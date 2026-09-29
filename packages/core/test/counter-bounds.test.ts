import { describe, expect, it } from "vitest";
import { reduce } from "../src/reducer";
import { deserialize, serialize } from "../src/serialize";
import { MAX_COUNTER, type GameState } from "../src/types";
import { newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const OPEN = {
  v: 2,
  type: "decision/open",
  playerId: "system",
  prompts: [{ playerId: "p1", options: ["yes", "no"], default: "no" }],
};

/** A valid save whose `hidden.decisionSeq` is `decisionSeq`, built by editing a serialized game. */
function withDecisionSeq(decisionSeq: number): GameState {
  const json = JSON.parse(serialize(newGame())) as { hidden: { decisionSeq: number } };
  json.hidden.decisionSeq = decisionSeq;
  return deserialize(JSON.stringify(json), TEST_RULES);
}

describe("decisionSeq bounds", () => {
  it("rejects decision/open at MAX_COUNTER", () => {
    const state = withDecisionSeq(MAX_COUNTER);
    expect(reduce(state, OPEN, TEST_RULES)).toEqual({
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: "decisionSeq would exceed MAX_COUNTER" },
    });
  });

  it("opens d2147483647 at MAX_COUNTER - 1", () => {
    const result = reduce(withDecisionSeq(MAX_COUNTER - 1), OPEN, TEST_RULES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.public.pending?.id).toBe("d2147483647");
    expect(result.state.hidden.decisionSeq).toBe(MAX_COUNTER);
    expect(deserialize(serialize(result.state), TEST_RULES)).toEqual(result.state);
  });
});
