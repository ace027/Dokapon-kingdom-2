import { describe, expect, it } from "vitest";
import { nextInt, nextU32, normalizeSeedState, seedRng, type RngState } from "../src/rng";

// Golden vectors pinned by the phase spec (computed independently from bryc's reference JS).
const USURPIA_SEED = [2424685999, 2448471286, 44465632, 3153165131];
const USURPIA_U32 = [3731355121, 1703163097, 1097702884, 3554771409, 3521645566];
const USURPIA_D6 = [2, 2, 5, 4, 5, 6, 4, 6, 1, 1];

describe("seedRng (cyrb128)", () => {
  it("matches the golden seed state for 'usurpia'", () => {
    expect(seedRng("usurpia")).toEqual(USURPIA_SEED);
  });

  it("is deterministic and seed-sensitive", () => {
    expect(seedRng("abc")).toEqual(seedRng("abc"));
    expect(seedRng("abc")).not.toEqual(seedRng("abd"));
  });

  it("replaces an all-zero state with a non-zero fallback", () => {
    expect(normalizeSeedState([0, 0, 0, 0])).toEqual([1, 0, 0, 0]);
    const nonZero: RngState = [0, 0, 0, 7];
    expect(normalizeSeedState(nonZero)).toBe(nonZero);
  });
});

describe("nextU32 (sfc32)", () => {
  it("matches the first five golden outputs", () => {
    let rng = seedRng("usurpia");
    const out: number[] = [];
    for (let i = 0; i < 5; i++) {
      const [value, next] = nextU32(rng);
      out.push(value);
      rng = next;
    }
    expect(out).toEqual(USURPIA_U32);
  });

  it("does not mutate its input tuple", () => {
    const rng = Object.freeze([...seedRng("usurpia")]) as unknown as RngState;
    const [, next] = nextU32(rng);
    expect(rng).toEqual(USURPIA_SEED);
    expect(next).not.toBe(rng);
  });

  it("returns unsigned 32-bit words", () => {
    let rng: RngState = [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff];
    for (let i = 0; i < 20; i++) {
      const [value, next] = nextU32(rng);
      expect(Number.isInteger(value) && value >= 0 && value < 2 ** 32).toBe(true);
      for (const word of next) expect(word >= 0 && word < 2 ** 32).toBe(true);
      rng = next;
    }
  });
});

describe("nextInt", () => {
  it("matches the first ten golden d6 rolls", () => {
    let rng = Object.freeze([...seedRng("usurpia")]) as unknown as RngState;
    const out: number[] = [];
    for (let i = 0; i < 10; i++) {
      const [value, next] = nextInt(rng, 1, 6);
      out.push(value);
      rng = next;
    }
    expect(out).toEqual(USURPIA_D6);
  });

  it("returns min when min === max and stays in range", () => {
    let rng = seedRng("range");
    const [same] = nextInt(rng, 5, 5);
    expect(same).toBe(5);
    for (let i = 0; i < 200; i++) {
      const [value, next] = nextInt(rng, -3, 3);
      expect(value >= -3 && value <= 3).toBe(true);
      rng = next;
    }
  });

  it("accepts a full 2**32 span", () => {
    const [value] = nextInt(seedRng("usurpia"), 0, 2 ** 32 - 1);
    expect(value).toBe(USURPIA_U32[0]);
  });

  it.each([
    ["min > max", 1, 0],
    ["non-integer min", 0.5, 2],
    ["span > 2**32", 0, 2 ** 32],
    ["unsafe integer", 0, 2 ** 53],
  ])("throws RangeError for %s", (_label, min, max) => {
    expect(() => nextInt(seedRng("x"), min, max)).toThrow(RangeError);
  });
});
