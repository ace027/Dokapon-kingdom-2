import type { Choice, PlayerId } from "./types";

export type Visibility = { kind: "public" } | { kind: "players"; ids: readonly PlayerId[] };

/** Shared by every public event, so it is frozen: no consumer can retarget all of them at once. */
export const PUBLIC = Object.freeze({ kind: "public" } as const) satisfies Visibility;

/** A frozen players-only visibility over a copy of `ids`. */
export function onlyPlayers(ids: readonly PlayerId[]): Visibility {
  return Object.freeze({ kind: "players", ids: Object.freeze([...ids]) } as const);
}

export type GameEvent =
  | {
      v: 1;
      type: "CounterIncremented";
      visibility: Visibility;
      playerId: PlayerId;
      amount: number;
      counter: number;
    }
  | { v: 1; type: "Rolled"; visibility: Visibility; playerId: PlayerId; value: number }
  | { v: 1; type: "TurnAdvanced"; visibility: Visibility; activePlayer: PlayerId; turn: number }
  | { v: 1; type: "SecretSet"; visibility: Visibility; playerId: PlayerId; note: string }
  | {
      v: 1;
      type: "DecisionOpened";
      visibility: Visibility;
      decisionId: string;
      required: readonly PlayerId[];
    }
  | {
      v: 1;
      type: "ChoiceCommitted";
      visibility: Visibility;
      decisionId: string;
      playerId: PlayerId;
    }
  | { v: 1; type: "ChoiceTimedOut"; visibility: Visibility; decisionId: string; playerId: PlayerId }
  | {
      v: 1;
      type: "ChoicesRevealed";
      visibility: Visibility;
      decisionId: string;
      choices: Readonly<Record<PlayerId, Choice>>;
      timedOut: readonly PlayerId[];
    };
