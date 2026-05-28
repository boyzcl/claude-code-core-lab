import assert from "node:assert/strict";
import {
  executeTool,
  run,
  verifyHappyPath,
} from "./mock-runtime-loop.mjs";

const cases = [];

record("happy path: ToolResult is fed into the second ModelRequest", () => {
  const session = run("请读取 README.md，并告诉我项目名。");
  const checks = verifyHappyPath(session);

  assert.equal(checks.final_answer_from_tool_result, true);
  assert.equal(checks.first_request_has_no_readme_text, true);
  assert.equal(checks.second_request_has_readme_text, true);

  return checks;
});

record("missing tool schema: model cannot call Read", () => {
  const session = run("请读取 README.md，并告诉我项目名。", {
    tools: [],
  });

  assert.equal(session.messages.length, 2);
  assert.equal(session.messages.at(-1).type, "assistant");
  assert.match(session.messages.at(-1).content, /没有暴露 Read tool schema/);

  const firstTrace = session.trace.find(
    (event) => event.event === "model.request.built" && event.turn === 1,
  );
  assert.equal(firstTrace.tool_count, 0);

  return {
    model_refused_to_invent_missing_tool: true,
    tool_count: firstTrace.tool_count,
  };
});

record("policy denial: illegal path becomes denied ToolResult", () => {
  const session = run("请读取 README.md，并告诉我项目名。", {
    requestedPath: "../README.md",
  });

  const deniedResult = session.messages.find(
    (message) => message.type === "tool_result" && message.status === "denied",
  );

  assert.equal(deniedResult.name, "Read");
  assert.equal(deniedResult.error.error_type, "permission_denied");
  assert.equal(deniedResult.error.recoverable, true);
  assert.deepEqual(session.state.readFiles, []);
  assert.match(session.messages.at(-1).content, /读取 README.md 失败/);

  return {
    denied_result_was_appended: true,
    read_files_after_denial: session.state.readFiles,
    final_answer_reports_failure: true,
  };
});

record("tool failure: FakeReadTool returns structured error", () => {
  const result = executeTool({
    id: "tool_call_missing",
    name: "Read",
    input: {
      path: "MISSING.md",
    },
  });

  assert.equal(result.type, "tool_result");
  assert.equal(result.status, "error");
  assert.equal(result.error.error_type, "file_not_found");
  assert.equal(result.error.recoverable, true);

  return {
    error_is_tool_result: true,
    error_type: result.error.error_type,
    recoverable: result.error.recoverable,
  };
});

console.log(
  JSON.stringify(
    {
      passed: cases.length,
      cases,
    },
    null,
    2,
  ),
);

function record(name, fn) {
  try {
    cases.push({
      name,
      status: "passed",
      details: fn(),
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
