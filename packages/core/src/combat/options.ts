// Pure prompt/role helpers for the combat flow (no GameState). `DEFENDER_OPTIONS` is a literal, so
// nothing here reads a `rules.ts`/`serialize.ts` value at module load (import-cycle guard).
import type { ContentId, DefendCommand, Rules } from "../rules";
import type { CharacterPublic, CombatState, PlayerId } from "../types";
import { ownGet } from "../validation";

/**
 * Defender commands, default `guard`. `ward` is ALWAYS offered, even with no ward spell equipped
 * (D2): Spell x Ward then uses the Guard multiplier but still blocks spell side effects.
 */
export const DEFENDER_OPTIONS: readonly DefendCommand[] = ["guard", "counter", "ward"];

/**
 * Attacker options, default `attack`: attack, strike, spell (only with a battle spell), flee, then
 * `item:<id>` for each distinct bag id (first-occurrence order) whose `use` is `combat` or `both`.
 */
export function attackerOptions(
  rules: Rules,
  ch: CharacterPublic,
  bag: readonly ContentId[],
): string[] {
  const options = ["attack", "strike"];
  if (ch.battleSpell !== null) options.push("spell");
  options.push("flee");
  for (const id of new Set(bag)) {
    const use = ownGet(rules.items, id)?.use;
    if (use === "combat" || use === "both") options.push(`item:${id}`);
  }
  return options;
}

/** Exchange 1: the first side attacks; exchange 2: the other side. */
export function exchangeRoles(c: CombatState): { attacker: 0 | 1; defender: 0 | 1 } {
  const other = c.first === 0 ? 1 : 0;
  return c.exchange === 1
    ? { attacker: c.first, defender: other }
    : { attacker: other, defender: c.first };
}

/**
 * The players who must commit for the current exchange: the attacker (if a player) then the
 * defender (if a player and not stunned). A stunned attacker skips its exchange, so nobody is
 * required then (`[]`).
 */
export function requiredFor(c: CombatState): PlayerId[] {
  const { attacker, defender } = exchangeRoles(c);
  const a = c.sides[attacker];
  const d = c.sides[defender];
  if (a.mods.stun) return [];
  const required: PlayerId[] = [];
  if (a.kind === "player") required.push(a.playerId);
  if (d.kind === "player" && !d.mods.stun) required.push(d.playerId);
  return required;
}
