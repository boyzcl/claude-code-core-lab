import assert from "node:assert/strict";
import { MessageStore } from "../lab02/message-store.mjs";
import {
  ToolRuntime,
  createToyWorkspace,
  runDemo,
  runTool,
  verifyDemo,
} from "./read-search-bash.mjs";

const cases = [];

await record("happy path: real Search, Read, Bash results enter MessageStore", async () => {
  const result = await runDemo();
  return verifyDemo(result);
});

await record("Read policy: path traversal is denied as ToolResult", async () => {
  const workspaceRoot = await createToyWorkspace();
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  const runtime = new ToolRuntime({ workspaceRoot });

  const result = await runTool(store, sessionId, runtime, {
    id: "tool_call_read_escape",
    name: "Read",
    input: {
      path: "../README.md",
    },
  });

  assert.equal(result.status, "denied");
  assert.equal(result.error.error_type, "permission_denied");
  assert.equal(result.error.recoverable, true);
  assert.deepEqual(store.getState(sessionId).readFiles, []);

  return {
    unsafe_read_denied: true,
    denied_result_stored: store.listMessages(sessionId).at(-1).status === "denied",
  };
});

await record("Bash policy: non-allowlisted command is denied", async () => {
  const workspaceRoot = await createToyWorkspace();
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  const runtime = new ToolRuntime({ workspaceRoot });

  const result = await runTool(store, sessionId, runtime, {
    id: "tool_call_bash_denied",
    name: "Bash",
    input: {
      command: "rm -rf .",
    },
  });

  assert.equal(result.status, "denied");
  assert.equal(result.error.error_type, "permission_denied");

  return {
    unsafe_bash_denied: true,
    command_was_not_executed: true,
  };
});

await record("Bash failure: non-zero exit is structured ToolResult", async () => {
  const workspaceRoot = await createToyWorkspace();
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  const runtime = new ToolRuntime({ workspaceRoot });

  const result = await runTool(store, sessionId, runtime, {
    id: "tool_call_bash_fail",
    name: "Bash",
    input: {
      command: "node scripts/fail.js",
    },
  });

  assert.equal(result.status, "error");
  assert.equal(result.content.exitCode, 2);
  assert.match(result.content.stderr, /intentional failure/);
  assert.equal(store.getState(sessionId).lastAction, "Bash");

  return {
    bash_failure_is_tool_result: true,
    exit_code_recorded: result.content.exitCode,
    stderr_recorded: true,
  };
});

await record("Search miss: zero matches is still a successful observation", async () => {
  const workspaceRoot = await createToyWorkspace();
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  const runtime = new ToolRuntime({ workspaceRoot });

  const result = await runTool(store, sessionId, runtime, {
    id: "tool_call_search_miss",
    name: "Search",
    input: {
      query: "definitely-not-present",
    },
  });

  assert.equal(result.status, "success");
  assert.deepEqual(result.content.matches, []);

  return {
    search_miss_is_observation: true,
    match_count: result.content.matches.length,
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
