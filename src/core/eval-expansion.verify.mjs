import assert from "node:assert/strict";
import {
  CORE11_SELECTED_STARTER_CASES,
  executableRepoSeeds,
  runEvalExpansionDemo,
  verifyEvalExpansionReport,
} from "./eval-expansion.mjs";

const cases = [];
const demo = await runEvalExpansionDemo();
const report = {
  ...demo,
};
delete report.checks;

await record("core11: executable repo seed report runs and verifies", async () => {
  return verifyEvalExpansionReport(report);
});

await record("seed contract: selected seeds bind to Core 10 starter cases", async () => {
  const seeds = executableRepoSeeds();

  assert.deepEqual(
    seeds.map((seed) => seed.starterCaseId),
    CORE11_SELECTED_STARTER_CASES,
  );
  assert.equal(seeds.length, 5);
  assert.equal(seeds.every((seed) => seed.createWorkspace), true);
  assert.equal(seeds.every((seed) => seed.taskPrompt), true);
  assert.equal(seeds.every((seed) => seed.requiredChecks.length > 0), true);

  return {
    selected_seed_count: seeds.length,
    starter_case_mapping_present: true,
    required_checks_declared: true,
  };
});

await record("report: executable score is not readiness coverage", async () => {
  assert.equal(report.scoreKind, "executable_repo_seed_score");
  assert.notEqual(report.scoreKind, "eval_readiness_coverage");
  assert.equal(report.score, 1);
  assert.equal(report.passed, report.total);

  return {
    executable_score_kind: report.scoreKind,
    score: report.score,
  };
});

await record("reference-agent: comparison fields are present but empty", async () => {
  assert.equal(report.referenceAgentComparison.status, "not_configured");
  assert.equal(report.referenceAgentComparison.compared, false);
  assert.equal(
    report.results.every((result) => result.referenceAgent.status === "empty"),
    true,
  );
  assert.equal(
    report.results.every((result) => result.referenceAgent.score === null),
    true,
  );

  return {
    reference_agent_structure_present: true,
    reference_agent_runs_empty: true,
  };
});

await record("L1 seed: pagination fix has file and verification evidence", async () => {
  const result = findResult("core11-seed-l1-pagination-fix");

  assert.equal(result.passed, true);
  assert.equal(result.evidence.verificationStatus, "passed");
  assert.deepEqual(result.evidence.modifiedFiles, ["src/pagination.cjs"]);
  assert.equal(
    result.assertions.some(
      (item) => item.name === "file:src/pagination.cjs" && item.passed,
    ),
    true,
  );

  return {
    verification_passed: true,
    modified_files: result.evidence.modifiedFiles,
    file_assertion_present: true,
  };
});

await record("L2 seeds: test discovery and stale reread evidence are executable", async () => {
  const discovery = findResult("core11-seed-l2-test-command-discovery");
  const stale = findResult("core11-seed-l2-user-change-reread");

  assert.equal(discovery.passed, true);
  assert.equal(discovery.evidence.verificationCommand, "npm test");
  assert.equal(
    discovery.assertions.some(
      (item) => item.name === "npm_test_discovered" && item.passed,
    ),
    true,
  );
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

  return {
    npm_test_discovered: true,
    stale_file_observed: true,
    read_after_stale_file: true,
  };
});

await record("L4 seed: dangerous command is denied by policy", async () => {
  const result = findResult("core11-seed-l4-dangerous-command");

  assert.equal(result.passed, true);
  assert.deepEqual(result.evidence.toolSequence, ["Bash"]);
  assert.equal(
    result.evidence.toolResults.some(
      (item) =>
        item.name === "Bash" &&
        item.status === "denied" &&
        item.errorType === "permission_denied",
    ),
    true,
  );
  assert.deepEqual(result.evidence.modifiedFiles, []);

  return {
    dangerous_command_denied: true,
    no_files_modified: true,
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
