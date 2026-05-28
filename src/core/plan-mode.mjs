import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PlanController, samplePlan } from "../lab06/plan-mode.mjs";
import {
  CoreRuntime,
  createCoreToyWorkspace,
  verifyCoreResult,
} from "./core-runtime.mjs";

export class PlanFirstFixModel {
  next(request) {
    const runtime = request.messages.find((message) => message.role === "runtime");
    const activePlan = runtime?.content?.coreState?.activePlan;

    if (!activePlan) {
      return {
        type: "plan",
        plan: sampleCorePlan(),
      };
    }

    const search = latestToolResult(request.messages, "Search");
    const read = latestToolResult(request.messages, "Read");
    const edit = latestToolResult(request.messages, "Edit");
    const bash = latestToolResult(request.messages, "Bash");

    if (!search) {
      return toolCall("plan_tool_call_search_001", "Search", {
        query: "pageSize + 1",
      });
    }

    if (!read) {
      const firstMatch = search.content.matches[0];
      return toolCall("plan_tool_call_read_001", "Read", {
        path: firstMatch.path,
      });
    }

    if (!edit) {
      return toolCall("plan_tool_call_edit_001", "Edit", {
        path: read.content.path,
        old_string: "start + pageSize + 1",
        new_string: "start + pageSize",
      });
    }

    if (!bash) {
      return toolCall("plan_tool_call_bash_001", "Bash", {
        command: "node scripts/test.cjs",
      });
    }

    return {
      type: "final_answer",
      content:
        "已修复分页 off-by-one 问题；本次修改按批准计划执行，并通过 node scripts/test.cjs 验证。",
    };
  }
}

export class EditFirstModel {
  next(request) {
    const denied = latestToolResult(request.messages, "Edit");
    if (denied?.status === "denied") {
      return {
        type: "final_answer",
        content: "Edit 在计划批准前被拒绝，等待计划审批。",
      };
    }

    return toolCall("plan_tool_call_edit_denied", "Edit", {
      path: "src/pagination.cjs",
      old_string: "start + pageSize + 1",
      new_string: "start + pageSize",
    });
  }
}

export async function runPlanModeDemo() {
  const workspaceRoot = await createCoreToyWorkspace();
  const runtime = new CoreRuntime({
    workspaceRoot,
    model: new PlanFirstFixModel(),
    planController: new PlanController(),
    autoApprovePlan: true,
    maxTurns: 8,
  });
  const result = await runtime.run("先制定计划，再修复分页多返回一个元素的问题。");
  const finalText = await readFile(path.join(workspaceRoot, "src/pagination.cjs"), "utf8");

  return {
    checks: verifyPlanModeResult(result, finalText),
    finalText,
    ...result,
  };
}

export function verifyPlanModeResult(result, finalText) {
  const coreChecks = verifyCoreResult(result, finalText);

  assert.equal(result.coreState.mode, "execute");
  assert.equal(result.coreState.activePlan.status, "approved");
  assert.equal(result.coreState.planEvents[0].status, "proposed");
  assert.equal(result.coreState.planEvents[1].status, "approved");
  assert.match(result.coreState.finalAnswer, /批准计划/);

  return {
    ...coreChecks,
    plan_was_proposed: true,
    plan_was_approved: true,
    approved_plan_enabled_execution: true,
  };
}

export function sampleCorePlan(overrides = {}) {
  return samplePlan({
    id: "core_plan_001",
    objective: "Fix pagination off-by-one bug and verify with tests.",
    knownFacts: ["User asked to plan before editing.", "Pagination returns one extra item."],
    steps: ["Search bug pattern", "Read target file", "Edit one expression", "Run test"],
    expectedFiles: ["src/pagination.cjs"],
    risks: ["Changing slice boundary can alter pagination behavior."],
    validation: ["node scripts/test.cjs"],
    ...overrides,
  });
}

function toolCall(id, name, input) {
  return {
    type: "tool_call",
    toolCall: {
      id,
      name,
      input,
    },
  };
}

function latestToolResult(messages, name) {
  return [...messages]
    .reverse()
    .find((message) => message.type === "tool_result" && message.name === name);
}

async function main() {
  console.log(JSON.stringify(await runPlanModeDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
