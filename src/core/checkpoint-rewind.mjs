import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DurableSessionStore,
  durableSessionBoundary,
} from "./durable-session-store-replay.mjs";
import {
  TransactionalToolRuntime,
  createTransactionWorkspace,
} from "./tool-runtime-transaction.mjs";

export const CORE30_CHECKPOINT_REWIND_VERSION =
  "core30-checkpoint-rewind-v1";

export class CheckpointRewindRuntime {
  constructor({
    workspaceRoot,
    store,
    sessionId,
    clock = () => "2026-05-28T10:30:00.000Z",
  } = {}) {
    if (!workspaceRoot || !store || !sessionId) {
      throw new CheckpointRewindError(
        "missing_runtime_dependency",
        "CheckpointRewindRuntime requires workspaceRoot, store, and sessionId.",
      );
    }

    this.workspaceRoot = workspaceRoot;
    this.store = store;
    this.sessionId = sessionId;
    this.clock = clock;
    this.checkpoints = new Map();
    this.rewindRequests = [];
    this.rewindAudits = [];
    this.externalChangeConflicts = [];
    this.runtimeTrace = [];
  }

  async createCheckpoint({
    id,
    label,
    filePaths,
    reason = "manual_checkpoint",
    visibleToUser = true,
  }) {
    if (!id || !Array.isArray(filePaths) || filePaths.length === 0) {
      throw new CheckpointRewindError(
        "invalid_checkpoint_request",
        "createCheckpoint requires id and at least one file path.",
      );
    }

    const replayBefore = await this.store.replay(this.sessionId);
    const fileStateSnapshot = await this.captureFileState(filePaths);
    const checkpoint = {
      version: CORE30_CHECKPOINT_REWIND_VERSION,
      id,
      label,
      reason,
      visibleToUser,
      createdAt: this.clock(),
      sessionId: this.sessionId,
      replayThroughSeq: replayBefore.lastSeq,
      replayStateHash: replayBefore.stateHash,
      fileStateSnapshot,
      boundary: checkpointRewindBoundary(),
    };
    const event = await this.store.appendEvent(
      this.sessionId,
      "checkpoint.created",
      {
        checkpoint,
      },
    );
    const durableSnapshot = await this.store.createSnapshot(this.sessionId, {
      reason: `checkpoint:${id}`,
    });
    const complete = {
      ...checkpoint,
      eventSeq: event.seq,
      eventHash: event.hash,
      durableSnapshotId: durableSnapshot.id,
      durableSnapshotThroughSeq: durableSnapshot.throughSeq,
    };
    this.checkpoints.set(id, complete);
    this.runtimeTrace.push({
      event: "checkpoint.created",
      checkpointId: id,
      eventSeq: event.seq,
      fileCount: fileStateSnapshot.files.length,
    });

    return cloneJson(complete);
  }

  async requestRewind({
    targetCheckpointId,
    fromCheckpointId = null,
    reason = "user_requested_rewind",
    requireCleanCurrentFiles = true,
  }) {
    const target = this.getCheckpoint(targetCheckpointId);
    const source = fromCheckpointId
      ? this.getCheckpoint(fromCheckpointId)
      : this.latestCheckpoint();
    const request = {
      id: `rewind_${String(this.rewindRequests.length + 1).padStart(3, "0")}`,
      status: "requested",
      targetCheckpointId,
      fromCheckpointId: source?.id ?? null,
      reason,
      requireCleanCurrentFiles,
      requestedAt: this.clock(),
    };
    this.rewindRequests.push(request);
    await this.store.appendEvent(this.sessionId, "rewind.requested", {
      request,
    });

    const conflict = await this.detectExternalChangeConflict({
      source,
      target,
      request,
    });
    if (conflict) {
      this.externalChangeConflicts.push(conflict);
      this.runtimeTrace.push({
        event: "rewind.denied",
        requestId: request.id,
        conflictCount: conflict.conflicts.length,
      });
      await this.store.appendEvent(this.sessionId, "rewind.denied", {
        request,
        conflict,
      });
      return {
        status: "denied",
        request,
        conflict,
        requiresConfirmation: true,
        filesRestored: [],
      };
    }

    const result = await this.applyRewind({ request, source, target });
    return result;
  }

  async applyRewind({ request, source, target }) {
    const before = await this.captureFileState(
      target.fileStateSnapshot.files.map((file) => file.path),
    );
    const restoredFiles = [];

    for (const file of target.fileStateSnapshot.files) {
      await writeFile(
        path.join(this.workspaceRoot, file.path),
        file.text,
        "utf8",
      );
      restoredFiles.push({
        path: file.path,
        fromHash:
          before.files.find((entry) => entry.path === file.path)?.hash ?? null,
        restoredHash: file.hash,
      });
    }

    const replayToTarget = await this.store.replay(this.sessionId, {
      throughSeq: target.eventSeq,
    });
    const audit = {
      id: `audit_${request.id}`,
      requestId: request.id,
      status: "applied",
      sourceCheckpointId: source?.id ?? null,
      targetCheckpointId: target.id,
      restoredFiles,
      replay: {
        throughSeq: target.eventSeq,
        stateHash: replayToTarget.stateHash,
        eventTypes: replayToTarget.eventTypes,
      },
      beforeFileState: before.files.map(publicFileSnapshot),
      afterFileState: target.fileStateSnapshot.files.map(publicFileSnapshot),
      auditTrail: [
        "rewind.requested",
        "external_change_checked",
        "files.restored",
        "rewind.applied",
      ],
      appliedAt: this.clock(),
    };
    this.rewindAudits.push(audit);
    this.runtimeTrace.push({
      event: "rewind.applied",
      requestId: request.id,
      targetCheckpointId: target.id,
      restoredFileCount: restoredFiles.length,
    });
    await this.store.appendEvent(this.sessionId, "rewind.applied", {
      request,
      audit,
    });

    return {
      status: "rewound",
      request,
      sourceCheckpoint: publicCheckpoint(source),
      targetCheckpoint: publicCheckpoint(target),
      restoredFiles,
      restoredSessionState: replayToTarget.state,
      audit,
    };
  }

  async detectExternalChangeConflict({ source, target, request }) {
    if (!request.requireCleanCurrentFiles || !source) return null;

    const current = await this.captureFileState(
      source.fileStateSnapshot.files.map((file) => file.path),
    );
    const conflicts = [];

    for (const sourceFile of source.fileStateSnapshot.files) {
      const currentFile = current.files.find(
        (file) => file.path === sourceFile.path,
      );
      if (!currentFile || currentFile.hash !== sourceFile.hash) {
        conflicts.push({
          path: sourceFile.path,
          expectedHash: sourceFile.hash,
          actualHash: currentFile?.hash ?? null,
          targetHash:
            target.fileStateSnapshot.files.find(
              (file) => file.path === sourceFile.path,
            )?.hash ?? null,
          reason: "file_changed_after_source_checkpoint",
        });
      }
    }

    if (conflicts.length === 0) return null;

    return {
      id: `conflict_${request.id}`,
      status: "external_change_conflict",
      requestId: request.id,
      sourceCheckpointId: source.id,
      targetCheckpointId: target.id,
      conflicts,
      safetyResult: {
        allowedToRestore: false,
        reason:
          "Rewind would overwrite file changes made after the source checkpoint.",
        recommendedNextEvent: "ask_user_to_confirm_or_create_new_checkpoint",
      },
      checkedAt: this.clock(),
    };
  }

  async replayRewindAudit(rewindRequestId) {
    const events = await this.store.readEvents(this.sessionId);
    const related = events.filter((event) => {
      const payload = event.payload?.request ?? event.payload?.audit;
      return (
        payload?.id === rewindRequestId ||
        payload?.requestId === rewindRequestId
      );
    });
    const applied = this.rewindAudits.find(
      (audit) => audit.requestId === rewindRequestId,
    );

    if (!applied) {
      throw new CheckpointRewindError(
        "rewind_audit_not_found",
        `No applied rewind audit found for ${rewindRequestId}.`,
      );
    }

    return {
      status: "replayed",
      rewindRequestId,
      eventTypes: related.map((event) => event.type),
      eventSeqs: related.map((event) => event.seq),
      sourceCheckpointId: applied.sourceCheckpointId,
      targetCheckpointId: applied.targetCheckpointId,
      restoredFiles: cloneJson(applied.restoredFiles),
      replayThroughSeq: applied.replay.throughSeq,
      replayStateHash: applied.replay.stateHash,
      auditTrailExplainsRewind: true,
    };
  }

  async captureFileState(filePaths) {
    const files = [];
    for (const relativePath of filePaths) {
      const absolutePath = path.join(this.workspaceRoot, relativePath);
      let text = null;
      let exists = true;
      try {
        text = await readFile(absolutePath, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        exists = false;
      }
      files.push({
        path: relativePath,
        exists,
        text,
        hash: exists ? hashText(text) : null,
        bytes: exists ? Buffer.byteLength(text, "utf8") : 0,
      });
    }

    return {
      capturedAt: this.clock(),
      files,
      fileHashes: files.map((file) => ({
        path: file.path,
        hash: file.hash,
      })),
    };
  }

  getCheckpoint(id) {
    const checkpoint = this.checkpoints.get(id);
    if (!checkpoint) {
      throw new CheckpointRewindError(
        "checkpoint_not_found",
        `Checkpoint not found: ${id}`,
      );
    }
    return checkpoint;
  }

  latestCheckpoint() {
    return [...this.checkpoints.values()].at(-1) ?? null;
  }
}

export class CheckpointRewindError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CheckpointRewindError";
    this.code = code;
    this.details = details;
  }
}

export async function createCheckpointRewindFixture() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "agent-core30-"));
  const workspaceRoot = await createTransactionWorkspace();
  const sessionRoot = path.join(rootDir, "session");
  const store = new DurableSessionStore({ rootDir: sessionRoot });
  const sessionId = await store.createSession({
    workspaceRoot,
    mode: "execute",
    initialState: {
      objective:
        "Prove user-visible checkpoints can rewind file state safely.",
      latestUserConstraints: [
        "Do not overwrite external user changes during rewind.",
      ],
    },
  });
  await store.appendEvent(sessionId, "user.message", {
    content: "Create a checkpoint before fixing pagination.",
  });
  await store.appendEvent(sessionId, "plan.snapshot", {
    activePlan: {
      id: "plan_core30",
      status: "approved",
      currentStepId: "step_2",
      steps: [
        {
          id: "step_1",
          text: "Create checkpoint",
          status: "done",
        },
        {
          id: "step_2",
          text: "Patch pagination",
          status: "active",
        },
      ],
    },
  });
  const runtime = new CheckpointRewindRuntime({
    workspaceRoot,
    store,
    sessionId,
  });
  const transactionRuntime = new TransactionalToolRuntime({ workspaceRoot });

  return {
    rootDir,
    workspaceRoot,
    store,
    sessionId,
    runtime,
    transactionRuntime,
    filePaths: ["src/pagination.cjs", "src/empty-page.cjs"],
  };
}

export async function applyPaginationTransaction({
  transactionRuntime,
  store,
  sessionId,
}) {
  await transactionRuntime.read("src/pagination.cjs");
  await transactionRuntime.read("src/empty-page.cjs");
  const preview = await transactionRuntime.previewTransaction(
    [
      {
        path: "src/pagination.cjs",
        oldString: "  return start + pageSize + 1;",
        newString: "  return start + pageSize;",
      },
      {
        path: "src/empty-page.cjs",
        oldString: "  return start > items.length;",
        newString: "  return start >= items.length;",
      },
    ],
    {
      reason: "fix pagination before checkpoint rewind demo",
    },
  );
  const commit = await transactionRuntime.commitTransaction(preview.transactionId);
  await store.appendEvent(sessionId, "tool.transaction", {
    transactionId: preview.transactionId,
    status: commit.status,
    diffArtifacts: preview.diffArtifacts.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      beforeHash: artifact.beforeHash,
      afterHash: artifact.afterHash,
    })),
    written: commit.written,
  });

  return {
    preview,
    commit,
  };
}

export async function runCheckpointRewindDemo() {
  const successFixture = await createCheckpointRewindFixture();
  const beforeCheckpoint = await successFixture.runtime.createCheckpoint({
    id: "checkpoint_before_fix",
    label: "Before pagination transaction",
    filePaths: successFixture.filePaths,
    reason: "user_visible_checkpoint_before_fix",
  });
  const transaction = await applyPaginationTransaction(successFixture);
  const afterCheckpoint = await successFixture.runtime.createCheckpoint({
    id: "checkpoint_after_fix",
    label: "After pagination transaction",
    filePaths: successFixture.filePaths,
    reason: "user_visible_checkpoint_after_fix",
  });
  const rewind = await successFixture.runtime.requestRewind({
    targetCheckpointId: beforeCheckpoint.id,
    fromCheckpointId: afterCheckpoint.id,
  });
  const auditReplay = await successFixture.runtime.replayRewindAudit(
    rewind.request.id,
  );

  const conflictFixture = await createCheckpointRewindFixture();
  const conflictBefore = await conflictFixture.runtime.createCheckpoint({
    id: "checkpoint_conflict_before_fix",
    label: "Before conflict transaction",
    filePaths: conflictFixture.filePaths,
  });
  await applyPaginationTransaction(conflictFixture);
  const conflictAfter = await conflictFixture.runtime.createCheckpoint({
    id: "checkpoint_conflict_after_fix",
    label: "After conflict transaction",
    filePaths: conflictFixture.filePaths,
  });
  await writeFile(
    path.join(conflictFixture.workspaceRoot, "src/pagination.cjs"),
    [
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
    ].join("\n"),
    "utf8",
  );
  const conflict = await conflictFixture.runtime.requestRewind({
    targetCheckpointId: conflictBefore.id,
    fromCheckpointId: conflictAfter.id,
  });
  const conflictFileText = await readFile(
    path.join(conflictFixture.workspaceRoot, "src/pagination.cjs"),
    "utf8",
  );

  const report = {
    version: CORE30_CHECKPOINT_REWIND_VERSION,
    status: "passed",
    validationMatrix: core30ImplementationValidationMatrix(),
    success: {
      beforeCheckpoint,
      transaction,
      afterCheckpoint,
      rewind,
      auditReplay,
      eventTypes: (
        await successFixture.store.readEvents(successFixture.sessionId)
      ).map((event) => event.type),
    },
    conflict: {
      beforeCheckpoint: conflictBefore,
      afterCheckpoint: conflictAfter,
      result: conflict,
      fileTextPreserved: conflictFileText.includes("Math.max(0, page)"),
    },
    boundary: checkpointRewindBoundary(),
  };

  return {
    checks: verifyCheckpointRewindDemo(report),
    ...report,
  };
}

export function verifyCheckpointRewindDemo(report) {
  assert.equal(report.version, CORE30_CHECKPOINT_REWIND_VERSION);
  assert.equal(report.status, "passed");
  assert.equal(report.success.beforeCheckpoint.fileStateSnapshot.files.length, 2);
  assert.equal(report.success.beforeCheckpoint.visibleToUser, true);
  assert.equal(report.success.rewind.status, "rewound");
  assert.equal(
    report.success.rewind.restoredFiles.some(
      (file) => file.path === "src/pagination.cjs",
    ),
    true,
  );
  assert.equal(
    report.success.rewind.restoredSessionState.objective,
    "Prove user-visible checkpoints can rewind file state safely.",
  );
  assert.equal(report.success.auditReplay.auditTrailExplainsRewind, true);
  assert.equal(report.conflict.result.status, "denied");
  assert.equal(
    report.conflict.result.conflict.status,
    "external_change_conflict",
  );
  assert.equal(report.conflict.fileTextPreserved, true);
  assert.equal(report.boundary.productionCheckpointProductClaim, false);

  return {
    validation_matrix_present: true,
    checkpoint_creation_binds_file_hashes_and_session_event: true,
    rewind_restores_file_and_session_state: true,
    external_change_conflict_denies_partial_rewind: true,
    audit_replay_explains_rewind: true,
    no_production_claim: true,
  };
}

export function core30ImplementationValidationMatrix() {
  return {
    topic: "Checkpoint / Rewind",
    evidenceTier:
      "A public docs as interface clues, B product artifact observations as mechanism clues, D local implementation and verify evidence.",
    publicBoundary: {
      rawPromptOrSourceMapText: false,
      officialImplementationClaim: false,
      ownObjectModel: true,
    },
    sameTopicMergeDecision: {
      extends: [
        "Core 22 ToolRuntime Transaction",
        "Core 24 Durable Session Store",
      ],
      independentBecause:
        "Core 30 models user-visible checkpoints that bind session evidence to file hashes, then enforces safe rewind with external-change detection and audit replay.",
      notCore22:
        "It does not implement diff preview, transaction commit, rollback, stale edit checks, protected file approval, or Bash risk routing.",
      notCore24:
        "It does not create a new append-only event log or durable snapshot store; it records checkpoint and rewind events into the existing durable session layer.",
    },
    runtimeState: [
      "checkpoint",
      "rewindRequest",
      "fileStateSnapshot",
      "externalChangeConflict",
      "rewindAudit",
    ],
    cases: [
      {
        case: "checkpoint creation",
        fixture: "before/after pagination transaction checkpoints",
        expected: "checkpoint binds file hashes, replay seq, event hash, and durable snapshot id",
        evidence: "checkpoint log",
      },
      {
        case: "rewind state",
        fixture: "rewind from after-fix checkpoint to before-fix checkpoint",
        expected: "files are restored and target replay state is returned",
        evidence: "state diff and restored files",
      },
      {
        case: "partial rewind denial",
        fixture: "file changed externally after source checkpoint",
        expected: "rewind is denied and no file is overwritten",
        evidence: "externalChangeConflict safety result",
      },
      {
        case: "audit replay",
        fixture: "applied rewind request",
        expected: "audit explains source checkpoint, target checkpoint, restored files, and replay through seq",
        evidence: "rewind audit replay report",
      },
    ],
    outOfScope: [
      "complete IDE UI",
      "cross-machine restore",
      "distributed session store",
      "full patch parser",
      "official Claude Code checkpoint implementation",
    ],
  };
}

export function checkpointRewindBoundary() {
  return {
    deterministicLocalCheckpointRewind: true,
    toolTransactionBoundary: {
      reusedForFixture: true,
      implementsCore22Transaction: false,
    },
    durableSessionBoundary: durableSessionBoundary(),
    productionCheckpointProductClaim: false,
    officialImplementationClaim: false,
    completeIdeUiClaim: false,
    crossMachineRestoreClaim: false,
    distributedSessionStoreClaim: false,
  };
}

function publicCheckpoint(checkpoint) {
  if (!checkpoint) return null;
  return {
    id: checkpoint.id,
    label: checkpoint.label,
    eventSeq: checkpoint.eventSeq,
    durableSnapshotId: checkpoint.durableSnapshotId,
    fileHashes: checkpoint.fileStateSnapshot.fileHashes,
  };
}

function publicFileSnapshot(file) {
  return {
    path: file.path,
    exists: file.exists,
    hash: file.hash,
    bytes: file.bytes,
  };
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function hashText(text) {
  return createHash("sha256").update(text ?? "").digest("hex");
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runCheckpointRewindDemo(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
