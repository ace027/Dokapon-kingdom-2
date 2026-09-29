import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContentDir } from "../src/load";
import type { ContentEntry } from "../src/validate";

export const DATA_DIR = new URL("../data/", import.meta.url);

/** The shipped content, parsed. */
export function loadEntries(): ContentEntry[] {
  return loadContentDir(DATA_DIR);
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

/**
 * Deep clone of `entries` with exactly one change: `mutate` receives the parsed root of `file`.
 * The input is never modified.
 */
export function mutateEntry(
  entries: readonly ContentEntry[],
  file: string,
  mutate: (root: JsonObject) => void,
): ContentEntry[] {
  const copy = structuredClone(entries) as ContentEntry[];
  const entry = copy.find((candidate) => candidate.file === file);
  if (entry === undefined || !isObject(entry.data)) throw new Error(`no object entry ${file}`);
  mutate(entry.data);
  return copy;
}

/** Walks a dotted path (`classes.4.parents`) from `root` and returns the container and last key. */
function locate(root: JsonObject, dotted: string): { parent: JsonObject; key: string } {
  const keys = dotted.split(".");
  const last = keys.pop();
  if (last === undefined) throw new Error("empty path");
  let node: unknown = root;
  for (const key of keys) {
    if (!isObject(node)) throw new Error(`path ${dotted} leaves the data at ${key}`);
    node = node[key];
  }
  if (!isObject(node)) throw new Error(`path ${dotted} has no container`);
  return { parent: node, key: last };
}

/** One mutation: replace the value at `dotted` inside `file` with `fn(oldValue)`. */
export function updatePath(
  entries: readonly ContentEntry[],
  file: string,
  dotted: string,
  fn: (old: unknown) => unknown,
): ContentEntry[] {
  return mutateEntry(entries, file, (root) => {
    const { parent, key } = locate(root, dotted);
    parent[key] = fn(parent[key]);
  });
}

/** One mutation: set the value at `dotted` inside `file`. */
export function setPath(
  entries: readonly ContentEntry[],
  file: string,
  dotted: string,
  value: unknown,
): ContentEntry[] {
  return updatePath(entries, file, dotted, () => value);
}

/** One mutation: delete the key at `dotted` inside `file`. */
export function removeKey(
  entries: readonly ContentEntry[],
  file: string,
  dotted: string,
): ContentEntry[] {
  return mutateEntry(entries, file, (root) => {
    const { parent, key } = locate(root, dotted);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete parent[key];
  });
}

/** Reads the value at `dotted` (for copying between fields). */
export function readPath(entries: readonly ContentEntry[], file: string, dotted: string): unknown {
  const entry = entries.find((candidate) => candidate.file === file);
  if (entry === undefined || !isObject(entry.data)) throw new Error(`no object entry ${file}`);
  const { parent, key } = locate(entry.data, dotted);
  return parent[key];
}

/**
 * Copies `data/` into a fresh temp dir, optionally applying exactly one mutation to one file
 * (for the CLI tests). Remove the dir with `cleanupTemp`.
 */
export function copyDataToTemp(mutation?: {
  file: string;
  mutate: (root: JsonObject) => void;
}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "usurpia-content-"));
  const source = fileURLToPath(DATA_DIR);
  for (const name of fs.readdirSync(source)) {
    fs.copyFileSync(path.join(source, name), path.join(dir, name));
  }
  if (mutation !== undefined) {
    const target = path.join(dir, mutation.file);
    const root = JSON.parse(fs.readFileSync(target, "utf8")) as unknown;
    if (!isObject(root)) throw new Error(`${mutation.file} is not an object`);
    mutation.mutate(root);
    fs.writeFileSync(target, JSON.stringify(root));
  }
  return dir;
}

export function cleanupTemp(dir: string | undefined): void {
  if (dir !== undefined) fs.rmSync(dir, { recursive: true, force: true });
}
