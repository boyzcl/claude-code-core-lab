import assert from "node:assert/strict";
import {
  CoreRuntime,
  CoreToolRuntime,
  createCoreToyWorkspace,
  runCoreDemo,
  verifyCoreResult,
} from "./core-runtime.mjs";

const cases = [];

await record("happy path: integrated runtime fixes and verifies bug", async () => {
  const result = await runCoreDemo();
  return verifyCoreResult(result, result.finalText);
});

await record("message store integration: every tool result is linked", async () => {
  const result = await runCoreDemo();
  const toolCalls = new Set(
    result.messages
      .filter((message) => message.type === "assistant_tool_call")
      .map((message) => message.tool_call.id),
  );

  for (const message of result.messages.filter((item) => item.type === "tool_result")) {
    assert.equal(toolCalls.has(message.tool_call_id), true);
  }

  return {
    all_tool_results_linked: true,
    tool_result_count: result.messages.filter((item) => item.type === "tool_result").length,
  };
});

await record("policy: Edit without Read returns structured error", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  const tools = new CoreToolRuntime({ workspaceRoot });
  const result = await tools.execute({
    id: "tool_call_edit_without_read",
    name: "Edit",
    input: {
      path: "src/pagination.cjs",
      old_string: "start + pageSize + 1",
      new_string: "start + pageSize",
    },
  });

  assert.equal(result.status, "error");
  assert.equal(result.error.error_type, "file_not_read");
  assert.equal(result.error.recommended_next_tool, "Read");

  return {
    edit_without_read_rejected: true,
  };
});

await record("policy: non-allowlisted Bash is denied", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  const tools = new CoreToolRuntime({ workspaceRoot });
  const result = await tools.execute({
    id: "tool_call_unsafe_bash",
    name: "Bash",
    input: {
      command: "rm -rf .",
    },
  });

  assert.equal(result.status, "denied");
  assert.equal(result.error.error_type, "permission_denied");

  return {
    unsafe_bash_denied: true,
  };
});

await record("runtime: stops with final answer after verification", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  const runtime = new CoreRuntime({ workspaceRoot });
  const result = await runtime.run("修复分页多返回一个元素的问题，并运行测试。");

  assert.equal(result.messages.at(-1).type, "assistant");
  assert.equal(result.coreState.verificationState.status, "passed");
  assert.match(result.messages.at(-1).content, /通过/);

  return {
    final_answer_after_verification: true,
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
