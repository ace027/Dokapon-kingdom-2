import type { Rules } from "@usurpia/core";
import { KERNEL_RULES } from "./kernel-rules";

/** The single rules source for the sim CLI and tests (W1: the kernel TEST_RULES copy). */
export function replayRules(): Rules {
  return KERNEL_RULES;
}
