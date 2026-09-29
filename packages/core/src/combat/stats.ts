// Pure stat math (no GameState). Integer floor steps only, applied in the spec's pinned order.
import {
  masteryRank,
  STAT_KEYS,
  type CombatHook,
  type Hook,
  type NpcBase,
  type Rules,
  type StatBlock,
  type StatKey,
} from "../rules";
import type { BattleMods, CharacterPublic, NpcRef } from "../types";
import { ownGet } from "../validation";
import { applyPassives } from "./passives";

const BP = 10_000;
const SHEET_HOOK: Readonly<Record<StatKey, CombatHook>> = {
  hp: "hpBp",
  atk: "atkBp",
  def: "defBp",
  mag: "magBp",
  spd: "spdBp",
  luck: "luckBp",
};
const fl = Math.floor;

function need<V>(value: V | undefined, kind: string, id: string): V {
  if (value === undefined) throw new Error(`unknown ${kind} ${id}`);
  return value;
}

function buildBlock(compute: (key: StatKey) => number): StatBlock {
  const entries = STAT_KEYS.map((key): [StatKey, number] => {
    const raw = compute(key);
    return [key, key === "hp" ? Math.max(1, raw) : Math.max(0, raw)];
  });
  return Object.fromEntries(entries) as StatBlock;
}

/**
 * Hooks active for a character: (1) current-class passives up to the mastery rank, in rank order;
 * (2) the portable rank-5 passive when it belongs to another class; (3) weapon, shield, accessory
 * hooks in that order.
 */
export function activeHooks(rules: Rules, ch: CharacterPublic): readonly Hook[] {
  const cls = need(ownGet(rules.classes, ch.classId), "class", ch.classId);
  const rank = masteryRank(rules, ownGet(ch.mastery, ch.classId) ?? 0);
  const hooks: Hook[] = cls.passives.filter((p) => p.rank <= rank);
  if (ch.portable !== null && ch.portable !== ch.classId) {
    const portable = need(ownGet(rules.classes, ch.portable), "class", ch.portable);
    const top = portable.passives[4];
    if (top !== undefined) hooks.push(top);
  }
  for (const slot of [ch.weapon, ch.shield, ch.accessory]) {
    if (slot === null) continue;
    hooks.push(...need(ownGet(rules.gear, slot), "gear", slot).hooks);
  }
  return hooks;
}

function gearStat(rules: Rules, id: string | null, key: StatKey): number {
  return id === null ? 0 : need(ownGet(rules.gear, id), "gear", id).stats[key];
}

export function sheetStats(rules: Rules, ch: CharacterPublic): StatBlock {
  const { baseStats, growth } = rules.progression;
  const cls = need(ownGet(rules.classes, ch.classId), "class", ch.classId);
  const totals = applyPassives(activeHooks(rules, ch));
  return buildBlock((key) => {
    let x = baseStats[key] + growth[key] * (ch.level - 1);
    x = fl((x * cls.statBp[key]) / BP);
    x += gearStat(rules, ch.weapon, key);
    x += gearStat(rules, ch.shield, key);
    x += gearStat(rules, ch.accessory, key);
    return fl((x * (BP + totals[SHEET_HOOK[key]])) / BP);
  });
}

/** The monster / guardian / enforcer definition behind an NPC reference. */
export function npcDef(rules: Rules, ref: NpcRef): NpcBase {
  switch (ref.kind) {
    case "monster":
      return need(ownGet(rules.monsters, ref.id), "monster", ref.id);
    case "guardian":
      return need(ownGet(rules.guardians, ref.id), "guardian", ref.id);
    case "enforcer":
      return rules.enforcer;
  }
}

function npcCurve(rules: Rules, ref: NpcRef): StatBlock {
  switch (ref.kind) {
    case "monster": {
      const def = need(ownGet(rules.monsters, ref.id), "monster", ref.id);
      const index = def.tier - 1 + (ref.senior ? 1 : 0);
      return need(rules.npcCurve[index], "npc curve tier", String(index + 1));
    }
    case "guardian":
      return need(rules.npcCurve[ref.townTier], "npc curve tier", String(ref.townTier + 1));
    case "enforcer": {
      const { baseStats, growth } = rules.progression;
      return buildBlockRaw((key) => baseStats[key] + growth[key] * (ref.level - 1));
    }
  }
}

function buildBlockRaw(compute: (key: StatKey) => number): StatBlock {
  return Object.fromEntries(
    STAT_KEYS.map((key): [StatKey, number] => [key, compute(key)]),
  ) as StatBlock;
}

/** NPC stat snapshot; never reads hooks. */
export function npcStats(rules: Rules, ref: NpcRef): StatBlock {
  const curve = npcCurve(rules, ref);
  const def = npcDef(rules, ref);
  return buildBlock((key) => fl((curve[key] * def.statBp[key]) / BP));
}

/** atk/def/mag/spd take the battle mods (floored, min 0); hp and luck are unchanged. */
export function battleStats(stats: StatBlock, mods: BattleMods): StatBlock {
  const mod = (value: number, delta: number): number =>
    Math.max(0, fl((value * (BP + delta)) / BP));
  return {
    hp: stats.hp,
    atk: mod(stats.atk, mods.atk),
    def: mod(stats.def, mods.def),
    mag: mod(stats.mag, mods.mag),
    spd: mod(stats.spd, mods.spd),
    luck: stats.luck,
  };
}

/** HP after a sheet change outside combat: KO stays KO, otherwise gains (never losses) carry over. */
export function adjustHp(oldMax: number, newMax: number, hp: number): number {
  return hp === 0 ? 0 : Math.min(newMax, hp + Math.max(0, newMax - oldMax));
}
