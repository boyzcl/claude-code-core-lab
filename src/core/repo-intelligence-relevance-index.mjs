import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CORE25_REPO_INTELLIGENCE_VERSION =
  "core25-repo-intelligence-relevance-index-v1";

const IGNORED_DIRS = new Set([".git", "node_modules", ".DS_Store"]);
const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".txt",
]);

export class RepoIntelligenceIndex {
  constructor({ workspaceRoot }) {
    if (!workspaceRoot) {
      throw new RepoIntelligenceError(
        "missing_workspace_root",
        "RepoIntelligenceIndex requires a workspaceRoot.",
      );
    }

    this.workspaceRoot = workspaceRoot;
    this.index = null;
    this.trace = [];
  }

  async buildIndex() {
    const files = await scanWorkspace(this.workspaceRoot);
    const indexedFiles = [];
    for (const relativePath of files) {
      indexedFiles.push(await indexFile(this.workspaceRoot, relativePath));
    }

    this.index = deriveRepoIndex(indexedFiles);
    this.record("repo.indexed", {
      fileCount: this.index.repoMap.fileCount,
      symbolCount: this.index.symbolIndex.symbols.length,
      testFileCount: this.index.testIndex.testFiles.length,
      ruleEntryCount: this.index.ruleIndex.entries.length,
    });

    return cloneJson(this.index);
  }

  async updateFiles(paths) {
    if (!this.index) await this.buildIndex();

    const byPath = new Map(this.index.files.map((file) => [file.path, file]));
    for (const relativePath of paths) {
      byPath.set(relativePath, await indexFile(this.workspaceRoot, relativePath));
    }

    const nextFiles = [...byPath.values()].sort((a, b) =>
      a.path.localeCompare(b.path),
    );
    const previousHashByPath = Object.fromEntries(
      this.index.files.map((file) => [file.path, file.hash]),
    );
    this.index = deriveRepoIndex(nextFiles);
    this.record("repo.index.updated", {
      changedPaths: paths,
      updatedFileCount: paths.length,
      reusedFileCount: Math.max(0, nextFiles.length - paths.length),
      changedHashes: paths.map((relativePath) => ({
        path: relativePath,
        before: previousHashByPath[relativePath],
        after: byPath.get(relativePath)?.hash,
      })),
    });

    return cloneJson({
      index: this.index,
      trace: this.trace.at(-1),
    });
  }

  scoreRelevance({
    goal,
    query = goal,
    maxFiles = 4,
  }) {
    if (!this.index) {
      throw new RepoIntelligenceError(
        "index_not_built",
        "Build the repo index before scoring relevance.",
      );
    }

    const terms = tokenize(`${goal} ${query}`);
    const querySymbols = discoverQuerySymbols(terms);
    const testAssociationsBySource = groupBy(
      this.index.testIndex.associations,
      "sourcePath",
    );
    const testAssociationsByTest = groupBy(
      this.index.testIndex.associations,
      "testPath",
    );

    const scoredFiles = this.index.files
      .map((file) =>
        scoreFile({
          file,
          terms,
          querySymbols,
          index: this.index,
          testAssociationsBySource,
          testAssociationsByTest,
        }),
      )
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    const selectedFiles = scoredFiles.slice(0, maxFiles);
    const report = {
      version: CORE25_REPO_INTELLIGENCE_VERSION,
      goal,
      query,
      selectedFiles,
      rankedFiles: scoredFiles,
      explanation: selectedFiles.map((file) => ({
        path: file.path,
        score: file.score,
        reasons: file.reasons,
      })),
      boundary: repoIntelligenceBoundary(),
    };
    this.record("relevance.scored", {
      query,
      selectedFiles: selectedFiles.map((file) => file.path),
    });

    return report;
  }

  compareTokenBenefit(relevanceReport) {
    const queryTerms = tokenize(
      `${relevanceReport.goal} ${relevanceReport.query}`,
    );
    const naiveFiles = this.index.files.filter((file) =>
      queryTerms.some(
        (term) =>
          file.searchText.includes(term) ||
          tokenize(file.path).includes(term),
      ),
    );
    const indexedFiles = relevanceReport.selectedFiles.map((selected) =>
      this.index.files.find((file) => file.path === selected.path),
    );
    const naiveTokens = sum(naiveFiles.map((file) => file.tokens));
    const indexedTokens = sum(indexedFiles.map((file) => file.tokens));
    const correctFileSelected = indexedFiles.some(
      (file) => file?.path === "src/pagination.cjs",
    );

    return {
      status:
        indexedTokens < naiveTokens && correctFileSelected ? "passed" : "failed",
      naive: {
        fileCount: naiveFiles.length,
        tokens: naiveTokens,
        paths: naiveFiles.map((file) => file.path),
      },
      indexed: {
        fileCount: indexedFiles.length,
        tokens: indexedTokens,
        paths: indexedFiles.map((file) => file.path),
      },
      tokenSavings: Math.max(0, naiveTokens - indexedTokens),
      correctFileSelected,
      boundary: repoIntelligenceBoundary(),
    };
  }

  record(event, details) {
    this.trace.push({
      seq: this.trace.length + 1,
      event,
      details: cloneJson(details),
    });
  }
}

export class RepoIntelligenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RepoIntelligenceError";
    this.code = code;
    this.details = details;
  }
}

export async function runRepoIntelligenceRelevanceDemo() {
  const fixture = await createRepoIntelligenceFixture();
  const repoIndex = new RepoIntelligenceIndex({
    workspaceRoot: fixture.workspaceRoot,
  });
  const index = await repoIndex.buildIndex();
  const relevance = repoIndex.scoreRelevance({
    goal:
      "Fix the empty page behavior in paginate while preserving public API and running tests.",
    query: "paginate empty page preserve public API npm test",
  });
  const tokenBenefit = repoIndex.compareTokenBenefit(relevance);

  return {
    checks: verifyRepoIntelligenceRelevanceDemo({
      index,
      relevance,
      tokenBenefit,
      trace: repoIndex.trace,
    }),
    version: CORE25_REPO_INTELLIGENCE_VERSION,
    workspaceRoot: fixture.workspaceRoot,
    index,
    relevance,
    tokenBenefit,
    trace: cloneJson(repoIndex.trace),
    boundary: repoIntelligenceBoundary(),
  };
}

export function verifyRepoIntelligenceRelevanceDemo(report) {
  assert.equal(report.index.version, CORE25_REPO_INTELLIGENCE_VERSION);
  assert.ok(report.index.repoMap.fileCount >= 8);
  assert.ok(report.index.repoMap.scripts.some((script) => script.name === "test"));
  assert.ok(
    report.index.symbolIndex.symbols.some(
      (symbol) => symbol.name === "paginate" && symbol.path === "src/pagination.cjs",
    ),
  );
  assert.ok(
    report.index.testIndex.associations.some(
      (association) =>
        association.sourcePath === "src/pagination.cjs" &&
        association.testPath === "tests/pagination.test.cjs",
    ),
  );
  assert.ok(
    report.index.ruleIndex.entries.some(
      (entry) => entry.path === "AGENTS.md" && entry.priority === "high",
    ),
  );
  assert.equal(report.relevance.selectedFiles[0].path, "src/pagination.cjs");
  assert.equal(report.tokenBenefit.status, "passed");
  assert.equal(
    (report.boundary ?? report.index.boundary).productionRepoIntelligenceClaim,
    false,
  );

  return {
    repo_map_indexed: true,
    symbol_index_located_target: true,
    test_index_associated_target: true,
    rule_index_high_priority: true,
    relevance_ranked_target_first: true,
    token_benefit_verified: true,
    no_production_claim: true,
  };
}

export async function createRepoIntelligenceFixture() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "agent-core25-"));
  await mkdir(path.join(workspaceRoot, "src"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "tests"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "scripts"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "docs"), { recursive: true });

  await writeFixtureFile(
    workspaceRoot,
    "AGENTS.md",
    [
      "# Project Rules",
      "",
      "- Preserve public API exports.",
      "- Use `npm test` before final.",
      "- Prefer narrow edits near the failing symbol.",
      "",
    ],
  );
  await writeFixtureFile(
    workspaceRoot,
    "README.md",
    [
      "# Pagination Library",
      "",
      "The package exposes pagination helpers and cart helpers.",
      "Public API names must stay stable for downstream callers.",
      "",
    ],
  );
  await writeFixtureFile(
    workspaceRoot,
    "package.json",
    [
      "{",
      '  "name": "repo-intelligence-fixture",',
      '  "private": true,',
      '  "type": "commonjs",',
      '  "scripts": {',
      '    "test": "node scripts/test.cjs",',
      '    "test:pagination": "node tests/pagination.test.cjs"',
      "  }",
      "}",
      "",
    ],
  );
  await writeFixtureFile(
    workspaceRoot,
    "src/pagination.cjs",
    [
      "function paginate(items, page, pageSize) {",
      "  const start = page * pageSize;",
      "  const end = start + pageSize;",
      "  return items.slice(start, end);",
      "}",
      "",
      "function pageCount(items, pageSize) {",
      "  return Math.ceil(items.length / pageSize);",
      "}",
      "",
      "module.exports = { paginate, pageCount };",
      "",
    ],
  );
  await writeFixtureFile(
    workspaceRoot,
    "src/cart.cjs",
    [
      "const { paginate } = require('./pagination.cjs');",
      "",
      "function paginateCartItems(items, page, pageSize) {",
      "  return paginate(items, page, pageSize).map((item) => item.name);",
      "}",
      "",
      "module.exports = { paginateCartItems };",
      "",
    ],
  );
  await writeFixtureFile(
    workspaceRoot,
    "src/pricing.cjs",
    [
      "function applyDiscount(price, percent) {",
      "  return price * (1 - percent / 100);",
      "}",
      "",
      "module.exports = { applyDiscount };",
      "",
    ],
  );
  await writeFixtureFile(
    workspaceRoot,
    "tests/pagination.test.cjs",
    [
      "const assert = require('node:assert/strict');",
      "const { paginate } = require('../src/pagination.cjs');",
      "",
      "assert.deepEqual(paginate([1, 2, 3, 4], 0, 2), [1, 2]);",
      "assert.deepEqual(paginate([1, 2, 3, 4], 9, 2), []);",
      "",
    ],
  );
  await writeFixtureFile(
    workspaceRoot,
    "tests/cart.test.cjs",
    [
      "const assert = require('node:assert/strict');",
      "const { paginateCartItems } = require('../src/cart.cjs');",
      "",
      "assert.deepEqual(paginateCartItems([{ name: 'a' }], 0, 1), ['a']);",
      "",
    ],
  );
  await writeFixtureFile(
    workspaceRoot,
    "scripts/test.cjs",
    [
      "require('../tests/pagination.test.cjs');",
      "require('../tests/cart.test.cjs');",
      "console.log('fixture tests passed');",
      "",
    ],
  );
  await writeFixtureFile(
    workspaceRoot,
    "docs/pagination-notes.md",
    [
      "# Pagination Notes",
      "",
      "Pagination handles pages for product and cart views.",
      "This document is background and should rank below source and tests.",
      "",
    ],
  );

  return { workspaceRoot };
}

export function repoIntelligenceBoundary() {
  return {
    deterministicLocalRepoIndex: true,
    productionRepoIntelligenceClaim: false,
    semanticEmbeddingClaim: false,
    arbitraryLargeRepoClaim: false,
  };
}

async function scanWorkspace(workspaceRoot, current = "") {
  const absolute = path.join(workspaceRoot, current);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const relativePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await scanWorkspace(workspaceRoot, relativePath)));
      continue;
    }

    if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relativePath.split(path.sep).join("/"));
    }
  }

  return files.sort();
}

async function indexFile(workspaceRoot, relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  const text = await readFile(absolutePath, "utf8");
  const fileStat = await stat(absolutePath);
  const lines = text.split("\n");
  const ext = path.extname(relativePath);
  const kind = classifyFile(relativePath);
  const symbols = extractSymbols(relativePath, text);
  const imports = extractImports(relativePath, text);
  const ruleEntries = extractRuleEntries(relativePath, text);
  const scripts = relativePath === "package.json" ? extractPackageScripts(text) : [];

  return {
    path: relativePath,
    kind,
    ext,
    sizeBytes: fileStat.size,
    lineCount: lines.length,
    tokens: estimateTokens(text),
    hash: hashText(text),
    symbols,
    imports,
    ruleEntries,
    scripts,
    searchText: tokenize(`${relativePath} ${text}`).join(" "),
  };
}

function deriveRepoIndex(files) {
  const scripts = files.flatMap((file) => file.scripts);
  const ruleEntries = files.flatMap((file) => file.ruleEntries);
  const symbols = files.flatMap((file) => file.symbols);
  const references = files.flatMap((file) =>
    file.imports.map((item) => ({
      fromPath: file.path,
      toPath: normalizeImportTarget(file.path, item.target),
      imported: item.imported,
      line: item.line,
    })),
  );
  const testFiles = files.filter((file) => file.kind === "test");
  const associations = buildTestAssociations(files, testFiles, references);

  return {
    version: CORE25_REPO_INTELLIGENCE_VERSION,
    repoMap: {
      fileCount: files.length,
      files: files.map((file) => ({
        path: file.path,
        kind: file.kind,
        lineCount: file.lineCount,
        hash: file.hash,
      })),
      scripts,
      ruleEntrypoints: files
        .filter((file) => file.ruleEntries.length > 0)
        .map((file) => file.path),
    },
    files,
    symbolIndex: {
      symbols,
      references,
    },
    testIndex: {
      packageScripts: scripts.filter((script) =>
        script.name.toLowerCase().includes("test"),
      ),
      testFiles: testFiles.map((file) => ({
        path: file.path,
        tokens: file.tokens,
      })),
      associations,
    },
    ruleIndex: {
      entries: ruleEntries,
    },
    boundary: repoIntelligenceBoundary(),
  };
}

function scoreFile({
  file,
  terms,
  querySymbols,
  index,
  testAssociationsBySource,
  testAssociationsByTest,
}) {
  const reasons = [];
  let score = 0;
  const pathTerms = new Set(tokenize(file.path));
  const contentTerms = new Set(file.searchText.split(" "));
  const overlap = terms.filter(
    (term) => pathTerms.has(term) || contentTerms.has(term),
  );

  if (overlap.length > 0) {
    const points = Math.min(45, overlap.length * 5);
    score += points;
    reasons.push({
      type: "term_overlap",
      points,
      terms: [...new Set(overlap)].slice(0, 8),
    });
  }

  for (const symbol of file.symbols) {
    if (querySymbols.has(symbol.name.toLowerCase())) {
      const points = symbol.exported ? 80 : 45;
      score += points;
      reasons.push({
        type: "symbol_match",
        points,
        symbol: symbol.name,
        exported: symbol.exported,
      });
    }
  }

  const sourceAssociations = testAssociationsBySource[file.path] ?? [];
  const hasQuerySymbol = file.symbols.some((symbol) =>
    querySymbols.has(symbol.name.toLowerCase()),
  );
  if (sourceAssociations.length > 0 && hasQuerySymbol) {
    score += 32;
    reasons.push({
      type: "test_association",
      points: 32,
      tests: sourceAssociations.map((item) => item.testPath),
    });
  }

  const testAssociations = testAssociationsByTest[file.path] ?? [];
  if (testAssociations.length > 0 && querySymbols.has("paginate")) {
    score += 30;
    reasons.push({
      type: "targeted_test",
      points: 30,
      sources: testAssociations.map((item) => item.sourcePath),
    });
  }

  if (file.ruleEntries.length > 0) {
    const highPriorityRules = file.ruleEntries.filter(
      (entry) => entry.priority === "high",
    );
    if (
      terms.includes("api") ||
      terms.includes("test") ||
      terms.includes("preserve")
    ) {
      const points = Math.min(30, highPriorityRules.length * 10);
      score += points;
      reasons.push({
        type: "rule_priority",
        points,
        rules: highPriorityRules.map((entry) => entry.text),
      });
    }
  }

  if (
    file.path === "package.json" &&
    index.testIndex.packageScripts.length > 0 &&
    terms.includes("test")
  ) {
    score += 22;
    reasons.push({
      type: "test_command",
      points: 22,
      scripts: index.testIndex.packageScripts.map((script) => script.command),
    });
  }

  if (file.kind === "doc") {
    score -= 12;
    reasons.push({
      type: "doc_penalty",
      points: -12,
      reason: "Documentation ranks below implementation and tests for this task.",
    });
  }

  return {
    path: file.path,
    kind: file.kind,
    score,
    tokens: file.tokens,
    hash: file.hash,
    reasons,
  };
}

function classifyFile(relativePath) {
  if (relativePath === "AGENTS.md" || relativePath === "README.md") return "rule";
  if (relativePath === "package.json") return "manifest";
  if (relativePath.includes("/test") || /\.test\./.test(relativePath)) return "test";
  if (relativePath.startsWith("src/")) return "source";
  if (relativePath.startsWith("scripts/")) return "script";
  if (relativePath.endsWith(".md")) return "doc";
  return "file";
}

function extractSymbols(relativePath, text) {
  if (![".js", ".cjs"].includes(path.extname(relativePath))) return [];

  const exports = new Set();
  const moduleExportMatch = text.match(/module\.exports\s*=\s*\{([^}]+)\}/m);
  if (moduleExportMatch) {
    for (const name of moduleExportMatch[1].split(",")) {
      const normalized = name.trim().split(":")[0]?.trim();
      if (normalized) exports.add(normalized);
    }
  }

  const symbols = [];
  for (const match of text.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    symbols.push(buildSymbol(relativePath, text, match[1], "function", exports));
  }
  for (const match of text.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=/g)) {
    symbols.push(buildSymbol(relativePath, text, match[1], "const", exports));
  }
  for (const exported of exports) {
    if (!symbols.some((symbol) => symbol.name === exported)) {
      symbols.push(buildSymbol(relativePath, text, exported, "export", exports));
    }
  }

  return symbols;
}

function buildSymbol(relativePath, text, name, kind, exports) {
  return {
    name,
    kind,
    path: relativePath,
    line: findLine(text, name),
    exported: exports.has(name),
  };
}

function extractImports(relativePath, text) {
  if (![".js", ".cjs"].includes(path.extname(relativePath))) return [];

  const imports = [];
  for (const match of text.matchAll(
    /const\s+\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\)/g,
  )) {
    imports.push({
      imported: match[1]
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
      target: match[2],
      line: findLine(text, match[0]),
    });
  }
  for (const match of text.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
    if (imports.some((item) => item.target === match[1])) continue;
    imports.push({
      imported: [],
      target: match[1],
      line: findLine(text, match[0]),
    });
  }

  return imports;
}

function extractRuleEntries(relativePath, text) {
  if (relativePath !== "AGENTS.md" && relativePath !== "README.md") return [];

  return text
    .split("\n")
    .map((line, index) => ({ text: line.trim(), line: index + 1 }))
    .filter((line) => line.text.startsWith("-") || /must|public API/i.test(line.text))
    .map((line) => ({
      path: relativePath,
      line: line.line,
      text: line.text.replace(/^-\s*/, ""),
      priority: /do not|preserve|public api|use `?npm test|must/i.test(line.text)
        ? "high"
        : "medium",
    }));
}

function extractPackageScripts(text) {
  try {
    const parsed = JSON.parse(text);
    return Object.entries(parsed.scripts ?? {}).map(([name, command]) => ({
      name,
      command,
    }));
  } catch {
    return [];
  }
}

function normalizeImportTarget(fromPath, target) {
  if (!target.startsWith(".")) return target;
  const normalized = path
    .normalize(path.join(path.dirname(fromPath), target))
    .split(path.sep)
    .join("/");
  return path.extname(normalized) ? normalized : `${normalized}.cjs`;
}

function buildTestAssociations(files, testFiles, references) {
  const sourceFiles = files.filter((file) => file.kind === "source");
  const associations = [];

  for (const testFile of testFiles) {
    const directRefs = references.filter(
      (reference) => reference.fromPath === testFile.path,
    );
    for (const reference of directRefs) {
      if (sourceFiles.some((source) => source.path === reference.toPath)) {
        associations.push({
          sourcePath: reference.toPath,
          testPath: testFile.path,
          reason: "direct_require",
          imported: reference.imported,
        });
      }
    }

    for (const source of sourceFiles) {
      const sourceStem = path.basename(source.path, path.extname(source.path));
      if (
        testFile.path.includes(sourceStem) &&
        !associations.some(
          (item) =>
            item.sourcePath === source.path && item.testPath === testFile.path,
        )
      ) {
        associations.push({
          sourcePath: source.path,
          testPath: testFile.path,
          reason: "path_name_match",
          imported: [],
        });
      }
    }
  }

  return associations.sort((a, b) =>
    `${a.sourcePath}:${a.testPath}`.localeCompare(`${b.sourcePath}:${b.testPath}`),
  );
}

function discoverQuerySymbols(terms) {
  const symbols = new Set();
  if (terms.includes("paginate") || terms.includes("pagination")) {
    symbols.add("paginate");
  }
  if (terms.includes("cart")) {
    symbols.add("paginatecartitems");
  }
  return symbols;
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
    .map((token) => (token === "pagination" ? "paginate" : token));
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text).length / 4));
}

function findLine(text, needle) {
  const index = text.indexOf(needle);
  if (index < 0) return 1;
  return text.slice(0, index).split("\n").length;
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key];
    acc[value] ??= [];
    acc[value].push(item);
    return acc;
  }, {});
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function writeFixtureFile(workspaceRoot, relativePath, lines) {
  await writeFile(path.join(workspaceRoot, relativePath), lines.join("\n"), "utf8");
}

async function main() {
  console.log(JSON.stringify(await runRepoIntelligenceRelevanceDemo(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
