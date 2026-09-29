import type { DecisionKind, PlayerId } from "./types";

export type Visibility = { kind: "public" } | { kind: "players"; ids: readonly PlayerId[] };

/** Shared by every public event, so it is frozen: no consumer can retarget all of them at once. */
export const PUBLIC = Object.freeze({ kind: "public" } as const) satisfies Visibility;

/** A frozen players-only visibility over a copy of `ids`. */
export function onlyPlayers(ids: readonly PlayerId[]): Visibility {
  return Object.freeze({ kind: "players", ids: Object.freeze([...ids]) } as const);
}

/**
 * Every event is `{ v: 2, type, visibility, ... }`. Only the five decision events are declared
 * in 02-01a (types only: nothing emits them until 02-01b); later waves add the rest.
 */
export type GameEvent =
  | {
      v: 2;
      type: "DecisionOpened";
      visibility: Visibility;
      decisionId: string;
      kind: DecisionKind;
      required: readonly PlayerId[];
    }
  | {
      v: 2;
      type: "PromptOpened";
      visibility: Visibility;
      decisionId: string;
      playerId: PlayerId;
      options: readonly string[];
      default: string;
    }
  | {
      v: 2;
      type: "ChoiceCommitted";
      visibility: Visibility;
      decisionId: string;
      playerId: PlayerId;
    }
  | { v: 2; type: "ChoiceTimedOut"; visibility: Visibility; decisionId: string; playerId: PlayerId }
  | {
      v: 2;
      type: "ChoicesRevealed";
      visibility: Visibility;
      decisionId: string;
      kind: DecisionKind;
      choices: Readonly<Record<PlayerId, string>>;
      timedOut: readonly PlayerId[];
    };
