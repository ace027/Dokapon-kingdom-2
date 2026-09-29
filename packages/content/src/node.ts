// Node-only entry point (package export "./node"): reads content from disk.
import type { Rules } from "@usurpia/core";
import { buildRules } from "./build-rules";
import { loadContentDir } from "./load";

export { loadContentDir } from "./load";

/** Loads, validates and assembles the shipped content. Throws `content invalid: <n> errors` on failure. */
export function loadRules(dir: string | URL = new URL("../data/", import.meta.url)): Rules {
  const result = buildRules(loadContentDir(dir));
  if (!result.ok) throw new Error(`content invalid: ${String(result.errors.length)} errors`);
  return result.rules;
}
