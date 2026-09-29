// Internal helpers shared by createGame, reduce and deserialize. Not re-exported from index.ts.
import type { Rules } from "./rules";
import { PLAYER_ID_PATTERN, RESERVED_IDS } from "./types";

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;

/** Longest slice of attacker-supplied text a reject message may echo. */
const MAX_ECHO = 64;

/** A non-array object whose prototype is `Object.prototype` or `null`. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Own-property lookup, so ids such as `toString` never resolve to `Object.prototype` members. */
export function ownGet<V>(record: Readonly<Record<string, V>>, key: string): V | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isUnique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

/** Caps attacker-supplied text echoed in reject messages at {@link MAX_ECHO} chars. */
export function clip(text: string): string {
  return text.length <= MAX_ECHO ? text : `${text.slice(0, MAX_ECHO)}…`;
}

/**
 * The player-list rules shared by `createGame` and `deserialize`: 1–4 unique string ids that
 * match {@link PLAYER_ID_PATTERN} and are not in {@link RESERVED_IDS}. Returns an error message,
 * or `null` when valid.
 */
export function playersError(players: unknown): string | null {
  if (!Array.isArray(players)) return "players must be an array";
  const ids: unknown[] = players;
  if (ids.length < MIN_PLAYERS || ids.length > MAX_PLAYERS) {
    return `players must hold ${MIN_PLAYERS}–${MAX_PLAYERS} ids`;
  }
  for (const id of ids) {
    if (typeof id !== "string") return "player ids must be strings";
    if (RESERVED_IDS.includes(id)) return `player id "${clip(id)}" is reserved`;
    if (!PLAYER_ID_PATTERN.test(id)) return `invalid player id "${clip(id)}"`;
  }
  return isUnique(ids) ? null : "player ids must be unique";
}

/**
 * The seat rules for `createGame`: 1–4 plain objects with exactly the keys `id` and `classId`,
 * ids that pass {@link playersError}, and each `classId` an own key of `rules.classes` whose
 * `kind` is `"base"` (`ownGet`, so `toString`/`constructor` are unknown classes). Returns a unique
 * error message per failure, or `null` when valid.
 */
export function seatsError(seats: unknown, rules: Rules): string | null {
  if (!Array.isArray(seats)) return "players must be an array";
  const list: unknown[] = seats;
  if (list.length < MIN_PLAYERS || list.length > MAX_PLAYERS) {
    return `players must hold ${MIN_PLAYERS}–${MAX_PLAYERS} seats`;
  }
  const seatObjects: Record<string, unknown>[] = [];
  for (const seat of list) {
    if (!isPlainObject(seat)) return "each seat must be an object";
    const keys = Object.keys(seat);
    if (keys.length !== 2 || !Object.hasOwn(seat, "id") || !Object.hasOwn(seat, "classId")) {
      return "each seat must have exactly the keys id and classId";
    }
    seatObjects.push(seat);
  }
  const idsError = playersError(seatObjects.map((seat) => seat.id));
  if (idsError !== null) return idsError;
  for (const seat of seatObjects) {
    const classId = seat.classId;
    if (typeof classId !== "string") return "seat classId must be a string";
    const def = ownGet(rules.classes, classId);
    if (def === undefined) return `unknown class "${clip(classId)}"`;
    if (def.kind !== "base") return `class "${clip(classId)}" is not a base class`;
  }
  return null;
}
