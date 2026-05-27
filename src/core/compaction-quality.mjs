import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { compactSession } from "../lab07/compaction.mjs";

export const CORE19_COMPACTION_QUALITY_VERSION = "core19-compaction-quality-v1";

export function evaluateCompactionQuality({ before, compacted }) {
  const summary = compacted.compactSummary ?? compacted;
  const checks = [
    checkObjective(before, summary),
    checkConstraints(before, summary),
    checkFailure(before, summary),
    checkPlan(before, summary),
    checkModifiedFiles(before, summary),
    checkPendingActions(before, summary),
  ];
  const failedChecks = checks.filter((check) => !check.passed);
  const score = checks.length === 0 ? 0 : passedChecks(checks) / checks.length;

  return {
    version: CORE19_COMPACTION_QUALITY_VERSION,
    status: failedChecks.length === 0 ? "passed" : "failed",
    score,
    failureType: failedChecks.length === 0 ? null : "compaction_loss",
    checks,
    failedChecks: failedChecks.map((check) => check.name),
    diff: buildCompactionDiff({ before, summary }),
    evidence: {
      compactSummaryFields: Object.keys(summary).sort(),
      artifactCount: compacted.artifacts?.length ?? 0,
      newerMessageCount: compacted.newerMessages?.length ?? 0,
    },
    boundary: {
      deterministicLocalEval: true,
      productionClaudeCodeClaim: false,
      promptOnlySummaryClaim: false,
    },
    recommendedAction:
      failedChecks.length === 0
        ? "safe_to_restore_compact_summary"
        : "repair_or_rerun_compaction_before_restore",
  };
}

export function runCompactionQualityDemo() {
  const before = createCompactionQualityInput();
  const compacted = compactSession(before);
  const report = evaluateCompactionQuality({ before, compacted });

  return {
    checks: verifyCompactionQualityDemo(report),
    before,
    compacted,
    report,
  };
}

export function verifyCompactionQualityDemo(report) {
  assert.equal(report.version, CORE19_COMPACTION_QUALITY_VERSION);
  assert.equal(report.status, "passed");
  assert.equal(report.score, 1);
  assert.equal(report.failureType, null);
  assert.equal(
    report.checks.every((check) => check.passed),
    true,
  );
  assert.equal(report.boundary.productionClaudeCodeClaim, false);

  return {
    compaction_quality_passed: true,
    objective_preserved: true,
    constraints_preserved: true,
    failure_preserved: true,
    plan_preserved: true,
    modified_files_preserved: true,
    pending_actions_preserved: true,
    no_production_claim: true,
  };
}

export function createCompactionQualityInput(overrides = {}) {
  return {
    objective: "Fix pagination off-by-one without changing the public API.",
    latestUserConstraints: [
      "Do not change the public API.",
      "Safety: only run allowlisted verification commands.",
    ],
    activePlan: {
      id: "plan_core19",
      status: "approved",
      steps: [
        {
          id: "step_1",
          text: "Read pagination implementation",
          status: "done",
        },
        {
          id: "step_2",
          text: "Patch boundary logic",
          status: "active",
        },
        {
          id: "step_3",
          text: "Rerun node scripts/test.cjs",
          status: "pending",
        },
      ],
    },
    modifiedFiles: [
      {
        path: "src/pagination.cjs",
        reason: "Remove the extra item returned by page slicing.",
      },
    ],
    latestFailures: [
      "node scripts/test.cjs failed: Expected page size 2, received 3.",
    ],
    verificationState: {
      status: "failed",
      command: "node scripts/test.cjs",
      exitCode: 1,
      stderr: "Expected page size 2, received 3.",
    },
    pendingActions: [
      "Inspect latest failure",
      "Patch boundary logic",
      "Rerun node scripts/test.cjs",
    ],
    messages: [
      {
        type: "tool_result",
        name: "Bash",
        status: "error",
        content: "FAIL ".repeat(140),
      },
      {
        type: "assistant",
        content: "The likely issue is an inclusive end index.",
      },
    ],
    newerMessages: [
      {
        type: "user",
        content: "保持公开 API 不变，只修边界逻辑。",
      },
    ],
    ...overrides,
  };
}

export function createBadCompactionFixture() {
  const before = createCompactionQualityInput();
  const good = compactSession(before);
  const bad = {
    ...good,
    compactSummary: {
      ...good.compactSummary,
      objective: "Summarize the previous conversation.",
      latestUserConstraints: ["Do not change the public API."],
      activePlan: {
        id: "plan_core19",
        status: "approved",
        steps: [
          {
            id: "step_1",
            text: "Read pagination implementation",
            status: "done",
          },
        ],
      },
      modifiedFiles: [],
      latestFailures: [],
      verificationState: {
        status: "passed",
        command: "node scripts/test.cjs",
        exitCode: 0,
      },
      pendingActions: [],
    },
  };

  return {
    before,
    good,
    bad,
    report: evaluateCompactionQuality({ before, compacted: bad }),
  };
}

function checkObjective(before, summary) {
  return check("objective_preservation", summary.objective === before.objective, {
    expected: before.objective,
    actual: summary.objective ?? null,
  });
}

function checkConstraints(before, summary) {
  return check(
    "constraint_preservation",
    sameSet(before.latestUserConstraints, summary.latestUserConstraints),
    {
      expected: before.latestUserConstraints,
      actual: summary.latestUserConstraints ?? [],
    },
  );
}

function checkFailure(before, summary) {
  const expectedFailed = before.verificationState?.status === "failed";
  const passed =
    !expectedFailed ||
    (summary.verificationState?.status === "failed" &&
      includesAll(summary.latestFailures, before.latestFailures));

  return check("failure_preservation", passed, {
    expectedVerificationState: before.verificationState,
    actualVerificationState: summary.verificationState ?? null,
    expectedLatestFailures: before.latestFailures,
    actualLatestFailures: summary.latestFailures ?? [],
  });
}

function checkPlan(before, summary) {
  const expectedSteps = normalizePlanSteps(before.activePlan?.steps);
  const actualSteps = normalizePlanSteps(summary.activePlan?.steps);

  return check(
    "plan_preservation",
    before.activePlan?.id === summary.activePlan?.id &&
      before.activePlan?.status === summary.activePlan?.status &&
      sameJson(expectedSteps, actualSteps),
    {
      expected: {
        id: before.activePlan?.id,
        status: before.activePlan?.status,
        steps: expectedSteps,
      },
      actual: {
        id: summary.activePlan?.id ?? null,
        status: summary.activePlan?.status ?? null,
        steps: actualSteps,
      },
    },
  );
}

function checkModifiedFiles(before, summary) {
  return check(
    "modified_files_preservation",
    sameJson(
      normalizeModifiedFiles(before.modifiedFiles),
      normalizeModifiedFiles(summary.modifiedFiles),
    ),
    {
      expected: normalizeModifiedFiles(before.modifiedFiles),
      actual: normalizeModifiedFiles(summary.modifiedFiles),
    },
  );
}

function checkPendingActions(before, summary) {
  return check(
    "pending_actions_preservation",
    sameJson(before.pendingActions ?? [], summary.pendingActions ?? []),
    {
      expected: before.pendingActions ?? [],
      actual: summary.pendingActions ?? [],
    },
  );
}

function buildCompactionDiff({ before, summary }) {
  return {
    objective: {
      before: before.objective,
      after: summary.objective ?? null,
      preserved: before.objective === summary.objective,
    },
    constraints: {
      missing: (before.latestUserConstraints ?? []).filter(
        (constraint) => !(summary.latestUserConstraints ?? []).includes(constraint),
      ),
      extra: (summary.latestUserConstraints ?? []).filter(
        (constraint) => !(before.latestUserConstraints ?? []).includes(constraint),
      ),
    },
    verificationState: {
      before: before.verificationState ?? null,
      after: summary.verificationState ?? null,
      failedStatePreserved:
        before.verificationState?.status !== "failed" ||
        summary.verificationState?.status === "failed",
    },
    activePlan: {
      before: {
        id: before.activePlan?.id ?? null,
        status: before.activePlan?.status ?? null,
        steps: normalizePlanSteps(before.activePlan?.steps),
      },
      after: {
        id: summary.activePlan?.id ?? null,
        status: summary.activePlan?.status ?? null,
        steps: normalizePlanSteps(summary.activePlan?.steps),
      },
    },
    modifiedFiles: {
      before: normalizeModifiedFiles(before.modifiedFiles),
      after: normalizeModifiedFiles(summary.modifiedFiles),
    },
    pendingActions: {
      before: before.pendingActions ?? [],
      after: summary.pendingActions ?? [],
    },
  };
}

function check(name, passed, details) {
  return {
    name,
    passed,
    failureType: passed ? null : "compaction_loss",
    details,
  };
}

function passedChecks(checks) {
  return checks.filter((check) => check.passed).length;
}

function sameSet(left = [], right = []) {
  return sameJson([...left].sort(), [...right].sort());
}

function includesAll(actual = [], expected = []) {
  return expected.every((item) => actual.includes(item));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizePlanSteps(steps = []) {
  return steps.map((step, index) =>
    typeof step === "string"
      ? {
          id: `step_${index + 1}`,
          text: step,
          status: null,
        }
      : {
          id: step.id ?? `step_${index + 1}`,
          text: step.text ?? step.name ?? "",
          status: step.status ?? null,
        },
  );
}

function normalizeModifiedFiles(files = []) {
  return files.map((file) =>
    typeof file === "string"
      ? {
          path: file,
          reason: null,
        }
      : {
          path: file.path,
          reason: file.reason ?? null,
        },
  );
}

function main() {
  console.log(JSON.stringify(runCompactionQualityDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
