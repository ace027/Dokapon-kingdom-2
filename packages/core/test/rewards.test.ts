// The reward hook in endCombat (spec: Combat flow state machine, endCombat; Progression): a KO won
// by a player appends VictoryRewarded / LevelUp / MasteryRankUp / HybridUnlocked after CombatEnded;
// draws, flees and NPC wins award nothing. Fixtures are edited saves and crafted rules whose NPCs are
// fragile (hp 1, def 0, spd 0), so one Attack from the player ends the combat.
import { describe, expect, it } from "vitest";
import type { GameEvent } from "../src/events";
import { sheetStats } from "../src/combat/stats";
import { reduce } from "../src/reducer";
import type { Rules } from "../src/rules";
import { deserialize, serialize } from "../src/serialize";
import type { GameState } from "../src/types";
import {
  applyAll,
  craft,
  deepFreeze,
  make as makeSave,
  need,
  newGame,
  type SaveJson,
} from "./fixtures/build";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const S = (hp: number, atk: number, def: number, mag: number, spd: number, luck: number) => ({
  hp,
  atk,
  def,
  mag,
  spd,
  luck,
});

/** Every NPC has 1 hp, 0 def and 0 spd; the shipped gold-per-tier values are made non-zero. */
const FRAGILE = craft((r) => {
  const weak = S(1, 10000, 1, 10000, 1, 10000);
  for (const m of Object.values(r.monsters)) m.statBp = weak;
  for (const g of Object.values(r.guardians)) {
    g.statBp = weak;
    g.goldPerTier = 7;
  }
  r.enforcer.statBp = weak;
  r.enforcer.goldPerLevel = 5;
  r.npcCurve = r.npcCurve.map(() => S(40, 20, 10, 10, 9, 4));
});

function make(edit: (json: SaveJson) => void, rules: Rules = FRAGILE): GameState {
  return makeSave(edit, rules);
}

const wins = (fighter: number, caster: number) => ({ battlemage: 0, caster, fighter });
const startVs = (opponent: unknown, attacker = "p1") => ({
  v: 2,
  type: "combat/start",
  playerId: "system",
  attacker,
  opponent,
});
const monster = (id: string, senior = false) => ({
  kind: "npc",
  npc: { kind: "monster", id, senior },
});
function pendingId(state: GameState): string {
  if (state.public.pending === null) throw new Error("no open decision");
  return state.public.pending.id;
}
const commit = (state: GameState, playerId: string, choice: string) => ({
  v: 2,
  type: "decision/commit",
  playerId,
  decisionId: pendingId(state),
  choice,
});

/** Starts p1 vs `opponent`, then commits p1's `choice` (the NPC or the given `also` commits follow). */
function fight(
  state: GameState,
  opponent: unknown,
  choice = "attack",
  rules: Rules = FRAGILE,
): { state: GameState; events: GameEvent[] } {
  const started = applyAll(state, [startVs(opponent)], rules);
  const committed = applyAll(started.state, [commit(started.state, "p1", choice)], rules);
  return { state: committed.state, events: [...started.events, ...committed.events] };
}

const types = (events: readonly GameEvent[]) => events.map((e) => e.type);

/** The events after `CombatEnded` (empty when there is none). */
function afterEnd(events: readonly GameEvent[]): GameEvent[] {
  const i = types(events).lastIndexOf("CombatEnded");
  return i < 0 ? [] : events.slice(i + 1);
}

describe("rewards: a player KO win", () => {
  it("PvP pays pvpXpPerLevel x the loser's level and no gold", () => {
    // p1 (level 4 + band: spd 16) goes first against a 1-hp level-4 caster (spd 13)
    const state = make((j) => {
      const p1 = need(j.public.characters.p1);
      p1.accessory = "band";
      p1.level = 4;
      p1.xp = 300;
      const p2 = need(j.public.characters.p2);
      p2.level = 4;
      p2.xp = 300;
      p2.hp = 1;
    });
    const start = applyAll(state, [startVs({ kind: "player", playerId: "p2" })], FRAGILE);
    const round = applyAll(
      start.state,
      [commit(start.state, "p1", "strike"), commit(start.state, "p2", "guard")],
      FRAGILE,
    );
    const events = [...start.events, ...round.events];
    const ended = types(events).indexOf("CombatEnded");
    expect(events[ended]).toMatchObject({ outcome: "ko", winner: 0 });
    expect(events.slice(ended + 1)).toEqual([
      {
        v: 2,
        type: "VictoryRewarded",
        visibility: { kind: "public" },
        playerId: "p1",
        xp: 40,
        gold: 0,
        classId: "fighter",
        masteryWins: 1,
      },
    ]);
    expect(round.state.public.characters.p1).toMatchObject({ xp: 340, gold: 100 });
    expect(round.state.public.characters.p1?.mastery.fighter).toBe(1);
    expect(round.state.public.combat).toBeNull();
    expect(deserialize(serialize(round.state), FRAGILE)).toEqual(round.state);
  });

  it("a monster pays its xp and gold", () => {
    const { state, events } = fight(newGame(undefined, FRAGILE), monster("slime"));
    expect(afterEnd(events)).toMatchObject([
      { type: "VictoryRewarded", playerId: "p1", xp: 20, gold: 30, masteryWins: 1 },
    ]);
    expect(state.public.characters.p1).toMatchObject({ xp: 20, gold: 130 });
  });

  it("a senior monster pays x1.5, floored", () => {
    const { events } = fight(newGame(undefined, FRAGILE), monster("gull", true));
    expect(afterEnd(events)).toMatchObject([{ type: "VictoryRewarded", xp: 37, gold: 60 }]);
  });

  it("a guardian pays per town tier (lich, tier 2: 100 xp, 14 gold)", () => {
    const { events } = fight(newGame(undefined, FRAGILE), {
      kind: "npc",
      npc: { kind: "guardian", id: "lich", townTier: 2 },
    });
    expect(afterEnd(events)).toMatchObject([
      { type: "VictoryRewarded", xp: 100, gold: 14 },
      { type: "LevelUp", level: 2 },
    ]);
  });

  it("the enforcer pays per level (level 3: 30 xp, 15 gold)", () => {
    const { events } = fight(newGame(undefined, FRAGILE), {
      kind: "npc",
      npc: { kind: "enforcer", level: 3 },
    });
    expect(afterEnd(events)).toMatchObject([{ type: "VictoryRewarded", xp: 30, gold: 15 }]);
  });

  it("emits LevelUp per level, ascending, and carries hp over the level up", () => {
    const state = make((j) => {
      const c = need(j.public.characters.p1);
      c.xp = 45;
      c.hp = 30;
    });
    const { state: after, events } = fight(state, monster("gull", true));
    // 45 + 37 = 82 xp: level 2
    expect(afterEnd(events).map((e) => e.type)).toEqual(["VictoryRewarded", "LevelUp"]);
    const c = need(after.public.characters.p1);
    expect(c.level).toBe(2);
    const oldMax = 48;
    const newMax = sheetStats(FRAGILE, c).hp;
    expect(c.hp).toBe(30 + (newMax - oldMax));
  });

  it("emits MasteryRankUp exactly at 3 wins, after VictoryRewarded", () => {
    const state = make((j) => {
      need(j.public.characters.p1).mastery = wins(2, 0);
    });
    const { events } = fight(state, monster("slime"));
    expect(afterEnd(events)).toMatchObject([
      { type: "VictoryRewarded", masteryWins: 3 },
      { type: "MasteryRankUp", playerId: "p1", classId: "fighter", rank: 2 },
    ]);
  });

  it("does not rank up at 1 or 4 wins", () => {
    for (const w of [0, 3]) {
      const state = make((j) => {
        need(j.public.characters.p1).mastery = wins(w, 0);
      });
      const { events } = fight(state, monster("slime"));
      expect(types(afterEnd(events))).toEqual(["VictoryRewarded"]);
    }
  });

  it("emits HybridUnlocked (battlemage) once, when fighter and caster both reach rank 3", () => {
    const state = make((j) => {
      need(j.public.characters.p1).mastery = wins(6, 7);
    });
    const first = fight(state, monster("slime"));
    expect(afterEnd(first.events)).toMatchObject([
      { type: "VictoryRewarded", masteryWins: 7 },
      { type: "MasteryRankUp", classId: "fighter", rank: 3 },
      { type: "HybridUnlocked", playerId: "p1", classId: "battlemage" },
    ]);
    // the next win (8) does not unlock it again
    const second = fight(first.state, monster("slime"));
    expect(types(afterEnd(second.events))).toEqual(["VictoryRewarded"]);
  });

  it("does not unlock the hybrid while one parent is a win short", () => {
    const state = make((j) => {
      need(j.public.characters.p1).mastery = wins(6, 6);
    });
    const { events } = fight(state, monster("slime"));
    expect(types(afterEnd(events))).toEqual(["VictoryRewarded", "MasteryRankUp"]);
  });

  it("does not mutate the input state", () => {
    const state = deepFreeze(newGame(undefined, FRAGILE));
    const started = applyAll(state, [startVs(monster("slime"))], FRAGILE);
    deepFreeze(started.state);
    expect(reduce(started.state, commit(started.state, "p1", "attack"), FRAGILE).ok).toBe(true);
  });
});

describe("rewards: nothing to award", () => {
  it("an NPC win awards nothing (the NPC goes first and KOs a 1-hp player)", () => {
    const rules = craft((r) => {
      r.npcCurve = r.npcCurve.map(() => S(40, 60, 10, 10, 99, 4));
      for (const m of Object.values(r.monsters)) {
        m.attackTable = { attack: 100, strike: 0, spell: 0, flee: 0 };
      }
    });
    const state = make((j) => {
      need(j.public.characters.p1).hp = 1;
    }, rules);
    const started = applyAll(state, [startVs(monster("slime"))], rules);
    const result = applyAll(started.state, [commit(started.state, "p1", "guard")], rules);
    const events = [...started.events, ...result.events];
    const ended = events.find((e) => e.type === "CombatEnded");
    expect(ended).toMatchObject({ outcome: "ko", winner: 1 });
    expect(afterEnd(events)).toEqual([]);
    expect(result.state.public.characters.p1).toMatchObject({ hp: 0, xp: 0, gold: 100 });
    expect(result.state.public.characters.p1?.mastery).toEqual(wins(0, 0));
  });

  it("a draw awards nothing (maxRounds 1 and a sturdy opponent)", () => {
    const rules = craft((r) => {
      r.combat.maxRounds = 1;
    });
    const state = newGame(undefined, rules);
    const started = applyAll(state, [startVs(monster("slime"))], rules);
    const first = applyAll(started.state, [commit(started.state, "p1", "attack")], rules);
    const second = applyAll(first.state, [commit(first.state, "p1", "guard")], rules);
    const events = [...started.events, ...first.events, ...second.events];
    expect(events.find((e) => e.type === "CombatEnded")).toMatchObject({
      outcome: "draw",
      winner: null,
    });
    expect(afterEnd(events)).toEqual([]);
    expect(second.state.public.characters.p1).toMatchObject({ xp: 0, gold: 100 });
    expect(second.state.public.characters.p1?.mastery).toEqual(wins(0, 0));
  });

  it("a flee awards nothing", () => {
    const rules = craft((r) => {
      r.combat.fleeBaseBp = 10000;
      r.combat.fleeMaxBp = 10000;
    });
    const { state, events } = fight(newGame(undefined, rules), monster("slime"), "flee", rules);
    expect(events.find((e) => e.type === "CombatEnded")).toMatchObject({
      outcome: "fled",
      winner: null,
      fled: 0,
    });
    expect(afterEnd(events)).toEqual([]);
    expect(state.public.characters.p1).toMatchObject({ xp: 0, gold: 100 });
    expect(state.public.characters.p1?.mastery).toEqual(wins(0, 0));
  });
});
