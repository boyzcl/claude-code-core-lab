import assert from "node:assert/strict";
import {
  CORE20_PLAN_STATE_MACHINE_VERSION,
  PlanStateMachine,
  createPlanStateMachineFixture,
  runPlanStateMachineDemo,
  validatePlanStateMachinePlan,
  verifyPlanStateMachineDemo,
} from "./plan-state-machine.mjs";
import { compactSession } from "../lab07/compaction.mjs";

const cases = [];

await record("core20: plan state machine demo runs and verifies", () => {
  const result = runPlanStateMachineDemo();
  return verifyPlanStateMachineDemo({
    machine: PlanStateMachine.restore(result.restored),
    compacted: result.compacted,
    compactionQuality: result.compactionQuality,
    finalDecision: result.finalDecision,
  });
});

await record("step lifecycle: steps move pending to active to done", () => {
  const machine = approvedMachine();
  const first = machine.findStep("step_1");

  assert.equal(first.status, "pending");
  machine.startStep("step_1");
  assert.equal(machine.findStep("step_1").status, "active");
  machine.completeStep("step_1", { tool: "Search" });
  assert.equal(machine.findStep("step_1").status, "done");

  const traceEvents = machine.trace.map((event) => event.event);
  assert.deepEqual(traceEvents.slice(-2), ["step.active", "step.done"]);

  return {
    step_statuses: machine.plan.steps.map((step) => step.status),
    plan_trace_tail: traceEvents.slice(-2),
  };
});

await record("blocked reason: failed step records structured reason and evidence", () => {
  const machine = approvedMachine();
  machine.startStep("step_2");
  const blocked = machine.blockStep("step_2", "target_file_missing", {
    path: "src/pagination.cjs",
    tool: "Read",
  });

  assert.equal(blocked.status, "blocked");
  assert.equal(machine.plan.status, "blocked");
  assert.equal(machine.findStep("step_2").blockedReason, "target_file_missing");
  assert.equal(
    machine.trace.some(
      (event) =>
        event.event === "step.blocked" && event.reason === "target_file_missing",
    ),
    true,
  );

  return {
    blocked_step: blocked.step.id,
    blocked_reason: blocked.reason,
    evidence: blocked.step.evidence,
  };
});

await record("revision: user change creates revised plan without overwriting history", () => {
  const machine = approvedMachine();
  machine.startStep("step_3");
  machine.blockStep("step_3", "user_changed_requirement", {
    userMessage: "Keep helper signature untouched.",
  });
  const revision = machine.revisePlan({
    reason: "user_changed_requirement",
    userMessage: "Keep helper signature untouched.",
    steps: [
      {
        id: "step_1",
        text: "Reread pagination helper",
        expectedTools: ["Read"],
      },
      {
        id: "step_2",
        text: "Patch caller boundary only",
        expectedTools: ["Edit"],
      },
      {
        id: "step_3",
        text: "Rerun verification",
        expectedTools: ["Bash"],
      },
    ],
  });

  assert.equal(revision.status, "revised");
  assert.equal(revision.previousPlanId, "plan_core20");
  assert.equal(machine.plan.id, "plan_core20_rev1");
  assert.equal(machine.plan.revisionOf, "plan_core20");
  assert.equal(machine.revisions.length, 1);
  assert.equal(machine.revisions[0].previousPlan.steps[2].status, "blocked");
  assert.equal(machine.plan.steps[0].status, "pending");

  return {
    previous_plan_id: revision.previousPlanId,
    active_plan_id: machine.plan.id,
    revision_history_count: machine.revisions.length,
  };
});

await record("resume: compaction preserves active step and restore marks it resumed", () => {
  const machine = approvedMachine();
  machine.startStep("step_3");
  const compacted = compactSession({
    objective: machine.plan.objective,
    latestUserConstraints: ["Do not change the public API."],
    activePlan: machine.snapshot().activePlan,
    modifiedFiles: [],
    latestFailures: [],
    verificationState: {
      status: "not_run",
      command: "node scripts/test.cjs",
    },
    pendingActions: ["Complete active step"],
    messages: [],
    newerMessages: [],
  });
  const restored = PlanStateMachine.restore({
    activePlan: compacted.compactSummary.activePlan,
    planTrace: machine.trace,
    planRevisionLog: machine.revisions,
  });

  assert.equal(compacted.compactSummary.activePlan.currentStepId, "step_3");
  assert.equal(restored.findStep("step_3").status, "resumed");
  assert.equal(
    restored.trace.some((event) => event.event === "step.resumed"),
    true,
  );

  return {
    active_step_after_compaction: compacted.compactSummary.activePlan.currentStepId,
    restored_step_status: restored.findStep("step_3").status,
  };
});

await record("permission: unapproved write tool is denied by plan state", () => {
  const machine = new PlanStateMachine();
  machine.propose(createPlanStateMachineFixture());

  const read = machine.authorizeTool({
    name: "Read",
    input: {
      path: "src/pagination.cjs",
    },
  });
  const edit = machine.authorizeTool({
    name: "Edit",
    input: {
      path: "src/pagination.cjs",
    },
  });

  assert.equal(read.allowed, true);
  assert.equal(edit.allowed, false);
  assert.equal(edit.error_type, "plan_not_approved");

  return {
    read_allowed_before_approval: true,
    edit_denied_before_approval: true,
    error_type: edit.error_type,
  };
});

await record("permission: approved execution is bounded to active step tool", () => {
  const machine = approvedMachine();
  machine.startStep("step_1");

  const search = machine.authorizeTool({ name: "Search", input: { query: "page" } });
  const edit = machine.authorizeTool({
    name: "Edit",
    input: {
      path: "src/pagination.cjs",
    },
  });

  assert.equal(search.allowed, true);
  assert.equal(edit.allowed, false);
  assert.equal(edit.error_type, "tool_outside_active_step");

  return {
    active_step: machine.currentStep().id,
    search_allowed: true,
    edit_denied_outside_active_step: true,
  };
});

await record("final grounding: incomplete plan cannot claim completion", () => {
  const machine = approvedMachine();
  machine.startStep("step_1");
  machine.completeStep("step_1", { tool: "Search" });
  const denied = machine.finalAnswerDecision({
    verificationState: {
      status: "passed",
      command: "node scripts/test.cjs",
    },
  });

  finishPlan(machine);
  const allowed = machine.finalAnswerDecision({
    verificationState: {
      status: "passed",
      command: "node scripts/test.cjs",
      exitCode: 0,
    },
  });

  assert.equal(denied.allowed, false);
  assert.equal(denied.error_type, "plan_incomplete");
  assert.equal(allowed.allowed, true);

  return {
    incomplete_final_denied: true,
    complete_verified_final_allowed: true,
    denied_error_type: denied.error_type,
  };
});

await record("boundary: plan machine is local runtime evidence, not prompt-only claim", () => {
  const result = runPlanStateMachineDemo();

  assert.equal(result.restored.version, CORE20_PLAN_STATE_MACHINE_VERSION);
  assert.equal(result.restored.boundary.deterministicLocalStateMachine, true);
  assert.equal(result.restored.boundary.productionClaudeCodeClaim, false);
  assert.equal(result.restored.boundary.promptOnlyPlanClaim, false);

  return {
    deterministic_local_state_machine: true,
    no_production_claude_code_claim: true,
    no_prompt_only_plan_claim: true,
  };
});

await record("validation: malformed plan is rejected before execution", () => {
  const validation = validatePlanStateMachinePlan({
    id: "bad_plan",
    objective: "Fix it",
    steps: [],
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("missing_steps"));
  assert.ok(validation.errors.includes("missing_validation"));

  return {
    malformed_plan_rejected: true,
    errors: validation.errors,
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

function approvedMachine() {
  const machine = new PlanStateMachine();
  machine.propose(createPlanStateMachineFixture());
  machine.approve("plan_core20");
  return machine;
}

function finishPlan(machine) {
  for (const step of machine.plan.steps) {
    if (step.status === "done") continue;
    if (step.status === "pending") {
      machine.startStep(step.id);
    }
    machine.completeStep(step.id, {
      tool: step.expectedTools[0] ?? "manual",
    });
  }
}
