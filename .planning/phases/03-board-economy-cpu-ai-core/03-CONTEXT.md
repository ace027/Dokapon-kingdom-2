# Phase 3: Board, Economy & CPU AI Core -- Context

## Phase Goal
A full game playable headlessly: a Tiled-authored ~75-space map, spinner and movement with PvP interception, town liberate/invest/tax/seize, weekly decrees, errands and the Gazette, a deadline victory with a placeholder boss, Royal Bonus Awards, and a persona x difficulty CPU AI, balanced by a `pnpm sim game` health suite (ROADMAP Phase 3).

**The authoritative contract source is the spec:** `.planning/specs/03-board-economy-cpu-ai-core-spec.md` (r2, critique folded; decision-complete except for the gaps this file closes under *Spec gaps closed by planning*). Plans point to spec sections by heading or number (for example "spec 4.3 Move validation", "D17") and do not re-derive contracts. Where this CONTEXT or a plan fixes a value the spec leaves open, the plan value is binding.

## Requirements Covered
`.planning/REQUIREMENTS.md` does not exist. Requirement text comes from PROJECT.md R10-R14 and the spec requirement table (B1-B12).
- **R10 (map and movement):** ~75-space open-web map authored in Tiled; spinner d6 with modifiers; self-avoiding movement; PvP interception; safe nodes. Spec B1, B2, B3. Plans 03-01 (map, graph, invariants), 03-03 (spin, move, landing).
- **R11 (town economy):** liberate (guardian fight), invest to 3x base, weekly tax, seize after PvP; Assets formula; board hooks become live with engine clamps. Spec B4, B8. Plans 03-01 (assets), 03-03 (everything else).
- **R12 (weekly loop and content):** exact week ordering, 3/4/5-week games, decrees (10 authored, 9 eligible), errands (12 authored, 10 eligible, reroll), Gazette (24), one data-tagged effect interpreter and seeded decks. Spec B5, B6. Plans 03-02 (effects, decks), 03-04 (content, week handlers).
- **R13 (victory):** lair unlock in the final week, placeholder boss with persistent HP, Royal Bonus Awards, deadline victory by assets, tally. Spec B7. Plan 03-05.
- **R14 (CPU AI, board half):** persona weight vector x difficulty, PlayerView-only, own RNG, Hard never reads hidden information. Spec B9. Plans 03-05 (AI), 03-06 (health gates).
- **Cross-cutting (spec B10, B11, B12):** the `pnpm sim game` health suite with gates G1-G3 (03-06); the Phase 2 review deferrals (03-01, 03-03, 03-06); determinism and replay v3 (all plans).

## What Already Exists (from prior phases)
Phases 1 and 2 are complete and reviewed (`02-REVIEW.md` PASSED 2026-10-01, 1465 tests, `dev` head `cf4526a` = the Phase 3 spec commit).
- **Monorepo:** pnpm 10.33.0, Node >= 22.13, TypeScript ~6.0.3 (`moduleResolution: bundler`, composite tsconfigs, `tsc -b`), Vitest 5 projects, ESLint 10 (core: `noInlineConfig`, purity bans on `Date`, `Math.random`, `Intl`, `Reflect`, `.constructor`, `localeCompare`, `import()`, `node:*`, cross-package imports), Prettier, `scripts/check-core-purity.mjs`.
- **Root scripts (verified in package.json):** `lint` (`eslint .`), `lint:purity`, `format`, `format:check`, `typecheck` (`tsc -b`), `test` (`vitest run`), `build` (`pnpm -r --if-present run build`), `sim` (`tsx packages/sim/src/cli.ts`), `validate:content`. Packages have no own `test`/`typecheck` scripts: package-scoped checks use `pnpm vitest run packages/<pkg>...` and `pnpm exec tsc -b packages/<pkg>`.
- **`@usurpia/core`:** `types.ts` (SCHEMA_VERSION 2, `Phase = "turn" | "decision"`, `CombatState`, `NpcRef`), `rules.ts` (RULES_VERSION 1, `Rules`, `BOARD_HOOKS`, `rulesHash`), `reducer.ts` (precedence version, type, shape, phase, actor, validate; `reduceAs`), `canonical.ts` (`stableStringify`, `hashState`), `serialize.ts` (single 504-line file, v2 `deserialize(json, rules)`), `game.ts` (`createGame`), `views.ts` (`viewFor` shares live state objects), `handlers/{shared,decision,combat,system,loadout,index}.ts`, `combat/{options,resolve,passives,stats}.ts`, `progression.ts`, `inventory.ts`, `ai/{combat,exp,opponent-model,tuning,index}.ts` (subpath export `@usurpia/core/ai`).
- **`@usurpia/content`:** six data files (`classes, gear, items, monsters, spells, tuning`), zod schemas under `src/schemas/` (`HOOK_RANGES` in `common.ts`), `CONTENT_REGISTRY` in `registry.ts`, `buildRules` (`build-rules.ts`), `shipped.ts` (browser-safe bundle), `node.ts` (`loadRules`, `ContentInvalidError`). Zones are `enchanted-forest` (T1), `soggy-coast` (T2), `goblin-mines` (T3), `bureaucrat-bog` (T4), four monsters per zone; guardians `landlord-lich`, `tollbridge-troll`, `knight-of-foreclosure`.
- **`@usurpia/sim`:** `pnpm sim duel`, `pnpm sim replay`, `report.ts`, `kits.ts`, `replay-file.ts`; tests `gate`, `perf`, `content-stats`, `cli`, `replay-file`, `duel`.
- **Frozen oracle:** `.planning/reference/phase-02/` (never edited, no longer authoritative). **Scratch:** `.planning/reference/phase-03/gen-map.mjs` (map generator, `node gen-map.mjs --tiled > map.tiled.json`, `--stats`, `--check file.json`; frozen once 03-01 commits the map; never edited by any plan).
- **Current pins (Phase 2 end):** `rulesHash(TEST_RULES)` `7433ea8b`, `createGame` fixture `758ef72c`, kernel poll replay `9616698e`, combat golden `ec0c3508` (80 events), rewards golden `57da3ea4` (84 events), `rulesHash(loadRules())` `84a995db`, sim fixture `hash=0483c0fa ... events=95`, duel perf total `total n=10000 a=5411 b=2370 draw=2118 fled=101`, gate counts per class.
- **Memory to honour:** PIT-001 (negative tests with exactly one mutation, proven by deleting the check), PIT-002 (`Object.hasOwn`/`ownGet` for id-keyed records; id pools include `toString`, `valueOf`, `hasOwnProperty`), PRF-001 (GitHub MCP only, orchestrator only), PRF-004 (TS engine is the golden oracle; re-pin in the same commit that changes rules, diff reviewed), PRF-005 (parallel plans in worktrees), PRF-006 (all agents on Sonnet 5.5; if a plan fails twice on complexity, stop and ask, never escalate to Opus).

## Key Design Decisions
- **Architecture approach: Pragmatic** (selected by the user, recorded in the spec header). Rationale: keep the Phase 2 handler-map reducer and partitions, add one new handler/partition per concern, one interpreter for all card effects, and a cheap potential-based AI.
  - *Rejected, Minimal:* hard-code decrees, errands and gazette cards as per-card code paths, keep `serialize.ts` as one file, share live state objects in `viewFor`, and let the AI search the real reducer. Cheapest to write, but every card is a bespoke code path (24 + 10 + 12 of them), the hidden-information boundary stays by convention only, and 03-06 balance iteration would touch code instead of data.
  - *Rejected, Clean Architecture:* an event-sourced board module with a full rules DSL, a Tiled parser in core, a persistent-structure state and a full game-tree search for Hard. Best long-term shape, but core would depend on Tiled and a DSL runtime (breaking the purity boundary), perf and review cost are high, and G2 (Hard >= 60%) would be bought with compute instead of a tuned heuristic.
  - *Selected, Pragmatic:* Tiled parsed in `content` and flattened to `Rules.map`; one closed effect vocabulary; deep-cloned views and events; AI as weighted terms plus a 3-hop BFS potential with softmax noise; sim health gates decide the tuning.
- **Decisions D1-D22:** all of spec section 3 is binding (Tiled flatten, SCHEMA_VERSION 3 / RULES_VERSION 2 with no migrator, `aiRng` as AI-driver state, 6-round weeks with `weekBreak`, `WRONG_STEP`, steps `spin | move | act | weekBreak`, one effect interpreter, hidden decks via `ctx` RNG, tax at week start, warp 4 spaces / Empty 4, boss shape, deep-cloned views, bare `steal-item` tag, `board/settle.ts` leaf, PvP rules, free liberation, assets formula, two-layer hook clamps, BFS-potential AI, no silent gate weakening, serialize split, goldens policy).
- **Spec gaps closed by planning (binding for all plans; each is also listed in the final planning report):**
  1. `Phase` is `"turn" | "decision" | "over"`. Spec 4.1 lists `'combat'` as well, which contradicts D5 ("Phase adds `over`") and the Phase 2 invariant (combat is `phase "decision"` with a `combat/exchange` pending). No `"combat"` member is added.
  2. Zone ids are the full content ids (`enchanted-forest`, `soggy-coast`, `goblin-mines`, `bureaucrat-bog`), not the spec's short names. Tier = zone tier (1-4 in that order). The castle is in `enchanted-forest`, the lair in `bureaucrat-bog`.
  3. Flattened map nodes gain `warp: NodeId | null` (the partner id), because warp pairing cannot be reconstructed from `{id, space, zone, tier, x, y}`. `Rules.map = {nodes, edges, towns, lair}` otherwise as in spec 5; the castle is the node with `space === "castle"`.
  4. `homing-stone` already exists in content as tag `warpCastle` ("warp to the Castle"). Spec 4.2 says it teleports to the nearest unliberated town. 03-01 renames the tag to `warpTown` (description "Warp to the nearest unliberated town.") so the spec semantics win; the data change lives in 03-01 so only one plan changes `rulesHash` per wave.
  5. `sellBp` lives in `tuning.economy` (`sellBp: 5000`); all other board numbers live in `tuning.board` (full table in 03-01 Task 1).
  6. The decree/errand/gazette JSON shapes, the effect parameter table, `Buff`, `DecreeView`, `ErrandView`, `BattleCtx`, `Tally`, `Award`, `Decks`, `EffectResult` and the full event union are not in the spec; they are fixed in *Shared contracts* below and in the owning plans.
  7. Tax Season threshold `X = 500 * ceil((maxPlayerTownValue + 300) / 500)` is evaluated when the decree is **revealed** (stored in `DecreeView.params.x`) and checked at week end. `maxPlayerTownValue` is the value of the single most valuable owned town over all players (0 with none); the decree is completed by owning a town of value >= X (spec D9), so a player's progress is the value of their most valuable town.
  8. Spec 4.6 says Slime/housing effects clamp town value to `[base/2, 3 x base]` (integer floor of `base/2`).
  9. `wanted-poster` params, `royal-delivery`, `royal-portrait`, `royal-parade` (g22) are given concrete definitions in 03-04.
  10. Persona weight vectors and difficulty numbers are given as initial integer values in 03-05; 03-06 may tune them (recording each iteration).
- **Competing-proposal points (spec 15):** 03-05 (AI scoring formulation) and 03-06 (tuning knob order). Each plan tells its executor to evaluate at least two candidates, choose one, and document the choice and evidence in its SUMMARY under the heading named in the plan. Executors do not spawn sub-planning agents; the choice is theirs, inside the plan's constraints.
- **Model split (PRF-006):** all agents on `sonnet` (Sonnet 5.5). **Agents:** `engineering-senior-developer` for 03-01 to 03-04 (and the victory part of 03-05); `engineering-ai-engineer` for the persona AI in 03-05; `data-analytics-engineer` for 03-06. The mandatory testing role of Phase 2 is satisfied here by single-mutation negative tests and the SUMMARY mutation proof inside every code plan (PIT-001), not by a separate agent.

### Wave rationale
- **W1: 03-01 || 03-02 (disjoint).** 03-01 owns the version bump and every shared type. 03-02 is a pure leaf (`board/effects.ts`, `board/decks.ts`, `content/src/schemas/effects.ts`) that depends only on existing core types, so it defines its own structural `EffectWorld`/`EffectResult` and imports nothing new from 03-01.
- **W2: 03-03 || 03-04 (disjoint by seam design).** 03-01 pre-creates every module a W2 plan fills, as typed `STUB(03-0X)` placeholders, so each W2 plan only edits files it owns. See *Cross-plan seams*.
- **W3: 03-05** (needs towns, settle and week handlers). **W4: 03-06** (needs the AI and the full loop; owns tuning).
- **Why 6 plans, not fewer:** ownership boundaries (types vs leaf vs handlers vs content vs AI vs sim) and independent verification; Wave 1 and 2 plans can be executed and verified in separate worktrees.

### Cross-plan seams (stubs pre-created by 03-01, replaced by the owner)
Every stub carries a `// STUB(03-0X)` marker comment with the owner plan. 03-05 Task 3 asserts `grep -rn "STUB(" packages/core/src` finds nothing.
| Seam | File | 03-01 creates | Owner fills |
|---|---|---|---|
| Handlers | `handlers/board.ts` (board/spin, board/move, board/useItem, town/*, shop/*, turn/end) | real guards, `phases`, `actor`, `steps`; `validate` rejects `INVALID_PAYLOAD "not implemented"` | 03-03 (validate + apply) |
| Handlers | `handlers/week.ts` (week/advance, errand/reroll) | same | 03-04 |
| Handlers | `handlers/boss.ts` (boss/enter) | same | 03-05 |
| Handler map | `handlers/index.ts` | spreads `boardHandlers`, `weekHandlers`, `bossHandlers` | nobody in W2/W3 (no edit needed) |
| Assets | `board/towns.ts` `assetsOf` | real (D17) | (03-03 tests it, may refine) |
| Tax | `board/towns.ts` `collectTax(state, rules, events)` | no-op returning `state` | 03-03 |
| Turn start | `board/turn.ts` `startTurn` | revive (50% max hp) and `TurnStarted`, regen = 0 | 03-03 (regen via `hooks.ts`) |
| Week end | `handlers/week.ts` `runWeekEnd` | sets `step = "weekBreak"` only | 03-04 |
| Signals | `board/signals.ts` `applySignals(prev, next, events, rules)` | returns `{state: next, events: []}`; wired into `reduce` after every `apply` | 03-04 |
| Gazette | `board/gazette.ts` `drawGazette` | no-op | 03-04 |
| Game end | `board/victory.ts` `endGame` | sets `phase "over"`, a placeholder `result`, emits `GameEnded` | 03-05 |

## Shared contracts (binding; types are final unless a plan says otherwise)
Defined once here; 03-01 implements them in `types.ts`/`events.ts`/`actions.ts`; 03-02 mirrors `EffectResult` and `Effect` exactly in `effects.ts`.

```ts
// types.ts additions (03-01)
type NodeId = string;  type TownId = string;  type Step = "spin" | "move" | "act" | "weekBreak";
interface Counters { monstersSlain; goldEarned; steps; invested; stolen; pvpWins; liberations; townsHeld; itemsFound; errandsDone: number } // ints, exact keys
interface Buff { kind: "spinMod" | "atkBp" | "defBp" | "coinLock"; value: number; uses: number } // uses >= 1; max 4 per player (oldest dropped on overflow)
interface DecreeView { id: string; week: number; params: Record<string, number | string>; progress: Record<PlayerId, number>; completedBy: PlayerId | null }
interface ErrandView { id: string; progress: number; target: number }
interface GazetteView { id: string; week: number; round: number }   // gazette.last (the most recently drawn card)
type BattleCtx =
  | { kind: "monster"; playerId: PlayerId; node: NodeId; monsterId: ContentId; senior: boolean }
  | { kind: "guardian"; playerId: PlayerId; townId: TownId }
  | { kind: "pvp"; attacker: PlayerId; defender: PlayerId; node: NodeId };
interface Deck { draw: string[]; discard: string[] }   // both empty = uninitialised: first draw builds draw from the pool via ctx shuffle
interface Decks { gazette: Deck; decree: string[]; errand: Record<PlayerId, Deck> }   // decree = remaining ids
interface Tally { [playerId]: { gold: number; items: number; towns: number; bonus: number; assets: number } }
interface Award { id: "monsters" | "humiliated" | "investor" | "thief" | "crown" | "steps"; playerId: PlayerId; bonus: number }
// GameSettings = { v, seed, players, weeks: 3|4|5, boss: boolean }  (exact keys)
// events.ts
interface EffectResult { tag: string; playerId: string | null; townId: string | null; amount: number; node: string | null }
```

Effect vocabulary and parameters (closed set; unknown tag rejected at build; parameters are exact per tag):

| tag | required params | optional | semantics |
|---|---|---|---|
| `gold` | `target`, `amount` (int >= 1) | | target gains amount (from the bank) |
| `loseGold` | `target`, `amount` | | loses `min(amount, gold)` to the bank |
| `loseGoldBp` | `target`, `bp` (1..10000) | | loses `floor(gold * bp / 10000)` to the bank |
| `goldBpAll` | `bp` (-10000..10000, nonzero) | | every player's gold changes by `floor(gold * |bp| / 10000)`, sign of `bp` |
| `item` | `target`, `table` (a key of `tuning.board.itemTables`) | | weighted draw; bag full -> gold at `sellBp` of price |
| `battleBuff` | `target`, `stat` (`atk`/`def`), `bp` (-5000..5000), `battles` (1..5) | | pushes `Buff{kind: atkBp/defBp}` |
| `townValueBp` | `target` (`random-owned-town`/`all-owned-towns`), `bp` (-5000..5000) | | value + `floor(value * bp / 10000)` clamped to `[floor(base/2), 3 * base]` |
| `taxHoliday` | | | `taxHoliday = true` |
| `shopsClosed` | `amount` (rounds 1..6) | | `shopsClosedUntil = clock + amount`, `clock = (week - 1) * 6 + round` |
| `warpAll` | `node` (`castle`) | | every player to the castle |
| `warpTo` | `target`, `node` (`castle`/`random-empty`/`nearest-temple`) | | |
| `swapPositions` | `target` (`self`), `with` (`random-rival`) | | |
| `spinMod` | `target`, `value` (-3..3 nonzero), `uses` (1..3) | | pushes `Buff{kind: spinMod}` |
| `healBp` | `target`, `bp` (1..10000) | | hp + `floor(maxHp * bp / 10000)`, capped at max |
| `damageBp` | `target`, `bp` (1..10000) | | hp - `floor(maxHp * bp / 10000)`, never below 1 |
| `xp` | `target`, `amount` | | accumulates `xpGain` (the caller applies progression) |
| `masteryWin` | `target` | `amount` (default 1) | accumulates `masteryGain` (current class) |
| `transferBp` | `from`, `to`, `bp` (1..10000) | | moves `floor(gold(from) * bp / 10000)` from `from` to `to` |

Targets: `self`, `all`, `leader` (max assets; ties: gold, then lowest seat), `lowest` (min assets; ties lowest seat), `random-player`, `random-rival`, `random-owned-town`, `all-owned-towns`. Draw order: targets are resolved in seat order; one `ctx.int` per random choice, in effect-list order.

Full event union added in 03-01 (all `v: 3`, `visibility` per Phase 2 convention; hidden information is never public): `WeekStarted{week}`, `TurnStarted{playerId, week, round, revived, regen}`, `Spun{playerId, roll, steps, item: string|null}`, `Moved{playerId, from, to, path, passed}`, `Landed{playerId, node, space}`, `Warped{playerId, from, to, cause: warp|homing|effect}`, `Rewarded{playerId, source, gold, items}` (item ids go through the private `BagUpdated`), `ShopTrade{playerId, side: buy|sell, kind, price}` (no id), `TownChanged{townId, owner, value, cause: liberate|invest|seize|effect}`, `TaxCollected{playerId, townId, amount}`, `PvpSpoils{winner, loser, kind: steal|seize|none, amount, townId}`, `KnockedOut{playerId, node, goldLost}`, `DecreeRevealed{decreeId, week, params}`, `DecreeResolved{decreeId, outcome: success|expired, winner, effects: EffectResult[], tax}`, `ErrandAssigned{playerId, errandId, target}` (private to `playerId`), `ErrandRerolled{playerId, fee}`, `ErrandDone{playerId, errandId, effects}`, `ErrandExpired{playerId, errandId}` (private), `GazetteDrawn{cardId, effects}`, `WeekEnded{week, assets}`, `BossUnlocked{}`, `BossDamaged{playerId, damage, recoil, hp}`, `GameEnded{winner, tally, awards}`.

Action union added in 03-01 (exact key sets, spec 4.2): `board/spin{item, pick}`, `board/move{path}`, `board/useItem{itemId}`, `town/liberate{townId}`, `town/invest{townId, amount}`, `town/seize{townId}`, `shop/buy{kind, id}`, `shop/sell{kind, id}`, `errand/reroll{}`, `boss/enter{}`, `turn/end{}`, `week/advance{}` (system). Handler metadata (`phases`, `actor`, `steps`): spin `turn/active/[spin]`; move `[move]`; useItem `[spin, act]`; town/* `[act]`; shop/* `[act]`; errand/reroll `[act]`; boss/enter `[act]`; turn/end `[act]`; week/advance `turn/system/[weekBreak]`. Loadout handlers become `actor: "active"`, `steps: [spin, act]`.

## File ownership (no collisions inside a wave)
| Wave | Plan | Owns (writes) |
|---|---|---|
| W1 | 03-01 | `core/src/{types,actions,events,canonical,reducer,game,views,rules,index,validation}.ts`, `core/src/serialize/**` (replaces `serialize.ts`), `core/src/board/{graph,towns,signals,turn,gazette,victory}.ts`, `core/src/handlers/{shared,loadout,index,board,week,boss}.ts`, all existing core tests (re-pin/migrate) plus new `graph|map-invariants|clone|wrong-step|serialize-v3|assets` tests, `content/data/{map.tiled.json,tuning.json,items.json}`, `content/src/{schemas/map,schemas/tuning,schemas/items,registry,shipped,build-rules,flatten-map}.ts` and content tests, `sim/src/{duel,kits,rules,replay-file}.ts` + `sim/fixtures` + sim tests, `client/src/*` |
| W1 | 03-02 | `core/src/board/{effects,decks}.ts`, `content/src/schemas/effects.ts`, `core/test/{effects,decks}.test.ts`, `content/test/effects-schema.test.ts` |
| W2 | 03-03 | `core/src/board/{hooks,settle,landing,towns,turn}.ts`, `core/src/handlers/{board,combat}.ts`, `core/src/combat/resolve.ts`, `core/src/index.ts`, `content/src/schemas/common.ts`, `content/test/{limits,hook-ranges}.test.ts`, new core tests `hooks|towns|spin|move|landing|pvp|shop|turn-end`, `resolve.test.ts`, `combat-golden.test.ts`, `sim/test/replay-file.test.ts` (steal-item row only) |
| W2 | 03-04 | `core/src/rules.ts`, `core/src/board/{gazette,signals,effect-world}.ts`, `core/src/handlers/week.ts`, `core/src/serialize/hidden.ts`, `core/test/fixtures/{test-rules,build}.ts`, new core tests `week-loop|signals|gazette|decrees|errands|deck-membership`, `rules.test.ts`, `content/data/{decrees,errands,gazette}.json`, `content/src/schemas/{decrees,errands,gazette}.ts`, `content/src/{registry,shipped,build-rules}.ts`, `content/test/{data,build-rules,shipped,load-rules}.test.ts`, `sim/test/replay-file.test.ts` (`rules=` token only), `sim/fixtures` |
| W3 | 03-05 | `core/src/board/victory.ts`, `core/src/handlers/{boss,week}.ts` (final-advance only), `core/src/ai/{persona,board,plan,difficulty,index}.ts`, `core/src/index.ts` (exports `EFFECT_TAGS` and every board/week module), `eslint.config.js`, `content/test/effects-parity.test.ts` (`EFFECT_TAG_LIST` equals core `EFFECT_TAGS`), AI/victory/boss tests |
| W4 | 03-06 | `sim/src/{game,health,mix,cli,report}.ts` (+ `duel.ts` flag parsing), `sim/test/*`, `content/data/{tuning,decrees}.json` and `core/src/ai/persona.ts` weights (tuning only), `eslint.config.js`, `README.md` |
The only same-wave shared files are `sim/test/replay-file.test.ts` (different lines) and, if ever needed, `handlers/index.ts`; both are additive-only and merge in order 03-03 then 03-04. Any textual conflict at merge: `git merge --abort`, stop, escalate.

## Pin and golden policy (PRF-004, binding)
- **Pure-function goldens** (matrix already pinned; tax G-T1; assets; effect results; shuffle; reachable sets on TEST_MAP; spin roll sequence) are written from the spec/worked examples where the spec gives them, and otherwise **recomputed from the TS engine** at the plan's closing task with the diff reviewed in the SUMMARY. Cross-check each engine-derived golden against an independent derivation where one exists (for spin rolls: direct `nextInt` calls on the seeded hidden rng).
- **Composite goldens** (state hashes, replay lines) are re-pinned from the TS engine **in the same commit that changes the rules**: 03-01 (`rulesHash(TEST_RULES)`, `rulesHash(loadRules())`, `createGame` fixture, kernel `9616698e`, combat `ec0c3508`, rewards `57da3ea4`, sim fixture hash, client demo), 03-03 (the three `steal-item` rows: `resolve.test.ts` around line 634, `combat-golden.test.ts` row around line 94, `sim/test/replay-file.test.ts` around line 154), 03-04 (`rulesHash` of both rule sets again, the sim fixture `rules=` token), 03-06 (the `sim game` fixture line).
- **Invariants that must NOT move in 03-01 (stop and escalate if they do):** every event count (80, 84, 10, 95), per-duel `(outcome, winner)`, the gate counts per class, the duel stdout blocks and the perf total line `a=5411 b=2370 draw=2118 fled=101`. Only hash-bearing pins change, because state gains v3 fields; combat and reward logic are untouched.
- **Balance gates** are thresholds (G1 [0.70, 0.85], G2 >= 0.60, G3 <= 0.35), not exact counts. One engine-derived exact line (`sim game --n 20 --seed ci`) is pinned as the determinism golden.
- **Mismatch protocol:** replay per action with a throwaway script in `/tmp/usurpia-scratch/<plan>/` (import sources by absolute worktree path, run with `pnpm exec tsx` from the checkout root) so `git status --porcelain` stays clean; never commit scratch files.

## Worktree and merge-order rules (PRF-005, orchestrator-owned)
Executors never push, never use GitHub MCP, and never touch another worktree or (for worktree plans) `/home/user/Dokapon-kingdom-2`. The orchestrator runs the full pipeline on `dev`, pushes, and proves CI.
- **W1 (03-01 || 03-02):** create from `dev` in `/home/user/Dokapon-kingdom-2`: `git worktree add ../usurpia-wt/03-01 -b phase3/03-01 dev` and `git worktree add ../usurpia-wt/03-02 -b phase3/03-02 dev`; install in each (`cd /home/user/usurpia-wt/<plan> && (pnpm install --frozen-lockfile --offline || pnpm install --frozen-lockfile)`); dispatch both executors in parallel; each commits on its own branch `phase3/<plan>`, message `Phase 3 plan 03-0X: <plan name>` ending with the attribution trailer lines from the execution prompt; verify `git show --name-only --format= HEAD` contains no `.tsbuild/`, `dist/`, `node_modules/`.
- **W1 merge (in `dev`, main checkout):** `git merge --no-ff phase3/03-01`, then `git merge --no-ff phase3/03-02`. Files are disjoint. On any conflict: `git merge --abort`, stop, escalate. Then the full pipeline: `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`; push `dev` (retry network failures 4 times, 2/4/8/16 s); verify CI through GitHub MCP (`mcp__github__actions_list` then `actions_get` until the run for the pushed `head_sha` concludes `success`); remove worktrees (`git worktree remove ../usurpia-wt/<plan>`, `git branch -d phase3/<plan>`).
- **W2 (03-03 || 03-04):** same procedure, branches `phase3/03-03` and `phase3/03-04`, created from the post-W1 green, pushed `dev`. **Merge order: 03-03 then 03-04** (`git merge --no-ff phase3/03-03`, then `git merge --no-ff phase3/03-04`). The orchestrator then runs the full pipeline plus `pnpm vitest run packages/core/test/week-loop.test.ts` once more (03-04's week-loop test was written against the 03-01 `collectTax` stub using a prefix oracle and must also pass against 03-03's real tax), pushes, and proves CI.
- **W3 (03-05) and W4 (03-06):** single plans; run in the main checkout on `dev` (like Phase 2's sequential plans), commit on `dev` without pushing; the orchestrator pushes and proves CI after each. If the user prefers isolation, a worktree `/home/user/usurpia-wt/03-05` on branch `phase3/03-05` works identically.
- **Gate failure policy:** a red full pipeline on `dev` is escalated or re-dispatched as a fix plan, never pushed red. A plan that fails twice on complexity: stop and ask the user (PRF-006).

## Plan Structure
- **Plan 03-01 (Wave 1): Map, graph, v3 state.** `map.tiled.json` + Tiled schema + flatten + `Rules.map` + `tuning.board`; `board/graph.ts` + map invariants (each its own message) + TEST_MAP; v3 types, `createGame`, `serialize/` split, `RULES_VERSION 2`, `SCHEMA_VERSION 3`; deep clone; `WRONG_STEP`; action/event unions; stubs; re-pin all composite goldens. Agent `engineering-senior-developer`.
- **Plan 03-02 (Wave 1): Effects and decks.** `board/effects.ts` (closed vocabulary interpreter), `board/decks.ts` (seeded shuffle and draw), `content/src/schemas/effects.ts`. Agent `engineering-senior-developer`.
- **Plan 03-03 (Wave 2): Movement, landing, towns.** `board/{hooks,settle,landing,towns,turn}.ts`, `handlers/board.ts`, `beginCombat` extraction, spin/move/useItem/landing/shop, liberate/invest/seize, spoils, `turn/end`, HOOK_RANGES + summed clamps, bare `steal-item` re-pin. Agent `engineering-senior-developer`.
- **Plan 03-04 (Wave 2): Decrees, errands, gazette, week loop.** content data + schemas + `Rules` fields, `board/{gazette,signals,effect-world}.ts`, `handlers/week.ts`. Agent `engineering-senior-developer`.
- **Plan 03-05 (Wave 3): Victory, boss, awards, persona AI.** `board/victory.ts`, `handlers/boss.ts`, `ai/{persona,board,plan,difficulty}.ts`, hidden-information fuzz. Agents `engineering-ai-engineer` (+ `engineering-senior-developer` for Task 1).
- **Plan 03-06 (Wave 4): Sim game, health suite, tuning.** `pnpm sim game`, mixes, health suite and gates, exit codes 4/5, CLI nits, perf test, tuning to G1-G3. Agent `data-analytics-engineer`.

## Conventions for every plan
- Each plan owns its `03-0X-SUMMARY.md` (in `files_modified`). No plan edits `.planning/specs/`, `.planning/reference/`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/memory/`, or phases 01-02.
- **Pipeline** (every plan ends with it, run from the plan's worktree or `dev`): `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.
- **Negative tests (PIT-001):** each validation check gets its own test built from a known-valid fixture with exactly one mutation, asserting the exact `RejectCode` and message. The SUMMARY records a `## Mutation proof` table: temporarily delete or invert each check, confirm only its own test(s) fail, restore.
- **Id-keyed records (PIT-002):** every record keyed by player id, town id, node id, content id, decree/errand/gazette id is read with `Object.hasOwn`/`ownGet`; records are built with `Object.fromEntries`; test id pools include `toString`, `valueOf`, `hasOwnProperty` (players) and `toString`, `valueOf`, `constructor`, `__proto__` (raw content ids in actions and saves).
- **Import-cycle guard:** `board/*` may not import `ai/*`; `ai/*` may not import `board/*`, `handlers/*`, `reducer`, `serialize`, `game`, `replay`, `index`; `board/settle.ts` is a leaf called from `handlers/combat.ts` `endCombat` (no import back into handlers). Verify fresh-process imports with `pnpm exec tsx --input-type=module -e 'import "./packages/core/src/<entry>.ts"'`.
- **Verification lines** are deterministic and exit 0; negative greps use `...; test $? -eq 1`. Money, bp and counters are integers; no floats in state; no `Math.random`/`Date`; no eslint-disable comments in core.
- **Attribution:** commit messages end with the trailer lines given in the execution prompt.
