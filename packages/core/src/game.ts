import { seedRng } from "./rng";
import { SCHEMA_VERSION, type GameSettings, type GameState, type PrivateState } from "./types";
import { playersError } from "./validation";

export class SettingsError extends Error {
  override name = "SettingsError";
}

/** Settings may come from untrusted JSON, so re-check everything the types claim. */
function validateSettings(input: unknown): void {
  if (typeof input !== "object" || input === null) {
    throw new SettingsError("settings must be an object");
  }
  const settings = input as Record<string, unknown>;
  if (settings.v !== SCHEMA_VERSION) {
    throw new SettingsError(`settings.v must be ${SCHEMA_VERSION}`);
  }
  if (typeof settings.seed !== "string" || settings.seed.length === 0) {
    throw new SettingsError("seed must be a non-empty string");
  }
  const error = playersError(settings.players);
  if (error !== null) throw new SettingsError(error);
}

export function createGame(settings: GameSettings): GameState {
  validateSettings(settings);
  const players = [...settings.players];
  const firstPlayer = players[0];
  if (firstPlayer === undefined) throw new SettingsError("players must not be empty");
  // fromEntries defines own data properties, so no id can reach a prototype setter.
  const privateStates: Record<string, PrivateState> = Object.fromEntries(
    players.map((p): [string, PrivateState] => [p, { note: null }]),
  );
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
