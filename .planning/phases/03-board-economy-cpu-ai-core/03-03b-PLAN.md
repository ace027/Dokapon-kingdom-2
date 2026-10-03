---
phase: 03-board-economy-cpu-ai-core
plan: 03b
type: execute
wave: 4
depends_on: ["03-03a", "03-04"]
files_modified:
  - packages/core/src/board/settle.ts
  - packages/core/src/board/landing.ts
  - packages/core/src/handlers/board.ts
  - packages/core/src/handlers/combat.ts
  - packages/core/src/combat/resolve.ts
  - packages/core/src/index.ts
  - packages/core/test/board-helpers.ts
  - packages/core/test/landing.test.ts
  - packages/core/test/shop.test.ts
  - packages/core/test/pvp.test.ts
  - packages/core/test/town-actions.test.ts
  - packages/core/test/turn-end.test.ts
  - packages/core/test/board-loop.test.ts
  - packages/core/test/resolve.test.ts
  - packages/core/test/combat-golden.test.ts
  - packages/sim/test/replay-file.test.ts
  - .planning/phases/03-board-economy-cpu-ai-core/03-03b-SUMMARY.md
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
  - packages/core/src/board/graph.ts
  - packages/core/src/board/hooks.ts
  - packages/core/src/board/towns.ts
  - packages/core/src/board/turn.ts
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
  - packages/content/
  - packages/sim/src/
  - packages/sim/fixtures/
  - packages/client/
  - package.json
  - pnpm-lock.yaml
  - eslint.config.js
  - scripts/
  - .github/
  - README.md
sequential_files:
  - "packages/sim/test/replay-file.test.ts"
expected_artifacts:
  - path: "packages/core/src/board/settle.ts"
    provides: "Leaf settle for board battles (KO, liberation, PvP outcome) next to stealGold"
    required: true
  - path: "packages/core/src/board/landing.ts"
    provides: "Landing sequence: warp, PvP check, space effects, weighted draws"
    required: true
  - path: "packages/core/src/handlers/board.ts"
    provides: "Real town/*, shop/* and turn/end handlers (no STUB left)"
    required: true
  - path: "packages/core/test/board-loop.test.ts"
    provides: "Seeded multi-player loop with week advances"
    required: true
  - path: ".planning/phases/03-board-economy-cpu-ai-core/03-03b-SUMMARY.md"
    provides: "Plan summary incl. pinned goldens, steal-item re-pin diff, mutation proof"
    required: true
autonomous: false
agents: ["engineering-senior-developer"]
requirements: [R10, R11, R13]
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
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/board/landing.ts\"'"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/board/settle.ts\"'"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/handlers/board.ts\"'"
  - "grep -rn 'STUB(03-03' packages/core/src; test $? -eq 1"
  - "grep -n 'steal-item:' packages/core/src/combat/resolve.ts; test $? -eq 1"
  - "grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-03b-SUMMARY.md"
  - "git log -1 --format=%s | grep -q '^Phase 3 plan 03-03b:'"
  - "git show --name-only --format= HEAD | grep -E '(^|/)(\\.tsbuild|dist|node_modules)/'; test $? -eq 1"
  - "git show --name-only --format= HEAD | grep -E '^(packages/core/src/(rules|types|events|actions|reducer|game|views)\\.ts|packages/core/src/(serialize|ai)/|packages/core/src/handlers/(week|boss|index|shared|loadout)\\.ts|packages/core/src/board/(graph|hooks|towns|turn|effects|decks|gazette|signals|effect-world|victory)\\.ts|packages/content/|packages/sim/(src|fixtures)/|packages/core/test/fixtures/)'; test $? -eq 1"
  - "test -z \"$(git status --porcelain)\""

must_haves:
  truths:
    - "Landing order is warp, then PvP check, then space effect; a PvP landing replaces the space effect; battle landings start combat from the move/useItem handler and board/settle.ts stays a leaf that handlers/combat.ts endCombat calls"
    - "Liberation is free (guardian fight) and happens in settleBattle; invest at 3x base is rejected with its own negative test; seize closes the spoils window and keeps value and liberatedWeek"
    - "turn/end ends the game through endGame(state, ctx, rules, events) with the handler ctx and runs runWeekEnd on the last seat of round 6; tests are stub-agnostic about endGame (phase over, GameEnded, non-null result) and about 03-04's decree/errand resolution events (prefix oracle, M1)"
    - "The shrine grants rules.board.shrineMasteryWins mastery wins (shipped 0, so no effect, no events and no RNG)"
    - "Steal-item is a bare tag; exactly the three Phase 2 steal-item rows are re-pinned; every other Phase 2 event count, outcome and golden is unchanged and the combat-game.json fixture is untouched"
    - "Every id-keyed record read in the new code (players, towns, nodes, items, gear, spells, monsters) uses Object.hasOwn/ownGet and survives ids toString, valueOf, hasOwnProperty (PIT-002); every negative test has exactly one mutation (PIT-001)"
    - "This plan never writes weekly/totals counters or progress folds: counters are folded from events by 03-04's applySignals, so every handler emits events carrying the data the fold needs"
  artifacts:
    - path: "packages/core/src/handlers/board.ts"
      provides: "Board handlers (all real)"
      min_lines: 400
      contains: "export const boardHandlers"
    - path: "packages/core/src/board/landing.ts"
      provides: "Landing"
      min_lines: 180
      contains: "export function resolveLanding"
    - path: "packages/core/src/board/settle.ts"
      provides: "Settle and steals"
      min_lines: 120
      contains: "export function settleBattle"
  key_links:
    - from: "packages/core/src/handlers/combat.ts"
      to: "packages/core/src/board/settle.ts"
      via: "endCombat calls settleBattle when public.battle is non-null"
      pattern: "settleBattle"
    - from: "packages/core/src/handlers/board.ts"
      to: "packages/core/src/handlers/combat.ts"
      via: "liberate starts guardian battles through beginCombat"
      pattern: "beginCombat"
    - from: "packages/core/src/handlers/board.ts"
      to: "packages/core/src/board/victory.ts"
      via: "turn/end calls endGame with the handler ctx"
      pattern: "endGame\\(state, ctx"
---

<objective>
Finish the board loop (the second half of the old 03-03): landing on every space type, PvP and monster/guardian settlement, shops, town liberate/invest/seize with spoils, `turn/end` (seat rotation, week end, game end) and the D13 `steal-item` bare-tag re-pin.

Purpose: spec sections 4.4-4.7, 4.9, 4.10 (game-end call) and 9 (R10, R11, R13). 03-03a delivered hooks, towns helpers, spin, move, useItem, `stealGold` and the `beginCombat` extraction; 03-04 delivered the week layer (merged in wave 3). This plan runs ALONE in wave 4 in the main checkout. `boss/enter`, awards and the real `endGame` are 03-05a.
Output: the modules in `files_modified`, one test file per concern, the three re-pinned steal-item rows, SUMMARY with mutation proof.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-board-economy-cpu-ai-core/03-CONTEXT.md
@.planning/phases/03-board-economy-cpu-ai-core/03-03a-PLAN.md
@.planning/specs/03-board-economy-cpu-ai-core-spec.md
@.planning/memory/ERRORS.md

Relevant source files (post 03-03a and 03-04 merge):
@packages/core/src/types.ts
@packages/core/src/events.ts
@packages/core/src/rules.ts
@packages/core/src/reducer.ts
@packages/core/src/handlers/shared.ts
@packages/core/src/handlers/combat.ts
@packages/core/src/handlers/board.ts
@packages/core/src/handlers/week.ts
@packages/core/src/board/graph.ts
@packages/core/src/board/towns.ts
@packages/core/src/board/turn.ts
@packages/core/src/board/settle.ts
@packages/core/src/board/landing.ts
@packages/core/src/board/gazette.ts
@packages/core/src/board/victory.ts
@packages/core/src/combat/resolve.ts
@packages/core/src/inventory.ts
@packages/core/src/progression.ts
@packages/core/test/board-helpers.ts
@packages/core/test/fixtures/test-rules.ts
</context>

<execution_contract>
Harness: read-before-write -> evidence-before-action -> minimal diff -> verify-before-report

Role: engineering-senior-developer (executor, model `sonnet`).
Task: implement spec sections 4.4-4.7, 4.9, 4.10 (call site) and 9 (`Seize without spoils`, `Bag full on reward`), specialised by 03-CONTEXT.md *Shared contracts* and *Cross-plan seams*, and by the decisions in the tasks below. Requirements R10, R11, R13.
Scope:
- Read targets: spec 4.4-4.7, 4.9, 03-CONTEXT.md, 03-03a-PLAN.md (seam shapes), the current `handlers/board.ts` (STUB(03-03b) handlers), `handlers/combat.ts` (`beginCombat`, `endCombat`, `startRound`, `openExchange`), `board/{graph,towns,turn,settle,landing,gazette,victory}.ts`, `handlers/week.ts`, `combat/stats.ts`, `combat/resolve.ts`, `inventory.ts`, `progression.ts`, `events.ts`, `NpcRef`, `test/fixtures/test-rules.ts` (`TEST_MAP`), `purity-traps.ts`, ERRORS.md.
- Write targets: exactly `files_modified`.
- Forbidden targets: `files_forbidden`. If a task needs an edit in a forbidden file (for example a new event field), stop: `BLOCKED`.
Workspace: this plan runs ALONE in wave 4, in the main checkout `/home/user/Dokapon-kingdom-2` on branch `dev` after wave 3 (03-03a, 03-04) is merged, green and pushed. Never push; never use GitHub MCP.
Allowed tools/actions:
- Edit listed files; run `pnpm vitest run <files>`, `pnpm exec tsc -b packages/core`, `pnpm exec eslint packages/core`, `pnpm lint:purity`, `pnpm exec prettier --write|--check <paths>`.
- Full repo pipeline (required at the end of Task 3).
- `git add`/`git commit` on `dev` (no push). Throwaway scripts only in `/tmp/usurpia-scratch/03-03b/`.
Forbidden actions:
- No files outside `files_modified`; no new dependencies; no `eslint-disable`; no floats in state; no `Math.random`/`Date`; no edits to Phase 2 combat behaviour (only the bare `steal-item` string and the `endCombat` settle call).
- Do not write `weekly`/`totals` counters, `decree.*`, `bonus` or `result` (03-04/03-05a own those folds).
- Do not self-defer planned work. Do not push; do not use GitHub MCP.
Implementation sequence:
1. Read targets. 2. Task 1 (endCombat wiring, settle, landing, steal-item re-pin). 3. Task 2 (shops, town handlers, turn/end). 4. Task 3 (integration loop, exports, mutation proof, pipeline, SUMMARY, commit).
Required interfaces/content structure: see each task. Edge/error cases: see each task.
Verification criteria:
- Every `> verification:` line and every `verification_commands` entry exits 0.
- Mutation proof (PIT-001): for each shop/town validation, the invest cap, each settle branch, the landing PvP-replaces-effect rule and the warp no-rearm rule, temporarily delete or invert the check, run the owning test file, confirm only its own tests fail, restore; record under `## Mutation proof` in the SUMMARY.
- Pinned goldens (landing draws, shop prices) carry the comment `// pinned from TS engine (PRF-004)`.
Final result format:
- Status: Complete | Partial | Failed | BLOCKED
- Files changed
- Verification commands and outputs
- Decisions made
- Issues/errors
</execution_contract>

<stop_gates>
Emit `BLOCKED` and stop instead of guessing when:
- A read target is missing, or the seams from 03-03a/03-04/03-01b do not match 03-CONTEXT *Cross-plan seams* (for example `resolveLanding`, `stealGold`, `beginCombat`, `runWeekEnd`, `endGame(state, ctx, rules, events)`, `drawGazette` are absent or have different signatures).
- Any Phase 2 invariant moves other than the three steal-item rows: event counts 80/84/10/95, per-duel `(outcome, winner)`, gate counts, duel stdout, perf total `a=5411 b=2370 draw=2118 fled=101`. Hash-bearing pins (replay `STEP_HASHES`) may be re-pinned only if the steal-item string is part of hashed state; list each in the SUMMARY.
- `packages/sim/fixtures/combat-game.json` (forbidden here) would need to change.
- Completing a task needs an edit in a forbidden file, or a spec/CONTEXT decision is contradicted by the code.
- Verification commands are non-deterministic, fail after one focused fix attempt, or cannot run.
</stop_gates>

<recovery>
After compaction, interruption, or context loss:
1. Re-read this PLAN.md, 03-CONTEXT.md and any 03-03b-SUMMARY.md draft.
2. Run `git diff --stat` and `git status --porcelain`; inspect `git diff` for every changed file.
3. Compare changed files against `files_modified` and `files_forbidden`; any unapproved change means `BLOCKED`.
4. Re-run the verification lines of every task already marked complete.
5. Continue only from the next unverified task; do not rely on memory-only claims.
</recovery>

<tasks>

<task type="auto">
  <name>Task 1: Board battles: endCombat wiring, settleBattle, landing, steal-item re-pin</name>
  <files>packages/core/src/board/settle.ts, packages/core/src/board/landing.ts, packages/core/src/handlers/combat.ts, packages/core/src/combat/resolve.ts, packages/core/test/board-helpers.ts, packages/core/test/landing.test.ts, packages/core/test/pvp.test.ts, packages/core/test/resolve.test.ts, packages/core/test/combat-golden.test.ts, packages/sim/test/replay-file.test.ts</files>
  <action>
Read spec 4.3-4.5 and 9 (`Seize without spoils`, `Bag full on reward`), 03-CONTEXT *Shared contracts*, `handlers/combat.ts` (`beginCombat`, `endCombat`), `board/settle.ts` and `board/landing.ts` from 03-03a, `board/graph.ts`, `inventory.ts`, `progression.ts` (`awardVictory`, `progressionEvent`), `events.ts` (exact `Rewarded.items`, `PvpSpoils`, `KnockedOut` shapes), `NpcRef`, 03-04's `gazette.ts` (`drawGazette`).

**A. `endCombat` wiring (`handlers/combat.ts`).** `beginCombat` and `public.battle` exist since 03-03a. Here `endCombat` keeps its signature; after its current logic, when `state.public.battle !== null`, it returns `settleBattle(result, battle, {outcome, winner}, rules, events)` (the `battle` is read from the state BEFORE it is cleared; `winner` is the side index, side 0 is always the attacker/board player). `settleBattle` clears `public.battle`. Because `settle.ts` is a leaf (it imports only types, `graph.ts`, `towns.ts` and `hooks.ts`), there is no import cycle. This is the only edit to `handlers/combat.ts` in this plan; Phase 2 behaviour with `battle === null` is unchanged.

**B. `board/settle.ts` additions (leaf; pure).** 03-03a created the file with `stealGold` (absolute `stealCapGold`, coin lock). Add:
```ts
export function settleBattle(state: GameState, battle: BattleCtx, result: {outcome: "ko" | "fled" | "draw"; winner: 0 | 1 | null}, rules: Rules, events: GameEvent[]): GameState
export function knockOut(state: GameState, playerId: PlayerId, rules: Rules, events: GameEvent[], loseGold: boolean): GameState
```
- `knockOut`: target node = `nearestWhere(graph, positions[playerId], (id) => space(id) === "temple")` (BFS, lowest index tie-break; if the player is already on a temple node it uses the nearest OTHER temple; null result keeps the node). `positions[playerId]` set; when `loseGold`, `debitGold(floor(gold * rules.board.koGoldLossBp / 10000))` to the bank; hp stays 0 (revival happens at the next `TurnStarted`). Emit `KnockedOut{playerId, node, goldLost}`.
- `settleBattle`, by `battle.kind`:
  - `monster`: board player (`battle.playerId`) KO'd (`outcome "ko"` and `winner === 1`) -> `knockOut(loseGold: true)`; any other outcome -> nothing more (rewards were paid by `endCombat`).
  - `guardian`: player win (`ko`, `winner === 0`) -> liberation: `towns[townId] = {owner: playerId, value: base, liberatedWeek: public.week}`, emit `TownChanged{townId, owner, value, cause: "liberate"}`; player KO'd -> `knockOut(loseGold: true)`; fled/draw -> nothing.
  - `pvp`: attacker win (`ko`, `winner === 0`) -> defender `knockOut(loseGold: false)` and `spoils = {winner: attacker, loser: defender}` (no event yet; the window is public state). Defender win (`ko`, `winner === 1`) -> attacker `knockOut(loseGold: false)`, then `stealGold(defender, attacker, rules.board.stealBp)` (immediate default steal for the defender). Fled or draw -> emit `PvpSpoils{winner: attacker, loser: defender, kind: "none", amount: 0, townId: null}`.
  - Always: `battle = null`, `step = "act"`, `spin = null`.
  Read every player/town/node via `ownGet`/`Object.hasOwn` (PIT-002). `steal-item` and the combat rewards are not touched here.

**C. `combat/resolve.ts` D13:** change `effects.push(\`steal-item:${stolen}\`)` to `effects.push("steal-item")` (the removed item still leaves the victim's bag and the private `BagUpdated` already tells the victim; the thief gains nothing, as before). Re-pin exactly three rows by running the owning test, reading the new value from the TS engine and reviewing the diff: `resolve.test.ts` (the on-hit hooks test near line 634: `["poison", "steal-gold:10", "steal-item"]`), `combat-golden.test.ts` (row near line 94: `["steal-gold:10", "steal-item"]`), `sim/test/replay-file.test.ts` (row near line 154: `["steal-item"]`; this file is also edited additively by 03-04 in wave 3, which is already merged, so re-read it first and touch only that row and any hash line derived from it). If the replay `STEP_HASHES` or any other hash moves because exchange effects are part of hashed state, re-pin those lines too (this is allowed only for hashes derived from that one string); if `packages/sim/fixtures/combat-game.json` would have to change beyond nothing at all (03-01b migrated it, 03-04 owns its `rulesHash` field), `BLOCKED`. Do not edit any other expectation.

**D. `board/landing.ts`** (replace the stub body; the exported signature is unchanged; remove its `STUB(03-03b)` marker):

```ts
export interface PendingBattle { battle: BattleCtx; opponent: Opponent }
export function resolveLanding(state: GameState, playerId: PlayerId, ctx: Ctx, rules: Rules, events: GameEvent[], opts: { arrived: boolean }): { state: GameState; battle: PendingBattle | null }
```
Sequence (spec 4.4): (1) read the node at `positions[playerId]`; emit `Landed{playerId, node, space}`. (2) **Warp**: when `space === "warp"` and `!opts.arrived`, teleport to `node.warp` (partner), emit `Warped{playerId, from, to, cause: "warp"}` and continue from the partner node with `arrived = true` (arrival never re-warps); emit a second `Landed` for the partner. (3) **PvP check**: a rival (another seated player, `hp > 0`) standing on the final node that is not a safe node (`castle`, `temple`) -> return `battle {kind: "pvp", attacker: playerId, defender, node}` with `opponent {kind: "player", playerId: defender}` (the lowest seat index when several rivals share a node) and apply NO space effect (**PvP replaces the space effect**). (4) **Space effect** by `space`:
- `battle`: choose the zone (`node.zone`, or when `public.week === public.weeksTotal` the zone whose tier is `min(node.tier + 1, 4)` taken from the first map node of that tier, `senior true`); weights from `rules.board.zones[zone].monsters`; when `public.decree.current?.id === "wanted-poster"` and its `params.monster` (a string, read with `Object.hasOwn`) is in the table, multiply that weight by `rules.board.wantedPosterMult`; one `ctx.int(1, totalWeight)` draw, cumulative in table order. Return `battle {kind: "monster", playerId, node, monsterId, senior}` with `opponent {kind: "npc", npc: {kind: "monster", id: monsterId, senior}}` (read `NpcRef` for the exact shape).
- `gold`: `base = rules.board.gold[node.tier - 1]`, `swing = floor(base * rules.board.goldSwingBp / 10000)`, `amount = ctx.int(base - swing, base + swing)`; credit; emit `Rewarded{playerId, source: "gold", gold: amount, items: 0}` (`items` per the exact type in `events.ts`: the count of items gained).
- `item`: one `ctx.int(1, total)` over `rules.board.itemTables["t" + node.tier]`; `addItem` to the bag; if the bag is full convert to gold `floor(price * rules.economy.sellBp / 10000)` (spec 9 `Bag full on reward`); emit private `BagUpdated` (via `bagEvent`) when added and `Rewarded{source: "item", gold: <converted or 0>, items: 1 or 0}` (public, never the id).
- `loot`: table `rules.board.lootTables[node.tier - 1]`; weights shifted by `luck = boardHookTotal(lootLuckBp)`: for entry index `k` of `n` entries `w' = floor(w * (10000 * (n - 1) + luck * k) / (10000 * (n - 1)))` (`n === 1` leaves weights unchanged), one `ctx.int(1, total')` draw. Gear: equip (`equipGear`) only when the new tier is strictly higher than the current slot's tier (empty slot counts as tier 0), else gold `floor(price * sellBp / 10000)`. Spells (`battleSpell`/`wardSpell`): same rule against the current spell in that slot via `setSpell`. Emit public `Granted{playerId, grant: {kind, id}}` plus `CharacterSet` when equipped, else `Rewarded{source: "loot", gold, items: 0}`.
- `event`: `drawGazette(state, ctx, rules, events)` (03-04's real draw is merged; this plan only calls it).
- `temple`: hp = `sheetStats(rules, character).hp` (full heal; only changes when hp < max), `CharacterSet` event when hp changed.
- `shrine`: grant `rules.board.shrineMasteryWins` mastery wins for the current class (shipped `0`: flavor only, no effect, no event, no RNG; 1..2 apply `awardVictory(rules, character, {xp: 0, gold: 0})` that many times, mapped through `progressionEvent`; note in the SUMMARY that `VictoryRewarded` with 0/0 is the shrine marker when the knob is on).
- `empty`, `castle`, `lair`, `shop`, `town`, `warp` (already handled): no effect. A disabled boss (`!boss.enabled`) makes the lair a plain empty node.
No rng is drawn for decisions with a single candidate except where listed (the draws above are the complete list, in this order within one landing).

**E. Tests.**
- `landing.test.ts`: monster draw pinned from the engine with a cross-check against `nextInt(1, total)`, wanted-poster x3 weight (construct `decree.current` in state), final-week senior zone (tier+1, cap 4), gold draw range and golden, item draw and the bag-full conversion (single mutation: full bag vs one free slot), loot weight shift (boundary: `luck` 0 equals base weights; `n === 1`), loot equip only when strictly higher tier (equal tier converts to gold), temple full heal, shrine with `shrineMasteryWins` 0 (shipped): no effect, no events, no RNG draw; with in-memory rules clones at 1 and 2: that many mastery wins for the current class and a rank-up event when crossing a threshold, event space calls the real gazette draw (merged from 03-04): assert exactly one `GazetteDrawn` follows `Landed` and `gazette.last` is non-null, without pinning the card id (card goldens are 03-04's), castle/lair/empty/town/shop no-ops, warp teleport and `Warped{cause: "warp"}`, warp arrival onto a rival triggers PvP after the warp, PvP replaces the space effect (a rival on a `gold` node: no gold paid, battle pvp), a KO'd rival is ignored, ids `toString`/`valueOf`/`hasOwnProperty` as players. Stub-agnostic oracle (M1): every landing assertion checks the exact event prefix it owns (`Landed`, then that space's effect events) and the state fields it owns, never the whole event list, so a later change in the gazette or signal layers cannot break it. Also here (moved from 03-03a): a mover stopping on a rival at a non-safe node accepted by M4 starts a pvp battle through `beginCombat`; a rival on a safe node (`t06`) starts none.
- `pvp.test.ts` (settle, using direct `settleBattle` calls on prepared states plus one full reducer path with a scripted combat): monster KO (temple relocation by BFS lowest index, `koGoldLossBp` 1000 loss to the bank, `KnockedOut` event), monster win/flee/draw (no KO), guardian win liberation (owner, value = base, `liberatedWeek`), guardian KO, pvp attacker win (spoils window open, defender relocated with no gold loss), pvp defender win (attacker relocated, defender steals `stealBp` immediately), pvp draw/flee (`PvpSpoils none`), the steal paths reuse `stealGold` (its cap and coin lock cases are 03-03a's `steal.test.ts`; here assert only that a pvp defender win pays through it), `battle` cleared and `step "act"` in every branch, a nearest-temple tie broken by lowest node index, and `beginCombat` equivalence: `combat/start` with `battle null` produces the same events and state as before (compare against the Phase 2 combat tests, which must all stay green unchanged).

Edge/error cases: players, towns and nodes named `toString`/`valueOf`/`hasOwnProperty`/`constructor`/`__proto__` never read prototype values; a landing with no rivals and a one-player game; a rival with `hp 0` on the landing node.

> verification: pnpm vitest run packages/core/test/landing.test.ts packages/core/test/pvp.test.ts
> verification: pnpm vitest run packages/core/test/resolve.test.ts packages/core/test/combat-golden.test.ts packages/sim/test/replay-file.test.ts
> verification: pnpm vitest run packages/core/test packages/sim/test
> verification: pnpm exec tsc -b packages/core packages/sim
> verification: pnpm exec eslint packages/core/src packages/core/test
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/landing.ts"'
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/settle.ts"'
> verification: grep -n 'steal-item:' packages/core/src/combat/resolve.ts; test $? -eq 1
> verification: grep -q 'settleBattle' packages/core/src/handlers/combat.ts
  </action>
  <verify>
pnpm vitest run packages/core/test/landing.test.ts packages/core/test/pvp.test.ts
pnpm vitest run packages/core/test packages/sim/test
pnpm exec tsc -b packages/core packages/sim
pnpm exec eslint packages/core/src packages/core/test
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/landing.ts"'
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/settle.ts"'
grep -n 'steal-item:' packages/core/src/combat/resolve.ts; test $? -eq 1
grep -q 'settleBattle' packages/core/src/handlers/combat.ts
  </verify>
  <done>Every landing effect, PvP and monster/guardian settlement work with single-mutation tests, endCombat settles board battles through the leaf, and the three steal-item rows are re-pinned with no other Phase 2 golden moved.</done>
</task>

<task type="auto">
  <name>Task 2: Shops, town handlers (liberate, invest, seize) and turn/end</name>
  <files>packages/core/src/handlers/board.ts, packages/core/test/shop.test.ts, packages/core/test/town-actions.test.ts, packages/core/test/turn-end.test.ts</files>
  <action>
Read spec 4.5, 4.6, 4.7 (`turn/end` and week end), 4.9, 4.10 (game end at `turn/end`), `handlers/board.ts` after 03-03a, `board/towns.ts` (`canInvest`, `creditGold`, `debitGold`), `board/settle.ts` (`stealGold`), `board/hooks.ts` (`boardHookTotal`), 03-04's `runWeekEnd` (`handlers/week.ts`), and the `endGame` stub (`board/victory.ts`, signature `(state, ctx, rules, events)`).

1. *shop/buy and shop/sell* (`kind` gear|item|spell; the player must stand on a `shop` node: `not at a shop`; `shops are closed` when `(week - 1) * 6 + round < gazette.shopsClosedUntil`; `unknown gear|item|spell`; price must be > 0: `not for sale`). Spell lookup: battle spells first, then ward spells (the executor verifies ids are disjoint in shipped content and TEST_RULES; if not, `BLOCKED`). Buy price: gear/item `price`; spell `floor(price * (10000 + boardHookTotal(spellPriceBp)) / 10000)`; `not enough gold`. Gear buy equips into its slot (old gear is discarded, `equipGear`); item buy `addItem` (`bag is full`); spell buy `setSpell` into the matching slot. Sell: gear must be the equipped item (`gear is not equipped`), spell must be the equipped spell (`spell is not equipped`), item must be in the bag (`item not in bag`); payout `floor(price * rules.economy.sellBp / 10000)`; gear/spell sells empty the slot (`withAdjustedHp`). Emit `ShopTrade{playerId, side, kind, price}` (price paid or received; no id), private `BagUpdated` for items, `CharacterSet` for gear/spell changes.
2. **`town/liberate{townId}`:** validate `unknown town`, `not at that town` (`positions[playerId]` must equal the town node), `town is already liberated` (owner non-null), `knocked out players cannot liberate` (hp 0). Apply: `beginCombat(state, playerId, {kind: "npc", npc: {kind: "guardian", id: <town guardian>, townTier: <tier of the town node>}}, {kind: "guardian", playerId, townId}, ctx, rules, events)`. Liberation itself happens in `settleBattle` (Task 2). Free: no gold cost (D "free liberation").
3. **`town/invest{townId, amount}`:** `canInvest(...)` messages in its order, plus the player must be able to pay (`not enough gold`). Apply: debit gold 1:1, `towns[townId].value += amount`, emit `TownChanged{townId, owner, value, cause: "invest"}`. Worked example pinned: base 800, invest 1600 gives value 2400 (3x), any further invest rejected (`investment would exceed 3x base value`); one negative test at exactly cap and cap + 1.
4. **`town/seize{townId}`:** `no spoils window is open` (`spoils === null`), `only the spoils winner can seize` (`spoils.winner !== playerId`), `unknown town`, `town is not owned by the loser` (owner !== `spoils.loser`). Apply: `owner = spoils.winner`, value and `liberatedWeek` kept, `TownChanged{cause: "seize"}`, `PvpSpoils{winner, loser, kind: "seize", amount: value, townId}`, `spoils = null` (closing the window). Spec 9 allows the INVALID_PAYLOAD-class reject for seize without spoils; use `INVALID_PAYLOAD`.
5. **`turn/end`** (step act): (a) an open spoils window auto-steals `rules.board.stealBp` (10%) through `stealGold` (honours coin purse lock) and closes; (b) clear `spin`, `spoils`, `turnTowns`; `turn = turn + 1` (saturating guard via `overflow`); (c) if `boss.enabled && boss.hp === 0` call `endGame(state, ctx, rules, events)` (H2: `apply` holds the `ctx`, so any RNG the end of game consumes is committed by the reducer before signals) and return (03-01b's stub places a placeholder result until 03-05a); (d) next seat = `(index + 1) % players.length`; if the ending player was the last seat: when `round === 6` call `runWeekEnd(state, ctx, rules, events)` (03-04's real week end is merged) and return, else `round + 1` and `startTurn` for seat 0; otherwise `startTurn` for the next seat. A one-player game rolls the round on every `turn/end`. Remove every remaining `STUB(03-03b)` marker from `handlers/board.ts`.
6. **Tests.**
- `shop.test.ts`: buy/sell for gear, item, spell with exact prices (spell price scaled by `spellPriceBp` -2500 and +5000 clamped), one negative per validation (not at a shop, closed shop at `clock < shopsClosedUntil` and open at `clock === shopsClosedUntil`, unknown id, price 0 not for sale, not enough gold at exactly price - 1, bag full, not equipped, not in bag), `WRONG_STEP` in `spin`, sell payouts at `sellBp`, replacing equipped gear discards the old one, `ShopTrade` never carries an id.
   - `town-actions.test.ts`: liberate (win via a scripted combat path, or direct `settleBattle` call plus a validate test for each negative; `beginCombat` started with `battle.kind "guardian"` and the correct `townTier`), one negative per liberate/invest/seize check built from a valid fixture with one mutation (not at the town, already liberated, KO'd, not owned, not in `turnTowns`, not enough gold at price - 1, cap and cap + 1, no spoils, wrong winner, town owned by someone else than the loser), invest worked example (2400, then rejected), seize keeps value and closes the window, seize emits both events in order, `WRONG_STEP` in `spin`/`move`, prototype-name towns and players.
   - `turn-end.test.ts`: seat rotation for 1-4 players (`activePlayer`, `round`), round 6 last seat calls `runWeekEnd` (assert `WeekEnded` is emitted, `step "weekBreak"` and no `TurnStarted`; do not pin decree or errand resolution events, they are 03-04's goldens), open spoils auto-steal 10% (and with a coin lock it steals 0 and consumes the buff), spoils cleared, `turnTowns`/`spin` cleared, `TurnStarted` revives a KO'd next player, regen applies, boss kill ends the game (`boss.hp 0` and enabled -> `phase "over"`, one `GameEnded` event and a non-null `result`; the winner and tally belong to 03-05a, so they are not asserted, and the test must also pass against 03-05a's real `endGame`), `turn` counter increments, `WRONG_STEP` in `spin`/`move`, a KO'd player can still `turn/end`.

Edge/error cases: `turn/end` with `players.length === 1`; `boss.enabled` false with `hp` 0 (no game end); spoils whose loser or winner id is a prototype-member name; invest amount equal to `MAX_COUNTER` (overflow rejected, never wraps); a liberate attempt while another combat is open (`WRONG_PHASE` from the reducer); ids as prototype member names in actions (`itemId: "toString"`, `townId: "__proto__"`) reject with the normal messages.

> verification: pnpm vitest run packages/core/test/shop.test.ts packages/core/test/town-actions.test.ts packages/core/test/turn-end.test.ts
> verification: pnpm exec tsc -b packages/core
> verification: pnpm exec eslint packages/core/src packages/core/test
> verification: grep -rn 'STUB(03-03' packages/core/src; test $? -eq 1
  </action>
  <verify>
pnpm vitest run packages/core/test/shop.test.ts packages/core/test/town-actions.test.ts packages/core/test/turn-end.test.ts
pnpm exec tsc -b packages/core
pnpm exec eslint packages/core/src packages/core/test
grep -rn 'STUB(03-03' packages/core/src; test $? -eq 1
  </verify>
  <done>Shops, liberate, invest, seize, spoils and turn/end work with single-mutation tests, endGame is called with the handler ctx, and no 03-03 stub marker remains.</done>
</task>

<task type="auto">
  <name>Task 3: Integration loop, exports, mutation proof, pipeline, SUMMARY, commit</name>
  <files>packages/core/src/index.ts, packages/core/test/board-loop.test.ts, .planning/phases/03-board-economy-cpu-ai-core/03-03b-SUMMARY.md</files>
  <action>
Read `handlers/board.ts` after Task 2, `board/graph.ts` (`canonicalPath`), `core/src/index.ts` after 03-03a and 03-04, the Phase 2 combat helpers used by tests (scripted `attack` commits).

1. **`core/src/index.ts`** (additive to 03-03a's exports): export `settleBattle` and `knockOut` (and `boardHandlers` only if the Phase 2 index already exports handler maps; follow the existing pattern, export nothing that would create a name clash). Do NOT export `effects`/`decks` or 03-04 modules (03-05a finishes the index).
2. **Tests.**
   - `board-loop.test.ts`: a seeded 2-player and a 4-player loop on TEST_RULES with a deterministic scripted driver (spin with no item, `canonicalPath` from `graph.ts` for the move, resolve any battle by committing `attack` for both required players until combat ends, `turn/end`, and the system `week/advance` whenever `step` is `weekBreak`), 60 actions, asserting after every action `deserialize(serialize(state), rules)` round-trips and `hashState` is stable across two identical runs; no action is rejected; events are deep-frozen-safe (mutating returned events never changes state); every `Rewarded`, `ShopTrade`, `Moved` and `TaxCollected` event is public and carries no item id; a view for a non-active player exposes no other player's bag. Assert the run terminates 5 turns without a thrown invariant.
3. **Mutation proof (PIT-001):** for each shop/town validation, the invest cap, each `settleBattle` branch, the landing PvP-replaces-effect rule, the warp no-rearm rule, the `endGame` call on boss kill and the spoils auto-steal, temporarily delete or invert the code, run the owning test file, confirm only its own tests fail, restore. Record the table.
4. **Pipeline and commit:** run `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`. Write `03-03b-SUMMARY.md` (sections: Result, Files changed, Pinned goldens (landing draws, shop prices), Steal-item re-pin diff (the three rows old to new, and whether any `STEP_HASHES` moved), Mutation proof, Decisions made (PvP replaces the space effect, shrine marker event and the `shrineMasteryWins` knob, `Rewarded.items` type, bag-full conversion), Issues). Commit on `dev` with message `Phase 3 plan 03-03b: Landing, settle, towns and turn loop` ending with the attribution trailer lines from the execution prompt; verify `git show --name-only --format= HEAD` lists only `files_modified` paths and `git status --porcelain` is empty. Do not push.

Edge/error cases: a game where every player is KO'd at once is impossible by construction (KO relocates and revives at turn start); `turn/end` for a KO'd player is accepted; two consecutive `turn/end` calls are rejected with `WRONG_STEP` by the reducer.

> verification: pnpm vitest run packages/core/test/board-loop.test.ts
> verification: pnpm exec tsc -b packages/core
> verification: pnpm exec eslint packages/core/src packages/core/test
> verification: grep -rn 'STUB(03-03' packages/core/src; test $? -eq 1
> verification: pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
> verification: grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-03b-SUMMARY.md
  </action>
  <verify>
pnpm vitest run packages/core/test/board-loop.test.ts
pnpm exec tsc -b packages/core
pnpm exec eslint packages/core/src packages/core/test
grep -rn 'STUB(03-03' packages/core/src; test $? -eq 1
pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-03b-SUMMARY.md
  </verify>
  <done>A seeded multi-player board loop with week advances round-trips through serialize, the mutation proof is recorded, the full pipeline is green and the plan is committed on dev.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Landing order warp -> PvP -> space effect, PvP replaces the effect, `settle.ts` stays a leaf, `endCombat` settles board battles only when `public.battle` is non-null.
- [ ] Invest cap (2400 then rejected), seize closes the window, liberation is free and happens in `settleBattle`.
- [ ] `turn/end` rotation, week end and game end work; `endGame` is called with the handler `ctx`.
- [ ] Exactly the three steal-item rows (plus only hash lines derived from that string) changed in Phase 2 tests; event counts, per-duel outcomes, gate counts and the perf total are unchanged; `combat-game.json` untouched.
- [ ] No `STUB(03-03` remains in `packages/core/src`; no forbidden file changed.
- [ ] Full pipeline green on `dev`; commit message and contents verified; every planned task completed or blocked with evidence.
</verification>

<success_criteria>
- A seeded game can be played through the real handlers: spin, validated move, landing effects, PvP and monster battles, liberation, investing, seizing, shopping, turn rotation and week advance, all deterministic and round-trippable.
- The economy numbers (steal, KO loss, shop prices) match the spec and are golden- or boundary-tested.
- Phase 2 combat behaviour is intact apart from the documented bare `steal-item` tag.
</success_criteria>

<output>
After completion, create `.planning/phases/03-board-economy-cpu-ai-core/03-03b-SUMMARY.md`

No STATE.md or ROADMAP.md edits (the orchestrator owns them). The orchestrator pushes `dev` and proves CI after this plan.
</output>
