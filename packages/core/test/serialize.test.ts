import { describe, expect, it } from "vitest";
import {
  deserialize,
  hashState,
  SchemaVersionError,
  serialize,
  stableStringify,
} from "../src/serialize";
import { fnv1a32 } from "../src/hash";
import { newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

class Point {
  constructor(readonly x: number) {}
}

function patched(patch: (draft: Record<string, unknown>) => void): string {
  const draft = JSON.parse(serialize(newGame())) as Record<string, unknown>;
  patch(draft);
  return JSON.stringify(draft);
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

describe("serialize", () => {
  it("is stableStringify and hashes canonically", () => {
    const state = newGame();
    expect(serialize(state)).toBe(stableStringify(state));
    expect(hashState(state)).toBe(fnv1a32(serialize(state)));
  });
});

describe("deserialize (02-01a compile shim; one mutation each from a valid save)", () => {
  it("throws TypeError when rules is not an object", () => {
    expect(() => deserialize(serialize(newGame()), undefined as never)).toThrow(
      "deserialize: rules must be an object",
    );
  });

  it("throws SyntaxError for invalid JSON", () => {
    expect(() => deserialize("{not json", TEST_RULES)).toThrow(SyntaxError);
  });

  it.each<[string, string]>([
    ["null", "null"],
    ["a number", "42"],
    ["an array", "[]"],
  ])("throws TypeError for %s", (_label, json) => {
    expect(() => deserialize(json, TEST_RULES)).toThrow(TypeError);
    expect(() => deserialize(json, TEST_RULES)).toThrow("deserialize: state must be an object");
  });

  it.each([1, 3])("throws SchemaVersionError for v: %s", (v) => {
    const json = patched((d) => {
      d.v = v;
    });
    expect(() => deserialize(json, TEST_RULES)).toThrow(SchemaVersionError);
    expect(() => deserialize(json, TEST_RULES)).toThrow(
      expect.objectContaining({ name: "SchemaVersionError" }),
    );
  });

  it("throws TypeError for an extra root key", () => {
    const json = patched((d) => {
      d.extra = 1;
    });
    expect(() => deserialize(json, TEST_RULES)).toThrow(TypeError);
    expect(() => deserialize(json, TEST_RULES)).toThrow("deserialize: root keys");
  });

  it("throws TypeError for a missing root key", () => {
    const json = patched((d) => {
      delete d.hidden;
    });
    expect(() => deserialize(json, TEST_RULES)).toThrow("deserialize: root keys");
  });

  it("throws TypeError for a renamed root key (right key count)", () => {
    const json = patched((d) => {
      d.other = d.hidden;
      delete d.hidden;
    });
    expect(() => deserialize(json, TEST_RULES)).toThrow("deserialize: root keys");
  });

  it("refuses an otherwise valid save until 02-01b", () => {
    const json = serialize(newGame());
    expect(() => deserialize(json, TEST_RULES)).toThrow(TypeError);
    expect(() => deserialize(json, TEST_RULES)).toThrow(
      "deserialize: v2 validation lands in 02-01b",
    );
  });
});
