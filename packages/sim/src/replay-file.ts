import { readFileSync } from "node:fs";
import {
  hashState,
  replay,
  SettingsError,
  type Action,
  type GameSettings,
  type ReplayResult,
} from "@usurpia/core";

/** A replay file could not be read, parsed or started. The CLI maps this to exit code 2. */
export class ReplayFileError extends Error {}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Replays a `{ settings, actions[] }` JSON file. Actions are untrusted: each one goes through
 * `reduce`, and rejected actions are counted rather than thrown.
 */
export function replayFile(filePath: string): { line: string; result: ReplayResult } {
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

  if (!isPlainObject(data) || !("settings" in data) || !Array.isArray(data.actions)) {
    throw new ReplayFileError("expected {settings, actions[]}");
  }

  let result: ReplayResult;
  try {
    // Both are untrusted: `createGame` re-validates settings and `reduce` guards every action.
    result = replay(data.settings as GameSettings, data.actions as readonly Action[]);
  } catch (error) {
    if (error instanceof SettingsError) {
      throw new ReplayFileError(`invalid settings: ${error.message}`);
    }
    throw error;
  }

  const { state, events, rejections } = result;
  const line = `hash=${hashState(state)} turn=${state.public.turn} counter=${state.public.counter} events=${events.length} rejections=${rejections.length}`;
  return { line, result };
}
