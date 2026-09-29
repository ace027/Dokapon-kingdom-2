// `system/setCharacter`: scenario/debug setup for sims and tests (system actor only). It bypasses
// hybrid unlock and starter rules on purpose. Records keyed by ids are read with `ownGet` (PIT-002).
import type { ActionOf, Handler } from "./shared";
import { hasExactKeys, isInt, ownGet, reject } from "./shared";
import { sheetStats } from "../combat/stats";
import { onlyPlayers, PUBLIC, type GameEvent } from "../events";
import type { GearSlot, Rules } from "../rules";
import type { CharacterPublic, GameState } from "../types";

type SetAction = ActionOf<"system/setCharacter">;

const MAX_BAG = 16;
const MAX_LEVEL = 99;

function isSlot(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isSetAction(raw: Record<string, unknown>): raw is SetAction {
  return (
    hasExactKeys(raw, [
      "v",
      "type",
      "playerId",
      "target",
      "classId",
      "level",
      "weapon",
      "shield",
      "accessory",
      "battleSpell",
      "wardSpell",
      "bag",
    ]) &&
    raw.v === 2 &&
    raw.type === "system/setCharacter" &&
    typeof raw.playerId === "string" &&
    typeof raw.target === "string" &&
    typeof raw.classId === "string" &&
    isInt(raw.level, 1, MAX_LEVEL) &&
    isSlot(raw.weapon) &&
    isSlot(raw.shield) &&
    isSlot(raw.accessory) &&
    isSlot(raw.battleSpell) &&
    isSlot(raw.wardSpell) &&
    Array.isArray(raw.bag) &&
    raw.bag.length <= MAX_BAG &&
    raw.bag.every((id) => typeof id === "string")
  );
}

function gearOk(rules: Rules, id: string | null, slot: GearSlot): boolean {
  return id === null || ownGet(rules.gear, id)?.slot === slot;
}

function validateSet(state: GameState, a: SetAction, rules: Rules) {
  if (!state.public.players.includes(a.target)) {
    return reject("INVALID_PAYLOAD", "target must be a seated player");
  }
  const cls = ownGet(rules.classes, a.classId);
  if (cls === undefined) return reject("INVALID_PAYLOAD", "unknown class");
  if (a.level > rules.progression.maxLevel)
    return reject("INVALID_PAYLOAD", "level above maxLevel");
  if (!gearOk(rules, a.weapon, "weapon")) return reject("INVALID_PAYLOAD", "unknown weapon");
  if (!gearOk(rules, a.shield, "shield")) return reject("INVALID_PAYLOAD", "unknown shield");
  if (!gearOk(rules, a.accessory, "accessory"))
    return reject("INVALID_PAYLOAD", "unknown accessory");
  if (a.battleSpell !== null && ownGet(rules.battleSpells, a.battleSpell) === undefined) {
    return reject("INVALID_PAYLOAD", "unknown battle spell");
  }
  if (a.wardSpell !== null && ownGet(rules.wardSpells, a.wardSpell) === undefined) {
    return reject("INVALID_PAYLOAD", "unknown ward spell");
  }
  if (!a.bag.every((id) => ownGet(rules.items, id) !== undefined)) {
    return reject("INVALID_PAYLOAD", "unknown item in bag");
  }
  if (a.bag.length > cls.bagSize) return reject("INVALID_PAYLOAD", "bag exceeds class bag size");
  return null;
}

export const setCharacterHandler: Handler<SetAction> = {
  phases: ["turn"],
  actor: "system",
  guard: isSetAction,
  validate: validateSet,
  apply: (state, a, _ctx, rules) => {
    const current = ownGet(state.public.characters, a.target);
    const priv = ownGet(state.private, a.target);
    if (current === undefined || priv === undefined) return { state, events: [] };
    const set: CharacterPublic = {
      ...current,
      classId: a.classId,
      level: a.level,
      xp: rules.progression.xpCurve[a.level - 1] ?? 0,
      weapon: a.weapon,
      shield: a.shield,
      accessory: a.accessory,
      battleSpell: a.battleSpell,
      wardSpell: a.wardSpell,
    };
    const character: CharacterPublic = { ...set, hp: sheetStats(rules, set).hp };
    const events: GameEvent[] = [
      {
        v: 2,
        type: "CharacterSet",
        visibility: PUBLIC,
        playerId: a.target,
        classId: a.classId,
        level: a.level,
        hp: character.hp,
      },
      {
        v: 2,
        type: "BagUpdated",
        visibility: onlyPlayers([a.target]),
        playerId: a.target,
        bag: [...a.bag],
      },
    ];
    return {
      state: {
        ...state,
        public: {
          ...state.public,
          characters: { ...state.public.characters, [a.target]: character },
        },
        private: { ...state.private, [a.target]: { ...priv, bag: [...a.bag] } },
      },
      events,
    };
  },
};
