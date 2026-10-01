import { describe, expect, it } from "vitest";
import { reduce } from "../src/reducer";
import { deserialize, serialize } from "../src/serialize";
import { MAX_COUNTER, type GameState } from "../src/types";
import { applyAll, craft, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const OPEN = {
  v: 2,
  type: "decision/open",
  playerId: "system",
  prompts: [{ playerId: "p1", options: ["yes", "no"], default: "no" }],
};

function fails(state: GameState, action: unknown, message: string): void {
  expect(reduce(state, action, TEST_RULES)).toEqual({
    ok: false,
    error: { code: "INVALID_PAYLOAD", message },
  });
}

/** A valid save whose `hidden.decisionSeq` is `decisionSeq`, built by editing a serialized game. */
function withDecisionSeq(decisionSeq: number): GameState {
  const json = JSON.parse(serialize(newGame())) as { hidden: { decisionSeq: number } };
  json.hidden.decisionSeq = decisionSeq;
  return deserialize(JSON.stringify(json), TEST_RULES);
}

describe("decisionSeq bounds", () => {
  it("rejects decision/open at MAX_COUNTER", () => {
    const state = withDecisionSeq(MAX_COUNTER);
    expect(reduce(state, OPEN, TEST_RULES)).toEqual({
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: "decisionSeq would exceed MAX_COUNTER" },
    });
  });

  it("opens d2147483647 at MAX_COUNTER - 1", () => {
    const result = reduce(withDecisionSeq(MAX_COUNTER - 1), OPEN, TEST_RULES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.public.pending?.id).toBe("d2147483647");
    expect(result.state.hidden.decisionSeq).toBe(MAX_COUNTER);
    expect(deserialize(serialize(result.state), TEST_RULES)).toEqual(result.state);
  });
});

const START = {
  v: 2,
  type: "combat/start",
  playerId: "system",
  attacker: "p1",
  opponent: { kind: "player", playerId: "p2" },
};
const commit = (playerId: string, choice: string) => ({
  v: 2,
  type: "decision/commit",
  playerId,
  decisionId: "d1",
  choice,
});

/** A valid save of `state` with `path` (dotted) set to `value`. */
function withValue(state: GameState, path: string, value: unknown): GameState {
  const json: unknown = JSON.parse(serialize(state));
  const keys = path.split(".");
  const last = keys.pop() ?? "";
  let node = json as Record<string, unknown>;
  for (const key of keys) node = node[key] as Record<string, unknown>;
  node[last] = value;
  return deserialize(JSON.stringify(json), TEST_RULES);
}

/** p1 (band: spd 13) outpaces p2, so p1 attacks first and no initiative draw happens. */
function fastAttacker(over: Record<string, unknown> = {}): GameState {
  return applyAll(newGame(), [
    {
      v: 2,
      type: "system/setCharacter",
      playerId: "system",
      target: "p1",
      classId: "fighter",
      level: 1,
      weapon: "stick",
      shield: "lid",
      accessory: "band",
      battleSpell: "zap",
      wardSpell: null,
      bag: [],
      ...over,
    },
  ]).state;
}

describe("combatSeq bounds", () => {
  it("rejects combat/start at MAX_COUNTER", () => {
    fails(
      withValue(newGame(), "hidden.combatSeq", MAX_COUNTER),
      START,
      "combatSeq would exceed MAX_COUNTER",
    );
  });

  it("starts c2147483647 at MAX_COUNTER - 1", () => {
    const result = reduce(
      withValue(newGame(), "hidden.combatSeq", MAX_COUNTER - 1),
      START,
      TEST_RULES,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.public.combat?.id).toBe(`c${MAX_COUNTER}`);
    expect(result.state.hidden.combatSeq).toBe(MAX_COUNTER);
    expect(deserialize(serialize(result.state), TEST_RULES)).toEqual(result.state);
  });
});

describe("decisionSeq bound for combat/start", () => {
  const bound = MAX_COUNTER - 2 * TEST_RULES.combat.maxRounds;

  it("passes at MAX_COUNTER - 2 x maxRounds", () => {
    const result = reduce(withValue(newGame(), "hidden.decisionSeq", bound), START, TEST_RULES);
    expect(result.ok).toBe(true);
  });

  it("rejects one above the bound", () => {
    fails(
      withValue(newGame(), "hidden.decisionSeq", bound + 1),
      START,
      "decisionSeq would exceed MAX_COUNTER",
    );
  });
});

describe("saturating combat counters", () => {
  it("keeps choiceHistory at MAX_COUNTER after a revealed strike and guard", () => {
    const base = fastAttacker();
    const opened = applyAll(base, [START]).state;
    const saturated = withValue(
      withValue(opened, "public.choiceHistory.p1.strike", MAX_COUNTER),
      "public.choiceHistory.p2.guard",
      MAX_COUNTER,
    );
    const { state } = applyAll(saturated, [commit("p1", "strike"), commit("p2", "guard")]);
    expect(state.public.choiceHistory.p1?.strike).toBe(MAX_COUNTER);
    expect(state.public.choiceHistory.p2?.guard).toBe(MAX_COUNTER);
    expect(state.public.choiceHistory.p1?.attack).toBe(0);
  });

  it("saturates stolen gold at MAX_COUNTER (pilfer moves 10 of 100)", () => {
    const base = withValue(
      fastAttacker({ battleSpell: "pilfer" }),
      "public.characters.p1.gold",
      MAX_COUNTER - 5,
    );
    const opened = applyAll(base, [START]).state;
    const { state, events } = applyAll(opened, [commit("p1", "spell"), commit("p2", "guard")]);
    const resolved = events.find((e) => e.type === "ExchangeResolved");
    expect(resolved).toMatchObject({ command: "spell", effects: ["steal-gold:10"] });
    expect(state.public.characters.p1?.gold).toBe(MAX_COUNTER);
    expect(state.public.characters.p2?.gold).toBe(90);
    expect(deserialize(serialize(state), TEST_RULES)).toEqual(state);
  });
});

describe("system/grant bounds", () => {
  const grant = (g: unknown) => ({
    v: 2,
    type: "system/grant",
    playerId: "system",
    target: "p1",
    grant: g,
  });

  it("rejects a gold grant that would pass MAX_COUNTER and accepts one landing exactly on it", () => {
    const base = withValue(newGame(), "public.characters.p1.gold", MAX_COUNTER - 5);
    fails(base, grant({ kind: "gold", amount: 10 }), "gold would exceed MAX_COUNTER");
    const exact = reduce(base, grant({ kind: "gold", amount: 5 }), TEST_RULES);
    expect(exact.ok).toBe(true);
    if (!exact.ok) return;
    expect(exact.state.public.characters.p1?.gold).toBe(MAX_COUNTER);
    expect(deserialize(serialize(exact.state), TEST_RULES)).toEqual(exact.state);
  });

  it("rejects an xp grant that would pass MAX_COUNTER and accepts one landing exactly on it", () => {
    const json = JSON.parse(serialize(newGame())) as {
      public: { characters: { p1: Record<string, unknown> } };
    };
    json.public.characters.p1.level = 10;
    json.public.characters.p1.xp = MAX_COUNTER - 5;
    const base = deserialize(JSON.stringify(json), TEST_RULES);
    fails(base, grant({ kind: "xp", amount: 10 }), "xp would exceed MAX_COUNTER");
    const exact = reduce(base, grant({ kind: "xp", amount: 5 }), TEST_RULES);
    expect(exact.ok).toBe(true);
    if (!exact.ok) return;
    expect(exact.state.public.characters.p1?.xp).toBe(MAX_COUNTER);
    expect(exact.events.map((e) => e.type)).toEqual(["Granted"]);
    expect(deserialize(serialize(exact.state), TEST_RULES)).toEqual(exact.state);
  });
});

describe("saturating reward counters", () => {
  // every monster has 1 hp, 0 def and 0 spd, so one Attack from p1 ends the combat
  const fragile = craft((r) => {
    for (const m of Object.values(r.monsters)) {
      m.statBp = { hp: 1, atk: 10000, def: 1, mag: 10000, spd: 1, luck: 10000 };
    }
  });

  /** p1 at the ceiling of xp (level 10), gold and fighter mastery, hp 1 (still below max). */
  function atCeiling(): GameState {
    const json: unknown = JSON.parse(serialize(newGame(undefined, fragile)));
    const c = (json as { public: { characters: { p1: Record<string, unknown> } } }).public
      .characters.p1;
    c.level = 10;
    c.xp = MAX_COUNTER;
    c.gold = MAX_COUNTER;
    c.mastery = { battlemage: 0, caster: 0, fighter: MAX_COUNTER };
    c.hp = 1;
    return deserialize(JSON.stringify(json), fragile);
  }

  it("keeps xp, gold and mastery wins at MAX_COUNTER after a monster KO win", () => {
    const { state, events } = applyAll(
      atCeiling(),
      [
        {
          v: 2,
          type: "combat/start",
          playerId: "system",
          attacker: "p1",
          opponent: { kind: "npc", npc: { kind: "monster", id: "slime", senior: false } },
        },
        commit("p1", "attack"),
      ],
      fragile,
    );
    expect(events.slice(-2).map((e) => e.type)).toEqual(["CombatEnded", "VictoryRewarded"]);
    expect(events.find((e) => e.type === "VictoryRewarded")).toMatchObject({
      xp: 20,
      gold: 30,
      masteryWins: MAX_COUNTER,
    });
    expect(state.public.characters.p1).toMatchObject({
      xp: MAX_COUNTER,
      gold: MAX_COUNTER,
      level: 10,
    });
    expect(state.public.characters.p1?.mastery.fighter).toBe(MAX_COUNTER);
    expect(deserialize(serialize(state), fragile)).toEqual(state);
  });
});
