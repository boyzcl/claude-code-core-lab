import assert from "node:assert/strict";
import {
  CORE26_HUMAN_APPROVAL_VERSION,
  HumanApprovalError,
  HumanApprovalInterruptionProtocol,
  assertNoHiddenExecution,
  classifyActionRisk,
  createHighRiskBashAction,
  createHumanApprovalFixture,
  createProtectedEditAction,
  humanApprovalBoundary,
  runHumanApprovalInterruptionDemo,
  verifyHumanApprovalInterruptionDemo,
} from "./human-approval-interruption-protocol.mjs";

const cases = [];

await record("core26: human approval demo runs and verifies", async () => {
  const result = await runHumanApprovalInterruptionDemo();
  return verifyHumanApprovalInterruptionDemo(result);
});

await record("high-risk approval: protected edit and Bash enter approval_required", async () => {
  const fixture = await createHumanApprovalFixture();
  const protectedEdit = await fixture.protocol.requestAction(
    createProtectedEditAction(),
  );
  const highRiskBash = await fixture.protocol.requestAction(
    createHighRiskBashAction(),
  );
  const events = await fixture.store.readEvents(fixture.sessionId);

  assert.equal(protectedEdit.status, "approval_required");
  assert.equal(protectedEdit.approval.risk.riskClass, "protected_edit");
  assert.equal(highRiskBash.status, "approval_required");
  assert.equal(highRiskBash.approval.risk.riskClass, "high_risk_bash");
  assert.equal(
    events.filter((event) => event.type === "approval.required").length,
    2,
  );

  return {
    protected_edit_status: protectedEdit.status,
    high_risk_bash_status: highRiskBash.status,
    approval_events: events.filter((event) => event.type === "approval.required").length,
  };
});

await record("approve path: user approval continues execution with trace", async () => {
  const fixture = await createHumanApprovalFixture();
  const request = await fixture.protocol.requestAction(createProtectedEditAction());
  const approved = await fixture.protocol.approve(request.approval.id, {
    approver: "maintainer",
    note: "Reviewed diff preview.",
  });
  const events = await fixture.store.readEvents(fixture.sessionId);
  const approvalIndex = events.findIndex((event) => event.type === "approval.approved");
  const executionIndex = events.findIndex((event) => event.type === "tool.executed");

  assert.equal(approved.status, "approved_and_executed");
  assert.equal(approved.execution.status, "executed");
  assert.ok(approvalIndex >= 0);
  assert.ok(executionIndex > approvalIndex);
  assert.equal(
    approved.runtimeTrace.some((event) => event.event === "tool.executed"),
    true,
  );

  return {
    approval_id: request.approval.id,
    executed_action: approved.execution.action.id,
    approval_event_before_execution: executionIndex > approvalIndex,
  };
});

await record("reject path: user rejection does not execute and revises plan", async () => {
  const fixture = await createHumanApprovalFixture();
  const request = await fixture.protocol.requestAction(createHighRiskBashAction());
  const rejected = await fixture.protocol.reject(request.approval.id, {
    reason: "Not needed for verification.",
  });

  assert.equal(rejected.status, "rejected_plan_revised");
  assert.equal(rejected.executedActionIds.includes("bash_rm_rf"), false);
  assert.equal(rejected.revision.reason, "approval_rejected");
  assert.equal(fixture.protocol.state.activePlan.status, "revised");
  assert.equal(
    fixture.protocol.state.activePlan.steps.find((step) => step.id === "step_2")
      .blockedReason,
    "human_rejected_approval",
  );

  return {
    rejected_action: request.approval.action.id,
    revision_id: rejected.revision.id,
    executed_action_ids: rejected.executedActionIds,
  };
});

await record("interruption: user change pauses active step and adds constraint", async () => {
  const fixture = await createHumanApprovalFixture();
  const interrupted = await fixture.protocol.interrupt({
    newGoal: "Stop protected writes and produce handoff.",
    newConstraint: "No more writes before user review.",
  });
  const events = await fixture.store.readEvents(fixture.sessionId);
  const pausedStep = interrupted.activePlan.steps.find(
    (step) => step.id === interrupted.interruption.pausedStepId,
  );

  assert.equal(interrupted.status, "interrupted");
  assert.equal(pausedStep.status, "paused");
  assert.ok(interrupted.activePlan.constraints.includes("No more writes before user review."));
  assert.ok(events.some((event) => event.type === "session.interrupted"));
  assert.ok(events.some((event) => event.type === "constraint.added"));

  return {
    paused_step: pausedStep.id,
    added_constraint: interrupted.interruption.newConstraint,
    session_events: events
      .filter((event) =>
        ["session.interrupted", "constraint.added", "plan.revised"].includes(
          event.type,
        ),
      )
      .map((event) => event.type),
  };
});

await record("handoff: unfinished task produces recoverable artifact", async () => {
  const fixture = await createHumanApprovalFixture();
  await fixture.protocol.requestAction(createProtectedEditAction());
  await fixture.protocol.interrupt({
    newGoal: "Pause and hand off.",
    newConstraint: "Resume only after approval review.",
  });
  const handoff = await fixture.protocol.buildHandoff();

  assert.equal(handoff.recoverable, true);
  assert.equal(handoff.pendingApprovals.length, 1);
  assert.ok(handoff.pendingActions.length > 0);
  assert.ok(handoff.recoveryInstructions.includes("Restore durable session events."));
  assert.equal(handoff.boundary.productionHumanApprovalClaim, false);

  return {
    handoff_id: handoff.id,
    pending_approvals: handoff.pendingApprovals.map((approval) => approval.id),
    pending_actions: handoff.pendingActions.map((action) => action.stepId),
  };
});

await record("no hidden execution: approval assertion blocks pre-approval execution", async () => {
  const fixture = await createHumanApprovalFixture();
  const denied = await fixture.protocol.attemptHiddenExecution(
    createProtectedEditAction({ id: "hidden_before_approval" }),
  );

  assert.equal(denied.status, "denied");
  assert.equal(denied.executedActionIds.includes("hidden_before_approval"), false);
  assert.equal(denied.assertion.error.error_type, "approval_required");

  const badEvents = [
    {
      seq: 1,
      type: "tool.executed",
      payload: {
        payload: {
          id: "hidden_before_approval",
          approvalRequired: true,
        },
      },
    },
  ];
  assert.throws(
    () => assertNoHiddenExecution(badEvents),
    /Tool executed before approval/,
  );

  return {
    denied_status: denied.status,
    policy_error: denied.assertion.error.error_type,
    injected_hidden_execution_rejected: true,
  };
});

await record("risk classifier: safe action stays outside approval queue", async () => {
  const safeRead = {
    id: "read_rules",
    tool: "Read",
    path: "AGENTS.md",
  };
  const protectedEdit = createProtectedEditAction();
  const highRiskBash = createHighRiskBashAction();

  assert.equal(classifyActionRisk(safeRead).requiresApproval, false);
  assert.equal(
    classifyActionRisk(protectedEdit, {
      protectedPaths: ["src/public-api.cjs"],
    }).riskClass,
    "protected_edit",
  );
  assert.equal(classifyActionRisk(highRiskBash).riskClass, "high_risk_bash");

  return {
    safe_read_requires_approval: false,
    protected_edit_risk: "protected_edit",
    high_risk_bash_risk: "high_risk_bash",
  };
});

await record("boundary: approval protocol is local evidence, not production UI", async () => {
  const result = await runHumanApprovalInterruptionDemo();

  assert.equal(
    CORE26_HUMAN_APPROVAL_VERSION,
    "core26-human-approval-interruption-protocol-v1",
  );
  assert.deepEqual(result.boundary, humanApprovalBoundary());
  assert.equal(result.boundary.deterministicLocalApprovalProtocol, true);
  assert.equal(result.boundary.replayableSessionEvents, true);
  assert.equal(result.boundary.productionHumanApprovalClaim, false);
  assert.equal(result.boundary.guiApprovalProductClaim, false);
  assert.equal(result.boundary.enterprisePolicyClaim, false);

  return {
    deterministic_local_approval_protocol: true,
    replayable_session_events: true,
    no_production_human_approval_claim: true,
    no_gui_approval_product_claim: true,
    no_enterprise_policy_claim: true,
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
      code: error instanceof HumanApprovalError ? error.code : undefined,
    });
    throw error;
  }
}
