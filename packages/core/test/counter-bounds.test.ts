import { describe, expect, it } from "vitest";
import { reduce } from "../src/reducer";
import { deserialize, serialize } from "../src/serialize";
import { MAX_COUNTER, type GameState } from "../src/types";
import { applyAll, newGame } from "./fixtures/build";
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
