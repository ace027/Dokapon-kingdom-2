import { describe, expect, it } from "vitest";
import {
  createGame,
  deserialize,
  MAX_COUNTER,
  reduce,
  serialize,
  type GameState,
} from "../src/index";

/** A valid turn-phase state (via deserialize) with one bounded counter set to `value`. */
function stateWith(field: "turn" | "counter" | "decisionSeq", value: number): GameState {
  const base = createGame({ v: 1, seed: "bounds", players: ["p1", "p2"] });
  const draft = JSON.parse(serialize(base)) as {
    public: Record<string, unknown>;
    hidden: Record<string, unknown>;
  };
  if (field === "decisionSeq") draft.hidden.decisionSeq = value;
  else draft.public[field] = value;
  return deserialize(JSON.stringify(draft));
}

function expectRejectedUnchanged(state: GameState, action: unknown): void {
  const before = serialize(state);
  const result = reduce(state, action);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe("INVALID_PAYLOAD");
  expect(serialize(state)).toBe(before);
}

/** Applies `action`, expects success, and returns the new state after a serialize round-trip. */
function applyAndReload(state: GameState, action: unknown): GameState {
  const result = reduce(state, action);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return deserialize(serialize(result.state));
}

describe("counter overflow (review cycle 2)", () => {
  it("rejects increment past MAX_COUNTER and accepts reaching it exactly", () => {
    const state = stateWith("counter", MAX_COUNTER - 5);
    expectRejectedUnchanged(state, { v: 1, type: "sample/increment", playerId: "p1", amount: 10 });
    const next = applyAndReload(state, {
      v: 1,
      type: "sample/increment",
      playerId: "p1",
      amount: 5,
    });
    expect(next.public.counter).toBe(MAX_COUNTER);
    expectRejectedUnchanged(next, { v: 1, type: "sample/increment", playerId: "p1", amount: 1 });
  });

  it("rejects roll past MAX_COUNTER turns and accepts reaching it exactly", () => {
    const state = stateWith("turn", MAX_COUNTER - 1);
    const next = applyAndReload(state, { v: 1, type: "sample/roll", playerId: "p1" });
    expect(next.public.turn).toBe(MAX_COUNTER);
    expectRejectedUnchanged(next, { v: 1, type: "sample/roll", playerId: "p2" });
  });

  it("rejects decision/open past MAX_COUNTER and accepts reaching it exactly", () => {
    const action = {
      v: 1,
      type: "decision/open",
      playerId: "system",
      required: ["p1"],
      defaultChoice: "A",
    };
    const state = stateWith("decisionSeq", MAX_COUNTER - 1);
    const next = applyAndReload(state, action);
    expect(next.hidden.decisionSeq).toBe(MAX_COUNTER);
    const closed = applyAndReload(next, {
      v: 1,
      type: "timeout",
      playerId: "system",
      decisionId: `d${MAX_COUNTER}`,
    });
    expectRejectedUnchanged(closed, action);
  });
});
