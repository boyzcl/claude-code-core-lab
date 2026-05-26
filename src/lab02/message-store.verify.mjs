import assert from "node:assert/strict";
import {
  MessageStore,
  StoreError,
  runDemo,
  verifyDemo,
} from "./message-store.mjs";

const cases = [];

record("happy path: append-only MessageStream with linked ToolResult", () => {
  const result = runDemo();
  return verifyDemo(result);
});

record("append-only: returned messages cannot mutate store internals", () => {
  const store = new MessageStore();
  const sessionId = store.createSession();

  store.appendUserMessage(sessionId, "hello");
  const messages = store.listMessages(sessionId);
  messages[0].content = "mutated outside";

  assert.equal(store.listMessages(sessionId)[0].content, "hello");

  return {
    external_mutation_blocked_by_clone: true,
  };
});

record("orphan ToolResult: result before call is rejected", () => {
  const store = new MessageStore();
  const sessionId = store.createSession();

  assertStoreError(
    () =>
      store.appendToolResult(sessionId, {
        id: "tool_result_orphan",
        tool_call_id: "missing_call",
        name: "Read",
        status: "success",
        content: {
          path: "README.md",
          text: "# Demo",
        },
      }),
    "orphan_tool_result",
  );

  assert.deepEqual(store.listMessages(sessionId), []);

  return {
    orphan_tool_result_rejected: true,
    message_stream_unchanged: true,
  };
});

record("duplicate ToolResult: one ToolCall gets one result in lab-02", () => {
  const store = new MessageStore();
  const sessionId = store.createSession();

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
      text: "# Demo",
    },
  });

  assertStoreError(
    () =>
      store.appendToolResult(sessionId, {
        id: "tool_result_duplicate",
        tool_call_id: "tool_call_001",
        name: "Read",
        status: "success",
        content: {
          path: "README.md",
          text: "# Demo again",
        },
      }),
    "duplicate_tool_result",
  );

  return {
    duplicate_tool_result_rejected: true,
  };
});

record("trace: every append is recorded with sequence", () => {
  const result = runDemo();
  const appended = result.trace.filter((event) => event.event === "message.appended");

  assert.deepEqual(
    appended.map((event) => event.sequence),
    [1, 2, 3, 4],
  );

  return {
    trace_has_append_events: appended.length,
    trace_sequences_are_ordered: true,
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

function assertStoreError(fn, code) {
  assert.throws(fn, (error) => error instanceof StoreError && error.code === code);
}
