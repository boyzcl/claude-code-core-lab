import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirs = new Set([".git", "node_modules"]);
const externalProtocols = /^(https?:|mailto:|tel:)/i;
const markdownLinkPattern = /!?\[[^\]]*]\(([^)\s]+(?:\s+"[^"]*")?)\)/g;

const markdownFiles = await listMarkdownFiles(root);
const failures = [];
let checkedLinks = 0;
let externalLinks = 0;

for (const file of markdownFiles) {
  const text = await readFile(file, "utf8");
  const searchable = stripFencedCode(text);
  const relativeFile = path.relative(root, file);

  for (const match of searchable.matchAll(markdownLinkPattern)) {
    const rawTarget = match[1].trim().replace(/\s+"[^"]*"$/, "");
    const target = rawTarget.replace(/^<|>$/g, "");

    if (!target || target.startsWith("#")) {
      continue;
    }

    if (externalProtocols.test(target)) {
      externalLinks += 1;
      continue;
    }

    if (target.startsWith("data:")) {
      continue;
    }

    checkedLinks += 1;

    const [targetPath] = target.split("#");
    const withoutQuery = targetPath.split("?")[0];
    const decodedTarget = safeDecode(withoutQuery);
    const absoluteTarget = path.resolve(path.dirname(file), decodedTarget);

    if (!absoluteTarget.startsWith(root)) {
      failures.push(`${relativeFile}: link escapes repository: ${target}`);
      continue;
    }

    try {
      await stat(absoluteTarget);
    } catch {
      failures.push(`${relativeFile}: missing link target: ${target}`);
    }
  }
}

if (failures.length > 0) {
  console.error("docs link check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `docs link check: ${checkedLinks} internal links passed, ${externalLinks} external links recorded`
);

async function listMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(absolute)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(absolute);
    }
  }

  return files;
}

function stripFencedCode(text) {
  return text.replace(/```[\s\S]*?```/g, "");
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
