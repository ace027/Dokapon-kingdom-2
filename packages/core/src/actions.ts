/**
 * The action union. In 02-01a it is empty: every versioned object is then `UNKNOWN_ACTION`.
 * 02-01b adds the W1 members (`decision/open`, `decision/commit`, `timeout`) together with their
 * guards and handlers; later waves extend this union, `ACTION_TYPES` and the handler map together.
 */
export type Action = never;

export type ActionType = Action["type"];

export const ACTION_TYPES: readonly Action["type"][] = [];
