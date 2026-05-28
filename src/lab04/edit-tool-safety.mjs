import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MessageStore } from "../lab02/message-store.mjs";

export class EditRuntime {
  constructor({ workspaceRoot }) {
    this.workspaceRoot = workspaceRoot;
    this.snapshots = new Map();
  }

  async execute(toolCall) {
    const decision = this.authorize(toolCall);
    if (!decision.allowed) {
      return makeDeniedToolResult(toolCall, decision.reason);
    }

    try {
      if (toolCall.name === "Read") {
        return await this.#read(toolCall);
      }

      if (toolCall.name === "Edit") {
        return await this.#edit(toolCall);
      }

      return makeErrorToolResult(toolCall, "unknown_tool", `Unknown tool ${toolCall.name}.`);
    } catch (error) {
      return makeErrorToolResult(
        toolCall,
        error.code ?? "tool_execution_error",
        error.message,
      );
    }
  }

  authorize(toolCall) {
    if (!["Read", "Edit"].includes(toolCall.name)) {
      return {
        allowed: false,
        reason: `Tool ${toolCall.name} is not registered in lab-04.`,
      };
    }

    const targetPath = toolCall.input?.path;
    const resolved = resolveWorkspacePath(this.workspaceRoot, targetPath);

    return resolved.ok
      ? { allowed: true, reason: "Path is inside workspace." }
      : { allowed: false, reason: resolved.reason };
  }

  async #read(toolCall) {
    const file = resolveWorkspacePath(this.workspaceRoot, toolCall.input.path);
    const text = await readFile(file.absolutePath, "utf8");
    const digest = hashText(text);

    this.snapshots.set(toolCall.input.path, {
      hash: digest,
      text,
    });

    return {
      type: "tool_result",
      id: resultId(toolCall),
      tool_call_id: toolCall.id,
      name: "Read",
      status: "success",
      content: {
        path: toolCall.input.path,
        text,
        hash: digest,
      },
    };
  }

  async #edit(toolCall) {
    const { path: targetPath, old_string: oldString, new_string: newString } =
      toolCall.input;
    const snapshot = this.snapshots.get(targetPath);

    if (!snapshot) {
      return makeErrorToolResult(
        toolCall,
        "file_not_read",
        "File must be read before edit.",
        "Read",
      );
    }

    const file = resolveWorkspacePath(this.workspaceRoot, targetPath);
    const currentText = await readFile(file.absolutePath, "utf8");
    const currentHash = hashText(currentText);

    if (currentHash !== snapshot.hash) {
      return makeErrorToolResult(
        toolCall,
        "stale_file",
        "File changed after it was read. Read it again before editing.",
        "Read",
      );
    }

    const matches = countOccurrences(currentText, oldString);
    if (matches === 0) {
      return makeErrorToolResult(
        toolCall,
        "old_string_not_found",
        "old_string was not found in the current file.",
        "Read",
      );
    }

    if (matches > 1) {
      return makeErrorToolResult(
        toolCall,
        "old_string_not_unique",
        "old_string matched multiple locations. Provide a unique old_string.",
        "Read",
      );
    }

    const nextText = currentText.replace(oldString, newString);
    const nextHash = hashText(nextText);
    await writeFile(file.absolutePath, nextText, "utf8");

    this.snapshots.set(targetPath, {
      hash: nextHash,
      text: nextText,
    });

    return {
      type: "tool_result",
      id: resultId(toolCall),
      tool_call_id: toolCall.id,
      name: "Edit",
      status: "success",
      content: {
        path: targetPath,
        replacements: 1,
        oldHash: currentHash,
        newHash: nextHash,
      },
    };
  }
}

export async function createEditWorkspace({ duplicate = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "agent-lab04-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "src", "settings.js"),
    duplicate
      ? "export const pageSize = 10;\nexport const fallbackPageSize = 10;\n"
      : "export const pageSize = 10;\n",
    "utf8",
  );
  return root;
}

export async function runTool(store, sessionId, runtime, toolCall) {
  store.appendAssistantToolCall(sessionId, toolCall);
  const result = await runtime.execute(toolCall);
  store.appendToolResult(sessionId, result);
  return result;
}

export async function runDemo() {
  const workspaceRoot = await createEditWorkspace();
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  const runtime = new EditRuntime({ workspaceRoot });

  store.appendUserMessage(sessionId, "把默认 pageSize 从 10 改成 20。");

  await runTool(store, sessionId, runtime, {
    id: "tool_call_read_001",
    name: "Read",
    input: {
      path: "src/settings.js",
    },
  });

  await runTool(store, sessionId, runtime, {
    id: "tool_call_edit_001",
    name: "Edit",
    input: {
      path: "src/settings.js",
      old_string: "export const pageSize = 10;",
      new_string: "export const pageSize = 20;",
    },
  });

  store.appendAssistantMessage(sessionId, "已把 pageSize 从 10 改成 20。");

  const finalText = await readFile(path.join(workspaceRoot, "src/settings.js"), "utf8");

  return {
    workspaceRoot,
    sessionId,
    finalText,
    messages: store.listMessages(sessionId),
    state: store.getState(sessionId),
    trace: store.getTrace(sessionId),
  };
}

export function verifyDemo(result) {
  assert.match(result.finalText, /pageSize = 20/);
  assert.deepEqual(result.state.readFiles, ["src/settings.js"]);
  assert.equal(result.state.lastAction, "Edit");

  return {
    read_before_edit_completed: true,
    edit_updated_file: true,
    edit_result_entered_store: true,
    state_tracks_last_action_edit: true,
  };
}

export function makeErrorToolResult(
  toolCall,
  errorType,
  message,
  recommendedNextTool = null,
) {
  return {
    type: "tool_result",
    id: resultId(toolCall),
    tool_call_id: toolCall.id,
    name: toolCall.name,
    status: "error",
    error: {
      error_type: errorType,
      message,
      recoverable: true,
      recommended_next_tool: recommendedNextTool,
    },
  };
}

function makeDeniedToolResult(toolCall, message) {
  return {
    type: "tool_result",
    id: resultId(toolCall),
    tool_call_id: toolCall.id,
    name: toolCall.name,
    status: "denied",
    error: {
      error_type: "permission_denied",
      message,
      recoverable: true,
      recommended_next_tool: null,
    },
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
  if (!needle) {
    return 0;
  }

  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function resultId(toolCall) {
  return `tool_result_${toolCall.id}`;
}

async function main() {
  const result = await runDemo();
  console.log(
    JSON.stringify(
      {
        checks: verifyDemo(result),
        ...result,
      },
      null,
      2,
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
