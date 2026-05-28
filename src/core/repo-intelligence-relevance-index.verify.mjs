import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CORE25_REPO_INTELLIGENCE_VERSION,
  RepoIntelligenceIndex,
  createRepoIntelligenceFixture,
  repoIntelligenceBoundary,
  runRepoIntelligenceRelevanceDemo,
  verifyRepoIntelligenceRelevanceDemo,
} from "./repo-intelligence-relevance-index.mjs";

const cases = [];

await record("core25: repo intelligence demo runs and verifies", async () => {
  const result = await runRepoIntelligenceRelevanceDemo();
  return verifyRepoIntelligenceRelevanceDemo(result);
});

await record("repo map: fixture files, scripts, and rule entries are indexed", async () => {
  const fixture = await createRepoIntelligenceFixture();
  const repoIndex = new RepoIntelligenceIndex({
    workspaceRoot: fixture.workspaceRoot,
  });
  const index = await repoIndex.buildIndex();

  assert.equal(index.version, CORE25_REPO_INTELLIGENCE_VERSION);
  assert.ok(index.repoMap.files.some((file) => file.path === "src/pagination.cjs"));
  assert.ok(index.repoMap.files.some((file) => file.path === "package.json"));
  assert.ok(index.repoMap.scripts.some((script) => script.name === "test"));
  assert.ok(index.repoMap.ruleEntrypoints.includes("AGENTS.md"));

  return {
    file_count: index.repoMap.fileCount,
    scripts: index.repoMap.scripts.map((script) => script.name),
    rule_entrypoints: index.repoMap.ruleEntrypoints,
  };
});

await record("symbol index: exported symbol and references can be located", async () => {
  const fixture = await createRepoIntelligenceFixture();
  const repoIndex = new RepoIntelligenceIndex({
    workspaceRoot: fixture.workspaceRoot,
  });
  const index = await repoIndex.buildIndex();
  const paginateSymbol = index.symbolIndex.symbols.find(
    (symbol) => symbol.name === "paginate" && symbol.path === "src/pagination.cjs",
  );
  const testReference = index.symbolIndex.references.find(
    (reference) =>
      reference.fromPath === "tests/pagination.test.cjs" &&
      reference.toPath === "src/pagination.cjs",
  );

  assert.ok(paginateSymbol);
  assert.equal(paginateSymbol.exported, true);
  assert.ok(testReference);
  assert.ok(testReference.imported.includes("paginate"));

  return {
    symbol: paginateSymbol,
    reference: testReference,
  };
});

await record("test index: package scripts and test files are associated", async () => {
  const fixture = await createRepoIntelligenceFixture();
  const repoIndex = new RepoIntelligenceIndex({
    workspaceRoot: fixture.workspaceRoot,
  });
  const index = await repoIndex.buildIndex();
  const paginationAssociation = index.testIndex.associations.find(
    (association) =>
      association.sourcePath === "src/pagination.cjs" &&
      association.testPath === "tests/pagination.test.cjs",
  );

  assert.ok(index.testIndex.packageScripts.some((script) => script.name === "test"));
  assert.ok(
    index.testIndex.testFiles.some(
      (file) => file.path === "tests/pagination.test.cjs",
    ),
  );
  assert.ok(paginationAssociation);

  return {
    package_scripts: index.testIndex.packageScripts,
    test_files: index.testIndex.testFiles.map((file) => file.path),
    associations: index.testIndex.associations,
  };
});

await record("rule discovery: AGENTS and README rules enter high priority index", async () => {
  const fixture = await createRepoIntelligenceFixture();
  const repoIndex = new RepoIntelligenceIndex({
    workspaceRoot: fixture.workspaceRoot,
  });
  const index = await repoIndex.buildIndex();
  const highPriorityRules = index.ruleIndex.entries.filter(
    (entry) => entry.priority === "high",
  );

  assert.ok(highPriorityRules.some((entry) => entry.path === "AGENTS.md"));
  assert.ok(
    highPriorityRules.some((entry) =>
      entry.text.toLowerCase().includes("public api"),
    ),
  );
  assert.ok(
    highPriorityRules.some((entry) =>
      entry.text.toLowerCase().includes("npm test"),
    ),
  );

  return {
    high_priority_rule_count: highPriorityRules.length,
    rules: highPriorityRules.map((entry) => ({
      path: entry.path,
      text: entry.text,
    })),
  };
});

await record("relevance scoring: correct file ranks above similar files", async () => {
  const fixture = await createRepoIntelligenceFixture();
  const repoIndex = new RepoIntelligenceIndex({
    workspaceRoot: fixture.workspaceRoot,
  });
  await repoIndex.buildIndex();
  const relevance = repoIndex.scoreRelevance({
    goal: "Fix paginate empty page bug, preserve public API, and run npm test.",
    query: "paginate empty page public API npm test",
  });
  const target = relevance.selectedFiles[0];
  const cart = relevance.rankedFiles.find((file) => file.path === "src/cart.cjs");
  const targetReasonTypes = new Set(target.reasons.map((reason) => reason.type));

  assert.equal(target.path, "src/pagination.cjs");
  assert.ok(target.score > cart.score);
  assert.equal(targetReasonTypes.has("symbol_match"), true);
  assert.equal(targetReasonTypes.has("test_association"), true);

  return {
    top_file: target.path,
    top_score: target.score,
    similar_file_score: cart.score,
    top_reasons: target.reasons.map((reason) => reason.type),
  };
});

await record("incremental update: modified file refreshes without full reindex", async () => {
  const fixture = await createRepoIntelligenceFixture();
  const repoIndex = new RepoIntelligenceIndex({
    workspaceRoot: fixture.workspaceRoot,
  });
  const first = await repoIndex.buildIndex();
  const before = first.files.find((file) => file.path === "src/pagination.cjs");
  const filePath = path.join(fixture.workspaceRoot, "src/pagination.cjs");
  const original = await readFile(filePath, "utf8");

  await writeFile(
    filePath,
    original.replace(
      "  return items.slice(start, end);",
      "  return start >= items.length ? [] : items.slice(start, end);",
    ),
    "utf8",
  );
  const update = await repoIndex.updateFiles(["src/pagination.cjs"]);
  const after = update.index.files.find((file) => file.path === "src/pagination.cjs");

  assert.notEqual(before.hash, after.hash);
  assert.equal(update.trace.event, "repo.index.updated");
  assert.deepEqual(update.trace.details.changedPaths, ["src/pagination.cjs"]);
  assert.equal(update.trace.details.updatedFileCount, 1);
  assert.ok(update.trace.details.reusedFileCount > 0);

  return {
    changed_path: "src/pagination.cjs",
    before_hash: before.hash,
    after_hash: after.hash,
    reused_file_count: update.trace.details.reusedFileCount,
  };
});

await record("token benefit: indexed context selects correct file with fewer tokens", async () => {
  const fixture = await createRepoIntelligenceFixture();
  const repoIndex = new RepoIntelligenceIndex({
    workspaceRoot: fixture.workspaceRoot,
  });
  await repoIndex.buildIndex();
  const relevance = repoIndex.scoreRelevance({
    goal:
      "Fix the empty page behavior in paginate while preserving public API and running tests.",
    query: "paginate empty page preserve public API npm test",
    maxFiles: 4,
  });
  const tokenBenefit = repoIndex.compareTokenBenefit(relevance);

  assert.equal(tokenBenefit.status, "passed");
  assert.equal(tokenBenefit.correctFileSelected, true);
  assert.ok(tokenBenefit.indexed.tokens < tokenBenefit.naive.tokens);
  assert.ok(tokenBenefit.indexed.paths.includes("src/pagination.cjs"));

  return {
    naive_tokens: tokenBenefit.naive.tokens,
    indexed_tokens: tokenBenefit.indexed.tokens,
    token_savings: tokenBenefit.tokenSavings,
    indexed_paths: tokenBenefit.indexed.paths,
  };
});

await record("boundary: repo intelligence is local evidence, not production search", async () => {
  const result = await runRepoIntelligenceRelevanceDemo();

  assert.equal(
    CORE25_REPO_INTELLIGENCE_VERSION,
    "core25-repo-intelligence-relevance-index-v1",
  );
  assert.deepEqual(result.boundary, repoIntelligenceBoundary());
  assert.equal(result.boundary.deterministicLocalRepoIndex, true);
  assert.equal(result.boundary.productionRepoIntelligenceClaim, false);
  assert.equal(result.boundary.semanticEmbeddingClaim, false);
  assert.equal(result.boundary.arbitraryLargeRepoClaim, false);

  return {
    deterministic_local_repo_index: true,
    no_production_repo_intelligence_claim: true,
    no_embedding_claim: true,
    no_arbitrary_large_repo_claim: true,
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
