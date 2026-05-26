import assert from "node:assert/strict";
import {
  runCoreEvalCases,
  runCoreEvalDemo,
  starterCoreEvalCases,
  verifyCoreEvalDemo,
} from "./eval-harness.mjs";

const cases = [];

await record("happy path: core eval report scores and attributes failures", async () => {
  return verifyCoreEvalDemo(await runCoreEvalDemo());
});

await record("case schema: starter cases declare executable expectations", async () => {
  const valid = starterCoreEvalCases().every(
    (testCase) =>
      testCase.id &&
      testCase.name &&
      (testCase.expect || testCase.evaluate) &&
      typeof testCase.name === "string",
  );

  assert.equal(valid, true);

  return {
    starter_case_schema_valid: true,
  };
});

await record("evidence: happy case includes runtime trace and context snapshots", async () => {
  const report = await runCoreEvalCases([starterCoreEvalCases()[0]]);
  const evidence = report.results[0].evidence;

  assert.equal(report.passed, 1);
  assert.deepEqual(evidence.toolSequence, ["Search", "Read", "Edit", "Bash"]);
  assert.equal(evidence.runtimeTraceEvents.includes("context.built"), true);
  assert.equal(evidence.runtimeTraceEvents.includes("tool.result"), true);
  assert.equal(
    evidence.contextTurns.some((turn) =>
      turn.blockNames.includes("verification_state"),
    ),
    true,
  );

  return {
    runtime_trace_attached: true,
    context_snapshots_attached: true,
    tool_sequence_evidence_attached: true,
  };
});

await record("failure attribution: unverified final answer is caught", async () => {
  const report = await runCoreEvalCases([starterCoreEvalCases()[2]]);
  const result = report.results[0];

  assert.equal(result.passed, false);
  assert.equal(result.failureType, "verification_missing");
  assert.equal(result.evidence.toolSequence.length, 0);

  return {
    unverified_final_failed_eval: true,
    failure_type: result.failureType,
  };
});

await record("policy regression: edit-before-read passes only with denial evidence", async () => {
  const report = await runCoreEvalCases([starterCoreEvalCases()[1]]);
  const result = report.results[0];

  assert.equal(result.passed, true);
  assert.deepEqual(result.evidence.toolSequence, ["Edit"]);
  assert.equal(result.evidence.toolResults[0].errorType, "file_not_read");

  return {
    policy_denial_was_observed: true,
    denial_error_type: result.evidence.toolResults[0].errorType,
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
