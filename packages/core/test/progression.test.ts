// Progression (spec: Progression, Mastery ranks): mastery ranks and passives, the portable rank-5
// passive, hybrid unlocks, applyXp, victoryReward and awardVictory (pure), plus the
// loadout/setPortable handler (single-mutation negatives, exact code + message, PIT-001).
import { describe, expect, it } from "vitest";
import { activeHooks, adjustHp, npcStats, sheetStats } from "../src/combat/stats";
import { ZERO_MODS } from "../src/combat/resolve";
import { reduce } from "../src/reducer";
import { levelForXp, masteryRank, type Rules } from "../src/rules";
import { deserialize, serialize } from "../src/serialize";
import { MAX_COUNTER, type CharacterPublic, type CombatSide, type GameState } from "../src/types";
import { applyXp, awardVictory, hybridsUnlocked, victoryReward } from "../src/progression";
import { craft, deepFreeze, make, need, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const p1 = need(newGame().public.characters.p1);
const p2 = need(newGame().public.characters.p2);
const wins = (fighter: number, caster: number, battlemage = 0) => ({
  battlemage,
  caster,
  fighter,
});
const ch = (over: Partial<CharacterPublic> = {}): CharacterPublic => ({ ...p1, ...over });

function fails(state: GameState, action: unknown, message: string, rules: Rules = TEST_RULES) {
  deepFreeze(state);
  expect(reduce(state, action, rules)).toEqual({
    ok: false,
    error: { code: "INVALID_PAYLOAD", message },
  });
}

describe("mastery ranks", () => {
  it.each([
    [0, 1],
    [2, 1],
    [3, 2],
    [6, 2],
    [7, 3],
    [11, 3],
    [12, 4],
    [17, 4],
    [18, 5],
  ] as const)("%i wins is rank %i", (w, rank) => {
    expect(masteryRank(TEST_RULES, w)).toBe(rank);
  });

  it("keeps the passives of ranks <= the current rank active", () => {
    const hooks = (fighterWins: number) =>
      activeHooks(TEST_RULES, ch({ mastery: wins(fighterWins, 0) })).map((h) => h.hook);
    expect(hooks(2)).toEqual(["strikeDmgBp"]);
    expect(hooks(3)).toEqual(["strikeDmgBp", "hpBp"]);
    expect(hooks(7)).toEqual(["strikeDmgBp", "hpBp", "guardVsStrikeBp"]);
    expect(hooks(12)).toEqual(["strikeDmgBp", "hpBp", "guardVsStrikeBp", "counterDmgBp"]);
    expect(hooks(18)).toEqual(["strikeDmgBp", "hpBp", "guardVsStrikeBp", "counterDmgBp", "critBp"]);
  });

  it("changes the sheet stats at the rank threshold (fighter L1: rank 2 adds hpBp)", () => {
    expect(sheetStats(TEST_RULES, ch({ mastery: wins(2, 0) })).hp).toBe(48);
    expect(sheetStats(TEST_RULES, ch({ mastery: wins(3, 0) })).hp).toBe(52);
  });
});

describe("portable rank-5 passive", () => {
  const caster = (portable: string | null): CharacterPublic => ({
    ...p2,
    level: 3,
    xp: 150,
    mastery: wins(18, 7),
    portable,
    accessory: null,
  });

  it("matches the spec's stat row (caster L3, caster wins 7, fighter wins 18, portable fighter)", () => {
    const stats = sheetStats(TEST_RULES, caster("fighter"));
    expect([stats.hp, stats.atk, stats.def, stats.mag, stats.spd, stats.luck]).toEqual([
      50, 18, 14, 25, 12, 7,
    ]);
  });

  it("is active only outside its own class", () => {
    const has = (c: CharacterPublic, hook: string) =>
      activeHooks(TEST_RULES, c).some((h) => h.hook === hook);
    expect(has(caster("fighter"), "critBp")).toBe(true);
    expect(has(caster(null), "critBp")).toBe(false);
    // the caster's own rank-5 passive is never doubled by carrying the class it already plays
    const own = activeHooks(TEST_RULES, { ...caster("caster"), mastery: wins(18, 18) });
    expect(own.filter((h) => h.hook === "spellTakenBp")).toHaveLength(1);
  });
});

describe("hybridsUnlocked", () => {
  it.each([
    [wins(0, 0), []],
    [wins(6, 7), []],
    [wins(7, 6), []],
    [wins(7, 7), ["battlemage"]],
    [wins(18, 18), ["battlemage"]],
  ])("mastery %j unlocks %j", (mastery, expected) => {
    expect(hybridsUnlocked(TEST_RULES, mastery)).toEqual(expected);
  });

  it("reads a missing parent as 0 wins (never an inherited member)", () => {
    expect(hybridsUnlocked(TEST_RULES, {})).toEqual([]);
    expect(hybridsUnlocked(TEST_RULES, { fighter: 7 })).toEqual([]);
  });

  it("ignores base classes and returns ids sorted", () => {
    const rules = craft((r) => {
      const battlemage = need(r.classes.battlemage);
      r.classes.aaa = { ...battlemage, id: "aaa" };
    });
    expect(hybridsUnlocked(rules, wins(7, 7))).toEqual(["aaa", "battlemage"]);
  });
});

describe("applyXp", () => {
  it("levels 0 -> 150 xp to L3 with every level gained, ascending", () => {
    const result = applyXp(TEST_RULES, ch({ xp: 0 }), 150);
    expect(result.levelsGained).toEqual([2, 3]);
    expect(result.character).toMatchObject({ xp: 150, level: 3 });
  });

  it("carries hp gains over the level up (fighter L1 48 -> L3 max)", () => {
    const result = applyXp(TEST_RULES, ch({ hp: 30 }), 150);
    const max = sheetStats(TEST_RULES, result.character).hp;
    expect(result.character.hp).toBe(adjustHp(48, max, 30));
    expect(result.character.hp).toBe(30 + (max - 48));
  });

  it("keeps a KO'd character at 0 hp", () => {
    expect(applyXp(TEST_RULES, ch({ hp: 0 }), 150).character.hp).toBe(0);
  });

  it("gains nothing when the xp stays inside the level", () => {
    const result = applyXp(TEST_RULES, ch(), 10);
    expect(result).toEqual({ character: ch({ xp: 10 }), levelsGained: [] });
  });

  it("saturates xp at MAX_COUNTER and clamps the level to maxLevel", () => {
    const result = applyXp(TEST_RULES, ch({ xp: MAX_COUNTER - 1 }), 1_000_000);
    expect(result.character.xp).toBe(MAX_COUNTER);
    expect(result.character.level).toBe(TEST_RULES.progression.maxLevel);
    expect(result.levelsGained).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(levelForXp(TEST_RULES, result.character.xp)).toBe(10);
  });

  it("does not mutate its input", () => {
    const input = deepFreeze(ch());
    expect(() => applyXp(TEST_RULES, input, 500)).not.toThrow();
  });
});

describe("victoryReward", () => {
  const playerSide = (playerId: string): CombatSide => ({
    kind: "player",
    playerId,
    mods: ZERO_MODS,
  });
  const npcSide = (npc: Extract<CombatSide, { kind: "npc" }>["npc"]): CombatSide => ({
    kind: "npc",
    npc,
    stats: npcStats(TEST_RULES, npc),
    hp: 1,
    mods: ZERO_MODS,
  });
  const gold = craft((r) => {
    need(r.guardians.lich).goldPerTier = 7;
    r.enforcer.goldPerLevel = 5;
  });

  it("pays pvpXpPerLevel x the loser's level and no gold for a player", () => {
    expect(victoryReward(TEST_RULES, playerSide("p2"), 4)).toEqual({ xp: 40, gold: 0 });
    expect(victoryReward(TEST_RULES, playerSide("p2"), 1)).toEqual({ xp: 10, gold: 0 });
  });

  it("pays a monster's xp and gold, x seniorRewardBp for a senior (floored)", () => {
    expect(
      victoryReward(TEST_RULES, npcSide({ kind: "monster", id: "slime", senior: false }), 0),
    ).toEqual({ xp: 20, gold: 30 });
    expect(
      victoryReward(TEST_RULES, npcSide({ kind: "monster", id: "slime", senior: true }), 0),
    ).toEqual({ xp: 30, gold: 45 });
    // gull: 25 xp / 40 gold, x1.5 = 37.5 / 60
    expect(
      victoryReward(TEST_RULES, npcSide({ kind: "monster", id: "gull", senior: true }), 0),
    ).toEqual({ xp: 37, gold: 60 });
  });

  it("pays a guardian x townTier", () => {
    const lich = { kind: "guardian", id: "lich", townTier: 2 } as const;
    expect(victoryReward(TEST_RULES, npcSide(lich), 0)).toEqual({ xp: 100, gold: 0 });
    expect(victoryReward(gold, npcSide(lich), 0)).toEqual({ xp: 100, gold: 14 });
  });

  it("pays the enforcer x its level", () => {
    const enforcer = { kind: "enforcer", level: 3 } as const;
    expect(victoryReward(TEST_RULES, npcSide(enforcer), 0)).toEqual({ xp: 30, gold: 0 });
    expect(victoryReward(gold, npcSide(enforcer), 0)).toEqual({ xp: 30, gold: 15 });
  });
});

describe("awardVictory", () => {
  it("adds xp, gold and one win for the current class", () => {
    const { character, events } = awardVictory(TEST_RULES, ch(), { xp: 20, gold: 30 });
    expect(character).toMatchObject({
      xp: 20,
      gold: 130,
      level: 1,
      mastery: wins(1, 0),
    });
    expect(events).toEqual([
      { type: "VictoryRewarded", xp: 20, gold: 30, classId: "fighter", masteryWins: 1 },
    ]);
  });

  it("emits VictoryRewarded, LevelUp per level, MasteryRankUp, HybridUnlocked in order", () => {
    const start = ch({ xp: 45, mastery: wins(6, 7) });
    const { character, events } = awardVictory(TEST_RULES, start, { xp: 110, gold: 0 });
    expect(events).toEqual([
      { type: "VictoryRewarded", xp: 110, gold: 0, classId: "fighter", masteryWins: 7 },
      { type: "LevelUp", level: 2 },
      { type: "LevelUp", level: 3 },
      { type: "MasteryRankUp", classId: "fighter", rank: 3 },
      { type: "HybridUnlocked", classId: "battlemage" },
    ]);
    expect(character.level).toBe(3);
  });

  it("emits MasteryRankUp exactly at 3 wins and not on the next win", () => {
    const at2 = awardVictory(TEST_RULES, ch({ mastery: wins(2, 0) }), { xp: 0, gold: 0 });
    expect(at2.events.map((e) => e.type)).toEqual(["VictoryRewarded", "MasteryRankUp"]);
    expect(at2.events[1]).toEqual({ type: "MasteryRankUp", classId: "fighter", rank: 2 });
    const at3 = awardVictory(TEST_RULES, at2.character, { xp: 0, gold: 0 });
    expect(at3.events.map((e) => e.type)).toEqual(["VictoryRewarded"]);
  });

  it("does not rank up on a win that stays inside the rank", () => {
    const { events } = awardVictory(TEST_RULES, ch({ mastery: wins(3, 0) }), { xp: 0, gold: 0 });
    expect(events.map((e) => e.type)).toEqual(["VictoryRewarded"]);
  });

  it("unlocks a hybrid once: when the second parent reaches the rank", () => {
    const first = awardVictory(TEST_RULES, ch({ mastery: wins(6, 7) }), { xp: 0, gold: 0 });
    expect(first.events.filter((e) => e.type === "HybridUnlocked")).toHaveLength(1);
    const again = awardVictory(TEST_RULES, first.character, { xp: 0, gold: 0 });
    expect(again.events.filter((e) => e.type === "HybridUnlocked")).toHaveLength(0);
  });

  it("does not unlock while a parent is one win short", () => {
    const { events } = awardVictory(TEST_RULES, ch({ mastery: wins(5, 7) }), { xp: 0, gold: 0 });
    expect(events.some((e) => e.type === "HybridUnlocked")).toBe(false);
  });

  it("applies the hybrid's own mastery when the character plays it", () => {
    const start = ch({ classId: "battlemage", mastery: wins(0, 0, 2) });
    const { character } = awardVictory(TEST_RULES, start, { xp: 0, gold: 0 });
    expect(character.mastery).toEqual(wins(0, 0, 3));
  });

  it("carries hp gains over a level up and keeps a KO'd character at 0", () => {
    const wounded = awardVictory(TEST_RULES, ch({ hp: 30 }), { xp: 60, gold: 0 });
    const max = sheetStats(TEST_RULES, wounded.character).hp;
    expect(wounded.character.hp).toBe(30 + (max - 48));
    expect(awardVictory(TEST_RULES, ch({ hp: 0 }), { xp: 60, gold: 0 }).character.hp).toBe(0);
  });

  it("saturates xp, gold and mastery wins at MAX_COUNTER", () => {
    const start = ch({
      xp: MAX_COUNTER,
      level: 10,
      gold: MAX_COUNTER,
      mastery: wins(MAX_COUNTER, 0),
      hp: 1,
    });
    const { character, events } = awardVictory(TEST_RULES, start, { xp: 50, gold: 50 });
    expect(character).toMatchObject({ xp: MAX_COUNTER, gold: MAX_COUNTER, level: 10 });
    expect(character.mastery.fighter).toBe(MAX_COUNTER);
    expect(events).toEqual([
      {
        type: "VictoryRewarded",
        xp: 50,
        gold: 50,
        classId: "fighter",
        masteryWins: MAX_COUNTER,
      },
    ]);
  });
});

describe("loadout/setPortable", () => {
  const set = (playerId: string, classId: string | null) => ({
    v: 2,
    type: "loadout/setPortable",
    playerId,
    classId,
  });

  it("rejects 17 wins and accepts 18 (a single mutation)", () => {
    const at17 = make((j) => {
      need(j.public.characters.p2).mastery = wins(17, 0);
    });
    fails(at17, set("p2", "fighter"), "portable passive requires mastery rank 5");
    const at18 = make((j) => {
      need(j.public.characters.p2).mastery = wins(18, 0);
    });
    const result = reduce(at18, set("p2", "fighter"), TEST_RULES);
    expect(result.ok).toBe(true);
  });

  it.each(["nope", "toString", "constructor", "__proto__"])(
    "rejects the unknown class %s",
    (id) => {
      const state = make((j) => {
        need(j.public.characters.p2).mastery = wins(18, 0);
      });
      fails(state, set("p2", id), "unknown class");
    },
  );

  it("rejects a class the character has no wins in", () => {
    fails(newGame(), set("p1", "caster"), "portable passive requires mastery rank 5");
  });

  it("sets the portable class and emits PortableSet with the adjusted hp", () => {
    const rules = craft((r) => {
      need(r.classes.fighter).passives = need(r.classes.fighter).passives.map((p) =>
        p.rank === 5 ? { ...p, hook: "hpBp" as const, value: 2500 } : p,
      );
    });
    const state = make((j) => {
      const c = need(j.public.characters.p2);
      c.mastery = wins(18, 0);
      c.hp = 20;
    }, rules);
    const before = need(state.public.characters.p2);
    const oldMax = sheetStats(rules, before).hp;
    const result = reduce(state, set("p2", "fighter"), rules);
    if (!result.ok) throw new Error(result.error.message);
    const after = need(result.state.public.characters.p2);
    const newMax = sheetStats(rules, after).hp;
    expect(newMax).toBeGreaterThan(oldMax);
    expect(after.portable).toBe("fighter");
    expect(after.hp).toBe(20 + (newMax - oldMax));
    expect(result.events).toEqual([
      {
        v: 2,
        type: "PortableSet",
        visibility: { kind: "public" },
        playerId: "p2",
        classId: "fighter",
        hp: after.hp,
      },
    ]);
    // the carried passive is now part of the sheet
    expect(activeHooks(rules, after).some((h) => h.hook === "hpBp" && h.value === 2500)).toBe(true);
    expect(deserialize(serialize(result.state), rules)).toEqual(result.state);
  });

  it("null clears the portable class and hp never rises", () => {
    const rules = craft((r) => {
      need(r.classes.fighter).passives = need(r.classes.fighter).passives.map((p) =>
        p.rank === 5 ? { ...p, hook: "hpBp" as const, value: 2500 } : p,
      );
    });
    const state = make((j) => {
      const c = need(j.public.characters.p2);
      c.mastery = wins(18, 0);
      c.portable = "fighter";
      c.hp = sheetStats(rules, {
        ...p2,
        mastery: wins(18, 0),
        portable: "fighter",
      }).hp;
    }, rules);
    const before = need(state.public.characters.p2);
    const result = reduce(state, set("p2", null), rules);
    if (!result.ok) throw new Error(result.error.message);
    const after = need(result.state.public.characters.p2);
    expect(after.portable).toBeNull();
    expect(after.hp).toBe(sheetStats(rules, after).hp);
    expect(after.hp).toBeLessThan(before.hp);
    expect(result.events).toMatchObject([{ type: "PortableSet", classId: null, hp: after.hp }]);
  });

  it("keeps a KO'd character at 0 hp", () => {
    const state = make((j) => {
      const c = need(j.public.characters.p2);
      c.mastery = wins(18, 0);
      c.hp = 0;
    });
    const result = reduce(state, set("p2", "fighter"), TEST_RULES);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.public.characters.p2?.hp).toBe(0);
  });

  it.each([
    ["an extra key", { ...set("p2", null), extra: 1 }],
    ["a numeric classId", set("p2", 5 as unknown as string)],
    ["a missing classId", { v: 2, type: "loadout/setPortable", playerId: "p2" }],
    ["a non-string playerId", set(5 as unknown as string, null)],
  ])("rejects %s at the shape step", (_name, action) => {
    fails(newGame(), action, "invalid payload for loadout/setPortable");
  });

  it("accepts null on a character with no portable class", () => {
    const result = reduce(newGame(), set("p1", null), TEST_RULES);
    expect(result.ok).toBe(true);
  });
});
