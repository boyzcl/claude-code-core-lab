import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { compactSession } from "../lab07/compaction.mjs";
import { MessageStore } from "../lab02/message-store.mjs";

export class CoreCompactor {
  constructor({ messageThreshold = 8, keepRecent = 4 } = {}) {
    this.messageThreshold = messageThreshold;
    this.keepRecent = keepRecent;
  }

  shouldCompact({ messages, coreState }) {
    return !coreState.compactSummary && messages.length >= this.messageThreshold;
  }

  compact({ messages, coreState }) {
    const splitAt = Math.max(0, messages.length - this.keepRecent);
    const olderMessages = messages.slice(0, splitAt);
    const newerMessages = messages.slice(splitAt);
    const compacted = compactSession({
      objective: latestUser(messages)?.content ?? "Continue current coding task.",
      latestUserConstraints: latestUser(messages) ? [latestUser(messages).content] : [],
      activePlan: coreState.activePlan,
      modifiedFiles: coreState.modifiedFiles,
      latestFailures: latestFailures(messages),
      verificationState: coreState.verificationState,
      pendingActions: pendingActions(coreState),
      messages: olderMessages.map(toCompactMessage),
      newerMessages,
    });

    return {
      ...compacted,
      compactedMessageCount: olderMessages.length,
    };
  }
}

export function applyCompactionToCoreState(coreState, compacted) {
  coreState.compactSummary = compacted.compactSummary;
  coreState.compactionArtifacts = compacted.artifacts;
  coreState.compaction = {
    compactedMessageCount: compacted.compactedMessageCount,
    newerMessageCount: compacted.newerMessages.length,
  };
}

export function runCompactionDemo() {
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot: "/workspace/core-05-demo" });
  store.appendUserMessage(sessionId, "修复分页问题，不要改变公开 API。");

  for (let index = 1; index <= 4; index += 1) {
    const callId = `tool_call_bash_${index}`;
    store.appendAssistantToolCall(sessionId, {
      id: callId,
      name: "Bash",
      input: {
        command: "node scripts/test.cjs",
      },
    });
    store.appendToolResult(sessionId, {
      id: `tool_result_bash_${index}`,
      tool_call_id: callId,
      name: "Bash",
      status: "error",
      content: {
        command: "node scripts/test.cjs",
        exitCode: 1,
        stdout: "",
        stderr: index === 4 ? "Expected 2 received 3" : "FAIL ".repeat(80),
      },
    });
  }

  const coreState = {
    activePlan: {
      id: "plan_001",
      status: "approved",
      steps: ["Read", "Edit", "Test"],
    },
    modifiedFiles: ["src/pagination.cjs"],
    verificationState: {
      status: "failed",
      command: "node scripts/test.cjs",
      exitCode: 1,
    },
  };
  const compactor = new CoreCompactor({ messageThreshold: 6, keepRecent: 3 });
  const messages = store.listMessages(sessionId);
  const compacted = compactor.compact({ messages, coreState });
  applyCompactionToCoreState(coreState, compacted);

  return {
    checks: verifyCompactionDemo({ compacted, coreState }),
    compacted,
    coreState,
  };
}

export function verifyCompactionDemo({ compacted, coreState }) {
  assert.equal(coreState.compactSummary.verificationState.status, "failed");
  assert.deepEqual(coreState.compactSummary.modifiedFiles, ["src/pagination.cjs"]);
  assert.equal(coreState.compactSummary.activePlan.id, "plan_001");
  assert.ok(coreState.compactionArtifacts.length >= 1);
  assert.ok(compacted.newerMessages.length > 0);

  return {
    failed_verification_preserved: true,
    modified_files_preserved: true,
    active_plan_preserved: true,
    long_output_artifacted: true,
    newer_messages_preserved: true,
  };
}

function latestUser(messages) {
  return [...messages].reverse().find((message) => message.type === "user");
}

function latestFailures(messages) {
  return messages
    .filter(
      (message) =>
        message.type === "tool_result" &&
        (message.status !== "success" ||
          (message.name === "Bash" && message.content?.exitCode !== 0)),
    )
    .slice(-3)
    .map((message) =>
      truncate(message.content?.stderr ?? message.error?.message ?? message.name, 160),
    );
}

function truncate(text, maxLength) {
  const value = String(text);
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function pendingActions(coreState) {
  if (coreState.verificationState?.status === "failed") {
    return ["Inspect latest failure", "Adjust implementation", "Rerun verification"];
  }

  return [];
}

function toCompactMessage(message) {
  if (message.type === "tool_result") {
    return {
      type: message.type,
      name: message.name,
      status: message.status,
      content: message.content?.stderr ?? message.content ?? message.error,
    };
  }

  return {
    type: message.type,
    content: message.content ?? message.tool_call ?? "",
  };
}

function main() {
  console.log(JSON.stringify(runCompactionDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
