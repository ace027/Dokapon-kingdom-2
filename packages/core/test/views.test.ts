import { describe, expect, it } from "vitest";
import type { GameEvent } from "../src/events";
import { onlyPlayers, PUBLIC } from "../src/events";
import type { GameState } from "../src/types";
import { eventsFor, redactEvent, viewFor } from "../src/views";
import { newGame } from "./fixtures/build";
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

  it("carries the version, viewer and the public partition only", () => {
    const state = newGame();
    const view = viewFor(state, "p1");
    expect(Object.keys(view).sort()).toEqual(["public", "self", "v", "viewer"]);
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
