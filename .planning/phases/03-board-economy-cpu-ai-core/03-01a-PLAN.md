---
phase: 03-board-economy-cpu-ai-core
plan: 01a
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/content/data/map.tiled.json
  - packages/content/data/tuning.json
  - packages/content/src/schemas/map.ts
  - packages/content/src/schemas/tuning.ts
  - packages/content/src/flatten-map.ts
  - packages/content/src/registry.ts
  - packages/content/src/shipped.ts
  - packages/content/src/build-rules.ts
  - packages/content/test/map.test.ts
  - packages/content/test/data.test.ts
  - packages/content/test/build-rules.test.ts
  - packages/content/test/shipped.test.ts
  - packages/content/test/load-rules.test.ts
  - packages/content/test/limits.test.ts
  - packages/content/test/validate.test.ts
  - packages/content/test/helpers.ts
  - packages/core/src/rules.ts
  - packages/core/src/board/graph.ts
  - packages/core/src/index.ts
  - packages/core/test/fixtures/test-rules.ts
  - packages/core/test/graph.test.ts
  - packages/core/test/map-invariants.test.ts
  - packages/core/test/rules.test.ts
  - packages/sim/fixtures/combat-game.json
  - packages/sim/test/replay-file.test.ts
  - packages/sim/test/cli.test.ts
  - packages/sim/test/duel.test.ts
  - packages/client/test/render.test.ts
  - .planning/phases/03-board-economy-cpu-ai-core/03-01a-SUMMARY.md
files_forbidden:
  - .planning/specs/
  - .planning/reference/
  - .planning/ROADMAP.md
  - .planning/PROJECT.md
  - .planning/STATE.md
  - .planning/memory/
  - .planning/phases/01-foundations-deterministic-engine/
  - .planning/phases/02-combat-core-balance-sim/
  - packages/core/src/board/effects.ts
  - packages/core/src/board/decks.ts
  - packages/content/src/schemas/effects.ts
  - packages/core/test/effects.test.ts
  - packages/core/test/decks.test.ts
  - packages/content/test/effects-schema.test.ts
  - packages/core/src/types.ts
  - packages/core/src/actions.ts
  - packages/core/src/events.ts
  - packages/core/src/canonical.ts
  - packages/core/src/reducer.ts
  - packages/core/src/game.ts
  - packages/core/src/views.ts
  - packages/core/src/serialize.ts
  - packages/core/src/handlers/
  - packages/core/src/combat/
  - packages/core/src/ai/
  - packages/content/data/items.json
  - packages/sim/src/
  - packages/client/src/
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
  - path: "packages/content/data/map.tiled.json"
    provides: "75-node Tiled map committed from the frozen generator"
    required: true
  - path: "packages/content/src/flatten-map.ts"
    provides: "Tiled to Rules.map flattening"
    required: true
  - path: "packages/core/src/board/graph.ts"
    provides: "Graph build, BFS distances, reachable sets, shortest paths, checkMapInvariants"
    required: true
  - path: "packages/core/test/map-invariants.test.ts"
    provides: "One negative test per map invariant, each with a unique message"
    required: true
  - path: "packages/core/test/fixtures/test-rules.ts"
    provides: "TEST_RULES with map (TEST_MAP), board tuning and sellBp"
    required: true
  - path: ".planning/phases/03-board-economy-cpu-ai-core/03-01a-SUMMARY.md"
    provides: "Plan summary incl. mutation proof, hash derivation list and golden diff review"
    required: true
autonomous: false
agents: ["engineering-senior-developer"]
requirements: [R10, R11]
user_setup: []
verification_commands:
  - "test \"$(git rev-parse --show-toplevel)\" = /home/user/usurpia-wt/03-01a"
  - "test \"$(git rev-parse --abbrev-ref HEAD)\" = phase3/03-01a"
  - "pnpm install --frozen-lockfile"
  - "pnpm lint"
  - "pnpm lint:purity"
  - "pnpm format:check"
  - "pnpm typecheck"
  - "pnpm test"
  - "pnpm build"
  - "node .planning/reference/phase-03/gen-map.mjs --check packages/content/data/map.tiled.json"
  - "pnpm validate:content"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/rules.ts\"'"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/board/graph.ts\"'"
  - "grep -q 'RULES_VERSION = 2' packages/core/src/rules.ts"
  - "grep -rn '84a995db' packages --include=*.ts; test $? -eq 1"
  - "grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-01a-SUMMARY.md"
  - "git log -1 --format=%s | grep -q '^Phase 3 plan 03-01a:'"
  - "git show --name-only --format= HEAD | grep -E '(^|/)(\\.tsbuild|dist|node_modules)/'; test $? -eq 1"
  - "test -z \"$(git status --porcelain)\""

must_haves:
  truths:
    - "The shipped map has exactly 75 nodes, 135 edges, the spec space counts and zone sizes, and every map invariant has its own unique error message proven by a single-mutation negative test (PIT-001)"
    - "Rules gains `map: BoardMap` and `board: BoardTuning` (and `economy.sellBp`), RULES_VERSION is 2, and `buildRules` fails with unique messages for every map invariant and every town/guardian/table cross-reference"
    - "No state shape changes in this plan: createGame, kernel, combat and rewards state hashes, every event count (80, 84, 10, 95), every per-duel outcome, the gate counts and the duel perf total line are byte-identical to Phase 2"
    - "Single-pin policy (critique C2): no test hard-codes `rulesHash(loadRules())` any more. Every former `84a995db` literal derives the hash from the rules under test; the only committed copy of the shipped-rules hash is the `rulesHash` field of `packages/sim/fixtures/combat-game.json`, guarded by one test that fails loudly when it is stale. `rulesHash(TEST_RULES)` stays a literal pin (it is not touched by tuning plans)"
    - "Every id-keyed record (towns, zones, item tables, node ids) is read with Object.hasOwn/ownGet and survives the ids toString, valueOf, hasOwnProperty, constructor, __proto__ (PIT-002)"
    - "Pure-function goldens (reachable sets, shortest paths) are computed from the TS engine and cross-checked by hand-tracing at least two of them (PRF-004); commits carry no .tsbuild/dist/node_modules (PRF-005 worktree plan; orchestrator-only pushes, PRF-001); all agents run on Sonnet 5.5 (PRF-006)"
  artifacts:
    - path: "packages/core/src/board/graph.ts"
      provides: "Graph utilities and map invariants"
      min_lines: 200
      contains: "export function checkMapInvariants"
    - path: "packages/content/src/flatten-map.ts"
      provides: "Tiled to Rules.map flattening"
      min_lines: 60
      contains: "export function flattenTiledMap"
    - path: "packages/core/test/map-invariants.test.ts"
      provides: "Per-invariant negative tests"
      min_lines: 150
      contains: "map: lair must be >= 7 from castle"
  key_links:
    - from: "packages/content/src/build-rules.ts"
      to: "packages/core/src/board/graph.ts"
      via: "buildRules calls checkMapInvariants and reports each message"
      pattern: "checkMapInvariants\\("
    - from: "packages/content/src/build-rules.ts"
      to: "packages/content/src/flatten-map.ts"
      via: "buildRules flattens the Tiled file into Rules.map"
      pattern: "flattenTiledMap\\("
---

<objective>
Lay the Phase 3 content and graph foundation (spec B1, part of B11) in `packages/content` and `packages/core`:
- commit the Tiled map (generated once from the frozen generator), parse and flatten it into `Rules.map`, and add `tuning.board` / `economy.sellBp` with `RULES_VERSION 2`;
- implement `board/graph.ts` (graph queries and every map invariant, each with its own message) plus the `TEST_MAP` fixture in `TEST_RULES`;
- adopt the single-pin policy for `rulesHash` so later tuning plans never have to chase literals.

Purpose: this is the W1 half of the old 03-01 (the v3 state/serialize half is now 03-01b in W2). It touches no state type, so it runs in parallel with 03-02.
Output: map data, Tiled schema and flatten, `Rules.map`/`Rules.board`, `board/graph.ts`, `TEST_MAP`, derived-hash tests, SUMMARY.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-board-economy-cpu-ai-core/03-CONTEXT.md
@.planning/specs/03-board-economy-cpu-ai-core-spec.md
@.planning/memory/ERRORS.md

Relevant source files:
@packages/core/src/rules.ts
@packages/core/src/index.ts
@packages/core/test/fixtures/test-rules.ts
@packages/content/src/build-rules.ts
@packages/content/src/registry.ts
@packages/content/src/shipped.ts
@packages/content/src/schemas/tuning.ts
@packages/content/data/tuning.json
@packages/content/test/helpers.ts
@packages/sim/test/replay-file.test.ts
@packages/sim/test/cli.test.ts
@packages/sim/test/duel.test.ts
@packages/sim/fixtures/combat-game.json
@packages/client/test/render.test.ts
@.planning/reference/phase-03/gen-map.mjs
</context>

<execution_contract>
Harness: read-before-write -> evidence-before-action -> minimal diff -> verify-before-report

Role: engineering-senior-developer (executor, model `sonnet`); self-review of every negative test against PIT-001 before reporting.
Task: implement spec sections 3 (D1, D10, D18-D19 numbers only), 5 and 8 (content part), exactly as specialised by 03-CONTEXT.md. Requirements R10, R11.
Scope:
- Read targets: spec sections above, 03-CONTEXT.md, ERRORS.md, every file in `<context>`, `gen-map.mjs`, `packages/content/test/**` (to extend), every test that currently contains `84a995db`.
- Write targets: exactly `files_modified`.
- Forbidden targets: `files_forbidden` (the parallel plan 03-02 owns `board/effects.ts`, `board/decks.ts`, `content/src/schemas/effects.ts` and their tests; they are not present in this worktree). In particular NO state type, reducer, handler, serializer or `items.json` change here (03-01b owns them).
Workspace (worktree isolation, 03-CONTEXT *Worktree and merge-order rules*):
- Worktree `/home/user/usurpia-wt/03-01a`, branch `phase3/03-01a`. Start every shell command with `cd /home/user/usurpia-wt/03-01a &&`. Never touch `/home/user/Dokapon-kingdom-2`, the sibling worktree, or any other branch. Never push; never use GitHub MCP.
Allowed tools/actions:
- Edit listed files; run package-scoped checks (`pnpm vitest run packages/core packages/content`, `pnpm exec tsc -b packages/core packages/content`, `pnpm exec eslint packages/core packages/content packages/sim packages/client`, `pnpm lint:purity`, `pnpm exec prettier --write|--check <paths>`).
- Run `node .planning/reference/phase-03/gen-map.mjs --tiled`, `--stats` and `--check` (read-only on the reference directory).
- Run the full repo pipeline in the worktree (required at the end of Task 3).
- `git add`/`git commit` on `phase3/03-01a`.
- Throwaway scripts only in `/tmp/usurpia-scratch/03-01a/` (import sources by absolute worktree path), never inside the checkout.
Forbidden actions:
- Do not modify files outside files_modified; do not add dependencies; do not edit `eslint.config.js`, `scripts/`, CI or README.
- Do not change combat, reward, loadout or progression behaviour; do not change any state shape.
- Do not weaken any invariant or test to make a golden pass; do not self-defer planned work.
- Do not push; do not use GitHub MCP; no eslint-disable comments; no floats in state; no `Math.random`/`Date` in core src.
Implementation sequence:
1. Read the targets. Record the baseline: run `pnpm test` once and note the Phase 2 pins listed in 03-CONTEXT (they are the invariants that must not move).
2. Task 1: Rules shape, tuning data, Tiled map, schema, flatten, build wiring, TEST_RULES + TEST_MAP.
3. Task 2: `board/graph.ts`, `checkMapInvariants`, build-time invariant reporting, graph and invariant tests.
4. Task 3: single-pin hash derivation, re-pin `rulesHash(TEST_RULES)`, fixture field, full pipeline, mutation proof, SUMMARY, commit.
Required interfaces/content structure: see each task. Edge/error cases: see each task.
Verification criteria:
- Every `> verification:` line and every `verification_commands` entry exits 0.
- Mutation proof (PIT-001): for every map invariant and every cross-reference error, temporarily delete or invert the check, run the owning test file, confirm only its own test(s) fail, restore; record under `## Mutation proof` in the SUMMARY.
- Golden diff review: the SUMMARY lists `rulesHash(TEST_RULES)` old -> new, the fixture `rulesHash` old -> new, every test line changed from a literal to a derived hash, and confirms the unchanged invariants (state hashes, event counts 80/84/10/95, duel stdout, gate counts, perf total).
Final result format:
- Status: Complete | Partial | Failed | BLOCKED
- Files changed
- Verification commands and outputs
- Decisions made
- Issues/errors
</execution_contract>

<stop_gates>
Emit `BLOCKED` and stop instead of guessing when:
- A read target in `<context>` is missing or unreadable, or `.planning/reference/phase-03/gen-map.mjs --check` does not pass on its own freshly generated output.
- `--stats` output differs from the spec section 5 numbers (75 nodes, 135 edges, avg degree 3.6, diameter 11, lair castle distance 7, mean castle-distance by tier `[1.71, 3.67, 4.45, 5.64]`) or the space/zone counts.
- Completing a task needs a file not in `files_modified` or one in `files_forbidden`.
- A Phase 2 invariant (state hash, event count, per-duel outcome/winner, gate count, duel perf total) changes: report the first diverging test and field; do not re-pin it. Only `rulesHash` values and the `rules=` tokens derived from them may change.
- A negative test cannot be built with exactly one mutation and a unique message: report the invariant and the minimal cascading message set.
- Verification commands are non-deterministic, fail after one focused fix attempt, or cannot run.
</stop_gates>

<recovery>
After compaction, interruption, or context loss:
1. Re-read this PLAN.md, 03-CONTEXT.md and any 03-01a-SUMMARY.md draft.
2. Run `git diff --stat` and `git status --porcelain`; inspect `git diff` for every changed file.
3. Compare changed files against `files_modified` and `files_forbidden`; any unapproved change means `BLOCKED`.
4. Re-run the verification lines of every task already marked complete before continuing.
5. Continue only from the next unverified task; do not rely on memory-only claims.
</recovery>

<tasks>

<task type="auto">
  <name>Task 1: Rules shape, tuning.board, Tiled map and flatten, build wiring, TEST_RULES with TEST_MAP</name>
  <files>packages/content/data/map.tiled.json, packages/content/data/tuning.json, packages/content/src/schemas/map.ts, packages/content/src/schemas/tuning.ts, packages/content/src/flatten-map.ts, packages/content/src/registry.ts, packages/content/src/shipped.ts, packages/content/src/build-rules.ts, packages/content/test/map.test.ts, packages/content/test/helpers.ts, packages/content/test/limits.test.ts, packages/content/test/validate.test.ts, packages/core/src/rules.ts, packages/core/test/fixtures/test-rules.ts, packages/core/test/rules.test.ts</files>
  <action>
Read spec section 5, D1, D10, D18-D19 (numbers only), `gen-map.mjs`, `build-rules.ts`, `registry.ts`, `shipped.ts`, `schemas/tuning.ts`, `rules.ts`, `test/fixtures/test-rules.ts` and `content/test/helpers.ts`.

1. **Generate the map.** `node .planning/reference/phase-03/gen-map.mjs --tiled > packages/content/data/map.tiled.json`; then `pnpm exec prettier --write packages/content/data/map.tiled.json` and confirm `node .planning/reference/phase-03/gen-map.mjs --check packages/content/data/map.tiled.json` exits 0 and `--stats` matches the spec numbers. The committed JSON is from now on the sole source of truth.
2. **`rules.ts`** (core): set `RULES_VERSION = 2`; export `NodeId = string`, `TownId = string`, `SPACE_TYPES` (`battle item loot gold town event empty shop temple shrine warp castle lair`) and `SpaceType`; export `MapNode {id: NodeId; space: SpaceType; zone: ContentId; tier: 1|2|3|4; x: number; y: number; warp: NodeId | null}`, `MapTown {node: NodeId; base: number; guardian: ContentId}`, `BoardMap {nodes: readonly MapNode[]; edges: readonly (readonly [NodeId, NodeId])[]; towns: Readonly<Record<TownId, MapTown>>; lair: NodeId}` (nodes ordered by id, edges sorted lexicographically with a < b). Add to `Rules`: `map: BoardMap` and `board: BoardTuning`; extend `EconomyTuning` with `sellBp: number`. `BoardTuning` (exact keys, all ints unless noted):
   - `maxSteps: 9`, `goldSwingBp: 2500`, `gold: readonly [number, number, number, number]`, `rerollFee`, `stealBp`, `stealCapGold`, `shrineMasteryWins`, `koGoldLossBp`, `reviveBp`, `taxBaseBp`, `wantedPosterMult`, `decreeReward`, `disappointmentBp`, `bossHp`, `bossMinBonus`, `bossBonusBp`, `bossDamageLowBp`, `bossDamageHighBp`, `bossRecoilBp`, `awardBonus`;
   - `zones: Readonly<Record<ContentId, {monsters: readonly {id: ContentId; weight: number}[]}>>`;
   - `itemTables: Readonly<Record<"t1" | "t2" | "t3" | "t4" | "rare", readonly {id: ContentId; weight: number}[]>>`;
   - `lootTables: readonly [LootTable, LootTable, LootTable, LootTable]` where `LootTable = readonly {kind: "gear" | "battleSpell" | "wardSpell"; id: ContentId; weight: number}[]`.
   `SHIPPED_MAP_SPEC` is NOT in rules.ts (it lives in `graph.ts`, Task 2).
3. **`tuning.json`** (`v` stays 1): add `board` and `economy.sellBp: 5000`. Shipped values (initial, 03-06 may tune): `maxSteps 9`, `goldSwingBp 2500`, `gold [30,60,100,160]`, `rerollFee 100`, `stealBp 1000`, `stealCapGold 400` (an ABSOLUTE gold cap per steal, replacing the spec's undefined `stealCapBp`), `shrineMasteryWins 0` (a documented tuning knob, int 0..2: mastery wins granted by a shrine landing; shipped OFF because the design treats the shrine as flavor until the Phase 5 Summon feature and mastery is a power lever for G3; 03-06 may turn it on), `koGoldLossBp 1000`, `reviveBp 5000`, `taxBaseBp 1000`, `wantedPosterMult 3`, `decreeReward 1500`, `disappointmentBp 500`, `bossHp 600`, `bossMinBonus 3000`, `bossBonusBp 2500`, `bossDamageLowBp 8000`, `bossDamageHighBp 12000`, `bossRecoilBp 5000`, `awardBonus 1000`.
   - `zones`: each of `enchanted-forest`, `soggy-coast`, `goblin-mines`, `bureaucrat-bog` lists its four monsters (read `monsters.json`) each `weight 25`, except `mimic-vault-clerk` weight 10.
   - `itemTables`: `t1` herb 40, antidote 20, smoke-bomb 20, swift-boots 10, battle-tonic 10. `t2` herb 20, big-herb 25, antidote 10, swift-boots 15, lead-boots 10, iron-tonic 10, coin-purse-lock 10. `t3` big-herb 25, smoke-bomb 10, pathfinder 15, homing-stone 15, lead-boots 10, coin-purse-lock 15, battle-tonic 10. `t4` royal-elixir 20, big-herb 20, pathfinder 20, homing-stone 15, coin-purse-lock 15, iron-tonic 10. `rare` royal-elixir 30, pathfinder 25, homing-stone 20, coin-purse-lock 25.
   - `lootTables` (tier 1..4): T1 gear bronze-blade 25, buckler 25, lucky-sock 20; battleSpell spark 15; wardSpell barrier 15. T2 gear knights-saber 20, tower-shield 20, speed-anklet 15, mage-ring 15; battleSpell fireball 10, frostbite 10, pickpocket-bolt 10; wardSpell reflect 10. T3 gear goblin-cleaver 20, mirror-shield 20, tax-collectors-seal 15; battleSpell thunderclap 15; wardSpell absorb 15, counterspell 15. T4 gear royal-claymore 20, aegis-of-usurpia 20, crown-ward-amulet 15; battleSpell royal-decree 20.
4. **`schemas/map.ts`:** a strict zod schema of exactly the generated Tiled shape (read the generated file first): top-level Tiled keys as generated, object layer named `nodes` (point objects `n01..n75` with typed `properties` `space, zone, tier, town, baseValue, guardian, warp`) and object layer named `edges` (polylines with `from`, `to`). Reject any `oneWay` property with the message `map: oneWay edges are not supported`. Unknown keys reject (strict).
5. **`flatten-map.ts`:** `export function flattenTiledMap(file: TiledMapFile): BoardMap` builds the `BoardMap` (nodes sorted by id, `warp` partner or null, `towns` via `Object.fromEntries`, edges normalised a < b and sorted, duplicates kept so the invariant check can report them).
6. **Registry/shipped/build-rules wiring (no invariants yet):** add `"map.tiled.json": TiledMapFileSchema` to `CONTENT_REGISTRY` and to `REQUIRED_FILES`, bundle it in `SHIPPED_ENTRIES` (keep the sorted order), and in `buildRules` produce `rules.map` via `flattenTiledMap` and `rules.board` from tuning (`rules.economy.sellBp` from `economy`). Extend `content/test/helpers.ts` (and every test that writes a complete temp content directory) with the new required file. Add unique-message cross-reference errors (each with its own single-mutation negative test): every `towns[*].guardian` is a key of `guardians` (`map: town <id> guardian <id> is not a guardian`); every town node has `space === "town"` and every town-space node has a `towns` entry (`map: town <id> must sit on a town space`, `map: town space <node> has no town entry`); every item table id is a key of `items`; every loot id exists in `gear`/`battleSpells`/`wardSpells` per its kind; every `zones` key is a zone used by `monsters` and every zone monster id exists in `monsters` with that zone; every `itemTables` key is one of the five names; weights are ints >= 1; `shrineMasteryWins` is an int 0..2; `stealCapGold` an int >= 0. Existing board-hook items stay valid (HOOK_RANGES is untouched here; 03-03a tightens it). Map-invariant reporting is wired in Task 2.
7. **TEST_RULES:** **TEST_MAP:** in `test/fixtures/test-rules.ts` add the 12-node `TEST_MAP`: ids `t01..t12`; edges the ring `t01-t02, ..., t11-t12, t12-t01` plus chords `t01-t07` and `t04-t10`; spaces `t01 castle, t02 battle, t03 gold, t04 town, t05 shop, t06 temple, t07 lair, t08 warp, t09 event, t10 town, t11 warp, t12 empty`; warps `t08` and `t11` are partners; all nodes use the zone id of TEST_RULES' tier-1 monster, tier 1 for `t01..t06`, tier 2 for `t07..t12`, x/y on a 4x3 grid (x 100..400 step 100, y 100..300 step 100); towns `{ "test-town-a": {node t04, base 800, guardian <a TEST_RULES guardian id>}, "test-town-b": {node t10, base 500, guardian <another or the same>}}`; `lair t07`. Add `TEST_RULES.map = TEST_MAP`, `TEST_RULES.board` (same scalar numbers as shipped; `zones` for that zone id with the first TEST_RULES monster of that zone weight 1; `itemTables`/`lootTables` using ids that exist in TEST_RULES items/gear/spells, at least one entry per table), `economy.sellBp 5000`, `v: 2`. TEST_MAP is never passed through `checkMapInvariants` with `SHIPPED_MAP_SPEC` (it is 12 nodes); graph tests use graph functions on it directly.
8. **Tests.** `packages/content/test/map.test.ts`: the shipped map flattens to 75 nodes, 135 edges, the spec space and zone counts, avg degree 3.6, `oneWay` rejected with its message, strict-schema extra-key and missing-property rejections; each cross-reference error is a single-mutation test with the exact message; `tuning.board` shape (exact keys, `stealCapGold 400`, `shrineMasteryWins 0`). Update `rules.test.ts` for the `v: 2` shape (its `rulesHash(TEST_RULES)` literal is re-pinned in Task 3). Do not hard-code any `rulesHash(loadRules())` literal in new tests (single-pin policy).

Edge/error cases: unknown node ids and duplicate ids are reported by Task 2's invariants; here, `towns` keyed by `toString`/`__proto__`/`constructor` (use `Object.fromEntries`, `Object.hasOwn`); a tuning `zones` key or item table key that is a prototype member name must be rejected as unknown, never read from the prototype.

> verification: node .planning/reference/phase-03/gen-map.mjs --check packages/content/data/map.tiled.json
> verification: pnpm vitest run packages/content/test/map.test.ts packages/content/test/limits.test.ts packages/content/test/validate.test.ts
> verification: pnpm exec tsc -b packages/core packages/content
> verification: pnpm exec eslint packages/core/src packages/content/src
> verification: pnpm validate:content
  </action>
  <verify>
node .planning/reference/phase-03/gen-map.mjs --check packages/content/data/map.tiled.json
pnpm vitest run packages/content/test/map.test.ts packages/content/test/limits.test.ts packages/content/test/validate.test.ts
pnpm exec tsc -b packages/core packages/content
pnpm exec eslint packages/core/src packages/content/src
pnpm validate:content
  </verify>
  <done>The shipped Tiled map flattens into Rules.map, tuning.board and sellBp are validated content, buildRules carries both with unique cross-reference errors, and TEST_RULES has a 12-node TEST_MAP.</done>
</task>

<task type="auto">
  <name>Task 2: board/graph.ts, map invariants at build time, graph and invariant tests</name>
  <files>packages/core/src/board/graph.ts, packages/core/src/index.ts, packages/content/src/build-rules.ts, packages/content/test/build-rules.test.ts, packages/core/test/graph.test.ts, packages/core/test/map-invariants.test.ts</files>
  <action>
Read spec section 5 (invariants list), D1, `gen-map.mjs --check` (the reference implementation of the invariants), `rules.ts` map types, Task 1's `flatten-map.ts` and `build-rules.ts`.

1. **`board/graph.ts`** (pure, no imports from `handlers`/`ai`; imports types from `../rules`): export
   - `interface Graph {readonly ids: readonly NodeId[]; readonly adj: readonly (readonly number[])[]; readonly index: ReadonlyMap<NodeId, number>}` and `buildGraph(map: BoardMap): Graph` (adjacency sorted ascending by index);
   - `neighbors(g, id): readonly NodeId[]`, `distancesFrom(g, id): readonly number[]` (BFS, `-1` unreachable), `shortestPath(g, a, b): NodeId[]` (lowest-index tie-break, includes both ends), `nearestWhere(g, from, pred: (id: NodeId) => boolean): NodeId | null` (BFS, ties by lowest node index, `from` itself excluded);
   - `reachableEnds(g, start: NodeId, steps: number, blocked?: ReadonlySet<NodeId>): NodeId[]` (a blocked node is never entered and is ignored when deciding whether a path is a maximal dead end; 03-03a passes the locked lair): ends of self-avoiding paths of exactly `steps` or maximal dead ends, ascending index, no duplicates (rules M1-M3; M4/M5 are applied by 03-03);
   - `enumeratePaths(g, start, steps, limit = 20000, blocked?: ReadonlySet<NodeId>): NodeId[][]` and `canonicalPath(g, start, end, steps, blocked?: ReadonlySet<NodeId>): NodeId[] | null` (the lexicographically smallest valid path by node index ending at `end`, or null);
   - `isAdjacentChain(g, start, path): boolean` (used by 03-03a's M1);
   - `checkMapInvariants(map: BoardMap, spec: MapSpec = SHIPPED_MAP_SPEC): string[]` returning one message per violated invariant, in the fixed order below, and `SHIPPED_MAP_SPEC` (counts, zone sizes `[15, 18, 20, 22]`, degree bounds 2..5 and castle <= 6, `minNodes 60`, `maxNodes 90`, `minLairDistance 7`, `minWarpGap 6`, `minTownGap 2`, `templeReach 7`, `warpZonePairs [["enchanted-forest","goblin-mines"],["soggy-coast","bureaucrat-bog"]]`, towns/bases/guardians-cycle expectations from spec 5).
   Messages (exact strings; `<x>` is substituted): `map: node count must be 60-90`, `map: duplicate node id <id>`, `map: self-loop edge at <id>`, `map: duplicate edge <a>-<b>`, `map: edge references unknown node <id>`, `map: must have exactly one castle`, `map: must have exactly one lair`, `map: graph must be connected`, `map: space count mismatch for <space>`, `map: node <id> degree out of range`, `map: zone size mismatch for <zone>`, `map: node <id> tier must equal zone tier`, `map: duplicate town id <id>`, `map: town <id> is missing a base value`, `map: towns <a> and <b> must be at distance >= 2`, `map: warp <id> must be mutual`, `map: warp pair <a>-<b> must be >= 6 apart`, `map: warp pair <a>-<b> must join zones <z1> and <z2>`, `map: lair must be >= 7 from castle`, `map: castle must be in enchanted-forest`, `map: mean castle distance must increase with tier`, `map: node <id> must be within 7 of a temple`. Each check is independent code (no shared early return) so a single mutation yields a single message.
2. **Build-time reporting.** In `buildRules`, call `checkMapInvariants(map)` and append one build error per returned message (file `map.tiled.json`, path `$`); a map that violates an invariant never produces `Rules`. `build-rules.test.ts` gains one test that a mutated raw map yields exactly that message. `packages/core/src/index.ts`: export `buildGraph`, `neighbors`, `distancesFrom`, `shortestPath`, `nearestWhere`, `reachableEnds`, `enumeratePaths`, `canonicalPath`, `isAdjacentChain`, `checkMapInvariants`, `SHIPPED_MAP_SPEC` and the new Rules types (`NodeId`, `TownId`, `SpaceType`, `SPACE_TYPES`, `MapNode`, `MapTown`, `BoardMap`, `BoardTuning`).
3.  **Tests.** `packages/content/test/map.test.ts`: the shipped map flattens to 75 nodes, 135 edges, the spec space and zone counts, avg degree 3.6, `checkMapInvariants` returns `[]`, `oneWay` rejected with its message, strict-schema extra-key and missing-property rejections; each cross-reference error is a single-mutation test with the exact message. `packages/core/test/map-invariants.test.ts`: for EVERY message in step 8, mutate the shipped flattened map in exactly one way (cloned with `structuredClone`) and assert `checkMapInvariants(mutated)` `toEqual` exactly that one message; if one mutation provably cascades, assert the cascade list in full and justify it in a comment. `packages/core/test/graph.test.ts`: on TEST_MAP, golden reachable-end sets for starts `t01` (steps 1..4) and `t04` (steps 3), shortest path `t02 -> t11`, `nearestWhere` temple from `t09`, `canonicalPath` determinism (twice equal), dead-end maximal path; compute the goldens with `pnpm exec tsx` from the TS engine at the end of this task, cross-check every set once by hand-tracing the ring/chords for at least two of them, and record them with a comment `// pinned from TS engine (PRF-004)`; also a shipped-map test that `reachableEnds` for the castle with 9 steps terminates and returns a non-empty ascending set, and `enumeratePaths` respects `limit`. Update `rules.test.ts` for `v: 2` shape (the new `rulesHash(TEST_RULES)` is pinned in Task 3).

Edge/error cases: unknown node ids, duplicate ids (use `Object.hasOwn` on object records, ids `toString`/`__proto__` as node ids in a mutated map must produce the duplicate/unknown errors, never a prototype read); `steps` 0 or negative returns `[]`; start not in the graph returns `[]`; `limit` exceeded throws `RangeError("enumeratePaths: limit exceeded")`.

> verification: pnpm vitest run packages/core/test/graph.test.ts packages/core/test/map-invariants.test.ts packages/content/test/build-rules.test.ts packages/content/test/map.test.ts
> verification: pnpm exec tsc -b packages/core packages/content
> verification: pnpm exec eslint packages/core/src/board packages/content/src
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/graph.ts"'
  </action>
  <verify>
pnpm vitest run packages/core/test/graph.test.ts packages/core/test/map-invariants.test.ts packages/content/test/build-rules.test.ts packages/content/test/map.test.ts
pnpm exec tsc -b packages/core packages/content
pnpm exec eslint packages/core/src/board packages/content/src
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/board/graph.ts"'
  </verify>
  <done>Every map invariant has its own message and single-mutation test, graph queries are golden-tested on TEST_MAP, and buildRules rejects a violating map.</done>
</task>

<task type="auto">
  <name>Task 3: Single-pin hash policy, re-pin, pipeline, mutation proof, SUMMARY, commit</name>
  <files>packages/content/test/data.test.ts, packages/content/test/build-rules.test.ts, packages/content/test/shipped.test.ts, packages/content/test/load-rules.test.ts, packages/core/test/rules.test.ts, packages/sim/fixtures/combat-game.json, packages/sim/test/replay-file.test.ts, packages/sim/test/cli.test.ts, packages/sim/test/duel.test.ts, packages/client/test/render.test.ts, .planning/phases/03-board-economy-cpu-ai-core/03-01a-SUMMARY.md</files>
  <action>
Read every test and fixture that contains `84a995db` or `7433ea8b` (`grep -rn "84a995db\|7433ea8b" packages --include=*.ts --include=*.json`, ignoring `.tsbuild`), `sim/src/replay-file.ts` and `sim/src/rules.ts` (`replayRules`).

1. **Prove the invariants first.** Run `pnpm vitest run` and list every failing assertion. The only legitimate failures are the `rulesHash` literals (and the `rules=` tokens built from them). State hashes (`createGame` fixture `758ef72c`, kernel `9616698e`, combat `ec0c3508`, rewards `57da3ea4`, sim fixture `hash=0483c0fa`), event counts (80, 84, 10, 95), per-duel `(outcome, winner)`, gate counts, duel stdout blocks and the perf total line must pass unchanged (this plan touches no state shape); otherwise `BLOCKED`.
2. **Single-pin policy (C2).** Replace each shipped-rules literal by a derived value, with these exact changes:
   - `content/test/data.test.ts` (lines ~11 and ~224), `content/test/build-rules.test.ts` (~53), `content/test/shipped.test.ts` (~13-15, the test title no longer names a hash): compare `rulesHash(<rules under test>)` with `rulesHash(loadRules())` (or the Node loader result the test already has); no literal.
   - `sim/test/duel.test.ts`: `const RULES_HASH = rulesHash(replayRules())` and the `MIRRORS_BLOCK` template and the JSON `rulesHash` assertion use it.
   - `sim/test/cli.test.ts`: the mismatch message `error: rules mismatch: file <FOREIGN_HASH>, current <derived>` and the replay line `hash=0483c0fa rules=<derived> turn=1 events=95 rejections=0` use the derived hash; `FOREIGN_HASH` stays a literal and a test asserts it differs from the current hash.
   - `sim/test/replay-file.test.ts`: `RULES_HASH` derived; `LINE` is `hash=0483c0fa rules=${RULES_HASH} ...`; add ONE test `combat-game fixture rulesHash equals rulesHash(loadRules())` that reads `fixtures/combat-game.json` and fails with the message `update the rulesHash field of packages/sim/fixtures/combat-game.json (only that field)` when stale.
   - `client/test/render.test.ts` (~51): `expect(rulesHash(DEMO_RULES)).toMatch(/^[0-9a-f]{8}$/)` plus equality with the Node loader hash when the client test may import it under the lint rules, otherwise only the format check (the content `shipped.test.ts` already proves shipped equals Node-loaded rules).
   - `sim/fixtures/combat-game.json`: update ONLY the `rulesHash` field to the new `rulesHash(loadRules())` (compute with `pnpm exec tsx` in `/tmp/usurpia-scratch/03-01a/`). This is the only committed copy of the shipped hash.
   - `core/test/rules.test.ts`: re-pin the literal `rulesHash(TEST_RULES)` (was `7433ea8b`) from the TS engine with the comment `// pinned from TS engine (PRF-004)`; it is the only remaining literal rules-hash pin and it is unaffected by tuning plans.
3. **Close.** Mutation proof table in the SUMMARY (every map invariant, every cross-reference error, the stale-fixture-hash test: temporarily corrupt the fixture field and show only that test fails). Run the full pipeline: `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm validate:content`; the last verification line proves no literal `84a995db` remains in any `.ts`. Write `03-01a-SUMMARY.md` (sections: Result, Files changed, Golden diff review (both hash olds -> news, the list of literals converted to derived values, unchanged invariants), Mutation proof, Decisions made (message wording, the `stealCapGold` and `shrineMasteryWins` knobs, the single-pin policy and where the one pin lives), Issues). Commit on `phase3/03-01a` with message `Phase 3 plan 03-01a: Map, graph and board tuning content` ending with the attribution trailer lines from the execution prompt; verify `git show --name-only --format= HEAD` has no `.tsbuild/`, `dist/`, `node_modules/` paths and `git status --porcelain` is empty. Do not push. Tell the orchestrator the merge order: `phase3/03-01a` first, then `phase3/03-02` (files are disjoint).

Edge/error cases: a test that builds its own rules clone and compares hashes (keep it relative to the clone); the replay CLI test that deliberately mismatches (uses the literal foreign hash); `.tsbuild` declaration files containing the old literal are ignored build output.

> verification: pnpm vitest run packages/content packages/core/test/rules.test.ts packages/sim packages/client
> verification: grep -rn '84a995db' packages --include=*.ts; test $? -eq 1
> verification: grep -c 'rulesHash' packages/sim/fixtures/combat-game.json
> verification: pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm validate:content
> verification: grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-01a-SUMMARY.md
  </action>
  <verify>
pnpm vitest run packages/content packages/core/test/rules.test.ts packages/sim packages/client
grep -rn '84a995db' packages --include=*.ts; test $? -eq 1
pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build && pnpm validate:content
grep -q 'Mutation proof' .planning/phases/03-board-economy-cpu-ai-core/03-01a-SUMMARY.md
  </verify>
  <done>No test hard-codes the shipped rules hash, the fixture field is the single committed copy and is guarded by one test, rulesHash(TEST_RULES) is re-pinned from the engine, every Phase 2 state pin is unchanged, the pipeline is green and the plan is committed on phase3/03-01a.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `node .planning/reference/phase-03/gen-map.mjs --check packages/content/data/map.tiled.json` exits 0 and the committed map equals the generator's `--tiled` output after prettier normalisation.
- [ ] Every map invariant message and every cross-reference error has a single-mutation test; the SUMMARY mutation proof lists each as killed only by its own test.
- [ ] `RULES_VERSION 2`; `Rules.map`/`Rules.board`/`economy.sellBp` present; `stealCapGold` (absolute) and `shrineMasteryWins` (default 0) are in tuning, TEST_RULES and the schema.
- [ ] State hashes, event counts 80/84/10/95, per-duel outcomes, gate counts, duel stdout and the perf total line are unchanged.
- [ ] No `.ts` file contains `84a995db`; the fixture `rulesHash` field is the only committed shipped hash.
- [ ] Full pipeline green in the worktree; commit message and contents verified.
- [ ] Every planned task is completed, blocked with evidence, or escalated; no planned work is self-deferred.
</verification>

<success_criteria>
- A Tiled-authored 75-node map loads through `buildRules` into `Rules.map` with invariants enforced at build and in tests; reachable-set and shortest-path queries are golden-tested on TEST_MAP.
- 03-01b can start from a green `dev` that has the Rules shape, graph module and TEST_MAP, and changes only state, serialization and the reducer.
- Later tuning plans never edit a rules-hash literal except the one fixture field.
</success_criteria>

<output>
After completion, create `.planning/phases/03-board-economy-cpu-ai-core/03-01a-SUMMARY.md`

No STATE.md or ROADMAP.md edits (the orchestrator owns them). The orchestrator merges `phase3/03-01a` first in W1 (then 03-02).
</output>
