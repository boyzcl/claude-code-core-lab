import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export class MessageStore {
  #sessions = new Map();
  #sessionSeq = 0;
  #messageSeq = 0;
  #traceSeq = 0;

  createSession({
    mode = "normal",
    workspaceRoot = "/workspace/toy-agent",
  } = {}) {
    const id = nextId("session", ++this.#sessionSeq);
    const session = {
      id,
      state: {
        mode,
        workspaceRoot,
        readFiles: [],
        toolResults: [],
        lastAction: null,
      },
      messages: [],
      trace: [],
    };

    this.#sessions.set(id, session);
    this.#recordTrace(session, "session.created", {
      session_id: id,
      workspaceRoot,
      mode,
    });

    return id;
  }

  appendUserMessage(sessionId, content) {
    return this.#appendMessage(sessionId, {
      type: "user",
      role: "user",
      content,
    });
  }

  appendAssistantToolCall(sessionId, toolCall) {
    if (!toolCall?.id) {
      throw new StoreError("invalid_tool_call", "ToolCall must include id.");
    }

    const session = this.#getSession(sessionId);
    const duplicate = session.messages.some(
      (message) =>
        message.type === "assistant_tool_call" &&
        message.tool_call.id === toolCall.id,
    );

    if (duplicate) {
      throw new StoreError(
        "duplicate_tool_call",
        `ToolCall ${toolCall.id} already exists.`,
      );
    }

    return this.#appendMessage(sessionId, {
      type: "assistant_tool_call",
      role: "assistant",
      tool_call: cloneJson(toolCall),
    });
  }

  appendToolResult(sessionId, result) {
    if (!result?.tool_call_id) {
      throw new StoreError(
        "invalid_tool_result",
        "ToolResult must include tool_call_id.",
      );
    }

    const session = this.#getSession(sessionId);
    const toolCall = session.messages.find(
      (message) =>
        message.type === "assistant_tool_call" &&
        message.tool_call.id === result.tool_call_id,
    );

    if (!toolCall) {
      throw new StoreError(
        "orphan_tool_result",
        `ToolResult ${result.id} references unknown ToolCall ${result.tool_call_id}.`,
      );
    }

    const duplicate = session.messages.some(
      (message) =>
        message.type === "tool_result" &&
        message.tool_call_id === result.tool_call_id,
    );

    if (duplicate) {
      throw new StoreError(
        "duplicate_tool_result",
        `ToolCall ${result.tool_call_id} already has a ToolResult.`,
      );
    }

    const message = this.#appendMessage(sessionId, {
      type: "tool_result",
      role: "tool",
      ...cloneJson(result),
    });

    this.#applyToolResultToState(session, result);

    return message;
  }

  appendAssistantMessage(sessionId, content) {
    return this.#appendMessage(sessionId, {
      type: "assistant",
      role: "assistant",
      content,
    });
  }

  listMessages(sessionId) {
    return cloneJson(this.#getSession(sessionId).messages);
  }

  getState(sessionId) {
    return cloneJson(this.#getSession(sessionId).state);
  }

  getTrace(sessionId) {
    return cloneJson(this.#getSession(sessionId).trace);
  }

  buildModelMessageStream(sessionId) {
    return this.listMessages(sessionId);
  }

  #appendMessage(sessionId, message) {
    const session = this.#getSession(sessionId);
    const stored = {
      id: message.id ?? nextId("msg", ++this.#messageSeq),
      sequence: session.messages.length + 1,
      ...cloneJson(message),
    };

    session.messages.push(stored);
    this.#recordTrace(session, "message.appended", {
      message_id: stored.id,
      sequence: stored.sequence,
      message_type: stored.type,
    });

    return cloneJson(stored);
  }

  #applyToolResultToState(session, result) {
    session.state.toolResults.push(result.id);
    session.state.lastAction = result.name;

    if (result.status === "success" && result.name === "Read") {
      session.state.readFiles.push(result.content.path);
    }

    this.#recordTrace(session, "state.updated", {
      readFiles: session.state.readFiles,
      toolResults: session.state.toolResults,
      lastAction: session.state.lastAction,
    });
  }

  #recordTrace(session, event, payload = {}) {
    session.trace.push({
      seq: ++this.#traceSeq,
      event,
      ...cloneJson(payload),
    });
  }

  #getSession(sessionId) {
    const session = this.#sessions.get(sessionId);

    if (!session) {
      throw new StoreError("session_not_found", `Session ${sessionId} not found.`);
    }

    return session;
  }
}

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

export function runDemo() {
  const store = new MessageStore();
  const sessionId = store.createSession();

  store.appendUserMessage(sessionId, "请读取 README.md，并告诉我项目名。");
  store.appendAssistantToolCall(sessionId, {
    id: "tool_call_001",
    name: "Read",
    input: {
      path: "README.md",
    },
  });
  store.appendToolResult(sessionId, {
    id: "tool_result_001",
    tool_call_id: "tool_call_001",
    name: "Read",
    status: "success",
    content: {
      path: "README.md",
      text: "# Toy Agent Runtime\n\nThis is a minimal runtime loop demo.",
    },
  });
  store.appendAssistantMessage(sessionId, "项目名是 Toy Agent Runtime。");

  return {
    sessionId,
    messages: store.listMessages(sessionId),
    state: store.getState(sessionId),
    trace: store.getTrace(sessionId),
    modelMessageStream: store.buildModelMessageStream(sessionId),
  };
}

export function verifyDemo(result) {
  assert.deepEqual(
    result.messages.map((message) => message.type),
    ["user", "assistant_tool_call", "tool_result", "assistant"],
  );
  assert.deepEqual(
    result.messages.map((message) => message.sequence),
    [1, 2, 3, 4],
  );
  assert.deepEqual(result.state.readFiles, ["README.md"]);
  assert.deepEqual(result.state.toolResults, ["tool_result_001"]);
  assert.equal(result.state.lastAction, "Read");
  assert.equal(result.modelMessageStream[2].type, "tool_result");
  assert.equal(result.modelMessageStream[2].tool_call_id, "tool_call_001");
  assert.equal(
    result.trace.some((event) => event.event === "state.updated"),
    true,
  );

  return {
    message_stream_is_ordered: true,
    tool_result_is_linked_to_tool_call: true,
    state_tracks_read_file: true,
    trace_records_state_update: true,
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextId(prefix, value) {
  return `${prefix}_${String(value).padStart(3, "0")}`;
}

function main() {
  const result = runDemo();
  console.log(
    JSON.stringify(
      {
        checks: verifyDemo(result),
        ...result,
      },
      null,
      2,
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
