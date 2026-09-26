import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  createGame,
  eventsFor,
  reduce,
  redactEvent,
  viewFor,
  type GameEvent,
  type GameState,
  type Viewer,
} from "../src/index";
import { arbGame } from "./arbitraries";

const sentinel = (playerId: string): string => `__SECRET_${playerId}__`;

/** Applies `actions` in order, failing the test on any rejection; returns the final state and all events. */
function play(state: GameState, actions: readonly unknown[]) {
  let current = state;
  const events: GameEvent[] = [];
  for (const action of actions) {
    const result = reduce(current, action);
    if (!result.ok) throw new Error(`unexpected rejection: ${result.error.code}`);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

function sampleGame() {
  return play(createGame({ v: 1, seed: "views", players: ["p1", "p2"] }), [
    { v: 1, type: "sample/roll", playerId: "p1" },
    { v: 1, type: "sample/setSecret", playerId: "p1", note: "p1 secret" },
    { v: 1, type: "decision/open", playerId: "system", required: ["p1", "p2"], defaultChoice: "A" },
    { v: 1, type: "decision/commit", playerId: "p2", decisionId: "d1", choice: "C" },
  ]);
}

describe("viewFor", () => {
  it("gives spectators the public state and no private state", () => {
    const { state } = sampleGame();
    const view = viewFor(state, "spectator");
    expect(view).toEqual({ v: 1, viewer: "spectator", public: state.public, self: null });
    expect(Object.keys(view).sort()).toEqual(["public", "self", "v", "viewer"]);
  });

  it("gives an unknown id no private state", () => {
    const { state } = sampleGame();
    expect(viewFor(state, "ghost").self).toBeNull();
    expect(viewFor(state, "constructor").self).toBeNull();
  });

  it("includes the viewer's own note and nothing hidden", () => {
    const { state } = sampleGame();
    const own = viewFor(state, "p1");
    expect(own.self).toEqual({ note: "p1 secret" });
    expect("hidden" in own).toBe(false);
    expect("private" in own).toBe(false);
    expect(JSON.stringify(viewFor(state, "p2"))).not.toContain("p1 secret");
    expect(viewFor(state, "p2").self).toEqual({ note: null });
  });

  it("does not expose committed choices of a pending decision", () => {
    const { state } = sampleGame();
    expect(state.hidden.decision?.choices).toEqual({ p2: "C" });
    for (const viewer of ["p1", "p2", "spectator"] as const) {
      const json = JSON.stringify(viewFor(state, viewer));
      expect(json).not.toContain('"C"');
      expect(json).not.toContain('"rng"');
      expect(json).not.toContain('"decisionSeq"');
    }
  });
});

describe("redactEvent / eventsFor", () => {
  it("shows SecretSet only to its owner", () => {
    const { events } = sampleGame();
    const secretSet = events.find((event) => event.type === "SecretSet");
    expect(secretSet).toBeDefined();
    if (!secretSet) return;
    expect(redactEvent(secretSet, "p1")).toBe(secretSet);
    expect(redactEvent(secretSet, "p2")).toBeNull();
    expect(redactEvent(secretSet, "spectator")).toBeNull();
    expect(redactEvent(secretSet, "ghost")).toBeNull();
  });

  it("shows public events to everyone, including spectators", () => {
    const { events } = sampleGame();
    const rolled = events.find((event) => event.type === "Rolled");
    expect(rolled).toBeDefined();
    if (!rolled) return;
    for (const viewer of ["p1", "p2", "spectator", "ghost"]) {
      expect(redactEvent(rolled, viewer)).toBe(rolled);
    }
  });

  it("emits ChoiceCommitted without a choice key", () => {
    const { events } = sampleGame();
    const committed = events.filter((event) => event.type === "ChoiceCommitted");
    expect(committed).toHaveLength(1);
    for (const event of committed) {
      expect("choice" in event).toBe(false);
      expect(JSON.stringify(eventsFor([event], "p1"))).not.toContain('"C"');
    }
  });

  it("hides a players-visibility event with empty ids from everyone", () => {
    const event: GameEvent = {
      v: 1,
      type: "SecretSet",
      visibility: { kind: "players", ids: [] },
      playerId: "p1",
      note: "x",
    };
    for (const viewer of ["p1", "p2", "spectator", "ghost"]) {
      expect(redactEvent(event, viewer)).toBeNull();
    }
  });

  it("preserves order and does not mutate the input", () => {
    const { events } = sampleGame();
    const snapshot = JSON.stringify(events);
    const forP2 = eventsFor(events, "p2");
    expect(JSON.stringify(events)).toBe(snapshot);
    expect(forP2).not.toBe(events);
    expect(forP2.map((event) => event.type)).toEqual([
      "Rolled",
      "TurnAdvanced",
      "DecisionOpened",
      "ChoiceCommitted",
    ]);
    expect(eventsFor(events, "p1").map((event) => event.type)).toEqual([
      "Rolled",
      "TurnAdvanced",
      "SecretSet",
      "DecisionOpened",
      "ChoiceCommitted",
    ]);
  });
});

describe("leak property", () => {
  it("never shows hidden state or another player's secret to any viewer", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        const players = settings.players;
        const viewers: Viewer[] = [...players, "spectator"];

        const seeded = play(
          createGame(settings),
          players.map((p) => ({ v: 1, type: "sample/setSecret", playerId: p, note: sentinel(p) })),
        );
        let state = seeded.state;
        const events: GameEvent[] = [...seeded.events];
        // Sanity: each owner really sees their own sentinel, so the negative checks are meaningful.
        for (const p of players) expect(JSON.stringify(viewFor(state, p))).toContain(sentinel(p));

        const check = () => {
          const decision = state.hidden.decision;
          for (const viewer of viewers) {
            const view = viewFor(state, viewer);
            const json = JSON.stringify(view);
            const eventsJson = JSON.stringify(eventsFor(events, viewer));
            // The view is exactly the public partition plus the viewer's own private entry.
            expect(Object.keys(view).sort()).toEqual(["public", "self", "v", "viewer"]);
            expect(view.public).toEqual(state.public);
            expect(view.self).toEqual(
              Object.hasOwn(state.private, viewer) ? state.private[viewer] : null,
            );
            expect("hidden" in view).toBe(false);
            expect(json).not.toContain('"rng"');
            expect(json).not.toContain('"decisionSeq"');
            expect(json).not.toContain('"defaultChoice"');
            if (decision !== null) {
              // Beyond `public` (checked equal to state.public above), nothing may carry another
              // player's committed choice while the decision is still hidden.
              const restJson = JSON.stringify({ ...view, public: null });
              expect(restJson).not.toContain('"choices"');
              for (const [other, choice] of Object.entries(decision.choices)) {
                if (other === viewer) continue;
                expect(restJson).not.toContain(
                  `${JSON.stringify(other)}:${JSON.stringify(choice)}`,
                );
              }
            }
            for (const other of players) {
              if (other === viewer) continue;
              expect(json).not.toContain(sentinel(other));
              expect(eventsJson).not.toContain(sentinel(other));
            }
            for (const event of eventsFor(events, viewer)) {
              if (event.type === "SecretSet") expect(event.playerId).toBe(viewer);
              if (event.type === "ChoiceCommitted") expect("choice" in event).toBe(false);
            }
          }
        };

        check();
        for (const action of script) {
          const result = reduce(state, action);
          if (result.ok) {
            state = result.state;
            events.push(...result.events);
          }
          check();
        }
      }),
      { numRuns: 200 },
    );
  });
});
