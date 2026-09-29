import { describe, expect, it } from "vitest";
import { expNeg } from "../src/ai/exp";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

describe("expNeg", () => {
  it("is exactly 1 at 0", () => {
    expect(expNeg(0)).toBe(1);
  });

  it("matches the pinned value at -1", () => {
    expect(expNeg(-1)).toBe(0.36787944117144233);
  });

  it("underflows to exactly 0 below -700", () => {
    expect(expNeg(-700.5)).toBe(0);
  });

  it("tracks Math.exp within 1e-13 relative error over [-40, 0]", () => {
    for (let i = 0; i < 1000; i++) {
      const x = (-40 * i) / 999;
      expect(Math.abs(expNeg(x) / Math.exp(x) - 1)).toBeLessThan(1e-13);
    }
  });

  it("is strictly decreasing across a coarse grid", () => {
    let previous = expNeg(0);
    for (let x = -0.5; x >= -20; x -= 0.5) {
      const value = expNeg(x);
      expect(value).toBeLessThan(previous);
      previous = value;
    }
  });

  it("rejects positive input with a RangeError", () => {
    expect(() => expNeg(0.1)).toThrow(RangeError);
  });

  it("rejects NaN with a RangeError", () => {
    expect(() => expNeg(Number.NaN)).toThrow(RangeError);
  });
});
