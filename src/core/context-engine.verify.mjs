import assert from "node:assert/strict";
import { ModelGateway, MockResponsesAdapter, runModelGatewayDemo } from "./model-gateway.mjs";
import { CoreRuntime, createCoreToyWorkspace } from "./core-runtime.mjs";
import {
  CoreContextEngine,
  runContextEngineDemo,
  verifyContextEngineDemo,
} from "./context-engine.mjs";

const cases = [];

await record("gateway runtime: context engine integrated without breaking tool chain", async () => {
  const result = await runModelGatewayDemo();
  const allSnapshotsHaveBlocks = result.contextSnapshots.every(
    (snapshot) => snapshot.blocks.length > 0,
  );

  assert.equal(result.coreState.verificationState.status, "passed");
  assert.equal(allSnapshotsHaveBlocks, true);

  return {
    verification_passed: true,
    context_snapshots_recorded: result.contextSnapshots.length,
  };
});

await record("context selection: hard state survives budget pressure", () => {
  const result = runContextEngineDemo();
  return verifyContextEngineDemo(result);
});

await record("message boundary: artifacted long output is not selected raw context", () => {
  const result = runContextEngineDemo();
  const selectedText = JSON.stringify(result.selectedMessages);

  assert.equal(result.artifacts.length, 1);
  assert.doesNotMatch(selectedText, /FAIL FAIL FAIL FAIL FAIL FAIL FAIL FAIL/);

  return {
    artifact_count: result.artifacts.length,
    selected_messages_avoid_raw_long_output: true,
  };
});

await record("model gateway: adapter receives context object with blocks", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  let sawContext = false;
  const model = new ModelGateway({
    adapter: new MockResponsesAdapter({
      steps: [
        (request) => {
          sawContext =
            Array.isArray(request.context?.blocks) &&
            request.context.blocks.some((block) => block.name === "latest_user");
          return [
            {
              type: "output_text_delta",
              text: "我已经收到经过 Context Engine 组装的请求。",
            },
          ];
        },
      ],
    }),
  });
  const runtime = new CoreRuntime({ workspaceRoot, model, maxTurns: 1 });
  const result = await runtime.run("只检查 context 是否传入模型网关。");

  assert.equal(sawContext, true);
  assert.match(result.coreState.finalAnswer, /Context Engine/);

  return {
    gateway_received_context_blocks: true,
  };
});

await record("context budget: latest failure survives tiny budget", () => {
  const result = runContextEngineDemo();
  const blockNames = result.blocks.map((block) => block.name);

  assert.ok(blockNames.includes("latest_failure"));
  assert.ok(blockNames.includes("verification_state"));

  return {
    latest_failure_preserved: true,
    verification_state_preserved: true,
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
