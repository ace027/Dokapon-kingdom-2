// Hard vs Easy gate (user decision D1): in every class mirror, Hard wins >= 70% of the decisive
// duels AND draws <= 40%, with the exact counts pinned as a determinism check. Every value below
// is transcribed from the spec's gate table and traces/gate.trace.json (events/hash are the
// rewards-on values, pinned in the W3 closing step after the 02-04 reward hook merged).
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
  events: number;
  hash: string;
}

/** The first 20 gate duels per class: (outcome, winner, events, hash) from traces/gate.trace.json. */
const GATE_FIRST20: Record<(typeof CLASSES)[number], readonly Pin[]> = {
  cleric: [
    { j: 0, outcome: "ko", winner: 0, events: 31, hash: "4a4be739" },
    { j: 1, outcome: "draw", winner: null, events: 55, hash: "aade8c5d" },
    { j: 2, outcome: "draw", winner: null, events: 56, hash: "7803483b" },
    { j: 3, outcome: "ko", winner: 0, events: 47, hash: "630d59ee" },
    { j: 4, outcome: "ko", winner: 0, events: 38, hash: "8a9c8124" },
    { j: 5, outcome: "ko", winner: 1, events: 31, hash: "b29683ab" },
    { j: 6, outcome: "draw", winner: null, events: 55, hash: "294e5371" },
    { j: 7, outcome: "ko", winner: 1, events: 32, hash: "de98e204" },
    { j: 8, outcome: "ko", winner: 0, events: 48, hash: "1dc58ec1" },
    { j: 9, outcome: "ko", winner: 1, events: 31, hash: "bb698c5d" },
    { j: 10, outcome: "ko", winner: 1, events: 31, hash: "d750e0c8" },
    { j: 11, outcome: "ko", winner: 1, events: 39, hash: "052b791f" },
    { j: 12, outcome: "ko", winner: 1, events: 47, hash: "84015468" },
    { j: 13, outcome: "ko", winner: 0, events: 38, hash: "3271b102" },
    { j: 14, outcome: "draw", winner: null, events: 56, hash: "74cb8890" },
    { j: 15, outcome: "ko", winner: 1, events: 39, hash: "b7ff2c4e" },
    { j: 16, outcome: "ko", winner: 0, events: 31, hash: "06244bde" },
    { j: 17, outcome: "ko", winner: 1, events: 31, hash: "2aded3d8" },
    { j: 18, outcome: "ko", winner: 0, events: 56, hash: "aa773085" },
    { j: 19, outcome: "draw", winner: null, events: 55, hash: "d26de8b0" },
  ],
  mage: [
    { j: 0, outcome: "draw", winner: null, events: 56, hash: "ec7ceacc" },
    { j: 1, outcome: "ko", winner: 1, events: 38, hash: "2e63508a" },
    { j: 2, outcome: "draw", winner: null, events: 55, hash: "35657c0f" },
    { j: 3, outcome: "ko", winner: 1, events: 31, hash: "5480073f" },
    { j: 4, outcome: "ko", winner: 0, events: 31, hash: "453a6119" },
    { j: 5, outcome: "ko", winner: 1, events: 38, hash: "dc961d48" },
    { j: 6, outcome: "ko", winner: 0, events: 48, hash: "0fbbcd36" },
    { j: 7, outcome: "ko", winner: 1, events: 31, hash: "bc5c6f3d" },
    { j: 8, outcome: "ko", winner: 1, events: 39, hash: "4650ccc6" },
    { j: 9, outcome: "ko", winner: 1, events: 47, hash: "f433f10b" },
    { j: 10, outcome: "ko", winner: 0, events: 47, hash: "b9f7441e" },
    { j: 11, outcome: "draw", winner: null, events: 55, hash: "e15bc377" },
    { j: 12, outcome: "draw", winner: null, events: 56, hash: "e6fd69f8" },
    { j: 13, outcome: "draw", winner: null, events: 56, hash: "4c900939" },
    { j: 14, outcome: "ko", winner: 0, events: 38, hash: "3a801c04" },
    { j: 15, outcome: "ko", winner: 1, events: 55, hash: "b684064a" },
    { j: 16, outcome: "draw", winner: null, events: 55, hash: "0e535cad" },
    { j: 17, outcome: "ko", winner: 1, events: 31, hash: "93f86b66" },
    { j: 18, outcome: "draw", winner: null, events: 56, hash: "68c422ac" },
    { j: 19, outcome: "ko", winner: 1, events: 48, hash: "470b9d01" },
  ],
  shadowpriest: [
    { j: 0, outcome: "ko", winner: 0, events: 55, hash: "dc593c4b" },
    { j: 1, outcome: "draw", winner: null, events: 56, hash: "36c06351" },
    { j: 2, outcome: "ko", winner: 0, events: 31, hash: "74940151" },
    { j: 3, outcome: "ko", winner: 1, events: 22, hash: "a7f0eb93" },
    { j: 4, outcome: "ko", winner: 0, events: 31, hash: "3b33d290" },
    { j: 5, outcome: "ko", winner: 1, events: 38, hash: "583a8b26" },
    { j: 6, outcome: "ko", winner: 0, events: 55, hash: "ddc83c5b" },
    { j: 7, outcome: "ko", winner: 1, events: 38, hash: "39984b50" },
    { j: 8, outcome: "ko", winner: 1, events: 32, hash: "06d292e7" },
    { j: 9, outcome: "ko", winner: 1, events: 55, hash: "2b711917" },
    { j: 10, outcome: "ko", winner: 0, events: 31, hash: "08ff049e" },
    { j: 11, outcome: "draw", winner: null, events: 55, hash: "1859c325" },
    { j: 12, outcome: "ko", winner: 0, events: 22, hash: "8eb0ddf4" },
    { j: 13, outcome: "ko", winner: 1, events: 22, hash: "c5e74c2b" },
    { j: 14, outcome: "ko", winner: 1, events: 38, hash: "9399fed1" },
    { j: 15, outcome: "ko", winner: 0, events: 31, hash: "1b00a1bf" },
    { j: 16, outcome: "ko", winner: 0, events: 31, hash: "6de3456c" },
    { j: 17, outcome: "draw", winner: null, events: 55, hash: "7502f10f" },
    { j: 18, outcome: "ko", winner: 1, events: 55, hash: "8746ebf0" },
    { j: 19, outcome: "draw", winner: null, events: 55, hash: "535bf1ac" },
  ],
  spellblade: [
    { j: 0, outcome: "ko", winner: 0, events: 31, hash: "55b5cbaf" },
    { j: 1, outcome: "ko", winner: 1, events: 31, hash: "d2fddbe1" },
    { j: 2, outcome: "ko", winner: 1, events: 31, hash: "3cb9930b" },
    { j: 3, outcome: "ko", winner: 1, events: 31, hash: "822ef720" },
    { j: 4, outcome: "ko", winner: 0, events: 31, hash: "2355ac9f" },
    { j: 5, outcome: "ko", winner: 1, events: 56, hash: "f6a6d6c9" },
    { j: 6, outcome: "ko", winner: 0, events: 39, hash: "3035b763" },
    { j: 7, outcome: "ko", winner: 0, events: 22, hash: "22de8b9e" },
    { j: 8, outcome: "ko", winner: 0, events: 38, hash: "245a369a" },
    { j: 9, outcome: "ko", winner: 1, events: 40, hash: "0967c631" },
    { j: 10, outcome: "ko", winner: 0, events: 22, hash: "0e87a775" },
    { j: 11, outcome: "ko", winner: 1, events: 31, hash: "31f07fc8" },
    { j: 12, outcome: "ko", winner: 0, events: 31, hash: "cc34a9f8" },
    { j: 13, outcome: "ko", winner: 0, events: 31, hash: "72e81f6c" },
    { j: 14, outcome: "ko", winner: 0, events: 31, hash: "8e79f780" },
    { j: 15, outcome: "ko", winner: 1, events: 22, hash: "f71f3a6b" },
    { j: 16, outcome: "ko", winner: 0, events: 39, hash: "bf770a91" },
    { j: 17, outcome: "ko", winner: 1, events: 32, hash: "b8f97105" },
    { j: 18, outcome: "draw", winner: null, events: 56, hash: "ca39c097" },
    { j: 19, outcome: "ko", winner: 1, events: 31, hash: "9e652be6" },
  ],
  thief: [
    { j: 0, outcome: "ko", winner: 0, events: 32, hash: "01a067ec" },
    { j: 1, outcome: "ko", winner: 1, events: 22, hash: "1fb0bf51" },
    { j: 2, outcome: "ko", winner: 0, events: 22, hash: "173843ab" },
    { j: 3, outcome: "ko", winner: 1, events: 39, hash: "ac5e11df" },
    { j: 4, outcome: "draw", winner: null, events: 56, hash: "9213a4f2" },
    { j: 5, outcome: "ko", winner: 0, events: 48, hash: "c05e9543" },
    { j: 6, outcome: "ko", winner: 1, events: 31, hash: "680d50f3" },
    { j: 7, outcome: "draw", winner: null, events: 56, hash: "4e77d5cc" },
    { j: 8, outcome: "ko", winner: 0, events: 31, hash: "3dc8bb7f" },
    { j: 9, outcome: "ko", winner: 1, events: 48, hash: "19bb1b72" },
    { j: 10, outcome: "ko", winner: 0, events: 55, hash: "9ddbdafa" },
    { j: 11, outcome: "ko", winner: 1, events: 31, hash: "2b62e4bd" },
    { j: 12, outcome: "ko", winner: 1, events: 31, hash: "b6001d16" },
    { j: 13, outcome: "ko", winner: 0, events: 31, hash: "127fbf6f" },
    { j: 14, outcome: "ko", winner: 0, events: 49, hash: "8a676493" },
    { j: 15, outcome: "ko", winner: 1, events: 31, hash: "c1b661db" },
    { j: 16, outcome: "ko", winner: 0, events: 48, hash: "3bfd8cb4" },
    { j: 17, outcome: "ko", winner: 1, events: 31, hash: "ee10cc8f" },
    { j: 18, outcome: "ko", winner: 0, events: 31, hash: "4db67a1f" },
    { j: 19, outcome: "ko", winner: 1, events: 56, hash: "612aeb78" },
  ],
  warrior: [
    { j: 0, outcome: "ko", winner: 0, events: 48, hash: "058ba6df" },
    { j: 1, outcome: "ko", winner: 0, events: 48, hash: "0b62c658" },
    { j: 2, outcome: "ko", winner: 0, events: 55, hash: "83db33af" },
    { j: 3, outcome: "ko", winner: 1, events: 38, hash: "a15e737a" },
    { j: 4, outcome: "ko", winner: 0, events: 39, hash: "6eb4f9e0" },
    { j: 5, outcome: "ko", winner: 1, events: 38, hash: "af88e446" },
    { j: 6, outcome: "ko", winner: 1, events: 38, hash: "0d50a26a" },
    { j: 7, outcome: "ko", winner: 1, events: 31, hash: "a9984693" },
    { j: 8, outcome: "ko", winner: 0, events: 38, hash: "b0c615b4" },
    { j: 9, outcome: "ko", winner: 1, events: 22, hash: "b8960f4f" },
    { j: 10, outcome: "ko", winner: 0, events: 55, hash: "de03e177" },
    { j: 11, outcome: "ko", winner: 1, events: 31, hash: "72b8aac6" },
    { j: 12, outcome: "draw", winner: null, events: 55, hash: "895448cb" },
    { j: 13, outcome: "ko", winner: 1, events: 31, hash: "4ac80c1e" },
    { j: 14, outcome: "ko", winner: 0, events: 39, hash: "bbd03686" },
    { j: 15, outcome: "ko", winner: 1, events: 31, hash: "2cd89470" },
    { j: 16, outcome: "ko", winner: 0, events: 31, hash: "c5c3485a" },
    { j: 17, outcome: "ko", winner: 1, events: 22, hash: "76fa36e3" },
    { j: 18, outcome: "ko", winner: 0, events: 31, hash: "b2168a80" },
    { j: 19, outcome: "ko", winner: 1, events: 38, hash: "dc15f688" },
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
        if (j < 20)
          pins.push({
            j,
            outcome: result.outcome,
            winner: result.winner,
            events: result.events,
            hash: result.hash,
          });
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

      it("reproduces the first 20 per-duel (outcome, winner, events, hash) pins", () => {
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
