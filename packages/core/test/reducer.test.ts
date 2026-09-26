import { describe, expect, it } from "vitest";
import { createGame } from "../src/game";
import { isAction, reduce, type RejectCode } from "../src/reducer";
import { stableStringify } from "../src/serialize";
import type { GameState } from "../src/types";

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function start(players: string[] = ["p1", "p2"]): GameState {
  return deepFreeze(createGame({ v: 1, seed: "usurpia", players }));
}

function step(state: GameState, action: unknown) {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(`unexpected reject ${result.error.code}`);
  return { state: deepFreeze(result.state), events: result.events };
}

function expectReject(state: GameState, action: unknown, code: RejectCode): void {
  const before = stableStringify(state);
  const result = reduce(state, action);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(code);
    expect(typeof result.error.message).toBe("string");
  }
  expect(stableStringify(state)).toBe(before);
}

const OPEN = {
  v: 1,
  type: "decision/open",
  playerId: "system",
  required: ["p1", "p2"],
  defaultChoice: "A",
};

function inDecision(): GameState {
  return step(start(), OPEN).state;
}

describe("reject precedence: version, type, shape", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["a number", 42],
    ["a string", "sample/roll"],
    ["an array", [1]],
    ["an empty object", {}],
    ["v: 2", { v: 2 }],
    ["v: 2 on an otherwise valid action", { v: 2, type: "sample/roll", playerId: "p1" }],
    ["v as a string", { v: "1", type: "sample/roll", playerId: "p1" }],
  ])("UNSUPPORTED_VERSION for %s", (_label, action) => {
    expectReject(start(), action, "UNSUPPORTED_VERSION");
  });

  it.each<[string, unknown]>([
    ["an unknown type", { v: 1, type: "nope" }],
    ["a missing type", { v: 1, playerId: "p1" }],
    ["a non-string type", { v: 1, type: 3, playerId: "p1" }],
  ])("UNKNOWN_ACTION for %s", (_label, action) => {
    expectReject(start(), action, "UNKNOWN_ACTION");
  });

  it.each<[string, unknown]>([
    ["amount 0", { v: 1, type: "sample/increment", playerId: "p1", amount: 0 }],
    ["amount 11", { v: 1, type: "sample/increment", playerId: "p1", amount: 11 }],
    ["amount 1.5", { v: 1, type: "sample/increment", playerId: "p1", amount: 1.5 }],
    ["amount '3'", { v: 1, type: "sample/increment", playerId: "p1", amount: "3" }],
    ["missing amount", { v: 1, type: "sample/increment", playerId: "p1" }],
    ["a 65-char note", { v: 1, type: "sample/setSecret", playerId: "p1", note: "n".repeat(65) }],
    ["a non-string note", { v: 1, type: "sample/setSecret", playerId: "p1", note: null }],
    ["an extra key", { v: 1, type: "sample/roll", playerId: "p1", zzz: 1 }],
    ["a missing playerId", { v: 1, type: "sample/roll" }],
    ["a non-string playerId", { v: 1, type: "sample/roll", playerId: 1 }],
    ["required not an array", { ...OPEN, required: "p1" }],
    ["required with a non-string", { ...OPEN, required: ["p1", 2] }],
    ["an invalid defaultChoice", { ...OPEN, defaultChoice: "D" }],
    [
      "an invalid choice",
      { v: 1, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "Z" },
    ],
    ["a non-string decisionId", { v: 1, type: "timeout", playerId: "system", decisionId: 1 }],
  ])("INVALID_PAYLOAD for %s", (_label, action) => {
    expectReject(start(), action, "INVALID_PAYLOAD");
  });

  it("checks shape before phase and actor", () => {
    // wrong actor (p2) + extra key → shape wins
    expectReject(start(), { v: 1, type: "sample/roll", playerId: "p2", zzz: 1 }, "INVALID_PAYLOAD");
  });
});

describe("reject precedence: phase, actor, state validation", () => {
  it("WRONG_PHASE: decision/commit during 'turn' beats the actor check", () => {
    expectReject(
      start(),
      { v: 1, type: "decision/commit", playerId: "ghost", decisionId: "d1", choice: "A" },
      "WRONG_PHASE",
    );
  });

  it("WRONG_PHASE: timeout during 'turn'", () => {
    expectReject(
      start(),
      { v: 1, type: "timeout", playerId: "system", decisionId: "d1" },
      "WRONG_PHASE",
    );
  });

  it("WRONG_PHASE: roll, increment and open during 'decision'", () => {
    const s = inDecision();
    expectReject(s, { v: 1, type: "sample/roll", playerId: "p1" }, "WRONG_PHASE");
    expectReject(s, { v: 1, type: "sample/increment", playerId: "p1", amount: 1 }, "WRONG_PHASE");
    expectReject(s, OPEN, "WRONG_PHASE");
  });

  it.each<[string, unknown]>([
    ["a non-active player rolling", { v: 1, type: "sample/roll", playerId: "p2" }],
    [
      "a non-active player incrementing",
      { v: 1, type: "sample/increment", playerId: "p2", amount: 1 },
    ],
    ["system sending sample/roll", { v: 1, type: "sample/roll", playerId: "system" }],
    ["a player opening a decision", { ...OPEN, playerId: "p1" }],
    [
      "a non-player setting a secret",
      { v: 1, type: "sample/setSecret", playerId: "ghost", note: "x" },
    ],
    ["system setting a secret", { v: 1, type: "sample/setSecret", playerId: "system", note: "x" }],
  ])("WRONG_ACTOR for %s", (_label, action) => {
    expectReject(start(), action, "WRONG_ACTOR");
  });

  it("WRONG_ACTOR for a player sending timeout", () => {
    expectReject(
      inDecision(),
      { v: 1, type: "timeout", playerId: "p1", decisionId: "d1" },
      "WRONG_ACTOR",
    );
  });

  it.each<[string, string[]]>([
    ["empty", []],
    ["duplicate", ["p1", "p1"]],
    ["containing a non-player", ["p1", "ghost"]],
  ])("INVALID_PAYLOAD for a %s required list", (_label, required) => {
    expectReject(start(), { ...OPEN, required }, "INVALID_PAYLOAD");
  });
});

describe("sample module transitions", () => {
  it("increment adds to the counter without advancing the turn", () => {
    const s0 = start();
    const { state, events } = step(s0, {
      v: 1,
      type: "sample/increment",
      playerId: "p1",
      amount: 3,
    });
    expect(state.public.counter).toBe(3);
    expect(state.public.turn).toBe(1);
    expect(state.public.activePlayer).toBe("p1");
    expect(state.hidden.rng).toEqual(s0.hidden.rng);
    expect(events).toEqual([
      {
        v: 1,
        type: "CounterIncremented",
        visibility: { kind: "public" },
        playerId: "p1",
        amount: 3,
        counter: 3,
      },
    ]);
  });

  it("roll uses the golden d6 sequence and emits Rolled then TurnAdvanced", () => {
    const s0 = start();
    const first = step(s0, { v: 1, type: "sample/roll", playerId: "p1" });
    expect(first.events).toEqual([
      { v: 1, type: "Rolled", visibility: { kind: "public" }, playerId: "p1", value: 2 },
      { v: 1, type: "TurnAdvanced", visibility: { kind: "public" }, activePlayer: "p2", turn: 2 },
    ]);
    expect(first.state.public.lastRoll).toEqual({ playerId: "p1", value: 2 });
    expect(first.state.hidden.rng).not.toEqual(s0.hidden.rng);

    const second = step(first.state, { v: 1, type: "sample/roll", playerId: "p2" });
    expect(second.state.public.lastRoll).toEqual({ playerId: "p2", value: 2 });
    expect(second.state.public.activePlayer).toBe("p1");
    expect(second.state.public.turn).toBe(3);
  });

  it("a 1-player roll keeps the active player and increments turn", () => {
    const { state, events } = step(start(["solo"]), {
      v: 1,
      type: "sample/roll",
      playerId: "solo",
    });
    expect(state.public.activePlayer).toBe("solo");
    expect(state.public.turn).toBe(2);
    expect(events.map((e) => e.type)).toEqual(["Rolled", "TurnAdvanced"]);
  });

  it("setSecret stores a private note visible only to its owner, in either phase", () => {
    const { state, events } = step(start(), {
      v: 1,
      type: "sample/setSecret",
      playerId: "p2",
      note: "n".repeat(64),
    });
    expect(state.private).toEqual({ p1: { note: null }, p2: { note: "n".repeat(64) } });
    expect(events).toEqual([
      {
        v: 1,
        type: "SecretSet",
        visibility: { kind: "players", ids: ["p2"] },
        playerId: "p2",
        note: "n".repeat(64),
      },
    ]);
    const inDec = step(inDecision(), { v: 1, type: "sample/setSecret", playerId: "p1", note: "" });
    expect(inDec.state.private.p1).toEqual({ note: "" });
  });

  it("accepts an empty note", () => {
    const result = reduce(start(), { v: 1, type: "sample/setSecret", playerId: "p1", note: "" });
    expect(result.ok).toBe(true);
  });
});

describe("isAction", () => {
  it("applies only the shape checks", () => {
    expect(isAction({ v: 1, type: "sample/roll", playerId: "p2" })).toBe(true);
    expect(isAction({ v: 1, type: "timeout", playerId: "p1", decisionId: "x" })).toBe(true);
    expect(isAction({ v: 1, type: "sample/roll", playerId: "p1", zzz: 1 })).toBe(false);
    expect(isAction({ v: 1, type: "nope" })).toBe(false);
    expect(isAction(null)).toBe(false);
  });
});
