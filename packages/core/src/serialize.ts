import { fnv1a32 } from "./hash";
import { SCHEMA_VERSION, type GameState } from "./types";
import { isChoice, isPlainObject, isStringArray, isUnique, playersError } from "./validation";

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

function isU32(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 2 ** 32;
}

function isNonNegativeSafeInt(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function shapeError(message: string): never {
  throw new TypeError(`deserialize: ${message}`);
}

function isSubset(values: readonly unknown[], of: readonly unknown[]): boolean {
  return values.every((value) => of.includes(value));
}

/** Own keys of `record` are exactly `keys` (as a set). */
function hasExactlyOwnKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Object.keys(record);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(record, key));
}

/** A plain object mapping own keys to choices; returns its keys. */
function choiceRecordKeys(value: unknown, label: string): string[] {
  if (!isPlainObject(value)) shapeError(`${label} must be a plain object`);
  const keys = Object.keys(value);
  if (!keys.every((key) => isChoice(value[key]))) shapeError(`${label} values must be choices`);
  return keys;
}

function assertPublicDecision(
  pending: unknown,
  decision: unknown,
  players: readonly string[],
): void {
  if (!isPlainObject(pending)) shapeError("public.pending must be an object in phase 'decision'");
  if (!isPlainObject(decision)) shapeError("hidden.decision must be an object in phase 'decision'");
  if (typeof pending.id !== "string") shapeError("public.pending.id must be a string");
  if (pending.kind !== "sample") shapeError("public.pending.kind must be 'sample'");
  const { required, committed } = pending;
  if (
    !isStringArray(required) ||
    required.length === 0 ||
    !isUnique(required) ||
    !isSubset(required, players)
  ) {
    shapeError("public.pending.required must be non-empty unique players");
  }
  if (!isStringArray(committed) || !isUnique(committed) || !isSubset(committed, required)) {
    shapeError("public.pending.committed must be unique required players");
  }
  if (decision.id !== pending.id) shapeError("hidden.decision.id must equal public.pending.id");
  if (!isChoice(decision.defaultChoice)) shapeError("hidden.decision.defaultChoice invalid");
  const chosen = choiceRecordKeys(decision.choices, "hidden.decision.choices");
  if (chosen.length !== committed.length || !isSubset(committed, chosen)) {
    shapeError("hidden.decision.choices keys must equal public.pending.committed");
  }
}

/** Full structural validation (spec: deserialize contract, review cycle 1 amendment). */
function assertStateShape(value: unknown): asserts value is GameState {
  if (!isPlainObject(value)) shapeError("state must be a plain object");
  if (value.v !== SCHEMA_VERSION) {
    throw new SchemaVersionError(
      `deserialize: unsupported schema version (expected v=${SCHEMA_VERSION})`,
    );
  }
  const { public: pub, private: priv, hidden } = value;
  if (!isPlainObject(pub) || !isPlainObject(priv) || !isPlainObject(hidden)) {
    shapeError("public, private and hidden must be plain objects");
  }

  const playersProblem = playersError(pub.players);
  if (playersProblem !== null) shapeError(`public.${playersProblem}`);
  const players = pub.players as readonly string[];
  if (typeof pub.activePlayer !== "string" || !players.includes(pub.activePlayer)) {
    shapeError("public.activePlayer must be a player");
  }
  if (pub.phase !== "turn" && pub.phase !== "decision") {
    shapeError("public.phase must be 'turn' or 'decision'");
  }
  if (!isNonNegativeSafeInt(pub.turn)) shapeError("public.turn must be a non-negative integer");
  if (!isNonNegativeSafeInt(pub.counter)) {
    shapeError("public.counter must be a non-negative integer");
  }
  if (!isNonNegativeSafeInt(hidden.decisionSeq)) {
    shapeError("hidden.decisionSeq must be a non-negative integer");
  }

  if (!hasExactlyOwnKeys(priv, players)) shapeError("private keys must equal public.players");
  for (const p of players) {
    const entry = priv[p];
    if (!isPlainObject(entry) || (entry.note !== null && typeof entry.note !== "string")) {
      shapeError("private entries must be {note: string | null}");
    }
  }

  const lastRoll = pub.lastRoll;
  if (lastRoll !== null) {
    if (
      !isPlainObject(lastRoll) ||
      typeof lastRoll.playerId !== "string" ||
      !players.includes(lastRoll.playerId) ||
      typeof lastRoll.value !== "number" ||
      !Number.isInteger(lastRoll.value) ||
      lastRoll.value < 1 ||
      lastRoll.value > 6
    ) {
      shapeError("public.lastRoll must be null or {playerId, value 1..6}");
    }
  }

  if (pub.phase === "turn") {
    if (pub.pending !== null || hidden.decision !== null) {
      shapeError("public.pending and hidden.decision must be null in phase 'turn'");
    }
  } else {
    assertPublicDecision(pub.pending, hidden.decision, players);
  }

  const lastReveal = pub.lastReveal;
  if (lastReveal !== null) {
    if (!isPlainObject(lastReveal) || typeof lastReveal.decisionId !== "string") {
      shapeError("public.lastReveal must be null or {decisionId, choices, timedOut}");
    }
    const revealed = choiceRecordKeys(lastReveal.choices, "public.lastReveal.choices");
    if (!isSubset(revealed, players)) shapeError("public.lastReveal.choices keys must be players");
    const timedOut = lastReveal.timedOut;
    if (!isStringArray(timedOut) || !isSubset(timedOut, players)) {
      shapeError("public.lastReveal.timedOut must be players");
    }
  }

  const rng = hidden.rng;
  if (!Array.isArray(rng) || rng.length !== 4 || !rng.every(isU32)) {
    shapeError("hidden.rng must be 4 integers in [0, 2**32)");
  }
}

/**
 * Parses canonical JSON back into a `GameState`. `SyntaxError` propagates from `JSON.parse`;
 * a wrong `v` throws `SchemaVersionError`; any structural problem (full shape, see the spec's
 * deserialize contract) throws `TypeError`.
 */
export function deserialize(json: string): GameState {
  const value: unknown = JSON.parse(json);
  assertStateShape(value);
  return value;
}
