// Sim stdout goldens (spec: Sim goldens; content rules; outcomes only, so reward-independent),
// determinism, --json, matchup grammar, kits and the duel runner's seating/level rules. No
// assertion here reads DuelResult.events or DuelResult.hash (reward coupling: the W3 closing step).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadRules } from "@usurpia/content/node";
import type { Action, GameEvent, GameSettings } from "@usurpia/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({
  settings: [] as unknown[],
  actions: [] as unknown[],
  events: [] as unknown[],
}));

vi.mock("@usurpia/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@usurpia/core")>();
  return {
    ...actual,
    createGame: (settings: GameSettings, rules: import("@usurpia/core").Rules) => {
      seen.settings.push(settings);
      return actual.createGame(settings, rules);
    },
    reduce: (state: unknown, action: unknown, rules: import("@usurpia/core").Rules) => {
      const result = actual.reduce(state as never, action, rules);
      seen.actions.push(action);
      if (result.ok) seen.events.push(...result.events);
      return result;
    },
  };
});

const { buildMatchups, runDuel, UsageError } = await import("../src/duel");
const { KITS, seatClass, TIER_LEVEL, tierForLevel } = await import("../src/kits");

const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const rules = loadRules();

function runCli(...args: string[]) {
  return spawnSync(process.execPath, [tsxCli, cliPath, ...args], {
    encoding: "utf8",
    cwd: repoRoot,
  });
}

const MIRRORS_BLOCK = `duel n=60 seed=golden level=5 difficulty=hard:easy rules=84a995db
# class-vs-class
cleric:cleric n=10 a=7 b=2 draw=1 fled=0 aRate=0.778
mage:mage n=10 a=5 b=0 draw=5 fled=0 aRate=1.000
shadowpriest:shadowpriest n=10 a=6 b=1 draw=3 fled=0 aRate=0.857
spellblade:spellblade n=10 a=9 b=1 draw=0 fled=0 aRate=0.900
thief:thief n=10 a=6 b=3 draw=1 fled=0 aRate=0.667
warrior:warrior n=10 a=9 b=1 draw=0 fled=0 aRate=0.900
total n=60 a=42 b=8 draw=10 fled=0
`;

describe("sim duel stdout goldens", () => {
  it("prints the mirrors block byte for byte", () => {
    const result = runCli(
      "duel",
      "--n",
      "60",
      "--matchup",
      "mirrors",
      "--difficulty",
      "hard:easy",
      "--seed",
      "golden",
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(MIRRORS_BLOCK);
  });

  it("ends the classes report with the pinned total", () => {
    const result = runCli("duel", "--n", "36", "--matchup", "classes", "--seed", "golden");
    expect(result.status).toBe(0);
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe("total n=36 a=14 b=11 draw=11 fled=0");
  });

  it("ends the CI smoke report with the pinned total and has both sections", () => {
    const result = runCli("duel", "--n", "264", "--seed", "ci");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# class-vs-class");
    expect(result.stdout).toContain("# class-vs-monster");
    expect(result.stdout.trimEnd().split("\n").at(-1)).toBe(
      "total n=264 a=154 b=57 draw=51 fled=2",
    );
  });

  it("is byte-identical across runs", () => {
    const args = ["duel", "--n", "60", "--matchup", "mirrors", "--seed", "again"];
    expect(runCli(...args).stdout).toBe(runCli(...args).stdout);
  });

  it("prints timing on stderr only", () => {
    const result = runCli("duel", "--n", "6", "--matchup", "mirrors");
    expect(result.stderr).toMatch(/^elapsed_ms=\d+\n$/);
    expect(result.stdout).not.toContain("elapsed_ms");
  });

  it("--json prints one stableStringify line with the spec keys", () => {
    const result = runCli("duel", "--n", "12", "--matchup", "mirrors", "--json");
    expect(result.status).toBe(0);
    const lines = result.stdout.split("\n").filter((line) => line !== "");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0] ?? "") as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(
      ["difficulty", "level", "matchups", "n", "rulesHash", "seed"].sort(),
    );
    expect(parsed.rulesHash).toBe("84a995db");
    expect(parsed.n).toBe(12);
    expect(parsed.seed).toBe("usurpia");
    expect(parsed.level).toBe(5);
    expect(parsed.difficulty).toEqual(["normal", "normal"]);
    const matchups = parsed.matchups as Record<string, unknown>[];
    expect(matchups).toHaveLength(6);
    expect(Object.keys(matchups[0] ?? {}).sort()).toEqual(
      ["a", "aWins", "b", "bWins", "draws", "fled", "n"].sort(),
    );
    expect(matchups.reduce((sum, m) => sum + Number(m.n), 0)).toBe(12);
  });

  it("omits matchups that ran no duel", () => {
    const result = runCli("duel", "--n", "2", "--matchup", "mirrors");
    expect(result.stdout).toContain("cleric:cleric n=1");
    expect(result.stdout).toContain("mage:mage n=1");
    expect(result.stdout).not.toContain("warrior:warrior");
  });

  it("prints aRate=n/a exactly when a matchup had no decisive duel (draw only)", () => {
    // Seed "na5" makes the single mage:mage duel a draw (a=0, b=0, draw=1).
    const result = runCli("duel", "--n", "1", "--matchup", "mage:mage", "--seed", "na5");
    expect(result.status).toBe(0);
    expect(result.stdout.split("\n")).toContain("mage:mage n=1 a=0 b=0 draw=1 fled=0 aRate=n/a");
  });

  it("prints a numeric aRate when a duel was decisive", () => {
    const result = runCli("duel", "--n", "1", "--matchup", "mage:mage", "--seed", "usurpia");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^mage:mage n=1 a=[01] b=[01] draw=0 fled=0 aRate=[01]\.000$/m);
  });
});

describe("buildMatchups", () => {
  it("has the spec sizes", () => {
    expect(buildMatchups(rules, "classes")).toHaveLength(36);
    expect(buildMatchups(rules, "mirrors")).toHaveLength(6);
    expect(buildMatchups(rules, "monsters")).toHaveLength(96);
    expect(buildMatchups(rules, "all")).toHaveLength(132);
  });

  it("orders ids ascending, classes before monsters", () => {
    const all = buildMatchups(rules, "all");
    expect(
      all.slice(0, 3).map((m) => `${m.a}:${m.b.kind === "class" ? m.b.classId : "?"}`),
    ).toEqual(["cleric:cleric", "cleric:mage", "cleric:shadowpriest"]);
    expect(all[36]?.group).toBe("class-vs-monster");
    expect(all.slice(0, 36).every((m) => m.group === "class-vs-class")).toBe(true);
  });

  it("parses explicit pairs", () => {
    expect(buildMatchups(rules, "warrior:mage")).toEqual([
      { a: "warrior", b: { kind: "class", classId: "mage" }, group: "class-vs-class" },
    ]);
    expect(buildMatchups(rules, "spellblade:monster/ogre-middle-manager")).toEqual([
      {
        a: "spellblade",
        b: { kind: "monster", monsterId: "ogre-middle-manager" },
        group: "class-vs-monster",
      },
    ]);
  });

  it("rejects unknown names and malformed specs with UsageError", () => {
    for (const bad of [
      "wizard:mage",
      "warrior:wizard",
      "warrior:monster/nope",
      "warrior",
      "a:b:c",
      "warrior:mage:thief",
      "toString:mage",
      "warrior:toString",
      "warrior:monster/constructor",
      "",
    ]) {
      expect(() => buildMatchups(rules, bad), bad).toThrow(UsageError);
    }
  });
});

describe("kits", () => {
  it("maps level to kit tier at the boundaries", () => {
    expect([1, 4, 5, 8, 9, 12, 13, 20].map(tierForLevel)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(TIER_LEVEL).toEqual([1, 5, 9, 13]);
  });

  it("has four tiers for each shipped class", () => {
    for (const id of Object.keys(rules.classes)) expect(KITS[id]).toHaveLength(4);
  });

  it("references only shipped content", () => {
    for (const rows of Object.values(KITS)) {
      for (const row of rows) {
        expect(rules.gear).toHaveProperty(row.weapon ?? "wooden-sword");
        expect(rules.gear).toHaveProperty(row.shield ?? "pot-lid");
        if (row.accessory !== null) expect(rules.gear).toHaveProperty(row.accessory);
        if (row.battleSpell !== null) expect(rules.battleSpells).toHaveProperty(row.battleSpell);
        if (row.wardSpell !== null) expect(rules.wardSpells).toHaveProperty(row.wardSpell);
      }
    }
  });

  it("seats a hybrid as parents[0] and a base class as itself", () => {
    expect(seatClass(rules, "warrior")).toBe("warrior");
    for (const id of ["spellblade", "shadowpriest"]) {
      expect(seatClass(rules, id)).toBe(rules.classes[id]?.parents?.[0]);
    }
    expect(() => seatClass(rules, "nope")).toThrow();
  });
});

describe("runDuel", () => {
  beforeEach(() => {
    seen.settings.length = 0;
    seen.actions.length = 0;
    seen.events.length = 0;
  });

  it("seats a hybrid as its first parent, then setCharacter carries the hybrid class", () => {
    runDuel(rules, {
      seed: "hybrid",
      a: { classId: "spellblade", difficulty: "hard" },
      b: { kind: "class", classId: "shadowpriest", difficulty: "easy" },
      level: 5,
    });
    const settings = seen.settings[0] as GameSettings;
    expect(settings.players).toEqual([
      { id: "a", classId: rules.classes.spellblade?.parents?.[0] },
      { id: "b", classId: rules.classes.shadowpriest?.parents?.[0] },
    ]);
    const sets = seen.actions.filter(
      (a): a is Extract<Action, { type: "system/setCharacter" }> =>
        (a as Action).type === "system/setCharacter",
    );
    expect(sets.map((a) => [a.target, a.classId])).toEqual([
      ["a", "spellblade"],
      ["b", "shadowpriest"],
    ]);
    const characterSets = (seen.events as GameEvent[]).filter((e) => e.type === "CharacterSet");
    expect(characterSets).toHaveLength(2);
  });

  it("gives both fighters the tier kit for the level and a two-herb bag", () => {
    runDuel(rules, {
      seed: "kit",
      a: { classId: "mage", difficulty: "normal" },
      b: { kind: "class", classId: "thief", difficulty: "normal" },
      level: 9,
    });
    const sets = seen.actions.filter(
      (a): a is Extract<Action, { type: "system/setCharacter" }> =>
        (a as Action).type === "system/setCharacter",
    );
    expect(sets[0]).toMatchObject({
      target: "a",
      classId: "mage",
      level: 9,
      weapon: "bronze-blade",
      shield: "mirror-shield",
      accessory: "mage-ring",
      battleSpell: "thunderclap",
      wardSpell: "reflect",
      bag: ["herb", "herb"],
    });
    expect(sets[1]).toMatchObject({ target: "b", classId: "thief", weapon: "goblin-cleaver" });
  });

  it("fights every monster at the level of its tier", () => {
    for (const [id, monster] of Object.entries(rules.monsters)) {
      seen.settings.length = 0;
      seen.actions.length = 0;
      const result = runDuel(rules, {
        seed: `tier/${id}`,
        a: { classId: "warrior", difficulty: "normal" },
        b: { kind: "monster", monsterId: id },
        level: 5,
      });
      expect((seen.settings[0] as GameSettings).players).toHaveLength(1);
      const set = seen.actions.find((a) => (a as Action).type === "system/setCharacter") as Extract<
        Action,
        { type: "system/setCharacter" }
      >;
      expect(set.level).toBe(TIER_LEVEL[monster.tier - 1]);
      expect(["ko", "fled", "draw"]).toContain(result.outcome);
    }
  });

  it("is deterministic for the same spec", () => {
    const spec = {
      seed: "same",
      a: { classId: "cleric", difficulty: "hard" as const },
      b: { kind: "class" as const, classId: "cleric", difficulty: "easy" as const },
      level: 5,
    };
    expect(runDuel(rules, spec)).toEqual(runDuel(rules, spec));
  });

  it("reports outcome, winner and fled consistently", () => {
    for (let i = 0; i < 30; i++) {
      const result = runDuel(rules, {
        seed: `shape/${String(i)}`,
        a: { classId: "thief", difficulty: "normal" },
        b: { kind: "class", classId: "warrior", difficulty: "normal" },
        level: 5,
      });
      if (result.outcome === "ko") {
        expect([0, 1]).toContain(result.winner);
        expect(result.fled).toBeNull();
      } else if (result.outcome === "draw") {
        expect(result.winner).toBeNull();
        expect(result.fled).toBeNull();
      } else {
        expect(result.winner).toBeNull();
        expect([0, 1]).toContain(result.fled);
      }
    }
  });
});
