// Pure inventory helpers (spec: Inventory and loadout): every success path and every Reject branch,
// each negative a single mutation from a fixture exactly at the limit (exact code + message,
// PIT-001). Content ids include Object.prototype members (PIT-002).
import { describe, expect, it } from "vitest";
import { sheetStats } from "../src/combat/stats";
import {
  addItem,
  addScroll,
  equipGear,
  isReject,
  planClassSwitch,
  removeItem,
  setSpell,
} from "../src/inventory";
import type { Rules } from "../src/rules";
import type { CharacterPublic } from "../src/types";
import { deepFreeze, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("missing fixture entry");
  return value;
}

function craft(edit: (rules: Mutable<Rules>) => void): Rules {
  const rules = JSON.parse(JSON.stringify(TEST_RULES)) as Mutable<Rules>;
  edit(rules);
  return rules;
}

const rej = (message: string) => ({ code: "INVALID_PAYLOAD", message });
const fighter: CharacterPublic = deepFreeze(need(newGame().public.characters.p1));
const caster: CharacterPublic = deepFreeze(need(newGame().public.characters.p2));
const wins = (f: number, c: number) => ({ battlemage: 0, caster: c, fighter: f });

describe("isReject", () => {
  it("is true for an INVALID_PAYLOAD rejection", () => {
    expect(isReject(rej("x"))).toBe(true);
    expect(isReject(addItem(TEST_RULES, "fighter", [], "nope"))).toBe(true);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "INVALID_PAYLOAD"],
    ["an array", []],
    ["a bag", ["herb"]],
    ["a character", fighter],
    ["another code", { code: "WRONG_ACTOR", message: "x" }],
    ["a non-string message", { code: "INVALID_PAYLOAD", message: 1 }],
    ["an extra key", { code: "INVALID_PAYLOAD", message: "x", extra: 1 }],
    ["a missing message", { code: "INVALID_PAYLOAD" }],
  ])("is false for %s", (_name, value) => {
    expect(isReject(value)).toBe(false);
  });
});

describe("addItem", () => {
  it("appends to the bag without mutating it", () => {
    const bag = deepFreeze(["herb"]);
    expect(addItem(TEST_RULES, "fighter", bag, "bomb")).toEqual(["herb", "bomb"]);
    expect(bag).toEqual(["herb"]);
  });

  it("fills a bag exactly to its class size and rejects one more (fighter 3, caster 4)", () => {
    expect(addItem(TEST_RULES, "fighter", ["herb", "herb"], "herb")).toEqual([
      "herb",
      "herb",
      "herb",
    ]);
    expect(addItem(TEST_RULES, "fighter", ["herb", "herb", "herb"], "herb")).toEqual(
      rej("bag is full"),
    );
    expect(addItem(TEST_RULES, "caster", ["herb", "herb", "herb"], "herb")).toEqual([
      "herb",
      "herb",
      "herb",
      "herb",
    ]);
    expect(addItem(TEST_RULES, "caster", ["herb", "herb", "herb", "herb"], "herb")).toEqual(
      rej("bag is full"),
    );
  });

  it.each(["nope", "toString", "constructor", "__proto__", "valueOf"])(
    "rejects the unknown item %s",
    (id) => {
      expect(addItem(TEST_RULES, "fighter", [], id)).toEqual(rej("unknown item"));
    },
  );

  it.each(["nope", "toString", "constructor"])("rejects the unknown class %s", (id) => {
    expect(addItem(TEST_RULES, id, [], "herb")).toEqual(rej("unknown class"));
  });
});

describe("removeItem", () => {
  it("removes the first occurrence only", () => {
    const bag = deepFreeze(["herb", "bomb", "herb"]);
    expect(removeItem(bag, "herb")).toEqual(["bomb", "herb"]);
    expect(removeItem(bag, "bomb")).toEqual(["herb", "herb"]);
    expect(bag).toEqual(["herb", "bomb", "herb"]);
  });

  it.each(["tonic", "toString", "constructor", ""])(
    "rejects %j when it is not in the bag",
    (id) => {
      expect(removeItem(["herb"], id)).toEqual(rej("item not in bag"));
    },
  );

  it("rejects on an empty bag", () => {
    expect(removeItem([], "herb")).toEqual(rej("item not in bag"));
  });
});

describe("addScroll", () => {
  it("appends up to maxScrolls (3) and rejects the fourth", () => {
    expect(addScroll(TEST_RULES, ["haste", "fog"], "haste")).toEqual(["haste", "fog", "haste"]);
    expect(addScroll(TEST_RULES, ["haste", "fog", "haste"], "fog")).toEqual(
      rej("scroll limit reached"),
    );
  });

  it("honours a crafted cap", () => {
    const rules = craft((r) => {
      r.economy.maxScrolls = 1;
    });
    expect(addScroll(rules, [], "haste")).toEqual(["haste"]);
    expect(addScroll(rules, ["haste"], "haste")).toEqual(rej("scroll limit reached"));
  });

  it.each(["zap", "nope", "toString", "valueOf"])("rejects the unknown field spell %s", (id) => {
    expect(addScroll(TEST_RULES, [], id)).toEqual(rej("unknown field spell"));
  });
});

describe("equipGear", () => {
  it("replaces the weapon slot, leaving the other slots", () => {
    const next = equipGear(TEST_RULES, fighter, "sword");
    expect(next).toEqual({ ...fighter, weapon: "sword" });
  });

  it.each([
    ["mirror", "shield"],
    ["charm", "accessory"],
    ["band", "accessory"],
  ] as const)("puts %s into the %s slot, replacing what was there", (id, slot) => {
    const next = equipGear(TEST_RULES, caster, id);
    if (isReject(next)) throw new Error(next.message);
    expect(next[slot]).toBe(id);
    expect(next.weapon).toBe("stick");
  });

  it.each(["nope", "toString", "constructor", "zap"])("rejects the unknown gear %s", (id) => {
    expect(equipGear(TEST_RULES, fighter, id)).toEqual(rej("unknown gear"));
  });

  it("carries an hp gain over the sheet change and keeps a KO at 0", () => {
    const rules = craft((r) => {
      need(r.gear.sword).stats.hp = 10;
    });
    const hurt = equipGear(rules, { ...fighter, hp: 30 }, "sword");
    if (isReject(hurt)) throw new Error(hurt.message);
    const gain = sheetStats(rules, hurt).hp - sheetStats(rules, fighter).hp;
    expect(gain).toBe(10);
    expect(hurt.hp).toBe(40);
    const ko = equipGear(rules, { ...fighter, hp: 0 }, "sword");
    if (isReject(ko)) throw new Error(ko.message);
    expect(ko.hp).toBe(0);
  });
});

describe("setSpell", () => {
  it("replaces the battle spell and the ward spell", () => {
    expect(setSpell(TEST_RULES, fighter, "battleSpell", "jolt")).toEqual({
      ...fighter,
      battleSpell: "jolt",
    });
    expect(setSpell(TEST_RULES, caster, "wardSpell", "sponge")).toEqual({
      ...caster,
      wardSpell: "sponge",
    });
  });

  it.each(["nope", "toString", "constructor", "shell"])(
    "rejects the unknown battle spell %s",
    (id) => {
      expect(setSpell(TEST_RULES, fighter, "battleSpell", id)).toEqual(rej("unknown battle spell"));
    },
  );

  it.each(["nope", "toString", "valueOf", "zap"])("rejects the unknown ward spell %s", (id) => {
    expect(setSpell(TEST_RULES, fighter, "wardSpell", id)).toEqual(rej("unknown ward spell"));
  });
});

describe("planClassSwitch", () => {
  const richFighter: CharacterPublic = { ...fighter, gold: 200 };

  it("switches, deducts the new class's fee, keeps mastery and lists no discard", () => {
    const plan = planClassSwitch(
      TEST_RULES,
      { ...fighter, mastery: wins(5, 0) },
      ["herb"],
      "caster",
      [],
    );
    if (isReject(plan)) throw new Error(plan.message);
    expect(plan.character).toMatchObject({ classId: "caster", gold: 50, mastery: wins(5, 0) });
    expect(plan.bag).toEqual(["herb"]);
    // fighter (max 48) -> caster (max 36): a loss is never carried, the hp is capped
    expect(plan.character.hp).toBe(36);
  });

  it("carries an hp gain (caster hp 36 -> fighter max 48)", () => {
    const plan = planClassSwitch(TEST_RULES, caster, ["herb", "bomb"], "fighter", []);
    if (isReject(plan)) throw new Error(plan.message);
    expect(plan.character.hp).toBe(48);
  });

  it("keeps a KO at 0 hp", () => {
    const plan = planClassSwitch(TEST_RULES, { ...caster, hp: 0 }, [], "fighter", []);
    if (isReject(plan)) throw new Error(plan.message);
    expect(plan.character.hp).toBe(0);
  });

  it.each(["nope", "toString", "constructor", "__proto__"])(
    "rejects the unknown class %s",
    (id) => {
      expect(planClassSwitch(TEST_RULES, fighter, [], id, [])).toEqual(rej("unknown class"));
    },
  );

  it("rejects the class the character already plays", () => {
    expect(planClassSwitch(TEST_RULES, fighter, [], "fighter", [])).toEqual(
      rej("already that class"),
    );
  });

  it("rejects a hybrid whose parents are not both rank 3 (and accepts it at 7/7)", () => {
    const at = (f: number, c: number) =>
      planClassSwitch(TEST_RULES, { ...richFighter, mastery: wins(f, c) }, [], "battlemage", []);
    expect(at(6, 7)).toEqual(rej("hybrid not unlocked"));
    expect(at(7, 6)).toEqual(rej("hybrid not unlocked"));
    expect(isReject(at(7, 7))).toBe(false);
  });

  it("rejects one gold short of the fee (battlemage 150) and accepts exactly the fee", () => {
    const at = (gold: number) =>
      planClassSwitch(TEST_RULES, { ...fighter, gold, mastery: wins(7, 7) }, [], "battlemage", []);
    expect(at(149)).toEqual(rej("not enough gold"));
    const ok = at(150);
    if (isReject(ok)) throw new Error(ok.message);
    expect(ok.character.gold).toBe(0);
  });

  it("requires exactly the overflow items: one fewer and one more both fail", () => {
    const bag = ["herb", "bomb", "herb", "bomb"]; // caster bag 4 -> fighter bag 3: overflow 1
    const plan = (discard: string[]) =>
      planClassSwitch(TEST_RULES, caster, bag, "fighter", discard);
    const msg = rej("discard must list exactly the overflow items");
    expect(plan([])).toEqual(msg);
    expect(plan(["herb", "bomb"])).toEqual(msg);
    const ok = plan(["bomb"]);
    if (isReject(ok)) throw new Error(ok.message);
    expect(ok.bag).toEqual(["herb", "herb", "bomb"]);
  });

  it("requires an empty discard when nothing overflows", () => {
    const msg = rej("discard must list exactly the overflow items");
    expect(planClassSwitch(TEST_RULES, caster, ["herb"], "fighter", ["herb"])).toEqual(msg);
    expect(isReject(planClassSwitch(TEST_RULES, caster, ["herb"], "fighter", []))).toBe(false);
  });

  it("rejects a discarded item that is not in the bag", () => {
    const bag = ["herb", "bomb", "herb", "bomb"];
    expect(planClassSwitch(TEST_RULES, caster, bag, "fighter", ["tonic"])).toEqual(
      rej("discarded item not in bag"),
    );
    expect(planClassSwitch(TEST_RULES, caster, bag, "fighter", ["toString"])).toEqual(
      rej("discarded item not in bag"),
    );
  });

  it("treats the discard list as a multiset (two herbs need two herbs in the bag)", () => {
    const rules = craft((r) => {
      need(r.classes.caster).bagSize = 5;
    });
    const bag = ["herb", "bomb", "bomb", "bomb", "bomb"]; // overflow 2 into the fighter's bag of 3
    const plan = (discard: string[]) => planClassSwitch(rules, caster, bag, "fighter", discard);
    expect(plan(["herb", "herb"])).toEqual(rej("discarded item not in bag"));
    const ok = plan(["herb", "bomb"]);
    if (isReject(ok)) throw new Error(ok.message);
    expect(ok.bag).toEqual(["bomb", "bomb", "bomb"]);
  });

  it("checks in table order (a missing class beats every later check)", () => {
    // unknown class + not enough gold + wrong discard: the class error wins
    expect(planClassSwitch(TEST_RULES, { ...fighter, gold: 0 }, [], "nope", ["herb"])).toEqual(
      rej("unknown class"),
    );
  });

  it("does not mutate its inputs", () => {
    const bag = deepFreeze(["herb", "bomb", "herb", "bomb"]);
    expect(() => planClassSwitch(TEST_RULES, caster, bag, "fighter", ["bomb"])).not.toThrow();
  });
});
