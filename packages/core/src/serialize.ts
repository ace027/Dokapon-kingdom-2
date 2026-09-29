import { attackerOptions, DEFENDER_OPTIONS, exchangeRoles, requiredFor } from "./combat/options";
import { npcStats, sheetStats } from "./combat/stats";
import { fnv1a32 } from "./hash";
import { COMMANDS, levelForXp, masteryRank, STAT_KEYS, type GearSlot, type Rules } from "./rules";
import {
  CHOICE_PATTERN,
  MAX_COUNTER,
  MAX_STAT,
  SCHEMA_VERSION,
  type CharacterPublic,
  type CombatState,
  type GameState,
  type NpcRef,
} from "./types";
import { clip, isPlainObject, isUnique, ownGet, playersError } from "./validation";

export class SchemaVersionError extends Error {
  override name = "SchemaVersionError";
}

function compareKeys(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function write(value: unknown, path: string): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`stableStringify: non-finite number at ${path}`);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items: unknown[] = value;
    const parts: string[] = [];
    for (let i = 0; i < items.length; i++) {
      parts.push(write(items[i], `${path}[${i}]`));
    }
    return `[${parts.join(",")}]`;
  }
  if (isPlainObject(value)) {
    const parts: string[] = [];
    for (const key of Object.keys(value).sort(compareKeys)) {
      parts.push(`${JSON.stringify(key)}:${write(value[key], `${path}.${key}`)}`);
    }
    return `{${parts.join(",")}}`;
  }
  throw new TypeError(`stableStringify: unsupported ${typeof value} value at ${path}`);
}

/**
 * Canonical JSON: object keys sorted by UTF-16 code units. Throws `TypeError` (naming the
 * offending path, e.g. `$.hidden.rng[2]`) on undefined, functions, symbols, bigints,
 * non-finite numbers and non-plain objects.
 */
export function stableStringify(value: unknown): string {
  return write(value, "$");
}

export function hashState(state: GameState): string {
  return fnv1a32(stableStringify(state));
}

export function serialize(state: GameState): string {
  return stableStringify(state);
}

// Import-cycle guard: `rules.ts` imports `stableStringify` from this module, and this module
// imports `levelForXp`/`masteryRank`/`sheetStats`/`COMMANDS`. Those values are used only inside
// function bodies below, never in a module-top-level constant.
const ROOT_KEYS = ["v", "public", "private", "hidden"] as const;
const PUBLIC_KEYS = [
  "phase",
  "turn",
  "activePlayer",
  "players",
  "characters",
  "choiceHistory",
  "pending",
  "lastReveal",
  "combat",
] as const;
const HIDDEN_KEYS = ["rng", "decisionSeq", "combatSeq", "decision"] as const;
const CHARACTER_KEYS = [
  "classId",
  "level",
  "xp",
  "hp",
  "gold",
  "mastery",
  "portable",
  "weapon",
  "shield",
  "accessory",
  "battleSpell",
  "wardSpell",
] as const;
const PRIVATE_KEYS = ["bag", "scrolls", "prompt"] as const;
const PROMPT_KEYS = ["decisionId", "options", "default"] as const;
const PENDING_KEYS = ["id", "kind", "required", "committed"] as const;
const HIDDEN_DECISION_KEYS = ["id", "choices"] as const;
const LAST_REVEAL_KEYS = ["decisionId", "kind", "choices", "timedOut"] as const;
const COMBAT_KEYS = ["id", "round", "exchange", "first", "sides"] as const;
const PLAYER_SIDE_KEYS = ["kind", "playerId", "mods"] as const;
const NPC_SIDE_KEYS = ["kind", "npc", "stats", "hp", "mods"] as const;
const MODS_KEYS = ["atk", "def", "mag", "spd", "poison", "stun"] as const;
const MOD_STATS = ["atk", "def", "mag", "spd"] as const;
const GEAR_SLOTS: readonly GearSlot[] = ["weapon", "shield", "accessory"];
const DECISION_KINDS: readonly unknown[] = ["poll", "combat/exchange"];
const MAX_PROMPT_OPTIONS = 24;
const U32_MAX = 2 ** 32 - 1;

type Obj = Record<string, unknown>;

/** Every failure is a `TypeError("deserialize: <message>")`; each check has its own message. */
function bad(message: string): never {
  throw new TypeError(`deserialize: ${message}`);
}

function isIntIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isToken(value: unknown): value is string {
  return typeof value === "string" && CHOICE_PATTERN.test(value);
}

function asObject(value: unknown, where: string): Obj {
  if (!isPlainObject(value)) bad(`${where} must be an object`);
  return value;
}

function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) bad(`${where} must be an array`);
  return value as unknown[];
}

/** Exact own keys: none missing, none unexpected. */
function exactKeys(o: Obj, keys: readonly string[], where: string): void {
  for (const key of keys) {
    if (!Object.hasOwn(o, key)) bad(`${where} is missing key "${key}"`);
  }
  for (const key of Object.keys(o)) {
    if (!keys.includes(key)) bad(`${where} has unexpected key "${clip(key)}"`);
  }
}

/** The own keys of `o` are exactly the seated players. */
function playerKeys(o: Obj, players: readonly string[], where: string): void {
  for (const id of players) {
    if (!Object.hasOwn(o, id)) bad(`${where} is missing player "${clip(id)}"`);
  }
  for (const id of Object.keys(o)) {
    if (!players.includes(id)) bad(`${where} has unexpected player "${clip(id)}"`);
  }
}

function checkCharacter(rules: Rules, id: string, value: unknown): void {
  const where = `characters.${clip(id)}`;
  const ch = asObject(value, where);
  exactKeys(ch, CHARACTER_KEYS, where);
  const cls = typeof ch.classId === "string" ? ownGet(rules.classes, ch.classId) : undefined;
  if (cls === undefined) bad(`${where}.classId is not a known class`);
  if (!isIntIn(ch.level, 1, rules.progression.maxLevel)) bad(`${where}.level out of range`);
  if (!isIntIn(ch.xp, 0, MAX_COUNTER)) bad(`${where}.xp out of range`);
  if (ch.level !== levelForXp(rules, ch.xp)) bad(`${where}.level does not match xp`);
  if (!isIntIn(ch.gold, 0, MAX_COUNTER)) bad(`${where}.gold out of range`);
  const mastery = asObject(ch.mastery, `${where}.mastery`);
  const classIds = Object.keys(rules.classes);
  for (const classId of classIds) {
    if (!Object.hasOwn(mastery, classId)) bad(`${where}.mastery is missing class "${classId}"`);
  }
  for (const key of Object.keys(mastery)) {
    if (!classIds.includes(key)) bad(`${where}.mastery has unexpected class "${clip(key)}"`);
  }
  for (const classId of classIds) {
    if (!isIntIn(mastery[classId], 0, MAX_COUNTER)) bad(`${where}.mastery.${classId} out of range`);
  }
  if (ch.portable !== null) {
    const portable =
      typeof ch.portable === "string" ? ownGet(rules.classes, ch.portable) : undefined;
    if (portable === undefined) bad(`${where}.portable is not a known class`);
    if (masteryRank(rules, mastery[ch.portable as string] as number) !== 5) {
      bad(`${where}.portable requires mastery rank 5`);
    }
  }
  for (const slot of GEAR_SLOTS) {
    const gearId = ch[slot];
    if (gearId === null) continue;
    const gear = typeof gearId === "string" ? ownGet(rules.gear, gearId) : undefined;
    if (gear === undefined) bad(`${where}.${slot} is unknown gear`);
    if (gear.slot !== slot) bad(`${where}.${slot} is in the wrong slot`);
  }
  if (ch.battleSpell !== null) {
    const spell =
      typeof ch.battleSpell === "string" ? ownGet(rules.battleSpells, ch.battleSpell) : undefined;
    if (spell === undefined) bad(`${where}.battleSpell is unknown`);
  }
  if (ch.wardSpell !== null) {
    const ward =
      typeof ch.wardSpell === "string" ? ownGet(rules.wardSpells, ch.wardSpell) : undefined;
    if (ward === undefined) bad(`${where}.wardSpell is unknown`);
  }
  if (!isIntIn(ch.hp, 0, MAX_STAT)) bad(`${where}.hp out of range`);
  // safe: every field the sheet reads was validated above.
  if (ch.hp > sheetStats(rules, ch as unknown as CharacterPublic).hp) {
    bad(`${where}.hp exceeds max hp`);
  }
}

function checkChoiceHistory(history: unknown, players: readonly string[]): void {
  const all = asObject(history, "choiceHistory");
  playerKeys(all, players, "choiceHistory");
  for (const id of players) {
    const where = `choiceHistory.${clip(id)}`;
    const counts = asObject(all[id], where);
    exactKeys(counts, COMMANDS, where);
    for (const command of COMMANDS) {
      if (!isIntIn(counts[command], 0, MAX_COUNTER)) bad(`${where}.${command} out of range`);
    }
  }
}

/** Returns the validated prompt (or null) of one private partition. */
function checkPrompt(prompt: unknown, where: string): Obj | null {
  if (prompt === null) return null;
  const p = asObject(prompt, where);
  exactKeys(p, PROMPT_KEYS, where);
  if (typeof p.decisionId !== "string") bad(`${where}.decisionId must be a string`);
  const options = p.options;
  if (!Array.isArray(options) || options.length < 1 || options.length > MAX_PROMPT_OPTIONS) {
    bad(`${where}.options must hold 1-${MAX_PROMPT_OPTIONS} tokens`);
  }
  if (!options.every(isToken)) bad(`${where}.options must be tokens`);
  if (!isUnique(options)) bad(`${where}.options must be unique`);
  if (!isToken(p.default) || !options.includes(p.default)) {
    bad(`${where}.default must be one of the options`);
  }
  return p;
}

function checkPrivate(rules: Rules, value: unknown, players: readonly string[], chars: Obj): Obj {
  const all = asObject(value, "private");
  playerKeys(all, players, "private");
  for (const id of players) {
    const where = `private.${clip(id)}`;
    const priv = asObject(all[id], where);
    exactKeys(priv, PRIVATE_KEYS, where);
    const bag = asArray(priv.bag, `${where}.bag`);
    if (!bag.every((item) => typeof item === "string" && ownGet(rules.items, item) !== undefined)) {
      bad(`${where}.bag has an unknown item`);
    }
    const cls = ownGet(rules.classes, (chars[id] as Obj).classId as string);
    if (cls === undefined || bag.length > cls.bagSize) bad(`${where}.bag exceeds bag size`);
    const scrolls = asArray(priv.scrolls, `${where}.scrolls`);
    if (
      !scrolls.every((s) => typeof s === "string" && ownGet(rules.fieldSpells, s) !== undefined)
    ) {
      bad(`${where}.scrolls has an unknown field spell`);
    }
    if (scrolls.length > rules.economy.maxScrolls) bad(`${where}.scrolls exceeds maxScrolls`);
    checkPrompt(priv.prompt, `${where}.prompt`);
  }
  return all;
}

function checkTurnPhase(pub: Obj, hidden: Obj, priv: Obj, players: readonly string[]): void {
  if (pub.pending !== null) bad("turn phase must have no pending decision");
  if (hidden.decision !== null) bad("turn phase must have no hidden decision");
  if (!players.every((id) => (priv[id] as Obj).prompt === null)) {
    bad("turn phase must have no prompts");
  }
}

function subsetOf(values: readonly unknown[], of: readonly unknown[]): boolean {
  return values.every((v) => of.includes(v));
}

function checkDecisionPhase(pub: Obj, hidden: Obj, priv: Obj, players: readonly string[]): void {
  if (pub.pending === null) bad("decision phase requires a pending decision");
  const pending = asObject(pub.pending, "pending");
  exactKeys(pending, PENDING_KEYS, "pending");
  if (pending.id !== `d${hidden.decisionSeq as number}`)
    bad("pending.id does not match decisionSeq");
  if (!DECISION_KINDS.includes(pending.kind)) bad("pending.kind is unknown");
  const required = asArray(pending.required, "pending.required");
  if (required.length === 0) bad("pending.required must not be empty");
  if (!isUnique(required)) bad("pending.required must be unique");
  if (!subsetOf(required, players)) bad("pending.required must be seated players");
  const committed = asArray(pending.committed, "pending.committed");
  if (!isUnique(committed)) bad("pending.committed must be unique");
  if (!subsetOf(committed, required)) bad("pending.committed must be a subset of required");
  if (committed.length >= required.length) bad("pending.committed must be fewer than required");

  for (const id of players) {
    const where = `private.${clip(id)}.prompt`;
    const prompt = (priv[id] as Obj).prompt as Obj | null;
    if (required.includes(id) && prompt === null) bad(`${where} is required`);
    if (!required.includes(id) && prompt !== null)
      bad(`${where} must be null for a non-required player`);
    if (prompt !== null && prompt.decisionId !== pending.id) {
      bad(`${where}.decisionId does not match pending.id`);
    }
  }

  const decision = asObject(hidden.decision ?? undefined, "hidden.decision");
  exactKeys(decision, HIDDEN_DECISION_KEYS, "hidden.decision");
  if (decision.id !== pending.id) bad("hidden.decision.id does not match pending.id");
  const choices = asObject(decision.choices, "hidden.decision.choices");
  if (!subsetOf(Object.keys(choices), committed) || !subsetOf(committed, Object.keys(choices))) {
    bad("hidden.decision.choices keys do not match committed");
  }
  for (const id of committed as string[]) {
    const prompt = (priv[id] as Obj).prompt as Obj;
    if (!(prompt.options as unknown[]).includes(choices[id])) {
      bad(`hidden.decision.choices.${clip(id)} is not one of the options`);
    }
  }
}

function checkLastReveal(value: unknown, players: readonly string[]): void {
  if (value === null) return;
  const reveal = asObject(value, "lastReveal");
  exactKeys(reveal, LAST_REVEAL_KEYS, "lastReveal");
  if (typeof reveal.decisionId !== "string") bad("lastReveal.decisionId must be a string");
  if (!DECISION_KINDS.includes(reveal.kind)) bad("lastReveal.kind is unknown");
  const choices = asObject(reveal.choices, "lastReveal.choices");
  const keys = Object.keys(choices);
  if (!subsetOf(keys, players)) bad("lastReveal.choices has an unseated player");
  for (const id of keys) {
    if (!isToken(choices[id])) bad(`lastReveal.choices.${clip(id)} must be a token`);
  }
  const timedOut = asArray(reveal.timedOut, "lastReveal.timedOut");
  if (!isUnique(timedOut)) bad("lastReveal.timedOut must be unique");
  if (!subsetOf(timedOut, keys)) bad("lastReveal.timedOut must be a subset of the choice keys");
}

function checkMods(rules: Rules, mods: unknown, where: string): void {
  const m = asObject(mods, `${where}.mods`);
  exactKeys(m, MODS_KEYS, `${where}.mods`);
  for (const stat of MOD_STATS) {
    if (!isIntIn(m[stat], rules.combat.modMinBp, rules.combat.modMaxBp)) {
      bad(`${where}.mods.${stat} out of range`);
    }
  }
  if (typeof m.poison !== "boolean") bad(`${where}.mods.poison must be a boolean`);
  if (typeof m.stun !== "boolean") bad(`${where}.mods.stun must be a boolean`);
}

/** Validates an NPC reference (ids exist, tiers and levels in range) and returns it. */
function checkNpcRef(rules: Rules, value: unknown, where: string): NpcRef {
  const npc = asObject(value, `${where}.npc`);
  switch (npc.kind) {
    case "monster":
      exactKeys(npc, ["kind", "id", "senior"], `${where}.npc`);
      if (typeof npc.id !== "string" || ownGet(rules.monsters, npc.id) === undefined) {
        bad(`${where}.npc is an unknown monster`);
      }
      if (typeof npc.senior !== "boolean") bad(`${where}.npc.senior must be a boolean`);
      break;
    case "guardian":
      exactKeys(npc, ["kind", "id", "townTier"], `${where}.npc`);
      if (typeof npc.id !== "string" || ownGet(rules.guardians, npc.id) === undefined) {
        bad(`${where}.npc is an unknown guardian`);
      }
      if (!isIntIn(npc.townTier, 1, 4)) bad(`${where}.npc.townTier out of range`);
      break;
    case "enforcer":
      exactKeys(npc, ["kind", "level"], `${where}.npc`);
      if (!isIntIn(npc.level, 1, rules.progression.maxLevel)) {
        bad(`${where}.npc.level out of range`);
      }
      break;
    default:
      bad(`${where}.npc.kind is unknown`);
  }
  // safe: kind, keys and every field of the reference were verified above.
  return npc as unknown as NpcRef;
}

function checkCombatSide(rules: Rules, value: unknown, index: number, players: readonly string[]) {
  const where = `combat.sides[${index}]`;
  const side = asObject(value, where);
  if (side.kind === "player") {
    exactKeys(side, PLAYER_SIDE_KEYS, where);
    if (typeof side.playerId !== "string" || !players.includes(side.playerId)) {
      bad(`${where}.playerId is not a seated player`);
    }
    checkMods(rules, side.mods, where);
    return;
  }
  if (index === 0) bad("combat.sides[0] must be a player side");
  if (side.kind !== "npc") bad(`${where}.kind is unknown`);
  exactKeys(side, NPC_SIDE_KEYS, where);
  const npc = checkNpcRef(rules, side.npc, where);
  const stats = asObject(side.stats, `${where}.stats`);
  exactKeys(stats, STAT_KEYS, `${where}.stats`);
  const expected = npcStats(rules, npc);
  if (!STAT_KEYS.every((key) => stats[key] === expected[key])) {
    bad(`${where}.stats does not match the npc snapshot`);
  }
  if (!isIntIn(side.hp, 1, expected.hp)) bad(`${where}.hp out of range`);
  checkMods(rules, side.mods, where);
}

function sameStrings(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/** Check 8: the combat state and its consistency with the open `combat/exchange` decision. */
function checkCombat(
  rules: Rules,
  pub: Obj,
  hidden: Obj,
  priv: Obj,
  chars: Obj,
  players: readonly string[],
): void {
  const pending = isPlainObject(pub.pending) ? pub.pending : null;
  const combatDecision = pending !== null && pending.kind === "combat/exchange";
  if (pub.combat === null) {
    if (combatDecision) bad("combat/exchange decision requires combat");
    return;
  }
  if (pending === null || !combatDecision) bad("combat requires a combat/exchange decision");
  const combat = asObject(pub.combat, "combat");
  exactKeys(combat, COMBAT_KEYS, "combat");
  if (combat.id !== `c${hidden.combatSeq as number}`) bad("combat.id does not match combatSeq");
  if (!isIntIn(combat.round, 1, rules.combat.maxRounds)) bad("combat.round out of range");
  if (!isIntIn(combat.exchange, 1, 2)) bad("combat.exchange must be 1 or 2");
  if (!isIntIn(combat.first, 0, 1)) bad("combat.first must be 0 or 1");
  const sides = asArray(combat.sides, "combat.sides");
  if (sides.length !== 2) bad("combat.sides must hold two sides");
  sides.forEach((side, index) => {
    checkCombatSide(rules, side, index, players);
  });
  const playerIds = sides.flatMap((side) => {
    const s = side as Obj;
    return s.kind === "player" ? [s.playerId as string] : [];
  });
  if (!isUnique(playerIds)) bad("combat.sides must not repeat a player");
  for (const id of playerIds) {
    if ((ownGet(chars, id) as Obj).hp === 0) bad(`combat side ${clip(id)} is knocked out`);
  }

  // safe: every side, mod and reference was verified above.
  const state = combat as unknown as CombatState;
  const required = requiredFor(state);
  if (!sameStrings(pending.required as unknown[], required)) {
    bad("pending.required does not match the combat exchange");
  }
  for (const id of required) {
    const character = ownGet(chars, id) as CharacterPublic;
    const prompt = (ownGet(priv, id) as Obj).prompt as Obj;
    const attacker = state.sides[exchangeRoles(state).attacker];
    const bag = (ownGet(priv, id) as Obj).bag as string[];
    const isAttacker = attacker.kind === "player" && attacker.playerId === id;
    const options = isAttacker ? attackerOptions(rules, character, bag) : [...DEFENDER_OPTIONS];
    const dflt = isAttacker ? "attack" : "guard";
    if (!sameStrings(prompt.options as unknown[], options) || prompt.default !== dflt) {
      bad(`private.${clip(id)}.prompt does not match the combat exchange`);
    }
  }
}

/**
 * Parses and fully validates a v2 save against `rules`: `JSON.parse` (a `SyntaxError`
 * propagates), a plain object (`TypeError`), `v === 2` (`SchemaVersionError`), then checks 1-8 in
 * spec order, each throwing `TypeError("deserialize: <unique message>")`. Exact own keys at every
 * object level; every player- or content-keyed lookup goes through `ownGet`. Check 8 validates
 * the combat state against the open `combat/exchange` decision.
 */
export function deserialize(json: string, rules: Rules): GameState {
  const root: unknown = JSON.parse(json);
  if (!isPlainObject(root)) bad("state must be an object");
  if (root.v !== SCHEMA_VERSION) {
    throw new SchemaVersionError(`unsupported schema version, expected ${SCHEMA_VERSION}`);
  }
  // 1. root and partitions
  exactKeys(root, ROOT_KEYS, "root");
  const pub = asObject(root.public, "public");
  exactKeys(pub, PUBLIC_KEYS, "public");
  asObject(root.private, "private");
  const hidden = asObject(root.hidden, "hidden");
  exactKeys(hidden, HIDDEN_KEYS, "hidden");

  // 2. players, active player, phase, counters, rng
  const playersProblem = playersError(pub.players);
  if (playersProblem !== null) bad(`players: ${playersProblem}`);
  const players = pub.players as string[];
  if (typeof pub.activePlayer !== "string" || !players.includes(pub.activePlayer)) {
    bad("activePlayer is not a seated player");
  }
  if (pub.phase !== "turn" && pub.phase !== "decision") bad("phase must be turn or decision");
  if (!isIntIn(pub.turn, 0, MAX_COUNTER)) bad("turn out of range");
  if (!isIntIn(hidden.decisionSeq, 0, MAX_COUNTER)) bad("decisionSeq out of range");
  if (!isIntIn(hidden.combatSeq, 0, MAX_COUNTER)) bad("combatSeq out of range");
  const rng = hidden.rng;
  if (!Array.isArray(rng) || rng.length !== 4 || !rng.every((n) => isIntIn(n, 0, U32_MAX))) {
    bad("rng must be four u32 values");
  }

  // 3. characters
  const characters = asObject(pub.characters, "characters");
  playerKeys(characters, players, "characters");
  for (const id of players) checkCharacter(rules, id, characters[id]);

  // 4. choice history
  checkChoiceHistory(pub.choiceHistory, players);

  // 5. private partitions
  const priv = checkPrivate(rules, root.private, players, characters);

  // 6. decision consistency
  if (pub.phase === "turn") checkTurnPhase(pub, hidden, priv, players);
  else checkDecisionPhase(pub, hidden, priv, players);

  // 7. last reveal
  checkLastReveal(pub.lastReveal, players);

  // 8. combat
  checkCombat(rules, pub, hidden, priv, characters, players);

  // safe: every key, type and cross-reference of GameState was verified above.
  return root as unknown as GameState;
}
