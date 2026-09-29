import type { GameEvent, PlayerView } from "@usurpia/core";

/**
 * Pure text rendering of a redacted player view. Takes only `viewFor`/`eventsFor` output, so the
 * client never sees raw `GameState`. No DOM access here; `main.ts` owns the DOM.
 * (02-01a interim: 02-01b adds the bag counts and the pending/options lines.)
 */
export function renderView(view: PlayerView, events: readonly GameEvent[]): string {
  const { turn, activePlayer, phase, players, characters } = view.public;
  const lines = [
    `Usurpia — viewer: ${view.viewer}`,
    `turn ${turn} · active ${activePlayer} · phase ${phase}`,
  ];
  for (const id of players) {
    const ch = Object.hasOwn(characters, id) ? characters[id] : undefined;
    if (ch === undefined) continue;
    lines.push(`${id} ${ch.classId} L${ch.level} hp ${ch.hp} gold ${ch.gold}`);
  }
  lines.push("events:", ...events.map((event) => `- ${event.type}`));
  return lines.join("\n");
}
