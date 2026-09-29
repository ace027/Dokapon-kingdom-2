import type { Command, ContentId, StatBlock } from "./rules";
import type { RngState } from "./rng";

export const SCHEMA_VERSION = 2 as const;
export const SYSTEM_ACTOR = "system" as const;

/**
 * Upper bound (inclusive) for `public.turn`, `hidden.decisionSeq`/`combatSeq`, xp, gold, mastery
 * wins and choice-history counts: `deserialize` rejects larger values and `reduce` rejects
 * player/system-requested transitions that would exceed it.
 */
export const MAX_COUNTER = 2 ** 31 - 1;

/** Decision option / choice tokens (<= 64 chars: fits "item:" + a 48-char content id). */
export const CHOICE_PATTERN = /^[a-z][a-z0-9:-]{0,63}$/;

/** Player ids must match this pattern and must not be one of {@link RESERVED_IDS}. */
export const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/** Ids rejected by `createGame`: actor/viewer sentinels and prototype-polluting keys. */
export const RESERVED_IDS: readonly string[] = [
  "system",
  "spectator",
  "__proto__",
  "constructor",
  "prototype",
] as const;

export type PlayerId = string;
/**
 * Who may send an action: any {@link PlayerId} or {@link SYSTEM_ACTOR} (`'system'`). The spec
 * writes this as `PlayerId | typeof SYSTEM_ACTOR`; that union widens to `string`, so it is
 * spelled as the (identical) `PlayerId` alias to avoid a redundant-constituent lint suppression.
 */
export type Actor = PlayerId;
export type Phase = "turn" | "decision";
export type DecisionKind = "poll" | "combat/exchange";

export interface SeatSettings {
  readonly id: PlayerId;
  readonly classId: ContentId;
}

/** 1-4 seats with unique ids, each a base class. */
export interface GameSettings {
  readonly v: 2;
  readonly seed: string;
  readonly players: readonly SeatSettings[];
}

/** Upper bound (inclusive) for hp and NPC stat snapshots. */
export const MAX_STAT = 99_999;

export type CommandCounts = Readonly<Record<Command, number>>;

export interface PendingDecisionPublic {
  readonly id: string;
  readonly kind: DecisionKind;
  readonly required: readonly PlayerId[];
  readonly committed: readonly PlayerId[];
}

export interface LastReveal {
  readonly decisionId: string;
  readonly kind: DecisionKind;
  readonly choices: Readonly<Record<PlayerId, string>>;
  readonly timedOut: readonly PlayerId[];
}

export interface CharacterPublic {
  readonly classId: ContentId;
  readonly level: number;
  readonly xp: number;
  readonly hp: number;
  readonly gold: number;
  /** Wins per class; own keys = every class id in rules. */
  readonly mastery: Readonly<Record<ContentId, number>>;
  /** Class whose rank-5 passive is carried. */
  readonly portable: ContentId | null;
  readonly weapon: ContentId | null;
  readonly shield: ContentId | null;
  readonly accessory: ContentId | null;
  readonly battleSpell: ContentId | null;
  readonly wardSpell: ContentId | null;
}

/** bp deltas in [modMinBp, modMaxBp] plus status flags. */
export interface BattleMods {
  readonly atk: number;
  readonly def: number;
  readonly mag: number;
  readonly spd: number;
  readonly poison: boolean;
  readonly stun: boolean;
}

export type NpcRef =
  | { readonly kind: "monster"; readonly id: ContentId; readonly senior: boolean }
  | { readonly kind: "guardian"; readonly id: ContentId; readonly townTier: 1 | 2 | 3 | 4 }
  | { readonly kind: "enforcer"; readonly level: number };

export type CombatSide =
  | { readonly kind: "player"; readonly playerId: PlayerId; readonly mods: BattleMods }
  | {
      readonly kind: "npc";
      readonly npc: NpcRef;
      readonly stats: StatBlock;
      readonly hp: number;
      readonly mods: BattleMods;
    };

export interface CombatState {
  readonly id: string;
  readonly round: number;
  readonly exchange: 1 | 2;
  readonly first: 0 | 1;
  readonly sides: readonly [CombatSide, CombatSide];
}

export interface PublicState {
  readonly phase: Phase;
  readonly turn: number;
  readonly activePlayer: PlayerId;
  readonly players: readonly PlayerId[];
  readonly characters: Readonly<Record<PlayerId, CharacterPublic>>;
  readonly choiceHistory: Readonly<Record<PlayerId, CommandCounts>>;
  readonly pending: PendingDecisionPublic | null;
  readonly lastReveal: LastReveal | null;
  readonly combat: CombatState | null;
}

export interface Prompt {
  readonly decisionId: string;
  readonly options: readonly string[];
  readonly default: string;
}

export interface PrivateState {
  readonly bag: readonly ContentId[];
  readonly scrolls: readonly ContentId[];
  readonly prompt: Prompt | null;
}

export interface HiddenState {
  readonly rng: RngState;
  readonly decisionSeq: number;
  readonly combatSeq: number;
  readonly decision: {
    readonly id: string;
    readonly choices: Readonly<Record<PlayerId, string>>;
  } | null;
}

export interface GameState {
  readonly v: typeof SCHEMA_VERSION;
  readonly public: PublicState;
  readonly private: Readonly<Record<PlayerId, PrivateState>>;
  readonly hidden: HiddenState;
}
