import assert from "node:assert/strict";
import {
  createRealRepoFixtureWorkspace,
  runRealRepoTaskDemo,
} from "./real-repo-task.mjs";
import {
  CoreRuntime,
  CoreToolRuntime,
} from "./core-runtime.mjs";
import { createPromptPackContextEngine } from "./prompt-pack.mjs";

const cases = [];

await record("real repo: task observes rules, recovers stale edit, and verifies", async () => {
  const result = await runRealRepoTaskDemo();

  assert.equal(result.checks.git_status_observed, true);
  assert.equal(result.checks.project_rules_read, true);
  assert.equal(result.checks.test_command_discovered, true);
  assert.equal(result.checks.stale_edit_recovered, true);
  assert.equal(result.checks.verification_passed, true);

  return result.checks;
});

await record("fixture: git status starts clean", async () => {
  const workspaceRoot = await createRealRepoFixtureWorkspace();
  const tools = new CoreToolRuntime({
    workspaceRoot,
    allowedCommands: ["git status --short"],
  });
  const result = await tools.execute({
    id: "core09_git_status_fixture",
    name: "Bash",
    input: {
      command: "git status --short",
    },
  });

  assert.equal(result.status, "success");
  assert.equal(result.content.stdout, "");

  return {
    fixture_git_repo_initialized: true,
  };
});

await record("fixture: npm test initially fails before fix", async () => {
  const workspaceRoot = await createRealRepoFixtureWorkspace();
  const tools = new CoreToolRuntime({
    workspaceRoot,
    allowedCommands: ["npm test"],
  });
  const result = await tools.execute({
    id: "core09_npm_test_fixture",
    name: "Bash",
    input: {
      command: "npm test",
    },
  });

  assert.equal(result.status, "error");
  assert.equal(result.content.exitCode, 1);

  return {
    fixture_test_starts_failing: true,
  };
});

await record("policy: real repo command allowlist denies unknown command", async () => {
  const workspaceRoot = await createRealRepoFixtureWorkspace();
  const tools = new CoreToolRuntime({
    workspaceRoot,
    allowedCommands: ["git status --short", "npm test"],
  });
  const result = await tools.execute({
    id: "core09_denied_command",
    name: "Bash",
    input: {
      command: "npm install",
    },
  });

  assert.equal(result.status, "denied");
  assert.equal(result.error.error_type, "permission_denied");

  return {
    unknown_real_repo_command_denied: true,
  };
});

await record("context: real repo run keeps project rules visible", async () => {
  const result = await runRealRepoTaskDemo();
  const selectedText = JSON.stringify(result.contextSnapshots);
  const requestText = JSON.stringify(result.modelRequests);

  assert.match(requestText, /Project Rules/);
  assert.match(requestText, /Use `npm test` for verification/);
  assert.match(selectedText, /file:AGENTS.md/);

  return {
    project_rules_entered_context: true,
  };
});

await record("runtime: final answer remains verification grounded", async () => {
  const result = await runRealRepoTaskDemo();

  assert.equal(result.coreState.verificationState.status, "passed");
  assert.equal(result.coreState.verificationState.command, "npm test");
  assert.match(result.coreState.finalAnswer, /npm test/);

  return {
    final_answer_grounded_in_npm_test: true,
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
