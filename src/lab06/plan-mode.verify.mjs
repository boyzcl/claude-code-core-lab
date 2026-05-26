import assert from "node:assert/strict";
import {
  PlanController,
  runDemo,
  samplePlan,
  validatePlan,
  verifyDemo,
} from "./plan-mode.mjs";

const cases = [];

record("happy path: valid plan can be approved and executed", () => {
  return verifyDemo(runDemo());
});

record("plan mode: Edit is denied before approval", () => {
  const controller = new PlanController();
  controller.proposePlan(samplePlan());
  const decision = controller.authorizeTool({ name: "Edit" });

  assert.equal(decision.allowed, false);

  return {
    edit_denied_in_plan_mode: true,
  };
});

record("plan validation: vague plan is invalid", () => {
  const result = validatePlan({
    id: "plan_bad",
    objective: "Fix it",
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("missing_steps"));
  assert.ok(result.errors.includes("missing_validation"));

  return {
    vague_plan_invalid: true,
    errors: result.errors,
  };
});

record("rejected plan: cannot be approved later", () => {
  const controller = new PlanController();
  controller.proposePlan(samplePlan());
  controller.rejectPlan("plan_001", "Too broad.");
  const approval = controller.approvePlan("plan_001");

  assert.equal(approval.status, "error");
  assert.equal(approval.error_type, "plan_rejected");

  return {
    rejected_plan_cannot_execute: true,
  };
});

record("approved plan: remains active execution context", () => {
  const controller = new PlanController();
  controller.proposePlan(samplePlan());
  const approval = controller.approvePlan("plan_001");

  assert.equal(approval.activePlan.status, "approved");
  assert.deepEqual(approval.activePlan.expectedFiles, ["src/pagination.js"]);

  return {
    active_plan_preserved: true,
    expected_files: approval.activePlan.expectedFiles,
  };
});

console.log(JSON.stringify({ passed: cases.length, cases }, null, 2));

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
