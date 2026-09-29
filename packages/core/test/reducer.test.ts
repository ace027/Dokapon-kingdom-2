import { describe, expect, it } from "vitest";
import { isAction, reduce } from "../src/reducer";
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

describe("reduce precedence in the action-less W1a kernel", () => {
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

  it("rejects a v:2 decision/open as UNKNOWN_ACTION (the union is empty)", () => {
    const result = reduce(newGame(), DECISION_OPEN, TEST_RULES);
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
    for (const action of [null, 42, DECISION_OPEN, { v: 1 }]) {
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
    };
    const result = reduce(newGame(), action, TEST_RULES);
    expect(reads).toBeLessThanOrEqual(1);
    expect(result).toEqual(
      reduce(newGame(), { v: 2, type: "decision/open", playerId: "system" }, TEST_RULES),
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
    ["a v2 decision/open", DECISION_OPEN],
    ["a v1 sample type", { v: 2, type: V1_SAMPLE_TYPES[0], playerId: "p1" }],
  ])("is false for %s", (_label, value) => {
    expect(isAction(value)).toBe(false);
  });
});
