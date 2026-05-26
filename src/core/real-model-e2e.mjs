import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadLocalEnv } from "./env-loader.mjs";
import {
  CoreRuntime,
  createCoreToyWorkspace,
} from "./core-runtime.mjs";
import { CoreContextEngine } from "./context-engine.mjs";
import {
  ModelGateway,
  OpenAICompatibleChatCompletionsAdapter,
  OpenAICompatibleResponsesAdapter,
} from "./model-gateway.mjs";
import {
  buildCoreEvalEvidence,
  evaluateCoreExpectations,
} from "./eval-harness.mjs";

loadLocalEnv();

export const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
export const DEFAULT_ARK_MODEL = "doubao-seed-2-0-lite-260428";
export const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
export const DEFAULT_REAL_MODEL_USER_TEXT =
  "修复分页多返回一个元素的问题，并运行测试。";

export const REAL_MODEL_SYSTEM_PROMPT = [
  "You are a local coding agent running inside a controlled local runtime.",
  "Use exactly one tool call per turn when a tool is needed.",
  "If you produce multiple tool calls, the runtime will execute only the first one and ignore the rest.",
  "When you choose a tool, use the provider function_call mechanism. Do not write a JSON tool_call as normal text.",
  "The model service does not execute tools. The local runtime executes Search, Read, Edit, and Bash.",
  "Read JSON tool_result messages carefully before deciding the next action.",
  "Use Search before Read, Read before Edit, and Bash after Edit.",
  "Never call Bash until an Edit tool_result with status success is present.",
  "Do not give a final answer until Bash has run and the tool_result exitCode is 0.",
  "If verification_state status is passed, immediately provide a final answer and do not call more tools.",
  "Keep edits narrow and preserve the public API.",
].join("\n");

export function createRealModelGateway({
  provider = process.env.AGENT_MODEL_PROVIDER ??
    (process.env.DEEPSEEK_API_KEY ? "chat_completions" : "responses"),
  baseUrl = defaultBaseUrl(provider),
  apiKey = process.env.DEEPSEEK_API_KEY ??
    process.env.ARK_API_KEY ??
    process.env.OPENAI_API_KEY,
  model = defaultModel(provider),
  reasoningEffort = process.env.AGENT_REASONING_EFFORT ?? "medium",
  fetchImpl = globalThis.fetch,
  timeoutMs = numberFromEnv(process.env.AGENT_MODEL_TIMEOUT_MS, 120000),
  maxOutputTokens = numberFromEnv(process.env.AGENT_MAX_OUTPUT_TOKENS, 8000),
} = {}) {
  const adapter =
    provider === "chat_completions" || provider === "deepseek"
      ? new OpenAICompatibleChatCompletionsAdapter({
          baseUrl,
          apiKey,
          fetchImpl,
          timeoutMs,
        })
      : new OpenAICompatibleResponsesAdapter({
          baseUrl,
          apiKey,
          fetchImpl,
          timeoutMs,
        });

  return new ModelGateway({
    adapter,
    model,
    reasoning:
      provider === "chat_completions" || provider === "deepseek" || reasoningEffort === "none"
        ? null
        : { effort: reasoningEffort },
    maxOutputTokens,
    runtimeVersion: "core-07",
  });
}

export function realModelEvalExpectation() {
  return {
    id: "core-07-real-model-e2e",
    name: "real model compatible adapter fixes pagination",
    expect: {
      verificationStatus: "passed",
      modifiedFiles: ["src/pagination.cjs"],
      finalAnswerIncludes: "通过",
      runtimeEvents: [
        "context.built",
        "model.output",
        "tool.result",
        "runtime.finished",
      ],
      storeEvents: ["message.appended", "state.updated"],
      contextBlocks: ["latest_user", "verification_state"],
      files: [
        {
          path: "src/pagination.cjs",
          includes: "start + pageSize);",
          excludes: "start + pageSize + 1);",
        },
      ],
    },
    evaluate: ({ evidence }) => [
      {
        name: "required_tool_order",
        passed: includesSubsequence(evidence.toolSequence, [
          "Search",
          "Read",
          "Edit",
          "Bash",
        ]),
        failureType: "tool_sequence_mismatch",
        details: {
          expectedSubsequence: ["Search", "Read", "Edit", "Bash"],
          actual: evidence.toolSequence,
        },
      },
    ],
  };
}

export async function runRealModelE2E({
  workspaceRoot,
  userText = DEFAULT_REAL_MODEL_USER_TEXT,
  gateway = createRealModelGateway(),
  contextEngine = new CoreContextEngine({
    systemPrompt: REAL_MODEL_SYSTEM_PROMPT,
    budget: 6000,
  }),
  maxTurns = numberFromEnv(process.env.AGENT_MAX_TURNS, 16),
} = {}) {
  const root = workspaceRoot ?? (await createCoreToyWorkspace());
  const runtime = new CoreRuntime({
    workspaceRoot: root,
    model: gateway,
    contextEngine,
    stopAfterPassedVerification: true,
    maxTurns,
  });
  const result = await runtime.run(userText);
  const evidence = buildCoreEvalEvidence(result);
  const testCase = realModelEvalExpectation();
  const assertions = await evaluateCoreExpectations({
    testCase,
    result,
    evidence,
    workspaceRoot: root,
  });
  const finalText = await readFile(path.join(root, "src/pagination.cjs"), "utf8");

  return {
    passed: assertions.every((item) => item.passed),
    assertions,
    evidence,
    finalText,
    ...result,
  };
}

export function summarizeRealModelRun(result) {
  return {
    passed: result.passed,
    toolSequence: result.evidence.toolSequence,
    verificationStatus: result.evidence.verificationStatus,
    modifiedFiles: result.evidence.modifiedFiles,
    finalAnswer: result.evidence.finalAnswer,
    failedAssertions: result.assertions.filter((item) => !item.passed),
    runtimeTraceEvents: result.evidence.runtimeTraceEvents,
    contextTurns: result.evidence.contextTurns,
  };
}

export function verifyRealModelRun(result) {
  assert.equal(result.passed, true);
  assert.deepEqual(result.evidence.toolSequence, ["Search", "Read", "Edit", "Bash"]);
  assert.equal(result.evidence.verificationStatus, "passed");
  assert.deepEqual(result.evidence.modifiedFiles, ["src/pagination.cjs"]);
  assert.match(result.finalText, /start \+ pageSize\)/);
  assert.doesNotMatch(result.finalText, /start \+ pageSize \+ 1/);

  return {
    real_model_e2e_passed: true,
    local_tool_runtime_executed_tools: true,
    eval_evidence_attached: true,
  };
}

function numberFromEnv(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultBaseUrl(provider) {
  if (provider === "chat_completions" || provider === "deepseek") {
    return (
      process.env.DEEPSEEK_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      DEFAULT_DEEPSEEK_BASE_URL
    );
  }

  return (
    process.env.ARK_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    DEFAULT_ARK_BASE_URL
  );
}

function defaultModel(provider) {
  if (provider === "chat_completions" || provider === "deepseek") {
    return (
      process.env.DEEPSEEK_MODEL ??
      process.env.AGENT_MODEL ??
      DEFAULT_DEEPSEEK_MODEL
    );
  }

  return process.env.ARK_MODEL ?? process.env.AGENT_MODEL ?? DEFAULT_ARK_MODEL;
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

async function main() {
  const result = await runRealModelE2E();
  console.log(JSON.stringify(summarizeRealModelRun(result), null, 2));
  if (!result.passed) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
