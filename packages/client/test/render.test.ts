import {
  createGame,
  eventsFor,
  reduce,
  rulesHash,
  viewFor,
  type GameEvent,
  type GameState,
} from "@usurpia/core";
import { describe, expect, it } from "vitest";
import { DEMO_RULES } from "../src/demo-rules";
import { renderView } from "../src/render";

const SETTINGS = {
  v: 2 as const,
  seed: "demo",
  players: [
    { id: "p1", classId: "warrior" },
    { id: "p2", classId: "mage" },
  ],
};
const initial = createGame(SETTINGS, DEMO_RULES);

/** The demo of `main.ts`: p1 and p2 are polled, then p1 commits `yes`. */
function demo(): { state: GameState; events: GameEvent[] } {
  const actions = [
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
  let state = initial;
  const events: GameEvent[] = [];
  for (const action of actions) {
    const result = reduce(state, action, DEMO_RULES);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

describe("DEMO_RULES", () => {
  it("is the shipped content rules (built by buildRules, not a copy)", () => {
    expect(rulesHash(DEMO_RULES)).toBe("84a995db");
  });
});

describe("renderView before any decision", () => {
  it("renders p2's view with the exact line layout", () => {
    expect(renderView(viewFor(initial, "p2"), [])).toBe(
      [
        "Usurpia — viewer: p2",
        "turn 1 · active p1 · phase turn",
        "p1 warrior L1 hp 46 gold 100 bag 1",
        "p2 mage L1 hp 34 gold 100 bag 1",
        "pending: —",
        "events:",
      ].join("\n"),
    );
  });

  it("renders a spectator with the same player lines", () => {
    const text = renderView(viewFor(initial, "spectator"), []);
    expect(text).toContain("viewer: spectator");
    expect(text).toContain("p1 warrior L1 hp 46 gold 100 bag 1");
    expect(text).toContain("p2 mage L1 hp 34 gold 100 bag 1");
    expect(text).toContain("pending: —");
  });
});

describe("renderView during the demo decision", () => {
  const { state, events } = demo();
  const p2 = renderView(viewFor(state, "p2"), eventsFor(events, "p2"));

  it("shows the player lines with bag counts", () => {
    expect(p2).toContain("p1 warrior L1 hp 46 gold 100 bag 1");
    expect(p2).toContain("p2 mage L1 hp 34 gold 100 bag 1");
  });

  it("shows the pending decision and p2's own options", () => {
    expect(p2).toContain("pending: d1 (poll) committed: p1");
    expect(p2).toContain("your options: red, green, blue (default red)");
  });

  it("lists only the events p2 may see and never p1's choice or options", () => {
    expect(p2).toContain("- DecisionOpened");
    expect(p2).toContain("- ChoiceCommitted");
    expect(p2.match(/- PromptOpened/g)).toHaveLength(1);
    expect(p2).not.toContain("yes");
  });

  it("gives a spectator the pending line and no options line", () => {
    const spectator = renderView(viewFor(state, "spectator"), eventsFor(events, "spectator"));
    expect(spectator).toContain("pending: d1 (poll) committed: p1");
    expect(spectator).not.toContain("your options");
    expect(spectator).not.toContain("- PromptOpened");
  });

  it("lists event types one per line", () => {
    expect(p2.endsWith("events:\n- DecisionOpened\n- PromptOpened\n- ChoiceCommitted")).toBe(true);
  });
});
