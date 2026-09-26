import type { RngState } from "./rng";

export const SCHEMA_VERSION = 1 as const;
export const SYSTEM_ACTOR = "system" as const;

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
// Spec contract: the union documents that `system` is a valid actor even though it widens to string.
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type Actor = PlayerId | typeof SYSTEM_ACTOR;
export type Phase = "turn" | "decision";
/** Sample hidden-choice alphabet. */
export type Choice = "A" | "B" | "C";

/** 1–4 unique player ids. */
export interface GameSettings {
  readonly v: 1;
  readonly seed: string;
  readonly players: readonly PlayerId[];
}

export interface PendingDecisionPublic {
  readonly id: string;
  readonly kind: "sample";
  readonly required: readonly PlayerId[];
  readonly committed: readonly PlayerId[];
}

export interface PublicState {
  readonly phase: Phase;
  readonly turn: number;
  readonly activePlayer: PlayerId;
  readonly players: readonly PlayerId[];
  readonly counter: number;
  readonly lastRoll: { readonly playerId: PlayerId; readonly value: number } | null;
  readonly pending: PendingDecisionPublic | null;
  readonly lastReveal: {
    readonly decisionId: string;
    readonly choices: Readonly<Record<PlayerId, Choice>>;
    readonly timedOut: readonly PlayerId[];
  } | null;
}

export interface PrivateState {
  readonly note: string | null;
}

export interface HiddenState {
  readonly rng: RngState;
  readonly decisionSeq: number;
  readonly decision: {
    readonly id: string;
    readonly defaultChoice: Choice;
    readonly choices: Readonly<Record<PlayerId, Choice>>;
  } | null;
}

export interface GameState {
  readonly v: typeof SCHEMA_VERSION;
  readonly public: PublicState;
  readonly private: Readonly<Record<PlayerId, PrivateState>>;
  readonly hidden: HiddenState;
}
