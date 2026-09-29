// `system/grant` and the four `loadout/*` handlers. Validation and application share one planner per
// action, so the checks that reject are exactly the checks apply relies on. Records keyed by a
// player or content id are read with `ownGet` (PIT-002).
import type { ActionOf, Handler } from "./shared";
import { hasExactKeys, isInt, overflow, ownGet, reject } from "./shared";
import { sheetStats } from "../combat/stats";
import { onlyPlayers, PUBLIC, type GameEvent } from "../events";
import type { Grant } from "../actions";
import {
  addItem,
  addScroll,
  equipGear,
  isReject,
  planClassSwitch,
  removeItem,
  setSpell,
} from "../inventory";
import { applyXp, progressionEvent, withAdjustedHp } from "../progression";
import type { Reject } from "../reducer";
import { masteryRank, type ContentId, type Rules } from "../rules";
import type { CharacterPublic, GameState, PlayerId, PrivateState } from "../types";
import { isPlainObject } from "../validation";

type GrantAction = ActionOf<"system/grant">;
type SwitchAction = ActionOf<"loadout/switchClass">;
type DiscardAction = ActionOf<"loadout/discard">;
type UseItemAction = ActionOf<"loadout/useItem">;
type PortableAction = ActionOf<"loadout/setPortable">;

const MAX_BAG = 16;
const MAX_GRANT_AMOUNT = 1_000_000;
const PORTABLE_RANK = 5;
const BP = 10_000;
const ID_GRANT_KINDS: readonly string[] = ["item", "scroll", "gear", "battleSpell", "wardSpell"];

interface Seat {
  character: CharacterPublic;
  priv: PrivateState;
}

/** The seated player's character and private partition; absence is an engine bug. */
function seatOf(state: GameState, id: PlayerId): Seat {
  const character = ownGet(state.public.characters, id);
  const priv = ownGet(state.private, id);
  if (character === undefined || priv === undefined) throw new Error("invariant: unseated player");
  return { character, priv };
}

function writeSeat(
  state: GameState,
  id: PlayerId,
  character: CharacterPublic,
  priv: PrivateState,
): GameState {
  return {
    ...state,
    public: { ...state.public, characters: { ...state.public.characters, [id]: character } },
    private: { ...state.private, [id]: priv },
  };
}

function bagEvent(playerId: PlayerId, bag: readonly ContentId[]): GameEvent {
  return { v: 2, type: "BagUpdated", visibility: onlyPlayers([playerId]), playerId, bag: [...bag] };
}

function isEnvelope(raw: Record<string, unknown>, type: string): boolean {
  return raw.v === 2 && raw.type === type && typeof raw.playerId === "string";
}

function isStringList(value: unknown, max: number): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((v) => typeof v === "string");
}

function isGrant(value: unknown): value is Grant {
  if (!isPlainObject(value) || typeof value.kind !== "string") return false;
  if (ID_GRANT_KINDS.includes(value.kind)) {
    return hasExactKeys(value, ["kind", "id"]) && typeof value.id === "string";
  }
  if (value.kind === "gold" || value.kind === "xp") {
    return hasExactKeys(value, ["kind", "amount"]) && isInt(value.amount, 1, MAX_GRANT_AMOUNT);
  }
  return false;
}

// ---------------------------------------------------------------- system/grant

function isGrantAction(raw: Record<string, unknown>): raw is GrantAction {
  return (
    hasExactKeys(raw, ["v", "type", "playerId", "target", "grant"]) &&
    isEnvelope(raw, "system/grant") &&
    typeof raw.target === "string" &&
    isGrant(raw.grant)
  );
}

interface GrantPlan {
  character: CharacterPublic;
  priv: PrivateState;
  events: GameEvent[];
}

function planGrant(state: GameState, a: GrantAction, rules: Rules): Reject | GrantPlan {
  if (!state.public.players.includes(a.target)) {
    return reject("INVALID_PAYLOAD", "target must be a seated player");
  }
  const { character, priv } = seatOf(state, a.target);
  const { grant } = a;
  const events: GameEvent[] = [
    {
      v: 2,
      type: "Granted",
      visibility:
        grant.kind === "item" || grant.kind === "scroll" ? onlyPlayers([a.target]) : PUBLIC,
      playerId: a.target,
      grant,
    },
  ];
  switch (grant.kind) {
    case "item": {
      const bag = addItem(rules, character.classId, priv.bag, grant.id);
      if (isReject(bag)) return bag;
      events.push(bagEvent(a.target, bag));
      return { character, priv: { ...priv, bag }, events };
    }
    case "scroll": {
      const scrolls = addScroll(rules, priv.scrolls, grant.id);
      if (isReject(scrolls)) return scrolls;
      events.push({
        v: 2,
        type: "ScrollsUpdated",
        visibility: onlyPlayers([a.target]),
        playerId: a.target,
        scrolls,
      });
      return { character, priv: { ...priv, scrolls }, events };
    }
    case "gear":
    case "battleSpell":
    case "wardSpell": {
      const next =
        grant.kind === "gear"
          ? equipGear(rules, character, grant.id)
          : setSpell(rules, character, grant.kind, grant.id);
      if (isReject(next)) return next;
      return { character: next, priv, events };
    }
    case "gold": {
      if (overflow(character.gold, grant.amount)) {
        return reject("INVALID_PAYLOAD", "gold would exceed MAX_COUNTER");
      }
      return { character: { ...character, gold: character.gold + grant.amount }, priv, events };
    }
    case "xp": {
      if (overflow(character.xp, grant.amount)) {
        return reject("INVALID_PAYLOAD", "xp would exceed MAX_COUNTER");
      }
      const gained = applyXp(rules, character, grant.amount);
      for (const level of gained.levelsGained) {
        events.push(progressionEvent(a.target, { type: "LevelUp", level }));
      }
      return { character: gained.character, priv, events };
    }
  }
}

export const grantHandler: Handler<GrantAction> = {
  phases: ["turn"],
  actor: "system",
  guard: isGrantAction,
  validate: (state, a, rules) => {
    const plan = planGrant(state, a, rules);
    return isReject(plan) ? plan : null;
  },
  apply: (state, a, _ctx, rules) => {
    const plan = planGrant(state, a, rules);
    if (isReject(plan)) return { state, events: [] };
    return { state: writeSeat(state, a.target, plan.character, plan.priv), events: plan.events };
  },
};

// ---------------------------------------------------------------- loadout/switchClass

function isSwitchAction(raw: Record<string, unknown>): raw is SwitchAction {
  return (
    hasExactKeys(raw, ["v", "type", "playerId", "classId", "discard"]) &&
    isEnvelope(raw, "loadout/switchClass") &&
    typeof raw.classId === "string" &&
    isStringList(raw.discard, MAX_BAG)
  );
}

/**
 * Validation is `planClassSwitch`, in table order: "unknown class", "already that class", "hybrid
 * not unlocked", "not enough gold", "discard must list exactly the overflow items" (length is
 * `max(0, bag.length - newBagSize)`) and "discarded item not in bag" (multiset).
 */
export const switchClassHandler: Handler<SwitchAction> = {
  phases: ["turn"],
  actor: "any-player",
  guard: isSwitchAction,
  validate: (state, a, rules) => {
    const { character, priv } = seatOf(state, a.playerId);
    const plan = planClassSwitch(rules, character, priv.bag, a.classId, a.discard);
    return isReject(plan) ? plan : null;
  },
  apply: (state, a, _ctx, rules) => {
    const { character, priv } = seatOf(state, a.playerId);
    const plan = planClassSwitch(rules, character, priv.bag, a.classId, a.discard);
    if (isReject(plan)) return { state, events: [] };
    const fee = character.gold - plan.character.gold;
    const events: GameEvent[] = [
      {
        v: 2,
        type: "ClassSwitched",
        visibility: PUBLIC,
        playerId: a.playerId,
        from: character.classId,
        to: a.classId,
        fee,
        hp: plan.character.hp,
      },
    ];
    if (a.discard.length > 0) events.push(bagEvent(a.playerId, plan.bag));
    return {
      state: writeSeat(state, a.playerId, plan.character, { ...priv, bag: plan.bag }),
      events,
    };
  },
};

// ---------------------------------------------------------------- loadout/discard

function isItemAction<T extends "loadout/discard" | "loadout/useItem">(
  type: T,
): (raw: Record<string, unknown>) => raw is ActionOf<T> {
  return (raw): raw is ActionOf<T> =>
    hasExactKeys(raw, ["v", "type", "playerId", "itemId"]) &&
    isEnvelope(raw, type) &&
    typeof raw.itemId === "string";
}

export const discardHandler: Handler<DiscardAction> = {
  phases: ["turn"],
  actor: "any-player",
  guard: isItemAction("loadout/discard"),
  validate: (state, a) => {
    const removed = removeItem(seatOf(state, a.playerId).priv.bag, a.itemId);
    return isReject(removed) ? removed : null;
  },
  apply: (state, a) => {
    const { character, priv } = seatOf(state, a.playerId);
    const bag = removeItem(priv.bag, a.itemId);
    if (isReject(bag)) return { state, events: [] };
    return {
      state: writeSeat(state, a.playerId, character, { ...priv, bag }),
      events: [bagEvent(a.playerId, bag)],
    };
  },
};

// ---------------------------------------------------------------- loadout/useItem

export const useItemHandler: Handler<UseItemAction> = {
  phases: ["turn"],
  actor: "any-player",
  guard: isItemAction("loadout/useItem"),
  validate: (state, a, rules) => {
    const { character, priv } = seatOf(state, a.playerId);
    const removed = removeItem(priv.bag, a.itemId);
    if (isReject(removed)) return removed;
    const def = ownGet(rules.items, a.itemId);
    if (def?.use !== "both" || def.effect.kind !== "heal") {
      return reject("INVALID_PAYLOAD", "item is not usable outside combat");
    }
    if (character.hp === 0) return reject("INVALID_PAYLOAD", "knocked out");
    return null;
  },
  apply: (state, a, _ctx, rules) => {
    const { character, priv } = seatOf(state, a.playerId);
    const def = ownGet(rules.items, a.itemId);
    const bag = removeItem(priv.bag, a.itemId);
    if (def?.effect.kind !== "heal" || isReject(bag)) return { state, events: [] };
    const max = sheetStats(rules, character).hp;
    const healed = Math.min(max - character.hp, Math.floor((max * def.effect.bp) / BP));
    const next: CharacterPublic = { ...character, hp: character.hp + healed };
    return {
      state: writeSeat(state, a.playerId, next, { ...priv, bag }),
      events: [
        {
          v: 2,
          type: "ItemUsed",
          visibility: PUBLIC,
          playerId: a.playerId,
          itemId: a.itemId,
          healed,
          hp: next.hp,
        },
        bagEvent(a.playerId, bag),
      ],
    };
  },
};

// ---------------------------------------------------------------- loadout/setPortable

function isPortableAction(raw: Record<string, unknown>): raw is PortableAction {
  return (
    hasExactKeys(raw, ["v", "type", "playerId", "classId"]) &&
    isEnvelope(raw, "loadout/setPortable") &&
    (raw.classId === null || typeof raw.classId === "string")
  );
}

export const setPortableHandler: Handler<PortableAction> = {
  phases: ["turn"],
  actor: "any-player",
  guard: isPortableAction,
  validate: (state, a, rules) => {
    if (a.classId === null) return null;
    if (ownGet(rules.classes, a.classId) === undefined) {
      return reject("INVALID_PAYLOAD", "unknown class");
    }
    const { character } = seatOf(state, a.playerId);
    if (masteryRank(rules, ownGet(character.mastery, a.classId) ?? 0) < PORTABLE_RANK) {
      return reject("INVALID_PAYLOAD", "portable passive requires mastery rank 5");
    }
    return null;
  },
  apply: (state, a, _ctx, rules) => {
    const { character, priv } = seatOf(state, a.playerId);
    const next = withAdjustedHp(rules, character, { ...character, portable: a.classId });
    return {
      state: writeSeat(state, a.playerId, next, priv),
      events: [
        {
          v: 2,
          type: "PortableSet",
          visibility: PUBLIC,
          playerId: a.playerId,
          classId: a.classId,
          hp: next.hp,
        },
      ],
    };
  },
};
