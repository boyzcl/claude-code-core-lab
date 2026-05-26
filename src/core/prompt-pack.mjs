import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CoreRuntime,
  createCoreToyWorkspace,
} from "./core-runtime.mjs";
import { CoreContextEngine } from "./context-engine.mjs";

export const CORE_PROMPT_PACK = {
  identity: [
    "You are a local coding agent.",
    "You propose one tool call at a time and wait for local tool results.",
  ],
  toolOrder: [
    "Use Search to locate likely code before reading files.",
    "Use Read before Edit.",
    "Use Edit only for narrow, exact replacements.",
    "Use Bash only for allowlisted verification commands.",
    "Give a final answer only after verification passes.",
  ],
  recovery: [
    "If Edit returns file_not_read, call Read for that file before editing again.",
    "If Bash is denied, inspect the denial and retry with an allowlisted command.",
    "If verification fails, use the failure output as the next observation.",
    "Do not pretend a denied or failed tool succeeded.",
  ],
  boundaries: [
    "Prompt guidance is not a permission system.",
    "Local ToolRuntime and Policy enforce file and command safety.",
    "MessageStore is the source of truth for tool calls and tool results.",
  ],
};

export function buildPromptPackSystemPrompt(promptPack = CORE_PROMPT_PACK) {
  return [
    "# Identity",
    ...promptPack.identity,
    "",
    "# Tool Order",
    ...promptPack.toolOrder,
    "",
    "# Recovery",
    ...promptPack.recovery,
    "",
    "# Boundaries",
    ...promptPack.boundaries,
  ].join("\n");
}

export function createPromptPackContextEngine({
  promptPack = CORE_PROMPT_PACK,
  budget = 6000,
} = {}) {
  return new CoreContextEngine({
    budget,
    systemPrompt: buildPromptPackSystemPrompt(promptPack),
  });
}

export class PromptPackRecoveryModel {
  constructor() {
    this.requests = [];
    this.triedUnsafeBash = false;
  }

  next(request) {
    this.requests.push(cloneJson(request));
    const messages = request.messages;
    const editResults = toolResults(messages, "Edit");
    const bashResults = toolResults(messages, "Bash");
    const search = latestToolResult(messages, "Search");
    const read = latestToolResult(messages, "Read");
    const edit = latestToolResult(messages, "Edit");
    const bash = latestToolResult(messages, "Bash");

    if (!editResults.length) {
      return toolCall("core08_edit_before_read_001", "Edit", {
        path: "src/pagination.cjs",
        old_string: "start + pageSize + 1",
        new_string: "start + pageSize",
      });
    }

    if (edit?.error?.error_type === "file_not_read" && !search) {
      return toolCall("core08_search_after_denial_001", "Search", {
        query: "pageSize + 1",
      });
    }

    if (!read) {
      return toolCall("core08_read_after_search_001", "Read", {
        path: search.content.matches[0].path,
      });
    }

    if (!editResults.some((result) => result.status === "success")) {
      return toolCall("core08_edit_after_read_001", "Edit", {
        path: read.content.path,
        old_string: "start + pageSize + 1",
        new_string: "start + pageSize",
      });
    }

    if (!bashResults.length) {
      if (this.triedUnsafeBash) {
        return toolCall("core08_bash_recovery_001", "Bash", {
          command: "node scripts/test.cjs",
        });
      }

      this.triedUnsafeBash = true;
      return toolCall("core08_bash_denied_001", "Bash", {
        command: `cd ${request.workspaceRoot} && node scripts/test.cjs`,
      });
    }

    if (bash?.status === "denied") {
      return toolCall("core08_bash_recovery_001", "Bash", {
        command: "node scripts/test.cjs",
      });
    }

    if (bash?.status === "success" && bash.content.exitCode === 0) {
      return {
        type: "final_answer",
        content:
          "已修复分页 off-by-one 问题，并通过 node scripts/test.cjs 验证。",
      };
    }

    return {
      type: "final_answer",
      content: "验证未通过，需要继续恢复。",
    };
  }
}

export class PromptIgnoringUnsafeModel {
  next() {
    return toolCall("core08_unsafe_bash_001", "Bash", {
      command: "rm -rf .",
    });
  }
}

export async function runPromptPackRecoveryDemo() {
  const workspaceRoot = await createCoreToyWorkspace();
  const model = new PromptPackRecoveryModel();
  const runtime = new CoreRuntime({
    workspaceRoot,
    model,
    contextEngine: createPromptPackContextEngine(),
    maxTurns: 10,
  });
  const result = await runtime.run("修复分页多返回一个元素的问题，并运行测试。");
  const finalText = await readFile(path.join(workspaceRoot, "src/pagination.cjs"), "utf8");

  return {
    checks: verifyPromptPackRecoveryResult(result, finalText, model.requests),
    modelRequests: model.requests,
    finalText,
    ...result,
  };
}

export function verifyPromptPackRecoveryResult(result, finalText, modelRequests) {
  const toolResultsList = result.messages.filter(
    (message) => message.type === "tool_result",
  );
  const toolSequence = toolResultsList.map((message) => message.name);
  const firstSystemPrompt = modelRequests[0].messages[0].content;

  assert.match(firstSystemPrompt, /Use Read before Edit/);
  assert.match(firstSystemPrompt, /If Edit returns file_not_read/);
  assert.equal(includesSubsequence(toolSequence, ["Search", "Read", "Edit", "Bash"]), true);
  assert.equal(toolResultsList[0].name, "Edit");
  assert.equal(toolResultsList[0].error.error_type, "file_not_read");
  assert.equal(
    toolResultsList.some(
      (resultItem) =>
        resultItem.name === "Bash" &&
        resultItem.status === "denied" &&
        resultItem.error.error_type === "permission_denied",
    ),
    true,
  );
  assert.match(finalText, /start \+ pageSize\)/);
  assert.doesNotMatch(finalText, /start \+ pageSize \+ 1/);
  assert.deepEqual(result.coreState.modifiedFiles, ["src/pagination.cjs"]);
  assert.equal(result.coreState.verificationState.status, "passed");
  assert.match(result.coreState.finalAnswer, /通过/);

  return {
    full_tool_chain_recovered: true,
    file_was_edited: true,
    verification_passed: true,
    final_answer_grounded_in_state: true,
    prompt_pack_entered_model_request: true,
    edit_denial_recovered: true,
    bash_denial_recovered: true,
    policy_still_enforced: true,
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

function toolResults(messages, name) {
  return messages.filter(
    (message) => message.type === "tool_result" && message.name === name,
  );
}

function includesSubsequence(items, expected) {
  let cursor = 0;
  for (const item of items) {
    if (item === expected[cursor]) {
      cursor += 1;
      if (cursor === expected.length) return true;
    }
  }
  return false;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runPromptPackRecoveryDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
