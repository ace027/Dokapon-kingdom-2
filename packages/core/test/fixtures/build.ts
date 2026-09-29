// Shared test helpers. Later plans (02-01b onward) reuse these by name.
import { createGame } from "../../src/game";
import { reduce } from "../../src/reducer";
import type { GameEvent } from "../../src/events";
import type { Rules } from "../../src/rules";
import type { GameSettings, GameState } from "../../src/types";
import { TEST_RULES } from "./test-rules";

export const FIXTURE_SETTINGS: GameSettings = {
  v: 2,
  seed: "fixture",
  players: [
    { id: "p1", classId: "fighter" },
    { id: "p2", classId: "caster" },
  ],
};

export function newGame(
  settings: GameSettings = FIXTURE_SETTINGS,
  rules: Rules = TEST_RULES,
): GameState {
  return createGame(settings, rules);
}

/** Applies `actions` in order; throws on the first rejection. */
export function applyAll(
  state: GameState,
  actions: readonly unknown[],
  rules: Rules = TEST_RULES,
): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (const [i, action] of actions.entries()) {
    const result = reduce(current, action, rules);
    if (!result.ok) {
      throw new Error(`rejected at ${i}: ${result.error.code} ${result.error.message}`);
    }
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/** Recursively freezes `x` in place and returns it. */
export function deepFreeze<T>(x: T): T {
  if (typeof x === "object" && x !== null && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const value of Object.values(x)) deepFreeze(value);
  }
  return x;
}
