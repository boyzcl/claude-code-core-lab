import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export const READ_TOOL_SCHEMA = {
  name: "Read",
  description: "Read a text file from the current workspace.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Workspace-relative file path.",
      },
    },
    required: ["path"],
  },
};

export function createSession() {
  return {
    id: "session_001",
    messages: [],
    requests: [],
    state: {
      mode: "normal",
      workspaceRoot: "/workspace/toy-agent",
      readFiles: [],
      toolResults: [],
      lastAction: null,
    },
    trace: [
      {
        event: "session.created",
        session_id: "session_001",
      },
    ],
  };
}

export function appendMessage(session, message) {
  session.messages.push(message);
  session.trace.push({
    event: "message.appended",
    message_type: message.type,
  });
}

export function buildModelRequest(session, turn, tools = [READ_TOOL_SCHEMA]) {
  const request = {
    messages: [
      {
        role: "system",
        content:
          "You are a local coding agent. Use tools when information is missing. Do not claim to know file contents unless a tool result provides them.",
      },
      {
        role: "runtime",
        content: {
          mode: session.state.mode,
          workspaceRoot: session.state.workspaceRoot,
          readFiles: session.state.readFiles,
          knownFacts: session.state.toolResults,
        },
      },
      ...session.messages,
    ],
    tools,
  };

  session.requests.push({
    turn,
    request: cloneJson(request),
  });

  session.trace.push({
    event: "model.request.built",
    turn,
    message_count: session.messages.length,
    tool_count: request.tools.length,
    tool_names: request.tools.map((tool) => tool.name),
    has_read_result: Boolean(findLatestToolResult(request.messages, "Read")),
    has_readme_text: containsText(request.messages, "# Toy Agent Runtime"),
  });

  return request;
}

export function findLatestToolResult(messages, toolName) {
  return [...messages]
    .reverse()
    .find((message) => message.type === "tool_result" && message.name === toolName);
}

export function createMockModel({
  requestedPath = "README.md",
  requireToolSchema = true,
} = {}) {
  return function mockModel(request) {
    const readResult = findLatestToolResult(request.messages, "Read");

    if (!readResult) {
      const hasReadTool = request.tools.some((tool) => tool.name === "Read");

      if (requireToolSchema && !hasReadTool) {
        return {
          type: "final_answer",
          content: "无法读取 README.md：当前 ModelRequest 没有暴露 Read tool schema。",
        };
      }

      return {
        type: "tool_call",
        toolCall: {
          id: "tool_call_001",
          name: "Read",
          input: {
            path: requestedPath,
          },
        },
      };
    }

    if (readResult.status !== "success") {
      return {
        type: "final_answer",
        content: `读取 README.md 失败：${readResult.error.message}`,
      };
    }

    const title = readResult.content.text
      .split("\n")[0]
      .replace(/^#\s*/, "")
      .trim();

    return {
      type: "final_answer",
      content: `项目名是 ${title}。`,
    };
  };
}

export const mockModel = createMockModel();

export function authorize(toolCall) {
  if (toolCall.name !== "Read") {
    return {
      allowed: false,
      reason: "Only Read is allowed in lab-01.",
    };
  }

  const path = toolCall.input?.path;
  if (path !== "README.md" || path.startsWith("/") || path.includes("..")) {
    return {
      allowed: false,
      reason: "Only workspace-relative README.md can be read in lab-01.",
    };
  }

  return {
    allowed: true,
    reason: "Read README.md is allowed.",
  };
}

export function executeTool(toolCall) {
  if (toolCall.name !== "Read") {
    return makeErrorToolResult(toolCall, "unknown_tool", "Unknown tool.");
  }

  if (toolCall.input.path !== "README.md") {
    return makeErrorToolResult(
      toolCall,
      "file_not_found",
      "FakeReadTool only contains README.md.",
    );
  }

  return {
    type: "tool_result",
    id: "tool_result_001",
    tool_call_id: toolCall.id,
    name: "Read",
    status: "success",
    content: {
      path: "README.md",
      text: "# Toy Agent Runtime\n\nThis is a minimal runtime loop demo.",
    },
    metadata: {
      bytes: 62,
    },
  };
}

export function makeDeniedToolResult(toolCall, decision) {
  return {
    type: "tool_result",
    id: `tool_result_denied_${toolCall.id}`,
    tool_call_id: toolCall.id,
    name: toolCall.name,
    status: "denied",
    error: {
      error_type: "permission_denied",
      message: decision.reason,
      recoverable: true,
      recommended_next_tool: null,
    },
  };
}

export function makeErrorToolResult(toolCall, errorType, message) {
  return {
    type: "tool_result",
    id: `tool_result_error_${toolCall.id}`,
    tool_call_id: toolCall.id,
    name: toolCall.name,
    status: "error",
    error: {
      error_type: errorType,
      message,
      recoverable: true,
      recommended_next_tool: null,
    },
  };
}

export function applyToolResultToState(session, result) {
  session.state.toolResults.push(result.id);
  session.state.lastAction = result.name;

  if (result.status === "success" && result.name === "Read") {
    session.state.readFiles.push(result.content.path);
  }

  session.trace.push({
    event: "state.updated",
    readFiles: session.state.readFiles,
    toolResults: session.state.toolResults,
    lastAction: session.state.lastAction,
  });
}

export function run(userText, options = {}) {
  const session = createSession();
  const tools = options.tools ?? [READ_TOOL_SCHEMA];
  const model =
    options.model ??
    createMockModel({
      requestedPath: options.requestedPath ?? "README.md",
      requireToolSchema: options.requireToolSchema ?? true,
    });
  const maxTurns = options.maxTurns ?? 3;

  appendMessage(session, {
    type: "user",
    id: "msg_user_001",
    role: "user",
    content: userText,
  });

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const request = buildModelRequest(session, turn, tools);
    const output = model(request, turn);

    session.trace.push({
      event: "model.output",
      turn,
      output_type: output.type,
      tool: output.type === "tool_call" ? output.toolCall.name : undefined,
    });

    if (output.type === "final_answer") {
      appendMessage(session, {
        type: "assistant",
        id: `msg_assistant_final_${turn}`,
        role: "assistant",
        content: output.content,
      });
      return session;
    }

    appendMessage(session, {
      type: "assistant_tool_call",
      id: `msg_assistant_tool_call_${turn}`,
      role: "assistant",
      tool_call: output.toolCall,
    });

    const decision = authorize(output.toolCall);
    session.trace.push({
      event: "tool.authorized",
      tool: output.toolCall.name,
      allowed: decision.allowed,
      reason: decision.reason,
    });

    const result = decision.allowed
      ? executeTool(output.toolCall)
      : makeDeniedToolResult(output.toolCall, decision);

    session.trace.push({
      event: "tool.executed",
      tool: output.toolCall.name,
      status: result.status,
    });

    appendMessage(session, result);
    applyToolResultToState(session, result);
  }

  throw new Error("Loop exceeded max turns");
}

export function verifyHappyPath(session) {
  assert.equal(session.messages.at(-1).content, "项目名是 Toy Agent Runtime。");
  assert.deepEqual(session.state.readFiles, ["README.md"]);

  const firstTrace = findRequestTrace(session, 1);
  const secondTrace = findRequestTrace(session, 2);
  assert.equal(firstTrace.tool_count, 1);
  assert.deepEqual(firstTrace.tool_names, ["Read"]);
  assert.equal(firstTrace.has_read_result, false);
  assert.equal(firstTrace.has_readme_text, false);
  assert.equal(secondTrace.has_read_result, true);
  assert.equal(secondTrace.has_readme_text, true);

  const firstRequest = session.requests.find((entry) => entry.turn === 1).request;
  const secondRequest = session.requests.find((entry) => entry.turn === 2).request;
  assert.equal(firstRequest.tools.some((tool) => tool.name === "Read"), true);
  assert.equal(containsText(firstRequest.messages, "# Toy Agent Runtime"), false);
  assert.equal(containsText(secondRequest.messages, "# Toy Agent Runtime"), true);

  const messageTypes = session.messages.map((message) => message.type);
  assert.deepEqual(messageTypes, [
    "user",
    "assistant_tool_call",
    "tool_result",
    "assistant",
  ]);

  return {
    final_answer_from_tool_result: true,
    tool_schema_is_exposed: true,
    first_request_has_no_read_result: true,
    first_request_has_no_readme_text: true,
    second_request_has_read_result: true,
    second_request_has_readme_text: true,
    message_stream_order_is_valid: true,
  };
}

function findRequestTrace(session, turn) {
  return session.trace.find(
    (event) => event.event === "model.request.built" && event.turn === turn,
  );
}

function containsText(value, text) {
  return JSON.stringify(value).includes(text);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatSession(session) {
  return {
    finalAnswer: session.messages.at(-1).content,
    checks: verifyHappyPath(session),
    state: session.state,
    messageStream: session.messages,
    trace: session.trace,
  };
}

function main() {
  const session = run("请读取 README.md，并告诉我项目名。");
  console.log(JSON.stringify(formatSession(session), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
