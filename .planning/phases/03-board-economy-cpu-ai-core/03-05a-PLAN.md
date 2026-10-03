---
phase: 03-board-economy-cpu-ai-core
plan: 05a
type: execute
wave: 5
depends_on: ["03-03b", "03-04"]
files_modified:
  - packages/core/src/board/victory.ts
  - packages/core/src/handlers/boss.ts
  - packages/core/src/index.ts
  - packages/core/test/victory.test.ts
  - packages/core/test/awards.test.ts
  - packages/core/test/boss.test.ts
  - packages/content/test/effects-parity.test.ts
  - .planning/phases/03-board-economy-cpu-ai-core/03-05a-SUMMARY.md
files_forbidden:
  - .planning/specs/
  - .planning/reference/
  - .planning/ROADMAP.md
  - .planning/PROJECT.md
  - .planning/STATE.md
  - .planning/memory/
  - .planning/phases/01-foundations-deterministic-engine/
  - .planning/phases/02-combat-core-balance-sim/
  - packages/core/src/types.ts
  - packages/core/src/actions.ts
  - packages/core/src/events.ts
  - packages/core/src/canonical.ts
  - packages/core/src/reducer.ts
  - packages/core/src/game.ts
  - packages/core/src/views.ts
  - packages/core/src/rules.ts
  - packages/core/src/serialize/
  - packages/core/src/combat/
  - packages/core/src/board/graph.ts
  - packages/core/src/board/effects.ts
  - packages/core/src/board/decks.ts
  - packages/core/src/board/effect-world.ts
  - packages/core/src/board/gazette.ts
  - packages/core/src/board/signals.ts
  - packages/core/src/board/hooks.ts
  - packages/core/src/board/settle.ts
  - packages/core/src/board/landing.ts
  - packages/core/src/board/towns.ts
  - packages/core/src/board/turn.ts
  - packages/core/src/handlers/shared.ts
  - packages/core/src/handlers/loadout.ts
  - packages/core/src/handlers/index.ts
  - packages/core/src/handlers/board.ts
  - packages/core/src/handlers/combat.ts
  - packages/core/test/fixtures/
  - packages/content/data/
  - packages/content/src/
  - packages/sim/
  - packages/client/
  - package.json
  - pnpm-lock.yaml
  - scripts/
  - .github/
  - README.md
  - packages/core/src/ai/
  - packages/core/src/handlers/week.ts
  - eslint.config.js
  - packages/core/test/ai.test.ts
  - packages/core/test/ai-persona.test.ts
  - packages/core/test/ai-plan.test.ts
  - packages/core/test/ai-board.test.ts
  - packages/core/test/ai-hidden.test.ts
  - packages/core/test/game-smoke.test.ts
sequential_files: []
expected_artifacts:
  - path: "packages/core/src/board/victory.ts"
    provides: "Real endGame(state, ctx, rules, events): awards, tally, winner tie-break (D17), GameEnded"
    required: true
  - path: "packages/core/src/handlers/boss.ts"
    provides: "Real boss/enter handler (one attempt per turn, damage, recoil, kill bonus)"
    required: true
  - path: "packages/content/test/effects-parity.test.ts"
    provides: "EFFECT_TAG_LIST equals core EFFECT_TAGS (runtime and compile time)"
    required: true
  - path: ".planning/phases/03-board-economy-cpu-ai-core/03-05a-SUMMARY.md"
    provides: "Summary with Pinned goldens, Mutation proof and the hand-off to 03-05b/03-06"
    required: true
autonomous: false
agents: ["engineering-senior-developer"]
requirements: [R13]
user_setup: []
verification_commands:
  - "test \"$(git rev-parse --show-toplevel)\" = /home/user/usurpia-wt/03-05a"
  - "test \"$(git rev-parse --abbrev-ref HEAD)\" = phase3/03-05a"
  - "pnpm install --frozen-lockfile"
  - "pnpm lint"
  - "pnpm lint:purity"
  - "pnpm format:check"
  - "pnpm typecheck"
  - "pnpm test"
  - "pnpm build"
  - "pnpm validate:content"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/board/victory.ts\"'"
  - "grep -rn 'STUB(' packages/core/src; test $? -eq 1"
  - "grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-05a-SUMMARY.md"
  - "git log -1 --format=%s | grep -q '^Phase 3 plan 03-05a:'"
  - "git show --name-only --format= HEAD | grep -E '(^|/)(\\.tsbuild|dist|node_modules)/'; test $? -eq 1"
  - "git show --name-only --format= HEAD | grep -E '^(packages/core/src/(types|events|actions|reducer|game|views|rules)\\.ts|packages/core/src/(serialize|combat|ai)/|packages/core/src/board/(graph|effects|decks|effect-world|gazette|signals|hooks|settle|landing|towns|turn)\\.ts|packages/core/src/handlers/(board|combat|index|shared|loadout|week)\\.ts|packages/content/data/|packages/content/src/|packages/sim/|eslint\\.config\\.js)'; test $? -eq 1"
  - "test -z \"$(git status --porcelain)\""

must_haves:
  truths:
    - "endGame(state, ctx, rules, events) is the only place a game ends: it draws up to 3 distinct awards from the eligible pool with ctx.int (never by writing hidden.rng itself, H2), adds +awardBonus to each winner's bonus, builds a per-player tally (gold, items, towns, bonus, assets) and picks the winner by assets, then gold, then town value, then lowest seat (D17); afterwards phase is over and every action is WRONG_PHASE"
    - "The RNG consumed by endGame is committed by the reducer (apply, commit ctx.rng, applySignals): a reduce-level test through turn/end and through the final week/advance proves hidden.rng after the call equals a manual replay of the award draws, not the pre-call rng (H2)"
    - "boss/enter allows ONE attempt per turn (public bossAttempted, reset by startTurn, set by boss/enter); it deals ctx.int(0.8x, 1.2x) of atk*3+mag to the persistent boss (hp 600), recoils 50% of max hp on the player (KO sends them to the temple), and a killing blow adds max(3000, 25% of leader assets) to bonus; the game ends at that turn's turn/end"
    - "Every validation (boss/enter checks, award eligibility, tie-breaks) has a single-mutation negative test proven by mutation (PIT-001); every id-keyed record read uses Object.hasOwn/ownGet with prototype-named ids (PIT-002)"
    - "Pinned goldens (tally, winner, awards on a prepared state) carry `// pinned from TS engine (PRF-004)`; no hash of a Phase 2 or earlier golden moves because of this plan"
    - "The core effect tag list and the content tag list are the same set in the same order (EFFECT_TAGS equals EFFECT_TAG_LIST), proven at runtime and at compile time"
    - "No STUB( marker remains anywhere in packages/core/src after this plan (STUB(03-05a) is the last owner)"
  artifacts:
    - path: "packages/core/src/board/victory.ts"
      provides: "endGame"
      min_lines: 120
      contains: "export function endGame"
    - path: "packages/core/src/handlers/boss.ts"
      provides: "boss/enter"
      min_lines: 90
      contains: "export const bossHandlers"
    - path: "packages/content/test/effects-parity.test.ts"
      provides: "tag parity"
      min_lines: 30
      contains: "EFFECT_TAGS"
  key_links:
    - from: "packages/core/src/handlers/board.ts"
      to: "packages/core/src/board/victory.ts"
      via: "turn/end calls endGame(state, ctx, rules, events) when boss.enabled && boss.hp === 0 (already wired by 03-03b)"
      pattern: "endGame\\(state, ctx"
    - from: "packages/content/test/effects-parity.test.ts"
      to: "packages/core/src/index.ts"
      via: "EFFECT_TAG_LIST (content) equals EFFECT_TAGS (core export)"
      pattern: "EFFECT_TAGS"
---

<objective>
Finish the engine: the real `endGame` (awards, tally, winner), the `boss/enter` handler with its one-attempt-per-turn rule, the exports that expose the whole board layer, and the effect-tag parity test.

Purpose: spec 4.10 and D17 (R13). After this plan the engine has no stubs left. This plan runs in wave 5 in its own worktree, in parallel with 03-05b (persona AI); the two plans touch disjoint files and merge 03-05a first, then 03-05b. This plan closes the last `STUB(` markers (`endGame`, `boss/enter`).
Output: `victory.ts`, `boss.ts`, the root index exports, victory/awards/boss tests, the effect-tag parity test, SUMMARY with pinned goldens and mutation proof.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-board-economy-cpu-ai-core/03-CONTEXT.md
@.planning/phases/03-board-economy-cpu-ai-core/03-03b-SUMMARY.md
@.planning/phases/03-board-economy-cpu-ai-core/03-04-SUMMARY.md
@.planning/specs/03-board-economy-cpu-ai-core-spec.md
@.planning/memory/ERRORS.md

Relevant source files:
@packages/core/src/board/victory.ts
@packages/core/src/board/towns.ts
@packages/core/src/board/settle.ts
@packages/core/src/board/turn.ts
@packages/core/src/handlers/boss.ts
@packages/core/src/handlers/week.ts
@packages/core/src/handlers/board.ts
@packages/core/src/handlers/shared.ts
@packages/core/src/reducer.ts
@packages/core/src/combat/stats.ts
@packages/core/src/index.ts
@packages/core/test/fixtures/test-rules.ts
@packages/core/test/board-helpers.ts
@packages/core/test/week-helpers.ts
</context>

<execution_contract>
Harness: read-before-write -> evidence-before-action -> minimal diff -> verify-before-report

Roles: all tasks engineering-senior-developer (engine). Executor model `sonnet`.
Task: implement spec sections 4.10 and D17, specialised by 03-CONTEXT.md and the tables below. Requirement R13.
Scope:
- Read targets: spec 4.10, D3, D17; 03-CONTEXT.md; the 03-03b and 03-04 SUMMARY files (decisions and any deviations); `board/victory.ts` stub, `handlers/boss.ts` stub, `handlers/board.ts` (`turn/end` calls `endGame(state, ctx, rules, events)` when `boss.enabled && boss.hp === 0`), `handlers/week.ts` (the final-advance branch calls `endGame` with the handler ctx), `reducer.ts` (apply, commit ctx.rng, applySignals order), `handlers/shared.ts` (`Ctx`, `makeCtx`), `board/settle.ts` (`knockOut`), `board/towns.ts` (`assetsOf`), `board/turn.ts` (`startTurn` resets `bossAttempted`), `combat/stats.ts` (`sheetStats`), `index.ts`, `purity-traps.ts`, ERRORS.md.
- Write targets: exactly `files_modified`.
- Forbidden targets: `files_forbidden`. If the engine needs a change in a forbidden file, stop: `BLOCKED` (for example a missing event field).
Workspace (worktree isolation, 03-CONTEXT *Worktree and merge-order rules*):
- Worktree `/home/user/usurpia-wt/03-05a`, branch `phase3/03-05a`, created by the orchestrator from the green `dev` after 03-03b merged (waves 1-4 complete). Start every shell command with `cd /home/user/usurpia-wt/03-05a &&`. Never touch `/home/user/Dokapon-kingdom-2`, the 03-05b worktree or other branches. Never push; never use GitHub MCP.
Allowed tools/actions:
- Edit listed files; run `pnpm vitest run <files>`, `pnpm exec tsc -b packages/core packages/content`, `pnpm exec eslint packages/core packages/content`, `pnpm lint:purity`, `pnpm exec prettier --write|--check <paths>`.
- Full repo pipeline in the worktree (required at the end of Task 3).
- `git add`/`git commit` on `phase3/03-05a`. Throwaway scripts only in `/tmp/usurpia-scratch/03-05a/` (import sources by absolute worktree path, run with `pnpm exec tsx` from the worktree root so `git status --porcelain` stays clean).
Forbidden actions:
- No files outside `files_modified`; no new dependencies; no `eslint-disable`; no `Math.random`/`Date` in core; no floats in state; do not write `hidden.rng` from `endGame` or `boss/enter` (randomness comes from `ctx.int` only).
- Do not self-defer planned work. Do not push; do not use GitHub MCP.
Implementation sequence:
1. Read targets. 2. Task 1 (endGame). 3. Task 2 (boss/enter). 4. Task 3 (exports, parity, pipeline, SUMMARY, commit).
Required interfaces/content structure: see each task. Edge/error cases: see each task.
Verification criteria:
- Every `> verification:` line and every `verification_commands` entry exits 0.
- Mutation proof (PIT-001): for every boss/enter validation (including the one-attempt rule), every award eligibility rule and tie-break, each D17 winner tie-break step, the kill-bonus formula, the recoil KO, temporarily delete or invert the code, run the owning test file, confirm only its own tests fail, restore; record under `## Mutation proof`.
- Pinned goldens (tally/winner/awards on a prepared state) carry `// pinned from TS engine (PRF-004)`.
Final result format:
- Status: Complete | Partial | Failed | BLOCKED
- Files changed
- Verification commands and outputs
- Decisions made
- Issues/errors
- Merge order for the orchestrator: `phase3/03-05a` first, then `phase3/03-05b` (files are disjoint).
</execution_contract>

<stop_gates>
Emit `BLOCKED` and stop instead of guessing when:
- A read target is missing, or the stubs/interfaces differ from 03-CONTEXT (`endGame(state, ctx, rules, events)`, `bossHandlers`, `knockOut`, `assetsOf`, `startTurn` resetting `bossAttempted`, the reducer order apply/commit/signals), or `turn/end` does not call `endGame` for a dead boss.
- A Phase 2 or earlier-wave golden moves (event counts, per-duel outcomes, rules hashes, 03-01b/03-03b/03-04 pins) because of this plan.
- Completing a task needs a forbidden file, or the spec/CONTEXT is contradicted by the code.
- Verification commands are non-deterministic, fail after one focused fix attempt, or cannot run.
</stop_gates>

<recovery>
After compaction, interruption, or context loss:
1. Re-read this PLAN.md, 03-CONTEXT.md, the 03-03b/03-04 SUMMARY files and any 03-05a-SUMMARY.md draft.
2. Run `git diff --stat` and `git status --porcelain`; inspect `git diff` for every changed file.
3. Compare changed files against `files_modified` and `files_forbidden`; any unapproved change means `BLOCKED`.
4. Re-run the verification lines of every task already marked complete.
5. Continue only from the next unverified task; do not rely on memory-only claims.
</recovery>

<tasks>

<task type="auto">
  <name>Task 1: endGame (awards, tally, winner)</name>
  <files>packages/core/src/board/victory.ts, packages/core/test/victory.test.ts, packages/core/test/awards.test.ts</files>
  <action>
Read spec 4.10, D17, the `board/victory.ts` stub, `board/towns.ts` (`assetsOf`), `handlers/shared.ts` (`Ctx.int`), `reducer.ts`, `handlers/board.ts` (`turn/end`), `handlers/week.ts` (final advance).

1. **`board/victory.ts` `endGame(state, ctx, rules, events): GameState`** (H2: the signature is the 03-01b one; `Ctx` is a type-only import from `../handlers/shared`). Randomness comes ONLY from `ctx.int`; the function never reads or writes `hidden.rng` because the reducer commits `ctx.rng` after `apply` returns, before `applySignals`. Already-over state returns `state` unchanged without consuming a draw (idempotent). Steps:
   - **Awards.** Pool in this order: `monsters` (max `totals.monstersSlain`), `humiliated` (Phase 5: never eligible), `investor` (`totals.invested`), `thief` (`totals.stolen`), `crown` (Phase 5: never eligible), `steps` (`totals.steps`). Eligible = the award has a counter and the maximum over players is `> 0`. Draw `min(3, eligible.length)` distinct awards by a partial Fisher-Yates over the eligible list (for `i` in `0..k-1`: `j = ctx.int(i, n - 1)`, swap `i` and `j`; the first `k` are the awards, kept in pool order for the event). Winner of an award: the player(s) with the maximum counter; ties go to the LOWEST assets (assets before any bonus of this call), then the lowest seat. Each award adds `rules.board.awardBonus` to the winner's `bonus`. `Award` = `{id, playerId, bonus: awardBonus}`.
   - **Tally** (after awards): for each player `{gold, items, towns, bonus, assets}` where `gold` is the character gold, `towns` the sum of owned town values, `bonus` the final `bonus[p]`, `assets = assetsOf(state, rules, p)` (D17, includes `bonus`) and `items = assets - gold - towns - bonus` (items, scrolls and equipped gear at `sellBp`; assert this identity in tests).
   - **Winner:** highest `assets`; ties: highest `gold`, then highest `towns`, then lowest seat (D17).
   - State: `phase "over"`, `result = {winner, tally, awards}`, `bonus` updated, `battle null`, `spin null`, `spoils null`. Emit `GameEnded{winner, tally, awards}` (public). Remove the `STUB(03-05a)` marker. Tally and awards use `Object.fromEntries` and `ownGet` (PIT-002).
2. **Tests.**
   - `victory.test.ts`: tally identity (`items = assets - gold - towns - bonus`) on a rich 3-player state (gold, bag, scrolls, gear, towns, bonus) with a pinned tally; winner tie-break matrix, one single-mutation test per step (assets tie -> gold; assets+gold tie -> towns; all tie -> lowest seat; and a control where assets differ); `GameEnded` payload equals `result`; phase `over` and every action `WRONG_PHASE` afterwards (spin, move, turn/end, week/advance, errand/reroll); idempotent second call (no draw consumed: the ctx is unchanged); one-player game; **reduce-level RNG commit test (H2)**: run `reduce` of `turn/end` with a dead boss and `reduce` of the final `week/advance`, assert `phase "over"`, one `GameEnded`, and that `state.hidden.rng` after the call equals a manual replay (`nextInt` over the pre-call rng consuming exactly the award draws, `k` draws of the Fisher-Yates) and differs from the pre-call rng whenever at least one award was drawn; same state twice gives identical result and `hashState`; prototype-named players.
   - `awards.test.ts`: pool order and eligibility (all counters 0 -> no awards; one eligible -> one award; `humiliated` and `crown` never eligible even with huge other counters), exactly 3 drawn when more are eligible, distinct, reproducible for a fixed seed (pinned ids from the engine, cross-checked against a test-local partial Fisher-Yates using `nextInt`), tie-break to the lowest assets then lowest seat (single-mutation: equal counters with different assets, then equal assets), `+awardBonus` applied to the right player and visible in the tally, a player winning two awards gets both bonuses, bonus saturation at `MAX_COUNTER`.
   Use `usePurityTraps()` like the other core tests.

Edge/error cases: two awards tied for the same winner; zero players is impossible (1-4 enforced); an `endGame` call on a state whose `battle` is non-null (cleared).

> verification: pnpm vitest run packages/core/test/victory.test.ts packages/core/test/awards.test.ts
> verification: pnpm exec tsc -b packages/core
> verification: pnpm exec eslint packages/core/src/board/victory.ts packages/core/test
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/victory.ts"'
> verification: grep -n 'STUB(' packages/core/src/board/victory.ts; test $? -eq 1
> verification: grep -n 'hidden' packages/core/src/board/victory.ts; test $? -eq 1
  </action>
  <verify>
pnpm vitest run packages/core/test/victory.test.ts packages/core/test/awards.test.ts
pnpm exec tsc -b packages/core
pnpm exec eslint packages/core/src/board/victory.ts packages/core/test
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/victory.ts"'
grep -n 'STUB(' packages/core/src/board/victory.ts; test $? -eq 1
grep -n 'hidden' packages/core/src/board/victory.ts; test $? -eq 1
  </verify>
  <done>Games end through one deterministic endGame with awards, tally and the D17 winner order, its RNG use is committed by the reducer (proven at reduce level), and each rule has a single-mutation test.</done>
</task>

<task type="auto">
  <name>Task 2: boss/enter (one attempt per turn, damage, recoil, kill bonus)</name>
  <files>packages/core/src/handlers/boss.ts, packages/core/test/boss.test.ts</files>
  <action>
Read spec 4.10, `handlers/boss.ts` stub, `board/towns.ts` (`assetsOf`), `board/settle.ts` (`knockOut`), `board/turn.ts` (`startTurn` resets `bossAttempted`), `handlers/board.ts` (`turn/end`), `combat/stats.ts` (`sheetStats`: `atk`, `mag`, `hp`).

1. **`handlers/boss.ts` `boss/enter`** (active, step `act`; keep the 03-01b guard and metadata): validate in this order `boss is not enabled` (`!boss.enabled`), `boss is locked` (`!boss.unlocked`), `boss is already defeated` (`boss.hp === 0`), `already attempted the boss this turn` (`public.bossAttempted`), `not at the lair` (`positions[playerId] !== rules.map.lair`), `knocked out players cannot fight the boss` (hp 0). Apply: `{atk, mag, hp: maxHp} = sheetStats(rules, character)`; `base = atk * 3 + mag`; `damage = ctx.int(floor(base * rules.board.bossDamageLowBp / 10000), floor(base * rules.board.bossDamageHighBp / 10000))` (one draw); `bossAttempted = true`; `bossHp = max(0, boss.hp - damage)`; recoil `floor(maxHp * rules.board.bossRecoilBp / 10000)`: `hp = max(0, hp - recoil)` and when `hp` reaches 0 call `knockOut(state, playerId, rules, events, false)` (nearest temple, no gold loss). Killing blow (`boss.hp > 0` before, `0` after): `bonus[p] += max(rules.board.bossMinBonus, floor(leaderAssets * rules.board.bossBonusBp / 10000))` where `leaderAssets` is the maximum `assetsOf` over players at that moment (before the bonus). Emit `BossDamaged{playerId, damage, recoil, hp: bossHp}`, `CharacterSet` for the player's hp change, and `KnockedOut` via `knockOut`. `step` stays `act`. The game ends when that player's `turn/end` runs (03-03b already calls `endGame(state, ctx, rules, events)` when `boss.enabled && boss.hp === 0`). **One attempt per turn (M7):** the recoil is a soft limit only, so `bossAttempted` is the hard one; `startTurn` clears it at the next turn. Record in the SUMMARY that the boss kill rate is uncalibrated and 03-06 reports `bossKillBp` as an informational metric (not gated). Remove the `STUB(03-05a)` marker. `handlers/week.ts` stays untouched.
2. **Tests (`boss.test.ts`).** Each validation negative from a valid fixture with one mutation (disabled, locked, defeated, already attempted, not at lair, KO'd); the already-attempted negative is built from a state where the SAME player has just entered (second `boss/enter` in the same turn is `REJECTED` with the message, the first succeeded), and a control: after `turn/end` and the player's next turn (`startTurn` cleared the flag) the attempt is legal again; `bossAttempted` is `true` after a successful entry and `false` after `startTurn`; damage range pinned from the engine and cross-checked against `nextInt(low, high)` on the seeded rng (boundaries of `0.8x` and `1.2x`); boss hp persists across two attempts by different players; boss hp floors at 0; recoil 50% max hp; recoil KO relocates to the nearest temple with no gold loss and hp 0; a killing blow adds `max(3000, floor(leaderAssets * 2500 / 10000))` (both branches: small leader assets -> 3000; large -> 25%); a non-killing blow adds nothing; the boss lair with `boss.enabled false` acts as an empty node (a non-rejecting `board/move` through the lair); the game ends at `turn/end` after the kill (`phase "over"`, one `GameEnded`); `WRONG_STEP` outside `act`; `WRONG_ACTOR` for a non-active player; prototype-named player ids.

Edge/error cases: boss `hp` 1 with damage 0 (min draw) leaves it alive; `base` 0 (damage 0, flag still set); the killer is KO'd by recoil on the killing blow (the kill stands, the game still ends at `turn/end`).

> verification: pnpm vitest run packages/core/test/boss.test.ts
> verification: pnpm exec tsc -b packages/core
> verification: pnpm exec eslint packages/core/src/handlers/boss.ts packages/core/test/boss.test.ts
> verification: grep -rn 'STUB(' packages/core/src/handlers/boss.ts; test $? -eq 1
  </action>
  <verify>
pnpm vitest run packages/core/test/boss.test.ts
pnpm exec tsc -b packages/core
pnpm exec eslint packages/core/src/handlers/boss.ts packages/core/test/boss.test.ts
grep -rn 'STUB(' packages/core/src/handlers/boss.ts; test $? -eq 1
  </verify>
  <done>The boss can be fought once per turn and killed with recoil and bonus, the game ends at turn/end after a kill, and each rule has a single-mutation test.</done>
</task>

<task type="auto">
  <name>Task 3: Exports, effect-tag parity, mutation proof, pipeline, SUMMARY, commit</name>
  <files>packages/core/src/index.ts, packages/content/test/effects-parity.test.ts, .planning/phases/03-board-economy-cpu-ai-core/03-05a-SUMMARY.md</files>
  <action>
Read `packages/core/src/index.ts` (what 03-01b and 03-03a/b already export and the style), the 03-03b/03-04 SUMMARY hand-off sections.

1. **`core/src/index.ts`:** export (without duplicating what earlier plans exported, and without name clashes) `EFFECT_TAGS`, `type EffectTag`, `type Effect`, `type EffectResult` only if events does not already export that name (if `EffectResult` clashes keep the events one), `applyEffects`, `resolveTarget`, `shuffle`, `drawCard`, `drawFromList`, `runEffects`, `applySignals`, `drawGazette`, `endGame`, `buildGraph`, `reachableEnds`, `canonicalPath`, `enumeratePaths`, `shortestPath`, `nearestWhere`, the new `Rules` types (`DecreeDef`, `ErrandDef`, `GazetteDef`, `BoardMap`, `BoardTuning`, `NodeId`, `TownId`, `SpaceType`), the v3 state types (`Step`, `Counters`, `Buff`, `DecreeView`, `ErrandView`, `GazetteView`, `BattleCtx`, `Deck`, `Decks`, `Tally`, `Award`), `viewFor`/`PlayerView` if not already exported. The AI is NOT exported here (03-05b owns `ai/index.ts`). Check `pnpm exec tsc -b` and `pnpm lint:purity` after the edit.
2. **`content/test/effects-parity.test.ts`** (the parity check 03-02 deferred): import `EFFECT_TAGS` from `@usurpia/core` and `EFFECT_TAG_LIST` from `../src/schemas/effects`; assert deep equality in order, 18 distinct entries, and a compile-time check (a `satisfies`/conditional-type assertion that `typeof EFFECT_TAG_LIST[number]` equals `EffectTag`, and that the zod output of `EffectSchema` is assignable to core `Effect` and vice versa for a sample value of every tag via a typed table `Record<EffectTag, Effect>`). A single-mutation proof: removing one entry from either list fails only this test.
3. **Mutation proof (PIT-001):** for every boss/enter validation (including the one-attempt rule), award eligibility and tie-break, each D17 winner step, the kill bonus, the recoil KO and the `endGame` ctx use, temporarily delete or invert the code, run the owning test file, confirm only its own tests fail, restore; record the table.
4. **Pipeline and commit:** `grep -rn 'STUB(' packages/core/src` must print nothing. Run `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm validate:content`. Write `03-05a-SUMMARY.md` (sections: Result, Files changed, Pinned goldens (tally/winner/awards, damage range), Mutation proof, Decisions made (endGame draws via `ctx.int`; one boss attempt per turn through `bossAttempted`; humiliated/crown ineligible; the boss kill rate is uncalibrated and measured by 03-06), Issues, Hand-off (03-05b needs nothing from this plan; 03-06 consumes the real `endGame`)). Commit on `phase3/03-05a` with message `Phase 3 plan 03-05a: Victory, boss and effect-tag parity` ending with the attribution trailer lines from the execution prompt; verify `git show --name-only --format=` HEAD lists only `files_modified` paths and `git status --porcelain` is empty. Do not push. Tell the orchestrator the merge order: `phase3/03-05a` first, then `phase3/03-05b`.

Edge/error cases: export name clashes in `index.ts` (resolve by keeping the existing export).

> verification: pnpm vitest run packages/content/test/effects-parity.test.ts
> verification: pnpm exec tsc -b packages/core packages/content
> verification: pnpm exec eslint packages/core packages/content
> verification: grep -rn 'STUB(' packages/core/src; test $? -eq 1
> verification: pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm validate:content
> verification: grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-05a-SUMMARY.md
  </action>
  <verify>
pnpm vitest run packages/content/test/effects-parity.test.ts
pnpm exec tsc -b packages/core packages/content
pnpm exec eslint packages/core packages/content
grep -rn 'STUB(' packages/core/src; test $? -eq 1
pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm validate:content
grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-05a-SUMMARY.md
  </verify>
  <done>The board layer is exported, effect-tag parity is enforced, no STUB marker remains, the pipeline is green and the plan is committed on phase3/03-05a.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `endGame(state, ctx, rules, events)` ends every game: awards (max 3, eligible only, drawn with `ctx.int`), tally identity, D17 winner order; the reduce-level test proves the committed RNG.
- [ ] `boss/enter` damage/recoil/bonus pinned; one attempt per turn; the game ends at `turn/end` after a kill.
- [ ] `EFFECT_TAG_LIST` equals core `EFFECT_TAGS` (runtime and compile-time).
- [ ] `grep -rn 'STUB(' packages/core/src` finds nothing; no forbidden file changed.
- [ ] Full pipeline green; commit message and contents verified; every planned task completed or blocked with evidence.
</verification>

<success_criteria>
- Every game ends through one deterministic `endGame`; the boss is fightable once per turn.
- All Phase 3 engine seams are filled and exported; the CPU AI (03-05b) merges next without touching these files.
</success_criteria>

<output>
After completion, create `.planning/phases/03-board-economy-cpu-ai-core/03-05a-SUMMARY.md`

No STATE.md or ROADMAP.md edits (the orchestrator owns them). The orchestrator merges `phase3/03-05a` into `dev` (before 03-05b), pushes and proves CI.
</output>
