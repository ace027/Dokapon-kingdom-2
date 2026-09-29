import type { Action } from "../actions";
import type { GameEvent } from "../events";
import type { Reject, RejectCode } from "../reducer";
import type { RngState } from "../rng";
import type { Rules } from "../rules";
import { CHOICE_PATTERN, MAX_COUNTER, type GameState, type Phase } from "../types";
import { clip, isPlainObject, ownGet } from "../validation";

export { clip, isPlainObject, ownGet };

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

/** One handler per action type; empty while `Action` is the empty union. */
export type HandlerMap = { [K in Action["type"]]: Handler<ActionOf<K>> };

/** Own keys of `raw` are exactly `keys` (as a set; callers include `v`, `type`, `playerId`). */
export function hasExactKeys(raw: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(raw);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(raw, key));
}

/** A decision token: matches {@link CHOICE_PATTERN} (1-64 chars). */
export function isChoiceToken(value: unknown): value is string {
  return typeof value === "string" && CHOICE_PATTERN.test(value);
}

/** An integer in `[min, max]`. */
export function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/** Builds a rejection. Callers clip attacker-supplied ids to 64 chars (`clip`) before echoing. */
export function reject(code: RejectCode, message: string): Reject {
  return { code, message };
}

/** True when adding `by` to `n` would exceed {@link MAX_COUNTER}. */
export function overflow(n: number, by: number): boolean {
  return n + by > MAX_COUNTER;
}
