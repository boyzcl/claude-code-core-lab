import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CORE29_MEMORY_SOURCE_VERSION,
  MemorySourceError,
  core29ImplementationValidationMatrix,
  createMemorySourceFixture,
  memorySourceBoundary,
  runMemorySourceDemo,
  verifyMemorySourceDemo,
} from "./memory-source-auto-memory.mjs";

const cases = [];

await record("core29: memory source demo runs and verifies", async () => {
  const result = await runMemorySourceDemo();
  return verifyMemorySourceDemo(result);
});

await record("validation matrix: Core 29 does not duplicate Course 08/09 or Core 18/19/24", async () => {
  const matrix = core29ImplementationValidationMatrix();

  assert.equal(matrix.topic, "Memory Source / CLAUDE.md / Auto Memory");
  assert.deepEqual(matrix.runtimeState, [
    "memoryStore",
    "memoryIndex",
    "memoryType",
    "memoryFreshnessCheck",
    "forgetEvent",
  ]);
  assert.equal(matrix.sameTopicMergeDecision.notCourse08.includes("ModelRequest"), true);
  assert.equal(matrix.sameTopicMergeDecision.notCourse09.includes("compactSummary"), true);
  assert.equal(matrix.sameTopicMergeDecision.notCore18.includes("token economy"), true);
  assert.equal(matrix.sameTopicMergeDecision.notCore19.includes("compaction quality"), true);
  assert.equal(matrix.sameTopicMergeDecision.notCore24.includes("durable session"), true);
  assert.equal(matrix.publicBoundary.rawPromptOrSourceMapText, false);
  assert.equal(matrix.publicBoundary.ownObjectModel, true);

  return {
    runtime_state: matrix.runtimeState,
    not_course08: matrix.sameTopicMergeDecision.notCourse08,
    not_course09: matrix.sameTopicMergeDecision.notCourse09,
    not_core18: matrix.sameTopicMergeDecision.notCore18,
    not_core19: matrix.sameTopicMergeDecision.notCore19,
    not_core24: matrix.sameTopicMergeDecision.notCore24,
    public_safe: true,
  };
});

await record("memory type routing: user feedback project and reference use distinct policies", async () => {
  const fixture = await createMemorySourceFixture();
  const routes = [
    fixture.runtime.routeMemoryCandidate(fixture.candidates.userPreference),
    fixture.runtime.routeMemoryCandidate(fixture.candidates.feedbackPreference),
    fixture.runtime.routeMemoryCandidate({
      id: "project_claude_md",
      type: "project",
      text: "Project memory file.",
      sourceKind: "project_memory_file",
    }),
    fixture.runtime.routeMemoryCandidate(fixture.candidates.freshReference),
  ];

  assert.deepEqual(
    routes.map((route) => route.memoryType),
    ["user", "feedback", "project", "reference"],
  );
  assert.equal(routes[0].writePolicy, "user_confirmed_long_term_preference");
  assert.equal(routes[1].readPolicy, "prefer_recent_feedback");
  assert.equal(routes[2].target, "project_memory_file");
  assert.equal(routes[3].requiresFreshnessCheck, true);

  return {
    memory_types: routes.map((route) => route.memoryType),
    targets: routes.map((route) => route.target),
    reference_requires_freshness: routes[3].requiresFreshnessCheck,
  };
});

await record("write and index: memory body and index are separated", async () => {
  const fixture = await createMemorySourceFixture();
  const write = await fixture.runtime.writeMemory(
    fixture.candidates.userPreference,
  );
  const indexText = await readFile(write.indexPath, "utf8");
  const bodyText = await readFile(write.bodyPath, "utf8");
  const index = JSON.parse(indexText);
  const entry = index.entries.find((item) => item.id === write.memory.id);

  assert.equal(write.status, "written");
  assert.ok(entry);
  assert.equal(Object.hasOwn(entry, "text"), false);
  assert.equal(indexText.includes("body-only-verification-preference"), false);
  assert.equal(bodyText.includes("body-only-verification-preference"), true);
  assert.equal(entry.bodyHash, write.memory.bodyHash);

  return {
    memory_id: write.memory.id,
    body_path: path.relative(fixture.rootDir, write.bodyPath),
    index_path: path.relative(fixture.rootDir, write.indexPath),
    index_has_text_field: Object.hasOwn(entry, "text"),
    body_hash_linked: entry.bodyHash === write.memory.bodyHash,
  };
});

await record("forget: deleted memory removes body and updates index", async () => {
  const fixture = await createMemorySourceFixture();
  await fixture.runtime.writeMemory(fixture.candidates.feedbackPreference);
  const forget = await fixture.runtime.forgetMemory({
    id: fixture.candidates.feedbackPreference.id,
  });
  const index = await fixture.runtime.loadMemoryIndex();

  assert.equal(forget.status, "forgotten");
  assert.equal(forget.deletionReport.bodyDeleted, true);
  assert.equal(index.entries.some((entry) => entry.id === forget.forgetEvent.memoryId), false);
  assert.equal(index.forgetEvents.some((event) => event.memoryId === forget.forgetEvent.memoryId), true);

  return {
    memory_id: forget.forgetEvent.memoryId,
    body_deleted: forget.deletionReport.bodyDeleted,
    index_entry_removed: true,
    forget_events: index.forgetEvents.length,
  };
});

await record("stale verification: referenced files are checked before recommendation", async () => {
  const fixture = await createMemorySourceFixture();
  await fixture.runtime.writeMemory(fixture.candidates.freshReference);
  await fixture.runtime.writeMemory(fixture.candidates.staleReference);

  const fresh = await fixture.runtime.recommendMemories({
    query: "pagination discussions",
  });
  const stale = await fixture.runtime.recommendMemories({
    query: "cache behavior",
  });

  assert.equal(fresh.recommended.some((item) => item.id === "mem_reference_pagination"), true);
  assert.equal(stale.recommended.length, 0);
  assert.deepEqual(
    stale.staleRejected.map((item) => item.id),
    ["mem_reference_stale_cache"],
  );
  assert.equal(
    stale.freshnessChecks[0].reason,
    "referenced_file_or_symbol_missing",
  );

  return {
    fresh_recommended: fresh.recommended.map((item) => item.id),
    stale_rejected: stale.staleRejected.map((item) => item.id),
    freshness_reason: stale.freshnessChecks[0].reason,
  };
});

await record("compaction boundary: long-term memory stays separate from compact summary", async () => {
  const fixture = await createMemorySourceFixture();
  await fixture.runtime.indexProjectMemoryFromClaudeMd();
  await fixture.runtime.writeMemory(fixture.candidates.userPreference);
  const snapshot = await fixture.runtime.buildContextSnapshot({
    compactSummary: {
      objective: "Continue after compaction.",
      pendingActions: ["Use long-term memory only as separate source."],
    },
  });

  assert.equal(snapshot.memoryMixedWithCompactSummary, false);
  assert.equal(snapshot.compactSummaryBlock.kind, "compact_summary");
  assert.equal(snapshot.memoryBlocks.every((block) => block.kind === "long_term_memory"), true);
  assert.equal(snapshot.longTermMemoryBlockCount, 2);
  assert.equal(snapshot.compactSummaryBlockCount, 1);

  return {
    memory_block_count: snapshot.longTermMemoryBlockCount,
    compact_summary_block_count: snapshot.compactSummaryBlockCount,
    memory_mixed_with_compact_summary: snapshot.memoryMixedWithCompactSummary,
  };
});

await record("no code-structure memory: repo facts are denied as long-term memory", async () => {
  const fixture = await createMemorySourceFixture();
  const result = await fixture.runtime.writeMemory(
    fixture.candidates.codeStructureClaim,
  );
  const index = await fixture.runtime.loadMemoryIndex();

  assert.equal(result.status, "denied");
  assert.equal(result.error.error_type, "code_structure_memory_denied");
  assert.equal(result.recommendedNextEvent, "read_repo_or_update_repo_index");
  assert.equal(index.entries.some((entry) => entry.id === "mem_code_structure_claim"), false);

  return {
    denied_status: result.status,
    error_type: result.error.error_type,
    recommended_next_event: result.recommendedNextEvent,
    index_entry_created: false,
  };
});

await record("boundary: memory source is local evidence, not official memory product", async () => {
  const boundary = memorySourceBoundary();

  assert.equal(CORE29_MEMORY_SOURCE_VERSION, "core29-memory-source-auto-memory-v1");
  assert.equal(boundary.deterministicLocalMemorySource, true);
  assert.equal(boundary.productionMemoryProductClaim, false);
  assert.equal(boundary.officialImplementationClaim, false);
  assert.equal(boundary.realClaudeMemoryFormatClaim, false);
  assert.equal(boundary.remoteMemoryServiceClaim, false);
  assert.equal(boundary.privacyComplianceSystemClaim, false);
  assert.equal(boundary.codeIntelligenceDatabaseClaim, false);

  return {
    deterministic_local_memory_source: true,
    no_production_memory_product_claim: true,
    no_official_memory_format_claim: true,
    no_remote_memory_service_claim: true,
    no_privacy_compliance_system_claim: true,
    no_code_intelligence_database_claim: true,
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
      code: error instanceof MemorySourceError ? error.code : undefined,
    });
    throw error;
  }
}
