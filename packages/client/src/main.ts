import { createGame, eventsFor, reduce, viewFor, type GameEvent } from "@usurpia/core";
import { renderView } from "./render";

const created = createGame({ v: 1, seed: "demo", players: ["p1", "p2"] });

let state = created;
const events: GameEvent[] = [];
for (const action of [
  { v: 1, type: "sample/roll", playerId: "p1" },
  { v: 1, type: "sample/setSecret", playerId: "p1", note: "p1 secret" },
] as const) {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(`demo action rejected: ${result.error.code}`);
  state = result.state;
  events.push(...result.events);
}

const app = document.querySelector("#app");
if (app) app.textContent = renderView(viewFor(state, "p2"), eventsFor(events, "p2"));
