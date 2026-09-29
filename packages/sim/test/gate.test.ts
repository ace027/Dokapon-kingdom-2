// Hard vs Easy gate (user decision D1): in every class mirror, Hard wins >= 70% of the decisive
// duels AND draws <= 40%, with the exact counts pinned as a determinism check. Every value below
// is transcribed from the spec's gate table and traces/gate.trace.json (outcome, winner only:
// the per-duel events/hash pins depend on the 02-04 reward hook and land in the W3 closing step).
import { loadRules } from "@usurpia/content/node";
import { describe, expect, it } from "vitest";
import { runDuel, type DuelResult } from "../src/duel";

const CLASSES = ["cleric", "mage", "shadowpriest", "spellblade", "thief", "warrior"] as const;
const DUELS_PER_CLASS = 400;
const LEVEL = 5;

const EXPECTED = {
  cleric: { hardWins: 221, easyWins: 65, draws: 114, fled: 0 },
  mage: { hardWins: 248, easyWins: 45, draws: 107, fled: 0 },
  shadowpriest: { hardWins: 247, easyWins: 67, draws: 86, fled: 0 },
  spellblade: { hardWins: 310, easyWins: 67, draws: 23, fled: 0 },
  thief: { hardWins: 263, easyWins: 68, draws: 69, fled: 0 },
  warrior: { hardWins: 306, easyWins: 60, draws: 34, fled: 0 },
} as const;

type Winner = 0 | 1 | null;
interface Pin {
  j: number;
  outcome: "ko" | "fled" | "draw";
  winner: Winner;
}

/** The first 20 gate duels per class: (outcome, winner) from traces/gate.trace.json. */
const GATE_FIRST20: Record<(typeof CLASSES)[number], readonly Pin[]> = {
  cleric: [
    { j: 0, outcome: "ko", winner: 0 },
    { j: 1, outcome: "draw", winner: null },
    { j: 2, outcome: "draw", winner: null },
    { j: 3, outcome: "ko", winner: 0 },
    { j: 4, outcome: "ko", winner: 0 },
    { j: 5, outcome: "ko", winner: 1 },
    { j: 6, outcome: "draw", winner: null },
    { j: 7, outcome: "ko", winner: 1 },
    { j: 8, outcome: "ko", winner: 0 },
    { j: 9, outcome: "ko", winner: 1 },
    { j: 10, outcome: "ko", winner: 1 },
    { j: 11, outcome: "ko", winner: 1 },
    { j: 12, outcome: "ko", winner: 1 },
    { j: 13, outcome: "ko", winner: 0 },
    { j: 14, outcome: "draw", winner: null },
    { j: 15, outcome: "ko", winner: 1 },
    { j: 16, outcome: "ko", winner: 0 },
    { j: 17, outcome: "ko", winner: 1 },
    { j: 18, outcome: "ko", winner: 0 },
    { j: 19, outcome: "draw", winner: null },
  ],
  mage: [
    { j: 0, outcome: "draw", winner: null },
    { j: 1, outcome: "ko", winner: 1 },
    { j: 2, outcome: "draw", winner: null },
    { j: 3, outcome: "ko", winner: 1 },
    { j: 4, outcome: "ko", winner: 0 },
    { j: 5, outcome: "ko", winner: 1 },
    { j: 6, outcome: "ko", winner: 0 },
    { j: 7, outcome: "ko", winner: 1 },
    { j: 8, outcome: "ko", winner: 1 },
    { j: 9, outcome: "ko", winner: 1 },
    { j: 10, outcome: "ko", winner: 0 },
    { j: 11, outcome: "draw", winner: null },
    { j: 12, outcome: "draw", winner: null },
    { j: 13, outcome: "draw", winner: null },
    { j: 14, outcome: "ko", winner: 0 },
    { j: 15, outcome: "ko", winner: 1 },
    { j: 16, outcome: "draw", winner: null },
    { j: 17, outcome: "ko", winner: 1 },
    { j: 18, outcome: "draw", winner: null },
    { j: 19, outcome: "ko", winner: 1 },
  ],
  shadowpriest: [
    { j: 0, outcome: "ko", winner: 0 },
    { j: 1, outcome: "draw", winner: null },
    { j: 2, outcome: "ko", winner: 0 },
    { j: 3, outcome: "ko", winner: 1 },
    { j: 4, outcome: "ko", winner: 0 },
    { j: 5, outcome: "ko", winner: 1 },
    { j: 6, outcome: "ko", winner: 0 },
    { j: 7, outcome: "ko", winner: 1 },
    { j: 8, outcome: "ko", winner: 1 },
    { j: 9, outcome: "ko", winner: 1 },
    { j: 10, outcome: "ko", winner: 0 },
    { j: 11, outcome: "draw", winner: null },
    { j: 12, outcome: "ko", winner: 0 },
    { j: 13, outcome: "ko", winner: 1 },
    { j: 14, outcome: "ko", winner: 1 },
    { j: 15, outcome: "ko", winner: 0 },
    { j: 16, outcome: "ko", winner: 0 },
    { j: 17, outcome: "draw", winner: null },
    { j: 18, outcome: "ko", winner: 1 },
    { j: 19, outcome: "draw", winner: null },
  ],
  spellblade: [
    { j: 0, outcome: "ko", winner: 0 },
    { j: 1, outcome: "ko", winner: 1 },
    { j: 2, outcome: "ko", winner: 1 },
    { j: 3, outcome: "ko", winner: 1 },
    { j: 4, outcome: "ko", winner: 0 },
    { j: 5, outcome: "ko", winner: 1 },
    { j: 6, outcome: "ko", winner: 0 },
    { j: 7, outcome: "ko", winner: 0 },
    { j: 8, outcome: "ko", winner: 0 },
    { j: 9, outcome: "ko", winner: 1 },
    { j: 10, outcome: "ko", winner: 0 },
    { j: 11, outcome: "ko", winner: 1 },
    { j: 12, outcome: "ko", winner: 0 },
    { j: 13, outcome: "ko", winner: 0 },
    { j: 14, outcome: "ko", winner: 0 },
    { j: 15, outcome: "ko", winner: 1 },
    { j: 16, outcome: "ko", winner: 0 },
    { j: 17, outcome: "ko", winner: 1 },
    { j: 18, outcome: "draw", winner: null },
    { j: 19, outcome: "ko", winner: 1 },
  ],
  thief: [
    { j: 0, outcome: "ko", winner: 0 },
    { j: 1, outcome: "ko", winner: 1 },
    { j: 2, outcome: "ko", winner: 0 },
    { j: 3, outcome: "ko", winner: 1 },
    { j: 4, outcome: "draw", winner: null },
    { j: 5, outcome: "ko", winner: 0 },
    { j: 6, outcome: "ko", winner: 1 },
    { j: 7, outcome: "draw", winner: null },
    { j: 8, outcome: "ko", winner: 0 },
    { j: 9, outcome: "ko", winner: 1 },
    { j: 10, outcome: "ko", winner: 0 },
    { j: 11, outcome: "ko", winner: 1 },
    { j: 12, outcome: "ko", winner: 1 },
    { j: 13, outcome: "ko", winner: 0 },
    { j: 14, outcome: "ko", winner: 0 },
    { j: 15, outcome: "ko", winner: 1 },
    { j: 16, outcome: "ko", winner: 0 },
    { j: 17, outcome: "ko", winner: 1 },
    { j: 18, outcome: "ko", winner: 0 },
    { j: 19, outcome: "ko", winner: 1 },
  ],
  warrior: [
    { j: 0, outcome: "ko", winner: 0 },
    { j: 1, outcome: "ko", winner: 0 },
    { j: 2, outcome: "ko", winner: 0 },
    { j: 3, outcome: "ko", winner: 1 },
    { j: 4, outcome: "ko", winner: 0 },
    { j: 5, outcome: "ko", winner: 1 },
    { j: 6, outcome: "ko", winner: 1 },
    { j: 7, outcome: "ko", winner: 1 },
    { j: 8, outcome: "ko", winner: 0 },
    { j: 9, outcome: "ko", winner: 1 },
    { j: 10, outcome: "ko", winner: 0 },
    { j: 11, outcome: "ko", winner: 1 },
    { j: 12, outcome: "draw", winner: null },
    { j: 13, outcome: "ko", winner: 1 },
    { j: 14, outcome: "ko", winner: 0 },
    { j: 15, outcome: "ko", winner: 1 },
    { j: 16, outcome: "ko", winner: 0 },
    { j: 17, outcome: "ko", winner: 1 },
    { j: 18, outcome: "ko", winner: 0 },
    { j: 19, outcome: "ko", winner: 1 },
  ],
};

const rules = loadRules();

function gateDuel(classId: string, j: number): { result: DuelResult; hardSide: 0 | 1 } {
  const hardFirst = j % 2 === 0;
  const result = runDuel(rules, {
    seed: `gate/${classId}/${String(j)}`,
    a: { classId, difficulty: hardFirst ? "hard" : "easy" },
    b: { kind: "class", classId, difficulty: hardFirst ? "easy" : "hard" },
    level: LEVEL,
  });
  return { result, hardSide: hardFirst ? 0 : 1 };
}

describe("Hard vs Easy gate", { timeout: 120_000 }, () => {
  for (const classId of CLASSES) {
    describe(classId, () => {
      const pins: Pin[] = [];
      const counts = { hardWins: 0, easyWins: 0, draws: 0, fled: 0 };
      for (let j = 0; j < DUELS_PER_CLASS; j++) {
        const { result, hardSide } = gateDuel(classId, j);
        if (j < 20) pins.push({ j, outcome: result.outcome, winner: result.winner });
        if (result.outcome === "draw") counts.draws += 1;
        else if (result.outcome === "fled") counts.fled += 1;
        else if (result.winner === hardSide) counts.hardWins += 1;
        else counts.easyWins += 1;
      }

      it("reproduces the pinned counts exactly", () => {
        expect(counts).toEqual(EXPECTED[classId]);
      });

      it("meets the D1 requirement: Hard >= 70% of decisive duels and draws <= 40%", () => {
        const decisive = counts.hardWins + counts.easyWins;
        expect(decisive).toBeGreaterThan(0);
        expect(counts.hardWins / decisive).toBeGreaterThanOrEqual(0.7);
        expect(counts.draws / DUELS_PER_CLASS).toBeLessThanOrEqual(0.4);
      });

      it("reproduces the first 20 per-duel (outcome, winner) pins", () => {
        expect(pins).toEqual(GATE_FIRST20[classId]);
      });
    });
  }

  it("counts every duel exactly once per class", () => {
    for (const classId of CLASSES) {
      const e = EXPECTED[classId];
      expect(e.hardWins + e.easyWins + e.draws + e.fled).toBe(DUELS_PER_CLASS);
    }
  });
});
