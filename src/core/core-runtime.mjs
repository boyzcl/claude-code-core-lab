import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { exec as execCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { MessageStore } from "../lab02/message-store.mjs";
import { CoreContextEngine } from "./context-engine.mjs";
import { applyCompactionToCoreState } from "./compaction.mjs";

const exec = promisify(execCallback);

export const CORE_TOOL_SCHEMAS = [
  {
    name: "Search",
    description: "Search text files in the current workspace.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
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
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "Edit",
    description: "Replace one unique string in a previously read file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: { type: "string" },
        new_string: { type: "string" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "Bash",
    description: "Run an allowlisted verification command.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string" },
      },
      required: ["command"],
    },
  },
];

export class CoreRuntime {
  constructor({
    workspaceRoot,
    model = new ScriptedFixModel(),
    tools = new CoreToolRuntime({ workspaceRoot }),
    contextEngine = new CoreContextEngine(),
    compactor = null,
    planController = null,
    autoApprovePlan = false,
    stopAfterPassedVerification = false,
    maxTurns = 8,
  }) {
    this.workspaceRoot = workspaceRoot;
    this.model = model;
    this.tools = tools;
    this.contextEngine = contextEngine;
    this.compactor = compactor;
    this.planController = planController;
    this.autoApprovePlan = autoApprovePlan;
    this.stopAfterPassedVerification = stopAfterPassedVerification;
    this.maxTurns = maxTurns;
    this.store = new MessageStore();
    this.sessionId = this.store.createSession({
      workspaceRoot,
      mode: planController ? "plan" : "normal",
    });
    this.contextSnapshots = [];
    this.runtimeTrace = [];
    this.runtimeTraceSeq = 0;
    this.coreState = {
      mode: planController ? "plan" : "normal",
      activePlan: null,
      planEvents: [],
      compactSummary: null,
      compactionArtifacts: [],
      compaction: null,
      modifiedFiles: [],
      verificationState: null,
      finalAnswer: null,
    };
    this.#recordRuntimeTrace("runtime.session_created", {
      sessionId: this.sessionId,
      mode: this.coreState.mode,
    });
  }

  async run(userText) {
    this.store.appendUserMessage(this.sessionId, userText);
    this.#recordRuntimeTrace("runtime.started", {
      userMessageLength: userText.length,
    });

    for (let turn = 1; turn <= this.maxTurns; turn += 1) {
      const request = this.#buildModelRequest(turn);
      const output = await this.model.next(request);
      this.#recordModelOutput(turn, output);

      if (output.type === "plan") {
        this.#handlePlanOutput(output.plan);
        continue;
      }

      if (output.type === "final_answer") {
        this.store.appendAssistantMessage(this.sessionId, output.content);
        this.coreState.finalAnswer = output.content;
        this.#recordRuntimeTrace("runtime.finished", {
          turn,
          finalAnswerLength: output.content.length,
          verificationStatus: this.coreState.verificationState?.status ?? null,
        });
        return this.#result();
      }

      if (
        this.stopAfterPassedVerification &&
        this.coreState.verificationState?.status === "passed"
      ) {
        const content = `已完成修改，并通过 ${this.coreState.verificationState.command} 验证。`;
        this.store.appendAssistantMessage(this.sessionId, content);
        this.coreState.finalAnswer = content;
        this.#recordRuntimeTrace("runtime.finished", {
          turn,
          finalAnswerLength: content.length,
          verificationStatus: this.coreState.verificationState.status,
          reason: "passed_verification_guard",
        });
        return this.#result();
      }

      this.store.appendAssistantToolCall(this.sessionId, output.toolCall);
      const planDecision = this.#authorizePlanTool(output.toolCall);
      this.#recordRuntimeTrace("tool.authorized", {
        turn,
        toolName: output.toolCall.name,
        allowed: planDecision.allowed,
        reason: planDecision.reason,
      });
      const result = planDecision.allowed
        ? await this.tools.execute(output.toolCall)
        : planDeniedResult(output.toolCall, planDecision.reason);
      this.store.appendToolResult(this.sessionId, result);
      this.#applyCoreState(result);
      this.#recordRuntimeTrace("tool.result", {
        turn,
        toolName: result.name,
        status: result.status,
        errorType: result.error?.error_type ?? null,
        exitCode: result.content?.exitCode ?? null,
      });
    }

    this.#recordRuntimeTrace("runtime.max_turns_exceeded", {
      maxTurns: this.maxTurns,
    });
    throw new Error("CoreRuntime exceeded max turns.");
  }

  #buildModelRequest(turn) {
    let messages = this.store.buildModelMessageStream(this.sessionId);
    let compactionEvent = null;
    if (this.compactor?.shouldCompact({ messages, coreState: this.coreState })) {
      const compacted = this.compactor.compact({
        messages,
        coreState: this.coreState,
      });
      applyCompactionToCoreState(this.coreState, compacted);
      messages = compacted.newerMessages;
      compactionEvent = {
        compactedMessageCount: compacted.compactedMessageCount,
        newerMessageCount: compacted.newerMessages.length,
        artifactCount: compacted.artifacts.length,
      };
      this.#recordRuntimeTrace("context.compacted", {
        turn,
        ...compactionEvent,
      });
    }
    const state = this.store.getState(this.sessionId);
    const context = this.contextEngine.build({
      sessionId: this.sessionId,
      workspaceRoot: this.workspaceRoot,
      turn,
      storeState: state,
      coreState: this.coreState,
      messages,
    });
    this.contextSnapshots.push({
      turn,
      blocks: context.blocks,
      artifacts: context.artifacts,
      tokenEstimate: context.tokenEstimate,
      selectedMessageIds: context.selectedMessages.map((message) => message.id),
    });
    this.#recordRuntimeTrace("context.built", {
      turn,
      blockNames: context.blocks.map((block) => block.name),
      artifactCount: context.artifacts.length,
      selectedMessageCount: context.selectedMessages.length,
      tokenEstimate: context.tokenEstimate,
      compacted: Boolean(compactionEvent),
    });

    return {
      sessionId: this.sessionId,
      workspaceRoot: this.workspaceRoot,
      turn,
      context,
      messages: context.messages,
      tools: CORE_TOOL_SCHEMAS,
    };
  }

  #applyCoreState(result) {
    if (result.status !== "success") {
      if (result.name === "Bash") {
        this.coreState.verificationState = {
          status: "failed",
          command: result.content?.command,
          exitCode: result.content?.exitCode,
          stderr: result.content?.stderr,
        };
      }
      return;
    }

    if (result.name === "Edit") {
      this.coreState.modifiedFiles.push(result.content.path);
    }

    if (result.name === "Bash") {
      this.coreState.verificationState = {
        status: result.content.exitCode === 0 ? "passed" : "failed",
        command: result.content.command,
        exitCode: result.content.exitCode,
        stdout: result.content.stdout,
        stderr: result.content.stderr,
      };
    }
  }

  #handlePlanOutput(plan) {
    if (!this.planController) {
      this.store.appendAssistantMessage(
        this.sessionId,
        "Plan was produced, but plan mode is not enabled.",
      );
      return;
    }

    const proposed = this.planController.proposePlan(plan);
    this.coreState.planEvents.push(proposed);
    this.#recordRuntimeTrace("plan.proposed", {
      planId: plan.id,
      status: proposed.status,
      errors: proposed.errors ?? [],
    });

    if (proposed.status !== "proposed") {
      this.store.appendAssistantMessage(
        this.sessionId,
        `Plan invalid: ${proposed.errors.join(", ")}`,
      );
      return;
    }

    this.store.appendAssistantMessage(
      this.sessionId,
      `Plan proposed: ${plan.objective}`,
    );

    if (this.autoApprovePlan) {
      const approval = this.planController.approvePlan(plan.id);
      this.coreState.planEvents.push(approval);
      this.#recordRuntimeTrace("plan.approved", {
        planId: plan.id,
        status: approval.status,
      });
      if (approval.status === "approved") {
        this.coreState.activePlan = approval.activePlan;
        this.coreState.mode = "execute";
        this.store.appendAssistantMessage(
          this.sessionId,
          `Plan approved: ${plan.id}`,
        );
      }
    }
  }

  #authorizePlanTool(toolCall) {
    if (!this.planController) {
      return {
        allowed: true,
        reason: "Plan mode is not enabled.",
      };
    }

    return this.planController.authorizeTool(toolCall);
  }

  #result() {
    return {
      sessionId: this.sessionId,
      workspaceRoot: this.workspaceRoot,
      messages: this.store.listMessages(this.sessionId),
      storeState: this.store.getState(this.sessionId),
      coreState: this.coreState,
      contextSnapshots: this.contextSnapshots,
      trace: this.store.getTrace(this.sessionId),
      runtimeTrace: this.runtimeTrace,
    };
  }

  #recordModelOutput(turn, output) {
    this.#recordRuntimeTrace("model.output", {
      turn,
      outputType: output.type,
      toolName: output.toolCall?.name ?? null,
      planId: output.plan?.id ?? null,
    });
  }

  #recordRuntimeTrace(event, payload = {}) {
    this.runtimeTrace.push({
      seq: ++this.runtimeTraceSeq,
      event,
      ...cloneJson(payload),
    });
  }
}

export class ScriptedFixModel {
  next(request) {
    const messages = request.messages;
    const search = latestToolResult(messages, "Search");
    const read = latestToolResult(messages, "Read");
    const edit = latestToolResult(messages, "Edit");
    const bash = latestToolResult(messages, "Bash");

    if (!search) {
      return toolCall("tool_call_search_001", "Search", {
        query: "pageSize + 1",
      });
    }

    if (!read) {
      const firstMatch = search.content.matches[0];
      return toolCall("tool_call_read_001", "Read", {
        path: firstMatch.path,
      });
    }

    if (!edit) {
      if (!read.content.text.includes("start + pageSize + 1")) {
        return {
          type: "final_answer",
          content: "未找到预期的 off-by-one 代码，停止修改。",
        };
      }

      return toolCall("tool_call_edit_001", "Edit", {
        path: read.content.path,
        old_string: "start + pageSize + 1",
        new_string: "start + pageSize",
      });
    }

    if (!bash) {
      return toolCall("tool_call_bash_001", "Bash", {
        command: "node scripts/test.cjs",
      });
    }

    if (bash.status === "success" && bash.content.exitCode === 0) {
      return {
        type: "final_answer",
        content:
          "已修复分页 off-by-one 问题，修改 src/pagination.cjs，并通过 node scripts/test.cjs 验证。",
      };
    }

    return {
      type: "final_answer",
      content: "已尝试修复，但验证失败，需要继续查看测试输出。",
    };
  }
}

export class CoreToolRuntime {
  constructor({ workspaceRoot, allowedCommands = ["node scripts/test.cjs"] }) {
    this.workspaceRoot = workspaceRoot;
    this.allowedCommands = new Set(allowedCommands);
    this.snapshots = new Map();
  }

  async execute(toolCall) {
    const decision = this.authorize(toolCall);
    if (!decision.allowed) {
      return denied(toolCall, decision.reason);
    }

    try {
      if (toolCall.name === "Search") return await this.#search(toolCall);
      if (toolCall.name === "Read") return await this.#read(toolCall);
      if (toolCall.name === "Edit") return await this.#edit(toolCall);
      if (toolCall.name === "Bash") return await this.#bash(toolCall);
      return errorResult(toolCall, "unknown_tool", `Unknown tool ${toolCall.name}.`);
    } catch (error) {
      return errorResult(
        toolCall,
        error.code ?? "tool_execution_error",
        error.message,
      );
    }
  }

  authorize(toolCall) {
    if (!["Search", "Read", "Edit", "Bash"].includes(toolCall.name)) {
      return {
        allowed: false,
        reason: `Tool ${toolCall.name} is not registered.`,
      };
    }

    if (toolCall.name === "Bash") {
      const command = toolCall.input?.command;
      return this.allowedCommands.has(command)
        ? { allowed: true, reason: "Command is allowlisted." }
        : { allowed: false, reason: `Command is not allowlisted: ${command}` };
    }

    if (toolCall.name === "Search") {
      return toolCall.input?.query
        ? { allowed: true, reason: "Search query is valid." }
        : { allowed: false, reason: "Search query is required." };
    }

    const resolved = resolveWorkspacePath(this.workspaceRoot, toolCall.input?.path);
    return resolved.ok
      ? { allowed: true, reason: "Path is inside workspace." }
      : { allowed: false, reason: resolved.reason };
  }

  async #search(toolCall) {
    const files = await listFiles(this.workspaceRoot);
    const matches = [];

    for (const absolutePath of files) {
      const text = await readFile(absolutePath, "utf8");
      const rel = path.relative(this.workspaceRoot, absolutePath);
      text.split(/\r?\n/).forEach((line, index) => {
        if (line.includes(toolCall.input.query)) {
          matches.push({
            path: rel,
            lineNumber: index + 1,
            line: line.trim(),
          });
        }
      });
    }

    return success(toolCall, "Search", {
      query: toolCall.input.query,
      matches,
    });
  }

  async #read(toolCall) {
    const resolved = resolveWorkspacePath(this.workspaceRoot, toolCall.input.path);
    const text = await readFile(resolved.absolutePath, "utf8");
    const digest = hash(text);
    this.snapshots.set(toolCall.input.path, {
      text,
      hash: digest,
    });

    return success(toolCall, "Read", {
      path: toolCall.input.path,
      text,
      hash: digest,
    });
  }

  async #edit(toolCall) {
    const { path: targetPath, old_string: oldString, new_string: newString } =
      toolCall.input;
    const snapshot = this.snapshots.get(targetPath);

    if (!snapshot) {
      return errorResult(
        toolCall,
        "file_not_read",
        "File must be read before editing.",
        "Read",
      );
    }

    const resolved = resolveWorkspacePath(this.workspaceRoot, targetPath);
    const currentText = await readFile(resolved.absolutePath, "utf8");
    if (hash(currentText) !== snapshot.hash) {
      return errorResult(
        toolCall,
        "stale_file",
        "File changed after it was read.",
        "Read",
      );
    }

    const matches = countOccurrences(currentText, oldString);
    if (matches !== 1) {
      return errorResult(
        toolCall,
        matches === 0 ? "old_string_not_found" : "old_string_not_unique",
        `Expected exactly one old_string match, got ${matches}.`,
        "Read",
      );
    }

    const nextText = currentText.replace(oldString, newString);
    await writeFile(resolved.absolutePath, nextText, "utf8");
    this.snapshots.set(targetPath, {
      text: nextText,
      hash: hash(nextText),
    });

    return success(toolCall, "Edit", {
      path: targetPath,
      replacements: 1,
    });
  }

  async #bash(toolCall) {
    const command = toolCall.input.command;

    try {
      const { stdout, stderr } = await exec(command, {
        cwd: this.workspaceRoot,
        timeout: 3000,
      });
      return success(toolCall, "Bash", {
        command,
        exitCode: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    } catch (error) {
      return {
        type: "tool_result",
        id: resultId(toolCall),
        tool_call_id: toolCall.id,
        name: "Bash",
        status: "error",
        content: {
          command,
          exitCode: typeof error.code === "number" ? error.code : 1,
          stdout: (error.stdout ?? "").trim(),
          stderr: (error.stderr ?? error.message).trim(),
        },
      };
    }
  }
}

export async function createCoreToyWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "agent-core-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });

  await writeFile(
    path.join(root, "src", "pagination.cjs"),
    [
      "function paginate(items, page, pageSize) {",
      "  const start = (page - 1) * pageSize;",
      "  return items.slice(start, start + pageSize + 1);",
      "}",
      "",
      "module.exports = { paginate };",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "scripts", "test.cjs"),
    [
      "const assert = require('node:assert/strict');",
      "const { paginate } = require('../src/pagination.cjs');",
      "assert.deepEqual(paginate([1, 2, 3, 4, 5], 1, 2), [1, 2]);",
      "assert.deepEqual(paginate([1, 2, 3, 4, 5], 2, 2), [3, 4]);",
      "console.log('pagination tests passed');",
      "",
    ].join("\n"),
    "utf8",
  );

  return root;
}

export async function runCoreDemo() {
  const workspaceRoot = await createCoreToyWorkspace();
  const runtime = new CoreRuntime({ workspaceRoot });
  const result = await runtime.run("修复分页多返回一个元素的问题，并运行测试。");
  const finalText = await readFile(path.join(workspaceRoot, "src/pagination.cjs"), "utf8");

  return {
    checks: verifyCoreResult(result, finalText),
    finalText,
    ...result,
  };
}

export function verifyCoreResult(result, finalText) {
  const toolNames = result.messages
    .filter((message) => message.type === "tool_result")
    .map((message) => message.name);

  assert.deepEqual(toolNames, ["Search", "Read", "Edit", "Bash"]);
  assert.match(finalText, /start \+ pageSize\)/);
  assert.doesNotMatch(finalText, /pageSize \+ 1/);
  assert.deepEqual(result.coreState.modifiedFiles, ["src/pagination.cjs"]);
  assert.equal(result.coreState.verificationState.status, "passed");
  assert.match(result.coreState.finalAnswer, /已修复分页/);

  return {
    full_tool_chain_executed: true,
    file_was_edited: true,
    verification_passed: true,
    final_answer_grounded_in_state: true,
  };
}

function toolCall(id, name, input) {
  return {
    type: "tool_call",
    toolCall: {
      id,
      name,
      input,
    },
  };
}

function latestToolResult(messages, name) {
  return [...messages]
    .reverse()
    .find((message) => message.type === "tool_result" && message.name === name);
}

function success(toolCall, name, content) {
  return {
    type: "tool_result",
    id: resultId(toolCall),
    tool_call_id: toolCall.id,
    name,
    status: "success",
    content,
  };
}

function denied(toolCall, message) {
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

function planDeniedResult(toolCall, message) {
  return {
    type: "tool_result",
    id: resultId(toolCall),
    tool_call_id: toolCall.id,
    name: toolCall.name,
    status: "denied",
    error: {
      error_type: "plan_mode_denied",
      message,
      recoverable: true,
      recommended_next_tool: "Plan",
    },
  };
}

function errorResult(toolCall, errorType, message, recommendedNextTool = null) {
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

function resolveWorkspacePath(workspaceRoot, relativePath) {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    return { ok: false, reason: "Path is required." };
  }

  if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
    return {
      ok: false,
      reason: `Path escapes workspace: ${relativePath}`,
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

async function listFiles(root) {
  const files = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }

  await walk(root);
  return files;
}

function countOccurrences(text, needle) {
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

function hash(text) {
  return createHash("sha256").update(text).digest("hex");
}

function resultId(toolCall) {
  return `tool_result_${toolCall.id}`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runCoreDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
