import assert from "node:assert/strict";
import { PlanController } from "../lab06/plan-mode.mjs";
import { CoreRuntime, createCoreToyWorkspace } from "./core-runtime.mjs";
import {
  EditFirstModel,
  PlanFirstFixModel,
  runPlanModeDemo,
  sampleCorePlan,
  verifyPlanModeResult,
} from "./plan-mode.mjs";

const cases = [];

await record("plan runtime: approved plan enables full fix and verification", async () => {
  const result = await runPlanModeDemo();
  return verifyPlanModeResult(result, result.finalText);
});

await record("plan policy: Edit is denied before plan approval", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  const runtime = new CoreRuntime({
    workspaceRoot,
    model: new EditFirstModel(),
    planController: new PlanController(),
    maxTurns: 2,
  });
  const result = await runtime.run("先不要批准计划，尝试直接编辑。");
  const denied = result.messages.find((message) => message.type === "tool_result");

  assert.equal(denied.status, "denied");
  assert.equal(denied.error.error_type, "plan_mode_denied");
  assert.match(denied.error.message, /not allowed in plan mode/);

  return {
    edit_denied_before_approval: true,
  };
});

await record("plan validation: vague plan is recorded and does not execute", async () => {
  const workspaceRoot = await createCoreToyWorkspace();
  const runtime = new CoreRuntime({
    workspaceRoot,
    model: {
      next() {
        return {
          type: "plan",
          plan: {
            id: "bad_plan",
            objective: "Fix it",
          },
        };
      },
    },
    planController: new PlanController(),
    autoApprovePlan: true,
    maxTurns: 1,
  });

  await assert.rejects(
    () => runtime.run("提出一个空泛计划。"),
    /CoreRuntime exceeded max turns/,
  );

  const invalid = runtime.coreState.planEvents[0];
  assert.equal(invalid.status, "invalid");
  assert.ok(invalid.errors.includes("missing_steps"));

  return {
    invalid_plan_recorded: true,
    execution_not_enabled: runtime.coreState.mode === "plan",
  };
});

await record("plan context: approved plan appears in context snapshots", async () => {
  const result = await runPlanModeDemo();
  const hasActivePlan = result.contextSnapshots.some((snapshot) =>
    snapshot.blocks.some((block) => block.name === "active_plan"),
  );

  assert.equal(hasActivePlan, true);

  return {
    active_plan_in_context: true,
  };
});

await record("plan controller: rejected plan cannot be approved in core path", () => {
  const controller = new PlanController();
  controller.proposePlan(sampleCorePlan());
  controller.rejectPlan("core_plan_001", "Need narrower validation.");
  const approval = controller.approvePlan("core_plan_001");

  assert.equal(approval.status, "error");
  assert.equal(approval.error_type, "plan_rejected");

  return {
    rejected_plan_blocked: true,
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
