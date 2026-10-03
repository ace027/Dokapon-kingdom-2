---
phase: 03-board-economy-cpu-ai-core
plan: 03a
type: execute
wave: 3
depends_on: ["03-01b"]
files_modified:
  - packages/core/src/board/hooks.ts
  - packages/core/src/board/settle.ts
  - packages/core/src/board/landing.ts
  - packages/core/src/board/towns.ts
  - packages/core/src/board/turn.ts
  - packages/core/src/handlers/board.ts
  - packages/core/src/handlers/combat.ts
  - packages/core/src/index.ts
  - packages/content/src/schemas/common.ts
  - packages/content/test/limits.test.ts
  - packages/content/test/hook-ranges.test.ts
  - packages/core/test/board-helpers.ts
  - packages/core/test/hooks.test.ts
  - packages/core/test/towns.test.ts
  - packages/core/test/turn-start.test.ts
  - packages/core/test/spin.test.ts
  - packages/core/test/steal.test.ts
  - packages/core/test/move.test.ts
  - .planning/phases/03-board-economy-cpu-ai-core/03-03a-SUMMARY.md
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
  - packages/core/src/board/gazette.ts
  - packages/core/src/board/signals.ts
  - packages/core/src/board/effect-world.ts
  - packages/core/src/board/victory.ts
  - packages/core/src/handlers/shared.ts
  - packages/core/src/handlers/loadout.ts
  - packages/core/src/handlers/index.ts
  - packages/core/src/handlers/week.ts
  - packages/core/src/handlers/boss.ts
  - packages/core/src/ai/
  - packages/core/test/fixtures/
  - packages/core/test/resolve.test.ts
  - packages/core/test/combat-golden.test.ts
  - packages/content/data/
  - packages/content/src/build-rules.ts
  - packages/content/src/registry.ts
  - packages/content/src/shipped.ts
  - packages/content/src/schemas/effects.ts
  - packages/content/src/schemas/tuning.ts
  - packages/content/src/schemas/items.ts
  - packages/sim/
  - packages/client/
  - package.json
  - pnpm-lock.yaml
  - eslint.config.js
  - scripts/
  - .github/
  - README.md
sequential_files: []
expected_artifacts:
  - path: "packages/core/src/board/hooks.ts"
    provides: "HOOK_SUM_CLAMPS and boardHookTotal (summed engine clamps over activeHooks)"
    required: true
  - path: "packages/core/src/board/settle.ts"
    provides: "Leaf with stealGold (settleBattle and knockOut arrive in 03-03b)"
    required: true
  - path: "packages/core/src/board/landing.ts"
    provides: "The resolveLanding seam with its final signature (stub body, replaced by 03-03b)"
    required: true
  - path: "packages/core/src/board/towns.ts"
    provides: "Real collectTax (G-T1), creditGold/debitGold, canInvest"
    required: true
  - path: "packages/core/src/board/turn.ts"
    provides: "startTurn with turnRegenBp regen and turnTowns"
    required: true
  - path: "packages/core/src/handlers/board.ts"
    provides: "Real board/spin, board/move and board/useItem handlers"
    required: true
  - path: "packages/content/test/hook-ranges.test.ts"
    provides: "Boundary and boundary+1 tests for every tightened HOOK_RANGES entry"
    required: true
  - path: ".planning/phases/03-board-economy-cpu-ai-core/03-03a-SUMMARY.md"
    provides: "Plan summary incl. pinned goldens and mutation proof"
    required: true
autonomous: false
agents: ["engineering-senior-developer"]
requirements: [R10, R11]
user_setup: []
verification_commands:
  - "test \"$(git rev-parse --show-toplevel)\" = /home/user/usurpia-wt/03-03a"
  - "test \"$(git rev-parse --abbrev-ref HEAD)\" = phase3/03-03a"
  - "pnpm install --frozen-lockfile"
  - "pnpm lint"
  - "pnpm lint:purity"
  - "pnpm format:check"
  - "pnpm typecheck"
  - "pnpm test"
  - "pnpm build"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/board/landing.ts\"'"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/board/settle.ts\"'"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/handlers/board.ts\"'"
  - "grep -rn 'STUB(03-03a)' packages/core/src; test $? -eq 1"
  - "grep -q 'STUB(03-03b)' packages/core/src/handlers/board.ts"
  - "grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-03a-SUMMARY.md"
  - "git log -1 --format=%s | grep -q '^Phase 3 plan 03-03a:'"
  - "git show --name-only --format= HEAD | grep -E '(^|/)(\\.tsbuild|dist|node_modules)/'; test $? -eq 1"
  - "git show --name-only --format= HEAD | grep -E '^(packages/core/src/(rules|types|events|actions|reducer|game|views)\\.ts|packages/core/src/(serialize|ai|combat)/|packages/core/src/handlers/(week|boss|index|shared|loadout)\\.ts|packages/core/src/board/(graph|effects|decks|gazette|signals|effect-world|victory)\\.ts|packages/content/data/|packages/core/test/fixtures/|packages/sim/)'; test $? -eq 1"
  - "test -z \"$(git status --porcelain)\""

must_haves:
  truths:
    - "Spin always draws exactly one ctx.int(1,6) first, then applies the item and buffs; the result is clamped to [1, tuning.board.maxSteps]; the roll sequence is pinned from the engine and cross-checked against direct nextInt calls on the seeded hidden rng"
    - "Move validation has five distinct checks M1-M5 with their own message each; every check has a single-mutation negative test built from a valid fixture and proven by mutation (PIT-001); the lair is blocked only while boss.enabled and not boss.unlocked"
    - "Tax golden G-T1 holds: base 800, value 800, townTaxBp 500 gives rate 1500 and tax 120; invest at 3x base is rejected with its own negative test"
    - "Every board hook has a content HOOK_RANGES bound and an engine summed clamp, each tested at boundary and boundary+1"
    - "stealGold caps at the ABSOLUTE tuning.board.stealCapGold (400) and honours the coin purse lock; the homing stone warps to the Castle (design behaviour, OQ5)"
    - "Move and homing-stone call resolveLanding through its final signature; landing effects, PvP, settle and shops are NOT in this plan (03-03b), so tests assert only event prefixes and state, never the landing tail"
    - "Phase 2 combat behaviour is unchanged by the beginCombat extraction (every Phase 2 event count, outcome and golden unchanged, the steal-item re-pin belongs to 03-03b)"
    - "Every id-keyed record read in the new code (players, towns, nodes, items) uses Object.hasOwn/ownGet and survives ids toString, valueOf, hasOwnProperty (PIT-002)"
    - "This plan never writes weekly/totals counters or progress folds: counters are folded from events by 03-04's applySignals, so every handler emits events carrying the data the fold needs"
  artifacts:
    - path: "packages/core/src/handlers/board.ts"
      provides: "Board handlers (spin, move, useItem real)"
      min_lines: 200
      contains: "export const boardHandlers"
    - path: "packages/core/src/board/settle.ts"
      provides: "stealGold leaf"
      min_lines: 40
      contains: "export function stealGold"
    - path: "packages/core/src/board/hooks.ts"
      provides: "Hook sums"
      min_lines: 40
      contains: "HOOK_SUM_CLAMPS"
    - path: "packages/core/test/move.test.ts"
      provides: "M1-M5 negatives"
      min_lines: 200
      contains: "lair is locked"
  key_links:
    - from: "packages/core/src/handlers/board.ts"
      to: "packages/core/src/handlers/combat.ts"
      via: "move starts board battles through beginCombat when resolveLanding returns one"
      pattern: "beginCombat"
    - from: "packages/core/src/handlers/board.ts"
      to: "packages/core/src/board/landing.ts"
      via: "move and homing-stone call resolveLanding"
      pattern: "resolveLanding\\("
    - from: "packages/core/src/board/hooks.ts"
      to: "packages/core/src/combat/stats.ts"
      via: "boardHookTotal sums activeHooks for one hook name and clamps"
      pattern: "activeHooks"
---

<objective>
Make the board move (the first half of the old 03-03): board-hook sums with clamps and tightened content ranges, the towns economy helpers (tax golden G-T1, gold helpers, invest validation), turn start (revive, regen, `turnTowns`), `beginCombat` extraction, `stealGold` with the absolute cap, spin, `useItem` (homing stone to the Castle, coin purse lock) and move validation M1-M5 with the pass-through pickpocket.

Purpose: spec sections 4.2, 4.3, 4.5, 4.6 (helpers) and 4.9 (R10, R11). 03-01b pre-created every module this plan fills as `STUB(03-03a)` seams, so this plan edits only files it owns and runs in parallel with 03-04 (wave 3). Landing, settle, shops, town handlers and `turn/end` are 03-03b (wave 4); `week/advance`, signals and gazette are 03-04; `boss/enter`, awards and `endGame` are 03-05a.
Output: the modules in `files_modified`, one test file per concern, SUMMARY with mutation proof.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-board-economy-cpu-ai-core/03-CONTEXT.md
@.planning/phases/03-board-economy-cpu-ai-core/03-01b-PLAN.md
@.planning/specs/03-board-economy-cpu-ai-core-spec.md
@.planning/memory/ERRORS.md

Relevant source files (post-03-01b merge):
@packages/core/src/types.ts
@packages/core/src/events.ts
@packages/core/src/rules.ts
@packages/core/src/reducer.ts
@packages/core/src/handlers/shared.ts
@packages/core/src/handlers/combat.ts
@packages/core/src/handlers/board.ts
@packages/core/src/board/graph.ts
@packages/core/src/board/towns.ts
@packages/core/src/board/turn.ts
@packages/core/src/combat/stats.ts
@packages/core/src/inventory.ts
@packages/content/src/schemas/common.ts
@packages/core/test/fixtures/test-rules.ts
@packages/core/test/purity-traps.ts
</context>

<execution_contract>
Harness: read-before-write -> evidence-before-action -> minimal diff -> verify-before-report

Role: engineering-senior-developer (executor, model `sonnet`).
Task: implement spec sections 4.2, 4.3, 4.5, 4.6 (helpers), 4.9 and 9 (`Invalid path`), specialised by 03-CONTEXT.md *Shared contracts* and *Cross-plan seams*, and by the decisions in the tasks below. Requirements R10, R11.
Scope:
- Read targets: spec 4.2-4.6 and 4.9, 03-CONTEXT.md, 03-01b-PLAN.md Task 1 (stub shapes), the current `handlers/board.ts` stubs, `handlers/combat.ts` (`combatStartHandler`, `endCombat`), `board/graph.ts`, `board/towns.ts` (`assetsOf`), `board/turn.ts`, `combat/stats.ts` (`activeHooks`, `sheetStats`), `inventory.ts`, `events.ts` (exact `Moved.passed`, `PvpSpoils` shapes), `NpcRef` in `types.ts`, `schemas/common.ts`, `test/fixtures/test-rules.ts` (`TEST_MAP`), `purity-traps.ts`, ERRORS.md.
- Write targets: exactly `files_modified`.
- Forbidden targets: `files_forbidden`. If a task needs an edit in a forbidden file (for example a new event field), stop: `BLOCKED`.
Workspace (worktree isolation, 03-CONTEXT *Worktree and merge-order rules*):
- Worktree `/home/user/usurpia-wt/03-03a`, branch `phase3/03-03a`, created by the orchestrator from the post-03-01b green `dev`. Start every shell command with `cd /home/user/usurpia-wt/03-03a &&`. Never touch `/home/user/Dokapon-kingdom-2`, the 03-04 worktree or other branches. Never push; never use GitHub MCP.
Allowed tools/actions:
- Edit listed files; run `pnpm vitest run <files>`, `pnpm exec tsc -b packages/core packages/content`, `pnpm exec eslint packages/core packages/content`, `pnpm lint:purity`, `pnpm exec prettier --write|--check <paths>`.
- Full repo pipeline in the worktree (required at the end of Task 3).
- `git add`/`git commit` on `phase3/03-03a`. Throwaway scripts only in `/tmp/usurpia-scratch/03-03a/` (import sources by absolute worktree path, run with `pnpm exec tsx` from the worktree root so `git status --porcelain` stays clean).
Forbidden actions:
- No files outside `files_modified`; no new dependencies; no `eslint-disable`; no floats in state; no `Math.random`/`Date`; no edits to Phase 2 combat behaviour (only the `beginCombat` extraction).
- Do not write `weekly`/`totals` counters, `decree.*`, `bonus` or `result` (03-04/03-05a own those folds).
- Do not self-defer planned work. Do not push; do not use GitHub MCP.
Implementation sequence:
1. Read targets. 2. Task 1 (pure layer + content ranges). 3. Task 2 (beginCombat, stealGold, landing seam, spin, useItem). 4. Task 3 (move, exports, mutation proof, pipeline, SUMMARY, commit).
Required interfaces/content structure: see each task. Edge/error cases: see each task.
Verification criteria:
- Every `> verification:` line and every `verification_commands` entry exits 0.
- Mutation proof (PIT-001): for each of M1-M5, each spin/useItem validation, each hook clamp bound, the invest cap, the tax clamp and the `stealGold` cap and coin lock, temporarily delete or invert the check, run the owning test file, confirm only its own tests fail, restore; record under `## Mutation proof` in the SUMMARY.
- Pinned goldens (spin roll sequence, G-T1) carry the comment `// pinned from TS engine (PRF-004)`; spin rolls are cross-checked against direct `nextInt`.
Final result format:
- Status: Complete | Partial | Failed | BLOCKED
- Files changed
- Verification commands and outputs
- Decisions made
- Issues/errors
</execution_contract>

<stop_gates>
Emit `BLOCKED` and stop instead of guessing when:
- A read target is missing, or the 03-01b stubs do not match the shapes in 03-CONTEXT *Cross-plan seams* (for example `collectTax`, `startTurn`, `boardHandlers`, `runWeekEnd`, `endGame(state, ctx, rules, events)`, `drawGazette` are absent or have different signatures).
- Any Phase 2 invariant moves: event counts 80/84/10/95, per-duel `(outcome, winner)`, gate counts, duel stdout, perf total `a=5411 b=2370 draw=2118 fled=101`, any hash.
- A shipped content hook value violates a tightened HOOK_RANGES bound (content data is owned by other plans; do not edit it).
- Completing a task needs an edit in a forbidden file, or a spec/CONTEXT decision is contradicted by the code.
- Verification commands are non-deterministic, fail after one focused fix attempt, or cannot run.
</stop_gates>

<recovery>
After compaction, interruption, or context loss:
1. Re-read this PLAN.md, 03-CONTEXT.md and any 03-03a-SUMMARY.md draft.
2. Run `git diff --stat` and `git status --porcelain`; inspect `git diff` for every changed file.
3. Compare changed files against `files_modified` and `files_forbidden`; any unapproved change means `BLOCKED`.
4. Re-run the verification lines of every task already marked complete.
5. Continue only from the next unverified task; do not rely on memory-only claims.
</recovery>

<tasks>

<task type="auto">
  <name>Task 1: Pure layer: hook sums, tax and gold helpers, turn start, content hook ranges</name>
  <files>packages/core/src/board/hooks.ts, packages/core/src/board/towns.ts, packages/core/src/board/turn.ts, packages/content/src/schemas/common.ts, packages/content/test/hook-ranges.test.ts, packages/content/test/limits.test.ts, packages/core/test/board-helpers.ts, packages/core/test/hooks.test.ts, packages/core/test/towns.test.ts, packages/core/test/turn-start.test.ts</files>
  <action>
Read spec 4.5, 4.6, 4.9, `combat/stats.ts` (`activeHooks`, `sheetStats`), `board/towns.ts` and `board/turn.ts` stubs, `schemas/common.ts` (`HOOK_RANGES`, `checkHookRange` message format), `limits.test.ts` (find every assertion on the old ranges).

1. **`schemas/common.ts` `HOOK_RANGES`:** tighten exactly: `pvpExtraSteal [0, 3]`, `passPickpocketBp [0, 2000]`, `spellPriceBp [-5000, 5000]`, `fieldSpellMove [0, 1]`, `turnRegenBp [0, 3000]`, `townTaxBp [0, 1000]`, `crownTaxResistBp [0, BP]` (unchanged), `lootLuckBp [0, 3000]`. Combat hooks untouched. Update the file's doc comment. Update every `limits.test.ts` assertion that encoded the old loose ranges. New `hook-ranges.test.ts`: for each of the 8 board hooks, `HookSchema.safeParse({hook, value})` accepts `min` and `max` and rejects `min - 1` and `max + 1` with the exact message `<hook> value must be between <min> and <max>` and that being the only issue (PIT-001); also confirms the shipped board-hook items (thief, mage, cleric, tax-collectors-seal, crown-ward-amulet values: pvpExtraSteal 1, passPickpocketBp 500, spellPriceBp -2500, fieldSpellMove 1, turnRegenBp 1000, townTaxBp 500, crownTaxResistBp 5000) are inside the bounds, by reading them from `packages/content/data/classes.json` and `gear.json` with `node:fs` in the test.
2. **`board/hooks.ts`** (pure; imports `Hook`/`BoardHook`/`Rules` types and `activeHooks`): export
   ```ts
   export const HOOK_SUM_CLAMPS: Readonly<Record<BoardHook, readonly [min: number, max: number]>>
   export function boardHookTotal(rules: Rules, ch: CharacterPublic, hook: BoardHook): number
   ```
   `HOOK_SUM_CLAMPS = { townTaxBp: [0,1500], passPickpocketBp: [0,2000], turnRegenBp: [0,3000], spellPriceBp: [-5000,5000], lootLuckBp: [0,3000], pvpExtraSteal: [0,3], fieldSpellMove: [0,1], crownTaxResistBp: [0,10000] }`. `boardHookTotal` sums `value` over `activeHooks(rules, ch)` whose `hook` equals the argument (integers, saturating at +-2^31 is unnecessary because hook values are bounded) and clamps to the table range. `pvpExtraSteal`, `fieldSpellMove`, `crownTaxResistBp` are summed and clamped but nothing reads them in Phase 3 (documented inert, spec 4.9).
3. **`board/towns.ts`:** keep `assetsOf` as is. Add
   - `creditGold(state, playerId, amount): GameState` (saturating at `MAX_COUNTER`, unknown player returns `state` unchanged via `ownGet`) and `debitGold(state, playerId, amount): {state: GameState; paid: number}` (pays `min(amount, gold)`).
   - Real `collectTax(state, rules, events): GameState`: if `public.gazette.taxHoliday` is true it only sets `taxHoliday = false` and emits nothing (the holiday is consumed here; 03-04's `week/advance` calls `collectTax` unconditionally and must not duplicate the check). Otherwise iterate towns sorted by town id ascending (`Object.keys(...).sort()`, read with `ownGet`); for each town with an owner: `rate = clamp(rules.board.taxBaseBp + boardHookTotal(rules, ownerCharacter, "townTaxBp"), 0, 1500)`, `amount = floor(value * rate / 10000)`, owner gold credited (saturating) from the bank, emit `TaxCollected{playerId, townId, amount}` (also when `amount` is 0). Pin G-T1 in tests: base 800, value 800, a `townTaxBp` 500 item on the owner gives rate 1500 and `amount` 120; also rate for no hook = 1000 gives 80.
   - `canInvest(state, rules, playerId, townId, amount): string | null` returning the exact rejection message (used by the handler in Task 3): `unknown town`, `town is not yours`, `town is not eligible for investing this turn` (not in `turnTowns`), `not enough gold`, `investment would exceed 3x base value`; order exactly as listed. Base value is `rules.map.towns[townId].base` via `ownGet`.
4. **`board/turn.ts` `startTurn`:** keep the revive, then (a) `regen = min(maxHp - hp, floor(maxHp * boardHookTotal(turnRegenBp) / 10000))` with `maxHp = sheetStats(rules, character).hp`, applied to the (possibly just revived) hp, never to a KO'd character, (b) `turnTowns` = `[townId]` for the town whose node equals `positions[playerId]` (via `Object.entries(rules.map.towns)` sorted by id) else `[]`, (c) keep the stub's `activePlayer`, `step "spin"`, `spin null`, `spoils null`; emit `TurnStarted{playerId, week, round, revived, regen}` first, then `CharacterSet` only when hp changed. Keep `bossAttempted false` in the turn reset (set by 01b). Remove the `STUB(03-03a)` markers in `towns.ts` and `turn.ts`.
5. **`test/board-helpers.ts`** (shared by all board tests in this plan; plain TS module, no `test()` calls): `makeBoardGame(opts?: {players?: string[]; weeks?: 3|4|5; boss?: boolean; seed?: string; rules?: Rules})` returns `{state, rules}`: `createGame` over `TEST_RULES` (or `opts.rules`), then `week: 1`, `round: 1`, `startTurn` for seat 0 (so `step "spin"`); `withStep(state, step, spin?)`, `withPosition(state, playerId, node)`, `withGold(state, playerId, n)`, `withBag(state, playerId, ids)`, `withTown(state, townId, owner, value, liberatedWeek)`, `withBuffs`, `withHp`, `withGear(state, playerId, patch)`; each returns a new state (immutable spreads, records via `Object.fromEntries`). A `act(state, action, rules)` wrapper around `reduce` returning `{state, events, reject}`; and `ids = ["toString","valueOf","hasOwnProperty"]` player pool constant for PIT-002 tests.
6. **Tests:**
   - `hooks.test.ts`: for each of the 8 hooks, a character whose passives/gear sum to exactly `max` (valid), `max + 1` (clamped to `max`), and for hooks with a negative range `min` and `min - 1`; sums across several sources (class passive + weapon + accessory) via an in-test `Rules` clone (spread of TEST_RULES with injected gear; not through the content schema); a character with no hooks totals 0; `activeHooks` order unchanged. Each case is a single mutation of a valid fixture (PIT-001).
   - `towns.test.ts`: G-T1 (120), base rate (80), `amount` floors (value 999 at 1000 bp gives 99), gold saturation at `MAX_COUNTER`, tax order (two owners, events in town id order), holiday consumed (no events, flag cleared, gold unchanged) and a second call taxes again, unowned towns skipped, players named `toString`/`valueOf`/`hasOwnProperty` owning towns, `canInvest` one negative per message in order (single mutation each: exactly-at-cap accepted, cap+1 rejected; amount 1 below gold accepted, gold+1 rejected), `creditGold`/`debitGold` on unknown player ids.
   - `turn-start.test.ts`: revive (hp 0 becomes `floor(maxHp * 5000 / 10000)`, `revived true`), regen for a 1000 bp hook, regen capped at max hp, no regen for a KO that was just revived beyond the cap, `turnTowns` at a town node and elsewhere, `activePlayer`/`step`/`spin`/`spoils` reset, event order (`TurnStarted` then `CharacterSet`).

Edge/error cases: players at nodes with unknown ids; towns with `owner` set but unknown player; `rate` below 0 or above 1500 before the final clamp (a negative `townTaxBp` cannot occur through content, test the clamp with an in-memory rules clone); `value` 0.

> verification: pnpm vitest run packages/core/test/hooks.test.ts packages/core/test/towns.test.ts packages/core/test/turn-start.test.ts packages/content/test/hook-ranges.test.ts packages/content/test/limits.test.ts
> verification: pnpm exec tsc -b packages/core packages/content
> verification: pnpm exec eslint packages/core/src/board packages/core/test packages/content/src packages/content/test
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/hooks.ts"'
> verification: grep -rn 'STUB(03-03a)' packages/core/src/board/towns.ts packages/core/src/board/turn.ts; test $? -eq 1
> verification: grep -q 'HOOK_SUM_CLAMPS' packages/core/src/board/hooks.ts
  </action>
  <verify>
pnpm vitest run packages/core/test/hooks.test.ts packages/core/test/towns.test.ts packages/core/test/turn-start.test.ts packages/content/test/hook-ranges.test.ts packages/content/test/limits.test.ts
pnpm exec tsc -b packages/core packages/content
pnpm exec eslint packages/core/src/board packages/core/test packages/content/src packages/content/test
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/hooks.ts"'
grep -rn 'STUB(03-03a)' packages/core/src/board/towns.ts packages/core/src/board/turn.ts; test $? -eq 1
  </verify>
  <done>Hook ranges and summed clamps are tight and boundary-tested, tax matches golden G-T1, gold helpers and invest validation are in place, and startTurn regenerates and sets turnTowns.</done>
</task>

<task type="auto">
  <name>Task 2: beginCombat extraction, stealGold, landing seam, spin and useItem</name>
  <files>packages/core/src/board/settle.ts, packages/core/src/board/landing.ts, packages/core/src/handlers/board.ts, packages/core/src/handlers/combat.ts, packages/core/test/spin.test.ts, packages/core/test/steal.test.ts</files>
  <action>
Read spec 4.2, 4.3, 4.5 and 9, 03-CONTEXT *Shared contracts* (action/event shapes) and *Cross-plan seams*, `handlers/combat.ts` (`combatStartHandler.apply`, `endCombat`), `board/graph.ts`, `inventory.ts`, `events.ts` and `NpcRef`, the Task 1 helpers.

**A. `beginCombat` extraction (`handlers/combat.ts`).** Move the body of `combatStartHandler.apply` into
```ts
export function beginCombat(state: GameState, attacker: PlayerId, opponent: Opponent, battle: BattleCtx | null, ctx: Ctx, rules: Rules, events: GameEvent[]): GameState
```
which is byte-for-byte the old logic plus `public.battle = battle` on the started state. `combatStartHandler.apply` calls it with `battle: null` and returns `{state, events}`; Phase 2 behaviour, event order and RNG draws are unchanged (the existing duel/combat tests are the proof). `endCombat` is NOT changed in this plan: 03-03b wires `settleBattle` into it (it is the only handler edit left for 03-03b in `handlers/combat.ts`). Until then `public.battle` is always `null`.

**B. `board/settle.ts` (new leaf, pure; imports only types, `graph.ts`, `towns.ts`, `hooks.ts`).** This plan creates the file with one export; 03-03b adds `settleBattle` and `knockOut`:
```ts
export function stealGold(state: GameState, thief: PlayerId, victim: PlayerId, rateBp: number, rules: Rules, events: GameEvent[]): GameState
```
`stealGold`: if the victim has a `coinLock` buff (first one in array order), consume one use (remove the buff at 0 uses) and the amount is 0; else `amount = min(floor(victimGold * rateBp / 10000), rules.board.stealCapGold)` (an ABSOLUTE gold cap, shipped `400`; the spec's undefined `stealCapBp` is replaced, record this in the SUMMARY). Move gold victim to thief (credit saturating; read both players via `ownGet`). Always emit `PvpSpoils{winner: thief, loser: victim, kind: "steal", amount, townId: null}` (also when 0).

**C. `board/landing.ts` (new, STUB for 03-03b).** Export the final types and a no-op body so move and homing-stone can call the real seam now:
```ts
export interface PendingBattle { battle: BattleCtx; opponent: Opponent }
export function resolveLanding(state: GameState, playerId: PlayerId, ctx: Ctx, rules: Rules, events: GameEvent[], opts: { arrived: boolean }): { state: GameState; battle: PendingBattle | null }
```
The stub returns `{state, battle: null}` and emits nothing, with `// STUB(03-03b)`. The signature is binding: 03-03b replaces only the body (warp, PvP check, space effects).

**D. `handlers/board.ts`** (replace the `STUB(03-03a)` handlers; keep the real guards and metadata from 03-01b; `town/*`, `shop/*` and `turn/end` stay `STUB(03-03b)` and are not touched). In this task implement `board/spin` and `board/useItem` (`board/move` is Task 3).

*board/spin* (`validate`, in order; `WRONG_STEP`/`WRONG_ACTOR` come from the reducer): `item !== null` requires the item in the bag (`item not in bag`) and its `effect` to be a board item with tag `spinBonus` (swift-boots), `spinFixed` (lead-boots) or `pickSpin` (pathfinder) (`not a spin item`); `pathfinder` requires `pick` 1..6 (`pathfinder requires a pick`), any other item or no item requires `pick === null` (`pick requires pathfinder`). `apply`: **always** draw `roll = ctx.int(1, 6)` first. `base = pick` for pathfinder, the effect `value` (1) for lead-boots (fixed; spin buffs are skipped entirely), else `roll`; swift-boots adds its `value` (3); then add the `value` of every `spinMod` buff in array order, decrementing `uses` (a buff at 0 uses is removed) except for lead-boots; `steps = clamp(sum, 1, rules.board.maxSteps)`. Remove the item from the bag (`removeItem`) with a private `BagUpdated`. State: `spin = {steps, mods, max: rules.board.maxSteps}` where `mods` lists the item id (if any) then one `"spin-mod"` per consumed buff; `step = "move"`. Event `Spun{playerId, roll, steps, item}`. The `lead-boots` content description was rewritten in 03-01b to `Your next spin is fixed at 1.`, so spec and content agree (no contradiction to record).

*board/useItem* (steps spin|act): `item not in bag`; effect tag `warpCastle` (homing-stone) or `blockGoldSteal` (coin-purse-lock) else `item cannot be used on the board`. Homing stone keeps the design's Castle warp (CONTEXT OQ5; the item text is "Warp to the Castle."): only at `step "spin"` (`homing-stone must be used before spinning`); `already at the castle` when the player's node is the castle (so the item is never wasted); target = the node with `space === "castle"`; consume the item (+ private `BagUpdated`), move the player, emit `Warped{cause: "homing"}`, set `spin = null`, `step = "act"` (the warp replaces the turn's move; `turnTowns` is unchanged because the castle is not a town), then `resolveLanding(..., {arrived: true})` (the castle is a safe node, so no PvP; the call keeps the seam uniform). Coin purse lock: reject `coin purse lock already active` when a `coinLock` buff exists; else consume the item and push `Buff{kind: "coinLock", value: 1, uses: 1}` (cap 4 buffs, oldest dropped). Emit `ItemUsed{playerId, itemId, healed: 0, hp}` for both (reuses the Phase 2 event; `hp` current).

**E. Tests.**
- `spin.test.ts`: spin golden (`seed "spin-golden"`, 12 consecutive spins, each applied to a copy reset to `step "spin"`, rolls pinned from the engine and cross-checked against 12 direct `nextInt(rng, 1, 6)` calls starting from `state.hidden.rng`; comment `// pinned from TS engine (PRF-004), cross-checked`); swift-boots +3 and clamp at 9 (a roll of 6 with a +2 buff and swift-boots gives 9, not 11), lead-boots fixed 1 with a buff ignored and not consumed, pathfinder pick, pathfinder missing pick, pick without pathfinder, item not owned, non-spin item id, spinMod buff decrement and removal at 0, negative buff clamped to 1, always exactly one rng draw (compare `hidden.rng` with one `nextInt` advance for every item variant), `WRONG_STEP` in `move`/`act` steps; `useItem`: homing-stone from `t05` warps to the castle `t01` (`Warped{cause: "homing"}`, item consumed with a private `BagUpdated`, `spin null`, `step act`, `turnTowns` unchanged), rejected when already at the castle (`already at the castle`), rejected at step `act` (`homing-stone must be used before spinning`), rejected when not owned; coin purse lock adds a buff, duplicate rejected, buff cap 4 drops the oldest, non-board item rejected (`item cannot be used on the board`).
- `steal.test.ts` (direct `stealGold` calls on prepared states): amount `floor(victimGold * rate / 10000)`; cap at `stealCapGold` (a victim with 100000 gold at 2500 bp pays exactly 400; one below the cap boundary pays the uncapped amount); `coinLock` consumption (amount 0, buff removed at 0 uses, `PvpSpoils` still emitted with `amount 0`); zero-gold victim; saturation of the thief's gold at `MAX_COUNTER`; unknown player ids and ids `toString`/`valueOf`/`hasOwnProperty` as thief/victim; each case is a single mutation of a valid fixture (PIT-001).

Edge/error cases: ids as prototype member names in actions (`itemId: "toString"`) reject with the normal messages, never read a prototype value; empty bag; a one-player game.

> verification: pnpm vitest run packages/core/test/spin.test.ts packages/core/test/steal.test.ts
> verification: pnpm vitest run packages/core/test packages/sim/test
> verification: pnpm exec tsc -b packages/core packages/sim
> verification: pnpm exec eslint packages/core/src packages/core/test
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/landing.ts"'
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/settle.ts"'
> verification: grep -q 'export function beginCombat' packages/core/src/handlers/combat.ts
  </action>
  <verify>
pnpm vitest run packages/core/test/spin.test.ts packages/core/test/steal.test.ts
pnpm vitest run packages/core/test packages/sim/test
pnpm exec tsc -b packages/core packages/sim
pnpm exec eslint packages/core/src packages/core/test
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/landing.ts"'
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/settle.ts"'
grep -q 'export function beginCombat' packages/core/src/handlers/combat.ts
  </verify>
  <done>Spin and useItem work with single-mutation tests, stealGold honours the absolute cap and coin lock, beginCombat is extracted with Phase 2 behaviour unchanged, and the landing seam exists with its final signature.</done>
</task>

<task type="auto">
  <name>Task 3: board/move (M1-M5), exports, mutation proof, pipeline, SUMMARY, commit</name>
  <files>packages/core/src/handlers/board.ts, packages/core/src/index.ts, packages/core/test/move.test.ts, .planning/phases/03-board-economy-cpu-ai-core/03-03a-SUMMARY.md</files>
  <action>
Read spec 4.3 (move validation), 4.4 (pass-through), `board/graph.ts` (`reachableEnds`, blocked sets, `canonicalPath`), `handlers/board.ts` after Task 2, `board/settle.ts` (`stealGold`), `board/hooks.ts` (`boardHookTotal`).

1. *board/move* validation in this order, each with its own message: M1 `path is not an adjacent chain` (first node adjacent to the player's node, each next adjacent to the previous; unknown node ids fail here); M2 `path revisits a node` (including the start); M3 `path is longer than the spin` (`path.length > spin.steps`); M4 `path stops short of the spin` (`path.length < spin.steps` and the last node is neither a maximal dead end nor a rival-occupied non-safe node; rival = another seated player with `hp > 0`; safe = `castle`/`temple`; maximal dead end = no neighbour of the last node outside `{start} + path`, ignoring the blocked lair); M5 `lair is locked` (the path contains `rules.map.lair` while `boss.enabled && !boss.unlocked`; the blocked lair is also excluded from dead-end determination, so a player next to the locked lair with no other exit is at a dead end). A disabled boss never blocks (the lair is an empty node). Use `reachableEnds`/graph `blocked` sets from `graph.ts` where they fit; keep the five checks as five separate statements so each can be mutation-killed alone.
`apply`: `positions[playerId] = last`; `turnTowns` gains the towns on the path nodes and the destination (deduplicated, path order); **pass-through**: for each INTERIOR node (path minus the last) occupied by one or more rivals (`hp > 0`) and not safe, and when `boardHookTotal(passPickpocketBp) > 0`, `stealGold(thief = mover, victim = rival, rate = that total)` per rival in seat order; `Moved{playerId, from, to, path, passed}` where `passed` lists the rivals on interior nodes in path then seat order (regardless of the hook); `spin = null`; `step = "act"`; then `resolveLanding(..., {arrived: false})`, and when it returns a battle call `beginCombat(state, playerId, opponent, battle, ctx, rules, events)`. The move never writes counters (steps = `path.length` is read from the `Moved` event by 03-04).
2. **`core/src/index.ts`** (owned by this plan in wave 3; 03-04 does not edit it): export `boardHookTotal`, `HOOK_SUM_CLAMPS`, `collectTax`, `creditGold`, `debitGold`, `canInvest`, `startTurn`, `resolveLanding`, `stealGold` and `beginCombat` (follow the existing pattern; export nothing that would create a name clash). Do NOT export `effects`/`decks` or the 03-04 modules.
3. **Tests.**
- `move.test.ts` on TEST_MAP (ring `t01..t12`, chords `t01-t07`, `t04-t10`; castle `t01`, lair `t07`): a valid exact-length path; **one negative per check built from a valid path with exactly one mutation**: M1 (non-adjacent second node; unknown node id), M2 (a path that returns to the start), M3 (length steps + 1), M4 (stop one short at a non-dead-end non-rival node), M5 (path through `t07` with `boss.enabled` and locked); positive controls: M3-short at a maximal dead end, M4-short ending on a rival at a non-safe node (accepted; the battle itself is 03-03b), a rival on a safe node (`t06`, accepted full-length, no battle), the lair passable with `boss.enabled === false` and with `unlocked === true`, dead-end determination ignoring the locked lair; pass-through pickpocket (a rival on an interior node with a 500 bp hook loses `floor(gold * 500 / 10000)` capped by `stealCapGold`, `coinLock` makes it 0 and consumes the buff, safe-node interior skipped, no hook means no steal but `passed` still lists the rival), `turnTowns` after a path crossing a town, `Moved` fields, step `act`, `spin null`, `WRONG_STEP` in `spin`/`act`. Because `resolveLanding` is a seam that 03-03b makes real, every event assertion checks only the prefix `[PvpSpoils..., Moved]` plus the position, `spin`, `step` and `turnTowns` state; it never asserts the event tail or the absence of landing events.
4. **Mutation proof (PIT-001):** for each check in M1-M5, each spin/useItem validation, each hook clamp bound (both directions), the invest cap, the tax clamp, the `stealGold` cap and coin lock, temporarily delete or invert the code, run the owning test file, confirm only its own tests fail, restore. Record the table.
5. **Pipeline and commit:** run `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`. Write `03-03a-SUMMARY.md` (sections: Result, Files changed, Pinned goldens (spin rolls with the cross-check statement, G-T1, shop-free), Mutation proof, Decisions made (spec ambiguities resolved: M3/M4 split, M5 vs disabled boss, `stealCapGold 400` replacing `stealCapBp`, homing-stone keeps the Castle warp (OQ5), `collectTax` consumes the holiday), Stub inventory (what 03-03b still owns), Issues). Commit on `phase3/03-03a` with message `Phase 3 plan 03-03a: Hooks, towns economy, spin and move` ending with the attribution trailer lines from the execution prompt; verify `git show --name-only --format= HEAD` lists only `files_modified` paths and `git status --porcelain` is empty. Do not push. Tell the orchestrator the merge order: `phase3/03-03a` first, then `phase3/03-04`; no shared file.

Edge/error cases: a move on a one-player board (no rivals, pickpocket nothing); path ids that are prototype member names (`constructor`, `__proto__`) fail M1 with the normal message; a mover knocked out (hp 0) can still move only if the reducer allows it (the reducer's actor/step rules decide, do not special-case).

> verification: pnpm vitest run packages/core/test/move.test.ts
> verification: pnpm exec tsc -b packages/core
> verification: pnpm exec eslint packages/core/src packages/core/test
> verification: grep -rn 'STUB(03-03a)' packages/core/src; test $? -eq 1
> verification: pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
> verification: grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-03a-SUMMARY.md
  </action>
  <verify>
pnpm vitest run packages/core/test/move.test.ts
pnpm exec tsc -b packages/core
pnpm exec eslint packages/core/src packages/core/test
grep -rn 'STUB(03-03a)' packages/core/src; test $? -eq 1
pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-03a-SUMMARY.md
  </verify>
  <done>Move validation M1-M5 and the pass-through pickpocket work with single-mutation tests, the plan's mutation proof is recorded, the full pipeline is green and the plan is committed on phase3/03-03a.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] M1-M5 each have their own message and negative test; the lair blocks only while the boss is enabled and locked.
- [ ] Spin draws exactly one `ctx.int(1,6)` first; the golden is cross-checked against direct `nextInt`.
- [ ] G-T1 (120) and the invest cap (2400 then rejected) are pinned; every hook has range and sum clamp tests at boundary and boundary + 1.
- [ ] `stealGold` cap is the absolute `stealCapGold`; homing stone warps to the Castle.
- [ ] `beginCombat` leaves Phase 2 duel behaviour unchanged; the landing seam keeps its final signature.
- [ ] No `STUB(03-03a)` remains in `packages/core/src`; `STUB(03-03b)` markers remain only in `handlers/board.ts` and `board/landing.ts`; no forbidden file changed.
- [ ] Full pipeline green; commit message and contents verified; every planned task completed or blocked with evidence.
</verification>

<success_criteria>
- Players can spin, take validated moves (M1-M5), use the homing stone and coin purse lock, and be pickpocketed in passing, deterministically and round-trippably.
- The economy helpers (tax, steal cap, hook clamps, invest cap) match the spec and are golden- or boundary-tested.
- Phase 2 combat behaviour is intact.
</success_criteria>

<output>
After completion, create `.planning/phases/03-board-economy-cpu-ai-core/03-03a-SUMMARY.md`

No STATE.md or ROADMAP.md edits (the orchestrator owns them). The orchestrator merges `phase3/03-03a` first in W3 (then 03-04) and runs the full pipeline plus `pnpm vitest run packages/core/test/week-loop.test.ts`.
</output>
