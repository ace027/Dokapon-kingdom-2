import type { HandlerMap } from "./shared";

/**
 * The exhaustive handler map. Empty in 02-01a because `Action` is the empty union; 02-01b adds
 * the decision handlers and later waves add the rest.
 */
export const handlers = {} satisfies HandlerMap;
