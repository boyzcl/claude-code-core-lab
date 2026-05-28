import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const READ_ONLY_TOOLS = new Set(["Search", "Read", "AskUser"]);
const WRITE_TOOLS = new Set(["Edit", "Write", "Bash"]);

export class PlanController {
  constructor() {
    this.mode = "plan";
    this.plan = null;
    this.rejectedPlanIds = new Set();
  }

  proposePlan(plan) {
    const validation = validatePlan(plan);
    if (!validation.valid) {
      return {
        status: "invalid",
        errors: validation.errors,
      };
    }

    this.plan = {
      ...plan,
      status: "proposed",
    };

    return {
      status: "proposed",
      plan: this.plan,
    };
  }

  rejectPlan(planId, reason) {
    if (this.plan?.id === planId) {
      this.plan.status = "rejected";
      this.plan.rejectionReason = reason;
    }
    this.rejectedPlanIds.add(planId);
    this.mode = "plan";

    return {
      status: "rejected",
      planId,
      reason,
    };
  }

  approvePlan(planId) {
    if (!this.plan || this.plan.id !== planId) {
      return {
        status: "error",
        error_type: "plan_not_found",
      };
    }

    if (this.rejectedPlanIds.has(planId) || this.plan.status === "rejected") {
      return {
        status: "error",
        error_type: "plan_rejected",
      };
    }

    this.plan.status = "approved";
    this.mode = "execute";

    return {
      status: "approved",
      activePlan: this.plan,
    };
  }

  authorizeTool(toolCall) {
    if (this.mode === "plan" && WRITE_TOOLS.has(toolCall.name)) {
      return {
        allowed: false,
        reason: `${toolCall.name} is not allowed in plan mode.`,
      };
    }

    if (this.mode === "plan" && READ_ONLY_TOOLS.has(toolCall.name)) {
      return {
        allowed: true,
        reason: `${toolCall.name} is allowed in plan mode.`,
      };
    }

    if (this.mode === "execute" && this.plan?.status !== "approved") {
      return {
        allowed: false,
        reason: "Execution requires approved plan.",
      };
    }

    return {
      allowed: true,
      reason: "Tool is allowed.",
    };
  }
}

export function validatePlan(plan) {
  const errors = [];

  for (const field of [
    "id",
    "objective",
    "knownFacts",
    "steps",
    "expectedFiles",
    "risks",
    "validation",
  ]) {
    if (!plan?.[field] || (Array.isArray(plan[field]) && plan[field].length === 0)) {
      errors.push(`missing_${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function samplePlan(overrides = {}) {
  return {
    id: "plan_001",
    objective: "Fix pagination off-by-one bug.",
    knownFacts: ["User reports one extra item."],
    steps: ["Search paginate", "Read implementation", "Edit narrow line", "Run tests"],
    expectedFiles: ["src/pagination.js"],
    risks: ["May affect page boundary behavior."],
    validation: ["npm test"],
    ...overrides,
  };
}

export function runDemo() {
  const controller = new PlanController();
  const proposed = controller.proposePlan(samplePlan());
  const readDecision = controller.authorizeTool({ name: "Read" });
  const editBeforeApproval = controller.authorizeTool({ name: "Edit" });
  const approved = controller.approvePlan("plan_001");
  const editAfterApproval = controller.authorizeTool({ name: "Edit" });

  const result = {
    proposed,
    readDecision,
    editBeforeApproval,
    approved,
    editAfterApproval,
    mode: controller.mode,
  };

  return {
    checks: verifyDemo(result),
    ...result,
  };
}

export function verifyDemo(result) {
  assert.equal(result.proposed.status, "proposed");
  assert.equal(result.readDecision.allowed, true);
  assert.equal(result.editBeforeApproval.allowed, false);
  assert.equal(result.approved.status, "approved");
  assert.equal(result.editAfterApproval.allowed, true);
  assert.equal(result.mode, "execute");

  return {
    plan_validated: true,
    read_allowed_in_plan_mode: true,
    edit_denied_before_approval: true,
    approved_plan_enables_execution: true,
  };
}

function main() {
  console.log(JSON.stringify(runDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
