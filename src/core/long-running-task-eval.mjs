import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { MessageStore } from "../lab02/message-store.mjs";
import { compactSession } from "../lab07/compaction.mjs";
import { ContextEconomyEngine } from "./context-economy.mjs";
import { evaluateCompactionQuality } from "./compaction-quality.mjs";
import {
  PlanStateMachine,
  createPlanStateMachineFixture,
} from "./plan-state-machine.mjs";

export const CORE21_LONG_RUNNING_TASK_EVAL_VERSION =
  "core21-long-running-task-eval-v1";

const LOCAL_COST_RATES = {
  uncachedInputPer1k: 0.001,
  cachedInputPer1k: 0.0002,
  outputPer1k: 0.002,
};

export function runLongRunningTaskEvalDemo() {
  const report = buildLongRunningTaskEvalReport();

  return {
    checks: verifyLongRunningTaskEvalDemo(report),
    report,
  };
}

export function buildLongRunningTaskEvalReport() {
  const store = new MessageStore();
  const sessionId = store.createSession({
    workspaceRoot: "/workspace/core-21-long-running-task-eval",
    mode: "execute",
  });
  store.appendUserMessage(
    sessionId,
    "修复分页边界问题，保持公开 API 不变；如果验证失败，继续定位并保留失败原因。",
  );

  const contextEngine = new ContextEconomyEngine({
    budget: 320,
    projectRules: "Preserve public APIs. Keep failure history. Verify before final.",
    memories: [
      {
        id: "pagination-boundary",
        score: 0.92,
        text: "Repeated pagination failures usually mean the next edit must be narrower and evidence-driven.",
      },
    ],
  });
  const planMachine = new PlanStateMachine();
  planMachine.propose(
    createPlanStateMachineFixture({
      id: "plan_core21",
      steps: [
        {
          id: "step_1",
          text: "Search pagination implementation",
          expectedTools: ["Search"],
        },
        {
          id: "step_2",
          text: "Read target file",
          expectedTools: ["Read"],
        },
        {
          id: "step_3",
          text: "Patch first boundary",
          expectedTools: ["Edit"],
        },
        {
          id: "step_4",
          text: "Run first verification",
          expectedTools: ["Bash"],
        },
      ],
    }),
  );
  planMachine.approve("plan_core21");

  const state = {
    objective: "Fix pagination boundary bug without changing the public API.",
    latestUserConstraints: [
      "Do not change the public API.",
      "Keep failure history across turns.",
    ],
    modifiedFiles: [],
    verificationState: {
      status: "not_run",
      command: "node scripts/test.cjs",
    },
    failureHistory: [],
    pendingActions: ["Search pagination implementation"],
    compactSummary: null,
    compactionArtifacts: [],
  };
  const turns = [];
  const compactionEvents = [];
  let previousContext = null;
  let machine = planMachine;

  executeStep({
    turn: 1,
    machine,
    store,
    sessionId,
    state,
    stepId: "step_1",
    toolName: "Search",
    input: { query: "pageSize + 1" },
    resultContent: {
      query: "pageSize + 1",
      matches: [
        {
          path: "src/pagination.cjs",
          lineNumber: 3,
          line: "return items.slice(start, start + pageSize + 1);",
        },
      ],
    },
    evidence: { query: "pageSize + 1" },
    onSuccess() {
      state.pendingActions = ["Read target file"];
    },
  });
  previousContext = recordTurn({
    turns,
    turn: 1,
    action: "search",
    machine,
    store,
    sessionId,
    state,
    contextEngine,
    previousContext,
    outputTokens: 38,
  });

  executeStep({
    turn: 2,
    machine,
    store,
    sessionId,
    state,
    stepId: "step_2",
    toolName: "Read",
    input: { path: "src/pagination.cjs" },
    resultContent: {
      path: "src/pagination.cjs",
      text: [
        "function paginate(items, page, pageSize) {",
        "  const start = (page - 1) * pageSize;",
        "  return items.slice(start, start + pageSize + 1);",
        "}",
      ].join("\n"),
    },
    evidence: { path: "src/pagination.cjs" },
    onSuccess() {
      state.pendingActions = ["Patch first boundary"];
    },
  });
  previousContext = recordTurn({
    turns,
    turn: 2,
    action: "read",
    machine,
    store,
    sessionId,
    state,
    contextEngine,
    previousContext,
    outputTokens: 42,
  });

  executeStep({
    turn: 3,
    machine,
    store,
    sessionId,
    state,
    stepId: "step_3",
    toolName: "Edit",
    input: {
      path: "src/pagination.cjs",
      old_string: "start + pageSize + 1",
      new_string: "start + pageSize",
    },
    resultContent: {
      path: "src/pagination.cjs",
      replacements: 1,
    },
    evidence: {
      path: "src/pagination.cjs",
      change: "remove extra item from first boundary",
    },
    onSuccess() {
      state.modifiedFiles = ["src/pagination.cjs"];
      state.pendingActions = ["Run first verification"];
    },
  });
  previousContext = recordTurn({
    turns,
    turn: 3,
    action: "patch_first_boundary",
    machine,
    store,
    sessionId,
    state,
    contextEngine,
    previousContext,
    outputTokens: 54,
  });

  executeFailedVerification({
    turn: 4,
    machine,
    store,
    sessionId,
    state,
    stepId: "step_4",
    stderr: "Expected page 2 to be [3,4], received [4,5].",
    reason: "verification_failed_after_first_patch",
    nextAction: "Revise plan to inspect page two boundary before editing again.",
  });
  previousContext = recordTurn({
    turns,
    turn: 4,
    action: "verification_failed_once",
    machine,
    store,
    sessionId,
    state,
    contextEngine,
    previousContext,
    outputTokens: 62,
  });

  machine.revisePlan({
    reason: "verification_failed_after_first_patch",
    userMessage: "继续，但不要改公开 API。",
    steps: [
      {
        id: "step_1",
        text: "Patch page two boundary only",
        expectedTools: ["Edit"],
      },
      {
        id: "step_2",
        text: "Rerun verification after second patch",
        expectedTools: ["Bash"],
      },
      {
        id: "step_3",
        text: "Patch empty page guard if failure repeats",
        expectedTools: ["Edit"],
      },
      {
        id: "step_4",
        text: "Run final verification",
        expectedTools: ["Bash"],
      },
    ],
  });
  state.pendingActions = ["Patch page two boundary only", "Rerun verification"];
  machine.startStep("step_1");
  appendToolTurn({
    turn: 5,
    store,
    sessionId,
    name: "Edit",
    input: {
      path: "src/pagination.cjs",
      old_string: "page * pageSize",
      new_string: "(page - 1) * pageSize",
    },
    status: "success",
    content: {
      path: "src/pagination.cjs",
      replacements: 1,
    },
  });
  machine.completeStep("step_1", {
    tool: "Edit",
    path: "src/pagination.cjs",
    change: "repair page two start boundary",
  });
  machine.startStep("step_2");

  const beforeCompaction = canonicalState({ machine, state });
  const compacted = compactSession({
    ...beforeCompaction,
    messages: store.buildModelMessageStream(sessionId),
    newerMessages: [],
  });
  const quality = evaluateCompactionQuality({
    before: beforeCompaction,
    compacted,
  });
  const restored = PlanStateMachine.restore({
    activePlan: compacted.compactSummary.activePlan,
    planTrace: machine.trace,
    planRevisionLog: machine.revisions,
  });
  machine = restored;
  state.compactSummary = compacted.compactSummary;
  state.compactionArtifacts = compacted.artifacts;
  compactionEvents.push({
    turn: 5,
    reason: "token_budget_pressure_after_repeated_context_growth",
    compactedMessageCount: store.buildModelMessageStream(sessionId).length,
    activeStepBefore: beforeCompaction.activePlan.currentStepId,
    restoredStepStatus: machine.findStep("step_2").status,
    quality,
    continuedAfterCompaction: true,
  });

  executeFailedVerification({
    turn: 5,
    machine,
    store,
    sessionId,
    state,
    stepId: "step_2",
    stderr: "Expected empty page to be [], received [5].",
    reason: "verification_failed_after_second_patch",
    nextAction: "Use restored plan step to patch the empty page guard.",
  });
  previousContext = recordTurn({
    turns,
    turn: 5,
    action: "compacted_then_failed_second_verification",
    machine,
    store,
    sessionId,
    state,
    contextEngine,
    previousContext,
    outputTokens: 70,
    compaction: compactionEvents[0],
  });

  machine.revisePlan({
    reason: "verification_failed_after_second_patch",
    userMessage: "继续修，但仍保持 API 不变。",
    steps: [
      {
        id: "step_1",
        text: "Patch empty page guard",
        expectedTools: ["Edit"],
      },
      {
        id: "step_2",
        text: "Run final verification",
        expectedTools: ["Bash"],
      },
    ],
  });
  executeStep({
    turn: 6,
    machine,
    store,
    sessionId,
    state,
    stepId: "step_1",
    toolName: "Edit",
    input: {
      path: "src/pagination.cjs",
      old_string: "return items.slice(start, end);",
      new_string: "return start >= items.length ? [] : items.slice(start, end);",
    },
    resultContent: {
      path: "src/pagination.cjs",
      replacements: 1,
    },
    evidence: {
      tool: "Edit",
      change: "empty page guard",
    },
    onSuccess() {
      state.pendingActions = ["Run final verification"];
    },
  });
  previousContext = recordTurn({
    turns,
    turn: 6,
    action: "patch_empty_page_guard",
    machine,
    store,
    sessionId,
    state,
    contextEngine,
    previousContext,
    outputTokens: 52,
  });

  executeStep({
    turn: 7,
    machine,
    store,
    sessionId,
    state,
    stepId: "step_2",
    toolName: "Bash",
    input: { command: "node scripts/test.cjs" },
    resultContent: {
      command: "node scripts/test.cjs",
      exitCode: 0,
      stdout: "pagination tests passed",
      stderr: "",
    },
    evidence: {
      tool: "Bash",
      command: "node scripts/test.cjs",
      exitCode: 0,
    },
    onSuccess() {
      state.verificationState = {
        status: "passed",
        command: "node scripts/test.cjs",
        exitCode: 0,
        stdout: "pagination tests passed",
        stderr: "",
      };
      state.pendingActions = [];
    },
  });
  previousContext = recordTurn({
    turns,
    turn: 7,
    action: "final_verification_passed",
    machine,
    store,
    sessionId,
    state,
    contextEngine,
    previousContext,
    outputTokens: 44,
  });

  const finalDecision = machine.finalAnswerDecision({
    verificationState: state.verificationState,
  });
  const costCurve = buildCostCurve(turns);
  const report = {
    version: CORE21_LONG_RUNNING_TASK_EVAL_VERSION,
    status: "passed",
    score: 1,
    failureType: null,
    turns,
    finalVerification: state.verificationState,
    finalDecision,
    failureHistory: state.failureHistory,
    compactionEvents,
    costCurve,
    learningHandoff: buildLearningHandoff({
      turns,
      failureHistory: state.failureHistory,
      compactionEvents,
      costCurve,
    }),
    boundary: {
      deterministicLocalEval: true,
      productionClaudeCodeClaim: false,
      productionLongRunningBenchmarkClaim: false,
      realProviderBillingClaim: false,
    },
  };

  return report;
}

export function evaluateLongRunningTaskEvalReport(report) {
  if (report.finalAnswer?.turn && report.finalVerification?.status !== "passed") {
    return {
      status: "failed",
      score: 0,
      failureType: "verification_missing",
      reason: "Final answer appeared before passed verification.",
    };
  }

  if (report.finalDecision?.allowed !== true) {
    return {
      status: "failed",
      score: 0,
      failureType: report.finalDecision?.error_type ?? "plan_incomplete",
      reason: report.finalDecision?.reason ?? "Plan did not allow final answer.",
    };
  }

  return {
    status: "passed",
    score: 1,
    failureType: null,
    reason: "Long-running task completed with passed verification.",
  };
}

export function createFalseFinalFixture() {
  return {
    version: CORE21_LONG_RUNNING_TASK_EVAL_VERSION,
    turns: [
      {
        turn: 1,
        action: "search",
      },
      {
        turn: 2,
        action: "premature_final",
      },
    ],
    finalAnswer: {
      turn: 2,
      content: "Done.",
    },
    finalVerification: null,
    finalDecision: {
      allowed: false,
      error_type: "verification_missing",
      reason: "No verification has passed.",
    },
  };
}

export function verifyLongRunningTaskEvalDemo(report) {
  const evaluation = evaluateLongRunningTaskEvalReport(report);

  assert.equal(report.version, CORE21_LONG_RUNNING_TASK_EVAL_VERSION);
  assert.equal(evaluation.status, "passed");
  assert.equal(report.turns.length, 7);
  assert.equal(report.finalVerification.status, "passed");
  assert.equal(report.finalDecision.allowed, true);
  assert.equal(report.failureHistory.length, 2);
  assert.equal(report.compactionEvents.length, 1);
  assert.equal(report.compactionEvents[0].quality.status, "passed");
  assert.equal(report.compactionEvents[0].restoredStepStatus, "resumed");
  assert.ok(report.costCurve.totalTokens > 0);
  assert.ok(report.costCurve.cacheHitTokens > 0);
  assert.equal(report.learningHandoff.length >= 4, true);
  assert.equal(report.boundary.productionLongRunningBenchmarkClaim, false);

  return {
    multi_turn_repair_passed: true,
    repeated_failures_preserved: true,
    compaction_resume_verified: true,
    cost_curve_recorded: true,
    learning_handoff_available: true,
    no_production_claim: true,
  };
}

function executeStep({
  turn,
  machine,
  store,
  sessionId,
  state,
  stepId,
  toolName,
  input,
  resultContent,
  evidence,
  onSuccess = null,
}) {
  machine.startStep(stepId);
  appendToolTurn({
    turn,
    store,
    sessionId,
    name: toolName,
    input,
    status: "success",
    content: resultContent,
  });
  if (onSuccess) onSuccess();
  machine.completeStep(stepId, evidence ?? { tool: toolName });
}

function executeFailedVerification({
  turn,
  machine,
  store,
  sessionId,
  state,
  stepId,
  stderr,
  reason,
  nextAction,
}) {
  appendToolTurn({
    turn,
    store,
    sessionId,
    name: "Bash",
    input: { command: "node scripts/test.cjs" },
    status: "error",
    content: {
      command: "node scripts/test.cjs",
      exitCode: 1,
      stdout: "",
      stderr,
    },
  });
  state.verificationState = {
    status: "failed",
    command: "node scripts/test.cjs",
    exitCode: 1,
    stderr,
  };
  state.failureHistory.push({
    turn,
    command: "node scripts/test.cjs",
    exitCode: 1,
    stderr,
    reason,
    nextAction,
    influencedNextAction: true,
  });
  state.pendingActions = [nextAction];
  machine.blockStep(stepId, reason, {
    command: "node scripts/test.cjs",
    stderr,
    nextAction,
  });
}

function appendToolTurn({ turn, store, sessionId, name, input, status, content }) {
  const callId = `core21_tool_call_${turn}_${name}`;
  store.appendAssistantToolCall(sessionId, {
    id: callId,
    name,
    input,
  });
  store.appendToolResult(sessionId, {
    id: `core21_tool_result_${turn}_${name}`,
    tool_call_id: callId,
    name,
    status,
    content,
  });
}

function recordTurn({
  turns,
  turn,
  action,
  machine,
  store,
  sessionId,
  state,
  contextEngine,
  previousContext,
  outputTokens,
  compaction = null,
}) {
  const context = contextEngine.build({
    sessionId,
    workspaceRoot: "/workspace/core-21-long-running-task-eval",
    turn,
    storeState: store.getState(sessionId),
    coreState: {
      activePlan: machine.snapshot().activePlan,
      modifiedFiles: state.modifiedFiles,
      verificationState: state.verificationState,
      compactSummary: state.compactSummary,
    },
    messages: store.buildModelMessageStream(sessionId),
    previousSnapshot: previousContext,
  });
  turns.push({
    turn,
    action,
    planId: machine.plan.id,
    planStatus: machine.plan.status,
    currentStepId: machine.plan.currentStepId,
    verificationStatus: state.verificationState.status,
    failureCount: state.failureHistory.length,
    pendingActions: [...state.pendingActions],
    context: {
      selectedBlockNames: context.blocks.map((block) => block.name),
      tokenEstimate: context.tokenEstimate,
      cacheHitTokens: context.cacheReport.cacheHitTokens,
      uncachedTailTokens: context.cacheReport.uncachedTailTokens,
      evictedBlockCount: context.evictionReport.length,
      artifactCount: context.artifacts.length,
    },
    outputTokens,
    compaction: compaction
      ? {
          reason: compaction.reason,
          restoredStepStatus: compaction.restoredStepStatus,
          qualityStatus: compaction.quality.status,
        }
      : null,
  });

  return context;
}

function canonicalState({ machine, state }) {
  return {
    objective: state.objective,
    latestUserConstraints: state.latestUserConstraints,
    activePlan: machine.snapshot().activePlan,
    modifiedFiles: state.modifiedFiles,
    latestFailures: state.failureHistory.map((failure) => failure.stderr),
    verificationState: state.verificationState,
    pendingActions: state.pendingActions,
  };
}

function buildCostCurve(turns) {
  const perTurn = turns.map((turn) => {
    const inputTokens = turn.context.tokenEstimate;
    const cachedInputTokens = turn.context.cacheHitTokens;
    const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    const estimatedCostUsd = roundUsd(
      (uncachedInputTokens / 1000) * LOCAL_COST_RATES.uncachedInputPer1k +
        (cachedInputTokens / 1000) * LOCAL_COST_RATES.cachedInputPer1k +
        (turn.outputTokens / 1000) * LOCAL_COST_RATES.outputPer1k,
    );

    return {
      turn: turn.turn,
      inputTokens,
      cachedInputTokens,
      uncachedInputTokens,
      outputTokens: turn.outputTokens,
      estimatedCostUsd,
    };
  });

  return {
    pricingTableId: "core21-local-deterministic-example",
    realProviderBillingClaim: false,
    perTurn,
    totalTokens: perTurn.reduce(
      (sum, turn) => sum + turn.inputTokens + turn.outputTokens,
      0,
    ),
    cacheHitTokens: perTurn.reduce((sum, turn) => sum + turn.cachedInputTokens, 0),
    estimatedCostUsd: roundUsd(
      perTurn.reduce((sum, turn) => sum + turn.estimatedCostUsd, 0),
    ),
  };
}

function buildLearningHandoff({ turns, failureHistory, compactionEvents, costCurve }) {
  return [
    `Ran ${turns.length} deterministic turns and finished with passed verification.`,
    `Preserved ${failureHistory.length} failed verification entries before the final pass.`,
    `Compacted at turn ${compactionEvents[0].turn} and restored active step as ${compactionEvents[0].restoredStepStatus}.`,
    `Tracked ${costCurve.totalTokens} total estimated tokens with ${costCurve.cacheHitTokens} cache-hit tokens.`,
    "Boundary: this is local eval evidence, not a production long-running benchmark.",
  ];
}

function roundUsd(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function main() {
  console.log(JSON.stringify(runLongRunningTaskEvalDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
