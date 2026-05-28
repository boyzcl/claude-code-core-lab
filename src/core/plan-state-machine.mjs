import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { compactSession } from "../lab07/compaction.mjs";
import { evaluateCompactionQuality } from "./compaction-quality.mjs";

export const CORE20_PLAN_STATE_MACHINE_VERSION = "core20-plan-state-machine-v1";

const READ_ONLY_TOOLS = new Set(["Search", "Read", "AskUser"]);
const WRITE_TOOLS = new Set(["Edit", "Write", "Bash"]);
const STEP_STATUSES = new Set([
  "pending",
  "active",
  "done",
  "blocked",
  "revised",
  "resumed",
]);

export class PlanStateMachine {
  constructor({ plan, approved = false, trace = [], revisions = [] } = {}) {
    this.trace = trace.map(cloneJson);
    this.revisions = revisions.map(cloneJson);
    this.seq = this.trace.reduce((max, event) => Math.max(max, event.seq ?? 0), 0);
    this.plan = plan ? normalizePlan(plan, { approved }) : null;
    this.boundary = {
      deterministicLocalStateMachine: true,
      productionClaudeCodeClaim: false,
      promptOnlyPlanClaim: false,
    };
  }

  static restore(snapshot) {
    const machine = new PlanStateMachine({
      plan: snapshot.activePlan ?? snapshot.plan,
      trace: snapshot.planTrace ?? snapshot.trace ?? [],
      revisions: snapshot.planRevisionLog ?? snapshot.revisions ?? [],
    });
    const activeStep = machine.currentStep();

    if (activeStep && ["active", "resumed"].includes(activeStep.status)) {
      activeStep.status = "resumed";
      machine.plan.status = "approved";
      machine.plan.approved = true;
      machine.record("step.resumed", {
        planId: machine.plan.id,
        stepId: activeStep.id,
      });
    }

    return machine;
  }

  propose(plan) {
    const validation = validatePlanStateMachinePlan(plan);
    if (!validation.valid) {
      this.record("plan.invalid", {
        planId: plan?.id ?? null,
        errors: validation.errors,
      });
      return {
        status: "invalid",
        errors: validation.errors,
      };
    }

    this.plan = normalizePlan(plan, { approved: false });
    this.record("plan.proposed", {
      planId: this.plan.id,
      stepCount: this.plan.steps.length,
    });

    return {
      status: "proposed",
      plan: cloneJson(this.plan),
    };
  }

  approve(planId) {
    if (!this.plan || this.plan.id !== planId) {
      return this.error("plan_not_found", `Plan not found: ${planId}`);
    }

    if (this.plan.status === "revised") {
      return this.error("plan_revised", `Plan was revised: ${planId}`);
    }

    this.plan.status = "approved";
    this.plan.approved = true;
    this.record("plan.approved", {
      planId,
    });

    return {
      status: "approved",
      activePlan: this.snapshot().activePlan,
    };
  }

  startStep(stepId = nextPendingStep(this.plan)?.id) {
    const decision = this.ensureApproved();
    if (!decision.allowed) return decision;

    const step = this.findStep(stepId);
    if (!step) return this.error("step_not_found", `Step not found: ${stepId}`);
    if (step.status !== "pending") {
      return this.error(
        "step_not_pending",
        `Step ${stepId} cannot start from ${step.status}.`,
      );
    }

    const active = this.currentStep();
    if (active && ["active", "resumed"].includes(active.status)) {
      return this.error(
        "step_already_active",
        `Step ${active.id} is already active.`,
      );
    }

    step.status = "active";
    step.startedAtSeq = this.seq + 1;
    this.plan.currentStepId = step.id;
    this.record("step.active", {
      planId: this.plan.id,
      stepId: step.id,
      text: step.text,
    });

    return {
      status: "active",
      step: cloneJson(step),
    };
  }

  completeStep(stepId = this.plan?.currentStepId, evidence = {}) {
    const step = this.findStep(stepId);
    if (!step) return this.error("step_not_found", `Step not found: ${stepId}`);
    if (!["active", "resumed"].includes(step.status)) {
      return this.error(
        "step_not_active",
        `Step ${stepId} cannot complete from ${step.status}.`,
      );
    }

    step.status = "done";
    step.completedAtSeq = this.seq + 1;
    step.evidence = {
      ...(step.evidence ?? {}),
      ...cloneJson(evidence),
    };
    this.record("step.done", {
      planId: this.plan.id,
      stepId,
      evidence: step.evidence,
    });

    const next = nextPendingStep(this.plan);
    this.plan.currentStepId = next?.id ?? null;
    if (!next) {
      this.plan.status = "completed";
      this.record("plan.completed", {
        planId: this.plan.id,
      });
    }

    return {
      status: "done",
      step: cloneJson(step),
      nextStepId: next?.id ?? null,
    };
  }

  blockStep(stepId = this.plan?.currentStepId, reason, evidence = {}) {
    const step = this.findStep(stepId);
    if (!step) return this.error("step_not_found", `Step not found: ${stepId}`);
    if (!["active", "resumed"].includes(step.status)) {
      return this.error(
        "step_not_active",
        `Step ${stepId} cannot block from ${step.status}.`,
      );
    }

    step.status = "blocked";
    step.blockedReason = reason;
    step.evidence = {
      ...(step.evidence ?? {}),
      ...cloneJson(evidence),
    };
    this.plan.status = "blocked";
    this.record("step.blocked", {
      planId: this.plan.id,
      stepId,
      reason,
      evidence: step.evidence,
    });

    return {
      status: "blocked",
      step: cloneJson(step),
      reason,
    };
  }

  revisePlan({ reason, userMessage, steps, validation }) {
    if (!this.plan) {
      return this.error("plan_not_found", "Cannot revise without an active plan.");
    }

    const previous = cloneJson(this.plan);
    for (const step of this.plan.steps) {
      if (["pending", "active", "resumed", "blocked"].includes(step.status)) {
        step.status = "revised";
      }
    }
    this.plan.status = "revised";
    this.revisions.push({
      previousPlan: previous,
      reason,
      userMessage,
      revisedAtSeq: this.seq + 1,
    });
    this.record("plan.revised", {
      fromPlanId: previous.id,
      reason,
      userMessage,
    });

    const revisionNumber = this.revisions.length;
    const nextPlan = normalizePlan(
      {
        id: `${previous.id}_rev${revisionNumber}`,
        objective: previous.objective,
        revisionOf: previous.id,
        steps: steps ?? previous.steps.map((step) => step.text),
        expectedFiles: previous.expectedFiles,
        validation: validation ?? previous.validation,
      },
      { approved: true },
    );
    nextPlan.status = "approved";
    this.plan = nextPlan;
    this.record("plan.revision_approved", {
      planId: nextPlan.id,
      revisionOf: previous.id,
      stepCount: nextPlan.steps.length,
    });

    return {
      status: "revised",
      previousPlanId: previous.id,
      activePlan: this.snapshot().activePlan,
      revisionLog: cloneJson(this.revisions),
    };
  }

  authorizeTool(toolCall) {
    if (!this.plan || !this.plan.approved || this.plan.status === "proposed") {
      if (READ_ONLY_TOOLS.has(toolCall.name)) {
        return {
          allowed: true,
          reason: `${toolCall.name} is allowed before plan approval.`,
        };
      }

      if (WRITE_TOOLS.has(toolCall.name)) {
        return {
          allowed: false,
          error_type: "plan_not_approved",
          reason: `${toolCall.name} requires an approved plan.`,
        };
      }
    }

    if (this.plan.status === "blocked") {
      return {
        allowed: false,
        error_type: "plan_blocked",
        reason: "Blocked plan must be revised or resumed before tool execution.",
      };
    }

    const activeStep = this.currentStep();
    if (!activeStep) {
      return {
        allowed: false,
        error_type: "no_active_step",
        reason: "Tool execution requires an active plan step.",
      };
    }

    if (
      activeStep.expectedTools.length > 0 &&
      !activeStep.expectedTools.includes(toolCall.name)
    ) {
      return {
        allowed: false,
        error_type: "tool_outside_active_step",
        reason: `${toolCall.name} does not match active step ${activeStep.id}.`,
      };
    }

    return {
      allowed: true,
      reason: `${toolCall.name} is allowed for active step ${activeStep.id}.`,
    };
  }

  finalAnswerDecision({ verificationState = null } = {}) {
    if (!this.plan) {
      return {
        allowed: false,
        error_type: "plan_missing",
        reason: "Final answer requires plan state.",
      };
    }

    const incompleteSteps = this.plan.steps.filter((step) => step.status !== "done");
    if (incompleteSteps.length > 0) {
      return {
        allowed: false,
        error_type: "plan_incomplete",
        reason: "Final answer cannot claim completion before all steps are done.",
        incompleteSteps: incompleteSteps.map((step) => ({
          id: step.id,
          status: step.status,
        })),
      };
    }

    if (verificationState?.status !== "passed") {
      return {
        allowed: false,
        error_type: "verification_missing",
        reason: "Final answer requires passed verification.",
      };
    }

    return {
      allowed: true,
      reason: "Plan is complete and verification passed.",
    };
  }

  snapshot() {
    return {
      version: CORE20_PLAN_STATE_MACHINE_VERSION,
      activePlan: cloneJson(this.plan),
      planTrace: cloneJson(this.trace),
      planRevisionLog: cloneJson(this.revisions),
      currentStepId: this.plan?.currentStepId ?? null,
      boundary: cloneJson(this.boundary),
    };
  }

  currentStep() {
    if (!this.plan) return null;
    return (
      this.plan.steps.find((step) =>
        ["active", "resumed"].includes(step.status),
      ) ?? null
    );
  }

  findStep(stepId) {
    return this.plan?.steps.find((step) => step.id === stepId) ?? null;
  }

  ensureApproved() {
    if (!this.plan?.approved || this.plan.status === "proposed") {
      return {
        allowed: false,
        error_type: "plan_not_approved",
        reason: "Plan must be approved before step execution.",
      };
    }

    if (this.plan.status === "revised") {
      return {
        allowed: false,
        error_type: "plan_revised",
        reason: "Revised plan cannot execute.",
      };
    }

    return {
      allowed: true,
    };
  }

  error(errorType, message) {
    return {
      status: "error",
      error_type: errorType,
      message,
    };
  }

  record(event, payload = {}) {
    this.trace.push({
      seq: ++this.seq,
      event,
      ...cloneJson(payload),
    });
  }
}

export function validatePlanStateMachinePlan(plan) {
  const errors = [];

  for (const field of ["id", "objective", "steps", "validation"]) {
    if (!plan?.[field] || (Array.isArray(plan[field]) && plan[field].length === 0)) {
      errors.push(`missing_${field}`);
    }
  }

  const steps = plan?.steps ?? [];
  for (const [index, step] of steps.entries()) {
    const normalized = normalizeStep(step, index);
    if (!normalized.text) errors.push(`missing_step_${index + 1}_text`);
    if (!STEP_STATUSES.has(normalized.status)) {
      errors.push(`invalid_step_${index + 1}_status`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function createPlanStateMachineFixture(overrides = {}) {
  return {
    id: "plan_core20",
    objective: "Fix pagination off-by-one without changing the public API.",
    expectedFiles: ["src/pagination.cjs"],
    validation: ["node scripts/test.cjs"],
    steps: [
      {
        id: "step_1",
        text: "Search pagination implementation",
        expectedTools: ["Search"],
      },
      {
        id: "step_2",
        text: "Read target file",
        expectedTools: ["Read"],
      },
      {
        id: "step_3",
        text: "Patch boundary logic",
        expectedTools: ["Edit"],
      },
      {
        id: "step_4",
        text: "Rerun verification",
        expectedTools: ["Bash"],
      },
    ],
    ...overrides,
  };
}

export function runPlanStateMachineDemo() {
  const machine = new PlanStateMachine();
  machine.propose(createPlanStateMachineFixture());
  machine.approve("plan_core20");
  machine.startStep("step_1");
  machine.completeStep("step_1", {
    tool: "Search",
    query: "pageSize + 1",
  });
  machine.startStep("step_2");
  machine.completeStep("step_2", {
    tool: "Read",
    path: "src/pagination.cjs",
  });
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
    pendingActions: ["Complete active plan step", "Run verification"],
    messages: [
      {
        type: "assistant",
        content: "Plan step 3 is active before compaction.",
      },
    ],
    newerMessages: [],
  });
  const compactionQuality = evaluateCompactionQuality({
    before: {
      objective: machine.plan.objective,
      latestUserConstraints: ["Do not change the public API."],
      activePlan: machine.snapshot().activePlan,
      modifiedFiles: [],
      latestFailures: [],
      verificationState: {
        status: "not_run",
        command: "node scripts/test.cjs",
      },
      pendingActions: ["Complete active plan step", "Run verification"],
    },
    compacted,
  });
  const resumed = PlanStateMachine.restore({
    activePlan: compacted.compactSummary.activePlan,
    planTrace: machine.trace,
    planRevisionLog: machine.revisions,
  });
  resumed.completeStep("step_3", {
    tool: "Edit",
    path: "src/pagination.cjs",
  });
  resumed.startStep("step_4");
  resumed.completeStep("step_4", {
    tool: "Bash",
    command: "node scripts/test.cjs",
    exitCode: 0,
  });
  const finalDecision = resumed.finalAnswerDecision({
    verificationState: {
      status: "passed",
      command: "node scripts/test.cjs",
      exitCode: 0,
    },
  });

  const result = {
    checks: verifyPlanStateMachineDemo({
      machine: resumed,
      compacted,
      compactionQuality,
      finalDecision,
    }),
    beforeCompaction: machine.snapshot(),
    compacted,
    compactionQuality,
    restored: resumed.snapshot(),
    finalDecision,
  };

  return result;
}

export function verifyPlanStateMachineDemo({
  machine,
  compacted,
  compactionQuality,
  finalDecision,
}) {
  assert.equal(machine.plan.status, "completed");
  assert.deepEqual(
    machine.plan.steps.map((step) => step.status),
    ["done", "done", "done", "done"],
  );
  assert.equal(compacted.compactSummary.activePlan.currentStepId, "step_3");
  assert.equal(compactionQuality.status, "passed");
  assert.equal(
    machine.trace.some((event) => event.event === "step.resumed"),
    true,
  );
  assert.equal(finalDecision.allowed, true);
  assert.equal(machine.boundary.productionClaudeCodeClaim, false);

  return {
    step_lifecycle_completed: true,
    compaction_preserved_active_step: true,
    resume_trace_recorded: true,
    final_grounded_in_completed_plan_and_verification: true,
    no_production_claim: true,
  };
}

function normalizePlan(plan, { approved = false } = {}) {
  const isApproved =
    approved ||
    plan.approved === true ||
    ["approved", "blocked", "completed"].includes(plan.status);
  const status = isApproved
    ? ["blocked", "completed"].includes(plan.status)
      ? plan.status
      : "approved"
    : "proposed";

  return {
    id: plan.id,
    objective: plan.objective,
    revisionOf: plan.revisionOf ?? null,
    status,
    approved: isApproved,
    expectedFiles: plan.expectedFiles ?? [],
    validation: plan.validation ?? [],
    currentStepId: plan.currentStepId ?? null,
    steps: (plan.steps ?? []).map((step, index) => normalizeStep(step, index)),
  };
}

function normalizeStep(step, index) {
  if (typeof step === "string") {
    return {
      id: `step_${index + 1}`,
      text: step,
      status: "pending",
      expectedTools: [],
      evidence: {},
    };
  }

  return {
    id: step.id ?? `step_${index + 1}`,
    text: step.text ?? step.name ?? "",
    status: step.status ?? "pending",
    expectedTools: step.expectedTools ?? [],
    blockedReason: step.blockedReason ?? null,
    evidence: step.evidence ?? {},
    startedAtSeq: step.startedAtSeq ?? null,
    completedAtSeq: step.completedAtSeq ?? null,
  };
}

function nextPendingStep(plan) {
  return plan?.steps.find((step) => step.status === "pending") ?? null;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function main() {
  console.log(JSON.stringify(runPlanStateMachineDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
