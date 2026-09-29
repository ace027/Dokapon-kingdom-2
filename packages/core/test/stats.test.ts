import { describe, expect, it } from "vitest";
import { applyPassives } from "../src/combat/passives";
import { activeHooks, adjustHp, battleStats, npcStats, sheetStats } from "../src/combat/stats";
import { BOARD_HOOKS, COMBAT_HOOKS, type Hook, type StatBlock } from "../src/rules";
import type { BattleMods, CharacterPublic } from "../src/types";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const block = ([hp, atk, def, mag, spd, luck]: readonly number[]): StatBlock => ({
  hp: hp ?? NaN,
  atk: atk ?? NaN,
  def: def ?? NaN,
  mag: mag ?? NaN,
  spd: spd ?? NaN,
  luck: luck ?? NaN,
});

interface Row {
  classId: string;
  level: number;
  weapon: string | null;
  shield: string | null;
  accessory: string | null;
  wins?: Record<string, number>;
  portable?: string | null;
}

function character(row: Row): CharacterPublic {
  return {
    classId: row.classId,
    level: row.level,
    xp: 0,
    hp: 1,
    gold: 0,
    mastery: { battlemage: 0, caster: 0, fighter: 0, ...row.wins },
    portable: row.portable ?? null,
    weapon: row.weapon,
    shield: row.shield,
    accessory: row.accessory,
    battleSpell: null,
    wardSpell: null,
  };
}

const NO_MODS: BattleMods = { atk: 0, def: 0, mag: 0, spd: 0, poison: false, stun: false };

describe("sheetStats goldens (hp/atk/def/mag/spd/luck)", () => {
  it("fighter L1, stick/lid/-", () => {
    const ch = character({
      classId: "fighter",
      level: 1,
      weapon: "stick",
      shield: "lid",
      accessory: null,
    });
    expect(sheetStats(TEST_RULES, ch)).toEqual({
      hp: 48,
      atk: 18,
      def: 12,
      mag: 9,
      spd: 10,
      luck: 5,
    });
  });

  it("caster L1, stick/lid/charm", () => {
    const ch = character({
      classId: "caster",
      level: 1,
      weapon: "stick",
      shield: "lid",
      accessory: "charm",
    });
    expect(sheetStats(TEST_RULES, ch)).toEqual({
      hp: 36,
      atk: 13,
      def: 11,
      mag: 15,
      spd: 10,
      luck: 9,
    });
  });

  it("battlemage L1, stick/mirror/band", () => {
    const ch = character({
      classId: "battlemage",
      level: 1,
      weapon: "stick",
      shield: "mirror",
      accessory: "band",
    });
    expect(sheetStats(TEST_RULES, ch)).toEqual({
      hp: 44,
      atk: 17,
      def: 14,
      mag: 13,
      spd: 13,
      luck: 5,
    });
  });

  it("fighter L5, sword/lid/-, fighter wins 3 (rank 2)", () => {
    const ch = character({
      classId: "fighter",
      level: 5,
      weapon: "sword",
      shield: "lid",
      accessory: null,
      wins: { fighter: 3 },
    });
    expect(sheetStats(TEST_RULES, ch)).toEqual({
      hp: 94,
      atk: 37,
      def: 20,
      mag: 19,
      spd: 14,
      luck: 9,
    });
    expect([94, 37, 20, 19, 14, 9]).toEqual(Object.values(sheetStats(TEST_RULES, ch)));
  });

  it("caster L3 with portable fighter rank-5 passive", () => {
    const ch = character({
      classId: "caster",
      level: 3,
      weapon: "stick",
      shield: "lid",
      accessory: null,
      wins: { caster: 7, fighter: 18 },
      portable: "fighter",
    });
    expect(sheetStats(TEST_RULES, ch)).toEqual({
      hp: 50,
      atk: 18,
      def: 14,
      mag: 25,
      spd: 12,
      luck: 7,
    });
  });

  it("battlemage L4, sword/lid/-, battlemage wins 7 (rank 3 atkBp)", () => {
    const ch = character({
      classId: "battlemage",
      level: 4,
      weapon: "sword",
      shield: "lid",
      accessory: null,
      wins: { battlemage: 7 },
    });
    expect(sheetStats(TEST_RULES, ch)).toEqual({
      hp: 70,
      atk: 34,
      def: 18,
      mag: 23,
      spd: 13,
      luck: 8,
    });
  });

  it("throws for an unknown class, including prototype members (own keys only)", () => {
    for (const classId of ["wizard", "toString", "constructor"]) {
      const ch = character({ classId, level: 1, weapon: null, shield: null, accessory: null });
      expect(() => sheetStats(TEST_RULES, ch)).toThrow(`unknown class ${classId}`);
    }
  });
});

describe("npcStats goldens", () => {
  it("monster slime", () => {
    expect(npcStats(TEST_RULES, { kind: "monster", id: "slime", senior: false })).toEqual(
      block([40, 12, 8, 10, 9, 4]),
    );
  });

  it("monster crab, senior (T3 curve)", () => {
    expect(npcStats(TEST_RULES, { kind: "monster", id: "crab", senior: true })).toEqual(
      block([120, 36, 26, 20, 12, 8]),
    );
  });

  it("monster gull", () => {
    expect(npcStats(TEST_RULES, { kind: "monster", id: "gull", senior: false })).toEqual(
      block([36, 12, 7, 8, 10, 4]),
    );
  });

  it("guardian lich, townTier 2 (T3 curve)", () => {
    expect(npcStats(TEST_RULES, { kind: "guardian", id: "lich", townTier: 2 })).toEqual(
      block([144, 32, 22, 31, 15, 8]),
    );
  });

  it("enforcer level 5", () => {
    expect(npcStats(TEST_RULES, { kind: "enforcer", level: 5 })).toEqual(
      block([72, 31, 18, 19, 14, 9]),
    );
  });

  it("throws for prototype-member monster ids", () => {
    expect(() => npcStats(TEST_RULES, { kind: "monster", id: "toString", senior: false })).toThrow(
      "unknown monster toString",
    );
  });
});

describe("applyPassives", () => {
  it("gives all zeros with exactly the COMBAT_HOOKS keys for no hooks", () => {
    const totals = applyPassives([]);
    expect(Object.keys(totals)).toEqual([...COMBAT_HOOKS]);
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
  });

  it("sums duplicates", () => {
    const hooks: Hook[] = [
      { hook: "critBp", value: 100 },
      { hook: "critBp", value: 250 },
      { hook: "physTakenBp", value: -1000 },
    ];
    const totals = applyPassives(hooks);
    expect(totals.critBp).toBe(350);
    expect(totals.physTakenBp).toBe(-1000);
  });

  it("ignores every board hook", () => {
    expect(BOARD_HOOKS).toHaveLength(8);
    const hooks: Hook[] = BOARD_HOOKS.map((hook) => ({ hook, value: 777 }));
    const totals = applyPassives(hooks);
    expect(Object.keys(totals)).toEqual([...COMBAT_HOOKS]);
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
  });
});

describe("activeHooks", () => {
  it("orders class passives by rank, then the portable rank-5, then gear hooks", () => {
    const ch = character({
      classId: "battlemage",
      level: 1,
      weapon: "sword",
      shield: "mirror",
      accessory: "band",
      wins: { battlemage: 7 },
      portable: "fighter",
    });
    expect(activeHooks(TEST_RULES, ch).map((h) => h.hook)).toEqual([
      "spellbladeStrike",
      "lifestealBp",
      "atkBp",
      "critBp",
      "spellTakenBp",
      "townTaxBp",
    ]);
  });

  it("only includes passives up to the current rank", () => {
    const ch = character({
      classId: "fighter",
      level: 1,
      weapon: null,
      shield: null,
      accessory: null,
    });
    expect(activeHooks(TEST_RULES, ch).map((h) => h.hook)).toEqual(["strikeDmgBp"]);
  });

  it("ignores the portable passive when it is the current class", () => {
    const base = {
      classId: "fighter",
      level: 1,
      weapon: null,
      shield: null,
      accessory: null,
      wins: { fighter: 18 },
    };
    const own = activeHooks(TEST_RULES, character({ ...base, portable: "fighter" }));
    expect(own).toEqual(activeHooks(TEST_RULES, character(base)));
    expect(own).toHaveLength(5);
  });
});

describe("battleStats", () => {
  const stats = block([50, 19, 10, 10, 10, 6]);

  it("floors and keeps hp/luck unchanged", () => {
    expect(battleStats(stats, { ...NO_MODS, atk: -5000 })).toEqual({ ...stats, atk: 9 });
  });

  it("floors at zero", () => {
    expect(battleStats(stats, { ...NO_MODS, def: -20000 }).def).toBe(0);
  });

  it("applies each of atk/def/mag/spd", () => {
    expect(battleStats(stats, { ...NO_MODS, atk: 2500, def: 5000, mag: -5000, spd: 1000 })).toEqual(
      {
        ...stats,
        atk: 23,
        def: 15,
        mag: 5,
        spd: 11,
      },
    );
  });
});

describe("adjustHp", () => {
  it("keeps hp when the max grows by less than the gap", () => {
    expect(adjustHp(50, 60, 40)).toBe(50);
  });

  it("clamps to the new max when it shrinks", () => {
    expect(adjustHp(60, 50, 55)).toBe(50);
  });

  it("keeps a KO at zero", () => {
    expect(adjustHp(50, 60, 0)).toBe(0);
  });
});
