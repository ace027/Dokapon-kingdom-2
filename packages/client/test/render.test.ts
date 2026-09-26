import {
  createGame,
  eventsFor,
  reduce,
  viewFor,
  type GameEvent,
  type GameState,
} from "@usurpia/core";
import { describe, expect, it } from "vitest";
import { renderView } from "../src/render";

function demo(): { state: GameState; events: GameEvent[] } {
  let state = createGame({ v: 1, seed: "demo", players: ["p1", "p2"] });
  const events: GameEvent[] = [];
  for (const action of [
    { v: 1, type: "sample/roll", playerId: "p1" },
    { v: 1, type: "sample/setSecret", playerId: "p1", note: "p1 secret" },
  ]) {
    const result = reduce(state, action);
    if (!result.ok) throw new Error(result.error.code);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

describe("renderView", () => {
  const { state, events } = demo();
  const render = (viewer: string) => renderView(viewFor(state, viewer), eventsFor(events, viewer));

  it("renders p2's view without p1's secret", () => {
    const text = render("p2");
    expect(text).toContain("viewer: p2");
    expect(text).toMatch(/last roll: p1 rolled [1-6]/);
    expect(text).toContain("events:");
    expect(text).toContain("- Rolled");
    expect(text).toContain("- TurnAdvanced");
    expect(text).not.toContain("p1 secret");
    // p2 is seated, so `self` is p2's own (empty) private state: the note line shows "(none)",
    // never p1's note.
    expect(text).toContain("your note: (none)");
    expect(text).not.toContain("SecretSet");
  });

  it("renders p1's own note and SecretSet event", () => {
    const text = render("p1");
    expect(text).toContain("your note: p1 secret");
    expect(text).toContain("- SecretSet");
  });

  it("renders a spectator without a note line", () => {
    const text = render("spectator");
    expect(text).toContain("viewer: spectator");
    expect(text).not.toContain("your note");
    expect(text).not.toContain("SecretSet");
  });

  it("renders the exact line layout", () => {
    const fresh = createGame({ v: 1, seed: "demo", players: ["p1", "p2"] });
    expect(renderView(viewFor(fresh, "p2"), [])).toBe(
      [
        "Usurpia — viewer: p2",
        "turn 1 · active p1 · phase turn",
        "counter 0",
        "last roll: —",
        "your note: (none)",
        "events:",
      ].join("\n"),
    );
  });
});
