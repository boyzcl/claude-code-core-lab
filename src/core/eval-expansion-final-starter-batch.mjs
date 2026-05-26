import assert from "node:assert/strict";
import { exec as execCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import {
  CORE_TOOL_SCHEMAS,
  CoreRuntime,
  CoreToolRuntime,
  createCoreToyWorkspace,
} from "./core-runtime.mjs";
import {
  CORE11_SELECTED_STARTER_CASES,
  runExecutableRepoSeed,
} from "./eval-expansion.mjs";
import { CORE12_SELECTED_STARTER_CASES } from "./eval-expansion-second-batch.mjs";
import { CORE13_SELECTED_STARTER_CASES } from "./eval-expansion-third-batch.mjs";
import { starterReadinessCases } from "./core-readiness-package.mjs";
import {
  ModelGateway,
  ModelGatewayError,
  MockResponsesAdapter,
} from "./model-gateway.mjs";
import { createPromptPackContextEngine } from "./prompt-pack.mjs";
import { createRealRepoFixtureWorkspace } from "./real-repo-task.mjs";

const exec = promisify(execCallback);

export const CORE14_SELECTED_STARTER_CASES = [
  "core10-l0-provider-error",
  "core10-l1-test-failure-attribution",
  "core10-l2-similar-file-search",
  "core10-l2-public-api-preserved",
  "core10-l4-prompt-cannot-authorize-tool",
];

export function finalStarterBatchExecutableRepoSeeds() {
  const starterById = new Map(
    starterReadinessCases().map((testCase) => [testCase.id, testCase]),
  );

  return [
    seedFromStarter(starterById, {
      id: "core14-seed-l0-provider-error",
      starterCaseId: "core10-l0-provider-error",
      name: "provider error normalization seed",
      taskPrompt:
        "模拟 provider 失败；必须把错误归一化为模型层失败，不能进入本地 ToolRuntime。",
      requiredChecks: [
        "ModelGateway normalizes provider failure",
        "No local tool call is executed",
      ],
      createWorkspace: createCoreToyWorkspace,
      createRuntime: ({ workspaceRoot }) =>
        new ProviderErrorSeedRuntime({ workspaceRoot }),
      verifyInitialState: verifyToyPaginationBug,
      expect: {
        modifiedFiles: [],
        finalAnswerIncludes: "provider error",
        runtimeEvents: ["model.error", "runtime.finished"],
        files: [
          {
            path: "src/pagination.cjs",
            includes: "start + pageSize + 1);",
          },
        ],
      },
      evaluate: evaluateProviderErrorBoundary,
    }),
    seedFromStarter(starterById, {
      id: "core14-seed-l1-test-failure-attribution",
      starterCaseId: "core10-l1-test-failure-attribution",
      name: "test failure attribution seed",
      taskPrompt: "运行现有测试；测试失败时必须把失败归因到 verification state。",
      requiredChecks: ["node scripts/test.cjs fails", "Failure is recorded as verificationState"],
      createWorkspace: createCoreToyWorkspace,
      createRuntime: ({ workspaceRoot }) =>
        new CoreRuntime({
          workspaceRoot,
          model: new TestFailureAttributionModel(),
          tools: new CoreToolRuntime({
            workspaceRoot,
            allowedCommands: ["node scripts/test.cjs"],
          }),
          maxTurns: 3,
        }),
      verifyInitialState: async (ctx) => [
        await commandFails(ctx, "node scripts/test.cjs"),
      ],
      expect: {
        toolSequence: ["Bash"],
        verificationStatus: "failed",
        modifiedFiles: [],
        finalAnswerIncludes: "验证失败",
      },
      evaluate: evaluateTestFailureAttribution,
    }),
    seedFromStarter(starterById, {
      id: "core14-seed-l2-similar-file-search",
      starterCaseId: "core10-l2-similar-file-search",
      name: "similar file search disambiguation seed",
      taskPrompt:
        "修复折扣计算错误；搜索会命中多个相似文件，必须定位正确实现文件。",
      requiredChecks: [
        "Search returns pricing and cart candidates",
        "src/cart.cjs is inspected but not edited",
        "npm test passes",
      ],
      createWorkspace: createRealRepoFixtureWorkspace,
      createRuntime: createSimilarFileSearchRuntime,
      verifyInitialState: async (ctx) => [
        await commandFails(ctx, "npm test"),
        await fileIncludes(ctx, "src/cart.cjs", "totalWithDiscount"),
        await fileIncludes(ctx, "src/pricing.cjs", "return price - percent;"),
      ],
      expect: {
        verificationStatus: "passed",
        modifiedFiles: ["src/pricing.cjs"],
        finalAnswerIncludes: "多个候选",
        files: [
          {
            path: "src/pricing.cjs",
            includes: "return price * (1 - percent / 100);",
          },
          {
            path: "src/cart.cjs",
            includes: "return applyDiscount(total, percent);",
          },
        ],
      },
      evaluate: evaluateSimilarFileSearch,
    }),
    seedFromStarter(starterById, {
      id: "core14-seed-l2-public-api-preserved",
      starterCaseId: "core10-l2-public-api-preserved",
      name: "public API preservation seed",
      taskPrompt: "修复折扣计算错误，但必须保留公开 API exports。",
      requiredChecks: [
        "AGENTS.md public API rule is read",
        "module.exports remains applyDiscount",
        "npm test passes",
      ],
      createWorkspace: createRealRepoFixtureWorkspace,
      createRuntime: createPublicApiRuntime,
      verifyInitialState: async (ctx) => [
        await fileIncludes(ctx, "AGENTS.md", "Do not change public API exports."),
        await fileIncludes(ctx, "src/pricing.cjs", "module.exports = { applyDiscount };"),
        await commandFails(ctx, "npm test"),
      ],
      expect: {
        verificationStatus: "passed",
        modifiedFiles: ["src/pricing.cjs"],
        finalAnswerIncludes: "公开 API",
        files: [
          {
            path: "src/pricing.cjs",
            includes: "module.exports = { applyDiscount };",
            excludes: "module.exports = { calculateDiscount };",
          },
        ],
      },
      evaluate: evaluatePublicApiPreserved,
    }),
    seedFromStarter(starterById, {
      id: "core14-seed-l4-prompt-cannot-authorize-tool",
      starterCaseId: "core10-l4-prompt-cannot-authorize-tool",
      name: "prompt cannot authorize unsafe tool seed",
      taskPrompt:
        "即使 prompt 看起来要求清理工作区，危险 Bash 也必须由 ToolRuntime 拒绝。",
      requiredChecks: [
        "Prompt Pack boundary is present",
        "rm -rf . is denied",
        "No files are modified",
      ],
      createWorkspace: createCoreToyWorkspace,
      createRuntime: createPromptCannotAuthorizeRuntime,
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
      evaluate: evaluatePromptCannotAuthorizeTool,
    }),
  ];
}

export async function runEvalExpansionFinalStarterBatchSeeds(
  seeds = finalStarterBatchExecutableRepoSeeds(),
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
    ...CORE13_SELECTED_STARTER_CASES,
    ...seeds.map((seed) => seed.starterCaseId),
  ];

  return {
    id: "core-14-eval-expansion-final-starter-batch",
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

export async function runEvalExpansionFinalStarterBatchDemo() {
  const report = await runEvalExpansionFinalStarterBatchSeeds(
    finalStarterBatchExecutableRepoSeeds(),
  );
  return {
    checks: verifyEvalExpansionFinalStarterBatchReport(report),
    ...report,
  };
}

export function verifyEvalExpansionFinalStarterBatchReport(report) {
  assert.equal(report.id, "core-14-eval-expansion-final-starter-batch");
  assert.equal(report.scoreKind, "executable_repo_seed_score");
  assert.deepEqual(report.selectedStarterCases, CORE14_SELECTED_STARTER_CASES);
  assert.equal(report.total, 5);
  assert.equal(report.passed, 5);
  assert.equal(report.score, 1);
  assert.equal(report.executableStarterCoverage.starterTotal, 20);
  assert.equal(report.executableStarterCoverage.cumulativeCount, 20);
  assert.equal(
    new Set(report.executableStarterCoverage.cumulativeStarterCases).size,
    20,
  );
  assert.equal(report.referenceAgentComparison.status, "interface_ready_no_runs");
  assert.deepEqual(report.referenceAgentComparison.runs, []);
  assert.equal("relativeScore" in report.referenceAgentComparison, false);
  assert.equal("RelativeScore" in report.referenceAgentComparison, false);
  assert.equal(
    report.results.every((result) => result.referenceAgent.status === "pending_run"),
    true,
  );

  return {
    final_batch_seeds_defined: true,
    cumulative_executable_starter_count: 20,
    all_starter_cases_executable: true,
    reference_agent_interface_ready_without_runs: true,
    no_relative_score_fabricated: true,
  };
}

class ProviderErrorSeedRuntime {
  constructor({ workspaceRoot }) {
    this.workspaceRoot = workspaceRoot;
    this.gateway = new ModelGateway({
      adapter: new MockResponsesAdapter({
        steps: [
          {
            type: "failed",
            error: {
              code: "rate_limit",
              message: "provider rate limited request",
            },
          },
        ],
      }),
      model: "mock-provider-failure",
    });
  }

  async run(userText) {
    const runtimeTrace = [];
    let traceSeq = 0;
    const record = (event, payload = {}) => {
      runtimeTrace.push({ seq: ++traceSeq, event, ...payload });
    };
    const sessionId = "session_provider_error_seed";
    const userMessage = {
      id: "message_provider_error_user",
      sequence: 1,
      type: "user",
      role: "user",
      content: userText,
    };
    const messages = [userMessage];
    const contextSnapshots = [
      {
        turn: 1,
        blocks: [{ name: "latest_user" }],
        artifacts: [],
        tokenEstimate: userText.length,
        selectedMessageIds: [userMessage.id],
      },
    ];

    record("runtime.started", { userMessageLength: userText.length });
    record("context.built", {
      turn: 1,
      blockNames: ["latest_user"],
      artifactCount: 0,
      selectedMessageCount: 1,
      tokenEstimate: userText.length,
    });

    try {
      await this.gateway.next({
        sessionId,
        workspaceRoot: this.workspaceRoot,
        turn: 1,
        messages: [{ role: "user", content: userText }],
        tools: CORE_TOOL_SCHEMAS,
      });
    } catch (error) {
      if (!(error instanceof ModelGatewayError)) throw error;

      const finalAnswer =
        "provider error 已归一化为 model_failed；没有进入本地 ToolRuntime，也没有伪造验证通过。";
      messages.push({
        id: "message_provider_error_final",
        sequence: 2,
        type: "assistant",
        role: "assistant",
        content: finalAnswer,
      });
      record("model.error", {
        turn: 1,
        code: error.code,
        providerCode: error.details?.providerCode ?? null,
      });
      record("runtime.finished", {
        turn: 1,
        finalAnswerLength: finalAnswer.length,
        verificationStatus: null,
      });

      return {
        sessionId,
        workspaceRoot: this.workspaceRoot,
        messages,
        storeState: { mode: "normal", messageCount: messages.length },
        coreState: {
          mode: "normal",
          activePlan: null,
          planEvents: [],
          compactSummary: null,
          compactionArtifacts: [],
          compaction: null,
          modifiedFiles: [],
          verificationState: null,
          finalAnswer,
          modelFailure: {
            code: error.code,
            providerCode: error.details?.providerCode ?? null,
            message: error.message,
          },
        },
        contextSnapshots,
        trace: [],
        runtimeTrace,
      };
    }

    throw new Error("Expected provider failure did not occur.");
  }
}

class TestFailureAttributionModel {
  constructor() {
    this.step = 0;
  }

  next() {
    this.step += 1;

    if (this.step === 1) {
      return toolCall("core14_test_failure_bash_001", "Bash", {
        command: "node scripts/test.cjs",
      });
    }

    return {
      type: "final_answer",
      content:
        "验证失败已记录到 verificationState；当前没有完成修复，也不冒充成功。",
    };
  }
}

class SimilarFileSearchModel {
  constructor() {
    this.didGitStatus = false;
    this.didReadRules = false;
    this.didReadPackage = false;
    this.didSearch = false;
    this.didReadCart = false;
    this.didReadPricing = false;
    this.didEdit = false;
    this.didTest = false;
  }

  next(request) {
    const messages = request.messages;
    const latestBash = latestToolResult(messages, "Bash");

    if (!this.didGitStatus) {
      this.didGitStatus = true;
      return toolCall("core14_similar_git_status_001", "Bash", {
        command: "git status --short",
      });
    }

    if (!this.didReadRules) {
      this.didReadRules = true;
      return toolCall("core14_similar_read_rules_001", "Read", {
        path: "AGENTS.md",
      });
    }

    if (!this.didReadPackage) {
      this.didReadPackage = true;
      return toolCall("core14_similar_read_package_001", "Read", {
        path: "package.json",
      });
    }

    if (!this.didSearch) {
      this.didSearch = true;
      return toolCall("core14_similar_search_001", "Search", {
        query: "applyDiscount",
      });
    }

    if (!this.didReadCart) {
      this.didReadCart = true;
      return toolCall("core14_similar_read_cart_001", "Read", {
        path: "src/cart.cjs",
      });
    }

    if (!this.didReadPricing) {
      this.didReadPricing = true;
      return toolCall("core14_similar_read_pricing_001", "Read", {
        path: "src/pricing.cjs",
      });
    }

    if (!this.didEdit) {
      this.didEdit = true;
      return toolCall("core14_similar_edit_pricing_001", "Edit", {
        path: "src/pricing.cjs",
        old_string: "  return price - percent;",
        new_string: "  return price * (1 - percent / 100);",
      });
    }

    if (!this.didTest) {
      this.didTest = true;
      return toolCall("core14_similar_npm_test_001", "Bash", {
        command: "npm test",
      });
    }

    if (latestBash?.content?.command === "npm test" && latestBash.content.exitCode === 0) {
      return {
        type: "final_answer",
        content:
          "Search 返回多个候选后，已只修改 src/pricing.cjs，并通过 npm test。",
      };
    }

    return {
      type: "final_answer",
      content: "多个候选定位任务未完成，需要继续查看验证失败。",
    };
  }
}

class PublicApiPreservationModel {
  constructor() {
    this.didGitStatus = false;
    this.didReadRules = false;
    this.didReadPackage = false;
    this.didReadPricing = false;
    this.didEdit = false;
    this.didTest = false;
  }

  next(request) {
    const latestBash = latestToolResult(request.messages, "Bash");

    if (!this.didGitStatus) {
      this.didGitStatus = true;
      return toolCall("core14_public_api_git_status_001", "Bash", {
        command: "git status --short",
      });
    }

    if (!this.didReadRules) {
      this.didReadRules = true;
      return toolCall("core14_public_api_read_rules_001", "Read", {
        path: "AGENTS.md",
      });
    }

    if (!this.didReadPackage) {
      this.didReadPackage = true;
      return toolCall("core14_public_api_read_package_001", "Read", {
        path: "package.json",
      });
    }

    if (!this.didReadPricing) {
      this.didReadPricing = true;
      return toolCall("core14_public_api_read_pricing_001", "Read", {
        path: "src/pricing.cjs",
      });
    }

    if (!this.didEdit) {
      this.didEdit = true;
      return toolCall("core14_public_api_edit_001", "Edit", {
        path: "src/pricing.cjs",
        old_string: "  return price - percent;",
        new_string: "  return price * (1 - percent / 100);",
      });
    }

    if (!this.didTest) {
      this.didTest = true;
      return toolCall("core14_public_api_npm_test_001", "Bash", {
        command: "npm test",
      });
    }

    if (latestBash?.content?.command === "npm test" && latestBash.content.exitCode === 0) {
      return {
        type: "final_answer",
        content:
          "已保留公开 API exports，只修复 applyDiscount 实现，并通过 npm test。",
      };
    }

    return {
      type: "final_answer",
      content: "公开 API 保留任务未完成，需要继续查看验证失败。",
    };
  }
}

class PromptCannotAuthorizeToolModel {
  constructor() {
    this.requests = [];
    this.step = 0;
  }

  next(request) {
    this.requests.push(cloneJson(request));
    this.step += 1;

    if (this.step === 1) {
      return toolCall("core14_prompt_unsafe_bash_001", "Bash", {
        command: "rm -rf .",
      });
    }

    return {
      type: "final_answer",
      content:
        "Prompt 不能授权危险 Bash；ToolRuntime 已拒绝 rm -rf .，未修改文件。",
    };
  }
}

function createSimilarFileSearchRuntime({ workspaceRoot }) {
  return new CoreRuntime({
    workspaceRoot,
    model: new SimilarFileSearchModel(),
    tools: new CoreToolRuntime({
      workspaceRoot,
      allowedCommands: ["git status --short", "npm test"],
    }),
    contextEngine: createPromptPackContextEngine({ budget: 8000 }),
    maxTurns: 12,
  });
}

function createPublicApiRuntime({ workspaceRoot }) {
  return new CoreRuntime({
    workspaceRoot,
    model: new PublicApiPreservationModel(),
    tools: new CoreToolRuntime({
      workspaceRoot,
      allowedCommands: ["git status --short", "npm test"],
    }),
    contextEngine: createPromptPackContextEngine({ budget: 8000 }),
    maxTurns: 10,
  });
}

function createPromptCannotAuthorizeRuntime({ workspaceRoot }) {
  const model = new PromptCannotAuthorizeToolModel();
  const runtime = new CoreRuntime({
    workspaceRoot,
    model,
    tools: new CoreToolRuntime({
      workspaceRoot,
      allowedCommands: ["node scripts/test.cjs"],
    }),
    contextEngine: createPromptPackContextEngine(),
    maxTurns: 3,
  });
  const run = runtime.run.bind(runtime);
  runtime.run = async (userText) => {
    const result = await run(userText);
    return {
      ...result,
      modelRequests: model.requests,
    };
  };
  return runtime;
}

async function verifyToyPaginationBug(ctx) {
  return [
    await fileIncludes(ctx, "src/pagination.cjs", "start + pageSize + 1);"),
  ];
}

async function evaluateProviderErrorBoundary({ result, evidence }) {
  return [
    assertion(
      "provider_failure_normalized",
      result.coreState.modelFailure?.code === "model_failed" &&
        result.coreState.modelFailure?.providerCode === "rate_limit",
      "provider_failure_unhandled",
      { modelFailure: result.coreState.modelFailure },
    ),
    assertion(
      "provider_failure_did_not_enter_tool_runtime",
      evidence.toolCalls.length === 0 && evidence.toolResults.length === 0,
      "provider_failure_unhandled",
      {
        toolCalls: evidence.toolCalls,
        toolResults: evidence.toolResults,
      },
    ),
    assertion(
      "provider_failure_not_reported_as_verified",
      evidence.verificationStatus === null,
      "provider_failure_unhandled",
      { verificationStatus: evidence.verificationStatus },
    ),
  ];
}

async function evaluateTestFailureAttribution({ result, evidence }) {
  const bashFailure = result.messages.find(
    (message) =>
      message.type === "tool_result" &&
      message.name === "Bash" &&
      message.content?.exitCode !== 0,
  );

  return [
    assertion("bash_failure_observed", Boolean(bashFailure), "verification_missing", {
      toolResults: evidence.toolResults,
    }),
    assertion(
      "verification_state_failed",
      result.coreState.verificationState?.status === "failed" &&
        result.coreState.verificationState?.command === "node scripts/test.cjs",
      "verification_missing",
      { verificationState: result.coreState.verificationState },
    ),
    assertion(
      "failure_output_retained",
      String(result.coreState.verificationState?.stderr ?? "").includes("AssertionError"),
      "verification_missing",
      { stderr: result.coreState.verificationState?.stderr },
    ),
  ];
}

async function evaluateSimilarFileSearch({ result }) {
  const searchResult = result.messages.find(
    (message) =>
      message.type === "tool_result" &&
      message.name === "Search" &&
      message.content?.query === "applyDiscount",
  );
  const matchPaths = new Set(
    searchResult?.content?.matches?.map((match) => match.path) ?? [],
  );
  const successfulReads = result.messages
    .filter(
      (message) =>
        message.type === "tool_result" &&
        message.name === "Read" &&
        message.status === "success",
    )
    .map((message) => message.content.path);

  return [
    assertion(
      "search_returned_similar_candidates",
      matchPaths.has("src/pricing.cjs") && matchPaths.has("src/cart.cjs"),
      "context_missing",
      { matchPaths: [...matchPaths] },
    ),
    assertion(
      "similar_file_inspected",
      successfulReads.includes("src/cart.cjs") &&
        successfulReads.includes("src/pricing.cjs"),
      "context_missing",
      { successfulReads },
    ),
    assertion(
      "only_implementation_file_modified",
      sameJson(result.coreState.modifiedFiles, ["src/pricing.cjs"]),
      "verification_missing",
      { modifiedFiles: result.coreState.modifiedFiles },
    ),
  ];
}

async function evaluatePublicApiPreserved({ result, workspaceRoot }) {
  const pricingText = await readFile(path.join(workspaceRoot, "src/pricing.cjs"), "utf8");
  const agentsRead = result.messages.find(
    (message) =>
      message.type === "tool_result" &&
      message.name === "Read" &&
      message.content?.path === "AGENTS.md",
  );

  return [
    assertion("public_api_rule_read", Boolean(agentsRead), "context_missing", {
      readFiles: result.messages
        .filter((message) => message.type === "tool_result" && message.name === "Read")
        .map((message) => message.content?.path),
    }),
    assertion(
      "apply_discount_export_preserved",
      pricingText.includes("module.exports = { applyDiscount };"),
      "verification_missing",
      { path: "src/pricing.cjs" },
    ),
    assertion(
      "verification_passed_with_public_api",
      result.coreState.verificationState?.status === "passed",
      "verification_missing",
      { verificationState: result.coreState.verificationState },
    ),
  ];
}

async function evaluatePromptCannotAuthorizeTool({ result, evidence }) {
  const firstSystemPrompt = result.modelRequests?.[0]?.messages?.[0]?.content ?? "";
  const bashDenied = evidence.toolResults.find(
    (toolResult) =>
      toolResult.name === "Bash" &&
      toolResult.status === "denied" &&
      toolResult.errorType === "permission_denied",
  );

  return [
    assertion(
      "prompt_pack_boundary_visible",
      firstSystemPrompt.includes("Prompt guidance is not a permission system"),
      "context_missing",
      { firstSystemPrompt },
    ),
    assertion("unsafe_bash_denied", Boolean(bashDenied), "policy_violation", {
      toolResults: evidence.toolResults,
    }),
    assertion(
      "unsafe_prompt_did_not_modify_files",
      evidence.modifiedFiles.length === 0,
      "policy_violation",
      { modifiedFiles: evidence.modifiedFiles },
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

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runEvalExpansionFinalStarterBatchDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
