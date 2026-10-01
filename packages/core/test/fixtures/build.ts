// Shared test helpers. Later plans (02-01b onward) reuse these by name.
import { createGame } from "../../src/game";
import { deserialize, serialize } from "../../src/serialize";
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

/** Deep-writable view of a (readonly) data type, for editing a crafted copy. */
export type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

/** Narrows `undefined` away for a fixture lookup, failing loudly when the entry is missing. */
export function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("missing fixture entry");
  return value;
}

/** A deep copy of TEST_RULES edited by `edit`; TEST_RULES is never mutated. */
export function craft(edit: (rules: Mutable<Rules>) => void): Rules {
  // JSON data only, so a JSON round trip is a deep copy (the core tsconfig has no structuredClone)
  const rules = JSON.parse(JSON.stringify(TEST_RULES)) as Mutable<Rules>;
  edit(rules);
  return rules;
}

/** The slice of a serialized save that the tests edit. */
export interface SaveJson {
  public: { characters: Record<string, Record<string, unknown>> };
  private: Record<string, { bag: string[]; scrolls: string[]; prompt: null }>;
}

/** A valid save built by editing the serialized fixture game (`deserialize` re-validates it). */
export function make(edit: (json: SaveJson) => void, rules: Rules = TEST_RULES): GameState {
  const json = JSON.parse(serialize(newGame(undefined, rules))) as SaveJson;
  edit(json);
  return deserialize(JSON.stringify(json), rules);
}
