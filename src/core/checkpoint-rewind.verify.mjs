import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CORE30_CHECKPOINT_REWIND_VERSION,
  CheckpointRewindError,
  applyPaginationTransaction,
  checkpointRewindBoundary,
  core30ImplementationValidationMatrix,
  createCheckpointRewindFixture,
  runCheckpointRewindDemo,
  verifyCheckpointRewindDemo,
} from "./checkpoint-rewind.mjs";

const cases = [];

await record("core30: checkpoint rewind demo runs and verifies", async () => {
  const result = await runCheckpointRewindDemo();
  return verifyCheckpointRewindDemo(result);
});

await record("validation matrix: Core 30 does not duplicate Core 22 or Core 24", async () => {
  const matrix = core30ImplementationValidationMatrix();

  assert.equal(matrix.topic, "Checkpoint / Rewind");
  assert.deepEqual(matrix.runtimeState, [
    "checkpoint",
    "rewindRequest",
    "fileStateSnapshot",
    "externalChangeConflict",
    "rewindAudit",
  ]);
  assert.equal(matrix.sameTopicMergeDecision.notCore22.includes("transaction commit"), true);
  assert.equal(matrix.sameTopicMergeDecision.notCore24.includes("append-only event log"), true);
  assert.equal(matrix.publicBoundary.rawPromptOrSourceMapText, false);
  assert.equal(matrix.publicBoundary.ownObjectModel, true);

  return {
    runtime_state: matrix.runtimeState,
    not_core22: matrix.sameTopicMergeDecision.notCore22,
    not_core24: matrix.sameTopicMergeDecision.notCore24,
    public_safe: true,
  };
});

await record("checkpoint creation: checkpoint binds file hashes session event and durable snapshot", async () => {
  const fixture = await createCheckpointRewindFixture();
  const checkpoint = await fixture.runtime.createCheckpoint({
    id: "checkpoint_creation_case",
    label: "Before edit",
    filePaths: fixture.filePaths,
  });
  const events = await fixture.store.readEvents(fixture.sessionId);

  assert.equal(checkpoint.visibleToUser, true);
  assert.equal(checkpoint.fileStateSnapshot.files.length, 2);
  assert.ok(checkpoint.fileStateSnapshot.files.every((file) => file.hash));
  assert.equal(typeof checkpoint.eventSeq, "number");
  assert.ok(checkpoint.eventHash);
  assert.ok(checkpoint.durableSnapshotId);
  assert.equal(events.some((event) => event.type === "checkpoint.created"), true);

  return {
    checkpoint_id: checkpoint.id,
    event_seq: checkpoint.eventSeq,
    durable_snapshot_id: checkpoint.durableSnapshotId,
    file_hashes: checkpoint.fileStateSnapshot.fileHashes,
  };
});

await record("rewind state: files and replay state return to target checkpoint", async () => {
  const fixture = await createCheckpointRewindFixture();
  const before = await fixture.runtime.createCheckpoint({
    id: "checkpoint_before_rewind_case",
    label: "Before fix",
    filePaths: fixture.filePaths,
  });
  await applyPaginationTransaction(fixture);
  const after = await fixture.runtime.createCheckpoint({
    id: "checkpoint_after_rewind_case",
    label: "After fix",
    filePaths: fixture.filePaths,
  });
  const result = await fixture.runtime.requestRewind({
    targetCheckpointId: before.id,
    fromCheckpointId: after.id,
  });
  const paginationText = await readFile(
    path.join(fixture.workspaceRoot, "src/pagination.cjs"),
    "utf8",
  );

  assert.equal(result.status, "rewound");
  assert.match(paginationText, /return start \+ pageSize \+ 1;/);
  assert.equal(result.restoredSessionState.objective, "Prove user-visible checkpoints can rewind file state safely.");
  assert.equal(result.audit.targetCheckpointId, before.id);
  assert.equal(result.audit.sourceCheckpointId, after.id);

  return {
    status: result.status,
    target_checkpoint: result.audit.targetCheckpointId,
    source_checkpoint: result.audit.sourceCheckpointId,
    restored_files: result.restoredFiles.map((file) => file.path),
    replay_state_objective: result.restoredSessionState.objective,
  };
});

await record("partial rewind denial: external user change is not overwritten", async () => {
  const fixture = await createCheckpointRewindFixture();
  const before = await fixture.runtime.createCheckpoint({
    id: "checkpoint_conflict_before_case",
    label: "Before fix",
    filePaths: fixture.filePaths,
  });
  await applyPaginationTransaction(fixture);
  const after = await fixture.runtime.createCheckpoint({
    id: "checkpoint_conflict_after_case",
    label: "After fix",
    filePaths: fixture.filePaths,
  });
  await fixture.store.appendEvent(fixture.sessionId, "user.message", {
    content: "I changed pagination manually after the checkpoint.",
  });
  const externalText = [
    "function pageStart(page, pageSize) {",
    "  return Math.max(0, page) * pageSize;",
    "}",
    "",
    "function pageEnd(start, pageSize) {",
    "  return start + pageSize;",
    "}",
    "",
    "module.exports = { pageStart, pageEnd };",
    "",
  ].join("\n");
  await writeExternalFile(fixture, "src/pagination.cjs", externalText);
  const denied = await fixture.runtime.requestRewind({
    targetCheckpointId: before.id,
    fromCheckpointId: after.id,
  });
  const afterDeniedText = await readFile(
    path.join(fixture.workspaceRoot, "src/pagination.cjs"),
    "utf8",
  );

  assert.equal(denied.status, "denied");
  assert.equal(denied.conflict.status, "external_change_conflict");
  assert.equal(denied.requiresConfirmation, true);
  assert.equal(denied.filesRestored.length, 0);
  assert.equal(afterDeniedText, externalText);

  return {
    denied_status: denied.status,
    conflict_status: denied.conflict.status,
    conflict_paths: denied.conflict.conflicts.map((item) => item.path),
    files_restored: denied.filesRestored.length,
    external_change_preserved: afterDeniedText === externalText,
  };
});

await record("audit replay: applied rewind explains source target files and seq", async () => {
  const fixture = await createCheckpointRewindFixture();
  const before = await fixture.runtime.createCheckpoint({
    id: "checkpoint_audit_before_case",
    label: "Before fix",
    filePaths: fixture.filePaths,
  });
  await applyPaginationTransaction(fixture);
  const after = await fixture.runtime.createCheckpoint({
    id: "checkpoint_audit_after_case",
    label: "After fix",
    filePaths: fixture.filePaths,
  });
  const rewind = await fixture.runtime.requestRewind({
    targetCheckpointId: before.id,
    fromCheckpointId: after.id,
  });
  const replay = await fixture.runtime.replayRewindAudit(rewind.request.id);

  assert.equal(replay.status, "replayed");
  assert.equal(replay.sourceCheckpointId, after.id);
  assert.equal(replay.targetCheckpointId, before.id);
  assert.equal(replay.restoredFiles.length, 2);
  assert.equal(replay.eventTypes.includes("rewind.requested"), true);
  assert.equal(replay.eventTypes.includes("rewind.applied"), true);
  assert.equal(replay.auditTrailExplainsRewind, true);

  return {
    event_types: replay.eventTypes,
    source_checkpoint: replay.sourceCheckpointId,
    target_checkpoint: replay.targetCheckpointId,
    restored_files: replay.restoredFiles.map((file) => file.path),
    replay_through_seq: replay.replayThroughSeq,
  };
});

await record("event log boundary: rewind appends audit events without truncating history", async () => {
  const fixture = await createCheckpointRewindFixture();
  const before = await fixture.runtime.createCheckpoint({
    id: "checkpoint_append_before_case",
    label: "Before fix",
    filePaths: fixture.filePaths,
  });
  await applyPaginationTransaction(fixture);
  const after = await fixture.runtime.createCheckpoint({
    id: "checkpoint_append_after_case",
    label: "After fix",
    filePaths: fixture.filePaths,
  });
  const beforeRewindEvents = await fixture.store.readEvents(fixture.sessionId);
  await fixture.runtime.requestRewind({
    targetCheckpointId: before.id,
    fromCheckpointId: after.id,
  });
  const afterRewindEvents = await fixture.store.readEvents(fixture.sessionId);

  assert.equal(afterRewindEvents.length > beforeRewindEvents.length, true);
  assert.equal(afterRewindEvents.some((event) => event.type === "tool.transaction"), true);
  assert.equal(afterRewindEvents.some((event) => event.type === "rewind.applied"), true);
  assert.deepEqual(
    beforeRewindEvents.map((event) => event.hash),
    afterRewindEvents.slice(0, beforeRewindEvents.length).map((event) => event.hash),
  );

  return {
    before_event_count: beforeRewindEvents.length,
    after_event_count: afterRewindEvents.length,
    history_prefix_preserved: true,
    rewind_event_appended: true,
  };
});

await record("boundary: checkpoint rewind is local evidence, not IDE rewind product", async () => {
  const boundary = checkpointRewindBoundary();

  assert.equal(CORE30_CHECKPOINT_REWIND_VERSION, "core30-checkpoint-rewind-v1");
  assert.equal(boundary.deterministicLocalCheckpointRewind, true);
  assert.equal(boundary.toolTransactionBoundary.implementsCore22Transaction, false);
  assert.equal(boundary.productionCheckpointProductClaim, false);
  assert.equal(boundary.officialImplementationClaim, false);
  assert.equal(boundary.completeIdeUiClaim, false);
  assert.equal(boundary.crossMachineRestoreClaim, false);
  assert.equal(boundary.distributedSessionStoreClaim, false);

  return {
    deterministic_local_checkpoint_rewind: true,
    no_core22_transaction_claim: true,
    no_production_checkpoint_product_claim: true,
    no_official_implementation_claim: true,
    no_cross_machine_restore_claim: true,
    no_distributed_session_store_claim: true,
  };
});

console.log(JSON.stringify({ passed: cases.length, cases }, null, 2));

async function writeExternalFile(fixture, relativePath, text) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path.join(fixture.workspaceRoot, relativePath), text, "utf8");
}

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
      code: error instanceof CheckpointRewindError ? error.code : undefined,
    });
    throw error;
  }
}
