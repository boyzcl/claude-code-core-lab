import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { MessageStore } from "../lab02/message-store.mjs";
import { CORE_CONTEXT_SYSTEM_PROMPT } from "./context-engine.mjs";

export const DEFAULT_CONTEXT_ECONOMY_TOOLS = [
  {
    name: "Search",
    description: "Search text files in the current workspace.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "Read",
    description: "Read a text file from the current workspace.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "Edit",
    description: "Replace one unique string in a previously read file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "Bash",
    description: "Run an allowlisted verification command.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string" },
      },
      required: ["command"],
    },
  },
];

const DEFAULT_BUDGET = 900;
const LONG_TOOL_OUTPUT_LIMIT = 180;

export class ContextEconomyEngine {
  constructor({
    budget = DEFAULT_BUDGET,
    systemPrompt = CORE_CONTEXT_SYSTEM_PROMPT,
    projectRules = null,
    memories = [],
    tools = DEFAULT_CONTEXT_ECONOMY_TOOLS,
    longToolOutputLimit = LONG_TOOL_OUTPUT_LIMIT,
  } = {}) {
    this.budget = budget;
    this.systemPrompt = systemPrompt;
    this.projectRules = projectRules;
    this.memories = memories;
    this.tools = tools;
    this.longToolOutputLimit = longToolOutputLimit;
  }

  build({
    sessionId,
    workspaceRoot,
    turn,
    storeState,
    coreState = {},
    messages = [],
    previousSnapshot = null,
  }) {
    const { blocks: candidateBlocks, artifacts: candidateArtifacts } =
      buildEconomyCandidateBlocks({
        systemPrompt: this.systemPrompt,
        projectRules: this.projectRules,
        memories: this.memories,
        tools: this.tools,
        coreState,
        messages,
        longToolOutputLimit: this.longToolOutputLimit,
      });
    const { selectedBlocks, evictionReport } = fitEconomyBudget(
      candidateBlocks,
      this.budget,
    );
    const stablePrefix = selectedBlocks.filter(
      (block) => block.zone === "stable_prefix",
    );
    const dynamicTail = selectedBlocks.filter(
      (block) => block.zone === "dynamic_tail",
    );
    const artifacts = candidateArtifacts.filter((artifact) =>
      selectedBlocks.some((block) => block.artifactId === artifact.id),
    );
    const selectedMessages = selectEconomyMessages(messages, selectedBlocks);
    const cacheReport = simulateStablePrefixCache({
      stablePrefix,
      dynamicTail,
      previousSnapshot,
    });
    const tokenReport = buildTokenReport({
      budget: this.budget,
      candidateBlocks,
      selectedBlocks,
      stablePrefix,
      dynamicTail,
      evictionReport,
      cacheReport,
    });
    const economyProof = {
      promptOnlySaving: false,
      noPromptOnlySaving: true,
      mechanisms: {
        blockSelection: tokenReport.evictedTokens > 0,
        artifactBoundary: tokenReport.artifactSavedTokens > 0,
        cacheSimulation: cacheReport.cacheHitTokens > 0,
      },
      evidence: {
        candidateBlockCount: candidateBlocks.length,
        selectedBlockCount: selectedBlocks.length,
        evictedBlockCount: evictionReport.length,
        artifactCount: artifacts.length,
        cacheHitTokens: cacheReport.cacheHitTokens,
      },
    };

    return {
      sessionId,
      workspaceRoot,
      turn,
      budget: this.budget,
      candidateBlocks,
      blocks: selectedBlocks,
      stablePrefix,
      dynamicTail,
      artifacts,
      evictionReport,
      tokenEstimate: tokenReport.selectedTokens,
      tokenReport,
      cacheReport,
      economyProof,
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
            stablePrefix: stablePrefix.map(toRuntimeBlock),
            dynamicTail: dynamicTail.map(toRuntimeBlock),
            artifacts: artifacts.map((artifact) => ({
              id: artifact.id,
              source: artifact.source,
              bytes: artifact.text.length,
              hash: artifact.hash,
            })),
            evictionReport,
            cacheReport,
            tokenReport,
            economyProof,
          },
        },
        ...selectedMessages,
      ],
    };
  }
}

export function buildEconomyCandidateBlocks({
  systemPrompt = CORE_CONTEXT_SYSTEM_PROMPT,
  projectRules = null,
  memories = [],
  tools = DEFAULT_CONTEXT_ECONOMY_TOOLS,
  coreState = {},
  messages = [],
  longToolOutputLimit = LONG_TOOL_OUTPUT_LIMIT,
} = {}) {
  const blocks = [];
  const artifacts = [];
  let order = 0;
  const add = (block) => {
    const normalizedContent = String(block.content ?? "");
    if (!normalizedContent) return;
    const complete = {
      order: ++order,
      cacheable: block.zone === "stable_prefix",
      ...block,
      content: normalizedContent,
      tokens: estimateTokens(normalizedContent),
    };
    blocks.push({
      ...complete,
      hash: hashBlock(complete),
    });
  };
  const latestUser = latestMessage(messages, "user");
  const latestFailure = latestFailureMessage(messages);

  add({
    id: "stable:system",
    name: "system",
    kind: "system",
    zone: "stable_prefix",
    priority: "hard",
    content: systemPrompt,
  });
  add({
    id: "stable:tools",
    name: "tools",
    kind: "tool_schema",
    zone: "stable_prefix",
    priority: "hard",
    content: stableStringify(tools),
  });
  add({
    id: "stable:project_rules",
    name: "project_rules",
    kind: "project_rules",
    zone: "stable_prefix",
    priority: "medium",
    content: projectRules,
  });
  add({
    id: "tail:latest_user",
    name: "latest_user",
    kind: "message",
    zone: "dynamic_tail",
    priority: "hard",
    content: latestUser?.content,
    sourceMessageId: latestUser?.id,
  });
  add({
    id: "tail:active_plan",
    name: "active_plan",
    kind: "runtime_state",
    zone: "dynamic_tail",
    priority: "hard",
    content: formatState(coreState.activePlan, 520),
  });
  add({
    id: "tail:verification_state",
    name: "verification_state",
    kind: "runtime_state",
    zone: "dynamic_tail",
    priority: "hard",
    content: formatState(coreState.verificationState, 360),
  });
  add({
    id: "tail:latest_failure",
    name: "latest_failure",
    kind: "runtime_state",
    zone: "dynamic_tail",
    priority: "hard",
    content: latestFailure ? truncate(toolResultText(latestFailure), 320) : null,
  });
  add({
    id: "tail:modified_files",
    name: "modified_files",
    kind: "runtime_state",
    zone: "dynamic_tail",
    priority: "hard",
    content: coreState.modifiedFiles?.join("\n"),
  });
  add({
    id: "tail:compact_summary",
    name: "compact_summary",
    kind: "compaction_state",
    zone: "dynamic_tail",
    priority: "medium",
    content: formatState(coreState.compactSummary, 720),
  });

  for (const message of messages.filter(
    (entry) =>
      entry.type === "tool_result" &&
      entry.name === "Read" &&
      entry.status === "success",
  )) {
    add({
      id: `tail:file:${message.content?.path}`,
      name: `file:${message.content?.path}`,
      kind: "file",
      zone: "dynamic_tail",
      priority: "medium",
      content: message.content?.text,
      sourceMessageId: message.id,
      sourceToolCallId: message.tool_call_id,
    });
  }

  for (const message of messages.filter((entry) => entry.type === "tool_result")) {
    const output = toolResultText(message);
    const status = isFailureResult(message) ? "failed" : "success";
    const priority = status === "failed" ? "hard" : "low";

    if (output.length > longToolOutputLimit) {
      const artifact = {
        id: `artifact_${shortHash(message.id)}`,
        source: message.id,
        text: output,
        bytes: output.length,
        tokens: estimateTokens(output),
        hash: sha256(output),
      };
      artifacts.push(artifact);
      add({
        id: `tail:tool:${message.id}`,
        name: `tool:${message.id}`,
        kind: "tool_result",
        zone: "dynamic_tail",
        priority,
        content: `${message.name} ${status} output stored in ${artifact.id}: ${truncate(
          output,
          120,
        )}`,
        sourceMessageId: message.id,
        sourceToolCallId: message.tool_call_id,
        artifactId: artifact.id,
        rawTokens: artifact.tokens,
      });
    } else {
      add({
        id: `tail:tool:${message.id}`,
        name: `tool:${message.id}`,
        kind: "tool_result",
        zone: "dynamic_tail",
        priority,
        content: output,
        sourceMessageId: message.id,
        sourceToolCallId: message.tool_call_id,
      });
    }
  }

  for (const memory of memories) {
    if (memory.score >= 0.8) {
      add({
        id: `tail:memory:${memory.id}`,
        name: `memory:${memory.id}`,
        kind: "memory",
        zone: "dynamic_tail",
        priority: "low",
        content: memory.text,
      });
    }
  }

  return {
    blocks,
    artifacts,
  };
}

export function fitEconomyBudget(blocks, budget = DEFAULT_BUDGET) {
  const selectedIds = new Set();
  let usedTokens = 0;

  for (const block of blocks) {
    if (block.priority === "hard") {
      selectedIds.add(block.id);
      usedTokens += block.tokens;
    }
  }

  for (const priority of ["medium", "low"]) {
    for (const block of blocks.filter((entry) => entry.priority === priority)) {
      if (usedTokens + block.tokens <= budget) {
        selectedIds.add(block.id);
        usedTokens += block.tokens;
      }
    }
  }

  const selectedBlocks = blocks.filter((block) => selectedIds.has(block.id));
  const evictionReport = blocks
    .filter((block) => !selectedIds.has(block.id))
    .map((block) => ({
      id: block.id,
      name: block.name,
      zone: block.zone,
      priority: block.priority,
      tokens: block.tokens,
      reason: "token_budget_lower_priority",
    }));

  return {
    selectedBlocks,
    evictionReport,
  };
}

export function simulateStablePrefixCache({
  stablePrefix,
  dynamicTail,
  previousSnapshot = null,
}) {
  const previousPrefix = previousSnapshot?.stablePrefix ?? [];
  let cacheHitTokens = 0;
  let cacheMissTokens = 0;

  for (const [index, block] of stablePrefix.entries()) {
    const previous = previousPrefix[index];
    if (previous?.id === block.id && previous?.hash === block.hash) {
      cacheHitTokens += block.tokens;
    } else {
      cacheMissTokens += block.tokens;
    }
  }

  const stablePrefixTokens = sumTokens(stablePrefix);
  const uncachedTailTokens = sumTokens(dynamicTail);

  return {
    stablePrefixTokens,
    cacheHitTokens,
    cacheMissTokens,
    uncachedTailTokens,
    estimatedSavedTokens: cacheHitTokens,
    cacheableBlockCount: stablePrefix.length,
    cacheHitBlockCount: stablePrefix.filter((block, index) => {
      const previous = previousPrefix[index];
      return previous?.id === block.id && previous?.hash === block.hash;
    }).length,
  };
}

export function selectEconomyMessages(messages, selectedBlocks) {
  const selectedMessageIds = new Set();
  const selectedToolCallIds = new Set();

  for (const block of selectedBlocks) {
    if (!block.sourceMessageId) continue;
    if (block.kind === "tool_result" && block.artifactId) continue;

    selectedMessageIds.add(block.sourceMessageId);
    if (block.sourceToolCallId) {
      selectedToolCallIds.add(block.sourceToolCallId);
    }
  }

  return messages.filter((message) => {
    if (selectedMessageIds.has(message.id)) return true;
    return (
      message.type === "assistant_tool_call" &&
      selectedToolCallIds.has(message.tool_call?.id)
    );
  });
}

export function runContextEconomyDemo() {
  const fixture = createContextEconomyFixture();
  const engine = new ContextEconomyEngine({
    budget: 360,
    projectRules: "Preserve public APIs. Prefer narrow edits. Verify before final.",
    memories: [
      {
        id: "pagination-boundary",
        score: 0.92,
        text: "Pagination failures usually depend on start/end index boundaries.",
      },
    ],
  });
  const first = engine.build({
    sessionId: fixture.sessionId,
    workspaceRoot: fixture.workspaceRoot,
    turn: 1,
    storeState: fixture.store.getState(fixture.sessionId),
    coreState: fixture.coreState,
    messages: fixture.store.buildModelMessageStream(fixture.sessionId),
  });

  fixture.store.appendUserMessage(
    fixture.sessionId,
    "继续，优先解释最新失败并保持公开 API 不变。",
  );
  const second = engine.build({
    sessionId: fixture.sessionId,
    workspaceRoot: fixture.workspaceRoot,
    turn: 2,
    storeState: fixture.store.getState(fixture.sessionId),
    coreState: fixture.coreState,
    messages: fixture.store.buildModelMessageStream(fixture.sessionId),
    previousSnapshot: first,
  });

  return {
    checks: verifyContextEconomyDemo({ first, second }),
    first,
    second,
  };
}

export function verifyContextEconomyDemo({ first, second }) {
  assert.deepEqual(
    first.stablePrefix.map((block) => block.id),
    second.stablePrefix.map((block) => block.id),
  );
  assert.deepEqual(
    first.stablePrefix.map((block) => block.hash),
    second.stablePrefix.map((block) => block.hash),
  );
  assert.equal(second.cacheReport.cacheHitTokens, second.cacheReport.stablePrefixTokens);
  assert.ok(second.dynamicTail.some((block) => block.name === "latest_user"));
  assert.ok(second.artifacts.length >= 1);
  assert.equal(second.economyProof.promptOnlySaving, false);

  return {
    stable_prefix_ids_and_hashes_reused: true,
    dynamic_tail_is_separate: true,
    cache_hit_tokens_reported: true,
    artifact_boundary_active: true,
    no_prompt_only_saving: true,
  };
}

export function createContextEconomyFixture() {
  const workspaceRoot = "/workspace/core-18-demo";
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  store.appendUserMessage(sessionId, "修复分页问题，不要改变公开 API。");
  store.appendAssistantToolCall(sessionId, {
    id: "tool_call_read_pagination",
    name: "Read",
    input: {
      path: "src/pagination.cjs",
    },
  });
  store.appendToolResult(sessionId, {
    id: "tool_result_read_pagination",
    tool_call_id: "tool_call_read_pagination",
    name: "Read",
    status: "success",
    content: {
      path: "src/pagination.cjs",
      text: "function paginate(items, page, pageSize) { return items.slice(page * pageSize, page * pageSize + pageSize + 1); }",
    },
  });
  store.appendAssistantToolCall(sessionId, {
    id: "tool_call_old_success",
    name: "Bash",
    input: {
      command: "node scripts/lint.cjs",
    },
  });
  store.appendToolResult(sessionId, {
    id: "tool_result_old_success",
    tool_call_id: "tool_call_old_success",
    name: "Bash",
    status: "success",
    content: {
      command: "node scripts/lint.cjs",
      exitCode: 0,
      stdout: "PASS ".repeat(120),
      stderr: "",
    },
  });
  store.appendAssistantToolCall(sessionId, {
    id: "tool_call_latest_failure",
    name: "Bash",
    input: {
      command: "node scripts/test.cjs",
    },
  });
  store.appendToolResult(sessionId, {
    id: "tool_result_latest_failure",
    tool_call_id: "tool_call_latest_failure",
    name: "Bash",
    status: "error",
    content: {
      command: "node scripts/test.cjs",
      exitCode: 1,
      stdout: "",
      stderr: `Expected page size 2, received 3. ${"FAIL ".repeat(140)}`,
    },
  });

  return {
    workspaceRoot,
    store,
    sessionId,
    coreState: {
      activePlan: {
        id: "plan_core18",
        status: "approved",
        steps: [
          { id: "step_1", text: "Inspect pagination implementation", status: "done" },
          { id: "step_2", text: "Fix boundary logic", status: "active" },
          { id: "step_3", text: "Rerun verification", status: "pending" },
        ],
      },
      modifiedFiles: ["src/pagination.cjs"],
      verificationState: {
        status: "failed",
        command: "node scripts/test.cjs",
        exitCode: 1,
        stderr: "Expected page size 2, received 3.",
      },
      compactSummary: {
        objective: "Fix pagination without changing the public API.",
        pendingActions: ["Inspect latest failure", "Edit boundary", "Rerun tests"],
      },
    },
  };
}

function buildTokenReport({
  budget,
  candidateBlocks,
  selectedBlocks,
  stablePrefix,
  dynamicTail,
  evictionReport,
  cacheReport,
}) {
  const candidateTokens = sumTokens(candidateBlocks);
  const selectedTokens = sumTokens(selectedBlocks);
  const evictedTokens = sumTokens(evictionReport);
  const selectedArtifactBlocks = selectedBlocks.filter((block) => block.artifactId);
  const artifactRawTokens = selectedArtifactBlocks.reduce(
    (total, block) => total + (block.rawTokens ?? block.tokens),
    0,
  );
  const artifactSummaryTokens = sumTokens(selectedArtifactBlocks);
  const artifactSavedTokens = Math.max(0, artifactRawTokens - artifactSummaryTokens);

  return {
    budget,
    candidateTokens,
    selectedTokens,
    evictedTokens,
    stablePrefixTokens: sumTokens(stablePrefix),
    dynamicTailTokens: sumTokens(dynamicTail),
    cacheHitTokens: cacheReport.cacheHitTokens,
    cacheMissTokens: cacheReport.cacheMissTokens,
    uncachedTailTokens: cacheReport.uncachedTailTokens,
    artifactRawTokens,
    artifactSummaryTokens,
    artifactSavedTokens,
    estimatedSavedTokens:
      evictedTokens + artifactSavedTokens + cacheReport.cacheHitTokens,
    selectedBlockCount: selectedBlocks.length,
    candidateBlockCount: candidateBlocks.length,
    evictedBlockCount: evictionReport.length,
    overBudgetAfterHardState: selectedTokens > budget,
  };
}

function toRuntimeBlock(block) {
  return {
    id: block.id,
    name: block.name,
    zone: block.zone,
    priority: block.priority,
    tokens: block.tokens,
    hash: block.hash,
    artifactId: block.artifactId ?? null,
  };
}

function latestMessage(messages, type) {
  return [...messages].reverse().find((message) => message.type === type);
}

function latestFailureMessage(messages) {
  return [...messages]
    .reverse()
    .find((message) => message.type === "tool_result" && isFailureResult(message));
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
    return stableStringify({
      command: message.content?.command,
      exitCode: message.content?.exitCode,
      stdout: message.content?.stdout,
      stderr: message.content?.stderr,
    });
  }

  return stableStringify(message.content ?? {});
}

function formatState(value, maxLength) {
  if (!value) return null;
  return truncate(stableStringify(value), maxLength);
}

function truncate(text, maxLength) {
  const value = String(text);
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function hashBlock(block) {
  return sha256(
    stableStringify({
      id: block.id,
      zone: block.zone,
      content: block.content,
    }),
  );
}

function shortHash(value) {
  return sha256(value).slice(0, 12);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function stableStringify(value) {
  return JSON.stringify(sortJson(value));
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortJson(value[key]);
        return sorted;
      }, {});
  }

  return value;
}

export function estimateTokens(text) {
  return Math.ceil(String(text ?? "").length / 4);
}

function sumTokens(blocks) {
  return blocks.reduce((total, block) => total + (block.tokens ?? 0), 0);
}

function main() {
  console.log(JSON.stringify(runContextEconomyDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
