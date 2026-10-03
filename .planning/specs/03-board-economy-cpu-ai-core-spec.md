# Phase 3 Spec: Board, Economy & CPU AI Core

Status: DRAFT-FINAL (r3: plan critique folded in, 9 plans; see Revision History)
Inputs: ROADMAP Phase 3 (6 success criteria), PROJECT R10-R14, `2026-09-26-dokapon-spiritual-sequel-design.md`, Phase 2 spec + 02-REVIEW deferrals.
Architecture: Pragmatic (user-selected). Reference scratch: `.planning/reference/phase-03/gen-map.mjs` (frozen after 03-01a).

## 1. Overview

Phase 3 turns the Phase 2 combat engine into a playable board game: a ~75-space graph map, a spinner, movement with PvP interception, town liberation/investment/tax, weekly decrees, errands, a hidden gazette deck, a deadline victory with a placeholder boss, Royal Bonus Awards, and a CPU AI (persona x difficulty) with a `pnpm sim game` health suite that gates the balance.

Core stays pure and deterministic (no Date/Math.random, no zod/content imports). Tiled JSON is parsed in `content` and flattened to `Rules.map`; core never sees Tiled. Everything board-related is a new handler/partition on the Phase 2 reducer; combat is reused unchanged except through the extracted `beginCombat` and a settle hook.

Out of scope: Crown/Crown Tax/Crown hoard (Phase 5), Humiliation, field spells cast on rivals (Phase 5), real boss fight (Phase 4), Phoenix/pvp spells on board, client UI, multiplayer transport, LUCK spinner reroll, class switching by AI.

## 2. Requirements

| ID | Requirement |
|---|---|
| B1 | Map: 75 nodes, 135 edges, Tiled-authored, flattened `Rules.map {nodes,edges,towns,lair}`, invariants checked at build and in tests |
| B2 | Spinner d6 + modifiers; movement over self-avoiding paths; PvP interception; safe nodes |
| B3 | Landing rules for all 12 space types; warp pairs |
| B4 | Town economy: liberate (guardian fight), invest (to 3x), weekly 10% tax, seize |
| B5 | Weekly loop with exact ordering; 3/4/5-week games; deadline victory by assets |
| B6 | Decrees (10 authored, 9 eligible), errands (12 authored, 10 eligible), gazette (24) via one data-tagged effect interpreter and seeded decks |
| B7 | Lair unlock in final week; placeholder boss with persistent HP; Royal Bonus Awards; GameEnded tally |
| B8 | Board hooks (BOARD_HOOKS) become live with engine clamps (HOOK_RANGES + summed clamps) |
| B9 | CPU AI: persona weight vector x difficulty; PlayerView-only; own RNG; no hidden reads on Hard |
| B10 | `pnpm sim game` with mixes, health suite, gates G1-G3, exit codes 4/5 |
| B11 | Phase 2 review deferrals resolved (section 12) |
| B12 | Determinism: same seed + actions => byte-identical canonical state; replay v3 |

## 3. Architecture and Key Decisions

Files (core): `board/{graph,towns,effects,decks,victory,settle}.ts`, `handlers/{board,week,boss}.ts`, `ai/{persona,board,plan,difficulty}.ts`. Content: `data/{map.tiled.json,decrees.json,errands.json,gazette.json}` + `tuning.board`/`tuning.economy` keys + schemas. Sim: `game.ts`, `health.ts`, mix parser.

Decisions (rationale in brackets):

- D1 Tiled authored, flattened in content. [Designer-editable; core stays free of Tiled/zod.] Map committed in 03-01a from the frozen generator and is then the sole source of truth; invariants are ported to TS tests (`map-invariants.test.ts`) and run in `buildRules`.
- D2 SCHEMA_VERSION 3, all `v` fields 3, RULES_VERSION 2. v2 saves and v2 replay files are rejected with `SchemaVersionError` (message includes found version). [No persisted v2 saves exist; v2 lacks board data that cannot be reconstructed deterministically; fixtures regenerated.] No migrator.
- D3 `aiRng` is AI-driver state (`AiState`), NOT in GameState. [Matches Phase 2 OQ5d; AI is a client of PlayerView. Flagged to user in OQ1.] CPU RNG seed: `seed\0cpu\0<playerId>\0<persona>\0<difficulty>`.
- D4 Time structure: `turnsPerWeek` = 6 rounds. Pre-game `week 0, step "weekBreak"`; first system `week/advance` starts week 1. `turn/end` by last player of the last round runs week end and sets `step "weekBreak"`; `week/advance` does week start, or, when `week === weeksTotal`, ends the game.
- D5 New RejectCode `WRONG_STEP` (checked after actor, before validate) via handler field `steps`; Phase adds `"over"`. Precedence: version, type, shape, phase, actor, step, validate.
- D6 `public.step` in `spin | move | act | weekBreak`. Loadout handlers become active-player only, steps `spin|act`; `switchClass` only on the Castle node.
- D7 One effect interpreter (`board/effects.ts`) executes data-tagged effects for decrees, errands, gazette. Every effect returns an `EffectResult` listed in the owning event. No code paths per card.
- D8 Hidden decks: `hidden.decks = {gazette:{draw,discard}, decree:[], errand: Record<PlayerId,{draw,discard}>}`. Shuffles use `ctx` RNG (sfc32 in `hidden.rng`).
- D9 Weekly tax is paid at week start; Tax Season decree is redefined to "own a town of value >= X" with `X = 500*ceil((maxPlayerTownValue+300)/500)`, where `maxPlayerTownValue` is the value of the single most valuable owned town over all players at the moment the decree is REVEALED (0 with none; stored in `DecreeView.params.x`); completion (own a town of value >= X) is checked at week end.
- D10 Warp: design "Warp pairs 2" = 4 spaces; Empty reduced 6 -> 4 so total stays 75 (flagged OQ2; one warp pair, 2 spaces, would also satisfy the design count).
- D11 Boss shape `boss:{enabled,hp,unlocked}`; settings gain `weeks:3|4|5`, `boss:boolean`. Settings exact keys `v,seed,players,weeks,boss`.
- D12 `viewFor` and event payloads are deep-cloned (`cloneJson` in canonical.ts). Fallback: if the 03-06 perf gate fails, the sim driver builds the seat views from `state.public` and the seat's own `state.private` once per step (never `hidden`); the public `viewFor` stays cloning.
- D13 `steal-item` tag is bare (no itemId); victim learns via private BagUpdated. Re-pin the three goldens (resolve.test.ts:634, combat-golden row, sim/test/replay-file.test.ts:154).
- D14 Battle context `public.battle {kind:'monster'|'guardian'|'pvp', ...}` settled by leaf module `board/settle.ts` called from `endCombat`, avoiding import cycles. `beginCombat` is extracted from `combat/start` apply; `combat/start` with no battle context behaves as in Phase 2 (duel sim unchanged).
- D15 Interceptions/PvP: ends-on-rival triggers PvP (lowest seat first); pass-through allowed; co-occupation allowed; no pushback; KO'd players cannot be attacked.
- D16 Liberation is free of gold; the guardian fight is the cost. Guardians use `npcCurve[townTier]` (a tier-1 town's guardian has T2 stats; accepted, it is the design's difficulty step).
- D17 Assets = gold + items at `sellBp` (5000) of price (bag + scrolls + equipped gear; spells excluded) + town values + `bonus[p]`. Winner tie-break: assets, gold, town value, lowest seat.
- D18 Board hook clamps in two layers: per-hook `HOOK_RANGES` tightened, and clamps on the SUM across gear/items/passives (section 6.9).
- D19 AI: depth-limited lookahead is a distance-discounted 3-hop BFS potential over static node values (cheap), not a full game-tree search. Noise via softmax temperature, error via epsilon-random legal move.
- D20 Gate failure is never silently weakened: tuning procedure (section 7), max 6 iterations; bounded fallback (r3): if a gate is still red after 6 iterations the driver, the suite and the best data are committed with the gate reported red and a follow-up plan is opened, never a loosened bound.
- D21 `serialize.ts` is split per partition (`serialize/{public,private,hidden,settings}.ts` + index) as part of 03-01b since the state bump touches it.
- D22 Goldens: pure-function goldens computed in-spec; composite goldens pinned at each plan's closing step from the TS engine (PRF-004). Phase 2 oracle stays frozen. Single-pin policy (r3): tests derive `rulesHash(loadRules())` and the `rules=` replay tokens; the only literal pins are `rulesHash(TEST_RULES)` and the `rulesHash` field of `packages/sim/fixtures/combat-game.json`.
- D23 Reducer order (r3, H2): `reduce` runs apply, then commits `ctx.rng` into `hidden.rng`, then `applySignals(prev, next, events, rules)`; `endGame(state, ctx, rules, events)` takes the handler `ctx` and draws only through `ctx.int`, so the RNG it consumes is committed. Owned by 03-01b with a reduce-level test.
- D24 Boss attempts (r3): one `boss/enter` per turn through public `bossAttempted` (reset by `startTurn`); the sim reports an informational `bossKillBp`.

## 4. State, Action, Event Contracts

### 4.1 State (v3)

```ts
type Step = 'spin'|'move'|'act'|'weekBreak';
type Phase = 'turn'|'decision'|'over';   // + existing; no 'combat' member (combat is phase 'decision' with a pending exchange)

PublicState += {
  week: number;                 // 0 before first advance
  weeksTotal: 3|4|5;
  turnsPerWeek: 6;
  round: number;                // 1..6 within week
  step: Step;
  spin: null | { steps: number; mods: string[]; max: number };   // set at spin, cleared at end of move
  turnTowns: string[];          // townIds eligible for invest this turn
  positions: Record<PlayerId, NodeId>;
  towns: Record<TownId, { owner: PlayerId|null; value: number; liberatedWeek: number|null }>;
  decree: { current: DecreeView|null; used: string[] };
  gazette: { last: GazetteView|null; shopsClosedUntil: number; taxHoliday: boolean };
  buffs: Record<PlayerId, Buff[]>;           // max 4
  weekly: Record<PlayerId, Counters>;        // reset at week start
  totals: Record<PlayerId, Counters>;
  bonus: Record<PlayerId, number>;           // awards + boss bonus
  boss: { enabled: boolean; hp: number; unlocked: boolean };
  bossAttempted: boolean;       // one boss attempt per turn: reset by startTurn, set by boss/enter
  spoils: null | { winner: PlayerId; loser: PlayerId };
  battle: null | BattleCtx;
  result: null | { winner: PlayerId; tally: Tally; awards: Award[] };
};
PrivateState[p] += { errand: ErrandView|null; rerollUsed: boolean };
HiddenState += { decks: Decks };
```

Counters: `monstersSlain, goldEarned, steps, invested, stolen, pvpWins, liberations, townsHeld, itemsFound, errandsDone`. All integers, exact keys.

All id-keyed records (`towns`, `positions`, `decks.errand`, decree/errand/gazette tables) are read with `ownGet`/`Object.hasOwn` (PIT-002); id pools in tests include `toString`, `valueOf`, `hasOwnProperty`.

### 4.2 Actions

| Type | Actor | Phase/Step | Payload |
|---|---|---|---|
| `board/spin` | active | turn / spin | `{item: 'swift-boots'|'lead-boots'|'pathfinder'|null, pick: 1..6|null}` |
| `board/move` | active | turn / move | `{path: NodeId[]}` (excluding start) |
| `board/useItem` | active | turn / spin,act | `{itemId: 'homing-stone'|'coin-purse-lock'}` |
| `town/liberate` | active | turn / act | `{townId}` |
| `town/invest` | active | turn / act | `{townId, amount}` |
| `town/seize` | active | turn / act | `{townId}` (requires open spoils) |
| `shop/buy` `shop/sell` | active | turn / act | `{kind: 'gear'|'item'|'spell', id}` |
| `errand/reroll` | active | turn / act, at Castle | `{}` |
| `boss/enter` | active | turn / act, at Lair, unlocked | `{}` |
| `turn/end` | active | turn / act | `{}` |
| `week/advance` | system | turn / weekBreak | `{}` |

Spin: `item` must be owned and matches modifier: swift-boots +3 (max 9 steps), lead-boots fixed 1, pathfinder requires `pick` 1-6 (else `pick` must be null). Base roll `nextInt(1,6)` uniform from `hidden.rng`; spin modifiers from buffs (`spinMod`) added, clamp to [1, `tuning.board.maxSteps`=9]. Rolled value is public (`Spun{playerId, roll, steps, item}`). `homing-stone` (spin step) teleports to the Castle node (the design's "warp to the Castle", OQ5; content tag `warpCastle`), is rejected when the player is already at the Castle, and consumes the turn's move (step -> act); `lead-boots` description reads "Your next spin is fixed at 1."; `coin-purse-lock` sets a protection flag consumed by the next steal against this player.

### 4.3 Move validation

A path is valid iff all hold (each a distinct, individually negative-testable check, PIT-001):
1. M1 adjacent chain starting at the player's node (edges symmetric; Tiled `oneWay` rejected at build).
2. M2 self-avoiding (no repeated node, including start).
3. M3 length exactly `spin.steps`, OR length < steps and the path is a maximal dead end (no unvisited neighbour of the last node).
4. M4 early stop (length < steps, not dead end) is allowed only if the final node is rival-occupied and not safe (intercept).
5. M5 no node in path is the Lair unless boss unlocked (otherwise it behaves as an empty node; see 6.7).
Canonical path used by AI/tests: lexicographically smallest by node index. Pass-through of rivals is allowed; passing a rival fires `passPickpocketBp` (6.9) for thief-gear owners. Safe nodes: castle, temple (PvP never triggers there; a move ending there simply lands).

### 4.4 Landing rules

Battle: compulsory; monster from node zone table (weights from `tuning.board.zones[zone].monsters`; wanted-poster x3; in final week senior-tier monster from zone+1 capped at 4). Interactive stops: shop, town, castle, lair. Auto-resolve: gold, item, loot, event, temple, warp, empty, shrine. Landing sequence: warp teleport -> PvP check -> space effect.
- Gold: tier table `tuning.board.gold = [30,60,100,160]` +- 25% via `ctx.int`.
- Item: weighted draw from `tuning.board.itemTable[tier]`; if bag full, converted to gold at sell value.
- Loot: gear/spell drawn from tier table; auto-equipped only if tier higher than current, else gold at sellBp; `lootLuckBp` shifts weights toward higher entries.
- Event: draws top eligible gazette card.
- Temple: full heal. Shrine: grants `tuning.board.shrineMasteryWins` mastery wins (int 0..2, shipped 0: flavor only until the Phase 5 Summon feature; a documented tuning knob, default OFF). Empty: nothing. Warp: teleport to partner (arrival does not re-warp).
- Castle: enables switchClass, errand reroll, entry for shop-like loadout actions.

### 4.5 PvP and spoils

Move ending on a rival (not safe, not KO'd) opens `combat/start` with `battle.kind='pvp'`. Attacker win: spoils window `{winner, loser}`; `town/seize` allowed while open; `turn/end` with an open window auto-steals 10% of loser's gold (absolute cap `tuning.board.stealCapGold` = 400 gold per steal, replacing the undefined `stealCapBp`; honors coin-purse-lock). Defender win: immediate default gold steal for the defender. Attacker KO or draw: no spoils. Monster/guardian KO: move to nearest temple (BFS, lowest index tie-break), lose `koGoldLossBp` (1000) of gold to the bank. TurnStarted revives a KO'd player (hp = 50% max) and applies turnRegen.

### 4.6 Towns

- Liberate: guardian fight (`battle.kind='guardian'`); win => `owner=player`, `value=base`; counters `liberations++`.
- Invest: `town/invest` allowed for owned-by-me towns in `public.turnTowns` (the town at the start node plus towns on the path); `amount` integer >= 1, value + amount <= 3 x base; gold deducted 1:1 into value.
- Tax: week start, owner receives `floor(value * rateBp / 10000)` where rate bp = clamp(1000 + sumHook(townTaxBp), 0, 1500) applied to value; paid from the bank (not from rivals).
- Seize: during spoils window the winner takes ownership of one rival-owned town; value kept (invested value stays).
- Slime/housing effects clamp value to [base/2, 3 x base].
- Worked example (golden G-T1): base 800, value 800, townTaxBp 500 => rate 1500 bp (clamp ok) => tax 120. Base 800, invest 1600 => value 2400 = 3x; further invest rejected.

### 4.7 Week loop (exact order)

Week start (`week/advance`, not final): (1) tax unless `taxHoliday`; (2) Phase 5 crown-check stub (no-op, documented); (3) boss unlock if `week === weeksTotal` and enabled; (4) reset weekly counters, `rerollUsed=false`; (5) decree reveal (`DecreeRevealed`); (6) errand assignment (`ErrandAssigned`, private); (7) `TurnStarted` for seat 0 with revive/regen.
Week end (last `turn/end` of round 6): decree evaluation (success: first completer, 1500 G + rare item; expiry: disappointment tax 5% of leader assets capped at gold, split among others); errand expiry; `WeekEnded{assets per player}`; `step = weekBreak`.
Final advance: `week === weeksTotal` => `GameEnded`.

### 4.8 Decrees, errands, gazette

Decree pool (10): liberate-town, wanted-poster, royal-delivery, tax-season, monster-census, crown-hunt, treasure-survey, invest-in-usurpia, duel-of-honor, royal-portrait. `crown-hunt` eligible=false in Phase 3 (needs Crown) => 9 usable. royal-portrait evaluates only at week end. `DecreeDef.minWeek` (int 1..5): `invest-in-usurpia` and `royal-portrait` are `minWeek 2` (a 600 G investment or an 800 G hoard is not a fair week-1 race); the decree draw skips decrees whose `minWeek` exceeds the current week (local skip-and-reshuffle in `handlers/week.ts`). One decree per week, no repeat until pool exhausted. Reward 1500 G + rare item table; bag full => gold at sell value.

Errand pool (12, ~10 eligible): kill N monsters in a zone, earn G, invest, liberate, win PvP, visit shop/temple/shrine, walk N steps, hold gold, etc. Two ("cast a field spell on a rival", "humiliate a rival") ineligible until Phase 5. Reward via effects: ~500 G, a consumable/scroll, or +1 mastery win. Per-player `errand` deck; one reroll per week at Castle for a fee (`tuning.board.rerollFee`=100); reroll resets progress. Progress is an event-derived fold (`signalsFromEvents`), never ad-hoc counters.

Gazette (24): 14 mild (g01-g14), 7 board-wide (g15-g21), 3 wild (g22 royal-parade, g23 market-crash, g24 royal audit: transfer 20% of the leader's gold to the lowest-assets player). Wild not in week 1 (skipped, kept in draw order). Reshuffle discards when no eligible card remains.
Mild: lost-wallet +300; wallet-not-returned -10% (to bank); ballad +20% ATK x2 battles; mean ballad -20% DEF x2; free-cake heal 50%; stubbed-toe -25% hp (min 1); favorable winds +2 spin; headwinds -2 spin; shiny pebble item; free lecture +60 XP; parking fine -100; retired hero +1 mastery win; doppelganger swap; lost-in-fog warp to random empty.
Board-wide: tax-holiday; goblin-union (shops closed 1 round via `shopsClosedUntil`); housing-boom +20% to a random owned town; slime infestation -15%; royal-giveaway lowest +1000; bake-sale +100 each; royal marathon all +2 spin.

Effect vocabulary (closed set; unknown tag rejected at build): `gold, loseGold, loseGoldBp, goldBpAll, item, battleBuff, townValueBp, taxHoliday, shopsClosed, warpAll, warpTo, swapPositions, spinMod, healBp, damageBp, xp, masteryWin, transferBp`.

### 4.9 Board hooks and clamps

Per-hook `HOOK_RANGES` (tightened): pvpExtraSteal [0,3], passPickpocketBp [0,2000], spellPriceBp [-5000,5000], fieldSpellMove [0,1], turnRegenBp [0,3000], townTaxBp [0,1000], crownTaxResistBp [0,BP] (unchanged), lootLuckBp [0,3000]. Engine clamps on the SUM: townTaxBp [0,1500], passPickpocketBp [0,2000], turnRegenBp [0,3000], spellPriceBp [-5000,5000], lootLuckBp [0,3000], pvpExtraSteal [0,3], fieldSpellMove [0,1]. Semantics: townTaxBp absolute add to rate; pickpocket applies to rivals passed in the path interior (steals `passPickpocketBp` of the rival's gold, capped); spellPriceBp scales shop spell prices; turnRegenBp heals at TurnStarted. `pvpExtraSteal`, `fieldSpellMove`, `crownTaxResistBp` are accepted, clamped, and still inert (Phase 5).

### 4.10 Victory, boss, awards

- Boss: unlocked in the final week if `boss.enabled`. `boss/enter` at the Lair: damage = `ctx.int(0.8x,1.2x)` of `atk*3 + mag`; recoil 50% of max hp to the player; KO => temple. Boss hp 600 persists across attempts, one attempt per turn (`public.bossAttempted`, validation `already attempted the boss this turn`). A killing blow adds `max(3000, 25% of leader assets)` to `bonus`; the game ends at that turn's `turn/end`. Disabled boss: Lair acts as Empty. The sim reports an informational `bossKillBp` (not gated, not tuned).
- Killing blow: `bonus[p] += max(3000, 25% of leader assets)`; game ends at that turn's `turn/end` when `boss.hp === 0`.
- Deadline: after final week's turns, `week/advance` ends the game.
- Awards: pool 6 (Most Monsters Slain, Most Humiliated [Phase 5], Best Investor, Biggest Thief, Crown Survivor [Phase 5], Most Steps Walked); only those with max counter > 0 are eligible; draw 3 distinct via ctx; each winner +1000 to `bonus`; ties to lowest assets then seat.
- `GameEnded{tally, awards}`; `result` set; phase `over`; all actions then `WRONG_PHASE`.

### 4.11 Events

`Spun, Moved, TownChanged, TaxCollected, DecreeRevealed, ErrandAssigned (private), GazetteDrawn, ErrandDone, WeekEnded, BossUnlocked, BossDamaged, GameEnded`, each carrying `EffectResult[]` where applicable. Private events are filtered by `viewFor`. Events are deep-cloned.

## 5. Map

Authoring: `content/data/map.tiled.json`: object layer `nodes` (point objects `n01..n75`, properties space, zone, tier, town, baseValue, guardian, warp), object layer `edges` (polylines with `from`,`to`). Parsed by zod in build-rules -> `Rules.map {nodes:[{id,space,zone,tier,x,y}], edges:[[a,b]], towns:{id:{node,base,guardian}}, lair}`.

Generator measured stats (committed seed): 75 nodes, 135 edges, avg degree 3.6, diameter 11, lair castle distance 7, mean castle-distance by tier [1.71, 3.67, 4.45, 5.64] (strictly increasing).
Space counts: battle 22, item 6, loot 4, gold 6 (item/loot/gold = 16), town 10, event 8, empty 4, shop 4, temple 3, shrine 2, warp 4, castle 1, lair 1. Zones: forest 15 (incl castle), coast 18, mines 20, bog 22 (incl lair).

Invariants (each a separate build error message): 60-90 nodes; no duplicates/self-loops; one castle, one lair; connected; exact counts per type; degree >= 2 (<= 5; castle <= 6); zone sizes; tier == zone tier; unique town ids with base; towns pairwise distance >= 2; warps mutual and >= 6 apart; lair distance from castle >= 7; castle in forest; mean castle distance increasing with tier; every node within 7 of a temple.

Towns (base): thistledown 500, mudwick 600, brinewick 700, gullhaven 800, soggyton 900, slagpit 1000, gildhollow 1100, pickaxe-rest 1200, ledgerfen 1300, fogbottom 1500. Guardians cycle [landlord-lich, tollbridge-troll, knight-of-foreclosure]. Warp pairs: forest-mines, coast-bog.

TEST_MAP: a 12-node fixture in TEST_RULES with reachable-set goldens (computed with `npx tsx` at 03-01a close) and a shuffle golden for the deck module.

## 6. AI

Router: `decideBoard(view, rules, aiState)` handles spin item, move path, town actions, shop, errand reroll, boss/enter, turn/end; `decideCombat` unchanged. Inputs are PlayerView + Rules only; `ai/` imports respect lint boundaries (no reducer/handlers/GameState/HiddenState/Math.exp).

Scoring terms (integer weights per persona): gold gain, invest potential, liberate EV, decree/errand progress, PvP EV, risk, xp, shop need, temple heal need, castle needs, passing towns, leader proximity. Personas: Tycoon (invest/towns), Menace (PvP), Adventurer (monsters/xp), Opportunist (decree/errand, leader chasing). Rival assets are estimated from public data (gold + towns + bonus + gear + bag count x assumed item value).

Difficulty: Easy depth 0, tau ~1.0, error ~30%; Normal depth 2, tau ~0.35, error ~8%; Hard depth 3, tau ~0.05, error 0. Hard never reads hidden info; fuzz test: identical decisions across states differing only in hidden fields or other players' private data.
Budget: ~100-150 ms per game; CI perf test n=50 under 30 s (wall-clock bound documented as soft; the assertion is relative to a calibration loop to avoid flakiness).

## 7. Sim

`pnpm sim game [--n N --seed S --players P --weeks W --mix SPEC --suite health --json --boss --max-actions M --replay-out F --game I]`. `--n` capped at 100000. Mix grammar `persona[:difficulty],...` or presets; seat assignment rotates by game index. Report via `stableStringify`.

Health suite: personas at Normal (G1 decree rate, G3), personas at Easy and Hard (G3), Hard vs Normal (hard,hard,normal,normal) with independent persona/difficulty rotation (G2): seat `s` of game `g` plays persona `P[(s+g)%4]` and difficulty `D[(s+floor(g/4))%4]`, `D = hard,hard,normal,normal`, so every persona plays Hard in half of the games. G1 is measured on the personas at Normal only. The full-N gate runs through the CLI (`pnpm sim game --suite health`), never in the default `pnpm test`; the default run keeps only an n=20 invariant smoke. `--weeks` accepts 3, 4 or 5.
Gates: G1 decree completion rate in [0.70,0.85]; G2 Hard seats win >= 60% of games; G3 no persona > 35% wins at each difficulty. Asserted invariants: all games terminate, 0 rejected AI actions, deserialize round-trip on sampled games. Informational: game length, asset variance, comeback rate, pvpPerPlayerWeek (target 2-3, not gated).
Exit codes: 0 ok, 1 invalid content, 2 usage, 3 replay rules mismatch, 4 gate failure, 5 engine invariant/non-termination.

Tuning procedure (D20): ordered knobs (decree reward/requirements, gold tables, persona weights, `DIFFICULTY_BOARD` tau/error, tax rate `board.taxBaseBp`), max 6 iterations, each recorded in the 03-06 SUMMARY; the only AI-side knobs are the `DIFFICULTY_BOARD` constants (hard tauMilli 20..100 with errorBp 0, normal tauMilli 250..600 with errorBp 500..1500; depths are fixed, a depth change needs a 03-05b fix plan) and the integer persona weights. 03-05b retires the G2 risk early: a pre-check of 100 games on shipped rules must show a Hard share >= 55% (up to 3 recorded adjustments). If a gate is still red after 6 iterations, the best data is committed with the gate reported red and a follow-up plan is opened (bounded fallback). If Phase 2 content tuning is needed, re-pin Phase 2 goldens (frozen oracle not re-run).

## 8. Compatibility

- v2 saves/replays rejected (D2). Phase 2 duel sim keeps working through `combat/start` with no battle context; its goldens are unchanged except the D13 re-pins.
- Content: `REQUIRED_FILES`/`CONTENT_REGISTRY` extended; `shipped.ts` bundles new JSON; `buildRules` adds unique-message cross-ref checks (towns<->guardians, items in tables, effect tags, decree/errand ids).
- Existing board-hook items in content (thief, mage, cleric, tax-collectors-seal, crown-ward-amulet) validated against the new ranges.

## 9. Failure Modes

| Failure | Handling |
|---|---|
| Invalid path | `INVALID_PAYLOAD`, state unchanged |
| Action in wrong step | `WRONG_STEP` |
| Seize without spoils | `STALE_DECISION`-class validate reject (INVALID_PAYLOAD) |
| Gate failure | exit 4, report lists failing gate, tuning procedure |
| Non-termination / rejected AI action | exit 5 |
| Bag full on reward | converted to gold |
| No eligible gazette card | reshuffle discard; if still none, skip draw |
| v2 save | `SchemaVersionError` |

## 10. Acceptance Checks

1. `pnpm -r build lint test` green.
2. Map invariants pass in build and tests; mutate-one-invariant negative tests each fail with their own unique message.
3. `board/spin` determinism: same seed same roll sequence (golden computed in-spec at 03-03a).
4. Move validity: one negative test per M1-M5, each killable by exactly one check (PIT-001).
5. Tax golden G-T1; invest cap negative test.
6. Week loop order test using event sequence assertions.
7. Hook clamps: values at boundary and boundary+1 for every hook range and summed clamp.
8. Effect interpreter: one test per tag; unknown tag rejected at build.
9. Awards: tie-breaks, ineligible zeros.
10. ai-hidden fuzz test extended; Hard decisions identical across hidden mutations.
11. `pnpm sim game --suite health` meets G1-G3, exit 0 (a documented `Partial` with the gate reported red is the bounded fallback).
12. Serialize round-trip with exact-key deserialize (extra/missing key negative tests per partition).
13. viewFor deep clone: mutating a view never mutates state.
14. Prototype-key pool test (`toString`, `valueOf`, `hasOwnProperty`) for every id-keyed record.
15. Reducer order: a reduce-level test proves the RNG consumed by `endGame` and by `applySignals` is committed (D23).
16. ROADMAP criterion 5: `pnpm sim game --n 1000 --players 4 --seed roadmap --json` exits 0 with `terminated` 1000 and `actions` and `assetVarianceMilli` present.
17. G2 pre-check (03-05b): Hard share >= 55% over 100 games on shipped rules, or the plan ends `Partial` with the table.
18. One boss attempt per turn: a second `boss/enter` in the same turn is rejected and the next turn allows it again.

## 11. Deliverables and Plans (9 plans, <= 3 tasks each, 6 waves)

| Wave | Plan | Agent | Scope |
|---|---|---|---|
| W1 | 03-01a | engineering-senior-developer | Map content + Tiled schema/flatten + graph.ts + map invariants + tuning tables + TEST_MAP + RULES_VERSION 2 + single-pin hash policy |
| W1 | 03-02 | engineering-senior-developer | effects.ts interpreter + decks.ts + effect schemas |
| W2 | 03-01b | engineering-senior-developer | v3 state types + serialize split + SCHEMA bump + deep clone + WRONG_STEP + reducer RNG commit order + lettered stubs + test/sim/client/fixture migration + golden re-pin |
| W3 | 03-03a | engineering-senior-developer | hooks/clamps + towns helpers/tax + turn start + spin/move/useItem + stealGold + beginCombat extraction |
| W3 | 03-04 | engineering-senior-developer | decrees/errands/gazette content + effect adapter + signals + week handlers |
| W4 | 03-03b | engineering-senior-developer | landing + shops + settle/PvP + town handlers + turn/end + steal-item re-pin |
| W5 | 03-05a | engineering-senior-developer | victory/boss/awards/tally + root exports + effect-tag parity test |
| W5 | 03-05b | engineering-ai-engineer | persona AI (persona.ts, board.ts, plan.ts, difficulty.ts) + smoke games + scoring decision + G2 pre-check |
| W6 | 03-06 | data-analytics-engineer | sim game + health suite + tuning to gates + CLI nits + perf test |

Parallel waves run in separate git worktrees (PRF-005); W2, W4 and W6 run alone on `dev`; all agents on Sonnet (PRF-006). Merge orders: W1 03-01a then 03-02; W3 03-03a then 03-04 (then the week-loop and signals tests once more); W5 03-05a then 03-05b. Same-wave plans touch disjoint files; `sim/test/replay-file.test.ts` and `sim/fixtures/combat-game.json` are edited additively in different waves only.

## 12. Review Deferrals Resolved

Board hook clamps (D18); view cloning (D12); v2 migration rejected (D2); steal-item tag (D13); CLI nits (nonexistent `USURPIA_CONTENT_DIR` friendly error exit 1; duel parses flags before loading content; `--n` capped; perf test relative bound); serialize split (D21); lint guard added forbidding `node:*` imports in content browser entries.

## 13. Path Validation

All new files under existing package roots; `.planning/reference/phase-03/gen-map.mjs` is the only scratch artifact. Core imports verified against eslint boundaries (board/ may not import ai/; ai/ may not import board/ internals beyond types in `types.ts`).

## 14. Open Questions

Blocking: none.
Non-blocking:
1. OQ1 aiRng as AI-driver state, not GameState (default: driver state, per Phase 2 OQ5d).
2. OQ2 Empty 6 -> 4 to fit warp pairs (default: as specified). Note: one warp pair (2 spaces) would also satisfy the design count ("Warp gates (pairs) 2" with Empty 6 already sums to 75).
3. OQ3 LUCK spinner reroll (default: omitted).
4. OQ4 PvP spoils is a minimal placeholder: 10% gold steal or town seize; richer spoils in Phase 5 (default: as specified).
5. OQ5 `homing-stone`: the design says "Warp to the Castle", the r2 spec said nearest unliberated town. Default (r3): keep the design's Castle warp (class switching and the errand reroll need the Castle; a town warp is dead late in the game), tag stays `warpCastle`, rejected when already at the Castle.
6. OQ6 Shrine mastery: default OFF (`shrineMasteryWins` 0), a tuning knob 0..2 until the Phase 5 Summon feature.

## 15. Complexity Assessment

Complex. ~45 new/changed core files, 6 waves, 9 plans, 2 cross-cutting version bumps, new reducer step precedence, and a statistical balance gate that may need iteration. Risk: HIGH on gate tuning (G2 Hard>=60% depends on the lookahead producing a real edge) and on state-size/perf after deep-cloning; MEDIUM on determinism across the new hidden decks; LOW on map (generator verified: invariants pass, output deterministic, md5 stable). Competing proposals recommended at 03-05b (AI scoring) and 03-06 (tuning knob order). G2 is pre-checked in 03-05b and tuned in 03-06 through the `DIFFICULTY_BOARD` constants only.

## 16. Design Deviations (r3)

Where the authored Phase 3 content differs from the design document. Phase 7's "all MVP design content" check reads this table.

| Item | Design document | Phase 3 (plan) | Reason |
|---|---|---|---|
| Market Crash (g23) | all gold -15% | `goldBpAll -1500` (-15%, matches the design) | r2 plan had -1000; corrected |
| Royal Portrait decree | gold >= Y at the Castle at week end | `gold >= 800` at week end, no Castle condition; `minWeek 2` | no event-derived "at Castle at week end" metric in Phase 3; deviation kept |
| Royal Delivery decree | bring an item to the Castle | `castleVisits 2` | no item-delivery signal in Phase 3 |
| Treasure Survey decree | visit a far space | `itemsFound 3` | no far-space metric in Phase 3 |
| Monster Census decree | slay 3 monsters | slay 4 | pacing against the 6-round week |
| Errands | design list (use consumables, sell items, strikes-only, warp gate, pass 3 towns, land on Gold, ...) | 12 plan errands (forest/coast/mines cull, prospector, patron, liberator, brawler, shopper, pilgrim, marathon, field-prankster and humiliator ineligible): 8 of 12 differ from the design list | signals available from the Phase 3 event fold |
| `homing-stone` | warp to the Castle | warp to the Castle (r2 spec change reverted, OQ5) | matches the design |
| `stealCapBp` | none | `stealCapGold` 400 absolute | snowball brake; the bp cap never bound |
| Shrine | flavor (Summon hotspot) | `shrineMasteryWins` knob, default 0 | OQ6 |
| Boss | placeholder boss | one attempt per turn, `bossKillBp` informational | uncalibrated boss, bounded exposure |
| Warp pairs | 2 pairs | 4 warp spaces, Empty 4 | OQ2 |
| Decree timing | n/a | `invest-in-usurpia` and `royal-portrait` `minWeek 2` | week-1 feasibility |

## 17. Revision History

- r1: initial draft.
- r2: critique folded: added WRONG_STEP precedence, Tax Season redefinition, summed hook clamps, effect vocabulary closure, gate-failure policy, duplicate-key tests, generator mix rebalanced (battle [3,4,7,8]) and lair distance invariant relaxed to >= 7 to match the 5-ring layout.
- r3: plan critique folded (REWORK verdict): 6 plans split into 9 (03-01a/b, 03-03a/b, 03-05a/b) in 6 waves; single-pin hash policy; reducer RNG commit order and `endGame(state, ctx, rules, events)`; exit codes per section 7 with `--weeks` 3|4|5; G2 pre-check in 03-05b, `DIFFICULTY_BOARD` bounds and bounded fallback in 03-06, independent persona/difficulty rotation, G1 on Normal only, health gate CLI-only; boss one attempt per turn plus informational `bossKillBp`; `DecreeDef.minWeek`; Tax Season X timing text (D9); `stealCapGold`, `shrineMasteryWins` knob, homing-stone Castle warp (OQ5, OQ6), OQ2 note; Design Deviations table (section 16).
