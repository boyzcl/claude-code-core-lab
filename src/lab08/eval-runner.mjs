import assert from "node:assert/strict";
import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const exec = promisify(execCallback);

export async function runEvalCases(cases) {
  const results = [];

  for (const testCase of cases) {
    results.push(await runEvalCase(testCase));
  }

  const passed = results.filter((result) => result.passed).length;
  const total = results.length;

  return {
    total,
    passed,
    score: total === 0 ? 0 : passed / total,
    results,
  };
}

export async function runEvalCase(testCase) {
  try {
    const { stdout, stderr } = await exec(testCase.command, {
      timeout: testCase.timeoutMs ?? 5000,
      maxBuffer: 1024 * 1024,
    });
    const output = `${stdout}${stderr}`;
    const passed =
      testCase.expectExitCode === 0 &&
      (!testCase.expectIncludes || output.includes(testCase.expectIncludes));

    return {
      id: testCase.id,
      name: testCase.name,
      passed,
      failureType: passed ? null : "assertion_failed",
      output: output.trim(),
    };
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}${error.message ?? ""}`;
    const passed =
      testCase.expectExitCode !== 0 &&
      (!testCase.expectIncludes || output.includes(testCase.expectIncludes));

    return {
      id: testCase.id,
      name: testCase.name,
      passed,
      failureType: passed ? null : "command_failed",
      output: output.trim(),
    };
  }
}

export function starterCases() {
  return [
    {
      id: "eval-pass-001",
      name: "passing command",
      command: "node -e \"console.log('agent eval ok')\"",
      expectExitCode: 0,
      expectIncludes: "agent eval ok",
    },
    {
      id: "eval-fail-expected-001",
      name: "expected non-zero command",
      command: "node -e \"console.error('expected failure'); process.exit(2)\"",
      expectExitCode: 2,
      expectIncludes: "expected failure",
    },
    {
      id: "eval-assertion-001",
      name: "wrong output should fail",
      command: "node -e \"console.log('actual')\"",
      expectExitCode: 0,
      expectIncludes: "expected",
    },
  ];
}

export async function runDemo() {
  const report = await runEvalCases(starterCases());
  return {
    checks: verifyDemo(report),
    ...report,
  };
}

export function verifyDemo(report) {
  assert.equal(report.total, 3);
  assert.equal(report.passed, 2);
  assert.equal(report.score, 2 / 3);
  assert.equal(report.results[2].failureType, "assertion_failed");

  return {
    eval_cases_executed: true,
    pass_fail_score_computed: true,
    failure_type_recorded: true,
  };
}

async function main() {
  console.log(JSON.stringify(await runDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
