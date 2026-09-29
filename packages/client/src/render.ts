import type { GameEvent, PlayerView } from "@usurpia/core";

/** Comma lists are joined with ", " (decided in 02-01b; the spec does not fix the separator). */
const LIST_SEPARATOR = ", ";
const NONE = "—";

/**
 * Pure text rendering of a redacted player view. Takes only `viewFor`/`eventsFor` output, so the
 * client never sees raw `GameState`. No DOM access here; `main.ts` owns the DOM.
 */
export function renderView(view: PlayerView, events: readonly GameEvent[]): string {
  const { turn, activePlayer, phase, players, characters, pending } = view.public;
  const lines = [
    `Usurpia — viewer: ${view.viewer}`,
    `turn ${turn} · active ${activePlayer} · phase ${phase}`,
  ];
  for (const id of players) {
    const ch = Object.hasOwn(characters, id) ? characters[id] : undefined;
    if (ch === undefined) continue;
    const bag = Object.hasOwn(view.counts, id) ? view.counts[id]?.bag : undefined;
    lines.push(`${id} ${ch.classId} L${ch.level} hp ${ch.hp} gold ${ch.gold} bag ${bag ?? 0}`);
  }
  if (pending === null) lines.push(`pending: ${NONE}`);
  else {
    const committed = pending.committed.length > 0 ? pending.committed.join(LIST_SEPARATOR) : NONE;
    lines.push(`pending: ${pending.id} (${pending.kind}) committed: ${committed}`);
  }
  const prompt = view.self?.prompt;
  if (prompt) {
    lines.push(`your options: ${prompt.options.join(LIST_SEPARATOR)} (default ${prompt.default})`);
  }
  lines.push("events:", ...events.map((event) => `- ${event.type}`));
  return lines.join("\n");
}
