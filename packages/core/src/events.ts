import type { ContentId, DefendCommand } from "./rules";
import type { CombatSide, DecisionKind, PlayerId } from "./types";

export type Visibility = { kind: "public" } | { kind: "players"; ids: readonly PlayerId[] };

/** Shared by every public event, so it is frozen: no consumer can retarget all of them at once. */
export const PUBLIC = Object.freeze({ kind: "public" } as const) satisfies Visibility;

/** A frozen players-only visibility over a copy of `ids`. */
export function onlyPlayers(ids: readonly PlayerId[]): Visibility {
  return Object.freeze({ kind: "players", ids: Object.freeze([...ids]) } as const);
}

/**
 * Every event is `{ v: 2, type, visibility, ... }`. The five decision events are emitted by the
 * decision handlers (02-01b); the combat events and `CharacterSet`/`BagUpdated` come from 02-03;
 * later waves add the rest. `PromptOpened` is players-only, and
 * `ChoiceCommitted` never carries the choice.
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
    }
  | {
      v: 2;
      type: "CombatStarted";
      visibility: Visibility;
      combatId: string;
      sides: readonly [CombatSide, CombatSide];
    }
  | {
      v: 2;
      type: "RoundStarted";
      visibility: Visibility;
      combatId: string;
      round: number;
      first: 0 | 1;
    }
  | {
      v: 2;
      type: "ExchangeSkipped";
      visibility: Visibility;
      combatId: string;
      round: number;
      exchange: 1 | 2;
      attacker: 0 | 1;
      reason: "stunned";
    }
  | {
      v: 2;
      type: "ExchangeResolved";
      visibility: Visibility;
      combatId: string;
      round: number;
      exchange: 1 | 2;
      attacker: 0 | 1;
      command: string;
      defense: DefendCommand | "open" | null;
      crit: boolean;
      /** Indexed by side: actual HP lost / gained. */
      damage: readonly [number, number];
      heal: readonly [number, number];
      effects: readonly string[];
      hp: readonly [number, number];
    }
  | {
      v: 2;
      type: "RoundEnded";
      visibility: Visibility;
      combatId: string;
      round: number;
      poison: readonly [number, number];
      regen: readonly [number, number];
      hp: readonly [number, number];
    }
  | {
      v: 2;
      type: "CombatEnded";
      visibility: Visibility;
      combatId: string;
      outcome: "ko" | "fled" | "draw";
      winner: 0 | 1 | null;
      fled: 0 | 1 | null;
      hp: readonly [number, number];
    }
  | {
      v: 2;
      type: "CharacterSet";
      visibility: Visibility;
      playerId: PlayerId;
      classId: ContentId;
      level: number;
      hp: number;
    }
  | {
      v: 2;
      type: "BagUpdated";
      visibility: Visibility;
      playerId: PlayerId;
      bag: readonly ContentId[];
    };
