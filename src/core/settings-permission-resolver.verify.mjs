import assert from "node:assert/strict";
import {
  CORE27_SETTINGS_PERMISSION_RESOLVER_VERSION,
  PermissionResolverError,
  PermissionedActionHarness,
  SettingsPermissionResolver,
  assertNoHiddenPermissionExecution,
  core27ImplementationValidationMatrix,
  createActionFixtures,
  createPermissionConfigFixture,
  createPrefixOnlyResolver,
  runSettingsPermissionResolverDemo,
  settingsPermissionResolverBoundary,
  verifySettingsPermissionResolverDemo,
} from "./settings-permission-resolver.mjs";

const cases = [];

await record("core27: settings permission resolver demo runs and verifies", async () => {
  const result = await runSettingsPermissionResolverDemo();
  return verifySettingsPermissionResolverDemo(result);
});

await record("validation matrix: Core 27 does not duplicate Core 22 or Core 26", async () => {
  const matrix = core27ImplementationValidationMatrix();

  assert.equal(matrix.topic, "Settings / Permission Resolver");
  assert.deepEqual(matrix.runtimeState, [
    "permissionConfig",
    "resolverTrace",
    "ruleSource",
    "decisionCache",
  ]);
  assert.equal(matrix.sameTopicMergeDecision.notCore22.includes("commit"), true);
  assert.equal(matrix.sameTopicMergeDecision.notCore26.includes("approve"), true);
  assert.equal(matrix.publicBoundary.rawPromptOrSourceMapText, false);
  assert.equal(matrix.publicBoundary.ownObjectModel, true);

  return {
    runtime_state: matrix.runtimeState,
    not_core22: matrix.sameTopicMergeDecision.notCore22,
    not_core26: matrix.sameTopicMergeDecision.notCore26,
    public_safe: true,
  };
});

await record("config precedence: policy/local/project/user rules are explainable", async () => {
  const resolver = new SettingsPermissionResolver({
    permissionConfig: createPermissionConfigFixture(),
  });
  const actions = createActionFixtures();
  const policyWins = resolver.resolve(actions.precedencePushMain);
  const localWins = resolver.resolve(actions.allowTest);
  const matchedSources = policyWins.trace
    .filter((entry) => entry.matched)
    .map((entry) => entry.source);

  assert.equal(policyWins.decision, "deny");
  assert.equal(policyWins.ruleSource, "policy");
  assert.deepEqual(matchedSources, ["policy", "project", "user"]);
  assert.equal(
    policyWins.shadowedMatches.some((entry) => entry.source === "project"),
    true,
  );
  assert.equal(localWins.decision, "allow");
  assert.equal(localWins.ruleSource, "local");
  assert.deepEqual(policyWins.precedence, ["policy", "local", "project", "user"]);

  return {
    policy_decision: policyWins.decision,
    policy_rule_source: policyWins.ruleSource,
    shadowed_sources: policyWins.shadowedMatches.map((entry) => entry.source),
    local_decision: localWins.decision,
    precedence: policyWins.precedence,
  };
});

await record("allow ask deny: one resolver feeds execute, approval, and refusal paths", async () => {
  const harness = new PermissionedActionHarness({
    resolver: new SettingsPermissionResolver(),
  });
  const actions = createActionFixtures();
  const allow = harness.requestAction(actions.allowTest);
  const ask = harness.requestAction(actions.askPush);
  const deny = harness.requestAction(actions.denyRemove);

  assert.equal(allow.status, "executed");
  assert.equal(allow.resolution.decision, "allow");
  assert.equal(ask.status, "approval_required");
  assert.equal(ask.approval.targetProtocol, "core26-human-approval-interruption-protocol");
  assert.equal(deny.status, "denied");
  assert.equal(deny.resolution.decision, "deny");
  assert.deepEqual(
    harness.toolExecutions.map((entry) => entry.id),
    ["run_tests"],
  );

  return {
    allow_status: allow.status,
    ask_status: ask.status,
    deny_status: deny.status,
    executed_actions: harness.toolExecutions.map((entry) => entry.id),
    approval_requests: harness.approvalRequests.map((entry) => entry.id),
  };
});

await record("prefix command rule: explicit prefix does not allow similar command", async () => {
  const resolver = createPrefixOnlyResolver();
  const allowed = resolver.resolve({
    id: "npm_test_args",
    tool: "Bash",
    command: "npm test -- --runInBand",
  });
  const similarWord = resolver.resolve({
    id: "npm_testing",
    tool: "Bash",
    command: "npm testing --fast",
  });
  const similarScript = resolver.resolve({
    id: "npm_test_unit",
    tool: "Bash",
    command: "npm test:unit",
  });

  assert.equal(allowed.decision, "allow");
  assert.equal(allowed.ruleSource, "policy");
  assert.notEqual(similarWord.decision, "allow");
  assert.notEqual(similarScript.decision, "allow");
  assert.equal(similarWord.ruleSource, "default");
  assert.equal(similarScript.ruleSource, "default");

  return {
    allowed_command: allowed.decision,
    similar_word_decision: similarWord.decision,
    similar_script_decision: similarScript.decision,
  };
});

await record("no hidden execution: ask and deny produce zero provider/tool deltas", async () => {
  const harness = new PermissionedActionHarness({
    resolver: new SettingsPermissionResolver(),
  });
  const actions = createActionFixtures();
  const ask = harness.requestAction(actions.askPush);
  const deny = harness.requestAction(actions.denyRemove);
  const assertion = assertNoHiddenPermissionExecution(harness.trace);

  assert.equal(ask.counters.delta.providerCalls, 0);
  assert.equal(ask.counters.delta.toolExecutions, 0);
  assert.equal(deny.counters.delta.providerCalls, 0);
  assert.equal(deny.counters.delta.toolExecutions, 0);
  assert.equal(harness.providerCalls, 0);
  assert.equal(harness.toolExecutions.length, 0);
  assert.equal(assertion.valid, true);

  return {
    ask_delta: ask.counters.delta,
    deny_delta: deny.counters.delta,
    provider_calls: harness.providerCalls,
    tool_executions: harness.toolExecutions.length,
  };
});

await record("decision cache: repeated action records cache hit without losing source", async () => {
  const resolver = new SettingsPermissionResolver();
  const actions = createActionFixtures();
  const first = resolver.resolve(actions.allowTest);
  const second = resolver.resolve(actions.allowTest);
  const trace = resolver.getResolverTrace();

  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, true);
  assert.equal(second.ruleSource, "local");
  assert.equal(second.matchedRule.id, "local_allow_test_runner");
  assert.equal(resolver.decisionCache.size, 1);
  assert.equal(trace.some((entry) => entry.event === "permission.cache_hit"), true);

  return {
    first_from_cache: first.fromCache,
    second_from_cache: second.fromCache,
    rule_source: second.ruleSource,
    cache_size: resolver.decisionCache.size,
    trace_events: trace.map((entry) => entry.event),
  };
});

await record("boundary: resolver is local evidence, not enterprise policy product", async () => {
  const boundary = settingsPermissionResolverBoundary();

  assert.equal(
    CORE27_SETTINGS_PERMISSION_RESOLVER_VERSION,
    "core27-settings-permission-resolver-v1",
  );
  assert.equal(boundary.deterministicLocalPermissionResolver, true);
  assert.equal(boundary.preToolExecutionDecision, true);
  assert.equal(boundary.configPrecedenceEvidence, true);
  assert.equal(boundary.core22TransactionClaim, false);
  assert.equal(boundary.core26ApprovalDecisionClaim, false);
  assert.equal(boundary.productionClaudeCodeClaim, false);
  assert.equal(boundary.officialImplementationClaim, false);
  assert.equal(boundary.enterprisePolicyClaim, false);
  assert.equal(boundary.guiPermissionProductClaim, false);

  return {
    deterministic_local_permission_resolver: true,
    no_core22_transaction_claim: true,
    no_core26_approval_decision_claim: true,
    no_enterprise_policy_claim: true,
    no_gui_permission_product_claim: true,
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
      code: error instanceof PermissionResolverError ? error.code : undefined,
    });
    throw error;
  }
}
