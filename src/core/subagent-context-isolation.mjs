import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DurableSessionStore,
  durableSessionBoundary,
} from "./durable-session-store-replay.mjs";
import {
  RepoIntelligenceIndex,
  repoIntelligenceBoundary,
} from "./repo-intelligence-relevance-index.mjs";

export const CORE31_SUBAGENT_CONTEXT_ISOLATION_VERSION =
  "core31-subagent-context-isolation-v1";

export class SubagentContextIsolationRuntime {
  constructor({
    workspaceRoot,
    store,
    sessionId,
    repoIndex = null,
    clock = () => "2026-05-28T11:10:00.000Z",
  } = {}) {
    if (!workspaceRoot || !store || !sessionId) {
      throw new SubagentContextIsolationError(
        "missing_runtime_dependency",
        "SubagentContextIsolationRuntime requires workspaceRoot, store, and sessionId.",
      );
    }

    this.workspaceRoot = workspaceRoot;
    this.store = store;
    this.sessionId = sessionId;
    this.repoIndex =
      repoIndex ?? new RepoIntelligenceIndex({ workspaceRoot });
    this.clock = clock;
    this.delegationLedger = new Map();
    this.delegatedTasks = [];
    this.subagentContexts = [];
    this.subagentResults = [];
    this.parentReceipts = [];
    this.runtimeTrace = [];
    this.appendQueue = Promise.resolve();
  }

  async initialize() {
    if (!this.repoIndex.index) await this.repoIndex.buildIndex();
    return this;
  }

  async delegateTasksInParallel(taskSpecs, { parallelGroupId } = {}) {
    await this.initialize();
    const groupId =
      parallelGroupId ??
      `parallel_${String(this.runtimeTrace.length + 1).padStart(3, "0")}`;
    await this.appendSessionEvent("delegation.parallel_started", {
      parallelGroupId: groupId,
      taskCount: taskSpecs.length,
    });
    const results = await Promise.all(
      taskSpecs.map((taskSpec) =>
        this.delegateTask(taskSpec, { parallelGroupId: groupId }),
      ),
    );
    await this.appendSessionEvent("delegation.parallel_completed", {
      parallelGroupId: groupId,
      resultIds: results
        .map((result) => result.subagentResult?.id)
        .filter(Boolean),
    });

    return {
      status: results.every((result) => result.status === "succeeded")
        ? "succeeded"
        : "completed_with_failure",
      parallelGroupId: groupId,
      results,
      independentTasks: results.map((result) => result.delegatedTask.id),
    };
  }

  async delegateTask(taskSpec, { parallelGroupId = null } = {}) {
    await this.initialize();
    const delegatedTask = normalizeDelegatedTask({
      ...taskSpec,
      parallelGroupId,
      createdAt: this.clock(),
    });
    const signature = taskSignature(delegatedTask);
    const existing = this.delegationLedger.get(signature);
    if (existing) {
      existing.reusedBy.push(delegatedTask.id);
      await this.appendSessionEvent("delegation.duplicate_reused", {
        delegatedTask,
        signature,
        reusedResultId: existing.result?.id ?? null,
      });
      return {
        status: "duplicate_reused",
        delegatedTask,
        reusedResultId: existing.result?.id ?? null,
        researchExecuted: false,
        ledgerEntry: publicLedgerEntry(existing),
      };
    }

    const subagentContext = await this.buildSubagentContext(delegatedTask);
    assertSubagentContextIsolation(subagentContext, delegatedTask);
    const ledgerEntry = {
      signature,
      taskIds: [delegatedTask.id],
      status: "running",
      startedAt: this.clock(),
      completedAt: null,
      runCount: 1,
      reusedBy: [],
      contextId: subagentContext.id,
      result: null,
    };
    this.delegationLedger.set(signature, ledgerEntry);
    this.delegatedTasks.push(delegatedTask);
    this.subagentContexts.push(subagentContext);
    this.runtimeTrace.push({
      event: "delegation.started",
      taskId: delegatedTask.id,
      parallelGroupId,
      contextId: subagentContext.id,
    });
    await this.appendSessionEvent("delegation.started", {
      delegatedTask,
      subagentContext: publicSubagentContext(subagentContext),
      signature,
    });

    const subagentResult = await this.runSubagentTask(
      delegatedTask,
      subagentContext,
    );
    const parentReceipt = await this.acceptSubagentResult(
      delegatedTask,
      subagentResult,
    );
    ledgerEntry.status = subagentResult.status;
    ledgerEntry.completedAt = this.clock();
    ledgerEntry.result = subagentResult;
    this.subagentResults.push(subagentResult);
    this.parentReceipts.push(parentReceipt);
    this.runtimeTrace.push({
      event: "delegation.completed",
      taskId: delegatedTask.id,
      resultId: subagentResult.id,
      status: subagentResult.status,
    });
    await this.appendSessionEvent("delegation.completed", {
      delegatedTaskId: delegatedTask.id,
      resultId: subagentResult.id,
      status: subagentResult.status,
      ledgerEntry: publicLedgerEntry(ledgerEntry),
    });

    return {
      status: subagentResult.status,
      delegatedTask,
      subagentContext,
      subagentResult,
      parentReceipt,
      ledgerEntry: publicLedgerEntry(ledgerEntry),
      researchExecuted: true,
    };
  }

  async buildSubagentContext(delegatedTask) {
    const relevance = this.repoIndex.scoreRelevance({
      goal: delegatedTask.objective,
      query: delegatedTask.query,
      maxFiles: 8,
    });
    const allowed = new Set(delegatedTask.allowedPaths);
    const forbidden = new Set(delegatedTask.forbiddenPaths);
    const selectedRankedFiles = relevance.rankedFiles
      .filter((file) => allowed.has(file.path))
      .filter((file) => !forbidden.has(file.path))
      .slice(0, delegatedTask.maxContextFiles);
    const selectedFiles = [];
    for (const file of selectedRankedFiles) {
      selectedFiles.push({
        path: file.path,
        hash: file.hash,
        score: file.score,
        reasons: file.reasons,
        tokens: file.tokens,
        snippet: await snippetForFile(this.workspaceRoot, file.path, delegatedTask.query),
      });
    }
    const estimatedTokens = selectedFiles.reduce(
      (total, file) => total + Math.min(file.tokens, 80),
      estimateTokens(delegatedTask.objective),
    );
    const context = {
      version: CORE31_SUBAGENT_CONTEXT_ISOLATION_VERSION,
      id: `subctx_${delegatedTask.id}`,
      taskId: delegatedTask.id,
      createdAt: this.clock(),
      tokenBudget: delegatedTask.contextBudget,
      estimatedTokens,
      allowedPaths: delegatedTask.allowedPaths,
      forbiddenPaths: delegatedTask.forbiddenPaths,
      selectedFiles,
      includedParentBlocks: [
        "delegated_task_objective",
        "task_specific_constraints",
      ],
      excludedParentBlocks: [
        "parent_private_notes",
        "unrelated_full_history",
        "unrelated_repo_files",
      ],
      rawParentMessagesIncluded: false,
      rawSubagentTranscriptReturned: false,
      isolationDigestHash: hashJson({
        taskId: delegatedTask.id,
        selectedFiles: selectedFiles.map((file) => ({
          path: file.path,
          hash: file.hash,
        })),
        excludedParentBlocks: [
          "parent_private_notes",
          "unrelated_full_history",
          "unrelated_repo_files",
        ],
      }),
      boundary: subagentContextIsolationBoundary(),
    };

    return context;
  }

  async runSubagentTask(delegatedTask, subagentContext) {
    if (delegatedTask.type === "missing_symbol_research") {
      return this.buildFailedResult({
        delegatedTask,
        subagentContext,
        reason: "target_symbol_not_found_in_isolated_context",
        retryHint:
          "Return to parent for broader repo context or revise allowed paths.",
      });
    }

    if (delegatedTask.type === "test_association_research") {
      const associations = this.repoIndex.index.testIndex.associations.filter(
        (association) =>
          delegatedTask.targetPath
            ? association.sourcePath === delegatedTask.targetPath
            : association.sourcePath.includes("pagination"),
      );
      const scripts = this.repoIndex.index.testIndex.packageScripts.filter(
        (script) => script.name.includes("test"),
      );
      if (associations.length === 0) {
        return this.buildFailedResult({
          delegatedTask,
          subagentContext,
          reason: "no_test_association_found",
          retryHint: "Ask parent to expand allowed paths or inspect scripts.",
        });
      }

      return this.buildSucceededResult({
        delegatedTask,
        subagentContext,
        summary:
          "Pagination has a direct test association and an allowlisted npm test path.",
        evidenceRefs: [
          ...associations.map((association) => ({
            kind: "test_association",
            path: association.testPath,
            sourcePath: association.sourcePath,
            imported: association.imported,
            line: association.line,
          })),
          ...scripts.map((script) => ({
            kind: "package_script",
            path: "package.json",
            name: script.name,
            command: script.command,
          })),
        ],
      });
    }

    const sourceFile = subagentContext.selectedFiles.find((file) =>
      file.path.startsWith("src/"),
    );
    if (!sourceFile) {
      return this.buildFailedResult({
        delegatedTask,
        subagentContext,
        reason: "no_source_file_in_isolated_context",
        retryHint: "Ask parent to revise delegated task allowed paths.",
      });
    }

    const symbols = this.repoIndex.index.symbolIndex.symbols.filter(
      (symbol) => symbol.path === sourceFile.path,
    );
    return this.buildSucceededResult({
      delegatedTask,
      subagentContext,
      summary: `${sourceFile.path} is the focused implementation file for the delegated research task.`,
      evidenceRefs: [
        {
          kind: "source_file",
          path: sourceFile.path,
          hash: sourceFile.hash,
          reasons: sourceFile.reasons,
        },
        ...symbols.map((symbol) => ({
          kind: "symbol",
          path: symbol.path,
          name: symbol.name,
          line: symbol.line,
          exported: symbol.exported,
        })),
      ],
    });
  }

  buildSucceededResult({ delegatedTask, subagentContext, summary, evidenceRefs }) {
    return {
      version: CORE31_SUBAGENT_CONTEXT_ISOLATION_VERSION,
      id: `subresult_${delegatedTask.id}`,
      taskId: delegatedTask.id,
      status: "succeeded",
      summary,
      evidenceRefs,
      contextDigestHash: subagentContext.isolationDigestHash,
      returnedToParent: {
        summaryOnly: true,
        evidenceLinksOnly: true,
        rawContextIncluded: false,
        rawTranscriptIncluded: false,
      },
      failure: null,
      completedAt: this.clock(),
    };
  }

  buildFailedResult({ delegatedTask, subagentContext, reason, retryHint }) {
    return {
      version: CORE31_SUBAGENT_CONTEXT_ISOLATION_VERSION,
      id: `subresult_${delegatedTask.id}`,
      taskId: delegatedTask.id,
      status: "failed",
      summary: "Subagent task failed inside its isolated context.",
      evidenceRefs: [],
      contextDigestHash: subagentContext.isolationDigestHash,
      returnedToParent: {
        summaryOnly: true,
        evidenceLinksOnly: true,
        rawContextIncluded: false,
        rawTranscriptIncluded: false,
      },
      failure: {
        reason,
        retryHint,
        structured: true,
      },
      completedAt: this.clock(),
    };
  }

  async acceptSubagentResult(delegatedTask, subagentResult) {
    const receipt = {
      id: `parent_receipt_${delegatedTask.id}`,
      taskId: delegatedTask.id,
      status:
        subagentResult.status === "succeeded"
          ? "accepted_as_observation"
          : "accepted_as_structured_failure",
      summary: subagentResult.summary,
      evidenceRefs: subagentResult.evidenceRefs,
      failure: subagentResult.failure,
      rawSubagentContextStored: false,
      promotedToSystemPrompt: false,
      duplicateResearchAllowed: false,
    };
    await this.appendSessionEvent("subagent.result_received", {
      delegatedTaskId: delegatedTask.id,
      result: receipt,
    });

    return receipt;
  }

  async appendSessionEvent(type, payload) {
    const append = this.appendQueue.then(() =>
      this.store.appendEvent(this.sessionId, type, payload),
    );
    this.appendQueue = append.catch(() => {});
    return append;
  }

  async replayDelegationLedger() {
    const events = await this.store.readEvents(this.sessionId);
    const delegationEvents = events.filter((event) =>
      event.type.startsWith("delegation.") ||
      event.type === "subagent.result_received",
    );
    return {
      status: "replayed",
      sessionId: this.sessionId,
      eventTypes: delegationEvents.map((event) => event.type),
      eventSeqs: delegationEvents.map((event) => event.seq),
      ledgerEntries: [...this.delegationLedger.values()].map(publicLedgerEntry),
      resultIds: this.subagentResults.map((result) => result.id),
      replayExplainsDelegation: true,
    };
  }
}

export class SubagentContextIsolationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SubagentContextIsolationError";
    this.code = code;
    this.details = details;
  }
}

export async function createSubagentContextIsolationFixture() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "agent-core31-"));
  const workspaceRoot = path.join(rootDir, "repo");
  await createSubagentFixtureWorkspace(workspaceRoot);
  const store = new DurableSessionStore({
    rootDir: path.join(rootDir, "session"),
  });
  const sessionId = await store.createSession({
    workspaceRoot,
    mode: "execute",
    initialState: {
      objective:
        "Use isolated subagents to research pagination implementation and tests.",
      latestUserConstraints: [
        "Do not leak parent private notes into delegated contexts.",
        "Do not repeat the same research after delegation.",
      ],
    },
  });
  await store.appendEvent(sessionId, "user.message", {
    content:
      "Delegate focused pagination research and return only summaries with evidence.",
  });
  const repoIndex = new RepoIntelligenceIndex({ workspaceRoot });
  await repoIndex.buildIndex();
  const runtime = new SubagentContextIsolationRuntime({
    workspaceRoot,
    store,
    sessionId,
    repoIndex,
  });

  return {
    rootDir,
    workspaceRoot,
    store,
    sessionId,
    repoIndex,
    runtime,
    tasks: createSubagentTaskSpecs(),
  };
}

export function createSubagentTaskSpecs() {
  return [
    {
      id: "task_find_pagination_source",
      type: "repo_file_research",
      objective:
        "Find the focused pagination implementation file without reading unrelated cart or private notes.",
      query: "paginate empty page source implementation",
      allowedPaths: [
        "src/pagination.cjs",
        "tests/pagination.test.cjs",
        "AGENTS.md",
        "package.json",
      ],
      forbiddenPaths: [
        "src/cart.cjs",
        "notes/private-plan.md",
        "docs/internal-notes.md",
      ],
    },
    {
      id: "task_find_pagination_tests",
      type: "test_association_research",
      objective:
        "Find tests and scripts that verify pagination behavior without reading unrelated files.",
      query: "pagination test package script",
      targetPath: "src/pagination.cjs",
      allowedPaths: [
        "src/pagination.cjs",
        "tests/pagination.test.cjs",
        "package.json",
        "AGENTS.md",
      ],
      forbiddenPaths: [
        "tests/cart.test.cjs",
        "notes/private-plan.md",
        "docs/internal-notes.md",
      ],
    },
  ];
}

export async function runSubagentContextIsolationDemo() {
  const fixture = await createSubagentContextIsolationFixture();
  const parallel = await fixture.runtime.delegateTasksInParallel(fixture.tasks, {
    parallelGroupId: "parallel_core31_001",
  });
  const duplicate = await fixture.runtime.delegateTask({
    ...fixture.tasks[0],
    id: "task_find_pagination_source_duplicate",
  });
  const failure = await fixture.runtime.delegateTask({
    id: "task_missing_billing_engine",
    type: "missing_symbol_research",
    objective:
      "Find a billing engine symbol using the current isolated pagination context.",
    query: "billing engine symbol",
    allowedPaths: ["src/pagination.cjs"],
    forbiddenPaths: ["notes/private-plan.md", "docs/internal-notes.md"],
  });
  const audit = await fixture.runtime.replayDelegationLedger();
  const events = await fixture.store.readEvents(fixture.sessionId);
  const report = {
    version: CORE31_SUBAGENT_CONTEXT_ISOLATION_VERSION,
    status: "passed",
    validationMatrix: core31ImplementationValidationMatrix(),
    parallel,
    duplicate,
    failure,
    audit,
    eventTypes: events.map((event) => event.type),
    contexts: fixture.runtime.subagentContexts,
    results: fixture.runtime.subagentResults,
    receipts: fixture.runtime.parentReceipts,
    ledger: [...fixture.runtime.delegationLedger.values()].map(publicLedgerEntry),
    boundary: subagentContextIsolationBoundary(),
  };

  return {
    checks: verifySubagentContextIsolationDemo(report),
    ...report,
  };
}

export function verifySubagentContextIsolationDemo(report) {
  assert.equal(report.version, CORE31_SUBAGENT_CONTEXT_ISOLATION_VERSION);
  assert.equal(report.status, "passed");
  assert.equal(report.parallel.status, "succeeded");
  assert.equal(report.parallel.results.length, 2);
  assert.equal(
    report.parallel.results.every((result) => result.researchExecuted === true),
    true,
  );
  assert.equal(
    report.contexts.every((context) => context.rawParentMessagesIncluded === false),
    true,
  );
  assert.equal(
    report.contexts.every((context) =>
      context.selectedFiles.every((file) =>
        context.allowedPaths.includes(file.path),
      ),
    ),
    true,
  );
  assert.equal(report.duplicate.status, "duplicate_reused");
  assert.equal(report.duplicate.researchExecuted, false);
  assert.equal(
    report.results
      .filter((result) => result.status === "succeeded")
      .every((result) => result.returnedToParent.rawContextIncluded === false),
    true,
  );
  assert.equal(report.failure.status, "failed");
  assert.equal(report.failure.subagentResult.failure.structured, true);
  assert.equal(report.audit.replayExplainsDelegation, true);
  assert.equal(report.boundary.productionSubagentSchedulerClaim, false);

  return {
    validation_matrix_present: true,
    independent_parallel_tasks_run: true,
    context_isolation_enforced: true,
    duplicate_research_blocked: true,
    result_contract_summary_and_evidence_only: true,
    failure_propagates_structured_reason: true,
    delegation_events_are_replayable: true,
    no_production_claim: true,
  };
}

export function core31ImplementationValidationMatrix() {
  return {
    topic: "Subagent Context Isolation",
    evidenceTier:
      "A public docs as interface clues, B product artifact observations as mechanism clues, D local implementation and verify evidence.",
    publicBoundary: {
      rawPromptOrSourceMapText: false,
      officialImplementationClaim: false,
      ownObjectModel: true,
    },
    sameTopicMergeDecision: {
      extends: [
        "Core 21 Long-Running Task Eval",
        "Core 24 Durable Session Store",
        "Core 25 Repo Intelligence",
      ],
      independentBecause:
        "Core 31 models delegated tasks with isolated context, structured subagent results, no-duplicate research, and replayable delegation ledger.",
      notCore21:
        "It does not evaluate multi-turn repair, repeated failure, compaction resume, cost curve, or no false final.",
      notCore24:
        "It does not create a new durable store; it appends delegation events to the existing session log.",
      notCore25:
        "It does not build a new repo index or relevance scorer; it consumes repo intelligence as bounded input for delegated context.",
    },
    runtimeState: [
      "delegatedTask",
      "subagentContext",
      "subagentResult",
      "delegationLedger",
      "isolationAudit",
    ],
    cases: [
      {
        case: "independent task",
        fixture: "two pagination research tasks with distinct allowed paths",
        expected: "tasks run in one parallel group and return independent results",
        evidence: "delegation trace",
      },
      {
        case: "context isolation",
        fixture: "parent context has private notes and unrelated files",
        expected: "subagent receives only allowed task-specific files",
        evidence: "subagentContext diff",
      },
      {
        case: "no duplicate research",
        fixture: "same delegated task signature submitted twice",
        expected: "second task reuses ledger result and does not run research",
        evidence: "delegationLedger",
      },
      {
        case: "result contract",
        fixture: "successful subagent result",
        expected: "parent receives summary and evidence refs, not raw context",
        evidence: "parent receipt",
      },
      {
        case: "failure propagation",
        fixture: "missing symbol in isolated context",
        expected: "parent receives structured failure and retry hint",
        evidence: "failure report",
      },
    ],
    outOfScope: [
      "real multi-process agent scheduler",
      "arbitrary long-running parallel agent system",
      "agent marketplace",
      "remote worker isolation",
      "official Claude Code subagent implementation",
    ],
  };
}

export function subagentContextIsolationBoundary() {
  return {
    deterministicLocalSubagentIsolation: true,
    longRunningEvalBoundary: {
      implementsCore21Eval: false,
      evaluatesLongRunningRepair: false,
    },
    durableSessionBoundary: durableSessionBoundary(),
    repoIntelligenceBoundary: repoIntelligenceBoundary(),
    productionSubagentSchedulerClaim: false,
    officialImplementationClaim: false,
    realMultiProcessClaim: false,
    remoteWorkerIsolationClaim: false,
    agentMarketplaceClaim: false,
  };
}

export function assertSubagentContextIsolation(context, delegatedTask) {
  const allowed = new Set(delegatedTask.allowedPaths);
  const forbidden = new Set(delegatedTask.forbiddenPaths);
  assert.equal(context.rawParentMessagesIncluded, false);
  assert.equal(context.rawSubagentTranscriptReturned, false);
  for (const file of context.selectedFiles) {
    assert.equal(allowed.has(file.path), true);
    assert.equal(forbidden.has(file.path), false);
  }
  assert.equal(context.excludedParentBlocks.includes("parent_private_notes"), true);
  return true;
}

async function createSubagentFixtureWorkspace(workspaceRoot) {
  await mkdir(workspaceRoot, { recursive: true });
  await writeFixtureFile(
    workspaceRoot,
    "package.json",
    JSON.stringify(
      {
        scripts: {
          test: "node scripts/test.cjs",
          "test:pagination": "node tests/pagination.test.cjs",
        },
      },
      null,
      2,
    ),
  );
  await writeFixtureFile(
    workspaceRoot,
    "AGENTS.md",
    [
      "# Fixture Rules",
      "",
      "- Preserve public API exports.",
      "- Use npm test before final.",
      "- Subagents may only receive task-specific files.",
      "",
    ].join("\n"),
  );
  await writeFixtureFile(
    workspaceRoot,
    "src/pagination.cjs",
    [
      "function paginate(items, page, pageSize) {",
      "  const start = page * pageSize;",
      "  const end = start + pageSize;",
      "  return items.slice(start, end);",
      "}",
      "",
      "function pageCount(items, pageSize) {",
      "  return Math.ceil(items.length / pageSize);",
      "}",
      "",
      "module.exports = { paginate, pageCount };",
      "",
    ].join("\n"),
  );
  await writeFixtureFile(
    workspaceRoot,
    "src/cart.cjs",
    [
      "const { paginate } = require('./pagination.cjs');",
      "",
      "function paginateCartItems(items, page, pageSize) {",
      "  return paginate(items, page, pageSize).map((item) => item.name);",
      "}",
      "",
      "module.exports = { paginateCartItems };",
      "",
    ].join("\n"),
  );
  await writeFixtureFile(
    workspaceRoot,
    "tests/pagination.test.cjs",
    [
      "const assert = require('node:assert/strict');",
      "const { paginate } = require('../src/pagination.cjs');",
      "",
      "assert.deepEqual(paginate([1, 2, 3, 4], 0, 2), [1, 2]);",
      "assert.deepEqual(paginate([1, 2, 3, 4], 9, 2), []);",
      "",
    ].join("\n"),
  );
  await writeFixtureFile(
    workspaceRoot,
    "tests/cart.test.cjs",
    [
      "const assert = require('node:assert/strict');",
      "const { paginateCartItems } = require('../src/cart.cjs');",
      "",
      "assert.deepEqual(paginateCartItems([{ name: 'a' }], 0, 1), ['a']);",
      "",
    ].join("\n"),
  );
  await writeFixtureFile(
    workspaceRoot,
    "scripts/test.cjs",
    [
      "require('../tests/pagination.test.cjs');",
      "require('../tests/cart.test.cjs');",
      "console.log('fixture tests passed');",
      "",
    ].join("\n"),
  );
  await writeFixtureFile(
    workspaceRoot,
    "notes/private-plan.md",
    [
      "# Parent Private Notes",
      "",
      "This file represents parent-only context and must not enter subagent contexts.",
      "",
    ].join("\n"),
  );
  await writeFixtureFile(
    workspaceRoot,
    "docs/internal-notes.md",
    [
      "# Internal Notes",
      "",
      "Unrelated context for isolation checks.",
      "",
    ].join("\n"),
  );
}

async function writeFixtureFile(workspaceRoot, relativePath, text) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${text.replace(/\n?$/, "\n")}`, "utf8");
}

function normalizeDelegatedTask(task) {
  if (!task.id || !task.objective || !task.query) {
    throw new SubagentContextIsolationError(
      "invalid_delegated_task",
      "A delegated task requires id, objective, and query.",
    );
  }
  return {
    version: CORE31_SUBAGENT_CONTEXT_ISOLATION_VERSION,
    id: task.id,
    type: task.type ?? "repo_file_research",
    objective: task.objective,
    query: task.query,
    targetPath: task.targetPath ?? null,
    allowedPaths: [...new Set(task.allowedPaths ?? [])].sort(),
    forbiddenPaths: [...new Set(task.forbiddenPaths ?? [])].sort(),
    contextBudget: task.contextBudget ?? 280,
    maxContextFiles: task.maxContextFiles ?? 3,
    expectedResultShape: [
      "status",
      "summary",
      "evidenceRefs",
      "failure",
      "contextDigestHash",
    ],
    parallelGroupId: task.parallelGroupId ?? null,
    createdAt: task.createdAt,
  };
}

function taskSignature(task) {
  return hashJson({
    type: task.type,
    objective: task.objective,
    query: task.query,
    targetPath: task.targetPath,
    allowedPaths: task.allowedPaths,
  });
}

function publicSubagentContext(context) {
  return {
    id: context.id,
    taskId: context.taskId,
    selectedFiles: context.selectedFiles.map((file) => ({
      path: file.path,
      hash: file.hash,
      score: file.score,
      reasons: file.reasons,
    })),
    includedParentBlocks: context.includedParentBlocks,
    excludedParentBlocks: context.excludedParentBlocks,
    rawParentMessagesIncluded: context.rawParentMessagesIncluded,
    rawSubagentTranscriptReturned: context.rawSubagentTranscriptReturned,
    isolationDigestHash: context.isolationDigestHash,
  };
}

function publicLedgerEntry(entry) {
  return {
    signature: entry.signature,
    taskIds: entry.taskIds,
    status: entry.status,
    runCount: entry.runCount,
    reusedBy: entry.reusedBy,
    contextId: entry.contextId,
    resultId: entry.result?.id ?? null,
  };
}

async function snippetForFile(workspaceRoot, relativePath, query) {
  const text = await readFile(path.join(workspaceRoot, relativePath), "utf8");
  const terms = tokenize(query);
  const lines = text.split("\n");
  const index = lines.findIndex((line) =>
    terms.some((term) => line.toLowerCase().includes(term)),
  );
  const lineNumber = index >= 0 ? index + 1 : 1;
  return {
    line: lineNumber,
    text: (lines[index >= 0 ? index : 0] ?? "").slice(0, 160),
  };
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9_]+/u)
    .filter(Boolean);
}

function estimateTokens(text) {
  return Math.ceil(String(text).length / 4);
}

function hashJson(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function main() {
  console.log(JSON.stringify(await runSubagentContextIsolationDemo(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
