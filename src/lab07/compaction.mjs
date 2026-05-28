import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const LONG_OUTPUT_LIMIT = 100;

export function compactSession(input) {
  const artifacts = [];
  const summary = {
    objective: input.objective,
    latestUserConstraints: input.latestUserConstraints,
    activePlan: input.activePlan,
    modifiedFiles: input.modifiedFiles,
    latestFailures: input.latestFailures,
    verificationState: normalizeVerification(input.verificationState),
    pendingActions: input.pendingActions,
    artifactRefs: [],
    olderHistorySummary: summarizeOlderHistory(input.messages ?? [], artifacts),
  };

  return {
    compactSummary: summary,
    artifacts,
    newerMessages: input.newerMessages ?? [],
  };
}

export function restoreContext(compacted) {
  return {
    summary: compacted.compactSummary,
    newerMessages: compacted.newerMessages,
  };
}

export function runDemo() {
  const compacted = compactSession(sampleInput());
  return {
    checks: verifyDemo(compacted),
    ...compacted,
  };
}

export function verifyDemo(compacted) {
  const summary = compacted.compactSummary;

  assert.equal(summary.objective, "Fix pagination off-by-one bug.");
  assert.deepEqual(summary.latestUserConstraints, ["Do not change public API."]);
  assert.equal(summary.activePlan.id, "plan_001");
  assert.deepEqual(summary.modifiedFiles, ["src/pagination.js"]);
  assert.equal(summary.verificationState.status, "failed");
  assert.match(summary.latestFailures[0], /Expected 2 received 3/);
  assert.ok(compacted.artifacts.length >= 1);

  return {
    objective_preserved: true,
    latest_user_constraints_preserved: true,
    active_plan_preserved: true,
    modified_files_preserved: true,
    failed_verification_not_marked_passed: true,
    long_output_artifacted: true,
  };
}

export function sampleInput(overrides = {}) {
  return {
    objective: "Fix pagination off-by-one bug.",
    latestUserConstraints: ["Do not change public API."],
    activePlan: {
      id: "plan_001",
      steps: ["Read", "Edit", "Test"],
    },
    modifiedFiles: ["src/pagination.js"],
    latestFailures: ["Expected 2 received 3 in pagination.test.js"],
    verificationState: {
      status: "failed",
      command: "npm test",
      exitCode: 1,
    },
    pendingActions: ["Adjust implementation", "Rerun npm test"],
    messages: [
      {
        type: "tool_result",
        name: "Bash",
        status: "error",
        content: "FAIL ".repeat(120),
      },
      {
        type: "assistant",
        content: "Older reasoning details.",
      },
    ],
    newerMessages: [
      {
        type: "user",
        content: "Actually keep the API exactly the same.",
      },
    ],
    ...overrides,
  };
}

function summarizeOlderHistory(messages, artifacts) {
  const parts = [];

  for (const message of messages) {
    const content = JSON.stringify(message.content ?? "");
    if (content.length > LONG_OUTPUT_LIMIT) {
      const artifactId = `artifact_${artifacts.length + 1}`;
      artifacts.push({
        id: artifactId,
        source: message.name ?? message.type,
        content: message.content,
      });
      parts.push(`${message.type}:${message.name ?? ""} stored in ${artifactId}`);
    } else {
      parts.push(`${message.type}:${String(message.content ?? "").slice(0, 80)}`);
    }
  }

  return parts;
}

function normalizeVerification(verificationState) {
  if (verificationState?.status === "failed") {
    return {
      ...verificationState,
      status: "failed",
    };
  }

  return verificationState;
}

function main() {
  console.log(JSON.stringify(runDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
