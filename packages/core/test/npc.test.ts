// NPC command draws (weighted, seeded) and tier curves (R8). Table boundaries are derived from the
// TEST_RULES tables; stat goldens come from the spec's stats table.
import { describe, expect, it } from "vitest";
import { drawNpcCommand, drawNpcDefense } from "../src/combat/resolve";
import { npcStats } from "../src/combat/stats";
import { nextInt, seedRng, type RngState } from "../src/rng";
import type { StatBlock } from "../src/rules";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

function constantDraw(u: number) {
  const calls: [number, number][] = [];
  return {
    calls,
    draw: (min: number, max: number) => {
      calls.push([min, max]);
      return u;
    },
  };
}

const slime = TEST_RULES.monsters.slime;
const gull = TEST_RULES.monsters.gull;
if (slime === undefined || gull === undefined) throw new Error("fixture monsters missing");
const GULL_TABLE = gull.attackTable;
const T2_CURVE = TEST_RULES.npcCurve[1];
if (T2_CURVE === undefined) throw new Error("fixture npcCurve missing");

describe("drawNpcCommand", () => {
  it("maps slime AT(60,20,20,0): 1-60 attack, 61-80 strike, 81-100 spell, never flee", () => {
    const cases: [number, string][] = [
      [1, "attack"],
      [60, "attack"],
      [61, "strike"],
      [80, "strike"],
      [81, "spell"],
      [100, "spell"],
    ];
    for (const [u, expected] of cases) {
      const { draw, calls } = constantDraw(u);
      expect(drawNpcCommand(slime.attackTable, draw)).toBe(expected);
      expect(calls).toEqual([[1, 100]]);
    }
  });

  it("maps gull AT(50,20,0,30): 1-50 attack, 51-70 strike, 71-100 flee, never spell", () => {
    const cases: [number, string][] = [
      [1, "attack"],
      [50, "attack"],
      [51, "strike"],
      [70, "strike"],
      [71, "flee"],
      [100, "flee"],
    ];
    for (const [u, expected] of cases) {
      expect(drawNpcCommand(gull.attackTable, constantDraw(u).draw)).toBe(expected);
    }
  });
});

describe("drawNpcDefense", () => {
  it("maps slime DT(40,30,30) at the boundaries", () => {
    const cases: [number, string][] = [
      [1, "guard"],
      [40, "guard"],
      [41, "counter"],
      [70, "counter"],
      [71, "ward"],
      [100, "ward"],
    ];
    for (const [u, expected] of cases) {
      const { draw, calls } = constantDraw(u);
      expect(drawNpcDefense(slime.defendTable, draw)).toBe(expected);
      expect(calls).toEqual([[1, 100]]);
    }
  });

  it("maps gull DT(30,30,40) at the boundaries", () => {
    const cases: [number, string][] = [
      [30, "guard"],
      [31, "counter"],
      [60, "counter"],
      [61, "ward"],
    ];
    for (const [u, expected] of cases) {
      expect(drawNpcDefense(gull.defendTable, constantDraw(u).draw)).toBe(expected);
    }
  });
});

const block = (b: StatBlock) => [b.hp, b.atk, b.def, b.mag, b.spd, b.luck];

describe("tier curves", () => {
  it("monster uses npcCurve[tier - 1]; its senior uses npcCurve[tier]", () => {
    expect(block(npcStats(TEST_RULES, { kind: "monster", id: "slime", senior: false }))).toEqual([
      40, 12, 8, 10, 9, 4,
    ]);
    // slime is tier 1 with all-10000 statBp, so its senior is exactly npcCurve[1]
    expect(block(npcStats(TEST_RULES, { kind: "monster", id: "slime", senior: true }))).toEqual(
      block(T2_CURVE),
    );
    expect(block(npcStats(TEST_RULES, { kind: "monster", id: "slime", senior: true }))).toEqual([
      80, 24, 15, 18, 12, 6,
    ]);
    expect(block(npcStats(TEST_RULES, { kind: "monster", id: "gull", senior: false }))).toEqual([
      36, 12, 7, 8, 10, 4,
    ]);
    // spec stats golden: crab (tier 2) senior uses the T3 curve
    expect(block(npcStats(TEST_RULES, { kind: "monster", id: "crab", senior: true }))).toEqual([
      120, 36, 26, 20, 12, 8,
    ]);
  });

  it("guardian uses npcCurve[townTier] (town tier 1 = T2)", () => {
    expect(block(npcStats(TEST_RULES, { kind: "guardian", id: "lich", townTier: 2 }))).toEqual([
      144, 32, 22, 31, 15, 8,
    ]);
    expect(block(npcStats(TEST_RULES, { kind: "guardian", id: "lich", townTier: 1 }))).toEqual([
      96, 21, 15, 21, 12, 6,
    ]);
  });

  it("enforcer uses base + growth x (level - 1)", () => {
    expect(block(npcStats(TEST_RULES, { kind: "enforcer", level: 5 }))).toEqual([
      72, 31, 18, 19, 14, 9,
    ]);
    expect(block(npcStats(TEST_RULES, { kind: "enforcer", level: 1 }))).toEqual([
      40, 16, 10, 9, 10, 5,
    ]);
  });
});

describe("seeded draws", () => {
  function sequence(seed: string, count: number): string[] {
    let rng: RngState = seedRng(seed);
    const draw = (min: number, max: number): number => {
      const [value, next] = nextInt(rng, min, max);
      rng = next;
      return value;
    };
    return Array.from({ length: count }, () => drawNpcCommand(GULL_TABLE, draw));
  }

  it("two identical seeded threads give identical command sequences", () => {
    expect(sequence("npc", 40)).toEqual(sequence("npc", 40));
  });

  it("draws only commands with a non-zero weight and eventually all of them", () => {
    const seen = new Set(sequence("npc", 200));
    expect([...seen].sort()).toEqual(["attack", "flee", "strike"]);
  });
});
