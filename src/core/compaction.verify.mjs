import assert from "node:assert/strict";
import { CoreRuntime, createCoreToyWorkspace } from "./core-runtime.mjs";
import { CoreCompactor, runCompactionDemo, verifyCompactionDemo } from "./compaction.mjs";

const cases = [];

await record("compactor: preserves hard state and artifacts long output", () => {
  return verifyCompactionDemo(runCompactionDemo());
});

await record("runtime: compaction triggers before model request", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  let sawCompactSummary = false;
  const runtime = new CoreRuntime({
    workspaceRoot,
    compactor: new CoreCompactor({ messageThreshold: 1, keepRecent: 1 }),
    model: {
      next(request) {
        sawCompactSummary = Boolean(
          request.messages.find((message) =>
            JSON.stringify(message.content).includes("compact_summary"),
          ),
        );
        return {
          type: "final_answer",
          content: "compact summary observed",
        };
      },
    },
  });
  const result = await runtime.run("触发一次 compact。");

  assert.equal(sawCompactSummary, true);
  assert.equal(result.coreState.compactSummary.verificationState, null);

  return {
    compact_summary_entered_context: true,
  };
});

await record("runtime: failed verification cannot become passed after compact", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  const runtime = new CoreRuntime({
    workspaceRoot,
    compactor: new CoreCompactor({ messageThreshold: 1, keepRecent: 1 }),
    model: {
      next() {
        return {
          type: "final_answer",
          content: "stop after compact",
        };
      },
    },
  });
  runtime.coreState.verificationState = {
    status: "failed",
    command: "node scripts/test.cjs",
    exitCode: 1,
  };
  const result = await runtime.run("保留失败验证状态。");

  assert.equal(result.coreState.compactSummary.verificationState.status, "failed");
  assert.notEqual(result.coreState.compactSummary.verificationState.status, "passed");

  return {
    failed_verification_preserved: true,
  };
});

await record("runtime: newer messages remain available after compact", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  const runtime = new CoreRuntime({
    workspaceRoot,
    compactor: new CoreCompactor({ messageThreshold: 1, keepRecent: 1 }),
    model: {
      next(request) {
        const selected = request.context.selectedMessages.map((message) => message.type);
        assert.deepEqual(selected, ["user"]);
        return {
          type: "final_answer",
          content: "newer message preserved",
        };
      },
    },
  });
  const result = await runtime.run("这是 compact 后仍应保留的新消息。");

  assert.equal(result.coreState.compaction.newerMessageCount, 1);

  return {
    newer_messages_preserved: true,
  };
});

await record("context: compact summary does not replace latest user message", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  let latestUserVisible = false;
  const runtime = new CoreRuntime({
    workspaceRoot,
    compactor: new CoreCompactor({ messageThreshold: 1, keepRecent: 1 }),
    model: {
      next(request) {
        latestUserVisible = request.messages.some(
          (message) =>
            message.type === "user" &&
            message.content === "最新用户约束不能被 compact summary 覆盖。",
        );
        return {
          type: "final_answer",
          content: "latest user visible",
        };
      },
    },
  });
  await runtime.run("最新用户约束不能被 compact summary 覆盖。");

  assert.equal(latestUserVisible, true);

  return {
    latest_user_message_preserved: true,
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
