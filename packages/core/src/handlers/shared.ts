import type { Action } from "../actions";
import { onlyPlayers, type GameEvent } from "../events";
import type { Reject, RejectCode } from "../reducer";
import type { RngState } from "../rng";
import type { Rules } from "../rules";
import {
  CHOICE_PATTERN,
  MAX_COUNTER,
  SCHEMA_VERSION,
  type DecisionKind,
  type GameState,
  type Phase,
  type PlayerId,
} from "../types";
import { clip, isInt, isPlainObject, ownGet, sameStrings } from "../validation";

export { clip, isInt, isPlainObject, ownGet, sameStrings };

/** Handler-local randomness. `int` draws via `nextInt` and advances `rng`. */
export interface Ctx {
  rng: RngState;
  int(min: number, max: number): number;
}

export interface Handler<A extends Action> {
  phases: readonly Phase[];
  actor: "active" | "any-player" | "system" | "required";
  /**
   * State-free shape check (precedence step 3). It must also verify the envelope
   * (`v`, `type`, string `playerId`), because `reduce` reads `playerId` from the guarded value.
   */
  guard: (raw: Record<string, unknown>) => raw is A;
  /** State-dependent validation (step 7); `null` means valid. */
  validate?: (s: GameState, a: A, rules: Rules) => Reject | null;
  apply: (s: GameState, a: A, ctx: Ctx, rules: Rules) => { state: GameState; events: GameEvent[] };
}

export type ActionOf<K extends Action["type"]> = Extract<Action, { type: K }>;

/** One handler per action type. */
export type HandlerMap = { [K in Action["type"]]: Handler<ActionOf<K>> };

/**
 * Applies a revealed decision of one kind (`resolvers[kind]`). `choices` is in `required` order.
 * `events` is appended to in place, like every handler's event list.
 */
export type Resolver = (
  state: GameState,
  choices: Readonly<Record<PlayerId, string>>,
  ctx: Ctx,
  rules: Rules,
  events: GameEvent[],
) => GameState;

/** One resolver per decision kind, passed into the decision handlers (no mutable registry). */
export type ResolverTable = Readonly<Record<DecisionKind, Resolver>>;

/** Own keys of `raw` are exactly `keys` (as a set; callers include `v`, `type`, `playerId`). */
export function hasExactKeys(raw: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(raw);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(raw, key));
}

/** A decision token: matches {@link CHOICE_PATTERN} (1-64 chars). */
export function isChoiceToken(value: unknown): value is string {
  return typeof value === "string" && CHOICE_PATTERN.test(value);
}

/** An array of `min..max` decision tokens. */
export function isTokenArray(value: unknown, min: number, max: number): value is string[] {
  return (
    Array.isArray(value) && value.length >= min && value.length <= max && value.every(isChoiceToken)
  );
}

/** The envelope every action guard checks: current `v`, the expected `type`, string `playerId`. */
export function isEnvelope(raw: Record<string, unknown>, type: string): boolean {
  return raw.v === SCHEMA_VERSION && raw.type === type && typeof raw.playerId === "string";
}

/** The players-only `BagUpdated` event for `playerId`'s new bag. */
export function bagEvent(playerId: PlayerId, bag: readonly string[]): GameEvent {
  return {
    v: SCHEMA_VERSION,
    type: "BagUpdated",
    visibility: onlyPlayers([playerId]),
    playerId,
    bag: [...bag],
  };
}

/** Builds a rejection. Callers clip attacker-supplied ids to 64 chars (`clip`) before echoing. */
export function reject(code: RejectCode, message: string): Reject {
  return { code, message };
}

/** True when adding `by` to `n` would exceed {@link MAX_COUNTER}. */
export function overflow(n: number, by: number): boolean {
  return n + by > MAX_COUNTER;
}
