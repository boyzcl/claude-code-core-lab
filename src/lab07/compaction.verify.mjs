import assert from "node:assert/strict";
import {
  compactSession,
  restoreContext,
  runDemo,
  sampleInput,
  verifyDemo,
} from "./compaction.mjs";

const cases = [];

record("happy path: compact summary preserves hard state", () => {
  return verifyDemo(runDemo());
});

record("verification: failed state cannot become passed", () => {
  const compacted = compactSession(sampleInput());

  assert.equal(compacted.compactSummary.verificationState.status, "failed");
  assert.notEqual(compacted.compactSummary.verificationState.status, "passed");

  return {
    failed_verification_preserved: true,
  };
});

record("newer messages: restored separately after compact summary", () => {
  const compacted = compactSession(sampleInput());
  const restored = restoreContext(compacted);

  assert.match(restored.newerMessages[0].content, /keep the API exactly/);
  assert.deepEqual(restored.summary.latestUserConstraints, ["Do not change public API."]);

  return {
    newer_messages_not_overwritten_by_summary: true,
  };
});

record("long output: stored as artifact reference", () => {
  const compacted = compactSession(sampleInput());

  assert.equal(compacted.artifacts.length, 1);
  assert.match(compacted.compactSummary.olderHistorySummary[0], /artifact_1/);

  return {
    artifact_count: compacted.artifacts.length,
    summary_has_artifact_reference: true,
  };
});

record("pending actions: preserved across compaction", () => {
  const compacted = compactSession(sampleInput());

  assert.deepEqual(compacted.compactSummary.pendingActions, [
    "Adjust implementation",
    "Rerun npm test",
  ]);

  return {
    pending_actions_preserved: true,
  };
});

console.log(JSON.stringify({ passed: cases.length, cases }, null, 2));

function record(name, fn) {
  try {
    cases.push({
      name,
      status: "passed",
      details: fn(),
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
