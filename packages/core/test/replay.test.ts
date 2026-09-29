import { describe, expect, it } from "vitest";
import { replay } from "../src/replay";
import { hashState, stableStringify } from "../src/serialize";
import { FIXTURE_SETTINGS, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const JUNK = [
  null,
  42,
  { v: 1, type: "x" },
  { v: 2, type: "decision/open", playerId: "system", prompts: [] },
];

describe("replay", () => {
  it("replays an empty script to the initial state", () => {
    const result = replay(FIXTURE_SETTINGS, [], TEST_RULES);
    expect(result.events).toHaveLength(0);
    expect(result.rejections).toHaveLength(0);
    expect(hashState(result.state)).toBe("758ef72c");
  });

  it("records a rejection per junk action, continues, and leaves the state unchanged", () => {
    const result = replay(FIXTURE_SETTINGS, JUNK, TEST_RULES);
    expect(result.rejections.map((r) => [r.index, r.error.code])).toEqual([
      [0, "UNSUPPORTED_VERSION"],
      [1, "UNSUPPORTED_VERSION"],
      [2, "UNSUPPORTED_VERSION"],
      [3, "UNKNOWN_ACTION"],
    ]);
    expect(result.events).toHaveLength(0);
    expect(result.state).toEqual(newGame());
  });

  it("is deterministic", () => {
    const a = replay(FIXTURE_SETTINGS, JUNK, TEST_RULES);
    const b = replay(FIXTURE_SETTINGS, JUNK, TEST_RULES);
    expect(stableStringify(a)).toBe(stableStringify(b));
  });
});
