import { createGame, rulesHash, viewFor } from "@usurpia/core";
import { describe, expect, it } from "vitest";
import { DEMO_RULES } from "../src/demo-rules";
import { renderView } from "../src/render";

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

describe("DEMO_RULES", () => {
  it("is a verbatim TEST_RULES copy", () => {
    expect(rulesHash(DEMO_RULES)).toBe("7433ea8b");
  });
});

describe("renderView", () => {
  it("renders p2's view with the exact line layout", () => {
    expect(renderView(viewFor(state, "p2"), [])).toBe(
      [
        "Usurpia — viewer: p2",
        "turn 1 · active p1 · phase turn",
        "p1 fighter L1 hp 48 gold 100",
        "p2 caster L1 hp 36 gold 100",
        "events:",
      ].join("\n"),
    );
  });

  it("renders a spectator with the same player lines", () => {
    const text = renderView(viewFor(state, "spectator"), []);
    expect(text).toContain("viewer: spectator");
    expect(text).toContain("p1 fighter L1 hp 48 gold 100");
    expect(text).toContain("p2 caster L1 hp 36 gold 100");
    expect(text).toContain("events:");
  });

  it("lists event types one per line", () => {
    const text = renderView(viewFor(state, "p1"), [
      {
        v: 2,
        type: "DecisionOpened",
        visibility: { kind: "public" },
        decisionId: "d1",
        kind: "poll",
        required: ["p1"],
      },
    ]);
    expect(text.endsWith("events:\n- DecisionOpened")).toBe(true);
  });
});
