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

describe("untrusted action canonicalization", () => {
  it("reads a getter exactly once (amount 5, then NaN)", () => {
    let reads = 0;
    const action = {
      v: 1,
      type: "sample/increment",
      playerId: "p1",
      get amount() {
        reads += 1;
        return reads === 1 ? 5 : Number.NaN;
      },
    };
    const result = reduce(start(), action);
    expect(reads).toBe(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.public.counter).toBe(5);
      expect(result.events).toEqual([
        {
          v: 1,
          type: "CounterIncremented",
          visibility: { kind: "public" },
          playerId: "p1",
          amount: 5,
          counter: 5,
        },
      ]);
    }
  });

  it("rejects a sparse required array with INVALID_PAYLOAD", () => {
    const required: unknown[] = [];
    required[1] = "p1";
    expect(0 in required).toBe(false);
    expectReject(start(), { ...OPEN, required }, "INVALID_PAYLOAD");
    expect(isAction({ ...OPEN, required })).toBe(false);
  });

  it.each<[string, ProxyHandler<object>, RejectCode]>([
    [
      "get throws",
      {
        get() {
          throw new Error("boom");
        },
      },
      "INVALID_PAYLOAD",
    ],
    [
      "ownKeys throws",
      {
        ownKeys() {
          throw new Error("boom");
        },
      },
      "INVALID_PAYLOAD",
    ],
    [
      "getPrototypeOf throws",
      {
        getPrototypeOf() {
          throw new Error("boom");
        },
      },
      "UNSUPPORTED_VERSION",
    ],
  ])("returns a reject (never throws) for a Proxy whose %s", (_label, handler, code) => {
    const action = new Proxy({ v: 1, type: "sample/roll", playerId: "p1" }, handler);
    expect(() => reduce(start(), action)).not.toThrow();
    expectReject(start(), action, code);
    expect(() => isAction(action)).not.toThrow();
    expect(isAction(action)).toBe(false);
  });

  it("a playerId getter cannot switch to __proto__ after the actor check", () => {
    let reads = 0;
    const action = {
      v: 1,
      type: "sample/setSecret",
      get playerId() {
        reads += 1;
        return reads === 1 ? "p1" : "__proto__";
      },
      note: "x",
    };
    const { state, events } = step(start(), action);
    expect(reads).toBe(1);
    expect(Object.keys(state.private).sort()).toEqual(["p1", "p2"]);
    expect(Object.hasOwn(state.private, "__proto__")).toBe(false);
    expect(Object.getPrototypeOf(state.private)).toBe(Object.prototype);
    expect(state.private.p1).toEqual({ note: "x" });
    expect(events[0]?.visibility).toEqual({ kind: "players", ids: ["p1"] });
  });

  it("rejects a __proto__ playerId outright", () => {
    const action = JSON.parse(
      '{"v":1,"type":"sample/setSecret","playerId":"__proto__","note":"x"}',
    ) as unknown;
    expectReject(start(), action, "WRONG_ACTOR");
  });

  it("rejects class instances and non-JSON values by version", () => {
    class Roll {
      v = 1;
      type = "sample/roll";
      playerId = "p1";
    }
    expectReject(start(), new Roll(), "UNSUPPORTED_VERSION");
    expectReject(start(), Number.NaN, "UNSUPPORTED_VERSION");
    expectReject(start(), () => 1, "UNSUPPORTED_VERSION");
  });
});

describe("reject messages", () => {
  const long = "x".repeat(1000);

  it.each<[string, () => GameState, unknown, RejectCode]>([
    ["WRONG_ACTOR", start, { v: 1, type: "sample/roll", playerId: long }, "WRONG_ACTOR"],
    [
      "STALE_DECISION",
      inDecision,
      { v: 1, type: "timeout", playerId: "system", decisionId: long },
      "STALE_DECISION",
    ],
  ])("%s echoes at most 64 chars of attacker input", (_label, make, action, code) => {
    const result = reduce(make(), action);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(code);
      expect(result.error.message).toContain(`${"x".repeat(64)}…`);
      expect(result.error.message).not.toContain("x".repeat(65));
      expect(result.error.message.length).toBeLessThan(64 + 60);
    }
  });
});

describe("malformed in-memory state", () => {
  function malformed(patch: (draft: Record<string, Record<string, unknown>>) => void): GameState {
    const draft = JSON.parse(stableStringify(inDecision())) as Record<
      string,
      Record<string, unknown>
    >;
    patch(draft);
    return draft as unknown as GameState;
  }

  const commitP1 = { v: 1, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "A" };
  const timeoutD1 = { v: 1, type: "timeout", playerId: "system", decisionId: "d1" };

  it.each<[string, (d: Record<string, Record<string, unknown>>) => void]>([
    [
      "pending missing",
      (d) => {
        delete d.public?.pending;
      },
    ],
    [
      "pending null",
      (d) => {
        if (d.public) d.public.pending = null;
      },
    ],
    [
      "pending {}",
      (d) => {
        if (d.public) d.public.pending = {};
      },
    ],
    [
      "pending.required not an array",
      (d) => {
        if (d.public) d.public.pending = { id: "d1" };
      },
    ],
    [
      "decision missing",
      (d) => {
        delete d.hidden?.decision;
      },
    ],
    [
      "decision.choices not an object",
      (d) => {
        if (d.hidden) d.hidden.decision = { id: "d1", defaultChoice: "A", choices: 3 };
      },
    ],
    [
      "players not an array",
      (d) => {
        if (d.public) d.public.players = "p1";
      },
    ],
  ])("never throws when %s", (_label, patch) => {
    const state = malformed(patch);
    for (const action of [
      commitP1,
      timeoutD1,
      OPEN,
      { v: 1, type: "sample/roll", playerId: "p1" },
    ]) {
      let result: ReturnType<typeof reduce> | undefined;
      expect(() => {
        result = reduce(state, action);
      }).not.toThrow();
      expect(result).toBeDefined();
    }
  });

  it("rejects commit/timeout against a missing decision instead of applying them", () => {
    const state = malformed((d) => {
      delete d.public?.pending;
    });
    expectReject(state, commitP1, "WRONG_ACTOR");
    expectReject(state, timeoutD1, "STALE_DECISION");
  });
});
