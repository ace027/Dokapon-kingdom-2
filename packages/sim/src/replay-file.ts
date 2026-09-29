import { readFileSync } from "node:fs";
import {
  hashState,
  replay,
  rulesHash,
  SettingsError,
  type GameSettings,
  type ReplayResult,
  type Rules,
} from "@usurpia/core";

/** A replay file could not be read, parsed or started. The CLI maps this to exit code 2. */
export class ReplayFileError extends Error {}

/** The file's `rulesHash` differs from the current rules. The CLI maps this to exit code 3. */
export class RulesMismatchError extends ReplayFileError {}

const FILE_KEYS = ["rulesHash", "settings", "actions"] as const;
const HASH_PATTERN = /^[0-9a-f]{8}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Replays a `{ rulesHash, settings, actions[] }` JSON file (exact keys). The file's `rulesHash`
 * is checked before replaying. Actions are untrusted: each one goes through `reduce`, and rejected
 * actions are counted rather than thrown.
 */
export function replayFile(
  filePath: string,
  rules: Rules,
  opts: { allowRulesMismatch?: boolean } = {},
): { line: string; result: ReplayResult } {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    throw new ReplayFileError(`cannot read ${filePath}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ReplayFileError("invalid JSON");
  }

  if (
    !isPlainObject(data) ||
    Object.keys(data).length !== FILE_KEYS.length ||
    !FILE_KEYS.every((key) => Object.hasOwn(data, key)) ||
    typeof data.rulesHash !== "string" ||
    !HASH_PATTERN.test(data.rulesHash) ||
    !Array.isArray(data.actions)
  ) {
    throw new ReplayFileError("expected {rulesHash, settings, actions[]}");
  }

  const fileHash = data.rulesHash;
  const currentHash = rulesHash(rules);
  const mismatch = fileHash !== currentHash;
  if (mismatch && opts.allowRulesMismatch !== true) {
    throw new RulesMismatchError(`rules mismatch: file ${fileHash}, current ${currentHash}`);
  }

  let result: ReplayResult;
  try {
    // Both are untrusted: `createGame` re-validates settings and `reduce` guards every action.
    result = replay(data.settings as GameSettings, data.actions as readonly unknown[], rules);
  } catch (error) {
    if (error instanceof SettingsError) {
      throw new ReplayFileError(`invalid settings: ${error.message}`);
    }
    throw error;
  }

  const { state, events, rejections } = result;
  const suffix = mismatch ? ` rules-mismatch=${fileHash}` : "";
  const line = `hash=${hashState(state)} rules=${currentHash} turn=${state.public.turn} events=${events.length} rejections=${rejections.length}${suffix}`;
  return { line, result };
}
