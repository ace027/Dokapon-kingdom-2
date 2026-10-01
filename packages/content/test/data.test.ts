import fs from "node:fs";
import { hybridsUnlocked, rulesHash, stableStringify } from "@usurpia/core";
import { afterEach, describe, expect, it } from "vitest";
import { loadRules } from "../src/node";
import { cleanupTemp, copyDataToTemp } from "./helpers";

const rules = loadRules();

describe("shipped content", () => {
  it("hashes to the pinned Revision 2 rules", () => {
    expect(rulesHash(rules)).toBe("84a995db");
    expect(rules.v).toBe(1);
  });

  it("ships the specified counts", () => {
    expect(Object.keys(rules.classes)).toHaveLength(6);
    expect(Object.values(rules.classes).filter((c) => c.kind === "base")).toHaveLength(4);
    expect(Object.values(rules.classes).filter((c) => c.kind === "hybrid")).toHaveLength(2);
    expect(Object.keys(rules.gear)).toHaveLength(15);
    const items = Object.values(rules.items);
    expect(items).toHaveLength(17);
    expect(items.filter((i) => i.kind === "consumable")).toHaveLength(12);
    expect(items.filter((i) => i.kind === "joke")).toHaveLength(5);
    expect(Object.keys(rules.battleSpells)).toHaveLength(8);
    expect(Object.keys(rules.wardSpells)).toHaveLength(4);
    expect(Object.keys(rules.fieldSpells)).toHaveLength(8);
    expect(Object.keys(rules.monsters)).toHaveLength(16);
    expect(Object.keys(rules.guardians)).toHaveLength(3);
    expect(rules.enforcer.id).toBe("crown-enforcer");
    expect(rules.npcCurve).toHaveLength(5);
  });

  it("keeps every record keyed by its entry id", () => {
    const records: Record<string, { id: string }>[] = [
      rules.classes,
      rules.gear,
      rules.items,
      rules.battleSpells,
      rules.wardSpells,
      rules.fieldSpells,
      rules.monsters,
      rules.guardians,
    ];
    for (const record of records) {
      for (const [key, value] of Object.entries(record)) expect(value.id).toBe(key);
    }
  });

  it("has exactly 4 monsters per zone and tier", () => {
    const zones: [string, number][] = [
      ["enchanted-forest", 1],
      ["soggy-coast", 2],
      ["goblin-mines", 3],
      ["bureaucrat-bog", 4],
    ];
    for (const [zone, tier] of zones) {
      const inZone = Object.values(rules.monsters).filter((m) => m.zone === zone);
      expect(inZone).toHaveLength(4);
      expect(inZone.every((m) => m.tier === tier)).toBe(true);
    }
  });

  it("ships the two hybrids with their parents and no starter", () => {
    expect(rules.classes.spellblade?.parents).toEqual(["warrior", "mage"]);
    expect(rules.classes.shadowpriest?.parents).toEqual(["thief", "cleric"]);
    expect(rules.classes.spellblade?.starter).toBeNull();
    expect(rules.classes.shadowpriest?.starter).toBeNull();
    for (const id of ["warrior", "thief", "mage", "cleric"]) {
      expect(rules.classes[id]?.parents).toBeNull();
      expect(rules.classes[id]?.starter).not.toBeNull();
    }
  });

  it("unlocks the shipped hybrids at mastery rank 3 (7 wins) in both parents", () => {
    expect(rules.progression.hybridUnlockRank).toBe(3);
    expect(rules.progression.masteryWins).toEqual([0, 3, 7, 12, 18]);
    expect(hybridsUnlocked(rules, { warrior: 7, mage: 7 })).toEqual(["spellblade"]);
    expect(hybridsUnlocked(rules, { warrior: 6, mage: 7 })).toEqual([]);
    expect(hybridsUnlocked(rules, { warrior: 7, mage: 6 })).toEqual([]);
    expect(hybridsUnlocked(rules, { thief: 7, cleric: 7 })).toEqual(["shadowpriest"]);
    expect(hybridsUnlocked(rules, { thief: 6, cleric: 7 })).toEqual([]);
    expect(hybridsUnlocked(rules, { thief: 7, cleric: 6 })).toEqual([]);
    expect(hybridsUnlocked(rules, { warrior: 7, mage: 7, thief: 7, cleric: 7 })).toEqual([
      "shadowpriest",
      "spellblade",
    ]);
  });

  it("pins every class passive (R5) in rank order", () => {
    const expected: Record<string, [string, string, number][]> = {
      warrior: [
        ["brawler", "strikeDmgBp", 1000],
        ["thick-skin", "hpBp", 1000],
        ["shield-wall", "defBp", 1000],
        ["battle-rhythm", "attackDmgBp", 1000],
        ["unbreakable", "guardVsStrikeBp", 5000],
      ],
      thief: [
        ["sticky-fingers", "pvpExtraSteal", 1],
        ["quick-feet", "fleeBp", 2000],
        ["lucky-break", "critBp", 500],
        ["fleet", "spdBp", 1000],
        ["pickpocket", "passPickpocketBp", 500],
      ],
      mage: [
        ["frugal-caster", "spellPriceBp", -2500],
        ["focus", "spellDmgBp", 1000],
        ["arcane-mind", "magBp", 1000],
        ["overcharge", "spellDmgBp", 1500],
        ["fieldcraft", "fieldSpellMove", 1],
      ],
      cleric: [
        ["mending", "turnRegenBp", 1000],
        ["sanctuary", "roundRegenBp", 500],
        ["faith", "defBp", 1000],
        ["devotion", "magBp", 1000],
        ["mirror-ward", "wardReflectBp", 5000],
      ],
      spellblade: [
        ["runic-edge", "spellbladeStrike", 5000],
        ["arcane-muscle", "magBp", 1000],
        ["honed-edge", "strikeDmgBp", 1000],
        ["keen-eye", "critBp", 500],
        ["twin-arts", "spellDmgBp", 1500],
      ],
      shadowpriest: [
        ["leech", "lifestealBp", 2500],
        ["shade-step", "spdBp", 1000],
        ["dark-litany", "roundRegenBp", 500],
        ["cruel-luck", "critBp", 500],
        ["soul-tithe", "lifestealBp", 2500],
      ],
    };
    for (const [classId, passives] of Object.entries(expected)) {
      const actual = rules.classes[classId]?.passives.map((p) => [p.id, p.hook, p.value]);
      expect(actual, classId).toEqual(passives);
      expect(rules.classes[classId]?.passives.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("pins every class's bagSize, switchFee, statBp and aiBias", () => {
    const summary = Object.fromEntries(
      Object.values(rules.classes).map((c) => [
        c.id,
        [c.bagSize, c.switchFee, Object.values(c.statBp), Object.values(c.aiBias)],
      ]),
    );
    // statBp keys are hp/atk/def/mag/spd/luck; aiBias keys are attack/strike/spell/guard/counter/ward.
    expect(summary).toEqual({
      warrior: [5, 100, [11500, 11500, 11500, 8500, 9000, 9000], [30, 50, 20, 50, 30, 20]],
      thief: [8, 100, [9500, 10000, 9000, 8000, 13000, 14000], [50, 30, 20, 35, 40, 25]],
      mage: [6, 100, [8500, 7500, 8500, 13000, 10000, 10000], [30, 20, 50, 40, 30, 30]],
      cleric: [6, 100, [10500, 9500, 11000, 12000, 9000, 10000], [35, 20, 45, 35, 25, 40]],
      spellblade: [6, 300, [11000, 11500, 10000, 11500, 9500, 9000], [30, 45, 25, 40, 35, 25]],
      shadowpriest: [7, 300, [10000, 10000, 9500, 11000, 12000, 12000], [45, 30, 25, 35, 35, 30]],
    });
  });

  it("pins the starter loadouts", () => {
    expect(rules.classes.warrior?.starter).toEqual({
      weapon: "wooden-sword",
      shield: "pot-lid",
      accessory: null,
      battleSpell: "spark",
      wardSpell: null,
      bag: ["herb"],
    });
    expect(rules.classes.thief?.starter?.bag).toEqual(["herb", "smoke-bomb"]);
    expect(rules.classes.thief?.starter?.accessory).toBe("lucky-sock");
    expect(rules.classes.mage?.starter).toMatchObject({
      battleSpell: "fireball",
      wardSpell: "barrier",
    });
    expect(rules.classes.cleric?.starter).toMatchObject({
      battleSpell: "drain",
      wardSpell: "barrier",
    });
    expect(rules.classes.cleric?.starter?.bag).toEqual(["herb", "antidote"]);
  });

  it("gives the Ogre a combat-time hook, and guardians and the enforcer no hooks", () => {
    expect(rules.monsters["ogre-middle-manager"]?.hooks).toEqual([
      { hook: "attackDmgBp", value: 1000 },
    ]);
    for (const guardian of Object.values(rules.guardians)) expect(guardian.hooks).toEqual([]);
    expect(rules.enforcer.hooks).toEqual([]);
    expect(
      Object.values(rules.guardians)
        .map((g) => g.style)
        .sort(),
    ).toEqual(["balanced", "magic", "physical"]);
  });

  it("has no style key on the enforcer", () => {
    expect("style" in rules.enforcer).toBe(false);
  });

  it("carries Revision 2 tuning", () => {
    expect(rules.combat.kBp).toBe(14500);
    expect(rules.combat.jMagBp).toBe(3500);
    expect(rules.progression.growth.hp).toBe(9);
    expect(rules.progression.maxLevel).toBe(20);
    expect(rules.progression.xpCurve).toHaveLength(20);
    expect(rules.progression.masteryWins).toEqual([0, 3, 7, 12, 18]);
  });

  it("strips display text everywhere", () => {
    const text = stableStringify(rules);
    for (const key of ['"name":', '"description":', '"tagline":']) {
      expect(text).not.toContain(key);
    }
  });
});

describe("loadRules", () => {
  let dir: string | undefined;
  afterEach(() => {
    cleanupTemp(dir);
    dir = undefined;
  });

  it("loads from an explicit dir (same hash as the default)", () => {
    dir = copyDataToTemp();
    expect(rulesHash(loadRules(dir))).toBe("84a995db");
  });

  it("throws content invalid: 1 errors for one corrupted file", () => {
    dir = copyDataToTemp({
      file: "items.json",
      mutate: (root) => {
        root.v = 2;
      },
    });
    expect(() => loadRules(dir)).toThrow("content invalid: 1 errors");
  });

  it("throws for a missing dir", () => {
    dir = copyDataToTemp();
    fs.rmSync(dir, { recursive: true });
    expect(() => loadRules(dir)).toThrow("content dir not found");
  });
});
