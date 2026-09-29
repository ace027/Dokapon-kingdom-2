import type { ContentId, Rules } from "@usurpia/core";

/** One equipment row: weapon, shield, accessory, battle spell, ward spell. */
export interface KitRow {
  readonly weapon: ContentId | null;
  readonly shield: ContentId | null;
  readonly accessory: ContentId | null;
  readonly battleSpell: ContentId | null;
  readonly wardSpell: ContentId | null;
}

type Tuple = readonly [ContentId, ContentId, ContentId | null, ContentId, ContentId | null];

function rows(...tiers: readonly [Tuple, Tuple, Tuple, Tuple]): readonly KitRow[] {
  return tiers.map(([weapon, shield, accessory, battleSpell, wardSpell]) => ({
    weapon,
    shield,
    accessory,
    battleSpell,
    wardSpell,
  }));
}

/** Per class, the equipment for character tiers 1..4 (spec: Kits). */
export const KITS: Readonly<Record<ContentId, readonly KitRow[]>> = {
  warrior: rows(
    ["wooden-sword", "pot-lid", null, "spark", null],
    ["bronze-blade", "buckler", "lucky-sock", "spark", "barrier"],
    ["knights-saber", "tower-shield", "speed-anklet", "fireball", "barrier"],
    ["royal-claymore", "aegis-of-usurpia", "crown-ward-amulet", "fireball", "reflect"],
  ),
  thief: rows(
    ["wooden-sword", "pot-lid", "lucky-sock", "spark", null],
    ["bronze-blade", "buckler", "speed-anklet", "pickpocket-bolt", "barrier"],
    ["goblin-cleaver", "buckler", "speed-anklet", "frostbite", "barrier"],
    ["royal-claymore", "mirror-shield", "speed-anklet", "thunderclap", "reflect"],
  ),
  mage: rows(
    ["wooden-sword", "pot-lid", null, "fireball", "barrier"],
    ["wooden-sword", "buckler", "mage-ring", "fireball", "barrier"],
    ["bronze-blade", "mirror-shield", "mage-ring", "thunderclap", "reflect"],
    ["knights-saber", "aegis-of-usurpia", "mage-ring", "royal-decree", "absorb"],
  ),
  cleric: rows(
    ["wooden-sword", "pot-lid", null, "drain", "barrier"],
    ["bronze-blade", "buckler", "mage-ring", "drain", "barrier"],
    ["knights-saber", "mirror-shield", "mage-ring", "drain", "absorb"],
    ["goblin-cleaver", "aegis-of-usurpia", "mage-ring", "drain", "counterspell"],
  ),
  spellblade: rows(
    ["wooden-sword", "pot-lid", null, "spark", null],
    ["bronze-blade", "buckler", "mage-ring", "fireball", "barrier"],
    ["knights-saber", "tower-shield", "mage-ring", "thunderclap", "barrier"],
    ["royal-claymore", "aegis-of-usurpia", "mage-ring", "thunderclap", "reflect"],
  ),
  shadowpriest: rows(
    ["wooden-sword", "pot-lid", "lucky-sock", "drain", null],
    ["bronze-blade", "buckler", "speed-anklet", "drain", "barrier"],
    ["goblin-cleaver", "mirror-shield", "speed-anklet", "drain", "absorb"],
    ["royal-claymore", "aegis-of-usurpia", "speed-anklet", "drain", "counterspell"],
  ),
};

/** The character level a monster of tier `i + 1` is fought at. */
export const TIER_LEVEL = [1, 5, 9, 13] as const;

/** Kit tier (1..4) for a character level. */
export function tierForLevel(level: number): 1 | 2 | 3 | 4 {
  return level >= 13 ? 4 : level >= 9 ? 3 : level >= 5 ? 2 : 1;
}

/** The base class a seat is created with: a hybrid is seated as `parents[0]`, then set by `setCharacter`. */
export function seatClass(rules: Rules, classId: ContentId): ContentId {
  if (!Object.hasOwn(rules.classes, classId)) throw new Error(`unknown class ${classId}`);
  const def = rules.classes[classId];
  const parent = def?.parents?.[0];
  return def?.kind === "hybrid" && parent !== undefined ? parent : classId;
}
