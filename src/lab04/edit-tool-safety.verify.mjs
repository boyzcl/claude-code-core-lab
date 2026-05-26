import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MessageStore } from "../lab02/message-store.mjs";
import {
  EditRuntime,
  createEditWorkspace,
  runDemo,
  runTool,
  verifyDemo,
} from "./edit-tool-safety.mjs";

const cases = [];

await record("happy path: read-before-edit succeeds", async () => {
  const result = await runDemo();
  return verifyDemo(result);
});

await record("read-before-write: Edit before Read is rejected", async () => {
  const workspaceRoot = await createEditWorkspace();
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  const runtime = new EditRuntime({ workspaceRoot });

  const result = await runTool(store, sessionId, runtime, {
    id: "tool_call_edit_without_read",
    name: "Edit",
    input: {
      path: "src/settings.js",
      old_string: "pageSize = 10",
      new_string: "pageSize = 20",
    },
  });

  assert.equal(result.status, "error");
  assert.equal(result.error.error_type, "file_not_read");
  assert.equal(result.error.recommended_next_tool, "Read");

  return {
    edit_before_read_rejected: true,
    recommended_next_tool: result.error.recommended_next_tool,
  };
});

await record("old_string uniqueness: multiple matches are rejected", async () => {
  const workspaceRoot = await createEditWorkspace({ duplicate: true });
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  const runtime = new EditRuntime({ workspaceRoot });

  await runTool(store, sessionId, runtime, {
    id: "tool_call_read_duplicate",
    name: "Read",
    input: {
      path: "src/settings.js",
    },
  });

  const result = await runTool(store, sessionId, runtime, {
    id: "tool_call_edit_duplicate",
    name: "Edit",
    input: {
      path: "src/settings.js",
      old_string: "10",
      new_string: "20",
    },
  });

  assert.equal(result.status, "error");
  assert.equal(result.error.error_type, "old_string_not_unique");

  return {
    non_unique_old_string_rejected: true,
  };
});

await record("stale file: external change after Read blocks Edit", async () => {
  const workspaceRoot = await createEditWorkspace();
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  const runtime = new EditRuntime({ workspaceRoot });

  await runTool(store, sessionId, runtime, {
    id: "tool_call_read_stale",
    name: "Read",
    input: {
      path: "src/settings.js",
    },
  });

  await writeFile(
    path.join(workspaceRoot, "src/settings.js"),
    "export const pageSize = 15;\n",
    "utf8",
  );

  const result = await runTool(store, sessionId, runtime, {
    id: "tool_call_edit_stale",
    name: "Edit",
    input: {
      path: "src/settings.js",
      old_string: "export const pageSize = 10;",
      new_string: "export const pageSize = 20;",
    },
  });

  assert.equal(result.status, "error");
  assert.equal(result.error.error_type, "stale_file");

  return {
    stale_file_rejected: true,
  };
});

await record("path safety: traversal path is denied", async () => {
  const workspaceRoot = await createEditWorkspace();
  const store = new MessageStore();
  const sessionId = store.createSession({ workspaceRoot });
  const runtime = new EditRuntime({ workspaceRoot });

  const result = await runTool(store, sessionId, runtime, {
    id: "tool_call_edit_escape",
    name: "Edit",
    input: {
      path: "../settings.js",
      old_string: "x",
      new_string: "y",
    },
  });

  assert.equal(result.status, "denied");
  assert.equal(result.error.error_type, "permission_denied");

  return {
    traversal_path_denied: true,
  };
});

await record("successful edit writes exactly one replacement", async () => {
  const result = await runDemo();
  const text = await readFile(path.join(result.workspaceRoot, "src/settings.js"), "utf8");

  assert.equal(text, "export const pageSize = 20;\n");

  return {
    file_content_after_edit: text.trim(),
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
