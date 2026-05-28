import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CORE_TOOL_SCHEMAS,
  CoreRuntime,
  createCoreToyWorkspace,
  verifyCoreResult,
} from "./core-runtime.mjs";

export class ModelGateway {
  constructor({
    adapter,
    model = "mock-coding-model",
    fallbackModel = null,
    reasoning = { effort: "medium" },
    maxOutputTokens = 8000,
    toolChoice = "auto",
    runtimeVersion = "core-02",
  } = {}) {
    if (!adapter?.createResponse) {
      throw new ModelGatewayError(
        "missing_adapter",
        "ModelGateway requires an adapter with createResponse(request).",
      );
    }

    this.adapter = adapter;
    this.model = model;
    this.fallbackModel = fallbackModel;
    this.reasoning = reasoning;
    this.maxOutputTokens = maxOutputTokens;
    this.toolChoice = toolChoice;
    this.runtimeVersion = runtimeVersion;
  }

  async next(runtimeRequest) {
    const request = this.#normalizeRequest(runtimeRequest);
    const events = [];

    try {
      for await (const event of this.adapter.createResponse(request)) {
        events.push(event);
      }
    } catch (error) {
      throw new ModelGatewayError(
        "adapter_error",
        error.message,
        { cause: error },
      );
    }

    return collectModelOutput(events, request.tools);
  }

  getCapabilities(model = this.model) {
    return this.adapter.getCapabilities?.(model) ?? {
      model,
      toolCalls: true,
      streaming: true,
      reasoning: true,
    };
  }

  #normalizeRequest(runtimeRequest) {
    return {
      sessionId: runtimeRequest.sessionId ?? "session_unknown",
      workspaceRoot: runtimeRequest.workspaceRoot,
      turn: runtimeRequest.turn,
      model: this.model,
      fallbackModel: this.fallbackModel,
      context: runtimeRequest.context ?? null,
      messages: runtimeRequest.messages ?? [],
      tools: runtimeRequest.tools ?? [],
      toolChoice: this.toolChoice,
      reasoning: this.reasoning,
      maxOutputTokens: this.maxOutputTokens,
      metadata: {
        turnId: `turn_${String(runtimeRequest.turn ?? 0).padStart(3, "0")}`,
        runtimeVersion: this.runtimeVersion,
      },
    };
  }
}

export class MockResponsesAdapter {
  constructor({ steps = [], capabilities = {} } = {}) {
    this.steps = steps;
    this.capabilities = capabilities;
    this.index = 0;
  }

  async *createResponse(request) {
    const step = this.steps[this.index];
    this.index += 1;

    if (!step) {
      yield {
        type: "failed",
        error: {
          code: "mock_step_missing",
          message: `No mock response configured for turn ${request.turn}.`,
        },
      };
      return;
    }

    const produced = typeof step === "function" ? await step(request) : step;
    for (const event of normalizeMockEvents(produced)) {
      yield event;
    }
  }

  getCapabilities(model) {
    return {
      model,
      toolCalls: true,
      streaming: true,
      reasoning: false,
      ...this.capabilities,
    };
  }
}

export class OpenAICompatibleResponsesAdapter {
  constructor({
    baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    apiKey = process.env.OPENAI_API_KEY,
    fetchImpl = globalThis.fetch,
    timeoutMs = 120000,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async *createResponse(request) {
    if (!this.apiKey) {
      yield {
        type: "failed",
        error: {
          code: "missing_api_key",
          message: "OPENAI_API_KEY is required for OpenAI-compatible requests.",
        },
      };
      return;
    }

    if (!this.fetchImpl) {
      yield {
        type: "failed",
        error: {
          code: "missing_fetch",
          message: "No fetch implementation is available.",
        },
      };
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(toResponsesPayload(request)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const providerError = await parseProviderError(response);
        yield {
          type: "failed",
          error: {
            code: providerError.code ?? "provider_http_error",
            message:
              providerError.message ?? `Provider returned HTTP ${response.status}.`,
            status: response.status,
          },
        };
        return;
      }

      const json = await response.json();
      yield* fromResponsesJson(json);
    } catch (error) {
      yield {
        type: "failed",
        error: {
          code: error.name === "AbortError" ? "timeout" : "provider_error",
          message: error.message,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  getCapabilities(model) {
    return {
      model,
      toolCalls: true,
      streaming: false,
      reasoning: true,
    };
  }
}

export class OpenAICompatibleChatCompletionsAdapter {
  constructor({
    baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    apiKey = process.env.OPENAI_API_KEY,
    fetchImpl = globalThis.fetch,
    timeoutMs = 120000,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async *createResponse(request) {
    if (!this.apiKey) {
      yield {
        type: "failed",
        error: {
          code: "missing_api_key",
          message: "API key is required for OpenAI-compatible chat requests.",
        },
      };
      return;
    }

    if (!this.fetchImpl) {
      yield {
        type: "failed",
        error: {
          code: "missing_fetch",
          message: "No fetch implementation is available.",
        },
      };
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(toChatCompletionsPayload(request)),
        signal: controller.signal,
      });

      if (!response.ok) {
        const providerError = await parseProviderError(response);
        yield {
          type: "failed",
          error: {
            code: providerError.code ?? "provider_http_error",
            message:
              providerError.message ?? `Provider returned HTTP ${response.status}.`,
            status: response.status,
          },
        };
        return;
      }

      const json = await response.json();
      yield* fromChatCompletionsJson(json);
    } catch (error) {
      yield {
        type: "failed",
        error: {
          code: error.name === "AbortError" ? "timeout" : "provider_error",
          message: error.message,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  getCapabilities(model) {
    return {
      model,
      toolCalls: true,
      streaming: false,
      reasoning: false,
    };
  }
}

export function createScriptedCoreResponsesAdapter() {
  return new MockResponsesAdapter({
    steps: [
      () => toolCallEvent("gateway_tool_call_search_001", "Search", {
        query: "pageSize + 1",
      }),
      (request) => {
        const search = latestToolResult(request.messages, "Search");
        return toolCallEvent("gateway_tool_call_read_001", "Read", {
          path: search.content.matches[0].path,
        });
      },
      (request) => {
        const read = latestToolResult(request.messages, "Read");
        if (!read.content.text.includes("start + pageSize + 1")) {
          return textEvents("未找到预期的 off-by-one 代码，停止修改。");
        }

        return toolCallEvent("gateway_tool_call_edit_001", "Edit", {
          path: read.content.path,
          old_string: "start + pageSize + 1",
          new_string: "start + pageSize",
        });
      },
      () => toolCallEvent("gateway_tool_call_bash_001", "Bash", {
        command: "node scripts/test.cjs",
      }),
      (request) => {
        const bash = latestToolResult(request.messages, "Bash");
        if (bash.status === "success" && bash.content.exitCode === 0) {
          return textEvents(
            "已修复分页 off-by-one 问题，修改 src/pagination.cjs，并通过 node scripts/test.cjs 验证。",
          );
        }

        return textEvents("已尝试修复，但验证失败，需要继续查看测试输出。");
      },
    ],
  });
}

export async function runModelGatewayDemo() {
  const workspaceRoot = await createCoreToyWorkspace();
  const gateway = new ModelGateway({
    adapter: createScriptedCoreResponsesAdapter(),
    model: "mock-responses-coding",
  });
  const runtime = new CoreRuntime({ workspaceRoot, model: gateway });
  const result = await runtime.run("修复分页多返回一个元素的问题，并运行测试。");
  const finalText = await readFile(path.join(workspaceRoot, "src/pagination.cjs"), "utf8");

  return {
    checks: verifyModelGatewayResult(result, finalText),
    gateway: {
      model: gateway.model,
      capabilities: gateway.getCapabilities(),
    },
    finalText,
    ...result,
  };
}

export function verifyModelGatewayResult(result, finalText) {
  const coreChecks = verifyCoreResult(result, finalText);
  const toolCallIds = result.messages
    .filter((message) => message.type === "assistant_tool_call")
    .map((message) => message.tool_call.id);

  assert.deepEqual(toolCallIds, [
    "gateway_tool_call_search_001",
    "gateway_tool_call_read_001",
    "gateway_tool_call_edit_001",
    "gateway_tool_call_bash_001",
  ]);

  return {
    ...coreChecks,
    model_gateway_replaced_scripted_model: true,
    local_tool_runtime_still_executed_tools: true,
  };
}

export function collectModelOutput(events, toolSchemas) {
  const text = [];
  const toolCalls = [];
  const usage = [];

  for (const event of events) {
    if (event.type === "failed") {
      throw new ModelGatewayError(
        "model_failed",
        event.error?.message ?? "Model response failed.",
        { providerCode: event.error?.code },
      );
    }

    if (event.type === "output_text_delta") {
      text.push(event.text ?? "");
    }

    if (event.type === "tool_call") {
      toolCalls.push(event.call);
    }

    if (event.type === "usage") {
      usage.push(event.usage);
    }
  }

  if (toolCalls.length >= 1) {
    return {
      type: "tool_call",
      toolCall: validateToolCall(toolCalls[0], toolSchemas),
      metadata: {
        usage,
        droppedToolCalls: toolCalls.slice(1).map((call) => ({
          id: call.id,
          name: call.name,
        })),
      },
    };
  }

  const content = text.join("").trim();
  if (!content) {
    throw new ModelGatewayError(
      "empty_model_output",
      "Model returned no tool call and no final text.",
    );
  }

  const textToolCall = parseTextToolCall(content);
  if (textToolCall) {
    return {
      type: "tool_call",
      toolCall: validateToolCall(textToolCall, toolSchemas),
      metadata: { usage, recoveredFromText: true },
    };
  }

  return {
    type: "final_answer",
    content,
    metadata: { usage },
  };
}

export function validateToolCall(call, toolSchemas) {
  if (!call || typeof call !== "object") {
    throw new ModelGatewayError("invalid_tool_call", "Tool call must be an object.");
  }

  if (typeof call.id !== "string" || call.id.trim() === "") {
    throw new ModelGatewayError("invalid_tool_call", "Tool call must include id.");
  }

  if (typeof call.name !== "string" || call.name.trim() === "") {
    throw new ModelGatewayError("invalid_tool_call", "Tool call must include name.");
  }

  if (!call.input || typeof call.input !== "object" || Array.isArray(call.input)) {
    throw new ModelGatewayError("invalid_tool_call", "Tool call input must be an object.");
  }

  const schema = toolSchemas.find((item) => item.name === call.name);
  if (!schema) {
    throw new ModelGatewayError(
      "unknown_tool",
      `Model requested unknown tool: ${call.name}.`,
    );
  }

  for (const field of schema.input_schema?.required ?? []) {
    if (!(field in call.input)) {
      throw new ModelGatewayError(
        "invalid_tool_input",
        `Tool ${call.name} requires input.${field}.`,
      );
    }
  }

  return JSON.parse(JSON.stringify(call));
}

export class ModelGatewayError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ModelGatewayError";
    this.code = code;
    this.details = details;
  }
}

function normalizeMockEvents(value) {
  if (Array.isArray(value)) return value;
  if (value?.type) return [value];
  if (value?.events) return value.events;
  throw new ModelGatewayError(
    "invalid_mock_response",
    "Mock response must be an event, event array, or { events } object.",
  );
}

function parseTextToolCall(content) {
  const trimmed = stripJsonFence(content.trim());
  if (!trimmed.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(trimmed);
    return parsed.tool_call ?? parsed.toolCall ?? parsed.function_call ?? null;
  } catch {
    return null;
  }
}

function stripJsonFence(content) {
  const match = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1].trim() : content;
}

function toolCallEvent(id, name, input) {
  return [
    {
      type: "tool_call",
      call: {
        id,
        name,
        input,
      },
    },
    {
      type: "completed",
      responseId: `mock_response_${id}`,
    },
  ];
}

function textEvents(content) {
  return [
    {
      type: "output_text_delta",
      text: content,
    },
    {
      type: "completed",
      responseId: "mock_response_final",
    },
  ];
}

function latestToolResult(messages, name) {
  return [...messages]
    .reverse()
    .find((message) => message.type === "tool_result" && message.name === name);
}

function toResponsesPayload(request) {
  const payload = {
    model: request.model,
    input: request.messages.map(toResponsesMessage),
    tools: request.tools.map(toResponsesTool),
    tool_choice: request.toolChoice,
  };

  if (request.reasoning) {
    payload.reasoning = request.reasoning;
  }

  if (request.maxOutputTokens) {
    payload.max_output_tokens = request.maxOutputTokens;
  }

  return payload;
}

function toResponsesMessage(message) {
  if (message.role === "runtime") {
    return {
      role: "system",
      content: JSON.stringify(message.content),
    };
  }

  if (message.type === "assistant_tool_call") {
    return {
      role: "assistant",
      content: JSON.stringify({ tool_call: message.tool_call }),
    };
  }

  if (message.type === "tool_result") {
    return {
      role: "user",
      content: JSON.stringify({ tool_result: message }),
    };
  }

  return {
    role: message.role,
    content:
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content),
  };
}

function toResponsesTool(tool) {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  };
}

function toChatCompletionsPayload(request) {
  const payload = {
    model: request.model,
    messages: request.messages.map(toChatMessage),
    tools: request.tools.map(toChatTool),
    tool_choice: request.toolChoice,
  };

  if (request.maxOutputTokens) {
    payload.max_tokens = request.maxOutputTokens;
  }

  return payload;
}

function toChatMessage(message) {
  if (message.role === "runtime") {
    return {
      role: "system",
      content: JSON.stringify(message.content),
    };
  }

  if (message.type === "assistant_tool_call") {
    return {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: message.tool_call.id,
          type: "function",
          function: {
            name: message.tool_call.name,
            arguments: JSON.stringify(message.tool_call.input),
          },
        },
      ],
    };
  }

  if (message.type === "tool_result") {
    return {
      role: "tool",
      tool_call_id: message.tool_call_id,
      content: JSON.stringify({ tool_result: message }),
    };
  }

  return {
    role: message.role,
    content:
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content),
  };
}

function toChatTool(tool) {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  };
}

async function parseProviderError(response) {
  try {
    const text = await response.text();
    const parsed = JSON.parse(text);
    return {
      code: parsed.error?.code,
      message: parsed.error?.message,
    };
  } catch {
    return {};
  }
}

function* fromResponsesJson(json) {
  for (const item of json.output ?? []) {
    if (item.type === "function_call") {
      yield {
        type: "tool_call",
        call: {
          id: item.call_id ?? item.id,
          name: item.name,
          input:
            typeof item.arguments === "string"
              ? JSON.parse(item.arguments)
              : item.arguments ?? {},
        },
      };
    }

    if (item.type === "message") {
      for (const content of item.content ?? []) {
        if (content.type === "output_text") {
          yield {
            type: "output_text_delta",
            text: content.text,
          };
        }
      }
    }
  }

  if (json.usage) {
    yield {
      type: "usage",
      usage: json.usage,
    };
  }

  yield {
    type: "completed",
    responseId: json.id,
  };
}

function* fromChatCompletionsJson(json) {
  const message = json.choices?.[0]?.message;

  for (const toolCall of message?.tool_calls ?? []) {
    if (toolCall.type !== "function") continue;
    yield {
      type: "tool_call",
      call: {
        id: toolCall.id,
        name: toolCall.function?.name,
        input:
          typeof toolCall.function?.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function?.arguments ?? {},
      },
    };
  }

  if (message?.content) {
    yield {
      type: "output_text_delta",
      text: message.content,
    };
  }

  if (json.usage) {
    yield {
      type: "usage",
      usage: json.usage,
    };
  }

  yield {
    type: "completed",
    responseId: json.id,
  };
}

async function main() {
  console.log(JSON.stringify(await runModelGatewayDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export { CORE_TOOL_SCHEMAS };
