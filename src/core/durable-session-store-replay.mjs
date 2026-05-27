import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compactSession } from "../lab07/compaction.mjs";
import { evaluateCompactionQuality } from "./compaction-quality.mjs";

export const CORE24_DURABLE_SESSION_VERSION =
  "core24-durable-session-store-replay-v1";

const REDACTED = "[REDACTED]";
const SECRET_KEY_PATTERN =
  /api[_-]?key|authorization|bearer|credential|secret|token|password/i;

export class DurableSessionStore {
  constructor({ rootDir }) {
    if (!rootDir) {
      throw new DurableSessionError(
        "missing_root_dir",
        "DurableSessionStore requires a rootDir.",
      );
    }

    this.rootDir = rootDir;
    this.sessionSeq = 0;
  }

  async createSession({
    sessionId = null,
    workspaceRoot = "/workspace/core-24",
    mode = "execute",
    initialState = {},
  } = {}) {
    const id = sessionId ?? `session_core24_${String(++this.sessionSeq).padStart(3, "0")}`;
    await mkdir(this.sessionDir(id), { recursive: true });
    await writeFile(this.eventLogPath(id), "", "utf8");
    await mkdir(this.snapshotDir(id), { recursive: true });
    await this.appendEvent(id, "session.created", {
      sessionId: id,
      workspaceRoot,
      mode,
      initialState,
    });

    return id;
  }

  async appendEvent(sessionId, type, payload = {}, { source = "runtime" } = {}) {
    const events = await this.readEvents(sessionId, { verify: true });
    const previousHash = events.at(-1)?.hash ?? "root";
    const event = {
      version: CORE24_DURABLE_SESSION_VERSION,
      seq: events.length + 1,
      type,
      source,
      payload: sanitizeForStorage(payload),
      previousHash,
    };
    event.hash = hashEvent(event);

    await appendFile(this.eventLogPath(sessionId), `${stableStringify(event)}\n`, "utf8");
    return cloneJson(event);
  }

  async createSnapshot(sessionId, { reason = "manual_snapshot" } = {}) {
    const replay = await this.replay(sessionId);
    const snapshot = {
      version: CORE24_DURABLE_SESSION_VERSION,
      id: `snapshot_${String(replay.lastSeq).padStart(3, "0")}`,
      sessionId,
      throughSeq: replay.lastSeq,
      reason,
      eventCount: replay.eventCount,
      eventLogHash: replay.eventLogHash,
      stateHash: hashJson(replay.state),
      state: replay.state,
      boundary: durableSessionBoundary(),
    };
    await writeFile(
      this.snapshotPath(sessionId, snapshot.id),
      `${stableStringify(snapshot)}\n`,
      "utf8",
    );

    return cloneJson(snapshot);
  }

  async restoreSnapshot(sessionId, snapshotId = null) {
    const snapshots = await this.listSnapshots(sessionId);
    const target = snapshotId
      ? snapshots.find((snapshot) => snapshot.id === snapshotId)
      : snapshots.at(-1);

    if (!target) {
      throw new DurableSessionError(
        "snapshot_not_found",
        `Snapshot not found for session ${sessionId}.`,
      );
    }

    return cloneJson(target);
  }

  async recoverAfterCrash(sessionId) {
    const snapshot = await this.restoreSnapshot(sessionId);
    const tailReplay = await this.replay(sessionId, {
      fromSeq: snapshot.throughSeq + 1,
      initialState: snapshot.state,
    });

    return {
      status: "recovered",
      sessionId,
      fromSnapshotId: snapshot.id,
      snapshotThroughSeq: snapshot.throughSeq,
      replayedTailEventCount: tailReplay.eventCount,
      state: tailReplay.state,
      activePlan: tailReplay.state.activePlan,
      pendingActions: tailReplay.state.pendingActions,
      replayReport: {
        lastSeq: tailReplay.lastSeq,
        stateHash: tailReplay.stateHash,
        eventLogHash: tailReplay.eventLogHash,
      },
      boundary: durableSessionBoundary(),
    };
  }

  async replay(sessionId, {
    fromSeq = 1,
    throughSeq = null,
    initialState = null,
  } = {}) {
    const events = (await this.readEvents(sessionId, { verify: true })).filter(
      (event) =>
        event.seq >= fromSeq && (throughSeq == null || event.seq <= throughSeq),
    );
    const state = events.reduce(
      (acc, event) => applyDurableEvent(acc, event),
      initialState ? cloneJson(initialState) : emptyReplayState(),
    );
    const lastSeq = events.at(-1)?.seq ?? (fromSeq > 1 ? fromSeq - 1 : 0);

    return {
      version: CORE24_DURABLE_SESSION_VERSION,
      sessionId,
      eventCount: events.length,
      firstSeq: events[0]?.seq ?? null,
      lastSeq,
      eventTypes: events.map((event) => event.type),
      eventLogHash: hashJson(events.map((event) => event.hash)),
      state,
      stateHash: hashJson(state),
      replayTimeline: events.map((event) => ({
        seq: event.seq,
        type: event.type,
        hash: event.hash,
      })),
      boundary: durableSessionBoundary(),
    };
  }

  async readEvents(sessionId, { verify = true } = {}) {
    let text = "";
    try {
      text = await readFile(this.eventLogPath(sessionId), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }

    const events = text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));

    if (verify) {
      verifyAppendOnlyLog(events);
    }

    return events;
  }

  async listSnapshots(sessionId) {
    let names = [];
    try {
      names = await readdir(this.snapshotDir(sessionId));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }

    const snapshots = [];
    for (const name of names.filter((item) => item.endsWith(".json")).sort()) {
      const text = await readFile(path.join(this.snapshotDir(sessionId), name), "utf8");
      snapshots.push(JSON.parse(text));
    }

    return snapshots;
  }

  async scanForSecrets(sessionId, { forbiddenValues = [] } = {}) {
    const files = [
      this.eventLogPath(sessionId),
      ...(await this.listSnapshots(sessionId)).map((snapshot) =>
        this.snapshotPath(sessionId, snapshot.id),
      ),
    ];
    const matches = [];

    for (const file of files) {
      const text = await readFile(file, "utf8");
      for (const value of forbiddenValues.filter(Boolean)) {
        if (text.includes(value)) {
          matches.push({
            file,
            kind: "forbidden_value",
          });
        }
      }
      if (/Bearer\s+\S+/i.test(text) || /sk-[A-Za-z0-9_-]{8,}/.test(text)) {
        matches.push({
          file,
          kind: "secret_pattern",
        });
      }
    }

    return {
      status: matches.length === 0 ? "passed" : "failed",
      scannedFileCount: files.length,
      matches,
      redactionMarkerPresent: files.length > 0,
    };
  }

  sessionDir(sessionId) {
    return path.join(this.rootDir, sessionId);
  }

  eventLogPath(sessionId) {
    return path.join(this.sessionDir(sessionId), "events.jsonl");
  }

  snapshotDir(sessionId) {
    return path.join(this.sessionDir(sessionId), "snapshots");
  }

  snapshotPath(sessionId, snapshotId) {
    return path.join(this.snapshotDir(sessionId), `${snapshotId}.json`);
  }
}

export class DurableSessionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DurableSessionError";
    this.code = code;
    this.details = details;
  }
}

export async function recordCompactionTransition(store, sessionId, {
  transitionId = "compaction_core24_001",
  before,
  compacted = compactSession(before),
  reason = "token_budget_pressure",
} = {}) {
  const quality = evaluateCompactionQuality({ before, compacted });
  await store.appendEvent(sessionId, "compaction.before", {
    transitionId,
    reason,
    before,
  });
  await store.appendEvent(sessionId, "compaction.after", {
    transitionId,
    compactSummary: compacted.compactSummary,
    artifacts: compacted.artifacts,
    newerMessages: compacted.newerMessages,
    quality,
  });

  return {
    transitionId,
    quality,
    compacted,
  };
}

export async function runDurableSessionStoreReplayDemo() {
  const fixture = await createDurableSessionFixture();
  const report = await buildDurableSessionReport(fixture);

  return {
    checks: verifyDurableSessionStoreReplayDemo(report),
    ...report,
  };
}

export async function createDurableSessionFixture() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "agent-core24-"));
  const store = new DurableSessionStore({ rootDir });
  const sessionId = await store.createSession({
    workspaceRoot: "/workspace/core-24-durable-session-store-replay",
    mode: "execute",
    initialState: {
      objective: "Fix pagination boundary bug while preserving public API.",
      latestUserConstraints: ["Do not change the public API."],
    },
  });
  const activePlan = {
    id: "plan_core24",
    status: "approved",
    currentStepId: "step_2",
    steps: [
      {
        id: "step_1",
        text: "Read pagination implementation",
        status: "done",
        expectedTools: ["Read"],
      },
      {
        id: "step_2",
        text: "Patch empty page guard",
        status: "active",
        expectedTools: ["Edit"],
      },
      {
        id: "step_3",
        text: "Run final verification",
        status: "pending",
        expectedTools: ["Bash"],
      },
    ],
  };
  const credentialValue = "local-test-provider-key";
  const bearerValue = "Bearer local-test-provider-token";

  await store.appendEvent(sessionId, "user.message", {
    content:
      "修复分页边界问题，保持公开 API 不变；如果中途崩溃，要能恢复到下一步。",
  });
  await store.appendEvent(sessionId, "plan.snapshot", {
    activePlan,
  });
  await store.appendEvent(sessionId, "pending_actions.updated", {
    pendingActions: ["Patch empty page guard", "Run final verification"],
  });
  await store.appendEvent(sessionId, "runtime.trace", {
    event: "context.built",
    turn: 1,
    blockNames: ["latest_user", "active_plan", "verification_state"],
  });
  await store.appendEvent(sessionId, "model.gateway_decision", {
    providerId: "primary",
    model: "core23-budgeted-primary",
    budgetDecision: {
      reason: "within_budget",
      estimatedCostUsd: 0.00155,
    },
    providerCredential: {
      apiKey: credentialValue,
      authorization: bearerValue,
    },
  });
  await appendToolTurn(store, sessionId, {
    callId: "tool_call_edit_guard",
    resultId: "tool_result_edit_guard",
    name: "Edit",
    input: {
      path: "src/pagination.cjs",
      old_string: "return items.slice(start, end);",
      new_string: "return start >= items.length ? [] : items.slice(start, end);",
    },
    status: "success",
    content: {
      path: "src/pagination.cjs",
      replacements: 1,
    },
  });
  await appendToolTurn(store, sessionId, {
    callId: "tool_call_bash_failed",
    resultId: "tool_result_bash_failed",
    name: "Bash",
    input: {
      command: "node scripts/test.cjs",
    },
    status: "error",
    content: {
      command: "node scripts/test.cjs",
      exitCode: 1,
      stdout: "",
      stderr: "Expected empty page to be [], received [5].",
    },
  });
  await store.appendEvent(sessionId, "pending_actions.updated", {
    pendingActions: [
      "Inspect latest failure",
      "Resume active plan step after crash",
      "Rerun node scripts/test.cjs",
    ],
  });

  const snapshot = await store.createSnapshot(sessionId, {
    reason: "after_failed_verification_before_crash",
  });
  const replayAtSnapshot = await store.replay(sessionId, {
    throughSeq: snapshot.throughSeq,
  });
  const beforeCompaction = buildCompactionInputFromReplay(replayAtSnapshot);
  const compaction = await recordCompactionTransition(store, sessionId, {
    before: beforeCompaction,
  });
  await store.appendEvent(sessionId, "runtime.crashed", {
    reason: "simulated_process_exit_after_compaction",
    recoverable: true,
  });

  return {
    rootDir,
    store,
    sessionId,
    activePlan,
    snapshot,
    replayAtSnapshot,
    compaction,
    forbiddenValues: [credentialValue, bearerValue],
  };
}

export async function buildDurableSessionReport(fixture) {
  const events = await fixture.store.readEvents(fixture.sessionId);
  const restored = await fixture.store.restoreSnapshot(
    fixture.sessionId,
    fixture.snapshot.id,
  );
  const recovered = await fixture.store.recoverAfterCrash(fixture.sessionId);
  const replay = await fixture.store.replay(fixture.sessionId);
  const secretScan = await fixture.store.scanForSecrets(fixture.sessionId, {
    forbiddenValues: fixture.forbiddenValues,
  });
  const compactionAudit = replay.state.compactionAudit[0];

  return {
    version: CORE24_DURABLE_SESSION_VERSION,
    status: "passed",
    rootDir: fixture.rootDir,
    sessionId: fixture.sessionId,
    eventLog: {
      path: fixture.store.eventLogPath(fixture.sessionId),
      eventCount: events.length,
      sequence: events.map((event) => event.seq),
      hashes: events.map((event) => event.hash),
      appendOnly: verifyAppendOnlyLog(events).valid,
    },
    snapshot: fixture.snapshot,
    restored,
    recovery: recovered,
    replay,
    compactionAudit,
    secretScan,
    boundary: durableSessionBoundary(),
  };
}

export function verifyDurableSessionStoreReplayDemo(report) {
  assert.equal(report.version, CORE24_DURABLE_SESSION_VERSION);
  assert.equal(report.status, "passed");
  assert.equal(report.eventLog.appendOnly, true);
  assert.equal(report.restored.stateHash, report.snapshot.stateHash);
  assert.equal(report.recovery.status, "recovered");
  assert.equal(report.recovery.activePlan.id, "plan_core24");
  assert.equal(report.recovery.pendingActions.length > 0, true);
  assert.equal(report.replay.state.activePlan.id, "plan_core24");
  assert.equal(report.compactionAudit.quality.status, "passed");
  assert.equal(report.secretScan.status, "passed");
  assert.equal(report.boundary.productionDurableStoreClaim, false);

  return {
    append_only_log_verified: true,
    snapshot_restore_verified: true,
    crash_recovery_verified: true,
    trace_replay_verified: true,
    compaction_audit_verified: true,
    secret_scan_passed: true,
    no_production_claim: true,
  };
}

export function durableSessionBoundary() {
  return {
    deterministicLocalDurableReplay: true,
    productionDurableStoreClaim: false,
    distributedStorageClaim: false,
    secretPersistenceClaim: false,
  };
}

function applyDurableEvent(state, event) {
  const next = cloneJson(state);
  const payload = event.payload ?? {};

  if (event.type === "session.created") {
    next.sessionId = payload.sessionId;
    next.workspaceRoot = payload.workspaceRoot;
    next.mode = payload.mode;
    next.objective = payload.initialState?.objective ?? next.objective;
    next.latestUserConstraints =
      payload.initialState?.latestUserConstraints ?? next.latestUserConstraints;
  }

  if (event.type === "user.message") {
    next.messages.push({
      type: "user",
      content: payload.content,
      seq: event.seq,
    });
  }

  if (event.type === "assistant.tool_call") {
    next.messages.push({
      type: "assistant_tool_call",
      toolCall: payload.toolCall,
      seq: event.seq,
    });
  }

  if (event.type === "tool.result") {
    next.messages.push({
      type: "tool_result",
      result: payload.result,
      seq: event.seq,
    });
    if (
      payload.result?.name === "Edit" &&
      payload.result?.status === "success" &&
      payload.result?.content?.path
    ) {
      next.modifiedFiles = unique([...next.modifiedFiles, payload.result.content.path]);
    }
    if (payload.result?.name === "Bash") {
      const exitCode = payload.result.content?.exitCode;
      next.verificationState = {
        status: exitCode === 0 ? "passed" : "failed",
        command: payload.result.content?.command,
        exitCode,
        stdout: payload.result.content?.stdout ?? "",
        stderr: payload.result.content?.stderr ?? "",
      };
      if (exitCode !== 0) {
        next.failureHistory.push({
          seq: event.seq,
          command: payload.result.content?.command,
          exitCode,
          stderr: payload.result.content?.stderr ?? "",
        });
      }
    }
  }

  if (event.type === "plan.snapshot") {
    next.activePlan = payload.activePlan;
  }

  if (event.type === "pending_actions.updated") {
    next.pendingActions = payload.pendingActions ?? [];
  }

  if (event.type === "runtime.trace") {
    next.runtimeTrace.push({
      seq: event.seq,
      ...payload,
    });
  }

  if (event.type === "model.gateway_decision") {
    next.modelGatewayDecisions.push({
      seq: event.seq,
      providerId: payload.providerId,
      model: payload.model,
      budgetDecision: payload.budgetDecision,
    });
  }

  if (event.type === "tool.transaction") {
    next.transactionLog.push({
      seq: event.seq,
      ...payload,
    });
  }

  if (event.type === "compaction.before") {
    next.compactionAudit.push({
      transitionId: payload.transitionId,
      reason: payload.reason,
      before: payload.before,
    });
  }

  if (event.type === "compaction.after") {
    const transition =
      next.compactionAudit.find(
        (item) => item.transitionId === payload.transitionId,
      ) ??
      next.compactionAudit[
        next.compactionAudit.push({ transitionId: payload.transitionId }) - 1
      ];
    transition.after = {
      compactSummary: payload.compactSummary,
      artifacts: payload.artifacts,
      newerMessages: payload.newerMessages,
    };
    transition.quality = payload.quality;
    next.compactSummary = payload.compactSummary;
    next.compactionArtifacts = payload.artifacts ?? [];
  }

  if (event.type === "runtime.crashed") {
    next.crash = {
      seq: event.seq,
      reason: payload.reason,
      recoverable: payload.recoverable,
    };
  }

  if (event.type === "assistant.final_answer") {
    next.finalAnswer = payload.content;
  }

  next.lastSeq = event.seq;
  next.appliedEventTypes.push(event.type);
  return next;
}

function emptyReplayState() {
  return {
    sessionId: null,
    workspaceRoot: null,
    mode: null,
    objective: null,
    latestUserConstraints: [],
    messages: [],
    runtimeTrace: [],
    modelGatewayDecisions: [],
    transactionLog: [],
    activePlan: null,
    pendingActions: [],
    modifiedFiles: [],
    verificationState: null,
    failureHistory: [],
    compactSummary: null,
    compactionArtifacts: [],
    compactionAudit: [],
    crash: null,
    finalAnswer: null,
    lastSeq: 0,
    appliedEventTypes: [],
  };
}

async function appendToolTurn(store, sessionId, {
  callId,
  resultId,
  name,
  input,
  status,
  content,
}) {
  await store.appendEvent(sessionId, "assistant.tool_call", {
    toolCall: {
      id: callId,
      name,
      input,
    },
  });
  await store.appendEvent(sessionId, "tool.result", {
    result: {
      id: resultId,
      tool_call_id: callId,
      name,
      status,
      content,
    },
  });
}

function buildCompactionInputFromReplay(replay) {
  const state = replay.state;
  return {
    objective: state.objective,
    latestUserConstraints: state.latestUserConstraints,
    activePlan: state.activePlan,
    modifiedFiles: state.modifiedFiles.map((file) => ({
      path: file,
      reason: "Recorded by durable replay before compaction.",
    })),
    latestFailures: state.failureHistory.map((failure) => failure.stderr),
    verificationState: state.verificationState,
    pendingActions: state.pendingActions,
    messages: state.messages.map((message) => ({
      type: message.type,
      name: message.result?.name,
      status: message.result?.status,
      content:
        message.result?.content?.stderr ??
        message.result?.content ??
        message.content ??
        message.toolCall,
    })),
    newerMessages: [],
  };
}

export function verifyAppendOnlyLog(events) {
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedSeq = index + 1;
    const expectedPreviousHash = index === 0 ? "root" : events[index - 1].hash;
    assert.equal(event.seq, expectedSeq);
    assert.equal(event.previousHash, expectedPreviousHash);
    assert.equal(event.hash, hashEvent(event));
  }

  return {
    valid: true,
    eventCount: events.length,
  };
}

function sanitizeForStorage(value, key = "") {
  if (SECRET_KEY_PATTERN.test(key)) return REDACTED;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForStorage(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeForStorage(entryValue, entryKey),
      ]),
    );
  }
  if (typeof value === "string" && /Bearer\s+\S+/i.test(value)) {
    return REDACTED;
  }
  return value;
}

function hashEvent(event) {
  const { hash, ...withoutHash } = event;
  return hashJson(withoutHash);
}

function hashJson(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function unique(items) {
  return [...new Set(items)];
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runDurableSessionStoreReplayDemo(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
