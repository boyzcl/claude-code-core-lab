import assert from "node:assert/strict";
import {
  CORE24_DURABLE_SESSION_VERSION,
  createDurableSessionFixture,
  durableSessionBoundary,
  runDurableSessionStoreReplayDemo,
  verifyAppendOnlyLog,
  verifyDurableSessionStoreReplayDemo,
} from "./durable-session-store-replay.mjs";

const cases = [];

await record("core24: durable session demo runs and verifies", async () => {
  const result = await runDurableSessionStoreReplayDemo();
  return verifyDurableSessionStoreReplayDemo(result);
});

await record("append-only event log: sequence and hash chain cannot reorder", async () => {
  const fixture = await createDurableSessionFixture();
  const events = await fixture.store.readEvents(fixture.sessionId);
  const verification = verifyAppendOnlyLog(events);
  const reordered = [events[1], events[0], ...events.slice(2)];

  assert.equal(verification.valid, true);
  assert.deepEqual(
    events.map((event) => event.seq),
    Array.from({ length: events.length }, (_, index) => index + 1),
  );
  assert.throws(() => verifyAppendOnlyLog(reordered), /Expected values to be strictly equal/);

  return {
    event_count: events.length,
    append_only_hash_chain_verified: true,
    reordered_log_rejected: true,
  };
});

await record("snapshot restore: restored state matches snapshot replay state", async () => {
  const fixture = await createDurableSessionFixture();
  const restored = await fixture.store.restoreSnapshot(
    fixture.sessionId,
    fixture.snapshot.id,
  );
  const replayAtSnapshot = await fixture.store.replay(fixture.sessionId, {
    throughSeq: fixture.snapshot.throughSeq,
  });

  assert.equal(restored.id, fixture.snapshot.id);
  assert.equal(restored.stateHash, fixture.snapshot.stateHash);
  assert.deepEqual(restored.state, replayAtSnapshot.state);
  assert.equal(restored.state.activePlan.id, "plan_core24");

  return {
    snapshot_id: restored.id,
    state_hash: restored.stateHash,
    active_plan_restored: restored.state.activePlan.id,
  };
});

await record("crash recovery: pending action and active plan survive", async () => {
  const fixture = await createDurableSessionFixture();
  const recovery = await fixture.store.recoverAfterCrash(fixture.sessionId);

  assert.equal(recovery.status, "recovered");
  assert.equal(recovery.activePlan.id, "plan_core24");
  assert.equal(recovery.activePlan.currentStepId, "step_2");
  assert.ok(recovery.pendingActions.includes("Rerun node scripts/test.cjs"));
  assert.equal(recovery.state.crash.recoverable, true);

  return {
    from_snapshot: recovery.fromSnapshotId,
    replayed_tail_events: recovery.replayedTailEventCount,
    active_step: recovery.activePlan.currentStepId,
    pending_actions: recovery.pendingActions,
  };
});

await record("trace replay: old trace rebuilds equivalent key state", async () => {
  const fixture = await createDurableSessionFixture();
  const replay = await fixture.store.replay(fixture.sessionId);

  assert.equal(replay.state.activePlan.id, fixture.activePlan.id);
  assert.deepEqual(replay.state.modifiedFiles, ["src/pagination.cjs"]);
  assert.equal(replay.state.verificationState.status, "failed");
  assert.equal(
    replay.state.runtimeTrace.some((event) => event.event === "context.built"),
    true,
  );
  assert.equal(replay.state.modelGatewayDecisions.length, 1);
  assert.equal(replay.state.compactionAudit.length, 1);

  return {
    event_count: replay.eventCount,
    state_hash: replay.stateHash,
    runtime_trace_events: replay.state.runtimeTrace.map((event) => event.event),
    model_gateway_decisions: replay.state.modelGatewayDecisions.length,
  };
});

await record("compaction audit: replay explains before and after transition", async () => {
  const fixture = await createDurableSessionFixture();
  const replay = await fixture.store.replay(fixture.sessionId);
  const audit = replay.state.compactionAudit[0];

  assert.equal(audit.transitionId, "compaction_core24_001");
  assert.equal(audit.before.activePlan.id, "plan_core24");
  assert.equal(audit.after.compactSummary.activePlan.id, "plan_core24");
  assert.equal(audit.quality.status, "passed");
  assert.equal(audit.quality.failureType, null);
  assert.equal(audit.quality.diff.activePlan.before.id, "plan_core24");
  assert.equal(audit.quality.diff.activePlan.after.id, "plan_core24");

  return {
    transition_id: audit.transitionId,
    quality_status: audit.quality.status,
    active_plan_preserved: true,
    pending_actions_preserved: audit.quality.diff.pendingActions.before.length > 0,
  };
});

await record("secret boundary: raw provider credentials are not persisted", async () => {
  const fixture = await createDurableSessionFixture();
  const scan = await fixture.store.scanForSecrets(fixture.sessionId, {
    forbiddenValues: fixture.forbiddenValues,
  });
  const eventsText = await readEventLogText(fixture);

  assert.equal(scan.status, "passed");
  assert.equal(scan.matches.length, 0);
  assert.equal(eventsText.includes("local-test-provider-key"), false);
  assert.equal(eventsText.includes("Bearer local-test-provider-token"), false);
  assert.equal(eventsText.includes("[REDACTED]"), true);

  return {
    scanned_files: scan.scannedFileCount,
    secret_scan_status: scan.status,
    redaction_marker_present: true,
  };
});

await record("boundary: durable replay is local evidence, not production store", async () => {
  const result = await runDurableSessionStoreReplayDemo();

  assert.equal(CORE24_DURABLE_SESSION_VERSION, "core24-durable-session-store-replay-v1");
  assert.deepEqual(result.boundary, durableSessionBoundary());
  assert.equal(result.boundary.deterministicLocalDurableReplay, true);
  assert.equal(result.boundary.productionDurableStoreClaim, false);
  assert.equal(result.boundary.distributedStorageClaim, false);
  assert.equal(result.boundary.secretPersistenceClaim, false);

  return {
    deterministic_local_replay: true,
    no_production_durable_store_claim: true,
    no_distributed_storage_claim: true,
    no_secret_persistence_claim: true,
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

async function readEventLogText(fixture) {
  const { readFile } = await import("node:fs/promises");
  return readFile(fixture.store.eventLogPath(fixture.sessionId), "utf8");
}
