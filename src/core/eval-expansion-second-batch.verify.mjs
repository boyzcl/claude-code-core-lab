import assert from "node:assert/strict";
import {
  CORE12_SELECTED_STARTER_CASES,
  runEvalExpansionSecondBatchDemo,
  secondBatchExecutableRepoSeeds,
  verifyEvalExpansionSecondBatchReport,
} from "./eval-expansion-second-batch.mjs";
import { CORE11_SELECTED_STARTER_CASES } from "./eval-expansion.mjs";

const cases = [];
const demo = await runEvalExpansionSecondBatchDemo();
const report = {
  ...demo,
};
delete report.checks;

await record("core12: second executable seed batch runs and verifies", async () => {
  return verifyEvalExpansionSecondBatchReport(report);
});

await record("seed contract: second batch binds to unmigrated Core 10 cases", async () => {
  const seeds = secondBatchExecutableRepoSeeds();
  const overlap = CORE12_SELECTED_STARTER_CASES.filter((id) =>
    CORE11_SELECTED_STARTER_CASES.includes(id),
  );

  assert.equal(seeds.length, 5);
  assert.deepEqual(
    seeds.map((seed) => seed.starterCaseId),
    CORE12_SELECTED_STARTER_CASES,
  );
  assert.deepEqual(overlap, []);
  assert.equal(seeds.every((seed) => seed.createWorkspace), true);
  assert.equal(seeds.every((seed) => seed.requiredChecks.length > 0), true);

  return {
    selected_seed_count: seeds.length,
    no_first_batch_overlap: true,
    required_checks_declared: true,
  };
});

await record("coverage: executable starter coverage is now 10 of 20", async () => {
  assert.equal(report.executableStarterCoverage.starterTotal, 20);
  assert.equal(report.executableStarterCoverage.cumulativeCount, 10);
  assert.equal(
    new Set(report.executableStarterCoverage.cumulativeStarterCases).size,
    10,
  );

  return {
    starter_total: report.executableStarterCoverage.starterTotal,
    cumulative_executable_count: report.executableStarterCoverage.cumulativeCount,
  };
});

await record("reference-agent: runnable interface exists without fake results", async () => {
  assert.equal(report.referenceAgentComparison.status, "interface_ready_no_runs");
  assert.equal(report.referenceAgentComparison.compared, false);
  assert.deepEqual(report.referenceAgentComparison.runs, []);
  assert.equal(
    report.results.every((result) => result.referenceAgent.status === "pending_run"),
    true,
  );
  assert.equal(
    report.results.every((result) => result.referenceAgent.result === null),
    true,
  );

  return {
    interface_ready: true,
    comparison_runs_empty: true,
    no_reference_score_fabricated: true,
  };
});

await record("L0 seeds: unique old_string and path safety are enforced", async () => {
  const unique = findResult("core12-seed-l0-unique-old-string");
  const pathSafety = findResult("core12-seed-l0-path-safety");

  assert.equal(unique.passed, true);
  assert.equal(
    unique.evidence.toolResults.some(
      (item) =>
        item.name === "Edit" &&
        item.status === "error" &&
        item.errorType === "old_string_not_unique",
    ),
    true,
  );
  assert.equal(pathSafety.passed, true);
  assert.equal(
    pathSafety.evidence.toolResults.some(
      (item) =>
        item.name === "Read" &&
        item.status === "denied" &&
        item.errorType === "permission_denied",
    ),
    true,
  );
  assert.deepEqual(unique.evidence.modifiedFiles, []);
  assert.deepEqual(pathSafety.evidence.modifiedFiles, []);

  return {
    old_string_not_unique_observed: true,
    path_traversal_denied: true,
    no_files_modified: true,
  };
});

await record("context seeds: long output artifact and hard failure blocks survive", async () => {
  const longOutput = findResult("core12-seed-l0-long-output-artifact");
  const budget = findResult("core12-seed-l1-context-budget-pressure");

  assert.equal(longOutput.passed, true);
  assert.equal(
    longOutput.assertions.some(
      (item) => item.name === "long_output_artifacted" && item.passed,
    ),
    true,
  );
  assert.equal(budget.passed, true);
  assert.equal(
    budget.assertions.some(
      (item) => item.name === "hard_failure_context_survives" && item.passed,
    ),
    true,
  );
  assert.equal(budget.evidence.verificationStatus, "failed");

  return {
    long_output_artifacted: true,
    latest_failure_preserved: true,
    verification_state_preserved: true,
  };
});

await record("L3 seed: plan and compaction continuity is executable", async () => {
  const result = findResult("core12-seed-l3-plan-compact-continuity");

  assert.equal(result.passed, true);
  assert.equal(result.evidence.verificationStatus, "passed");
  assert.equal(result.evidence.runtimeTraceEvents.includes("context.compacted"), true);
  assert.equal(
    result.assertions.some(
      (item) => item.name === "active_plan_preserved" && item.passed,
    ),
    true,
  );
  assert.deepEqual(result.evidence.modifiedFiles, ["src/pagination.cjs"]);

  return {
    context_compacted: true,
    active_plan_preserved: true,
    verification_passed_after_compaction: true,
  };
});

console.log(JSON.stringify({ passed: cases.length, cases }, null, 2));

function findResult(id) {
  const result = report.results.find((item) => item.id === id);
  assert.ok(result, `Missing result: ${id}`);
  return result;
}

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
