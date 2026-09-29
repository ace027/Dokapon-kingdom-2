// v2 fast-check arbitraries shared by the property suites (replay, views). Later plans (02-03,
// 02-04) extend `arbInputFor` with their own action generators.
import fc from "fast-check";
import type { GameSettings } from "../src/types";

/** Ids that collide with `Object.prototype` members; every id-keyed record must survive them (PIT-002). */
export const PROTO_IDS = ["toString", "valueOf", "hasOwnProperty", "isPrototypeOf"] as const;

/** Every player id a generated game may seat. */
export const PLAYER_POOL: readonly string[] = ["p1", "p2", "p3", "p4", ...PROTO_IDS];

const CLASS_IDS = ["fighter", "caster"] as const;

const arbClass = fc.constantFrom(...CLASS_IDS);

/** 1-4 unique seats from {@link PLAYER_POOL}; 3-4 seats are favoured so opens/commits often involve several players. */
export const arbSettings: fc.Arbitrary<GameSettings> = fc
  .tuple(
    fc.oneof(
      { weight: 1, arbitrary: fc.integer({ min: 1, max: 2 }) },
      { weight: 4, arbitrary: fc.integer({ min: 3, max: 4 }) },
    ),
    fc.shuffledSubarray([...PLAYER_POOL], { minLength: 4, maxLength: PLAYER_POOL.length }),
    fc.array(arbClass, { minLength: 4, maxLength: 4 }),
    fc.string({ minLength: 1, maxLength: 12 }),
  )
  .map(([count, ids, classes, seed]) => ({
    v: 2 as const,
    seed,
    players: ids.slice(0, count).map((id, i) => ({ id, classId: classes[i] ?? "fighter" })),
  }));

/** The seat ids of generated settings, in seat order. */
export function seatIds(settings: GameSettings): string[] {
  return settings.players.map((seat) => seat.id);
}

const LONG_OPTION = "b".repeat(64);
const CHOICE_OPTION = `item:${"a".repeat(48)}`;
/**
 * Generic option tokens (the 53- and 64-char boundary tokens included). The first three are
 * "common": most generated options and commits draw from them, so commits often land in the
 * committing player's own options and decisions actually reach their reveal.
 */
const TOKEN_POOL = ["yes", "no", "red", "green", "blue", "a", "b", CHOICE_OPTION, LONG_OPTION];
const COMMON_TOKENS = 3;

/** Maps a generated number to a token: mostly common ones, sometimes rare, sometimes a sentinel. */
function pickToken(n: number, sentinels: readonly string[]): string {
  const bucket = n % 10;
  if (bucket < 6) return TOKEN_POOL[n % COMMON_TOKENS] ?? "yes";
  if (bucket < 8 || sentinels.length === 0) return TOKEN_POOL[n % TOKEN_POOL.length] ?? "yes";
  return sentinels[n % sentinels.length] ?? "yes";
}
const BAD_CHOICES = ["Bad Token", "c".repeat(65)];

/**
 * Per-seat sentinel tokens `s<i>-<a..d>`: they are only ever generated inside the options (and
 * commits) of the seat with index `i`, so the leak property can tell whose data a view contains.
 */
export const SENTINELS: readonly (readonly string[])[] = [0, 1, 2, 3].map((i) =>
  ["a", "b", "c", "d"].map((letter) => `s${i}-${letter}`),
);

function sentinelsFor(ids: readonly string[], playerId: string): readonly string[] {
  const index = ids.indexOf(playerId);
  return index < 0 ? [] : (SENTINELS[index] ?? []);
}

function arbPlayerId(ids: readonly string[], extra: readonly string[]): fc.Arbitrary<string> {
  return fc.oneof(
    { weight: 14, arbitrary: fc.constantFrom(...ids) },
    { weight: 1, arbitrary: fc.constantFrom(...PLAYER_POOL) },
    { weight: 1, arbitrary: fc.constantFrom(...extra) },
  );
}

function arbPrompt(ids: readonly string[]): fc.Arbitrary<unknown> {
  return fc
    .tuple(
      arbPlayerId(ids, ["ghost"]),
      fc.nat({ max: 7 }),
      fc.array(fc.nat({ max: 200 }), { minLength: 1, maxLength: 8 }),
      fc.oneof(
        { weight: 4, arbitrary: fc.nat({ max: 20 }).map((n) => ({ pick: n })) },
        { weight: 1, arbitrary: fc.constantFrom(...TOKEN_POOL).map((t) => ({ token: t })) },
      ),
    )
    .map(([playerId, dupRoll, picks, dflt]) => {
      const sentinels = sentinelsFor(ids, playerId);
      const tokens = picks.map((n) => pickToken(n, sentinels));
      // Duplicate options are kept only on one roll in eight, so most opens pass validation.
      const options = dupRoll === 0 ? tokens : [...new Set(tokens)];
      const first = options[0] ?? "yes";
      const chosen = "pick" in dflt ? (options[dflt.pick % options.length] ?? first) : dflt.token;
      return { playerId, options, default: chosen };
    });
}

function arbOpen(ids: readonly string[]): fc.Arbitrary<unknown> {
  const prompt = arbPrompt(ids);
  return fc
    .oneof(
      {
        weight: 5,
        arbitrary: fc.uniqueArray(prompt, {
          minLength: 1,
          maxLength: 4,
          selector: (p) => (p as { playerId: string }).playerId,
        }),
      },
      { weight: 1, arbitrary: fc.array(prompt, { minLength: 1, maxLength: 4 }) },
    )
    .map((prompts) => ({ v: 2, type: "decision/open", playerId: "system", prompts }));
}

function arbCommit(ids: readonly string[]): fc.Arbitrary<unknown> {
  return fc
    .tuple(
      arbPlayerId(ids, ["system"]),
      fc.constantFrom("d1", "d1", "d1", "d2", "d2", "d3", "d4", "x"),
      fc.nat({ max: 200 }),
      fc.constantFrom(...BAD_CHOICES),
      fc.boolean(),
    )
    .map(([playerId, decisionId, n, bad, useBad]) => {
      const choice = useBad && n % 8 === 0 ? bad : pickToken(n, sentinelsFor(ids, playerId));
      return { v: 2, type: "decision/commit", playerId, decisionId, choice };
    });
}

const arbTimeoutFor = fc
  .constantFrom("d1", "d2", "d3", "d4", "x")
  .map((decisionId) => ({ v: 2, type: "timeout", playerId: "system", decisionId }));

const arbTimeoutByPlayer = fc
  .tuple(fc.constantFrom(...PLAYER_POOL), fc.constantFrom("d1", "x"))
  .map(([playerId, decisionId]) => ({ v: 2, type: "timeout", playerId, decisionId }));

const VALID_COMMIT = {
  v: 2,
  type: "decision/commit",
  playerId: "p1",
  decisionId: "d1",
  choice: "yes",
};

const arbJunk: fc.Arbitrary<unknown> = fc.constantFrom<unknown>(
  null,
  42,
  {},
  { v: 1, type: "timeout", playerId: "system", decisionId: "d1" },
  { v: 2 },
  { ...VALID_COMMIT, zzz: 1 },
  { v: 2, type: "timeout", playerId: "system", decisionId: "d1", zzz: 1 },
);

/** Any action-shaped input for a game whose seats are `ids`, player ids biased toward them. */
export function arbInputFor(ids: readonly string[]): fc.Arbitrary<unknown> {
  return fc.oneof(
    { weight: 4, arbitrary: arbOpen(ids) },
    { weight: 8, arbitrary: arbCommit(ids) },
    { weight: 3, arbitrary: arbTimeoutFor },
    { weight: 1, arbitrary: arbTimeoutByPlayer },
    { weight: 1, arbitrary: arbJunk },
  );
}

/** Any action-shaped input (player ids from the whole pool). */
export const arbInput: fc.Arbitrary<unknown> = arbInputFor(PLAYER_POOL);

export const arbScript: fc.Arbitrary<unknown[]> = fc.array(arbInput, {
  maxLength: 60,
  size: "large",
});

/** Settings plus a script whose player ids favour the seated players. */
export const arbGame: fc.Arbitrary<[GameSettings, unknown[]]> = arbSettings.chain((settings) =>
  fc.tuple(
    fc.constant(settings),
    fc.array(arbInputFor(seatIds(settings)), { maxLength: 60, size: "large" }),
  ),
);
