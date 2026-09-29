// v2 fast-check arbitraries shared by the property suites (replay, views). 02-03 adds the combat
// generators (`combat/start`, `system/setCharacter`, combat commits); 02-04 extends `arbInputFor`
// with the loadout actions.
import fc from "fast-check";
import type { GameSettings } from "../src/types";

/** Ids that collide with `Object.prototype` members; every id-keyed record must survive them (PIT-002). */
export const PROTO_IDS = ["toString", "valueOf", "hasOwnProperty", "isPrototypeOf"] as const;

/** Every player id a generated game may seat. */
export const PLAYER_POOL: readonly string[] = ["p1", "p2", "p3", "p4", ...PROTO_IDS];

const CLASS_IDS = ["fighter", "caster"] as const;

const arbClass = fc.constantFrom(...CLASS_IDS);

/** 1-4 unique seats from {@link PLAYER_POOL}; 3-4 seats are favoured so opens/commits often involve several players. */
export const arbSettings: fc.Arbitrary<GameSettings> = fc
  .tuple(
    fc.oneof(
      { weight: 1, arbitrary: fc.integer({ min: 1, max: 2 }) },
      { weight: 4, arbitrary: fc.integer({ min: 3, max: 4 }) },
    ),
    fc.shuffledSubarray([...PLAYER_POOL], { minLength: 4, maxLength: PLAYER_POOL.length }),
    fc.array(arbClass, { minLength: 4, maxLength: 4 }),
    fc.string({ minLength: 1, maxLength: 12 }),
  )
  .map(([count, ids, classes, seed]) => ({
    v: 2 as const,
    seed,
    players: ids.slice(0, count).map((id, i) => ({ id, classId: classes[i] ?? "fighter" })),
  }));

/** The seat ids of generated settings, in seat order. */
export function seatIds(settings: GameSettings): string[] {
  return settings.players.map((seat) => seat.id);
}

const LONG_OPTION = "b".repeat(64);
const CHOICE_OPTION = `item:${"a".repeat(48)}`;
/**
 * Generic option tokens (the 53- and 64-char boundary tokens included). The first three are
 * "common": most generated options and commits draw from them, so commits often land in the
 * committing player's own options and decisions actually reach their reveal.
 */
const TOKEN_POOL = ["yes", "no", "red", "green", "blue", "a", "b", CHOICE_OPTION, LONG_OPTION];
const COMMON_TOKENS = 3;

/** Maps a generated number to a token: mostly common ones, sometimes rare, sometimes a sentinel. */
function pickToken(n: number, sentinels: readonly string[]): string {
  const bucket = n % 10;
  if (bucket < 6) return TOKEN_POOL[n % COMMON_TOKENS] ?? "yes";
  if (bucket < 8 || sentinels.length === 0) return TOKEN_POOL[n % TOKEN_POOL.length] ?? "yes";
  return sentinels[n % sentinels.length] ?? "yes";
}
const BAD_CHOICES = ["Bad Token", "c".repeat(65)];

/**
 * Per-seat sentinel tokens `s<i>-<a..d>`: they are only ever generated inside the options (and
 * commits) of the seat with index `i`, so the leak property can tell whose data a view contains.
 */
export const SENTINELS: readonly (readonly string[])[] = [0, 1, 2, 3].map((i) =>
  ["a", "b", "c", "d"].map((letter) => `s${i}-${letter}`),
);

function sentinelsFor(ids: readonly string[], playerId: string): readonly string[] {
  const index = ids.indexOf(playerId);
  return index < 0 ? [] : (SENTINELS[index] ?? []);
}

function arbPlayerId(ids: readonly string[], extra: readonly string[]): fc.Arbitrary<string> {
  return fc.oneof(
    { weight: 14, arbitrary: fc.constantFrom(...ids) },
    { weight: 1, arbitrary: fc.constantFrom(...PLAYER_POOL) },
    { weight: 1, arbitrary: fc.constantFrom(...extra) },
  );
}

function arbPrompt(ids: readonly string[]): fc.Arbitrary<unknown> {
  return fc
    .tuple(
      arbPlayerId(ids, ["ghost"]),
      fc.nat({ max: 7 }),
      fc.array(fc.nat({ max: 200 }), { minLength: 1, maxLength: 8 }),
      fc.oneof(
        { weight: 4, arbitrary: fc.nat({ max: 20 }).map((n) => ({ pick: n })) },
        { weight: 1, arbitrary: fc.constantFrom(...TOKEN_POOL).map((t) => ({ token: t })) },
      ),
    )
    .map(([playerId, dupRoll, picks, dflt]) => {
      const sentinels = sentinelsFor(ids, playerId);
      const tokens = picks.map((n) => pickToken(n, sentinels));
      // Duplicate options are kept only on one roll in eight, so most opens pass validation.
      const options = dupRoll === 0 ? tokens : [...new Set(tokens)];
      const first = options[0] ?? "yes";
      const chosen = "pick" in dflt ? (options[dflt.pick % options.length] ?? first) : dflt.token;
      return { playerId, options, default: chosen };
    });
}

function arbOpen(ids: readonly string[]): fc.Arbitrary<unknown> {
  const prompt = arbPrompt(ids);
  return fc
    .oneof(
      {
        weight: 5,
        arbitrary: fc.uniqueArray(prompt, {
          minLength: 1,
          maxLength: 4,
          selector: (p) => (p as { playerId: string }).playerId,
        }),
      },
      { weight: 1, arbitrary: fc.array(prompt, { minLength: 1, maxLength: 4 }) },
    )
    .map((prompts) => ({ v: 2, type: "decision/open", playerId: "system", prompts }));
}

function arbCommit(ids: readonly string[]): fc.Arbitrary<unknown> {
  return fc
    .tuple(
      arbPlayerId(ids, ["system"]),
      fc.constantFrom("d1", "d1", "d1", "d2", "d2", "d3", "d4", "x"),
      fc.nat({ max: 200 }),
      fc.constantFrom(...BAD_CHOICES),
      fc.boolean(),
    )
    .map(([playerId, decisionId, n, bad, useBad]) => {
      const choice = useBad && n % 8 === 0 ? bad : pickToken(n, sentinelsFor(ids, playerId));
      return { v: 2, type: "decision/commit", playerId, decisionId, choice };
    });
}

const arbTimeoutFor = fc
  .constantFrom("d1", "d2", "d3", "d4", "x")
  .map((decisionId) => ({ v: 2, type: "timeout", playerId: "system", decisionId }));

const arbTimeoutByPlayer = fc
  .tuple(fc.constantFrom(...PLAYER_POOL), fc.constantFrom("d1", "x"))
  .map(([playerId, decisionId]) => ({ v: 2, type: "timeout", playerId, decisionId }));

const VALID_COMMIT = {
  v: 2,
  type: "decision/commit",
  playerId: "p1",
  decisionId: "d1",
  choice: "yes",
};

const arbJunk: fc.Arbitrary<unknown> = fc.constantFrom<unknown>(
  null,
  42,
  {},
  { v: 1, type: "timeout", playerId: "system", decisionId: "d1" },
  { v: 2 },
  { ...VALID_COMMIT, zzz: 1 },
  { v: 2, type: "timeout", playerId: "system", decisionId: "d1", zzz: 1 },
);

// ---- combat generators (02-03) ----------------------------------------------------------------

/** Commands and items a combat commit may pick; roughly half are valid for a given prompt. */
const COMBAT_CHOICES = [
  "attack",
  "strike",
  "spell",
  "guard",
  "counter",
  "ward",
  "flee",
  "item:herb",
  "item:bomb",
  "item:tonic",
] as const;
const COMBAT_DECISION_IDS = ["d1", "d1", "d1", "d2", "d2", "d3", "d4", "d5", "d6", "x"] as const;
const MONSTER_IDS = ["slime", "crab", "gull"] as const;
/** Content ids that must never resolve to an inherited member (PIT-002). */
const BAD_CONTENT_IDS = ["nope", "toString", "constructor", "__proto__"] as const;

function arbCombatCommit(ids: readonly string[]): fc.Arbitrary<unknown> {
  return fc
    .tuple(
      arbPlayerId(ids, ["system"]),
      fc.constantFrom(...COMBAT_DECISION_IDS),
      fc.constantFrom(...COMBAT_CHOICES),
    )
    .map(([playerId, decisionId, choice]) => ({
      v: 2,
      type: "decision/commit",
      playerId,
      decisionId,
      choice,
    }));
}

const arbCombatTimeout = fc
  .constantFrom(...COMBAT_DECISION_IDS)
  .map((decisionId) => ({ v: 2, type: "timeout", playerId: "system", decisionId }));

function arbOpponent(ids: readonly string[]): fc.Arbitrary<unknown> {
  const monster = fc
    .tuple(
      fc.oneof(
        { weight: 9, arbitrary: fc.constantFrom(...MONSTER_IDS) },
        { weight: 1, arbitrary: fc.constantFrom(...BAD_CONTENT_IDS) },
      ),
      fc.boolean(),
    )
    .map(([id, senior]) => ({ kind: "npc", npc: { kind: "monster", id, senior } }));
  const guardian = fc
    .tuple(
      fc.oneof(
        { weight: 9, arbitrary: fc.constant("lich") },
        { weight: 1, arbitrary: fc.constantFrom(...BAD_CONTENT_IDS) },
      ),
      fc.integer({ min: 1, max: 4 }),
    )
    .map(([id, townTier]) => ({ kind: "npc", npc: { kind: "guardian", id, townTier } }));
  const enforcer = fc
    .integer({ min: 1, max: 12 })
    .map((level) => ({ kind: "npc", npc: { kind: "enforcer", level } }));
  const player = arbPlayerId(ids, ["ghost"]).map((playerId) => ({ kind: "player", playerId }));
  return fc.oneof(
    { weight: 6, arbitrary: player },
    { weight: 5, arbitrary: monster },
    { weight: 2, arbitrary: guardian },
    { weight: 2, arbitrary: enforcer },
  );
}

function arbStart(ids: readonly string[]): fc.Arbitrary<unknown> {
  return fc.tuple(arbPlayerId(ids, ["ghost"]), arbOpponent(ids)).map(([attacker, opponent]) => ({
    v: 2,
    type: "combat/start",
    playerId: "system",
    attacker,
    opponent,
  }));
}

const KIT_CLASSES = ["fighter", "caster", "battlemage"] as const;
const KIT_WEAPONS = ["stick", "sword"] as const;
const KIT_SHIELDS = ["lid", "mirror"] as const;
const KIT_ACCESSORIES = ["charm", "band", null] as const;
const KIT_SPELLS = ["zap", "jolt", "leech", "hex", "frost", "pilfer", null] as const;
const KIT_WARDS = ["shell", "mirror-ward", "sponge", "null-ward", null] as const;
const KIT_ITEMS = ["herb", "bomb", "tonic", "antidote", "boots", "wig"] as const;

/** One deliberately invalid field per `flaw` roll (0 = a valid kit). */
const KIT_FLAWS: readonly (Record<string, unknown> | null)[] = [
  null,
  null,
  null,
  null,
  null,
  null,
  { classId: "nope" },
  { classId: "toString" },
  { level: 11 },
  { weapon: "lid" },
  { weapon: "toString" },
  { battleSpell: "shell" },
  { wardSpell: "constructor" },
  { bag: ["herb", "herb", "herb", "herb", "herb"] },
  { bag: ["toString"] },
];

function arbSetCharacter(ids: readonly string[]): fc.Arbitrary<unknown> {
  return fc
    .tuple(
      arbPlayerId(ids, ["ghost"]),
      fc.constantFrom(...KIT_CLASSES),
      fc.integer({ min: 1, max: 10 }),
      fc.tuple(
        fc.constantFrom(...KIT_WEAPONS),
        fc.constantFrom(...KIT_SHIELDS),
        fc.constantFrom(...KIT_ACCESSORIES),
        fc.constantFrom(...KIT_SPELLS),
        fc.constantFrom(...KIT_WARDS),
      ),
      fc.array(fc.constantFrom(...KIT_ITEMS), { maxLength: 3 }),
      fc.nat({ max: KIT_FLAWS.length - 1 }),
    )
    .map(
      ([
        target,
        classId,
        level,
        [weapon, shield, accessory, battleSpell, wardSpell],
        bag,
        flaw,
      ]) => ({
        v: 2,
        type: "system/setCharacter",
        playerId: "system",
        target,
        classId,
        level,
        weapon,
        shield,
        accessory,
        battleSpell,
        wardSpell,
        bag,
        ...KIT_FLAWS[flaw],
      }),
    );
}

/** Any action-shaped input for a game whose seats are `ids`, player ids biased toward them. */
export function arbInputFor(ids: readonly string[]): fc.Arbitrary<unknown> {
  return fc.oneof(
    { weight: 3, arbitrary: arbOpen(ids) },
    { weight: 6, arbitrary: arbCommit(ids) },
    { weight: 2, arbitrary: arbTimeoutFor },
    { weight: 1, arbitrary: arbTimeoutByPlayer },
    { weight: 1, arbitrary: arbJunk },
    { weight: 5, arbitrary: arbStart(ids) },
    { weight: 3, arbitrary: arbSetCharacter(ids) },
    { weight: 14, arbitrary: arbCombatCommit(ids) },
    { weight: 3, arbitrary: arbCombatTimeout },
  );
}

/** Any action-shaped input (player ids from the whole pool). */
export const arbInput: fc.Arbitrary<unknown> = arbInputFor(PLAYER_POOL);

export const arbScript: fc.Arbitrary<unknown[]> = fc.array(arbInput, {
  maxLength: 60,
  size: "large",
});

/** Settings plus a script whose player ids favour the seated players. */
export const arbGame: fc.Arbitrary<[GameSettings, unknown[]]> = arbSettings.chain((settings) =>
  fc.tuple(
    fc.constant(settings),
    fc.array(arbInputFor(seatIds(settings)), { maxLength: 60, size: "large" }),
  ),
);

/** Settings of the spec's combat golden (TEST_RULES). */
export const COMBAT_GOLDEN_SETTINGS: GameSettings = {
  v: 2,
  seed: "combat-golden",
  players: [
    { id: "p1", classId: "fighter" },
    { id: "p2", classId: "caster" },
  ],
};

const commit = (playerId: string, decisionId: string, choice: string) => ({
  v: 2,
  type: "decision/commit",
  playerId,
  decisionId,
  choice,
});

/** The spec's combat golden (18 actions); shared by the golden, serialize and replay suites. */
export const COMBAT_GOLDEN_ACTIONS: readonly unknown[] = [
  {
    v: 2,
    type: "system/setCharacter",
    playerId: "system",
    target: "p1",
    classId: "battlemage",
    level: 1,
    weapon: "stick",
    shield: "mirror",
    accessory: "band",
    battleSpell: "jolt",
    wardSpell: "mirror-ward",
    bag: ["herb", "tonic"],
  },
  {
    v: 2,
    type: "combat/start",
    playerId: "system",
    attacker: "p1",
    opponent: { kind: "player", playerId: "p2" },
  },
  commit("p1", "d1", "spell"),
  commit("p2", "d1", "counter"),
  commit("p1", "d2", "item:tonic"),
  { v: 2, type: "timeout", playerId: "system", decisionId: "d2" },
  commit("p2", "d3", "spell"),
  commit("p1", "d3", "ward"),
  commit("p1", "d4", "strike"),
  commit("p2", "d4", "counter"),
  commit("p2", "d5", "item:bomb"),
  commit("p1", "d5", "guard"),
  {
    v: 2,
    type: "combat/start",
    playerId: "system",
    attacker: "p2",
    opponent: { kind: "npc", npc: { kind: "monster", id: "gull", senior: false } },
  },
  commit("p2", "d6", "guard"),
  commit("p2", "d7", "attack"),
  commit("p2", "d8", "counter"),
  commit("p2", "d9", "spell"),
  commit("p2", "d10", "strike"),
];
