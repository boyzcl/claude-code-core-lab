import assert from "node:assert/strict";
import { starterReadinessCases } from "./core-readiness-package.mjs";
import { CORE11_SELECTED_STARTER_CASES } from "./eval-expansion.mjs";
import { CORE12_SELECTED_STARTER_CASES } from "./eval-expansion-second-batch.mjs";
import { CORE13_SELECTED_STARTER_CASES } from "./eval-expansion-third-batch.mjs";
import {
  CORE14_SELECTED_STARTER_CASES,
  finalStarterBatchExecutableRepoSeeds,
  runEvalExpansionFinalStarterBatchDemo,
  verifyEvalExpansionFinalStarterBatchReport,
} from "./eval-expansion-final-starter-batch.mjs";

const cases = [];
const demo = await runEvalExpansionFinalStarterBatchDemo();
const report = {
  ...demo,
};
delete report.checks;

await record("core14: final executable starter batch runs and verifies", async () => {
  return verifyEvalExpansionFinalStarterBatchReport(report);
});

await record("seed contract: final batch binds only to remaining Core 10 cases", async () => {
  const seeds = finalStarterBatchExecutableRepoSeeds();
  const previous = new Set([
    ...CORE11_SELECTED_STARTER_CASES,
    ...CORE12_SELECTED_STARTER_CASES,
    ...CORE13_SELECTED_STARTER_CASES,
  ]);
  const overlap = CORE14_SELECTED_STARTER_CASES.filter((id) => previous.has(id));
  const allStarterCases = starterReadinessCases().map((testCase) => testCase.id);
  const cumulative = [
    ...CORE11_SELECTED_STARTER_CASES,
    ...CORE12_SELECTED_STARTER_CASES,
    ...CORE13_SELECTED_STARTER_CASES,
    ...CORE14_SELECTED_STARTER_CASES,
  ];

  assert.equal(seeds.length, 5);
  assert.deepEqual(
    seeds.map((seed) => seed.starterCaseId),
    CORE14_SELECTED_STARTER_CASES,
  );
  assert.deepEqual(overlap, []);
  assert.deepEqual(new Set(cumulative), new Set(allStarterCases));
  assert.equal(seeds.every((seed) => seed.createWorkspace), true);
  assert.equal(seeds.every((seed) => seed.requiredChecks.length > 0), true);

  return {
    selected_seed_count: seeds.length,
    no_previous_batch_overlap: true,
    all_starter_cases_covered: true,
    required_checks_declared: true,
  };
});

await record("coverage: executable starter coverage is now 20 of 20", async () => {
  assert.equal(report.executableStarterCoverage.starterTotal, 20);
  assert.equal(report.executableStarterCoverage.cumulativeCount, 20);
  assert.equal(
    new Set(report.executableStarterCoverage.cumulativeStarterCases).size,
    20,
  );

  return {
    starter_total: report.executableStarterCoverage.starterTotal,
    cumulative_executable_count: report.executableStarterCoverage.cumulativeCount,
  };
});

await record("reference-agent: interface remains ready with no RelativeScore", async () => {
  assert.equal(report.referenceAgentComparison.status, "interface_ready_no_runs");
  assert.equal(report.referenceAgentComparison.compared, false);
  assert.deepEqual(report.referenceAgentComparison.runs, []);
  assert.equal("relativeScore" in report.referenceAgentComparison, false);
  assert.equal("RelativeScore" in report.referenceAgentComparison, false);
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
    no_relative_score_fabricated: true,
  };
});

await record("L0 seed: provider error is normalized before tool execution", async () => {
  const result = findResult("core14-seed-l0-provider-error");

  assert.equal(result.passed, true);
  assert.equal(
    result.assertions.some(
      (item) => item.name === "provider_failure_normalized" && item.passed,
    ),
    true,
  );
  assert.equal(
    result.assertions.some(
      (item) =>
        item.name === "provider_failure_did_not_enter_tool_runtime" &&
        item.passed,
    ),
    true,
  );
  assert.deepEqual(result.evidence.toolSequence, []);
  assert.deepEqual(result.evidence.modifiedFiles, []);

  return {
    provider_failure_normalized: true,
    no_local_tools_executed: true,
    no_files_modified: true,
  };
});

await record("L1/L2 seeds: failure attribution and similar-file search are executable", async () => {
  const failure = findResult("core14-seed-l1-test-failure-attribution");
  const similar = findResult("core14-seed-l2-similar-file-search");

  assert.equal(failure.passed, true);
  assert.equal(failure.evidence.verificationStatus, "failed");
  assert.equal(
    failure.assertions.some(
      (item) => item.name === "failure_output_retained" && item.passed,
    ),
    true,
  );
  assert.equal(similar.passed, true);
  assert.equal(similar.evidence.verificationStatus, "passed");
  assert.equal(
    similar.assertions.some(
      (item) => item.name === "search_returned_similar_candidates" && item.passed,
    ),
    true,
  );
  assert.deepEqual(similar.evidence.modifiedFiles, ["src/pricing.cjs"]);

  return {
    failed_test_attributed: true,
    failure_output_retained: true,
    similar_candidates_disambiguated: true,
  };
});

await record("L2/L4 seeds: public API and prompt boundary are enforced", async () => {
  const publicApi = findResult("core14-seed-l2-public-api-preserved");
  const promptBoundary = findResult("core14-seed-l4-prompt-cannot-authorize-tool");

  assert.equal(publicApi.passed, true);
  assert.equal(
    publicApi.assertions.some(
      (item) => item.name === "apply_discount_export_preserved" && item.passed,
    ),
    true,
  );
  assert.equal(publicApi.evidence.verificationCommand, "npm test");
  assert.equal(promptBoundary.passed, true);
  assert.equal(
    promptBoundary.assertions.some(
      (item) => item.name === "prompt_pack_boundary_visible" && item.passed,
    ),
    true,
  );
  assert.equal(
    promptBoundary.assertions.some(
      (item) => item.name === "unsafe_bash_denied" && item.passed,
    ),
    true,
  );
  assert.deepEqual(promptBoundary.evidence.modifiedFiles, []);

  return {
    public_api_preserved: true,
    prompt_pack_boundary_visible: true,
    unsafe_bash_denied: true,
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
