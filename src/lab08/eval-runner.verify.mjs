import assert from "node:assert/strict";
import {
  runDemo,
  runEvalCases,
  starterCases,
  verifyDemo,
} from "./eval-runner.mjs";

const cases = [];

await record("happy path: eval runner produces score and failure type", async () => {
  return verifyDemo(await runDemo());
});

await record("case schema: every starter case has required fields", async () => {
  const valid = starterCases().every(
    (testCase) =>
      testCase.id &&
      testCase.name &&
      testCase.command &&
      typeof testCase.expectExitCode === "number",
  );

  assert.equal(valid, true);

  return {
    starter_case_schema_valid: true,
  };
});

await record("all-pass suite: score is 1", async () => {
  const report = await runEvalCases([
    {
      id: "all-pass-001",
      name: "pass one",
      command: "node -e \"console.log('one')\"",
      expectExitCode: 0,
      expectIncludes: "one",
    },
    {
      id: "all-pass-002",
      name: "pass two",
      command: "node -e \"console.log('two')\"",
      expectExitCode: 0,
      expectIncludes: "two",
    },
  ]);

  assert.equal(report.score, 1);
  assert.equal(report.passed, 2);

  return {
    all_pass_score: report.score,
  };
});

await record("unexpected command failure: recorded as command_failed", async () => {
  const report = await runEvalCases([
    {
      id: "unexpected-fail-001",
      name: "unexpected fail",
      command: "node -e \"process.exit(3)\"",
      expectExitCode: 0,
    },
  ]);

  assert.equal(report.results[0].passed, false);
  assert.equal(report.results[0].failureType, "command_failed");

  return {
    failure_type: report.results[0].failureType,
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
