import { sheetStats } from "./combat/stats";
import { seedRng } from "./rng";
import type { Rules } from "./rules";
import { COMMANDS } from "./rules";
import {
  SCHEMA_VERSION,
  type CharacterPublic,
  type CommandCounts,
  type GameSettings,
  type GameState,
  type PrivateState,
} from "./types";
import { isPlainObject, ownGet, seatsError } from "./validation";

export class SettingsError extends Error {
  override name = "SettingsError";
}

/** Settings may come from untrusted JSON, so re-check everything the types claim. */
function validateSettings(input: unknown, rules: Rules): void {
  if (!isPlainObject(input)) throw new SettingsError("settings must be an object");
  if (input.v !== SCHEMA_VERSION) throw new SettingsError(`settings.v must be ${SCHEMA_VERSION}`);
  if (typeof input.seed !== "string" || input.seed.length === 0) {
    throw new SettingsError("seed must be a non-empty string");
  }
  const error = seatsError(input.players, rules);
  if (error !== null) throw new SettingsError(error);
}

/**
 * Builds the v2 initial state. Every record is built with `Object.fromEntries`, so no id can reach
 * a prototype setter (PIT-002), and each class lookup goes through `ownGet`.
 */
export function createGame(settings: GameSettings, rules: Rules): GameState {
  validateSettings(settings, rules);
  const seats = [...settings.players];
  const first = seats[0];
  if (first === undefined) throw new SettingsError("players must not be empty");
  const ids = seats.map((seat) => seat.id);
  const classIds = Object.keys(rules.classes).sort();
  const mastery = (): Record<string, number> =>
    Object.fromEntries(classIds.map((classId): [string, number] => [classId, 0]));
  const counts = (): CommandCounts =>
    Object.fromEntries(COMMANDS.map((command): [string, number] => [command, 0])) as CommandCounts;

  const entries = seats.map((seat) => {
    const starter = ownGet(rules.classes, seat.classId)?.starter;
    if (starter === undefined || starter === null) {
      throw new SettingsError(`class "${seat.classId}" has no starter loadout`);
    }
    const base: CharacterPublic = {
      classId: seat.classId,
      level: 1,
      xp: 0,
      hp: 1,
      gold: rules.economy.startingGold,
      mastery: mastery(),
      portable: null,
      weapon: starter.weapon,
      shield: starter.shield,
      accessory: starter.accessory,
      battleSpell: starter.battleSpell,
      wardSpell: starter.wardSpell,
    };
    const character: CharacterPublic = { ...base, hp: sheetStats(rules, base).hp };
    const priv: PrivateState = { bag: [...starter.bag], scrolls: [], prompt: null };
    return { id: seat.id, character, priv };
  });
  const characters: Record<string, CharacterPublic> = Object.fromEntries(
    entries.map((e): [string, CharacterPublic] => [e.id, e.character]),
  );
  const privateStates: Record<string, PrivateState> = Object.fromEntries(
    entries.map((e): [string, PrivateState] => [e.id, e.priv]),
  );

  return {
    v: SCHEMA_VERSION,
    public: {
      phase: "turn",
      turn: 1,
      activePlayer: first.id,
      players: ids,
      characters,
      choiceHistory: Object.fromEntries(ids.map((id): [string, CommandCounts] => [id, counts()])),
      pending: null,
      lastReveal: null,
      combat: null,
    },
    private: privateStates,
    hidden: { rng: seedRng(settings.seed), decisionSeq: 0, combatSeq: 0, decision: null },
  };
}
