import assert from "node:assert/strict";
import { CORE11_SELECTED_STARTER_CASES } from "./eval-expansion.mjs";
import { CORE12_SELECTED_STARTER_CASES } from "./eval-expansion-second-batch.mjs";
import {
  CORE13_SELECTED_STARTER_CASES,
  runEvalExpansionThirdBatchDemo,
  thirdBatchExecutableRepoSeeds,
  verifyEvalExpansionThirdBatchReport,
} from "./eval-expansion-third-batch.mjs";

const cases = [];
const demo = await runEvalExpansionThirdBatchDemo();
const report = {
  ...demo,
};
delete report.checks;

await record("core13: third executable seed batch runs and verifies", async () => {
  return verifyEvalExpansionThirdBatchReport(report);
});

await record("seed contract: third batch binds to unmigrated Core 10 cases", async () => {
  const seeds = thirdBatchExecutableRepoSeeds();
  const previous = new Set([
    ...CORE11_SELECTED_STARTER_CASES,
    ...CORE12_SELECTED_STARTER_CASES,
  ]);
  const overlap = CORE13_SELECTED_STARTER_CASES.filter((id) => previous.has(id));

  assert.equal(seeds.length, 5);
  assert.deepEqual(
    seeds.map((seed) => seed.starterCaseId),
    CORE13_SELECTED_STARTER_CASES,
  );
  assert.deepEqual(overlap, []);
  assert.equal(seeds.every((seed) => seed.createWorkspace), true);
  assert.equal(seeds.every((seed) => seed.requiredChecks.length > 0), true);

  return {
    selected_seed_count: seeds.length,
    no_previous_batch_overlap: true,
    required_checks_declared: true,
  };
});

await record("coverage: executable starter coverage is now 15 of 20", async () => {
  assert.equal(report.executableStarterCoverage.starterTotal, 20);
  assert.equal(report.executableStarterCoverage.cumulativeCount, 15);
  assert.equal(
    new Set(report.executableStarterCoverage.cumulativeStarterCases).size,
    15,
  );

  return {
    starter_total: report.executableStarterCoverage.starterTotal,
    cumulative_executable_count: report.executableStarterCoverage.cumulativeCount,
  };
});

await record("reference-agent: interface remains ready without fabricated runs", async () => {
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

await record("L0 seeds: stale, bash denial, and linkage are executable", async () => {
  const stale = findResult("core13-seed-l0-stale-file");
  const bash = findResult("core13-seed-l0-bash-denial");
  const linkage = findResult("core13-seed-l0-tool-result-linkage");

  assert.equal(stale.passed, true);
  assert.equal(
    stale.assertions.some(
      (item) => item.name === "stale_file_observed" && item.passed,
    ),
    true,
  );
  assert.equal(
    stale.assertions.some(
      (item) => item.name === "read_after_stale_file" && item.passed,
    ),
    true,
  );
  assert.equal(bash.passed, true);
  assert.equal(
    bash.evidence.toolResults.some(
      (item) =>
        item.name === "Bash" &&
        item.status === "denied" &&
        item.errorType === "permission_denied",
    ),
    true,
  );
  assert.equal(linkage.passed, true);
  assert.equal(
    linkage.assertions.some(
      (item) => item.name === "tool_results_link_to_calls" && item.passed,
    ),
    true,
  );

  return {
    stale_file_recovered: true,
    bash_denied: true,
    tool_results_linked: true,
  };
});

await record("L1 seed: file_not_read recovery is executable", async () => {
  const result = findResult("core13-seed-l1-recovery-after-file-not-read");

  assert.equal(result.passed, true);
  assert.equal(result.evidence.verificationStatus, "passed");
  assert.equal(
    result.assertions.some(
      (item) => item.name === "file_not_read_observed" && item.passed,
    ),
    true,
  );
  assert.equal(
    result.assertions.some(
      (item) => item.name === "read_after_file_not_read" && item.passed,
    ),
    true,
  );

  return {
    file_not_read_observed: true,
    read_after_denial: true,
    verification_passed: true,
  };
});

await record("L2 seed: project rules enter context and verification passes", async () => {
  const result = findResult("core13-seed-l2-project-rules");

  assert.equal(result.passed, true);
  assert.equal(result.evidence.verificationCommand, "npm test");
  assert.equal(
    result.assertions.some(
      (item) => item.name === "agents_md_read" && item.passed,
    ),
    true,
  );
  assert.equal(
    result.assertions.some(
      (item) => item.name === "project_rules_context_block" && item.passed,
    ),
    true,
  );

  return {
    project_rules_read: true,
    project_rules_context_block: true,
    npm_test_passed: true,
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
