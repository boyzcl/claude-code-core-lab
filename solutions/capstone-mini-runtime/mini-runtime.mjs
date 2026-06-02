import { spawnSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const VERIFY_COMMAND = "node test-calculator.mjs";

export async function runMiniRuntime({ workspace, objective = "Fix calculator add() and verify tests" } = {}) {
  if (!workspace) {
    throw new Error("workspace is required");
  }

  const tools = createToolRuntime(workspace);
  const trace = [];

  const search = await tools.search("return a - b");
  trace.push({ tool: "Search", input: { query: "return a - b" }, output: search });

  if (search.files.length === 0) {
    return failedResult(objective, trace, "Search found no candidate file.");
  }

  const targetFile = search.files[0];
  const read = await tools.read(targetFile);
  trace.push({ tool: "Read", input: { file: targetFile }, output: { bytes: read.text.length } });

  const edit = await tools.edit(targetFile, "return a - b", "return a + b");
  trace.push({ tool: "Edit", input: { file: targetFile }, output: edit });

  if (!edit.ok) {
    return failedResult(objective, trace, `Edit failed: ${edit.error}`);
  }

  const bash = tools.bash(VERIFY_COMMAND);
  trace.push({
    tool: "Bash",
    input: { command: VERIFY_COMMAND },
    output: {
      exitCode: bash.exitCode,
      stdout: bash.stdout,
      stderr: bash.stderr
    }
  });

  const verify = {
    passed: bash.exitCode === 0,
    command: VERIFY_COMMAND
  };
  trace.push({ tool: "Verify", input: { command: VERIFY_COMMAND }, output: verify });

  if (!verify.passed) {
    return failedResult(objective, trace, "Verification command failed.");
  }

  return {
    objective,
    status: "verified",
    trace,
    finalAnswer: `Fixed add() and verified with ${VERIFY_COMMAND}. This is local capstone evidence, not a production capability claim.`
  };
}

export function createToolRuntime(workspace) {
  const readFiles = new Set();

  return {
    async search(query) {
      const files = await listFiles(workspace);
      const matches = [];

      for (const file of files) {
        const absolute = path.join(workspace, file);
        const text = await readFile(absolute, "utf8");

        if (text.includes(query)) {
          matches.push(file);
        }
      }

      return { files: matches };
    },

    async read(file) {
      const safeFile = safeRelativePath(file);
      const text = await readFile(path.join(workspace, safeFile), "utf8");
      readFiles.add(safeFile);
      return { file: safeFile, text };
    },

    async edit(file, oldText, newText) {
      const safeFile = safeRelativePath(file);

      if (!readFiles.has(safeFile)) {
        return { ok: false, error: "edit_requires_prior_read" };
      }

      const absolute = path.join(workspace, safeFile);
      const text = await readFile(absolute, "utf8");
      const matchCount = text.split(oldText).length - 1;

      if (matchCount !== 1) {
        return { ok: false, error: "old_text_must_match_once", matchCount };
      }

      await writeFile(absolute, text.replace(oldText, newText));
      return { ok: true, file: safeFile };
    },

    bash(command) {
      if (command !== VERIFY_COMMAND) {
        return {
          command,
          exitCode: 1,
          stdout: "",
          stderr: "command_not_allowed"
        };
      }

      const child = spawnSync("node", ["test-calculator.mjs"], {
        cwd: workspace,
        encoding: "utf8"
      });

      return {
        command,
        exitCode: child.status ?? 1,
        stdout: child.stdout,
        stderr: child.stderr
      };
    }
  };
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(root, entry.name);

    if (entry.isDirectory()) {
      const nested = await listFiles(absolute);
      files.push(...nested.map((file) => path.join(entry.name, file)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".mjs")) {
      files.push(entry.name);
    }
  }

  return files.map((file) => file.split(path.sep).join("/"));
}

function safeRelativePath(file) {
  const normalized = path.normalize(file);

  if (path.isAbsolute(normalized) || normalized.startsWith("..")) {
    throw new Error(`unsafe path: ${file}`);
  }

  return normalized.split(path.sep).join("/");
}

function failedResult(objective, trace, reason) {
  return {
    objective,
    status: "failed",
    trace,
    finalAnswer: `Could not verify the fix: ${reason}`
  };
}
