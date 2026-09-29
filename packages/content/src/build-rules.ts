import type { z } from "zod";
import { MAX_COUNTER, type Rules } from "@usurpia/core";
import { CONTENT_REGISTRY, REQUIRED_FILES } from "./registry";
import { ClassesFileSchema, type ClassEntry, type ClassesFile } from "./schemas/classes";
import { GearFileSchema, type GearFile } from "./schemas/gear";
import { ItemsFileSchema, type ItemsFile } from "./schemas/items";
import { MonstersFileSchema, type MonstersFile } from "./schemas/monsters";
import { SpellsFileSchema, type SpellsFile } from "./schemas/spells";
import { TuningFileSchema, type TuningFile } from "./schemas/tuning";
import type { ContentEntry, ContentError } from "./validate";

export type BuildResult =
  | { readonly ok: true; readonly rules: Rules }
  | { readonly ok: false; readonly errors: ContentError[] };

interface ContentFiles {
  readonly classes: ClassesFile;
  readonly gear: GearFile;
  readonly items: ItemsFile;
  readonly monsters: MonstersFile;
  readonly spells: SpellsFile;
  readonly tuning: TuningFile;
}

const registry: Readonly<Record<string, z.ZodType>> = CONTENT_REGISTRY;
const ZONES: readonly string[] = [
  "enchanted-forest",
  "soggy-coast",
  "goblin-mines",
  "bureaucrat-bog",
];
const SHEET_STAT_HOOKS: readonly string[] = ["hpBp", "atkBp", "defBp", "magBp", "spdBp", "luckBp"];
const DISPLAY_KEYS: ReadonlySet<string> = new Set(["name", "description", "tagline"]);
const CURVE_TIERS = 5;
const MASTERY_RANKS = 5;
const PASSIVES_PER_CLASS = 5;
const ENFORCER_ID = "crown-enforcer";

// Cross-reference messages (one unique string per rule; listed in the 02-02 SUMMARY).
const MSG = {
  noBaseClass: "at least one base class is required",
  baseHasParents: "base class must not have parents",
  baseNeedsStarter: "base class requires a starter loadout",
  hybridNeedsParents: "hybrid class requires parents",
  hybridParentsDistinct: "hybrid parents must be two distinct base classes",
  hybridParentUnknown: "hybrid parent must be an existing class",
  hybridParentNotBase: "hybrid parent must be a base class",
  hybridHasStarter: "hybrid class must not have a starter",
  passivesLength: "passives must have exactly 5 entries",
  passiveRank: "passive rank must equal its position + 1",
  starterWeaponUnknown: "starter weapon must be an existing gear id",
  starterShieldUnknown: "starter shield must be an existing gear id",
  starterAccessoryUnknown: "starter accessory must be an existing gear id",
  starterWeaponSlot: "starter weapon must be a weapon",
  starterShieldSlot: "starter shield must be a shield",
  starterAccessorySlot: "starter accessory must be an accessory",
  starterBattleSpell: "starter battle spell must be an existing battle spell",
  starterWardSpell: "starter ward spell must be an existing ward spell",
  starterBagItem: "starter bag item must be an existing item",
  starterBagSize: "starter bag exceeds bagSize",
  aiBiasAttack: "aiBias attack+strike+spell must be greater than 0",
  aiBiasDefend: "aiBias guard+counter+ward must be greater than 0",
  npcBattleSpell: "npc battleSpell must be an existing battle spell",
  npcWardSpell: "npc wardSpell must be an existing ward spell",
  npcSpellWeight: "attackTable.spell must be 0 when battleSpell is null",
  npcAttackSum: "attackTable must sum to more than 0",
  npcDefendSum: "defendTable must sum to more than 0",
  npcSheetHook: "npc sheet-stat hooks are not applied",
  monsterZone: "monster zone must be one of the four zones",
  enforcerId: "enforcer id must be crown-enforcer",
  curveLength: "curve must have exactly 5 tiers",
  xpCurveLength: "xpCurve length must equal maxLevel",
  xpCurveFirst: "xpCurve[0] must be 0",
  xpCurveIncreasing: "xpCurve must be strictly increasing",
  xpCurveMax: "xpCurve values must not exceed MAX_COUNTER",
  masteryLength: "masteryWins must have exactly 5 entries",
  masteryFirst: "masteryWins[0] must be 0",
  masteryIncreasing: "masteryWins must be strictly increasing",
  hybridUnlockRank: "hybridUnlockRank must be between 1 and 5",
} as const;

function compareErrors(a: ContentError, b: ContentError): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  return 0;
}

const fail = (errors: ContentError[]): BuildResult => ({
  ok: false,
  errors: [...errors].sort(compareErrors),
});

function schemaFor(file: string): z.ZodType | undefined {
  return Object.hasOwn(registry, file) ? registry[file] : undefined;
}

/** Stage 1: every required file present, every file registered and valid JSON. */
function fileSetErrors(entries: readonly ContentEntry[]): ContentError[] {
  const errors: ContentError[] = [];
  const present = new Set(entries.map((entry) => entry.file));
  for (const required of REQUIRED_FILES) {
    if (!present.has(required)) {
      errors.push({ file: required, path: "", message: "missing required content file" });
    }
  }
  for (const { file, data } of entries) {
    if (schemaFor(file) === undefined) {
      errors.push({ file, path: "", message: "unknown content file (not in CONTENT_REGISTRY)" });
    } else if (data === undefined) {
      errors.push({ file, path: "", message: "invalid JSON" });
    }
  }
  return errors;
}

function parseFile<T>(
  file: string,
  schema: z.ZodType<T>,
  entries: readonly ContentEntry[],
  errors: ContentError[],
): T | undefined {
  const entry = entries.find((candidate) => candidate.file === file);
  const result = schema.safeParse(entry?.data);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    errors.push({ file, path: issue.path.join("."), message: issue.message });
  }
  return undefined;
}

/** Stage 3: duplicate ids per collection, reported at the later occurrence. */
function duplicateIdErrors(
  file: string,
  collection: string,
  items: readonly { readonly id: string }[],
): ContentError[] {
  const errors: ContentError[] = [];
  const firstIndexById = new Map<string, number>();
  items.forEach((item, index) => {
    const first = firstIndexById.get(item.id);
    if (first === undefined) {
      firstIndexById.set(item.id, index);
      return;
    }
    errors.push({
      file,
      path: `${collection}.${String(index)}.id`,
      message: `duplicate id "${item.id}" (first at ${collection}.${String(first)})`,
    });
  });
  return errors;
}

function duplicates(f: ContentFiles): ContentError[] {
  return [
    ...duplicateIdErrors("classes.json", "classes", f.classes.classes),
    ...duplicateIdErrors("gear.json", "gear", f.gear.gear),
    ...duplicateIdErrors("items.json", "items", f.items.items),
    ...duplicateIdErrors("spells.json", "battle", f.spells.battle),
    ...duplicateIdErrors("spells.json", "ward", f.spells.ward),
    ...duplicateIdErrors("spells.json", "field", f.spells.field),
    ...duplicateIdErrors("monsters.json", "monsters", f.monsters.monsters),
    ...duplicateIdErrors("monsters.json", "guardians", f.monsters.guardians),
  ];
}

/** Id lookups use Maps, never plain-object access, so prototype members are never found (PIT-002). */
function byId<T extends { readonly id: string }>(items: readonly T[]): ReadonlyMap<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function crossRefErrors(f: ContentFiles): ContentError[] {
  const errors: ContentError[] = [];
  const add = (file: string, path: string, message: string): void => {
    errors.push({ file, path, message });
  };
  const gear = byId(f.gear.gear);
  const items = byId(f.items.items);
  const battle = byId(f.spells.battle);
  const ward = byId(f.spells.ward);
  const classes = byId(f.classes.classes);

  checkClasses(f.classes.classes, { classes, gear, items, battle, ward }, add);
  checkNpcs(f.monsters, { battle, ward }, add);
  checkTables(f, add);
  return errors;
}

type Add = (file: string, path: string, message: string) => void;

interface Lookups {
  readonly classes: ReadonlyMap<string, ClassEntry>;
  readonly gear: ReadonlyMap<string, { readonly slot: string }>;
  readonly items: ReadonlyMap<string, unknown>;
  readonly battle: ReadonlyMap<string, unknown>;
  readonly ward: ReadonlyMap<string, unknown>;
}

function checkClasses(list: readonly ClassEntry[], lookups: Lookups, add: Add): void {
  const file = "classes.json";
  if (!list.some((c) => c.kind === "base")) add(file, "classes", MSG.noBaseClass);
  list.forEach((cls, i) => {
    const at = `classes.${String(i)}`;
    checkClassKind(cls, at, lookups.classes, add);
    if (cls.passives.length !== PASSIVES_PER_CLASS) add(file, `${at}.passives`, MSG.passivesLength);
    cls.passives.forEach((passive, j) => {
      if (passive.rank !== j + 1) add(file, `${at}.passives.${String(j)}.rank`, MSG.passiveRank);
    });
    if (cls.starter !== null) checkStarter(cls, cls.starter, `${at}.starter`, lookups, add);
    const { attack, strike, spell, guard, counter, ward } = cls.aiBias;
    if (attack + strike + spell <= 0) add(file, `${at}.aiBias`, MSG.aiBiasAttack);
    if (guard + counter + ward <= 0) add(file, `${at}.aiBias`, MSG.aiBiasDefend);
  });
}

function checkClassKind(
  cls: ClassEntry,
  at: string,
  classes: ReadonlyMap<string, ClassEntry>,
  add: Add,
): void {
  const file = "classes.json";
  if (cls.kind === "base") {
    if (cls.parents !== null) add(file, `${at}.parents`, MSG.baseHasParents);
    if (cls.starter === null) add(file, `${at}.starter`, MSG.baseNeedsStarter);
    return;
  }
  if (cls.starter !== null) add(file, `${at}.starter`, MSG.hybridHasStarter);
  if (cls.parents === null) {
    add(file, `${at}.parents`, MSG.hybridNeedsParents);
    return;
  }
  if (cls.parents[0] === cls.parents[1]) add(file, `${at}.parents.1`, MSG.hybridParentsDistinct);
  cls.parents.forEach((parentId, k) => {
    const parent = classes.get(parentId);
    if (parent === undefined) add(file, `${at}.parents.${String(k)}`, MSG.hybridParentUnknown);
    else if (parent.kind !== "base")
      add(file, `${at}.parents.${String(k)}`, MSG.hybridParentNotBase);
  });
}

function checkStarter(
  cls: ClassEntry,
  starter: NonNullable<ClassEntry["starter"]>,
  at: string,
  lookups: Lookups,
  add: Add,
): void {
  const file = "classes.json";
  const slots = [
    ["weapon", MSG.starterWeaponUnknown, MSG.starterWeaponSlot],
    ["shield", MSG.starterShieldUnknown, MSG.starterShieldSlot],
    ["accessory", MSG.starterAccessoryUnknown, MSG.starterAccessorySlot],
  ] as const;
  for (const [slot, unknownMessage, slotMessage] of slots) {
    const id = starter[slot];
    if (id === null) continue;
    const piece = lookups.gear.get(id);
    if (piece === undefined) add(file, `${at}.${slot}`, unknownMessage);
    else if (piece.slot !== slot) add(file, `${at}.${slot}`, slotMessage);
  }
  if (starter.battleSpell !== null && !lookups.battle.has(starter.battleSpell)) {
    add(file, `${at}.battleSpell`, MSG.starterBattleSpell);
  }
  if (starter.wardSpell !== null && !lookups.ward.has(starter.wardSpell)) {
    add(file, `${at}.wardSpell`, MSG.starterWardSpell);
  }
  starter.bag.forEach((itemId, k) => {
    if (!lookups.items.has(itemId)) add(file, `${at}.bag.${String(k)}`, MSG.starterBagItem);
  });
  if (starter.bag.length > cls.bagSize) add(file, `${at}.bag`, MSG.starterBagSize);
}

interface Npc {
  readonly battleSpell: string | null;
  readonly wardSpell: string | null;
  readonly attackTable: {
    readonly attack: number;
    readonly strike: number;
    readonly spell: number;
    readonly flee: number;
  };
  readonly defendTable: { readonly guard: number; readonly counter: number; readonly ward: number };
  readonly hooks: readonly { readonly hook: string }[];
}

function checkNpc(npc: Npc, at: string, lookups: Pick<Lookups, "battle" | "ward">, add: Add): void {
  const file = "monsters.json";
  if (npc.battleSpell !== null && !lookups.battle.has(npc.battleSpell)) {
    add(file, `${at}.battleSpell`, MSG.npcBattleSpell);
  }
  if (npc.wardSpell !== null && !lookups.ward.has(npc.wardSpell)) {
    add(file, `${at}.wardSpell`, MSG.npcWardSpell);
  }
  const { attack, strike, spell, flee } = npc.attackTable;
  if (npc.battleSpell === null && spell > 0)
    add(file, `${at}.attackTable.spell`, MSG.npcSpellWeight);
  if (attack + strike + spell + flee <= 0) add(file, `${at}.attackTable`, MSG.npcAttackSum);
  const { guard, counter, ward } = npc.defendTable;
  if (guard + counter + ward <= 0) add(file, `${at}.defendTable`, MSG.npcDefendSum);
  npc.hooks.forEach((hook, j) => {
    if (SHEET_STAT_HOOKS.includes(hook.hook))
      add(file, `${at}.hooks.${String(j)}.hook`, MSG.npcSheetHook);
  });
}

function checkNpcs(m: MonstersFile, lookups: Pick<Lookups, "battle" | "ward">, add: Add): void {
  m.monsters.forEach((monster, i) => {
    const at = `monsters.monsters.${String(i)}`;
    checkNpc(monster, at, lookups, add);
    if (!ZONES.includes(monster.zone)) add("monsters.json", `${at}.zone`, MSG.monsterZone);
  });
  m.guardians.forEach((guardian, i) => {
    checkNpc(guardian, `monsters.guardians.${String(i)}`, lookups, add);
  });
  checkNpc(m.enforcer, "monsters.enforcer", lookups, add);
  if (m.enforcer.id !== ENFORCER_ID) add("monsters.json", "monsters.enforcer.id", MSG.enforcerId);
  if (m.curve.length !== CURVE_TIERS) add("monsters.json", "curve", MSG.curveLength);
}

function strictlyIncreasingAt(values: readonly number[]): number[] {
  const bad: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const cur = values[i];
    if (prev !== undefined && cur !== undefined && cur <= prev) bad.push(i);
  }
  return bad;
}

function checkTables(f: ContentFiles, add: Add): void {
  const file = "tuning.json";
  const { maxLevel, xpCurve, masteryWins, hybridUnlockRank } = f.tuning.progression;
  if (xpCurve.length !== maxLevel) add(file, "progression.xpCurve", MSG.xpCurveLength);
  if (xpCurve.length > 0 && xpCurve[0] !== 0) add(file, "progression.xpCurve.0", MSG.xpCurveFirst);
  for (const i of strictlyIncreasingAt(xpCurve)) {
    add(file, `progression.xpCurve.${String(i)}`, MSG.xpCurveIncreasing);
  }
  xpCurve.forEach((xp, i) => {
    if (xp > MAX_COUNTER) add(file, `progression.xpCurve.${String(i)}`, MSG.xpCurveMax);
  });
  if (masteryWins.length !== MASTERY_RANKS) add(file, "progression.masteryWins", MSG.masteryLength);
  if (masteryWins.length > 0 && masteryWins[0] !== 0) {
    add(file, "progression.masteryWins.0", MSG.masteryFirst);
  }
  for (const i of strictlyIncreasingAt(masteryWins)) {
    add(file, `progression.masteryWins.${String(i)}`, MSG.masteryIncreasing);
  }
  if (hybridUnlockRank < 1 || hybridUnlockRank > MASTERY_RANKS) {
    add(file, "progression.hybridUnlockRank", MSG.hybridUnlockRank);
  }
}

/** Removes display text (`name`, `description`, `tagline`) at every level. */
function stripDisplayText(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripDisplayText);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !DISPLAY_KEYS.has(key))
        .map(([key, child]) => [key, stripDisplayText(child)]),
    );
  }
  return value;
}

function keyed(items: readonly { readonly id: string }[]): unknown {
  return Object.fromEntries(items.map((item) => [item.id, stripDisplayText(item)]));
}

function assemble(f: ContentFiles): Rules {
  // One documented cast: zod's output types are structurally equal to Rules except for the
  // literal-union numbers (tier, rank), which are range-checked by the schemas.
  return {
    v: 1,
    classes: keyed(f.classes.classes),
    gear: keyed(f.gear.gear),
    items: keyed(f.items.items),
    battleSpells: keyed(f.spells.battle),
    wardSpells: keyed(f.spells.ward),
    fieldSpells: keyed(f.spells.field),
    monsters: keyed(f.monsters.monsters),
    guardians: keyed(f.monsters.guardians),
    enforcer: stripDisplayText(f.monsters.enforcer),
    npcCurve: f.monsters.curve,
    combat: f.tuning.combat,
    progression: f.tuning.progression,
    economy: f.tuning.economy,
  } as Rules;
}

/**
 * The only producer of `Rules`. Stages run in order and stop after the first one that produced
 * errors: file set, schema, duplicate ids, cross-references, assemble.
 */
export function buildRules(entries: readonly ContentEntry[]): BuildResult {
  const setErrors = fileSetErrors(entries);
  if (setErrors.length > 0) return fail(setErrors);

  const schemaErrors: ContentError[] = [];
  const classes = parseFile("classes.json", ClassesFileSchema, entries, schemaErrors);
  const gear = parseFile("gear.json", GearFileSchema, entries, schemaErrors);
  const items = parseFile("items.json", ItemsFileSchema, entries, schemaErrors);
  const monsters = parseFile("monsters.json", MonstersFileSchema, entries, schemaErrors);
  const spells = parseFile("spells.json", SpellsFileSchema, entries, schemaErrors);
  const tuning = parseFile("tuning.json", TuningFileSchema, entries, schemaErrors);
  if (
    schemaErrors.length > 0 ||
    classes === undefined ||
    gear === undefined ||
    items === undefined ||
    monsters === undefined ||
    spells === undefined ||
    tuning === undefined
  ) {
    return fail(schemaErrors);
  }

  const files: ContentFiles = { classes, gear, items, monsters, spells, tuning };
  const duplicateErrors = duplicates(files);
  if (duplicateErrors.length > 0) return fail(duplicateErrors);
  const refErrors = crossRefErrors(files);
  if (refErrors.length > 0) return fail(refErrors);
  return { ok: true, rules: assemble(files) };
}
