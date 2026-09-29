// Content NPC spot stats (spec: Content NPC spot stats), content rules. Pins the Ogre fix: its
// hook is combat-time and does not change these sheet numbers.
import { loadRules } from "@usurpia/content/node";
import { npcStats, type NpcRef, type StatBlock } from "@usurpia/core";
import { describe, expect, it } from "vitest";

const rules = loadRules();
const block = (
  hp: number,
  atk: number,
  def: number,
  mag: number,
  spd: number,
  luck: number,
): StatBlock => ({
  hp,
  atk,
  def,
  mag,
  spd,
  luck,
});

const ROWS: [string, NpcRef, StatBlock][] = [
  [
    "monster ogre-middle-manager (T4)",
    { kind: "monster", id: "ogre-middle-manager", senior: false },
    block(218, 63, 33, 42, 17, 9),
  ],
  [
    "senior slime-intern (T2 curve)",
    { kind: "monster", id: "slime-intern", senior: true },
    block(76, 24, 12, 17, 10, 4),
  ],
  [
    "guardian landlord-lich, townTier 1 (T2 curve)",
    { kind: "guardian", id: "landlord-lich", townTier: 1 },
    block(104, 24, 15, 27, 13, 6),
  ],
  ["enforcer level 10", { kind: "enforcer", level: 10 }, block(108, 49, 28, 31, 19, 14)],
];

describe("content NPC spot stats", () => {
  for (const [name, ref, expected] of ROWS) {
    it(name, () => {
      expect(npcStats(rules, ref)).toEqual(expected);
    });
  }
});
