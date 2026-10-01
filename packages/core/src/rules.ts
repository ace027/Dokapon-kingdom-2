// The data-only Rules contract (spec: `rules.ts` — the `Rules` contract). Core trusts a `Rules`
// value (it is validated by content's `buildRules` or is the typed TEST_RULES literal).
import { fnv1a32 } from "./hash";
import { stableStringify } from "./canonical";

export const RULES_VERSION = 1 as const;
export type ContentId = string; // CONTENT_ID_PATTERN and not in RESERVED_CONTENT_IDS
export const CONTENT_ID_PATTERN = /^[a-z][a-z0-9-]{0,47}$/;
export const RESERVED_CONTENT_IDS: readonly string[] = ["constructor", "prototype"];
export type StatKey = "hp" | "atk" | "def" | "mag" | "spd" | "luck";
export const STAT_KEYS: readonly StatKey[] = ["hp", "atk", "def", "mag", "spd", "luck"]; // canonical order
export type StatBlock = Readonly<Record<StatKey, number>>; // integers
export type ModStat = "atk" | "def" | "mag" | "spd";
export type AttackCommand = "attack" | "strike" | "spell";
export type DefendCommand = "guard" | "counter" | "ward";
export type Command = AttackCommand | DefendCommand;
export const ATTACK_COMMANDS: readonly AttackCommand[] = ["attack", "strike", "spell"];
export const DEFEND_COMMANDS: readonly DefendCommand[] = ["guard", "counter", "ward"];
export const COMMANDS: readonly Command[] = [
  "attack",
  "strike",
  "spell",
  "guard",
  "counter",
  "ward",
];

export const COMBAT_HOOKS = [
  "hpBp",
  "atkBp",
  "defBp",
  "magBp",
  "spdBp",
  "luckBp", // sheet-stat bonus (bp)
  "attackDmgBp",
  "strikeDmgBp",
  "spellDmgBp", // outgoing damage bonus per command (bp)
  "guardVsStrikeBp", // as defender with Guard vs Strike: damage × (10000 − min(10000, v)) / 10000
  "counterDmgBp", // as defender, Strike×Counter reflection × (10000 + v) / 10000
  "wardReflectBp", // as defender with Ward vs Spell: reflect v bp of the unwarded spell damage (adds to Reflect spell)
  "critBp",
  "fleeBp", // + crit chance / + flee chance (bp)
  "lifestealBp", // attacker heals v bp of Attack/Strike damage dealt
  "roundRegenBp", // heal v bp of max HP at each round end
  "spellTakenBp",
  "physTakenBp", // as defender: spell / physical damage × max(0, 10000 + v) / 10000
  "spellbladeStrike", // bespoke Spellblade hook (see resolve)
  "poisonOnHit",
  "stealGoldOnHitBp",
  "stealItemOnHit", // on-hit hooks (used by monsters)
] as const;
export const BOARD_HOOKS = [
  "pvpExtraSteal",
  "passPickpocketBp",
  "spellPriceBp",
  "fieldSpellMove",
  "turnRegenBp",
  "townTaxBp",
  "crownTaxResistBp",
  "lootLuckBp",
] as const; // accepted, summed by nobody in Phase 2 (Phase 3/5 implement)
export type CombatHook = (typeof COMBAT_HOOKS)[number];
export type BoardHook = (typeof BOARD_HOOKS)[number];
export type HookName = CombatHook | BoardHook;
export interface Hook {
  readonly hook: HookName;
  readonly value: number;
} // int in [-10000, 100000]
export interface PassiveDef extends Hook {
  readonly rank: 1 | 2 | 3 | 4 | 5;
  readonly id: ContentId;
}
export type CommandWeights = Readonly<Record<Command, number>>; // ints 0..100

export interface Loadout {
  readonly weapon: ContentId | null;
  readonly shield: ContentId | null;
  readonly accessory: ContentId | null;
  readonly battleSpell: ContentId | null;
  readonly wardSpell: ContentId | null;
  readonly bag: readonly ContentId[];
}
export interface ClassDef {
  readonly id: ContentId;
  readonly kind: "base" | "hybrid";
  readonly parents: readonly [ContentId, ContentId] | null; // hybrid only: two distinct base classes
  readonly statBp: StatBlock; // class multiplier per stat (bp, 1..100000)
  readonly bagSize: number; // 1..16
  readonly switchFee: number; // gold, 0..1_000_000
  readonly passives: readonly PassiveDef[]; // exactly 5, passives[i].rank === i + 1
  readonly starter: Loadout | null; // base: non-null; hybrid: null
  readonly aiBias: CommandWeights; // AI base table (Easy uses it directly)
}
export type GearSlot = "weapon" | "shield" | "accessory";
export interface GearDef {
  readonly id: ContentId;
  readonly slot: GearSlot;
  readonly tier: 1 | 2 | 3 | 4 | 5;
  readonly price: number;
  readonly stats: StatBlock;
  /* flat, ints −999..999 */ readonly hooks: readonly Hook[];
}
export type ItemUse = "combat" | "board" | "both" | "none";
export type BoardItemTag = "spinBonus" | "spinFixed" | "warpCastle" | "pickSpin" | "blockGoldSteal";
export type JokeTag = "decoyGoldBag" | "cursedWig" | "whoopeeScroll" | "royalSummons" | "bagOfBees";
export type ItemEffect =
  | { readonly kind: "heal"; readonly bp: number }
  | { readonly kind: "cleanse" }
  | { readonly kind: "flee" }
  | { readonly kind: "mod"; readonly stat: ModStat; readonly bp: number }
  | { readonly kind: "board"; readonly tag: BoardItemTag; readonly value: number }
  | { readonly kind: "joke"; readonly tag: JokeTag };
export interface ItemDef {
  readonly id: ContentId;
  readonly kind: "consumable" | "joke";
  readonly price: number;
  readonly use: ItemUse;
  readonly effect: ItemEffect;
}
export type SpellEffect =
  | { readonly kind: "none" }
  | { readonly kind: "stun"; readonly chanceBp: number }
  | { readonly kind: "mod"; readonly stat: ModStat; readonly bp: number }
  | { readonly kind: "drain"; readonly bp: number }
  | { readonly kind: "stealGold"; readonly bp: number };
export interface BattleSpellDef {
  readonly id: ContentId;
  readonly tier: 1 | 2 | 3 | 4 | 5;
  readonly price: number;
  readonly powerBp: number;
  /* 0 = no damage */ readonly effect: SpellEffect;
}
export type WardMode = "barrier" | "reflect" | "absorb" | "counterspell";
export interface WardSpellDef {
  readonly id: ContentId;
  readonly tier: 1 | 2 | 3 | 4 | 5;
  readonly price: number;
  readonly mode: WardMode;
  readonly valueBp: number;
}
export type FieldSpellTag =
  | "spinTwiceHigher"
  | "spinCap"
  | "seizeTown"
  | "fullHealCleanse"
  | "hideAndImmune"
  | "doubleGoldSpace"
  | "swapPositions"
  | "blockFieldSpells";
export interface FieldSpellDef {
  readonly id: ContentId;
  readonly tier: 1 | 2 | 3 | 4 | 5;
  readonly price: number;
  readonly tag: FieldSpellTag;
  readonly value: number;
  readonly duration: number;
}
export interface AttackTable {
  readonly attack: number;
  readonly strike: number;
  readonly spell: number;
  readonly flee: number;
} // ints 0..1000
export interface DefendTable {
  readonly guard: number;
  readonly counter: number;
  readonly ward: number;
}
export interface NpcBase {
  readonly statBp: StatBlock;
  readonly attackTable: AttackTable;
  readonly defendTable: DefendTable;
  readonly battleSpell: ContentId | null;
  readonly wardSpell: ContentId | null;
  readonly hooks: readonly Hook[];
}
export interface MonsterDef extends NpcBase {
  readonly id: ContentId;
  readonly tier: 1 | 2 | 3 | 4;
  readonly zone: ContentId;
  readonly xp: number;
  readonly gold: number;
}
export interface GuardianDef extends NpcBase {
  readonly id: ContentId;
  readonly style: "magic" | "physical" | "balanced";
  readonly xpPerTier: number;
  readonly goldPerTier: number;
}
export interface EnforcerDef extends NpcBase {
  readonly id: ContentId;
  readonly xpPerLevel: number;
  readonly goldPerLevel: number;
}
export interface MatrixRow {
  readonly guard: number;
  readonly counter: number;
  readonly ward: number;
  readonly open: number;
} // bp
export interface CombatTuning {
  readonly kBp: number;
  readonly jBp: number;
  readonly jMagBp: number;
  readonly matrix: {
    readonly attack: MatrixRow;
    readonly strike: MatrixRow;
    readonly spell: MatrixRow;
  }; // strike.counter = reflection multiplier (damage to the ATTACKER)
  readonly critBaseBp: number;
  readonly critPerLuckBp: number;
  readonly critCapBp: number;
  readonly critMultBp: number;
  readonly maxRounds: number; // 1..10
  readonly fleeBaseBp: number;
  readonly fleePerSpdBp: number;
  readonly fleeMinBp: number;
  readonly fleeMaxBp: number;
  readonly modMinBp: number;
  readonly modMaxBp: number;
  readonly poisonBp: number;
  readonly seniorRewardBp: number;
  readonly pvpXpPerLevel: number;
}
export interface ProgressionTuning {
  readonly maxLevel: number; // 1..99
  readonly xpCurve: readonly number[]; // length maxLevel; [0] = 0; strictly increasing; cumulative XP to reach level i+1
  readonly baseStats: StatBlock; // level-1 stats before class multiplier
  readonly growth: StatBlock; // added per level above 1
  readonly masteryWins: readonly number[]; // length 5; [0] = 0; strictly increasing; wins needed for rank i+1
  readonly hybridUnlockRank: number; // 1..5
}
export interface EconomyTuning {
  readonly startingGold: number;
  readonly maxScrolls: number;
} // maxScrolls 0..9
export interface Rules {
  readonly v: typeof RULES_VERSION;
  readonly classes: Readonly<Record<ContentId, ClassDef>>;
  readonly gear: Readonly<Record<ContentId, GearDef>>;
  readonly items: Readonly<Record<ContentId, ItemDef>>;
  readonly battleSpells: Readonly<Record<ContentId, BattleSpellDef>>;
  readonly wardSpells: Readonly<Record<ContentId, WardSpellDef>>;
  readonly fieldSpells: Readonly<Record<ContentId, FieldSpellDef>>;
  readonly monsters: Readonly<Record<ContentId, MonsterDef>>;
  readonly guardians: Readonly<Record<ContentId, GuardianDef>>;
  readonly enforcer: EnforcerDef;
  readonly npcCurve: readonly StatBlock[]; // exactly 5 entries: tiers T1..T5
  readonly combat: CombatTuning;
  readonly progression: ProgressionTuning;
  readonly economy: EconomyTuning;
}

/** `fnv1a32(stableStringify(rules))`: independent of key insertion order. */
export function rulesHash(rules: Rules): string {
  return fnv1a32(stableStringify(rules));
}

/** Max rank `r` in 1..5 with `wins >= masteryWins[r - 1]`. */
export function masteryRank(rules: Rules, wins: number): 1 | 2 | 3 | 4 | 5 {
  const thresholds = rules.progression.masteryWins;
  let rank: 1 | 2 | 3 | 4 | 5 = 1;
  const ranks = [1, 2, 3, 4, 5] as const;
  for (const r of ranks) {
    const needed = thresholds[r - 1];
    if (needed !== undefined && wins >= needed) rank = r;
  }
  return rank;
}

/** Max level `L` with `xp >= xpCurve[L - 1]`. */
export function levelForXp(rules: Rules, xp: number): number {
  const curve = rules.progression.xpCurve;
  let level = 1;
  for (let i = 0; i < curve.length; i++) {
    const needed = curve[i];
    if (needed !== undefined && xp >= needed) level = i + 1;
  }
  return level;
}
