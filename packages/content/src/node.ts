// Node-only entry point (package export "./node"): reads content from disk.
import type { Rules } from "@usurpia/core";
import { buildRules } from "./build-rules";
import { loadContentDir } from "./load";
import type { ContentError } from "./validate";

export { loadContentDir } from "./load";

/** One `${file} ${path}: ${message}` line per error (the format of the content gate). */
export function formatContentError({ file, path, message }: ContentError): string {
  return `${file} ${path}: ${message}`;
}

/** Thrown by {@link loadRules}; `errors` carries every content error, sorted by file then path. */
export class ContentInvalidError extends Error {
  readonly errors: readonly ContentError[];

  constructor(errors: readonly ContentError[]) {
    super(
      [`content invalid: ${String(errors.length)} errors`, ...errors.map(formatContentError)].join(
        "\n",
      ),
    );
    this.name = "ContentInvalidError";
    this.errors = errors;
  }
}

/**
 * Loads, validates and assembles the shipped content. Throws {@link ContentInvalidError} on
 * failure: the message is `content invalid: <n> errors` followed by one line per error.
 */
export function loadRules(dir: string | URL = new URL("../data/", import.meta.url)): Rules {
  const result = buildRules(loadContentDir(dir));
  if (!result.ok) throw new ContentInvalidError(result.errors);
  return result.rules;
}
