import { createGame, viewFor } from "@usurpia/core";
import { DEMO_RULES } from "./demo-rules";
import { renderView } from "./render";

const state = createGame(
  {
    v: 2,
    seed: "demo",
    players: [
      { id: "p1", classId: "fighter" },
      { id: "p2", classId: "caster" },
    ],
  },
  DEMO_RULES,
);

const app = document.querySelector("#app");
if (app) app.textContent = renderView(viewFor(state, "p2"), []);
