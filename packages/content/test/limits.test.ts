// Range and ceiling rules the engine relies on (review finding S1). Every row mutates exactly one
// field to one value just outside its range and expects exactly one error: no other check can
// reject the fixture (PIT-001), and deleting the rule makes that row (and only that row) fail.
import { describe, expect, it } from "vitest";
import { buildRules } from "../src/index";
import type { ContentEntry, ContentError } from "../src/index";
import { loadEntries, setPath } from "./helpers";

const base = loadEntries();
const MAX_BP = 100_000;

function errorsOf(entries: readonly ContentEntry[]): ContentError[] {
  const result = buildRules(entries);
  if (result.ok) throw new Error("expected content errors, got ok");
  return result.errors;
}

const small = (min: number) => `Too small: expected number to be >=${String(min)}`;
const big = (max: number) => `Too big: expected number to be <=${String(max)}`;

interface RangeRow {
  readonly file: string;
  /** Path of the value; `at(n)` rows are shared by below/above. */
  readonly path: string;
  readonly min: number;
  readonly max: number;
}

/** Rejected one below `min` and one above `max`, each with exactly one error at `path`. */
function rangeRows(rows: readonly RangeRow[]): void {
  const cases = rows.flatMap((r) => [
    [r.path, "below", r.file, r.path, r.min - 1, small(r.min)] as const,
    [r.path, "above", r.file, r.path, r.max + 1, big(r.max)] as const,
  ]);
  it.each(cases)("%s %s range", (_label, _side, file, path, value, message) => {
    expect(errorsOf(setPath(base, file, path, value))).toEqual([{ file, path, message }]);
  });
}

describe("heal / drain / steal-gold bp are fractions (0..10000)", () => {
  rangeRows([
    { file: "items.json", path: "items.0.effect.bp", min: 0, max: 10_000 },
    { file: "spells.json", path: "battle.4.effect.bp", min: 0, max: 10_000 },
    { file: "spells.json", path: "battle.6.effect.bp", min: 0, max: 10_000 },
  ]);

  it("targets the effects the rows claim (herb heal, drain, pickpocket bolt)", () => {
    const items = base.find((e) => e.file === "items.json")?.data as {
      items: { effect: { kind: string } }[];
    };
    const spells = base.find((e) => e.file === "spells.json")?.data as {
      battle: { effect: { kind: string } }[];
    };
    expect(items.items[0]?.effect.kind).toBe("heal");
    expect(spells.battle[4]?.effect.kind).toBe("drain");
    expect(spells.battle[6]?.effect.kind).toBe("stealGold");
  });
});

describe("ward spell valueBp", () => {
  rangeRows([
    { file: "spells.json", path: "ward.0.valueBp", min: 0, max: MAX_BP },
    { file: "spells.json", path: "ward.3.valueBp", min: 0, max: MAX_BP },
  ]);

  it("a reflect ward reflects at most 100% (10001 is rejected)", () => {
    expect(errorsOf(setPath(base, "spells.json", "ward.1.valueBp", 10_001))).toEqual([
      {
        file: "spells.json",
        path: "ward.1.valueBp",
        message: "reflect valueBp must be at most 10000",
      },
    ]);
  });

  it("a counterspell multiplier above 100% stays valid (ships at 12500)", () => {
    expect(buildRules(setPath(base, "spells.json", "ward.3.valueBp", 20_000)).ok).toBe(true);
  });
});

describe("combat tuning ranges", () => {
  const T = "tuning.json";
  const multipliers = [
    "kBp",
    "jBp",
    "jMagBp",
    "critMultBp",
    "seniorRewardBp",
    ...(["attack", "strike", "spell"] as const).flatMap((row) =>
      (["guard", "counter", "ward", "open"] as const).map((cell) => `matrix.${row}.${cell}`),
    ),
  ];
  rangeRows(multipliers.map((p) => ({ file: T, path: `combat.${p}`, min: 0, max: MAX_BP })));
  rangeRows(
    [
      "critBaseBp",
      "critPerLuckBp",
      "critCapBp",
      "fleeBaseBp",
      "fleeMinBp",
      "fleeMaxBp",
      "poisonBp",
    ].map((p) => ({ file: T, path: `combat.${p}`, min: 0, max: 10_000 })),
  );
  rangeRows([
    { file: T, path: "combat.fleePerSpdBp", min: -10_000, max: 10_000 },
    { file: T, path: "combat.modMinBp", min: -10_000, max: 0 },
    { file: T, path: "combat.modMaxBp", min: 0, max: MAX_BP },
  ]);

  it("covers every shipped matrix cell (12) and the shipped values stay valid", () => {
    expect(multipliers.filter((p) => p.startsWith("matrix."))).toHaveLength(12);
    expect(buildRules(base).ok).toBe(true);
  });

  it("rejects fleeMinBp above fleeMaxBp (both in range, so only the cross-field rule fires)", () => {
    expect(errorsOf(setPath(base, T, "combat.fleeMinBp", 9500))).toEqual([
      { file: T, path: "combat.fleeMinBp", message: "fleeMinBp must be at most fleeMaxBp" },
    ]);
  });

  it("accepts fleeMinBp equal to fleeMaxBp", () => {
    expect(buildRules(setPath(base, T, "combat.fleeMinBp", 9000)).ok).toBe(true);
  });
});

/** Independent pin of the allowed range per hook (engine semantics in schemas/common.ts). */
const HOOKS: Record<string, readonly [number, number]> = {
  hpBp: [-10_000, MAX_BP],
  atkBp: [-10_000, MAX_BP],
  defBp: [-10_000, MAX_BP],
  magBp: [-10_000, MAX_BP],
  spdBp: [-10_000, MAX_BP],
  luckBp: [-10_000, MAX_BP],
  attackDmgBp: [-10_000, MAX_BP],
  strikeDmgBp: [-10_000, MAX_BP],
  spellDmgBp: [-10_000, MAX_BP],
  guardVsStrikeBp: [0, 10_000],
  counterDmgBp: [-10_000, MAX_BP],
  wardReflectBp: [0, 10_000],
  critBp: [-10_000, 10_000],
  fleeBp: [-10_000, 10_000],
  lifestealBp: [0, 10_000],
  roundRegenBp: [0, 10_000],
  spellTakenBp: [-10_000, MAX_BP],
  physTakenBp: [-10_000, MAX_BP],
  spellbladeStrike: [0, MAX_BP],
  poisonOnHit: [0, 1],
  stealGoldOnHitBp: [0, 10_000],
  stealItemOnHit: [0, 1],
  pvpExtraSteal: [0, MAX_BP],
  passPickpocketBp: [0, 10_000],
  spellPriceBp: [-10_000, 10_000],
  fieldSpellMove: [0, MAX_BP],
  turnRegenBp: [0, 10_000],
  townTaxBp: [0, 10_000],
  crownTaxResistBp: [0, 10_000],
  lootLuckBp: [-10_000, MAX_BP],
};

describe("hook values are bounded per hook name", () => {
  const rows = Object.entries(HOOKS).flatMap(([hook, [min, max]]) => [
    [hook, "below", min - 1, min, max] as const,
    [hook, "above", max + 1, min, max] as const,
  ]);
  const hooksPath = "gear.0.hooks";
  const valuePath = `${hooksPath}.0.value`;

  it("pins all 30 hook names", () => {
    expect(Object.keys(HOOKS)).toHaveLength(30);
  });

  it.each(rows)("%s %s", (hook, _side, value, min, max) => {
    const entries = setPath(base, "gear.json", hooksPath, [{ hook, value }]);
    expect(errorsOf(entries)).toEqual([
      {
        file: "gear.json",
        path: valuePath,
        message: `${hook} value must be between ${String(min)} and ${String(max)}`,
      },
    ]);
  });

  it.each(
    Object.entries(HOOKS).flatMap(
      ([h, [min, max]]) =>
        [
          [h, min],
          [h, max],
        ] as const,
    ),
  )("%s accepts the boundary value %d", (hook, value) => {
    const result = buildRules(setPath(base, "gear.json", hooksPath, [{ hook, value }]));
    const own = result.ok ? [] : result.errors.filter((e) => e.path === valuePath);
    expect(own).toEqual([]);
  });

  it("applies to class passives (spread shape) and NPC hooks too", () => {
    const passive = errorsOf(
      setPath(base, "classes.json", "classes.0.passives.0", {
        hook: "lifestealBp",
        value: 10_001,
        rank: 1,
        id: "brawler",
        name: "Brawler",
        description: "x",
      }),
    );
    expect(passive).toEqual([
      {
        file: "classes.json",
        path: "classes.0.passives.0.value",
        message: "lifestealBp value must be between 0 and 10000",
      },
    ]);
    expect(
      errorsOf(
        setPath(base, "monsters.json", "monsters.0.hooks", [
          { hook: "lifestealBp", value: 10_001 },
        ]),
      ),
    ).toEqual([
      {
        file: "monsters.json",
        path: "monsters.0.hooks.0.value",
        message: "lifestealBp value must be between 0 and 10000",
      },
    ]);
  });
});

describe("worst-case stat ceilings (MAX_STAT = 99999)", () => {
  it("rejects a class whose level-max stat with all passives and best gear can exceed it", () => {
    // Only warrior (hp 11500 bp, passives and gear hp hooks) tips over at baseStats.hp 80000.
    expect(errorsOf(setPath(base, "tuning.json", "progression.baseStats.hp", 80_000))).toEqual([
      {
        file: "classes.json",
        path: "classes.0.statBp.hp",
        message: "class sheet stat can exceed MAX_STAT in the worst case (101426 > 99999)",
      },
    ]);
  });

  it("rejects a monster whose statBp times its highest curve tier exceeds it", () => {
    expect(errorsOf(setPath(base, "monsters.json", "curve.0.hp", 99_999))).toEqual([
      {
        file: "monsters.json",
        path: "monsters.3.statBp.hp",
        message: "monster stat can exceed MAX_STAT in the worst case (139998 > 99999)",
      },
    ]);
  });

  it("rejects a guardian whose statBp times a curve tier 2..5 row exceeds it", () => {
    expect(errorsOf(setPath(base, "monsters.json", "curve.2.hp", 80_000))).toEqual([
      {
        file: "monsters.json",
        path: "guardians.1.statBp.hp",
        message: "guardian stat can exceed MAX_STAT in the worst case (104000 > 99999)",
      },
    ]);
  });

  it("rejects an enforcer whose baseStats + growth * (maxLevel - 1) exceeds it", () => {
    // 40 + 5262 * 19 = 100018. Classes with 10000+ bp hp fail too; the enforcer error is its own.
    const errors = errorsOf(setPath(base, "tuning.json", "progression.growth.hp", 5262));
    expect(errors).toContainEqual({
      file: "monsters.json",
      path: "enforcer",
      message:
        "enforcer hp (baseStats + growth * (maxLevel - 1)) can exceed MAX_STAT in the worst case (100018 > 99999)",
    });
  });

  it("accepts the shipped content (nothing near the ceiling)", () => {
    expect(buildRules(base).ok).toBe(true);
  });
});
