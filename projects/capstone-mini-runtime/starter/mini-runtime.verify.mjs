import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { runMiniRuntime } from "./mini-runtime.mjs";

async function createFixture() {
  const workspace = await mkdtemp(path.join(tmpdir(), "capstone-mini-runtime-starter-"));

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

  assert.notEqual(initial.status, 0, "fixture should fail before the learner implements the runtime");

  const result = await runMiniRuntime({ workspace });

  assert.equal(result.status, "verified", "starter is expected to fail here until the runtime is implemented");
  assert.deepEqual(
    result.trace.map((entry) => entry.tool),
    ["Search", "Read", "Edit", "Bash", "Verify"],
    "runtime must execute the full Search -> Read -> Edit -> Bash -> Verify chain"
  );
} finally {
  await rm(workspace, { recursive: true, force: true });
}
