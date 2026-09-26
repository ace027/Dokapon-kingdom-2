import { describe, expect, it } from "vitest";
import type { GameEvent } from "../src/events";
import { createGame } from "../src/game";
import { reduce, type RejectCode } from "../src/reducer";
import type { GameState } from "../src/types";

function step(
  state: GameState,
  action: unknown,
): { state: GameState; events: readonly GameEvent[] } {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(`unexpected reject ${result.error.code}`);
  return result;
}

function rejectCode(state: GameState, action: unknown): RejectCode | null {
  const result = reduce(state, action);
  return result.ok ? null : result.error.code;
}

const open = (required = ["p1", "p2"], defaultChoice = "C") => ({
  v: 1,
  type: "decision/open",
  playerId: "system",
  required,
  defaultChoice,
});
const commit = (playerId: string, choice: string, decisionId = "d1") => ({
  v: 1,
  type: "decision/commit",
  playerId,
  decisionId,
  choice,
});
const timeout = (decisionId = "d1") => ({ v: 1, type: "timeout", playerId: "system", decisionId });

function opened(players = ["p1", "p2"], required = ["p1", "p2"]): GameState {
  const s0 = createGame({ v: 1, seed: "usurpia", players });
  const { state, events } = step(s0, open(required));
  expect(events).toEqual([
    { v: 1, type: "DecisionOpened", visibility: { kind: "public" }, decisionId: "d1", required },
  ]);
  return state;
}

describe("decision commit/reveal", () => {
  it("opens a decision with public pending and hidden choices", () => {
    const s = opened();
    expect(s.public.phase).toBe("decision");
    expect(s.public.pending).toEqual({
      id: "d1",
      kind: "sample",
      required: ["p1", "p2"],
      committed: [],
    });
    expect(s.hidden.decision).toEqual({ id: "d1", defaultChoice: "C", choices: {} });
    expect(s.hidden.decisionSeq).toBe(1);
    expect(s.public.lastReveal).toBeNull();
  });

  it("reveals once every required player has committed", () => {
    const s1 = step(opened(), commit("p1", "B"));
    expect(s1.events).toHaveLength(1);
    const committed = s1.events[0];
    expect(committed).toEqual({
      v: 1,
      type: "ChoiceCommitted",
      visibility: { kind: "public" },
      decisionId: "d1",
      playerId: "p1",
    });
    expect(committed !== undefined && "choice" in committed).toBe(false);
    expect(s1.state.public.pending?.committed).toEqual(["p1"]);
    expect(s1.state.hidden.decision?.choices).toEqual({ p1: "B" });
    expect(JSON.stringify(s1.state.public)).not.toContain('"B"');

    const s2 = step(s1.state, commit("p2", "A"));
    expect(s2.events).toEqual([
      {
        v: 1,
        type: "ChoiceCommitted",
        visibility: { kind: "public" },
        decisionId: "d1",
        playerId: "p2",
      },
      {
        v: 1,
        type: "ChoicesRevealed",
        visibility: { kind: "public" },
        decisionId: "d1",
        choices: { p1: "B", p2: "A" },
        timedOut: [],
      },
    ]);
    for (const e of s2.events) expect("choice" in e).toBe(false);
    expect(s2.state.public.phase).toBe("turn");
    expect(s2.state.public.lastReveal).toEqual({
      decisionId: "d1",
      choices: { p1: "B", p2: "A" },
      timedOut: [],
    });
    expect(s2.state.public.pending).toBeNull();
    expect(s2.state.hidden.decision).toBeNull();
  });

  it("timeout fills missing players with the default choice", () => {
    const s1 = step(opened(), commit("p1", "B"));
    const s2 = step(s1.state, timeout());
    expect(s2.events).toEqual([
      {
        v: 1,
        type: "ChoiceTimedOut",
        visibility: { kind: "public" },
        decisionId: "d1",
        playerId: "p2",
      },
      {
        v: 1,
        type: "ChoicesRevealed",
        visibility: { kind: "public" },
        decisionId: "d1",
        choices: { p1: "B", p2: "C" },
        timedOut: ["p2"],
      },
    ]);
    expect(s2.state.public.phase).toBe("turn");
    expect(s2.state.public.lastReveal).toEqual({
      decisionId: "d1",
      choices: { p1: "B", p2: "C" },
      timedOut: ["p2"],
    });
    expect(s2.state.public.pending).toBeNull();
    expect(s2.state.hidden.decision).toBeNull();
  });

  it("timeout with nobody committed times out everyone in required order", () => {
    const s = opened(["p1", "p2", "p3"], ["p3", "p1"]);
    const { events } = step(s, timeout());
    expect(events.map((e) => [e.type, "playerId" in e ? e.playerId : null])).toEqual([
      ["ChoiceTimedOut", "p3"],
      ["ChoiceTimedOut", "p1"],
      ["ChoicesRevealed", null],
    ]);
  });

  it("only required players may commit", () => {
    const s = opened(["p1", "p2", "p3"], ["p1", "p2"]);
    expect(rejectCode(s, commit("p3", "A"))).toBe("WRONG_ACTOR");
    expect(rejectCode(s, commit("system", "A"))).toBe("WRONG_ACTOR");
  });

  it("rejects a stale decisionId for commit and timeout", () => {
    const s = opened();
    expect(rejectCode(s, commit("p1", "A", "d0"))).toBe("STALE_DECISION");
    expect(rejectCode(s, timeout("x"))).toBe("STALE_DECISION");
  });

  it("rejects a double commit, with STALE_DECISION taking precedence", () => {
    const s = step(opened(), commit("p1", "A")).state;
    expect(rejectCode(s, commit("p1", "B"))).toBe("ALREADY_COMMITTED");
    expect(rejectCode(s, commit("p1", "B", "zz"))).toBe("STALE_DECISION");
  });

  it("rejects timeout after the reveal with WRONG_PHASE", () => {
    const s1 = step(opened(), commit("p1", "A"));
    const s2 = step(s1.state, commit("p2", "A"));
    expect(rejectCode(s2.state, timeout())).toBe("WRONG_PHASE");
  });

  it("gives the second decision id d2 and keeps the previous reveal until then", () => {
    const revealed = step(opened(), timeout()).state;
    const { state, events } = step(revealed, open(["p2"], "A"));
    expect(state.public.pending?.id).toBe("d2");
    expect(state.hidden.decisionSeq).toBe(2);
    expect(state.public.lastReveal?.decisionId).toBe("d1");
    expect(events[0]).toMatchObject({ type: "DecisionOpened", decisionId: "d2" });
    expect(rejectCode(state, commit("p2", "B", "d1"))).toBe("STALE_DECISION");
    const done = step(state, commit("p2", "B", "d2"));
    expect(done.state.public.lastReveal).toEqual({
      decisionId: "d2",
      choices: { p2: "B" },
      timedOut: [],
    });
  });
});
