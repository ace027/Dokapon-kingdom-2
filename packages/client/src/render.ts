import type { GameEvent, PlayerView } from "@usurpia/core";

/**
 * Pure text rendering of a redacted player view. Takes only `viewFor`/`eventsFor` output, so the
 * client never sees raw `GameState`. No DOM access here; `main.ts` owns the DOM.
 */
export function renderView(view: PlayerView, events: readonly GameEvent[]): string {
  const { turn, activePlayer, phase, counter, lastRoll } = view.public;
  const lines = [
    `Usurpia — viewer: ${view.viewer}`,
    `turn ${turn} · active ${activePlayer} · phase ${phase}`,
    `counter ${counter}`,
    lastRoll ? `last roll: ${lastRoll.playerId} rolled ${lastRoll.value}` : "last roll: —",
  ];
  if (view.self !== null) lines.push(`your note: ${view.self.note ?? "(none)"}`);
  lines.push("events:", ...events.map((event) => `- ${event.type}`));
  return lines.join("\n");
}
