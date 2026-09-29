// The combat state machine: combat/start and system/setCharacter validation (single mutations,
// exact code + message, PIT-001), initiative, stun/skip, flee/items, draws, KO, poison/regen,
// choice history and RNG draw order. After every applied action the state must round-trip through
// deserialize(serialize(s), rules). Crafted rules are deep copies of TEST_RULES.
import { describe, expect, it } from "vitest";
import type { GameEvent } from "../src/events";
import {
  attackerOptions,
  DEFENDER_OPTIONS,
  exchangeRoles,
  requiredFor,
} from "../src/combat/options";
import { npcStats } from "../src/combat/stats";
import { combatStartHandler } from "../src/handlers/combat";
import { setCharacterHandler } from "../src/handlers/system";
import { reduce } from "../src/reducer";
import { nextInt } from "../src/rng";
import type { Rules } from "../src/rules";
import { deserialize, serialize } from "../src/serialize";
import { MAX_COUNTER, type CharacterPublic, type GameSettings, type GameState } from "../src/types";
import { COMBAT_GOLDEN_ACTIONS, COMBAT_GOLDEN_SETTINGS } from "./arbitraries";
import { applyAll, deepFreeze, FIXTURE_SETTINGS, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

// ---- helpers ---------------------------------------------------------------------------------

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("missing fixture entry");
  return value;
}

/** A deep copy of TEST_RULES (like `structuredClone`) edited by `edit`; TEST_RULES is never mutated. */
function craft(edit: (rules: Mutable<Rules>) => void): Rules {
  // JSON data only, so a JSON round trip is a deep copy (the core tsconfig has no structuredClone)
  const rules = JSON.parse(JSON.stringify(TEST_RULES)) as Mutable<Rules>;
  edit(rules);
  return rules;
}

const start = (attacker: string, opponent: unknown) => ({
  v: 2,
  type: "combat/start",
  playerId: "system",
  attacker,
  opponent,
});
const vs = (playerId: string) => ({ kind: "player", playerId });
const monster = (id: string, senior = false) => ({
  kind: "npc",
  npc: { kind: "monster", id, senior },
});
const guardian = (id: string, townTier: number) => ({
  kind: "npc",
  npc: { kind: "guardian", id, townTier },
});
const commit = (playerId: string, decisionId: string, choice: string) => ({
  v: 2,
  type: "decision/commit",
  playerId,
  decisionId,
  choice,
});
const setChar = (target: string, over: Record<string, unknown> = {}) => ({
  v: 2,
  type: "system/setCharacter",
  playerId: "system",
  target,
  classId: "fighter",
  level: 1,
  weapon: "stick",
  shield: "lid",
  accessory: null,
  battleSpell: "zap",
  wardSpell: null,
  bag: [],
  ...over,
});

interface Applied {
  state: GameState;
  events: GameEvent[];
}

/** Applies one action, asserting acceptance, no input mutation and the deserialize round trip. */
function step(state: GameState, action: unknown, rules: Rules = TEST_RULES): Applied {
  deepFreeze(state);
  const result = reduce(state, action, rules);
  if (!result.ok) throw new Error(`rejected: ${result.error.code} ${result.error.message}`);
  expect(deserialize(serialize(result.state), rules)).toEqual(result.state);
  return { state: result.state, events: [...result.events] };
}

function run(state: GameState, actions: readonly unknown[], rules: Rules = TEST_RULES): Applied {
  let current = state;
  const events: GameEvent[] = [];
  for (const action of actions) {
    const applied = step(current, action, rules);
    current = applied.state;
    events.push(...applied.events);
  }
  return { state: current, events };
}

function fails(
  state: GameState,
  action: unknown,
  code: string,
  message: string,
  rules: Rules = TEST_RULES,
): void {
  const before = serialize(state);
  expect(reduce(state, action, rules)).toEqual({ ok: false, error: { code, message } });
  expect(serialize(state)).toBe(before);
}

/** Sets values by dotted path in the serialized state and loads it back (must stay valid). */
function edit(state: GameState, changes: Record<string, unknown>, rules: Rules = TEST_RULES) {
  const json: unknown = JSON.parse(serialize(state));
  for (const [path, value] of Object.entries(changes)) {
    const keys = path.split(".");
    const last = keys.pop() ?? "";
    let node = json as Record<string, unknown>;
    for (const key of keys) node = node[key] as Record<string, unknown>;
    node[last] = value;
  }
  return deserialize(JSON.stringify(json), rules);
}

function ofType<T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

/** Commits the prompted players of the open exchange (attacker first in `required`). */
function playExchange(
  state: GameState,
  attack = "attack",
  defend = "guard",
  rules: Rules = TEST_RULES,
): Applied {
  const { pending } = state.public;
  if (pending === null) throw new Error("no open decision");
  const [first, second] = pending.required;
  const actions = [commit(first ?? "", pending.id, attack)];
  if (second !== undefined) actions.push(commit(second, pending.id, defend));
  return run(state, actions, rules);
}

const fixture = () => newGame();
const ZERO = { atk: 0, def: 0, mag: 0, spd: 0, poison: false, stun: false };

// ---- combat/start ----------------------------------------------------------------------------

describe("combat/start", () => {
  it("opens the first exchange: CombatStarted, RoundStarted, decision with attacker-first prompts", () => {
    const before = fixture();
    const { state, events } = step(before, start("p1", vs("p2")));
    // p1 (spd 10, luck 5) ties p2 (spd 10, luck 9): one draw (1, 5 + 9 + 2), first = u <= 6 ? 0 : 1
    const [u, rng] = nextInt(before.hidden.rng, 1, 16);
    const first = u <= 6 ? 0 : 1;
    expect(events.map((e) => e.type)).toEqual([
      "CombatStarted",
      "RoundStarted",
      "DecisionOpened",
      "PromptOpened",
      "PromptOpened",
    ]);
    expect(ofType(events, "RoundStarted")[0]?.first).toBe(first);
    expect(state.hidden.rng).toEqual(rng);
    expect(state.hidden.combatSeq).toBe(1);
    expect(state.public.combat).toMatchObject({ id: "c1", round: 1, exchange: 1, first });
    const attackerId = first === 0 ? "p1" : "p2";
    const defenderId = first === 0 ? "p2" : "p1";
    expect(state.public.pending).toEqual({
      id: "d1",
      kind: "combat/exchange",
      required: [attackerId, defenderId],
      committed: [],
    });
    expect(state.private[defenderId]?.prompt).toEqual({
      decisionId: "d1",
      options: ["guard", "counter", "ward"],
      default: "guard",
    });
    expect(state.private[attackerId]?.prompt?.default).toBe("attack");
    expect(state.private[attackerId]?.prompt?.options.slice(0, 2)).toEqual(["attack", "strike"]);
  });

  it("higher SPD goes first without a draw", () => {
    const fastP1 = run(fixture(), [setChar("p1", { accessory: "band" })]).state;
    const a = step(fastP1, start("p1", vs("p2")));
    expect(ofType(a.events, "RoundStarted")[0]?.first).toBe(0);
    expect(a.state.hidden.rng).toEqual(fastP1.hidden.rng);
    const fastP2 = run(fixture(), [setChar("p2", { classId: "caster", accessory: "band" })]).state;
    const b = step(fastP2, start("p1", vs("p2")));
    expect(ofType(b.events, "RoundStarted")[0]?.first).toBe(1);
    expect(b.state.hidden.rng).toEqual(fastP2.hidden.rng);
    expect(b.state.public.pending?.required).toEqual(["p2", "p1"]);
  });

  it("builds npc sides from the stat snapshot (monster, senior, guardian, enforcer)", () => {
    const cases = [
      { kind: "monster", id: "slime", senior: false },
      { kind: "monster", id: "crab", senior: true },
      { kind: "guardian", id: "lich", townTier: 2 },
      { kind: "enforcer", level: 5 },
    ] as const;
    for (const npc of cases) {
      const { state } = step(fixture(), start("p1", { kind: "npc", npc }));
      const stats = npcStats(TEST_RULES, npc);
      expect(state.public.combat?.sides[0]).toEqual({ kind: "player", playerId: "p1", mods: ZERO });
      expect(state.public.combat?.sides[1]).toEqual({
        kind: "npc",
        npc,
        stats,
        hp: stats.hp,
        mods: ZERO,
      });
    }
    expect(npcStats(TEST_RULES, { kind: "guardian", id: "lich", townTier: 2 }).hp).toBe(144);
  });

  it("an npc attacker prompts only the defending player", () => {
    // the lich (T3 spd 15) outpaces p1 (spd 10) and attacks first
    const { state } = step(fixture(), start("p1", guardian("lich", 2)));
    expect(state.public.combat?.first).toBe(1);
    expect(state.public.pending?.required).toEqual(["p1"]);
    expect(state.private.p1?.prompt?.options).toEqual(["guard", "counter", "ward"]);
  });

  it("works for seats named like Object.prototype members (PIT-002)", () => {
    const game = newGame({
      v: 2,
      seed: "proto",
      players: [
        { id: "toString", classId: "fighter" },
        { id: "valueOf", classId: "caster" },
        { id: "hasOwnProperty", classId: "fighter" },
      ],
    });
    const { state } = step(game, start("toString", vs("valueOf")));
    const played = playExchange(state);
    expect(played.events.some((e) => e.type === "ExchangeResolved")).toBe(true);
    fails(
      game,
      start("isPrototypeOf", vs("valueOf")),
      "INVALID_PAYLOAD",
      "attacker must be a seated player",
    );
  });
});

describe("combat/start validation (one mutation each)", () => {
  const koP = (id: string) => edit(fixture(), { [`public.characters.${id}.hp`]: 0 });
  const atSeq = (path: string, n: number) => edit(fixture(), { [path]: n });
  const rows: [string, () => GameState, unknown, string][] = [
    ["unseated attacker", fixture, start("ghost", vs("p2")), "attacker must be a seated player"],
    ["toString attacker", fixture, start("toString", vs("p2")), "attacker must be a seated player"],
    ["KO'd attacker", () => koP("p1"), start("p1", vs("p2")), "attacker is knocked out"],
    ["unseated opponent", fixture, start("p1", vs("ghost")), "opponent player must be seated"],
    ["self duel", fixture, start("p1", vs("p1")), "opponent must differ from attacker"],
    ["KO'd opponent", () => koP("p2"), start("p1", vs("p2")), "opponent is knocked out"],
    ["unknown monster", fixture, start("p1", monster("nope")), "unknown monster"],
    ["monster toString", fixture, start("p1", monster("toString")), "unknown monster"],
    ["monster constructor", fixture, start("p1", monster("constructor")), "unknown monster"],
    ["monster __proto__", fixture, start("p1", monster("__proto__")), "unknown monster"],
    ["unknown guardian", fixture, start("p1", guardian("nope", 1)), "unknown guardian"],
    ["guardian toString", fixture, start("p1", guardian("toString", 1)), "unknown guardian"],
    ["guardian __proto__", fixture, start("p1", guardian("__proto__", 1)), "unknown guardian"],
    [
      "enforcer above maxLevel",
      fixture,
      start("p1", { kind: "npc", npc: { kind: "enforcer", level: 11 } }),
      "enforcer level above maxLevel",
    ],
    [
      "combatSeq at MAX_COUNTER",
      () => atSeq("hidden.combatSeq", MAX_COUNTER),
      start("p1", vs("p2")),
      "combatSeq would exceed MAX_COUNTER",
    ],
    [
      "decisionSeq one above the bound",
      () => atSeq("hidden.decisionSeq", MAX_COUNTER - 2 * TEST_RULES.combat.maxRounds + 1),
      start("p1", vs("p2")),
      "decisionSeq would exceed MAX_COUNTER",
    ],
  ];

  it.each(rows)("%s", (_name, state, action, message) => {
    fails(state(), action, "INVALID_PAYLOAD", message);
  });

  it("accepts combatSeq = MAX_COUNTER - 1 and decisionSeq exactly at the bound", () => {
    const seq = step(atSeq("hidden.combatSeq", MAX_COUNTER - 1), start("p1", vs("p2")));
    expect(seq.state.public.combat?.id).toBe(`c${MAX_COUNTER}`);
    const bound = MAX_COUNTER - 2 * TEST_RULES.combat.maxRounds;
    expect(() => step(atSeq("hidden.decisionSeq", bound), start("p1", vs("p2")))).not.toThrow();
    expect(() => step(atSeq("hidden.decisionSeq", bound - 1), start("p1", vs("p2")))).not.toThrow();
  });

  const bad = "invalid payload for combat/start";
  const npcAction = (npc: unknown) => start("p1", { kind: "npc", npc });
  const shapeRows: [string, unknown][] = [
    ["senior not a boolean", npcAction({ kind: "monster", id: "slime", senior: "true" })],
    ["townTier 0", npcAction({ kind: "guardian", id: "lich", townTier: 0 })],
    ["townTier 5", npcAction({ kind: "guardian", id: "lich", townTier: 5 })],
    ["level 0", npcAction({ kind: "enforcer", level: 0 })],
    ["level 100", npcAction({ kind: "enforcer", level: 100 })],
    ["level 1.5", npcAction({ kind: "enforcer", level: 1.5 })],
    ["extra key in opponent", start("p1", { kind: "player", playerId: "p2", extra: 1 })],
    ["extra key in npc", npcAction({ kind: "monster", id: "slime", senior: false, extra: 1 })],
    ["unknown opponent kind", start("p1", { kind: "boss" })],
    ["unknown opponent kind with an npc", start("p1", { kind: "boss", npc: monster("slime").npc })],
    ["opponent null", start("p1", null)],
    ["opponent not an object", start("p1", 5)],
    ["npc null", start("p1", { kind: "npc", npc: null })],
    ["unknown npc kind", npcAction({ kind: "boss" })],
    ["attacker not a string", start(5 as unknown as string, vs("p2"))],
    ["extra top-level key", { ...start("p1", vs("p2")), extra: 1 }],
    [
      "extra key in guardian npc",
      npcAction({ kind: "guardian", id: "lich", townTier: 1, extra: 1 }),
    ],
    ["extra key in enforcer npc", npcAction({ kind: "enforcer", level: 5, extra: 1 })],
    ["extra key beside the npc", start("p1", { ...monster("slime"), extra: 1 })],
    ["opponent playerId not a string", start("p1", { kind: "player", playerId: 5 })],
    ["monster id not a string", npcAction({ kind: "monster", id: 5, senior: false })],
    ["guardian id not a string", npcAction({ kind: "guardian", id: 5, townTier: 1 })],
    ["playerId not a string", { ...start("p1", vs("p2")), playerId: 5 }],
  ];
  it.each(shapeRows)("shape: %s", (_name, action) => {
    fails(fixture(), action, "INVALID_PAYLOAD", bad);
  });

  it("the guard verifies the envelope itself (v and type)", () => {
    const valid = start("p1", vs("p2"));
    expect(combatStartHandler.guard(valid)).toBe(true);
    expect(combatStartHandler.guard({ ...valid, v: 1 })).toBe(false);
    expect(combatStartHandler.guard({ ...valid, type: "timeout" })).toBe(false);
  });

  it("rejects during a decision (WRONG_PHASE) and from a player (WRONG_ACTOR)", () => {
    const { state } = step(fixture(), start("p1", vs("p2")));
    fails(
      state,
      start("p1", vs("p2")),
      "WRONG_PHASE",
      "combat/start is not allowed in phase decision",
    );
    fails(
      fixture(),
      { ...start("p1", vs("p2")), playerId: "p1" },
      "WRONG_ACTOR",
      "p1 may not perform combat/start",
    );
  });
});

// ---- system/setCharacter ---------------------------------------------------------------------

describe("system/setCharacter", () => {
  it("sets class, level, xp, gear, spells and bag; heals to sheet max; keeps the rest", () => {
    const before = run(fixture(), [
      setChar("p1", { classId: "battlemage", level: 1, accessory: "band" }),
    ]);
    expect(before.events.map((e) => e.type)).toEqual(["CharacterSet", "BagUpdated"]);
    expect(before.state.public.characters.p1).toMatchObject({
      classId: "battlemage",
      level: 1,
      xp: 0,
      accessory: "band",
    });
    const l5 = step(
      before.state,
      setChar("p1", { level: 5, weapon: "sword", bag: ["herb", "herb"] }),
    );
    const c5 = need(l5.state.public.characters.p1);
    expect(c5.xp).toBe(TEST_RULES.progression.xpCurve[4]);
    // fighter L5 (no wins): floor((40 + 8 x 4) x 12000 / 10000) = 86; the spec's 94 adds rank-2 hpBp
    expect(c5.hp).toBe(86);
    expect(l5.state.private.p1?.bag).toEqual(["herb", "herb"]);
    expect(l5.events[0]).toMatchObject({ type: "CharacterSet", playerId: "p1", level: 5, hp: 86 });
    expect(l5.events[1]).toMatchObject({
      type: "BagUpdated",
      playerId: "p1",
      bag: ["herb", "herb"],
    });
    expect(l5.events[1]?.visibility).toEqual({ kind: "players", ids: ["p1"] });
    // gold, mastery, portable, scrolls and prompt stay
    expect(c5.gold).toBe(100);
    expect(c5.mastery).toEqual(before.state.public.characters.p1?.mastery);
    expect(c5.portable).toBeNull();
    expect(l5.state.private.p1?.scrolls).toEqual([]);
    expect(l5.state.private.p1?.prompt).toBeNull();
  });

  it("revives a knocked-out character", () => {
    const ko = edit(fixture(), { "public.characters.p1.hp": 0 });
    const revived = step(ko, setChar("p1"));
    expect(revived.state.public.characters.p1?.hp).toBe(48);
  });

  const rows: [string, unknown, string][] = [
    ["unseated target", setChar("ghost"), "target must be a seated player"],
    ["unknown class", setChar("p1", { classId: "nope" }), "unknown class"],
    ["class toString", setChar("p1", { classId: "toString" }), "unknown class"],
    ["level above maxLevel", setChar("p1", { level: 11 }), "level above maxLevel"],
    ["missing weapon", setChar("p1", { weapon: "nope" }), "unknown weapon"],
    ["weapon toString", setChar("p1", { weapon: "toString" }), "unknown weapon"],
    ["shield in the weapon slot", setChar("p1", { weapon: "lid" }), "unknown weapon"],
    ["missing shield", setChar("p1", { shield: "nope" }), "unknown shield"],
    ["weapon in the shield slot", setChar("p1", { shield: "stick" }), "unknown shield"],
    ["missing accessory", setChar("p1", { accessory: "nope" }), "unknown accessory"],
    ["weapon in the accessory slot", setChar("p1", { accessory: "stick" }), "unknown accessory"],
    ["unknown battle spell", setChar("p1", { battleSpell: "nope" }), "unknown battle spell"],
    ["battle spell toString", setChar("p1", { battleSpell: "toString" }), "unknown battle spell"],
    [
      "a ward spell in the battle slot",
      setChar("p1", { battleSpell: "shell" }),
      "unknown battle spell",
    ],
    ["unknown ward spell", setChar("p1", { wardSpell: "nope" }), "unknown ward spell"],
    ["ward spell constructor", setChar("p1", { wardSpell: "constructor" }), "unknown ward spell"],
    ["unknown bag item", setChar("p1", { bag: ["nope"] }), "unknown item in bag"],
    ["bag item toString", setChar("p1", { bag: ["toString"] }), "unknown item in bag"],
    [
      "bag over the class size",
      setChar("p1", { bag: ["herb", "herb", "herb", "herb"] }),
      "bag exceeds class bag size",
    ],
  ];
  it.each(rows)("rejects: %s", (_name, action, message) => {
    fails(fixture(), action, "INVALID_PAYLOAD", message);
  });

  it("accepts a bag exactly at the class size and the bigger caster bag", () => {
    expect(() => step(fixture(), setChar("p1", { bag: ["herb", "herb", "herb"] }))).not.toThrow();
    expect(() =>
      step(fixture(), setChar("p1", { classId: "caster", bag: ["herb", "herb", "herb", "herb"] })),
    ).not.toThrow();
  });

  const bad = "invalid payload for system/setCharacter";
  const shapeRows: [string, Record<string, unknown>][] = [
    ["level 0", { level: 0 }],
    ["level 100", { level: 100 }],
    ["level 1.5", { level: 1.5 }],
    ["weapon not a string", { weapon: 5 }],
    ["shield not a string", { shield: 5 }],
    ["accessory not a string", { accessory: 5 }],
    ["battleSpell not a string", { battleSpell: 5 }],
    ["wardSpell not a string", { wardSpell: 5 }],
    ["bag not an array", { bag: "herb" }],
    ["bag of 17", { bag: Array.from({ length: 17 }, () => "herb") }],
    ["bag entry not a string", { bag: [5] }],
    ["target not a string", { target: 5 }],
    ["classId not a string", { classId: 5 }],
    ["playerId not a string", { playerId: 5 }],
    ["extra key", { extra: 1 }],
  ];
  it.each(shapeRows)("shape: %s", (_name, over) => {
    fails(fixture(), { ...setChar("p1"), ...over }, "INVALID_PAYLOAD", bad);
  });

  it("the guard verifies the envelope itself (v and type)", () => {
    expect(setCharacterHandler.guard(setChar("p1"))).toBe(true);
    expect(setCharacterHandler.guard({ ...setChar("p1"), v: 1 })).toBe(false);
    expect(setCharacterHandler.guard({ ...setChar("p1"), type: "timeout" })).toBe(false);
  });

  it("guards its phase and actor", () => {
    fails(
      fixture(),
      { ...setChar("p1"), playerId: "p1" },
      "WRONG_ACTOR",
      "p1 may not perform system/setCharacter",
    );
    const { state } = step(fixture(), start("p1", vs("p2")));
    fails(
      state,
      setChar("p1"),
      "WRONG_PHASE",
      "system/setCharacter is not allowed in phase decision",
    );
  });
});

// ---- options ---------------------------------------------------------------------------------

describe("combat/options", () => {
  const ch = (over: Partial<CharacterPublic> = {}): CharacterPublic => ({
    ...need(newGame().public.characters.p1),
    ...over,
  });

  it("lists attack, strike, spell (only with a battle spell), flee, then distinct combat items", () => {
    const bag = ["herb", "boots", "herb", "wig", "tonic", "antidote", "bomb"];
    expect(attackerOptions(TEST_RULES, ch(), bag)).toEqual([
      "attack",
      "strike",
      "spell",
      "flee",
      "item:herb",
      "item:tonic",
      "item:antidote",
      "item:bomb",
    ]);
    expect(attackerOptions(TEST_RULES, ch({ battleSpell: null }), ["wig", "boots"])).toEqual([
      "attack",
      "strike",
      "flee",
    ]);
    expect(attackerOptions(TEST_RULES, ch(), ["toString", "herb"])).toEqual([
      "attack",
      "strike",
      "spell",
      "flee",
      "item:herb",
    ]);
  });

  it("always offers Ward to the defender, even with no ward spell (D2)", () => {
    expect(DEFENDER_OPTIONS).toEqual(["guard", "counter", "ward"]);
  });

  it("derives roles and required players from the combat state", () => {
    const { state } = step(fixture(), start("p1", monster("slime")));
    const combat = state.public.combat;
    if (combat === null) throw new Error("no combat");
    expect(exchangeRoles({ ...combat, first: 0, exchange: 1 })).toEqual({
      attacker: 0,
      defender: 1,
    });
    expect(exchangeRoles({ ...combat, first: 0, exchange: 2 })).toEqual({
      attacker: 1,
      defender: 0,
    });
    expect(exchangeRoles({ ...combat, first: 1, exchange: 1 })).toEqual({
      attacker: 1,
      defender: 0,
    });
    expect(requiredFor({ ...combat, first: 0, exchange: 1 })).toEqual(["p1"]);
    expect(requiredFor({ ...combat, first: 1, exchange: 1 })).toEqual(["p1"]);
    const stun = { ...ZERO, stun: true };
    const [a, b] = combat.sides;
    expect(
      requiredFor({ ...combat, sides: [{ ...a, mods: stun }, b], first: 0, exchange: 1 }),
    ).toEqual([]);
  });
});

// ---- exchanges: flee, items, draws, RNG order ------------------------------------------------

describe("exchanges", () => {
  it("draws the npc defense, then the crit, then (at the next reveal) the npc command, then its crit", () => {
    const { state: opened } = step(fixture(), start("p1", monster("slime")));
    const first = step(opened, commit("p1", "d1", "attack"));
    const [uDef, r1] = nextInt(opened.hidden.rng, 1, 100);
    const [, r2] = nextInt(r1, 1, 10_000);
    expect(ofType(first.events, "ExchangeResolved")[0]?.defense).toBe(
      uDef <= 40 ? "guard" : uDef <= 70 ? "counter" : "ward",
    );
    // the npc's own command is drawn when its exchange resolves, not when the prompt opens
    expect(first.state.hidden.rng).toEqual(r2);
    expect(first.state.public.pending?.required).toEqual(["p1"]);
    const second = step(first.state, commit("p1", "d2", "guard"));
    const [uCmd, r3] = nextInt(r2, 1, 100);
    const command = uCmd <= 60 ? "attack" : uCmd <= 80 ? "strike" : "spell";
    expect(ofType(second.events, "ExchangeResolved")[0]).toMatchObject({ attacker: 1, command });
    // Attack/Strike into Guard are crit-eligible (one more draw); a Spell is not
    const expected = command === "spell" ? r3 : nextInt(r3, 1, 10_000)[1];
    expect(second.state.hidden.rng).toEqual(expected);
  });

  it("an item command draws no npc defense and no crit", () => {
    const { state: opened } = step(fixture(), start("p1", monster("slime")));
    const { state, events } = step(opened, commit("p1", "d1", "item:herb"));
    expect(state.hidden.rng).toEqual(opened.hidden.rng);
    expect(ofType(events, "ExchangeResolved")[0]).toMatchObject({
      command: "item:herb",
      defense: null,
      effects: ["item:herb"],
    });
    expect(ofType(events, "BagUpdated")).toMatchObject([{ playerId: "p1", bag: [] }]);
  });

  it("a player defender's revealed choice is ignored against an item or flee", () => {
    const pvp = step(fixture(), start("p1", vs("p2"))).state;
    const attackerId = pvp.public.pending?.required[0] ?? "";
    const defenderId = pvp.public.pending?.required[1] ?? "";
    const { events } = run(pvp, [
      commit(attackerId, "d1", "item:herb"),
      commit(defenderId, "d1", "counter"),
    ]);
    expect(ofType(events, "ExchangeResolved")[0]).toMatchObject({
      defense: null,
      command: "item:herb",
    });
  });

  it("flee succeeds or fails on the flee chance and ends the combat as fled", () => {
    const always = craft((r) => {
      r.combat.fleeMinBp = 10_000;
      r.combat.fleeMaxBp = 10_000;
    });
    const opened = step(fixture(), start("p1", monster("slime")), always).state;
    const ok = step(opened, commit("p1", "d1", "flee"), always);
    expect(ofType(ok.events, "ExchangeResolved")[0]).toMatchObject({
      effects: ["fled"],
      defense: null,
    });
    expect(ofType(ok.events, "CombatEnded")).toMatchObject([
      { outcome: "fled", winner: null, fled: 0 },
    ]);
    expect(ok.state.public.combat).toBeNull();
    expect(ok.state.public.phase).toBe("turn");
    expect(ok.state.public.pending).toBeNull();

    const never = craft((r) => {
      r.combat.fleeMinBp = 0;
      r.combat.fleeMaxBp = 0;
    });
    const opened2 = step(fixture(), start("p1", monster("slime")), never).state;
    const failed = step(opened2, commit("p1", "d1", "flee"), never);
    expect(ofType(failed.events, "ExchangeResolved")[0]).toMatchObject({
      effects: ["flee-failed"],
    });
    expect(ofType(failed.events, "CombatEnded")).toEqual([]);
    expect(failed.state.public.combat?.exchange).toBe(2);
  });

  it("a smoke bomb ends the combat as fled for the user", () => {
    const game = run(fixture(), [
      setChar("p2", { classId: "caster", bag: ["herb", "bomb"] }),
    ]).state;
    const { state: opened } = step(game, start("p2", monster("slime")));
    const { state, events } = step(opened, commit("p2", "d1", "item:bomb"));
    expect(ofType(events, "ExchangeResolved")[0]).toMatchObject({
      effects: ["item:bomb", "fled"],
    });
    expect(ofType(events, "CombatEnded")).toMatchObject([
      { outcome: "fled", winner: null, fled: 0 },
    ]);
    expect(state.private.p2?.bag).toEqual(["herb"]);
    expect(ofType(events, "BagUpdated")).toMatchObject([{ playerId: "p2", bag: ["herb"] }]);
  });

  it("emits no BagUpdated when no bag changed", () => {
    const { state: opened } = step(fixture(), start("p1", monster("slime")));
    const { events } = step(opened, commit("p1", "d1", "attack"));
    expect(ofType(events, "BagUpdated")).toEqual([]);
  });

  it("a bag item with a 48-char id yields option item:<48 chars> and resolves", () => {
    const longId = `a${"b".repeat(47)}`;
    const rules = craft((r) => {
      r.items[longId] = {
        id: longId,
        kind: "consumable",
        price: 1,
        use: "combat",
        effect: { kind: "heal", bp: 1000 },
      };
    });
    const game = run(newGame(undefined, rules), [setChar("p1", { bag: [longId] })], rules).state;
    const { state: opened } = step(game, start("p1", monster("slime")), rules);
    const option = `item:${longId}`;
    expect(option).toHaveLength(53);
    expect(opened.private.p1?.prompt?.options).toContain(option);
    const { state, events } = step(opened, commit("p1", "d1", option), rules);
    expect(ofType(events, "ExchangeResolved")[0]?.effects).toEqual([option]);
    expect(state.private.p1?.bag).toEqual([]);
  });
});

// ---- endings ---------------------------------------------------------------------------------

describe("endings", () => {
  const bigHp = craft((r) => {
    r.progression.baseStats = { ...r.progression.baseStats, hp: 5000 };
  });

  it("draws after maxRounds complete rounds with both standing", () => {
    let { state } = step(newGame(undefined, bigHp), start("p1", vs("p2")), bigHp);
    const events: GameEvent[] = [];
    for (let i = 0; i < 6; i++) {
      const played = playExchange(state, "attack", "guard", bigHp);
      state = played.state;
      events.push(...played.events);
    }
    expect(ofType(events, "RoundEnded")).toHaveLength(3);
    expect(ofType(events, "RoundStarted")).toHaveLength(2);
    const ended = ofType(events, "CombatEnded");
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ outcome: "draw", winner: null, fled: null });
    expect(state.public.combat).toBeNull();
    expect(state.public.phase).toBe("turn");
    expect(state.public.characters.p1?.hp).toBeGreaterThan(0);
    expect(state.public.characters.p2?.hp).toBeGreaterThan(0);
  });

  const fastP1 = () => run(fixture(), [setChar("p1", { accessory: "band" })]).state;

  it("a KO ends the combat with the other side as winner", () => {
    const game = edit(fastP1(), { "public.characters.p2.hp": 1 });
    const { state: opened } = step(game, start("p1", vs("p2")));
    const { state, events } = playExchange(opened, "attack", "guard");
    expect(ofType(events, "CombatEnded")).toMatchObject([
      { outcome: "ko", winner: 0, fled: null, hp: [expect.any(Number) as number, 0] },
    ]);
    expect(state.public.characters.p2?.hp).toBe(0);
    expect(state.public.combat).toBeNull();
    // a KO'd fighter cannot start another combat
    fails(state, start("p1", vs("p2")), "INVALID_PAYLOAD", "opponent is knocked out");
    fails(state, start("p2", vs("p1")), "INVALID_PAYLOAD", "attacker is knocked out");
  });

  it("a reflected Strike can KO the attacker: the defender wins", () => {
    const game = edit(fastP1(), { "public.characters.p1.hp": 1 });
    const { state: opened } = step(game, start("p1", vs("p2")));
    const { events } = playExchange(opened, "strike", "counter");
    expect(ofType(events, "CombatEnded")).toMatchObject([
      { outcome: "ko", winner: 1, hp: [0, expect.any(Number) as number] },
    ]);
  });

  it("a double KO in one exchange is a draw", () => {
    const prepared = run(fixture(), [
      setChar("p1", { accessory: "band" }),
      setChar("p2", { classId: "caster", accessory: "charm", wardSpell: "mirror-ward" }),
    ]).state;
    const game = edit(prepared, { "public.characters.p1.hp": 1, "public.characters.p2.hp": 1 });
    const { state: opened } = step(game, start("p1", vs("p2")));
    const { state, events } = playExchange(opened, "spell", "ward");
    expect(ofType(events, "ExchangeResolved")[0]?.hp).toEqual([0, 0]);
    expect(ofType(events, "CombatEnded")).toMatchObject([
      { outcome: "draw", winner: null, fled: null, hp: [0, 0] },
    ]);
    expect(state.public.combat).toBeNull();
  });
});

// ---- statuses --------------------------------------------------------------------------------

describe("stun", () => {
  /** A stun that always lands and a lich that always casts it; the lich ties p1's SPD. */
  const stunRules = craft((r) => {
    need(r.battleSpells.jolt).effect = { kind: "stun", chanceBp: 10_000 };
    const lich = need(r.guardians.lich);
    lich.attackTable = { attack: 0, strike: 0, spell: 100, flee: 0 };
    lich.defendTable = { guard: 100, counter: 0, ward: 0 };
    lich.battleSpell = "jolt";
    lich.statBp = { ...lich.statBp, spd: 8400 };
  });

  it("a stunned attacker skips its exchange; a stunned player defender is resolved as open without a decision", () => {
    // seed stun-3: the SPD tie goes to p1 in round 1 and to the lich in round 2
    const settings: GameSettings = { ...FIXTURE_SETTINGS, seed: "stun-3" };
    const opened = step(newGame(settings, stunRules), start("p1", guardian("lich", 1)), stunRules);
    const d1 = step(opened.state, commit("p1", "d1", "attack"), stunRules);
    expect(ofType(d1.events, "ExchangeResolved")[0]).toMatchObject({
      attacker: 0,
      defense: "guard",
    });
    const d2 = step(d1.state, commit("p1", "d2", "guard"), stunRules);
    // exchange 1.2: the lich stuns p1 (jolt into Guard lands); round 2: the lich attacks first
    expect(ofType(d2.events, "RoundStarted").map((e) => e.first)).toEqual([1, 1]);
    const resolved = ofType(d2.events, "ExchangeResolved");
    expect(resolved[0]).toMatchObject({ attacker: 1, defense: "guard", effects: ["stun"] });
    // 2.1: p1 is a stunned defender: no decision opens, the lich's spell resolves against `open`
    expect(resolved[1]).toMatchObject({ round: 2, exchange: 1, attacker: 1, defense: "open" });
    const types = d2.events.map((e) => e.type);
    const round2 = types.indexOf("RoundStarted");
    expect(types.slice(round2, round2 + 3)).toEqual([
      "RoundStarted",
      "ExchangeResolved",
      "ExchangeSkipped",
    ]);
    // 2.2: the lich re-stunned p1, so p1's own exchange is skipped and the stun is consumed
    expect(ofType(d2.events, "ExchangeSkipped")).toMatchObject([
      { combatId: "c1", round: 2, exchange: 2, attacker: 0, reason: "stunned" },
    ]);
    const combat = d2.state.public.combat;
    expect(combat?.sides[0].mods.stun).toBe(false);
    expect(combat?.round).toBe(3);
  });

  /** The golden after combat/start: d1 open, p1 attacks, p2 defends; p2 is made a stunned defender. */
  function stunnedDefenderState(): GameState {
    const prefix = applyAll(
      newGame(COMBAT_GOLDEN_SETTINGS),
      COMBAT_GOLDEN_ACTIONS.slice(0, 2),
    ).state;
    expect(prefix.public.pending?.required).toEqual(["p1", "p2"]);
    return edit(prefix, {
      "public.combat.sides.1.mods.stun": true,
      "public.pending.required": ["p1"],
      "private.p2.prompt": null,
    });
  }

  it("a stunned player defender is not required; its stun is consumed once", () => {
    const game = stunnedDefenderState();
    const combat = game.public.combat;
    if (combat === null) throw new Error("no combat");
    expect(requiredFor(combat)).toEqual(["p1"]);
    const { state, events } = step(game, commit("p1", "d1", "attack"));
    expect(ofType(events, "ExchangeResolved")[0]).toMatchObject({ attacker: 0, defense: "open" });
    expect(state.public.combat?.sides[1].mods.stun).toBe(false);
    expect(ofType(events, "ExchangeSkipped")).toEqual([]);
    // exchange 2: p2 attacks and both are prompted again
    expect(state.public.pending?.required).toEqual(["p2", "p1"]);
  });

  it("an item against a stunned defender has no defense cell", () => {
    const { events, state } = step(stunnedDefenderState(), commit("p1", "d1", "item:herb"));
    expect(ofType(events, "ExchangeResolved")[0]).toMatchObject({
      command: "item:herb",
      defense: null,
    });
    expect(state.public.combat?.sides[1].mods.stun).toBe(false);
  });
});

describe("round end: poison then regen", () => {
  const rules = craft((r) => {
    const slime = need(r.monsters.slime);
    slime.statBp = { ...slime.statBp, atk: 0 };
    slime.attackTable = { attack: 100, strike: 0, spell: 0, flee: 0 };
    slime.defendTable = { guard: 100, counter: 0, ward: 0 };
    need(r.gear.lid).hooks = [{ hook: "roundRegenBp", value: 1000 }];
  });
  const opened = () => step(newGame(undefined, rules), start("p1", monster("slime")), rules).state;

  it("poison lowers hp (never below 1) before regen heals", () => {
    // p1: hp 3 and poisoned; the slime's atk-0 attack into Guard deals the minimum 1
    const game = edit(
      opened(),
      { "public.characters.p1.hp": 3, "public.combat.sides.0.mods.poison": true },
      rules,
    );
    const { events, state } = run(
      game,
      [commit("p1", "d1", "attack"), commit("p1", "d2", "guard")],
      rules,
    );
    expect(ofType(events, "ExchangeResolved")[1]).toMatchObject({ attacker: 1, damage: [1, 0] });
    // maxHp 48: poison max(1, floor(48 x 800 / 10000)) = 3, hp 2 -> max(1, 2 - 3) = 1 (lost 1);
    // regen floor(48 x 1000 / 10000) = 4 -> 5
    const ended = ofType(events, "RoundEnded")[0];
    expect(ended?.poison).toEqual([1, 0]);
    expect(ended?.regen[0]).toBe(4);
    expect(ended?.hp[0]).toBe(5);
    expect(state.public.characters.p1?.hp).toBe(5);
  });

  it("a poisoned side that can afford it loses floor(maxHp x poisonBp / 10000)", () => {
    const game = edit(opened(), { "public.combat.sides.0.mods.poison": true }, rules);
    const { events } = run(
      game,
      [commit("p1", "d1", "attack"), commit("p1", "d2", "guard")],
      rules,
    );
    const ended = ofType(events, "RoundEnded")[0];
    expect(ended?.poison).toEqual([3, 0]);
    // hp 48 - 1 (slime hit) - 3 (poison) + 4 (regen, capped by the missing hp)
    expect(ended?.regen[0]).toBe(4);
    expect(ended?.hp[0]).toBe(48 - 1 - 3 + 4);
  });
});

// ---- opponent model: choiceHistory -----------------------------------------------------------

describe("choiceHistory", () => {
  it("counts revealed commands and skips a timed-out default", () => {
    const opened = step(fixture(), start("p1", vs("p2"))).state;
    const [a = "", d = ""] = opened.public.pending?.required ?? [];
    const committed = step(opened, commit(a, "d1", "strike")).state;
    const { state } = step(committed, {
      v: 2,
      type: "timeout",
      playerId: "system",
      decisionId: "d1",
    });
    expect(state.public.choiceHistory[a]).toMatchObject({ strike: 1, guard: 0 });
    expect(state.public.choiceHistory[d]).toEqual({
      attack: 0,
      strike: 0,
      spell: 0,
      guard: 0,
      counter: 0,
      ward: 0,
    });
    expect(state.public.lastReveal).toMatchObject({ kind: "combat/exchange", timedOut: [d] });
  });

  it("does not count flee or item choices", () => {
    const opened = step(fixture(), start("p1", monster("slime"))).state;
    const { state } = step(opened, commit("p1", "d1", "item:herb"));
    expect(state.public.choiceHistory.p1).toEqual({
      attack: 0,
      strike: 0,
      spell: 0,
      guard: 0,
      counter: 0,
      ward: 0,
    });
  });
});

describe("commit validation during combat", () => {
  it("rejects a non-required player and choices outside the own options", () => {
    const game = newGame({
      v: 2,
      seed: "three",
      players: [
        { id: "p1", classId: "fighter" },
        { id: "p2", classId: "caster" },
        { id: "p3", classId: "fighter" },
      ],
    });
    const { state } = step(game, start("p1", vs("p2")));
    const [a = "", d = ""] = state.public.pending?.required ?? [];
    fails(state, commit("p3", "d1", "attack"), "WRONG_ACTOR", "p3 may not perform decision/commit");
    fails(state, commit(a, "d1", "guard"), "INVALID_PAYLOAD", "choice is not one of your options");
    fails(state, commit(d, "d1", "attack"), "INVALID_PAYLOAD", "choice is not one of your options");
    fails(
      state,
      commit(a, "d1", "item:bomb"),
      "INVALID_PAYLOAD",
      "choice is not one of your options",
    );
  });
});

describe("whole-combat determinism", () => {
  it("replaying the golden twice gives identical states and events", () => {
    const one = applyAll(newGame(COMBAT_GOLDEN_SETTINGS), COMBAT_GOLDEN_ACTIONS);
    const two = applyAll(newGame(COMBAT_GOLDEN_SETTINGS), COMBAT_GOLDEN_ACTIONS);
    expect(serialize(one.state)).toBe(serialize(two.state));
    expect(one.events).toEqual(two.events);
  });
});
