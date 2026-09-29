import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { GameEvent } from "../src/events";
import { onlyPlayers, PUBLIC } from "../src/events";
import { createGame } from "../src/game";
import { reduce } from "../src/reducer";
import type { GameState } from "../src/types";
import { ownGet } from "../src/validation";
import { eventsFor, redactEvent, viewFor } from "../src/views";
import { arbGame, PLAYER_POOL, SENTINELS, seatIds } from "./arbitraries";
import { applyAll, newGame } from "./fixtures/build";
import { TEST_RULES } from "./fixtures/test-rules";
import { usePurityTraps } from "./purity-traps";

usePurityTraps();

const PROMPT_FOR_P1: GameEvent = {
  v: 2,
  type: "PromptOpened",
  visibility: onlyPlayers(["p1"]),
  decisionId: "d1",
  playerId: "p1",
  options: ["yes", "no"],
  default: "no",
};

const OPENED: GameEvent = {
  v: 2,
  type: "DecisionOpened",
  visibility: PUBLIC,
  decisionId: "d1",
  kind: "poll",
  required: ["p1"],
};

function withSentinel(state: GameState): GameState {
  return {
    ...state,
    private: { ...state.private, p1: { bag: ["__SECRET_p1__"], scrolls: [], prompt: null } },
  };
}

describe("viewFor", () => {
  it("gives a seated player their own private partition", () => {
    const state = newGame();
    expect(viewFor(state, "p1").self).toEqual(state.private.p1);
    expect(viewFor(state, "p2").self).toEqual(state.private.p2);
  });

  it.each(["spectator", "ghost", "toString", "valueOf", "hasOwnProperty"])(
    "gives %s no private partition",
    (viewer) => {
      expect(viewFor(newGame(), viewer).self).toBeNull();
    },
  );

  it("never leaks hidden state or another player's private data", () => {
    const view = viewFor(withSentinel(newGame()), "p2");
    const json = JSON.stringify(view);
    expect(json).not.toContain('"hidden"');
    expect(json).not.toContain('"rng"');
    expect(json).not.toContain("__SECRET_p1__");
    expect(view.self).toEqual(newGame().private.p2);
  });

  it("carries the version, viewer, the public partition, own private data and counts only", () => {
    const state = newGame();
    const view = viewFor(state, "p1");
    expect(Object.keys(view).sort()).toEqual(["counts", "public", "self", "v", "viewer"]);
    expect(view.public).toEqual(state.public);
    expect(view.viewer).toBe("p1");
    expect(view.v).toBe(2);
  });
});

describe("redactEvent / eventsFor", () => {
  it("shows a private PromptOpened to its owner only", () => {
    expect(redactEvent(PROMPT_FOR_P1, "p1")).toBe(PROMPT_FOR_P1);
    expect(redactEvent(PROMPT_FOR_P1, "p2")).toBeNull();
    expect(redactEvent(PROMPT_FOR_P1, "spectator")).toBeNull();
  });

  it("shows public events to everyone", () => {
    for (const viewer of ["p1", "p2", "spectator"]) {
      expect(redactEvent(OPENED, viewer)).toBe(OPENED);
    }
  });

  it("keeps order and filters per viewer without mutating the input", () => {
    const events = [OPENED, PROMPT_FOR_P1];
    expect(eventsFor(events, "p1")).toEqual([OPENED, PROMPT_FOR_P1]);
    expect(eventsFor(events, "p2")).toEqual([OPENED]);
    expect(events).toHaveLength(2);
  });
});

describe("viewFor counts", () => {
  const COUNTS = { p1: { bag: 1, scrolls: 0 }, p2: { bag: 2, scrolls: 0 } };

  it("gives every seated viewer the bag and scroll counts of every seat", () => {
    for (const viewer of ["p1", "p2"]) expect(viewFor(newGame(), viewer).counts).toEqual(COUNTS);
  });

  it("gives a spectator the same counts and no private partition", () => {
    const view = viewFor(newGame(), "spectator");
    expect(view.counts).toEqual(COUNTS);
    expect(view.self).toBeNull();
  });

  it("counts scrolls and reflects a changed bag length, never the contents", () => {
    const base = newGame();
    const state: GameState = {
      ...base,
      private: {
        ...base.private,
        p1: { bag: ["herb", "herb", "tonic"], scrolls: ["haste", "fog"], prompt: null },
      },
    };
    const view = viewFor(state, "p2");
    expect(view.counts.p1).toEqual({ bag: 3, scrolls: 2 });
    expect(JSON.stringify(view)).not.toContain("haste");
    expect(JSON.stringify(view)).not.toContain("tonic");
  });

  it("matches the exact view shape for every viewer", () => {
    const state = newGame();
    for (const viewer of ["p1", "p2", "spectator", "toString"]) {
      expect(viewFor(state, viewer)).toEqual({
        v: 2,
        viewer,
        public: state.public,
        self: state.public.players.includes(viewer) ? ownGet(state.private, viewer) : null,
        counts: COUNTS,
      });
    }
  });

  it("has no hidden key", () => {
    for (const viewer of ["p1", "p2", "spectator"]) {
      expect("hidden" in viewFor(newGame(), viewer)).toBe(false);
    }
  });
});

describe("viewFor during an open poll", () => {
  const state = applyAll(newGame(), [
    {
      v: 2,
      type: "decision/open",
      playerId: "system",
      prompts: [
        { playerId: "p1", options: ["only-p1-a", "only-p1-b"], default: "only-p1-a" },
        { playerId: "p2", options: ["only-p2-a", "only-p2-b"], default: "only-p2-b" },
      ],
    },
    { v: 2, type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "only-p1-b" },
  ]).state;

  it("shows p2 its own prompt and never p1's options or committed choice", () => {
    const view = viewFor(state, "p2");
    expect(view.self?.prompt).toEqual({
      decisionId: "d1",
      options: ["only-p2-a", "only-p2-b"],
      default: "only-p2-b",
    });
    const json = JSON.stringify(view);
    expect(json).not.toContain("only-p1");
    expect(view.public.pending?.committed).toEqual(["p1"]);
  });

  it("shows a spectator neither prompt", () => {
    const view = viewFor(state, "spectator");
    expect(view.self).toBeNull();
    expect(JSON.stringify(view)).not.toContain("only-p");
  });
});

describe("structural redaction property", () => {
  const VIEWERS = ["spectator", ...PLAYER_POOL];

  it("never leaks another seat's data, hidden state or a committed choice", () => {
    fc.assert(
      fc.property(arbGame, ([settings, script]) => {
        const ids = seatIds(settings);
        let state = createGame(settings, TEST_RULES);
        const verify = (events: readonly GameEvent[]): void => {
          for (const viewer of VIEWERS) {
            const view = viewFor(state, viewer);
            const seated = ids.includes(viewer);
            expect(view).toEqual({
              v: 2,
              viewer,
              public: state.public,
              self: seated ? (ownGet(state.private, viewer) ?? null) : null,
              counts: Object.fromEntries(
                ids.map((id) => [
                  id,
                  {
                    bag: ownGet(state.private, id)?.bag.length,
                    scrolls: ownGet(state.private, id)?.scrolls.length,
                  },
                ]),
              ),
            });
            expect("hidden" in view).toBe(false);
            const json = JSON.stringify(view);
            expect(json).not.toContain('"decisionSeq"');
            expect(json).not.toContain('"rng"');
            // Choices are public once revealed, so blank them out before looking for sentinels.
            const blanked = JSON.stringify({
              ...view,
              public: { ...view.public, lastReveal: null },
            });
            for (const [seat, tokens] of SENTINELS.entries()) {
              if (ids[seat] === viewer) continue;
              for (const token of tokens) expect(blanked).not.toContain(`"${token}"`);
            }
            for (const event of eventsFor(events, viewer)) {
              if (event.type === "PromptOpened") expect(event.playerId).toBe(viewer);
              if (event.type === "ChoiceCommitted") expect("choice" in event).toBe(false);
            }
          }
        };
        verify([]);
        for (const action of script) {
          const result = reduce(state, action, TEST_RULES);
          if (!result.ok) continue;
          state = result.state;
          verify(result.events);
        }
      }),
      { numRuns: 200 },
    );
  });
});
