# Plan 01-02 Summary: Core Kernel

**Status:** Complete
**Agent:** engineering-senior-developer-01-02 (golden-vector and property-test work done in-agent)
**Requirements:** R2, R3 (serialization, actor rules, commit/reveal, timeout)

## Files
- `packages/core/src/types.ts`: partitioned state types; `SCHEMA_VERSION`, `SYSTEM_ACTOR`, `RESERVED_IDS`, `PLAYER_ID_PATTERN`
- `packages/core/src/rng.ts`: cyrb128 `seedRng`, sfc32 `nextU32`, unbiased `nextInt`, internal `normalizeSeedState`
- `packages/core/src/hash.ts`: `fnv1a32`
- `packages/core/src/serialize.ts`: `stableStringify` (path-naming TypeErrors), `hashState`, `serialize`, `deserialize`, `SchemaVersionError`
- `packages/core/src/actions.ts`: `Action` union, `ActionType`, `ACTION_TYPES`, `isActionType`
- `packages/core/src/events.ts`: `GameEvent`, `Visibility`, `PUBLIC`, `onlyPlayers`
- `packages/core/src/handlers.ts`: `Handler`/`Ctx` and the `handlers` map for all 6 types (`satisfies` exhaustive map)
- `packages/core/src/reducer.ts`: `reduce` (9-step precedence), `isAction`, `RejectCode`, `Reject`, `ReduceResult`
- `packages/core/src/game.ts`: `createGame`, `SettingsError`
- `packages/core/src/replay.ts`: `replay`, `ReplayResult`
- `packages/core/src/index.ts`: public exports (`PACKAGE_NAME` removed)
- `packages/core/test/{rng,serialize,game,reducer,decision,replay}.test.ts`, `test/arbitraries.ts`
- `packages/core/test/smoke.test.ts`: deleted

## Exported API (`@usurpia/core`)
- Values: `SCHEMA_VERSION`, `SYSTEM_ACTOR`, `RESERVED_IDS`, `PLAYER_ID_PATTERN`, `ACTION_TYPES`, `seedRng`, `nextU32`, `nextInt`, `fnv1a32`, `stableStringify`, `hashState`, `serialize`, `deserialize`, `SchemaVersionError`, `reduce`, `isAction`, `createGame`, `SettingsError`, `replay`
- Types: `PlayerId`, `Actor`, `Phase`, `Choice`, `GameSettings`, `PendingDecisionPublic`, `PublicState`, `PrivateState`, `HiddenState`, `GameState`, `RngState`, `Action`, `ActionType`, `GameEvent`, `Visibility`, `RejectCode`, `Reject`, `ReduceResult`, `ReplayResult`
- Not exported: `handlers`/`Handler`/`Ctx` (internal), `normalizeSeedState` (test-only helper), `PUBLIC`/`onlyPlayers` (event-building helpers). Plan 01-04 adds the views exports.

## Tests
- 6 test files, 125 tests, all passing (`pnpm vitest run packages/core`).
  - rng 13, serialize 29, game 22, reducer 46, decision 9, replay 6
- Golden vectors (from the spec, not recorded): `seedRng("usurpia")`, the first 5 `nextU32`, the first 10 d6 rolls, and the three FNV vectors all match. The reducer test also pins the first two `sample/roll` values (2, 2).
- fast-check properties at `numRuns: 200` each: determinism, no-throw/no-mutation on deep-frozen input, rejection identity, mid-replay serialize/deserialize (replay.test.ts); action round-trip and event/state round-trip at every step (serialize.test.ts). That is 6 properties x 200 runs.
- Coverage sanity test: 300 seeded samples of the arbitraries emit all 8 event types, so the decision/reveal/timeout paths are really exercised by the properties.
- Negative check: I made the `sample/increment` handler mutate its input; the no-mutation property failed. Reverted.

## Verification
All `verification_commands` exit 0: `pnpm vitest run packages/core`, `pnpm exec tsc -b packages/core`, `pnpm exec eslint packages/core`, `pnpm lint:purity` (`✓ core purity rules active`), `pnpm exec prettier --check packages/core`, and the three greps / file checks. `grep -rE "Math\.random|Date\.|new Date" packages/core/src` finds nothing.

## Decisions / Deviations
1. **Handler cast placement.** The single documented `as unknown as Handler<Action>` widening sits in `checkShape`, right after the type is verified and just before the guard runs, so the guard, phase, actor, validate and apply steps all use one widened handler. It is still the only cast in `src/`.
2. **System-only actions accept any string `playerId` in the guard.** `decision/open` and `timeout` guards check only `typeof playerId === "string"`; the `system` restriction is the actor rule (step 5). This is required so a player sending `timeout` gets `WRONG_ACTOR` instead of `INVALID_PAYLOAD`.
3. **Inconsistent decision state.** `STALE_DECISION` is also returned when `public.pending` and `hidden.decision` are missing or disagree (possible only for hand-edited/deserialized states), so `apply` never runs without an open decision.
4. **`createGame` re-validates at runtime** against untrusted JSON (types are not trusted), including non-object settings and non-string ids.
5. **`Actor` type** keeps the spec's `PlayerId | typeof SYSTEM_ACTOR` union with an eslint-disable for `no-redundant-type-constituents` (documentation value per spec).
6. **`RESERVED_IDS`** is declared `readonly string[]` (spec type) with an `as const` literal (plan).
7. **Arbitraries bias:** system-only actions draw `system` about half the time, and `required` mixes subsets of p1/p2, p1–p4, all actor ids and arrays with duplicates. Without this bias decisions almost never open. Exported names `arbSettings`, `arbInput`, `arbScript` match the plan for 01-04.
8. **Test-only casts:** tests pass untrusted scripts to `replay` via `as readonly Action[]` and invalid settings via an `untrusted()` helper, because the spec signatures are typed.

## Issues
None. Plan 01-03's files under `packages/content/` were not read, modified or staged.
