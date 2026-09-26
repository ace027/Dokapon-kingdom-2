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
import { arbInput, arbScript, arbSettings } from "./arbitraries";

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
      fc.property(arbSettings, arbScript, (settings, script) => {
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
