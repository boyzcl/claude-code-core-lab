import assert from "node:assert/strict";
import {
  ContextEconomyEngine,
  createContextEconomyFixture,
  runContextEconomyDemo,
  verifyContextEconomyDemo,
} from "./context-economy.mjs";

const cases = [];

await record("core18: context economy demo runs and verifies", () => {
  const result = runContextEconomyDemo();
  return verifyContextEconomyDemo(result);
});

await record("stable prefix: system, tool, and project blocks keep order id and hash", () => {
  const fixture = createContextEconomyFixture();
  const engine = new ContextEconomyEngine({
    budget: 1200,
    projectRules: "Preserve public APIs. Prefer narrow edits. Verify before final.",
  });
  const first = buildWithFixture(engine, fixture, { turn: 1 });
  fixture.store.appendUserMessage(
    fixture.sessionId,
    "第二轮继续，但不要改变稳定项目规则。",
  );
  const second = buildWithFixture(engine, fixture, {
    turn: 2,
    previousSnapshot: first,
  });

  assert.deepEqual(
    first.stablePrefix.map((block) => block.name),
    ["system", "tools", "project_rules"],
  );
  assert.deepEqual(
    second.stablePrefix.map((block) => block.name),
    ["system", "tools", "project_rules"],
  );
  assert.deepEqual(
    second.stablePrefix.map((block) => block.id),
    first.stablePrefix.map((block) => block.id),
  );
  assert.deepEqual(
    second.stablePrefix.map((block) => block.hash),
    first.stablePrefix.map((block) => block.hash),
  );

  return {
    stable_prefix_order: second.stablePrefix.map((block) => block.name),
    stable_prefix_hashes_reused: true,
  };
});

await record("dynamic tail: latest user and tool results stay outside stable prefix", () => {
  const fixture = createContextEconomyFixture();
  const engine = new ContextEconomyEngine({
    budget: 1200,
    projectRules: "Preserve public APIs.",
  });
  const first = buildWithFixture(engine, fixture, { turn: 1 });
  fixture.store.appendUserMessage(fixture.sessionId, "继续处理最新失败。");
  const second = buildWithFixture(engine, fixture, {
    turn: 2,
    previousSnapshot: first,
  });
  const stableNames = second.stablePrefix.map((block) => block.name);
  const dynamicNames = second.dynamicTail.map((block) => block.name);
  const firstLatestUser = first.dynamicTail.find((block) => block.name === "latest_user");
  const secondLatestUser = second.dynamicTail.find(
    (block) => block.name === "latest_user",
  );

  assert.equal(stableNames.includes("latest_user"), false);
  assert.equal(stableNames.some((name) => name.startsWith("tool:")), false);
  assert.ok(dynamicNames.includes("latest_user"));
  assert.ok(dynamicNames.some((name) => name.startsWith("tool:")));
  assert.notEqual(firstLatestUser.hash, secondLatestUser.hash);

  return {
    stable_prefix_excludes_dynamic_tail: true,
    dynamic_tail_blocks: dynamicNames.filter(
      (name) => name === "latest_user" || name.startsWith("tool:"),
    ),
  };
});

await record("token budget: low priority content is evicted and hard state survives", () => {
  const fixture = createContextEconomyFixture();
  const engine = new ContextEconomyEngine({
    budget: 170,
    projectRules: "Preserve public APIs. Prefer narrow edits. Verify before final.",
    memories: [
      {
        id: "low-priority-memory",
        score: 0.95,
        text: "This low priority memory should be cut before hard runtime state.",
      },
    ],
  });
  const result = buildWithFixture(engine, fixture, { turn: 1 });
  const selectedNames = result.blocks.map((block) => block.name);
  const evictedPriorities = new Set(
    result.evictionReport.map((entry) => entry.priority),
  );

  assert.ok(selectedNames.includes("active_plan"));
  assert.ok(selectedNames.includes("verification_state"));
  assert.ok(selectedNames.includes("latest_failure"));
  assert.ok(result.evictionReport.length > 0);
  assert.equal(evictedPriorities.has("low"), true);

  return {
    hard_state_retained: [
      "active_plan",
      "verification_state",
      "latest_failure",
    ],
    evicted_blocks: result.evictionReport.map((entry) => entry.name),
  };
});

await record("cache simulation: second turn reports cache hits and uncached tail", () => {
  const fixture = createContextEconomyFixture();
  const engine = new ContextEconomyEngine({
    budget: 1000,
    projectRules: "Preserve public APIs.",
  });
  const first = buildWithFixture(engine, fixture, { turn: 1 });
  fixture.store.appendUserMessage(
    fixture.sessionId,
    "继续下一轮，稳定前缀应命中缓存。",
  );
  const second = buildWithFixture(engine, fixture, {
    turn: 2,
    previousSnapshot: first,
  });

  assert.equal(first.cacheReport.cacheHitTokens, 0);
  assert.equal(second.cacheReport.cacheHitTokens, second.cacheReport.stablePrefixTokens);
  assert.equal(second.cacheReport.cacheMissTokens, 0);
  assert.ok(second.cacheReport.uncachedTailTokens > 0);
  assert.ok(second.cacheReport.estimatedSavedTokens > 0);
  assert.ok(second.tokenReport.estimatedSavedTokens >= second.cacheReport.cacheHitTokens);

  return {
    stablePrefixTokens: second.cacheReport.stablePrefixTokens,
    cacheHitTokens: second.cacheReport.cacheHitTokens,
    cacheMissTokens: second.cacheReport.cacheMissTokens,
    uncachedTailTokens: second.cacheReport.uncachedTailTokens,
    estimatedSavedTokens: second.tokenReport.estimatedSavedTokens,
  };
});

await record("artifact boundary: long output is artifacted and not selected raw", () => {
  const fixture = createContextEconomyFixture();
  const engine = new ContextEconomyEngine({
    budget: 1000,
    projectRules: "Preserve public APIs.",
  });
  const result = buildWithFixture(engine, fixture, { turn: 1 });
  const selectedText = JSON.stringify(result.selectedMessages);
  const artifactSources = result.artifacts.map((artifact) => artifact.source);

  assert.ok(artifactSources.includes("tool_result_latest_failure"));
  assert.doesNotMatch(selectedText, /FAIL FAIL FAIL FAIL FAIL FAIL FAIL FAIL/);
  assert.equal(
    result.selectedMessages.some(
      (message) => message.id === "tool_result_latest_failure",
    ),
    false,
  );

  return {
    artifact_sources: artifactSources,
    raw_long_output_not_selected: true,
  };
});

await record("latest failure: failure, verification state, and active plan survive pressure", () => {
  const fixture = createContextEconomyFixture();
  const engine = new ContextEconomyEngine({
    budget: 80,
    projectRules: "Preserve public APIs.",
  });
  const result = buildWithFixture(engine, fixture, { turn: 1 });
  const selectedNames = result.blocks.map((block) => block.name);

  assert.ok(selectedNames.includes("active_plan"));
  assert.ok(selectedNames.includes("verification_state"));
  assert.ok(selectedNames.includes("latest_failure"));

  return {
    budget: result.budget,
    selected_hard_state: selectedNames.filter((name) =>
      ["active_plan", "verification_state", "latest_failure"].includes(name),
    ),
    overBudgetAfterHardState: result.tokenReport.overBudgetAfterHardState,
  };
});

await record("no prompt-only saving: savings are proven by selection, artifacts, and cache", () => {
  const fixture = createContextEconomyFixture();
  const engine = new ContextEconomyEngine({
    budget: 210,
    projectRules: "Preserve public APIs. Prefer narrow edits. Verify before final.",
    memories: [
      {
        id: "cut-me",
        score: 0.99,
        text: "A low priority hint that should not displace hard state.",
      },
    ],
  });
  const first = buildWithFixture(engine, fixture, { turn: 1 });
  fixture.store.appendUserMessage(fixture.sessionId, "继续，保持同一稳定前缀。");
  const second = buildWithFixture(engine, fixture, {
    turn: 2,
    previousSnapshot: first,
  });

  assert.equal(second.economyProof.promptOnlySaving, false);
  assert.equal(second.economyProof.noPromptOnlySaving, true);
  assert.equal(second.economyProof.mechanisms.blockSelection, true);
  assert.equal(second.economyProof.mechanisms.artifactBoundary, true);
  assert.equal(second.economyProof.mechanisms.cacheSimulation, true);
  assert.ok(second.blocks.length < second.candidateBlocks.length);
  assert.ok(second.artifacts.length > 0);
  assert.ok(second.cacheReport.cacheHitTokens > 0);

  return {
    mechanisms: second.economyProof.mechanisms,
    evictedBlockCount: second.evictionReport.length,
    artifactSavedTokens: second.tokenReport.artifactSavedTokens,
    cacheHitTokens: second.cacheReport.cacheHitTokens,
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

function buildWithFixture(engine, fixture, { turn, previousSnapshot = null }) {
  return engine.build({
    sessionId: fixture.sessionId,
    workspaceRoot: fixture.workspaceRoot,
    turn,
    storeState: fixture.store.getState(fixture.sessionId),
    coreState: fixture.coreState,
    messages: fixture.store.buildModelMessageStream(fixture.sessionId),
    previousSnapshot,
  });
}
