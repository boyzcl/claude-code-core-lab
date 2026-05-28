import assert from "node:assert/strict";
import {
  CORE_TOOL_SCHEMAS,
  ModelGateway,
  ModelGatewayError,
  MockResponsesAdapter,
  OpenAICompatibleChatCompletionsAdapter,
  OpenAICompatibleResponsesAdapter,
  collectModelOutput,
  runModelGatewayDemo,
  validateToolCall,
} from "./model-gateway.mjs";

const cases = [];

await record("gateway runtime: model gateway fixes and verifies bug", async () => {
  const result = await runModelGatewayDemo();
  assert.equal(result.checks.model_gateway_replaced_scripted_model, true);
  assert.equal(result.coreState.verificationState.status, "passed");

  return {
    model_gateway_replaced_scripted_model: true,
    verification_passed: true,
  };
});

await record("parser: text-only model output becomes final answer", async () => {
  const output = collectModelOutput(
    [
      { type: "output_text_delta", text: "任务已经完成" },
      { type: "completed", responseId: "response_final" },
    ],
    CORE_TOOL_SCHEMAS,
  );

  assert.equal(output.type, "final_answer");
  assert.equal(output.content, "任务已经完成");

  return {
    final_answer_parsed: true,
  };
});

await record("parser: explicit text tool_call JSON is recovered", async () => {
  const output = collectModelOutput(
    [
      {
        type: "output_text_delta",
        text: JSON.stringify({
          tool_call: {
            id: "text_tool_call_edit",
            name: "Edit",
            input: {
              path: "src/pagination.cjs",
              old_string: "start + pageSize + 1",
              new_string: "start + pageSize",
            },
          },
        }),
      },
      { type: "completed", responseId: "response_text_tool_call" },
    ],
    CORE_TOOL_SCHEMAS,
  );

  assert.equal(output.type, "tool_call");
  assert.equal(output.metadata.recoveredFromText, true);
  assert.equal(output.toolCall.name, "Edit");

  return {
    explicit_text_tool_call_recovered: true,
  };
});

await record("parser: multiple tool calls are normalized to first call", async () => {
  const output = collectModelOutput(
    [
      {
        type: "tool_call",
        call: {
          id: "tool_call_search",
          name: "Search",
          input: { query: "pageSize + 1" },
        },
      },
      {
        type: "tool_call",
        call: {
          id: "tool_call_bash",
          name: "Bash",
          input: { command: "node scripts/test.cjs" },
        },
      },
    ],
    CORE_TOOL_SCHEMAS,
  );

  assert.equal(output.type, "tool_call");
  assert.equal(output.toolCall.name, "Search");
  assert.deepEqual(output.metadata.droppedToolCalls, [
    {
      id: "tool_call_bash",
      name: "Bash",
    },
  ]);

  return {
    first_tool_call_selected: true,
    extra_tool_calls_recorded_in_metadata: true,
  };
});

await record("validator: unknown model tool is rejected before execution", async () => {
  assert.throws(
    () =>
      validateToolCall(
        {
          id: "tool_call_unknown",
          name: "DeleteEverything",
          input: {},
        },
        CORE_TOOL_SCHEMAS,
      ),
    (error) => error instanceof ModelGatewayError && error.code === "unknown_tool",
  );

  return {
    unknown_tool_rejected_by_gateway: true,
  };
});

await record("validator: missing required tool input is rejected", async () => {
  assert.throws(
    () =>
      validateToolCall(
        {
          id: "tool_call_read_missing_path",
          name: "Read",
          input: {},
        },
        CORE_TOOL_SCHEMAS,
      ),
    (error) => error instanceof ModelGatewayError && error.code === "invalid_tool_input",
  );

  return {
    missing_required_input_rejected: true,
  };
});

await record("adapter: provider failure is normalized as model_failed", async () => {
  const gateway = new ModelGateway({
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
  });

  await assert.rejects(
    () =>
      gateway.next({
        sessionId: "session_test",
        turn: 1,
        messages: [],
        tools: CORE_TOOL_SCHEMAS,
      }),
    (error) => error instanceof ModelGatewayError && error.code === "model_failed",
  );

  return {
    provider_failure_normalized: true,
  };
});

await record("adapter: provider http error preserves provider code", async () => {
  const gateway = new ModelGateway({
    adapter: new OpenAICompatibleResponsesAdapter({
      apiKey: "test-key",
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        async text() {
          return JSON.stringify({
            error: {
              code: "AccountOverdueError",
              message: "The request failed because your account has an overdue balance.",
            },
          });
        },
      }),
    }),
  });

  await assert.rejects(
    () =>
      gateway.next({
        sessionId: "session_test",
        turn: 1,
        messages: [],
        tools: CORE_TOOL_SCHEMAS,
      }),
    (error) =>
      error instanceof ModelGatewayError &&
      error.code === "model_failed" &&
      error.details.providerCode === "AccountOverdueError",
  );

  return {
    provider_http_error_code_preserved: true,
  };
});

await record("openai-compatible adapter: response json maps to tool call event", async () => {
  const adapter = new OpenAICompatibleResponsesAdapter({
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          id: "response_test",
          output: [
            {
              type: "function_call",
              call_id: "tool_call_search",
              name: "Search",
              arguments: JSON.stringify({ query: "pageSize + 1" }),
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 4,
          },
        };
      },
    }),
  });

  const gateway = new ModelGateway({ adapter, model: "test-model" });
  const output = await gateway.next({
    sessionId: "session_test",
    turn: 1,
    messages: [],
    tools: CORE_TOOL_SCHEMAS,
  });

  assert.equal(output.type, "tool_call");
  assert.equal(output.toolCall.name, "Search");
  assert.deepEqual(output.toolCall.input, { query: "pageSize + 1" });

  return {
    responses_json_mapped_to_tool_call: true,
  };
});

await record("chat-completions adapter: tool call json maps to tool call event", async () => {
  const adapter = new OpenAICompatibleChatCompletionsAdapter({
    apiKey: "test-key",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          id: "chatcmpl_test",
          choices: [
            {
              message: {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "tool_call_search",
                    type: "function",
                    function: {
                      name: "Search",
                      arguments: JSON.stringify({ query: "pageSize + 1" }),
                    },
                  },
                ],
              },
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 4,
          },
        };
      },
    }),
  });

  const gateway = new ModelGateway({ adapter, model: "test-model" });
  const output = await gateway.next({
    sessionId: "session_test",
    turn: 1,
    messages: [],
    tools: CORE_TOOL_SCHEMAS,
  });

  assert.equal(output.type, "tool_call");
  assert.equal(output.toolCall.name, "Search");
  assert.deepEqual(output.toolCall.input, { query: "pageSize + 1" });

  return {
    chat_completions_json_mapped_to_tool_call: true,
  };
});

console.log(JSON.stringify({ passed: cases.length, cases }, null, 2));

async function record(name, fn) {
  try {
    cases.push({
      name,
      status: "passed",
      details: await fn(),
    });
  } catch (error) {
    cases.push({
      name,
      status: "failed",
      message: error.message,
    });
    throw error;
  }
}
