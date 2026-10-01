// Review cycle 1 (core) hardening: the engine stays inside its ranges for extreme-but-schema-legal
// content values (S1), `deserialize` demands decisionSeq headroom for an open combat (S2),
// `reduceAs` authenticates the actor (S3) and `createGame` reads settings once (S5). Every negative
// test is built so that exactly one check can reject it (PIT-001); the mutation table is in
// .planning/phases/02-combat-core-balance-sim/02-REVIEW-FIX-core.md.
import { describe, expect, it } from "vitest";
import { sheetStats, npcStats } from "../src/combat/stats";
import { createGame, SettingsError } from "../src/game";
import { victoryReward } from "../src/progression";
import { reduce, reduceAs } from "../src/reducer";
import type { Rules } from "../src/rules";
import { deserialize, serialize } from "../src/serialize";
import {
  MAX_COUNTER,
  MAX_STAT,
  type CombatSide,
  type GameSettings,
  type GameState,
} from "../src/types";
import {
  applyAll,
  craft,
  FIXTURE_SETTINGS,
  make,
  need,
  newGame,
  type SaveJson,
} from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const roundTrips = (state: GameState, rules: Rules): void => {
  expect(deserialize(serialize(state), rules)).toEqual(state);
};

const startVs = (opponent: unknown, attacker = "p1") => ({
  v: 2,
  type: "combat/start",
  playerId: "system",
  attacker,
  opponent,
});
const pvp = { kind: "player", playerId: "p2" };
const slime = { kind: "npc", npc: { kind: "monster", id: "slime", senior: false } };
const commit = (state: GameState, playerId: string, choice: string) => ({
  v: 2,
  type: "decision/commit",
  playerId,
  decisionId: state.public.pending?.id ?? "none",
  choice,
});
const useItem = (playerId: string, itemId: string) => ({
  v: 2,
  type: "loadout/useItem",
  playerId,
  itemId,
});
const grantGold = (amount: number) => ({
  v: 2,
  type: "system/grant",
  playerId: "system",
  target: "p1",
  grant: { kind: "gold", amount },
});

// ---------------------------------------------------------------------------------------- S1

describe("S1: extreme content values keep the state inside its ranges", () => {
  describe("heal clamps", () => {
    const negative = craft((r) => {
      need(r.items.herb).effect = { kind: "heal", bp: -5000 };
    });
    const oversized = craft((r) => {
      need(r.items.herb).effect = { kind: "heal", bp: 9_000_000 };
    });
    const hurt = (rules: Rules): GameState =>
      make((j: SaveJson) => {
        need(j.public.characters.p1).hp = 22;
        need(j.public.characters.p2).hp = 22;
      }, rules);

    it("loadout/useItem with a negative heal bp heals 0 and keeps hp", () => {
      const result = reduce(hurt(negative), useItem("p1", "herb"), negative);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.public.characters.p1?.hp).toBe(22);
      expect(result.events[0]).toMatchObject({ type: "ItemUsed", healed: 0, hp: 22 });
      roundTrips(result.state, negative);
    });

    it("loadout/useItem with an oversized heal bp stops at max hp (48)", () => {
      const result = reduce(hurt(oversized), useItem("p1", "herb"), oversized);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.public.characters.p1?.hp).toBe(48);
      expect(result.events[0]).toMatchObject({ healed: 26, hp: 48 });
      roundTrips(result.state, oversized);
    });

    it("an in-combat heal item with a negative bp heals 0 and the state still round-trips", () => {
      const start = applyAll(hurt(negative), [startVs(pvp)], negative);
      const [attacker = "", defender = ""] = start.state.public.pending?.required ?? [];
      const { state, events } = applyAll(
        start.state,
        [commit(start.state, attacker, "item:herb"), commit(start.state, defender, "guard")],
        negative,
      );
      expect(events.find((e) => e.type === "ExchangeResolved")).toMatchObject({
        command: "item:herb",
        heal: [0, 0],
      });
      expect(state.public.characters[attacker]?.hp).toBe(22);
      roundTrips(state, negative);
    });
  });

  describe("victoryReward never pays a negative amount", () => {
    // One field is negative and the other positive, so each clamp is exercised on its own.
    const negativeXp = craft((r) => {
      for (const m of Object.values(r.monsters)) [m.xp, m.gold] = [-50, 30];
      for (const g of Object.values(r.guardians)) [g.xpPerTier, g.goldPerTier] = [-5, 7];
      [r.enforcer.xpPerLevel, r.enforcer.goldPerLevel] = [-2, 3];
      r.combat.pvpXpPerLevel = -4;
    });
    const negativeGold = craft((r) => {
      for (const m of Object.values(r.monsters)) [m.xp, m.gold] = [50, -30];
      for (const g of Object.values(r.guardians)) [g.xpPerTier, g.goldPerTier] = [5, -7];
      [r.enforcer.xpPerLevel, r.enforcer.goldPerLevel] = [2, -3];
    });
    const mods = { atk: 0, def: 0, mag: 0, spd: 0, poison: false, stun: false };
    const monsterSide: CombatSide = {
      kind: "npc",
      npc: { kind: "monster", id: "slime", senior: false },
      stats: { hp: 1, atk: 1, def: 1, mag: 1, spd: 1, luck: 1 },
      hp: 1,
      mods,
    };
    const guardianId = Object.keys(TEST_RULES.guardians)[0] ?? "";
    const sides: [string, CombatSide][] = [
      ["monster", monsterSide],
      ["guardian", { ...monsterSide, npc: { kind: "guardian", id: guardianId, townTier: 2 } }],
      ["enforcer", { ...monsterSide, npc: { kind: "enforcer", level: 3 } }],
    ];
    it.each(sides)("%s loser, negative xp: xp is 0 and the positive gold is kept", (_n, side) => {
      const reward = victoryReward(negativeXp, side, 0);
      expect(reward.xp).toBe(0);
      expect(reward.gold).toBeGreaterThan(0);
    });

    it("player loser, negative pvpXpPerLevel: xp is 0", () => {
      const loser: CombatSide = { kind: "player", playerId: "p2", mods };
      expect(victoryReward(negativeXp, loser, 4)).toEqual({ xp: 0, gold: 0 });
    });

    it.each(sides)("%s loser, negative gold: gold is 0 and the positive xp is kept", (_n, side) => {
      const reward = victoryReward(negativeGold, side, 0);
      expect(reward.gold).toBe(0);
      expect(reward.xp).toBeGreaterThan(0);
    });

    it("a KO win over a negative-reward monster leaves xp and gold unchanged", () => {
      const rules = craft((r) => {
        for (const m of Object.values(r.monsters)) {
          m.xp = -50;
          m.gold = -30;
          m.statBp = { hp: 1, atk: 10000, def: 1, mag: 10000, spd: 1, luck: 10000 };
        }
      });
      const start = applyAll(newGame(undefined, rules), [startVs(slime)], rules);
      const { state, events } = applyAll(start.state, [commit(start.state, "p1", "attack")], rules);
      expect(events.find((e) => e.type === "VictoryRewarded")).toMatchObject({ xp: 0, gold: 0 });
      expect(state.public.characters.p1).toMatchObject({ xp: 0, gold: 100 });
      roundTrips(state, rules);
    });
  });

  describe("sheet and NPC stats are clamped to MAX_STAT", () => {
    const huge = craft((r) => {
      r.progression.baseStats = { hp: 5_000_000, atk: 5_000_000, def: 1, mag: 1, spd: 1, luck: 1 };
      r.npcCurve = r.npcCurve.map(() => ({
        hp: 5_000_000,
        atk: 5_000_000,
        def: 1,
        mag: 1,
        spd: 1,
        luck: 1,
      }));
    });

    it("sheetStats clamps hp and atk, and createGame's state round-trips", () => {
      const game = newGame(undefined, huge);
      const p1 = need(game.public.characters.p1);
      const sheet = sheetStats(huge, p1);
      expect(sheet.hp).toBe(MAX_STAT);
      expect(sheet.atk).toBe(MAX_STAT);
      expect(p1.hp).toBe(MAX_STAT);
      roundTrips(game, huge);
    });

    it("npcStats and a started NPC combat stay within MAX_STAT and round-trip", () => {
      const stats = npcStats(huge, { kind: "monster", id: "slime", senior: false });
      expect(stats.hp).toBe(MAX_STAT);
      expect(stats.atk).toBe(MAX_STAT);
      const { state } = applyAll(newGame(undefined, huge), [startVs(slime)], huge);
      const npc = state.public.combat?.sides[1];
      expect(npc?.kind === "npc" ? npc.hp : -1).toBe(MAX_STAT);
      roundTrips(state, huge);
    });
  });
});

// ---------------------------------------------------------------------------------------- S2

describe("S2: deserialize requires decisionSeq headroom for an open combat", () => {
  const ROUNDS = TEST_RULES.combat.maxRounds;

  /** Re-numbers the open decision of a round-1 combat state to `seq` everywhere it appears. */
  function withSeq(seq: number): string {
    const state = applyAll(newGame(), [startVs(pvp)]).state;
    const json = JSON.parse(serialize(state)) as {
      public: { pending: { id: string } };
      private: Record<string, { prompt: { decisionId: string } | null }>;
      hidden: { decisionSeq: number; decision: { id: string } };
    };
    const id = `d${String(seq)}`;
    json.hidden.decisionSeq = seq;
    json.hidden.decision.id = id;
    json.public.pending.id = id;
    for (const priv of Object.values(json.private)) {
      if (priv.prompt !== null) priv.prompt.decisionId = id;
    }
    return JSON.stringify(json);
  }

  // Round 1, exchange 1 is slot 1: 2 x maxRounds - 1 more decisions can follow this one.
  const LAST_OK = MAX_COUNTER - (2 * ROUNDS - 1);

  it("accepts decisionSeq exactly at the headroom limit", () => {
    const state = deserialize(withSeq(LAST_OK), TEST_RULES);
    expect(state.hidden.decisionSeq).toBe(LAST_OK);
  });

  it("rejects decisionSeq one above the limit (no headroom)", () => {
    expect(() => deserialize(withSeq(LAST_OK + 1), TEST_RULES)).toThrow(
      "deserialize: hidden.decisionSeq leaves no headroom for the combat",
    );
  });

  it("a combat started at the validateStart limit plays to its end, every state reloadable", () => {
    const base = JSON.parse(serialize(newGame())) as { hidden: { decisionSeq: number } };
    base.hidden.decisionSeq = MAX_COUNTER - 2 * ROUNDS; // the largest value combat/start accepts
    let current = applyAll(deserialize(JSON.stringify(base), TEST_RULES), [startVs(pvp)]).state;
    let decisions = 0;
    while (current.public.combat !== null) {
      decisions += 1;
      roundTrips(current, TEST_RULES);
      const open = current;
      const required = open.public.pending?.required ?? [];
      current = applyAll(
        open,
        required.map((id, i) => commit(open, id, i === 0 ? "attack" : "guard")),
      ).state;
    }
    expect(decisions).toBeGreaterThan(1);
    expect(current.hidden.decisionSeq).toBeLessThanOrEqual(MAX_COUNTER);
    roundTrips(current, TEST_RULES);
  });
});

// ---------------------------------------------------------------------------------------- S3

describe("S3: reduceAs authenticates the actor", () => {
  const pollOpen = {
    v: 2,
    type: "decision/open",
    playerId: "system",
    prompts: [
      { playerId: "p1", options: ["a", "b"], default: "a" },
      { playerId: "p2", options: ["a", "b"], default: "a" },
    ],
  };
  const turnState = newGame();
  const decisionState = applyAll(turnState, [pollOpen]).state;
  const setCharacter = {
    v: 2,
    type: "system/setCharacter",
    playerId: "system",
    target: "p1",
    classId: "fighter",
    level: 5,
    weapon: null,
    shield: null,
    accessory: null,
    battleSpell: null,
    wardSpell: null,
    bag: [],
  };
  const timeout = { v: 2, type: "timeout", playerId: "system", decisionId: "d1" };
  const wrongActor = (message = "action playerId does not match the authenticated actor") => ({
    ok: false,
    error: { code: "WRONG_ACTOR", message },
  });

  it.each([
    ["system/grant", turnState, grantGold(5)],
    ["system/setCharacter", turnState, setCharacter],
    ["timeout", decisionState, timeout],
    ["decision/open", turnState, pollOpen],
    ["combat/start", turnState, startVs(pvp)],
  ] as const)("a client claiming playerId system cannot send %s", (_type, state, action) => {
    expect(reduceAs(state, action, TEST_RULES, "p1")).toEqual(wrongActor());
    // the same action is valid from the host (non-vacuous: only the identity check rejects it)
    expect(reduceAs(state, action, TEST_RULES, "system").ok).toBe(true);
  });

  it("a spoofed decision/commit as another player is rejected", () => {
    const spoof = commit(decisionState, "p2", "b");
    expect(reduceAs(decisionState, spoof, TEST_RULES, "p1")).toEqual(wrongActor());
    expect(reduceAs(decisionState, spoof, TEST_RULES, "p2").ok).toBe(true);
  });

  it("the system actor cannot be used to commit as a player either", () => {
    const asP2 = commit(decisionState, "p2", "b");
    expect(reduceAs(decisionState, asP2, TEST_RULES, "system")).toEqual(wrongActor());
  });

  it("a matching actor gets exactly what reduce returns", () => {
    const own = commit(decisionState, "p1", "b");
    expect(reduceAs(decisionState, own, TEST_RULES, "p1")).toEqual(
      reduce(decisionState, own, TEST_RULES),
    );
    expect(reduceAs(turnState, grantGold(5), TEST_RULES, "system")).toEqual(
      reduce(turnState, grantGold(5), TEST_RULES),
    );
  });

  it("a matching actor still gets reduce's own rejects (reduceAs adds no permission)", () => {
    // p1 authenticates as p1 and sends a system-only action type under their own id
    const sneaky = { ...grantGold(5), playerId: "p1" };
    expect(reduceAs(turnState, sneaky, TEST_RULES, "p1")).toEqual(
      reduce(turnState, sneaky, TEST_RULES),
    );
    expect(reduceAs(turnState, sneaky, TEST_RULES, "p1")).toMatchObject({
      ok: false,
      error: { code: "WRONG_ACTOR", message: "p1 may not perform system/grant" },
    });
  });

  it("malformed input gets reduce's shape codes whatever the actor", () => {
    expect(reduceAs(turnState, { ...grantGold(5), v: 3 }, TEST_RULES, "p1")).toMatchObject({
      error: { code: "UNSUPPORTED_VERSION" },
    });
    expect(reduceAs(turnState, { ...grantGold(5), type: "nope" }, TEST_RULES, "p1")).toMatchObject({
      error: { code: "UNKNOWN_ACTION" },
    });
    expect(reduceAs(turnState, { ...grantGold(5), extra: 1 }, TEST_RULES, "p1")).toMatchObject({
      error: { code: "INVALID_PAYLOAD" },
    });
  });

  it("reads a getter-backed playerId once (the checked id is the one reduce uses)", () => {
    let reads = 0;
    const action = {
      v: 2,
      type: "decision/commit",
      get playerId() {
        reads += 1;
        return reads === 1 ? "p1" : "p2";
      },
      decisionId: "d1",
      choice: "b",
    };
    const result = reduceAs(decisionState, action, TEST_RULES, "p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.public.pending?.committed).toEqual(["p1"]);
  });
});

// ---------------------------------------------------------------------------------------- S5

describe("S5: createGame reads settings once", () => {
  const players = [
    { id: "p1", classId: "fighter" },
    { id: "p2", classId: "caster" },
  ];
  const expected = createGame({ ...FIXTURE_SETTINGS, seed: "first" }, TEST_RULES);

  function shifting(): unknown {
    let reads = 0;
    return {
      v: 2,
      get seed() {
        reads += 1;
        return reads === 1 ? "first" : "second";
      },
      players,
    };
  }

  it("a getter that answers differently on a second read does not split validation and use", () => {
    expect(createGame(shifting() as GameSettings, TEST_RULES)).toEqual(expected);
  });

  it("a Proxy that answers differently on a second read behaves the same", () => {
    const counts = new Map<string | symbol, number>();
    const settings: GameSettings = { v: 2, seed: "first", players };
    const proxy = new Proxy(settings, {
      get(target, key) {
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        return key === "seed" && n > 1
          ? "second"
          : (target as unknown as Record<string, unknown>)[key as string];
      },
    });
    expect(createGame(proxy, TEST_RULES)).toEqual(expected);
  });

  it("settings that are not canonical JSON are a SettingsError, not a TypeError", () => {
    const bad = { ...FIXTURE_SETTINGS, extra: () => 1 } as unknown as GameSettings;
    expect(() => createGame(bad, TEST_RULES)).toThrow(SettingsError);
    expect(() => createGame(bad, TEST_RULES)).toThrow("settings are not canonical JSON");
  });

  it("non-canonical settings that are also invalid report the specific SettingsError", () => {
    const bad = { ...FIXTURE_SETTINGS, players: [], extra: () => 1 } as unknown as GameSettings;
    expect(() => createGame(bad, TEST_RULES)).toThrow(SettingsError);
    expect(() => createGame(bad, TEST_RULES)).not.toThrow("settings are not canonical JSON");
  });

  it("a getter that throws is a SettingsError", () => {
    const bad = {
      v: 2,
      get seed(): string {
        throw new Error("boom");
      },
      players,
    } as unknown as GameSettings;
    expect(() => createGame(bad, TEST_RULES)).toThrow(SettingsError);
  });
});
