import type { PlayerId } from "./types";

/**
 * The action union. Every action is `{ v: 2, type, playerId, ...payload }` with exactly the listed
 * keys. The W1b members are the three decision actions; later waves extend this union,
 * `ACTION_TYPES` and the handler map together.
 */
export type Action =
  | {
      v: 2;
      type: "decision/open";
      playerId: "system";
      prompts: { playerId: PlayerId; options: string[]; default: string }[];
    }
  | { v: 2; type: "decision/commit"; playerId: PlayerId; decisionId: string; choice: string }
  | { v: 2; type: "timeout"; playerId: "system"; decisionId: string };

export type ActionType = Action["type"];

export const ACTION_TYPES: readonly ActionType[] = ["decision/open", "decision/commit", "timeout"];
