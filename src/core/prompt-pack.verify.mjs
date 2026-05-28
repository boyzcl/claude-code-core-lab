import assert from "node:assert/strict";
import {
  PromptIgnoringUnsafeModel,
  buildPromptPackSystemPrompt,
  createPromptPackContextEngine,
  runPromptPackRecoveryDemo,
} from "./prompt-pack.mjs";
import { CoreRuntime, createCoreToyWorkspace } from "./core-runtime.mjs";

const cases = [];

await record("prompt pack: recovery demo fixes and verifies", async () => {
  const result = await runPromptPackRecoveryDemo();

  assert.equal(result.checks.prompt_pack_entered_model_request, true);
  assert.equal(result.checks.edit_denial_recovered, true);
  assert.equal(result.checks.bash_denial_recovered, true);
  assert.equal(result.coreState.verificationState.status, "passed");

  return {
    prompt_pack_entered_model_request: true,
    recovery_loop_completed: true,
    verification_passed: true,
  };
});

await record("prompt pack: system prompt contains guidance and boundaries", async () => {
  const prompt = buildPromptPackSystemPrompt();

  assert.match(prompt, /Use Read before Edit/);
  assert.match(prompt, /If Bash is denied/);
  assert.match(prompt, /Prompt guidance is not a permission system/);
  assert.match(prompt, /MessageStore is the source of truth/);

  return {
    tool_order_guidance_present: true,
    recovery_guidance_present: true,
    runtime_boundary_present: true,
  };
});

await record("recovery loop: denied ToolResult re-enters next request", async () => {
  const result = await runPromptPackRecoveryDemo();
  const secondRequestText = JSON.stringify(result.modelRequests[1].messages);

  assert.match(secondRequestText, /file_not_read/);
  assert.match(secondRequestText, /recommended_next_tool/);
  assert.match(secondRequestText, /Read/);

  return {
    denied_tool_result_visible_to_next_turn: true,
  };
});

await record("policy boundary: prompt cannot authorize unsafe Bash", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  const runtime = new CoreRuntime({
    workspaceRoot,
    model: new PromptIgnoringUnsafeModel(),
    contextEngine: createPromptPackContextEngine(),
    maxTurns: 1,
  });

  await assert.rejects(
    () => runtime.run("运行危险命令。"),
    /CoreRuntime exceeded max turns/,
  );

  const denied = runtime.store
    .listMessages(runtime.sessionId)
    .find((message) => message.type === "tool_result" && message.name === "Bash");

  assert.equal(denied.status, "denied");
  assert.equal(denied.error.error_type, "permission_denied");

  return {
    unsafe_bash_denied_despite_prompt: true,
  };
});

await record("context: prompt pack is delivered as system message", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  let observedSystemPrompt = "";
  const model = {
    next(request) {
      observedSystemPrompt = request.messages[0].content;
      return {
        type: "final_answer",
        content: "观察完成。",
      };
    },
  };
  const runtime = new CoreRuntime({
    workspaceRoot,
    model,
    contextEngine: createPromptPackContextEngine(),
  });

  await runtime.run("观察 prompt。");

  assert.match(observedSystemPrompt, /# Tool Order/);
  assert.match(observedSystemPrompt, /# Recovery/);
  assert.match(observedSystemPrompt, /# Boundaries/);

  return {
    prompt_pack_system_message_observed: true,
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
