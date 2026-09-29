// Inventory helpers: bag, scroll, gear/spell slot and class-switch rules. Pure: each returns the
// new value or a `Reject` whose message is the handler-table string. Records keyed by content ids
// are read with `ownGet` (PIT-002).
import { hybridsUnlocked, withAdjustedHp } from "./progression";
import type { Reject } from "./reducer";
import type { ContentId, Rules } from "./rules";
import type { CharacterPublic } from "./types";
import { isPlainObject, ownGet } from "./validation";

/** A value or the rejection that explains why it cannot be produced. */
export type InvResult<T> = T | Reject;

function rejection(message: string): Reject {
  return { code: "INVALID_PAYLOAD", message };
}

/** True for a `Reject` (an `INVALID_PAYLOAD` object with a string message). */
export function isReject(x: unknown): x is Reject {
  return (
    isPlainObject(x) &&
    Object.keys(x).length === 2 &&
    x.code === "INVALID_PAYLOAD" &&
    typeof x.message === "string"
  );
}

/** Appends `itemId` to a bag sized by the class (`unknown item`, `unknown class`, `bag is full`). */
export function addItem(
  rules: Rules,
  classId: ContentId,
  bag: readonly ContentId[],
  itemId: ContentId,
): InvResult<ContentId[]> {
  if (ownGet(rules.items, itemId) === undefined) return rejection("unknown item");
  const cls = ownGet(rules.classes, classId);
  if (cls === undefined) return rejection("unknown class");
  if (bag.length >= cls.bagSize) return rejection("bag is full");
  return [...bag, itemId];
}

/** Removes the first occurrence of `itemId`. */
export function removeItem(bag: readonly ContentId[], itemId: ContentId): InvResult<ContentId[]> {
  const index = bag.indexOf(itemId);
  if (index < 0) return rejection("item not in bag");
  return [...bag.slice(0, index), ...bag.slice(index + 1)];
}

/** Appends a field-spell scroll (they never occupy bag space; capped at `maxScrolls`). */
export function addScroll(
  rules: Rules,
  scrolls: readonly ContentId[],
  spellId: ContentId,
): InvResult<ContentId[]> {
  if (ownGet(rules.fieldSpells, spellId) === undefined) return rejection("unknown field spell");
  if (scrolls.length >= rules.economy.maxScrolls) return rejection("scroll limit reached");
  return [...scrolls, spellId];
}

/** Equips gear into its own slot, replacing what was there; hp follows the sheet change. */
export function equipGear(
  rules: Rules,
  ch: CharacterPublic,
  gearId: ContentId,
): InvResult<CharacterPublic> {
  const gear = ownGet(rules.gear, gearId);
  if (gear === undefined) return rejection("unknown gear");
  return withAdjustedHp(rules, ch, { ...ch, [gear.slot]: gearId });
}

/** Sets the battle or ward spell slot, replacing what was there. */
export function setSpell(
  rules: Rules,
  ch: CharacterPublic,
  kind: "battleSpell" | "wardSpell",
  id: ContentId,
): InvResult<CharacterPublic> {
  if (kind === "battleSpell") {
    if (ownGet(rules.battleSpells, id) === undefined) return rejection("unknown battle spell");
  } else if (ownGet(rules.wardSpells, id) === undefined) {
    return rejection("unknown ward spell");
  }
  return withAdjustedHp(rules, ch, { ...ch, [kind]: id });
}

/**
 * Plans a class switch. Checks, in order: unknown class, already that class, hybrid not unlocked,
 * not enough gold (the new class's fee), the exact overflow discard list, and that each discarded
 * item is in the bag (multiset: every entry removes the first remaining occurrence).
 */
export function planClassSwitch(
  rules: Rules,
  ch: CharacterPublic,
  bag: readonly ContentId[],
  classId: ContentId,
  discard: readonly ContentId[],
): InvResult<{ character: CharacterPublic; bag: ContentId[] }> {
  const cls = ownGet(rules.classes, classId);
  if (cls === undefined) return rejection("unknown class");
  if (classId === ch.classId) return rejection("already that class");
  if (cls.kind === "hybrid" && !hybridsUnlocked(rules, ch.mastery).includes(classId)) {
    return rejection("hybrid not unlocked");
  }
  if (ch.gold < cls.switchFee) return rejection("not enough gold");
  if (discard.length !== Math.max(0, bag.length - cls.bagSize)) {
    return rejection("discard must list exactly the overflow items");
  }
  let remaining: ContentId[] = [...bag];
  for (const itemId of discard) {
    const removed = removeItem(remaining, itemId);
    if (isReject(removed)) return rejection("discarded item not in bag");
    remaining = removed;
  }
  const character = withAdjustedHp(rules, ch, {
    ...ch,
    classId,
    gold: ch.gold - cls.switchFee,
  });
  return { character, bag: remaining };
}
