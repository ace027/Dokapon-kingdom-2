# Plan 02-01a Summary: Kernel v2 data model and Rules threading

**Status:** Complete with warnings (see Deviations). Completed by a **resumed executor** after the first executor was cut off by an API usage limit.

## Recovery note (resumed executor)
- Found uncommitted work: modified `actions/events/types.ts`, deleted `handlers.ts`, untracked `combat/`, `handlers/`, `rules.ts`, `test/{fixtures,rules.test,stats.test}`. All paths were inside `files_modified`.
- **Kept as-is** (read fully and checked against the spec; `rulesHash(TEST_RULES)` = `7433ea8b` and every stats golden row pass): `rules.ts`, `combat/passives.ts`, `combat/stats.ts`, `handlers/shared.ts`, `handlers/index.ts`, `test/fixtures/test-rules.ts`, `test/rules.test.ts`, `test/stats.test.ts`, `actions.ts`, `events.ts`, `types.ts`. `views.ts` was already the W1a shape (unchanged).
- **Corrected:** none of the drafts needed corrections.
- **Rewritten / newly written by the resumed executor:** `validation.ts` (+`seatsError`, -`isChoice`), `game.ts`, `replay.ts`, `reducer.ts`, `serialize.ts` (shim), `index.ts`, `test/fixtures/build.ts`, the `game/reducer/replay/views/serialize` tests, all sim/client/content/README changes and the lockfile.
- The four plan-listed deletions (`decision.test.ts`, `counter-bounds.test.ts`, `arbitraries.ts`, `sim/fixtures/sample-game.json`) were first refused by the permission classifier and then carried out by the coordinator with user approval.

## Exported API (core index)
`SCHEMA_VERSION, MAX_COUNTER, MAX_STAT, CHOICE_PATTERN, PLAYER_ID_PATTERN, RESERVED_IDS, SYSTEM_ACTOR`, v2 state types, everything in `rules.ts` (`Rules`, `rulesHash`, `masteryRank`, `levelForXp`, hooks/constants/defs), `applyPassives`/`HookTotals`, `activeHooks, sheetStats, npcDef, npcStats, battleStats, adjustHp`, rng/hash/serialize (`deserialize(json, rules)` shim), `Action` (= never), `ACTION_TYPES` (= []), events, `reduce(state, action, rules)`, `isAction`, `createGame(settings, rules)`, `SettingsError`, `replay(settings, actions, rules)`, `viewFor`, `redactEvent`, `eventsFor`.

## Test counts
Before: 263 (Phase 1). After: 209 (12 files; v1 sample/decision/property tests removed, 02-01b re-creates them for v2).

## Goldens observed
`rulesHash(TEST_RULES)` = `7433ea8b` (core, sim `KERNEL_RULES`, client `DEMO_RULES`); `createGame` hash `758ef72c` + spec canonical JSON verbatim; sim line `hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=0`.

## fixtures/build.ts helpers
- `FIXTURE_SETTINGS: GameSettings` = `{v:2, seed:"fixture", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}`
- `newGame(settings: GameSettings = FIXTURE_SETTINGS, rules: Rules = TEST_RULES): GameState`
- `applyAll(state: GameState, actions: readonly unknown[], rules: Rules = TEST_RULES): { state: GameState; events: GameEvent[] }` (throws `Error("rejected at <i>: <code> <message>")`)
- `deepFreeze<T>(x: T): T`

## Pipeline (exit codes, final run)
`pnpm install --frozen-lockfile` 0; `pnpm lint` 0; `pnpm lint:purity` 0 (11 cases); `pnpm format:check` 0; `pnpm typecheck` 0; `pnpm test` 0 (209 passed); `pnpm build` 0. Golden/deletion/README greps, the three fresh-process tsx import checks and the four tool-exclusion checks: all 0.

## PIT-001 mutation proofs (single check deleted, only its test(s) fail; scratch script outside the repo)
- `seatsError`: not-array -> "players not an array"; size -> 0/5 players; plain-object -> string seat; exact-key length -> extra-key seat only; hasOwn part -> renamed-classId seat only; ids check -> id cases; string classId -> non-string classId; unknown class (`ownGet`) -> wizard/toString/constructor; hybrid -> battlemage.
- `createGame`: v, seed, object checks each fail exactly their cases.
- `deserialize` shim: rules-object, plain-object, version, root key count (extra key), root hasOwn (renamed root key) each fail only their tests.
- `reducer`: version check and `Object.hasOwn(handlers, type)` fail their tests.
- Added two "right key count" cases (renamed seat key, renamed root key) because the missing-key cases were rejectable by two checks.
- Defence-in-depth checks with no single-mutation test: `views.ts` (`players.includes` and `ownGet` each alone suffice for `self:null`), `reducer.ts` post-`hasOwn` `handler === undefined` guard (unreachable).

## Decisions
- Task 1 added the v2 `types.ts` exports additively first, as planned.
- `Action = never` workarounds: widened `type`/`playerId` to `string`, one documented cast on the handler lookup.
- The `deserialize` shim additionally throws `TypeError("deserialize: rules must be an object")` for a non-object `rules` (needed to use the parameter; `void rules;` fails lint).

## Deviations / issues
- The plan's grep `grep -rnE ... packages/sim/fixtures ...; test $? -eq 1` exits 2 (not 1) because deleting the only fixture removed the directory. Run without the missing directory it exits 1 (no matches). 02-01b re-creates `packages/sim/fixtures/kernel-game.json`, which restores the expected exit code.
