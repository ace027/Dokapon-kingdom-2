import fc from "fast-check";
import type { GameSettings } from "../src/index";

/** Real players, the system actor and an outsider, so actor checks are exercised both ways. */
const ACTOR_IDS = ["p1", "p2", "p3", "p4", "system", "ghost"] as const;
const PLAYER_IDS = ["p1", "p2", "p3", "p4"] as const;

const arbActorId = fc.constantFrom(...ACTOR_IDS);
/** System-only actions draw `system` half the time so decisions actually open and resolve. */
const arbSystemishId = fc.oneof(fc.constant("system"), arbActorId);
const arbChoice = fc.constantFrom("A", "B", "C", "D");
const arbDecisionId = fc.constantFrom("d1", "d2", "d3", "x");
const arbRequired = fc.oneof(
  fc.subarray([...PLAYER_IDS.slice(0, 2)]),
  fc.subarray([...PLAYER_IDS]),
  fc.subarray([...ACTOR_IDS]),
  fc.array(fc.constantFrom(...PLAYER_IDS), { maxLength: 3 }),
);

export const arbSettings: fc.Arbitrary<GameSettings> = fc.record({
  v: fc.constant(1 as const),
  seed: fc.string({ minLength: 1, maxLength: 12 }),
  players: fc.constantFrom(["p1"], ["p1", "p2"], ["p1", "p2", "p3"], ["p1", "p2", "p3", "p4"]),
});

/** Correctly shaped actions of all 6 types (payload values may still be out of range). */
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
  fc.record({
    v: fc.constant(1),
    type: fc.constant("decision/commit"),
    playerId: arbActorId,
    decisionId: arbDecisionId,
    choice: arbChoice,
  }),
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
    playerId: fc.constant("p1"),
  }),
  arbShaped.map((action) => ({ ...action, zzz: 1 })),
);

/** Untrusted reducer input: mostly well-shaped actions, plus junk. */
export const arbInput: fc.Arbitrary<unknown> = fc.oneof(
  { arbitrary: arbShaped, weight: 6 },
  { arbitrary: arbJunk, weight: 1 },
);

export const arbScript: fc.Arbitrary<unknown[]> = fc.array(arbInput, { maxLength: 60 });
