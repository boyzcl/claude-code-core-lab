import { readFileSync } from "node:fs";
import path from "node:path";

export function loadLocalEnv({
  filePath = path.resolve(process.cwd(), ".env.local"),
  override = false,
} = {}) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { loaded: false, filePath };
    throw error;
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = unquoteEnvValue(trimmed.slice(index + 1).trim());
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return { loaded: true, filePath };
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
