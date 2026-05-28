import assert from "node:assert/strict";
import { exec as execCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { MessageStore } from "../lab02/message-store.mjs";

const exec = promisify(execCallback);

export const TOOL_SCHEMAS = [
  {
    name: "Search",
    description: "Search text files in the current workspace.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "Read",
    description: "Read a text file from the current workspace.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "Bash",
    description: "Run an allowlisted shell command in the current workspace.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
        },
      },
      required: ["command"],
    },
  },
];

export class ToolRuntime {
  constructor({
    workspaceRoot,
    allowedCommands = ["node scripts/check.js", "node scripts/fail.js"],
  }) {
    this.workspaceRoot = workspaceRoot;
    this.allowedCommands = new Set(allowedCommands);
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

      if (toolCall.name === "Search") {
        return await this.#search(toolCall);
      }

      if (toolCall.name === "Bash") {
        return await this.#bash(toolCall);
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
    if (!["Read", "Search", "Bash"].includes(toolCall.name)) {
      return {
        allowed: false,
        reason: `Tool ${toolCall.name} is not registered in lab-03.`,
      };
    }

    if (toolCall.name === "Read") {
      const result = resolveWorkspacePath(this.workspaceRoot, toolCall.input?.path);
      return result.ok
        ? { allowed: true, reason: "Read path is inside workspace." }
        : { allowed: false, reason: result.reason };
    }

    if (toolCall.name === "Search") {
      const query = toolCall.input?.query;
      if (typeof query !== "string" || query.trim() === "") {
        return {
          allowed: false,
          reason: "Search query must be a non-empty string.",
        };
      }

      return {
        allowed: true,
        reason: "Search query is valid.",
      };
    }

    const command = toolCall.input?.command;
    if (!this.allowedCommands.has(command)) {
      return {
        allowed: false,
        reason: `Command is not allowlisted in lab-03: ${command}`,
      };
    }

    return {
      allowed: true,
      reason: "Bash command is allowlisted.",
    };
  }

  async #read(toolCall) {
    const resolved = resolveWorkspacePath(this.workspaceRoot, toolCall.input.path);
    if (!resolved.ok) {
      return makeDeniedToolResult(toolCall, resolved.reason);
    }

    const text = await readFile(resolved.absolutePath, "utf8");

    return {
      type: "tool_result",
      id: resultId(toolCall),
      tool_call_id: toolCall.id,
      name: "Read",
      status: "success",
      content: {
        path: toolCall.input.path,
        text,
      },
      metadata: {
        bytes: Buffer.byteLength(text),
      },
    };
  }

  async #search(toolCall) {
    const query = toolCall.input.query;
    const files = await listWorkspaceFiles(this.workspaceRoot);
    const matches = [];

    for (const absolutePath of files) {
      const text = await readFile(absolutePath, "utf8");
      const relPath = path.relative(this.workspaceRoot, absolutePath);
      const lines = text.split(/\r?\n/);

      lines.forEach((line, index) => {
        if (line.includes(query)) {
          matches.push({
            path: relPath,
            lineNumber: index + 1,
            line: line.trim(),
          });
        }
      });
    }

    return {
      type: "tool_result",
      id: resultId(toolCall),
      tool_call_id: toolCall.id,
      name: "Search",
      status: "success",
      content: {
        query,
        matches,
      },
      metadata: {
        matchCount: matches.length,
      },
    };
  }

  async #bash(toolCall) {
    const command = toolCall.input.command;

    try {
      const { stdout, stderr } = await exec(command, {
        cwd: this.workspaceRoot,
        timeout: 3000,
        maxBuffer: 1024 * 1024,
      });

      return bashResult(toolCall, command, 0, stdout, stderr, "success");
    } catch (error) {
      return bashResult(
        toolCall,
        command,
        typeof error.code === "number" ? error.code : 1,
        error.stdout ?? "",
        error.stderr ?? error.message,
        "error",
      );
    }
  }
}

export async function createToyWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "agent-lab03-"));

  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });

  await writeFile(
    path.join(root, "README.md"),
    "# Toy Tool Runtime\n\nThis workspace is created by lab-03.\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "src", "pagination.js"),
    [
      "export function paginate(items, page, pageSize) {",
      "  const start = (page - 1) * pageSize;",
      "  return items.slice(start, start + pageSize);",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "scripts", "check.js"),
    [
      "const items = [1, 2, 3, 4, 5];",
      "const pageSize = 2;",
      "const page = 2;",
      "const start = (page - 1) * pageSize;",
      "const result = items.slice(start, start + pageSize);",
      "if (JSON.stringify(result) !== JSON.stringify([3, 4])) {",
      "  console.error('pagination check failed');",
      "  process.exit(1);",
      "}",
      "console.log('pagination check passed');",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "scripts", "fail.js"),
    "console.error('intentional failure');\nprocess.exit(2);\n",
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
  const workspaceRoot = await createToyWorkspace();
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  const runtime = new ToolRuntime({ workspaceRoot });

  store.appendUserMessage(
    sessionId,
    "请搜索 paginate 相关代码，读取实现，并运行检查。",
  );

  await runTool(store, sessionId, runtime, {
    id: "tool_call_search_001",
    name: "Search",
    input: {
      query: "paginate",
    },
  });

  await runTool(store, sessionId, runtime, {
    id: "tool_call_read_001",
    name: "Read",
    input: {
      path: "src/pagination.js",
    },
  });

  await runTool(store, sessionId, runtime, {
    id: "tool_call_bash_001",
    name: "Bash",
    input: {
      command: "node scripts/check.js",
    },
  });

  store.appendAssistantMessage(
    sessionId,
    "已搜索 paginate，读取了 src/pagination.js，并运行检查通过。",
  );

  return {
    workspaceRoot,
    sessionId,
    messages: store.listMessages(sessionId),
    state: store.getState(sessionId),
    trace: store.getTrace(sessionId),
  };
}

export function verifyDemo(result) {
  const searchResult = findToolResult(result.messages, "Search");
  const readResult = findToolResult(result.messages, "Read");
  const bashResultMessage = findToolResult(result.messages, "Bash");

  assert.ok(searchResult.content.matches.length >= 1);
  assert.equal(searchResult.content.matches[0].path, "src/pagination.js");
  assert.match(readResult.content.text, /export function paginate/);
  assert.equal(bashResultMessage.content.exitCode, 0);
  assert.match(bashResultMessage.content.stdout, /pagination check passed/);
  assert.deepEqual(result.state.readFiles, ["src/pagination.js"]);
  assert.equal(result.state.toolResults.length, 3);
  assert.equal(result.state.lastAction, "Bash");

  return {
    search_found_real_file: true,
    read_returned_real_file_content: true,
    bash_ran_real_command: true,
    tool_results_entered_message_store: true,
    state_tracks_read_and_last_action: true,
  };
}

function findToolResult(messages, name) {
  return messages.find(
    (message) => message.type === "tool_result" && message.name === name,
  );
}

async function listWorkspaceFiles(root) {
  const files = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }

      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  await walk(root);
  return files;
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

function makeErrorToolResult(toolCall, errorType, message) {
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
      recommended_next_tool: null,
    },
  };
}

function bashResult(toolCall, command, exitCode, stdout, stderr, status) {
  return {
    type: "tool_result",
    id: resultId(toolCall),
    tool_call_id: toolCall.id,
    name: "Bash",
    status,
    content: {
      command,
      exitCode,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    },
    metadata: {
      timedOut: false,
    },
  };
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
