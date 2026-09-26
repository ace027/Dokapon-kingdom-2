// Node-only: reads a content data dir from disk. Not re-exported from index.ts (keeps index browser-safe).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentEntry } from "./validate";

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Reads every `*.json` file in `dir` (sorted by name). A file that is not valid JSON yields
 * `data: undefined`, which validateContent reports as "invalid JSON".
 * Throws `content dir not found: <dir>` when `dir` does not exist or is not a directory.
 */
export function loadContentDir(dir: string | URL): ContentEntry[] {
  const dirPath = dir instanceof URL ? fileURLToPath(dir) : dir;
  if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
    throw new Error(`content dir not found: ${dirPath}`);
  }
  return readdirSync(dirPath)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((file) => ({ file, data: parseJson(readFileSync(path.join(dirPath, file), "utf8")) }));
}
