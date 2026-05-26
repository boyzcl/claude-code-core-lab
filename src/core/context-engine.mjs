import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { buildContext } from "../lab05/context-engine.mjs";
import { MessageStore } from "../lab02/message-store.mjs";

export const CORE_CONTEXT_SYSTEM_PROMPT =
  "You are a local coding agent. Use tools to inspect, edit narrowly, and verify before final answer.";

export class CoreContextEngine {
  constructor({
    budget = 4000,
    systemPrompt = CORE_CONTEXT_SYSTEM_PROMPT,
    activePlan = null,
    projectRules = null,
    memories = [],
  } = {}) {
    this.budget = budget;
    this.systemPrompt = systemPrompt;
    this.activePlan = activePlan;
    this.projectRules = projectRules;
    this.memories = memories;
  }

  build({ sessionId, workspaceRoot, turn, storeState, coreState, messages }) {
    const input = toContextInput({
      systemPrompt: this.systemPrompt,
      activePlan: this.activePlan,
      projectRules: this.projectRules,
      memories: this.memories,
      storeState,
      coreState,
      messages,
    });
    const context = buildContext(input, { budget: this.budget });
    const selectedMessages = selectMessagesForContext(messages, context);

    return {
      sessionId,
      workspaceRoot,
      turn,
      blocks: context.blocks,
      artifacts: context.artifacts,
      tokenEstimate: context.tokenEstimate,
      selectedMessages,
      messages: [
        {
          role: "system",
          content: this.systemPrompt,
        },
        {
          role: "runtime",
          content: {
            storeState,
            coreState,
            contextBlocks: context.blocks,
            artifacts: context.artifacts.map((artifact) => ({
              id: artifact.id,
              source: artifact.source,
              bytes: artifact.text.length,
            })),
          },
        },
        ...selectedMessages,
      ],
    };
  }
}

export function toContextInput({
  systemPrompt = CORE_CONTEXT_SYSTEM_PROMPT,
  activePlan = null,
  projectRules = null,
  memories = [],
  storeState,
  coreState,
  messages,
}) {
  const latestUser = latestMessage(messages, "user");
  const readFiles = messages
    .filter(
      (message) =>
        message.type === "tool_result" &&
        message.name === "Read" &&
        message.status === "success",
    )
    .map((message) => ({
      path: message.content.path,
      include: true,
      text: message.content.text,
    }));

  const toolResults = messages
    .filter((message) => message.type === "tool_result")
    .map((message) => ({
      id: message.id,
      status: isFailureResult(message) ? "failed" : "success",
      output: toolResultText(message),
    }));

  return {
    systemPrompt,
    mode: storeState?.mode ?? "normal",
    latestUserMessage: latestUser?.content,
    activePlan: activePlan ?? formatActivePlan(coreState?.activePlan),
    modifiedFiles: coreState?.modifiedFiles ?? [],
    verificationState: formatVerificationState(coreState?.verificationState),
    latestFailure: formatLatestFailure(messages),
    projectRules: coreState?.compactSummary
      ? {
          enabled: true,
          text: formatCompactSummary(coreState.compactSummary),
        }
      : projectRules
        ? {
            enabled: true,
            text: projectRules,
          }
        : null,
    readFiles,
    toolResults,
    memories,
  };
}

export function selectMessagesForContext(messages, context) {
  const selectedIds = new Set();
  const selectedToolResultIds = new Set();
  const artifactSources = new Set(context.artifacts.map((artifact) => artifact.source));
  const selectedFiles = new Set();
  const latestUser = latestMessage(messages, "user");

  if (latestUser) {
    selectedIds.add(latestUser.id);
  }

  for (const block of context.blocks) {
    if (block.name.startsWith("tool:")) {
      const resultId = block.name.slice("tool:".length);
      if (!artifactSources.has(resultId)) {
        selectedToolResultIds.add(resultId);
      }
    }

    if (block.name.startsWith("file:")) {
      selectedFiles.add(block.name.slice("file:".length));
    }
  }

  for (const message of messages) {
    if (selectedToolResultIds.has(message.id)) {
      selectedIds.add(message.id);
      selectedIds.add(toolCallMessageId(messages, message.tool_call_id));
    }

    if (
      message.type === "tool_result" &&
      message.name === "Read" &&
      selectedFiles.has(message.content?.path)
    ) {
      selectedIds.add(message.id);
      selectedIds.add(toolCallMessageId(messages, message.tool_call_id));
    }
  }

  return messages.filter((message) => selectedIds.has(message.id));
}

export function runContextEngineDemo() {
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot: "/workspace/core-03-demo" });
  store.appendUserMessage(sessionId, "请修复分页问题，但不要改变公开 API。");
  store.appendAssistantToolCall(sessionId, {
    id: "tool_call_read_001",
    name: "Read",
    input: {
      path: "src/pagination.cjs",
    },
  });
  store.appendToolResult(sessionId, {
    id: "tool_result_read_001",
    tool_call_id: "tool_call_read_001",
    name: "Read",
    status: "success",
    content: {
      path: "src/pagination.cjs",
      text: "return items.slice(start, start + pageSize + 1);",
    },
  });
  store.appendAssistantToolCall(sessionId, {
    id: "tool_call_bash_001",
    name: "Bash",
    input: {
      command: "node scripts/test.cjs",
    },
  });
  store.appendToolResult(sessionId, {
    id: "tool_result_bash_001",
    tool_call_id: "tool_call_bash_001",
    name: "Bash",
    status: "error",
    content: {
      command: "node scripts/test.cjs",
      exitCode: 1,
      stdout: "",
      stderr: "FAIL ".repeat(80),
    },
  });

  const engine = new CoreContextEngine({
    budget: 130,
    activePlan: "1. Read pagination\n2. Edit narrowly\n3. Run tests",
  });
  const result = engine.build({
    sessionId,
    workspaceRoot: "/workspace/core-03-demo",
    turn: 3,
    storeState: store.getState(sessionId),
    coreState: {
      modifiedFiles: ["src/pagination.cjs"],
      verificationState: {
        status: "failed",
        command: "node scripts/test.cjs",
        exitCode: 1,
        stderr: "pagination failure",
      },
      finalAnswer: null,
    },
    messages: store.buildModelMessageStream(sessionId),
  });

  return {
    checks: verifyContextEngineDemo(result),
    ...result,
  };
}

export function verifyContextEngineDemo(result) {
  const blockNames = result.blocks.map((block) => block.name);
  const selectedText = JSON.stringify(result.selectedMessages);

  assert.ok(blockNames.includes("latest_user"));
  assert.ok(blockNames.includes("active_plan"));
  assert.ok(blockNames.includes("verification_state"));
  assert.ok(blockNames.includes("latest_failure"));
  assert.ok(result.artifacts.length >= 1);
  assert.doesNotMatch(selectedText, /FAIL FAIL FAIL FAIL FAIL FAIL FAIL FAIL/);

  return {
    latest_user_preserved: true,
    active_plan_preserved: true,
    verification_state_preserved: true,
    latest_failure_preserved: true,
    long_output_artifacted: true,
    raw_long_output_not_selected: true,
  };
}

function latestMessage(messages, type) {
  return [...messages].reverse().find((message) => message.type === type);
}

function toolCallMessageId(messages, toolCallId) {
  return messages.find(
    (message) =>
      message.type === "assistant_tool_call" && message.tool_call.id === toolCallId,
  )?.id;
}

function isFailureResult(message) {
  return (
    message.status !== "success" ||
    (message.name === "Bash" && message.content?.exitCode !== 0)
  );
}

function toolResultText(message) {
  if (message.error) {
    return [
      `error_type=${message.error.error_type}`,
      `message=${message.error.message}`,
      message.error.recommended_next_tool
        ? `recommended_next_tool=${message.error.recommended_next_tool}`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (message.name === "Search") {
    const matches = message.content?.matches ?? [];
    return [
      `query=${message.content?.query}`,
      `matches=${matches
        .map((match) => `${match.path}:${match.lineNumber}`)
        .join(", ")}`,
    ].join(" ");
  }

  if (message.name === "Bash") {
    return JSON.stringify({
      command: message.content?.command,
      exitCode: message.content?.exitCode,
      stdout: message.content?.stdout,
      stderr: message.content?.stderr,
    });
  }

  return JSON.stringify(message.content ?? {});
}

function formatVerificationState(state) {
  if (!state) return null;
  return truncate(JSON.stringify(state), 240);
}

function formatActivePlan(plan) {
  if (!plan) return null;
  return truncate(JSON.stringify(plan), 360);
}

function formatCompactSummary(summary) {
  return truncate(`compact_summary=${JSON.stringify(summary)}`, 600);
}

function formatLatestFailure(messages) {
  const failure = [...messages]
    .reverse()
    .find((message) => message.type === "tool_result" && isFailureResult(message));

  if (!failure) return null;
  return truncate(toolResultText(failure), 240);
}

function truncate(text, maxLength) {
  const value = String(text);
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function main() {
  console.log(JSON.stringify(runContextEngineDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
