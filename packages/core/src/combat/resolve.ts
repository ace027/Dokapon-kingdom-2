// Pure combat math (no GameState): snapshots, the damage matrix cell, NPC command draws and one
// exchange. Every multiply is `Math.floor(x * bp / 10000)` applied step by step in the spec's
// order; all randomness comes from the injected `draw` (the handler passes `ctx.int`).
import type {
  AttackCommand,
  AttackTable,
  BattleSpellDef,
  CombatTuning,
  ContentId,
  DefendCommand,
  DefendTable,
  ModStat,
  Rules,
  StatBlock,
  WardSpellDef,
} from "../rules";
import { MAX_COUNTER, type BattleMods, type CharacterPublic, type CombatSide } from "../types";
import { ownGet } from "../validation";
import { applyPassives, type HookTotals } from "./passives";
import { activeHooks, battleStats, npcDef, sheetStats } from "./stats";

const BP = 10_000;
const fl = Math.floor;

export const ZERO_MODS: BattleMods = {
  atk: 0,
  def: 0,
  mag: 0,
  spd: 0,
  poison: false,
  stun: false,
};

/** Inclusive random integer in `[min, max]`. */
export type Draw = (min: number, max: number) => number;

export interface Combatant {
  /** Battle stats (mods applied). */
  readonly stats: StatBlock;
  readonly hp: number;
  readonly maxHp: number;
  readonly hooks: HookTotals;
  readonly spell: BattleSpellDef | null;
  readonly ward: WardSpellDef | null;
}

export function snapshotPlayer(rules: Rules, ch: CharacterPublic, mods: BattleMods): Combatant {
  const sheet = sheetStats(rules, ch);
  return {
    stats: battleStats(sheet, mods),
    hp: ch.hp,
    maxHp: sheet.hp,
    hooks: applyPassives(activeHooks(rules, ch)),
    spell: ch.battleSpell === null ? null : (ownGet(rules.battleSpells, ch.battleSpell) ?? null),
    ward: ch.wardSpell === null ? null : (ownGet(rules.wardSpells, ch.wardSpell) ?? null),
  };
}

export function snapshotNpc(rules: Rules, side: Extract<CombatSide, { kind: "npc" }>): Combatant {
  const def = npcDef(rules, side.npc);
  return {
    stats: battleStats(side.stats, side.mods),
    hp: side.hp,
    maxHp: side.stats.hp,
    hooks: applyPassives(def.hooks),
    spell: def.battleSpell === null ? null : (ownGet(rules.battleSpells, def.battleSpell) ?? null),
    ward: def.wardSpell === null ? null : (ownGet(rules.wardSpells, def.wardSpell) ?? null),
  };
}

export type DefenseCell = DefendCommand | "open";

/** Attack and Strike can crit, except a Strike into a Counter (which is reflected). */
export function isCritEligible(a: AttackCommand, d: DefenseCell): boolean {
  return (a === "attack" || a === "strike") && !(a === "strike" && d === "counter");
}

export function critChanceBp(rules: Rules, att: Combatant): number {
  const t = rules.combat;
  return Math.min(t.critCapBp, t.critBaseBp + att.stats.luck * t.critPerLuckBp + att.hooks.critBp);
}

export function fleeChanceBp(rules: Rules, fleer: Combatant, other: Combatant): number {
  const t = rules.combat;
  const raw =
    t.fleeBaseBp + (fleer.stats.spd - other.stats.spd) * t.fleePerSpdBp + fleer.hooks.fleeBp;
  return Math.min(t.fleeMaxBp, Math.max(t.fleeMinBp, raw));
}

export function physBase(t: CombatTuning, att: Combatant, def: Combatant): number {
  return Math.max(1, fl((att.stats.atk * t.kBp - def.stats.def * t.jBp) / BP));
}

export function spellBase(t: CombatTuning, att: Combatant, def: Combatant): number {
  if (att.spell === null || att.spell.powerBp === 0) return 0;
  return Math.max(1, fl((att.stats.mag * att.spell.powerBp - def.stats.mag * t.jMagBp) / BP));
}

export type CellTag = "reflected" | "negated" | "absorbed";

export interface CellResult {
  readonly toDefender: number;
  readonly toAttacker: number;
  readonly healAttacker: number;
  readonly healDefender: number;
  readonly tags: readonly CellTag[];
  readonly effectLands: boolean;
}

function outgoingBonus(h: HookTotals, a: AttackCommand): number {
  switch (a) {
    case "attack":
      return h.attackDmgBp;
    case "strike":
      return h.strikeDmgBp;
    case "spell":
      return h.spellDmgBp;
  }
}

/** One cell of the resolution matrix: the spec's `computeCell` steps 1-16, in order. */
export function computeCell(
  t: CombatTuning,
  att: Combatant,
  def: Combatant,
  a: AttackCommand,
  d: DefenseCell,
  crit: boolean,
): CellResult {
  const m = t.matrix;
  const base = a === "spell" ? spellBase(t, att, def) : physBase(t, att, def); // 1
  if (a === "strike" && d === "counter") {
    // 2: reflection; crit is ignored
    let r = fl((base * m.strike.counter) / BP);
    r = fl((r * (BP + def.hooks.counterDmgBp)) / BP);
    return {
      toDefender: 0,
      toAttacker: Math.max(1, r),
      healAttacker: 0,
      healDefender: 0,
      tags: ["reflected"],
      effectLands: false,
    };
  }
  // 3 (D2: Ward with no ward spell gives no spell resistance)
  const mult = a === "spell" && d === "ward" && def.ward === null ? m.spell.guard : m[a][d];
  let dmg = fl((base * mult) / BP);
  dmg = fl((dmg * (BP + outgoingBonus(att.hooks, a))) / BP); // 4
  if (a === "strike" && d === "guard" && def.hooks.guardVsStrikeBp > 0) {
    dmg = fl((dmg * (BP - Math.min(BP, def.hooks.guardVsStrikeBp))) / BP); // 5
  }
  const taken = a === "spell" ? def.hooks.spellTakenBp : def.hooks.physTakenBp;
  dmg = fl((dmg * Math.max(0, BP + taken)) / BP); // 6
  const ward = d === "ward" ? def.ward : null; // 7
  const tags: CellTag[] = [];
  let negated = false;
  if (ward?.mode === "counterspell") {
    if (a === "spell") {
      dmg = 0;
      negated = true;
      tags.push("negated");
    } else {
      dmg = fl((dmg * ward.valueBp) / BP);
    }
  }
  if (crit && a !== "spell") dmg = fl((dmg * t.critMultBp) / BP); // 8
  if (
    a === "strike" &&
    att.hooks.spellbladeStrike > 0 &&
    att.spell !== null &&
    att.spell.powerBp > 0
  ) {
    dmg += fl((spellBase(t, att, def) * att.hooks.spellbladeStrike) / BP); // 9
  }
  if (base > 0 && !negated) dmg = Math.max(1, dmg); // 10
  let healDefender = 0;
  if (ward?.mode === "absorb" && a === "spell" && dmg > 0) {
    healDefender = dmg; // 11
    dmg = 0;
    tags.push("absorbed");
  }
  const toDefender = dmg; // 12
  let toAttacker = 0;
  if (d === "ward" && a === "spell" && base > 0 && !negated) {
    const rbp = (ward?.mode === "reflect" ? ward.valueBp : 0) + def.hooks.wardReflectBp; // 13
    if (rbp > 0) {
      const sraw = fl((base * (BP + att.hooks.spellDmgBp)) / BP);
      toAttacker = Math.max(1, fl((sraw * rbp) / BP));
      tags.push("reflected");
    }
  }
  let healAttacker = 0;
  if (a !== "spell" && dmg > 0 && att.hooks.lifestealBp > 0) {
    healAttacker += fl((dmg * att.hooks.lifestealBp) / BP); // 14
  }
  const carries =
    a === "spell" || (a === "strike" && att.hooks.spellbladeStrike > 0 && att.spell !== null);
  const powerless = a === "spell" && att.spell !== null && att.spell.powerBp === 0;
  const effectLands = carries && d !== "ward" && (dmg > 0 || powerless); // 15
  if (effectLands && att.spell?.effect.kind === "drain") {
    healAttacker += fl((dmg * att.spell.effect.bp) / BP); // 16
  }
  return { toDefender, toAttacker, healAttacker, healDefender, tags, effectLands };
}

/** Weighted pick: `u = draw(1, total)`; the first key whose running sum reaches `u`. */
function weightedPick<K extends string>(
  keys: readonly K[],
  weights: Readonly<Record<K, number>>,
  draw: Draw,
): K {
  const total = keys.reduce((sum, key) => sum + weights[key], 0);
  const u = draw(1, total);
  let running = 0;
  for (const key of keys) {
    running += weights[key];
    if (running >= u) return key;
  }
  throw new Error("invariant: weighted draw fell outside the table");
}

const ATTACK_KEYS = ["attack", "strike", "spell", "flee"] as const;
const DEFEND_KEYS = ["guard", "counter", "ward"] as const;

export function drawNpcCommand(table: AttackTable, draw: Draw): AttackCommand | "flee" {
  return weightedPick(ATTACK_KEYS, table, draw);
}

export function drawNpcDefense(table: DefendTable, draw: Draw): DefendCommand {
  return weightedPick(DEFEND_KEYS, table, draw);
}

export interface Fighter {
  readonly isPlayer: boolean;
  readonly snap: Combatant;
  readonly mods: BattleMods;
  /** NPCs: 0. */
  readonly gold: number;
  /** NPCs: []. */
  readonly bag: readonly ContentId[];
}

export interface ExchangeInput {
  readonly attacker: Fighter;
  readonly defender: Fighter;
  /** `"flee"`, `"item:<id>"` or an attack command. */
  readonly command: string;
  /** `null` iff the command is flee or an item. */
  readonly defense: DefenseCell | null;
}

export interface FighterAfter {
  readonly hp: number;
  readonly mods: BattleMods;
  readonly gold: number;
  readonly bag: readonly ContentId[];
}

export interface ExchangeOutcome {
  readonly attacker: FighterAfter;
  readonly defender: FighterAfter;
  readonly crit: boolean;
  readonly damage: { readonly attacker: number; readonly defender: number };
  readonly heal: { readonly attacker: number; readonly defender: number };
  readonly effects: readonly string[];
  readonly fled: boolean;
}

const ITEM_PREFIX = "item:";

function isAttackCommand(command: string): command is AttackCommand {
  return command === "attack" || command === "strike" || command === "spell";
}

function clampAdd(t: CombatTuning, mods: BattleMods, stat: ModStat, bp: number): BattleMods {
  return { ...mods, [stat]: Math.min(t.modMaxBp, Math.max(t.modMinBp, mods[stat] + bp)) };
}

function removeFirst(bag: readonly ContentId[], id: ContentId): ContentId[] {
  const index = bag.indexOf(id);
  return index < 0 ? [...bag] : [...bag.slice(0, index), ...bag.slice(index + 1)];
}

function cleansed(mods: BattleMods): BattleMods {
  return {
    atk: mods.atk < 0 ? 0 : mods.atk,
    def: mods.def < 0 ? 0 : mods.def,
    mag: mods.mag < 0 ? 0 : mods.mag,
    spd: mods.spd < 0 ? 0 : mods.spd,
    poison: false,
    stun: false,
  };
}

/** Resolves one exchange. Draws, in order: flee | crit, stun, steal-item (each only when it applies). */
export function resolveExchange(rules: Rules, input: ExchangeInput, draw: Draw): ExchangeOutcome {
  const { attacker, defender, command } = input;
  const t = rules.combat;
  let aMods = attacker.mods;
  let dMods = defender.mods;
  let aHp = attacker.snap.hp;
  let dHp = defender.snap.hp;
  let aGold = attacker.gold;
  let dGold = defender.gold;
  let aBag: readonly ContentId[] = attacker.bag;
  let dBag: readonly ContentId[] = defender.bag;
  let crit = false;
  let fled = false;
  let dmgA = 0;
  let dmgD = 0;
  let healA = 0;
  let healD = 0;
  const effects: string[] = [];

  if (command === "flee") {
    const u = draw(1, 10_000);
    fled = u <= fleeChanceBp(rules, attacker.snap, defender.snap);
    effects.push(fled ? "fled" : "flee-failed");
  } else if (command.startsWith(ITEM_PREFIX)) {
    const id = command.slice(ITEM_PREFIX.length);
    aBag = removeFirst(aBag, id);
    effects.push(`item:${id}`);
    const effect = ownGet(rules.items, id)?.effect;
    if (effect?.kind === "heal") {
      healA = Math.max(
        0,
        Math.min(attacker.snap.maxHp - aHp, fl((attacker.snap.maxHp * effect.bp) / BP)),
      );
      aHp += healA;
    } else if (effect?.kind === "cleanse") {
      aMods = cleansed(aMods);
    } else if (effect?.kind === "flee") {
      effects.push("fled");
      fled = true;
    } else if (effect?.kind === "mod") {
      aMods = clampAdd(t, aMods, effect.stat, effect.bp);
    }
  } else if (isAttackCommand(command) && input.defense !== null) {
    const cell = input.defense;
    if (isCritEligible(command, cell)) {
      crit = draw(1, 10_000) <= critChanceBp(rules, attacker.snap);
    }
    const r = computeCell(t, attacker.snap, defender.snap, command, cell, crit);
    const newA = Math.max(0, aHp - r.toAttacker);
    const newD = Math.max(0, dHp - r.toDefender);
    dmgA = aHp - newA;
    dmgD = dHp - newD;
    aHp = newA;
    dHp = newD;
    if (aHp > 0) {
      // a negative drain bp must never turn a heal into damage
      healA = Math.max(0, Math.min(attacker.snap.maxHp - aHp, r.healAttacker));
      aHp += healA;
    }
    if (dHp > 0) {
      healD = Math.min(defender.snap.maxHp - dHp, r.healDefender);
      dHp += healD;
    }
    effects.push(...r.tags);
    const spell = attacker.snap.spell;
    if (r.effectLands && spell !== null) {
      const effect = spell.effect;
      if (effect.kind === "stun") {
        if (draw(1, 10_000) <= effect.chanceBp) {
          dMods = { ...dMods, stun: true };
          effects.push("stun");
        }
      } else if (effect.kind === "mod") {
        dMods = clampAdd(t, dMods, effect.stat, effect.bp);
        effects.push(`mod:${effect.stat}:${effect.bp}`);
      } else if (effect.kind === "stealGold") {
        if (defender.isPlayer) {
          const n = Math.min(dGold, fl((dGold * effect.bp) / BP));
          if (n > 0) {
            dGold -= n;
            if (attacker.isPlayer) aGold = Math.min(MAX_COUNTER, aGold + n);
            effects.push(`steal-gold:${n}`);
          }
        }
      } else if (effect.kind === "drain") {
        if (healA > 0) effects.push("drain");
      }
    }
    if ((command === "attack" || command === "strike") && r.toDefender > 0) {
      const hooks = attacker.snap.hooks;
      if (hooks.poisonOnHit > 0) {
        dMods = { ...dMods, poison: true };
        effects.push("poison");
      }
      if (hooks.stealGoldOnHitBp > 0 && defender.isPlayer) {
        const n = Math.min(dGold, fl((dGold * hooks.stealGoldOnHitBp) / BP));
        if (n > 0) {
          dGold -= n;
          effects.push(`steal-gold:${n}`);
        }
      }
      if (hooks.stealItemOnHit > 0 && defender.isPlayer && dBag.length > 0) {
        const i = draw(0, dBag.length - 1);
        const stolen = dBag[i];
        if (stolen !== undefined) {
          dBag = [...dBag.slice(0, i), ...dBag.slice(i + 1)];
          effects.push(`steal-item:${stolen}`);
        }
      }
    }
  }

  return {
    attacker: { hp: aHp, mods: aMods, gold: aGold, bag: aBag },
    defender: { hp: dHp, mods: dMods, gold: dGold, bag: dBag },
    crit,
    damage: { attacker: dmgA, defender: dmgD },
    heal: { attacker: healA, defender: healD },
    effects,
    fled,
  };
}
