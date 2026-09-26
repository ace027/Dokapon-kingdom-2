import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  createGame,
  deserialize,
  fnv1a32,
  hashState,
  isAction,
  reduce,
  replay,
  SchemaVersionError,
  serialize,
  stableStringify,
  type Action,
  type GameState,
} from "../src/index";
import { arbGame, arbInput } from "./arbitraries";

const minimalState: GameState = {
  v: 1,
  public: {
    phase: "turn",
    turn: 1,
    activePlayer: "p1",
    players: ["p1"],
    counter: 0,
    lastRoll: null,
    pending: null,
    lastReveal: null,
  },
  private: { p1: { note: null } },
  hidden: { rng: [1, 2, 3, 4], decisionSeq: 0, decision: null },
};

function withPatch(patch: (draft: Record<string, unknown>) => void): string {
  const draft = JSON.parse(serialize(minimalState)) as Record<string, unknown>;
  patch(draft);
  return JSON.stringify(draft);
}

class Point {
  constructor(readonly x: number) {}
}

describe("fnv1a32", () => {
  it("matches the golden vectors", () => {
    expect(fnv1a32("")).toBe("811c9dc5");
    expect(fnv1a32("a")).toBe("e40c292c");
    expect(fnv1a32('{"a":1}')).toBe("8b9e4511");
  });
});

describe("stableStringify", () => {
  it("sorts keys recursively", () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
  });

  it("is independent of key insertion order", () => {
    expect(stableStringify({ x: 1, y: { q: null, p: "s" } })).toBe(
      stableStringify({ y: { p: "s", q: null }, x: 1 }),
    );
  });

  it("handles primitives and null-prototype objects", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify('a"b')).toBe('"a\\"b"');
    expect(stableStringify(-1.5)).toBe("-1.5");
    const bare = Object.create(null) as Record<string, unknown>;
    bare.k = 1;
    expect(stableStringify(bare)).toBe('{"k":1}');
  });

  it.each<[string, unknown]>([
    ["top-level undefined", undefined],
    ["nested undefined", { a: { b: undefined } }],
    ["undefined array element", [1, undefined]],
    ["NaN", { n: Number.NaN }],
    ["Infinity", [Infinity]],
    ["function", { f: () => 1 }],
    ["Map", new Map([["a", 1]])],
    ["class instance", new Point(1)],
    ["bigint", { b: 1n }],
    ["symbol", Symbol("s")],
  ])("throws TypeError for %s", (_label, value) => {
    expect(() => stableStringify(value)).toThrow(TypeError);
  });

  it("names the offending path", () => {
    expect(() => stableStringify({ hidden: { rng: [1, 2, Number.NaN, 4] } })).toThrow(
      "$.hidden.rng[2]",
    );
  });
});

describe("serialize / deserialize", () => {
  it("round-trips a state and hashes canonically", () => {
    expect(deserialize(serialize(minimalState))).toEqual(minimalState);
    expect(hashState(minimalState)).toBe(fnv1a32(serialize(minimalState)));
  });

  it("throws SchemaVersionError for v: 2", () => {
    const json = withPatch((d) => {
      d.v = 2;
    });
    expect(() => deserialize(json)).toThrow(SchemaVersionError);
    expect(() => deserialize(json)).toThrow(
      expect.objectContaining({ name: "SchemaVersionError" }),
    );
  });

  it("throws SyntaxError for invalid JSON", () => {
    expect(() => deserialize("{not json")).toThrow(SyntaxError);
  });

  it.each<[string, string]>([
    ["non-object JSON", "[1,2]"],
    ["null JSON", "null"],
    [
      "missing partition",
      withPatch((d) => {
        delete d.hidden;
      }),
    ],
    [
      "bad phase",
      withPatch((d) => {
        (d.public as Record<string, unknown>).phase = "combat";
      }),
    ],
    [
      "empty players",
      withPatch((d) => {
        (d.public as Record<string, unknown>).players = [];
      }),
    ],
    [
      "non-string player",
      withPatch((d) => {
        (d.public as Record<string, unknown>).players = [1];
      }),
    ],
    [
      "rng of wrong length",
      withPatch((d) => {
        (d.hidden as Record<string, unknown>).rng = [1, 2, 3];
      }),
    ],
    [
      "rng word out of range",
      withPatch((d) => {
        (d.hidden as Record<string, unknown>).rng = [1, 2, 3, 2 ** 32];
      }),
    ],
    [
      "non-integer rng word",
      withPatch((d) => {
        (d.hidden as Record<string, unknown>).rng = [1, 2, 3, 0.5];
      }),
    ],
  ])("throws TypeError for %s", (_label, json) => {
    expect(() => deserialize(json)).toThrow(TypeError);
  });
});

interface Draft {
  public: Record<string, unknown>;
  private: Record<string, unknown>;
  hidden: Record<string, unknown>;
}

/** A valid mid-decision state: p1 committed B, p2 still pending; p1 rolled and there was a reveal. */
const decisionState: GameState = {
  v: 1,
  public: {
    phase: "decision",
    turn: 2,
    activePlayer: "p2",
    players: ["p1", "p2"],
    counter: 3,
    lastRoll: { playerId: "p1", value: 6 },
    pending: { id: "d2", kind: "sample", required: ["p1", "p2"], committed: ["p1"] },
    lastReveal: { decisionId: "d1", choices: { p1: "A" }, timedOut: ["p1"] },
  },
  private: { p1: { note: "n" }, p2: { note: null } },
  hidden: {
    rng: [1, 2, 3, 4],
    decisionSeq: 2,
    decision: { id: "d2", defaultChoice: "C", choices: { p1: "B" } },
  },
};

function patchDecision(patch: (draft: Draft) => void): string {
  const draft = JSON.parse(serialize(decisionState)) as Draft;
  patch(draft);
  return JSON.stringify(draft);
}

const pub = (d: Draft) => d.public;
const hid = (d: Draft) => d.hidden;
const pendingOf = (d: Draft) => pub(d).pending as Record<string, unknown>;
const decisionOf = (d: Draft) => hid(d).decision as Record<string, unknown>;

describe("deserialize full-shape validation (review cycle 1)", () => {
  it("accepts valid turn and decision states, including prototype-named players", () => {
    expect(deserialize(serialize(decisionState))).toEqual(decisionState);
    const protoNamed = createGame({ v: 1, seed: "s", players: ["toString", "valueOf"] });
    expect(deserialize(serialize(protoNamed))).toEqual(protoNamed);
    const toStringOnly = withPatch((d) => {
      d.public = { ...minimalState.public, players: ["toString"], activePlayer: "toString" };
      d.private = { toString: { note: null } };
    });
    expect(deserialize(toStringOnly).public.players).toEqual(["toString"]);
  });

  it.each<[string, (d: Draft) => void]>([
    [
      "phase 'decision' with pending missing",
      (d) => {
        delete pub(d).pending;
      },
    ],
    [
      "phase 'decision' with pending {}",
      (d) => {
        pub(d).pending = {};
      },
    ],
    [
      "pending {id:'d1'} without required",
      (d) => {
        pub(d).pending = { id: "d2", kind: "sample" };
      },
    ],
    [
      "pending.required empty",
      (d) => {
        pendingOf(d).required = [];
      },
    ],
    [
      "pending.required with a non-player",
      (d) => {
        pendingOf(d).required = ["p1", "ghost"];
      },
    ],
    [
      "pending.required duplicated",
      (d) => {
        pendingOf(d).required = ["p1", "p1"];
      },
    ],
    [
      "pending.committed outside required",
      (d) => {
        pendingOf(d).required = ["p2"];
      },
    ],
    [
      "pending.kind wrong",
      (d) => {
        pendingOf(d).kind = "combat";
      },
    ],
    [
      "pending.id !== decision.id",
      (d) => {
        decisionOf(d).id = "d9";
      },
    ],
    [
      "decision missing in phase 'decision'",
      (d) => {
        hid(d).decision = null;
      },
    ],
    [
      "decision.defaultChoice invalid",
      (d) => {
        decisionOf(d).defaultChoice = "D";
      },
    ],
    [
      "decision.choices keys != committed",
      (d) => {
        decisionOf(d).choices = {};
      },
    ],
    [
      "decision.choices extra key",
      (d) => {
        decisionOf(d).choices = { p1: "B", p2: "A" };
      },
    ],
    [
      "decision.choices bad value",
      (d) => {
        decisionOf(d).choices = { p1: "Z" };
      },
    ],
    [
      "phase 'turn' with a pending decision",
      (d) => {
        pub(d).phase = "turn";
      },
    ],
    [
      "missing decisionSeq",
      (d) => {
        delete hid(d).decisionSeq;
      },
    ],
    [
      "negative decisionSeq",
      (d) => {
        hid(d).decisionSeq = -1;
      },
    ],
    [
      "fractional turn",
      (d) => {
        pub(d).turn = 1.5;
      },
    ],
    [
      "missing counter",
      (d) => {
        delete pub(d).counter;
      },
    ],
    [
      "players ['constructor']",
      (d) => {
        pub(d).players = ["constructor"];
        pub(d).activePlayer = "constructor";
        d.private = { constructor: { note: null } };
      },
    ],
    [
      "players with an invalid id",
      (d) => {
        pub(d).players = ["p1", "bad id"];
      },
    ],
    [
      "5 players",
      (d) => {
        pub(d).players = ["p1", "p2", "p3", "p4", "p5"];
      },
    ],
    [
      "duplicate players",
      (d) => {
        pub(d).players = ["p1", "p1"];
      },
    ],
    [
      "activePlayer not a player",
      (d) => {
        pub(d).activePlayer = "ghost";
      },
    ],
    [
      "private keys != players (missing)",
      (d) => {
        delete d.private.p2;
      },
    ],
    [
      "private keys != players (extra)",
      (d) => {
        d.private.p3 = { note: null };
      },
    ],
    [
      "private __proto__ key",
      (d) =>
        void (d.private = JSON.parse('{"p1":{"note":null},"__proto__":{"note":null}}') as Record<
          string,
          unknown
        >),
    ],
    [
      "private note not a string",
      (d) => {
        d.private.p1 = { note: 3 };
      },
    ],
    [
      "lastRoll value 7",
      (d) => {
        pub(d).lastRoll = { playerId: "p1", value: 7 };
      },
    ],
    [
      "lastRoll by a non-player",
      (d) => {
        pub(d).lastRoll = { playerId: "ghost", value: 1 };
      },
    ],
    [
      "lastReveal choices for a non-player",
      (d) => {
        pub(d).lastReveal = { decisionId: "d1", choices: { ghost: "A" }, timedOut: [] };
      },
    ],
    [
      "lastReveal timedOut non-player",
      (d) => {
        pub(d).lastReveal = { decisionId: "d1", choices: {}, timedOut: ["ghost"] };
      },
    ],
    [
      "lastReveal choice value invalid",
      (d) => {
        pub(d).lastReveal = { decisionId: "d1", choices: { p1: 1 }, timedOut: [] };
      },
    ],
  ])("throws TypeError for %s", (_label, patch) => {
    expect(() => deserialize(patchDecision(patch))).toThrow(TypeError);
  });
});

describe("canonical JSON round-trips (properties)", () => {
  it("round-trips every valid generated action", () => {
    fc.assert(
      fc.property(arbInput, (input) => {
        if (!isAction(input)) return;
        expect(JSON.parse(stableStringify(input))).toEqual(input);
      }),
      { numRuns: 200 },
    );
  });

  it("round-trips every emitted event and every intermediate state", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        let state = createGame(settings);
        expect(deserialize(serialize(state))).toEqual(state);
        for (const action of script) {
          const result = reduce(state, action);
          if (!result.ok) continue;
          state = result.state;
          for (const event of result.events) {
            expect(JSON.parse(stableStringify(event))).toEqual(event);
          }
          expect(deserialize(serialize(state))).toEqual(state);
        }
        const { events } = replay(settings, script as readonly Action[]);
        for (const event of events) expect(JSON.parse(stableStringify(event))).toEqual(event);
      }),
      { numRuns: 200 },
    );
  });
});
