import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const DEFAULT_BUDGET = 900;
const LONG_TOOL_OUTPUT_LIMIT = 120;

export function buildContext(input, { budget = DEFAULT_BUDGET } = {}) {
  const artifacts = [];
  const blocks = [];

  add(blocks, "system", "hard", input.systemPrompt);
  add(blocks, "mode", "hard", `mode=${input.mode ?? "normal"}`);
  add(blocks, "latest_user", "hard", input.latestUserMessage);
  add(blocks, "active_plan", "hard", input.activePlan);
  add(blocks, "modified_files", "hard", input.modifiedFiles?.join("\n"));
  add(blocks, "verification_state", "hard", input.verificationState);
  add(blocks, "latest_failure", "hard", input.latestFailure);

  if (input.projectRules?.enabled) {
    add(blocks, "project_rules", "medium", input.projectRules.text);
  }

  for (const file of input.readFiles ?? []) {
    if (file.include) {
      add(blocks, `file:${file.path}`, "medium", file.text);
    }
  }

  for (const result of input.toolResults ?? []) {
    if (result.output.length > LONG_TOOL_OUTPUT_LIMIT) {
      const artifactId = `artifact_${artifacts.length + 1}`;
      artifacts.push({
        id: artifactId,
        source: result.id,
        text: result.output,
      });
      add(
        blocks,
        `tool:${result.id}`,
        result.status === "failed" ? "hard" : "low",
        `${result.status} output stored in ${artifactId}: ${result.output.slice(0, 80)}...`,
      );
    } else {
      add(
        blocks,
        `tool:${result.id}`,
        result.status === "failed" ? "hard" : "low",
        result.output,
      );
    }
  }

  for (const memory of input.memories ?? []) {
    if (memory.score >= 0.8) {
      add(blocks, `memory:${memory.id}`, "low", memory.text);
    }
  }

  const selected = fitBudget(blocks, budget);

  return {
    blocks: selected,
    artifacts,
    tokenEstimate: estimate(selected.map((block) => block.content).join("\n")),
  };
}

export function runDemo() {
  const result = buildContext(sampleInput(), { budget: 120 });
  return {
    checks: verifyDemo(result),
    ...result,
  };
}

export function verifyDemo(result) {
  const names = result.blocks.map((block) => block.name);

  assert.ok(names.includes("system"));
  assert.ok(names.includes("latest_user"));
  assert.ok(names.includes("active_plan"));
  assert.ok(names.includes("latest_failure"));
  assert.ok(names.includes("verification_state"));
  assert.ok(names.includes("tool:old_success") === false);
  assert.ok(result.artifacts.length >= 1);

  return {
    hard_blocks_survive_budget: true,
    old_success_output_pruned: true,
    long_output_became_artifact: true,
    verification_state_preserved: true,
  };
}

export function sampleInput(overrides = {}) {
  return {
    systemPrompt: "You are a local coding agent.",
    mode: "normal",
    latestUserMessage: "请修复分页问题，但不要改变公开 API。",
    activePlan: "1. Search paginate\n2. Read implementation\n3. Edit narrowly\n4. Run tests",
    modifiedFiles: ["src/pagination.js"],
    verificationState: "last verification failed: npm test exitCode=1",
    latestFailure: "Expected page size 2, received 3 in pagination.test.js",
    projectRules: {
      enabled: true,
      text: "Prefer small focused changes.",
    },
    readFiles: [
      {
        path: "src/pagination.js",
        include: true,
        text: "export function paginate(items, page, pageSize) { return items.slice(0, pageSize + 1); }",
      },
      {
        path: "src/unread.js",
        include: false,
        text: "this should not appear",
      },
    ],
    toolResults: [
      {
        id: "old_success",
        status: "success",
        output: "Old successful search output that can be pruned.",
      },
      {
        id: "long_bash",
        status: "failed",
        output: "FAIL ".repeat(80),
      },
    ],
    memories: [
      {
        id: "relevant",
        score: 0.9,
        text: "Pagination bugs often hide in boundary tests.",
      },
      {
        id: "irrelevant",
        score: 0.2,
        text: "Ignore me.",
      },
    ],
    ...overrides,
  };
}

function fitBudget(blocks, budget) {
  let selected = [...blocks];

  for (const priority of ["low", "medium"]) {
    while (estimateBlocks(selected) > budget) {
      const index = selected.findIndex((block) => block.priority === priority);
      if (index === -1) {
        break;
      }
      selected.splice(index, 1);
    }
  }

  return selected;
}

function add(blocks, name, priority, content) {
  if (!content) {
    return;
  }

  blocks.push({
    name,
    priority,
    content,
    tokens: estimate(content),
  });
}

function estimateBlocks(blocks) {
  return estimate(blocks.map((block) => block.content).join("\n"));
}

function estimate(text) {
  return Math.ceil(String(text).length / 4);
}

function main() {
  console.log(JSON.stringify(runDemo(), null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
