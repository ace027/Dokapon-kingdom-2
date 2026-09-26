import { seedRng } from "./rng";
import {
  PLAYER_ID_PATTERN,
  RESERVED_IDS,
  SCHEMA_VERSION,
  type GameSettings,
  type GameState,
  type PrivateState,
} from "./types";

export class SettingsError extends Error {
  override name = "SettingsError";
}

const MIN_PLAYERS = 1;
const MAX_PLAYERS = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Settings may come from untrusted JSON, so re-check everything the types claim. */
function validateSettings(input: unknown): void {
  if (!isRecord(input)) throw new SettingsError("settings must be an object");
  if (input.v !== SCHEMA_VERSION) throw new SettingsError(`settings.v must be ${SCHEMA_VERSION}`);
  if (typeof input.seed !== "string" || input.seed.length === 0) {
    throw new SettingsError("seed must be a non-empty string");
  }
  if (!Array.isArray(input.players)) throw new SettingsError("players must be an array");
  const players: unknown[] = input.players;
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new SettingsError(`players must hold ${MIN_PLAYERS}–${MAX_PLAYERS} ids`);
  }
  for (const id of players) {
    if (typeof id !== "string") throw new SettingsError("player ids must be strings");
    if (RESERVED_IDS.includes(id)) throw new SettingsError(`player id "${id}" is reserved`);
    if (!PLAYER_ID_PATTERN.test(id)) throw new SettingsError(`invalid player id "${id}"`);
  }
  if (new Set(players).size !== players.length)
    throw new SettingsError("player ids must be unique");
}

export function createGame(settings: GameSettings): GameState {
  validateSettings(settings);
  const players = [...settings.players];
  const firstPlayer = players[0];
  if (firstPlayer === undefined) throw new SettingsError("players must not be empty");
  const privateStates: Record<string, PrivateState> = {};
  for (const p of players) privateStates[p] = { note: null };
  return {
    v: SCHEMA_VERSION,
    public: {
      phase: "turn",
      turn: 1,
      activePlayer: firstPlayer,
      players,
      counter: 0,
      lastRoll: null,
      pending: null,
      lastReveal: null,
    },
    private: privateStates,
    hidden: { rng: seedRng(settings.seed), decisionSeq: 0, decision: null },
  };
}
