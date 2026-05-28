import assert from "node:assert/strict";
import {
  CORE31_SUBAGENT_CONTEXT_ISOLATION_VERSION,
  assertSubagentContextIsolation,
  core31ImplementationValidationMatrix,
  createSubagentContextIsolationFixture,
  createSubagentTaskSpecs,
  runSubagentContextIsolationDemo,
  subagentContextIsolationBoundary,
  verifySubagentContextIsolationDemo,
} from "./subagent-context-isolation.mjs";

const cases = [];

await record("core31: subagent context isolation demo runs and verifies", async () => {
  const result = await runSubagentContextIsolationDemo();
  return verifySubagentContextIsolationDemo(result);
});

await record("validation matrix: Core 31 does not duplicate Core 21 24 or 25", async () => {
  const matrix = core31ImplementationValidationMatrix();

  assert.equal(matrix.topic, "Subagent Context Isolation");
  assert.deepEqual(matrix.runtimeState, [
    "delegatedTask",
    "subagentContext",
    "subagentResult",
    "delegationLedger",
    "isolationAudit",
  ]);
  assert.equal(matrix.sameTopicMergeDecision.notCore21.includes("multi-turn repair"), true);
  assert.equal(matrix.sameTopicMergeDecision.notCore24.includes("durable store"), true);
  assert.equal(matrix.sameTopicMergeDecision.notCore25.includes("repo index"), true);
  assert.equal(matrix.publicBoundary.rawPromptOrSourceMapText, false);
  assert.equal(matrix.publicBoundary.ownObjectModel, true);

  return {
    runtime_state: matrix.runtimeState,
    not_core21: matrix.sameTopicMergeDecision.notCore21,
    not_core24: matrix.sameTopicMergeDecision.notCore24,
    not_core25: matrix.sameTopicMergeDecision.notCore25,
    public_safe: true,
  };
});

await record("independent task: two delegated tasks run in one parallel group", async () => {
  const fixture = await createSubagentContextIsolationFixture();
  const parallel = await fixture.runtime.delegateTasksInParallel(fixture.tasks, {
    parallelGroupId: "parallel_verify_001",
  });

  assert.equal(parallel.status, "succeeded");
  assert.equal(parallel.results.length, 2);
  assert.equal(parallel.parallelGroupId, "parallel_verify_001");
  assert.deepEqual(parallel.independentTasks, [
    "task_find_pagination_source",
    "task_find_pagination_tests",
  ]);
  assert.equal(
    parallel.results.every((result) => result.researchExecuted === true),
    true,
  );

  return {
    status: parallel.status,
    parallel_group_id: parallel.parallelGroupId,
    task_ids: parallel.independentTasks,
    result_ids: parallel.results.map((result) => result.subagentResult.id),
  };
});

await record("context isolation: subagent sees only task-specific files", async () => {
  const fixture = await createSubagentContextIsolationFixture();
  const result = await fixture.runtime.delegateTask(fixture.tasks[0]);
  const context = result.subagentContext;

  assertSubagentContextIsolation(context, result.delegatedTask);
  assert.equal(
    context.selectedFiles.some((file) => file.path === "src/cart.cjs"),
    false,
  );
  assert.equal(
    context.selectedFiles.some((file) => file.path === "notes/private-plan.md"),
    false,
  );
  assert.equal(context.rawParentMessagesIncluded, false);

  return {
    selected_paths: context.selectedFiles.map((file) => file.path),
    excluded_parent_blocks: context.excludedParentBlocks,
    raw_parent_messages_included: context.rawParentMessagesIncluded,
  };
});

await record("no duplicate research: delegated task signature reuses ledger", async () => {
  const fixture = await createSubagentContextIsolationFixture();
  const first = await fixture.runtime.delegateTask(fixture.tasks[0]);
  const duplicate = await fixture.runtime.delegateTask({
    ...fixture.tasks[0],
    id: "task_find_pagination_source_again",
  });

  assert.equal(first.researchExecuted, true);
  assert.equal(duplicate.status, "duplicate_reused");
  assert.equal(duplicate.researchExecuted, false);
  assert.equal(duplicate.ledgerEntry.runCount, 1);
  assert.deepEqual(duplicate.ledgerEntry.reusedBy, [
    "task_find_pagination_source_again",
  ]);

  return {
    first_result_id: first.subagentResult.id,
    duplicate_status: duplicate.status,
    run_count: duplicate.ledgerEntry.runCount,
    reused_by: duplicate.ledgerEntry.reusedBy,
  };
});

await record("result contract: parent receives summary and evidence only", async () => {
  const fixture = await createSubagentContextIsolationFixture();
  const result = await fixture.runtime.delegateTask(fixture.tasks[1]);
  const receipt = result.parentReceipt;

  assert.equal(result.subagentResult.status, "succeeded");
  assert.equal(result.subagentResult.returnedToParent.summaryOnly, true);
  assert.equal(result.subagentResult.returnedToParent.evidenceLinksOnly, true);
  assert.equal(result.subagentResult.returnedToParent.rawContextIncluded, false);
  assert.equal(result.subagentResult.returnedToParent.rawTranscriptIncluded, false);
  assert.equal(receipt.rawSubagentContextStored, false);
  assert.equal(receipt.promotedToSystemPrompt, false);
  assert.ok(receipt.evidenceRefs.length > 0);

  return {
    receipt_status: receipt.status,
    evidence_refs: receipt.evidenceRefs.map((ref) => ref.kind),
    raw_context_included: result.subagentResult.returnedToParent.rawContextIncluded,
    promoted_to_system_prompt: receipt.promotedToSystemPrompt,
  };
});

await record("failure propagation: subagent failure reaches parent as structured failure", async () => {
  const fixture = await createSubagentContextIsolationFixture();
  const result = await fixture.runtime.delegateTask({
    id: "task_missing_symbol_verify",
    type: "missing_symbol_research",
    objective: "Find missing billing symbol in isolated context.",
    query: "billing symbol",
    allowedPaths: ["src/pagination.cjs"],
    forbiddenPaths: ["notes/private-plan.md"],
  });

  assert.equal(result.status, "failed");
  assert.equal(result.subagentResult.failure.structured, true);
  assert.equal(result.parentReceipt.status, "accepted_as_structured_failure");
  assert.equal(result.parentReceipt.failure.retryHint.includes("parent"), true);

  return {
    status: result.status,
    failure_reason: result.subagentResult.failure.reason,
    retry_hint: result.subagentResult.failure.retryHint,
    parent_receipt_status: result.parentReceipt.status,
  };
});

await record("isolation audit: delegation ledger is replayable from session events", async () => {
  const fixture = await createSubagentContextIsolationFixture();
  await fixture.runtime.delegateTasksInParallel(fixture.tasks, {
    parallelGroupId: "parallel_audit_001",
  });
  const replay = await fixture.runtime.replayDelegationLedger();

  assert.equal(replay.status, "replayed");
  assert.equal(replay.replayExplainsDelegation, true);
  assert.equal(replay.eventTypes.includes("delegation.started"), true);
  assert.equal(replay.eventTypes.includes("subagent.result_received"), true);
  assert.equal(replay.ledgerEntries.length, 2);

  return {
    event_types: replay.eventTypes,
    ledger_entries: replay.ledgerEntries.length,
    result_ids: replay.resultIds,
  };
});

await record("boundary: subagent isolation is local evidence not agent marketplace", async () => {
  const boundary = subagentContextIsolationBoundary();
  const taskSpecs = createSubagentTaskSpecs();

  assert.equal(
    CORE31_SUBAGENT_CONTEXT_ISOLATION_VERSION,
    "core31-subagent-context-isolation-v1",
  );
  assert.equal(taskSpecs.length, 2);
  assert.equal(boundary.deterministicLocalSubagentIsolation, true);
  assert.equal(boundary.longRunningEvalBoundary.implementsCore21Eval, false);
  assert.equal(boundary.productionSubagentSchedulerClaim, false);
  assert.equal(boundary.officialImplementationClaim, false);
  assert.equal(boundary.realMultiProcessClaim, false);
  assert.equal(boundary.remoteWorkerIsolationClaim, false);
  assert.equal(boundary.agentMarketplaceClaim, false);

  return {
    deterministic_local_subagent_isolation: true,
    no_core21_eval_claim: true,
    no_production_scheduler_claim: true,
    no_official_implementation_claim: true,
    no_remote_worker_isolation_claim: true,
    no_agent_marketplace_claim: true,
  };
});

console.log(JSON.stringify({ passed: cases.length, cases }, null, 2));

async function record(name, fn) {
  try {
    const details = await fn();
    cases.push({
      name,
      status: "passed",
      details,
    });
  } catch (error) {
    cases.push({
      name,
      status: "failed",
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
    console.log(JSON.stringify({ passed: cases.length - 1, cases }, null, 2));
    throw error;
  }
}
