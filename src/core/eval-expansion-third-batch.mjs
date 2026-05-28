import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CoreRuntime,
  CoreToolRuntime,
  createCoreToyWorkspace,
} from "./core-runtime.mjs";
import {
  CORE11_SELECTED_STARTER_CASES,
  runExecutableRepoSeed,
} from "./eval-expansion.mjs";
import { CORE12_SELECTED_STARTER_CASES } from "./eval-expansion-second-batch.mjs";
import { starterReadinessCases } from "./core-readiness-package.mjs";
import {
  PromptPackRecoveryModel,
  createPromptPackContextEngine,
} from "./prompt-pack.mjs";
import {
  RealRepoTaskModel,
  createRealRepoFixtureWorkspace,
} from "./real-repo-task.mjs";

export const CORE13_SELECTED_STARTER_CASES = [
  "core10-l0-stale-file",
  "core10-l0-bash-denial",
  "core10-l0-tool-result-linkage",
  "core10-l1-recovery-after-file-not-read",
  "core10-l2-project-rules",
];

export function thirdBatchExecutableRepoSeeds() {
  const starterById = new Map(
    starterReadinessCases().map((testCase) => [testCase.id, testCase]),
  );

  return [
    seedFromStarter(starterById, {
      id: "core13-seed-l0-stale-file",
      starterCaseId: "core10-l0-stale-file",
      name: "stale file reread and edit seed",
      taskPrompt:
        "修复分页问题；如果文件在读取后被用户修改，必须重新读取后再修改。",
      requiredChecks: ["stale_file observed", "Read after stale_file", "verification passes"],
      createWorkspace: createCoreToyWorkspace,
      createRuntime: ({ workspaceRoot }) =>
        new CoreRuntime({
          workspaceRoot,
          model: new ToyStaleFileRecoveryModel(),
          maxTurns: 8,
        }),
      verifyInitialState: verifyToyPaginationBug,
      expect: {
        verificationStatus: "passed",
        modifiedFiles: ["src/pagination.cjs"],
        finalAnswerIncludes: "通过",
        files: [
          {
            path: "src/pagination.cjs",
            includes: "start + pageSize);",
            excludes: "start + pageSize + 1);",
          },
        ],
      },
      evaluate: evaluateToyStaleFileRecovery,
    }),
    seedFromStarter(starterById, {
      id: "core13-seed-l0-bash-denial",
      starterCaseId: "core10-l0-bash-denial",
      name: "bash allowlist denial seed",
      taskPrompt: "尝试运行未授权测试命令，必须被 Bash allowlist 拒绝。",
      requiredChecks: ["Bash npm test is denied", "No files modified"],
      createWorkspace: createCoreToyWorkspace,
      createRuntime: ({ workspaceRoot }) =>
        new CoreRuntime({
          workspaceRoot,
          model: new BashDenialModel(),
          tools: new CoreToolRuntime({
            workspaceRoot,
            allowedCommands: ["node scripts/test.cjs"],
          }),
          maxTurns: 3,
        }),
      verifyInitialState: verifyToyPaginationBug,
      expect: {
        toolSequence: ["Bash"],
        toolResults: [
          {
            name: "Bash",
            status: "denied",
            errorType: "permission_denied",
          },
        ],
        modifiedFiles: [],
        finalAnswerIncludes: "拒绝",
        files: [
          {
            path: "src/pagination.cjs",
            includes: "start + pageSize + 1);",
          },
        ],
      },
    }),
    seedFromStarter(starterById, {
      id: "core13-seed-l0-tool-result-linkage",
      starterCaseId: "core10-l0-tool-result-linkage",
      name: "tool result linkage seed",
      taskPrompt: "修复分页多返回一个元素的问题，并保留工具结果链路证据。",
      requiredChecks: ["Every ToolResult links to an AssistantToolCall"],
      createWorkspace: createCoreToyWorkspace,
      verifyInitialState: verifyToyPaginationBug,
      expect: {
        toolSequence: ["Search", "Read", "Edit", "Bash"],
        verificationStatus: "passed",
        modifiedFiles: ["src/pagination.cjs"],
        finalAnswerIncludes: "通过",
      },
      evaluate: evaluateToolResultLinkage,
    }),
    seedFromStarter(starterById, {
      id: "core13-seed-l1-recovery-after-file-not-read",
      starterCaseId: "core10-l1-recovery-after-file-not-read",
      name: "recovery after file_not_read seed",
      taskPrompt: "先尝试修复分页问题；如果 Edit 被拒绝，读取文件后恢复。",
      requiredChecks: ["file_not_read observed", "Read after file_not_read", "verification passes"],
      createWorkspace: createCoreToyWorkspace,
      createRuntime: ({ workspaceRoot }) =>
        new CoreRuntime({
          workspaceRoot,
          model: new PromptPackRecoveryModel(),
          contextEngine: createPromptPackContextEngine(),
          maxTurns: 10,
        }),
      verifyInitialState: verifyToyPaginationBug,
      expect: {
        verificationStatus: "passed",
        modifiedFiles: ["src/pagination.cjs"],
        finalAnswerIncludes: "通过",
      },
      evaluate: evaluateFileNotReadRecovery,
    }),
    seedFromStarter(starterById, {
      id: "core13-seed-l2-project-rules",
      starterCaseId: "core10-l2-project-rules",
      name: "project rules enter context seed",
      taskPrompt: "修复折扣计算错误，必须读取并遵守项目规则。",
      requiredChecks: ["AGENTS.md read", "Project rules visible in context", "npm test passes"],
      createWorkspace: createRealRepoFixtureWorkspace,
      createRuntime: createRealRepoRuntime,
      verifyInitialState: async (ctx) => [
        await fileIncludes(ctx, "AGENTS.md", "Use `npm test` for verification."),
        await fileIncludes(ctx, "AGENTS.md", "Do not change public API exports."),
      ],
      expect: {
        verificationStatus: "passed",
        modifiedFiles: ["src/pricing.cjs"],
        finalAnswerIncludes: "npm test",
      },
      evaluate: evaluateProjectRulesVisible,
    }),
  ];
}

export async function runEvalExpansionThirdBatchSeeds(
  seeds = thirdBatchExecutableRepoSeeds(),
) {
  const results = [];

  for (const seed of seeds) {
    results.push(await runExecutableRepoSeed(seed));
  }

  const passed = results.filter((result) => result.passed).length;
  const total = results.length;
  const cumulativeStarterCases = [
    ...CORE11_SELECTED_STARTER_CASES,
    ...CORE12_SELECTED_STARTER_CASES,
    ...seeds.map((seed) => seed.starterCaseId),
  ];

  return {
    id: "core-13-eval-expansion-third-batch",
    scoreKind: "executable_repo_seed_score",
    selectedStarterCases: seeds.map((seed) => seed.starterCaseId),
    total,
    passed,
    score: total === 0 ? 0 : passed / total,
    executableStarterCoverage: {
      starterTotal: 20,
      cumulativeCount: cumulativeStarterCases.length,
      cumulativeStarterCases,
    },
    failureTypes: failureTypeSummary(results),
    referenceAgentComparison: {
      status: "interface_ready_no_runs",
      compared: false,
      runnerContract: {
        input: ["starterCaseId", "taskPrompt", "requiredChecks"],
        output: ["score", "failureType", "cost", "latencyMs", "notes"],
      },
      runs: [],
    },
    results,
  };
}

export async function runEvalExpansionThirdBatchDemo() {
  const report = await runEvalExpansionThirdBatchSeeds(
    thirdBatchExecutableRepoSeeds(),
  );
  return {
    checks: verifyEvalExpansionThirdBatchReport(report),
    ...report,
  };
}

export function verifyEvalExpansionThirdBatchReport(report) {
  assert.equal(report.id, "core-13-eval-expansion-third-batch");
  assert.equal(report.scoreKind, "executable_repo_seed_score");
  assert.deepEqual(report.selectedStarterCases, CORE13_SELECTED_STARTER_CASES);
  assert.equal(report.total, 5);
  assert.equal(report.passed, 5);
  assert.equal(report.score, 1);
  assert.equal(report.executableStarterCoverage.starterTotal, 20);
  assert.equal(report.executableStarterCoverage.cumulativeCount, 15);
  assert.equal(report.referenceAgentComparison.status, "interface_ready_no_runs");
  assert.equal(
    report.results.every((result) => result.referenceAgent.status === "pending_run"),
    true,
  );

  return {
    third_batch_seeds_defined: true,
    cumulative_executable_starter_count: 15,
    reference_agent_interface_ready: true,
    all_third_batch_seeds_passed: true,
  };
}

class ToyStaleFileRecoveryModel {
  constructor() {
    this.step = 0;
    this.externalChangeApplied = false;
  }

  async next(request) {
    this.step += 1;
    const staleEdit = toolResults(request.messages, "Edit").find(
      (result) => result.error?.error_type === "stale_file",
    );
    const successfulEdit = toolResults(request.messages, "Edit").find(
      (result) => result.status === "success",
    );
    const latestRead = latestToolResult(request.messages, "Read");
    const latestBash = latestToolResult(request.messages, "Bash");

    if (this.step === 1) {
      return toolCall("core13_stale_read_001", "Read", {
        path: "src/pagination.cjs",
      });
    }

    if (!staleEdit && !successfulEdit) {
      await this.#simulateUserChange(request.workspaceRoot);
      return toolCall("core13_stale_edit_001", "Edit", {
        path: "src/pagination.cjs",
        old_string: "start + pageSize + 1",
        new_string: "start + pageSize",
      });
    }

    if (staleEdit && latestRead.sequence < staleEdit.sequence) {
      return toolCall("core13_stale_reread_001", "Read", {
        path: "src/pagination.cjs",
      });
    }

    if (!successfulEdit) {
      return toolCall("core13_stale_edit_after_reread_001", "Edit", {
        path: "src/pagination.cjs",
        old_string: "start + pageSize + 1",
        new_string: "start + pageSize",
      });
    }

    if (!latestBash) {
      return toolCall("core13_stale_bash_001", "Bash", {
        command: "node scripts/test.cjs",
      });
    }

    return {
      type: "final_answer",
      content: "已重新读取 stale 文件后完成修复，并通过 node scripts/test.cjs 验证。",
    };
  }

  async #simulateUserChange(workspaceRoot) {
    if (this.externalChangeApplied) return;
    this.externalChangeApplied = true;
    const filePath = path.join(workspaceRoot, "src/pagination.cjs");
    const text = await readFile(filePath, "utf8");
    await writeFile(
      filePath,
      text.replace(
        "\nmodule.exports = { paginate };\n",
        "\n// user note: keep paginate export stable\nmodule.exports = { paginate };\n",
      ),
      "utf8",
    );
  }
}

class BashDenialModel {
  constructor() {
    this.step = 0;
  }

  next() {
    this.step += 1;

    if (this.step === 1) {
      return toolCall("core13_bash_denied_001", "Bash", {
        command: "npm test",
      });
    }

    return {
      type: "final_answer",
      content: "未授权 Bash 命令已被拒绝，未修改文件。",
    };
  }
}

function createRealRepoRuntime({ workspaceRoot }) {
  return new CoreRuntime({
    workspaceRoot,
    model: new RealRepoTaskModel(),
    tools: new CoreToolRuntime({
      workspaceRoot,
      allowedCommands: ["git status --short", "npm test"],
    }),
    contextEngine: createPromptPackContextEngine({ budget: 8000 }),
    maxTurns: 12,
  });
}

async function verifyToyPaginationBug(ctx) {
  return [
    await fileIncludes(ctx, "src/pagination.cjs", "start + pageSize + 1);"),
  ];
}

async function evaluateToyStaleFileRecovery({ result, evidence, workspaceRoot }) {
  const staleEdit = evidence.toolResults.find(
    (toolResult) =>
      toolResult.name === "Edit" && toolResult.errorType === "stale_file",
  );
  const readAfterStale = evidence.toolResults.find(
    (toolResult) =>
      toolResult.name === "Read" &&
      staleEdit &&
      toolResult.sequence > staleEdit.sequence,
  );
  const finalText = await readFile(path.join(workspaceRoot, "src/pagination.cjs"), "utf8");

  return [
    assertion("stale_file_observed", Boolean(staleEdit), "stale_file_recovery_failed", {
      toolResults: evidence.toolResults,
    }),
    assertion(
      "read_after_stale_file",
      Boolean(readAfterStale),
      "stale_file_recovery_failed",
      { toolResults: evidence.toolResults },
    ),
    assertion(
      "user_change_preserved",
      finalText.includes("user note: keep paginate export stable"),
      "stale_file_recovery_failed",
      { path: "src/pagination.cjs" },
    ),
    assertion(
      "verification_after_stale_recovery",
      result.coreState.verificationState?.status === "passed",
      "verification_missing",
      { verificationState: result.coreState.verificationState },
    ),
  ];
}

async function evaluateToolResultLinkage({ result }) {
  const toolCallIds = new Map(
    result.messages
      .filter((message) => message.type === "assistant_tool_call")
      .map((message) => [message.tool_call.id, message.sequence]),
  );
  const toolResultsList = result.messages.filter(
    (message) => message.type === "tool_result",
  );
  const linked = toolResultsList.every((message) => {
    const callSequence = toolCallIds.get(message.tool_call_id);
    return callSequence && callSequence < message.sequence;
  });

  return [
    assertion("tool_results_link_to_calls", linked, "tool_protocol_error", {
      toolCallIds: [...toolCallIds.keys()],
      toolResultIds: toolResultsList.map((message) => message.tool_call_id),
    }),
  ];
}

async function evaluateFileNotReadRecovery({ evidence }) {
  const fileNotRead = evidence.toolResults.find(
    (toolResult) =>
      toolResult.name === "Edit" && toolResult.errorType === "file_not_read",
  );
  const readAfterDenial = evidence.toolResults.find(
    (toolResult) =>
      toolResult.name === "Read" &&
      fileNotRead &&
      toolResult.sequence > fileNotRead.sequence,
  );
  const successfulEditAfterRead = evidence.toolResults.find(
    (toolResult) =>
      toolResult.name === "Edit" &&
      toolResult.status === "success" &&
      readAfterDenial &&
      toolResult.sequence > readAfterDenial.sequence,
  );

  return [
    assertion("file_not_read_observed", Boolean(fileNotRead), "tool_protocol_error", {
      toolResults: evidence.toolResults,
    }),
    assertion(
      "read_after_file_not_read",
      Boolean(readAfterDenial),
      "tool_protocol_error",
      { toolResults: evidence.toolResults },
    ),
    assertion(
      "edit_after_recovery_read",
      Boolean(successfulEditAfterRead),
      "tool_protocol_error",
      { toolResults: evidence.toolResults },
    ),
  ];
}

async function evaluateProjectRulesVisible({ result, evidence }) {
  const agentsRead = evidence.toolCalls.find(
    (toolCall) => toolCall.name === "Read" && toolCall.input.path === "AGENTS.md",
  );
  const projectRulesContext = evidence.contextTurns.find((turn) =>
    turn.blockNames.includes("file:AGENTS.md"),
  );
  const agentsResult = result.messages.find(
    (message) =>
      message.type === "tool_result" &&
      message.name === "Read" &&
      message.content?.path === "AGENTS.md",
  );

  return [
    assertion("agents_md_read", Boolean(agentsRead), "context_missing", {
      toolCalls: evidence.toolCalls,
    }),
    assertion(
      "project_rules_context_block",
      Boolean(projectRulesContext),
      "context_missing",
      { contextTurns: evidence.contextTurns },
    ),
    assertion(
      "project_rules_content_visible",
      JSON.stringify(agentsResult?.content ?? {}).includes("Use `npm test` for verification."),
      "context_missing",
      { agentsResult },
    ),
  ];
}

async function fileIncludes({ workspaceRoot }, relativePath, expectedText) {
  const text = await readFile(path.join(workspaceRoot, relativePath), "utf8");
  return assertion(
    `initial_file:${relativePath}`,
    text.includes(expectedText),
    "seed_initial_state_failed",
    { expectedText },
  );
}

function seedFromStarter(starterById, seed) {
  const starter = starterById.get(seed.starterCaseId);
  assert.ok(starter, `Unknown starter case: ${seed.starterCaseId}`);

  return {
    ...seed,
    level: starter.level,
    starterTitle: starter.title,
    failureTypes: starter.failureTypes,
    referenceAgent: {
      status: "pending_run",
      runRequest: {
        seedId: seed.id,
        starterCaseId: seed.starterCaseId,
        taskPrompt: seed.taskPrompt,
        requiredChecks: seed.requiredChecks,
      },
      result: null,
    },
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

function assertion(name, passed, failureType, details = {}) {
  return {
    name,
    passed,
    failureType: passed ? null : failureType,
    details,
  };
}

function failureTypeSummary(results) {
  const summary = {};

  for (const result of results) {
    if (!result.failureType) continue;
    summary[result.failureType] = (summary[result.failureType] ?? 0) + 1;
  }

  return summary;
}

async function main() {
  console.log(JSON.stringify(await runEvalExpansionThirdBatchDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
