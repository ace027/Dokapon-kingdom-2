// Pins every cell of the golden matrix (incl. D2), all 23 variant rows and the exchange draw
// order. Expected values are transcribed from the spec tables (Golden matrix / Variant rows).
import { describe, expect, it } from "vitest";
import { applyPassives } from "../src/combat/passives";
import {
  computeCell,
  critChanceBp,
  fleeChanceBp,
  isCritEligible,
  physBase,
  resolveExchange,
  spellBase,
  ZERO_MODS,
  type CellResult,
  type Combatant,
  type DefenseCell,
  type ExchangeInput,
  type Fighter,
} from "../src/combat/resolve";
import type { AttackCommand, Hook, Rules, StatBlock } from "../src/rules";
import { MAX_COUNTER } from "../src/types";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const T = TEST_RULES.combat;

function hooks(...list: Hook[]) {
  return applyPassives(list);
}
const H = (hook: Hook["hook"], value: number): Hook => ({ hook, value });

const FIXTURE_SPELL = {
  id: "fixture",
  tier: 1,
  price: 0,
  powerBp: 12000,
  effect: { kind: "none" },
} as const;

function attacker(over: Partial<Combatant> = {}): Combatant {
  return {
    stats: { hp: 100, atk: 30, def: 20, mag: 24, spd: 10, luck: 8 },
    hp: 100,
    maxHp: 100,
    hooks: hooks(),
    spell: FIXTURE_SPELL,
    ward: null,
    ...over,
  };
}

function defender(over: Partial<Combatant> = {}): Combatant {
  return {
    stats: { hp: 90, atk: 26, def: 18, mag: 20, spd: 9, luck: 4 },
    hp: 90,
    maxHp: 90,
    hooks: hooks(),
    spell: null,
    ward: null,
    ...over,
  };
}

function ward(id: string) {
  const def = TEST_RULES.wardSpells[id];
  if (def === undefined) throw new Error(`no ward ${id}`);
  return def;
}
function spell(id: string) {
  const def = TEST_RULES.battleSpells[id];
  if (def === undefined) throw new Error(`no spell ${id}`);
  return def;
}
function withStats(base: Combatant, over: Partial<StatBlock>): Combatant {
  return { ...base, stats: { ...base.stats, ...over } };
}

describe("golden matrix fixture", () => {
  it("has physBase 28, spellBase 18 and crit chance 500", () => {
    expect(physBase(T, attacker(), defender())).toBe(28);
    expect(spellBase(T, attacker(), defender())).toBe(18);
    expect(critChanceBp(TEST_RULES, attacker())).toBe(500);
  });
});

interface Cell {
  a: AttackCommand;
  d: DefenseCell;
  toDefender: number;
  toAttacker?: number;
  crit?: number;
  effectLands?: boolean;
  tags?: string[];
}

// Attacker x Defender, tuning = TEST_RULES.combat, defender has NO ward spell (D2).
const MATRIX: Cell[] = [
  { a: "attack", d: "guard", toDefender: 14, crit: 21 },
  { a: "attack", d: "counter", toDefender: 35, crit: 52 }, // failed Counter: 1.25x
  { a: "attack", d: "ward", toDefender: 28, crit: 42 },
  { a: "attack", d: "open", toDefender: 28, crit: 42 },
  { a: "strike", d: "guard", toDefender: 42, crit: 63 }, // pierces Guard
  { a: "strike", d: "counter", toDefender: 0, toAttacker: 28, tags: ["reflected"] }, // reflection, no crit
  { a: "strike", d: "ward", toDefender: 49, crit: 73 },
  { a: "strike", d: "open", toDefender: 42, crit: 63 },
  { a: "spell", d: "guard", toDefender: 18, effectLands: true },
  { a: "spell", d: "counter", toDefender: 18, effectLands: true },
  { a: "spell", d: "ward", toDefender: 18, effectLands: false }, // D2: no ward spell -> Guard multiplier
  { a: "spell", d: "open", toDefender: 18, effectLands: true },
];

describe("computeCell: golden matrix (12 cells)", () => {
  it.each(MATRIX)("$a x $d", (cell) => {
    const r = computeCell(T, attacker(), defender(), cell.a, cell.d, false);
    expect(r.toDefender).toBe(cell.toDefender);
    expect(r.toAttacker).toBe(cell.toAttacker ?? 0);
    expect(r.healAttacker).toBe(0);
    expect(r.healDefender).toBe(0);
    expect(r.tags).toEqual(cell.tags ?? []);
    if (cell.effectLands !== undefined) expect(r.effectLands).toBe(cell.effectLands);
    if (cell.crit !== undefined) {
      expect(computeCell(T, attacker(), defender(), cell.a, cell.d, true).toDefender).toBe(
        cell.crit,
      );
    }
  });

  it("D2: Spell x Ward is 18 with no ward spell and 7 with Barrier", () => {
    expect(computeCell(T, attacker(), defender(), "spell", "ward", false).toDefender).toBe(18);
    expect(
      computeCell(T, attacker(), defender({ ward: ward("shell") }), "spell", "ward", false)
        .toDefender,
    ).toBe(7);
  });

  it("ignores crit on a Strike x Counter reflection and on spells", () => {
    expect(computeCell(T, attacker(), defender(), "strike", "counter", true)).toEqual(
      computeCell(T, attacker(), defender(), "strike", "counter", false),
    );
    expect(computeCell(T, attacker(), defender(), "spell", "guard", true).toDefender).toBe(18);
  });
});

interface Variant {
  name: string;
  att?: Partial<Combatant>;
  def?: Partial<Combatant>;
  a: AttackCommand;
  d: DefenseCell;
  toDefender: number;
  toAttacker?: number;
  healAttacker?: number;
  healDefender?: number;
  tags?: string[];
  effectLands?: boolean;
  crit?: number;
}

const VARIANTS: Variant[] = [
  {
    name: "att strikeDmgBp +1000",
    att: { hooks: hooks(H("strikeDmgBp", 1000)) },
    a: "strike",
    d: "ward",
    toDefender: 53,
    crit: 79,
  },
  {
    name: "def guardVsStrikeBp 5000",
    def: { hooks: hooks(H("guardVsStrikeBp", 5000)) },
    a: "strike",
    d: "guard",
    toDefender: 21,
    crit: 31,
  },
  {
    name: "def counterDmgBp +2000",
    def: { hooks: hooks(H("counterDmgBp", 2000)) },
    a: "strike",
    d: "counter",
    toDefender: 0,
    toAttacker: 33,
    tags: ["reflected"],
  },
  {
    name: "def spellTakenBp -2000",
    def: { hooks: hooks(H("spellTakenBp", -2000)) },
    a: "spell",
    d: "guard",
    toDefender: 14,
    effectLands: true,
  },
  {
    name: "def physTakenBp -5000",
    def: { hooks: hooks(H("physTakenBp", -5000)) },
    a: "attack",
    d: "ward",
    toDefender: 14,
    crit: 21,
  },
  {
    name: "def ward Barrier",
    def: { ward: ward("shell") },
    a: "spell",
    d: "ward",
    toDefender: 7,
    effectLands: false,
  },
  {
    name: "def ward Barrier (Attack)",
    def: { ward: ward("shell") },
    a: "attack",
    d: "ward",
    toDefender: 28,
    crit: 42,
  },
  {
    name: "def ward mirror-ward (Reflect 5000)",
    def: { ward: ward("mirror-ward") },
    a: "spell",
    d: "ward",
    toDefender: 7,
    toAttacker: 9,
    tags: ["reflected"],
    effectLands: false,
  },
  {
    name: "def ward sponge (Absorb)",
    def: { ward: ward("sponge") },
    a: "spell",
    d: "ward",
    toDefender: 0,
    healDefender: 7,
    tags: ["absorbed"],
    effectLands: false,
  },
  {
    name: "def ward null-ward (Counterspell)",
    def: { ward: ward("null-ward") },
    a: "spell",
    d: "ward",
    toDefender: 0,
    tags: ["negated"],
    effectLands: false,
  },
  {
    name: "null-ward Attack",
    def: { ward: ward("null-ward") },
    a: "attack",
    d: "ward",
    toDefender: 35,
    crit: 52,
  },
  {
    name: "null-ward Strike",
    def: { ward: ward("null-ward") },
    a: "strike",
    d: "ward",
    toDefender: 61,
    crit: 91,
  },
  {
    name: "def wardReflectBp 5000, no ward spell",
    def: { hooks: hooks(H("wardReflectBp", 5000)) },
    a: "spell",
    d: "ward",
    toDefender: 18,
    toAttacker: 9,
    tags: ["reflected"],
    effectLands: false,
  },
  {
    name: "def wardReflectBp 5000 + Barrier",
    def: { hooks: hooks(H("wardReflectBp", 5000)), ward: ward("shell") },
    a: "spell",
    d: "ward",
    toDefender: 7,
    toAttacker: 9,
    tags: ["reflected"],
    effectLands: false,
  },
  {
    name: "att spell Hex",
    att: { spell: spell("hex") },
    a: "spell",
    d: "guard",
    toDefender: 0,
    effectLands: true,
  },
  {
    name: "att spell Hex, no ward spell",
    att: { spell: spell("hex") },
    a: "spell",
    d: "ward",
    toDefender: 0,
    effectLands: false,
  },
  {
    name: "att spell Leech",
    att: { spell: spell("leech") },
    a: "spell",
    d: "counter",
    toDefender: 9,
    healAttacker: 4,
    effectLands: true,
  },
  {
    name: "att spell Leech, no ward spell",
    att: { spell: spell("leech") },
    a: "spell",
    d: "ward",
    toDefender: 9,
    effectLands: false,
  },
  {
    name: "att lifestealBp 2000",
    att: { hooks: hooks(H("lifestealBp", 2000)) },
    a: "attack",
    d: "counter",
    toDefender: 35,
    healAttacker: 7,
    crit: 52,
  },
  {
    name: "att spellbladeStrike 5000 (Guard)",
    att: { hooks: hooks(H("spellbladeStrike", 5000)) },
    a: "strike",
    d: "guard",
    toDefender: 51,
    effectLands: true,
    crit: 72,
  },
  {
    name: "att spellbladeStrike 5000 (Ward)",
    att: { hooks: hooks(H("spellbladeStrike", 5000)) },
    a: "strike",
    d: "ward",
    toDefender: 58,
    effectLands: false,
    crit: 82,
  },
  {
    name: "att spellbladeStrike 5000 (Counter)",
    att: { hooks: hooks(H("spellbladeStrike", 5000)) },
    a: "strike",
    d: "counter",
    toDefender: 0,
    toAttacker: 28,
    tags: ["reflected"],
    effectLands: false,
  },
  {
    name: "att atk 1 (min-1 rule)",
    att: withStats(attacker(), { atk: 1 }),
    a: "attack",
    d: "guard",
    toDefender: 1,
    crit: 1,
  },
];

describe("computeCell: variant rows", () => {
  it("has all 23 rows", () => {
    expect(VARIANTS).toHaveLength(23);
  });

  it.each(VARIANTS)("$name", (v) => {
    const att = attacker(v.att);
    const def = defender(v.def);
    const r: CellResult = computeCell(T, att, def, v.a, v.d, false);
    expect(r.toDefender).toBe(v.toDefender);
    expect(r.toAttacker).toBe(v.toAttacker ?? 0);
    expect(r.healAttacker).toBe(v.healAttacker ?? 0);
    expect(r.healDefender).toBe(v.healDefender ?? 0);
    expect(r.tags).toEqual(v.tags ?? []);
    if (v.effectLands !== undefined) expect(r.effectLands).toBe(v.effectLands);
    if (v.crit !== undefined) {
      expect(computeCell(T, att, def, v.a, v.d, true).toDefender).toBe(v.crit);
    }
  });
});

describe("isCritEligible", () => {
  const cases: [AttackCommand, DefenseCell, boolean][] = [
    ["attack", "guard", true],
    ["attack", "counter", true],
    ["attack", "ward", true],
    ["attack", "open", true],
    ["strike", "guard", true],
    ["strike", "counter", false],
    ["strike", "ward", true],
    ["strike", "open", true],
    ["spell", "guard", false],
    ["spell", "counter", false],
    ["spell", "ward", false],
    ["spell", "open", false],
  ];
  it.each(cases)("%s x %s = %s", (a, d, expected) => {
    expect(isCritEligible(a, d)).toBe(expected);
  });
});

describe("fleeChanceBp", () => {
  const fleer = (spd: number, extra: Hook[] = []) =>
    attacker({ stats: { hp: 1, atk: 1, def: 1, mag: 1, spd, luck: 1 }, hooks: hooks(...extra) });
  it("adds fleePerSpdBp per SPD point of difference", () => {
    expect(fleeChanceBp(TEST_RULES, fleer(10), fleer(9))).toBe(5250);
    expect(fleeChanceBp(TEST_RULES, fleer(9), fleer(10))).toBe(4750);
  });
  it("clamps at fleeMinBp and fleeMaxBp", () => {
    expect(fleeChanceBp(TEST_RULES, fleer(0), fleer(40))).toBe(T.fleeMinBp);
    expect(fleeChanceBp(TEST_RULES, fleer(40), fleer(0))).toBe(T.fleeMaxBp);
  });
  it("adds the fleeBp hook before clamping", () => {
    expect(fleeChanceBp(TEST_RULES, fleer(10, [H("fleeBp", 2000)]), fleer(10))).toBe(7000);
    expect(fleeChanceBp(TEST_RULES, fleer(10, [H("fleeBp", 9000)]), fleer(10))).toBe(T.fleeMaxBp);
  });
});

// ---- resolveExchange with a scripted draw ----------------------------------------------------

function scripted(values: number[]) {
  const calls: [number, number][] = [];
  const queue = [...values];
  const draw = (min: number, max: number): number => {
    calls.push([min, max]);
    const next = queue.shift();
    if (next === undefined) throw new Error(`unexpected draw (${min}, ${max})`);
    return next;
  };
  return { draw, calls };
}

function fighter(snap: Combatant, over: Partial<Fighter> = {}): Fighter {
  return { isPlayer: true, snap, mods: { ...ZERO_MODS }, gold: 100, bag: [], ...over };
}

function exchange(
  rules: Rules,
  att: Fighter,
  def: Fighter,
  command: string,
  defense: DefenseCell | null,
  values: number[],
) {
  const { draw, calls } = scripted(values);
  const input: ExchangeInput = { attacker: att, defender: def, command, defense };
  return { out: resolveExchange(rules, input, draw), calls };
}

describe("resolveExchange", () => {
  const att = () => fighter(attacker());
  const def = () => fighter(defender());

  it("flee succeeds when u <= chance (5250) and fails above it", () => {
    const ok = exchange(TEST_RULES, att(), def(), "flee", null, [5250]);
    expect(ok.calls).toEqual([[1, 10000]]);
    expect(ok.out.fled).toBe(true);
    expect(ok.out.effects).toEqual(["fled"]);
    const fail = exchange(TEST_RULES, att(), def(), "flee", null, [5251]);
    expect(fail.out.fled).toBe(false);
    expect(fail.out.effects).toEqual(["flee-failed"]);
  });

  it("heal item: heals min(missing, floor(maxHp x bp)) and removes the first herb", () => {
    const a = fighter(attacker({ hp: 50 }), { bag: ["herb", "bomb", "herb"] });
    const { out, calls } = exchange(TEST_RULES, a, def(), "item:herb", null, []);
    expect(calls).toEqual([]);
    expect(out.attacker.hp).toBe(80);
    expect(out.heal.attacker).toBe(30);
    expect(out.attacker.bag).toEqual(["bomb", "herb"]);
    expect(out.effects).toEqual(["item:herb"]);
    const capped = exchange(
      TEST_RULES,
      fighter(attacker({ hp: 90 }), { bag: ["herb"] }),
      def(),
      "item:herb",
      null,
      [],
    );
    expect(capped.out.heal.attacker).toBe(10);
    expect(capped.out.attacker.hp).toBe(100);
  });

  it("cleanse item zeroes negative stat mods and clears poison and stun", () => {
    const a = fighter(attacker(), {
      bag: ["antidote"],
      mods: { atk: -2500, def: 1000, mag: -1, spd: 0, poison: true, stun: true },
    });
    const { out, calls } = exchange(TEST_RULES, a, def(), "item:antidote", null, []);
    expect(calls).toEqual([]);
    expect(out.attacker.mods).toEqual({
      atk: 0,
      def: 1000,
      mag: 0,
      spd: 0,
      poison: false,
      stun: false,
    });
    expect(out.effects).toEqual(["item:antidote"]);
  });

  it("flee item (smoke bomb) ends fled without a draw", () => {
    const a = fighter(attacker(), { bag: ["bomb"] });
    const { out, calls } = exchange(TEST_RULES, a, def(), "item:bomb", null, []);
    expect(calls).toEqual([]);
    expect(out.fled).toBe(true);
    expect(out.effects).toEqual(["item:bomb", "fled"]);
  });

  it("mod item clamp-adds into [modMinBp, modMaxBp]", () => {
    const a = fighter(attacker(), {
      bag: ["tonic"],
      mods: { ...ZERO_MODS, atk: 4000 },
    });
    const { out } = exchange(TEST_RULES, a, def(), "item:tonic", null, []);
    expect(out.attacker.mods.atk).toBe(T.modMaxBp);
  });

  it("draws crit (1, 10000) for a crit-eligible attack: u <= 500 crits", () => {
    const hit = exchange(TEST_RULES, att(), def(), "attack", "guard", [500]);
    expect(hit.calls).toEqual([[1, 10000]]);
    expect(hit.out.crit).toBe(true);
    expect(hit.out.damage).toEqual({ attacker: 0, defender: 21 });
    expect(hit.out.defender.hp).toBe(69);
    const miss = exchange(TEST_RULES, att(), def(), "attack", "guard", [501]);
    expect(miss.out.crit).toBe(false);
    expect(miss.out.damage.defender).toBe(14);
  });

  it("Strike x Counter draws nothing and reflects onto the attacker", () => {
    const { out, calls } = exchange(TEST_RULES, att(), def(), "strike", "counter", []);
    expect(calls).toEqual([]);
    expect(out.damage).toEqual({ attacker: 28, defender: 0 });
    expect(out.attacker.hp).toBe(72);
    expect(out.effects).toEqual(["reflected"]);
  });

  it("stun spell draws (1, 10000) after the cell: lands at u <= chance, not above", () => {
    const a = fighter(attacker({ spell: spell("jolt") }));
    const landed = exchange(TEST_RULES, a, def(), "spell", "guard", [5000]);
    expect(landed.calls).toEqual([[1, 10000]]);
    expect(landed.out.defender.mods.stun).toBe(true);
    expect(landed.out.effects).toEqual(["stun"]);
    const missed = exchange(TEST_RULES, a, def(), "spell", "guard", [5001]);
    expect(missed.out.defender.mods.stun).toBe(false);
    expect(missed.out.effects).toEqual([]);
    const warded = exchange(TEST_RULES, a, def(), "spell", "ward", []);
    expect(warded.calls).toEqual([]);
  });

  it("mod spell lowers the defender stat and tags mod:<stat>:<bp>", () => {
    const a = fighter(attacker({ spell: spell("frost") }));
    const { out, calls } = exchange(TEST_RULES, a, def(), "spell", "guard", []);
    expect(calls).toEqual([]);
    expect(out.defender.mods.spd).toBe(-2000);
    expect(out.effects).toEqual(["mod:spd:-2000"]);
  });

  it("stealGold spell moves gold from a player defender to a player attacker", () => {
    const a = fighter(attacker({ spell: spell("pilfer") }), { gold: 50 });
    const { out } = exchange(TEST_RULES, a, def(), "spell", "guard", []);
    expect(out.effects).toEqual(["steal-gold:10"]);
    expect(out.attacker.gold).toBe(60);
    expect(out.defender.gold).toBe(90);
  });

  it("stealGold spell: an NPC defender has no gold; an NPC attacker's take vanishes", () => {
    const a = fighter(attacker({ spell: spell("pilfer") }), { gold: 50 });
    const npc = fighter(defender(), { isPlayer: false, gold: 0 });
    const vsNpc = exchange(TEST_RULES, a, npc, "spell", "guard", []);
    expect(vsNpc.out.effects).toEqual([]);
    expect(vsNpc.out.attacker.gold).toBe(50);
    const npcAtt = fighter(attacker({ spell: spell("pilfer") }), { isPlayer: false, gold: 0 });
    const vsPlayer = exchange(TEST_RULES, npcAtt, def(), "spell", "guard", []);
    expect(vsPlayer.out.effects).toEqual(["steal-gold:10"]);
    expect(vsPlayer.out.attacker.gold).toBe(0);
    expect(vsPlayer.out.defender.gold).toBe(90);
  });

  it("stolen gold saturates at MAX_COUNTER for a player attacker", () => {
    const a = fighter(attacker({ spell: spell("pilfer") }), { gold: MAX_COUNTER - 5 });
    const { out } = exchange(TEST_RULES, a, def(), "spell", "guard", []);
    expect(out.attacker.gold).toBe(MAX_COUNTER);
  });

  it("drain tags only when the heal is > 0", () => {
    const hurt = fighter(attacker({ spell: spell("leech"), hp: 90 }));
    const healed = exchange(TEST_RULES, hurt, def(), "spell", "counter", []);
    expect(healed.out.heal.attacker).toBe(4);
    expect(healed.out.effects).toEqual(["drain"]);
    const full = fighter(attacker({ spell: spell("leech") }));
    const none = exchange(TEST_RULES, full, def(), "spell", "counter", []);
    expect(none.out.heal.attacker).toBe(0);
    expect(none.out.effects).toEqual([]);
  });

  it("applies on-hit hooks in order: poison, steal-gold, steal-item (draws crit, then item index)", () => {
    const gull = attacker({
      hooks: hooks(H("poisonOnHit", 1), H("stealGoldOnHitBp", 1000), H("stealItemOnHit", 1)),
    });
    const victim = fighter(defender(), { gold: 100, bag: ["herb", "bomb"] });
    const { out, calls } = exchange(
      TEST_RULES,
      fighter(gull, { isPlayer: false, gold: 0 }),
      victim,
      "attack",
      "guard",
      [10000, 1],
    );
    expect(calls).toEqual([
      [1, 10000],
      [0, 1],
    ]);
    expect(out.effects).toEqual(["poison", "steal-gold:10", "steal-item:bomb"]);
    expect(out.defender.mods.poison).toBe(true);
    expect(out.defender.gold).toBe(90);
    expect(out.defender.bag).toEqual(["herb"]);
    expect(out.attacker.gold).toBe(0);
  });

  it("on-hit steals need a player defender (gold, bag) and a landed hit", () => {
    const gull = attacker({ hooks: hooks(H("stealGoldOnHitBp", 1000), H("stealItemOnHit", 1)) });
    const npc = fighter(defender(), { isPlayer: false, gold: 0 });
    const vsNpc = exchange(TEST_RULES, fighter(gull), npc, "attack", "guard", [10000]);
    expect(vsNpc.out.effects).toEqual([]);
    const emptyBag = fighter(defender(), { gold: 100, bag: [] });
    const noItem = exchange(TEST_RULES, fighter(gull), emptyBag, "attack", "guard", [10000]);
    expect(noItem.calls).toEqual([[1, 10000]]);
    expect(noItem.out.effects).toEqual(["steal-gold:10"]);
  });

  it("KO and reflect clamp hp at 0 and report actual damage", () => {
    const weak = fighter(defender({ hp: 5 }));
    const { out } = exchange(TEST_RULES, att(), weak, "attack", "open", [10000]);
    expect(out.defender.hp).toBe(0);
    expect(out.damage.defender).toBe(5);
  });

  it("absorb heals the defender by the absorbed damage, clamped to max hp", () => {
    const sponge = fighter(defender({ ward: ward("sponge"), hp: 3 }));
    const healed = exchange(TEST_RULES, att(), sponge, "spell", "ward", []);
    expect(healed.out.defender.hp).toBe(10);
    expect(healed.out.heal.defender).toBe(7);
    const nearFull = fighter(defender({ ward: ward("sponge"), hp: 88 }));
    const capped = exchange(TEST_RULES, att(), nearFull, "spell", "ward", []);
    expect(capped.out.heal.defender).toBe(2);
    expect(capped.out.defender.hp).toBe(90);
  });
});
