import path from "node:path";
import type { Rules } from "@usurpia/core";
import { loadRules } from "@usurpia/content/node";

/** Same variable as the content build gate (`packages/content/scripts/validate.ts`). */
const DIR_ENV = "USURPIA_CONTENT_DIR";

/**
 * The single rules source for the sim CLI and tests: the shipped content, or the data dir named
 * by `USURPIA_CONTENT_DIR` (resolved against the cwd) when that variable is set and non-empty.
 */
export function replayRules(): Rules {
  const fromEnv = process.env[DIR_ENV];
  return fromEnv !== undefined && fromEnv !== ""
    ? loadRules(path.resolve(process.cwd(), fromEnv))
    : loadRules();
}
