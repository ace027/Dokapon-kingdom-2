import { describe, expect, it } from "vitest";
import {
  deserialize,
  hashState,
  SchemaVersionError,
  serialize,
  stableStringify,
} from "../src/serialize";
import { fnv1a32 } from "../src/hash";
import { replay } from "../src/replay";
import { MAX_COUNTER, type GameSettings, type GameState } from "../src/types";
import { COMBAT_GOLDEN_ACTIONS, COMBAT_GOLDEN_SETTINGS } from "./arbitraries";
import { applyAll, FIXTURE_SETTINGS, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

class Point {
  constructor(readonly x: number) {}
}

describe("fnv1a32", () => {
  it("matches the golden vectors", () => {
    expect(fnv1a32("")).toBe("811c9dc5");
    expect(fnv1a32("a")).toBe("e40c292c");
    expect(fnv1a32('{"a":1}')).toBe("8b9e4511");
  });
});

describe("stableStringify", () => {
  it("sorts keys recursively", () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
  });

  it("is independent of key insertion order", () => {
    expect(stableStringify({ x: 1, y: { q: null, p: "s" } })).toBe(
      stableStringify({ y: { p: "s", q: null }, x: 1 }),
    );
  });

  it("handles primitives and null-prototype objects", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify('a"b')).toBe('"a\\"b"');
    expect(stableStringify(-1.5)).toBe("-1.5");
    const bare = Object.create(null) as Record<string, unknown>;
    bare.k = 1;
    expect(stableStringify(bare)).toBe('{"k":1}');
  });

  it.each<[string, unknown]>([
    ["top-level undefined", undefined],
    ["nested undefined", { a: { b: undefined } }],
    ["undefined array element", [1, undefined]],
    ["NaN", { n: Number.NaN }],
    ["Infinity", [Infinity]],
    ["function", { f: () => 1 }],
    ["Map", new Map([["a", 1]])],
    ["class instance", new Point(1)],
    ["bigint", { b: 1n }],
    ["symbol", Symbol("s")],
  ])("throws TypeError for %s", (_label, value) => {
    expect(() => stableStringify(value)).toThrow(TypeError);
  });

  it("names the offending path", () => {
    expect(() => stableStringify({ hidden: { rng: [1, 2, Number.NaN, 4] } })).toThrow(
      "$.hidden.rng[2]",
    );
  });
});

describe("serialize", () => {
  it("is stableStringify and hashes canonically", () => {
    const state = newGame();
    expect(serialize(state)).toBe(stableStringify(state));
    expect(hashState(state)).toBe(fnv1a32(serialize(state)));
  });
});

// ---------------------------------------------------------------------------------------------
// deserialize: one row per check, each a single mutation of a VALID base (PIT-001).
// ---------------------------------------------------------------------------------------------

const POLL_OPEN = {
  v: 2,
  type: "decision/open",
  playerId: "system",
  prompts: [
    { playerId: "p1", options: ["yes", "no"], default: "no" },
    { playerId: "p2", options: ["red", "green", "blue"], default: "red" },
  ],
};
const KERNEL_ACTIONS = [
  POLL_OPEN,
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "yes" },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "no" },
  { v: 2, type: "timeout", playerId: "system", decisionId: "d1" },
  {
    v: 2,
    type: "decision/open",
    playerId: "system",
    prompts: [{ playerId: "p2", options: ["a", "b"], default: "a" }],
  },
  { v: 2, type: "decision/commit", playerId: "p2", decisionId: "d2", choice: "c" },
  { v: 2, type: "decision/commit", playerId: "p2", decisionId: "d2", choice: "b" },
];
const FOUR_SEATS: GameSettings = {
  v: 2,
  seed: "poll",
  players: [
    { id: "p1", classId: "fighter" },
    { id: "p2", classId: "caster" },
    { id: "p3", classId: "fighter" },
    { id: "p4", classId: "caster" },
  ],
};

/** Base 1: after the kernel poll replay (phase turn, a `lastReveal`, no timeouts in it). */
const turnBase = replay(FIXTURE_SETTINGS, KERNEL_ACTIONS, TEST_RULES).state;
/** Base 2: mid-decision, p1 committed, p2 and p3 pending, p4 not required. */
const pollBase = applyAll(newGame(FOUR_SEATS), [
  {
    v: 2,
    type: "decision/open",
    playerId: "system",
    prompts: [
      { playerId: "p1", options: ["yes", "no"], default: "no" },
      { playerId: "p2", options: ["red", "green", "blue"], default: "red" },
      { playerId: "p3", options: ["a", "b"], default: "a" },
    ],
  },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "yes" },
]).state;
/** Base 3: after a reveal with `timedOut: ["p2"]`. */
const revealBase = applyAll(newGame(), [
  POLL_OPEN,
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "yes" },
  { v: 2, type: "timeout", playerId: "system", decisionId: "d1" },
]).state;

const COMBAT_START = (opponent: unknown) => ({
  v: 2,
  type: "combat/start",
  playerId: "system",
  attacker: "p1",
  opponent,
});
/** Base 4: mid-combat, the golden's actions 0-3: d2 open, both players prompted, none committed. */
const combatBase = applyAll(
  newGame(COMBAT_GOLDEN_SETTINGS),
  COMBAT_GOLDEN_ACTIONS.slice(0, 4),
).state;
/** Base 5: the golden's actions 0-4: d2 open with p1 committed (hidden.decision.choices). */
const combatCommittedBase = applyAll(
  newGame(COMBAT_GOLDEN_SETTINGS),
  COMBAT_GOLDEN_ACTIONS.slice(0, 5),
).state;
/** Base 6: a player vs the gull (the golden's actions 0-12): the npc attacks, only p2 is prompted. */
const npcBase = applyAll(newGame(COMBAT_GOLDEN_SETTINGS), COMBAT_GOLDEN_ACTIONS.slice(0, 13)).state;
/** Bases 7-8: a guardian (town tier 2) and the Crown Enforcer (level 5). */
const guardianBase = applyAll(newGame(), [
  COMBAT_START({ kind: "npc", npc: { kind: "guardian", id: "lich", townTier: 2 } }),
]).state;
const enforcerBase = applyAll(newGame(), [
  COMBAT_START({ kind: "npc", npc: { kind: "enforcer", level: 5 } }),
]).state;

/** The mid-combat base's `public.combat` as plain JSON (for a well-formed combat on a turn base). */
function combatJson(): unknown {
  const parsed = JSON.parse(serialize(combatBase)) as { public: { combat: unknown } };
  return parsed.public.combat;
}

const BASES: Readonly<
  Record<
    "turn" | "poll" | "reveal" | "combat" | "combatCommitted" | "npc" | "guardian" | "enforcer",
    GameState
  >
> = {
  turn: turnBase,
  poll: pollBase,
  reveal: revealBase,
  combat: combatBase,
  combatCommitted: combatCommittedBase,
  npc: npcBase,
  guardian: guardianBase,
  enforcer: enforcerBase,
};

type Op =
  | { readonly kind: "set"; readonly path: string; readonly to: unknown }
  | { readonly kind: "del"; readonly path: string }
  | { readonly kind: "rename"; readonly path: string; readonly to: string };
const set = (path: string, to: unknown): Op => ({ kind: "set", path, to });
const del = (path: string): Op => ({ kind: "del", path });
const rename = (path: string, to: string): Op => ({ kind: "rename", path, to });

function applyOps(base: GameState, ops: readonly Op[]): string {
  const json: unknown = JSON.parse(serialize(base));
  for (const op of ops) {
    const keys = op.path.split(".");
    const last = keys.pop() ?? "";
    let node = json as Record<string, unknown>;
    for (const key of keys) node = node[key] as Record<string, unknown>;
    if (op.kind === "set") node[last] = op.to;
    else if (op.kind === "del") node[last] = undefined;
    else {
      node[op.to] = node[last];
      node[last] = undefined;
    }
  }
  return JSON.stringify(json);
}

type BaseName = keyof typeof BASES;
interface Row {
  readonly base: BaseName;
  readonly ops: readonly Op[];
  readonly message: string;
}
const row = (base: BaseName, ops: Op[], message: string): Row => ({ base, ops, message });

const TOKENS_25 = ["yes", ...Array.from({ length: 24 }, (_, i) => `t${i}`)];
const VALID_PROMPT = { decisionId: "d1", options: ["yes"], default: "yes" };

const ROWS: readonly Row[] = [
  // 1. root and partitions
  row("turn", [del("hidden")], 'deserialize: root is missing key "hidden"'),
  row("turn", [set("extra", 1)], 'deserialize: root has unexpected key "extra"'),
  row("turn", [rename("private", "other")], 'deserialize: root is missing key "private"'),
  row("turn", [set("public", 5)], "deserialize: public must be an object"),
  row("turn", [del("public.combat")], 'deserialize: public is missing key "combat"'),
  row("turn", [set("public.zzz", 1)], 'deserialize: public has unexpected key "zzz"'),
  row("turn", [set("private", 5)], "deserialize: private must be an object"),
  row("turn", [set("hidden", 5)], "deserialize: hidden must be an object"),
  row("turn", [del("hidden.decision")], 'deserialize: hidden is missing key "decision"'),
  row("turn", [set("hidden.zzz", 1)], 'deserialize: hidden has unexpected key "zzz"'),
  // 2. players, active player, phase, counters, rng
  row("turn", [set("public.players", "p1")], "deserialize: players: players must be an array"),
  row("turn", [set("public.players", [])], "deserialize: players: players must hold 1–4 ids"),
  row(
    "turn",
    [set("public.players", [1, "p2"])],
    "deserialize: players: player ids must be strings",
  ),
  row(
    "turn",
    [set("public.players", ["system", "p2"])],
    'deserialize: players: player id "system" is reserved',
  ),
  row(
    "turn",
    [set("public.players", ["p 1", "p2"])],
    'deserialize: players: invalid player id "p 1"',
  ),
  row(
    "turn",
    [set("public.players", ["p1", "p1"])],
    "deserialize: players: player ids must be unique",
  ),
  row(
    "turn",
    [set("public.activePlayer", "ghost")],
    "deserialize: activePlayer is not a seated player",
  ),
  row("turn", [set("public.phase", "combat")], "deserialize: phase must be turn or decision"),
  row("turn", [set("public.turn", -1)], "deserialize: turn out of range"),
  row("turn", [set("hidden.decisionSeq", -1)], "deserialize: decisionSeq out of range"),
  row("turn", [set("hidden.combatSeq", 1.5)], "deserialize: combatSeq out of range"),
  row("turn", [set("hidden.rng", [1, 2, 3])], "deserialize: rng must be four u32 values"),
  // 3. characters
  row("turn", [set("public.characters", 1)], "deserialize: characters must be an object"),
  row("turn", [del("public.characters.p2")], 'deserialize: characters is missing player "p2"'),
  row(
    "turn",
    [set("public.characters.p3", {})],
    'deserialize: characters has unexpected player "p3"',
  ),
  row("turn", [set("public.characters.p1", 5)], "deserialize: characters.p1 must be an object"),
  row("turn", [del("public.characters.p1.hp")], 'deserialize: characters.p1 is missing key "hp"'),
  row(
    "turn",
    [set("public.characters.p1.zzz", 1)],
    'deserialize: characters.p1 has unexpected key "zzz"',
  ),
  row(
    "turn",
    [set("public.characters.p1.classId", "wizard")],
    "deserialize: characters.p1.classId is not a known class",
  ),
  row(
    "turn",
    [set("public.characters.p1.level", 0)],
    "deserialize: characters.p1.level out of range",
  ),
  row("turn", [set("public.characters.p1.xp", -1)], "deserialize: characters.p1.xp out of range"),
  row(
    "turn",
    [set("public.characters.p1.level", 2)],
    "deserialize: characters.p1.level does not match xp",
  ),
  row(
    "turn",
    [set("public.characters.p1.gold", -1)],
    "deserialize: characters.p1.gold out of range",
  ),
  row(
    "turn",
    [set("public.characters.p1.mastery", 5)],
    "deserialize: characters.p1.mastery must be an object",
  ),
  row(
    "turn",
    [del("public.characters.p1.mastery.battlemage")],
    'deserialize: characters.p1.mastery is missing class "battlemage"',
  ),
  row(
    "turn",
    [set("public.characters.p1.mastery.wizard", 0)],
    'deserialize: characters.p1.mastery has unexpected class "wizard"',
  ),
  row(
    "turn",
    [set("public.characters.p1.mastery.fighter", -1)],
    "deserialize: characters.p1.mastery.fighter out of range",
  ),
  row(
    "turn",
    [set("public.characters.p1.portable", "wizard")],
    "deserialize: characters.p1.portable is not a known class",
  ),
  row(
    "turn",
    [set("public.characters.p1.portable", "caster")],
    "deserialize: characters.p1.portable requires mastery rank 5",
  ),
  row(
    "turn",
    [set("public.characters.p1.weapon", "nope")],
    "deserialize: characters.p1.weapon is unknown gear",
  ),
  row(
    "turn",
    [set("public.characters.p1.weapon", "lid")],
    "deserialize: characters.p1.weapon is in the wrong slot",
  ),
  row(
    "turn",
    [set("public.characters.p1.shield", "nope")],
    "deserialize: characters.p1.shield is unknown gear",
  ),
  row(
    "turn",
    [set("public.characters.p2.accessory", "stick")],
    "deserialize: characters.p2.accessory is in the wrong slot",
  ),
  row(
    "turn",
    [set("public.characters.p1.battleSpell", "nope")],
    "deserialize: characters.p1.battleSpell is unknown",
  ),
  row(
    "turn",
    [set("public.characters.p2.wardSpell", "nope")],
    "deserialize: characters.p2.wardSpell is unknown",
  ),
  row("turn", [set("public.characters.p1.hp", -1)], "deserialize: characters.p1.hp out of range"),
  row("turn", [set("public.characters.p1.hp", 49)], "deserialize: characters.p1.hp exceeds max hp"),
  // 4. choice history
  row("turn", [set("public.choiceHistory", 1)], "deserialize: choiceHistory must be an object"),
  row(
    "turn",
    [del("public.choiceHistory.p2")],
    'deserialize: choiceHistory is missing player "p2"',
  ),
  row(
    "turn",
    [set("public.choiceHistory.p3", {})],
    'deserialize: choiceHistory has unexpected player "p3"',
  ),
  row(
    "turn",
    [set("public.choiceHistory.p1", 5)],
    "deserialize: choiceHistory.p1 must be an object",
  ),
  row(
    "turn",
    [del("public.choiceHistory.p1.ward")],
    'deserialize: choiceHistory.p1 is missing key "ward"',
  ),
  row(
    "turn",
    [set("public.choiceHistory.p1.zzz", 0)],
    'deserialize: choiceHistory.p1 has unexpected key "zzz"',
  ),
  row(
    "turn",
    [set("public.choiceHistory.p1.attack", -1)],
    "deserialize: choiceHistory.p1.attack out of range",
  ),
  // 5. private partitions
  row("turn", [del("private.p2")], 'deserialize: private is missing player "p2"'),
  row("turn", [set("private.p3", {})], 'deserialize: private has unexpected player "p3"'),
  row("turn", [set("private.p1", 5)], "deserialize: private.p1 must be an object"),
  row("turn", [del("private.p1.scrolls")], 'deserialize: private.p1 is missing key "scrolls"'),
  row("turn", [set("private.p1.zzz", 1)], 'deserialize: private.p1 has unexpected key "zzz"'),
  row("turn", [set("private.p1.bag", "herb")], "deserialize: private.p1.bag must be an array"),
  row("turn", [set("private.p1.bag", ["nope"])], "deserialize: private.p1.bag has an unknown item"),
  row(
    "turn",
    [set("private.p1.bag", ["herb", "herb", "herb", "herb"])],
    "deserialize: private.p1.bag exceeds bag size",
  ),
  row(
    "turn",
    [set("private.p1.scrolls", "haste")],
    "deserialize: private.p1.scrolls must be an array",
  ),
  row(
    "turn",
    [set("private.p1.scrolls", ["nope"])],
    "deserialize: private.p1.scrolls has an unknown field spell",
  ),
  row(
    "turn",
    [set("private.p1.scrolls", ["haste", "haste", "fog", "fog"])],
    "deserialize: private.p1.scrolls exceeds maxScrolls",
  ),
  row("poll", [set("private.p2.prompt", 5)], "deserialize: private.p2.prompt must be an object"),
  row(
    "poll",
    [del("private.p2.prompt.default")],
    'deserialize: private.p2.prompt is missing key "default"',
  ),
  row(
    "poll",
    [set("private.p2.prompt.zzz", 1)],
    'deserialize: private.p2.prompt has unexpected key "zzz"',
  ),
  row(
    "poll",
    [set("private.p2.prompt.decisionId", 1)],
    "deserialize: private.p2.prompt.decisionId must be a string",
  ),
  row(
    "poll",
    [set("private.p2.prompt.options", TOKENS_25)],
    "deserialize: private.p2.prompt.options must hold 1-24 tokens",
  ),
  row(
    "poll",
    [set("private.p2.prompt.options", ["Red", "red"])],
    "deserialize: private.p2.prompt.options must be tokens",
  ),
  row(
    "poll",
    [set("private.p2.prompt.options", ["red", "red"])],
    "deserialize: private.p2.prompt.options must be unique",
  ),
  row(
    "poll",
    [set("private.p2.prompt.default", "maybe")],
    "deserialize: private.p2.prompt.default must be one of the options",
  ),
  // 6. decision consistency
  row(
    "turn",
    [set("public.pending", { id: "d1", kind: "poll", required: ["p1"], committed: [] })],
    "deserialize: turn phase must have no pending decision",
  ),
  row(
    "turn",
    [set("hidden.decision", { id: "d2", choices: {} })],
    "deserialize: turn phase must have no hidden decision",
  ),
  row(
    "turn",
    [set("private.p1.prompt", VALID_PROMPT)],
    "deserialize: turn phase must have no prompts",
  ),
  row(
    "poll",
    [set("public.pending", null)],
    "deserialize: decision phase requires a pending decision",
  ),
  row("poll", [set("public.pending", 5)], "deserialize: pending must be an object"),
  row("poll", [del("public.pending.kind")], 'deserialize: pending is missing key "kind"'),
  row("poll", [set("public.pending.zzz", 1)], 'deserialize: pending has unexpected key "zzz"'),
  row(
    "poll",
    [set("public.pending.id", "d2")],
    "deserialize: pending.id does not match decisionSeq",
  ),
  row("poll", [set("public.pending.kind", "duel")], "deserialize: pending.kind is unknown"),
  row(
    "poll",
    [set("public.pending.required", "p1")],
    "deserialize: pending.required must be an array",
  ),
  row(
    "poll",
    [set("public.pending.required", [])],
    "deserialize: pending.required must not be empty",
  ),
  row(
    "poll",
    [set("public.pending.required", ["p1", "p1", "p3"])],
    "deserialize: pending.required must be unique",
  ),
  row(
    "poll",
    [set("public.pending.required", ["p1", "p2", "ghost"])],
    "deserialize: pending.required must be seated players",
  ),
  row(
    "poll",
    [set("public.pending.committed", "p1")],
    "deserialize: pending.committed must be an array",
  ),
  // committed [p1, p1]: choices keys stay {p1}, so only the uniqueness check can fire (PIT-001).
  row(
    "poll",
    [set("public.pending.committed", ["p1", "p1"])],
    "deserialize: pending.committed must be unique",
  ),
  row(
    "poll",
    [set("public.pending.committed", ["p4"]), set("hidden.decision.choices", { p4: "yes" })],
    "deserialize: pending.committed must be a subset of required",
  ),
  row(
    "poll",
    [
      set("public.pending.committed", ["p1", "p2", "p3"]),
      set("hidden.decision.choices", { p1: "yes", p2: "red", p3: "a" }),
    ],
    "deserialize: pending.committed must be fewer than required",
  ),
  row("poll", [set("private.p3.prompt", null)], "deserialize: private.p3.prompt is required"),
  row(
    "poll",
    [set("private.p4.prompt", VALID_PROMPT)],
    "deserialize: private.p4.prompt must be null for a non-required player",
  ),
  row(
    "poll",
    [set("private.p3.prompt.decisionId", "d9")],
    "deserialize: private.p3.prompt.decisionId does not match pending.id",
  ),
  row("poll", [set("hidden.decision", null)], "deserialize: hidden.decision must be an object"),
  row(
    "poll",
    [del("hidden.decision.choices")],
    'deserialize: hidden.decision is missing key "choices"',
  ),
  row(
    "poll",
    [set("hidden.decision.zzz", 1)],
    'deserialize: hidden.decision has unexpected key "zzz"',
  ),
  row(
    "poll",
    [set("hidden.decision.id", "d2")],
    "deserialize: hidden.decision.id does not match pending.id",
  ),
  row(
    "poll",
    [set("hidden.decision.choices", 5)],
    "deserialize: hidden.decision.choices must be an object",
  ),
  row(
    "poll",
    [set("hidden.decision.choices.p2", "red")],
    "deserialize: hidden.decision.choices keys do not match committed",
  ),
  row(
    "poll",
    [set("hidden.decision.choices.p1", "maybe")],
    "deserialize: hidden.decision.choices.p1 is not one of the options",
  ),
  // 7. last reveal
  row("reveal", [set("public.lastReveal", 5)], "deserialize: lastReveal must be an object"),
  row("reveal", [del("public.lastReveal.kind")], 'deserialize: lastReveal is missing key "kind"'),
  row(
    "reveal",
    [set("public.lastReveal.zzz", 1)],
    'deserialize: lastReveal has unexpected key "zzz"',
  ),
  row(
    "reveal",
    [set("public.lastReveal.decisionId", 1)],
    "deserialize: lastReveal.decisionId must be a string",
  ),
  row("reveal", [set("public.lastReveal.kind", "duel")], "deserialize: lastReveal.kind is unknown"),
  row(
    "reveal",
    [set("public.lastReveal.choices", 5)],
    "deserialize: lastReveal.choices must be an object",
  ),
  row(
    "reveal",
    [set("public.lastReveal.choices.ghost", "yes")],
    "deserialize: lastReveal.choices has an unseated player",
  ),
  row(
    "reveal",
    [set("public.lastReveal.choices.p1", "Bad Token")],
    "deserialize: lastReveal.choices.p1 must be a token",
  ),
  row(
    "reveal",
    [set("public.lastReveal.timedOut", "p2")],
    "deserialize: lastReveal.timedOut must be an array",
  ),
  row(
    "reveal",
    [set("public.lastReveal.timedOut", ["p2", "p2"])],
    "deserialize: lastReveal.timedOut must be unique",
  ),
  row(
    "reveal",
    [set("public.lastReveal.timedOut", ["ghost"])],
    "deserialize: lastReveal.timedOut must be a subset of the choice keys",
  ),
  // 8. combat
  row(
    "turn",
    [set("public.combat", combatJson())],
    "deserialize: combat requires a combat/exchange decision",
  ),
  row(
    "combat",
    [set("public.combat", null)],
    "deserialize: combat/exchange decision requires combat",
  ),
  row("combat", [set("public.combat", 5)], "deserialize: combat must be an object"),
  row("combat", [del("public.combat.round")], 'deserialize: combat is missing key "round"'),
  row("combat", [set("public.combat.zzz", 1)], 'deserialize: combat has unexpected key "zzz"'),
  row("combat", [set("public.combat.id", "c2")], "deserialize: combat.id does not match combatSeq"),
  row("combat", [set("public.combat.round", 0)], "deserialize: combat.round out of range"),
  row("combat", [set("public.combat.exchange", 3)], "deserialize: combat.exchange must be 1 or 2"),
  row("combat", [set("public.combat.first", 2)], "deserialize: combat.first must be 0 or 1"),
  row("combat", [set("public.combat.sides", "x")], "deserialize: combat.sides must be an array"),
  row(
    "combat",
    [set("public.combat.sides", [{}])],
    "deserialize: combat.sides must hold two sides",
  ),
  row(
    "combat",
    [set("public.combat.sides.0", { kind: "npc" })],
    "deserialize: combat.sides[0] must be a player side",
  ),
  row(
    "combat",
    [del("public.combat.sides.0.mods")],
    'deserialize: combat.sides[0] is missing key "mods"',
  ),
  row(
    "combat",
    [set("public.combat.sides.1.kind", "boss")],
    "deserialize: combat.sides[1].kind is unknown",
  ),
  row(
    "combat",
    [set("public.combat.sides.1.playerId", "p1")],
    "deserialize: combat.sides must not repeat a player",
  ),
  row(
    "combat",
    [set("public.combat.sides.1.playerId", "ghost")],
    "deserialize: combat.sides[1].playerId is not a seated player",
  ),
  row(
    "combat",
    [set("public.combat.sides.0.mods", 5)],
    "deserialize: combat.sides[0].mods must be an object",
  ),
  row(
    "combat",
    [del("public.combat.sides.0.mods.spd")],
    'deserialize: combat.sides[0].mods is missing key "spd"',
  ),
  row(
    "combat",
    [set("public.combat.sides.0.mods.atk", 5001)],
    "deserialize: combat.sides[0].mods.atk out of range",
  ),
  row(
    "combat",
    [set("public.combat.sides.1.mods.def", -5001)],
    "deserialize: combat.sides[1].mods.def out of range",
  ),
  row(
    "combat",
    [set("public.combat.sides.0.mods.stun", "no")],
    "deserialize: combat.sides[0].mods.stun must be a boolean",
  ),
  row(
    "combat",
    [set("public.combat.sides.1.mods.poison", 1)],
    "deserialize: combat.sides[1].mods.poison must be a boolean",
  ),
  row("combat", [set("public.characters.p1.hp", 0)], "deserialize: combat side p1 is knocked out"),
  row(
    "combat",
    [set("public.pending.required", ["p2", "p1"])],
    "deserialize: pending.required does not match the combat exchange",
  ),
  row(
    "combat",
    [set("private.p2.prompt.options", ["guard", "counter"])],
    "deserialize: private.p2.prompt does not match the combat exchange",
  ),
  row(
    "combat",
    [set("private.p1.prompt.options", ["attack", "strike", "spell", "flee"])],
    "deserialize: private.p1.prompt does not match the combat exchange",
  ),
  row(
    "npc",
    [set("public.combat.sides.1.npc.id", "toString")],
    "deserialize: combat.sides[1].npc is an unknown monster",
  ),
  row(
    "npc",
    [set("public.combat.sides.1.npc.senior", "yes")],
    "deserialize: combat.sides[1].npc.senior must be a boolean",
  ),
  row(
    "npc",
    [set("public.combat.sides.1.npc.zzz", 1)],
    'deserialize: combat.sides[1].npc has unexpected key "zzz"',
  ),
  row(
    "npc",
    [set("public.combat.sides.1.npc.kind", "boss")],
    "deserialize: combat.sides[1].npc.kind is unknown",
  ),
  row(
    "npc",
    [set("public.combat.sides.1.npc", 5)],
    "deserialize: combat.sides[1].npc must be an object",
  ),
  row(
    "combat",
    [set("public.combat.sides.0", 5)],
    "deserialize: combat.sides[0] must be an object",
  ),
  row(
    "npc",
    [set("public.combat.sides.1.stats", 5)],
    "deserialize: combat.sides[1].stats must be an object",
  ),
  row(
    "guardian",
    [set("public.combat.sides.1.npc.zzg", 1)],
    'deserialize: combat.sides[1].npc has unexpected key "zzg"',
  ),
  row(
    "enforcer",
    [set("public.combat.sides.1.npc.zze", 1)],
    'deserialize: combat.sides[1].npc has unexpected key "zze"',
  ),
  row(
    "npc",
    [set("public.combat.sides.1.stats.atk", 999)],
    "deserialize: combat.sides[1].stats does not match the npc snapshot",
  ),
  row(
    "npc",
    [del("public.combat.sides.1.stats.luck")],
    'deserialize: combat.sides[1].stats is missing key "luck"',
  ),
  row("npc", [set("public.combat.sides.1.hp", 0)], "deserialize: combat.sides[1].hp out of range"),
  row("npc", [del("public.combat.sides.1.hp")], 'deserialize: combat.sides[1] is missing key "hp"'),
  row(
    "guardian",
    [set("public.combat.sides.1.npc.townTier", 5)],
    "deserialize: combat.sides[1].npc.townTier out of range",
  ),
  row(
    "guardian",
    [set("public.combat.sides.1.npc.id", "nope")],
    "deserialize: combat.sides[1].npc is an unknown guardian",
  ),
  row(
    "enforcer",
    [set("public.combat.sides.1.npc.level", 11)],
    "deserialize: combat.sides[1].npc.level out of range",
  ),
];

function failure(json: string): unknown {
  try {
    deserialize(json, TEST_RULES);
  } catch (error) {
    return error;
  }
  return undefined;
}

function expectRejected(json: string, message: string): void {
  const error = failure(json);
  expect(error).toBeInstanceOf(TypeError);
  expect((error as TypeError).message).toBe(message);
}

describe("deserialize: valid bases", () => {
  it.each(Object.entries(BASES))(
    "accepts the %s base and round-trips it deep-equal",
    (_name, state) => {
      expect(deserialize(serialize(state), TEST_RULES)).toEqual(state);
    },
  );

  it("builds the bases as intended (phase, timeouts, committed)", () => {
    expect(turnBase.public.phase).toBe("turn");
    expect(turnBase.public.lastReveal).toEqual({
      decisionId: "d2",
      kind: "poll",
      choices: { p2: "b" },
      timedOut: [],
    });
    expect(pollBase.public.phase).toBe("decision");
    expect(pollBase.public.pending).toEqual({
      id: "d1",
      kind: "poll",
      required: ["p1", "p2", "p3"],
      committed: ["p1"],
    });
    expect(revealBase.public.lastReveal?.timedOut).toEqual(["p2"]);
  });
});

describe("deserialize: single-mutation table", () => {
  it("has a unique message per row", () => {
    const messages = ROWS.map((r) => r.message);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("covers checks 1-8 with at least 30 rows", () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(30);
  });

  it.each(ROWS.map((r) => [r.message, r] as const))("rejects: %s", (_message, r) => {
    expectRejected(applyOps(BASES[r.base], r.ops), r.message);
  });
});

describe("deserialize: envelope errors", () => {
  it("throws SyntaxError for invalid JSON", () => {
    expect(() => deserialize("{not json", TEST_RULES)).toThrow(SyntaxError);
  });

  it.each<[string, string]>([
    ["null", "null"],
    ["a number", "42"],
    ["an array", "[]"],
  ])("throws TypeError for %s", (_label, json) => {
    expectRejected(json, "deserialize: state must be an object");
  });

  it.each([1, 3])("throws SchemaVersionError for v: %s", (v) => {
    const json = applyOps(turnBase, [set("v", v)]);
    expect(() => deserialize(json, TEST_RULES)).toThrow(SchemaVersionError);
    expect(() => deserialize(json, TEST_RULES)).toThrow(
      expect.objectContaining({ name: "SchemaVersionError" }),
    );
  });
});

describe("deserialize: boundaries and prototype-member ids (PIT-002)", () => {
  it.each([
    ["turn", "public.turn"],
    ["decisionSeq", "hidden.decisionSeq"],
    ["combatSeq", "hidden.combatSeq"],
  ])("accepts %s = MAX_COUNTER and rejects MAX_COUNTER + 1", (name, path) => {
    // decisionSeq must stay consistent with a phase-turn base, which has no pending id.
    expect(() =>
      deserialize(applyOps(turnBase, [set(path, MAX_COUNTER)]), TEST_RULES),
    ).not.toThrow();
    expectRejected(
      applyOps(turnBase, [set(path, MAX_COUNTER + 1)]),
      `deserialize: ${name} out of range`,
    );
  });

  it("accepts 1 and 24 prompt options and rejects none", () => {
    const options24 = TOKENS_25.slice(0, 24);
    const ok = (options: string[]) =>
      applyOps(pollBase, [
        set("private.p2.prompt.options", options),
        set("private.p2.prompt.default", options[0]),
      ]);
    expect(() => deserialize(ok(options24), TEST_RULES)).not.toThrow();
    expect(() => deserialize(ok(["red"]), TEST_RULES)).not.toThrow();
    expectRejected(
      applyOps(pollBase, [set("private.p2.prompt.options", [])]),
      "deserialize: private.p2.prompt.options must hold 1-24 tokens",
    );
  });

  it.each(["toString", "valueOf", "hasOwnProperty", "constructor"])(
    "treats %s as an unknown content id, never an inherited member",
    (id) => {
      expectRejected(
        applyOps(turnBase, [set("public.characters.p1.classId", id)]),
        "deserialize: characters.p1.classId is not a known class",
      );
      expectRejected(
        applyOps(turnBase, [set("public.characters.p1.weapon", id)]),
        "deserialize: characters.p1.weapon is unknown gear",
      );
      expectRejected(
        applyOps(turnBase, [set("public.characters.p1.battleSpell", id)]),
        "deserialize: characters.p1.battleSpell is unknown",
      );
      expectRejected(
        applyOps(turnBase, [set("public.characters.p1.portable", id)]),
        "deserialize: characters.p1.portable is not a known class",
      );
      expectRejected(
        applyOps(turnBase, [set("private.p1.bag", [id])]),
        "deserialize: private.p1.bag has an unknown item",
      );
      expectRejected(
        applyOps(turnBase, [set("private.p1.scrolls", [id])]),
        "deserialize: private.p1.scrolls has an unknown field spell",
      );
    },
  );

  it("round-trips a mid-decision game whose seats are named like Object.prototype members", () => {
    const proto = applyAll(
      newGame({
        v: 2,
        seed: "proto",
        players: [
          { id: "toString", classId: "fighter" },
          { id: "valueOf", classId: "caster" },
          { id: "hasOwnProperty", classId: "fighter" },
        ],
      }),
      [
        {
          v: 2,
          type: "decision/open",
          playerId: "system",
          prompts: [
            { playerId: "toString", options: ["a", "b"], default: "b" },
            { playerId: "valueOf", options: ["c"], default: "c" },
          ],
        },
        { v: 2, type: "decision/commit", playerId: "toString", decisionId: "d1", choice: "a" },
      ],
    ).state;
    expect(deserialize(serialize(proto), TEST_RULES)).toEqual(proto);
  });
});

describe("deserialize: combat boundaries and prototype-member ids (PIT-002)", () => {
  it("accepts round = maxRounds and rejects maxRounds + 1", () => {
    const max = TEST_RULES.combat.maxRounds;
    expect(() =>
      deserialize(applyOps(combatBase, [set("public.combat.round", max)]), TEST_RULES),
    ).not.toThrow();
    expectRejected(
      applyOps(combatBase, [set("public.combat.round", max + 1)]),
      "deserialize: combat.round out of range",
    );
  });

  it("accepts npc hp = stats.hp and rejects stats.hp + 1", () => {
    const hp = (npcBase.public.combat?.sides[1] as { stats: { hp: number } }).stats.hp;
    expect(() =>
      deserialize(applyOps(npcBase, [set("public.combat.sides.1.hp", hp)]), TEST_RULES),
    ).not.toThrow();
    expectRejected(
      applyOps(npcBase, [set("public.combat.sides.1.hp", hp + 1)]),
      "deserialize: combat.sides[1].hp out of range",
    );
  });

  it("rejects townTier 0 and enforcer level 0", () => {
    expectRejected(
      applyOps(guardianBase, [set("public.combat.sides.1.npc.townTier", 0)]),
      "deserialize: combat.sides[1].npc.townTier out of range",
    );
    expectRejected(
      applyOps(enforcerBase, [set("public.combat.sides.1.npc.level", 0)]),
      "deserialize: combat.sides[1].npc.level out of range",
    );
  });

  it("rejects a prompt whose default is not the engine default", () => {
    expectRejected(
      applyOps(combatBase, [set("private.p2.prompt.default", "counter")]),
      "deserialize: private.p2.prompt does not match the combat exchange",
    );
  });

  it("checks hidden.decision.choices of a committed combat decision", () => {
    expectRejected(
      applyOps(combatCommittedBase, [set("hidden.decision.choices.p1", "guard")]),
      "deserialize: hidden.decision.choices.p1 is not one of the options",
    );
    expectRejected(
      applyOps(combatCommittedBase, [set("hidden.decision.choices", {})]),
      "deserialize: hidden.decision.choices keys do not match committed",
    );
  });

  it.each(["toString", "constructor", "__proto__"])(
    "treats %s as an unknown monster and guardian id",
    (id) => {
      expectRejected(
        applyOps(npcBase, [set("public.combat.sides.1.npc.id", id)]),
        "deserialize: combat.sides[1].npc is an unknown monster",
      );
      expectRejected(
        applyOps(guardianBase, [set("public.combat.sides.1.npc.id", id)]),
        "deserialize: combat.sides[1].npc is an unknown guardian",
      );
    },
  );

  it("round-trips combats between seats named like Object.prototype members", () => {
    const game = newGame({
      v: 2,
      seed: "proto",
      players: [
        { id: "toString", classId: "fighter" },
        { id: "valueOf", classId: "caster" },
      ],
    });
    const combat = applyAll(game, [
      {
        v: 2,
        type: "combat/start",
        playerId: "system",
        attacker: "valueOf",
        opponent: { kind: "player", playerId: "toString" },
      },
    ]).state;
    expect(combat.public.combat).not.toBeNull();
    expect(deserialize(serialize(combat), TEST_RULES)).toEqual(combat);
  });
});
