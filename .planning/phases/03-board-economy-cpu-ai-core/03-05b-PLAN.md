---
phase: 03-board-economy-cpu-ai-core
plan: 05b
type: execute
wave: 5
depends_on: ["03-03b", "03-04"]
files_modified:
  - packages/core/src/ai/persona.ts
  - packages/core/src/ai/difficulty.ts
  - packages/core/src/ai/plan.ts
  - packages/core/src/ai/board.ts
  - packages/core/src/ai/index.ts
  - eslint.config.js
  - packages/core/test/ai-persona.test.ts
  - packages/core/test/ai-plan.test.ts
  - packages/core/test/ai-board.test.ts
  - packages/core/test/ai-hidden.test.ts
  - packages/core/test/game-smoke.test.ts
  - .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md
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
  - packages/core/src/ai/combat.ts
  - packages/core/src/ai/exp.ts
  - packages/core/src/ai/opponent-model.ts
  - packages/core/src/ai/tuning.ts
  - packages/core/src/board/victory.ts
  - packages/core/src/handlers/boss.ts
  - packages/core/src/handlers/week.ts
  - packages/core/src/index.ts
  - packages/content/
  - packages/core/test/victory.test.ts
  - packages/core/test/awards.test.ts
  - packages/core/test/boss.test.ts
sequential_files: []
expected_artifacts:
  - path: "packages/core/src/ai/board.ts"
    provides: "Persona board AI router: BoardAiState, createBoardAi, decideBoard, decidePlayer"
    required: true
  - path: "packages/core/src/ai/persona.ts"
    provides: "Four personas with 12 integer weight terms"
    required: true
  - path: "packages/core/src/ai/difficulty.ts"
    provides: "DIFFICULTY_BOARD (depth, tau, error) plus softmax/error selection"
    required: true
  - path: "packages/core/src/ai/plan.ts"
    provides: "Own BFS, path enumeration and 3-hop distance-discounted potential"
    required: true
  - path: "packages/core/test/game-smoke.test.ts"
    provides: "Full AI-driven games on TEST_RULES (boss off) with zero rejected AI actions"
    required: true
  - path: ".planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md"
    provides: "Summary incl. the `## AI scoring decision` section, the `## G2 pre-check` table and mutation proof"
    required: true
autonomous: false
agents: ["engineering-ai-engineer"]
requirements: [R14]
user_setup: []
verification_commands:
  - "test \"$(git rev-parse --show-toplevel)\" = /home/user/usurpia-wt/03-05b"
  - "test \"$(git rev-parse --abbrev-ref HEAD)\" = phase3/03-05b"
  - "pnpm install --frozen-lockfile"
  - "pnpm lint"
  - "pnpm lint:purity"
  - "pnpm format:check"
  - "pnpm typecheck"
  - "pnpm test"
  - "pnpm build"
  - "pnpm validate:content"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/ai/index.ts\"'"
  - "grep -n 'Math\\.exp\\|Math\\.pow\\|\\*\\*' packages/core/src/ai/persona.ts packages/core/src/ai/difficulty.ts packages/core/src/ai/plan.ts packages/core/src/ai/board.ts; test $? -eq 1"
  - "grep -rn \"from \\\"\\.\\./board\\|from '\\.\\./board\" packages/core/src/ai; test $? -eq 1"
  - "grep -q 'AI scoring decision' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md"
  - "grep -q 'G2 pre-check' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md"
  - "grep -q 'Decree completion probe' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md"
  - "grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md"
  - "git log -1 --format=%s | grep -q '^Phase 3 plan 03-05b:'"
  - "git show --name-only --format= HEAD | grep -E '(^|/)(\\.tsbuild|dist|node_modules)/'; test $? -eq 1"
  - "git show --name-only --format= HEAD | grep -E '^(packages/core/src/(types|events|actions|reducer|game|views|rules|index)\\.ts|packages/core/src/(serialize|combat)/|packages/core/src/ai/(combat|exp|opponent-model|tuning)\\.ts|packages/core/src/board/|packages/core/src/handlers/|packages/content/|packages/sim/)'; test $? -eq 1"
  - "test -z \"$(git status --porcelain)\""

must_haves:
  truths:
    - "The persona AI reads PlayerView and Rules only: no hidden decks or rng, no other player's private data; identical decisions are required across states that differ only in those fields, for all four personas and all three difficulties (hidden-information fuzz)"
    - "The AI never proposes an action the engine rejects: every candidate is built from the same checks the handlers apply (path validity M1-M5, prices, caps, the one-boss-attempt-per-turn flag), proven by full AI-driven games with zero rejected actions and by a cross-check of the AI's own BFS against board/graph.reachableEnds"
    - "AI arithmetic is engine-independent: expNeg instead of Math.exp, no ** and no Math.pow, integer weights, a per-seat RNG seeded seed\\0cpu\\0<playerId>\\0<persona>\\0<difficulty>, and ai/ imports nothing from reducer, handlers, serialize, game, replay, index or ../board (lint-enforced)"
    - "The executor evaluates at least two scoring formulations and documents the choice, the evidence and the rejected alternative in the SUMMARY under the heading `## AI scoring decision`"
    - "G2 risk is retired here, not discovered in 03-06 (C3): before the plan ends a G2 pre-check (100 games, hard,hard,normal,normal on shipped rules via `loadRules()`, seat difficulty and persona rotated INDEPENDENTLY) must show the Hard share >= 55%; up to 3 recorded adjustments are allowed, in this order: DIFFICULTY_BOARD constants, then persona weights, then plan/board scoring; if the share is still below 55% the plan ends `Partial` with the table (bounded fallback, spec D20), never by weakening the target"
    - "The DIFFICULTY_BOARD constants (depth, tauMilli, errorBp per difficulty) live in one exported table in ai/difficulty.ts; on the AI side 03-06 may edit ONLY those constants (bounds: hard tauMilli 20..100 and errorBp 0, normal tauMilli 250..600 and errorBp 500..1500, easy and every depth fixed; a depth change needs a 03-05b fix plan) and the integer persona weight values, never AI logic"
    - "A per-decree completion probe (informational, 100 normal-difficulty games on shipped rules, success = DecreeResolved.outcome === \"success\") is recorded in the SUMMARY so 03-06 can tune G1 from evidence"
    - "Every AI legality check has a single-mutation negative test proven by mutation (PIT-001); every id-keyed record read uses Object.hasOwn/ownGet with prototype-named ids (PIT-002)"
    - "Pinned goldens (AI decision for a fixed view) carry `// pinned from TS engine (PRF-004)`"
  artifacts:
    - path: "packages/core/src/ai/board.ts"
      provides: "decideBoard"
      min_lines: 300
      contains: "export function decideBoard"
    - path: "packages/core/src/ai/plan.ts"
      provides: "BFS and potential"
      min_lines: 120
      contains: "export function potential"
    - path: "packages/core/src/ai/difficulty.ts"
      provides: "DIFFICULTY_BOARD and pickScored"
      min_lines: 60
      contains: "export const DIFFICULTY_BOARD"
    - path: "packages/core/test/game-smoke.test.ts"
      provides: "AI-driven games"
      min_lines: 100
      contains: "decidePlayer"
  key_links:
    - from: "packages/core/src/ai/board.ts"
      to: "packages/core/src/ai/combat.ts"
      via: "decidePlayer delegates pending combat decisions to decideCombat with the embedded combat AiState"
      pattern: "decideCombat"
    - from: "eslint.config.js"
      to: "packages/core/src/ai/"
      via: "the AI import restriction regex gains ../board so the AI cannot import board internals"
      pattern: "board"
---

<objective>
The four-persona CPU board AI with three difficulties, its lint guard and hidden-information fuzz, full AI-driven smoke games, the recorded scoring decision, and the G2 pre-check that proves Hard seats are on track for the 03-06 gate.

Purpose: spec section 6, D3, D19 (R14). After this plan a full game can be played end to end by CPU players through the public API, which is what 03-06 measures. This plan runs in wave 5 in its own worktree, in parallel with 03-05a (victory, boss, exports); the two plans touch disjoint files and merge 03-05a first, then 03-05b. In this worktree `endGame` and `boss/enter` are still the 03-01b stubs, so every test here is stub-agnostic (no assertion on a winner or tally; boss-enabled AI-driven games are run by 03-06 against the real engine).
Output: `ai/{persona,difficulty,plan,board}.ts`, the lint guard, `ai/index.ts`, persona/plan/board/hidden/smoke tests, SUMMARY with the AI scoring decision and the G2 pre-check table.
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
@packages/core/src/board/graph.ts
@packages/core/src/board/towns.ts
@packages/core/src/handlers/board.ts
@packages/core/src/handlers/week.ts
@packages/core/src/ai/combat.ts
@packages/core/src/ai/exp.ts
@packages/core/src/ai/opponent-model.ts
@packages/core/src/ai/index.ts
@packages/core/src/views.ts
@packages/core/src/combat/stats.ts
@packages/core/test/ai-hidden.test.ts
@packages/core/test/fixtures/test-rules.ts
@packages/core/test/board-helpers.ts
@packages/core/test/week-helpers.ts
@eslint.config.js
</context>

<execution_contract>
Harness: read-before-write -> evidence-before-action -> minimal diff -> verify-before-report

Roles: all tasks engineering-ai-engineer. Executor model `sonnet`.
Task: implement spec section 6, D3, D19, specialised by 03-CONTEXT.md and the tables below. Requirement R14.
Scope:
- Read targets: spec section 6, D3, D19, D20; 03-CONTEXT.md; the 03-03b and 03-04 SUMMARY files (decisions and any deviations); `board/graph.ts` (the engine's BFS, for the cross-check only), `handlers/board.ts`/`handlers/week.ts` (the validations the AI mirrors from PlayerView + Rules), `ai/combat.ts` (`AiState`, `createAi`, `decideCombat`, `Difficulty`, how it seeds and advances its rng), `ai/exp.ts`, `ai/opponent-model.ts` (style of engine-independent arithmetic), `ai/tuning.ts` (style only), `views.ts` (`PlayerView`), `combat/stats.ts` (`sheetStats`), existing AI tests (`ai.test.ts`, `ai-exp.test.ts`, `ai-hidden.test.ts`), `eslint.config.js` (AI block), `purity-traps.ts`, ERRORS.md.
- Write targets: exactly `files_modified`.
- Forbidden targets: `files_forbidden`. If the AI needs a change in a forbidden file (for example a missing field in `PlayerView`), stop: `BLOCKED`.
Workspace (worktree isolation, 03-CONTEXT *Worktree and merge-order rules*):
- Worktree `/home/user/usurpia-wt/03-05b`, branch `phase3/03-05b`, created by the orchestrator from the green `dev` after 03-03b merged (waves 1-4 complete). Start every shell command with `cd /home/user/usurpia-wt/03-05b &&`. Never touch `/home/user/Dokapon-kingdom-2`, the 03-05a worktree or other branches. Never push; never use GitHub MCP.
Allowed tools/actions:
- Edit listed files; run `pnpm vitest run <files>`, `pnpm exec tsc -b packages/core packages/content`, `pnpm exec eslint packages/core eslint.config.js`, `pnpm lint:purity`, `pnpm exec prettier --write|--check <paths>`.
- Full repo pipeline in the worktree (required at the end of Task 3).
- `git add`/`git commit` on `phase3/03-05b`. Throwaway scripts (scoring harness, G2 pre-check) only in `/tmp/usurpia-scratch/03-05b/` (import sources by absolute worktree path and run with `pnpm exec tsx` from the worktree root so `git status --porcelain` stays clean).
Forbidden actions:
- No files outside `files_modified`; no new dependencies; no `eslint-disable`; no `Math.exp`/`Math.pow`/`**`/`Math.random`/`Date` in `ai/`; no floats in state; the AI must not import `reducer`, `handlers`, `serialize`, `game`, `replay`, `index` or `../board`.
- Do not spawn sub-planning agents: the scoring-formulation choice is yours, inside the constraints below.
- Do not self-defer planned work. Do not push; do not use GitHub MCP.
Implementation sequence:
1. Read targets. 2. Task 1 (persona, difficulty, plan). 3. Task 2 (board AI, lint guard, hidden fuzz). 4. Task 3 (smoke games, scoring decision, G2 pre-check, pipeline, SUMMARY, commit).
Required interfaces/content structure: see each task. Edge/error cases: see each task.
Verification criteria:
- Every `> verification:` line and every `verification_commands` entry exits 0.
- Mutation proof (PIT-001): for each AI legality check (path M1-M5 in `validatePathAi`, price/cap checks, closed shops, the boss-attempt flag, the hp-vs-recoil check) and each act precondition, temporarily delete or invert the code, run the owning test file, confirm only its own tests fail, restore; record under `## Mutation proof`.
- Pinned goldens (AI decision for a fixed view per persona) carry `// pinned from TS engine (PRF-004)`.
Final result format:
- Status: Complete | Partial | Failed | BLOCKED
- Files changed
- Verification commands and outputs
- Decisions made (including the AI scoring decision and the G2 pre-check verdict)
- Issues/errors
- Merge order for the orchestrator: `phase3/03-05a` first, then `phase3/03-05b` (files are disjoint).
</execution_contract>

<stop_gates>
Emit `BLOCKED` and stop instead of guessing when:
- A read target is missing, or the interfaces differ from 03-CONTEXT (`PlayerView` (including `public.bossAttempted`), `AiState`, `decideCombat`, `Rules.map`/`Rules.board` shapes absent or changed).
- A Phase 2 or earlier-wave golden moves (event counts, per-duel outcomes, rules hashes, 03-01b/03-03b/03-04 pins) because of this plan.
- The AI cannot be made legal without reading hidden information or importing a forbidden module.
- A full AI-driven game does not terminate within the smoke test's action cap after one focused fix attempt (report the seed and the loop, do not weaken the cap).
- Completing a task needs a forbidden file, or the spec/CONTEXT is contradicted by the code.
- Verification commands are non-deterministic, fail after one focused fix attempt, or cannot run.
(The G2 pre-check missing 55% after 3 adjustments is NOT a stop: it ends the plan `Partial`, see Task 3.)
</stop_gates>

<recovery>
After compaction, interruption, or context loss:
1. Re-read this PLAN.md, 03-CONTEXT.md, the 03-03b/03-04 SUMMARY files and any 03-05b-SUMMARY.md draft.
2. Run `git diff --stat` and `git status --porcelain`; inspect `git diff` for every changed file.
3. Compare changed files against `files_modified` and `files_forbidden`; any unapproved change means `BLOCKED`.
4. Re-run the verification lines of every task already marked complete.
5. Continue only from the next unverified task; do not rely on memory-only claims.
</recovery>

<tasks>

<task type="auto">
  <name>Task 1: Persona weights, difficulty table and the AI's own graph code</name>
  <files>packages/core/src/ai/persona.ts, packages/core/src/ai/difficulty.ts, packages/core/src/ai/plan.ts, packages/core/test/ai-persona.test.ts, packages/core/test/ai-plan.test.ts</files>
  <action>
Read spec section 6, D3, D19, `ai/combat.ts` (`Difficulty`, how it seeds and advances its rng), `ai/exp.ts`, `ai/opponent-model.ts`, `ai/tuning.ts` (style only), `views.ts` (`PlayerView`: `public`, `self`, `counts`), `board/graph.ts` (for the cross-check only).

1. **`ai/persona.ts`:** `export type Persona = "tycoon" | "menace" | "adventurer" | "opportunist"`, `PERSONAS` (this order), `export interface PersonaWeights` with exactly the 12 integer terms `gold, invest, liberate, quest, pvp, risk, xp, shop, temple, castle, passTowns, leader`, and `PERSONA_WEIGHTS` (initial values; this plan's G2 pre-check may adjust them within its bound, 03-06 may change the integer values only, 0..20, never the keys or the logic):
   | persona | gold | invest | liberate | quest | pvp | risk | xp | shop | temple | castle | passTowns | leader |
   |---|---|---|---|---|---|---|---|---|---|---|---|---|
   | tycoon | 6 | 9 | 8 | 4 | 1 | 6 | 3 | 4 | 5 | 3 | 7 | 1 |
   | menace | 4 | 2 | 3 | 3 | 9 | 2 | 4 | 4 | 4 | 2 | 2 | 6 |
   | adventurer | 4 | 3 | 4 | 4 | 2 | 4 | 9 | 5 | 5 | 4 | 2 | 1 |
   | opportunist | 5 | 4 | 4 | 10 | 4 | 5 | 3 | 3 | 4 | 5 | 3 | 8 |
   (`risk` weights caution: how strongly low hp and strong rivals discount a node.) Persona terms mean: gold = expected gold from a node and payouts; invest = value of putting gold into an owned town in `turnTowns` and of tax from owned towns; liberate = value of unliberated towns reachable; quest = progress toward the current decree/errand (read from `public.decree`, `self.errand`); pvp = expected steal/seize value of a rival on an end node; risk = avoid battle nodes when hp is low; xp = monster nodes; shop = need for gear/spells/bag; temple = heal need; castle = reroll/ switch value; passTowns = owned towns passed (tax/visibility); leader = chase (menace/opportunist) the asset leader.
2. **`ai/difficulty.ts`** (the `DIFFICULTY_BOARD` constants are the ONLY AI knob 03-06 may tune, C3; keep them in this one exported table with no other tuning numbers elsewhere in `ai/`)**:** `export const DIFFICULTY_BOARD: Readonly<Record<Difficulty, {depth: number; tauMilli: number; errorBp: number}>>` = easy `{0, 1000, 3000}`, normal `{2, 350, 800}`, hard `{3, 50, 0}`; `pickScored<T>(candidates: readonly {item: T; score: number}[], difficulty, rng): {item: T; rng: RngState}`: with probability `errorBp / 10000` (one `nextInt(rng, 1, 10000) <= errorBp` draw, only when `errorBp > 0`) a uniform random legal candidate (one more draw); otherwise a softmax over `score / (tauMilli / 1000)` using `expNeg` on `(score - best) / tau` (never `Math.exp`), one `nextInt` draw against the cumulative weights (`weightScale` integer arithmetic like `ai/combat.ts`); `tau` tiny (hard) must not overflow: `expNeg` underflows to 0 below `-700`, so the best candidate always has weight 1.
3. **`ai/plan.ts`** (pure, imports only `../rules` and `../views`/`../types` types and `../validation`): the AI's own graph code, no `board/` imports: `buildAiGraph(rules.map)`, `reachableEndsAi(graph, start, steps, blocked)` (ends of self-avoiding paths of exactly `steps` plus maximal dead ends, with the lair in `blocked` while the boss is enabled and locked; ascending), `canonicalPathAi(graph, start, end, steps, blocked)` (lexicographically smallest valid path by node index), `rivalEnds`-style helpers for intercept paths (an early stop is legal at a rival-occupied non-safe node), and `potential(view, rules, graph, from, depth, weights)`: a distance-discounted BFS sum over nodes within `depth` hops (`depth` 0 = only the node itself) of `nodeValue(...) / (hop + 1)` using only `+ - * /`. `nodeValue(view, rules, node, weights)` = the weighted sum of the 12 terms for landing/standing on that node given PUBLIC state only (space type, tier gold table, unliberated town base, own town in reach, temple when hp is low, shop when gold is high, monster zone xp, rival on the node, decree/errand progress for the metric the node serves, leader proximity); rival assets are ESTIMATED from public data: `gold + owned town values + bonus + equipped gear sell value + counts.bag * assumedItemValue` with `assumedItemValue = 50` (never the real bag). Every candidate path must be re-validated with the same M1-M5 logic as the engine (the AI exports `validatePathAi` used by tests as a cross-check against the engine).
4. **Tests.**
   - `ai-persona.test.ts`: exact weight table and difficulty table (ints, 12 keys, 4 personas, `Object.keys` exact), `createBoardAi` seed string pinned (the rng after one `nextInt` equals a manual `seedRng(...)` derivation), `pickScored` determinism, error branch frequency bounds over 2000 seeded draws for easy (3000 bp) and zero for hard, softmax with `tau 50` picks the best candidate in >= 99% of 1000 draws and `tau 1000` spreads (no candidate below 10% across 3 equal-ish scores), no `NaN` for scores far apart, `expNeg` used (grep the source for `Math.exp`: absent).
   - `ai-plan.test.ts`: the AI BFS equals `board/graph.reachableEnds` on `TEST_MAP` for every start and steps 1..9 with and without the blocked lair; `canonicalPathAi` equals `canonicalPath`; `validatePathAi` agrees with the engine path validation on 100 valid and 100 single-mutation-invalid paths (each M1-M5 mutation, one test per mutation); `potential` at depth 0 equals `nodeValue`, grows monotonically in no hidden input, uses integer arithmetic only (no `NaN`, no float result for integer inputs of `+ - *` and an integer division helper); rival assets are estimated from public data (a view with a different real bag of the same `counts.bag` gives the same estimate); prototype-named node and town ids.
   Use `usePurityTraps()` like the other core tests.

Edge/error cases: a one-player game (no rivals: `leader`/`pvp` terms 0); empty bag; `maxSteps` clamp; every reachable end blocked by rivals on safe nodes (still legal); decree null (no `quest` term).

> verification: pnpm vitest run packages/core/test/ai-persona.test.ts packages/core/test/ai-plan.test.ts packages/core/test/ai.test.ts packages/core/test/ai-exp.test.ts
> verification: pnpm exec tsc -b packages/core
> verification: pnpm exec eslint packages/core/src/ai packages/core/test
> verification: grep -n 'Math\.exp\|Math\.pow\|\*\*' packages/core/src/ai/persona.ts packages/core/src/ai/difficulty.ts packages/core/src/ai/plan.ts; test $? -eq 1
  </action>
  <verify>
pnpm vitest run packages/core/test/ai-persona.test.ts packages/core/test/ai-plan.test.ts packages/core/test/ai.test.ts packages/core/test/ai-exp.test.ts
pnpm exec tsc -b packages/core
pnpm exec eslint packages/core/src/ai packages/core/test
grep -n 'Math\.exp\|Math\.pow\|\*\*' packages/core/src/ai/persona.ts packages/core/src/ai/difficulty.ts packages/core/src/ai/plan.ts; test $? -eq 1
  </verify>
  <done>Personas, the DIFFICULTY_BOARD table, softmax/error selection and the AI's own BFS and potential exist, match the engine's path rules, and are tested.</done>
</task>

<task type="auto">
  <name>Task 2: Board AI router, lint guard, hidden-information fuzz</name>
  <files>packages/core/src/ai/board.ts, packages/core/src/ai/index.ts, eslint.config.js, packages/core/test/ai-board.test.ts, packages/core/test/ai-hidden.test.ts</files>
  <action>
Read spec section 6, `ai/combat.ts` (`AiState`, `createAi`, `decideCombat`), `views.ts`, the CONTEXT action table, the handler validations in `handlers/board.ts`/`handlers/week.ts`/`handlers/boss.ts` stub (the AI mirrors them from PlayerView + Rules), `eslint.config.js` AI block, `test/ai-hidden.test.ts`, and Task 1's `ai/plan.ts`.

1. **`ai/board.ts`:** `export interface BoardAiState { readonly rng: RngState; readonly playerId: PlayerId; readonly persona: Persona; readonly difficulty: Difficulty; readonly combat: AiState }`; `createBoardAi(seed: string, playerId: PlayerId, persona: Persona, difficulty: Difficulty): BoardAiState` with `rng = seedRng(\`${seed}\u0000cpu\u0000${playerId}\u0000${persona}\u0000${difficulty}\`)` (spec D3, NUL separators) and `combat = createAi(seed, playerId, difficulty)`; `decideBoard(view: PlayerView, rules: Rules, ai: BoardAiState): {action: Action | null; ai: BoardAiState}` and `decidePlayer(view, rules, ai)` (when a combat decision is pending for this player delegate to `decideCombat(view, rules, ai.combat)` and keep `ai.rng` untouched; otherwise `decideBoard`). `decideBoard` returns `action: null` when it is not this player's board step. By `public.step` (all legal by construction, built from PlayerView only):
   - `spin`: candidate actions are `board/useItem` homing-stone (when owned and an unliberated town exists), `board/useItem` coin-purse-lock (when owned, no lock active and gold >= 300), and the spins `{item: null}`, swift-boots, pathfinder (with each `pick` 1..6) and lead-boots (only when `depth >= 2` and the persona values staying put near a payout); score each by the potential of the best reachable end it enables (expected roll for random spins: the mean over 1..6 of the best end score at `min(steps, 9)`; `depth` 0 evaluates nothing and picks `{item: null}` with the error/softmax step).
   - `move`: enumerate reachable ends (own BFS), score each end by `nodeValue(end) + potential(end, depth)` plus pass-through terms (`passTowns`, pickpocket value for thief gear, rivals passed), pick with `pickScored`, emit `board/move` with the canonical path to the chosen end.
   - `act`, in priority order of positive-score candidates evaluated each call: `boss/enter` (at the unlocked lair, `public.boss.hp > 0`, `public.bossAttempted === false`, and enough hp to survive the recoil: `hp > floor(maxHp * rules.board.bossRecoilBp / 10000)`; one attempt per turn is an engine rule, M7), `town/seize` (spoils open: the highest-value rival town owned by the loser), `town/liberate` (at an unliberated town, hp >= 60% of max), `town/invest` (an owned town in `turnTowns`; amount = `min(gold - reserve, 3 * base - value)` with a persona reserve of 100 gold, only when >= 100), `shop/buy`/`shop/sell` (at a shop: buy the best affordable upgrade by tier within the persona's `shop` term; sell only when the bag is full and the item is worth less than the one just found), `errand/reroll` (at the castle, errand ineligible-looking or progress 0 with a target above 20 and gold above the fee + 200, once), else `turn/end`. Every candidate mirrors the engine validation from PlayerView data (prices, caps, closed shops `clock < shopsClosedUntil`, rival-occupied checks). Termination guarantee: an `act` action is only emitted when it changes state in a way that removes its own precondition (gold spent, spoils closed, town invested to cap, errand rerolled) or else `turn/end`.
   Never read `state.hidden` or another player's `private` (the types make it impossible; keep `PlayerView` as the only input). The AI never throws on a legal view; unexpected shapes yield `turn/end` or `null`.
2. **`ai/index.ts`:** export `createBoardAi`, `decideBoard`, `decidePlayer`, `type BoardAiState`, `PERSONAS`, `type Persona`, `PERSONA_WEIGHTS`, `type PersonaWeights`, `DIFFICULTY_BOARD`, `validatePathAi`; keep every existing export. (The root `core/src/index.ts` is owned by 03-05a and is not edited here; the AI is imported through `ai/index.ts` by tests and, in 03-06, by the sim package through the existing AI entry point. If the sim cannot reach `ai/index.ts` through the root export that exists today, record it in the SUMMARY hand-off; do not edit the root index.)
3. **`eslint.config.js` (AI block only):** add a pattern `{ regex: "^\\.\\./board(/|$)", message: "the AI must not import board internals; it reads PlayerView and Rules only" }` to the AI `patterns` list (the existing regex stays; `./board` inside `ai/` is the AI's own module and stays legal). Do not touch any other config block. Prove the guard: an `import "../board/graph"` inside `ai/` fails lint (a throwaway file in `/tmp/usurpia-scratch/03-05b/` copied into `packages/core/src/ai/` temporarily and removed; record in the SUMMARY).
4. **Tests.**
   - `ai-board.test.ts`: every path the AI emits across 300 seeded situations (random positions, hp, gold, steps, rivals, boss locked/unlocked/disabled, `bossAttempted` true/false) is accepted by the engine `validate` (use `reduce` on the prepared state; the boss-enabled situations assert the AI's choice by value only, since `boss/enter` is a stub in this worktree); each act candidate has one test where it is chosen and one where its single precondition is mutated away and it is not (seize without spoils, liberate at low hp, invest at cap, shop closed, reroll off-castle, boss locked, boss already attempted this turn, boss hp at or below the recoil); per persona one scenario where the persona's top term decides the move (tycoon prefers the town end, menace the rival end, adventurer the monster end, opportunist the quest-progress end), at depth 3 hard; a pinned decision for one fixed view per persona (`// pinned from TS engine (PRF-004)`); `decideBoard` returns `null` when it is not the player's turn or the phase is `decision`; `decidePlayer` delegates a pending combat decision; no mutation of the view (deep-frozen view); prototype-named players and node/town ids; termination guarantee: for every act candidate the post-state (engine `reduce`) removes the candidate's own precondition or the next AI call returns `turn/end`.
   - `ai-hidden.test.ts` (extend; keep the existing combat tests): from a mid-game board state at each of the steps `spin`, `move` and `act`, build valid saves that differ ONLY in `hidden` (rng, decks, decision) and in OTHER players' `private` (bag contents of the same length, errands, `rerollUsed`); for each of the 4 personas x 3 difficulties assert identical `viewFor` JSON, identical `decideBoard` action and identical resulting `ai.rng` across 20 seeded variants (spec acceptance 10). A control proves the test can fail: a variant that changes the VIEWER's own bag changes the view.
   Use `usePurityTraps()` like the other core tests.

Edge/error cases: hp 0 on the active player (only `turn/end`); the AI never throws on a legal view and yields `turn/end` or `null` on an unexpected shape.

> verification: pnpm vitest run packages/core/test/ai-board.test.ts packages/core/test/ai-hidden.test.ts packages/core/test/ai-plan.test.ts packages/core/test/ai.test.ts
> verification: pnpm exec tsc -b packages/core
> verification: pnpm exec eslint packages/core/src/ai packages/core/test eslint.config.js
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/ai/index.ts"'
> verification: grep -n 'Math\.exp\|Math\.pow\|\*\*' packages/core/src/ai/board.ts; test $? -eq 1
> verification: grep -rn "from \"\.\./board\|from '\.\./board" packages/core/src/ai; test $? -eq 1
  </action>
  <verify>
pnpm vitest run packages/core/test/ai-board.test.ts packages/core/test/ai-hidden.test.ts packages/core/test/ai-plan.test.ts packages/core/test/ai.test.ts
pnpm exec tsc -b packages/core
pnpm exec eslint packages/core/src/ai packages/core/test eslint.config.js
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/ai/index.ts"'
grep -n 'Math\.exp\|Math\.pow\|\*\*' packages/core/src/ai/board.ts; test $? -eq 1
grep -rn "from \"\.\./board\|from '\.\./board" packages/core/src/ai; test $? -eq 1
  </verify>
  <done>Four personas at three difficulties choose legal spin, move and act actions from PlayerView alone, never vary with hidden information, and are guarded by lint and a fuzz test.</done>
</task>

<task type="auto">
  <name>Task 3: Smoke games, scoring decision, G2 pre-check, pipeline, SUMMARY, commit</name>
  <files>packages/core/test/game-smoke.test.ts, .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md</files>
  <action>
Read `ai/index.ts`, `test/fixtures/build.ts` (`applyAll` style), `test/board-helpers.ts`, `test/week-helpers.ts`, the 03-03b/03-04 SUMMARY hand-off sections.

1. **`core/test/game-smoke.test.ts`:** a local driver (test-only; the real driver is 03-06's `sim/src/game.ts`): create a game on `TEST_RULES` (`TEST_MAP`) for 1, 2, 3 and 4 players, `weeks 3`, `boss false` (boss-enabled AI-driven games are 03-06's: `boss/enter` is still a stub in this worktree and a stub never sets `bossAttempted`), each seat a CPU with a persona/difficulty chosen from a fixed rotation (all four personas and all three difficulties appear across the cases); loop: `week/advance` as the system action when `step === "weekBreak"`, for a pending combat decision `decideCombat`-via-`decidePlayer` for every required player (commit through `decision/commit`), otherwise `decidePlayer` for the active player; cap 20000 actions per game. Assert for 12 seeded games: terminates with `phase "over"`, **zero rejected actions** (collect `{seed, step, action}` of any reject and fail with them), `result` non-null (stub-agnostic: do not assert the winner or tally), `GameEnded` emitted once, `deserialize(serialize(state), rules)` round-trips at every 25th action and at the end, determinism (same seed and mix twice gives the identical final `hashState`), no hidden info in the events seen by a spectator (`eventsFor(events, "spectator")` has no `BagUpdated`, `ErrandAssigned`, `ErrandExpired`), and a smoke perf bound: `50` games of 2 players finish under a generous wall-clock bound measured against a calibration loop (relative, as 03-06 will do; skip the assertion when the calibration is below a noise floor). Keep the whole file under ~10 s.
2. **Scoring decision (competing-proposal point, spec 15).** Before finalising `ai/plan.ts`/`board.ts` scoring, implement and evaluate at least TWO formulations on a throwaway harness in `/tmp/usurpia-scratch/03-05b/` (40 seeded 4-player games on `TEST_RULES` per formulation, personas rotated, normal difficulty, boss off): **A** linear weighted sum of normalised terms plus the discounted BFS potential (the baseline described in Tasks 1 and 2); **B** gold-equivalent expected value (each term converted to expected gold using tuning numbers, persona weights as multipliers, potential added as discounted expected gold). Measure per formulation: rejected actions (must be 0), mean actions per game, wall-clock per game, persona separation (the mean of each persona's signature counter: tycoon `invested`/towns, menace `pvpWins`+`stolen`, adventurer `monstersSlain`, opportunist `errandsDone` + decree completions, each higher than the other personas' mean), and Hard-vs-Normal win rate over the 40 games (informational). Choose the formulation with zero rejects and the clearer persona separation, using speed as tie-break; implement only the chosen one in the committed code. Document in the SUMMARY under the exact heading `## AI scoring decision`: both formulations, the harness numbers in a table, the choice, why, and the rejected alternative's weakness. (Executors do not spawn sub-planning agents; the choice is the executor's.)
3. **G2 pre-check (C3).** After the scoring choice, run a throwaway script in `/tmp/usurpia-scratch/03-05b/` that plays 100 four-player games on the SHIPPED rules (`loadRules()` through the content package, never `TEST_RULES`), `weeks 4`, `boss false`, seed `g2-precheck`, difficulties `hard,hard,normal,normal` and personas assigned by two INDEPENDENT rotations: seat `s` of game `g` plays difficulty `D[(s + g) % 4]` and persona `P[(s + floor(g / 4)) % 4]` (so no persona is locked to a difficulty and each persona/difficulty pair occurs). Because `endGame` is the 03-01b stub in this worktree (winner = seat 0), the script computes the winner itself from the final state with the D17 order (`assetsOf`, then gold, then town value, then lowest seat; award bonuses omitted, noted in the SUMMARY). Report the Hard share of wins (a Hard seat is one of the two seats on a `hard` difficulty; the share is wins by Hard seats over games), its standard error, mean actions per game and the rejected-action count (must be 0). **Target: Hard share >= 55%** (G2 in 03-06 is the 60% gate; this margin leaves headroom for 03-06's bounded tuning). If below 55%, make up to 3 recorded adjustments, one per attempt, in this order: (a) the `DIFFICULTY_BOARD` constants (depth, `tauMilli`, `errorBp`), (b) persona weights (+-2 each, integers 0..20), (c) the potential or node scoring in `plan.ts`/`board.ts`; re-run the SAME 100 games after each; keep an adjustment only if the share rises. Update the exact-weights and difficulty tests to the final numbers with a comment per changed value. Record under the exact heading `## G2 pre-check`: the table `attempt | change | Hard share % | SE | rejected | verdict`, and the final verdict. If the share is still below 55% after 3 adjustments, the plan ends with Status `Partial` and the full table (bounded fallback, spec D20: the orchestrator then decides between a 03-06 tuning budget, a depth increase for Hard, or a spec amendment); the target is never weakened and 03-06 edits on the AI side only the `DIFFICULTY_BOARD` constants (within the bounds in must_haves) and persona weight values.
4. **Decree completion probe (H3, informational).** With the final AI, play 100 four-player games on the SHIPPED rules (`weeks 4`, `boss false`, seed `decree-probe`, all seats Normal, personas rotated by `(s + g) % 4`) in the same scratch harness and report per decree id (the eligible decrees in `decrees.json`): reveals, successes (`DecreeResolved.outcome === "success"`), `successBp = floor(successes * 10000 / reveals)` (guard `reveals > 0`), plus the aggregate bp. Flag every decree with at least 5 reveals and 0 successes (`unreachable for CPU`) or above 9500 bp (`trivial`). This is evidence for 03-06's G1 tuning, not a gate; record it under the exact heading `## Decree completion probe`.
5. **Mutation proof (PIT-001):** for each AI legality check (path M1-M5 in `validatePathAi`, price/cap checks in act candidates, closed shops, boss attempt flag, hp-vs-recoil), temporarily delete or invert the code, run the owning test file, confirm only its own tests fail, restore; record the table.
6. **Pipeline and commit:** run `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm validate:content`. Write `03-05b-SUMMARY.md` (sections: Result, Files changed, Pinned goldens (AI decisions), `## AI scoring decision`, `## G2 pre-check`, `## Decree completion probe`, Mutation proof, Lint guard proof, Decisions made (persona weights final values, `decidePlayer` wrapper, DIFFICULTY_BOARD final values), Issues, Hand-off to 03-06 (driver contract: `week/advance` as system action, `decidePlayer`, `createBoardAi` seeds, how the smoke driver loops, the boss-enabled AI games still to run, how the sim package reaches `ai/index.ts`)). Commit on `phase3/03-05b` with message `Phase 3 plan 03-05b: Persona CPU AI` ending with the attribution trailer lines from the execution prompt; verify `git show --name-only --format=` HEAD lists only `files_modified` paths and `git status --porcelain` is empty. Do not push. Tell the orchestrator the merge order: `phase3/03-05a` first, then `phase3/03-05b`.

Edge/error cases: a smoke game that stalls (report seed and loop; do not raise the cap); 1-player smoke game (no rivals); a seeded game with all seats Easy (errors on every turn still legal).

> verification: pnpm vitest run packages/core/test/game-smoke.test.ts
> verification: pnpm exec tsc -b packages/core packages/content
> verification: pnpm exec eslint packages/core eslint.config.js
> verification: pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm validate:content
> verification: grep -q 'AI scoring decision' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md
> verification: grep -q 'G2 pre-check' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md
> verification: grep -q 'Decree completion probe' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md
> verification: grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md
  </action>
  <verify>
pnpm vitest run packages/core/test/game-smoke.test.ts
pnpm exec tsc -b packages/core packages/content
pnpm exec eslint packages/core eslint.config.js
pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm validate:content
grep -q 'AI scoring decision' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md
grep -q 'G2 pre-check' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md
grep -q 'Decree completion probe' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md
grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md
  </verify>
  <done>CPU-driven games on TEST_RULES run to completion with zero rejected actions and deterministic hashes, the scoring choice is documented with evidence, the G2 pre-check shows the Hard share (or ends Partial with the table), the pipeline is green and the plan is committed on phase3/03-05b.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] The AI reads PlayerView only; the hidden-information fuzz passes for 4 personas x 3 difficulties; the lint guard blocks `../board` imports (proof recorded).
- [ ] AI BFS equals `board/graph`; every AI action is accepted by the engine in the smoke games (0 rejects).
- [ ] The `## AI scoring decision` section compares at least two formulations with numbers and names the choice and the rejected alternative.
- [ ] The `## G2 pre-check` section reports 100 games on shipped rules with independent rotations and a Hard share >= 55%, or the plan is `Partial` with the table.
- [ ] The `## Decree completion probe` lists every eligible decree with reveals, successes and bp.
- [ ] DIFFICULTY_BOARD is the single tuning table; no forbidden file changed.
- [ ] Full pipeline green; commit message and contents verified; every planned task completed or blocked with evidence.
</verification>

<success_criteria>
- The CPU is legal, deterministic, hidden-information-safe and cheap enough for the 03-06 sim and perf gates.
- G2 risk is measured before 03-06 starts, and 03-06's only AI-side knobs are the DIFFICULTY_BOARD constants and persona weight values.
</success_criteria>

<output>
After completion, create `.planning/phases/03-board-economy-cpu-ai-core/03-05b-SUMMARY.md`

No STATE.md or ROADMAP.md edits (the orchestrator owns them). The orchestrator merges `phase3/03-05b` into `dev` after 03-05a, pushes and proves CI.
</output>
