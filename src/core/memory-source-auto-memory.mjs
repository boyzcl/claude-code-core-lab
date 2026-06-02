import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
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

export const CORE29_MEMORY_SOURCE_VERSION =
  "core29-memory-source-auto-memory-v1";

const MEMORY_TYPES = ["user", "feedback", "project", "reference"];

const MEMORY_TYPE_POLICIES = {
  user: {
    readPolicy: "include_when_relevant",
    writePolicy: "user_confirmed_long_term_preference",
    contextPriority: "medium",
    requiresFreshnessCheck: false,
  },
  feedback: {
    readPolicy: "prefer_recent_feedback",
    writePolicy: "user_feedback_promoted_after_confirmation",
    contextPriority: "medium",
    requiresFreshnessCheck: false,
  },
  project: {
    readPolicy: "read_project_memory_file",
    writePolicy: "index_read_only_project_memory",
    contextPriority: "hard",
    requiresFreshnessCheck: false,
  },
  reference: {
    readPolicy: "include_only_after_freshness_check",
    writePolicy: "curated_reference_with_recheck",
    contextPriority: "low",
    requiresFreshnessCheck: true,
  },
};

export class MemorySourceRuntime {
  constructor({
    workspaceRoot,
    memoryRoot,
    store = null,
    sessionId = null,
    now = "2026-05-28T10:00:00.000Z",
  } = {}) {
    if (!workspaceRoot || !memoryRoot) {
      throw new MemorySourceError(
        "missing_roots",
        "MemorySourceRuntime requires workspaceRoot and memoryRoot.",
      );
    }

    this.workspaceRoot = workspaceRoot;
    this.memoryRoot = memoryRoot;
    this.store = store;
    this.sessionId = sessionId;
    this.now = now;
    this.state = {
      version: CORE29_MEMORY_SOURCE_VERSION,
      memoryStore: {
        rootDir: memoryRoot,
        indexPath: this.indexPath(),
        itemsDir: this.itemsDir(),
      },
      memoryIndex: null,
      memoryTypes: cloneJson(MEMORY_TYPE_POLICIES),
      memoryFreshnessChecks: [],
      forgetEvents: [],
      contextSnapshots: [],
      runtimeTrace: [],
    };
  }

  async initialize() {
    await mkdir(this.itemsDir(), { recursive: true });
    try {
      await stat(this.indexPath());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.saveMemoryIndex(emptyMemoryIndex());
    }
    return this.loadMemoryIndex();
  }

  routeMemoryCandidate(candidate) {
    const normalized = normalizeMemoryCandidate(candidate);
    const memoryType = normalized.type;
    const policy = MEMORY_TYPE_POLICIES[memoryType];

    if (!policy) {
      throw new MemorySourceError(
        "unsupported_memory_type",
        `Unsupported memory type: ${memoryType}`,
        { memoryType },
      );
    }

    const route = {
      status: "routed",
      memoryType,
      candidateId: normalized.id,
      sourceKind: normalized.sourceKind,
      writePolicy: policy.writePolicy,
      readPolicy: policy.readPolicy,
      contextPriority: policy.contextPriority,
      requiresFreshnessCheck: policy.requiresFreshnessCheck,
      target:
        memoryType === "project"
          ? "project_memory_file"
          : `memory_store/${memoryType}`,
    };
    this.state.runtimeTrace.push({
      event: "memory.routed",
      candidateId: normalized.id,
      memoryType,
    });
    return route;
  }

  async indexProjectMemoryFromClaudeMd({
    projectMemoryPath = path.join(this.workspaceRoot, "CLAUDE.md"),
  } = {}) {
    await this.initialize();
    const text = await readFile(projectMemoryPath, "utf8");
    const candidate = normalizeMemoryCandidate({
      id: "project_claude_md",
      type: "project",
      text,
      sourceKind: "project_memory_file",
      sourcePath: path.relative(this.workspaceRoot, projectMemoryPath),
      tags: ["project", "claude-md"],
      readOnly: true,
    });
    const route = this.routeMemoryCandidate(candidate);
    const memory = buildMemoryRecord(candidate, route, this.now);
    const write = await this.persistMemory(memory, {
      eventType: "memory.project_indexed",
    });

    return {
      status: "indexed",
      route,
      memory: write.memory,
      indexEntry: write.indexEntry,
      sourcePath: candidate.sourcePath,
      readOnly: true,
    };
  }

  async writeMemory(candidate) {
    await this.initialize();
    const normalized = normalizeMemoryCandidate(candidate);
    const route = this.routeMemoryCandidate(normalized);
    const policy = enforceMemoryWritePolicy(normalized, route);

    if (policy.status === "denied") {
      const denial = {
        status: "denied",
        candidateId: normalized.id,
        memoryType: route.memoryType,
        error: policy.error,
        recommendedNextEvent: policy.recommendedNextEvent,
      };
      this.state.runtimeTrace.push({
        event: "memory.write_denied",
        candidateId: normalized.id,
        errorType: policy.error.error_type,
      });
      await this.record("memory.write_denied", denial);
      return denial;
    }

    const memory = buildMemoryRecord(normalized, route, this.now);
    const write = await this.persistMemory(memory, {
      eventType: "memory.written",
    });

    return {
      status: "written",
      route,
      policy,
      ...write,
    };
  }

  async persistMemory(memory, { eventType }) {
    const bodyPath = this.memoryBodyPath(memory.id);
    const index = await this.loadMemoryIndex();
    const body = {
      ...memory,
      bodyHash: hashJson({
        id: memory.id,
        type: memory.type,
        text: memory.text,
        references: memory.references,
      }),
    };
    const indexEntry = {
      id: memory.id,
      type: memory.type,
      tags: memory.tags,
      sourceKind: memory.sourceKind,
      sourcePath: memory.sourcePath,
      bodyPath: path.relative(this.memoryRoot, bodyPath),
      bodyHash: body.bodyHash,
      summary: summarizeMemory(memory.text),
      references: cloneJson(memory.references),
      readOnly: memory.readOnly,
      createdAt: memory.createdAt,
      updatedAt: this.now,
      status: "active",
    };
    const nextEntries = index.entries.filter((entry) => entry.id !== memory.id);
    nextEntries.push(indexEntry);
    const nextIndex = {
      ...index,
      updatedAt: this.now,
      entries: nextEntries.sort((a, b) => a.id.localeCompare(b.id)),
    };

    await writeFile(bodyPath, `${stableStringify(body)}\n`, "utf8");
    await this.saveMemoryIndex(nextIndex);
    this.state.runtimeTrace.push({
      event: eventType,
      memoryId: memory.id,
      memoryType: memory.type,
    });
    await this.record(eventType, {
      memoryId: memory.id,
      memoryType: memory.type,
      bodyHash: body.bodyHash,
      indexEntry,
    });

    return {
      memory: body,
      indexEntry,
      bodyPath,
      indexPath: this.indexPath(),
      bodyAndIndexSeparated: !Object.hasOwn(indexEntry, "text"),
    };
  }

  async forgetMemory({ id, reason = "user_requested_forget" } = {}) {
    if (!id) {
      throw new MemorySourceError(
        "missing_memory_id",
        "forgetMemory requires an id.",
      );
    }

    const index = await this.loadMemoryIndex();
    const entry = index.entries.find((item) => item.id === id);
    if (!entry) {
      throw new MemorySourceError(
        "memory_not_found",
        `Memory not found: ${id}`,
      );
    }

    const bodyPath = path.join(this.memoryRoot, entry.bodyPath);
    await rm(bodyPath, { force: true });
    const forgetEvent = {
      id: `forget_${id}`,
      memoryId: id,
      memoryType: entry.type,
      reason,
      deletedBodyPath: entry.bodyPath,
      occurredAt: this.now,
    };
    const nextIndex = {
      ...index,
      updatedAt: this.now,
      entries: index.entries.filter((item) => item.id !== id),
      forgetEvents: [...index.forgetEvents, forgetEvent],
    };
    await this.saveMemoryIndex(nextIndex);
    this.state.forgetEvents.push(forgetEvent);
    this.state.runtimeTrace.push({
      event: "memory.forgotten",
      memoryId: id,
      memoryType: entry.type,
    });
    await this.record("memory.forgotten", forgetEvent);

    return {
      status: "forgotten",
      forgetEvent,
      deletionReport: {
        memoryId: id,
        bodyDeleted: !(await pathExists(bodyPath)),
        indexEntryRemoved: true,
        indexUpdated: true,
      },
    };
  }

  async recommendMemories({ query }) {
    const index = await this.loadMemoryIndex();
    const candidates = [];

    for (const entry of index.entries) {
      const memory = await this.readMemory(entry.id);
      const score = scoreMemoryRelevance(memory, query);
      if (score <= 0) continue;

      let freshness = null;
      if (entry.references.length > 0 || MEMORY_TYPE_POLICIES[entry.type].requiresFreshnessCheck) {
        freshness = await this.verifyMemoryFreshness(entry);
      }

      candidates.push({
        entry,
        memory,
        score,
        freshness,
      });
    }

    const recommended = candidates
      .filter((item) => !item.freshness || item.freshness.status === "fresh")
      .sort((a, b) => b.score - a.score)
      .map((item) => ({
        id: item.entry.id,
        type: item.entry.type,
        text: item.memory.text,
        score: item.score,
        freshnessStatus: item.freshness?.status ?? "not_required",
      }));
    const staleRejected = candidates
      .filter((item) => item.freshness?.status === "stale")
      .map((item) => ({
        id: item.entry.id,
        type: item.entry.type,
        reason: item.freshness.reason,
        freshnessStatus: item.freshness.status,
      }));
    const report = {
      status: "recommended",
      query,
      recommended,
      staleRejected,
      freshnessChecks: candidates
        .map((item) => item.freshness)
        .filter(Boolean),
    };
    this.state.runtimeTrace.push({
      event: "memory.recommended",
      query,
      recommendedCount: recommended.length,
      staleRejectedCount: staleRejected.length,
    });
    await this.record("memory.recommended", report);
    return report;
  }

  async verifyMemoryFreshness(entry) {
    const checks = [];
    for (const reference of entry.references) {
      const absolutePath = path.join(this.workspaceRoot, reference.path);
      let exists = true;
      let text = "";
      try {
        text = await readFile(absolutePath, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        exists = false;
      }

      const symbolPresent = reference.symbol
        ? exists && text.includes(reference.symbol)
        : null;
      checks.push({
        path: reference.path,
        symbol: reference.symbol ?? null,
        exists,
        symbolPresent,
      });
    }

    const stale = checks.find(
      (check) => !check.exists || check.symbolPresent === false,
    );
    const freshness = {
      id: `freshness_${entry.id}_${this.state.memoryFreshnessChecks.length + 1}`,
      memoryId: entry.id,
      memoryType: entry.type,
      status: stale ? "stale" : "fresh",
      reason: stale
        ? "referenced_file_or_symbol_missing"
        : "all_references_verified_before_recommendation",
      checks,
      checkedAt: this.now,
    };
    this.state.memoryFreshnessChecks.push(freshness);
    this.state.runtimeTrace.push({
      event: "memory.freshness_checked",
      memoryId: entry.id,
      status: freshness.status,
    });
    await this.record("memory.freshness_checked", freshness);
    return freshness;
  }

  async buildContextSnapshot({
    reason = "memory_context_snapshot",
    compactSummary = null,
  } = {}) {
    const index = await this.loadMemoryIndex();
    const memoryBlocks = index.entries.map((entry) => ({
      id: `memory:${entry.id}`,
      kind: "long_term_memory",
      memoryType: entry.type,
      source: entry.sourceKind,
      bodyPath: entry.bodyPath,
      summary: entry.summary,
      references: cloneJson(entry.references),
    }));
    const compactSummaryBlock = compactSummary
      ? {
          id: "compact_summary:current",
          kind: "compact_summary",
          source: "core19_compaction_quality",
          content: compactSummary,
        }
      : null;
    const snapshot = {
      reason,
      memoryBlocks,
      compactSummaryBlock,
      longTermMemoryBlockCount: memoryBlocks.length,
      compactSummaryBlockCount: compactSummaryBlock ? 1 : 0,
      memoryMixedWithCompactSummary: false,
      memorySource: "memory_store",
      compactSummarySource: compactSummaryBlock ? "compaction_state" : null,
    };
    this.state.contextSnapshots.push(snapshot);
    this.state.runtimeTrace.push({
      event: "context.memory_snapshot",
      memoryBlockCount: memoryBlocks.length,
      hasCompactSummary: Boolean(compactSummaryBlock),
    });
    await this.record("context.memory_snapshot", snapshot);
    return cloneJson(snapshot);
  }

  async readMemory(id) {
    const index = await this.loadMemoryIndex();
    const entry = index.entries.find((item) => item.id === id);
    if (!entry) {
      throw new MemorySourceError(
        "memory_not_found",
        `Memory not found: ${id}`,
      );
    }
    const text = await readFile(path.join(this.memoryRoot, entry.bodyPath), "utf8");
    return JSON.parse(text);
  }

  async loadMemoryIndex() {
    await mkdir(this.itemsDir(), { recursive: true });
    let text = "";
    try {
      text = await readFile(this.indexPath(), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const index = emptyMemoryIndex();
      await this.saveMemoryIndex(index);
      return index;
    }

    const index = JSON.parse(text);
    this.state.memoryIndex = cloneJson(index);
    return index;
  }

  async saveMemoryIndex(index) {
    await mkdir(this.memoryRoot, { recursive: true });
    await mkdir(this.itemsDir(), { recursive: true });
    const next = {
      version: CORE29_MEMORY_SOURCE_VERSION,
      entries: [],
      forgetEvents: [],
      ...index,
    };
    await writeFile(this.indexPath(), `${stableStringify(next)}\n`, "utf8");
    this.state.memoryIndex = cloneJson(next);
    return next;
  }

  async record(type, payload = {}) {
    if (!this.store || !this.sessionId) return null;
    return this.store.appendEvent(this.sessionId, type, {
      core29: true,
      payload,
    });
  }

  indexPath() {
    return path.join(this.memoryRoot, "memory-index.json");
  }

  itemsDir() {
    return path.join(this.memoryRoot, "items");
  }

  memoryBodyPath(id) {
    return path.join(this.itemsDir(), `${id}.json`);
  }
}

export class MemorySourceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "MemorySourceError";
    this.code = code;
    this.details = details;
  }
}

export async function createMemorySourceFixture() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "agent-core29-"));
  const workspaceRoot = path.join(rootDir, "workspace");
  const memoryRoot = path.join(rootDir, "memory");
  const sessionRoot = path.join(rootDir, "session");
  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, "CLAUDE.md"),
    [
      "# Project Memory",
      "",
      "- Keep public API exports stable.",
      "- Use npm test as the final verification command.",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(workspaceRoot, "src", "pagination.cjs"),
    [
      "function paginate(items, page, pageSize) {",
      "  const start = page * pageSize;",
      "  return items.slice(start, start + pageSize);",
      "}",
      "",
      "module.exports = { paginate };",
    ].join("\n"),
    "utf8",
  );
  const store = new DurableSessionStore({ rootDir: sessionRoot });
  const sessionId = await store.createSession({
    workspaceRoot,
    mode: "execute",
    initialState: {
      objective:
        "Prove long-term memory can enter context without becoming compaction summary.",
      latestUserConstraints: ["Forget requests must update memory index."],
    },
  });
  const runtime = new MemorySourceRuntime({
    workspaceRoot,
    memoryRoot,
    store,
    sessionId,
  });
  await runtime.initialize();

  return {
    rootDir,
    workspaceRoot,
    memoryRoot,
    store,
    sessionId,
    runtime,
    candidates: createMemoryCandidateFixtures(),
  };
}

export function createMemoryCandidateFixtures() {
  return {
    userPreference: {
      id: "mem_user_final_verification",
      type: "user",
      text:
        "User prefers final answers that name the verification command and result, and this body contains the unique phrase body-only-verification-preference.",
      sourceKind: "user_confirmed",
      tags: ["final-answer", "verification"],
    },
    feedbackPreference: {
      id: "mem_feedback_public_api",
      type: "feedback",
      text:
        "When feedback mentions public API stability, preserve exported names in follow-up edits.",
      sourceKind: "user_feedback",
      tags: ["public-api", "feedback"],
    },
    freshReference: {
      id: "mem_reference_pagination",
      type: "reference",
      text:
        "For pagination discussions, check the referenced pagination fixture before making a recommendation.",
      sourceKind: "curated_reference",
      tags: ["pagination", "reference"],
      references: [
        {
          path: "src/pagination.cjs",
          symbol: "paginate",
        },
      ],
    },
    staleReference: {
      id: "mem_reference_stale_cache",
      type: "reference",
      text:
        "For cache behavior, verify the referenced cache fixture still exists before using this memory.",
      sourceKind: "curated_reference",
      tags: ["cache", "reference"],
      references: [
        {
          path: "src/legacy-cache.cjs",
          symbol: "legacyCache",
        },
      ],
    },
    codeStructureClaim: {
      id: "mem_code_structure_claim",
      type: "user",
      text:
        "The paginate function is defined in src/pagination.cjs and exports paginate for callers.",
      sourceKind: "model_inferred",
      tags: ["code-structure"],
      references: [
        {
          path: "src/pagination.cjs",
          symbol: "paginate",
        },
      ],
    },
  };
}

export async function runMemorySourceDemo() {
  const fixture = await createMemorySourceFixture();
  const runtime = fixture.runtime;
  const candidates = fixture.candidates;

  const projectMemory = await runtime.indexProjectMemoryFromClaudeMd();
  const typeRoutes = [
    runtime.routeMemoryCandidate(candidates.userPreference),
    runtime.routeMemoryCandidate(candidates.feedbackPreference),
    runtime.routeMemoryCandidate({
      id: "project_claude_md",
      type: "project",
      text: "Project memory file.",
      sourceKind: "project_memory_file",
    }),
    runtime.routeMemoryCandidate(candidates.freshReference),
  ];
  const userWrite = await runtime.writeMemory(candidates.userPreference);
  const feedbackWrite = await runtime.writeMemory(candidates.feedbackPreference);
  const freshReferenceWrite = await runtime.writeMemory(candidates.freshReference);
  const staleReferenceWrite = await runtime.writeMemory(candidates.staleReference);
  const forget = await runtime.forgetMemory({
    id: candidates.feedbackPreference.id,
    reason: "user_requested_forget",
  });
  const freshRecommendation = await runtime.recommendMemories({
    query: "pagination discussions",
  });
  const staleRecommendation = await runtime.recommendMemories({
    query: "cache behavior",
  });
  const contextSnapshot = await runtime.buildContextSnapshot({
    reason: "after_compaction_with_memory",
    compactSummary: {
      objective: "Continue product surface memory implementation.",
      pendingActions: ["Run focused verify", "Run verify:all"],
    },
  });
  const codeStructureDenied = await runtime.writeMemory(
    candidates.codeStructureClaim,
  );
  const events = await fixture.store.readEvents(fixture.sessionId);

  const report = {
    version: CORE29_MEMORY_SOURCE_VERSION,
    status: "passed",
    validationMatrix: core29ImplementationValidationMatrix(),
    sessionId: fixture.sessionId,
    projectMemory,
    typeRoutes,
    userWrite,
    feedbackWrite,
    freshReferenceWrite,
    staleReferenceWrite,
    forget,
    freshRecommendation,
    staleRecommendation,
    contextSnapshot,
    codeStructureDenied,
    eventTypes: events.map((event) => event.type),
    state: cloneJson(runtime.state),
    boundary: memorySourceBoundary(),
  };

  return {
    checks: verifyMemorySourceDemo(report),
    ...report,
  };
}

export function verifyMemorySourceDemo(report) {
  assert.equal(report.version, CORE29_MEMORY_SOURCE_VERSION);
  assert.equal(report.status, "passed");
  assert.equal(report.projectMemory.status, "indexed");
  assert.deepEqual(
    report.typeRoutes.map((route) => route.memoryType),
    ["user", "feedback", "project", "reference"],
  );
  assert.equal(report.userWrite.status, "written");
  assert.equal(report.userWrite.bodyAndIndexSeparated, true);
  assert.equal(report.feedbackWrite.status, "written");
  assert.equal(report.forget.status, "forgotten");
  assert.equal(report.forget.deletionReport.bodyDeleted, true);
  assert.equal(report.freshRecommendation.recommended.length >= 1, true);
  assert.equal(report.staleRecommendation.recommended.length, 0);
  assert.equal(report.staleRecommendation.staleRejected.length, 1);
  assert.equal(report.contextSnapshot.memoryMixedWithCompactSummary, false);
  assert.equal(report.codeStructureDenied.status, "denied");
  assert.equal(report.boundary.productionMemoryProductClaim, false);
  assert.equal(report.boundary.officialImplementationClaim, false);

  return {
    validation_matrix_present: true,
    memory_type_routing_verified: true,
    write_and_index_separated: true,
    forget_updates_store_and_index: true,
    stale_verification_before_recommendation: true,
    compaction_boundary_preserved: true,
    code_structure_memory_denied: true,
    no_production_claim: true,
  };
}

export function core29ImplementationValidationMatrix() {
  return {
    topic: "Memory Source / CLAUDE.md / Auto Memory",
    evidenceTier:
      "A public docs as interface clues, B product artifact observations as mechanism clues, D local implementation and verify evidence.",
    publicBoundary: {
      rawPromptOrSourceMapText: false,
      officialImplementationClaim: false,
      ownObjectModel: true,
    },
    sameTopicMergeDecision: {
      extends: [
        "Course 08 Context Engine",
        "Course 09 Compaction",
        "Core 18 Context Economy",
        "Core 19 Compaction Quality",
        "Core 24 Durable Session Store",
      ],
      independentBecause:
        "Core 29 owns long-term memory type routing, write/index separation, forget semantics, stale reference checks, and no code-structure memory policy.",
      notCourse08:
        "It does not redefine general ModelRequest assembly; it provides a governed memory source that Context Engine may read.",
      notCourse09:
        "It does not compact conversation history; it keeps long-term memory separate from compactSummary.",
      notCore18:
        "It does not optimize token economy; it only marks memory blocks as a source with type and freshness evidence.",
      notCore19:
        "It does not score compaction quality; it verifies memory is not confused with compaction state.",
      notCore24:
        "It records memory events into the existing durable session log but does not create a new durable session store.",
    },
    runtimeState: [
      "memoryStore",
      "memoryIndex",
      "memoryType",
      "memoryFreshnessCheck",
      "forgetEvent",
    ],
    cases: [
      {
        case: "memory type routing",
        fixture: "user, feedback, project CLAUDE.md, and reference candidates",
        expected: "each type receives distinct read/write policy and context priority",
        evidence: "memory route report",
      },
      {
        case: "write and index",
        fixture: "user-confirmed preference",
        expected: "body file and index entry are separate and hash-linked",
        evidence: "body file, memory-index.json",
      },
      {
        case: "forget",
        fixture: "user requests deleting a feedback memory",
        expected: "body file is deleted and index forgetEvent is written",
        evidence: "deletion report",
      },
      {
        case: "stale verification",
        fixture: "reference memory points at missing file",
        expected: "freshness check rejects recommendation before context use",
        evidence: "freshness trace",
      },
      {
        case: "compaction boundary",
        fixture: "compactSummary and long-term memory both exist",
        expected: "memory blocks remain separate from compact summary",
        evidence: "context snapshot",
      },
      {
        case: "no code-structure memory",
        fixture: "candidate asserts where a function is defined/exported",
        expected: "write is denied and caller is told to read repo evidence",
        evidence: "policy result",
      },
    ],
    outOfScope: [
      "real Claude Code memory file format",
      "remote multi-user memory service",
      "privacy compliance system",
      "complete code intelligence database",
      "official Claude Code memory implementation",
    ],
  };
}

export function memorySourceBoundary() {
  return {
    deterministicLocalMemorySource: true,
    durableSessionBoundary: durableSessionBoundary(),
    productionMemoryProductClaim: false,
    officialImplementationClaim: false,
    realClaudeMemoryFormatClaim: false,
    remoteMemoryServiceClaim: false,
    privacyComplianceSystemClaim: false,
    codeIntelligenceDatabaseClaim: false,
  };
}

function normalizeMemoryCandidate(candidate) {
  if (!candidate?.id || !candidate?.text) {
    throw new MemorySourceError(
      "invalid_memory_candidate",
      "Memory candidate requires id and text.",
      { candidate },
    );
  }
  const type = candidate.type ?? inferMemoryType(candidate);
  if (!MEMORY_TYPES.includes(type)) {
    throw new MemorySourceError(
      "unsupported_memory_type",
      `Unsupported memory type: ${type}`,
    );
  }

  return {
    id: safeId(candidate.id),
    type,
    text: String(candidate.text),
    sourceKind: candidate.sourceKind ?? "runtime",
    sourcePath: candidate.sourcePath ?? null,
    tags: candidate.tags ?? [],
    references: candidate.references ?? [],
    readOnly: Boolean(candidate.readOnly),
  };
}

function inferMemoryType(candidate) {
  if (candidate.sourceKind === "project_memory_file") return "project";
  if (candidate.sourceKind === "user_feedback") return "feedback";
  if (candidate.sourceKind === "curated_reference") return "reference";
  return "user";
}

function enforceMemoryWritePolicy(candidate, route) {
  if (route.memoryType === "project" && !candidate.readOnly) {
    return {
      status: "denied",
      error: {
        error_type: "project_memory_read_only",
        message: "Project memory should be indexed from CLAUDE.md, not auto-written.",
      },
      recommendedNextEvent: "index_project_memory_file",
    };
  }

  if (isCodeStructureMemory(candidate)) {
    return {
      status: "denied",
      error: {
        error_type: "code_structure_memory_denied",
        message:
          "Code structure facts must be re-read from repo evidence instead of stored as long-term memory.",
      },
      recommendedNextEvent: "read_repo_or_update_repo_index",
    };
  }

  return {
    status: "allowed",
    writePolicy: route.writePolicy,
  };
}

function isCodeStructureMemory(candidate) {
  const text = candidate.text.toLowerCase();
  const mentionsPath = /\bsrc\/[\w./-]+/.test(text);
  const assertsStructure =
    /\b(function|class|module|exports?|defined in|located in|lives in)\b/.test(
      text,
    );
  return candidate.sourceKind === "model_inferred" && mentionsPath && assertsStructure;
}

function buildMemoryRecord(candidate, route, now) {
  return {
    version: CORE29_MEMORY_SOURCE_VERSION,
    id: candidate.id,
    type: route.memoryType,
    text: candidate.text,
    tags: cloneJson(candidate.tags),
    sourceKind: candidate.sourceKind,
    sourcePath: candidate.sourcePath,
    references: cloneJson(candidate.references),
    readOnly: candidate.readOnly,
    createdAt: now,
    policy: {
      readPolicy: route.readPolicy,
      writePolicy: route.writePolicy,
      contextPriority: route.contextPriority,
      requiresFreshnessCheck: route.requiresFreshnessCheck,
    },
  };
}

function summarizeMemory(text) {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  return normalized.length <= 72
    ? normalized
    : `${normalized.slice(0, 69)}...`;
}

function scoreMemoryRelevance(memory, query) {
  const terms = new Set(tokenize(query));
  const memoryTerms = new Set([
    ...tokenize(memory.text),
    ...memory.tags.flatMap((tag) => tokenize(tag)),
  ]);
  let score = 0;
  for (const term of terms) {
    if (memoryTerms.has(term)) score += 1;
  }
  return score;
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
    .filter((term) => term.length > 1);
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

function emptyMemoryIndex() {
  return {
    version: CORE29_MEMORY_SOURCE_VERSION,
    updatedAt: "never",
    entries: [],
    forgetEvents: [],
  };
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function hashJson(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value) {
  return JSON.stringify(sortJson(value), null, 2);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entryValue]) => [key, sortJson(entryValue)]),
    );
  }
  return value;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runMemorySourceDemo(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
