import fc from "fast-check";
import type { GameSettings } from "../src/index";

/**
 * Player ids that collide with `Object.prototype` members. They are valid ids, so every property
 * (determinism, round-trip, leak) must hold for them exactly as for `p1`.
 */
export const PROTO_IDS = ["toString", "valueOf", "hasOwnProperty", "isPrototypeOf"] as const;
const PLAYER_IDS = ["p1", "p2", "p3", "p4", ...PROTO_IDS] as const;
/** Every player id, the system actor and an outsider, so actor checks are exercised both ways. */
const ACTOR_IDS = [...PLAYER_IDS, "system", "ghost"] as const;

const arbChoice = fc.constantFrom("A", "B", "C", "D");
const arbDecisionId = fc.oneof(
  { arbitrary: fc.constant("d1"), weight: 2 },
  { arbitrary: fc.constantFrom("d1", "d2", "d3", "x"), weight: 3 },
);

/** Player lists, weighted toward 3–4 players so hidden choices of *other* players exist. */
const arbPlayers: fc.Arbitrary<readonly string[]> = fc.oneof(
  { arbitrary: fc.constantFrom(["p1"], ["toString"]), weight: 1 },
  { arbitrary: fc.constantFrom(["p1", "p2"], ["toString", "valueOf"]), weight: 2 },
  {
    arbitrary: fc.constantFrom(
      ["p1", "p2", "p3"],
      ["p1", "toString", "hasOwnProperty"],
      ["hasOwnProperty", "isPrototypeOf", "p3"],
    ),
    weight: 3,
  },
  {
    arbitrary: fc.constantFrom(
      ["p1", "p2", "p3", "p4"],
      ["valueOf", "p2", "isPrototypeOf", "toString"],
      ["toString", "valueOf", "hasOwnProperty", "isPrototypeOf"],
    ),
    weight: 4,
  },
);

export const arbSettings: fc.Arbitrary<GameSettings> = fc.record({
  v: fc.constant(1 as const),
  seed: fc.string({ minLength: 1, maxLength: 12 }),
  players: arbPlayers,
});

/**
 * Untrusted reducer input for a game seated with `players`: mostly well-shaped actions of all 6
 * types (ids drawn mostly from the seated players, payload values may still be out of range),
 * plus junk.
 */
function arbInputFor(players: readonly string[]): fc.Arbitrary<unknown> {
  const arbActorId = fc.oneof(
    { arbitrary: fc.constantFrom(...players), weight: 3 },
    { arbitrary: fc.constantFrom(...ACTOR_IDS), weight: 1 },
  );
  /** System-only actions draw `system` half the time so decisions actually open and resolve. */
  const arbSystemishId = fc.oneof(fc.constant("system"), arbActorId);
  const arbRequired = fc.oneof(
    { arbitrary: fc.subarray([...players], { minLength: 1 }), weight: 4 },
    { arbitrary: fc.subarray([...PLAYER_IDS]), weight: 1 },
    { arbitrary: fc.subarray([...ACTOR_IDS]), weight: 1 },
    { arbitrary: fc.array(fc.constantFrom(...players), { maxLength: 3 }), weight: 1 },
  );

  const arbShaped: fc.Arbitrary<Record<string, unknown>> = fc.oneof(
    fc.record({
      v: fc.constant(1),
      type: fc.constant("sample/increment"),
      playerId: arbActorId,
      amount: fc.integer({ min: -2, max: 12 }),
    }),
    fc.record({ v: fc.constant(1), type: fc.constant("sample/roll"), playerId: arbActorId }),
    fc.record({
      v: fc.constant(1),
      type: fc.constant("sample/setSecret"),
      playerId: arbActorId,
      note: fc.string({ maxLength: 70 }),
    }),
    fc.record({
      v: fc.constant(1),
      type: fc.constant("decision/open"),
      playerId: arbSystemishId,
      required: arbRequired,
      defaultChoice: arbChoice,
    }),
    {
      // Weighted up so other players' hidden commits really occur while a decision is open.
      arbitrary: fc.record({
        v: fc.constant(1),
        type: fc.constant("decision/commit"),
        playerId: arbActorId,
        decisionId: arbDecisionId,
        choice: arbChoice,
      }),
      weight: 3,
    },
    fc.record({
      v: fc.constant(1),
      type: fc.constant("timeout"),
      playerId: arbSystemishId,
      decisionId: arbDecisionId,
    }),
  );

  const arbJunk: fc.Arbitrary<unknown> = fc.oneof(
    fc.constant(null),
    fc.integer(),
    fc.constant({}),
    fc.record({
      v: fc.constant(2),
      type: fc.constant("sample/roll"),
      playerId: fc.constant(players[0] ?? "p1"),
    }),
    arbShaped.map((action) => ({ ...action, zzz: 1 })),
  );

  return fc.oneof({ arbitrary: arbShaped, weight: 6 }, { arbitrary: arbJunk, weight: 1 });
}

/** Untrusted reducer input over every known id (not tied to one game's seating). */
export const arbInput: fc.Arbitrary<unknown> = arbInputFor(PLAYER_IDS);

/** A script of 0–60 inputs over every known id. */
export const arbScript: fc.Arbitrary<unknown[]> = fc.array(arbInput, { maxLength: 60 });

/** Settings plus a 0–60 input script whose ids are drawn mostly from that game's players. */
export const arbGame: fc.Arbitrary<[GameSettings, unknown[]]> = arbSettings.chain((settings) =>
  fc.tuple(
    fc.constant(settings),
    fc.array(arbInputFor(settings.players), { maxLength: 60, size: "medium" }),
  ),
);
