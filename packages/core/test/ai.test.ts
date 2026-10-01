// AI goldens (spec: CPU AI, "AI goldens") on the TEST_RULES fighter-vs-caster PvP state, plus the
// heal rule, the decideCombat null-return guards (one mutated field each, PIT-001) and purity.
import { describe, expect, it } from "vitest";
import { AI_TUNING, combatPolicy, createAi, decideCombat, type Difficulty } from "../src/ai";
import { createGame } from "../src/game";
import { reduce } from "../src/reducer";
import { deserialize, serialize } from "../src/serialize";
import type { GameSettings, GameState } from "../src/types";
import { viewFor, type PlayerView } from "../src/views";
import { computeCell, critChanceBp, isCritEligible, snapshotPlayer } from "../src/combat/resolve";
import type { AttackCommand, Rules } from "../src/rules";
import { applyAll, craft, deepFreeze } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const SETTINGS: GameSettings = {
  v: 2,
  seed: "ai",
  players: [
    { id: "p1", classId: "fighter" },
    { id: "p2", classId: "caster" },
  ],
};
const START = {
  v: 2,
  type: "combat/start",
  playerId: "system",
  attacker: "p1",
  opponent: { kind: "player", playerId: "p2" },
};

function baseState(): GameState {
  return applyAll(createGame(SETTINGS, TEST_RULES), [START]).state;
}

/** Edits the JSON of a valid save and reloads it, so the result is still a valid state. */
interface SaveJson {
  public: {
    characters: Record<string, { hp: number }>;
    choiceHistory: Record<string, Record<string, number>>;
  };
}

function edited(state: GameState, edit: (json: SaveJson) => void): GameState {
  const json = JSON.parse(serialize(state)) as SaveJson;
  edit(json);
  return deserialize(JSON.stringify(json), TEST_RULES);
}

function withHistory(state: GameState, counts: Record<string, number>): GameState {
  return edited(state, (json) => {
    for (const id of ["p1", "p2"]) Object.assign(need(json.public.choiceHistory[id]), counts);
  });
}

const ALL_ZERO = baseState();
const STRIKE_20 = withHistory(ALL_ZERO, { strike: 20 });
const GUARD_20 = withHistory(ALL_ZERO, { guard: 20 });

interface Row {
  state: GameState;
  viewer: string;
  difficulty: Difficulty;
  commands: string[];
  weights: number[];
  ev: number[] | null;
}
const P1_CMDS = ["attack", "strike", "spell"];
const P2_CMDS = ["guard", "counter", "ward"];
const ROWS: Record<string, Row> = {
  "all0 p1 easy": {
    state: ALL_ZERO,
    viewer: "p1",
    difficulty: "easy",
    commands: P1_CMDS,
    weights: [40, 40, 20],
    ev: null,
  },
  "all0 p1 normal": {
    state: ALL_ZERO,
    viewer: "p1",
    difficulty: "normal",
    commands: P1_CMDS,
    weights: [241220, 750409, 8371],
    ev: [0.427944, 0.598181, 0.027778],
  },
  "all0 p1 hard": {
    state: ALL_ZERO,
    viewer: "p1",
    difficulty: "hard",
    commands: P1_CMDS,
    weights: [13982, 986017, 1],
    ev: [0.427944, 0.598181, 0.027778],
  },
  "all0 p2 easy": {
    state: ALL_ZERO,
    viewer: "p2",
    difficulty: "easy",
    commands: P2_CMDS,
    weights: [30, 20, 50],
    ev: null,
  },
  "all0 p2 normal": {
    state: ALL_ZERO,
    viewer: "p2",
    difficulty: "normal",
    commands: P2_CMDS,
    weights: [152259, 752677, 95065],
    ev: [-0.402472, -0.101944, -0.54975],
  },
  "all0 p2 hard": {
    state: ALL_ZERO,
    viewer: "p2",
    difficulty: "hard",
    commands: P2_CMDS,
    weights: [546, 999441, 14],
    ev: [-0.402472, -0.101944, -0.54975],
  },
  "strike20 p2 hard": {
    state: STRIKE_20,
    viewer: "p2",
    difficulty: "hard",
    commands: P2_CMDS,
    weights: [0, 1000000, 0],
    ev: [-0.704868, 0.278148, -0.823975],
  },
  "guard20 p1 hard": {
    state: GUARD_20,
    viewer: "p1",
    difficulty: "hard",
    commands: P1_CMDS,
    weights: [7, 999993, 0],
    ev: [0.260444, 0.737486, 0.027778],
  },
};

describe("AI golden state", () => {
  it("opens the pinned prompts", () => {
    expect(viewFor(ALL_ZERO, "p1").self?.prompt?.options).toEqual([
      "attack",
      "strike",
      "spell",
      "flee",
      "item:herb",
    ]);
    expect(viewFor(ALL_ZERO, "p2").self?.prompt?.options).toEqual(["guard", "counter", "ward"]);
  });

  it("carries the history variants", () => {
    expect(STRIKE_20.public.choiceHistory.p1?.strike).toBe(20);
    expect(GUARD_20.public.choiceHistory.p2?.guard).toBe(20);
  });
});

describe("combatPolicy goldens", () => {
  for (const [name, row] of Object.entries(ROWS)) {
    it(name, () => {
      const policy = combatPolicy(viewFor(row.state, row.viewer), TEST_RULES, row.difficulty);
      expect(policy.commands).toEqual(row.commands);
      expect(policy.weights).toEqual(row.weights);
      if (row.ev === null) {
        expect(policy.ev).toBeNull();
      } else {
        expect(policy.ev).toHaveLength(row.ev.length);
        row.ev.forEach((value, i) => {
          expect(policy.ev?.[i]).toBeCloseTo(value, 6);
        });
      }
    });
  }

  it("Normal ignores choice history (same weights as the all-0 rows)", () => {
    for (const state of [STRIKE_20, GUARD_20]) {
      for (const [viewer, key] of [
        ["p1", "all0 p1 normal"],
        ["p2", "all0 p2 normal"],
      ] as const) {
        const policy = combatPolicy(viewFor(state, viewer), TEST_RULES, "normal");
        expect(policy.weights).toEqual(ROWS[key]?.weights);
      }
    }
  });

  it("Easy never reads the opponent (weights are the class bias)", () => {
    const view = viewFor(STRIKE_20, "p1");
    expect(combatPolicy(view, TEST_RULES, "easy").weights).toEqual([40, 40, 20]);
  });

  it("is deterministic and does not draw randomness", () => {
    const view = viewFor(ALL_ZERO, "p1");
    expect(combatPolicy(view, TEST_RULES, "hard")).toEqual(combatPolicy(view, TEST_RULES, "hard"));
  });

  it("uniform weights when a class bias is all zero", () => {
    const rules = JSON.parse(JSON.stringify(TEST_RULES)) as typeof TEST_RULES;
    const fighter = rules.classes.fighter;
    if (fighter === undefined) throw new Error("fixture");
    (fighter as { aiBias: unknown }).aiBias = {
      attack: 0,
      strike: 0,
      spell: 0,
      guard: 0,
      counter: 0,
      ward: 0,
    };
    const easy = combatPolicy(viewFor(ALL_ZERO, "p1"), rules, "easy");
    expect(easy.weights).toEqual([1, 1, 1]);
  });

  it("exposes the pinned tuning constants", () => {
    expect(AI_TUNING).toEqual({
      healThresholdBp: 3500,
      easyForgetHealBp: 3000,
      koBonus: 0.5,
      normalTemp: 0.15,
      hardTemp: 0.04,
      hardPriorStrength: 4,
      weightScale: 1_000_000,
    });
  });
});

describe("decideCombat goldens", () => {
  const CASES: [string, Difficulty, string, number[]][] = [
    ["p1", "easy", "strike", [3331102407, 1535445285, 772308753, 1112744324]],
    ["p1", "normal", "strike", [4183196888, 813986969, 677920980, 3243803346]],
    ["p1", "hard", "strike", [1366581972, 206714184, 2346612497, 1782913445]],
    ["p2", "easy", "counter", [3836409917, 3572200996, 801488308, 1210260529]],
    ["p2", "normal", "counter", [91016355, 297186996, 1934346612, 4099156348]],
    ["p2", "hard", "counter", [1549760109, 3612060378, 2996506608, 524471693]],
  ];
  for (const [viewer, difficulty, choice, rng] of CASES) {
    it(`${viewer} ${difficulty} chooses ${choice} and advances the rng`, () => {
      const ai = createAi("ai", viewer, difficulty);
      const result = decideCombat(viewFor(ALL_ZERO, viewer), TEST_RULES, ai);
      expect(result.action).toEqual({
        v: 2,
        type: "decision/commit",
        playerId: viewer,
        decisionId: "d1",
        choice,
      });
      expect([...result.ai.rng]).toEqual(rng);
      expect(result.ai.playerId).toBe(viewer);
      expect(result.ai.difficulty).toBe(difficulty);
    });

    it(`${viewer} ${difficulty} action is accepted by reduce`, () => {
      const result = decideCombat(
        viewFor(ALL_ZERO, viewer),
        TEST_RULES,
        createAi("ai", viewer, difficulty),
      );
      expect(reduce(ALL_ZERO, result.action, TEST_RULES).ok).toBe(true);
    });
  }

  it("seeds the rng from seed, player and difficulty", () => {
    expect(createAi("ai", "p1", "easy").rng).not.toEqual(createAi("ai", "p2", "easy").rng);
    expect(createAi("ai", "p1", "easy").rng).not.toEqual(createAi("ai", "p1", "hard").rng);
    expect(createAi("ai", "p1", "easy").rng).not.toEqual(createAi("other", "p1", "easy").rng);
  });

  it("never mutates its inputs", () => {
    const view = deepFreeze(structuredCloneView(viewFor(ALL_ZERO, "p1")));
    const ai = deepFreeze({ ...createAi("ai", "p1", "hard") });
    const rules = deepFreeze(JSON.parse(JSON.stringify(TEST_RULES)) as typeof TEST_RULES);
    expect(() => decideCombat(view, rules, ai)).not.toThrow();
  });
});

function need<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("missing fixture entry");
  return value;
}

function structuredCloneView(view: PlayerView): PlayerView {
  return JSON.parse(JSON.stringify(view)) as PlayerView;
}

describe("decideCombat null-return guards (one mutated field each)", () => {
  const view = viewFor(ALL_ZERO, "p1");
  const ai = createAi("ai", "p1", "hard");

  function expectNull(mutated: PlayerView): void {
    const result = decideCombat(mutated, TEST_RULES, ai);
    expect(result.action).toBeNull();
    expect(result.ai).toBe(ai);
  }

  it("the unmodified view produces an action (non-vacuous)", () => {
    expect(decideCombat(view, TEST_RULES, ai).action).not.toBeNull();
  });

  it("viewer has no private state", () => {
    expectNull({ ...view, self: null });
  });

  it("viewer has no prompt", () => {
    expectNull({ ...view, self: { ...need(view.self), prompt: null } });
  });

  it("pending is null", () => {
    expectNull({ ...view, public: { ...view.public, pending: null } });
  });

  it("the decision is a poll", () => {
    expectNull({
      ...view,
      public: { ...view.public, pending: { ...need(view.public.pending), kind: "poll" } },
    });
  });

  it("pending.id differs from the prompt's decisionId", () => {
    expectNull({
      ...view,
      public: { ...view.public, pending: { ...need(view.public.pending), id: "d99" } },
    });
  });

  it("the viewer has already committed", () => {
    expectNull({
      ...view,
      public: { ...view.public, pending: { ...need(view.public.pending), committed: ["p1"] } },
    });
  });

  it("there is no combat", () => {
    expectNull({ ...view, public: { ...view.public, combat: null } });
  });

  it("a spectator gets no action", () => {
    expectNull(viewFor(ALL_ZERO, "spectator"));
  });

  it("returns null after the viewer really committed", () => {
    const committed = applyAll(ALL_ZERO, [
      { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "attack" },
    ]).state;
    expectNull(viewFor(committed, "p1"));
  });
});

describe("heal rule", () => {
  const LOW = edited(ALL_ZERO, (json) => {
    need(json.public.characters.p1).hp = 10;
  });
  const SEEDS = Array.from({ length: 40 }, (_, i) => `heal-${String(i)}`);

  function choiceOf(state: GameState, viewer: string, seed: string, difficulty: Difficulty) {
    const result = decideCombat(
      viewFor(state, viewer),
      TEST_RULES,
      createAi(seed, viewer, difficulty),
    );
    if (result.action?.type !== "decision/commit") throw new Error("no commit");
    return result.action.choice;
  }

  it("Normal and Hard always heal a low-hp attacker who holds a heal item", () => {
    for (const seed of SEEDS) {
      expect(choiceOf(LOW, "p1", seed, "normal")).toBe("item:herb");
      expect(choiceOf(LOW, "p1", seed, "hard")).toBe("item:herb");
    }
  });

  it("Easy forgets sometimes: only item:herb or attack/strike/spell, both outcomes occur", () => {
    const choices = SEEDS.map((seed) => choiceOf(LOW, "p1", seed, "easy"));
    for (const choice of choices) {
      expect(["item:herb", "attack", "strike", "spell"]).toContain(choice);
    }
    expect(choices).toContain("item:herb");
    expect(choices.some((c) => c !== "item:herb")).toBe(true);
  });

  it("does not fire above the threshold (hp 40% of max)", () => {
    const state = edited(ALL_ZERO, (json) => {
      need(json.public.characters.p1).hp = 20; // 20/48 = 41.7% > 35%
    });
    for (const seed of SEEDS) {
      for (const d of ["easy", "normal", "hard"] as const) {
        expect(choiceOf(state, "p1", seed, d)).not.toMatch(/^item:/);
      }
    }
  });

  it("fires at exactly the threshold", () => {
    const state = edited(ALL_ZERO, (json) => {
      // maxHp 48: 48 * 3500 / 10000 = 16.8, so hp 16 is at or below and hp 17 is above
      need(json.public.characters.p1).hp = 16;
    });
    expect(choiceOf(state, "p1", "edge", "hard")).toBe("item:herb");
    const above = edited(ALL_ZERO, (json) => {
      need(json.public.characters.p1).hp = 17;
    });
    expect(choiceOf(above, "p1", "edge", "hard")).not.toMatch(/^item:/);
  });

  it("a full-hp attacker never picks an item and never flees", () => {
    for (const seed of SEEDS) {
      for (const d of ["easy", "normal", "hard"] as const) {
        const choice = choiceOf(ALL_ZERO, "p1", seed, d);
        expect(choice).not.toMatch(/^item:/);
        expect(choice).not.toBe("flee");
      }
    }
  });

  it("a low-hp defender never heals (defenders have no item options)", () => {
    const state = edited(ALL_ZERO, (json) => {
      need(json.public.characters.p2).hp = 3;
    });
    for (const seed of SEEDS) {
      expect(["guard", "counter", "ward"]).toContain(choiceOf(state, "p2", seed, "hard"));
    }
  });

  it("the healing commit is accepted by reduce", () => {
    const result = decideCombat(viewFor(LOW, "p1"), TEST_RULES, createAi("heal-0", "p1", "hard"));
    expect(reduce(LOW, result.action, TEST_RULES).ok).toBe(true);
  });
});

// ---- T4: AI branches --------------------------------------------------------------------------

/** The slice of a saved combat state the tests below edit. */
interface RawCombat {
  public: {
    characters: Record<string, { hp: number }>;
    combat: { sides: { mods: { stun: boolean } }[] };
    pending: { required: string[] };
  };
  private: Record<string, { bag: string[]; prompt: unknown }>;
}

function rawEdit(state: GameState, rules: Rules, edit: (json: RawCombat) => void): GameState {
  const json = JSON.parse(serialize(state)) as RawCombat;
  edit(json);
  return deserialize(JSON.stringify(json), rules);
}

/** Heal items of known sizes. At maxHp 48: herb 14, big 28, exact 32, super 38, elixir 48. */
const HEAL_RULES = craft((r) => {
  const heal = (id: string, bp: number) => ({
    id,
    kind: "consumable" as const,
    price: 1,
    use: "both" as const,
    effect: { kind: "heal" as const, bp },
  });
  for (const [id, bp] of [
    ["herb-b", 3000],
    ["big", 6000],
    ["big-b", 6000],
    ["exact", 6667],
    ["super", 8000],
    ["elixir", 10000],
    ["elixir-b", 10000],
  ] as const) {
    r.items[id] = heal(id, bp);
  }
});

function healPick(rules: Rules, hp: number, bag: string[]): string {
  const base = applyAll(createGame(SETTINGS, rules), [START], rules).state;
  const state = rawEdit(base, rules, (json) => {
    need(json.public.characters.p1).hp = hp;
    need(json.private.p1).bag = bag;
    // the open prompt lists the bag's items, so keep it in step with the new bag
    const prompt = need(json.private.p1).prompt as { options: string[] };
    prompt.options = [
      ...prompt.options.filter((o) => !o.startsWith("item:")),
      ...[...new Set(bag)].map((id) => `item:${id}`),
    ];
  });
  const result = decideCombat(viewFor(state, "p1"), rules, createAi("heal-pick", "p1", "hard"));
  if (result.action?.type !== "decision/commit") throw new Error("no commit");
  return result.action.choice;
}

describe("heal rule: which heal item (step 2), maxHp 48 and hp 16 so 32 hp are missing", () => {
  it("picks the smallest heal that covers the missing hp (not the first or the largest)", () => {
    // elixir 48, super 38 and herb 14: super is the smallest that covers 32
    expect(healPick(HEAL_RULES, 16, ["elixir", "super", "herb"])).toBe("item:super");
  });

  it("a heal of exactly the missing hp covers it (amount >= missing)", () => {
    // exact heals floor(48 x 6667 / 10000) = 32 = missing; elixir 48 also covers
    expect(healPick(HEAL_RULES, 16, ["elixir", "exact", "herb"])).toBe("item:exact");
  });

  it("when none covers, picks the largest heal", () => {
    // herb 14 and big 28 both fall short of 32
    expect(healPick(HEAL_RULES, 16, ["herb", "big"])).toBe("item:big");
  });

  it("ties between covering heals go to the earlier option", () => {
    expect(healPick(HEAL_RULES, 16, ["elixir", "elixir-b"])).toBe("item:elixir");
  });

  it("ties between non-covering heals go to the earlier option", () => {
    expect(healPick(HEAL_RULES, 16, ["big", "big-b"])).toBe("item:big");
  });

  it("ignores a non-heal item in the bag", () => {
    expect(healPick(HEAL_RULES, 16, ["bomb", "herb"])).toBe("item:herb");
  });
});

describe("heal rule threshold at maxHp 100 (hp x 10000 <= maxHp x healThresholdBp)", () => {
  // baseStats.hp 100 and neutral class/gear hp multipliers make the fighter's max hp exactly 100
  const HUNDRED = craft((r) => {
    r.progression.baseStats = { ...r.progression.baseStats, hp: 100 };
    r.progression.growth = { ...r.progression.growth, hp: 0 };
    for (const cls of Object.values(r.classes)) cls.statBp = { ...cls.statBp, hp: 10000 };
  });
  const maxHp = (): number => {
    const p1 = need(createGame(SETTINGS, HUNDRED).public.characters.p1);
    return snapshotPlayer(HUNDRED, p1, {
      atk: 0,
      def: 0,
      mag: 0,
      spd: 0,
      poison: false,
      stun: false,
    }).maxHp;
  };

  it("the fixture really has maxHp 100 and threshold 35%", () => {
    expect(maxHp()).toBe(100);
    expect(AI_TUNING.healThresholdBp).toBe(3500);
  });

  it.each([
    [34, true],
    [35, true], // 35 x 10000 = 100 x 3500: equality fires
    [36, false],
  ])("hp %i heals: %s", (hp, heals) => {
    const choice = healPick(HUNDRED, hp, ["herb"]);
    expect(choice === "item:herb").toBe(heals);
  });
});

describe("a stunned opponent defender is modelled as the single defence 'open' (step 5)", () => {
  const stunned = rawEdit(ALL_ZERO, TEST_RULES, (json) => {
    need(json.public.combat.sides[1]).mods.stun = true;
    json.public.pending.required = ["p1"]; // a stunned defender is not asked
    need(json.private.p2).prompt = null;
  });

  /** Spec step 6 `val(a, open)` for the viewer p1 attacking, written out independently. */
  function expected(command: AttackCommand): number {
    const view = viewFor(stunned, "p1");
    const [side0, side1] = need(view.public.combat).sides;
    const att = snapshotPlayer(TEST_RULES, need(view.public.characters.p1), side0.mods);
    const def = snapshotPlayer(TEST_RULES, need(view.public.characters.p2), side1.mods);
    const p = isCritEligible(command, "open") ? critChanceBp(TEST_RULES, att) / 10000 : 0;
    const r0 = computeCell(TEST_RULES.combat, att, def, command, "open", false);
    const r1 = p > 0 ? computeCell(TEST_RULES.combat, att, def, command, "open", true) : r0;
    const mix = (a: number, b: number): number => (1 - p) * a + p * b;
    const toDef = mix(r0.toDefender, r1.toDefender);
    const toAtt = mix(r0.toAttacker, r1.toAttacker);
    const healAtt = mix(r0.healAttacker, r1.healAttacker);
    const healDef = mix(r0.healDefender, r1.healDefender);
    return (
      (Math.min(toDef, def.hp) - healDef) / def.maxHp -
      (Math.min(toAtt, att.hp) - healAtt) / att.maxHp +
      (toDef >= def.hp ? AI_TUNING.koBonus : 0) -
      (toAtt >= att.hp ? AI_TUNING.koBonus : 0)
    );
  }

  it.each(["normal", "hard"] as const)(
    "%s: ev is val(command, open) for each attack",
    (difficulty) => {
      const policy = combatPolicy(viewFor(stunned, "p1"), TEST_RULES, difficulty);
      expect(policy.commands).toEqual(["attack", "strike", "spell"]);
      policy.commands.forEach((command, i) => {
        expect(policy.ev?.[i]).toBeCloseTo(expected(command as AttackCommand), 9);
      });
    },
  );

  it("differs from the unstunned model (non-vacuous)", () => {
    const open = combatPolicy(viewFor(stunned, "p1"), TEST_RULES, "hard").ev;
    const normal = combatPolicy(viewFor(ALL_ZERO, "p1"), TEST_RULES, "hard").ev;
    expect(open).not.toEqual(normal);
  });
});
