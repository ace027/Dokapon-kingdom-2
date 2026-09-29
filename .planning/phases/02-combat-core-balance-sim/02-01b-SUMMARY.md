# Plan 02-01b Summary: Generic decisions, deserialize v2, views counts, property suite

**Status:** Complete. Executed in the main checkout on `dev`; committed on `dev` (no push).

## What changed
- `packages/core/src/handlers/decision.ts` (new): `decision/open` (kind `poll`), `decision/commit`, `timeout`, `openDecision`, `revealDecision`, `resolvePoll`, `resolveUnsupported`, `decisionHandlers(resolvers)`.
- `packages/core/src/handlers/{shared,index}.ts`: `Resolver`/`ResolverTable`, `isTokenArray`; `handlers = { ...decisionHandlers(resolvers) }` with `poll: resolvePoll`, `"combat/exchange": resolveUnsupported`.
- `packages/core/src/{actions,events}.ts`: the three W1b `Action` members, `ACTION_TYPES = ["decision/open","decision/commit","timeout"]`; the decision events are now emitted (doc comment only).
- `packages/core/src/serialize.ts`: full `deserialize(json, rules)` v2, checks 1-8 (W1b check 8). Values from `../rules` and `../combat/stats` are used only inside function bodies (import-cycle guard).
- `packages/core/src/views.ts`: `PlayerView.counts` (bag/scroll counts for every seated player, via `ownGet`).
- `packages/core/src/reducer.ts`: see Deviations.
- Tests: `decision.test.ts`, `serialize.test.ts`, `views.test.ts`, `reducer.test.ts`, `replay.test.ts`, `counter-bounds.test.ts`, `arbitraries.ts`; `packages/sim/fixtures/kernel-game.json`, `packages/sim/test/{cli,replay-file}.test.ts`; client `main.ts`, `render.ts`, `render.test.ts`.

## API list
Core `index.ts` exports are unchanged in name (`ACTION_TYPES`/`Action` are now non-empty; `deserialize` is the full v2 one; `PlayerView` gains `counts`). The decision module API is internal to `handlers/`, imported by 02-03 as `../handlers/decision`:
`openDecision`, `revealDecision`, `decisionHandlers`, `resolvePoll`, `resolveUnsupported`, `PromptSpec`; types `Resolver`, `ResolverTable` (in `handlers/shared.ts`). Not added to `index.ts`: the spec's export list does not require it.

## Test counts
Before (02-01a): 209. After: **437** (15 files, all passing).
| File | Tests |
|---|---|
| core/decision.test.ts | 56 |
| core/reducer.test.ts | 41 |
| core/serialize.test.ts | 150 (113 single-mutation rows + envelope, boundary, PIT-002, round trips) |
| core/views.test.ts | 19 (incl. the leak property) |
| core/replay.test.ts | 15 (kernel golden, generator sanity, 6 properties) |
| core/counter-bounds.test.ts | 2 |
| core/{game,purity,rng,rules,stats}.test.ts | 32 + 1 + 13 + 11 + 25 (unchanged) |
| sim/cli.test.ts | 13 |
| sim/replay-file.test.ts | 16 |
| client/render.test.ts | 8 |
| content/validate.test.ts | 35 (unchanged) |

## Property run counts
Six replay properties in `replay.test.ts` (determinism, never throws and never mutates a deep-frozen state, rejection identity, split replay via `deserialize(serialize(s))`, every reachable state round-trips deep-equal, integers only) plus the leak property in `views.test.ts`: each `fc.assert(..., { numRuns: 200 })`, so 7 x 200 = 1400 generated games. `arbGame` scripts use `size: "large"` (average about 27 actions, up to 60). A sanity test samples 600 games and requires more than 20 reveals, more than 5 timeouts and a reveal that includes a prototype-named seat (observed about 420 reveals, about 480 timeouts per 600 games).

## Goldens observed (all from the spec; none recorded from the implementation)
- Kernel poll replay: `hashState = 9616698e`, rejections `[{2, ALREADY_COMMITTED}, {5, INVALID_PAYLOAD}]`, 10 events in spec order, `lastReveal = {d2, poll, {p2:"b"}, []}`, first reveal `{p1:"yes", p2:"red"}` with `timedOut ["p2"]`. First run matched; no mismatch localisation was needed.
- The seven per-step hashes `8557c459, 6d3f756c, 6d3f756c, f34995e5, 7ad35d0a, 7ad35d0a, 9616698e` (transcribed from `traces/kernel-game.trace.json`) are asserted after each fold step.
- `pnpm sim replay packages/sim/fixtures/kernel-game.json` prints `hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2`.

## deserialize message table (113 rows, all unique; asserted by the meta-test)
Each is a single mutation of a valid base (`turn` = after the kernel replay, `poll` = 4 seats, 3 required, p1 committed, `reveal` = after a reveal with `timedOut ["p2"]`). Messages are `TypeError("deserialize: ...")` with ids clipped to 64 chars. Not in the table (separate tests): `state must be an object`, `SyntaxError`, `SchemaVersionError` for v 1 and 3, boundary cases and prototype-member content ids (which share the messages of the unknown-id rows).
- `deserialize: root is missing key "hidden"`
- `deserialize: root has unexpected key "extra"`
- `deserialize: root is missing key "private"`
- `deserialize: public must be an object`
- `deserialize: public is missing key "combat"`
- `deserialize: public has unexpected key "zzz"`
- `deserialize: private must be an object`
- `deserialize: hidden must be an object`
- `deserialize: hidden is missing key "decision"`
- `deserialize: hidden has unexpected key "zzz"`
- `deserialize: players: players must be an array`
- `deserialize: players: players must hold 1–4 ids`
- `deserialize: players: player ids must be strings`
- `deserialize: players: player id "system" is reserved`
- `deserialize: players: invalid player id "p 1"`
- `deserialize: players: player ids must be unique`
- `deserialize: activePlayer is not a seated player`
- `deserialize: phase must be turn or decision`
- `deserialize: turn out of range`
- `deserialize: decisionSeq out of range`
- `deserialize: combatSeq out of range`
- `deserialize: rng must be four u32 values`
- `deserialize: characters must be an object`
- `deserialize: characters is missing player "p2"`
- `deserialize: characters has unexpected player "p3"`
- `deserialize: characters.p1 must be an object`
- `deserialize: characters.p1 is missing key "hp"`
- `deserialize: characters.p1 has unexpected key "zzz"`
- `deserialize: characters.p1.classId is not a known class`
- `deserialize: characters.p1.level out of range`
- `deserialize: characters.p1.xp out of range`
- `deserialize: characters.p1.level does not match xp`
- `deserialize: characters.p1.gold out of range`
- `deserialize: characters.p1.mastery must be an object`
- `deserialize: characters.p1.mastery is missing class "battlemage"`
- `deserialize: characters.p1.mastery has unexpected class "wizard"`
- `deserialize: characters.p1.mastery.fighter out of range`
- `deserialize: characters.p1.portable is not a known class`
- `deserialize: characters.p1.portable requires mastery rank 5`
- `deserialize: characters.p1.weapon is unknown gear`
- `deserialize: characters.p1.weapon is in the wrong slot`
- `deserialize: characters.p1.shield is unknown gear`
- `deserialize: characters.p2.accessory is in the wrong slot`
- `deserialize: characters.p1.battleSpell is unknown`
- `deserialize: characters.p2.wardSpell is unknown`
- `deserialize: characters.p1.hp out of range`
- `deserialize: characters.p1.hp exceeds max hp`
- `deserialize: choiceHistory must be an object`
- `deserialize: choiceHistory is missing player "p2"`
- `deserialize: choiceHistory has unexpected player "p3"`
- `deserialize: choiceHistory.p1 must be an object`
- `deserialize: choiceHistory.p1 is missing key "ward"`
- `deserialize: choiceHistory.p1 has unexpected key "zzz"`
- `deserialize: choiceHistory.p1.attack out of range`
- `deserialize: private is missing player "p2"`
- `deserialize: private has unexpected player "p3"`
- `deserialize: private.p1 must be an object`
- `deserialize: private.p1 is missing key "scrolls"`
- `deserialize: private.p1 has unexpected key "zzz"`
- `deserialize: private.p1.bag must be an array`
- `deserialize: private.p1.bag has an unknown item`
- `deserialize: private.p1.bag exceeds bag size`
- `deserialize: private.p1.scrolls must be an array`
- `deserialize: private.p1.scrolls has an unknown field spell`
- `deserialize: private.p1.scrolls exceeds maxScrolls`
- `deserialize: private.p2.prompt must be an object`
- `deserialize: private.p2.prompt is missing key "default"`
- `deserialize: private.p2.prompt has unexpected key "zzz"`
- `deserialize: private.p2.prompt.decisionId must be a string`
- `deserialize: private.p2.prompt.options must hold 1-24 tokens`
- `deserialize: private.p2.prompt.options must be tokens`
- `deserialize: private.p2.prompt.options must be unique`
- `deserialize: private.p2.prompt.default must be one of the options`
- `deserialize: turn phase must have no pending decision`
- `deserialize: turn phase must have no hidden decision`
- `deserialize: turn phase must have no prompts`
- `deserialize: decision phase requires a pending decision`
- `deserialize: pending must be an object`
- `deserialize: pending is missing key "kind"`
- `deserialize: pending has unexpected key "zzz"`
- `deserialize: pending.id does not match decisionSeq`
- `deserialize: pending.kind is unknown`
- `deserialize: pending.required must be an array`
- `deserialize: pending.required must not be empty`
- `deserialize: pending.required must be unique`
- `deserialize: pending.required must be seated players`
- `deserialize: pending.committed must be an array`
- `deserialize: pending.committed must be unique`
- `deserialize: pending.committed must be a subset of required`
- `deserialize: pending.committed must be fewer than required`
- `deserialize: private.p3.prompt is required`
- `deserialize: private.p4.prompt must be null for a non-required player`
- `deserialize: private.p3.prompt.decisionId does not match pending.id`
- `deserialize: hidden.decision must be an object`
- `deserialize: hidden.decision is missing key "choices"`
- `deserialize: hidden.decision has unexpected key "zzz"`
- `deserialize: hidden.decision.id does not match pending.id`
- `deserialize: hidden.decision.choices must be an object`
- `deserialize: hidden.decision.choices keys do not match committed`
- `deserialize: hidden.decision.choices.p1 is not one of the options`
- `deserialize: lastReveal must be an object`
- `deserialize: lastReveal is missing key "kind"`
- `deserialize: lastReveal has unexpected key "zzz"`
- `deserialize: lastReveal.decisionId must be a string`
- `deserialize: lastReveal.kind is unknown`
- `deserialize: lastReveal.choices must be an object`
- `deserialize: lastReveal.choices has an unseated player`
- `deserialize: lastReveal.choices.p1 must be a token`
- `deserialize: lastReveal.timedOut must be an array`
- `deserialize: lastReveal.timedOut must be unique`
- `deserialize: lastReveal.timedOut must be a subset of the choice keys`
- `deserialize: combat must be null`
- `deserialize: combat decisions unsupported`

## Mutation proof
Method (PIT-001): a throwaway script outside the repo (`/tmp/usurpia-scratch/02-01b/mutate*.mjs`) deleted one check at a time (turning its `reject`/`bad` call into a no-op, or the guard clause into `true`), ran the owning test files with the JSON reporter, recorded the failing tests and restored the source. Every deletion made only that check's tests fail (the source was restored byte-for-byte; `git status` showed only the plan's files).

### decision validation checks (`decision.test.ts`, `reducer.test.ts`, `counter-bounds.test.ts`)
| Deleted check (message) | Failing tests (only these) |
|---|---|
| prompt players must be unique | decision/open rejects duplicate prompt players with INVALID_PAYLOAD |
| prompt player must be seated | decision/open rejects an unseated prompt player with INVALID_PAYLOAD; decision/open rejects a prototype-member id that is not seated with INVALID_PAYLOAD |
| prompt options must be unique | decision/open rejects duplicate options with INVALID_PAYLOAD |
| prompt default must be one of its options | decision/open rejects a default outside the options with INVALID_PAYLOAD |
| decisionSeq would exceed MAX_COUNTER | decisionSeq bounds rejects decision/open at MAX_COUNTER |
| ${clip(a.playerId | decision/commit rejects a double commit that reuses an in-options choice; decision/commit checks ALREADY_COMMITTED before the options check |
| choice is not one of your options | 4 tests: decision/commit rejects a token outside every option list; decision/commit rejects another player's option; ... |
| STALE_DECISION (staleError) | 5 tests: decision/commit rejects a stale decision id; decision/commit clips an oversized stale decision id in the message; ... |

### decision shape guards
| Deleted shape-guard clause | Failing tests (only these) |
|---|---|
| open: exact keys | decision/open rejects an extra action key at the shape step; isAction is false for a decision/open with an extra key |
| open: prompts is an array | decision/open rejects prompts that are not an array at the shape step |
| open: at least 1 prompt | decision/open rejects 0 prompts at the shape step; rejection identity and purity returns no state on rejection, leaves the input untouched, and never throws on a frozen input; isAction is false for a decision/open with no prompts |
| open: at most 4 prompts | decision/open rejects 5 prompts at the shape step |
| open: prompt is a plain object | decision/open rejects a null prompt at the shape step |
| open: prompt exact keys | decision/open rejects an extra prompt key at the shape step |
| open: prompt playerId is a string | decision/open rejects a non-string prompt player at the shape step |
| open: options are 1..8 tokens | 4 tests: decision/open rejects 0 options at the shape step; decision/open rejects 9 options at the shape step; ... |
| open: default is a token | decision/open rejects a non-token default at the shape step |
| commit: exact keys | decision/commit rejects an extra key at the shape step |
| commit: decisionId is a string | decision/commit rejects a non-string decision id at the shape step |
| commit: choice is a token | decision/open rejects a commit of a 65-char token at the shape step; decision/commit rejects a non-token choice at the shape step; reduce precedence: phase, actor, state validation checks the shape before the phase (INVALID_PAYLOAD beats WRONG_PHASE) |
| timeout: exact keys | timeout rejects an extra key at the shape step |
| timeout: decisionId is a string | timeout rejects a non-string decision id at the shape step |
| isTokenArray: min length | decision/open rejects 0 options at the shape step |
| isTokenArray: max length | decision/open rejects 9 options at the shape step |
| isTokenArray: every element is a token | decision/open rejects a 65-char option at the shape step; decision/open rejects a non-token option at the shape step |
The `prompt is a plain object` clause initially had no failing test (a non-object entry was rejected by the key-count clause anyway; `null` would have thrown in `Object.keys`). A `null` prompt case was added and the mutation re-run: only `decision/open rejects a null prompt at the shape step` fails.

### deserialize checks (`serialize.test.ts`)
Every `bad(...)` call in `deserialize` and its helpers was deleted in turn (67 mutations, the version check included).
| Deleted deserialize check | Failing tests (only these) |
|---|---|
| <where> must be an object | 15 tests: row public must be an object; row private must be an object; ... |
| <where> must be an array | 5 tests: row private.p1.bag must be an array; row private.p1.scrolls must be an array; ... |
| <where> is missing key "${key} | 11 tests: row root is missing key "hidden"; row root is missing key "private"; ... |
| <where> has unexpected key "${clip(key | 10 tests: row root has unexpected key "extra"; row public has unexpected key "zzz"; ... |
| <where> is missing player "${clip(id | row characters is missing player "p2"; row choiceHistory is missing player "p2"; row private is missing player "p2" |
| <where> has unexpected player "${clip(id | row characters has unexpected player "p3"; row choiceHistory has unexpected player "p3"; row private has unexpected player "p3" |
| <where>.classId is not a known class | 5 tests: row characters.p1.classId is not a known class; treats toString as an unknown content id, never an inherited member; ... |
| <where>.level out of range | row characters.p1.level out of range |
| <where>.xp out of range | row characters.p1.xp out of range |
| <where>.level does not match xp | row characters.p1.level does not match xp |
| <where>.gold out of range | row characters.p1.gold out of range |
| <where>.mastery is missing class "${classId} | row characters.p1.mastery is missing class "battlemage" |
| <where>.mastery has unexpected class "${clip(key | row characters.p1.mastery has unexpected class "wizard" |
| <where>.mastery.${classId} out of range | row characters.p1.mastery.fighter out of range |
| <where>.portable is not a known class | 5 tests: row characters.p1.portable is not a known class; treats toString as an unknown content id, never an inherited member; ... |
| <where>.portable requires mastery rank 5 | row characters.p1.portable requires mastery rank 5 |
| <where>.${slot} is unknown gear | 6 tests: row characters.p1.weapon is unknown gear; row characters.p1.shield is unknown gear; ... |
| <where>.${slot} is in the wrong slot | row characters.p1.weapon is in the wrong slot; row characters.p2.accessory is in the wrong slot |
| <where>.battleSpell is unknown | 5 tests: row characters.p1.battleSpell is unknown; treats toString as an unknown content id, never an inherited member; ... |
| <where>.wardSpell is unknown | row characters.p2.wardSpell is unknown |
| <where>.hp out of range | row characters.p1.hp out of range |
| <where>.hp exceeds max hp | row characters.p1.hp exceeds max hp |
| <where>.${command} out of range | row choiceHistory.p1.attack out of range |
| <where>.decisionId must be a string | row private.p2.prompt.decisionId must be a string |
| <where>.options must hold 1-${MAX_PROMPT_OPTIONS} tokens | row private.p2.prompt.options must hold 1-24 tokens; accepts 1 and 24 prompt options and rejects none |
| <where>.options must be tokens | row private.p2.prompt.options must be tokens |
| <where>.options must be unique | row private.p2.prompt.options must be unique |
| <where>.default must be one of the options | row private.p2.prompt.default must be one of the options |
| <where>.bag has an unknown item | 5 tests: row private.p1.bag has an unknown item; treats toString as an unknown content id, never an inherited member; ... |
| <where>.bag exceeds bag size | row private.p1.bag exceeds bag size |
| <where>.scrolls has an unknown field spell | 5 tests: row private.p1.scrolls has an unknown field spell; treats toString as an unknown content id, never an inherited member; ... |
| <where>.scrolls exceeds maxScrolls | row private.p1.scrolls exceeds maxScrolls |
| turn phase must have no pending decision | row turn phase must have no pending decision |
| turn phase must have no hidden decision | row turn phase must have no hidden decision |
| turn phase must have no prompts | row turn phase must have no prompts |
| decision phase requires a pending decision | row decision phase requires a pending decision |
| pending.id does not match decisionSeq | row pending.id does not match decisionSeq |
| pending.kind is unknown | row pending.kind is unknown |
| pending.required must not be empty | row pending.required must not be empty |
| pending.required must be unique | row pending.required must be unique |
| pending.required must be seated players | row pending.required must be seated players |
| pending.committed must be unique | row pending.committed must be unique |
| pending.committed must be a subset of required | row pending.committed must be a subset of required |
| pending.committed must be fewer than required | row pending.committed must be fewer than required |
| <where> is required | row private.p3.prompt is required |
| <where> must be null for a non-required player | row private.p4.prompt must be null for a non-required player |
| <where>.decisionId does not match pending.id | row private.p3.prompt.decisionId does not match pending.id |
| hidden.decision.id does not match pending.id | row hidden.decision.id does not match pending.id |
| hidden.decision.choices keys do not match committed | row hidden.decision.choices keys do not match committed |
| hidden.decision.choices.${clip(id | row hidden.decision.choices.p1 is not one of the options |
| lastReveal.decisionId must be a string | row lastReveal.decisionId must be a string |
| lastReveal.kind is unknown | row lastReveal.kind is unknown |
| lastReveal.choices has an unseated player | row lastReveal.choices has an unseated player |
| lastReveal.choices.${clip(id | row lastReveal.choices.p1 must be a token |
| lastReveal.timedOut must be unique | row lastReveal.timedOut must be unique |
| lastReveal.timedOut must be a subset of the choice keys | row lastReveal.timedOut must be a subset of the choice keys |
| state must be an object | throws TypeError for null; throws TypeError for a number; throws TypeError for an array |
| players: ${playersProblem} | 6 tests: row players: players must be an array; row players: players must hold 1–4 ids; ... |
| activePlayer is not a seated player | row activePlayer is not a seated player |
| phase must be turn or decision | row phase must be turn or decision |
| turn out of range | row turn out of range; accepts turn = MAX_COUNTER and rejects MAX_COUNTER + 1 |
| decisionSeq out of range | row decisionSeq out of range; accepts decisionSeq = MAX_COUNTER and rejects MAX_COUNTER + 1 |
| combatSeq out of range | row combatSeq out of range; accepts combatSeq = MAX_COUNTER and rejects MAX_COUNTER + 1 |
| rng must be four u32 values | row rng must be four u32 values |
| combat must be null | row combat must be null |
| combat decisions unsupported | row combat decisions unsupported |
| SchemaVersionError | throws SchemaVersionError for v: 1; throws SchemaVersionError for v: 3 |

Defence-in-depth without a single-mutation test: `revealDecision`'s `pending === null || open === null` early return and the commit/timeout `apply` no-decision branches (covered by direct unit tests in the `defensive paths` block, but unreachable through `reduce`), `revealedChoices`' `invariant` throw (unreachable for valid states), `views.ts` `?? 0` fallbacks.

## Pipeline (exit codes checked, final run on the committed tree)
| Command | Exit |
|---|---|
| `pnpm install --frozen-lockfile` | 0 |
| `pnpm lint` | 0 |
| `pnpm lint:purity` | 0 |
| `pnpm format:check` | 0 |
| `pnpm typecheck` | 0 |
| `pnpm test` | 0 (437 passed, 15 files) |
| `pnpm build` | 0 |
| `pnpm sim replay packages/sim/fixtures/kernel-game.json` piped to `grep -qx 'hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2'` | 0 |
| sample/README grep (`test $? -eq 1`, no matches) | 1 (as required; the missing-directory exit 2 noted in 02-01a is fixed because the fixture directory exists again) |
| `grep -q rulesHash README.md`, `grep -c 'numRuns: 200' replay.test.ts` >= 6, `numRuns: 200` in `views.test.ts` | 0 |
| fresh-process imports of `rules.ts`, `serialize.ts` and `@usurpia/core` (sim) | 0, 0, 0 |

Tails:
```

 RUN  v5.0.2 /home/user/Dokapon-kingdom-2


 Test Files  15 passed (15)
      Tests  437 passed (437)
   Start at  12:38:33
   Duration  7.74s (tests 86%, transform 9%, import 4%)

    Isolate  15 workers spawned · ~124ms startup each (spawn + environment, per file)
             at least ~496ms faster with isolate: false — reuses workers across files instead of one per file
```

## arbitraries exports
`packages/core/test/arbitraries.ts` (reused and extended by 02-03/02-04):
- `PROTO_IDS: readonly ["toString","valueOf","hasOwnProperty","isPrototypeOf"]`
- `PLAYER_POOL: readonly string[]` = `["p1","p2","p3","p4", ...PROTO_IDS]`
- `arbSettings: fc.Arbitrary<GameSettings>`: 1-4 unique seats from `PLAYER_POOL` (3-4 seats favoured, weight 4:1), `classId` from `["fighter","caster"]`, seed `fc.string({minLength:1,maxLength:12})`
- `seatIds(settings: GameSettings): string[]`
- `SENTINELS: readonly (readonly string[])[]`: `[["s0-a".."s0-d"], ..., ["s3-a".."s3-d"]]`, generated only inside seat `i`'s own options/commits
- `arbInputFor(ids: readonly string[]): fc.Arbitrary<unknown>`: `fc.oneof` over `decision/open` (1-4 prompts, players biased to `ids` plus the pool and `"ghost"`; 1-8 options from the common tokens `yes/no/red`, rare tokens `green/blue/a/b`, a 53-char `item:` token, a 64-char token, plus the seat's sentinels; default usually one of its options), `decision/commit` (players from `ids`/pool/`"system"`, decisionIds `d1..d4` and `x` with `d1` favoured, choices from the same token mix plus `"Bad Token"` and a 65-char token), `timeout` (system, or a player), and junk (`null`, an integer, `{}`, `{v:1,...}`, a valid action with `zzz: 1`)
- `arbInput: fc.Arbitrary<unknown>` = `arbInputFor(PLAYER_POOL)`
- `arbScript: fc.Arbitrary<unknown[]>` = `fc.array(arbInput, {maxLength: 60, size: "large"})`
- `arbGame: fc.Arbitrary<[GameSettings, unknown[]]>` = `arbSettings.chain(s => fc.tuple(fc.constant(s), fc.array(arbInputFor(seatIds(s)), {maxLength: 60, size: "large"})))`
- Test helpers unchanged from 02-01a (`fixtures/build.ts`): `FIXTURE_SETTINGS`, `newGame`, `applyAll` (throws on the first rejection), `deepFreeze`.

## Resolver/ResolverTable signatures
`packages/core/src/handlers/shared.ts`:
```ts
export type Resolver = (
  state: GameState,
  choices: Readonly<Record<PlayerId, string>>,
  ctx: Ctx,
  rules: Rules,
  events: GameEvent[],
) => GameState;
export type ResolverTable = Readonly<Record<DecisionKind, Resolver>>;
```
`packages/core/src/handlers/decision.ts`:
```ts
export interface PromptSpec { readonly playerId: PlayerId; readonly options: readonly string[]; readonly default: string }
export function openDecision(state: GameState, kind: DecisionKind, prompts: readonly PromptSpec[], events: GameEvent[]): GameState;
export function revealDecision(state: GameState, timedOut: readonly PlayerId[], ctx: Ctx, rules: Rules, events: GameEvent[], resolvers: ResolverTable): GameState;
export const resolvePoll: Resolver;
export const resolveUnsupported: Resolver;
export function decisionHandlers(resolvers: ResolverTable): Pick<HandlerMap, "decision/open" | "decision/commit" | "timeout">;
```
`handlers/index.ts`: `const resolvers = { poll: resolvePoll, "combat/exchange": resolveUnsupported } satisfies ResolverTable; export const handlers = { ...decisionHandlers(resolvers) } satisfies HandlerMap;`. 02-03 replaces `resolveUnsupported` there. `openDecision` and `revealDecision` mutate the passed `events` array (push) and return the new state; `revealDecision` returns the state unchanged when no decision is open. For a `combat/exchange` reveal, the `choiceHistory` update happens before the resolver is called, and the resolver receives the already-revealed state (phase `turn`, `pending`/`hidden.decision`/prompts cleared, `lastReveal` set), so 02-03's resolver may open the next exchange with `openDecision`.

## Decisions
- Comma lists in the client render are joined with `", "` (`your options: red, green, blue (default red)`), as the plan decided.
- `Resolver` returns `GameState` and takes `(state, choices, ctx, rules, events)` exactly as the execution contract; `choices` is built in `required` order.
- The reveal passes the resolver the state after the reveal (see above); `events` already contains `ChoicesRevealed`.
- deserialize check 6 for phase `turn` does not test `combat === null`; in W1b that lives only in check 8 (`combat must be null`), so the two messages stay unique and each has a single-mutation test. 02-03 turns check 8 into the spec's `combat !== null <=> pending.kind === "combat/exchange"` rule.
- deserialize check 6 verifies prompts (present exactly for required players, `decisionId` match) before `hidden.decision.choices` values, so the choice-in-options check never fires because of a missing prompt.
- Exact-key checks report missing and unexpected keys with different messages (`... is missing key "k"` / `... has unexpected key "k"`), so both checks are distinct and provable.
- `hidden.decision.choices` keys are compared with `committed` as sets, so a duplicated `committed` entry is rejected by the uniqueness check alone.
- `PromptSpec` is a named interface for the `openDecision` prompts parameter (`{playerId, options, default}`).
- The guard for `decision/open`/`timeout` checks only that `playerId` is a string (the system actor is a later `WRONG_ACTOR` check, as the precedence requires), so the action type's `playerId: "system"` literal is a documented type-level idealisation from the spec.
- The `arbGame` arrays use `size: "large"` (in addition to `maxLength: 60`): with the default size scripts averaged 4.5 actions and reveals were too rare for the properties to say anything.
- `packages/sim/test/cli.test.ts` derives the expected `rules=` value from `rulesHash(replayRules())`; only its last test names the kernel fixture and `9616698e`, which 02-05 replaces together with the fixture.

## Deviations
- `packages/core/src/reducer.ts` (edited only where the non-empty `Action` union requires it, as the plan permits): removed the two 02-01a workarounds, the `// Widened to string` comment and the explicit `{ type: string; playerId: string }` annotation on the destructuring (`const { type, playerId } = a;`). Precedence order and the single documented widening cast on the handler lookup are unchanged. `index.ts` needed no edit.
- `packages/core/src/events.ts`: doc comment only (the decision events are now emitted); no type change.
- Plan check-6 ordering and the check-8 split described under Decisions differ slightly from the spec's listing order; messages and outcomes are the spec's.

## Warnings and pre-existing issues
- `packages/sim/test/cli.test.ts` and `replay-file.test.ts` pin the kernel fixture line; 02-05 must update them when it deletes `kernel-game.json`.
- The 02-01a-noted grep exit 2 (missing `packages/sim/fixtures`) is resolved by the new fixture directory.
- No pre-existing issues found in the touched areas.
