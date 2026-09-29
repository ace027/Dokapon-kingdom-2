import { describe, expect, it } from "vitest";
import type { GameEvent } from "../src/events";
import { decisionHandlers, revealDecision } from "../src/handlers/decision";
import type { Resolver, ResolverTable } from "../src/handlers/shared";
import { reduce, type Reject, type RejectCode } from "../src/reducer";
import { seedRng } from "../src/rng";
import { stableStringify } from "../src/serialize";
import { MAX_COUNTER, type GameState, type PendingDecisionPublic } from "../src/types";
import { applyAll, deepFreeze, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const P1_PROMPT = { playerId: "p1", options: ["yes", "no"], default: "no" };
const P2_PROMPT = { playerId: "p2", options: ["red", "green", "blue"], default: "red" };

const open = (prompts: unknown[]) => ({
  v: 2,
  type: "decision/open",
  playerId: "system",
  prompts,
});
const commit = (playerId: string, decisionId: string, choice: string) => ({
  v: 2,
  type: "decision/commit",
  playerId,
  decisionId,
  choice,
});
const timeout = (decisionId: string) => ({ v: 2, type: "timeout", playerId: "system", decisionId });

const POLL = open([P1_PROMPT, P2_PROMPT]);

/** The exact rejection of `action` on `state`; the result never carries a state. */
function rejectionOf(state: GameState, action: unknown): Reject {
  const result = reduce(state, action, TEST_RULES);
  if (result.ok) throw new Error("expected a rejection");
  expect("state" in result).toBe(false);
  return result.error;
}

function expectReject(state: GameState, action: unknown, code: RejectCode, message: string): void {
  expect(rejectionOf(state, action)).toEqual({ code, message });
}

function pendingOf(state: GameState): PendingDecisionPublic {
  if (state.public.pending === null) throw new Error("no pending decision");
  return state.public.pending;
}

const opened = () => applyAll(newGame(), [POLL]).state;

describe("poll flow", () => {
  it("opens, commits and reveals with the exact events and state", () => {
    const start = deepFreeze(newGame());
    const { state, events } = applyAll(start, [
      POLL,
      commit("p1", "d1", "yes"),
      commit("p2", "d1", "green"),
    ]);
    expect(events.map((e) => e.type)).toEqual([
      "DecisionOpened",
      "PromptOpened",
      "PromptOpened",
      "ChoiceCommitted",
      "ChoiceCommitted",
      "ChoicesRevealed",
    ]);
    for (const e of events.filter((e) => e.type === "ChoiceCommitted")) {
      expect("choice" in e).toBe(false);
    }
    expect(state.public.lastReveal).toEqual({
      decisionId: "d1",
      kind: "poll",
      choices: { p1: "yes", p2: "green" },
      timedOut: [],
    });
    expect(state.public.pending).toBeNull();
    expect(state.hidden.decision).toBeNull();
    expect(state.private.p1?.prompt).toBeNull();
    expect(state.private.p2?.prompt).toBeNull();
    expect(state.public.phase).toBe("turn");
    expect(state.public.choiceHistory).toEqual(start.public.choiceHistory);
    expect(state.hidden.decisionSeq).toBe(1);
  });

  it("emits DecisionOpened publicly and each PromptOpened privately, in prompt order", () => {
    const { state, events } = applyAll(newGame(), [POLL]);
    expect(events[0]).toEqual({
      v: 2,
      type: "DecisionOpened",
      visibility: { kind: "public" },
      decisionId: "d1",
      kind: "poll",
      required: ["p1", "p2"],
    });
    expect(events[1]).toEqual({
      v: 2,
      type: "PromptOpened",
      visibility: { kind: "players", ids: ["p1"] },
      decisionId: "d1",
      playerId: "p1",
      options: ["yes", "no"],
      default: "no",
    });
    expect(events[2]).toMatchObject({
      visibility: { kind: "players", ids: ["p2"] },
      playerId: "p2",
    });
    expect(state.public.phase).toBe("decision");
    expect(state.public.pending).toEqual({
      id: "d1",
      kind: "poll",
      required: ["p1", "p2"],
      committed: [],
    });
    expect(state.hidden.decision).toEqual({ id: "d1", choices: {} });
    expect(state.private.p1?.prompt).toEqual({
      decisionId: "d1",
      options: ["yes", "no"],
      default: "no",
    });
  });

  it("keeps the committed choice hidden until the reveal", () => {
    const { state } = applyAll(newGame(), [POLL, commit("p1", "d1", "yes")]);
    expect(pendingOf(state).committed).toEqual(["p1"]);
    expect(state.hidden.decision).toEqual({ id: "d1", choices: { p1: "yes" } });
    expect(JSON.stringify(state.public)).not.toContain("yes");
    expect(state.public.phase).toBe("decision");
  });

  it("fills a timed-out player's own default and emits ChoiceTimedOut before the reveal", () => {
    const { state, events } = applyAll(newGame(), [POLL, commit("p1", "d1", "yes"), timeout("d1")]);
    expect(events.map((e) => e.type).slice(3)).toEqual([
      "ChoiceCommitted",
      "ChoiceTimedOut",
      "ChoicesRevealed",
    ]);
    expect(state.public.lastReveal).toEqual({
      decisionId: "d1",
      kind: "poll",
      choices: { p1: "yes", p2: "red" },
      timedOut: ["p2"],
    });
    const revealed = events.at(-1);
    expect(revealed).toMatchObject({ type: "ChoicesRevealed", timedOut: ["p2"] });
  });

  it("times out every required player in required order when nobody committed", () => {
    const { state, events } = applyAll(newGame(), [POLL, timeout("d1")]);
    expect(
      events.filter((e) => e.type === "ChoiceTimedOut").map((e) => "playerId" in e && e.playerId),
    ).toEqual(["p1", "p2"]);
    expect(state.public.lastReveal?.choices).toEqual({ p1: "no", p2: "red" });
    expect(state.public.lastReveal?.timedOut).toEqual(["p1", "p2"]);
  });

  it("numbers the next decision d2", () => {
    const { state } = applyAll(newGame(), [POLL, timeout("d1"), open([P2_PROMPT])]);
    expect(pendingOf(state).id).toBe("d2");
    expect(state.private.p2?.prompt?.decisionId).toBe("d2");
    expect(state.hidden.decisionSeq).toBe(2);
  });
});

describe("decision/open", () => {
  it.each<[string, unknown[], string]>([
    ["duplicate prompt players", [P1_PROMPT, { ...P1_PROMPT }], "prompt players must be unique"],
    [
      "an unseated prompt player",
      [P1_PROMPT, { ...P2_PROMPT, playerId: "ghost" }],
      "prompt player must be seated",
    ],
    [
      "a prototype-member id that is not seated",
      [{ ...P1_PROMPT, playerId: "toString" }],
      "prompt player must be seated",
    ],
    [
      "duplicate options",
      [{ ...P1_PROMPT, options: ["yes", "yes"], default: "yes" }],
      "prompt options must be unique",
    ],
    [
      "a default outside the options",
      [{ ...P1_PROMPT, default: "maybe" }],
      "prompt default must be one of its options",
    ],
  ])("rejects %s with INVALID_PAYLOAD", (_label, prompts, message) => {
    expectReject(newGame(), open(prompts), "INVALID_PAYLOAD", message);
  });

  const SHAPE_MESSAGE = "invalid payload for decision/open";
  it.each<[string, unknown]>([
    ["0 prompts", open([])],
    ["5 prompts", open([P1_PROMPT, P2_PROMPT, P1_PROMPT, P1_PROMPT, P1_PROMPT])],
    ["0 options", open([{ ...P1_PROMPT, options: [] }])],
    [
      "9 options",
      open([
        { ...P1_PROMPT, options: ["a", "b", "c", "d", "e", "f", "g", "h", "i"], default: "a" },
      ]),
    ],
    ["a 65-char option", open([{ ...P1_PROMPT, options: ["a".repeat(65), "no"] }])],
    ["a non-token option", open([{ ...P1_PROMPT, options: ["Yes", "no"] }])],
    ["a non-token default", open([{ ...P1_PROMPT, default: "No" }])],
    ["a null prompt", open([null])],
    ["a non-object prompt", open(["p1"])],
    ["an extra prompt key", open([{ ...P1_PROMPT, zzz: 1 }])],
    ["a missing prompt key", open([{ playerId: "p1", options: ["yes"] }])],
    ["an extra action key", { ...POLL, zzz: 1 }],
    ["prompts that are not an array", { ...POLL, prompts: {} }],
    ["a non-string prompt player", open([{ ...P1_PROMPT, playerId: 1 }])],
  ])("rejects %s at the shape step", (_label, action) => {
    expectReject(newGame(), action, "INVALID_PAYLOAD", SHAPE_MESSAGE);
  });

  it("accepts 1..4 prompts and 1..8 options", () => {
    const four = ["p1", "p2", "p3", "p4"].map((playerId) => ({
      playerId,
      options: ["a", "b", "c", "d", "e", "f", "g", "h"],
      default: "h",
    }));
    const game = newGame({
      v: 2,
      seed: "four",
      players: [
        { id: "p1", classId: "fighter" },
        { id: "p2", classId: "caster" },
        { id: "p3", classId: "fighter" },
        { id: "p4", classId: "caster" },
      ],
    });
    const { state } = applyAll(game, [open(four)]);
    expect(pendingOf(state).required).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it.each([
    ["a 53-char option", `item:${"a".repeat(48)}`, 53],
    ["a 64-char option", "b".repeat(64), 64],
  ])("accepts %s and commits it through to the reveal", (_label, token, length) => {
    expect(token).toHaveLength(length);
    const { state } = applyAll(newGame(), [
      open([{ playerId: "p1", options: [token, "no"], default: "no" }]),
      commit("p1", "d1", token),
    ]);
    expect(state.public.lastReveal?.choices).toEqual({ p1: token });
  });

  it("rejects a commit of a 65-char token at the shape step", () => {
    expectReject(
      opened(),
      commit("p1", "d1", "c".repeat(65)),
      "INVALID_PAYLOAD",
      "invalid payload for decision/commit",
    );
  });
});

describe("decision/commit", () => {
  it("rejects a stale decision id", () => {
    expectReject(
      opened(),
      commit("p1", "d9", "yes"),
      "STALE_DECISION",
      "decision d9 is not the open decision",
    );
  });

  it("clips an oversized stale decision id in the message", () => {
    const error = rejectionOf(opened(), commit("p1", "d".repeat(100), "yes"));
    expect(error.code).toBe("STALE_DECISION");
    expect(error.message).toBe(`decision ${"d".repeat(64)}… is not the open decision`);
  });

  it("rejects a double commit that reuses an in-options choice", () => {
    const state = applyAll(newGame(), [POLL, commit("p1", "d1", "yes")]).state;
    expectReject(state, commit("p1", "d1", "yes"), "ALREADY_COMMITTED", "p1 already committed");
  });

  it("checks STALE_DECISION before ALREADY_COMMITTED", () => {
    const state = applyAll(newGame(), [POLL, commit("p1", "d1", "yes")]).state;
    expectReject(
      state,
      commit("p1", "d9", "yes"),
      "STALE_DECISION",
      "decision d9 is not the open decision",
    );
  });

  it("checks ALREADY_COMMITTED before the options check", () => {
    const state = applyAll(newGame(), [POLL, commit("p1", "d1", "yes")]).state;
    expectReject(state, commit("p1", "d1", "zzz"), "ALREADY_COMMITTED", "p1 already committed");
  });

  it.each<[string, string, string]>([
    ["a token outside every option list", "p2", "purple"],
    ["another player's option", "p2", "yes"],
    ["another player's option (p1 side)", "p1", "red"],
  ])("rejects %s", (_label, playerId, choice) => {
    expectReject(
      opened(),
      commit(playerId, "d1", choice),
      "INVALID_PAYLOAD",
      "choice is not one of your options",
    );
  });

  it.each<[string, unknown]>([
    ["a non-token choice", commit("p1", "d1", "Bad Token")],
    ["a non-string decision id", { ...commit("p1", "d1", "yes"), decisionId: 1 }],
    ["an extra key", { ...commit("p1", "d1", "yes"), zzz: 1 }],
    ["a missing choice", { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1" }],
  ])("rejects %s at the shape step", (_label, action) => {
    expectReject(opened(), action, "INVALID_PAYLOAD", "invalid payload for decision/commit");
  });

  it("does not consume the rejected action: the input state is untouched", () => {
    const state = deepFreeze(opened());
    const before = stableStringify(state);
    rejectionOf(state, commit("p2", "d1", "yes"));
    expect(stableStringify(state)).toBe(before);
  });
});

describe("timeout", () => {
  it("rejects a stale decision id", () => {
    expectReject(opened(), timeout("d9"), "STALE_DECISION", "decision d9 is not the open decision");
  });

  it.each<[string, unknown]>([
    ["an extra key", { ...timeout("d1"), zzz: 1 }],
    ["a non-string decision id", { ...timeout("d1"), decisionId: 1 }],
  ])("rejects %s at the shape step", (_label, action) => {
    expectReject(opened(), action, "INVALID_PAYLOAD", "invalid payload for timeout");
  });
});

describe("players named like Object.prototype members (PIT-002)", () => {
  const game = newGame({
    v: 2,
    seed: "proto",
    players: [
      { id: "toString", classId: "fighter" },
      { id: "valueOf", classId: "caster" },
      { id: "hasOwnProperty", classId: "fighter" },
    ],
  });
  const prompts = [
    { playerId: "toString", options: ["a", "b"], default: "b" },
    { playerId: "valueOf", options: ["c", "d"], default: "d" },
    { playerId: "hasOwnProperty", options: ["e"], default: "e" },
  ];

  it("commits and times out with each player's own default", () => {
    const { state } = applyAll(game, [open(prompts), commit("toString", "d1", "a"), timeout("d1")]);
    const reveal = state.public.lastReveal;
    expect(reveal?.choices).toEqual({ toString: "a", valueOf: "d", hasOwnProperty: "e" });
    expect(reveal?.timedOut).toEqual(["valueOf", "hasOwnProperty"]);
    for (const choice of Object.values(reveal?.choices ?? {})) expect(typeof choice).toBe("string");
    expect(() => stableStringify(state)).not.toThrow();
  });

  it("lets a prototype-named player commit and completes the poll", () => {
    const { state } = applyAll(game, [
      open(prompts),
      commit("valueOf", "d1", "c"),
      commit("hasOwnProperty", "d1", "e"),
      commit("toString", "d1", "b"),
    ]);
    expect(state.public.lastReveal?.choices).toEqual({
      toString: "b",
      valueOf: "c",
      hasOwnProperty: "e",
    });
    expect(state.public.lastReveal?.timedOut).toEqual([]);
  });

  it("refuses a commit from a prototype-named player who is not seated", () => {
    expectReject(
      opened(),
      commit("toString", "d1", "yes"),
      "WRONG_ACTOR",
      "toString may not perform decision/commit",
    );
  });
});

// The combat/exchange reveal path is exercised directly: W1b `deserialize` and the handlers never
// produce a combat pending, so the state is a hand-built structural copy of an open poll.
describe("revealDecision: combat/exchange choiceHistory counting", () => {
  const COMBAT_PROMPTS = [
    { playerId: "p1", options: ["strike", "flee", "item:herb"], default: "strike" },
    { playerId: "p2", options: ["guard", "counter", "ward"], default: "guard" },
  ];

  interface Call {
    choices: Readonly<Record<string, string>>;
  }

  function stubTable(calls: Call[]): ResolverTable {
    const combat: Resolver = (state, choices) => {
      calls.push({ choices });
      return state;
    };
    const poll: Resolver = () => {
      throw new Error("poll resolver must not run");
    };
    return { poll, "combat/exchange": combat };
  }

  const ctx = () => ({
    rng: seedRng("reveal"),
    int: (): number => {
      throw new Error("the stub resolver never draws");
    },
  });

  const ZERO = { attack: 0, strike: 0, spell: 0, guard: 0, counter: 0, ward: 0 };

  function combatState(choices: Record<string, string>, strikeCount = 0): GameState {
    const base = applyAll(newGame(), [open(COMBAT_PROMPTS)]).state;
    const pending = pendingOf(base);
    return {
      ...base,
      public: {
        ...base.public,
        pending: { ...pending, kind: "combat/exchange", committed: Object.keys(choices) },
        choiceHistory: {
          ...base.public.choiceHistory,
          p1: { ...ZERO, strike: strikeCount },
        },
      },
      hidden: { ...base.hidden, decision: { id: "d1", choices } },
    };
  }

  it("counts a committed command and skips a timed-out default", () => {
    const calls: Call[] = [];
    const events: GameEvent[] = [];
    const next = revealDecision(
      combatState({ p1: "strike" }),
      ["p2"],
      ctx(),
      TEST_RULES,
      events,
      stubTable(calls),
    );
    expect(next.public.choiceHistory.p1).toEqual({ ...ZERO, strike: 1 });
    expect(next.public.choiceHistory.p2).toEqual(ZERO);
    expect(next.public.lastReveal).toEqual({
      decisionId: "d1",
      kind: "combat/exchange",
      choices: { p1: "strike", p2: "guard" },
      timedOut: ["p2"],
    });
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0]?.choices ?? {})).toEqual(["p1", "p2"]);
    expect(events.map((e) => e.type)).toEqual(["ChoicesRevealed"]);
  });

  it("does not count flee, and counts the defender's command", () => {
    const calls: Call[] = [];
    const next = revealDecision(
      combatState({ p1: "flee", p2: "counter" }),
      [],
      ctx(),
      TEST_RULES,
      [],
      stubTable(calls),
    );
    expect(next.public.choiceHistory.p1).toEqual(ZERO);
    expect(next.public.choiceHistory.p2).toEqual({ ...ZERO, counter: 1 });
    expect(calls).toHaveLength(1);
  });

  it("does not count item:<id>", () => {
    const calls: Call[] = [];
    const next = revealDecision(
      combatState({ p1: "item:herb", p2: "ward" }),
      [],
      ctx(),
      TEST_RULES,
      [],
      stubTable(calls),
    );
    expect(next.public.choiceHistory.p1).toEqual(ZERO);
    expect(next.public.choiceHistory.p2).toEqual({ ...ZERO, ward: 1 });
    expect(Object.keys(calls[0]?.choices ?? {})).toEqual(["p1", "p2"]);
  });

  it("saturates at MAX_COUNTER", () => {
    const next = revealDecision(
      combatState({ p1: "strike", p2: "guard" }, MAX_COUNTER),
      [],
      ctx(),
      TEST_RULES,
      [],
      stubTable([]),
    );
    expect(next.public.choiceHistory.p1?.strike).toBe(MAX_COUNTER);
    expect(Number.isSafeInteger(next.public.choiceHistory.p1?.strike)).toBe(true);
    expect(next.public.choiceHistory.p2?.guard).toBe(1);
  });

  it("leaves choiceHistory unchanged for a poll with the same choices", () => {
    const base = combatState({ p1: "strike", p2: "guard" });
    const poll: GameState = {
      ...base,
      public: { ...base.public, pending: { ...pendingOf(base), kind: "poll" } },
    };
    const table: ResolverTable = { ...stubTable([]), poll: (state) => state };
    const next = revealDecision(poll, [], ctx(), TEST_RULES, [], table);
    expect(next.public.choiceHistory).toEqual(poll.public.choiceHistory);
    expect(next.public.lastReveal?.kind).toBe("poll");
  });

  it("clears pending, hidden.decision and the required prompts, and returns to phase turn", () => {
    const next = revealDecision(
      combatState({ p1: "strike", p2: "guard" }),
      [],
      ctx(),
      TEST_RULES,
      [],
      stubTable([]),
    );
    expect(next.public.pending).toBeNull();
    expect(next.hidden.decision).toBeNull();
    expect(next.private.p1?.prompt).toBeNull();
    expect(next.private.p2?.prompt).toBeNull();
    expect(next.public.phase).toBe("turn");
  });
});

describe("defensive paths", () => {
  const table: ResolverTable = { poll: (s) => s, "combat/exchange": (s) => s };

  it("revealDecision returns the state unchanged when no decision is open", () => {
    const state = newGame();
    const events: GameEvent[] = [];
    const ctx = { rng: seedRng("x"), int: () => 0 };
    expect(revealDecision(state, [], ctx, TEST_RULES, events, table)).toBe(state);
    expect(events).toEqual([]);
  });

  it("the commit and timeout handlers do nothing when no decision is open", () => {
    const handlers = decisionHandlers(table);
    const state = newGame();
    const ctx = { rng: seedRng("x"), int: () => 0 };
    const c = {
      v: 2 as const,
      type: "decision/commit" as const,
      playerId: "p1",
      decisionId: "d1",
      choice: "yes",
    };
    const t = {
      v: 2 as const,
      type: "timeout" as const,
      playerId: "system" as const,
      decisionId: "d1",
    };
    expect(handlers["decision/commit"].apply(state, c, ctx, TEST_RULES)).toEqual({
      state,
      events: [],
    });
    expect(handlers.timeout.apply(state, t, ctx, TEST_RULES)).toEqual({ state, events: [] });
  });
});
