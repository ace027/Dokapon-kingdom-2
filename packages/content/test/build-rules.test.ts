import { rulesHash } from "@usurpia/core";
import { describe, expect, it } from "vitest";
import { buildRules } from "../src/index";
import type { ContentEntry, ContentError } from "../src/index";
import { loadEntries, mutateEntry, readPath, removeKey, setPath, updatePath } from "./helpers";

const base = loadEntries();
const CLASSES = "classes.json";
const MONSTERS = "monsters.json";
const TUNING = "tuning.json";

function errorsOf(entries: readonly ContentEntry[]): ContentError[] {
  const result = buildRules(entries);
  if (result.ok) throw new Error("expected content errors, got ok");
  return result.errors;
}

const err = (file: string, path: string, message: string): ContentError => ({
  file,
  path,
  message,
});

/** Sets an array to `n` elements (drops from the end, or repeats the last element). */
const resize = (n: number) => (old: unknown) => {
  const list = old as unknown[];
  return Array.from({ length: n }, (_v, i) => list[Math.min(i, list.length - 1)]);
};
const dropLast = (old: unknown) => (old as unknown[]).slice(0, -1);
const withPush = (extra: unknown) => (old: unknown) => [...(old as unknown[]), extra];

describe("buildRules: the unmutated content", () => {
  it("is valid", () => {
    expect(buildRules(base).ok).toBe(true);
  });

  it("does not modify its input", () => {
    const before = JSON.stringify(base);
    buildRules(base);
    expect(JSON.stringify(base)).toBe(before);
  });

  it("keeps rulesHash equal when only display text changes", () => {
    const changed = mutateEntry(base, CLASSES, (root) => {
      const [first] = root.classes as { name: string; passives: { description: string }[] }[];
      if (first === undefined) throw new Error("no classes");
      first.name = "Renamed";
      const [passive] = first.passives;
      if (passive === undefined) throw new Error("no passives");
      passive.description = "Different words.";
    });
    const result = buildRules(changed);
    expect(result.ok && rulesHash(result.rules)).toBe("84a995db");
  });
});

describe("buildRules: file-set stage", () => {
  it("reports a missing file and skips every later stage", () => {
    const entries = setPath(
      base.filter((entry) => entry.file !== "gear.json"),
      CLASSES,
      "v",
      2,
    );
    expect(errorsOf(entries)).toEqual([err("gear.json", "", "missing required content file")]);
  });

  it("reports an unknown file", () => {
    expect(errorsOf([...base, { file: "extra.json", data: {} }])).toEqual([
      err("extra.json", "", "unknown content file (not in CONTENT_REGISTRY)"),
    ]);
  });

  it("does not treat Object.prototype members as registered files", () => {
    expect(errorsOf([...base, { file: "constructor", data: {} }])).toEqual([
      err("constructor", "", "unknown content file (not in CONTENT_REGISTRY)"),
    ]);
  });

  it("reports invalid JSON (data undefined)", () => {
    const entries = base.map((e) =>
      e.file === "spells.json" ? { file: e.file, data: undefined } : e,
    );
    expect(errorsOf(entries)).toEqual([err("spells.json", "", "invalid JSON")]);
  });
});

describe("buildRules: schema stage", () => {
  const cases: [string, ContentEntry[], ContentError][] = [
    [
      "an unknown key",
      setPath(base, CLASSES, "classes.0.extra", 1),
      err(CLASSES, "classes.0", 'Unrecognized key: "extra"'),
    ],
    [
      "a wrong type",
      setPath(base, "gear.json", "gear.0.price", "free"),
      err("gear.json", "gear.0.price", "Invalid input: expected number, received string"),
    ],
    [
      "an out-of-range int",
      setPath(base, CLASSES, "classes.0.bagSize", 17),
      err(CLASSES, "classes.0.bagSize", "Too big: expected number to be <=16"),
    ],
    [
      "a fractional int",
      setPath(base, "gear.json", "gear.0.price", 1.5),
      err("gear.json", "gear.0.price", "Invalid input: expected int, received number"),
    ],
    [
      "a bad id pattern",
      setPath(base, "items.json", "items.0.id", "Bad Id"),
      err("items.json", "items.0.id", "id must be kebab-case, start with a letter, max 48 chars"),
    ],
    [
      "the reserved id constructor (item)",
      setPath(base, "items.json", "items.0.id", "constructor"),
      err("items.json", "items.0.id", "reserved id"),
    ],
    [
      "the reserved id prototype (class)",
      setPath(base, CLASSES, "classes.0.id", "prototype"),
      err(CLASSES, "classes.0.id", "reserved id"),
    ],
    [
      "a style key on the enforcer",
      setPath(base, MONSTERS, "enforcer.style", "magic"),
      err(MONSTERS, "enforcer", 'Unrecognized key: "style"'),
    ],
    [
      "a missing stat key",
      removeKey(base, CLASSES, "classes.0.statBp.luck"),
      err(CLASSES, "classes.0.statBp.luck", "Invalid input: expected number, received undefined"),
    ],
    [
      "an unsupported file version",
      setPath(base, TUNING, "v", 2),
      err(TUNING, "v", "Invalid input: expected 1"),
    ],
    [
      "an unknown hook name",
      setPath(base, "gear.json", "gear.8.hooks.0.hook", "nopeBp"),
      err(
        "gear.json",
        "gear.8.hooks.0.hook",
        'Invalid option: expected one of "hpBp"|"atkBp"|"defBp"|"magBp"|"spdBp"|"luckBp"|"attackDmgBp"|"strikeDmgBp"|"spellDmgBp"|"guardVsStrikeBp"|"counterDmgBp"|"wardReflectBp"|"critBp"|"fleeBp"|"lifestealBp"|"roundRegenBp"|"spellTakenBp"|"physTakenBp"|"spellbladeStrike"|"poisonOnHit"|"stealGoldOnHitBp"|"stealItemOnHit"|"pvpExtraSteal"|"passPickpocketBp"|"spellPriceBp"|"fieldSpellMove"|"turnRegenBp"|"townTaxBp"|"crownTaxResistBp"|"lootLuckBp"',
      ),
    ],
    [
      "curve hp of 0",
      setPath(base, MONSTERS, "curve.0.hp", 0),
      err(MONSTERS, "curve.0.hp", "Too small: expected number to be >=1"),
    ],
    [
      "maxRounds above 10",
      setPath(base, TUNING, "combat.maxRounds", 11),
      err(TUNING, "combat.maxRounds", "Too big: expected number to be <=10"),
    ],
  ];

  it.each(cases)("rejects %s with exactly one error", (_label, entries, expected) => {
    expect(errorsOf(entries)).toEqual([expected]);
  });

  it("stops after schema errors: a schema error plus a cross-ref error yields only the schema error", () => {
    const entries = setPath(
      setPath(base, CLASSES, "classes.0.extra", 1),
      MONSTERS,
      "monsters.0.zone",
      "nowhere",
    );
    expect(errorsOf(entries)).toEqual([err(CLASSES, "classes.0", 'Unrecognized key: "extra"')]);
  });

  it("stops after duplicate ids: a duplicate plus a cross-ref error yields only the duplicate", () => {
    const entries = setPath(
      setPath(base, "gear.json", "gear.1.id", "wooden-sword"),
      MONSTERS,
      "monsters.0.zone",
      "nowhere",
    );
    expect(errorsOf(entries)).toEqual([
      err("gear.json", "gear.1.id", 'duplicate id "wooden-sword" (first at gear.0)'),
    ]);
  });
});

describe("buildRules: duplicate ids per collection", () => {
  const collections: [string, string, string][] = [
    [CLASSES, "classes", "classes"],
    ["gear.json", "gear", "gear"],
    ["items.json", "items", "items"],
    ["spells.json", "battle", "battle"],
    ["spells.json", "ward", "ward"],
    ["spells.json", "field", "field"],
    [MONSTERS, "monsters", "monsters"],
    [MONSTERS, "guardians", "guardians"],
  ];

  it.each(collections)("%s %s reports the later occurrence", (file, collection) => {
    const first = readPath(base, file, `${collection}.0.id`) as string;
    const entries = setPath(base, file, `${collection}.1.id`, first);
    expect(errorsOf(entries)).toEqual([
      err(file, `${collection}.1.id`, `duplicate id "${first}" (first at ${collection}.0)`),
    ]);
  });
});

interface RefCase {
  readonly rule: string;
  readonly entries: ContentEntry[];
  readonly error: ContentError;
}

const BAD = "no-such-id";
const attackless = { attack: 0, strike: 0, spell: 0, flee: 0 };
const defendless = { guard: 0, counter: 0, ward: 0 };

/** One mutation and one expected error per cross-reference rule. */
const refCases: RefCase[] = [
  {
    rule: "no base class",
    entries: setPath(base, CLASSES, "classes", []),
    error: err(CLASSES, "classes", "at least one base class is required"),
  },
  {
    rule: "base class with parents",
    entries: setPath(base, CLASSES, "classes.0.parents", ["warrior", "mage"]),
    error: err(CLASSES, "classes.0.parents", "base class must not have parents"),
  },
  {
    rule: "base class without starter",
    entries: setPath(base, CLASSES, "classes.0.starter", null),
    error: err(CLASSES, "classes.0.starter", "base class requires a starter loadout"),
  },
  {
    rule: "hybrid without parents",
    entries: setPath(base, CLASSES, "classes.4.parents", null),
    error: err(CLASSES, "classes.4.parents", "hybrid class requires parents"),
  },
  {
    rule: "hybrid parents equal",
    entries: setPath(base, CLASSES, "classes.4.parents", ["warrior", "warrior"]),
    error: err(CLASSES, "classes.4.parents.1", "hybrid parents must be two distinct base classes"),
  },
  {
    rule: "hybrid parent unknown (pattern-valid id, PIT-002)",
    entries: setPath(base, CLASSES, "classes.4.parents.1", "tostring"),
    error: err(CLASSES, "classes.4.parents.1", "hybrid parent must be an existing class"),
  },
  {
    rule: "hybrid parent is itself a hybrid",
    entries: setPath(base, CLASSES, "classes.4.parents", ["warrior", "shadowpriest"]),
    error: err(CLASSES, "classes.4.parents.1", "hybrid parent must be a base class"),
  },
  {
    rule: "hybrid with a starter",
    entries: setPath(
      base,
      CLASSES,
      "classes.4.starter",
      readPath(base, CLASSES, "classes.0.starter"),
    ),
    error: err(CLASSES, "classes.4.starter", "hybrid class must not have a starter"),
  },
  {
    rule: "passives length",
    entries: updatePath(base, CLASSES, "classes.0.passives", dropLast),
    error: err(CLASSES, "classes.0.passives", "passives must have exactly 5 entries"),
  },
  {
    rule: "passive rank",
    entries: setPath(base, CLASSES, "classes.0.passives.2.rank", 4),
    error: err(CLASSES, "classes.0.passives.2.rank", "passive rank must equal its position + 1"),
  },
  {
    rule: "starter weapon unknown",
    entries: setPath(base, CLASSES, "classes.0.starter.weapon", BAD),
    error: err(CLASSES, "classes.0.starter.weapon", "starter weapon must be an existing gear id"),
  },
  {
    rule: "starter shield unknown",
    entries: setPath(base, CLASSES, "classes.0.starter.shield", BAD),
    error: err(CLASSES, "classes.0.starter.shield", "starter shield must be an existing gear id"),
  },
  {
    rule: "starter accessory unknown",
    entries: setPath(base, CLASSES, "classes.1.starter.accessory", BAD),
    error: err(
      CLASSES,
      "classes.1.starter.accessory",
      "starter accessory must be an existing gear id",
    ),
  },
  {
    rule: "starter weapon in the wrong slot",
    entries: setPath(base, CLASSES, "classes.0.starter.weapon", "pot-lid"),
    error: err(CLASSES, "classes.0.starter.weapon", "starter weapon must be a weapon"),
  },
  {
    rule: "starter shield in the wrong slot",
    entries: setPath(base, CLASSES, "classes.0.starter.shield", "wooden-sword"),
    error: err(CLASSES, "classes.0.starter.shield", "starter shield must be a shield"),
  },
  {
    rule: "starter accessory in the wrong slot",
    entries: setPath(base, CLASSES, "classes.1.starter.accessory", "pot-lid"),
    error: err(CLASSES, "classes.1.starter.accessory", "starter accessory must be an accessory"),
  },
  {
    rule: "starter battle spell unknown",
    entries: setPath(base, CLASSES, "classes.0.starter.battleSpell", BAD),
    error: err(
      CLASSES,
      "classes.0.starter.battleSpell",
      "starter battle spell must be an existing battle spell",
    ),
  },
  {
    rule: "starter ward spell unknown",
    entries: setPath(base, CLASSES, "classes.2.starter.wardSpell", BAD),
    error: err(
      CLASSES,
      "classes.2.starter.wardSpell",
      "starter ward spell must be an existing ward spell",
    ),
  },
  {
    rule: "starter bag item unknown",
    entries: setPath(base, CLASSES, "classes.0.starter.bag.0", BAD),
    error: err(CLASSES, "classes.0.starter.bag.0", "starter bag item must be an existing item"),
  },
  {
    rule: "starter bag larger than bagSize",
    entries: updatePath(base, CLASSES, "classes.0.starter.bag", resize(6)),
    error: err(CLASSES, "classes.0.starter.bag", "starter bag exceeds bagSize"),
  },
  {
    rule: "aiBias attack side is zero",
    entries: mutateEntry(base, CLASSES, (root) => {
      root.classes = (root.classes as { aiBias: Record<string, number> }[]).map((c, i) =>
        i === 0 ? { ...c, aiBias: { ...c.aiBias, attack: 0, strike: 0, spell: 0 } } : c,
      );
    }),
    error: err(CLASSES, "classes.0.aiBias", "aiBias attack+strike+spell must be greater than 0"),
  },
  {
    rule: "aiBias defend side is zero",
    entries: mutateEntry(base, CLASSES, (root) => {
      root.classes = (root.classes as { aiBias: Record<string, number> }[]).map((c, i) =>
        i === 0 ? { ...c, aiBias: { ...c.aiBias, guard: 0, counter: 0, ward: 0 } } : c,
      );
    }),
    error: err(CLASSES, "classes.0.aiBias", "aiBias guard+counter+ward must be greater than 0"),
  },
  {
    rule: "npc battleSpell unknown",
    entries: setPath(base, MONSTERS, "monsters.0.battleSpell", BAD),
    error: err(
      MONSTERS,
      "monsters.0.battleSpell",
      "npc battleSpell must be an existing battle spell",
    ),
  },
  {
    rule: "npc wardSpell unknown",
    entries: setPath(base, MONSTERS, "monsters.0.wardSpell", BAD),
    error: err(MONSTERS, "monsters.0.wardSpell", "npc wardSpell must be an existing ward spell"),
  },
  {
    rule: "attackTable.spell > 0 without a battleSpell",
    entries: setPath(base, MONSTERS, "monsters.0.battleSpell", null),
    error: err(
      MONSTERS,
      "monsters.0.attackTable.spell",
      "attackTable.spell must be 0 when battleSpell is null",
    ),
  },
  {
    rule: "attack table sums to 0",
    entries: setPath(base, MONSTERS, "monsters.0.attackTable", attackless),
    error: err(MONSTERS, "monsters.0.attackTable", "attackTable must sum to more than 0"),
  },
  {
    rule: "defend table sums to 0",
    entries: setPath(base, MONSTERS, "monsters.0.defendTable", defendless),
    error: err(MONSTERS, "monsters.0.defendTable", "defendTable must sum to more than 0"),
  },
  {
    rule: "npc sheet-stat hook (monster)",
    entries: setPath(base, MONSTERS, "monsters.15.hooks", [{ hook: "atkBp", value: 1000 }]),
    error: err(MONSTERS, "monsters.15.hooks.0.hook", "npc sheet-stat hooks are not applied"),
  },
  {
    rule: "monster zone",
    entries: setPath(base, MONSTERS, "monsters.0.zone", "nowhere"),
    error: err(MONSTERS, "monsters.0.zone", "monster zone must be one of the four zones"),
  },
  {
    rule: "enforcer id",
    entries: setPath(base, MONSTERS, "enforcer.id", "not-the-enforcer"),
    error: err(MONSTERS, "enforcer.id", "enforcer id must be crown-enforcer"),
  },
  {
    rule: "curve length",
    entries: updatePath(base, MONSTERS, "curve", dropLast),
    error: err(MONSTERS, "curve", "curve must have exactly 5 tiers"),
  },
  {
    rule: "xpCurve length",
    entries: updatePath(base, TUNING, "progression.xpCurve", dropLast),
    error: err(TUNING, "progression.xpCurve", "xpCurve length must equal maxLevel"),
  },
  {
    rule: "xpCurve[0]",
    entries: setPath(base, TUNING, "progression.xpCurve.0", 1),
    error: err(TUNING, "progression.xpCurve.0", "xpCurve[0] must be 0"),
  },
  {
    rule: "xpCurve strictly increasing",
    entries: setPath(base, TUNING, "progression.xpCurve.5", 500),
    error: err(TUNING, "progression.xpCurve.5", "xpCurve must be strictly increasing"),
  },
  {
    rule: "xpCurve above MAX_COUNTER",
    entries: setPath(base, TUNING, "progression.xpCurve.19", 2 ** 31),
    error: err(TUNING, "progression.xpCurve.19", "xpCurve values must not exceed MAX_COUNTER"),
  },
  {
    rule: "masteryWins length",
    entries: updatePath(base, TUNING, "progression.masteryWins", withPush(25)),
    error: err(TUNING, "progression.masteryWins", "masteryWins must have exactly 5 entries"),
  },
  {
    rule: "masteryWins[0]",
    entries: setPath(base, TUNING, "progression.masteryWins.0", 1),
    error: err(TUNING, "progression.masteryWins.0", "masteryWins[0] must be 0"),
  },
  {
    rule: "masteryWins strictly increasing",
    entries: setPath(base, TUNING, "progression.masteryWins.2", 3),
    error: err(TUNING, "progression.masteryWins.2", "masteryWins must be strictly increasing"),
  },
  {
    rule: "hybridUnlockRank 0",
    entries: setPath(base, TUNING, "progression.hybridUnlockRank", 0),
    error: err(TUNING, "progression.hybridUnlockRank", "hybridUnlockRank must be between 1 and 5"),
  },
  {
    rule: "hybridUnlockRank 6",
    entries: setPath(base, TUNING, "progression.hybridUnlockRank", 6),
    error: err(TUNING, "progression.hybridUnlockRank", "hybridUnlockRank must be between 1 and 5"),
  },
];

describe("buildRules: cross-reference rules (single mutation, exactly one error)", () => {
  it.each(refCases.map((c) => [c.rule, c] as const))("%s", (_rule, c) => {
    expect(errorsOf(c.entries)).toEqual([c.error]);
  });

  it("reports every path from the file root: it resolves inside the mutated file's JSON", () => {
    const resolves = (entries: readonly ContentEntry[], file: string, dotted: string): boolean => {
      let node: unknown = entries.find((entry) => entry.file === file)?.data;
      for (const key of dotted === "" ? [] : dotted.split(".")) {
        if (typeof node !== "object" || node === null || !Object.hasOwn(node, key)) return false;
        node = (node as Record<string, unknown>)[key];
      }
      return true;
    };
    for (const c of refCases) {
      expect(resolves(c.entries, c.error.file, c.error.path), c.rule).toBe(true);
    }
  });

  it("every rule has its own message (the two hybridUnlockRank bounds share one rule)", () => {
    const messages = refCases.map((c) => c.error.message);
    const distinctRules = refCases.length - 1;
    expect(new Set(messages).size).toBe(distinctRules);
  });

  const npcVariants: [string, string, string, string][] = [
    [
      "guardian battleSpell",
      "guardians.0.battleSpell",
      "guardians.0.battleSpell",
      "npc battleSpell must be an existing battle spell",
    ],
    [
      "enforcer battleSpell",
      "enforcer.battleSpell",
      "enforcer.battleSpell",
      "npc battleSpell must be an existing battle spell",
    ],
    [
      "guardian wardSpell",
      "guardians.0.wardSpell",
      "guardians.0.wardSpell",
      "npc wardSpell must be an existing ward spell",
    ],
    [
      "enforcer wardSpell",
      "enforcer.wardSpell",
      "enforcer.wardSpell",
      "npc wardSpell must be an existing ward spell",
    ],
  ];

  it.each(npcVariants)(
    "%s applies to guardians and the enforcer",
    (_label, edit, path, message) => {
      expect(errorsOf(setPath(base, MONSTERS, edit, BAD))).toEqual([err(MONSTERS, path, message)]);
    },
  );

  it.each([
    ["guardian", "guardians.0.hooks", "guardians.0.hooks.0.hook"],
    ["enforcer", "enforcer.hooks", "enforcer.hooks.0.hook"],
  ])("rejects a sheet-stat hook on a %s", (_label, edit, path) => {
    expect(errorsOf(setPath(base, MONSTERS, edit, [{ hook: "hpBp", value: 100 }]))).toEqual([
      err(MONSTERS, path, "npc sheet-stat hooks are not applied"),
    ]);
  });

  it("still accepts combat-time hooks on an NPC (the Ogre ships attackDmgBp)", () => {
    expect(readPath(base, MONSTERS, "monsters.15.hooks")).toEqual([
      { hook: "attackDmgBp", value: 1000 },
    ]);
    expect(buildRules(base).ok).toBe(true);
  });

  it("evaluates every cross-ref rule in one pass (two mutations, two errors, sorted)", () => {
    const entries = setPath(
      setPath(base, TUNING, "progression.hybridUnlockRank", 0),
      CLASSES,
      "classes.0.parents",
      ["warrior", "mage"],
    );
    expect(errorsOf(entries)).toEqual([
      err(CLASSES, "classes.0.parents", "base class must not have parents"),
      err(TUNING, "progression.hybridUnlockRank", "hybridUnlockRank must be between 1 and 5"),
    ]);
  });
});
