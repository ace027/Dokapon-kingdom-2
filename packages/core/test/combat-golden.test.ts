// The combat golden (spec: Combat golden, TEST_RULES): 18 actions, 0 rejections, 80 events, final
// hashState ec0c3508. Every expected value below is transcribed from the spec and the reference
// trace, never recorded from this engine. Mismatch localisation: fold per action and diff the
// per-step hashes (below) against the trace, then the events.
import { describe, expect, it } from "vitest";
import { createGame } from "../src/game";
import type { GameEvent } from "../src/events";
import { reduce } from "../src/reducer";
import { replay } from "../src/replay";
import { hashState } from "../src/serialize";
import { COMBAT_GOLDEN_ACTIONS, COMBAT_GOLDEN_SETTINGS } from "./arbitraries";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

/** `hashState` after `createGame` and after each of the 18 actions (traces/combat-golden.trace.json). */
const INITIAL_HASH = "a53e747c";
const STEP_HASHES = [
  "54470f85",
  "f8c8f59c",
  "33b5b8c4",
  "34143f79",
  "83c779d3",
  "c9372f12",
  "c18c10ce",
  "4f5d3bbc",
  "126574a6",
  "c87abeaa",
  "b1fdf883",
  "65cf76d4",
  "69ff96dd",
  "67abe62a",
  "7be77857",
  "38a4f593",
  "ad08922d",
  "ec0c3508",
];

/** The spec's event type sequence; `Type×n` expands to n copies. */
const TYPE_SEQUENCE =
  "CharacterSet, BagUpdated, CombatStarted, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, ExchangeSkipped, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted, ChoiceTimedOut, ChoicesRevealed, ExchangeResolved, BagUpdated, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, BagUpdated, CombatEnded, CombatStarted, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, BagUpdated, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, CombatEnded";

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

/** The 10 `ExchangeResolved` rows of the spec table (row 9 is D2: no ward spell, so 12). */
const EXCHANGES: Row[] = [
  row("c1", 1, 1, 0, "spell", "counter", [0, 8], ["stun"], [44, 28]),
  row("c1", 2, 1, 0, "item:tonic", null, [0, 0], ["item:tonic"], [44, 28]),
  row("c1", 2, 2, 1, "spell", "ward", [2, 4], ["reflected"], [42, 24]),
  row("c1", 3, 1, 0, "strike", "counter", [20, 0], ["reflected"], [22, 24]),
  row("c1", 3, 2, 1, "item:bomb", null, [0, 0], ["item:bomb", "fled"], [22, 24]),
  row("c2", 1, 1, 1, "strike", "guard", [13, 0], ["steal-gold:10", "steal-item:herb"], [11, 36]),
  row("c2", 1, 2, 0, "attack", "guard", [0, 6], [], [11, 30]),
  row("c2", 2, 1, 1, "flee", null, [0, 0], ["flee-failed"], [11, 30]),
  row("c2", 2, 2, 0, "spell", "ward", [0, 12], [], [11, 18]),
  row("c2", 3, 1, 0, "strike", "counter", [11, 0], ["reflected"], [0, 18]),
];

describe("combat golden (TEST_RULES)", () => {
  const result = replay(COMBAT_GOLDEN_SETTINGS, COMBAT_GOLDEN_ACTIONS, TEST_RULES);

  it("replays with 0 rejections, 80 events and hashState ec0c3508", () => {
    expect(result.rejections).toEqual([]);
    expect(result.events).toHaveLength(80);
    expect(hashState(result.state)).toBe("ec0c3508");
  });

  it("matches the trace hash after createGame and after every action", () => {
    let state = createGame(COMBAT_GOLDEN_SETTINGS, TEST_RULES);
    expect(hashState(state)).toBe(INITIAL_HASH);
    for (const [i, action] of COMBAT_GOLDEN_ACTIONS.entries()) {
      const step = reduce(state, action, TEST_RULES);
      if (!step.ok) throw new Error(`action ${i} rejected: ${step.error.message}`);
      state = step.state;
      expect(hashState(state), `hash after action ${i}`).toBe(STEP_HASHES[i]);
    }
  });

  it("emits the spec's 80-event type sequence", () => {
    expect(result.events.map((e) => e.type)).toEqual(expandTypes(TYPE_SEQUENCE));
  });

  it("emits the spec's exchange table", () => {
    const resolved = result.events.filter(
      (e): e is Extract<GameEvent, { type: "ExchangeResolved" }> => e.type === "ExchangeResolved",
    );
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

  it("skips the stunned attacker at c1 1.2", () => {
    const skipped = result.events.filter((e) => e.type === "ExchangeSkipped");
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toMatchObject({
      combatId: "c1",
      round: 1,
      exchange: 2,
      attacker: 1,
      reason: "stunned",
    });
  });

  it("ends both combats as the spec says", () => {
    const ended = result.events.filter((e) => e.type === "CombatEnded");
    expect(ended).toMatchObject([
      { combatId: "c1", outcome: "fled", winner: null, fled: 1, hp: [22, 24] },
      { combatId: "c2", outcome: "ko", winner: 1, fled: null, hp: [0, 18] },
    ]);
  });

  it("starts the rounds with the spec's initiative", () => {
    const firsts = (combatId: string) =>
      result.events.flatMap((e) =>
        e.type === "RoundStarted" && e.combatId === combatId ? [e.first] : [],
      );
    expect(firsts("c1")).toEqual([0, 0, 0]);
    expect(firsts("c2")).toEqual([1, 1, 0]);
  });

  it("leaves the spec's final characters, bags, history and hidden state", () => {
    const { state } = result;
    expect(state.public.combat).toBeNull();
    expect(state.public.phase).toBe("turn");
    expect(state.public.characters.p1?.hp).toBe(22);
    expect(state.private.p1?.bag).toEqual(["herb"]);
    expect(state.public.characters.p2?.hp).toBe(0);
    expect(state.public.characters.p2?.gold).toBe(90);
    expect(state.private.p2?.bag).toEqual([]);
    expect(state.public.choiceHistory.p1).toEqual({
      attack: 0,
      strike: 1,
      spell: 1,
      guard: 1,
      counter: 0,
      ward: 1,
    });
    // the timed-out guard at d2 is not counted
    expect(state.public.choiceHistory.p2).toEqual({
      attack: 1,
      strike: 1,
      spell: 2,
      guard: 1,
      counter: 3,
      ward: 0,
    });
    expect(state.hidden).toEqual({
      combatSeq: 2,
      decisionSeq: 10,
      decision: null,
      rng: [3200512360, 239253250, 3363130012, 583700052],
    });
  });
});
