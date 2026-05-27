import assert from "node:assert/strict";
import {
  CORE21_LONG_RUNNING_TASK_EVAL_VERSION,
  buildLongRunningTaskEvalReport,
  createFalseFinalFixture,
  evaluateLongRunningTaskEvalReport,
  runLongRunningTaskEvalDemo,
  verifyLongRunningTaskEvalDemo,
} from "./long-running-task-eval.mjs";

const cases = [];

await record("core21: long-running task eval demo runs and verifies", () => {
  const result = runLongRunningTaskEvalDemo();
  return verifyLongRunningTaskEvalDemo(result.report);
});

await record("multi-turn repair: state continues until final verification passes", () => {
  const report = buildLongRunningTaskEvalReport();
  const evaluation = evaluateLongRunningTaskEvalReport(report);

  assert.equal(report.turns.length, 7);
  assert.equal(report.finalVerification.status, "passed");
  assert.equal(report.finalDecision.allowed, true);
  assert.equal(evaluation.status, "passed");

  return {
    turn_count: report.turns.length,
    final_verification: report.finalVerification.status,
    final_allowed: report.finalDecision.allowed,
  };
});

await record("repeated failure: two failures remain in history and steer next action", () => {
  const report = buildLongRunningTaskEvalReport();

  assert.equal(report.failureHistory.length, 2);
  assert.deepEqual(
    report.failureHistory.map((failure) => failure.exitCode),
    [1, 1],
  );
  assert.equal(
    report.failureHistory.every((failure) => failure.influencedNextAction),
    true,
  );
  assert.match(report.failureHistory[0].nextAction, /Revise plan/);
  assert.match(report.failureHistory[1].nextAction, /restored plan step/);

  return {
    failure_count: report.failureHistory.length,
    next_actions: report.failureHistory.map((failure) => failure.nextAction),
  };
});

await record("compaction under pressure: active step survives and resumes", () => {
  const report = buildLongRunningTaskEvalReport();
  const event = report.compactionEvents[0];
  const turn = report.turns.find((entry) => entry.turn === event.turn);

  assert.equal(event.quality.status, "passed");
  assert.equal(event.activeStepBefore, "step_2");
  assert.equal(event.restoredStepStatus, "resumed");
  assert.equal(event.continuedAfterCompaction, true);
  assert.equal(turn.compaction.qualityStatus, "passed");

  return {
    compaction_turn: event.turn,
    active_step_before: event.activeStepBefore,
    restored_step_status: event.restoredStepStatus,
  };
});

await record("cost curve: every turn has token and configured cost basis", () => {
  const report = buildLongRunningTaskEvalReport();

  assert.equal(report.costCurve.perTurn.length, report.turns.length);
  assert.ok(report.costCurve.totalTokens > 0);
  assert.ok(report.costCurve.cacheHitTokens > 0);
  assert.ok(report.costCurve.estimatedCostUsd > 0);
  assert.equal(report.costCurve.realProviderBillingClaim, false);

  return {
    per_turn_count: report.costCurve.perTurn.length,
    total_tokens: report.costCurve.totalTokens,
    cache_hit_tokens: report.costCurve.cacheHitTokens,
    estimated_cost_usd: report.costCurve.estimatedCostUsd,
  };
});

await record("no false final: premature final is attributed to verification_missing", () => {
  const evaluation = evaluateLongRunningTaskEvalReport(createFalseFinalFixture());

  assert.equal(evaluation.status, "failed");
  assert.equal(evaluation.failureType, "verification_missing");

  return {
    premature_final_blocked: true,
    failure_type: evaluation.failureType,
  };
});

await record("learning handoff: summary explains continue, compact, resume, and cost", () => {
  const report = buildLongRunningTaskEvalReport();
  const text = report.learningHandoff.join("\n");

  assert.match(text, /failed verification/);
  assert.match(text, /Compacted/);
  assert.match(text, /restored active step/);
  assert.match(text, /estimated tokens/);

  return {
    handoff_lines: report.learningHandoff.length,
    includes_failure_compaction_resume_cost: true,
  };
});

await record("boundary: long-running eval is local evidence, not production claim", () => {
  const report = buildLongRunningTaskEvalReport();

  assert.equal(report.version, CORE21_LONG_RUNNING_TASK_EVAL_VERSION);
  assert.equal(report.boundary.deterministicLocalEval, true);
  assert.equal(report.boundary.productionClaudeCodeClaim, false);
  assert.equal(report.boundary.productionLongRunningBenchmarkClaim, false);
  assert.equal(report.boundary.realProviderBillingClaim, false);

  return {
    deterministic_local_eval: true,
    no_production_claude_code_claim: true,
    no_real_provider_billing_claim: true,
  };
});

console.log(JSON.stringify({ passed: cases.length, cases }, null, 2));

async function record(name, fn) {
  try {
    cases.push({
      name,
      status: "passed",
      details: await fn(),
    });
  } catch (error) {
    cases.push({
      name,
      status: "failed",
      message: error.message,
    });
    throw error;
  }
}
