import type { Rules } from "@usurpia/core";
import { loadRules } from "@usurpia/content/node";

/** The single rules source for the sim CLI and tests: the shipped content. */
export function replayRules(): Rules {
  return loadRules();
}
