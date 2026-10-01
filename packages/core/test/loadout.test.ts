// system/grant and loadout/* (spec: reducer handler table; Inventory and loadout): shape guards,
// phase/actor rules, every state check as a single mutation from a fixture exactly at the limit
// (exact code + message, PIT-001), event order and visibility. Ids include Object.prototype members
// (PIT-002). After every accepted action the state round-trips through deserialize.
import { describe, expect, it } from "vitest";
import type { GameEvent } from "../src/events";
import { sheetStats } from "../src/combat/stats";
import { reduce, type Reject } from "../src/reducer";
import type { Rules } from "../src/rules";
import { deserialize, serialize } from "../src/serialize";
import type { GameState } from "../src/types";
import { applyAll, craft, deepFreeze, make, need, newGame, type SaveJson } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const wins = (fighter: number, caster: number) => ({ battlemage: 0, caster, fighter });
const char = (json: SaveJson, id: string) => need(json.public.characters[id]);
const priv = (json: SaveJson, id: string) => need(json.private[id]);

const grant = (target: string, g: unknown) => ({
  v: 2,
  type: "system/grant",
  playerId: "system",
  target,
  grant: g,
});
const item = (id: string) => ({ kind: "item", id });
const switchTo = (playerId: string, classId: unknown, discard: unknown = []) => ({
  v: 2,
  type: "loadout/switchClass",
  playerId,
  classId,
  discard,
});
const discardItem = (playerId: string, itemId: unknown) => ({
  v: 2,
  type: "loadout/discard",
  playerId,
  itemId,
});
const useItem = (playerId: string, itemId: unknown) => ({
  v: 2,
  type: "loadout/useItem",
  playerId,
  itemId,
});

function fails(
  state: GameState,
  action: unknown,
  code: Reject["code"],
  message: string,
  rules: Rules = TEST_RULES,
): void {
  deepFreeze(state);
  expect(reduce(state, action, rules)).toEqual({ ok: false, error: { code, message } });
}
const invalid = (
  state: GameState,
  action: unknown,
  message: string,
  rules: Rules = TEST_RULES,
): void => {
  fails(state, action, "INVALID_PAYLOAD", message, rules);
};

function ok(
  state: GameState,
  action: unknown,
  rules: Rules = TEST_RULES,
): { state: GameState; events: readonly GameEvent[] } {
  deepFreeze(state);
  const result = reduce(state, action, rules);
  if (!result.ok) throw new Error(`rejected: ${result.error.code} ${result.error.message}`);
  expect(deserialize(serialize(result.state), rules)).toEqual(result.state);
  return { state: result.state, events: result.events };
}

const types = (events: readonly GameEvent[]) => events.map((e) => e.type);
const PRIVATE_TO_P1 = { kind: "players", ids: ["p1"] };
const PUBLIC_VIS = { kind: "public" };

describe("system/grant: shape, phase and actor", () => {
  it.each([
    ["amount 0", grant("p1", { kind: "gold", amount: 0 })],
    ["amount 1_000_001", grant("p1", { kind: "gold", amount: 1_000_001 })],
    ["amount 1.5", grant("p1", { kind: "xp", amount: 1.5 })],
    ["amount as a string", grant("p1", { kind: "xp", amount: "5" })],
    ["a negative amount", grant("p1", { kind: "gold", amount: -1 })],
    ["an extra key in grant (id kind)", grant("p1", { kind: "item", id: "herb", amount: 1 })],
    ["an extra key in grant (amount kind)", grant("p1", { kind: "gold", amount: 1, id: "herb" })],
    ["a missing id", grant("p1", { kind: "item" })],
    ["a non-string id", grant("p1", { kind: "item", id: 5 })],
    ["an unknown kind", grant("p1", { kind: "loot", id: "herb" })],
    ["a non-object grant", grant("p1", "herb")],
    ["a null grant", grant("p1", null)],
    ["a non-string target", grant(5 as unknown as string, item("herb"))],
    ["an extra top-level key", { ...grant("p1", item("herb")), extra: 1 }],
  ])("rejects %s with INVALID_PAYLOAD", (_name, action) => {
    invalid(newGame(), action, "invalid payload for system/grant");
  });

  it("accepts the boundary amounts 1 and 1_000_000", () => {
    for (const amount of [1, 1_000_000]) {
      expect(
        ok(newGame(), grant("p1", { kind: "gold", amount })).state.public.characters.p1?.gold,
      ).toBe(100 + amount);
    }
  });

  it("a player sending it is WRONG_ACTOR", () => {
    const action = { ...grant("p1", item("herb")), playerId: "p1" };
    fails(newGame(), action, "WRONG_ACTOR", "p1 may not perform system/grant");
  });

  it("is WRONG_PHASE during a combat decision", () => {
    const started = applyAll(newGame(), [
      {
        v: 2,
        type: "combat/start",
        playerId: "system",
        attacker: "p1",
        opponent: { kind: "player", playerId: "p2" },
      },
    ]).state;
    fails(
      started,
      grant("p1", item("herb")),
      "WRONG_PHASE",
      "system/grant is not allowed in phase decision",
    );
  });
});

describe("system/grant: state checks", () => {
  it.each(["ghost", "toString", "valueOf", "system"])("rejects the target %s", (target) => {
    invalid(newGame(), grant(target, item("herb")), "target must be a seated player");
  });

  it.each(["nope", "toString", "constructor", "__proto__", "zap"])(
    "rejects the unknown item %s",
    (id) => {
      invalid(newGame(), grant("p1", item(id)), "unknown item");
    },
  );

  it.each(["nope", "toString", "constructor", "zap"])(
    "rejects the unknown field spell %s",
    (id) => {
      invalid(newGame(), grant("p1", { kind: "scroll", id }), "unknown field spell");
    },
  );

  it.each(["nope", "toString", "constructor", "zap"])("rejects the unknown gear %s", (id) => {
    invalid(newGame(), grant("p1", { kind: "gear", id }), "unknown gear");
  });

  it.each(["nope", "toString", "constructor", "shell"])(
    "rejects the unknown battle spell %s",
    (id) => {
      invalid(newGame(), grant("p1", { kind: "battleSpell", id }), "unknown battle spell");
    },
  );

  it.each(["nope", "toString", "constructor", "zap"])("rejects the unknown ward spell %s", (id) => {
    invalid(newGame(), grant("p1", { kind: "wardSpell", id }), "unknown ward spell");
  });

  it("rejects an item when the bag is exactly full, and accepts it one item short", () => {
    const full = make((j) => {
      priv(j, "p1").bag = ["herb", "herb", "herb"];
    });
    invalid(full, grant("p1", item("herb")), "bag is full");
    const almost = make((j) => {
      priv(j, "p1").bag = ["herb", "herb"];
    });
    expect(ok(almost, grant("p1", item("herb"))).state.private.p1?.bag).toEqual([
      "herb",
      "herb",
      "herb",
    ]);
  });

  it("sizes the bag by the target's class (caster 4)", () => {
    const three = make((j) => {
      priv(j, "p2").bag = ["herb", "herb", "herb"];
    });
    expect(ok(three, grant("p2", item("bomb"))).state.private.p2?.bag).toHaveLength(4);
    const four = make((j) => {
      priv(j, "p2").bag = ["herb", "herb", "herb", "herb"];
    });
    invalid(four, grant("p2", item("bomb")), "bag is full");
  });

  it("rejects the 4th scroll and accepts the 3rd", () => {
    const three = make((j) => {
      priv(j, "p1").scrolls = ["haste", "fog", "haste"];
    });
    invalid(three, grant("p1", { kind: "scroll", id: "fog" }), "scroll limit reached");
    const two = make((j) => {
      priv(j, "p1").scrolls = ["haste", "fog"];
    });
    expect(ok(two, grant("p1", { kind: "scroll", id: "fog" })).state.private.p1?.scrolls).toEqual([
      "haste",
      "fog",
      "fog",
    ]);
  });

  it("a scroll never takes bag space", () => {
    const fullBag = make((j) => {
      priv(j, "p1").bag = ["herb", "herb", "herb"];
    });
    expect(
      ok(fullBag, grant("p1", { kind: "scroll", id: "haste" })).state.private.p1?.scrolls,
    ).toEqual(["haste"]);
  });
});

describe("system/grant: apply and events", () => {
  it("item: Granted (private) then BagUpdated (private)", () => {
    const { state, events } = ok(newGame(), grant("p1", item("tonic")));
    expect(state.private.p1?.bag).toEqual(["herb", "tonic"]);
    expect(events).toEqual([
      { v: 2, type: "Granted", visibility: PRIVATE_TO_P1, playerId: "p1", grant: item("tonic") },
      {
        v: 2,
        type: "BagUpdated",
        visibility: PRIVATE_TO_P1,
        playerId: "p1",
        bag: ["herb", "tonic"],
      },
    ]);
  });

  it("scroll: Granted (private) then ScrollsUpdated (private)", () => {
    const { events } = ok(newGame(), grant("p2", { kind: "scroll", id: "haste" }));
    expect(events).toEqual([
      {
        v: 2,
        type: "Granted",
        visibility: { kind: "players", ids: ["p2"] },
        playerId: "p2",
        grant: { kind: "scroll", id: "haste" },
      },
      {
        v: 2,
        type: "ScrollsUpdated",
        visibility: { kind: "players", ids: ["p2"] },
        playerId: "p2",
        scrolls: ["haste"],
      },
    ]);
  });

  it.each([
    [{ kind: "gear", id: "sword" }],
    [{ kind: "battleSpell", id: "jolt" }],
    [{ kind: "wardSpell", id: "sponge" }],
    [{ kind: "gold", amount: 5 }],
  ])("%j: a single public Granted", (g) => {
    const { events } = ok(newGame(), grant("p1", g));
    expect(events).toEqual([
      { v: 2, type: "Granted", visibility: PUBLIC_VIS, playerId: "p1", grant: g },
    ]);
  });

  it("gear replaces the slot; battle and ward spells replace theirs", () => {
    const { state } = ok(newGame(), grant("p2", { kind: "gear", id: "band" }));
    expect(state.public.characters.p2).toMatchObject({ accessory: "band", weapon: "stick" });
    const spell = ok(newGame(), grant("p2", { kind: "battleSpell", id: "jolt" }));
    expect(spell.state.public.characters.p2?.battleSpell).toBe("jolt");
    const ward = ok(newGame(), grant("p2", { kind: "wardSpell", id: "sponge" }));
    expect(ward.state.public.characters.p2?.wardSpell).toBe("sponge");
  });

  it("gear carries an hp gain over the sheet change", () => {
    const rules = craft((r) => {
      need(r.gear.sword).stats.hp = 10;
    });
    const state = make((j) => {
      char(j, "p1").hp = 30;
    }, rules);
    const { state: after } = ok(state, grant("p1", { kind: "gear", id: "sword" }), rules);
    expect(after.public.characters.p1?.hp).toBe(40);
  });

  it("a KO'd character stays at 0 hp through a gear grant", () => {
    const rules = craft((r) => {
      need(r.gear.sword).stats.hp = 10;
    });
    const state = make((j) => {
      char(j, "p1").hp = 0;
    }, rules);
    const { state: after } = ok(state, grant("p1", { kind: "gear", id: "sword" }), rules);
    expect(after.public.characters.p1?.hp).toBe(0);
  });

  it("gold adds to the balance", () => {
    const { state } = ok(newGame(), grant("p1", { kind: "gold", amount: 200 }));
    expect(state.public.characters.p1?.gold).toBe(300);
  });

  it("xp emits LevelUp per level after Granted, and adjusts hp (golden: p2 hp 36 -> 50)", () => {
    const { state, events } = ok(newGame(), grant("p2", { kind: "xp", amount: 150 }));
    expect(types(events)).toEqual(["Granted", "LevelUp", "LevelUp"]);
    expect(events.slice(1)).toMatchObject([
      { playerId: "p2", level: 2 },
      { playerId: "p2", level: 3 },
    ]);
    expect(state.public.characters.p2).toMatchObject({ xp: 150, level: 3, hp: 50 });
  });

  it("xp inside the level emits no LevelUp", () => {
    const { events } = ok(newGame(), grant("p1", { kind: "xp", amount: 49 }));
    expect(types(events)).toEqual(["Granted"]);
  });
});

describe("loadout/switchClass", () => {
  const rich = (edit: (j: SaveJson) => void = () => undefined) =>
    make((j) => {
      char(j, "p1").gold = 200;
      edit(j);
    });

  it("switches: fee deducted, mastery kept, hp adjusted, ClassSwitched without BagUpdated", () => {
    const state = make((j) => {
      char(j, "p1").mastery = wins(5, 0);
    });
    const { state: after, events } = ok(state, switchTo("p1", "caster"));
    expect(after.public.characters.p1).toMatchObject({
      classId: "caster",
      gold: 50,
      hp: 36,
      mastery: wins(5, 0),
    });
    expect(after.private.p1?.bag).toEqual(["herb"]);
    expect(events).toEqual([
      {
        v: 2,
        type: "ClassSwitched",
        visibility: PUBLIC_VIS,
        playerId: "p1",
        from: "fighter",
        to: "caster",
        fee: 50,
        hp: 36,
      },
    ]);
  });

  it("charges the new class's fee (battlemage 150)", () => {
    const state = rich((j) => {
      char(j, "p1").mastery = wins(7, 7);
    });
    const { state: after, events } = ok(state, switchTo("p1", "battlemage"));
    expect(after.public.characters.p1?.gold).toBe(50);
    expect(events[0]).toMatchObject({ type: "ClassSwitched", fee: 150 });
  });

  it.each(["nope", "toString", "constructor", "__proto__"])(
    "rejects the unknown class %s",
    (id) => {
      invalid(newGame(), switchTo("p1", id), "unknown class");
    },
  );

  it("rejects the class already played", () => {
    invalid(newGame(), switchTo("p1", "fighter"), "already that class");
  });

  it("rejects a locked hybrid with enough gold, accepts it once both parents reach rank 3", () => {
    const locked = rich((j) => {
      char(j, "p1").mastery = wins(6, 7);
    });
    invalid(locked, switchTo("p1", "battlemage"), "hybrid not unlocked");
    const unlocked = rich((j) => {
      char(j, "p1").mastery = wins(7, 7);
    });
    expect(ok(unlocked, switchTo("p1", "battlemage")).state.public.characters.p1?.classId).toBe(
      "battlemage",
    );
  });

  it("rejects one gold short (hybrid unlocked) and accepts exactly the fee", () => {
    const short = make((j) => {
      const c = char(j, "p1");
      c.mastery = wins(7, 7);
      c.gold = 149;
    });
    invalid(short, switchTo("p1", "battlemage"), "not enough gold");
    const exact = make((j) => {
      const c = char(j, "p1");
      c.mastery = wins(7, 7);
      c.gold = 150;
    });
    expect(ok(exact, switchTo("p1", "battlemage")).state.public.characters.p1?.gold).toBe(0);
  });

  const overflowing = () =>
    make((j) => {
      priv(j, "p2").bag = ["herb", "bomb", "herb", "bomb"];
    });

  it("requires exactly the overflow items: one fewer and one more both fail", () => {
    const state = overflowing(); // caster bag 4 -> fighter bag 3, enough gold, unlocked class
    const message = "discard must list exactly the overflow items";
    invalid(state, switchTo("p2", "fighter", []), message);
    invalid(state, switchTo("p2", "fighter", ["herb", "bomb"]), message);
    const { state: after, events } = ok(state, switchTo("p2", "fighter", ["bomb"]));
    expect(after.private.p2?.bag).toEqual(["herb", "herb", "bomb"]);
    expect(types(events)).toEqual(["ClassSwitched", "BagUpdated"]);
    expect(events[1]).toEqual({
      v: 2,
      type: "BagUpdated",
      visibility: { kind: "players", ids: ["p2"] },
      playerId: "p2",
      bag: ["herb", "herb", "bomb"],
    });
  });

  it("one more than the overflow fails when nothing overflows", () => {
    const state = make((j) => {
      priv(j, "p2").bag = ["herb", "bomb", "herb"]; // fits the fighter's 3
    });
    invalid(
      state,
      switchTo("p2", "fighter", ["herb"]),
      "discard must list exactly the overflow items",
    );
    expect(types(ok(state, switchTo("p2", "fighter", [])).events)).toEqual(["ClassSwitched"]);
  });

  it("rejects a discarded item that is not in the bag", () => {
    const state = overflowing();
    invalid(state, switchTo("p2", "fighter", ["tonic"]), "discarded item not in bag");
    invalid(state, switchTo("p2", "fighter", ["toString"]), "discarded item not in bag");
  });

  it("treats the discard list as a multiset", () => {
    const rules = craft((r) => {
      need(r.classes.caster).bagSize = 5;
    });
    const state = make((j) => {
      priv(j, "p2").bag = ["herb", "bomb", "bomb", "bomb", "bomb"];
    }, rules);
    invalid(state, switchTo("p2", "fighter", ["herb", "herb"]), "discarded item not in bag", rules);
    const { state: after } = ok(state, switchTo("p2", "fighter", ["herb", "bomb"]), rules);
    expect(after.private.p2?.bag).toEqual(["bomb", "bomb", "bomb"]);
  });

  it("a KO'd character switches and stays at 0 hp", () => {
    const state = make((j) => {
      char(j, "p2").hp = 0;
    });
    expect(ok(state, switchTo("p2", "fighter")).state.public.characters.p2?.hp).toBe(0);
  });

  it("carries an hp gain to the new class (caster 36 -> fighter 48)", () => {
    const { state } = ok(newGame(), switchTo("p2", "fighter"));
    expect(state.public.characters.p2?.hp).toBe(48);
    expect(sheetStats(TEST_RULES, need(state.public.characters.p2)).hp).toBe(48);
  });

  it.each([
    ["a number classId", switchTo("p1", 5)],
    ["a missing discard", { v: 2, type: "loadout/switchClass", playerId: "p1", classId: "caster" }],
    ["a non-array discard", switchTo("p1", "caster", "herb")],
    ["a non-string discard entry", switchTo("p1", "caster", [5])],
    [
      "a discard of 17",
      switchTo(
        "p1",
        "caster",
        Array.from({ length: 17 }, () => "herb"),
      ),
    ],
    ["an extra key", { ...switchTo("p1", "caster"), extra: 1 }],
  ])("rejects %s at the shape step", (_name, action) => {
    invalid(newGame(), action, "invalid payload for loadout/switchClass");
  });
});

describe("loadout/discard", () => {
  it("removes the first occurrence and emits a private BagUpdated", () => {
    const state = make((j) => {
      priv(j, "p2").bag = ["herb", "bomb", "herb"];
    });
    const { state: after, events } = ok(state, discardItem("p2", "herb"));
    expect(after.private.p2?.bag).toEqual(["bomb", "herb"]);
    expect(events).toEqual([
      {
        v: 2,
        type: "BagUpdated",
        visibility: { kind: "players", ids: ["p2"] },
        playerId: "p2",
        bag: ["bomb", "herb"],
      },
    ]);
  });

  it.each(["tonic", "toString", "constructor", "__proto__"])("rejects %s not in the bag", (id) => {
    invalid(newGame(), discardItem("p1", id), "item not in bag");
  });

  it("rejects on an empty bag and accepts with one item (single mutation)", () => {
    const empty = make((j) => {
      priv(j, "p1").bag = [];
    });
    invalid(empty, discardItem("p1", "herb"), "item not in bag");
    expect(ok(newGame(), discardItem("p1", "herb")).state.private.p1?.bag).toEqual([]);
  });

  it.each([
    ["a number itemId", discardItem("p1", 5)],
    ["an extra key", { ...discardItem("p1", "herb"), extra: 1 }],
    ["a missing itemId", { v: 2, type: "loadout/discard", playerId: "p1" }],
  ])("rejects %s at the shape step", (_name, action) => {
    invalid(newGame(), action, "invalid payload for loadout/discard");
  });
});

describe("loadout/useItem", () => {
  it("heals min(maxHp - hp, floor(maxHp x bp)) and emits ItemUsed then BagUpdated", () => {
    // golden: 22 -> 36, healed 14 (30% of 48, floored)
    const state = make((j) => {
      char(j, "p1").hp = 22;
    });
    const { state: after, events } = ok(state, useItem("p1", "herb"));
    expect(after.public.characters.p1?.hp).toBe(36);
    expect(after.private.p1?.bag).toEqual([]);
    expect(events).toEqual([
      {
        v: 2,
        type: "ItemUsed",
        visibility: PUBLIC_VIS,
        playerId: "p1",
        itemId: "herb",
        healed: 14,
        hp: 36,
      },
      { v: 2, type: "BagUpdated", visibility: PRIVATE_TO_P1, playerId: "p1", bag: [] },
    ]);
  });

  it("clamps the heal at max hp", () => {
    const state = make((j) => {
      char(j, "p1").hp = 40;
    });
    const { state: after, events } = ok(state, useItem("p1", "herb"));
    expect(after.public.characters.p1?.hp).toBe(48);
    expect(events[0]).toMatchObject({ healed: 8, hp: 48 });
  });

  it("heals 0 at full hp but still consumes the item", () => {
    const { state, events } = ok(newGame(), useItem("p1", "herb"));
    expect(events[0]).toMatchObject({ type: "ItemUsed", healed: 0, hp: 48 });
    expect(state.private.p1?.bag).toEqual([]);
  });

  it.each(["tonic", "toString", "constructor", "__proto__", "boots"])(
    "rejects %s not in the bag",
    (id) => {
      invalid(newGame(), useItem("p1", id), "item not in bag");
    },
  );

  it.each([
    ["boots", "board"],
    ["wig", "joke"],
    ["bomb", "combat"],
    ["tonic", "combat"],
    ["antidote", "both but cleanse"],
  ])("rejects %s (%s) outside combat, with the item in the bag", (id) => {
    const state = make((j) => {
      char(j, "p1").hp = 22;
      priv(j, "p1").bag = [id];
    });
    invalid(state, useItem("p1", id), "item is not usable outside combat");
  });

  it("rejects a knocked out character holding a herb, accepts at 1 hp", () => {
    const ko = make((j) => {
      char(j, "p1").hp = 0;
    });
    invalid(ko, useItem("p1", "herb"), "knocked out");
    const one = make((j) => {
      char(j, "p1").hp = 1;
    });
    expect(ok(one, useItem("p1", "herb")).state.public.characters.p1?.hp).toBe(15);
  });

  it("checks the bag first, then usability, then knocked out", () => {
    const state = make((j) => {
      char(j, "p1").hp = 0;
      priv(j, "p1").bag = ["bomb"];
    });
    invalid(state, useItem("p1", "bomb"), "item is not usable outside combat");
    invalid(state, useItem("p1", "herb"), "item not in bag");
  });

  it.each([
    ["a number itemId", useItem("p1", 5)],
    ["an extra key", { ...useItem("p1", "herb"), extra: 1 }],
  ])("rejects %s at the shape step", (_name, action) => {
    invalid(newGame(), action, "invalid payload for loadout/useItem");
  });
});

describe("loadout/*: phase and actor", () => {
  const inCombat = () =>
    applyAll(newGame(), [
      {
        v: 2,
        type: "combat/start",
        playerId: "system",
        attacker: "p1",
        opponent: { kind: "player", playerId: "p2" },
      },
    ]).state;

  it.each([
    ["loadout/switchClass", switchTo("p1", "caster")],
    ["loadout/discard", discardItem("p1", "herb")],
    ["loadout/useItem", useItem("p1", "herb")],
    ["loadout/setPortable", { v: 2, type: "loadout/setPortable", playerId: "p1", classId: null }],
  ])("%s during combat is WRONG_PHASE", (type, action) => {
    fails(inCombat(), action, "WRONG_PHASE", `${type} is not allowed in phase decision`);
  });

  it.each([
    ["loadout/switchClass", switchTo("system", "caster")],
    ["loadout/discard", discardItem("system", "herb")],
    ["loadout/useItem", useItem("system", "herb")],
    [
      "loadout/setPortable",
      { v: 2, type: "loadout/setPortable", playerId: "system", classId: null },
    ],
  ])("%s sent by system is WRONG_ACTOR", (type, action) => {
    fails(newGame(), action, "WRONG_ACTOR", `system may not perform ${type}`);
  });

  it.each([
    ["system/grant", { ...grant("p1", item("herb")), playerId: 5 }],
    ["loadout/switchClass", switchTo(5 as unknown as string, "caster")],
    ["loadout/discard", discardItem(5 as unknown as string, "herb")],
    ["loadout/useItem", useItem(5 as unknown as string, "herb")],
  ])("%s with a non-string playerId fails the shape step", (type, action) => {
    invalid(newGame(), action, `invalid payload for ${type}`);
  });

  it("rejects an item that only heals in combat (use combat, effect heal)", () => {
    const rules = craft((r) => {
      r.items.elixir = {
        id: "elixir",
        kind: "consumable",
        price: 10,
        use: "combat",
        effect: { kind: "heal", bp: 5000 },
      };
    });
    const state = make((j) => {
      char(j, "p1").hp = 22;
      priv(j, "p1").bag = ["elixir"];
    }, rules);
    invalid(state, useItem("p1", "elixir"), "item is not usable outside combat", rules);
  });

  it.each(["ghost", "toString"])("an unseated sender %s is WRONG_ACTOR", (id) => {
    fails(
      newGame(),
      discardItem(id, "herb"),
      "WRONG_ACTOR",
      `${id} may not perform loadout/discard`,
    );
  });
});
