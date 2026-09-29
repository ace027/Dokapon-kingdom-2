import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GameEvent } from "@usurpia/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReplayFileError, replayFile, RulesMismatchError } from "../src/replay-file";
import { replayRules } from "../src/rules";

const combatFixture = fileURLToPath(new URL("../fixtures/combat-game.json", import.meta.url));

const SETTINGS = {
  v: 2,
  seed: "fixture",
  players: [
    { id: "a", classId: "warrior" },
    { id: "b", classId: "mage" },
  ],
};
const RULES_HASH = "84a995db";
const EMPTY_LINE = `hash=[0-9a-f]{8} rules=${RULES_HASH} turn=1 events=0 rejections=0`;
const FOREIGN_HASH = "7433ea8b";

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "usurpia-sim-"));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeTemp(name: string, contents: unknown): string {
  const filePath = path.join(tempDir, name);
  fs.writeFileSync(filePath, typeof contents === "string" ? contents : JSON.stringify(contents));
  return filePath;
}

function goodFile(overrides: Record<string, unknown> = {}): unknown {
  return { rulesHash: RULES_HASH, settings: SETTINGS, actions: [], ...overrides };
}

function errorOf(filePath: string, opts?: { allowRulesMismatch?: boolean }): unknown {
  try {
    replayFile(filePath, replayRules(), opts);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("replayRules", () => {
  it("is the shipped content", () => {
    const rules = replayRules();
    expect(Object.keys(rules.classes).sort()).toEqual([
      "cleric",
      "mage",
      "shadowpriest",
      "spellblade",
      "thief",
      "warrior",
    ]);
  });
});

describe("combat-game fixture", () => {
  const LINE = "hash=0483c0fa rules=84a995db turn=1 events=95 rejections=0";
  /** Per-step hashState from traces/combat-game.trace.json (initial 8110a5ee). */
  const STEP_HASHES = [
    "6f44a77c",
    "5fa07f03",
    "40b6409e",
    "55eee36e",
    "47830df7",
    "d6804f0d",
    "9b9fb3f3",
    "69da3424",
    "afb85572",
    "cf6ad733",
    "d2abacc3",
    "d2578407",
    "cba90fa5",
    "75d8b2cf",
    "92471765",
    "23292a9a",
    "e7bffe80",
    "0034d968",
    "04d8cd6a",
    "3dcc6b6d",
    "fe1ca1bc",
    "6a6397ed",
    "0483c0fa",
  ];
  const TYPE_SEQUENCE =
    "CharacterSet, BagUpdated, CharacterSet, BagUpdated, CombatStarted, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, BagUpdated, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, BagUpdated, CombatEnded, CombatStarted, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, BagUpdated, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted, ChoiceTimedOut, ChoicesRevealed, ExchangeResolved, RoundEnded, CombatEnded, CombatStarted, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, CombatEnded";

  function expandTypes(text: string): string[] {
    return text.split(", ").flatMap((part) => {
      const [type = "", count] = part.split("×");
      return Array.from({ length: count === undefined ? 1 : Number(count) }, () => type);
    });
  }

  it("replays to the golden line", () => {
    expect(replayFile(combatFixture, replayRules()).line).toBe(LINE);
  });

  it("is deterministic and has no rejections", () => {
    const first = replayFile(combatFixture, replayRules());
    const second = replayFile(combatFixture, replayRules());
    expect(second.line).toBe(first.line);
    expect(first.result.rejections).toEqual([]);
  });

  it("has the pinned event type sequence (95 events)", () => {
    const { result } = replayFile(combatFixture, replayRules());
    expect(result.events.map((e) => e.type)).toEqual(expandTypes(TYPE_SEQUENCE));
    expect(result.events).toHaveLength(95);
  });

  it("reaches the traced hash after every action", () => {
    const actions = (JSON.parse(fs.readFileSync(combatFixture, "utf8")) as { actions: unknown[] })
      .actions;
    expect(actions).toHaveLength(STEP_HASHES.length);
    const hashes = STEP_HASHES.map((_, i) => {
      const file = writeTemp(`prefix-${String(i)}.json`, {
        rulesHash: RULES_HASH,
        settings: { v: 2, seed: "sim-fixture", players: SETTINGS.players },
        actions: actions.slice(0, i + 1),
      });
      return /hash=([0-9a-f]{8})/.exec(replayFile(file, replayRules()).line)?.[1];
    });
    expect(hashes).toEqual(STEP_HASHES);
  });

  it("pins the 12-exchange table", () => {
    const { result } = replayFile(combatFixture, replayRules());
    const exchanges = result.events.filter(
      (e): e is Extract<GameEvent, { type: "ExchangeResolved" }> => e.type === "ExchangeResolved",
    );
    const table = exchanges.map((e) => [
      e.combatId,
      `${String(e.round)}.${String(e.exchange)}`,
      e.attacker,
      e.command,
      e.defense,
      [...e.damage],
      [...e.heal],
      [...e.effects],
      [...e.hp],
    ]);
    expect(table).toEqual([
      ["c1", "1.1", 1, "attack", "guard", [15, 0], [0, 0], ["steal-item:battle-tonic"], [72, 85]],
      [
        "c1",
        "1.2",
        0,
        "item:smoke-bomb",
        null,
        [0, 0],
        [0, 0],
        ["item:smoke-bomb", "fled"],
        [72, 85],
      ],
      ["c2", "1.1", 0, "spell", "ward", [0, 44], [0, 0], [], [64, 28]],
      ["c2", "1.2", 1, "attack", "guard", [19, 0], [0, 0], [], [45, 28]],
      ["c2", "2.1", 0, "attack", "guard", [0, 8], [0, 0], [], [45, 20]],
      ["c2", "2.2", 1, "item:herb", null, [0, 0], [0, 26], ["item:herb"], [45, 46]],
      ["c2", "3.1", 0, "spell", "guard", [0, 44], [0, 0], [], [45, 2]],
      ["c2", "3.2", 1, "attack", "guard", [19, 0], [0, 0], [], [26, 2]],
      ["c3", "1.1", 0, "spell", "counter", [0, 42], [0, 0], [], [26, 62]],
      ["c3", "1.2", 1, "spell", "ward", [9, 0], [0, 0], [], [17, 62]],
      ["c3", "2.1", 0, "strike", "guard", [0, 33], [0, 0], [], [17, 29]],
      ["c3", "2.2", 1, "spell", "counter", [17, 0], [0, 0], [], [0, 29]],
    ]);
  });

  it("ends the three combats as fled, draw and ko", () => {
    const { result } = replayFile(combatFixture, replayRules());
    const ends = result.events.filter(
      (e): e is Extract<GameEvent, { type: "CombatEnded" }> => e.type === "CombatEnded",
    );
    expect(ends.map((e) => [e.combatId, e.outcome, e.winner, e.fled, [...e.hp]])).toEqual([
      ["c1", "fled", null, 0, [72, 85]],
      ["c2", "draw", null, null, [26, 2]],
      ["c3", "ko", 1, null, [0, 29]],
    ]);
  });

  it("leaves the pinned final state", () => {
    const { state } = replayFile(combatFixture, replayRules()).result;
    expect(state.public.characters.a).toMatchObject({
      classId: "warrior",
      level: 5,
      xp: 500,
      gold: 100,
      hp: 2,
    });
    expect(state.public.characters.b).toMatchObject({
      classId: "mage",
      level: 5,
      xp: 500,
      gold: 100,
      hp: 0,
    });
    expect(state.private.a?.bag).toEqual([]);
    expect(state.private.b?.bag).toEqual(["herb"]);
    expect(state.public.choiceHistory.a).toEqual({
      attack: 2,
      strike: 0,
      spell: 0,
      guard: 3,
      counter: 0,
      ward: 1,
    });
    expect(state.public.choiceHistory.b).toEqual({
      attack: 1,
      strike: 1,
      spell: 3,
      guard: 2,
      counter: 1,
      ward: 1,
    });
    expect(state.hidden).toEqual({
      combatSeq: 3,
      decisionSeq: 12,
      decision: null,
      rng: [1644771214, 1962754076, 1815850500, 733868240],
    });
  });
});

describe("replayFile", () => {
  it("prints the empty-replay line for a matching rulesHash", () => {
    const { line } = replayFile(writeTemp("ok.json", goodFile()), replayRules());
    expect(line).toMatch(new RegExp(`^${EMPTY_LINE}$`));
  });

  it("is deterministic across runs", () => {
    const filePath = writeTemp("ok.json", goodFile());
    expect(replayFile(filePath, replayRules()).line).toBe(replayFile(filePath, replayRules()).line);
  });

  it("counts rejected actions instead of throwing", () => {
    const filePath = writeTemp("junk.json", goodFile({ actions: [null, { v: 2, type: "x" }] }));
    const { line, result } = replayFile(filePath, replayRules());
    expect(result.rejections.map((r) => r.error.code)).toEqual([
      "UNSUPPORTED_VERSION",
      "UNKNOWN_ACTION",
    ]);
    expect(line).toMatch(
      new RegExp(`^hash=[0-9a-f]{8} rules=${RULES_HASH} turn=1 events=0 rejections=2$`),
    );
  });

  it("throws RulesMismatchError for a different rulesHash (the old kernel rules)", () => {
    const error = errorOf(writeTemp("mismatch.json", goodFile({ rulesHash: FOREIGN_HASH })));
    expect(error).toBeInstanceOf(RulesMismatchError);
    expect((error as Error).message).toBe(
      `rules mismatch: file ${FOREIGN_HASH}, current ${RULES_HASH}`,
    );
  });

  it("proceeds with a suffix under allowRulesMismatch", () => {
    const filePath = writeTemp("mismatch.json", goodFile({ rulesHash: FOREIGN_HASH }));
    const { line } = replayFile(filePath, replayRules(), { allowRulesMismatch: true });
    expect(line).toMatch(new RegExp(`^${EMPTY_LINE} rules-mismatch=${FOREIGN_HASH}$`));
  });

  it("rejects TEST_RULES class ids under content rules as invalid settings", () => {
    const filePath = writeTemp(
      "fighter.json",
      goodFile({ settings: { ...SETTINGS, players: [{ id: "a", classId: "fighter" }] } }),
    );
    const error = errorOf(filePath);
    expect(error).toBeInstanceOf(ReplayFileError);
    expect((error as Error).message).toMatch(/^invalid settings: /);
  });
});

describe("replayFile errors", () => {
  function expectFileError(error: unknown, message: string | RegExp): void {
    expect(error).toBeInstanceOf(ReplayFileError);
    expect(error).not.toBeInstanceOf(RulesMismatchError);
    if (typeof message === "string") expect((error as Error).message).toBe(message);
    else expect((error as Error).message).toMatch(message);
  }

  it("reports invalid JSON", () => {
    expectFileError(errorOf(writeTemp("bad.json", "{ not json")), "invalid JSON");
  });

  it("reports a missing rulesHash key", () => {
    const rest = goodFile() as Record<string, unknown>;
    delete rest.rulesHash;
    expectFileError(
      errorOf(writeTemp("nohash.json", rest)),
      "expected {rulesHash, settings, actions[]}",
    );
  });

  it("reports an extra key", () => {
    expectFileError(
      errorOf(writeTemp("extra.json", goodFile({ extra: 1 }))),
      "expected {rulesHash, settings, actions[]}",
    );
  });

  it("reports actions that are not an array", () => {
    expectFileError(
      errorOf(writeTemp("actions.json", goodFile({ actions: {} }))),
      "expected {rulesHash, settings, actions[]}",
    );
  });

  it("reports a rulesHash that is not 8 hex chars", () => {
    expectFileError(
      errorOf(writeTemp("badhash.json", goodFile({ rulesHash: "DEADBEEF" }))),
      "expected {rulesHash, settings, actions[]}",
    );
  });

  it("reports a non-object root", () => {
    for (const body of ["[]", "null"]) {
      expectFileError(
        errorOf(writeTemp("root.json", body)),
        "expected {rulesHash, settings, actions[]}",
      );
    }
  });

  it("reports an unreadable path", () => {
    const missing = path.join(tempDir, "does-not-exist.json");
    expectFileError(errorOf(missing), `cannot read ${missing}`);
  });

  it("reports invalid settings", () => {
    const filePath = writeTemp(
      "settings.json",
      goodFile({ settings: { ...SETTINGS, players: [] } }),
    );
    expectFileError(errorOf(filePath), /^invalid settings: /);
  });
});
