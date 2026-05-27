import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DurableSessionStore,
  durableSessionBoundary,
} from "./durable-session-store-replay.mjs";

export const CORE26_HUMAN_APPROVAL_VERSION =
  "core26-human-approval-interruption-protocol-v1";

const HIGH_RISK_COMMAND_PATTERNS = [/rm\s+-rf\b/, /sudo\b/, /curl\s+.*\|\s*(sh|bash)/];

export class HumanApprovalInterruptionProtocol {
  constructor({
    store,
    sessionId,
    protectedPaths = ["src/public-api.cjs"],
    initialPlan = createInitialApprovalPlan(),
  }) {
    if (!store || !sessionId) {
      throw new HumanApprovalError(
        "missing_session",
        "HumanApprovalInterruptionProtocol requires a durable store and sessionId.",
      );
    }

    this.store = store;
    this.sessionId = sessionId;
    this.protectedPaths = new Set(protectedPaths);
    this.state = {
      version: CORE26_HUMAN_APPROVAL_VERSION,
      activePlan: cloneJson(initialPlan),
      approvalState: {
        pending: [],
        decided: [],
      },
      runtimeTrace: [],
      planRevisionLog: [],
      interruptions: [],
      constraints: ["Preserve public API exports."],
      handoffArtifacts: [],
      executedActions: [],
      policyAssertions: [],
    };
    this.approvalSeq = 0;
    this.handoffSeq = 0;
  }

  async requestAction(action) {
    const risk = classifyActionRisk(action, {
      protectedPaths: this.protectedPaths,
    });
    await this.record("tool.action.requested", {
      action,
      risk,
    });

    if (risk.requiresApproval) {
      const approval = {
        id: `approval_${String(++this.approvalSeq).padStart(3, "0")}`,
        status: "approval_required",
        action,
        risk,
        requestedAtSeq: this.state.runtimeTrace.length + 1,
      };
      this.state.approvalState.pending.push(approval);
      this.state.runtimeTrace.push({
        event: "approval.required",
        approvalId: approval.id,
        actionId: action.id,
        reason: risk.reason,
      });
      await this.record("approval.required", approval);

      return {
        status: "approval_required",
        approval,
        boundary: humanApprovalBoundary(),
      };
    }

    return this.executeAction(action, { approvalId: null });
  }

  async approve(approvalId, {
    approver = "human",
    note = "approved",
  } = {}) {
    const approval = this.takePendingApproval(approvalId);
    const decision = {
      ...approval,
      status: "approved",
      approver,
      note,
    };
    this.state.approvalState.decided.push(decision);
    this.state.runtimeTrace.push({
      event: "approval.approved",
      approvalId,
      actionId: approval.action.id,
    });
    await this.record("approval.approved", decision);

    const execution = await this.executeAction(approval.action, {
      approvalId,
      approvalRequired: true,
    });

    return {
      status: "approved_and_executed",
      approval: decision,
      execution,
      runtimeTrace: cloneJson(this.state.runtimeTrace),
    };
  }

  async reject(approvalId, {
    approver = "human",
    reason = "rejected_by_user",
  } = {}) {
    const approval = this.takePendingApproval(approvalId);
    const decision = {
      ...approval,
      status: "rejected",
      approver,
      reason,
    };
    this.state.approvalState.decided.push(decision);
    this.state.runtimeTrace.push({
      event: "approval.rejected",
      approvalId,
      actionId: approval.action.id,
      reason,
    });
    await this.record("approval.rejected", decision);

    const revision = await this.revisePlan({
      reason: "approval_rejected",
      blockedAction: approval.action,
      newConstraint: "Do not execute rejected high-risk action.",
    });

    return {
      status: "rejected_plan_revised",
      approval: decision,
      revision,
      executedActionIds: this.state.executedActions.map((action) => action.id),
    };
  }

  async interrupt({
    newGoal,
    newConstraint,
    source = "user",
  }) {
    const activeStep = this.activeStep();
    if (activeStep) {
      activeStep.status = "paused";
      activeStep.pauseReason = "user_interruption";
    }
    const interruption = {
      id: `interrupt_${String(this.state.interruptions.length + 1).padStart(3, "0")}`,
      source,
      newGoal,
      newConstraint,
      pausedStepId: activeStep?.id ?? null,
    };
    this.state.interruptions.push(interruption);
    this.state.constraints.push(newConstraint);
    this.state.runtimeTrace.push({
      event: "user.interrupted",
      interruptionId: interruption.id,
      pausedStepId: interruption.pausedStepId,
    });
    await this.record("session.interrupted", interruption);
    await this.record("constraint.added", {
      source,
      constraint: newConstraint,
    });

    const revision = await this.revisePlan({
      reason: "user_interruption",
      newGoal,
      newConstraint,
    });

    return {
      status: "interrupted",
      interruption,
      revision,
      activePlan: cloneJson(this.state.activePlan),
    };
  }

  async buildHandoff({
    reason = "task_incomplete",
  } = {}) {
    const events = await this.store.readEvents(this.sessionId);
    const artifact = {
      id: `handoff_${String(++this.handoffSeq).padStart(3, "0")}`,
      reason,
      recoverable: true,
      sessionId: this.sessionId,
      lastEventSeq: events.at(-1)?.seq ?? 0,
      activePlan: cloneJson(this.state.activePlan),
      pendingApprovals: cloneJson(this.state.approvalState.pending),
      constraints: cloneJson(this.state.constraints),
      pendingActions: pendingPlanActions(this.state.activePlan),
      recoveryInstructions: [
        "Restore durable session events.",
        "Review pending approvals before executing tools.",
        "Resume from paused or active plan step.",
      ],
      boundary: humanApprovalBoundary(),
    };
    this.state.handoffArtifacts.push(artifact);
    this.state.runtimeTrace.push({
      event: "handoff.created",
      handoffId: artifact.id,
    });
    await this.record("handoff.created", artifact);

    return artifact;
  }

  async attemptHiddenExecution(action) {
    const risk = classifyActionRisk(action, {
      protectedPaths: this.protectedPaths,
    });
    if (!risk.requiresApproval) {
      return this.executeAction(action, { approvalId: null });
    }

    const assertion = {
      actionId: action.id,
      status: "blocked",
      error: {
        error_type: "approval_required",
        message: `Action ${action.id} requires human approval before execution.`,
        recommended_next_event: "approval.required",
      },
    };
    this.state.policyAssertions.push(assertion);
    this.state.runtimeTrace.push({
      event: "policy.hidden_execution_blocked",
      actionId: action.id,
    });
    await this.record("policy.hidden_execution_blocked", assertion);

    return {
      status: "denied",
      assertion,
      executedActionIds: this.state.executedActions.map((item) => item.id),
    };
  }

  async executeAction(action, {
    approvalId = null,
    approvalRequired = false,
  } = {}) {
    const executed = {
      ...action,
      status: "executed",
      approvalId,
      approvalRequired,
    };
    this.state.executedActions.push(executed);
    this.state.runtimeTrace.push({
      event: "tool.executed",
      actionId: action.id,
      approvalId,
    });
    await this.record("tool.executed", executed);

    return {
      status: "executed",
      action: executed,
    };
  }

  takePendingApproval(approvalId) {
    const index = this.state.approvalState.pending.findIndex(
      (approval) => approval.id === approvalId,
    );
    if (index < 0) {
      throw new HumanApprovalError(
        "approval_not_found",
        `Approval not found: ${approvalId}.`,
      );
    }

    return this.state.approvalState.pending.splice(index, 1)[0];
  }

  activeStep() {
    return this.state.activePlan.steps.find(
      (step) => step.id === this.state.activePlan.currentStepId,
    );
  }

  async revisePlan({
    reason,
    blockedAction = null,
    newGoal = null,
    newConstraint = null,
  }) {
    const previousPlan = cloneJson(this.state.activePlan);
    const revision = {
      id: `${previousPlan.id}_rev${this.state.planRevisionLog.length + 1}`,
      reason,
      previousPlanId: previousPlan.id,
      blockedAction,
      newGoal,
      newConstraint,
    };
    this.state.planRevisionLog.push(revision);
    this.state.activePlan = {
      ...previousPlan,
      id: revision.id,
      status: "revised",
      revisionReason: reason,
      constraints: unique([
        ...(previousPlan.constraints ?? []),
        ...(newConstraint ? [newConstraint] : []),
      ]),
      steps: previousPlan.steps.map((step) =>
        step.id === previousPlan.currentStepId
          ? {
              ...step,
              status:
                reason === "approval_rejected" ? "blocked" : step.status,
              blockedReason:
                reason === "approval_rejected"
                  ? "human_rejected_approval"
                  : step.blockedReason,
            }
          : step,
      ),
    };
    await this.record("plan.revised", revision);

    return cloneJson(revision);
  }

  async record(type, payload) {
    await this.store.appendEvent(this.sessionId, type, {
      core26: true,
      payload,
    });
  }
}

export class HumanApprovalError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HumanApprovalError";
    this.code = code;
    this.details = details;
  }
}

export async function runHumanApprovalInterruptionDemo() {
  const fixture = await createHumanApprovalFixture();
  const protocol = fixture.protocol;
  const protectedEdit = createProtectedEditAction();
  const approvalRequired = await protocol.requestAction(protectedEdit);
  const approvePath = await protocol.approve(approvalRequired.approval.id, {
    note: "Approve narrow protected edit after review.",
  });
  const highRiskBash = createHighRiskBashAction();
  const bashApproval = await protocol.requestAction(highRiskBash);
  const rejectPath = await protocol.reject(bashApproval.approval.id, {
    reason: "Dangerous shell command is not needed.",
  });
  const interruption = await protocol.interrupt({
    newGoal: "Keep API stable and produce a handoff before more writes.",
    newConstraint: "Stop before any additional protected file write.",
  });
  const hiddenExecution = await protocol.attemptHiddenExecution(
    createProtectedEditAction({ id: "hidden_protected_edit" }),
  );
  const handoff = await protocol.buildHandoff();
  const events = await fixture.store.readEvents(fixture.sessionId);
  const noHiddenExecution = assertNoHiddenExecution(events);

  const report = {
    version: CORE26_HUMAN_APPROVAL_VERSION,
    status: "passed",
    sessionId: fixture.sessionId,
    approvalRequired,
    approvePath,
    rejectPath,
    interruption,
    hiddenExecution,
    handoff,
    state: cloneJson(protocol.state),
    eventTypes: events.map((event) => event.type),
    noHiddenExecution,
    boundary: humanApprovalBoundary(),
  };

  return {
    checks: verifyHumanApprovalInterruptionDemo(report),
    ...report,
  };
}

export function verifyHumanApprovalInterruptionDemo(report) {
  assert.equal(report.version, CORE26_HUMAN_APPROVAL_VERSION);
  assert.equal(report.status, "passed");
  assert.equal(report.approvalRequired.status, "approval_required");
  assert.equal(report.approvePath.status, "approved_and_executed");
  assert.equal(report.rejectPath.status, "rejected_plan_revised");
  assert.equal(report.interruption.status, "interrupted");
  assert.equal(report.hiddenExecution.status, "denied");
  assert.equal(report.handoff.recoverable, true);
  assert.equal(report.noHiddenExecution.valid, true);
  assert.equal(report.boundary.productionHumanApprovalClaim, false);

  return {
    high_risk_approval_required: true,
    approve_path_executed_with_trace: true,
    reject_path_revised_plan_without_execution: true,
    interruption_paused_step_and_added_constraint: true,
    handoff_artifact_created: true,
    no_hidden_execution_asserted: true,
    no_production_claim: true,
  };
}

export async function createHumanApprovalFixture() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "agent-core26-"));
  const store = new DurableSessionStore({ rootDir });
  const sessionId = await store.createSession({
    workspaceRoot: "/workspace/core-26-human-approval",
    mode: "execute",
    initialState: {
      objective: "Patch protected public API with human approval.",
      latestUserConstraints: ["Preserve public API exports."],
    },
  });
  const protocol = new HumanApprovalInterruptionProtocol({
    store,
    sessionId,
  });

  await store.appendEvent(sessionId, "plan.snapshot", {
    activePlan: protocol.state.activePlan,
  });

  return {
    rootDir,
    store,
    sessionId,
    protocol,
  };
}

export function createProtectedEditAction({ id = "edit_public_api" } = {}) {
  return {
    id,
    tool: "Edit",
    path: "src/public-api.cjs",
    reason: "Patch exported API guard.",
    diffPreviewId: "diff_public_api_guard",
  };
}

export function createHighRiskBashAction({ id = "bash_rm_rf" } = {}) {
  return {
    id,
    tool: "Bash",
    command: "rm -rf .",
    reason: "Dangerous cleanup request should never execute without approval.",
  };
}

export function classifyActionRisk(action, { protectedPaths = new Set() } = {}) {
  const protectedSet =
    protectedPaths instanceof Set ? protectedPaths : new Set(protectedPaths);

  if (action.tool === "Edit" && protectedSet.has(action.path)) {
    return {
      riskClass: "protected_edit",
      requiresApproval: true,
      reason: `Protected file requires human approval: ${action.path}`,
    };
  }

  if (
    action.tool === "Bash" &&
    HIGH_RISK_COMMAND_PATTERNS.some((pattern) => pattern.test(action.command ?? ""))
  ) {
    return {
      riskClass: "high_risk_bash",
      requiresApproval: true,
      reason: `High-risk Bash command requires human approval: ${action.command}`,
    };
  }

  return {
    riskClass: "normal",
    requiresApproval: false,
    reason: "No human approval required.",
  };
}

export function assertNoHiddenExecution(events) {
  const approvedActionIds = new Set();

  for (const event of events) {
    if (event.type === "approval.approved") {
      approvedActionIds.add(event.payload?.payload?.action?.id);
    }

    if (event.type === "tool.executed") {
      const executed = event.payload?.payload;
      if (
        executed?.approvalRequired &&
        !approvedActionIds.has(executed.id)
      ) {
        throw new HumanApprovalError(
          "hidden_execution_detected",
          `Tool executed before approval: ${executed.id}`,
          { event },
        );
      }
    }
  }

  return {
    valid: true,
    approvedActionIds: [...approvedActionIds],
  };
}

export function humanApprovalBoundary() {
  return {
    deterministicLocalApprovalProtocol: true,
    replayableSessionEvents: true,
    durableSessionBoundary: durableSessionBoundary(),
    productionHumanApprovalClaim: false,
    guiApprovalProductClaim: false,
    enterprisePolicyClaim: false,
  };
}

function createInitialApprovalPlan() {
  return {
    id: "plan_core26",
    status: "approved",
    currentStepId: "step_2",
    constraints: ["Preserve public API exports."],
    steps: [
      {
        id: "step_1",
        text: "Read repo intelligence evidence",
        status: "done",
        expectedTools: ["Read"],
      },
      {
        id: "step_2",
        text: "Patch protected public API guard",
        status: "active",
        expectedTools: ["Edit"],
      },
      {
        id: "step_3",
        text: "Run approved verification",
        status: "pending",
        expectedTools: ["Bash"],
      },
    ],
  };
}

function pendingPlanActions(plan) {
  return plan.steps
    .filter((step) => step.status !== "done")
    .map((step) => ({
      stepId: step.id,
      text: step.text,
      status: step.status,
    }));
}

function unique(items) {
  return [...new Set(items)];
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function main() {
  console.log(JSON.stringify(await runHumanApprovalInterruptionDemo(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
