import assert from "node:assert/strict";
import { exec as execCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import {
  CoreRuntime,
  CoreToolRuntime,
} from "./core-runtime.mjs";
import { createPromptPackContextEngine } from "./prompt-pack.mjs";

const exec = promisify(execCallback);

export async function createRealRepoFixtureWorkspace() {
  const root = await mkdtemp(path.join(tmpdir(), "agent-real-repo-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });

  await writeFile(
    path.join(root, "AGENTS.md"),
    [
      "# Project Rules",
      "",
      "- Do not change public API exports.",
      "- Prefer the smallest fix.",
      "- Use `npm test` for verification.",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "real-repo-fixture",
        private: true,
        type: "commonjs",
        scripts: {
          test: "node scripts/test.cjs",
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "src/pricing.cjs"),
    [
      "function applyDiscount(price, percent) {",
      "  return price - percent;",
      "}",
      "",
      "module.exports = { applyDiscount };",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "src/cart.cjs"),
    [
      "const { applyDiscount } = require('./pricing.cjs');",
      "",
      "function totalWithDiscount(items, percent) {",
      "  const total = items.reduce((sum, item) => sum + item.price, 0);",
      "  return applyDiscount(total, percent);",
      "}",
      "",
      "module.exports = { totalWithDiscount };",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "scripts/test.cjs"),
    [
      "const assert = require('node:assert/strict');",
      "const { applyDiscount } = require('../src/pricing.cjs');",
      "const { totalWithDiscount } = require('../src/cart.cjs');",
      "assert.equal(applyDiscount(200, 10), 180);",
      "assert.equal(totalWithDiscount([{ price: 100 }, { price: 100 }], 25), 150);",
      "console.log('pricing tests passed');",
      "",
    ].join("\n"),
    "utf8",
  );

  await exec("git init", { cwd: root });
  await exec("git add .", { cwd: root });
  await exec('git -c user.email=core@example.invalid -c user.name="Core" commit -m init', {
    cwd: root,
  });

  return root;
}

export class RealRepoTaskModel {
  constructor() {
    this.requests = [];
    this.externalChangeApplied = false;
    this.didGitStatus = false;
    this.didReadRules = false;
    this.didReadPackage = false;
    this.didSearchDiscount = false;
    this.didReadPricing = false;
    this.didFirstEdit = false;
    this.didRereadAfterStale = false;
    this.didSecondEdit = false;
    this.didNpmTest = false;
  }

  async next(request) {
    this.requests.push(cloneJson(request));
    const messages = request.messages;
    const bashResults = toolResults(messages, "Bash");
    const searchResults = toolResults(messages, "Search");
    const readResults = toolResults(messages, "Read");
    const editResults = toolResults(messages, "Edit");
    const lastEdit = latestToolResult(messages, "Edit");
    const lastBash = latestToolResult(messages, "Bash");

    if (!this.didGitStatus) {
      this.didGitStatus = true;
      return toolCall("core09_git_status_001", "Bash", {
        command: "git status --short",
      });
    }

    if (!this.didReadRules) {
      this.didReadRules = true;
      return toolCall("core09_read_rules_001", "Read", {
        path: "AGENTS.md",
      });
    }

    if (!this.didReadPackage) {
      this.didReadPackage = true;
      return toolCall("core09_read_package_001", "Read", {
        path: "package.json",
      });
    }

    if (!this.didSearchDiscount) {
      this.didSearchDiscount = true;
      return toolCall("core09_search_discount_001", "Search", {
        query: "applyDiscount",
      });
    }

    if (!this.didReadPricing) {
      this.didReadPricing = true;
      return toolCall("core09_read_pricing_001", "Read", {
        path: "src/pricing.cjs",
      });
    }

    if (!this.didFirstEdit) {
      this.didFirstEdit = true;
      await this.#simulateUserChange(request.workspaceRoot);
      return toolCall("core09_edit_stale_001", "Edit", {
        path: "src/pricing.cjs",
        old_string: "  return price - percent;",
        new_string: "  return price * (1 - percent / 100);",
      });
    }

    if (lastEdit?.error?.error_type === "stale_file" && !this.didRereadAfterStale) {
      this.didRereadAfterStale = true;
      return toolCall("core09_reread_after_stale_001", "Read", {
        path: "src/pricing.cjs",
      });
    }

    if (!this.didSecondEdit) {
      this.didSecondEdit = true;
      return toolCall("core09_edit_after_reread_001", "Edit", {
        path: "src/pricing.cjs",
        old_string: "  return price - percent;",
        new_string: "  return price * (1 - percent / 100);",
      });
    }

    if (!this.didNpmTest) {
      this.didNpmTest = true;
      return toolCall("core09_npm_test_001", "Bash", {
        command: "npm test",
      });
    }

    if (lastBash?.content?.command === "npm test" && lastBash.content.exitCode === 0) {
      return {
        type: "final_answer",
        content:
          "已按项目规则修复折扣计算，保留公开 API，并通过 npm test 验证。",
      };
    }

    return {
      type: "final_answer",
      content: "真实仓库任务未完成，需要继续查看测试输出。",
    };
  }

  async #simulateUserChange(workspaceRoot) {
    if (this.externalChangeApplied) return;
    this.externalChangeApplied = true;
    await writeFile(
      path.join(workspaceRoot, "src/pricing.cjs"),
      [
        "function applyDiscount(price, percent) {",
        "  return price - percent;",
        "}",
        "",
        "// user note: keep applyDiscount export stable",
        "module.exports = { applyDiscount };",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

export async function runRealRepoTaskDemo() {
  const workspaceRoot = await createRealRepoFixtureWorkspace();
  const model = new RealRepoTaskModel();
  const runtime = new CoreRuntime({
    workspaceRoot,
    model,
    tools: new CoreToolRuntime({
      workspaceRoot,
      allowedCommands: ["git status --short", "npm test"],
    }),
    contextEngine: createPromptPackContextEngine({ budget: 8000 }),
    maxTurns: 12,
  });
  const result = await runtime.run(
    "修复折扣计算错误，遵守项目规则，找到并运行正确测试。",
  );
  const finalText = await readFile(path.join(workspaceRoot, "src/pricing.cjs"), "utf8");

  return {
    checks: verifyRealRepoTaskResult(result, finalText, model.requests),
    modelRequests: model.requests,
    finalText,
    ...result,
  };
}

export function verifyRealRepoTaskResult(result, finalText, modelRequests) {
  const toolResultsList = result.messages.filter(
    (message) => message.type === "tool_result",
  );
  const bashCommands = toolResultsList
    .filter((message) => message.name === "Bash")
    .map((message) => message.content?.command);
  const readFiles = toolResultsList
    .filter((message) => message.name === "Read" && message.status === "success")
    .map((message) => message.content.path);
  const search = toolResultsList.find(
    (message) => message.name === "Search" && message.content.query === "applyDiscount",
  );
  const staleEdit = toolResultsList.find(
    (message) => message.name === "Edit" && message.error?.error_type === "stale_file",
  );
  const successfulEdit = toolResultsList.find(
    (message) => message.name === "Edit" && message.status === "success",
  );

  assert.deepEqual(bashCommands, ["git status --short", "npm test"]);
  assert.equal(readFiles.includes("AGENTS.md"), true);
  assert.equal(readFiles.includes("package.json"), true);
  assert.equal(readFiles.includes("src/pricing.cjs"), true);
  assert.equal(search.content.matches.length >= 2, true);
  assert.equal(Boolean(staleEdit), true);
  assert.equal(Boolean(successfulEdit), true);
  assert.match(finalText, /price \* \(1 - percent \/ 100\)/);
  assert.match(finalText, /module\.exports = \{ applyDiscount \}/);
  assert.equal(result.coreState.verificationState.status, "passed");
  assert.equal(result.coreState.verificationState.command, "npm test");
  assert.match(result.coreState.finalAnswer, /npm test/);
  assert.equal(
    JSON.stringify(modelRequests).includes("user note: keep applyDiscount export stable"),
    true,
  );

  return {
    git_status_observed: true,
    project_rules_read: true,
    test_command_discovered: true,
    multi_file_search_observed: true,
    stale_edit_recovered: true,
    public_api_preserved: true,
    verification_passed: true,
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runRealRepoTaskDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
