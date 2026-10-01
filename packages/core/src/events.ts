import type { Grant } from "./actions";
import type { ContentId, DefendCommand } from "./rules";
import type { CombatSide, DecisionKind, PlayerId, SCHEMA_VERSION } from "./types";

export type Visibility = { kind: "public" } | { kind: "players"; ids: readonly PlayerId[] };

/** Shared by every public event, so it is frozen: no consumer can retarget all of them at once. */
export const PUBLIC = Object.freeze({ kind: "public" } as const) satisfies Visibility;

/** A frozen players-only visibility over a copy of `ids`. */
export function onlyPlayers(ids: readonly PlayerId[]): Visibility {
  return Object.freeze({ kind: "players", ids: Object.freeze([...ids]) } as const);
}

/**
 * Every event is `{ v: SCHEMA_VERSION, type, visibility, ... }`. Decision events come from the
 * decision handlers, combat events and `CharacterSet`/`BagUpdated` from the combat and system
 * handlers, progression and loadout events from the loadout handlers. `PromptOpened` is
 * players-only, and `ChoiceCommitted` never carries the choice.
 */
export type GameEvent =
  | {
      v: typeof SCHEMA_VERSION;
      type: "DecisionOpened";
      visibility: Visibility;
      decisionId: string;
      kind: DecisionKind;
      required: readonly PlayerId[];
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "PromptOpened";
      visibility: Visibility;
      decisionId: string;
      playerId: PlayerId;
      options: readonly string[];
      default: string;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "ChoiceCommitted";
      visibility: Visibility;
      decisionId: string;
      playerId: PlayerId;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "ChoiceTimedOut";
      visibility: Visibility;
      decisionId: string;
      playerId: PlayerId;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "ChoicesRevealed";
      visibility: Visibility;
      decisionId: string;
      kind: DecisionKind;
      choices: Readonly<Record<PlayerId, string>>;
      timedOut: readonly PlayerId[];
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "CombatStarted";
      visibility: Visibility;
      combatId: string;
      sides: readonly [CombatSide, CombatSide];
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "RoundStarted";
      visibility: Visibility;
      combatId: string;
      round: number;
      first: 0 | 1;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "ExchangeSkipped";
      visibility: Visibility;
      combatId: string;
      round: number;
      exchange: 1 | 2;
      attacker: 0 | 1;
      reason: "stunned";
    }
  | {
      v: typeof SCHEMA_VERSION;
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
      v: typeof SCHEMA_VERSION;
      type: "RoundEnded";
      visibility: Visibility;
      combatId: string;
      round: number;
      poison: readonly [number, number];
      regen: readonly [number, number];
      hp: readonly [number, number];
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "CombatEnded";
      visibility: Visibility;
      combatId: string;
      outcome: "ko" | "fled" | "draw";
      winner: 0 | 1 | null;
      fled: 0 | 1 | null;
      hp: readonly [number, number];
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "CharacterSet";
      visibility: Visibility;
      playerId: PlayerId;
      classId: ContentId;
      level: number;
      hp: number;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "BagUpdated";
      visibility: Visibility;
      playerId: PlayerId;
      bag: readonly ContentId[];
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "ScrollsUpdated";
      visibility: Visibility;
      playerId: PlayerId;
      scrolls: readonly ContentId[];
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "Granted";
      visibility: Visibility;
      playerId: PlayerId;
      grant: Grant;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "LevelUp";
      visibility: Visibility;
      playerId: PlayerId;
      level: number;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "VictoryRewarded";
      visibility: Visibility;
      playerId: PlayerId;
      xp: number;
      gold: number;
      classId: ContentId;
      masteryWins: number;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "MasteryRankUp";
      visibility: Visibility;
      playerId: PlayerId;
      classId: ContentId;
      rank: number;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "HybridUnlocked";
      visibility: Visibility;
      playerId: PlayerId;
      classId: ContentId;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "ClassSwitched";
      visibility: Visibility;
      playerId: PlayerId;
      from: ContentId;
      to: ContentId;
      fee: number;
      hp: number;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "ItemUsed";
      visibility: Visibility;
      playerId: PlayerId;
      itemId: ContentId;
      healed: number;
      hp: number;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "PortableSet";
      visibility: Visibility;
      playerId: PlayerId;
      classId: ContentId | null;
      hp: number;
    };
