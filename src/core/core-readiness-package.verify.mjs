import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCore10EvalMatrix,
  buildCore10ReadinessPackage,
  calculateWeightedReadiness,
  CORE10_FAILURE_TAXONOMY,
  starterReadinessCases,
  summarizeRecordedVerification,
  verifyCore10ReadinessPackage,
} from "./core-readiness-package.mjs";

const cases = [];
const root = process.cwd();

await record("core10: readiness package builds and verifies", async () => {
  const packageResult = await buildCore10ReadinessPackage({ root });

  return verifyCore10ReadinessPackage(packageResult);
});

await record("eval suite: starter cases match L0-L4 distribution", async () => {
  const matrix = buildCore10EvalMatrix(starterReadinessCases());
  const distribution = Object.fromEntries(
    matrix.map((level) => [level.level, level.caseCount]),
  );

  assert.deepEqual(distribution, {
    L0: 8,
    L1: 4,
    L2: 5,
    L3: 1,
    L4: 2,
  });
  assert.equal(matrix.every((level) => level.status === "starter_ready"), true);

  return {
    starter_distribution_valid: true,
    levels: distribution,
  };
});

await record("score: readiness coverage is not a production capability claim", async () => {
  const matrix = buildCore10EvalMatrix(starterReadinessCases());
  const score = calculateWeightedReadiness(matrix);
  const packageResult = await buildCore10ReadinessPackage({ root });

  assert.equal(score.scoreKind, "eval_readiness_coverage");
  assert.equal(score.weightedScore, 100);
  assert.equal(packageResult.claim.canClaim70To80, false);
  assert.match(packageResult.claim.currentClaim, /not yet proven/);

  return {
    readiness_score_computed: true,
    production_claim_blocked: true,
  };
});

await record("taxonomy: critical red lines are explicit", async () => {
  const critical = CORE10_FAILURE_TAXONOMY.filter((failure) => failure.critical);

  assert.equal(critical.length >= 4, true);
  assert.equal(
    critical.some((failure) => failure.id === "policy_violation"),
    true,
  );
  assert.equal(
    critical.some((failure) => failure.id === "verification_missing"),
    true,
  );

  return {
    critical_failure_taxonomy_declared: true,
    critical_count: critical.length,
  };
});

await record("docs: open-source entry layer and authority map are present", async () => {
  const packageResult = await buildCore10ReadinessPackage({ root });
  const docNames = packageResult.docs.docs.map((doc) => doc.relativePath);

  assert.equal(packageResult.docs.passed, true);
  assert.equal(packageResult.docs.envIgnored, true);
  assert.equal(docNames.includes("README.md"), true);
  assert.equal(docNames.includes("docs/index.md"), true);
  assert.equal(docNames.includes("docs/authority-map.md"), true);

  return {
    docs_entry_layer_present: true,
    env_local_ignored: true,
  };
});

await record("scripts: core10 is wired into package verification", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

  assert.equal(
    packageJson.scripts["core:10"],
    "node src/core/core-readiness-package.mjs",
  );
  assert.equal(
    packageJson.scripts["core:10:verify"],
    "node src/core/core-readiness-package.verify.mjs",
  );
  assert.match(packageJson.scripts["verify:all"], /core:10:verify/);

  return {
    core10_script_present: true,
    verify_all_includes_core10: true,
  };
});

await record("baseline: recorded verification evidence remains all green", async () => {
  const summary = summarizeRecordedVerification();

  assert.equal(summary.passed, 89);
  assert.equal(summary.total, 89);
  assert.equal(summary.passRate, 1);

  return {
    recorded_baseline_passed: summary.passed,
    recorded_baseline_total: summary.total,
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
