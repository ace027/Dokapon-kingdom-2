import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createGame } from "../src/game";
import { reduce } from "../src/reducer";
import { replay } from "../src/replay";
import { deserialize, hashState, serialize, stableStringify } from "../src/serialize";
import type { GameState } from "../src/types";
import { arbGame, PROTO_IDS } from "./arbitraries";
import { deepFreeze, FIXTURE_SETTINGS, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const JUNK = [
  null,
  42,
  { v: 1, type: "x" },
  { v: 2, type: "decision/open", playerId: "system", prompts: [] },
  { v: 2, type: "nope", playerId: "system" },
];

// The kernel golden actions (spec: Golden W1b). Two of them are rejected by design.
const KERNEL_ACTIONS = [
  {
    v: 2,
    type: "decision/open",
    playerId: "system",
    prompts: [
      { playerId: "p1", options: ["yes", "no"], default: "no" },
      { playerId: "p2", options: ["red", "green", "blue"], default: "red" },
    ],
  },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "yes" },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "no" },
  { v: 2, type: "timeout", playerId: "system", decisionId: "d1" },
  {
    v: 2,
    type: "decision/open",
    playerId: "system",
    prompts: [{ playerId: "p2", options: ["a", "b"], default: "a" }],
  },
  { v: 2, type: "decision/commit", playerId: "p2", decisionId: "d2", choice: "c" },
  { v: 2, type: "decision/commit", playerId: "p2", decisionId: "d2", choice: "b" },
];

// hashState after each of the 7 actions (the oracle's traces/kernel-game.trace.json step hashes;
// a rejected action leaves the previous hash). Transcribed here; the test never reads .planning/.
const KERNEL_STEP_HASHES = [
  "8557c459",
  "6d3f756c",
  "6d3f756c",
  "f34995e5",
  "7ad35d0a",
  "7ad35d0a",
  "9616698e",
];

describe("replay", () => {
  it("replays an empty script to the initial state", () => {
    const result = replay(FIXTURE_SETTINGS, [], TEST_RULES);
    expect(result.events).toHaveLength(0);
    expect(result.rejections).toHaveLength(0);
    expect(hashState(result.state)).toBe("758ef72c");
  });

  it("records a rejection per junk action, continues, and leaves the state unchanged", () => {
    const result = replay(FIXTURE_SETTINGS, JUNK, TEST_RULES);
    expect(result.rejections.map((r) => [r.index, r.error.code])).toEqual([
      [0, "UNSUPPORTED_VERSION"],
      [1, "UNSUPPORTED_VERSION"],
      [2, "UNSUPPORTED_VERSION"],
      [3, "INVALID_PAYLOAD"],
      [4, "UNKNOWN_ACTION"],
    ]);
    expect(result.events).toHaveLength(0);
    expect(result.state).toEqual(newGame());
  });

  it("continues after a rejection and still applies later actions", () => {
    const result = replay(FIXTURE_SETTINGS, [null, ...KERNEL_ACTIONS.slice(0, 2)], TEST_RULES);
    expect(result.rejections.map((r) => r.index)).toEqual([0]);
    expect(result.state.public.pending?.committed).toEqual(["p1"]);
  });

  it("is deterministic", () => {
    const a = replay(FIXTURE_SETTINGS, JUNK, TEST_RULES);
    const b = replay(FIXTURE_SETTINGS, JUNK, TEST_RULES);
    expect(stableStringify(a)).toBe(stableStringify(b));
  });
});

describe("kernel golden (9616698e)", () => {
  const result = replay(FIXTURE_SETTINGS, KERNEL_ACTIONS, TEST_RULES);

  it("reproduces the final hash, the two rejections and the ten events", () => {
    expect(hashState(result.state)).toBe("9616698e");
    expect(result.rejections.map((r) => [r.index, r.error.code])).toEqual([
      [2, "ALREADY_COMMITTED"],
      [5, "INVALID_PAYLOAD"],
    ]);
    expect(result.events.map((e) => e.type)).toEqual([
      "DecisionOpened",
      "PromptOpened",
      "PromptOpened",
      "ChoiceCommitted",
      "ChoiceTimedOut",
      "ChoicesRevealed",
      "DecisionOpened",
      "PromptOpened",
      "ChoiceCommitted",
      "ChoicesRevealed",
    ]);
  });

  it("ends with the second decision revealed", () => {
    expect(result.state.public.lastReveal).toEqual({
      decisionId: "d2",
      kind: "poll",
      choices: { p2: "b" },
      timedOut: [],
    });
    expect(result.state.public.turn).toBe(1);
  });

  it("reveals the first decision with p2's own default after the timeout", () => {
    const first = result.events.find((e) => e.type === "ChoicesRevealed");
    expect(first).toMatchObject({
      decisionId: "d1",
      kind: "poll",
      choices: { p1: "yes", p2: "red" },
      timedOut: ["p2"],
    });
  });

  it("matches the oracle's hash after every action", () => {
    let state = createGame(FIXTURE_SETTINGS, TEST_RULES);
    const hashes: string[] = [];
    for (const action of KERNEL_ACTIONS) {
      const step = reduce(state, action, TEST_RULES);
      if (step.ok) state = step.state;
      hashes.push(hashState(state));
    }
    expect(hashes).toEqual(KERNEL_STEP_HASHES);
  });
});

/** Every reachable state of a script (the initial one first); rejected actions are skipped. */
function reachable(
  settings: Parameters<typeof createGame>[0],
  script: readonly unknown[],
): GameState[] {
  let state = createGame(settings, TEST_RULES);
  const states = [state];
  for (const action of script) {
    const result = reduce(state, action, TEST_RULES);
    if (result.ok) {
      state = result.state;
      states.push(state);
    }
  }
  return states;
}

function allNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (Array.isArray(value)) for (const item of value as unknown[]) allNumbers(item, out);
  else if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) allNumbers(item, out);
  }
  return out;
}

describe("generators reach the interesting paths", () => {
  it("produces reveals, timeouts and prototype-named seats that reveal", () => {
    const games = fc.sample(arbGame, 600);
    let reveals = 0;
    let timeouts = 0;
    let protoReveals = 0;
    for (const [settings, script] of games) {
      const result = replay(settings, script, TEST_RULES);
      for (const event of result.events) {
        if (event.type === "ChoicesRevealed") {
          reveals += 1;
          if (PROTO_IDS.some((id) => Object.hasOwn(event.choices, id))) protoReveals += 1;
        }
        if (event.type === "ChoiceTimedOut") timeouts += 1;
      }
    }
    expect(reveals).toBeGreaterThan(20);
    expect(timeouts).toBeGreaterThan(5);
    expect(protoReveals).toBeGreaterThan(0);
  });
});

describe("v2 properties", () => {
  it("is deterministic: two replays agree on state, events and rejections", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        const a = replay(settings, script, TEST_RULES);
        const b = replay(settings, script, TEST_RULES);
        expect(stableStringify(a)).toBe(stableStringify(b));
      }),
      { numRuns: 200 },
    );
  });

  it("never throws on a deep-frozen state and never mutates it", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        let state = deepFreeze(createGame(settings, TEST_RULES));
        for (const action of script) {
          const before = stableStringify(state);
          const result = reduce(state, action, TEST_RULES);
          expect(stableStringify(state)).toBe(before);
          if (result.ok) state = deepFreeze(result.state);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("rejects by identity: no state comes back and the fold equals replay", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        let state = createGame(settings, TEST_RULES);
        for (const action of script) {
          const before = state;
          const result = reduce(state, action, TEST_RULES);
          if (result.ok) state = result.state;
          else {
            expect("state" in result).toBe(false);
            expect(state).toBe(before);
          }
        }
        expect(hashState(state)).toBe(hashState(replay(settings, script, TEST_RULES).state));
      }),
      { numRuns: 200 },
    );
  });

  it("split replay through deserialize(serialize(s)) reaches the same final hash", () => {
    fc.assert(
      fc.property(arbGame, fc.nat(), ([settings, script], k) => {
        const cut = k % (script.length + 1);
        const prefix = replay(settings, script.slice(0, cut), TEST_RULES).state;
        let state = deserialize(serialize(prefix), TEST_RULES);
        for (const action of script.slice(cut)) {
          const result = reduce(state, action, TEST_RULES);
          if (result.ok) state = result.state;
        }
        expect(hashState(state)).toBe(hashState(replay(settings, script, TEST_RULES).state));
      }),
      { numRuns: 200 },
    );
  });

  it("every reachable state passes deserialize(serialize(s), rules) and deep-equals s", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        for (const state of reachable(settings, script)) {
          expect(deserialize(serialize(state), TEST_RULES)).toEqual(state);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("keeps every number in every reachable state a safe integer", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        for (const state of reachable(settings, script)) {
          expect(allNumbers(state).every((n) => Number.isSafeInteger(n))).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
