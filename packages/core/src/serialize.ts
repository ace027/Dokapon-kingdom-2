import { fnv1a32 } from "./hash";
import type { Rules } from "./rules";
import { SCHEMA_VERSION, type GameState } from "./types";
import { isPlainObject } from "./validation";

export class SchemaVersionError extends Error {
  override name = "SchemaVersionError";
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

const ROOT_KEYS = ["v", "public", "private", "hidden"] as const;

/**
 * 02-01a compile shim. Parses JSON, rejects non-objects and other schema versions, checks the
 * exact root keys, and then refuses every input: the full v2 validation lands in 02-01b.
 */
export function deserialize(json: string, rules: Rules): GameState {
  if (typeof rules !== "object") throw new TypeError("deserialize: rules must be an object");
  const value: unknown = JSON.parse(json);
  if (!isPlainObject(value)) throw new TypeError("deserialize: state must be an object");
  if (value.v !== SCHEMA_VERSION) {
    throw new SchemaVersionError(`unsupported schema version, expected ${SCHEMA_VERSION}`);
  }
  const own = Object.keys(value);
  if (own.length !== ROOT_KEYS.length || !ROOT_KEYS.every((key) => Object.hasOwn(value, key))) {
    throw new TypeError("deserialize: root keys");
  }
  throw new TypeError("deserialize: v2 validation lands in 02-01b");
}
