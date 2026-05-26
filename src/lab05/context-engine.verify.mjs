import assert from "node:assert/strict";
import { buildContext, runDemo, sampleInput, verifyDemo } from "./context-engine.mjs";

const cases = [];

record("happy path: hard context survives budget pressure", () => {
  const result = runDemo();
  return verifyDemo(result);
});

record("file inclusion: unread or unselected files are not included", () => {
  const result = buildContext(sampleInput(), { budget: 2000 });
  const joined = result.blocks.map((block) => block.content).join("\n");

  assert.match(joined, /export function paginate/);
  assert.doesNotMatch(joined, /this should not appear/);

  return {
    read_file_included: true,
    unselected_file_excluded: true,
  };
});

record("long output: converted to artifact reference", () => {
  const result = buildContext(sampleInput(), { budget: 2000 });
  const block = result.blocks.find((item) => item.name === "tool:long_bash");

  assert.ok(block.content.includes("artifact_1"));
  assert.equal(result.artifacts.length, 1);

  return {
    artifact_count: result.artifacts.length,
    context_has_artifact_reference: true,
  };
});

record("memory relevance: low score memory is excluded", () => {
  const result = buildContext(sampleInput(), { budget: 2000 });
  const joined = result.blocks.map((block) => block.content).join("\n");

  assert.match(joined, /Pagination bugs often hide/);
  assert.doesNotMatch(joined, /Ignore me/);

  return {
    high_relevance_memory_included: true,
    low_relevance_memory_excluded: true,
  };
});

record("latest failure: hard keep even under tiny budget", () => {
  const result = buildContext(sampleInput(), { budget: 100 });
  const names = result.blocks.map((block) => block.name);

  assert.ok(names.includes("latest_failure"));
  assert.ok(names.includes("latest_user"));
  assert.ok(names.includes("active_plan"));

  return {
    latest_failure_preserved: true,
    latest_user_preserved: true,
    active_plan_preserved: true,
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
