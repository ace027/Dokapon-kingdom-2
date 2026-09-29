import { describe, expect, it } from "vitest";
import {
  CONTENT_ID_PATTERN,
  levelForXp,
  masteryRank,
  RESERVED_CONTENT_IDS,
  rulesHash,
  STAT_KEYS,
  type Rules,
} from "../src/rules";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

describe("rulesHash", () => {
  it("pins the TEST_RULES transcription", () => {
    expect(rulesHash(TEST_RULES)).toBe("7433ea8b");
  });

  it("changes when one tuning number changes", () => {
    const tweaked: Rules = { ...TEST_RULES, economy: { ...TEST_RULES.economy, startingGold: 101 } };
    expect(rulesHash(tweaked)).not.toBe(rulesHash(TEST_RULES));
  });

  it("is independent of key insertion order", () => {
    const { economy, ...rest } = TEST_RULES;
    const reordered = { economy, ...rest } as Rules;
    expect(Object.keys(reordered)[0]).toBe("economy");
    expect(rulesHash(reordered)).toBe(rulesHash(TEST_RULES));
  });
});

describe("content id pattern and constants", () => {
  it("accepts a 48-char id", () => {
    expect(CONTENT_ID_PATTERN.test("a".repeat(48))).toBe(true);
  });

  it("rejects 49 chars", () => {
    expect(CONTENT_ID_PATTERN.test("a".repeat(49))).toBe(false);
  });

  it("rejects uppercase", () => {
    expect(CONTENT_ID_PATTERN.test("aBc")).toBe(false);
  });

  it("rejects a leading digit", () => {
    expect(CONTENT_ID_PATTERN.test("1abc")).toBe(false);
  });

  it("reserves prototype-polluting ids", () => {
    expect(RESERVED_CONTENT_IDS).toEqual(["constructor", "prototype"]);
  });

  it("keeps the canonical stat order", () => {
    expect(STAT_KEYS).toEqual(["hp", "atk", "def", "mag", "spd", "luck"]);
  });
});

describe("masteryRank / levelForXp", () => {
  it("maps wins to ranks at every threshold boundary", () => {
    const wins = [0, 2, 3, 6, 7, 11, 12, 17, 18, 1000];
    expect(wins.map((w) => masteryRank(TEST_RULES, w))).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it("maps xp to levels at every checked boundary", () => {
    const xp = [0, 49, 50, 149, 150, 2250, 99999];
    expect(xp.map((x) => levelForXp(TEST_RULES, x))).toEqual([1, 1, 2, 2, 3, 10, 10]);
  });
});
