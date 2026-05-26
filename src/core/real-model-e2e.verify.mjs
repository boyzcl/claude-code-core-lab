import assert from "node:assert/strict";
import {
  createRealModelGateway,
  runRealModelE2E,
  verifyRealModelRun,
} from "./real-model-e2e.mjs";
import { ModelGatewayError } from "./model-gateway.mjs";

const cases = [];

await record("adapter contract: mock responses drive full local e2e", async () => {
  const captured = [];
  const fetchImpl = createMockResponsesFetch(captured);
  const gateway = createRealModelGateway({
    provider: "responses",
    apiKey: "test-key",
    fetchImpl,
    model: "doubao-seed-2-0-lite-260428",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
  });
  const result = await runRealModelE2E({ gateway });
  const checks = verifyRealModelRun(result);

  assert.equal(captured.length, 5);
  assert.equal(captured[0].url.endsWith("/responses"), true);
  assert.equal(captured[0].body.model, "doubao-seed-2-0-lite-260428");
  assert.equal(captured[0].body.tools.some((tool) => tool.name === "Search"), true);
  assert.equal(JSON.stringify(captured[0].body).includes("test-key"), false);

  return {
    ...checks,
    responses_endpoint_called: true,
    request_body_does_not_include_api_key: true,
  };
});

await record("adapter contract: mock chat completions drive full local e2e", async () => {
  const captured = [];
  const fetchImpl = createMockChatCompletionsFetch(captured);
  const gateway = createRealModelGateway({
    provider: "chat_completions",
    apiKey: "test-key",
    fetchImpl,
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
  });
  const result = await runRealModelE2E({ gateway });
  const checks = verifyRealModelRun(result);

  assert.equal(captured.length, 5);
  assert.equal(captured[0].url.endsWith("/chat/completions"), true);
  assert.equal(captured[0].body.model, "deepseek-chat");
  assert.equal(captured[0].body.tools[0].function.name, "Search");
  assert.equal(JSON.stringify(captured[0].body).includes("test-key"), false);

  return {
    ...checks,
    chat_completions_endpoint_called: true,
    request_body_does_not_include_api_key: true,
  };
});

await record("config: missing api key fails before fetch", async () => {
  const gateway = createRealModelGateway({
    apiKey: null,
    fetchImpl: () => {
      throw new Error("fetch should not be called");
    },
  });

  await assert.rejects(
    () =>
      gateway.next({
        sessionId: "session_test",
        turn: 1,
        messages: [{ role: "user", content: "hello" }],
        tools: [],
      }),
    (error) =>
      error instanceof ModelGatewayError &&
      error.code === "model_failed" &&
      error.details.providerCode === "missing_api_key",
  );

  return {
    missing_key_normalized: true,
    fetch_not_called: true,
  };
});

await record("payload: tool results are fed back as next request input", async () => {
  const captured = [];
  const gateway = createRealModelGateway({
    provider: "responses",
    apiKey: "test-key",
    fetchImpl: createMockResponsesFetch(captured),
  });

  await runRealModelE2E({ gateway });
  const secondPayload = JSON.stringify(captured[1].body.input);
  const thirdPayload = JSON.stringify(captured[2].body.input);

  assert.match(secondPayload, /tool_result/);
  assert.match(secondPayload, /Search/);
  assert.equal(thirdPayload.includes("src/pagination.cjs"), true);
  assert.equal(thirdPayload.includes("start + pageSize + 1"), true);

  return {
    search_result_reentered_model_request: true,
    read_result_reentered_model_request: true,
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

function createMockResponsesFetch(captured) {
  const outputs = [
    functionCall("call_core07_search_001", "Search", {
      query: "pageSize + 1",
    }),
    functionCall("call_core07_read_001", "Read", {
      path: "src/pagination.cjs",
    }),
    functionCall("call_core07_edit_001", "Edit", {
      path: "src/pagination.cjs",
      old_string: "start + pageSize + 1",
      new_string: "start + pageSize",
    }),
    functionCall("call_core07_bash_001", "Bash", {
      command: "node scripts/test.cjs",
    }),
    messageOutput(
      "已修复分页 off-by-one 问题，修改 src/pagination.cjs，并通过 node scripts/test.cjs 验证。",
    ),
  ];

  return async (url, init) => {
    const body = JSON.parse(init.body);
    captured.push({
      url,
      headers: init.headers,
      body,
    });
    const output = outputs[captured.length - 1];

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: `resp_core07_${captured.length}`,
          status: "completed",
          model: body.model,
          output: [output],
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            total_tokens: 15,
          },
        };
      },
    };
  };
}

function createMockChatCompletionsFetch(captured) {
  const outputs = [
    chatToolCall("call_core07_search_001", "Search", {
      query: "pageSize + 1",
    }),
    chatToolCall("call_core07_read_001", "Read", {
      path: "src/pagination.cjs",
    }),
    chatToolCall("call_core07_edit_001", "Edit", {
      path: "src/pagination.cjs",
      old_string: "start + pageSize + 1",
      new_string: "start + pageSize",
    }),
    chatToolCall("call_core07_bash_001", "Bash", {
      command: "node scripts/test.cjs",
    }),
    {
      content:
        "已修复分页 off-by-one 问题，修改 src/pagination.cjs，并通过 node scripts/test.cjs 验证。",
      tool_calls: null,
    },
  ];

  return async (url, init) => {
    const body = JSON.parse(init.body);
    captured.push({
      url,
      headers: init.headers,
      body,
    });
    const output = outputs[captured.length - 1];

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: `chatcmpl_core07_${captured.length}`,
          model: body.model,
          choices: [
            {
              message: {
                role: "assistant",
                content: output.content ?? "",
                tool_calls: output.tool_calls,
              },
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        };
      },
    };
  };
}

function functionCall(callId, name, input) {
  return {
    type: "function_call",
    id: `fc_${callId}`,
    call_id: callId,
    name,
    arguments: JSON.stringify(input),
    status: "completed",
  };
}

function chatToolCall(callId, name, input) {
  return {
    content: "",
    tool_calls: [
      {
        id: callId,
        type: "function",
        function: {
          name,
          arguments: JSON.stringify(input),
        },
      },
    ],
  };
}

function messageOutput(text) {
  return {
    type: "message",
    id: "msg_core07_final",
    status: "completed",
    content: [
      {
        type: "output_text",
        text,
      },
    ],
  };
}
