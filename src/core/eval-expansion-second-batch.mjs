import assert from "node:assert/strict";
import { exec as execCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { PlanController } from "../lab06/plan-mode.mjs";
import {
  CoreRuntime,
  CoreToolRuntime,
  createCoreToyWorkspace,
} from "./core-runtime.mjs";
import { CoreContextEngine } from "./context-engine.mjs";
import { CoreCompactor } from "./compaction.mjs";
import {
  CORE11_SELECTED_STARTER_CASES,
  runExecutableRepoSeed,
} from "./eval-expansion.mjs";
import { starterReadinessCases } from "./core-readiness-package.mjs";
import { PlanFirstFixModel } from "./plan-mode.mjs";

const exec = promisify(execCallback);

export const CORE12_SELECTED_STARTER_CASES = [
  "core10-l0-unique-old-string",
  "core10-l0-path-safety",
  "core10-l0-long-output-artifact",
  "core10-l1-context-budget-pressure",
  "core10-l3-plan-compact-continuity",
];

export function secondBatchExecutableRepoSeeds() {
  const starterById = new Map(
    starterReadinessCases().map((testCase) => [testCase.id, testCase]),
  );

  return [
    seedFromStarter(starterById, {
      id: "core12-seed-l0-unique-old-string",
      starterCaseId: "core10-l0-unique-old-string",
      name: "unique old_string rejection seed",
      taskPrompt: "尝试修复分页表达式，但如果 old_string 不唯一必须停止。",
      requiredChecks: ["Read target file", "Edit returns old_string_not_unique"],
      createWorkspace: createDuplicateOldStringWorkspace,
      createRuntime: ({ workspaceRoot }) =>
        new CoreRuntime({
          workspaceRoot,
          model: new NonUniqueEditModel(),
          maxTurns: 4,
        }),
      verifyInitialState: async (ctx) => [
        await fileIncludes(ctx, "src/pagination.cjs", "function previewEnd"),
      ],
      expect: {
        toolSequence: ["Read", "Edit"],
        toolResults: [
          {
            name: "Edit",
            status: "error",
            errorType: "old_string_not_unique",
          },
        ],
        modifiedFiles: [],
        finalAnswerIncludes: "不唯一",
        files: [
          {
            path: "src/pagination.cjs",
            includes: "start + pageSize + 1);",
          },
        ],
      },
    }),
    seedFromStarter(starterById, {
      id: "core12-seed-l0-path-safety",
      starterCaseId: "core10-l0-path-safety",
      name: "path traversal denial seed",
      taskPrompt: "尝试读取工作区外路径，必须被路径策略拒绝。",
      requiredChecks: ["Read ../outside.txt returns permission_denied"],
      createWorkspace: createCoreToyWorkspace,
      createRuntime: ({ workspaceRoot }) =>
        new CoreRuntime({
          workspaceRoot,
          model: new PathEscapeModel(),
          maxTurns: 3,
        }),
      verifyInitialState: verifyToyPaginationBug,
      expect: {
        toolSequence: ["Read"],
        toolResults: [
          {
            name: "Read",
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
      id: "core12-seed-l0-long-output-artifact",
      starterCaseId: "core10-l0-long-output-artifact",
      name: "long output artifact seed",
      taskPrompt: "运行测试并确认长失败输出不会原样挤占上下文。",
      requiredChecks: ["node scripts/test.cjs fails", "Context artifact is created"],
      createWorkspace: createLongFailureWorkspace,
      createRuntime: createLongFailureRuntime,
      verifyInitialState: async (ctx) => [
        await commandFails(ctx, "node scripts/test.cjs"),
      ],
      expect: {
        toolSequence: ["Bash"],
        verificationStatus: "failed",
        modifiedFiles: [],
        finalAnswerIncludes: "长输出",
      },
      evaluate: evaluateLongOutputArtifact,
    }),
    seedFromStarter(starterById, {
      id: "core12-seed-l1-context-budget-pressure",
      starterCaseId: "core10-l1-context-budget-pressure",
      name: "context budget pressure seed",
      taskPrompt: "在很小上下文预算下运行失败测试，保留最新失败和验证状态。",
      requiredChecks: ["latest_failure block survives", "verification_state block survives"],
      createWorkspace: createLongFailureWorkspace,
      createRuntime: ({ workspaceRoot }) =>
        createLongFailureRuntime({
          workspaceRoot,
          budget: 110,
        }),
      verifyInitialState: async (ctx) => [
        await commandFails(ctx, "node scripts/test.cjs"),
      ],
      expect: {
        toolSequence: ["Bash"],
        verificationStatus: "failed",
        modifiedFiles: [],
        finalAnswerIncludes: "失败状态",
      },
      evaluate: evaluateContextBudgetPressure,
    }),
    seedFromStarter(starterById, {
      id: "core12-seed-l3-plan-compact-continuity",
      starterCaseId: "core10-l3-plan-compact-continuity",
      name: "plan and compaction continuity seed",
      taskPrompt: "先制定计划，再修复分页问题；压缩后仍要保留计划和验证状态。",
      requiredChecks: [
        "approved plan enters context",
        "compaction happens",
        "node scripts/test.cjs passes",
      ],
      createWorkspace: createCoreToyWorkspace,
      createRuntime: ({ workspaceRoot }) =>
        new CoreRuntime({
          workspaceRoot,
          model: new PlanFirstFixModel(),
          planController: new PlanController(),
          autoApprovePlan: true,
          compactor: new CoreCompactor({ messageThreshold: 4, keepRecent: 4 }),
          maxTurns: 8,
        }),
      verifyInitialState: verifyToyPaginationBug,
      expect: {
        verificationStatus: "passed",
        modifiedFiles: ["src/pagination.cjs"],
        finalAnswerIncludes: "批准计划",
        contextBlocks: ["active_plan", "verification_state"],
        files: [
          {
            path: "src/pagination.cjs",
            includes: "start + pageSize);",
            excludes: "start + pageSize + 1);",
          },
        ],
      },
      evaluate: evaluatePlanCompactionContinuity,
    }),
  ];
}

export async function runEvalExpansionSecondBatchSeeds(
  seeds = secondBatchExecutableRepoSeeds(),
) {
  const results = [];

  for (const seed of seeds) {
    results.push(await runExecutableRepoSeed(seed));
  }

  const passed = results.filter((result) => result.passed).length;
  const total = results.length;
  const cumulativeStarterCases = [
    ...CORE11_SELECTED_STARTER_CASES,
    ...seeds.map((seed) => seed.starterCaseId),
  ];

  return {
    id: "core-12-eval-expansion-second-batch",
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

export async function runEvalExpansionSecondBatchDemo() {
  const report = await runEvalExpansionSecondBatchSeeds(
    secondBatchExecutableRepoSeeds(),
  );
  return {
    checks: verifyEvalExpansionSecondBatchReport(report),
    ...report,
  };
}

export function verifyEvalExpansionSecondBatchReport(report) {
  assert.equal(report.id, "core-12-eval-expansion-second-batch");
  assert.equal(report.scoreKind, "executable_repo_seed_score");
  assert.deepEqual(report.selectedStarterCases, CORE12_SELECTED_STARTER_CASES);
  assert.equal(report.total, 5);
  assert.equal(report.passed, 5);
  assert.equal(report.score, 1);
  assert.equal(report.executableStarterCoverage.cumulativeCount, 10);
  assert.equal(report.executableStarterCoverage.starterTotal, 20);
  assert.equal(report.referenceAgentComparison.status, "interface_ready_no_runs");
  assert.equal(
    report.results.every((result) => result.referenceAgent.status === "pending_run"),
    true,
  );

  return {
    second_batch_seeds_defined: true,
    cumulative_executable_starter_count: 10,
    reference_agent_interface_ready: true,
    all_second_batch_seeds_passed: true,
  };
}

class NonUniqueEditModel {
  constructor() {
    this.step = 0;
  }

  next(request) {
    this.step += 1;
    const edit = latestToolResult(request.messages, "Edit");

    if (this.step === 1) {
      return toolCall("core12_read_duplicate_001", "Read", {
        path: "src/pagination.cjs",
      });
    }

    if (!edit) {
      return toolCall("core12_edit_duplicate_001", "Edit", {
        path: "src/pagination.cjs",
        old_string: "start + pageSize + 1",
        new_string: "start + pageSize",
      });
    }

    return {
      type: "final_answer",
      content: "old_string 不唯一，Edit 已被拒绝，未修改文件。",
    };
  }
}

class PathEscapeModel {
  constructor() {
    this.step = 0;
  }

  next() {
    this.step += 1;

    if (this.step === 1) {
      return toolCall("core12_read_escape_001", "Read", {
        path: "../outside.txt",
      });
    }

    return {
      type: "final_answer",
      content: "路径读取已被拒绝，未访问工作区外文件。",
    };
  }
}

class LongFailureModel {
  constructor({ finalText }) {
    this.step = 0;
    this.finalText = finalText;
  }

  next() {
    this.step += 1;

    if (this.step === 1) {
      return toolCall("core12_bash_long_failure_001", "Bash", {
        command: "node scripts/test.cjs",
      });
    }

    return {
      type: "final_answer",
      content: this.finalText,
    };
  }
}

async function createDuplicateOldStringWorkspace() {
  const workspaceRoot = await createCoreToyWorkspace();
  const filePath = path.join(workspaceRoot, "src/pagination.cjs");
  const text = await readFile(filePath, "utf8");
  const nextText = text.replace(
    "\nmodule.exports = { paginate };\n",
    [
      "",
      "function previewEnd(start, pageSize) {",
      "  return start + pageSize + 1;",
      "}",
      "",
      "module.exports = { paginate };",
      "",
    ].join("\n"),
  );
  await writeFile(filePath, nextText, "utf8");
  return workspaceRoot;
}

async function createLongFailureWorkspace() {
  const workspaceRoot = await createCoreToyWorkspace();
  await writeFile(
    path.join(workspaceRoot, "scripts/test.cjs"),
    [
      "console.error('FAIL '.repeat(140));",
      "process.exit(1);",
      "",
    ].join("\n"),
    "utf8",
  );
  return workspaceRoot;
}

function createLongFailureRuntime({
  workspaceRoot,
  budget = 130,
  finalText = "长输出已转成 artifact，失败状态仍保留。",
}) {
  return new CoreRuntime({
    workspaceRoot,
    model: new LongFailureModel({ finalText }),
    tools: new CoreToolRuntime({
      workspaceRoot,
      allowedCommands: ["node scripts/test.cjs"],
    }),
    contextEngine: new CoreContextEngine({ budget }),
    maxTurns: 3,
  });
}

async function verifyToyPaginationBug(ctx) {
  return [
    await fileIncludes(ctx, "src/pagination.cjs", "start + pageSize + 1);"),
  ];
}

async function evaluateLongOutputArtifact({ result }) {
  const artifactTurns = result.contextSnapshots.filter(
    (snapshot) => snapshot.artifacts.length > 0,
  );

  return [
    assertion(
      "long_output_artifacted",
      artifactTurns.length > 0,
      "context_missing",
      {
        artifactTurns: artifactTurns.map((snapshot) => snapshot.turn),
      },
    ),
  ];
}

async function evaluateContextBudgetPressure({ evidence }) {
  const hardContextTurn = evidence.contextTurns.find(
    (turn) =>
      turn.blockNames.includes("latest_failure") &&
      turn.blockNames.includes("verification_state"),
  );

  return [
    assertion(
      "hard_failure_context_survives",
      Boolean(hardContextTurn),
      "context_missing",
      {
        contextTurns: evidence.contextTurns,
      },
    ),
  ];
}

async function evaluatePlanCompactionContinuity({ result, evidence }) {
  const compacted = evidence.runtimeTraceEvents.includes("context.compacted");
  const activePlanPreserved =
    result.coreState.compactSummary?.activePlan?.status === "approved" &&
    result.coreState.activePlan?.status === "approved";
  const verificationAfterCompact = result.coreState.verificationState?.status === "passed";

  return [
    assertion("context_compacted", compacted, "compaction_loss", {
      runtimeTraceEvents: evidence.runtimeTraceEvents,
    }),
    assertion("active_plan_preserved", activePlanPreserved, "compaction_loss", {
      compactSummary: result.coreState.compactSummary,
      activePlan: result.coreState.activePlan,
    }),
    assertion(
      "verification_after_compact",
      verificationAfterCompact,
      "verification_missing",
      {
        verificationState: result.coreState.verificationState,
      },
    ),
  ];
}

async function fileIncludes({ workspaceRoot }, relativePath, expectedText) {
  const text = await readFile(path.join(workspaceRoot, relativePath), "utf8");
  return assertion(
    `initial_file:${relativePath}`,
    text.includes(expectedText),
    "seed_initial_state_failed",
    {
      expectedText,
    },
  );
}

async function commandFails({ workspaceRoot }, command) {
  try {
    await exec(command, { cwd: workspaceRoot, timeout: 3000 });
    return assertion(
      `initial_command_fails:${command}`,
      false,
      "seed_initial_state_failed",
      { command },
    );
  } catch (error) {
    return assertion(
      `initial_command_fails:${command}`,
      true,
      "seed_initial_state_failed",
      {
        command,
        exitCode: typeof error.code === "number" ? error.code : 1,
      },
    );
  }
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
  console.log(JSON.stringify(await runEvalExpansionSecondBatchDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
