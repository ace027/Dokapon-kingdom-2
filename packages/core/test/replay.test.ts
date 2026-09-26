import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  deserialize,
  hashState,
  reduce,
  replay,
  serialize,
  stableStringify,
  type Action,
  type GameSettings,
  type GameState,
} from "../src/index";
import { arbGame } from "./arbitraries";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Scripts are untrusted input; `replay` passes every element through `reduce`'s guards. */
function run(settings: GameSettings, script: readonly unknown[]) {
  return replay(settings, script as readonly Action[]);
}

function foldFrom(state: GameState, script: readonly unknown[]): GameState {
  let current = state;
  for (const action of script) {
    const result = reduce(current, action);
    if (result.ok) current = result.state;
  }
  return current;
}

describe("replay properties", () => {
  it("is deterministic", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        const a = run(settings, script);
        const b = run(settings, script);
        expect(stableStringify(a.state)).toBe(stableStringify(b.state));
        expect(stableStringify(a.events)).toBe(stableStringify(b.events));
        expect(a.events).toEqual(b.events);
        expect(a.rejections).toEqual(b.rejections);
      }),
      { numRuns: 200 },
    );
  });

  it("reduce never throws and never mutates a deep-frozen input", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        let state = run(settings, []).state;
        for (const action of script) {
          deepFreeze(state);
          const snapshot = stableStringify(state);
          let result: ReturnType<typeof reduce> | undefined;
          expect(() => {
            result = reduce(state, action);
          }).not.toThrow();
          expect(stableStringify(state)).toBe(snapshot);
          if (result?.ok) state = result.state;
        }
      }),
      { numRuns: 200 },
    );
  });

  it("a rejection leaves the input state unmodified and matches replay's rejection indices", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        const expected = run(settings, script);
        let state = run(settings, []).state;
        const rejectedAt: number[] = [];
        script.forEach((action, index) => {
          const prior = state;
          const snapshotBefore = stableStringify(prior);
          const result = reduce(prior, action);
          if (result.ok) {
            state = result.state;
          } else {
            expect(stableStringify(prior)).toBe(snapshotBefore);
            expect("state" in result).toBe(false);
            rejectedAt.push(index);
          }
        });
        expect(rejectedAt).toEqual(expected.rejections.map((r) => r.index));
        expect(hashState(state)).toBe(hashState(expected.state));
      }),
      { numRuns: 200 },
    );
  });

  it("survives serialize/deserialize at any split point", () => {
    fc.assert(
      fc.property(arbGame, fc.nat(), ([settings, script], rawSplit) => {
        const k = Math.min(rawSplit, script.length);
        const head = run(settings, script.slice(0, k)).state;
        const restored = deserialize(serialize(head));
        expect(restored).toEqual(head);
        const resumed = foldFrom(restored, script.slice(k));
        expect(hashState(resumed)).toBe(hashState(run(settings, script).state));
      }),
      { numRuns: 200 },
    );
  });

  it("generated scripts reach decisions and reveals", () => {
    const samples = fc.sample(arbGame, { numRuns: 300, seed: 42 });
    const types = new Set(
      samples.flatMap(([s, script]) => run(s, script).events.map((e) => e.type)),
    );
    expect(types).toEqual(
      new Set([
        "CounterIncremented",
        "Rolled",
        "TurnAdvanced",
        "SecretSet",
        "DecisionOpened",
        "ChoiceCommitted",
        "ChoiceTimedOut",
        "ChoicesRevealed",
      ]),
    );
  });
});

describe("replay example", () => {
  it("continues past a rejection and records its index", () => {
    const result = replay({ v: 1, seed: "usurpia", players: ["p1", "p2"] }, [
      { v: 1, type: "sample/roll", playerId: "p1" },
      { v: 1, type: "sample/increment", playerId: "p2", amount: 3 },
      { v: 1, type: "sample/roll", playerId: "p1" },
      { v: 1, type: "sample/roll", playerId: "p2" },
    ]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.index).toBe(2);
    expect(result.rejections[0]?.error.code).toBe("WRONG_ACTOR");
    expect(result.state.public.turn).toBe(3);
    expect(result.state.public.counter).toBe(3);
    // Pinned before the review-cycle-1 fixes; hardening must not change reachable states.
    expect(hashState(result.state)).toBe("edac7d4a");
    expect(result.events.map((e) => e.type)).toEqual([
      "Rolled",
      "TurnAdvanced",
      "CounterIncremented",
      "Rolled",
      "TurnAdvanced",
    ]);
  });
});
