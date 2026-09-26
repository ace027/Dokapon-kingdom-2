import type { z } from "zod";
import { CONTENT_REGISTRY, REQUIRED_FILES } from "./registry";

export interface ContentEntry {
  /** Path relative to the data dir, e.g. "items.json". */
  readonly file: string;
  /** Parsed JSON, or `undefined` when the file was not valid JSON. */
  readonly data: unknown;
}

export interface ContentError {
  readonly file: string;
  /** Dotted path such as "items.2.price", or "" for file-level problems. */
  readonly path: string;
  readonly message: string;
}

const registry: Readonly<Record<string, z.ZodType>> = CONTENT_REGISTRY;

function schemaFor(file: string): z.ZodType | undefined {
  return Object.hasOwn(registry, file) ? registry[file] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Generic duplicate-id check for any file whose parsed data has an `items` array of `{id}`. */
function duplicateIdErrors(file: string, data: unknown): ContentError[] {
  if (!isRecord(data) || !Array.isArray(data.items)) return [];
  const errors: ContentError[] = [];
  const firstIndexById = new Map<string, number>();
  data.items.forEach((item: unknown, index: number) => {
    if (!isRecord(item) || typeof item.id !== "string") return;
    const first = firstIndexById.get(item.id);
    if (first === undefined) {
      firstIndexById.set(item.id, index);
      return;
    }
    errors.push({
      file,
      path: `items.${String(index)}.id`,
      message: `duplicate id "${item.id}" (first at items.${String(first)})`,
    });
  });
  return errors;
}

function compareErrors(a: ContentError, b: ContentError): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  return 0;
}

/**
 * Validates content entries against CONTENT_REGISTRY. Pure: shared by the CLI build gate and tests.
 * Returns errors sorted by file, then path (stable for equal keys).
 */
export function validateContent(entries: readonly ContentEntry[]): ContentError[] {
  const errors: ContentError[] = [];
  const present = new Set(entries.map((entry) => entry.file));

  for (const required of REQUIRED_FILES) {
    if (!present.has(required)) {
      errors.push({ file: required, path: "", message: "missing required content file" });
    }
  }

  for (const { file, data } of entries) {
    const schema = schemaFor(file);
    if (schema === undefined) {
      errors.push({ file, path: "", message: "unknown content file (not in CONTENT_REGISTRY)" });
      continue;
    }
    if (data === undefined) {
      errors.push({ file, path: "", message: "invalid JSON" });
      continue;
    }
    const result = schema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, path: issue.path.join("."), message: issue.message });
      }
      continue;
    }
    errors.push(...duplicateIdErrors(file, result.data));
  }

  return errors.sort(compareErrors);
}
