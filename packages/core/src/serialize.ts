import { fnv1a32 } from "./hash";
import { SCHEMA_VERSION, type GameState } from "./types";

export class SchemaVersionError extends Error {
  override name = "SchemaVersionError";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function compareKeys(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function write(value: unknown, path: string): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`stableStringify: non-finite number at ${path}`);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items: unknown[] = value;
    const parts: string[] = [];
    for (let i = 0; i < items.length; i++) {
      parts.push(write(items[i], `${path}[${i}]`));
    }
    return `[${parts.join(",")}]`;
  }
  if (isPlainObject(value)) {
    const parts: string[] = [];
    for (const key of Object.keys(value).sort(compareKeys)) {
      parts.push(`${JSON.stringify(key)}:${write(value[key], `${path}.${key}`)}`);
    }
    return `{${parts.join(",")}}`;
  }
  throw new TypeError(`stableStringify: unsupported ${typeof value} value at ${path}`);
}

/**
 * Canonical JSON: object keys sorted by UTF-16 code units. Throws `TypeError` (naming the
 * offending path, e.g. `$.hidden.rng[2]`) on undefined, functions, symbols, bigints,
 * non-finite numbers and non-plain objects.
 */
export function stableStringify(value: unknown): string {
  return write(value, "$");
}

export function hashState(state: GameState): string {
  return fnv1a32(stableStringify(state));
}

export function serialize(state: GameState): string {
  return stableStringify(state);
}

function isU32(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 2 ** 32;
}

function assertStateShape(value: unknown): asserts value is GameState {
  if (!isPlainObject(value)) {
    throw new TypeError("deserialize: state must be a plain object");
  }
  if (value.v !== SCHEMA_VERSION) {
    throw new SchemaVersionError(
      `deserialize: unsupported schema version (expected v=${SCHEMA_VERSION})`,
    );
  }
  const { public: pub, private: priv, hidden } = value;
  if (!isPlainObject(pub) || !isPlainObject(priv) || !isPlainObject(hidden)) {
    throw new TypeError("deserialize: public, private and hidden must be plain objects");
  }
  if (pub.phase !== "turn" && pub.phase !== "decision") {
    throw new TypeError("deserialize: public.phase must be 'turn' or 'decision'");
  }
  const players = pub.players;
  if (
    !Array.isArray(players) ||
    players.length === 0 ||
    !players.every((p) => typeof p === "string")
  ) {
    throw new TypeError("deserialize: public.players must be a non-empty string array");
  }
  const rng = hidden.rng;
  if (!Array.isArray(rng) || rng.length !== 4 || !rng.every(isU32)) {
    throw new TypeError("deserialize: hidden.rng must be 4 integers in [0, 2**32)");
  }
}

/**
 * Parses canonical JSON back into a `GameState`. `SyntaxError` propagates from `JSON.parse`;
 * a wrong `v` throws `SchemaVersionError`; structural problems throw `TypeError`.
 */
export function deserialize(json: string): GameState {
  const value: unknown = JSON.parse(json);
  assertStateShape(value);
  return value;
}
