import type { Choice, PlayerId, SYSTEM_ACTOR } from "./types";

/** Every action carries `v` and `playerId`. See the phase spec for per-type rules. */
export type Action =
  | { v: 1; type: "sample/increment"; playerId: PlayerId; amount: number }
  | { v: 1; type: "sample/roll"; playerId: PlayerId }
  | { v: 1; type: "sample/setSecret"; playerId: PlayerId; note: string }
  | {
      v: 1;
      type: "decision/open";
      playerId: typeof SYSTEM_ACTOR;
      required: PlayerId[];
      defaultChoice: Choice;
    }
  | { v: 1; type: "decision/commit"; playerId: PlayerId; decisionId: string; choice: Choice }
  | { v: 1; type: "timeout"; playerId: typeof SYSTEM_ACTOR; decisionId: string };

export type ActionType = Action["type"];

export const ACTION_TYPES = [
  "sample/increment",
  "sample/roll",
  "sample/setSecret",
  "decision/open",
  "decision/commit",
  "timeout",
] as const satisfies readonly ActionType[];

export function isActionType(value: unknown): value is ActionType {
  return ACTION_TYPES.some((type) => type === value);
}
