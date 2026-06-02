import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createToolRuntime, runMiniRuntime } from "./mini-runtime.mjs";

async function createFixture() {
  const workspace = await mkdtemp(path.join(tmpdir(), "capstone-mini-runtime-solution-"));

  await writeFile(
    path.join(workspace, "calculator.mjs"),
    [
      "export function add(a, b) {",
      "  return a - b;",
      "}",
      ""
    ].join("\n")
  );

  await writeFile(
    path.join(workspace, "test-calculator.mjs"),
    [
      "import assert from 'node:assert/strict';",
      "import { add } from './calculator.mjs';",
      "",
      "assert.equal(add(2, 3), 5);",
      "console.log('calculator ok');",
      ""
    ].join("\n")
  );

  return workspace;
}

const workspace = await createFixture();

try {
  const initial = spawnSync("node", ["test-calculator.mjs"], {
    cwd: workspace,
    encoding: "utf8"
  });

  assert.notEqual(initial.status, 0, "fixture should fail before the runtime edits calculator.mjs");

  const tools = createToolRuntime(workspace);
  const unsafeEdit = await tools.edit("calculator.mjs", "return a - b", "return a + b");
  assert.equal(unsafeEdit.ok, false, "Edit must require a prior Read");
  assert.equal(unsafeEdit.error, "edit_requires_prior_read");

  const denied = tools.bash("rm -rf .");
  assert.equal(denied.exitCode, 1, "Bash must deny commands outside the allowlist");
  assert.equal(denied.stderr, "command_not_allowed");

  const result = await runMiniRuntime({ workspace });
  assert.equal(result.status, "verified");
  assert.deepEqual(
    result.trace.map((entry) => entry.tool),
    ["Search", "Read", "Edit", "Bash", "Verify"]
  );

  const calculator = await readFile(path.join(workspace, "calculator.mjs"), "utf8");
  assert.match(calculator, /return a \+ b/);

  const final = spawnSync("node", ["test-calculator.mjs"], {
    cwd: workspace,
    encoding: "utf8"
  });
  assert.equal(final.status, 0);
  assert.match(final.stdout, /calculator ok/);
  assert.match(result.finalAnswer, /node test-calculator\.mjs/);
  assert.match(result.finalAnswer, /not a production capability claim/);

  console.log("capstone-mini-runtime solution verify: 8/8 passed");
} finally {
  await rm(workspace, { recursive: true, force: true });
}
