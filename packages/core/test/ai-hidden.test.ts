// The CPU must not read hidden information (spec: "Never reads hidden information", check c).
// From a PvP state where the opponent already committed, valid saves that differ ONLY in hidden.rng,
// the opponent's committed choice and the contents of the opponent's bag are built; the viewer's
// PlayerView and every difficulty's decision (action and resulting ai.rng) must be identical.
import { describe, expect, it } from "vitest";
import { createAi, decideCombat, type Difficulty } from "../src/ai";
import { createGame } from "../src/game";
import { deserialize, hashState, serialize } from "../src/serialize";
import type { GameSettings, GameState } from "../src/types";
import { viewFor } from "../src/views";
import { applyAll } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const SETTINGS: GameSettings = {
  v: 2,
  seed: "ai",
  players: [
    { id: "p1", classId: "fighter" },
    { id: "p2", classId: "caster" },
  ],
};
const START = {
  v: 2,
  type: "combat/start",
  playerId: "system",
  attacker: "p1",
  opponent: { kind: "player", playerId: "p2" },
};
const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

function commit(playerId: string, choice: string) {
  return { v: 2, type: "decision/commit", playerId, decisionId: "d1", choice };
}

/** Same length, different contents (`counts` legitimately exposes the length). */
const BAG_VARIANTS = [
  ["herb", "bomb"],
  ["bomb", "herb"],
  ["herb", "herb"],
];
const RNG_VARIANTS = [
  [1, 2, 3, 4],
  [4_000_000_000, 5, 6, 7],
  [123456789, 987654321, 42, 7],
];

function variants(
  committer: string,
  committed: readonly string[],
  bags: readonly (readonly string[])[],
): GameState[] {
  return committed.map((choice, i) => {
    const state = applyAll(createGame(SETTINGS, TEST_RULES), [
      START,
      commit(committer, choice),
    ]).state;
    const json = JSON.parse(serialize(state)) as {
      hidden: { rng: number[] };
      private: Record<string, { bag: readonly string[] }>;
    };
    json.hidden.rng = RNG_VARIANTS[i] ?? [];
    json.private[committer] = { ...json.private[committer], bag: bags[i] ?? [] };
    return deserialize(JSON.stringify(json), TEST_RULES);
  });
}

function expectBlind(states: readonly GameState[], viewer: string): void {
  // Non-vacuous (PIT-001): the states really differ, pairwise.
  const hashes = states.map(hashState);
  expect(new Set(hashes).size).toBe(states.length);
  const [first, ...rest] = states;
  if (first === undefined) throw new Error("no variants");
  const baseView = viewFor(first, viewer);
  for (const other of rest) expect(viewFor(other, viewer)).toEqual(baseView);
  for (const difficulty of DIFFICULTIES) {
    const ai = createAi("ai-hidden", viewer, difficulty);
    const baseline = decideCombat(baseView, TEST_RULES, ai);
    expect(baseline.action).not.toBeNull();
    for (const other of rest) {
      const result = decideCombat(viewFor(other, viewer), TEST_RULES, ai);
      expect(result.action).toEqual(baseline.action);
      expect(result.ai.rng).toEqual(baseline.ai.rng);
    }
  }
}

describe("the AI never reads hidden information", () => {
  it("attacker p1 ignores which defence p2 already committed, hidden.rng and p2's bag", () => {
    const states = variants("p2", ["guard", "counter", "ward"], BAG_VARIANTS);
    for (const state of states) expect(state.public.pending?.committed).toEqual(["p2"]);
    expect(states.map((s) => s.hidden.decision?.choices.p2)).toEqual(["guard", "counter", "ward"]);
    expectBlind(states, "p1");
  });

  it("defender p2 ignores which attack p1 already committed, hidden.rng and p1's bag", () => {
    const bags = [["herb"], ["herb"], ["herb"]];
    const states = variants("p1", ["attack", "strike", "spell"], bags);
    expect(states.map((s) => s.hidden.decision?.choices.p1)).toEqual(["attack", "strike", "spell"]);
    expectBlind(states, "p2");
  });

  it("the test can detect a leak: the raw states do give different hidden data", () => {
    const [a, b] = variants("p2", ["guard", "ward"], BAG_VARIANTS);
    expect(a?.hidden).not.toEqual(b?.hidden);
    expect(a?.private.p2).not.toEqual(b?.private.p2);
  });
});
