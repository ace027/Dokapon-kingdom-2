// Content build gate: validates the data dir through the shared validateContent code path.
// Exit codes: 0 valid, 1 invalid content, 2 usage error or unreadable dir.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContentDir } from "../src/load";
import { validateContent, type ContentEntry } from "../src/validate";

const USAGE = "usage: validate [--dir <path>]";

function usageError(): never {
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(args: readonly string[]): string {
  let dir = fileURLToPath(new URL("../data/", import.meta.url));
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    if (arg !== "--dir" || value === undefined) usageError();
    dir = path.resolve(process.cwd(), value);
    i++;
  }
  return dir;
}

const dir = parseArgs(process.argv.slice(2));

function loadOrExit(contentDir: string): ContentEntry[] {
  try {
    return loadContentDir(contentDir);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}

const entries = loadOrExit(dir);

const errors = validateContent(entries);
if (errors.length > 0) {
  for (const { file, path: errorPath, message } of errors) {
    console.log(`✗ ${file} ${errorPath}: ${message}`);
  }
  process.exit(1);
}
console.log(`✓ content valid (${String(entries.length)} files)`);
