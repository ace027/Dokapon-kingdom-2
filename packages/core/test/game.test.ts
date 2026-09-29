import { describe, expect, it } from "vitest";
import { createGame, SettingsError } from "../src/game";
import { hashState, stableStringify } from "../src/serialize";
import { RESERVED_IDS, type GameSettings } from "../src/types";
import { FIXTURE_SETTINGS, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

// Spec golden (W1a): canonical JSON of createGame(FIXTURE_SETTINGS, TEST_RULES).
const GOLDEN_JSON =
  '{"hidden":{"combatSeq":0,"decision":null,"decisionSeq":0,"rng":[2094061593,184016598,2753665883,215806170]},"private":{"p1":{"bag":["herb"],"prompt":null,"scrolls":[]},"p2":{"bag":["herb","bomb"],"prompt":null,"scrolls":[]}},"public":{"activePlayer":"p1","characters":{"p1":{"accessory":null,"battleSpell":"zap","classId":"fighter","gold":100,"hp":48,"level":1,"mastery":{"battlemage":0,"caster":0,"fighter":0},"portable":null,"shield":"lid","wardSpell":null,"weapon":"stick","xp":0},"p2":{"accessory":"charm","battleSpell":"zap","classId":"caster","gold":100,"hp":36,"level":1,"mastery":{"battlemage":0,"caster":0,"fighter":0},"portable":null,"shield":"lid","wardSpell":"shell","weapon":"stick","xp":0}},"choiceHistory":{"p1":{"attack":0,"counter":0,"guard":0,"spell":0,"strike":0,"ward":0},"p2":{"attack":0,"counter":0,"guard":0,"spell":0,"strike":0,"ward":0}},"combat":null,"lastReveal":null,"pending":null,"phase":"turn","players":["p1","p2"],"turn":1},"v":2}';

type Draft = Record<string, unknown>;
type Mutate = (settings: Draft) => void;

function mutated(mutate: Mutate): GameSettings {
  const draft = JSON.parse(JSON.stringify(FIXTURE_SETTINGS)) as Draft;
  mutate(draft);
  return draft as unknown as GameSettings;
}

/** The i-th seat of a settings draft (the fixture always has two). */
function seat(draft: Draft, i: number): Draft {
  const found = (draft.players as Draft[])[i];
  if (found === undefined) throw new Error(`fixture has no seat ${i}`);
  return found;
}

describe("createGame golden", () => {
  it("hashes to the spec golden", () => {
    expect(hashState(newGame())).toBe("758ef72c");
  });

  it("matches the spec canonical JSON verbatim", () => {
    expect(stableStringify(newGame())).toBe(GOLDEN_JSON);
  });

  it("gives equal states for the same seed and different rng for another seed", () => {
    expect(newGame()).toEqual(newGame());
    const other = newGame({ ...FIXTURE_SETTINGS, seed: "other" });
    expect(other.hidden.rng).not.toEqual(newGame().hidden.rng);
  });

  it("has exactly the v2 public keys and private entry keys", () => {
    const state = newGame();
    expect(Object.keys(state.public).sort()).toEqual([
      "activePlayer",
      "characters",
      "choiceHistory",
      "combat",
      "lastReveal",
      "pending",
      "phase",
      "players",
      "turn",
    ]);
    expect(Object.keys(state.private.p1 ?? {}).sort()).toEqual(["bag", "prompt", "scrolls"]);
  });

  it("accepts a single seat and four seats", () => {
    const one = createGame(
      { ...FIXTURE_SETTINGS, players: [{ id: "a", classId: "fighter" }] },
      TEST_RULES,
    );
    expect(one.public.players).toEqual(["a"]);
    const four = createGame(
      {
        ...FIXTURE_SETTINGS,
        players: ["a", "b", "c", "d"].map((id) => ({ id, classId: "caster" })),
      },
      TEST_RULES,
    );
    expect(four.public.players).toEqual(["a", "b", "c", "d"]);
  });
});

describe("createGame SettingsError (one mutation each from FIXTURE_SETTINGS)", () => {
  const cases: [string, Mutate, string][] = [
    ["v: 1", (s) => (s.v = 1), "settings.v must be 2"],
    ["empty seed", (s) => (s.seed = ""), "seed must be a non-empty string"],
    ["non-string seed", (s) => (s.seed = 5), "seed must be a non-empty string"],
    ["0 players", (s) => (s.players = []), "players must hold 1–4 seats"],
    [
      "5 players",
      (s) => (s.players = ["a", "b", "c", "d", "e"].map((id) => ({ id, classId: "fighter" }))),
      "players must hold 1–4 seats",
    ],
    ["players not an array", (s) => (s.players = "p1"), "players must be an array"],
    ["string seat (v1 shape)", (s) => (s.players = ["p1", "p2"]), "each seat must be an object"],
    [
      "seat with an extra key",
      (s) => (seat(s, 0).extra = 1),
      "each seat must have exactly the keys id and classId",
    ],
    [
      "seat missing classId",
      (s) => delete seat(s, 0).classId,
      "each seat must have exactly the keys id and classId",
    ],
    [
      "seat with classId renamed (right key count)",
      (s) => {
        const seat0 = seat(s, 0);
        seat0.klass = seat0.classId;
        delete seat0.classId;
      },
      "each seat must have exactly the keys id and classId",
    ],
    ["duplicate id", (s) => (seat(s, 1).id = "p1"), "player ids must be unique"],
    ["invalid id", (s) => (seat(s, 0).id = "bad id"), 'invalid player id "bad id"'],
    [
      "33-char id",
      (s) => (seat(s, 0).id = "a".repeat(33)),
      `invalid player id "${"a".repeat(33)}"`,
    ],
    ["non-string id", (s) => (seat(s, 0).id = 7), "player ids must be strings"],
    [
      "hybrid classId",
      (s) => (seat(s, 0).classId = "battlemage"),
      'class "battlemage" is not a base class',
    ],
    ["unknown classId", (s) => (seat(s, 0).classId = "wizard"), 'unknown class "wizard"'],
    [
      "prototype classId toString",
      (s) => (seat(s, 0).classId = "toString"),
      'unknown class "toString"',
    ],
    [
      "prototype classId constructor",
      (s) => (seat(s, 0).classId = "constructor"),
      'unknown class "constructor"',
    ],
    ["non-string classId", (s) => (seat(s, 0).classId = 3), "seat classId must be a string"],
  ];

  it.each(cases)("rejects %s", (_label, mutate, message) => {
    const settings = mutated(mutate);
    expect(() => createGame(settings, TEST_RULES)).toThrow(SettingsError);
    expect(() => createGame(settings, TEST_RULES)).toThrow(message);
  });

  it.each([...RESERVED_IDS])("rejects the reserved id %s", (id) => {
    const settings = mutated((s) => (seat(s, 0).id = id));
    expect(() => createGame(settings, TEST_RULES)).toThrow(`player id "${id}" is reserved`);
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["a string", "settings"],
    ["an array", []],
  ])("rejects settings that are %s", (_label, settings) => {
    const bad = settings as GameSettings;
    expect(() => createGame(bad, TEST_RULES)).toThrow(SettingsError);
    expect(() => createGame(bad, TEST_RULES)).toThrow("settings must be an object");
  });
});
