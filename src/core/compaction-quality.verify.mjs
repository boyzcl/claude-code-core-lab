import assert from "node:assert/strict";
import {
  CORE19_COMPACTION_QUALITY_VERSION,
  createBadCompactionFixture,
  createCompactionQualityInput,
  evaluateCompactionQuality,
  runCompactionQualityDemo,
  verifyCompactionQualityDemo,
} from "./compaction-quality.mjs";
import { compactSession } from "../lab07/compaction.mjs";

const cases = [];

await record("core19: compaction quality demo runs and verifies", () => {
  const result = runCompactionQualityDemo();
  return verifyCompactionQualityDemo(result.report);
});

await record("objective preservation: compacted objective does not drift", () => {
  const { before, report } = goodReport();
  const check = findCheck(report, "objective_preservation");

  assert.equal(check.passed, true);
  assert.equal(report.diff.objective.before, before.objective);
  assert.equal(report.diff.objective.after, before.objective);

  return {
    objective_preserved: true,
    objective: before.objective,
  };
});

await record("constraint preservation: user and safety constraints remain complete", () => {
  const { before, report } = goodReport();
  const check = findCheck(report, "constraint_preservation");

  assert.equal(check.passed, true);
  assert.deepEqual(report.diff.constraints.missing, []);
  assert.deepEqual(report.diff.constraints.extra, []);
  assert.ok(
    before.latestUserConstraints.includes(
      "Safety: only run allowlisted verification commands.",
    ),
  );

  return {
    constraints_preserved: before.latestUserConstraints,
    missing_constraints: report.diff.constraints.missing,
  };
});

await record("failure preservation: failed verification cannot become passed", () => {
  const { before, report } = goodReport();
  const check = findCheck(report, "failure_preservation");

  assert.equal(check.passed, true);
  assert.equal(before.verificationState.status, "failed");
  assert.equal(report.diff.verificationState.after.status, "failed");

  return {
    failed_verification_preserved: true,
    command: before.verificationState.command,
  };
});

await record("plan preservation: active plan id, steps, and status survive", () => {
  const { before, report } = goodReport();
  const check = findCheck(report, "plan_preservation");

  assert.equal(check.passed, true);
  assert.equal(report.diff.activePlan.after.id, before.activePlan.id);
  assert.deepEqual(
    report.diff.activePlan.after.steps.map((step) => step.status),
    ["done", "active", "pending"],
  );

  return {
    plan_id: report.diff.activePlan.after.id,
    step_statuses: report.diff.activePlan.after.steps.map((step) => step.status),
  };
});

await record("modified files: file path and reason remain traceable", () => {
  const { report } = goodReport();
  const check = findCheck(report, "modified_files_preservation");

  assert.equal(check.passed, true);
  assert.deepEqual(report.diff.modifiedFiles.after, [
    {
      path: "src/pagination.cjs",
      reason: "Remove the extra item returned by page slicing.",
    },
  ]);

  return {
    modified_files: report.diff.modifiedFiles.after,
  };
});

await record("pending actions: next actions remain available after compact", () => {
  const { before, report } = goodReport();
  const check = findCheck(report, "pending_actions_preservation");

  assert.equal(check.passed, true);
  assert.deepEqual(report.diff.pendingActions.after, before.pendingActions);

  return {
    pending_actions: report.diff.pendingActions.after,
  };
});

await record("quality score: bad summary is identified as compaction_loss", () => {
  const { report } = createBadCompactionFixture();

  assert.equal(report.status, "failed");
  assert.equal(report.failureType, "compaction_loss");
  assert.ok(report.score < 1);
  assert.ok(report.failedChecks.includes("objective_preservation"));
  assert.ok(report.failedChecks.includes("failure_preservation"));
  assert.equal(report.recommendedAction, "repair_or_rerun_compaction_before_restore");

  return {
    status: report.status,
    score: report.score,
    failureType: report.failureType,
    failedChecks: report.failedChecks,
  };
});

await record("boundary: quality eval is local evidence, not production claim", () => {
  const { report } = goodReport();

  assert.equal(report.version, CORE19_COMPACTION_QUALITY_VERSION);
  assert.equal(report.boundary.deterministicLocalEval, true);
  assert.equal(report.boundary.productionClaudeCodeClaim, false);
  assert.equal(report.boundary.promptOnlySummaryClaim, false);

  return {
    deterministic_local_eval: true,
    no_production_claude_code_claim: true,
    no_prompt_only_summary_claim: true,
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

function goodReport() {
  const before = createCompactionQualityInput();
  const compacted = compactSession(before);
  const report = evaluateCompactionQuality({ before, compacted });

  return {
    before,
    compacted,
    report,
  };
}

function findCheck(report, name) {
  const check = report.checks.find((entry) => entry.name === name);
  assert.ok(check, `Missing check ${name}`);
  return check;
}
