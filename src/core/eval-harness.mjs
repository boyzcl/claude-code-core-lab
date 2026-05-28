import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CoreRuntime, createCoreToyWorkspace } from "./core-runtime.mjs";

const DEFAULT_USER_TEXT = "修复分页多返回一个元素的问题，并运行测试。";

export async function runCoreEvalCases(cases = starterCoreEvalCases()) {
  const results = [];

  for (const testCase of cases) {
    results.push(await runCoreEvalCase(testCase));
  }

  const passed = results.filter((result) => result.passed).length;
  const total = results.length;

  return {
    total,
    passed,
    score: total === 0 ? 0 : passed / total,
    failureTypes: failureTypeSummary(results),
    results,
  };
}

export async function runCoreEvalCase(testCase) {
  try {
    const workspaceRoot =
      testCase.workspaceRoot ??
      (testCase.createWorkspace
        ? await testCase.createWorkspace()
        : await createCoreToyWorkspace());
    const runtime = testCase.createRuntime
      ? testCase.createRuntime({ workspaceRoot, testCase })
      : new CoreRuntime({
          workspaceRoot,
          ...(testCase.runtimeOptions ?? {}),
        });
    const result = await runtime.run(testCase.userText ?? DEFAULT_USER_TEXT);
    const evidence = buildCoreEvalEvidence(result);
    const assertions = await evaluateCoreExpectations({
      testCase,
      result,
      evidence,
      workspaceRoot,
    });
    const failed = assertions.find((item) => !item.passed);

    return {
      id: testCase.id,
      name: testCase.name,
      passed: !failed,
      score: failed ? 0 : 1,
      failureType: failed?.failureType ?? null,
      assertions,
      evidence,
    };
  } catch (error) {
    return {
      id: testCase.id,
      name: testCase.name,
      passed: false,
      score: 0,
      failureType: "runtime_exception",
      assertions: [
        {
          name: "runtime_completed",
          passed: false,
          failureType: "runtime_exception",
          details: {
            message: error.message,
          },
        },
      ],
      evidence: null,
    };
  }
}

export function buildCoreEvalEvidence(result) {
  const toolCalls = result.messages
    .filter((message) => message.type === "assistant_tool_call")
    .map((message) => ({
      id: message.tool_call.id,
      name: message.tool_call.name,
      input: message.tool_call.input,
      sequence: message.sequence,
    }));
  const toolResults = result.messages
    .filter((message) => message.type === "tool_result")
    .map((message) => ({
      id: message.id,
      toolCallId: message.tool_call_id,
      name: message.name,
      status: message.status,
      errorType: message.error?.error_type ?? null,
      exitCode: message.content?.exitCode ?? null,
      sequence: message.sequence,
    }));
  const contextTurns = (result.contextSnapshots ?? []).map((snapshot) => ({
    turn: snapshot.turn,
    blockNames: snapshot.blocks.map((block) => block.name),
    artifactCount: snapshot.artifacts.length,
    selectedMessageCount: snapshot.selectedMessageIds.length,
    tokenEstimate: snapshot.tokenEstimate,
  }));

  return {
    sessionId: result.sessionId,
    messageCount: result.messages.length,
    toolCalls,
    toolResults,
    toolSequence: toolResults.map((item) => item.name),
    modifiedFiles: result.coreState.modifiedFiles ?? [],
    verificationStatus: result.coreState.verificationState?.status ?? null,
    verificationCommand: result.coreState.verificationState?.command ?? null,
    finalAnswer: result.coreState.finalAnswer ?? null,
    storeTraceEvents: (result.trace ?? []).map((event) => event.event),
    runtimeTraceEvents: (result.runtimeTrace ?? []).map((event) => event.event),
    contextTurns,
    compaction: result.coreState.compaction ?? null,
    compactionArtifactCount: result.coreState.compactionArtifacts?.length ?? 0,
  };
}

export async function evaluateCoreExpectations({
  testCase,
  result,
  evidence,
  workspaceRoot,
}) {
  const assertions = [];
  const expect = testCase.expect ?? {};

  if (expect.toolSequence) {
    assertions.push({
      name: "tool_sequence",
      passed: sameJson(evidence.toolSequence, expect.toolSequence),
      failureType: "tool_sequence_mismatch",
      details: {
        expected: expect.toolSequence,
        actual: evidence.toolSequence,
      },
    });
  }

  if (expect.toolResults) {
    for (const expected of expect.toolResults) {
      const matched = evidence.toolResults.some((actual) =>
        toolResultMatches(actual, expected),
      );
      assertions.push({
        name: `tool_result:${expected.name}`,
        passed: matched,
        failureType: "tool_result_mismatch",
        details: {
          expected,
          actual: evidence.toolResults,
        },
      });
    }
  }

  if (expect.verificationStatus) {
    assertions.push({
      name: "verification_status",
      passed: evidence.verificationStatus === expect.verificationStatus,
      failureType: evidence.verificationStatus
        ? "verification_failed"
        : "verification_missing",
      details: {
        expected: expect.verificationStatus,
        actual: evidence.verificationStatus,
      },
    });
  }

  if (expect.modifiedFiles) {
    assertions.push({
      name: "modified_files",
      passed: sameJson(evidence.modifiedFiles, expect.modifiedFiles),
      failureType: "state_mismatch",
      details: {
        expected: expect.modifiedFiles,
        actual: evidence.modifiedFiles,
      },
    });
  }

  if (expect.finalAnswerIncludes) {
    assertions.push({
      name: "final_answer_includes",
      passed: evidence.finalAnswer?.includes(expect.finalAnswerIncludes) ?? false,
      failureType: "final_answer_ungrounded",
      details: {
        expected: expect.finalAnswerIncludes,
        actual: evidence.finalAnswer,
      },
    });
  }

  if (expect.runtimeEvents) {
    for (const event of expect.runtimeEvents) {
      assertions.push({
        name: `runtime_event:${event}`,
        passed: evidence.runtimeTraceEvents.includes(event),
        failureType: "missing_trace_evidence",
        details: {
          expected: event,
          actual: evidence.runtimeTraceEvents,
        },
      });
    }
  }

  if (expect.storeEvents) {
    for (const event of expect.storeEvents) {
      assertions.push({
        name: `store_event:${event}`,
        passed: evidence.storeTraceEvents.includes(event),
        failureType: "missing_trace_evidence",
        details: {
          expected: event,
          actual: evidence.storeTraceEvents,
        },
      });
    }
  }

  if (expect.contextBlocks) {
    const allBlockNames = new Set(
      evidence.contextTurns.flatMap((turn) => turn.blockNames),
    );
    for (const blockName of expect.contextBlocks) {
      assertions.push({
        name: `context_block:${blockName}`,
        passed: allBlockNames.has(blockName),
        failureType: "context_missing",
        details: {
          expected: blockName,
          actual: [...allBlockNames],
        },
      });
    }
  }

  if (expect.files) {
    for (const fileExpectation of expect.files) {
      const text = await readFile(
        path.join(workspaceRoot, fileExpectation.path),
        "utf8",
      );
      const includesOk = fileExpectation.includes
        ? text.includes(fileExpectation.includes)
        : true;
      const excludesOk = fileExpectation.excludes
        ? !text.includes(fileExpectation.excludes)
        : true;
      assertions.push({
        name: `file:${fileExpectation.path}`,
        passed: includesOk && excludesOk,
        failureType: "file_expectation_failed",
        details: {
          path: fileExpectation.path,
          includes: fileExpectation.includes ?? null,
          excludes: fileExpectation.excludes ?? null,
        },
      });
    }
  }

  if (testCase.evaluate) {
    const customAssertions = await testCase.evaluate({
      result,
      evidence,
      workspaceRoot,
    });
    assertions.push(...customAssertions);
  }

  return assertions;
}

export function starterCoreEvalCases() {
  return [
    {
      id: "core-eval-happy-001",
      name: "runtime fixes pagination and leaves trace evidence",
      expect: {
        toolSequence: ["Search", "Read", "Edit", "Bash"],
        verificationStatus: "passed",
        modifiedFiles: ["src/pagination.cjs"],
        finalAnswerIncludes: "通过",
        runtimeEvents: [
          "context.built",
          "model.output",
          "tool.result",
          "runtime.finished",
        ],
        storeEvents: ["message.appended", "state.updated"],
        contextBlocks: ["latest_user", "verification_state"],
        files: [
          {
            path: "src/pagination.cjs",
            includes: "start + pageSize);",
            excludes: "start + pageSize + 1);",
          },
        ],
      },
    },
    {
      id: "core-eval-policy-001",
      name: "edit before read is attributed to policy/tool safety",
      createRuntime: ({ workspaceRoot }) =>
        new CoreRuntime({
          workspaceRoot,
          model: new EditBeforeReadModel(),
        }),
      expect: {
        toolSequence: ["Edit"],
        toolResults: [
          {
            name: "Edit",
            status: "error",
            errorType: "file_not_read",
          },
        ],
        finalAnswerIncludes: "拒绝",
        runtimeEvents: ["tool.result", "runtime.finished"],
      },
    },
    {
      id: "core-eval-unverified-final-001",
      name: "unverified final answer is caught by eval",
      createRuntime: ({ workspaceRoot }) =>
        new CoreRuntime({
          workspaceRoot,
          model: new ImmediateFinalModel(),
        }),
      expect: {
        verificationStatus: "passed",
        runtimeEvents: ["runtime.finished"],
      },
    },
  ];
}

export async function runCoreEvalDemo() {
  const report = await runCoreEvalCases(starterCoreEvalCases());
  return {
    checks: verifyCoreEvalDemo(report),
    ...report,
  };
}

export function verifyCoreEvalDemo(report) {
  assert.equal(report.total, 3);
  assert.equal(report.passed, 2);
  assert.equal(report.score, 2 / 3);
  assert.equal(
    report.results.find((result) => result.id === "core-eval-unverified-final-001")
      .failureType,
    "verification_missing",
  );
  assert.equal(
    report.results
      .find((result) => result.id === "core-eval-happy-001")
      .evidence.runtimeTraceEvents.includes("context.built"),
    true,
  );

  return {
    core_eval_cases_executed: true,
    score_computed: true,
    failure_type_recorded: true,
    trace_evidence_attached: true,
  };
}

export class EditBeforeReadModel {
  constructor() {
    this.step = 0;
  }

  next() {
    this.step += 1;

    if (this.step === 1) {
      return toolCall("tool_call_edit_before_read_001", "Edit", {
        path: "src/pagination.cjs",
        old_string: "start + pageSize + 1",
        new_string: "start + pageSize",
      });
    }

    return {
      type: "final_answer",
      content: "Edit 被拒绝：文件必须先 Read，未修改文件。",
    };
  }
}

export class ImmediateFinalModel {
  next() {
    return {
      type: "final_answer",
      content: "已修复分页问题，并通过测试。",
    };
  }
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

function toolResultMatches(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function failureTypeSummary(results) {
  const summary = {};

  for (const result of results) {
    if (!result.failureType) continue;
    summary[result.failureType] = (summary[result.failureType] ?? 0) + 1;
  }

  return summary;
}

async function main() {
  console.log(JSON.stringify(await runCoreEvalDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
