import assert from "node:assert/strict";
import {
  CORE28_HOOKS_LIFECYCLE_VERSION,
  HookLifecycleError,
  assertNoHiddenHookExecution,
  core28ImplementationValidationMatrix,
  createHookActionFixtures,
  createHooksLifecycleFixture,
  hooksLifecycleBoundary,
  runHooksLifecycleDemo,
  verifyHooksLifecycleDemo,
} from "./hooks-lifecycle.mjs";

const cases = [];

await record("core28: hooks lifecycle demo runs and verifies", async () => {
  const result = await runHooksLifecycleDemo();
  return verifyHooksLifecycleDemo(result);
});

await record("validation matrix: Core 28 does not duplicate Core 24 or Core 26", async () => {
  const matrix = core28ImplementationValidationMatrix();

  assert.equal(matrix.topic, "Hooks Lifecycle");
  assert.deepEqual(matrix.runtimeState, [
    "hookRegistry",
    "hookEvent",
    "hookDecision",
    "hookFeedback",
    "redactedHookOutput",
  ]);
  assert.equal(matrix.sameTopicMergeDecision.notCore24.includes("durable store"), true);
  assert.equal(matrix.sameTopicMergeDecision.notCore26.includes("approve"), true);
  assert.equal(matrix.publicBoundary.rawPromptOrSourceMapText, false);
  assert.equal(matrix.publicBoundary.ownObjectModel, true);

  return {
    runtime_state: matrix.runtimeState,
    not_core24: matrix.sameTopicMergeDecision.notCore24,
    not_core26: matrix.sameTopicMergeDecision.notCore26,
    public_safe: true,
  };
});

await record("pre tool hook: block prevents tool execution and enters event log", async () => {
  const fixture = await createHooksLifecycleFixture();
  const actions = createHookActionFixtures();
  const result = await fixture.runtime.requestAction(actions.preBlocked);
  const events = await fixture.store.readEvents(fixture.sessionId);

  assert.equal(result.status, "blocked_by_hook");
  assert.equal(result.blocked.hookDecision.decision, "block");
  assert.equal(result.counters.delta.toolExecutions, 0);
  assert.ok(events.some((event) => event.type === "hook.pre_tool.blocked"));
  assert.ok(events.some((event) => event.type === "tool.blocked_by_hook"));

  return {
    blocked_status: result.status,
    hook_id: result.blocked.hookDecision.hookId,
    tool_execution_delta: result.counters.delta.toolExecutions,
    event_types: events.map((event) => event.type),
  };
});

await record("post tool hook: feedback enters next context as observation", async () => {
  const fixture = await createHooksLifecycleFixture();
  const actions = createHookActionFixtures();
  const result = await fixture.runtime.requestAction(actions.safeTest);
  const observation = result.contextSnapshot.dynamicObservations.find(
    (item) => item.sourceHookId === "hook_post_test_feedback",
  );

  assert.equal(result.status, "executed");
  assert.equal(result.postHookReport.results.some((item) => item.decision === "message"), true);
  assert.ok(observation);
  assert.equal(observation.type, "hook_observation");
  assert.equal(observation.promotedToSystem, false);
  assert.equal(result.contextSnapshot.systemMessages.length, 0);
  assert.equal(result.contextSnapshot.hookFeedbackPromotedToSystem, false);

  return {
    executed_action: result.execution.id,
    observation_source: observation.sourceHookId,
    promoted_to_system: observation.promotedToSystem,
    system_message_count: result.contextSnapshot.systemMessages.length,
  };
});

await record("user prompt hook: constraint enters runtime state, not system prompt", async () => {
  const fixture = await createHooksLifecycleFixture();
  const result = await fixture.runtime.handleUserPrompt({
    id: "prompt_public_api",
    content: "请保持 public API 稳定。",
  });

  assert.equal(result.status, "processed");
  assert.ok(result.constraints.includes("Hook constraint: keep exported API names stable."));
  assert.equal(result.contextSnapshot.hookFeedbackPromotedToSystem, false);
  assert.equal(result.contextSnapshot.systemMessages.length, 0);

  return {
    constraints: result.constraints,
    hook_feedback_promoted_to_system: result.contextSnapshot.hookFeedbackPromotedToSystem,
    system_message_count: result.contextSnapshot.systemMessages.length,
  };
});

await record("hook failure: structured failure does not bypass permission denial", async () => {
  const fixture = await createHooksLifecycleFixture();
  const actions = createHookActionFixtures();
  const result = await fixture.runtime.requestAction(actions.denyWithHookFailure);

  assert.equal(result.status, "denied");
  assert.equal(result.denial.permission.decision, "deny");
  assert.equal(result.denial.preHookReport.failures.length, 1);
  assert.equal(
    result.denial.preHookReport.failures[0].error.error_type,
    "hook_failed",
  );
  assert.equal(result.counters.delta.toolExecutions, 0);
  assert.equal(fixture.runtime.state.executedActions.length, 0);

  return {
    denied_status: result.status,
    permission_decision: result.denial.permission.decision,
    hook_failure_count: result.denial.preHookReport.failures.length,
    tool_execution_delta: result.counters.delta.toolExecutions,
  };
});

await record("secret boundary: hook output is redacted before storage", async () => {
  const fixture = await createHooksLifecycleFixture();
  const actions = createHookActionFixtures();
  await fixture.runtime.requestAction(actions.safeTest);
  await fixture.runtime.requestAction(actions.denyWithHookFailure);
  const scan = await fixture.store.scanForSecrets(fixture.sessionId, {
    forbiddenValues: fixture.forbiddenValues,
  });
  const events = await fixture.store.readEvents(fixture.sessionId);
  const serializedEvents = JSON.stringify(events);

  assert.equal(scan.status, "passed");
  assert.equal(serializedEvents.includes("Bearer local-hook-token"), false);
  assert.equal(serializedEvents.includes("sk-hook-secret-123456"), false);
  assert.equal(serializedEvents.includes("[REDACTED]"), true);

  return {
    secret_scan_status: scan.status,
    scanned_files: scan.scannedFileCount,
    redaction_marker_present: serializedEvents.includes("[REDACTED]"),
  };
});

await record("no hidden execution: blocked and denied actions never execute", async () => {
  const fixture = await createHooksLifecycleFixture();
  const actions = createHookActionFixtures();
  await fixture.runtime.requestAction(actions.preBlocked);
  await fixture.runtime.requestAction(actions.denyWithHookFailure);
  const assertion = assertNoHiddenHookExecution(fixture.runtime.state.runtimeTrace);

  assert.equal(assertion.valid, true);
  assert.deepEqual(assertion.blockedActionIds, ["test_with_write_mode"]);
  assert.deepEqual(assertion.deniedActionIds, ["deny_with_hook_failure"]);
  assert.equal(fixture.runtime.state.executedActions.length, 0);

  return {
    blocked_action_ids: assertion.blockedActionIds,
    denied_action_ids: assertion.deniedActionIds,
    executed_action_count: fixture.runtime.state.executedActions.length,
  };
});

await record("boundary: hooks lifecycle is local evidence, not shell hook product", async () => {
  const boundary = hooksLifecycleBoundary();

  assert.equal(CORE28_HOOKS_LIFECYCLE_VERSION, "core28-hooks-lifecycle-v1");
  assert.equal(boundary.deterministicLocalHooksLifecycle, true);
  assert.equal(boundary.replayableSessionEvents, true);
  assert.equal(boundary.productionHooksClaim, false);
  assert.equal(boundary.officialImplementationClaim, false);
  assert.equal(boundary.shellHookProductClaim, false);
  assert.equal(boundary.arbitraryScriptSandboxClaim, false);
  assert.equal(boundary.pluginSystemClaim, false);

  return {
    deterministic_local_hooks_lifecycle: true,
    replayable_session_events: true,
    no_shell_hook_product_claim: true,
    no_arbitrary_script_sandbox_claim: true,
    no_plugin_system_claim: true,
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
      code: error instanceof HookLifecycleError ? error.code : undefined,
    });
    throw error;
  }
}
