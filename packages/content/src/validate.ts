import { buildRules } from "./build-rules";

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

/**
 * Validates content entries (file set, schema, duplicate ids, cross-references). Pure: shared by
 * the CLI build gate and tests through `buildRules`. Errors are sorted by file, then path.
 */
export function validateContent(entries: readonly ContentEntry[]): ContentError[] {
  const result = buildRules(entries);
  return result.ok ? [] : result.errors;
}
