// The rewards/loadout golden (spec: Rewards/loadout golden, TEST_RULES): 25 actions, 0 rejections,
// 84 events, final hashState 57da3ea4. Every expected value below is transcribed from the spec and
// the reference trace (traces/rewards-golden.trace.json), never recorded from this engine.
// Mismatch localisation: fold per action and diff the per-step hashes against the trace, then events.
import { describe, expect, it } from "vitest";
import { createGame } from "../src/game";
import type { GameEvent } from "../src/events";
import { reduce } from "../src/reducer";
import { replay } from "../src/replay";
import { hashState } from "../src/serialize";
import type { GameSettings } from "../src/types";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const SETTINGS: GameSettings = {
  v: 2,
  seed: "rewards-golden",
  players: [
    { id: "p1", classId: "fighter" },
    { id: "p2", classId: "caster" },
  ],
};

const ACTIONS: unknown[] = [
  {
    v: 2,
    type: "system/grant",
    playerId: "system",
    target: "p1",
    grant: { kind: "item", id: "tonic" },
  },
  {
    v: 2,
    type: "combat/start",
    playerId: "system",
    attacker: "p1",
    opponent: { kind: "npc", npc: { kind: "monster", id: "slime", senior: false } },
  },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "strike" },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d2", choice: "guard" },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d3", choice: "strike" },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d4", choice: "guard" },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d5", choice: "attack" },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d6", choice: "counter" },
  { v: 2, type: "loadout/useItem", playerId: "p1", itemId: "herb" },
  {
    v: 2,
    type: "combat/start",
    playerId: "system",
    attacker: "p2",
    opponent: { kind: "player", playerId: "p1" },
  },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d7", choice: "strike" },
  { v: 2, type: "decision/commit", playerId: "p2", decisionId: "d7", choice: "counter" },
  { v: 2, type: "decision/commit", playerId: "p2", decisionId: "d8", choice: "spell" },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d8", choice: "guard" },
  { v: 2, type: "decision/commit", playerId: "p2", decisionId: "d9", choice: "spell" },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d9", choice: "counter" },
  {
    v: 2,
    type: "system/grant",
    playerId: "system",
    target: "p2",
    grant: { kind: "xp", amount: 150 },
  },
  {
    v: 2,
    type: "system/grant",
    playerId: "system",
    target: "p2",
    grant: { kind: "gold", amount: 200 },
  },
  {
    v: 2,
    type: "system/grant",
    playerId: "system",
    target: "p2",
    grant: { kind: "item", id: "antidote" },
  },
  {
    v: 2,
    type: "system/grant",
    playerId: "system",
    target: "p2",
    grant: { kind: "item", id: "wig" },
  },
  {
    v: 2,
    type: "system/grant",
    playerId: "system",
    target: "p2",
    grant: { kind: "scroll", id: "haste" },
  },
  {
    v: 2,
    type: "system/grant",
    playerId: "system",
    target: "p2",
    grant: { kind: "gear", id: "sword" },
  },
  {
    v: 2,
    type: "system/grant",
    playerId: "system",
    target: "p2",
    grant: { kind: "wardSpell", id: "sponge" },
  },
  { v: 2, type: "loadout/switchClass", playerId: "p2", classId: "fighter", discard: ["wig"] },
  { v: 2, type: "loadout/discard", playerId: "p1", itemId: "tonic" },
];

/** `hashState` after `createGame` and after each of the 25 actions (traces/rewards-golden.trace.json). */
const INITIAL_HASH = "8823afb2";
const STEP_HASHES = [
  "9a66a533",
  "99765b85",
  "4213a589",
  "4b560ddc",
  "eed9f30c",
  "340eb904",
  "d740d01a",
  "87e3e168",
  "1ca1a574",
  "6da4dc93",
  "446655ff",
  "a6e40a60",
  "fd949d00",
  "6fc6fee8",
  "b75a607c",
  "ca8bd060",
  "3f41b5a2",
  "1a5e5444",
  "05ab1808",
  "03bd9e3d",
  "dcf5c4ca",
  "1de7e2a5",
  "8f4a7e75",
  "2ff3acb9",
  "57da3ea4",
];

/** The spec's event type sequence; `Type×n` expands to n copies. */
const TYPE_SEQUENCE =
  "Granted, BagUpdated, CombatStarted, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, CombatEnded, VictoryRewarded, ItemUsed, BagUpdated, CombatStarted, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, CombatEnded, VictoryRewarded, Granted, LevelUp×2, Granted×2, BagUpdated, Granted, BagUpdated, Granted, ScrollsUpdated, Granted×2, ClassSwitched, BagUpdated×2";

function expandTypes(text: string): string[] {
  return text.split(", ").flatMap((part) => {
    const [type = "", count] = part.split("×");
    return Array.from({ length: count === undefined ? 1 : Number(count) }, () => type);
  });
}

interface Row {
  combatId: string;
  round: number;
  exchange: number;
  attacker: number;
  command: string;
  defense: string | null;
  damage: [number, number];
  heal: [number, number];
  effects: string[];
  hp: [number, number];
}

const row = (
  combatId: string,
  round: number,
  exchange: number,
  attacker: number,
  command: string,
  defense: string | null,
  damage: [number, number],
  effects: string[],
  hp: [number, number],
): Row => ({
  combatId,
  round,
  exchange,
  attacker,
  command,
  defense,
  damage,
  heal: [0, 0],
  effects,
  hp,
});

/** The 9 `ExchangeResolved` rows of the spec table. */
const EXCHANGES: Row[] = [
  row("c1", 1, 1, 0, "strike", "guard", [0, 29], [], [48, 11]),
  row("c1", 1, 2, 1, "attack", "guard", [4, 0], [], [44, 11]),
  row("c1", 2, 1, 0, "strike", "counter", [18, 0], ["reflected"], [26, 11]),
  row("c1", 2, 2, 1, "attack", "guard", [4, 0], [], [22, 11]),
  row("c1", 3, 1, 0, "attack", "guard", [0, 9], [], [22, 2]),
  row("c1", 3, 2, 1, "strike", "counter", [0, 2], ["reflected"], [22, 0]),
  row("c2", 1, 1, 1, "strike", "counter", [0, 17], ["reflected"], [36, 19]),
  row("c2", 1, 2, 0, "spell", "guard", [0, 11], [], [36, 8]),
  row("c2", 2, 1, 0, "spell", "counter", [0, 8], [], [36, 0]),
];

type Of<T extends GameEvent["type"]> = Extract<GameEvent, { type: T }>;

describe("rewards/loadout golden (TEST_RULES)", () => {
  const result = replay(SETTINGS, ACTIONS, TEST_RULES);
  const of = <T extends GameEvent["type"]>(type: T): Of<T>[] =>
    result.events.filter((e): e is Of<T> => e.type === type);

  it("replays with 0 rejections, 84 events and hashState 57da3ea4", () => {
    expect(result.rejections).toEqual([]);
    expect(result.events).toHaveLength(84);
    expect(hashState(result.state)).toBe("57da3ea4");
  });

  it("matches the trace hash after createGame and after every action", () => {
    let state = createGame(SETTINGS, TEST_RULES);
    expect(hashState(state)).toBe(INITIAL_HASH);
    for (const [i, action] of ACTIONS.entries()) {
      const step = reduce(state, action, TEST_RULES);
      if (!step.ok) throw new Error(`action ${i} rejected: ${step.error.message}`);
      state = step.state;
      expect(hashState(state), `hash after action ${i}`).toBe(STEP_HASHES[i]);
    }
  });

  it("emits the spec's 84-event type sequence", () => {
    expect(result.events.map((e) => e.type)).toEqual(expandTypes(TYPE_SEQUENCE));
  });

  it("emits the spec's exchange table", () => {
    const resolved = of("ExchangeResolved");
    expect(
      resolved.map((e) => ({
        combatId: e.combatId,
        round: e.round,
        exchange: e.exchange,
        attacker: e.attacker,
        command: e.command,
        defense: e.defense,
        damage: e.damage,
        heal: e.heal,
        effects: e.effects,
        hp: e.hp,
      })),
    ).toEqual(EXCHANGES);
    expect(resolved.every((e) => !e.crit)).toBe(true);
  });

  it("ends both combats as KOs won by side 0", () => {
    expect(of("CombatEnded")).toMatchObject([
      { combatId: "c1", outcome: "ko", winner: 0, fled: null, hp: [22, 0] },
      { combatId: "c2", outcome: "ko", winner: 0, fled: null, hp: [36, 0] },
    ]);
  });

  it("emits the spec's reward, item, level, scroll, switch and bag checkpoints", () => {
    expect(of("VictoryRewarded")).toMatchObject([
      { playerId: "p1", xp: 20, gold: 30, classId: "fighter", masteryWins: 1 },
      { playerId: "p2", xp: 10, gold: 0, classId: "caster", masteryWins: 1 },
    ]);
    expect(of("ItemUsed")).toMatchObject([{ playerId: "p1", itemId: "herb", healed: 14, hp: 36 }]);
    expect(of("LevelUp").map((e) => [e.playerId, e.level])).toEqual([
      ["p2", 2],
      ["p2", 3],
    ]);
    expect(of("ScrollsUpdated")).toMatchObject([{ playerId: "p2", scrolls: ["haste"] }]);
    expect(of("ClassSwitched")).toMatchObject([
      { playerId: "p2", from: "caster", to: "fighter", fee: 50, hp: 67 },
    ]);
    const bags = of("BagUpdated").map((e) => [e.playerId, e.bag]);
    expect(bags).toContainEqual(["p2", ["herb", "bomb", "antidote"]]);
    expect(bags[bags.length - 1]).toEqual(["p1", []]);
    expect(of("MasteryRankUp")).toEqual([]);
    expect(of("HybridUnlocked")).toEqual([]);
  });

  it("leaves the spec's final characters, bags, history and hidden state", () => {
    const { state } = result;
    expect(state.public.combat).toBeNull();
    expect(state.public.phase).toBe("turn");
    expect(state.public.characters.p1).toEqual({
      classId: "fighter",
      level: 1,
      xp: 20,
      hp: 0,
      gold: 130,
      mastery: { battlemage: 0, caster: 0, fighter: 1 },
      portable: null,
      weapon: "stick",
      shield: "lid",
      accessory: null,
      battleSpell: "zap",
      wardSpell: null,
    });
    expect(state.public.characters.p2).toEqual({
      classId: "fighter",
      level: 3,
      xp: 160,
      hp: 67,
      gold: 250,
      mastery: { battlemage: 0, caster: 1, fighter: 0 },
      portable: null,
      weapon: "sword",
      shield: "lid",
      accessory: "charm",
      battleSpell: "zap",
      wardSpell: "sponge",
    });
    expect(state.private.p1).toEqual({ bag: [], scrolls: [], prompt: null });
    expect(state.private.p2).toEqual({
      bag: ["herb", "bomb", "antidote"],
      scrolls: ["haste"],
      prompt: null,
    });
    expect(state.public.choiceHistory.p1).toEqual({
      attack: 1,
      strike: 3,
      spell: 0,
      guard: 3,
      counter: 2,
      ward: 0,
    });
    expect(state.public.choiceHistory.p2).toEqual({
      attack: 0,
      strike: 0,
      spell: 2,
      guard: 0,
      counter: 1,
      ward: 0,
    });
    expect(state.hidden).toEqual({
      combatSeq: 2,
      decisionSeq: 9,
      decision: null,
      rng: [2320551141, 1615250627, 3129816856, 743918455],
    });
  });
});
