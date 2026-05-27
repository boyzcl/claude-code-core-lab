import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CORE22_TOOL_TRANSACTION_VERSION,
  TransactionalToolRuntime,
  classifyBashRisk,
  createTransactionWorkspace,
  runToolTransactionDemo,
  verifyToolTransactionDemo,
} from "./tool-runtime-transaction.mjs";

const cases = [];

await record("core22: transaction demo runs and verifies", async () => {
  const result = await runToolTransactionDemo();
  return verifyToolTransactionDemo(result);
});

await record("diff preview: preview creates diff artifacts and does not write", async () => {
  const workspaceRoot = await createTransactionWorkspace();
  const runtime = new TransactionalToolRuntime({ workspaceRoot });
  await runtime.read("src/pagination.cjs");
  const before = await readFile(path.join(workspaceRoot, "src/pagination.cjs"), "utf8");
  const preview = await runtime.previewTransaction([
    {
      path: "src/pagination.cjs",
      oldString: "  return start + pageSize + 1;",
      newString: "  return start + pageSize;",
    },
  ]);
  const afterPreview = await readFile(
    path.join(workspaceRoot, "src/pagination.cjs"),
    "utf8",
  );

  assert.equal(preview.status, "previewed");
  assert.equal(preview.writesApplied, false);
  assert.equal(afterPreview, before);
  assert.match(preview.diffArtifacts[0].preview, /-   return start/);
  assert.match(preview.diffArtifacts[0].preview, /\+   return start/);

  return {
    diff_artifacts: preview.diffArtifacts.length,
    preview_did_not_write: true,
  };
});

await record("transaction commit: multi-file transaction writes only after commit", async () => {
  const workspaceRoot = await createTransactionWorkspace();
  const runtime = new TransactionalToolRuntime({ workspaceRoot });
  await runtime.read("src/pagination.cjs");
  await runtime.read("src/empty-page.cjs");
  const preview = await runtime.previewTransaction([
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
  ]);
  const commit = await runtime.commitTransaction(preview.transactionId);
  const pagination = await readFile(
    path.join(workspaceRoot, "src/pagination.cjs"),
    "utf8",
  );
  const emptyPage = await readFile(
    path.join(workspaceRoot, "src/empty-page.cjs"),
    "utf8",
  );

  assert.equal(commit.status, "committed");
  assert.deepEqual(commit.written, ["src/pagination.cjs", "src/empty-page.cjs"]);
  assert.match(pagination, /return start \+ pageSize;/);
  assert.match(emptyPage, /start >= items.length/);

  return {
    committed_files: commit.written,
    transaction_log_events: commit.transactionLog.map((entry) => entry.event),
  };
});

await record("rollback: simulated failure restores pre-transaction hashes", async () => {
  const workspaceRoot = await createTransactionWorkspace();
  const runtime = new TransactionalToolRuntime({ workspaceRoot });
  await runtime.read("src/pagination.cjs");
  await runtime.read("src/empty-page.cjs");
  const beforePagination = await readFile(
    path.join(workspaceRoot, "src/pagination.cjs"),
    "utf8",
  );
  const beforeEmpty = await readFile(
    path.join(workspaceRoot, "src/empty-page.cjs"),
    "utf8",
  );
  const preview = await runtime.previewTransaction([
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
  ]);
  const result = await runtime.commitTransaction(preview.transactionId, {
    failAfterWrites: 1,
  });
  const afterPagination = await readFile(
    path.join(workspaceRoot, "src/pagination.cjs"),
    "utf8",
  );
  const afterEmpty = await readFile(
    path.join(workspaceRoot, "src/empty-page.cjs"),
    "utf8",
  );

  assert.equal(result.status, "rolled_back");
  assert.equal(afterPagination, beforePagination);
  assert.equal(afterEmpty, beforeEmpty);
  assert.equal(result.rollback.restoredCount, 1);

  return {
    rolled_back: true,
    restored: result.rollback.restored,
  };
});

await record("stale reread: external change after read blocks preview", async () => {
  const workspaceRoot = await createTransactionWorkspace();
  const runtime = new TransactionalToolRuntime({ workspaceRoot });
  await runtime.read("src/pagination.cjs");
  await writeFile(
    path.join(workspaceRoot, "src/pagination.cjs"),
    "function touched() { return true; }\n",
    "utf8",
  );
  const preview = await runtime.previewTransaction([
    {
      path: "src/pagination.cjs",
      oldString: "  return start + pageSize + 1;",
      newString: "  return start + pageSize;",
    },
  ]);

  assert.equal(preview.status, "denied");
  assert.equal(preview.error.error_type, "stale_file");
  assert.equal(preview.error.recommended_next_tool, "Read");

  return {
    stale_file_blocked: true,
    recommended_next_tool: preview.error.recommended_next_tool,
  };
});

await record("protected file: protected API edit requires approval", async () => {
  const workspaceRoot = await createTransactionWorkspace();
  const runtime = new TransactionalToolRuntime({ workspaceRoot });
  await runtime.read("src/public-api.cjs");
  const preview = await runtime.previewTransaction([
    {
      path: "src/public-api.cjs",
      oldString: "module.exports = {",
      newString: "module.exports = Object.freeze({",
    },
  ]);

  assert.equal(preview.status, "denied");
  assert.equal(preview.error.error_type, "protected_file_requires_approval");
  assert.equal(preview.error.recommended_next_tool, "AskUser");

  return {
    protected_file_blocked: true,
    recommended_next_tool: preview.error.recommended_next_tool,
  };
});

await record("bash risk class: high-risk command is denied or sent to approval", async () => {
  const workspaceRoot = await createTransactionWorkspace();
  const runtime = new TransactionalToolRuntime({ workspaceRoot });
  const safe = runtime.authorizeBash("npm test");
  const unsafe = runtime.authorizeBash("rm -rf .");

  assert.equal(classifyBashRisk("npm test"), "low");
  assert.equal(safe.allowed, true);
  assert.equal(unsafe.allowed, false);
  assert.equal(unsafe.riskClass, "high");
  assert.equal(unsafe.recommended_next_tool, "AskUser");

  return {
    safe_command_allowed: true,
    high_risk_command_denied: true,
    high_risk_error_type: unsafe.error_type,
  };
});

await record("boundary: transaction layer is local evidence, not full ToolRuntime", async () => {
  const result = await runToolTransactionDemo();

  assert.equal(result.boundary.deterministicLocalTransaction, true);
  assert.equal(result.boundary.productionClaudeCodeClaim, false);
  assert.equal(result.boundary.fullToolRuntimeClaim, false);
  assert.ok(result.preview.transactionId.startsWith("tx_"));
  assert.equal(CORE22_TOOL_TRANSACTION_VERSION, "core22-tool-runtime-transaction-v1");

  return {
    deterministic_local_transaction: true,
    no_production_claude_code_claim: true,
    no_full_tool_runtime_claim: true,
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
