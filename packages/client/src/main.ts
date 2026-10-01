import {
  createGame,
  eventsFor,
  reduce,
  viewFor,
  type GameEvent,
  type GameState,
} from "@usurpia/core";
import { DEMO_RULES } from "./demo-rules";
import { renderView } from "./render";

const DEMO_ACTIONS: readonly unknown[] = [
  {
    v: 2,
    type: "decision/open",
    playerId: "system",
    prompts: [
      { playerId: "p1", options: ["yes", "no"], default: "no" },
      { playerId: "p2", options: ["red", "green", "blue"], default: "red" },
    ],
  },
  { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "yes" },
];

let state: GameState = createGame(
  {
    v: 2,
    seed: "demo",
    players: [
      { id: "p1", classId: "warrior" },
      { id: "p2", classId: "mage" },
    ],
  },
  DEMO_RULES,
);
const events: GameEvent[] = [];
for (const action of DEMO_ACTIONS) {
  const result = reduce(state, action, DEMO_RULES);
  if (!result.ok) throw new Error(`demo action rejected: ${result.error.code}`);
  state = result.state;
  events.push(...result.events);
}

const app = document.querySelector("#app");
if (app) app.textContent = renderView(viewFor(state, "p2"), eventsFor(events, "p2"));
