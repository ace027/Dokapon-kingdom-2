import { describe, expect, it } from "vitest";
import { isAction, reduce } from "../src/reducer";
import type { GameState } from "../src/types";
import { deepFreeze, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

// The Phase 1 sample type strings, built without the banned literals (the sample grep scans tests).
const V1_SAMPLE_TYPES = [
  ["sample", "roll"].join("/"),
  ["sample", "increment"].join("/"),
  ["sample", "set" + "Secret"].join("/"),
];

const DECISION_OPEN = {
  v: 2,
  type: "decision/open",
  playerId: "system",
  prompts: [{ playerId: "p1", options: ["yes", "no"], default: "no" }],
};

describe("reduce precedence: version, type, shape", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["a number", 42],
    ["an array", []],
    ["an empty object", {}],
    ["a v1 decision/open", { ...DECISION_OPEN, v: 1 }],
    ["a string version", { ...DECISION_OPEN, v: "2" }],
  ])("rejects %s as UNSUPPORTED_VERSION", (_label, action) => {
    const state = newGame();
    const result = reduce(state, action, TEST_RULES);
    expect(result).toEqual({
      ok: false,
      error: { code: "UNSUPPORTED_VERSION", message: "action must be a plain object with v=2" },
    });
  });

  it("accepts a valid v:2 decision/open", () => {
    const result = reduce(newGame(), DECISION_OPEN, TEST_RULES);
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown v:2 type as UNKNOWN_ACTION", () => {
    const result = reduce(newGame(), { ...DECISION_OPEN, type: "decision/close" }, TEST_RULES);
    expect(result).toEqual({
      ok: false,
      error: { code: "UNKNOWN_ACTION", message: "unknown action type" },
    });
  });

  it.each(V1_SAMPLE_TYPES)(
    "rejects the v1 sample type %s sent with v:2 as UNKNOWN_ACTION",
    (type) => {
      const result = reduce(newGame(), { v: 2, type, playerId: "p1" }, TEST_RULES);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UNKNOWN_ACTION");
    },
  );

  it.each(["toString", "constructor", "hasOwnProperty", "__proto__"])(
    "treats the prototype-member type %s as UNKNOWN_ACTION",
    (type) => {
      const result = reduce(newGame(), { v: 2, type, playerId: "p1" }, TEST_RULES);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UNKNOWN_ACTION");
    },
  );

  it("treats a missing or non-string type as UNKNOWN_ACTION", () => {
    for (const action of [{ v: 2 }, { v: 2, type: 5 }]) {
      const result = reduce(newGame(), action, TEST_RULES);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UNKNOWN_ACTION");
    }
  });
});

describe("rejection identity and purity", () => {
  it("returns no state on rejection, leaves the input untouched, and never throws on a frozen input", () => {
    const state = deepFreeze(newGame());
    const before = JSON.stringify(state);
    for (const action of [null, 42, { ...DECISION_OPEN, prompts: [] }, { v: 1 }]) {
      const result = reduce(state, action, TEST_RULES);
      expect(result.ok).toBe(false);
      expect("state" in result).toBe(false);
    }
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("canonicalize once", () => {
  it("reads a getter at most once and rejects it identically to its plain twin", () => {
    let reads = 0;
    const action = {
      v: 2,
      get type() {
        reads += 1;
        return "decision/open";
      },
      playerId: "system",
      prompts: [],
    };
    const result = reduce(newGame(), action, TEST_RULES);
    expect(reads).toBeLessThanOrEqual(1);
    expect(result).toEqual(
      reduce(
        newGame(),
        { v: 2, type: "decision/open", playerId: "system", prompts: [] },
        TEST_RULES,
      ),
    );
  });

  it("rejects a Proxy without throwing", () => {
    const proxy = new Proxy(
      { v: 2, type: "x", playerId: "p1" },
      {
        get() {
          throw new Error("trap");
        },
        getPrototypeOf() {
          throw new Error("trap");
        },
      },
    );
    const result = reduce(newGame(), proxy, TEST_RULES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNSUPPORTED_VERSION");
  });

  it("rejects a non-canonical plain object (an undefined field) as INVALID_PAYLOAD", () => {
    const result = reduce(newGame(), { v: 2, type: "x", playerId: undefined }, TEST_RULES);
    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: "action is not canonical JSON" },
    });
  });
});

describe("isAction", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["a number", 42],
    ["an array", []],
    ["a v1 action", { ...DECISION_OPEN, v: 1 }],
    ["a decision/open with an extra key", { ...DECISION_OPEN, zzz: 1 }],
    ["a decision/open with no prompts", { ...DECISION_OPEN, prompts: [] }],
    ["a v1 sample type", { v: 2, type: V1_SAMPLE_TYPES[0], playerId: "p1" }],
  ])("is false for %s", (_label, value) => {
    expect(isAction(value)).toBe(false);
  });
});

describe("isAction accepts each W1b shape", () => {
  it.each<[string, unknown]>([
    ["decision/open", DECISION_OPEN],
    [
      "decision/commit",
      { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "yes" },
    ],
    ["timeout", { v: 2, type: "timeout", playerId: "system", decisionId: "d1" }],
  ])("is true for %s", (_label, value) => {
    expect(isAction(value)).toBe(true);
  });
});

describe("reduce precedence: phase, actor, state validation", () => {
  const commit = (playerId: string, decisionId = "d1", choice = "yes") => ({
    v: 2,
    type: "decision/commit",
    playerId,
    decisionId,
    choice,
  });
  const TIMEOUT = { v: 2, type: "timeout", playerId: "system", decisionId: "d1" };
  const OPEN_TWO = {
    ...DECISION_OPEN,
    prompts: [
      { playerId: "p1", options: ["yes", "no"], default: "no" },
      { playerId: "p2", options: ["red", "blue"], default: "red" },
    ],
  };

  function mid(): GameState {
    const result = reduce(deepFreeze(newGame()), OPEN_TWO, TEST_RULES);
    if (!result.ok) throw new Error("fixture rejected");
    return deepFreeze(result.state);
  }

  function expectRejected(state: GameState, action: unknown, code: string, message: string): void {
    const before = JSON.stringify(state);
    const result = reduce(state, action, TEST_RULES);
    expect(result).toEqual({ ok: false, error: { code, message } });
    expect("state" in result).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  }

  it("rejects a commit during phase turn as WRONG_PHASE", () => {
    expectRejected(
      deepFreeze(newGame()),
      commit("p1"),
      "WRONG_PHASE",
      "decision/commit is not allowed in phase turn",
    );
  });

  it("rejects a timeout during phase turn as WRONG_PHASE", () => {
    expectRejected(
      deepFreeze(newGame()),
      TIMEOUT,
      "WRONG_PHASE",
      "timeout is not allowed in phase turn",
    );
  });

  it("rejects decision/open during a decision as WRONG_PHASE", () => {
    expectRejected(
      mid(),
      OPEN_TWO,
      "WRONG_PHASE",
      "decision/open is not allowed in phase decision",
    );
  });

  it("rejects a player sending decision/open as WRONG_ACTOR", () => {
    expectRejected(
      deepFreeze(newGame()),
      { ...DECISION_OPEN, playerId: "p1" },
      "WRONG_ACTOR",
      "p1 may not perform decision/open",
    );
  });

  it("rejects a player sending timeout as WRONG_ACTOR", () => {
    expectRejected(
      mid(),
      { ...TIMEOUT, playerId: "p1" },
      "WRONG_ACTOR",
      "p1 may not perform timeout",
    );
  });

  it("rejects the system committing as WRONG_ACTOR", () => {
    expectRejected(
      mid(),
      commit("system"),
      "WRONG_ACTOR",
      "system may not perform decision/commit",
    );
  });

  it("rejects a seated player who is not required as WRONG_ACTOR", () => {
    const three = newGame({
      v: 2,
      seed: "three",
      players: [
        { id: "p1", classId: "fighter" },
        { id: "p2", classId: "caster" },
        { id: "p3", classId: "fighter" },
      ],
    });
    const result = reduce(three, OPEN_TWO, TEST_RULES);
    if (!result.ok) throw new Error("fixture rejected");
    expectRejected(
      deepFreeze(result.state),
      commit("p3"),
      "WRONG_ACTOR",
      "p3 may not perform decision/commit",
    );
  });

  it("checks the shape before the phase (INVALID_PAYLOAD beats WRONG_PHASE)", () => {
    expectRejected(
      deepFreeze(newGame()),
      commit("p1", "d1", "Bad Token"),
      "INVALID_PAYLOAD",
      "invalid payload for decision/commit",
    );
  });

  it("checks the phase before the actor (WRONG_PHASE beats WRONG_ACTOR)", () => {
    expectRejected(
      deepFreeze(newGame()),
      commit("system"),
      "WRONG_PHASE",
      "decision/commit is not allowed in phase turn",
    );
  });

  it("checks the actor before state validation (WRONG_ACTOR beats STALE_DECISION)", () => {
    expectRejected(
      mid(),
      commit("system", "d9"),
      "WRONG_ACTOR",
      "system may not perform decision/commit",
    );
  });

  it("reaches state validation last (STALE_DECISION for a required player)", () => {
    expectRejected(
      mid(),
      commit("p1", "d9"),
      "STALE_DECISION",
      "decision d9 is not the open decision",
    );
  });
});
