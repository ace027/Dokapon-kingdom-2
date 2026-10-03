---
phase: 03-board-economy-cpu-ai-core
plan: 01b
type: execute
wave: 2
depends_on: ["03-01a", "03-02"]
files_modified:
  - packages/core/src/types.ts
  - packages/core/src/actions.ts
  - packages/core/src/events.ts
  - packages/core/src/canonical.ts
  - packages/core/src/reducer.ts
  - packages/core/src/game.ts
  - packages/core/src/views.ts
  - packages/core/src/validation.ts
  - packages/core/src/index.ts
  - packages/core/src/serialize.ts
  - packages/core/src/serialize/index.ts
  - packages/core/src/serialize/public.ts
  - packages/core/src/serialize/private.ts
  - packages/core/src/serialize/hidden.ts
  - packages/core/src/serialize/settings.ts
  - packages/core/src/board/towns.ts
  - packages/core/src/board/signals.ts
  - packages/core/src/board/turn.ts
  - packages/core/src/board/gazette.ts
  - packages/core/src/board/victory.ts
  - packages/core/src/handlers/shared.ts
  - packages/core/src/handlers/index.ts
  - packages/core/src/handlers/board.ts
  - packages/core/src/handlers/week.ts
  - packages/core/src/handlers/boss.ts
  - packages/core/src/handlers/loadout.ts
  - packages/core/src/handlers/combat.ts
  - packages/core/src/handlers/decision.ts
  - packages/core/src/handlers/system.ts
  - packages/core/src/inventory.ts
  - packages/core/src/progression.ts
  - packages/core/src/ai/combat.ts
  - packages/core/src/ai/opponent-model.ts
  - packages/core/test/fixtures/test-rules.ts
  - packages/core/test/fixtures/build.ts
  - packages/core/test/arbitraries.ts
  - packages/core/test/clone.test.ts
  - packages/core/test/wrong-step.test.ts
  - packages/core/test/reduce-order.test.ts
  - packages/core/test/serialize-v3.test.ts
  - packages/core/test/assets.test.ts
  - packages/core/test/stubs.test.ts
  - packages/core/test/serialize.test.ts
  - packages/core/test/views.test.ts
  - packages/core/test/replay.test.ts
  - packages/core/test/reducer.test.ts
  - packages/core/test/game.test.ts
  - packages/core/test/rules.test.ts
  - packages/core/test/loadout.test.ts
  - packages/core/test/rewards.test.ts
  - packages/core/test/rewards-golden.test.ts
  - packages/core/test/combat-golden.test.ts
  - packages/core/test/combat-flow.test.ts
  - packages/core/test/decision.test.ts
  - packages/core/test/counter-bounds.test.ts
  - packages/core/test/hardening.test.ts
  - packages/core/test/ai.test.ts
  - packages/core/test/ai-hidden.test.ts
  - packages/core/test/inventory.test.ts
  - packages/core/test/progression.test.ts
  - packages/core/test/npc.test.ts
  - packages/core/test/stats.test.ts
  - packages/core/test/resolve.test.ts
  - packages/content/data/items.json
  - packages/content/test/data.test.ts
  - packages/sim/src/duel.ts
  - packages/sim/src/kits.ts
  - packages/sim/src/rules.ts
  - packages/sim/src/replay-file.ts
  - packages/sim/fixtures/combat-game.json
  - packages/sim/test/replay-file.test.ts
  - packages/sim/test/cli.test.ts
  - packages/sim/test/duel.test.ts
  - packages/sim/test/gate.test.ts
  - packages/sim/test/content-stats.test.ts
  - packages/client/src/main.ts
  - packages/client/src/render.ts
  - packages/client/test/render.test.ts
  - .planning/phases/03-board-economy-cpu-ai-core/03-01b-SUMMARY.md
files_forbidden:
  - .planning/specs/
  - .planning/reference/
  - .planning/ROADMAP.md
  - .planning/PROJECT.md
  - .planning/STATE.md
  - .planning/memory/
  - .planning/phases/01-foundations-deterministic-engine/
  - .planning/phases/02-combat-core-balance-sim/
  - packages/content/data/map.tiled.json
  - packages/content/data/tuning.json
  - packages/content/src/
  - packages/core/src/board/graph.ts
  - packages/core/src/board/effects.ts
  - packages/core/src/board/decks.ts
  - packages/core/src/rules.ts
  - packages/core/package.json
  - packages/content/package.json
  - package.json
  - pnpm-lock.yaml
  - eslint.config.js
  - scripts/
  - .github/
  - README.md
sequential_files: []
expected_artifacts:
  - path: "packages/core/src/serialize/index.ts"
    provides: "v3 serialize/deserialize split per partition"
    required: true
  - path: "packages/core/src/types.ts"
    provides: "v3 state types, SCHEMA_VERSION 3, Phase 'over', Step"
    required: true
  - path: "packages/core/test/reduce-order.test.ts"
    provides: "Reducer RNG commit-order test (apply, commit ctx.rng, applySignals)"
    required: true
  - path: "packages/sim/fixtures/combat-game.json"
    provides: "The v3-migrated replay fixture (same actions, settings v3)"
    required: true
  - path: ".planning/phases/03-board-economy-cpu-ai-core/03-01b-SUMMARY.md"
    provides: "Plan summary incl. mutation proof and golden diff review"
    required: true
autonomous: false
agents: ["engineering-senior-developer"]
requirements: [R10, R11, R12]
user_setup: []
verification_commands:
  - "test \"$(git rev-parse --abbrev-ref HEAD)\" = dev"
  - "pnpm install --frozen-lockfile"
  - "pnpm lint"
  - "pnpm lint:purity"
  - "pnpm format:check"
  - "pnpm typecheck"
  - "pnpm test"
  - "pnpm build"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/serialize/index.ts\"'"
  - "grep -q 'SCHEMA_VERSION = 3' packages/core/src/types.ts"
  - "grep -q 'WRONG_STEP' packages/core/src/reducer.ts"
  - "grep -q 'applySignals(' packages/core/src/reducer.ts"
  - "test ! -e packages/core/src/serialize.ts"
  - "grep -q 'STUB(03-03a)' packages/core/src/handlers/board.ts"
  - "grep -q 'STUB(03-03b)' packages/core/src/handlers/board.ts"
  - "grep -rn 'sample-game' packages; test $? -eq 1"
  - "grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-01b-SUMMARY.md"
  - "git log -1 --format=%s | grep -q '^Phase 3 plan 03-01b:'"
  - "git show --name-only --format= HEAD | grep -E '(^|/)(\\.tsbuild|dist|node_modules)/'; test $? -eq 1"
  - "test -z \"$(git status --porcelain)\""

must_haves:
  truths:
    - "SCHEMA_VERSION is 3, every `v` field is 3, and a v2 save or v2 replay file is rejected with SchemaVersionError whose message includes the found version; `RULES_VERSION` stays 2 (03-01a)"
    - "WRONG_STEP is checked after the actor check and before validate; phase 'over' rejects every action with WRONG_PHASE"
    - "reduce commits ctx.rng into hidden.rng BEFORE applySignals runs and applySignals sees the committed RNG and the hidden.rng of the state it returns is final; a reduce-level spy test fails if the two steps are swapped (H2)"
    - "endGame has the signature (state, ctx, rules, events) and every handler that can end the game holds a ctx"
    - "viewFor and event payloads are deep clones: mutating a view or an event never mutates state, rules or later results"
    - "All id-keyed records (positions, towns, decks.errand, buffs, weekly, totals, bonus) are read with Object.hasOwn/ownGet and survive the ids toString, valueOf, hasOwnProperty (PIT-001/PIT-002: every negative test has exactly one mutation and is proven by deleting its check)"
    - "Combat, reward and duel behaviour is unchanged: every event count, per-duel (outcome, winner), gate count and the duel perf total line are byte-identical to Phase 2; only state-hash pins are re-pinned from the TS engine, and no test carries a literal copy of rulesHash(loadRules())"
    - "packages/sim/fixtures/combat-game.json (the only replay fixture) is migrated to v3 (settings v 3, weeks 3, boss false, actions v 3, derived rulesHash) with the same 95 events"
    - "The lead-boots description says `Your next spin is fixed at 1.`; homing-stone and tag warpCastle are unchanged"
  artifacts:
    - path: "packages/core/src/serialize/index.ts"
      provides: "serialize/deserialize v3 composing the partition modules"
      min_lines: 40
      contains: "export function deserialize"
    - path: "packages/core/src/reducer.ts"
      provides: "Handler-map reducer with WRONG_STEP, cloned events and the apply, commit, signals order"
      contains: "WRONG_STEP"
  key_links:
    - from: "packages/core/src/handlers/index.ts"
      to: "packages/core/src/handlers/board.ts"
      via: "boardHandlers spread into the exhaustive handler map"
      pattern: "\\.\\.\\.boardHandlers"
    - from: "packages/core/src/reducer.ts"
      to: "packages/core/src/board/signals.ts"
      via: "applySignals called after the ctx.rng commit of every handler apply"
      pattern: "applySignals\\("
---

<objective>
Bring the engine state to v3 (the W2 half of the old 03-01):
- bump `SCHEMA_VERSION 3`, add the board state partitions, the 12 actions and 24 events, `createGame` v3, and split `serialize.ts` per partition with exact-key negative tests;
- add deep cloning, `WRONG_STEP`, loadout gating, and fix the reducer's RNG commit order (apply, commit `ctx.rng`, then `applySignals`) so later plans never edit `reducer.ts`;
- create every module a later plan fills as a typed, lettered-owner STUB;
- migrate every test, the sim, the client and the one replay fixture `combat-game.json` to v3, re-pinning state-hash goldens from the TS engine.

Purpose: spec B11 (partly), B12, the type/seam foundation for 03-03a to 03-06. Every shared type lives here so later plans never edit `types.ts`, `actions.ts`, `events.ts`, `reducer.ts` or `serialize/*` (except `serialize/hidden.ts`, owned by 03-04).
Output: v3 types/serialize/game/reducer/views, stub modules, migrated tests, sim, client and fixture, SUMMARY.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-board-economy-cpu-ai-core/03-CONTEXT.md
@.planning/specs/03-board-economy-cpu-ai-core-spec.md
@.planning/memory/ERRORS.md
@.planning/phases/02-combat-core-balance-sim/02-REVIEW.md

Relevant source files:
@packages/core/src/types.ts
@packages/core/src/rules.ts
@packages/core/src/actions.ts
@packages/core/src/events.ts
@packages/core/src/canonical.ts
@packages/core/src/reducer.ts
@packages/core/src/game.ts
@packages/core/src/views.ts
@packages/core/src/validation.ts
@packages/core/src/serialize.ts
@packages/core/src/index.ts
@packages/core/src/handlers/shared.ts
@packages/core/src/handlers/index.ts
@packages/core/src/handlers/loadout.ts
@packages/core/test/fixtures/test-rules.ts
@packages/core/test/fixtures/build.ts
@packages/core/test/arbitraries.ts
@packages/content/data/items.json
@packages/sim/src/replay-file.ts
@packages/sim/src/duel.ts
@packages/sim/fixtures/combat-game.json
</context>

<execution_contract>
Harness: read-before-write -> evidence-before-action -> minimal diff -> verify-before-report

Role: engineering-senior-developer (executor, model `sonnet`); self-review of every negative test against PIT-001 before reporting.
Task: implement spec sections 3 (D2, D5, D6, D12, D21, D22), 4.1, 4.2 (types and guards only), 4.11 and the reference updates of section 12, exactly as specialised by 03-CONTEXT.md *Shared contracts* and *Cross-plan seams*. Requirements R10, R11, R12.
Scope:
- Read targets: spec sections above, 03-CONTEXT.md, 02-REVIEW.md, ERRORS.md, every file in `<context>`, `packages/core/test/**` and `packages/sim/test/**` (to migrate).
- Write targets: exactly `files_modified` (new files include everything under `packages/core/src/serialize/` and `packages/core/src/board/{towns,signals,turn,gazette,victory}.ts`).
- Forbidden targets: `files_forbidden`. `Rules` (`core/src/rules.ts`) is NOT changed here (03-01a owns it, 03-04 adds decree/errand/gazette fields).
Workspace: this plan runs ALONE in wave 2, in the main checkout `/home/user/Dokapon-kingdom-2` on branch `dev` after wave 1 is merged, green and pushed (03-CONTEXT *Worktree and merge-order rules*). Never push; never use GitHub MCP.
Allowed tools/actions:
- Edit listed files; run package-scoped checks (`pnpm vitest run packages/core`, `pnpm exec tsc -b packages/core`, `pnpm exec eslint packages/core packages/content packages/sim packages/client`, `pnpm lint:purity`, `pnpm exec prettier --write|--check <paths>`).
- Run the full repo pipeline (required at the end of Task 3).
- `git add`/`git commit` on `dev` (no push).
- Throwaway scripts only in `/tmp/usurpia-scratch/03-01b/` (import sources by absolute path), never inside the checkout.
Forbidden actions:
- Do not modify files outside files_modified; do not add dependencies; do not edit `eslint.config.js`, `scripts/`, CI or README.
- Do not change combat, reward, loadout or progression behaviour; the only handler change outside new stubs is the loadout metadata (actor `active`, steps `spin|act`, `switchClass` only on the Castle node, spec D6).
- Do not self-defer planned work; do not weaken any invariant or test to make a golden pass.
- Do not push; do not use GitHub MCP; no eslint-disable comments; no floats in state; no `Math.random`/`Date` in core src.
Implementation sequence:
1. Read the targets. Record the baseline: run `pnpm test` once and note the Phase 2 pins listed in 03-CONTEXT (they are the invariants that must not move).
2. Task 1: v3 types, actions/events unions, `createGame`, `serialize/` split with v3 checks, stubs and seams, `handlers/index.ts` spreads.
3. Task 2: `cloneJson`, `WRONG_STEP`, loadout gating, reducer commit order, lead-boots text.
4. Task 3: migrate and re-pin every test, the sim and client, migrate `combat-game.json`, full pipeline, mutation proof, SUMMARY, commit.
Required interfaces/content structure: see each task. Edge/error cases: see each task.
Verification criteria:
- Every `> verification:` line and every `verification_commands` entry exits 0.
- Mutation proof (PIT-001): for every v3 `deserialize` check, `WRONG_STEP` and the reducer commit order, temporarily delete or invert the check, run the owning test file, confirm only its own test(s) fail, restore; record under `## Mutation proof` in the SUMMARY.
- Golden diff review: the SUMMARY lists every re-pinned value as old -> new and confirms the unchanged invariants (event counts 80/84/10/95, duel stdout, gate counts, perf total).
Final result format:
- Status: Complete | Partial | Failed | BLOCKED
- Files changed
- Verification commands and outputs
- Decisions made
- Issues/errors
</execution_contract>

<stop_gates>
Emit `BLOCKED` and stop instead of guessing when:
- A read target in `<context>` is missing or unreadable, or wave 1 (03-01a, 03-02) is not merged on `dev`.
- Completing a task needs a file not in `files_modified` or one in `files_forbidden`.
- A Phase 2 invariant (event count, per-duel outcome/winner, gate count, duel perf total) changes after the v3 migration: report the first diverging test and field; do not re-pin it.
- A negative test cannot be built with exactly one mutation and a unique message: report the check and the minimal cascading message set.
- The reducer order test cannot distinguish the two orders (it must fail when the commit moves after `applySignals`).
- Verification commands are non-deterministic, fail after one focused fix attempt, or cannot run.
</stop_gates>

<recovery>
After compaction, interruption, or context loss:
1. Re-read this PLAN.md, 03-CONTEXT.md and any 03-01b-SUMMARY.md draft.
2. Run `git diff --stat` and `git status --porcelain`; inspect `git diff` for every changed file.
3. Compare changed files against `files_modified` and `files_forbidden`; any unapproved change means `BLOCKED`.
4. Re-run the verification lines of every task already marked complete before continuing.
5. Continue only from the next unverified task; do not rely on memory-only claims.
</recovery>

<tasks>

<task type="auto">
  <name>Task 1: v3 state, actions and events, createGame, serialize split, stubs and seams</name>
  <files>packages/core/src/types.ts, packages/core/src/actions.ts, packages/core/src/events.ts, packages/core/src/game.ts, packages/core/src/validation.ts, packages/core/src/serialize.ts, packages/core/src/serialize/index.ts, packages/core/src/serialize/public.ts, packages/core/src/serialize/private.ts, packages/core/src/serialize/hidden.ts, packages/core/src/serialize/settings.ts, packages/core/src/board/towns.ts, packages/core/src/board/signals.ts, packages/core/src/board/turn.ts, packages/core/src/board/gazette.ts, packages/core/src/board/victory.ts, packages/core/src/handlers/shared.ts, packages/core/src/handlers/index.ts, packages/core/src/handlers/board.ts, packages/core/src/handlers/week.ts, packages/core/src/handlers/boss.ts, packages/core/src/index.ts, packages/core/test/serialize-v3.test.ts, packages/core/test/assets.test.ts, packages/core/test/stubs.test.ts, packages/core/test/game.test.ts</files>
  <action>
Read spec 4.1, 4.2, 4.11, D2-D8, D11, D17, D21, 03-CONTEXT *Shared contracts* and *Cross-plan seams*, the whole of `serialize.ts` (note its message style, `SchemaVersionError`, the per-partition checks and `decisionSeq` bound), `game.ts`, `validation.ts`, `handlers/shared.ts`, `handlers/loadout.ts` (handler shape).

1. **`types.ts`:** `SCHEMA_VERSION = 3`; `Phase = "turn" | "decision" | "over"`; add `Step`, `Counters` (plus `COUNTER_KEYS` ordered array), `Buff`, `DecreeView`, `ErrandView`, `BattleCtx`, `GazetteView` (`{id: string; week: number; round: number}`, the last drawn card, CONTEXT *Shared contracts*), `Deck`, `Decks`, `Tally`, `Award`, `AwardId`, and the v3 `PublicState`/`PrivateState`/`HiddenState` additions exactly as spec 4.1 and CONTEXT (public: `week, weeksTotal, turnsPerWeek (6), round, step, spin, turnTowns, positions, towns, decree, gazette, buffs, weekly, totals, bonus, boss, bossAttempted, spoils, battle, result`; private: `errand, rerollUsed`; hidden: `decks`). `GameSettings` gains `weeks: 3 | 4 | 5` and `boss: boolean` (exact keys `v, seed, players, weeks, boss`). `MAX_BOARD_BUFFS = 4`, `TURNS_PER_WEEK = 6`.
2. **`actions.ts`:** add the 12 actions with the exact key sets of CONTEXT (spin `{item: "swift-boots" | "lead-boots" | "pathfinder" | null, pick: number | null}`; `shop/buy|sell` `{kind: "gear" | "item" | "spell", id}`; etc.).
3. **`events.ts`:** add `EffectResult` and the 24 new event variants of CONTEXT with their exact fields; private ones (`ErrandAssigned`, `ErrandExpired`) use `onlyPlayers([playerId])`, every other new event is `PUBLIC`.
4. **`game.ts` `createGame(settings, rules)`:** validate `weeks` in `{3,4,5}` and `boss` boolean with `SettingsError` messages `weeks must be 3, 4 or 5` and `boss must be a boolean` (keep Phase 2 messages and their precedence; the exact-key check now expects `v, seed, players, weeks, boss`). Initial v3 state: `phase "turn"`, `week 0`, `round 1`, `step "weekBreak"`, `turnsPerWeek 6`, `spin null`, `turnTowns []`, `positions` = every player at the castle node (`rules.map.nodes.find(space === "castle")`), `towns` = every `rules.map.towns` key with `{owner: null, value: 0, liberatedWeek: null}`, `decree {current: null, used: []}`, `gazette {last: null, shopsClosedUntil: 0, taxHoliday: false}`, `buffs`/`weekly`/`totals`/`bonus` zero-filled per player (`Object.fromEntries`), `boss {enabled: settings.boss, hp: rules.board.bossHp, unlocked: false}`, `bossAttempted false` (boolean, reset by `startTurn`, set by `boss/enter`; it enforces one boss attempt per turn without an import cycle), `spoils null`, `battle null`, `result null`; private `errand null`, `rerollUsed false`; hidden `decks {gazette: {draw: [], discard: []}, decree: [], errand: <per player {draw: [], discard: []}>}`. No RNG is consumed at creation (decks initialise lazily on first draw, CONTEXT `Deck`). Build every record with `Object.fromEntries` (PIT-002).
5. **`serialize/` split (D21):** delete `serialize.ts`; create `serialize/{index,public,private,hidden,settings}.ts`. `index.ts` exports `serialize`, `deserialize`, `SchemaVersionError`, `hashState`, `stableStringify` (same public surface and the same re-exports `core/index.ts` uses; fix imports repo-wide, `moduleResolution: bundler` resolves `./serialize` to the directory index). `deserialize(json, rules)`: parse, reject `v !== 3` with `SchemaVersionError` whose message includes the found version (`unsupported schema version <found>, expected 3`; found shown as `unknown` for non-numbers), then partition modules validate with exact-key checks. New checks (each its own message in the existing style, each with a single-mutation negative test in `serialize-v3.test.ts`, PIT-001; each partition has extra-key and missing-key tests):
   - public: `week` int 0..`weeksTotal`; `weeksTotal` in 3|4|5; `turnsPerWeek` 6; `round` 1..6; `step` in the four values; `phase "over"` iff `result` non-null; `spin` null unless `step "move"` (non-null iff `step "move"`), with `steps` 1..`rules.board.maxSteps`, `max` in `steps..maxSteps`, `mods` array of at most 8 choice-pattern strings; `turnTowns` unique town ids; `positions` exact key set equals `players`, each a node id of `rules.map`; `towns` exact key set equals `rules.map.towns` keys, `owner` null or a player, unowned means `value 0` and `liberatedWeek null`, owned means value in `[floor(base/2), 3*base]` and `liberatedWeek` int 1..`weeksTotal`; `decree.used` unique strings, `decree.current` null or valid `DecreeView` (progress keys subset of players, `completedBy` null or a player); `gazette` fields typed, `shopsClosedUntil` int >= 0; `buffs` exact player keys, each array length <= 4 with valid `Buff`; `weekly`/`totals` exact player keys with exact `Counters` keys, ints 0..`MAX_COUNTER`; `bonus` ints 0..`MAX_COUNTER`; `boss.hp` int 0..`rules.board.bossHp`, `boss.unlocked` implies `boss.enabled`; `bossAttempted` is a boolean and true only when `boss.enabled && boss.unlocked`; `spoils` null or distinct seated `winner`/`loser`; `battle` null or a valid `BattleCtx` (players seated, nodes/towns/monsters exist via `ownGet`/`Object.hasOwn`), and `battle !== null` implies `combat !== null`; `result` null or `{winner (seated), tally (exact player keys), awards (<= 3, valid ids, seated)}`.
   - private: `errand` null or `{id: choice-pattern string, progress >= 0, target >= 1}`; `rerollUsed` boolean.
   - hidden: `decks.gazette`/`decks.errand[p]` have `draw`/`discard` as arrays of choice-pattern strings with no duplicate across draw+discard; `decks.decree` unique strings; `decks.errand` exact player key set. (Pool membership is checked by 03-04 in `hidden.ts` once decree/errand/gazette ids exist in `Rules`; leave a single clearly named function `checkDeckMembership(hidden, rules): string | null` returning `null` and marked `// STUB(03-04)`.)
   - settings partition: exact keys, `weeks`, `boss`.
   Keep every Phase 2 check (combat, decisions, `decisionSeq` bound, mastery, bags) unchanged in behaviour; combat `battle` cross-link is the only addition.
6. **Seams and stubs (CONTEXT *Cross-plan seams*).** Every stub carries a `// STUB(<owner plan>)` marker with the lettered owner id (`03-03a`, `03-03b`, `03-04`, `03-05a`). Create:
   - `board/towns.ts`: real `assetsOf(state: GameState, rules: Rules, playerId: PlayerId): number` (D17: gold + every bag item and scroll at `floor(price * sellBp / 10000)` + equipped weapon/shield/accessory at the same rate (spells excluded) + sum of `towns[*].value` owned by the player + `bonus[p]`; unknown ids contribute 0 via `Object.hasOwn`); `collectTax(state, rules, events): GameState` returning `state` with `// STUB(03-03a)`.
   - `board/turn.ts`: `startTurn(state, playerId, rules, events): GameState` that, when the character is KO'd (`hp === 0`), revives it to `max(1, floor(maxHp * rules.board.reviveBp / 10000))`, then sets `public.activePlayer = playerId`, `step "spin"`, `spin null`, `turnTowns []`, `spoils null`, `bossAttempted false`, and emits `TurnStarted{playerId, week, round, revived, regen: 0}`; `// STUB(03-03a): regen via hooks and turnTowns = the town at the start node`. (03-04's `week/advance` and 03-03b's `turn/end` both rely on `startTurn` leaving the board in `step "spin"` for that player.)
   - `board/signals.ts`: `applySignals(prev: GameState, next: GameState, events: readonly GameEvent[], rules: Rules): {state: GameState; events: GameEvent[]}` returning `{state: next, events: []}` with `// STUB(03-04)`. Contract fixed here (H2): `applySignals` receives `next` with the handler's RNG already committed; if it needs randomness (03-04's errand rewards) it builds its OWN ctx from `next.hidden.rng` and returns the advanced RNG inside the state it returns; `reduce` returns `signals.state` as is, so nothing overwrites it afterwards.
   - `board/gazette.ts`: `drawGazette(state, ctx, rules, events): GameState` returning `state` with `// STUB(03-04)`.
   - `board/victory.ts`: `endGame(state: GameState, ctx: Ctx, rules: Rules, events: GameEvent[]): GameState` (H2: the caller holds a `ctx`; `Ctx` is a type-only import from `../handlers/shared`, erased at compile time so no runtime cycle) that sets `phase "over"` and `result {winner: players[0], tally: zero tally, awards: []}` and emits `GameEnded`, with `// STUB(03-05a)`. Unused parameters carry a leading underscore only if the lint config allows it; otherwise reference them with a harmless typed no-op, never an eslint-disable comment.
   - `handlers/board.ts` exports `boardHandlers` (all of `board/spin, board/move, board/useItem, town/liberate, town/invest, town/seize, shop/buy, shop/sell, turn/end`), `handlers/week.ts` exports `weekHandlers` (`week/advance, errand/reroll`) and `runWeekEnd(state, ctx, rules, events): GameState` (stub: sets `step "weekBreak"`), `handlers/boss.ts` exports `bossHandlers` (`boss/enter`). Each handler has a real `guard` (exact key set, types, ranges: `pick` 1..6 or null, `amount` int >= 1 and <= `MAX_COUNTER`, item/town/node ids matching `CONTENT_ID_PATTERN` (`^[a-z][a-z0-9-]{0,47}$`, which also covers `n01` and `t01`) via a guard helper added to `handlers/shared.ts`; `path` array of 1..9 node-id strings), the metadata of CONTEXT (`phases`, `actor`, `steps`), and `validate` returning `reject("INVALID_PAYLOAD", "not implemented")` plus an `apply` that returns `{state, events: []}`. Marker owners: `board/spin`, `board/move`, `board/useItem` are `// STUB(03-03a)`; `town/*`, `shop/*`, `turn/end` are `// STUB(03-03b)`; `week/advance`, `errand/reroll` and `runWeekEnd` are `// STUB(03-04)`; `boss/enter` is `// STUB(03-05a)`.
   - `handlers/index.ts`: spread `...boardHandlers, ...weekHandlers, ...bossHandlers` into the handler map (type `satisfies HandlerMap` keeps it exhaustive).
   - `core/src/index.ts`: export the new types, `assetsOf`, `SCHEMA_VERSION` and `Step` (the `graph.ts` exports already exist from 03-01a); do not export stubs' internals.
7. **Tests:** `serialize-v3.test.ts` (round-trip of `createGame` states with 1-4 players and weeks 3/4/5, one single-mutation negative test per check above with exact message, extra/missing key per partition, the `SchemaVersionError` message for `v: 2`, `v: "3"`, missing `v`), `assets.test.ts` (D17 worked cases: gold only; bag + scrolls + gear at 5000 bp; towns; bonus; unknown id contributes 0; ids `toString`/`valueOf`/`hasOwnProperty` as players), `stubs.test.ts` (named for history; it must stay green after 03-03a/03-03b/03-04/03-05a fill the stubs, so it asserts only what never changes: for every one of the 12 board/week/boss actions, a shape-invalid payload is rejected with the reducer's existing shape-rejection code (read it from `reducer.ts`), and the `phases`/`actor`/`steps` metadata yields `WRONG_PHASE`, `WRONG_ACTOR` and `WRONG_STEP` through `reduce` on otherwise valid payloads; it never asserts the `not implemented` message or the stub bodies)), extend `game.test.ts` (v3 initial state structure, `SettingsError` for each new settings check, prototype-key player ids). Pins for the `createGame` hash are written in Task 3.

Edge/error cases: unknown settings keys; `weeks` 2/6/"3"/3.5; `boss` "true"; ids in `positions`/`towns` that are prototype members; deck arrays containing the same id twice across `draw` and `discard`; `spin` set while `step` is not `move`; `phase "over"` with `result` null; owned town value below `floor(base/2)` and above `3*base`.

> verification: pnpm exec tsc -b packages/core
> verification: pnpm vitest run packages/core/test/serialize-v3.test.ts packages/core/test/assets.test.ts packages/core/test/stubs.test.ts packages/core/test/game.test.ts
> verification: test ! -e packages/core/src/serialize.ts
> verification: grep -q 'SCHEMA_VERSION = 3' packages/core/src/types.ts
> verification: grep -q '\.\.\.boardHandlers' packages/core/src/handlers/index.ts
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/serialize/index.ts"'
> verification: pnpm exec eslint packages/core/src
  </action>
  <verify>
pnpm exec tsc -b packages/core
pnpm vitest run packages/core/test/serialize-v3.test.ts packages/core/test/assets.test.ts packages/core/test/stubs.test.ts packages/core/test/game.test.ts
test ! -e packages/core/src/serialize.ts
grep -q 'SCHEMA_VERSION = 3' packages/core/src/types.ts
grep -q '\.\.\.boardHandlers' packages/core/src/handlers/index.ts
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/serialize/index.ts"'
pnpm exec eslint packages/core/src
  </verify>
  <done>GameState, actions, events and settings are v3 with exact-key partitioned serialization, createGame builds the board state without consuming RNG, and every module a later plan fills exists as a typed STUB with real guards, metadata and a lettered owner marker.</done>
</task>

<task type="auto">
  <name>Task 2: Deep clone, WRONG_STEP, loadout gating, reducer RNG commit order, lead-boots description</name>
  <files>packages/core/src/canonical.ts, packages/core/src/reducer.ts, packages/core/src/views.ts, packages/core/src/handlers/shared.ts, packages/core/src/handlers/loadout.ts, packages/core/test/clone.test.ts, packages/core/test/wrong-step.test.ts, packages/core/test/reduce-order.test.ts, packages/content/data/items.json, packages/content/test/data.test.ts</files>
  <action>
Read spec D5, D6, D12, `reducer.ts` (the `reduce` tail: `makeCtx`, the `hidden.rng` write-back after `apply`), `views.ts`, `canonical.ts`, `handlers/loadout.ts`, `handlers/shared.ts` and `packages/content/data/items.json` (`lead-boots`, `swift-boots`).

1. **Deep clone (D12).** `canonical.ts` exports `cloneJson<T>(value: T): T`: a recursive structural copy for canonical JSON values (null, boolean, string, finite number, arrays, plain objects; objects rebuilt with `Object.fromEntries(Object.keys(value).map(...))` so `__proto__` stays an own data key); throws `TypeError("cloneJson: unsupported <type> value at <path>")` for anything else (same path style as `stableStringify`). `views.ts` `viewFor` returns `public` and `self` as `cloneJson` copies (counts already fresh). `reducer.ts`: `reduce` returns `events: cloneJson(applied.events)` and still never mutates `state`; the returned `state` shares no objects with the input `state` partitions it changed (unchanged partitions may be shared; document that in the doc comment). `redactEvent`/`eventsFor` return events unchanged (already cloned at the source). Do not add a shared-view variant now (03-06 owns the perf fallback).
2. **`WRONG_STEP` (D5).** Add `"WRONG_STEP"` to `RejectCode`; `Handler` (in `handlers/shared.ts`) gains `steps?: readonly Step[]`; `reduce` checks, in this order: version, type, shape, phase, actor, **step** (when `handler.steps !== undefined` and `!handler.steps.includes(state.public.step)` return `WRONG_STEP` with message `<type> is not allowed in step <step>`), validate. Phase `"over"` is in no handler's `phases`, so every action returns `WRONG_PHASE`.
3. **Loadout gating (D6).** `loadout/*` handlers (`switchClass`, `discard`, `useItem`, `setPortable`): `actor: "active"`, `steps: ["spin", "act"]`; `loadout/switchClass` additionally requires the active player's node to be the castle (single check, `INVALID_PAYLOAD` message `class can only be switched at the castle`, placed after the existing Phase 2 checks so existing negatives keep their precedence). `system/*` and `combat/start` have no `steps`.
4. **Reducer RNG commit order (H2).** Today `reduce` builds `ctx = makeCtx(state.hidden.rng)`, calls `handler.apply`, then overwrites `hidden.rng` from `ctx.rng`. Any post-apply layer that wrote `hidden.rng` would be silently discarded. Fix the order once, here, so no later plan has to touch `reducer.ts`: (a) `applied = handler.apply(state, a, ctx, rules)`; (b) commit: `committed = {...applied.state, hidden: {...applied.state.hidden, rng: ctx.rng}}`; (c) `signals = applySignals(state, committed, applied.events, rules)`; (d) return `{ok: true, state: signals.state, events: cloneJson([...applied.events, ...signals.events])}`. `applySignals` therefore always sees the committed RNG, and any RNG it consumes lives in the state it returns (contract in Task 1). Handlers that end the game (`turn/end`, `week/advance`) hold the `ctx` and call `endGame(state, ctx, rules, events)` inside `apply`, so the RNG they consume is committed by step (b). Document the order (apply, commit, signals) in the `reduce` doc comment.
5. **`lead-boots` description (M3).** `items.json`: change the `lead-boots` description from `Target's next spin is fixed at 1.` to `Your next spin is fixed at 1.` (the tag `spinFixed` targets `self`; the spin action consumes it for the active player, spec 4.2). `homing-stone` and tag `warpCastle` stay exactly as they are (the design's Castle warp is kept, CONTEXT OQ5). If `content/test/data.test.ts` pins item descriptions, update that single assertion. This changes `rulesHash(loadRules())` by design; every test derives it (03-01a), so only the fixture `rulesHash` field moves (Task 3).
6. **Tests.** `clone.test.ts` (mutating a view, a view's nested arrays, and an event never changes `state`, `rules` or the next `viewFor`; `cloneJson` rejects `undefined`, `NaN`, functions, class instances; `__proto__` key preserved as own property), `wrong-step.test.ts` (each stepped handler rejected with `WRONG_STEP` from every other step; precedence: wrong phase beats wrong step, wrong actor beats wrong step, wrong step beats validate, using shape-valid actions built from a valid fixture with exactly one mutation each; phase `over` gives `WRONG_PHASE`; loadout actions rejected in `move`/`weekBreak`, accepted in `spin`/`act`; `switchClass` off-castle rejected), `reduce-order.test.ts` (H2: `vi.mock("../src/board/signals")` wrapping the real stub with a spy that records `next.hidden.rng` and `prev.hidden.rng`; drive a handler that consumes RNG through `ctx` (a Phase 2 combat or loadout action that draws, or a purpose-built test handler map entry via the existing test fixtures) and assert (i) the spy runs exactly once per successful `reduce` and never for a rejected action, (ii) `next.hidden.rng` seen by the spy equals the `ctx`-advanced RNG and differs from `prev.hidden.rng`, (iii) the returned `state.hidden.rng` deep-equals the spy's `next.hidden.rng` when the spy returns `next` unchanged, and (iv) a spy that returns a state with a different `hidden.rng` has that value returned unchanged, proving signals run after the commit. The test must fail if step (b) is moved after step (c); prove it by swapping the two lines and watching exactly this test fail).

Edge/error cases: `cloneJson` on very deep states (no recursion limit issue at Phase 3 sizes; document the depth assumption); a viewer id that is a prototype member (`toString`) still gets `self: null`; events with frozen shared constants (`PUBLIC`) are cloned, not shared; a rejected action never reaches `applySignals`.

> verification: pnpm vitest run packages/core/test/clone.test.ts packages/core/test/wrong-step.test.ts packages/core/test/reduce-order.test.ts packages/core/test/loadout.test.ts packages/core/test/views.test.ts
> verification: grep -q 'WRONG_STEP' packages/core/src/reducer.ts
> verification: grep -q 'cloneJson' packages/core/src/views.ts
> verification: grep -q 'applySignals(' packages/core/src/reducer.ts
> verification: grep -q 'Your next spin is fixed at 1' packages/content/data/items.json
> verification: pnpm exec eslint packages/core/src packages/content/src
  </action>
  <verify>
pnpm vitest run packages/core/test/clone.test.ts packages/core/test/wrong-step.test.ts packages/core/test/reduce-order.test.ts packages/core/test/loadout.test.ts packages/core/test/views.test.ts
grep -q 'WRONG_STEP' packages/core/src/reducer.ts
grep -q 'cloneJson' packages/core/src/views.ts
grep -q 'applySignals(' packages/core/src/reducer.ts
grep -q 'Your next spin is fixed at 1' packages/content/data/items.json
pnpm exec eslint packages/core/src packages/content/src
  </verify>
  <done>The reducer clones views and events, rejects out-of-step actions with WRONG_STEP, commits the handler RNG before the signal layer, loadout actions are active-player, step-gated and castle-restricted, and the lead-boots text matches its self-targeting tag.</done>
</task>

<task type="auto">
  <name>Task 3: Migrate tests, re-pin composite goldens, sim and client, migrate combat-game.json, pipeline, commit</name>
  <files>packages/core/src/handlers/combat.ts, packages/core/src/handlers/decision.ts, packages/core/src/handlers/system.ts, packages/core/src/inventory.ts, packages/core/src/progression.ts, packages/core/src/ai/combat.ts, packages/core/src/ai/opponent-model.ts, packages/core/test/fixtures/build.ts, packages/core/test/fixtures/test-rules.ts, packages/core/test/arbitraries.ts, packages/core/test/*.test.ts, packages/sim/src/duel.ts, packages/sim/src/kits.ts, packages/sim/src/rules.ts, packages/sim/src/replay-file.ts, packages/sim/fixtures/combat-game.json, packages/sim/test/*.test.ts, packages/client/src/main.ts, packages/client/src/render.ts, packages/client/test/render.test.ts, .planning/phases/03-board-economy-cpu-ai-core/03-01b-SUMMARY.md</files>
  <action>
Read spec D13 (re-pin list only), D22, section 8, 02-REVIEW.md "Suggestions / deferred", `packages/sim/src/replay-file.ts`, `packages/sim/fixtures/combat-game.json`, every core/sim/client test that creates a game or pins a hash.

1. **Migrate tests.** Update the helpers (`fixtures/build.ts`, `arbitraries.ts`) so states default to `step "act"` for the active player at the castle where a test needs loadout actions (a helper `atStep(state, step, node?)` that rebuilds public.step/positions through a typed copy, used by tests only; do not add test-only code to src). Every existing test keeps its assertions; only settings (`weeks: 3, boss: false`), `v` literals, and hash pins change. New tests: `clone.test.ts` (mutating a view, a view's nested arrays, and an event never changes `state`, `rules` or the next `viewFor`; `cloneJson` rejects `undefined`, `NaN`, functions, class instances; `__proto__` key preserved as own property), `wrong-step.test.ts` (each stepped handler rejected with `WRONG_STEP` from every other step; precedence: wrong phase beats wrong step, wrong actor beats wrong step, wrong step beats validate, using shape-valid actions built from a valid fixture with exactly one mutation each; phase `over` gives `WRONG_PHASE`; loadout actions rejected in `move`/`weekBreak`, accepted in `spin`/`act`; `switchClass` off-castle rejected).
2. **`v` fallout.** Every `v: 2` literal in `packages/core/src` outside the files above (`handlers/combat.ts`, `handlers/decision.ts`, `handlers/system.ts`, `inventory.ts`, `progression.ts`, `ai/combat.ts`, `ai/opponent-model.ts`) becomes the `SCHEMA_VERSION` constant or 3; no behaviour changes.
3. **Re-pin from the TS engine (PRF-004, diff reviewed).** First prove the invariants: run `pnpm vitest run` and list every failing assertion; the only legitimate failures are hash values (`hashState`, replay-line hashes). Event counts (80, 84, 10, 95), per-duel `(outcome, winner)`, gate counts, duel stdout blocks and the perf total line must pass unchanged; if not, `BLOCKED`. `rulesHash(TEST_RULES)` is NOT re-pinned here (03-01a pinned it; `Rules` is unchanged by this plan) and every `rulesHash(loadRules())` use is derived (03-01a), so the lead-boots description changes no test. Re-pin, recording old -> new in the SUMMARY: `createGame` fixture hash (was `758ef72c`) and its canonical JSON golden, kernel poll replay (was `9616698e`), combat golden (was `ec0c3508`), rewards golden (was `57da3ea4`) including any per-step hash table the tests carry, and the sim fixture line (`hash=0483c0fa ...`, the `rules=` token stays derived). Also add a v3 negative: a v2 `GameState` JSON and a v2 replay file are rejected (state: `SchemaVersionError`; replay file: `SchemaVersionError` thrown by `replay-file.ts` before `createGame`, message includes `2`; the CLI prints `error: <message>` and exits 2, covered in `cli.test.ts`).
4. **Sim, client and the fixture migration (C1).** `sim/src/duel.ts`/`kits.ts` settings gain `weeks: 3, boss: false` and `v: 3`; `replay-file.ts` accepts v3 files only (check `settings.v` first, then `createGame`); `client/src/main.ts` demo settings gain `weeks`/`boss`; `render.ts` output stays textually the same unless a v3 field is rendered (do not render new fields). Migrate `packages/sim/fixtures/combat-game.json` (the ONLY committed replay fixture; it is v2 today: `settings.v 2`, every action `v: 2`) with a throwaway script in `/tmp/usurpia-scratch/03-01b/`: `settings {v: 3, seed, players, weeks: 3, boss: false}`, every action `v: 3`, the same action sequence and event count (95), `rulesHash` set to `rulesHash(loadRules())` (the single derived pin; 03-04 afterwards touches only that field). Do not create any other fixture and do not rename this one.
5. **Close.** Mutation proof table in the SUMMARY (every v3 deserialize check, `WRONG_STEP`, `cloneJson` path errors, the three loadout gating checks, the reducer commit order). Run the full pipeline: `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`. Write `03-01b-SUMMARY.md` (sections: Result, Files changed, Golden diff review, Mutation proof, Decisions made (including any Rules/serialize message wording choices), Stub inventory with lettered owner plans, Issues). The SUMMARY must state under Decisions: "There is no `'combat'` Phase member: `Phase` is `turn | decision | over`; combat is `phase decision` with a pending `combat/exchange` (spec 4.1 listing `'combat'` is superseded by D5)". Commit on `dev` with message `Phase 3 plan 03-01b: v3 state foundation` ending with the attribution trailer lines from the execution prompt; verify `git show --name-only --format= HEAD` has no `.tsbuild/`, `dist/`, `node_modules/` paths and `git status --porcelain` is empty.

Edge/error cases: `cloneJson` on very deep states (no recursion limit issue at Phase 3 sizes; document the depth assumption); a viewer id that is a prototype member (`toString`) still gets `self: null`; events with frozen shared constants (`PUBLIC`) are cloned, not shared.

> verification: pnpm vitest run
> verification: pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm build
> verification: grep -q 'a=5411 b=2370 draw=2118 fled=101' packages/sim/test/perf.test.ts
> verification: grep -q '"v": 3' packages/sim/fixtures/combat-game.json
> verification: grep -rn 'sample-game' packages; test $? -eq 1
> verification: grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-01b-SUMMARY.md
> verification: grep -q "no .combat. Phase member" .planning/phases/03-board-economy-cpu-ai-core/03-01b-SUMMARY.md
  </action>
  <verify>
pnpm vitest run
pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm build
grep -q 'a=5411 b=2370 draw=2118 fled=101' packages/sim/test/perf.test.ts
grep -q '"v": 3' packages/sim/fixtures/combat-game.json
grep -rn 'sample-game' packages; test $? -eq 1
grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-01b-SUMMARY.md
grep -q "no .combat. Phase member" .planning/phases/03-board-economy-cpu-ai-core/03-01b-SUMMARY.md
  </verify>
  <done>Every Phase 2 behaviour and non-hash golden is unchanged, the replay fixture is v3, all state-hash goldens are re-pinned from the engine with a reviewed diff, and the plan is committed on dev after a green full pipeline.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `SCHEMA_VERSION 3`, v2 saves and replay files rejected with `SchemaVersionError` including the found version.
- [ ] `reduce-order.test.ts` passes and fails (only it) when the `ctx.rng` commit is moved after `applySignals`.
- [ ] Event counts 80/84/10/95, per-duel outcomes, gate counts, duel stdout and the perf total line are unchanged; only state-hash pins moved (old -> new in the SUMMARY).
- [ ] `grep -rn "STUB(" packages/core/src` lists exactly the seams of the CONTEXT table, each with a lettered owner plan.
- [ ] `combat-game.json` is v3 with the same action sequence, and no literal `rulesHash(loadRules())` exists in any test.
- [ ] Full pipeline green on `dev`; commit message and contents verified.
- [ ] Every planned task is completed, blocked with evidence, or escalated; no planned work is self-deferred.
</verification>

<success_criteria>
- State, actions, events and settings are v3; `serialize/` is split per partition with exact-key negative tests; `createGame` builds the board state without consuming RNG.
- `viewFor` and events are deep clones; `WRONG_STEP` precedence is tested; the reducer commits RNG before signals; loadout actions are active-player, step-gated and castle-restricted for class switching.
- All later seams exist as typed stubs; 03-03a, 03-03b and 03-04 can each be executed without editing `types.ts`, `actions.ts`, `events.ts`, `reducer.ts`, `serialize/*` (except `hidden.ts`) or `handlers/index.ts`.
</success_criteria>

<output>
After completion, create `.planning/phases/03-board-economy-cpu-ai-core/03-01b-SUMMARY.md`

No STATE.md or ROADMAP.md edits (the orchestrator owns them). The orchestrator pushes `dev` and proves CI after this plan.
</output>
