import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CORE22_TOOL_TRANSACTION_VERSION =
  "core22-tool-runtime-transaction-v1";

const HIGH_RISK_COMMAND_PATTERNS = [/rm\s+-rf/, /curl\s+.*\|\s*(sh|bash)/, /sudo\b/];

export class TransactionalToolRuntime {
  constructor({
    workspaceRoot,
    protectedPaths = ["src/public-api.cjs"],
    allowedCommands = ["npm test", "node scripts/test.cjs"],
  }) {
    this.workspaceRoot = workspaceRoot;
    this.protectedPaths = new Set(protectedPaths);
    this.allowedCommands = new Set(allowedCommands);
    this.snapshots = new Map();
    this.transactions = new Map();
    this.transactionSeq = 0;
    this.log = [];
  }

  async read(relativePath) {
    const resolved = resolveWorkspacePath(this.workspaceRoot, relativePath);
    if (!resolved.ok) return errorResult("Read", "path_denied", resolved.reason);

    const text = await readFile(resolved.absolutePath, "utf8");
    const digest = hashText(text);
    this.snapshots.set(relativePath, {
      path: relativePath,
      text,
      hash: digest,
    });
    this.record("read.snapshot", {
      path: relativePath,
      hash: digest,
    });

    return {
      status: "success",
      name: "Read",
      content: {
        path: relativePath,
        text,
        hash: digest,
      },
    };
  }

  async previewTransaction(edits, { reason = "transaction_preview" } = {}) {
    const checked = [];
    const diffArtifacts = [];

    for (const edit of edits) {
      const decision = await this.checkEdit(edit);
      if (!decision.allowed) {
        return {
          status: "denied",
          error: decision.error,
          checked,
          diffArtifacts,
        };
      }

      checked.push(decision.checked);
      diffArtifacts.push(buildDiffArtifact(decision.checked));
    }

    const transactionId = `tx_${++this.transactionSeq}`;
    const transaction = {
      id: transactionId,
      status: "previewed",
      reason,
      edits: checked,
      diffArtifacts,
      beforeHashes: checked.map((edit) => ({
        path: edit.path,
        hash: edit.beforeHash,
      })),
      log: [
        {
          event: "transaction.previewed",
          editCount: checked.length,
        },
      ],
    };
    this.transactions.set(transactionId, transaction);
    this.record("transaction.previewed", {
      transactionId,
      editCount: checked.length,
    });

    return {
      status: "previewed",
      transactionId,
      diffArtifacts,
      transactionLog: cloneJson(transaction.log),
      writesApplied: false,
    };
  }

  async commitTransaction(transactionId, { failAfterWrites = null } = {}) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return errorResult("Commit", "transaction_not_found", `Missing ${transactionId}`);
    }

    const beforeTexts = new Map();
    const written = [];

    try {
      for (const edit of transaction.edits) {
        const current = await readFile(edit.absolutePath, "utf8");
        const currentHash = hashText(current);
        if (currentHash !== edit.beforeHash) {
          return errorResult(
            "Commit",
            "stale_file",
            `File changed after preview: ${edit.path}`,
            "Read",
          );
        }
        beforeTexts.set(edit.path, current);
      }

      for (const edit of transaction.edits) {
        await writeFile(edit.absolutePath, edit.afterText, "utf8");
        written.push(edit.path);
        this.snapshots.set(edit.path, {
          path: edit.path,
          text: edit.afterText,
          hash: edit.afterHash,
        });

        if (failAfterWrites != null && written.length >= failAfterWrites) {
          throw new Error("simulated_transaction_failure");
        }
      }

      transaction.status = "committed";
      transaction.log.push({
        event: "transaction.committed",
        written,
      });
      this.record("transaction.committed", {
        transactionId,
        written,
      });

      return {
        status: "committed",
        transactionId,
        written,
        transactionLog: cloneJson(transaction.log),
      };
    } catch (error) {
      const rollback = await this.rollbackWrites(beforeTexts, written);
      transaction.status = "rolled_back";
      transaction.log.push({
        event: "transaction.rolled_back",
        reason: error.message,
        restored: rollback.restored,
      });
      this.record("transaction.rolled_back", {
        transactionId,
        reason: error.message,
        restored: rollback.restored,
      });

      return {
        status: "rolled_back",
        transactionId,
        error: {
          error_type: "transaction_failed",
          message: error.message,
          recoverable: true,
          recommended_next_tool: "Read",
        },
        rollback,
        transactionLog: cloneJson(transaction.log),
      };
    }
  }

  async checkEdit(edit) {
    const resolved = resolveWorkspacePath(this.workspaceRoot, edit.path);
    if (!resolved.ok) {
      return {
        allowed: false,
        error: {
          error_type: "path_denied",
          message: resolved.reason,
          recommended_next_tool: null,
        },
      };
    }

    if (this.protectedPaths.has(edit.path)) {
      return {
        allowed: false,
        error: {
          error_type: "protected_file_requires_approval",
          message: `Protected file requires human approval: ${edit.path}`,
          recommended_next_tool: "AskUser",
        },
      };
    }

    const snapshot = this.snapshots.get(edit.path);
    if (!snapshot) {
      return {
        allowed: false,
        error: {
          error_type: "file_not_read",
          message: `Read ${edit.path} before previewing an edit.`,
          recommended_next_tool: "Read",
        },
      };
    }

    const currentText = await readFile(resolved.absolutePath, "utf8");
    const currentHash = hashText(currentText);
    if (currentHash !== snapshot.hash) {
      return {
        allowed: false,
        error: {
          error_type: "stale_file",
          message: `File changed after read: ${edit.path}`,
          recommended_next_tool: "Read",
        },
      };
    }

    const matches = countOccurrences(currentText, edit.oldString);
    if (matches !== 1) {
      return {
        allowed: false,
        error: {
          error_type:
            matches === 0 ? "old_string_not_found" : "old_string_not_unique",
          message: `Expected exactly one oldString match in ${edit.path}, got ${matches}.`,
          recommended_next_tool: "Read",
        },
      };
    }

    const afterText = currentText.replace(edit.oldString, edit.newString);
    return {
      allowed: true,
      checked: {
        path: edit.path,
        absolutePath: resolved.absolutePath,
        oldString: edit.oldString,
        newString: edit.newString,
        beforeText: currentText,
        afterText,
        beforeHash: currentHash,
        afterHash: hashText(afterText),
      },
    };
  }

  authorizeBash(command) {
    const riskClass = classifyBashRisk(command);

    if (riskClass === "high") {
      return {
        allowed: false,
        riskClass,
        error_type: "high_risk_command_requires_approval",
        reason: `High-risk command requires approval: ${command}`,
        recommended_next_tool: "AskUser",
      };
    }

    if (!this.allowedCommands.has(command)) {
      return {
        allowed: false,
        riskClass,
        error_type: "command_not_allowlisted",
        reason: `Command is not allowlisted: ${command}`,
        recommended_next_tool: null,
      };
    }

    return {
      allowed: true,
      riskClass,
      reason: "Command is allowlisted.",
    };
  }

  async rollbackWrites(beforeTexts, writtenPaths) {
    const restored = [];
    for (const targetPath of [...writtenPaths].reverse()) {
      const text = beforeTexts.get(targetPath);
      const resolved = resolveWorkspacePath(this.workspaceRoot, targetPath);
      await writeFile(resolved.absolutePath, text, "utf8");
      this.snapshots.set(targetPath, {
        path: targetPath,
        text,
        hash: hashText(text),
      });
      restored.push({
        path: targetPath,
        hash: hashText(text),
      });
    }

    return {
      restored,
      restoredCount: restored.length,
    };
  }

  record(event, payload = {}) {
    this.log.push({
      seq: this.log.length + 1,
      event,
      ...cloneJson(payload),
    });
  }
}

export async function createTransactionWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "agent-core22-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await writeFile(
    path.join(root, "src/pagination.cjs"),
    [
      "function pageStart(page, pageSize) {",
      "  return page * pageSize;",
      "}",
      "",
      "function pageEnd(start, pageSize) {",
      "  return start + pageSize + 1;",
      "}",
      "",
      "module.exports = { pageStart, pageEnd };",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "src/empty-page.cjs"),
    [
      "function isEmptyPage(items, start) {",
      "  return start > items.length;",
      "}",
      "",
      "module.exports = { isEmptyPage };",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "src/public-api.cjs"),
    [
      "module.exports = {",
      "  paginate: require('./pagination.cjs'),",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "scripts/test.cjs"),
    "console.log('ok');\n",
    "utf8",
  );

  return root;
}

export async function runToolTransactionDemo() {
  const workspaceRoot = await createTransactionWorkspace();
  const runtime = new TransactionalToolRuntime({ workspaceRoot });

  await runtime.read("src/pagination.cjs");
  await runtime.read("src/empty-page.cjs");
  const preview = await runtime.previewTransaction(
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
    { reason: "fix pagination boundaries" },
  );
  const beforeCommitText = await readFile(
    path.join(workspaceRoot, "src/pagination.cjs"),
    "utf8",
  );
  const commit = await runtime.commitTransaction(preview.transactionId);
  const afterCommitText = await readFile(
    path.join(workspaceRoot, "src/pagination.cjs"),
    "utf8",
  );

  const result = {
    checks: verifyToolTransactionDemo({
      preview,
      commit,
      beforeCommitText,
      afterCommitText,
      runtime,
    }),
    workspaceRoot,
    preview,
    commit,
    beforeCommitText,
    afterCommitText,
    runtimeLog: runtime.log,
    boundary: {
      deterministicLocalTransaction: true,
      productionClaudeCodeClaim: false,
      fullToolRuntimeClaim: false,
    },
  };

  return result;
}

export function verifyToolTransactionDemo({
  preview,
  commit,
  beforeCommitText,
  afterCommitText,
  runtime,
  runtimeLog,
}) {
  const log = runtime?.log ?? runtimeLog ?? [];

  assert.equal(preview.status, "previewed");
  assert.equal(preview.writesApplied, false);
  assert.match(beforeCommitText, /return page \* pageSize/);
  assert.equal(commit.status, "committed");
  assert.match(afterCommitText, /return start \+ pageSize;/);
  assert.equal(preview.diffArtifacts.length, 2);
  assert.equal(
    log.some((entry) => entry.event === "transaction.committed"),
    true,
  );

  return {
    diff_preview_created: true,
    preview_did_not_write: true,
    transaction_committed: true,
    transaction_log_recorded: true,
    no_production_claim: true,
  };
}

export function classifyBashRisk(command) {
  if (HIGH_RISK_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
    return "high";
  }
  if (/npm test|node scripts\/test\.cjs|git status --short/.test(command)) {
    return "low";
  }
  return "medium";
}

function buildDiffArtifact(edit) {
  return {
    id: `diff_${shortHash(`${edit.path}:${edit.beforeHash}:${edit.afterHash}`)}`,
    path: edit.path,
    beforeHash: edit.beforeHash,
    afterHash: edit.afterHash,
    preview: [
      `--- ${edit.path}`,
      `+++ ${edit.path}`,
      `- ${edit.oldString}`,
      `+ ${edit.newString}`,
    ].join("\n"),
    writesApplied: false,
  };
}

function resolveWorkspacePath(workspaceRoot, relativePath) {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    return {
      ok: false,
      reason: "Path must be a non-empty workspace-relative string.",
    };
  }

  if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
    return {
      ok: false,
      reason: `Path is outside workspace or not allowed: ${relativePath}`,
    };
  }

  const absolutePath = path.resolve(workspaceRoot, relativePath);
  const rel = path.relative(workspaceRoot, absolutePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return {
      ok: false,
      reason: `Path escapes workspace: ${relativePath}`,
    };
  }

  return {
    ok: true,
    absolutePath,
  };
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

function errorResult(name, errorType, message, recommendedNextTool = null) {
  return {
    status: "error",
    name,
    error: {
      error_type: errorType,
      message,
      recoverable: true,
      recommended_next_tool: recommendedNextTool,
    },
  };
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function shortHash(text) {
  return hashText(text).slice(0, 12);
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runToolTransactionDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
