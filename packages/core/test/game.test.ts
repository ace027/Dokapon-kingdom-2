import { describe, expect, it } from "vitest";
import { createGame, SettingsError } from "../src/game";
import { seedRng } from "../src/rng";
import { RESERVED_IDS, type GameSettings } from "../src/types";

/** Builds settings that bypass the static types, as untrusted JSON would. */
function untrusted(value: unknown): GameSettings {
  return value as GameSettings;
}

describe("createGame validation", () => {
  const cases: [string, unknown][] = [
    ["0 players", { v: 1, seed: "s", players: [] }],
    ["5 players", { v: 1, seed: "s", players: ["a", "b", "c", "d", "e"] }],
    ["a duplicate id", { v: 1, seed: "s", players: ["p1", "p1"] }],
    ["an id with a space", { v: 1, seed: "s", players: ["p 1"] }],
    ["a 33-char id", { v: 1, seed: "s", players: ["x".repeat(33)] }],
    ["an empty id", { v: 1, seed: "s", players: [""] }],
    ["a non-string id", { v: 1, seed: "s", players: [7] }],
    ["an empty seed", { v: 1, seed: "", players: ["p1"] }],
    ["a non-string seed", { v: 1, seed: 5, players: ["p1"] }],
    ["v: 2", { v: 2, seed: "s", players: ["p1"] }],
    ["non-array players", { v: 1, seed: "s", players: "p1" }],
    ["null settings", null],
    ...RESERVED_IDS.map((id): [string, unknown] => [
      `reserved id "${id}"`,
      { v: 1, seed: "s", players: ["p1", id] },
    ]),
  ];

  it("covers every reserved id", () => {
    expect([...RESERVED_IDS]).toEqual([
      "system",
      "spectator",
      "__proto__",
      "constructor",
      "prototype",
    ]);
  });

  it.each(cases)("throws SettingsError for %s", (_label, settings) => {
    expect(() => createGame(untrusted(settings))).toThrow(SettingsError);
  });

  it("accepts a 32-char id and 4 players", () => {
    const id = "A".repeat(32);
    expect(() => createGame({ v: 1, seed: "s", players: [id, "b-2", "c_3", "D4"] })).not.toThrow();
  });

  it("names the error class", () => {
    expect(() => createGame(untrusted({ v: 2, seed: "s", players: ["p1"] }))).toThrow(
      expect.objectContaining({ name: "SettingsError" }),
    );
  });
});

describe("createGame initial state", () => {
  it("builds the partitioned state from the spec", () => {
    const players = ["p1", "p2"];
    const state = createGame({ v: 1, seed: "usurpia", players });
    expect(state).toEqual({
      v: 1,
      public: {
        phase: "turn",
        turn: 1,
        activePlayer: "p1",
        players: ["p1", "p2"],
        counter: 0,
        lastRoll: null,
        pending: null,
        lastReveal: null,
      },
      private: { p1: { note: null }, p2: { note: null } },
      hidden: { rng: seedRng("usurpia"), decisionSeq: 0, decision: null },
    });
    expect(state.public.players).not.toBe(players);
  });

  it("is deterministic per seed and seed-sensitive", () => {
    const a = createGame({ v: 1, seed: "one", players: ["p1"] });
    const b = createGame({ v: 1, seed: "one", players: ["p1"] });
    const c = createGame({ v: 1, seed: "two", players: ["p1"] });
    expect(a).toEqual(b);
    expect(c.hidden.rng).not.toEqual(a.hidden.rng);
  });
});
