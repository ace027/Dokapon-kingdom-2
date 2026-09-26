// Internal helpers shared by createGame, reduce and deserialize. Not re-exported from index.ts.
import { PLAYER_ID_PATTERN, RESERVED_IDS, type Choice } from "./types";

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

export function isChoice(value: unknown): value is Choice {
  return value === "A" || value === "B" || value === "C";
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
