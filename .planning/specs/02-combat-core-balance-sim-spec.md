# Spec: Phase 2 — Combat Core & Balance Sim

## Overview
Phase 2 turns the Phase 1 kernel into a real game engine for **combat, classes, progression, items/spells and monsters**, and proves balance headlessly with a **duel simulator** and a **combat CPU**:
- **Kernel v2** (`packages/core`): `reduce(state, action, rules)` with data-only `Rules`, a generic multi-player `PendingDecision` with per-player options/defaults, schema v2 state (characters, loadouts, combat, public choice history), and the Phase 1 sample module deleted.
- **Combat engine** (`core/src/combat/*`, `core/src/handlers/combat.ts`): asymmetric Attack/Strike/Spell vs Guard/Counter/Ward, SPD initiative with a LUCK tie roll, up to 3 rounds, flee, items, battle/ward spells, statuses, integer-only damage math, monsters/guardians/Crown Enforcer as non-player combatants whose commands are drawn inside `reduce`.
- **Progression + inventory** (`core/src/progression.ts`, `core/src/inventory.ts`, `core/src/handlers/loadout.ts`): XP/levels, class mastery ranks 1–5 with data-tagged passives, hybrid unlock, portable rank-5 passive, class switching with explicit overflow discards, bag/scroll/gear/spell limits.
- **Content** (`packages/content`): six zod-validated data files → `buildRules()` → `Rules`, with 6 classes, 15 gear, 17 items (12 consumables + 5 joke items), 8 battle + 4 ward + 8 field spells, and **20 NPC definitions = 16 zone monsters (4 per zone/tier) + 4 special NPCs (3 town guardians + the Crown Enforcer)** — this is how the roadmap's "~20 monsters" is satisfied. **All numbers in this spec are initial tuning** for the sim to refine (Revision 2 retuned them so the Hard-vs-Easy gate passes with margin).
- **CPU AI** (`core/src/ai/*`, exported as `@usurpia/core/ai`): Easy/Normal/Hard combat policies reading only `PlayerView` + `Rules`, with their own seeded RNG outside `reduce`.
- **Balance sim** (`packages/sim`): `pnpm sim duel` runs thousands of duels through `reduce` and reports class×class and class×monster win rates; `pnpm sim replay` replays v2 files and checks a `rulesHash`.

Architecture direction (user-selected, 2026-09-29): **Hybrid: Pragmatic-based**, with the forward-compat decisions from Phase 1 Open Question 5 bound as written in *Key Decisions*. Every golden value below was computed by the **reference implementation committed at `.planning/reference/phase-02/`** (the *golden oracle*, see *Golden oracle and traces*); `node .planning/reference/phase-02/verify-spec.mjs` re-derives every golden from this spec's own tables and action blocks and must report 0 failures. An implementation that disagrees with a golden value is wrong unless a Revision History row says otherwise.

## Requirements
| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| R5 | Six stats; 4 base classes; level + per-class mastery ranks 1–5 with passives; hybrid unlock at rank 3 in two classes (Spellblade, Shadowpriest) | Must | `stats.test.ts`, `progression.test.ts`, `rewards.test.ts`: sheet-stat goldens; rank thresholds `[0,3,7,12,18]` wins; passives of ranks ≤ current rank active; hybrid unlock exactly when both parents reach rank 3; portable rank-5 passive active only outside its own class; content `data.test.ts` pins every class and passive |
| R6 | Asymmetric combat: attacker Attack/Strike/Spell vs defender Guard/Counter/Ward via the resolution matrix, SPD initiative, ≤ 3 rounds, flee; the Ward command works with the equipped Ward Spell (no ward spell → Spell×Ward uses the Guard multiplier) | Must | `resolve.test.ts` pins **every matrix cell** (incl. Strike×Counter reflection, failed Counter = Attack×Counter 1.25×, and Spell×Ward without a ward spell = Guard multiplier) against the golden table; `combat-flow.test.ts` pins the state machine; `combat-golden.test.ts` pins the combat golden replay (hash `ec0c3508`) and its exchange table |
| R7 | Gear (Weapon/Shield/Accessory), Battle + Ward spell slot, ≤ 3 field-spell scrolls, class-sized bag, ~12 consumables, ~15 gear, 8 battle, 4 ward, 8 field spells | Must | `inventory.test.ts` / `loadout.test.ts`: slot/kind checks, bag capacity, 3-scroll cap, class-switch overflow requires an exact `discard` list; content counts pinned in `data.test.ts` |
| R8 | ~20 "monsters with day jobs" across 4 tiers, 3 guardian archetypes, the Crown Enforcer, weighted command tables | Must | Content ships 16 monsters (4 per tier) + 3 guardians + 1 enforcer = 20 NPC definitions, plus data-only Senior variants (tier + 1); `npc.test.ts` pins tier-curve stats; command draws are seeded and pinned |
| R9 | Headless balance simulator CLI reporting win rates (game length/assets arrive in Phase 3) | Must | `perf.test.ts` runs `pnpm sim duel --n 10000 --seed perf`: exit 0, ≤ 60 s wall, both sections, pinned `total` line; `gate.test.ts`: in **every** class mirror of the gate, Hard wins ≥ 70% of **decisive** duels **and** the draw rate is ≤ 40%, with the exact pinned counts |

## Architecture
```
packages/
├─ core/src/
│  ├─ types.ts            GameState v2, settings, views' building blocks, SCHEMA_VERSION = 2, MAX_COUNTER, MAX_STAT
│  ├─ rules.ts            Rules type tree (data only), CONTENT_ID_PATTERN, rulesHash(), masteryRank(), levelForXp()
│  ├─ actions.ts          Action union v2 + ACTION_TYPES
│  ├─ events.ts           GameEvent union v2, PUBLIC, onlyPlayers()
│  ├─ reducer.ts          reduce(state, action, rules), isAction(); precedence unchanged from Phase 1
│  ├─ handlers/
│  │  ├─ index.ts         assembles the exhaustive handler map (satisfies HandlerMap)
│  │  ├─ shared.ts        Ctx, Handler, guards (hasExactKeys, isChoiceToken…), reject(), overflow()
│  │  ├─ decision.ts      decision/open (poll), decision/commit, timeout, openDecision(), revealDecision() + resolver dispatch
│  │  ├─ combat.ts        combat/start, combat/exchange resolver, exchange loop, round end, endCombat
│  │  ├─ system.ts        system/setCharacter (scenario/debug setup, system actor only)
│  │  └─ loadout.ts       system/grant, loadout/switchClass|discard|useItem|setPortable
│  ├─ combat/
│  │  ├─ passives.ts      applyPassives(hooks) → HookTotals (the single hook switch)
│  │  ├─ stats.ts         activeHooks, sheetStats, npcDef, npcStats, battleStats, adjustHp (pure, no GameState)
│  │  ├─ options.ts       attackerOptions, DEFENDER_OPTIONS, requiredFor (pure)
│  │  └─ resolve.ts       snapshots, computeCell, critChanceBp, fleeChanceBp, drawNpcCommand, resolveExchange (pure; injected draw)
│  ├─ progression.ts      applyXp, awardVictory, hybridsUnlocked (pure)
│  ├─ inventory.ts        addItem, removeItem, addScroll, equipGear, setSpell, planClassSwitch (pure; value | Reject)
│  ├─ ai/                 index.ts (public AI API), combat.ts (policy), opponent-model.ts, tuning.ts, exp.ts (expNeg)
│  ├─ game.ts  replay.ts  views.ts  serialize.ts  validation.ts  rng.ts  hash.ts  index.ts
├─ core/test/fixtures/test-rules.ts   TEST_RULES (small Rules literal; no content dependency)
├─ content/  data/{classes,gear,items,spells,monsters,tuning}.json, src/schemas/*, src/build-rules.ts, src/node.ts
├─ sim/      src/{cli,replay-file,duel,kits,report,rules}.ts, fixtures/combat-game.json, test/{duel,gate,perf,content-stats,cli,replay-file}.test.ts
└─ client/   text shell updated to the v2 view (Phaser arrives in Phase 4)
```

**Dependency direction (Phase 2):**
- `core` → nothing (unchanged lint). `core/src/**` except `core/src/ai/**` must not import `ai/` (new lint). `core/src/ai/**` must not import `reducer`, `handlers/*`, the core barrel `index`, `serialize`, `game` or `replay` (each exposes `GameState` values), must not import the names `GameState`/`HiddenState` from **any** module, and must not use `Math.exp`/`Math.log`/`Math.pow` (new lint; see *Lint and purity probe*).
- `content` → `core` (**type-only** imports of `Rules` and friends, plus the pure value helpers `rulesHash`, `CONTENT_ID_PATTERN`, `STAT_KEYS`, `COMBAT_HOOKS`, `BOARD_HOOKS`).
- `sim` → `core`, `core/ai`, `content` (`@usurpia/content/node`).
- `client` → `core` only (content wiring is Phase 4).

### Key Decisions
| Decision | Choice | Rationale | Alternatives Considered |
|----------|--------|-----------|------------------------|
| Content injection (OQ5a, binding) | `reduce(state, action, rules: Rules)`; core defines `Rules` (JSON data + integer tuning, **no functions, no display text**); content builds/validates it with `buildRules`; rules are never stored in state or saves; replay/sim files record `rulesHash = fnv1a32(stableStringify(rules))` | Core stays pure and content-agnostic; hashes detect rule drift | Rules in settings/state (bloats saves, hash churn) |
| Display text | `name`/`description`/`tagline` live only in content JSON; `buildRules` strips them | Typo fixes must not change `rulesHash` or invalidate replays | Text in Rules |
| Generic decisions (OQ5b, binding) | `public.pending {id, kind, required, committed}`; per-player `private[p].prompt {decisionId, options, default}`; `hidden.decision {id, choices}`. Opened internally by handlers (`combat/start`, next exchange) and by the system action `decision/open` (kind `poll`); commit validates `choice ∈ own options`; timeout fills each missing player's **own** default | Options can reveal private data (bag items), so they live in the private partition; structural redaction preserved | Options in public (leaks bags); options in hidden (views would have to read hidden) |
| Sample removal (OQ5c, binding) | Delete `sample/*`, `counter`, `lastRoll`, `note`, the A/B/C alphabet; `SCHEMA_VERSION` 1 → 2; actions/events/settings carry `v: 2`; new fixtures and goldens | Keep the kernel honest; no dead gameplay | Keep sample behind a flag |
| CPU RNG (OQ5d, binding) | AI has its own `RngState` seeded `seedRng(seed + "\u0000ai\u0000" + playerId + "\u0000" + difficulty)`; reads only `PlayerView` + `Rules`; returns an `Action` | CPU choices enter the game only as recorded actions; replay never re-runs AI | Drawing AI randomness from `hidden.rng` (would desync replays and leak) |
| Monster commands | Drawn **inside reduce** at reveal from weighted tables with `ctx` RNG (attacker's table first, then defender's) | NPCs are not players; no commit needed; deterministic | NPC as pseudo-player committing via system actions (noisy) |
| Passives | Data-tagged hooks `{hook, value}`; one exhaustive `applyPassives` switch sums values per hook into `HookTotals`; board hooks are accepted and ignored until Phase 3/5; Spellblade gets the single bespoke hook `spellbladeStrike` | Content-driven, testable, no per-class code | Per-class code modules |
| Opponent model | `public.choiceHistory[playerId]` = counts of each player's **revealed** combat commands (timed-out defaults excluded); never hidden | Anything a human at the table could remember; Hard stays fair | Per-AI private memory (not shared, not replayable) |
| Class switch overflow | `loadout/switchClass` requires `discard: ItemId[]` whose length equals `max(0, bag.length − newBagSize)` exactly; otherwise `INVALID_PAYLOAD` | Deterministic, no hidden auto-discard | Auto-discard newest; interactive decision |
| Integer math | All state numbers are integers; multipliers are basis points (`bp`, 10000 = 1.0×); every multiply is `Math.floor(x * bp / 10000)` applied step by step in the pinned order | Cross-platform exact hashes; no floats in state | Floats + rounding at the end |
| Damage variance | None in Phase 2 (only crits, stun chance and NPC/initiative/flee draws are random) | Makes EV exact and goldens hand-checkable | ±10% variance roll (can be added later as a tuning knob with a revision row) |
| Draw rule | After `maxRounds` (3) complete rounds with both standing → `draw`; a double KO in one exchange → `draw` | Matches design; sim counts draws separately | Winner by remaining HP% |
| Deserialize | `deserialize(json, rules)`: full exact-key shape + referential checks against `rules` + derived invariants (level vs xp, hp ≤ max, npc stat snapshot = recomputation, prompts = engine prompts) | Saves loaded under different rules fail loudly; Phase 1 discipline extended | Rules-free shape check only |
| Handlers split | `handlers/{shared,decision,combat,system,loadout,index}.ts`; the decision module dispatches reveal to a per-kind resolver table passed in by `index.ts` (no mutable registry) | Wave-parallel ownership; purity | One big `handlers.ts` |
| AI export | Subpath export `@usurpia/core/ai` (`core/package.json` `exports["./ai"]`); the main `index.ts` never imports `ai/` | Enforces the import boundary at package level too | Re-export from index |
| Sim/client rules in W1 | From 02-01a until W3 the sim uses `packages/sim/src/kernel-rules.ts` and the client uses `packages/client/src/demo-rules.ts`, both **verbatim copies of `TEST_RULES` typed as `Rules`**; W3 (02-05) deletes the sim copy and loads content rules | `buildRules` does not exist until W2; core test fixtures cannot be imported across packages (composite `rootDir`) | Exporting test fixtures from core `src` |
| Performance | `pnpm sim duel --n 10000` ≤ 60 s wall on `ubuntu-latest` (target ≤ 20 s; reference JS ran 10 000 duels in 2.2 s), asserted automatically by `packages/sim/test/perf.test.ts` (02-05) | Headroom for per-action validation in `reduce` | Bypassing `reduce` in the sim (forbidden: user requirement) |
| Ward without a ward spell (user decision D2, 2026-09-29) | The Ward command is always offered. With **no ward spell equipped**, Spell×Ward uses the **Guard multiplier** (`matrix.spell.guard`, 10000 bp) — Ward gives no spell resistance on its own. The starter ward spell **Barrier** (`valueBp 0`) is the baseline that grants the 0.4× spell resist (`matrix.spell.ward`); Reflect/Absorb/Counterspell build on it exactly as in `computeCell` | Design intent (design doc *Spell slots*): "1 **Ward Spell** (defense, used with the defender's *Ward* command)" and *Ward spells*: "Barrier — Standard spell resist (the matrix value)". So the 0.4× matrix value is what the Barrier ward spell provides; the Ward command without a ward spell is an unskilled block (Guard value vs Spell). The design doc itself is not edited; this row is the binding interpretation | Ward always 0.4× (made Barrier worthless and Ward free) |
| Golden oracle (critique #1) | `.planning/reference/phase-02/` (reference JS, `verify-spec.mjs`, `gen-goldens.mjs`, `traces/*.json`) is the single source of every golden; it is excluded from eslint, prettier, tsc and vitest; executors diff against its per-action traces to localise a mismatch | Composite goldens (hashes, stdout, gate counts) are otherwise opaque to debug | Scratch scripts in `/tmp` (lost) |
| Hard-vs-Easy gate (user decision D1) | Every class mirror of the gate must satisfy **both** `hardWins / (hardWins + easyWins) ≥ 0.70` and `draws / 400 ≤ 0.40`; initial tuning was retuned (Revision 2) so every mirror has ≥ 0.773 and ≤ 0.285 | A Hard AI that only "wins" 3 decisive duels out of 400 proves nothing | Decisive-only rate (draw-dominated mirrors passed vacuously) |
| AI arithmetic (critique #10) | The AI softmax uses `expNeg` (range reduction + degree-13 Taylor, IEEE `+ − × ÷` and `Math.round` only); no `Math.exp`/`Math.log`/`Math.pow`. AI goldens are therefore engine-independent (not just V8/Node-exact) | ECMAScript leaves `exp`/`log`/`pow` implementation-approximated | Accept V8-only goldens |

## API and Type Contracts
Unchanged from Phase 1 and still binding: `rng.ts` (sfc32/cyrb128 + golden vectors), `hash.ts`, `stableStringify`, the canonicalize-once rule for untrusted actions, `Object.hasOwn`/`ownGet` for every record keyed by player ids **or content ids**, bounded echo (≤ 64 chars) in reject messages, `RESERVED_IDS`, `PLAYER_ID_PATTERN`, `MAX_COUNTER = 2**31 − 1`, frozen `PUBLIC` visibility, `onlyPlayers()`, replay-continues-after-rejection.

### `rules.ts` — the `Rules` contract (W1a, 02-01a)
```ts
export const RULES_VERSION = 1 as const;
export type ContentId = string;                       // CONTENT_ID_PATTERN and not in RESERVED_CONTENT_IDS
export const CONTENT_ID_PATTERN = /^[a-z][a-z0-9-]{0,47}$/;
export const RESERVED_CONTENT_IDS: readonly string[] = ["constructor", "prototype"];
export type StatKey = "hp" | "atk" | "def" | "mag" | "spd" | "luck";
export const STAT_KEYS: readonly StatKey[] = ["hp", "atk", "def", "mag", "spd", "luck"];   // canonical order
export type StatBlock = Readonly<Record<StatKey, number>>;                                  // integers
export type ModStat = "atk" | "def" | "mag" | "spd";
export type AttackCommand = "attack" | "strike" | "spell";
export type DefendCommand = "guard" | "counter" | "ward";
export type Command = AttackCommand | DefendCommand;
export const ATTACK_COMMANDS: readonly AttackCommand[] = ["attack", "strike", "spell"];
export const DEFEND_COMMANDS: readonly DefendCommand[] = ["guard", "counter", "ward"];
export const COMMANDS: readonly Command[] = ["attack", "strike", "spell", "guard", "counter", "ward"];

export const COMBAT_HOOKS = [
  "hpBp", "atkBp", "defBp", "magBp", "spdBp", "luckBp",          // sheet-stat bonus (bp)
  "attackDmgBp", "strikeDmgBp", "spellDmgBp",                    // outgoing damage bonus per command (bp)
  "guardVsStrikeBp",   // as defender with Guard vs Strike: damage × (10000 − min(10000, v)) / 10000
  "counterDmgBp",      // as defender, Strike×Counter reflection × (10000 + v) / 10000
  "wardReflectBp",     // as defender with Ward vs Spell: reflect v bp of the unwarded spell damage (adds to Reflect spell)
  "critBp", "fleeBp",  // + crit chance / + flee chance (bp)
  "lifestealBp",       // attacker heals v bp of Attack/Strike damage dealt
  "roundRegenBp",      // heal v bp of max HP at each round end
  "spellTakenBp", "physTakenBp",   // as defender: spell / physical damage × max(0, 10000 + v) / 10000
  "spellbladeStrike",  // bespoke Spellblade hook (see resolve)
  "poisonOnHit", "stealGoldOnHitBp", "stealItemOnHit",   // on-hit hooks (used by monsters)
] as const;
export const BOARD_HOOKS = [
  "pvpExtraSteal", "passPickpocketBp", "spellPriceBp", "fieldSpellMove",
  "turnRegenBp", "townTaxBp", "crownTaxResistBp", "lootLuckBp",
] as const;                                            // accepted, summed by nobody in Phase 2 (Phase 3/5 implement)
export type CombatHook = (typeof COMBAT_HOOKS)[number];
export type BoardHook = (typeof BOARD_HOOKS)[number];
export type HookName = CombatHook | BoardHook;
export interface Hook { readonly hook: HookName; readonly value: number }            // int in [-10000, 100000]
export interface PassiveDef extends Hook { readonly rank: 1 | 2 | 3 | 4 | 5; readonly id: ContentId }
export type CommandWeights = Readonly<Record<Command, number>>;                       // ints 0..100

export interface Loadout {
  readonly weapon: ContentId | null; readonly shield: ContentId | null; readonly accessory: ContentId | null;
  readonly battleSpell: ContentId | null; readonly wardSpell: ContentId | null;
  readonly bag: readonly ContentId[];
}
export interface ClassDef {
  readonly id: ContentId; readonly kind: "base" | "hybrid";
  readonly parents: readonly [ContentId, ContentId] | null;   // hybrid only: two distinct base classes
  readonly statBp: StatBlock;                                 // class multiplier per stat (bp, 1..100000)
  readonly bagSize: number;                                   // 1..16
  readonly switchFee: number;                                 // gold, 0..1_000_000
  readonly passives: readonly PassiveDef[];                   // exactly 5, passives[i].rank === i + 1
  readonly starter: Loadout | null;                           // base: non-null; hybrid: null
  readonly aiBias: CommandWeights;                            // AI base table (Easy uses it directly)
}
export type GearSlot = "weapon" | "shield" | "accessory";
export interface GearDef { readonly id: ContentId; readonly slot: GearSlot; readonly tier: 1|2|3|4|5; readonly price: number; readonly stats: StatBlock; /* flat, ints −999..999 */ readonly hooks: readonly Hook[] }
export type ItemUse = "combat" | "board" | "both" | "none";
export type BoardItemTag = "spinBonus" | "spinFixed" | "warpCastle" | "pickSpin" | "blockGoldSteal";
export type JokeTag = "decoyGoldBag" | "cursedWig" | "whoopeeScroll" | "royalSummons" | "bagOfBees";
export type ItemEffect =
  | { readonly kind: "heal"; readonly bp: number } | { readonly kind: "cleanse" } | { readonly kind: "flee" }
  | { readonly kind: "mod"; readonly stat: ModStat; readonly bp: number }
  | { readonly kind: "board"; readonly tag: BoardItemTag; readonly value: number }
  | { readonly kind: "joke"; readonly tag: JokeTag };
export interface ItemDef { readonly id: ContentId; readonly kind: "consumable" | "joke"; readonly price: number; readonly use: ItemUse; readonly effect: ItemEffect }
export type SpellEffect =
  | { readonly kind: "none" } | { readonly kind: "stun"; readonly chanceBp: number }
  | { readonly kind: "mod"; readonly stat: ModStat; readonly bp: number }
  | { readonly kind: "drain"; readonly bp: number } | { readonly kind: "stealGold"; readonly bp: number };
export interface BattleSpellDef { readonly id: ContentId; readonly tier: 1|2|3|4|5; readonly price: number; readonly powerBp: number; /* 0 = no damage */ readonly effect: SpellEffect }
export type WardMode = "barrier" | "reflect" | "absorb" | "counterspell";
export interface WardSpellDef { readonly id: ContentId; readonly tier: 1|2|3|4|5; readonly price: number; readonly mode: WardMode; readonly valueBp: number }
export type FieldSpellTag = "spinTwiceHigher" | "spinCap" | "seizeTown" | "fullHealCleanse" | "hideAndImmune" | "doubleGoldSpace" | "swapPositions" | "blockFieldSpells";
export interface FieldSpellDef { readonly id: ContentId; readonly tier: 1|2|3|4|5; readonly price: number; readonly tag: FieldSpellTag; readonly value: number; readonly duration: number }
export interface AttackTable { readonly attack: number; readonly strike: number; readonly spell: number; readonly flee: number }   // ints 0..1000
export interface DefendTable { readonly guard: number; readonly counter: number; readonly ward: number }
export interface NpcBase { readonly statBp: StatBlock; readonly attackTable: AttackTable; readonly defendTable: DefendTable; readonly battleSpell: ContentId | null; readonly wardSpell: ContentId | null; readonly hooks: readonly Hook[] }
export interface MonsterDef extends NpcBase { readonly id: ContentId; readonly tier: 1|2|3|4; readonly zone: ContentId; readonly xp: number; readonly gold: number }
export interface GuardianDef extends NpcBase { readonly id: ContentId; readonly style: "magic" | "physical" | "balanced"; readonly xpPerTier: number; readonly goldPerTier: number }
export interface EnforcerDef extends NpcBase { readonly id: ContentId; readonly xpPerLevel: number; readonly goldPerLevel: number }
export interface MatrixRow { readonly guard: number; readonly counter: number; readonly ward: number; readonly open: number }   // bp
export interface CombatTuning {
  readonly kBp: number; readonly jBp: number; readonly jMagBp: number;
  readonly matrix: { readonly attack: MatrixRow; readonly strike: MatrixRow; readonly spell: MatrixRow };  // strike.counter = reflection multiplier (damage to the ATTACKER)
  readonly critBaseBp: number; readonly critPerLuckBp: number; readonly critCapBp: number; readonly critMultBp: number;
  readonly maxRounds: number;                                                    // 1..10
  readonly fleeBaseBp: number; readonly fleePerSpdBp: number; readonly fleeMinBp: number; readonly fleeMaxBp: number;
  readonly modMinBp: number; readonly modMaxBp: number; readonly poisonBp: number;
  readonly seniorRewardBp: number; readonly pvpXpPerLevel: number;
}
export interface ProgressionTuning {
  readonly maxLevel: number;                  // 1..99
  readonly xpCurve: readonly number[];        // length maxLevel; [0] = 0; strictly increasing; cumulative XP to reach level i+1
  readonly baseStats: StatBlock;              // level-1 stats before class multiplier
  readonly growth: StatBlock;                 // added per level above 1
  readonly masteryWins: readonly number[];    // length 5; [0] = 0; strictly increasing; wins needed for rank i+1
  readonly hybridUnlockRank: number;          // 1..5
}
export interface EconomyTuning { readonly startingGold: number; readonly maxScrolls: number }   // maxScrolls 0..9
export interface Rules {
  readonly v: typeof RULES_VERSION;
  readonly classes: Readonly<Record<ContentId, ClassDef>>;
  readonly gear: Readonly<Record<ContentId, GearDef>>;
  readonly items: Readonly<Record<ContentId, ItemDef>>;
  readonly battleSpells: Readonly<Record<ContentId, BattleSpellDef>>;
  readonly wardSpells: Readonly<Record<ContentId, WardSpellDef>>;
  readonly fieldSpells: Readonly<Record<ContentId, FieldSpellDef>>;
  readonly monsters: Readonly<Record<ContentId, MonsterDef>>;
  readonly guardians: Readonly<Record<ContentId, GuardianDef>>;
  readonly enforcer: EnforcerDef;
  readonly npcCurve: readonly StatBlock[];    // exactly 5 entries: tiers T1..T5
  readonly combat: CombatTuning;
  readonly progression: ProgressionTuning;
  readonly economy: EconomyTuning;
}
export function rulesHash(rules: Rules): string;               // fnv1a32(stableStringify(rules))
export function masteryRank(rules: Rules, wins: number): 1|2|3|4|5;   // max r with wins >= masteryWins[r-1]
export function levelForXp(rules: Rules, xp: number): number;         // max L with xp >= xpCurve[L-1]
```
- Every record is keyed by its entry's `id` (`record[id].id === id`). All lookups use `ownGet`. Core **trusts** `Rules` (it is validated by `buildRules` or is the typed `TEST_RULES` literal); core never re-validates rules.
- `Rules` contains no names, descriptions or taglines.
- **NPC hooks:** an NPC's `hooks` are summed by `applyPassives(def.hooks)` in `snapshotNpc` and act only through **combat-time** hooks (`attackDmgBp`, `physTakenBp`, on-hit hooks, …). `npcStats` never reads hooks, so the sheet-stat hooks `hpBp`/`atkBp`/`defBp`/`magBp`/`spdBp`/`luckBp` would be silent no-ops on an NPC; content rejects them (cross-ref rule "npc sheet-stat hooks are not applied"). All three shipped guardians and the Crown Enforcer have `hooks: []`; `EnforcerDef` has **no** `style` field (only guardians have one).

### `types.ts` — GameState v2 (W1a, 02-01a)
```ts
export const SCHEMA_VERSION = 2 as const;
export const MAX_COUNTER = 2 ** 31 - 1;       // turn, decisionSeq, combatSeq, xp, gold, mastery wins, choiceHistory counts
export const MAX_STAT = 99_999;               // hp and npc stat snapshots
export const CHOICE_PATTERN = /^[a-z][a-z0-9:-]{0,63}$/;   // decision option / choice tokens (≤ 64 chars: fits "item:" + a 48-char content id)
export type Phase = "turn" | "decision";
export type DecisionKind = "poll" | "combat/exchange";
export interface SeatSettings { readonly id: PlayerId; readonly classId: ContentId }
export interface GameSettings { readonly v: 2; readonly seed: string; readonly players: readonly SeatSettings[] }  // 1–4 seats
export interface CharacterPublic {
  readonly classId: ContentId; readonly level: number; readonly xp: number; readonly hp: number; readonly gold: number;
  readonly mastery: Readonly<Record<ContentId, number>>;   // wins per class; own keys = every class id in rules
  readonly portable: ContentId | null;                     // class whose rank-5 passive is carried
  readonly weapon: ContentId | null; readonly shield: ContentId | null; readonly accessory: ContentId | null;
  readonly battleSpell: ContentId | null; readonly wardSpell: ContentId | null;
}
export type CommandCounts = Readonly<Record<Command, number>>;
export interface PendingDecisionPublic { readonly id: string; readonly kind: DecisionKind; readonly required: readonly PlayerId[]; readonly committed: readonly PlayerId[] }
export interface LastReveal { readonly decisionId: string; readonly kind: DecisionKind; readonly choices: Readonly<Record<PlayerId, string>>; readonly timedOut: readonly PlayerId[] }
export interface BattleMods { readonly atk: number; readonly def: number; readonly mag: number; readonly spd: number; readonly poison: boolean; readonly stun: boolean }  // bp deltas in [modMinBp, modMaxBp]
export type NpcRef =
  | { readonly kind: "monster"; readonly id: ContentId; readonly senior: boolean }
  | { readonly kind: "guardian"; readonly id: ContentId; readonly townTier: 1 | 2 | 3 | 4 }
  | { readonly kind: "enforcer"; readonly level: number };
export type CombatSide =
  | { readonly kind: "player"; readonly playerId: PlayerId; readonly mods: BattleMods }
  | { readonly kind: "npc"; readonly npc: NpcRef; readonly stats: StatBlock; readonly hp: number; readonly mods: BattleMods };
export interface CombatState { readonly id: string; readonly round: number; readonly exchange: 1 | 2; readonly first: 0 | 1; readonly sides: readonly [CombatSide, CombatSide] }
export interface PublicState {
  readonly phase: Phase; readonly turn: number; readonly activePlayer: PlayerId; readonly players: readonly PlayerId[];
  readonly characters: Readonly<Record<PlayerId, CharacterPublic>>;
  readonly choiceHistory: Readonly<Record<PlayerId, CommandCounts>>;
  readonly pending: PendingDecisionPublic | null;
  readonly lastReveal: LastReveal | null;
  readonly combat: CombatState | null;
}
export interface Prompt { readonly decisionId: string; readonly options: readonly string[]; readonly default: string }
export interface PrivateState { readonly bag: readonly ContentId[]; readonly scrolls: readonly ContentId[]; readonly prompt: Prompt | null }
export interface HiddenState {
  readonly rng: RngState; readonly decisionSeq: number; readonly combatSeq: number;
  readonly decision: { readonly id: string; readonly choices: Readonly<Record<PlayerId, string>> } | null;
}
export interface GameState { readonly v: typeof SCHEMA_VERSION; readonly public: PublicState; readonly private: Readonly<Record<PlayerId, PrivateState>>; readonly hidden: HiddenState }
```
Removed from v1: `Choice`, `counter`, `lastRoll`, `PrivateState.note`, `hidden.decision.defaultChoice`. `Actor`/`Viewer` stay `= PlayerId` aliases.

**Partition rationale / redaction:** public = everything a player at the table can see (class, level, xp, hp, gold, equipped gear and spells, mastery, combat state, who has committed, revealed choices, choice history). Private = bag, field-spell scrolls, the player's own open prompt (its options reveal bag items). Hidden = RNG, decision/combat sequence numbers, committed-but-unrevealed choices.

**`createGame(settings, rules)`** (W1a) throws `SettingsError` unless: settings is an object; `v === 2`; `seed` is a non-empty string; `players` is an array of 1–4 plain objects with exactly the keys `id`, `classId`; ids pass `playersError` (pattern, reserved, unique); each `classId` is an own key of `rules.classes` whose `kind === "base"`. It returns:
- `public = {phase:"turn", turn:1, activePlayer: players[0].id, players: ids, characters, choiceHistory, pending:null, lastReveal:null, combat:null}`;
- `characters[id] = {classId, level:1, xp:0, gold: rules.economy.startingGold, mastery: {every class id (sorted): 0}, portable:null, weapon/shield/accessory/battleSpell/wardSpell from classes[classId].starter, hp: sheetStats(...).hp}`;
- `choiceHistory[id] = {attack:0, strike:0, spell:0, guard:0, counter:0, ward:0}`;
- `private[id] = {bag: [...starter.bag], scrolls: [], prompt: null}`;
- `hidden = {rng: seedRng(seed), decisionSeq: 0, combatSeq: 0, decision: null}`.
All records are built with `Object.fromEntries` (PIT-002).

**Golden (W1a):** `createGame({v:2, seed:"fixture", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}, TEST_RULES)` has `hashState = 758ef72c` and canonical JSON:
```json
{"hidden":{"combatSeq":0,"decision":null,"decisionSeq":0,"rng":[2094061593,184016598,2753665883,215806170]},"private":{"p1":{"bag":["herb"],"prompt":null,"scrolls":[]},"p2":{"bag":["herb","bomb"],"prompt":null,"scrolls":[]}},"public":{"activePlayer":"p1","characters":{"p1":{"accessory":null,"battleSpell":"zap","classId":"fighter","gold":100,"hp":48,"level":1,"mastery":{"battlemage":0,"caster":0,"fighter":0},"portable":null,"shield":"lid","wardSpell":null,"weapon":"stick","xp":0},"p2":{"accessory":"charm","battleSpell":"zap","classId":"caster","gold":100,"hp":36,"level":1,"mastery":{"battlemage":0,"caster":0,"fighter":0},"portable":null,"shield":"lid","wardSpell":"shell","weapon":"stick","xp":0}},"choiceHistory":{"p1":{"attack":0,"counter":0,"guard":0,"spell":0,"strike":0,"ward":0},"p2":{"attack":0,"counter":0,"guard":0,"spell":0,"strike":0,"ward":0}},"combat":null,"lastReveal":null,"pending":null,"phase":"turn","players":["p1","p2"],"turn":1},"v":2}
```

### `game.ts` / `replay.ts` signatures (W1a)
```ts
export class SettingsError extends Error {}
export function createGame(settings: GameSettings, rules: Rules): GameState;
export interface ReplayResult { readonly state: GameState; readonly events: readonly GameEvent[]; readonly rejections: readonly { index: number; error: Reject }[] }
export function replay(settings: GameSettings, actions: readonly unknown[], rules: Rules): ReplayResult;   // continues after rejections (unchanged)
export function hashState(state: GameState): string;                                                     // unchanged
```
`packages/core/src/index.ts` exports everything in this section plus `rules.ts`, `combat/{passives,stats,options,resolve}.ts`, `progression.ts` and `inventory.ts` public functions (added by the owning plan); it never re-exports `ai/`.

### `views.ts` (W1a shape; `counts` and the full redaction suite in W1b)
```ts
export interface PlayerView {
  readonly v: typeof SCHEMA_VERSION; readonly viewer: Viewer; readonly public: PublicState;
  readonly self: PrivateState | null;                                          // own private partition, or null for spectators/unknown ids
  readonly counts: Readonly<Record<PlayerId, { readonly bag: number; readonly scrolls: number }>>;  // every seated player's bag/scroll COUNTS only
}
export function viewFor(state: GameState, viewer: Viewer): PlayerView;   // built from public + ownGet(private, viewer) + counts via Object.fromEntries; never spreads state
export function redactEvent(event: GameEvent, viewer: Viewer): GameEvent | null;   // unchanged semantics
export function eventsFor(events: readonly GameEvent[], viewer: Viewer): GameEvent[];
```
A viewer sees of an opponent: class/level/xp/hp/gold/gear/spells/mastery (public), bag and scroll **counts**, whether they have committed, never their options, bag contents, scrolls, or uncommitted/unrevealed choice.

### `actions.ts` — Action union v2
Every action is `{ v: 2, type, playerId, ...payload }` with **exactly** the listed keys (extra keys → `INVALID_PAYLOAD` at the shape step). "token" = string matching `CHOICE_PATTERN`; "id" = any string (existence is checked in the state step).
```ts
export type Opponent = { kind: "player"; playerId: PlayerId } | { kind: "npc"; npc: NpcRef };
export type Grant =
  | { kind: "item" | "scroll" | "gear" | "battleSpell" | "wardSpell"; id: ContentId }
  | { kind: "gold" | "xp"; amount: number };                                  // int 1..1_000_000
export type Action =
  // W1b (02-01b). In 02-01a `Action` is the empty union (`never`), `ACTION_TYPES = []` and the handler map is `{}`;
  // every versioned object is then UNKNOWN_ACTION. 02-01b adds these three members, their guards and handlers together.
  | { v: 2; type: "decision/open"; playerId: "system"; prompts: { playerId: PlayerId; options: string[]; default: string }[] }
  | { v: 2; type: "decision/commit"; playerId: PlayerId; decisionId: string; choice: string }
  | { v: 2; type: "timeout"; playerId: "system"; decisionId: string }
  // W2 (02-03)
  | { v: 2; type: "combat/start"; playerId: "system"; attacker: PlayerId; opponent: Opponent }
  | { v: 2; type: "system/setCharacter"; playerId: "system"; target: PlayerId; classId: ContentId; level: number;
      weapon: ContentId | null; shield: ContentId | null; accessory: ContentId | null;
      battleSpell: ContentId | null; wardSpell: ContentId | null; bag: ContentId[] }
  // W3 (02-04)
  | { v: 2; type: "system/grant"; playerId: "system"; target: PlayerId; grant: Grant }
  | { v: 2; type: "loadout/switchClass"; playerId: PlayerId; classId: ContentId; discard: ContentId[] }
  | { v: 2; type: "loadout/discard"; playerId: PlayerId; itemId: ContentId }
  | { v: 2; type: "loadout/useItem"; playerId: PlayerId; itemId: ContentId }
  | { v: 2; type: "loadout/setPortable"; playerId: PlayerId; classId: ContentId | null };
```
`ACTION_TYPES` lists the types in the order above. Each wave extends the union, `ACTION_TYPES`, the handler map and the arbitraries together.

### `events.ts` — GameEvent union v2
Every event is `{ v: 2, type, visibility, ...fields }`. Visibility is `PUBLIC` unless marked **private** (`onlyPlayers([playerId])`).

| Event | Fields | Emitted by |
|-------|--------|-----------|
| `DecisionOpened` | `decisionId, kind, required` | any decision open |
| `PromptOpened` **private** | `decisionId, playerId, options, default` | one per required player, in `required` order, right after `DecisionOpened` |
| `ChoiceCommitted` | `decisionId, playerId` (never the choice) | commit |
| `ChoiceTimedOut` | `decisionId, playerId` | timeout, per missing player in `required` order |
| `ChoicesRevealed` | `decisionId, kind, choices, timedOut` | reveal |
| `CombatStarted` | `combatId, sides` (the new `combat.sides`) | combat/start |
| `RoundStarted` | `combatId, round, first` | each round start |
| `ExchangeSkipped` | `combatId, round, exchange, attacker, reason: "stunned"` | stunned attacker |
| `ExchangeResolved` | `combatId, round, exchange, attacker: 0\|1, command: string, defense: DefendCommand \| "open" \| null, crit: boolean, damage: [n0, n1], heal: [n0, n1], effects: string[], hp: [hp0, hp1]` | every resolved exchange (arrays are indexed by **side**, values are actual HP lost/gained) |
| `RoundEnded` | `combatId, round, poison: [n0,n1], regen: [n0,n1], hp: [hp0,hp1]` | after exchange 2 |
| `CombatEnded` | `combatId, outcome: "ko" \| "fled" \| "draw", winner: 0\|1\|null, fled: 0\|1\|null, hp: [hp0,hp1]` | combat end |
| `CharacterSet` | `playerId, classId, level, hp` | system/setCharacter |
| `BagUpdated` **private** | `playerId, bag` (full new bag) | any bag change |
| `ScrollsUpdated` **private** | `playerId, scrolls` | scroll grant |
| `Granted` (**private** for `item`/`scroll`, else public) | `playerId, grant` | system/grant |
| `LevelUp` | `playerId, level` (one per level gained, ascending) | xp gain |
| `VictoryRewarded` | `playerId, xp, gold, classId, masteryWins` | KO win by a player |
| `MasteryRankUp` | `playerId, classId, rank` | wins crossing a threshold |
| `HybridUnlocked` | `playerId, classId` (ascending class id) | first time both parents reach `hybridUnlockRank` |
| `ClassSwitched` | `playerId, from, to, fee, hp` | loadout/switchClass |
| `ItemUsed` | `playerId, itemId, healed, hp` | loadout/useItem |
| `PortableSet` | `playerId, classId \| null, hp` | loadout/setPortable |

`ExchangeResolved.effects` tags, in emission order: cell tags (`reflected`, `negated`, `absorbed`), then the spell effect tag (`stun`, `mod:<stat>:<bp>`, `steal-gold:<n>`), then `drain` (only if the drain heal was > 0), then on-hit tags (`poison`, `steal-gold:<n>`, `steal-item:<itemId>`); for items `item:<itemId>` then `fled` (smoke bomb); for flee `fled` or `flee-failed`.

### `reducer.ts` — precedence and handler table
`reduce(state: GameState, action: unknown, rules: Rules): ReduceResult` and `isAction(value: unknown)` keep the **Phase 1 precedence** exactly: canonicalize once → `UNSUPPORTED_VERSION` (not a plain object or `v !== 2`) → `UNKNOWN_ACTION` → `INVALID_PAYLOAD` (shape guard) → `WRONG_PHASE` → `WRONG_ACTOR` → state validation → apply → write `ctx.rng` back. `RejectCode` is unchanged (7 codes). Rejections return the input state untouched. `Ctx = { rng: RngState; int(min, max): number }` (unchanged). Handlers receive `(state, action, ctx, rules)`; `validate(state, action, rules)`.

State-validation order is the row order below; the **first** failing check wins. Every check has a **unique** message (the text in quotes, with ids clipped to 64 chars); tests assert the exact message (PIT-001).

| Type | Phases | Actor | Shape guard (state-free) | State validation, in order (`INVALID_PAYLOAD` unless noted) |
|------|--------|-------|--------------------------|-------------------------------------------------------------|
| `decision/open` | turn | system | `prompts`: array 1..4 of plain objects with exactly `playerId` (string), `options` (array 1..8 of tokens), `default` (token) | "prompt players must be unique"; "prompt player must be seated"; "prompt options must be unique"; "prompt default must be one of its options"; "decisionSeq would exceed MAX_COUNTER" |
| `decision/commit` | decision | required | `decisionId` string, `choice` token | `STALE_DECISION` "decision <id> is not the open decision"; `ALREADY_COMMITTED` "<p> already committed"; "choice is not one of your options" |
| `timeout` | decision | system | `decisionId` string | `STALE_DECISION` (same message) |
| `combat/start` | turn | system | `attacker` string; `opponent` exact-key union; `npc` exact-key `NpcRef` (`senior` boolean, `townTier` int 1..4, `level` int 1..99) | "attacker must be a seated player"; "attacker is knocked out"; "opponent player must be seated"; "opponent must differ from attacker"; "opponent is knocked out"; "unknown monster"; "unknown guardian"; "enforcer level above maxLevel"; "combatSeq would exceed MAX_COUNTER"; "decisionSeq would exceed MAX_COUNTER" (needs `decisionSeq ≤ MAX_COUNTER − 2 × maxRounds`) |
| `system/setCharacter` | turn | system | `target`, `classId` strings; `level` int 1..99; five slot fields string\|null; `bag` array ≤ 16 of strings | "target must be a seated player"; "unknown class"; "level above maxLevel"; "unknown weapon"; "unknown shield"; "unknown accessory" (each also fails if the gear's slot differs); "unknown battle spell"; "unknown ward spell"; "unknown item in bag"; "bag exceeds class bag size" |
| `system/grant` | turn | system | `target` string; `grant` exact-key union | "target must be a seated player"; per kind: "unknown item" / "unknown field spell" / "unknown gear" / "unknown battle spell" / "unknown ward spell"; "bag is full"; "scroll limit reached"; "gold would exceed MAX_COUNTER"; "xp would exceed MAX_COUNTER" |
| `loadout/switchClass` | turn | any-player | `classId` string; `discard` array ≤ 16 of strings | "unknown class"; "already that class"; "hybrid not unlocked"; "not enough gold"; "discard must list exactly the overflow items" (length ≠ `max(0, bag.length − newBagSize)`); "discarded item not in bag" (multiset: each entry removes the first remaining occurrence) |
| `loadout/discard` | turn | any-player | `itemId` string | "item not in bag" |
| `loadout/useItem` | turn | any-player | `itemId` string | "item not in bag"; "item is not usable outside combat" (only `use === "both"` with `effect.kind === "heal"` is usable in Phase 2); "knocked out" (hp 0) |
| `loadout/setPortable` | turn | any-player | `classId` string\|null | "unknown class"; "portable passive requires mastery rank 5" |

Actor rules unchanged (`active`, `any-player`, `system`, `required`). Phase 2 uses no `active` handler; `turn`/`activePlayer` stay at their initial values.

### Transition semantics — kernel (W1b, 02-01b)
- **`openDecision(state, kind, prompts, events)`**: `decisionSeq += 1`; `id = "d" + decisionSeq`; `public.pending = {id, kind, required: prompts.map(p ⇒ p.playerId), committed: []}`; `hidden.decision = {id, choices: {}}`; each `private[p].prompt = {decisionId: id, options, default}`; `phase = "decision"`; emit `DecisionOpened`, then one `PromptOpened` per prompt in order.
- **`decision/open`** (kind `poll`): `openDecision` with the action's prompts (options copied).
- **`decision/commit`**: append to `committed`, store `choices[p]`, emit `ChoiceCommitted`; if all required committed → **reveal** with `timedOut: []`.
- **`timeout`**: for each required player not committed (in `required` order) emit `ChoiceTimedOut`; then **reveal** with those players as `timedOut`; their choice is their own `prompt.default`.
- **reveal**: `choices` built in `required` order (committed choice via `ownGet`, else own default); `lastReveal = {decisionId, kind, choices, timedOut}`; clear `pending`, `hidden.decision` and every required player's `prompt`; `phase = "turn"`; emit `ChoicesRevealed`. If `kind === "combat/exchange"`: for each required player **not** in `timedOut` whose choice is one of the 6 `COMMANDS`, `choiceHistory[p][choice] = min(MAX_COUNTER, n + 1)`; then call the kind's resolver `resolvers[kind](state, choices, ctx, rules, events)`. The `poll` resolver returns the state unchanged. In W1 the `combat/exchange` resolver slot holds `resolveUnsupported` (returns the state unchanged; unreachable because W1 `deserialize` rejects combat decisions); 02-03 replaces it.

**Golden (W1b, `packages/sim/fixtures/kernel-game.json`, core `replay.test.ts`)** — settings `{v:2, seed:"fixture", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}`, rules `TEST_RULES`, actions:
```json
[{"v":2,"type":"decision/open","playerId":"system","prompts":[{"playerId":"p1","options":["yes","no"],"default":"no"},{"playerId":"p2","options":["red","green","blue"],"default":"red"}]},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d1","choice":"yes"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d1","choice":"no"},
 {"v":2,"type":"timeout","playerId":"system","decisionId":"d1"},
 {"v":2,"type":"decision/open","playerId":"system","prompts":[{"playerId":"p2","options":["a","b"],"default":"a"}]},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d2","choice":"c"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d2","choice":"b"}]
```
→ rejections `[{index:2, ALREADY_COMMITTED}, {index:5, INVALID_PAYLOAD}]`; 10 events `DecisionOpened, PromptOpened×2, ChoiceCommitted, ChoiceTimedOut, ChoicesRevealed, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed`; final `hashState = 9616698e`; `lastReveal = {decisionId:"d2", kind:"poll", choices:{p2:"b"}, timedOut:[]}`; the first reveal's choices are `{p1:"yes", p2:"red"}` with `timedOut:["p2"]`; `rulesHash(TEST_RULES) = 7433ea8b`. Sim line: `hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2`. Oracle summary (`traces/kernel-game.trace.json`): `2 rejections ([{"index":2,"code":"ALREADY_COMMITTED"},{"index":5,"code":"INVALID_PAYLOAD"}]), 10 events, final hashState = 9616698e`.

### `combat/passives.ts` + `combat/stats.ts` — stats (W1a, 02-01a; pure, no GameState)
```ts
export type HookTotals = Readonly<Record<CombatHook, number>>;
export function applyPassives(hooks: readonly Hook[]): HookTotals;
  // starts every COMBAT_HOOKS key at 0; one exhaustive `switch (hook.hook)` adds `value` for each combat hook
  // and does nothing for each BOARD_HOOKS member (explicit cases, no default), so adding a hook name fails typecheck until handled
export function activeHooks(rules: Rules, ch: CharacterPublic): readonly Hook[];
  // (1) current class passives with rank <= masteryRank(mastery[classId]), in rank order;
  // (2) if portable !== null && portable !== classId: classes[portable].passives[4];
  // (3) hooks of weapon, shield, accessory (in that order, skipping null)
export function sheetStats(rules: Rules, ch: CharacterPublic): StatBlock;
export function npcDef(rules: Rules, ref: NpcRef): NpcBase;             // monster / guardian / enforcer definition
export function npcStats(rules: Rules, ref: NpcRef): StatBlock;
export function battleStats(stats: StatBlock, mods: BattleMods): StatBlock;
export function adjustHp(oldMax: number, newMax: number, hp: number): number;   // hp === 0 ? 0 : min(newMax, hp + max(0, newMax − oldMax))
```
**Sheet stats** (player), for each stat `s` in `STAT_KEYS`, with `t = applyPassives(activeHooks(rules, ch))` and `fl = Math.floor`:
1. `x = baseStats[s] + growth[s] × (level − 1)`
2. `x = fl(x × classes[classId].statBp[s] / 10000)`
3. `x += weapon.stats[s] + shield.stats[s] + accessory.stats[s]` (null slots add 0)
4. `x = fl(x × (10000 + t[s + "Bp"]) / 10000)`
5. `hp = max(1, x)`; other stats `max(0, x)`. `maxHp = sheet.hp`.

**NPC stats**: `curve` = `npcCurve[tier − 1 + (senior ? 1 : 0)]` for monsters; `npcCurve[townTier]` for guardians (town tier 1..4 → T2..T5); for the enforcer `curve[s] = baseStats[s] + growth[s] × (level − 1)`. Then `stat[s] = fl(curve[s] × def.statBp[s] / 10000)`, `hp = max(1, …)`, others `max(0, …)`. The combat side stores this snapshot.

**Battle stats**: `atk/def/mag/spd = max(0, fl(stat × (10000 + mods[s]) / 10000))`; `hp` and `luck` unchanged.

**HP adjustment rule** (every sheet change outside combat: level up, class switch, gear/spell grant, portable change, setCharacter excepted): `hp = adjustHp(oldMax, newMax, hp)`. `system/setCharacter` sets `hp = newMax`.

**Goldens (`stats.test.ts`, TEST_RULES; stat order hp/atk/def/mag/spd/luck; mastery wins default 0):**

| Character / NPC | Result |
|---|---|
| fighter L1, stick/lid/— | 48/18/12/9/10/5 |
| caster L1, stick/lid/charm | 36/13/11/15/10/9 |
| battlemage L1, stick/mirror/band | 44/17/14/13/13/5 |
| fighter L5, sword/lid/—, fighter wins 3 (rank 2: `strikeDmgBp`, `hpBp`) | 94/37/20/19/14/9 |
| caster L3, stick/lid/—, caster wins 7 (rank 3), fighter wins 18 (rank 5), portable `fighter` | 50/18/14/25/12/7 |
| battlemage L4, sword/lid/—, battlemage wins 7 (rank 3: `atkBp` active) | 70/34/18/23/13/8 |
| monster `slime` | 40/12/8/10/9/4 |
| monster `crab`, senior (T3 curve) | 120/36/26/20/12/8 |
| monster `gull` | 36/12/7/8/10/4 |
| guardian `lich`, townTier 2 (T3 curve) | 144/32/22/31/15/8 |
| enforcer level 5 | 72/31/18/19/14/9 |

### `combat/resolve.ts` — damage math (W2, 02-03; pure, no GameState, injected `draw`)
```ts
export type Draw = (min: number, max: number) => number;   // inclusive; the handler passes ctx.int
export interface Combatant { readonly stats: StatBlock /* battle stats */; readonly hp: number; readonly maxHp: number; readonly hooks: HookTotals; readonly spell: BattleSpellDef | null; readonly ward: WardSpellDef | null }
export function snapshotPlayer(rules: Rules, ch: CharacterPublic, mods: BattleMods): Combatant;
export function snapshotNpc(rules: Rules, side: Extract<CombatSide, { kind: "npc" }>): Combatant;  // maxHp = side.stats.hp
export type DefenseCell = DefendCommand | "open";
export function isCritEligible(a: AttackCommand, d: DefenseCell): boolean;   // (a === "attack" || a === "strike") && !(a === "strike" && d === "counter")
export function critChanceBp(rules: Rules, att: Combatant): number;          // min(critCapBp, critBaseBp + luck × critPerLuckBp + hooks.critBp)
export function fleeChanceBp(rules: Rules, fleer: Combatant, other: Combatant): number;
  // clamp(fleeBaseBp + (fleer.spd − other.spd) × fleePerSpdBp + fleer.hooks.fleeBp, fleeMinBp, fleeMaxBp)
export function physBase(t: CombatTuning, att: Combatant, def: Combatant): number;  // max(1, fl((att.atk × kBp − def.def × jBp) / 10000))
export function spellBase(t: CombatTuning, att: Combatant, def: Combatant): number; // powerBp === 0 ? 0 : max(1, fl((att.mag × powerBp − def.mag × jMagBp) / 10000))
export type CellTag = "reflected" | "negated" | "absorbed";
export interface CellResult { readonly toDefender: number; readonly toAttacker: number; readonly healAttacker: number; readonly healDefender: number; readonly tags: readonly CellTag[]; readonly effectLands: boolean }
export function computeCell(t: CombatTuning, att: Combatant, def: Combatant, a: AttackCommand, d: DefenseCell, crit: boolean): CellResult;
export function drawNpcCommand(table: AttackTable, draw: Draw): AttackCommand | "flee";   // keys in order attack, strike, spell, flee
export function drawNpcDefense(table: DefendTable, draw: Draw): DefendCommand;            // keys in order guard, counter, ward
  // weighted draw: total = Σ weights; u = draw(1, total); pick the first key whose running sum >= u
export function resolveExchange(rules: Rules, input: ExchangeInput, draw: Draw): ExchangeOutcome;
```
**`computeCell` — the exact algorithm** (`m = t.matrix`, all steps `fl`, `h` = hook totals):
1. `base = a === "spell" ? spellBase : physBase` (att must have a spell for `"spell"`; guaranteed by options/tables).
2. **Strike × Counter (reflection):** `r = fl(base × m.strike.counter / 10000)`; `r = fl(r × (10000 + def.h.counterDmgBp) / 10000)`; return `toAttacker = max(1, r)`, tags `["reflected"]`, everything else 0, `effectLands = false`. `crit` is ignored.
3. `mult = (a === "spell" && d === "ward" && def.ward === null) ? m.spell.guard : m[a][d]` (**D2:** Ward without a ward spell gives no spell resistance — the Guard multiplier applies; with any ward spell, incl. Barrier, `m.spell.ward` applies); `dmg = fl(base × mult / 10000)`.
4. `dmg = fl(dmg × (10000 + bonus) / 10000)`, `bonus = att.h.attackDmgBp | strikeDmgBp | spellDmgBp` by command.
5. If `a === "strike" && d === "guard" && def.h.guardVsStrikeBp > 0`: `dmg = fl(dmg × (10000 − min(10000, def.h.guardVsStrikeBp)) / 10000)`.
6. `dmg = fl(dmg × max(0, 10000 + (a === "spell" ? def.h.spellTakenBp : def.h.physTakenBp)) / 10000)`.
7. `ward = d === "ward" ? def.ward : null`. If `ward?.mode === "counterspell"`: spell → `dmg = 0`, `negated = true`, tag `negated`; Attack/Strike → `dmg = fl(dmg × ward.valueBp / 10000)`.
8. If `crit && a !== "spell"`: `dmg = fl(dmg × critMultBp / 10000)`.
9. **Spellblade:** if `a === "strike" && att.h.spellbladeStrike > 0 && att.spell !== null && att.spell.powerBp > 0`: `dmg += fl(spellBase(att, def) × att.h.spellbladeStrike / 10000)`.
10. If `base > 0 && !negated`: `dmg = max(1, dmg)`.
11. If `ward?.mode === "absorb" && a === "spell" && dmg > 0`: `healDefender = dmg`, `dmg = 0`, tag `absorbed`.
12. `toDefender = dmg`.
13. If `d === "ward" && a === "spell" && base > 0 && !negated`: `rbp = (ward?.mode === "reflect" ? ward.valueBp : 0) + def.h.wardReflectBp`; if `rbp > 0`: `sraw = fl(base × (10000 + att.h.spellDmgBp) / 10000)`, `toAttacker = max(1, fl(sraw × rbp / 10000))`, tag `reflected`.
14. If `a !== "spell" && dmg > 0 && att.h.lifestealBp > 0`: `healAttacker += fl(dmg × lifestealBp / 10000)`.
15. `carries = a === "spell" || (a === "strike" && att.h.spellbladeStrike > 0 && att.spell !== null)`; `effectLands = carries && d !== "ward" && (dmg > 0 || (a === "spell" && att.spell.powerBp === 0))`. (The **Ward command** blocks spell side effects whether or not a ward spell is equipped; D2 changes only the step-3 multiplier.)
16. If `effectLands && att.spell.effect.kind === "drain"`: `healAttacker += fl(dmg × effect.bp / 10000)`.

**Golden matrix (`resolve.test.ts`)** — tuning = `TEST_RULES.combat` (`kBp 12500, jBp 5000, jMagBp 5000`, matrix below, `critMultBp 15000`; the shipped content tuning differs since Revision 2 — `kBp 14500`, `jMagBp 3500` — so this golden deliberately uses the TEST_RULES values). Fixture: attacker battle stats `{hp:100, atk:30, def:20, mag:24, spd:10, luck:8}`, hp 100/100, all hooks 0, spell `{powerBp:12000, effect:none}`, ward null; defender `{hp:90, atk:26, def:18, mag:20, spd:9, luck:4}`, hp 90/90, hooks 0, **ward null** (so the Spell×Ward base cell exercises D2). So `physBase = 28`, `spellBase = 18`, `critChanceBp(att) = 500`. The multiplier shown is the one step 3 uses.

| Attacker \ Defender | Guard (m) | Counter (m) | Ward (m) | Open (m) |
|---|---|---|---|---|
| **Attack** | 5000 → **14** (crit 21) | 12500 → **35** (crit 52) — failed Counter | 10000 → **28** (crit 42) | 10000 → **28** (crit 42) |
| **Strike** | 15000 → **42** (crit 63) — pierces Guard | reflection 10000 → **attacker takes 28**, defender 0 (no crit) | 17500 → **49** (crit 73) | 15000 → **42** (crit 63) |
| **Spell** | 10000 → **18**, effectLands | 10000 → **18**, effectLands | 10000 → **18**, no effect — **no ward spell: Guard multiplier (D2)** | 10000 → **18**, effectLands |

Variant rows (same fixture, one change each; ward spells are the TEST_RULES ones: `shell` = Barrier (`valueBp 0`), `mirror-ward` = Reflect 5000, `sponge` = Absorb, `null-ward` = Counterspell 12500). `effectLands` is listed for spell cells and Spellblade strikes; "extras" are heals and tags:

| Variant | Cell | Result (no crit): toDefender / toAttacker / extras | Crit toDefender |
|---|---|---|---|
| att `strikeDmgBp +1000` | Strike×Ward | 53 / 0 | 79 |
| def `guardVsStrikeBp 5000` (Warrior r5) | Strike×Guard | 21 / 0 | 31 |
| def `counterDmgBp +2000` | Strike×Counter | 0 / 33 / `reflected` | n/a |
| def `spellTakenBp −2000` (Mirror Shield) | Spell×Guard | 14 / 0 / effectLands true | n/a |
| def `physTakenBp −5000` (Wisp) | Attack×Ward | 14 / 0 | 21 |
| def ward Barrier (`shell`, the 0.4× baseline) | Spell×Ward | 7 / 0 / effectLands false | n/a |
| def ward Barrier | Attack×Ward | 28 / 0 | 42 |
| def ward Reflect (`mirror-ward`, 5000) | Spell×Ward | 7 / 9 / `reflected` / effectLands false | n/a |
| def ward Absorb (`sponge`) | Spell×Ward | 0 / 0 / heal def 7 / `absorbed` / effectLands false | n/a |
| def ward Counterspell (`null-ward`, 12500) | Spell×Ward | 0 / 0 / `negated` / effectLands false | n/a |
| def ward Counterspell | Attack×Ward | 35 / 0 | 52 |
| def ward Counterspell | Strike×Ward | 61 / 0 | 91 |
| def `wardReflectBp 5000`, no ward spell (Cleric r5) | Spell×Ward | 18 / 9 / `reflected` / effectLands false | n/a |
| def `wardReflectBp 5000` + ward Barrier | Spell×Ward | 7 / 9 / `reflected` / effectLands false | n/a |
| att spell Hex (power 0) | Spell×Guard | 0 / 0 / effectLands true | n/a |
| att spell Hex, def no ward spell | Spell×Ward | 0 / 0 / effectLands false | n/a |
| att spell Leech (power 8000, drain 5000) | Spell×Counter | 9 / 0 / heal att 4 / effectLands true | n/a |
| att spell Leech, def no ward spell | Spell×Ward | 9 / 0 / effectLands false | n/a |
| att `lifestealBp 2000` | Attack×Counter | 35 / 0 / heal att 7 | 52 |
| att `spellbladeStrike 5000` | Strike×Guard | 51 / 0 / effectLands true | 72 |
| att `spellbladeStrike 5000` | Strike×Ward | 58 / 0 / effectLands false | 82 |
| att `spellbladeStrike 5000` | Strike×Counter | 0 / 28 / `reflected` / effectLands false | n/a |
| att `atk 1` (min-1 rule) | Attack×Guard | 1 / 0 | 1 |

### `resolveExchange` — one exchange (pure)
```ts
export interface Fighter { readonly isPlayer: boolean; readonly snap: Combatant; readonly mods: BattleMods; readonly gold: number; readonly bag: readonly ContentId[] }  // npc: gold 0, bag []
export interface ExchangeInput { readonly attacker: Fighter; readonly defender: Fighter; readonly command: string; readonly defense: DefenseCell | null }
export interface FighterAfter { readonly hp: number; readonly mods: BattleMods; readonly gold: number; readonly bag: readonly ContentId[] }
export interface ExchangeOutcome {
  readonly attacker: FighterAfter; readonly defender: FighterAfter; readonly crit: boolean;
  readonly damage: { readonly attacker: number; readonly defender: number }; readonly heal: { readonly attacker: number; readonly defender: number };
  readonly effects: readonly string[]; readonly fled: boolean;
}
```
`command` is `"flee"`, `"item:<id>"` or an `AttackCommand`; `defense` is `null` iff the command is flee/item. Steps (all draws through `draw`, in this order):
- **flee:** `u = draw(1, 10000)`; `fled = u <= fleeChanceBp(attacker, defender)`; effect `fled` / `flee-failed`.
- **item:** remove the **first** occurrence of the id from the attacker's bag; effect `item:<id>`; then by `effect.kind`: `heal` → `h = min(maxHp − hp, fl(maxHp × bp / 10000))`, `heal.attacker = h`; `cleanse` → negative `atk/def/mag/spd` mods set to 0, `poison = stun = false`; `flee` → effect `fled`, `fled = true` (no draw); `mod` → `mods[stat] = clamp(mods[stat] + bp, modMinBp, modMaxBp)`.
- **attack/strike/spell:** (1) if `isCritEligible` → `u = draw(1, 10000)`, `crit = u <= critChanceBp(attacker)`; (2) `r = computeCell(...)`; (3) `hpA = max(0, hpA − r.toAttacker)`, `hpD = max(0, hpD − r.toDefender)`, `damage` = actual HP lost; (4) if `hpA > 0` heal attacker `min(maxA − hpA, r.healAttacker)`; if `hpD > 0` heal defender `min(maxD − hpD, r.healDefender)`; (5) effects `...r.tags`; (6) if `r.effectLands`, by `attacker.snap.spell.effect.kind`: `stun` → `u = draw(1, 10000)`, if `u <= chanceBp` set defender `stun = true` + tag `stun`; `mod` → clamp-add to defender mods + tag `mod:<stat>:<bp>`; `stealGold` → only if defender is a player: `n = fl(defender.gold × bp / 10000)`, if `n > 0` move `n` gold to the attacker if the attacker is a player (else it vanishes; attacker gold saturates at MAX_COUNTER) + tag `steal-gold:<n>`; `drain` → tag `drain` iff `heal.attacker > 0`; (7) if command ∈ {attack, strike} and `r.toDefender > 0`, attacker on-hit hooks in order: `poisonOnHit > 0` → defender `poison = true` + tag `poison`; `stealGoldOnHitBp > 0` and defender is a player → `n = fl(gold × bp / 10000)`, if `n > 0` defender loses `n` (vanishes) + tag `steal-gold:<n>`; `stealItemOnHit > 0` and defender is a player with a non-empty bag → `i = draw(0, bag.length − 1)`, remove index `i` + tag `steal-item:<id>`.

### Combat flow state machine (W2, 02-03: `combat/options.ts`, `handlers/combat.ts`, `handlers/system.ts`)
```ts
// combat/options.ts (pure)
export const DEFENDER_OPTIONS: readonly DefendCommand[] = ["guard", "counter", "ward"];   // default "guard"
  // "ward" is ALWAYS offered, even with wardSpell === null (D2): then Spell×Ward uses the Guard multiplier
  // (computeCell step 3) but still blocks spell side effects; Attack/Strike×Ward use the ward column as usual.
export function attackerOptions(rules: Rules, ch: CharacterPublic, bag: readonly ContentId[]): string[];
  // ["attack", "strike", ...(ch.battleSpell !== null ? ["spell"] : []), "flee",
  //  ...("item:" + id for each distinct bag id, in first-occurrence order, whose use is "combat" or "both")]; default "attack"
export function exchangeRoles(c: CombatState): { attacker: 0 | 1; defender: 0 | 1 };   // exchange 1 → first; exchange 2 → 1 − first
export function requiredFor(c: CombatState): PlayerId[];
  // [attacker playerId if the attacker side is a player] + [defender playerId if the defender side is a player and not stunned]
  // (evaluated only when the attacker is not stunned)
```
```
combat/start ──► CombatStarted ──► startRound(1) ──► openExchange ─┬─► decision open (phase "decision") ── commits/timeout ──► reveal ──► resolveCurrent ─┐
                                                                    ├─► attacker stunned: clear stun, ExchangeSkipped ──► advance ──────────────────────────┤
                                                                    └─► no player must choose: resolveCurrent immediately ───────────────────────────────────┤
    ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
    ▼
 KO / double KO / fled ──► endCombat ;  else advance: exchange 1 → 2 ──► openExchange
                                                  exchange 2 → roundEnd ──► RoundEnded ──► round == maxRounds ? endCombat(draw) : startRound(round+1) ──► openExchange
```
- **`combat/start`** apply: `combatSeq += 1`, `id = "c" + combatSeq`; `sides[0] = {kind:"player", playerId: attacker, mods: ZERO}`, `sides[1]` = the opponent player side, or `{kind:"npc", npc, stats: npcStats(npc), hp: stats.hp, mods: ZERO}` (`ZERO = {atk:0,def:0,mag:0,spd:0,poison:false,stun:false}`); `combat = {id, round:1, exchange:1, first:0, sides}`; emit `CombatStarted`; then `startRound(1)`, then `openExchange`.
- **`startRound(r)`**: initiative from battle stats: higher `spd` goes first; on a tie `u = ctx.int(1, luck0 + luck1 + 2)` and `first = u <= luck0 + 1 ? 0 : 1`. Set `round = r, exchange = 1, first`; emit `RoundStarted`.
- **`openExchange`** (loop): roles from `exchangeRoles`. If the attacker side has `stun`: set its `stun = false`, emit `ExchangeSkipped`, **advance**, continue. Else build prompts: attacker (if player) `{options: attackerOptions, default: "attack"}`, then defender (if player and not stunned) `{options: DEFENDER_OPTIONS, default: "guard"}`; if any → `openDecision(kind "combat/exchange")` and stop; else **resolveCurrent** with no choices and continue.
- **`resolveCurrent(choices)`** (the `combat/exchange` resolver): (1) attacker command = the attacker player's revealed choice, or `drawNpcCommand(attackTable, ctx.int)`; (2) if the defender is stunned: set its `stun = false`, defense = `"open"` if the command is attack/strike/spell else `null`; else if the command is flee/item: defense `null` (a player defender's revealed choice is ignored; an NPC defender draws nothing); else defense = the defender player's choice or `drawNpcDefense(defendTable, ctx.int)`; (3) build `Fighter`s from snapshots (after the stun clear); (4) `resolveExchange(rules, input, ctx.int)`; (5) write hp/mods/gold/bag back (player hp/gold into `characters`, bag into `private`, npc hp into the side); (6) emit `ExchangeResolved`, then `BagUpdated` for each player whose bag changed (attacker first); (7) outcome: `fled` → end `fled` (`fled` = attacker side); both hp 0 → end `draw`; one hp 0 → end `ko`, winner = the other side; else **advance**.
- **advance**: exchange 1 → set `exchange = 2`. Exchange 2 → round end: for side 0 then 1 (both alive): poison first (`p = max(1, fl(maxHp × poisonBp / 10000))`, `hp = max(1, hp − p)`), then regen (`hooks.roundRegenBp > 0`: `+min(maxHp − hp, fl(maxHp × roundRegenBp / 10000))`); emit `RoundEnded`; if `round >= maxRounds` end `draw`, else `startRound(round + 1)`.
- **endCombat(outcome, winner, fled)**: emit `CombatEnded`; set `combat = null` (phase is already `"turn"` after the reveal; pending/prompts already cleared). In W3 (02-04) a `ko` whose winner side is a player then calls `awardVictory` (see Progression). Players keep their hp (a KO leaves hp 0); battle mods vanish.
- **Invariant** (checked by `deserialize`): `combat !== null` ⇔ `phase === "decision" && pending.kind === "combat/exchange"`; every combat side has hp ≥ 1; `pending.required` equals `requiredFor(combat)`; prompts equal the prompts `openExchange` would build.

**RNG draw order (per `reduce` call, all via `ctx.int`):** initiative tie draw (round start, only on SPD tie) → per exchange: NPC attacker command → NPC defender command → flee `(1,10000)` → crit `(1,10000)` → stun `(1,10000)` → steal-item `(0, len−1)`; each only when its condition holds.

**`system/setCharacter`** apply (`handlers/system.ts`): `character = {...ch, classId, level, xp: xpCurve[level − 1], weapon, shield, accessory, battleSpell, wardSpell}`, then `hp = sheetStats(...).hp` (full heal, also revives); `private.bag = [...bag]` (scrolls, prompt, mastery, gold, portable unchanged); emit `CharacterSet`, then `BagUpdated`. It bypasses hybrid unlock and starter rules on purpose (sim/test scenarios; system actor only).

**Combat golden (W2, `core/test/combat-golden.test.ts`, TEST_RULES)** — settings `{v:2, seed:"combat-golden", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}`, 18 actions, 0 rejections, 80 events, final `hashState = ec0c3508` (oracle summary `0 rejections ([]), 80 events, final hashState = ec0c3508`; per-action trace `traces/combat-golden.trace.json`):
```json
[{"v":2,"type":"system/setCharacter","playerId":"system","target":"p1","classId":"battlemage","level":1,"weapon":"stick","shield":"mirror","accessory":"band","battleSpell":"jolt","wardSpell":"mirror-ward","bag":["herb","tonic"]},
 {"v":2,"type":"combat/start","playerId":"system","attacker":"p1","opponent":{"kind":"player","playerId":"p2"}},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d1","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d1","choice":"counter"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d2","choice":"item:tonic"},
 {"v":2,"type":"timeout","playerId":"system","decisionId":"d2"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d3","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d3","choice":"ward"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d4","choice":"strike"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d4","choice":"counter"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d5","choice":"item:bomb"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d5","choice":"guard"},
 {"v":2,"type":"combat/start","playerId":"system","attacker":"p2","opponent":{"kind":"npc","npc":{"kind":"monster","id":"gull","senior":false}}},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d6","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d7","choice":"attack"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d8","choice":"counter"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d9","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d10","choice":"strike"}]
```
`ExchangeResolved` sequence plus `ExchangeSkipped`/`CombatEnded` markers (combat, round.exchange, attacker side, command / defense → damage [side0, side1], heal, effects, hp after):

| # | c | r.e | att | command / defense | damage | heal | effects | hp after |
|---|---|---|---|---|---|---|---|---|
| 1 | c1 | 1.1 | 0 | spell / counter | [0,8] | [0,0] | `stun` | [44,28] |
| — | c1 | 1.2 | 1 | `ExchangeSkipped` (stunned) | | | | |
| 2 | c1 | 2.1 | 0 | item:tonic / null | [0,0] | [0,0] | `item:tonic` | [44,28] |
| 3 | c1 | 2.2 | 1 | spell / ward | [2,4] | [0,0] | `reflected` | [42,24] |
| 4 | c1 | 3.1 | 0 | strike / counter | [20,0] | [0,0] | `reflected` | [22,24] |
| 5 | c1 | 3.2 | 1 | item:bomb / null | [0,0] | [0,0] | `item:bomb`, `fled` | [22,24] |
| end | c1 | — | — | `CombatEnded fled` winner null fled 1 | | | | [22,24] |
| 6 | c2 | 1.1 | 1 | strike / guard | [13,0] | [0,0] | `steal-gold:10`, `steal-item:herb` | [11,36] |
| 7 | c2 | 1.2 | 0 | attack / guard | [0,6] | [0,0] | — | [11,30] |
| 8 | c2 | 2.1 | 1 | flee / null | [0,0] | [0,0] | `flee-failed` | [11,30] |
| 9 | c2 | 2.2 | 0 | spell / ward | [0,12] | [0,0] | — | [11,18] |
| 10 | c2 | 3.1 | 0 | strike / counter | [11,0] | [0,0] | `reflected` | [0,18] |
| end | c2 | — | — | `CombatEnded ko` winner 1 fled null | | | | [0,18] |

Notes: #2 — p2 timed out (default `guard`), ignored because the command is an item. #3 — p1 wards with Reflect (`mirror-ward`) + Mirror Shield (`spellTakenBp −2000`). #6 — the gull's Strike steals 10 gold and the herb. #7, #9, #10 — the gull's defenses are drawn. **#9 changed in Revision 2 (D2):** the gull has **no ward spell**, so its Ward takes the Guard multiplier: `spellBase` 11 × 10000 bp = 11, +10% caster r1 `spellDmgBp` → **12** (was 4 under the old always-0.4× rule; row #10's hp changed accordingly). The final `hashState` is unchanged by D2 because the gull's hp is not part of the final state (combat is `null`); the per-action trace (`traces/combat-golden.trace.json`) pins the difference. c2 ends `ko` winner 1 (npc: no reward).

Round starts: c1 `first` = 0, 0, 0; c2 `first` = 1, 1, 0. Final: p1 hp 22, bag `["herb"]`; p2 hp 0, gold 90, bag `[]`; `choiceHistory.p1 = {attack:0,strike:1,spell:1,guard:1,counter:0,ward:1}`, `choiceHistory.p2 = {attack:1,strike:1,spell:2,guard:1,counter:3,ward:0}` (the timed-out `guard` at d2 is not counted); `hidden = {combatSeq:2, decisionSeq:10, decision:null, rng:[3200512360,239253250,3363130012,583700052]}`. Event type sequence (80):
`CharacterSet, BagUpdated, CombatStarted, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, ExchangeSkipped, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted, ChoiceTimedOut, ChoicesRevealed, ExchangeResolved, BagUpdated, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, BagUpdated, CombatEnded, CombatStarted, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, BagUpdated, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, CombatEnded`.
The scenario ends every combat without a player KO win, so the W3 reward logic cannot change this hash.

### `serialize.ts` — `deserialize(json, rules)` v2 (W1b, 02-01b; 02-01a ships only the shim described in *Deliverables*; 02-03 adds check 8)
`serialize(state)` = `stableStringify(state)` (unchanged). `deserialize(json: string, rules: Rules): GameState`: `JSON.parse` (SyntaxError propagates); not a plain object → `TypeError`; `v !== 2` → `SchemaVersionError`; then every check below, in this order, each throwing `TypeError("deserialize: <unique message>")`. **Exact own keys at every object level** (root, public, private entries, hidden, characters, mastery, choiceHistory entries, prompt, pending, decision, lastReveal, combat, sides, npc refs, stats, mods). All player-/content-keyed lookups via `ownGet`.
1. Root / partitions: plain objects, exact keys (`v, public, private, hidden`; public: `phase, turn, activePlayer, players, characters, choiceHistory, pending, lastReveal, combat`; hidden: `rng, decisionSeq, combatSeq, decision`).
2. `players` (same rules as `createGame`), `activePlayer ∈ players`, `phase ∈ {turn, decision}`, `turn`, `decisionSeq`, `combatSeq` integers in `[0, MAX_COUNTER]`, `rng` 4 × u32.
3. `characters`: own keys = players; each: `classId` ∈ rules.classes; `level` int in `[1, maxLevel]`; `xp` in `[0, MAX_COUNTER]` and `level === levelForXp(xp)`; `gold` in `[0, MAX_COUNTER]`; `mastery` own keys = all rule class ids, values in `[0, MAX_COUNTER]`; `portable` null or a class id with `masteryRank === 5`; each gear slot null or a gear id **of that slot**; spells null or ids in the right table; `hp` int in `[0, MAX_STAT]` and `hp <= sheetStats(...).hp`.
4. `choiceHistory`: own keys = players; each exactly the 6 command keys, values in `[0, MAX_COUNTER]`.
5. `private`: own keys = players; `bag` array of item ids, length ≤ class `bagSize`; `scrolls` array of field-spell ids, length ≤ `maxScrolls`; `prompt` null or `{decisionId, options, default}` (options: 1..24 unique tokens; default ∈ options).
6. Decision consistency: `phase === "turn"` ⇒ `pending`, `hidden.decision`, every `prompt` null and `combat` null. `phase === "decision"` ⇒ `pending` `{id, kind, required, committed}` with `id === "d" + decisionSeq`, `kind ∈ DecisionKind`, `required` non-empty unique ⊆ players, `committed` unique ⊆ required and `committed.length < required.length`; `hidden.decision {id === pending.id, choices}` with own keys = committed and each value ∈ that player's prompt options; `prompt !== null` exactly for required players, each with `decisionId === pending.id`.
7. `lastReveal`: null or `{decisionId, kind, choices, timedOut}`: choices own keys ⊆ players, values tokens; `timedOut` unique ⊆ choice keys.
8. Combat (**02-03 adds this; in W1b the check is "combat must be null" and `kind === "combat/exchange"` is rejected with "combat decisions unsupported"**): `combat !== null` ⇔ `pending?.kind === "combat/exchange"`; `id === "c" + combatSeq`; `round ∈ [1, maxRounds]`; `exchange ∈ {1,2}`; `first ∈ {0,1}`; `sides` length 2, `sides[0]` a player side; player sides: seated, distinct; npc sides: valid `NpcRef` (ids exist, `townTier` 1..4, `level` 1..maxLevel), `stats` deep-equal `npcStats(rules, npc)`, `hp` in `[1, stats.hp]`; `mods` ints in `[modMinBp, modMaxBp]` and booleans; every player side's character `hp >= 1`; `pending.required` equals `requiredFor(combat)`; each prompt deep-equals the one `openExchange` would build.

Every state `reduce` produces must pass `deserialize(serialize(s), rules)` (property test). Handlers reject (`INVALID_PAYLOAD`) any transition that would push a bounded counter above `MAX_COUNTER` where the transition is player/system-requested (`decision/open`, `combat/start`, `system/grant`); internal awards (`choiceHistory`, reward XP/gold/mastery, stolen gold) **saturate** at `MAX_COUNTER`.

### Progression (W3, 02-04: `progression.ts`, reward hook in `handlers/combat.ts`)
```ts
export function hybridsUnlocked(rules: Rules, mastery: Readonly<Record<ContentId, number>>): ContentId[];  // sorted hybrid ids whose both parents have rank >= hybridUnlockRank
export function applyXp(rules: Rules, ch: CharacterPublic, amount: number): { character: CharacterPublic; levelsGained: number[] };  // saturating xp, level = levelForXp, hp via adjustHp
export function victoryReward(rules: Rules, loser: CombatSide, loserLevel: number): { xp: number; gold: number };
export function awardVictory(rules: Rules, ch: CharacterPublic, reward: { xp: number; gold: number }): { character: CharacterPublic; events: /* see below */ };
```
- **Reward** (only when `outcome === "ko"` and the winner side is a player): loser player → `xp = pvpXpPerLevel × loser.level`, `gold = 0` (PvP spoils are Phase 5); monster → `xp = fl(def.xp × m / 10000)`, `gold = fl(def.gold × m / 10000)` with `m = senior ? seniorRewardBp : 10000`; guardian → `xpPerTier × townTier`, `goldPerTier × townTier`; enforcer → `xpPerLevel × level`, `goldPerLevel × level`.
- **Apply**: `oldMax` = sheet hp; `xp += reward.xp`, `level = levelForXp`, `gold += reward.gold`, `mastery[classId] += 1` (all saturating); `hp = adjustHp(oldMax, newMax, hp)`.
- **Events** (after `CombatEnded`, in order): `VictoryRewarded {playerId, xp, gold, classId, masteryWins}`; `LevelUp` per level gained; `MasteryRankUp {classId, rank}` if the rank increased; `HybridUnlocked` for each hybrid newly unlocked (ascending id).
- Mastery ranks: rank `r` at wins ≥ `masteryWins[r−1]` = `[0, 3, 7, 12, 18]`. Passives of ranks ≤ rank are active in the current class. Hybrids have their own mastery and passives. **Portable**: `loadout/setPortable` sets `portable` (rank-5 check); its rank-5 passive is active whenever the current class differs; `null` clears; emit `PortableSet {playerId, classId, hp}` (hp via `adjustHp`).

### Inventory and loadout (W3, 02-04: `inventory.ts`, `handlers/loadout.ts`)
```ts
export type InvResult<T> = T | Reject;            // Reject = { code: "INVALID_PAYLOAD", message } (messages as in the handler table)
export function isReject(x: unknown): x is Reject;
export function addItem(rules: Rules, classId: ContentId, bag: readonly ContentId[], itemId: ContentId): InvResult<ContentId[]>;
export function removeItem(bag: readonly ContentId[], itemId: ContentId): InvResult<ContentId[]>;   // first occurrence
export function addScroll(rules: Rules, scrolls: readonly ContentId[], spellId: ContentId): InvResult<ContentId[]>;
export function equipGear(rules: Rules, ch: CharacterPublic, gearId: ContentId): InvResult<CharacterPublic>;   // into its own slot, replacing
export function setSpell(rules: Rules, ch: CharacterPublic, kind: "battleSpell" | "wardSpell", id: ContentId): InvResult<CharacterPublic>;
export function planClassSwitch(rules: Rules, ch: CharacterPublic, bag: readonly ContentId[], classId: ContentId, discard: readonly ContentId[]): InvResult<{ character: CharacterPublic; bag: ContentId[] }>;
```
- **`system/grant`**: emit `Granted` first; then `item` → `addItem` + `BagUpdated`; `scroll` → `addScroll` + `ScrollsUpdated`; `gear` → `equipGear`; `battleSpell`/`wardSpell` → `setSpell`; `gold` → `gold += amount`; `xp` → `applyXp` + `LevelUp` per level. Any sheet change applies `adjustHp` (a KO'd character stays at 0).
- **`loadout/switchClass`**: validation as in the table; apply: bag minus `discard`, `gold −= switchFee`, `classId = new`, `hp = adjustHp(...)`; emit `ClassSwitched {playerId, from, to, fee, hp}`, then `BagUpdated` iff `discard` is non-empty. Mastery is kept per class. Phase 3 will restrict switching to the Castle; Phase 2 allows it in phase `turn` anywhere.
- **`loadout/discard`**: remove first occurrence; `BagUpdated`.
- **`loadout/useItem`**: remove first occurrence; heal `min(maxHp − hp, fl(maxHp × bp / 10000))`; emit `ItemUsed {playerId, itemId, healed, hp}`, then `BagUpdated`.
- Gear is never in the bag; acquiring gear or a spell replaces the equipped one (the old one is discarded; selling is Phase 3). Field-spell scrolls never occupy bag space (cap `maxScrolls = 3`).

**Rewards/loadout golden (W3, 02-04, `core/test/rewards-golden.test.ts`, TEST_RULES)** — settings `{v:2, seed:"rewards-golden", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}`, these 25 actions, 0 rejections, 84 events, final `hashState = 57da3ea4` (oracle summary `0 rejections ([]), 84 events, final hashState = 57da3ea4`; per-action trace `traces/rewards-golden.trace.json`):
```json
[{"v":2,"type":"system/grant","playerId":"system","target":"p1","grant":{"kind":"item","id":"tonic"}},
 {"v":2,"type":"combat/start","playerId":"system","attacker":"p1","opponent":{"kind":"npc","npc":{"kind":"monster","id":"slime","senior":false}}},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d1","choice":"strike"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d2","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d3","choice":"strike"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d4","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d5","choice":"attack"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d6","choice":"counter"},
 {"v":2,"type":"loadout/useItem","playerId":"p1","itemId":"herb"},
 {"v":2,"type":"combat/start","playerId":"system","attacker":"p2","opponent":{"kind":"player","playerId":"p1"}},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d7","choice":"strike"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d7","choice":"counter"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d8","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d8","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d9","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d9","choice":"counter"},
 {"v":2,"type":"system/grant","playerId":"system","target":"p2","grant":{"kind":"xp","amount":150}},
 {"v":2,"type":"system/grant","playerId":"system","target":"p2","grant":{"kind":"gold","amount":200}},
 {"v":2,"type":"system/grant","playerId":"system","target":"p2","grant":{"kind":"item","id":"antidote"}},
 {"v":2,"type":"system/grant","playerId":"system","target":"p2","grant":{"kind":"item","id":"wig"}},
 {"v":2,"type":"system/grant","playerId":"system","target":"p2","grant":{"kind":"scroll","id":"haste"}},
 {"v":2,"type":"system/grant","playerId":"system","target":"p2","grant":{"kind":"gear","id":"sword"}},
 {"v":2,"type":"system/grant","playerId":"system","target":"p2","grant":{"kind":"wardSpell","id":"sponge"}},
 {"v":2,"type":"loadout/switchClass","playerId":"p2","classId":"fighter","discard":["wig"]},
 {"v":2,"type":"loadout/discard","playerId":"p1","itemId":"tonic"}]
```
Checkpoints: c1 (p1 vs slime, stats `40/12/8/10/9/4`) ends `ko` winner 0 in round 3.2 (the slime's Strike is reflected) → `VictoryRewarded {p1, xp:20, gold:30, classId:"fighter", masteryWins:1}`; `loadout/useItem herb` → `ItemUsed {p1, herb, healed:14, hp:36}` then `BagUpdated`; c2 (p2 vs p1) ends `ko` winner 0 at round 2.1 → `VictoryRewarded {p2, xp:10, gold:0, classId:"caster", masteryWins:1}`; the xp grant emits `LevelUp` 2 and 3 (p2 hp 36 → 50 via `adjustHp`); the scroll grant emits `ScrollsUpdated ["haste"]`; `ClassSwitched {p2, from:"caster", to:"fighter", fee:50, hp:67}` then `BagUpdated ["herb","bomb","antidote"]`; finally `BagUpdated` for p1 (`[]`). Final characters: p1 `{fighter, L1, xp 20, gold 130, hp 0, mastery.fighter 1, bag []}`; p2 `{fighter, L3, xp 160, gold 250, hp 67, weapon "sword", wardSpell "sponge", mastery.caster 1, scrolls ["haste"]}`. Exchange table (same format as the combat golden):

| # | c | r.e | att | command / defense | damage | heal | effects | hp after |
|---|---|---|---|---|---|---|---|---|
| 1 | c1 | 1.1 | 0 | strike / guard | [0,29] | [0,0] | — | [48,11] |
| 2 | c1 | 1.2 | 1 | attack / guard | [4,0] | [0,0] | — | [44,11] |
| 3 | c1 | 2.1 | 0 | strike / counter | [18,0] | [0,0] | `reflected` | [26,11] |
| 4 | c1 | 2.2 | 1 | attack / guard | [4,0] | [0,0] | — | [22,11] |
| 5 | c1 | 3.1 | 0 | attack / guard | [0,9] | [0,0] | — | [22,2] |
| 6 | c1 | 3.2 | 1 | strike / counter | [0,2] | [0,0] | `reflected` | [22,0] |
| end | c1 | — | — | `CombatEnded ko` winner 0 fled null | | | | [22,0] |
| 7 | c2 | 1.1 | 1 | strike / counter | [0,17] | [0,0] | `reflected` | [36,19] |
| 8 | c2 | 1.2 | 0 | spell / guard | [0,11] | [0,0] | — | [36,8] |
| 9 | c2 | 2.1 | 0 | spell / counter | [0,8] | [0,0] | — | [36,0] |
| end | c2 | — | — | `CombatEnded ko` winner 0 fled null | | | | [36,0] |

Final `hidden = {combatSeq:2, decisionSeq:9, decision:null, rng:[2320551141,1615250627,3129816856,743918455]}`; `choiceHistory.p1 = {attack:1,strike:3,spell:0,guard:3,counter:2,ward:0}`, `choiceHistory.p2 = {attack:0,strike:0,spell:2,guard:0,counter:1,ward:0}`. Event type sequence (84): `Granted, BagUpdated, CombatStarted, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, CombatEnded, VictoryRewarded, ItemUsed, BagUpdated, CombatStarted, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, CombatEnded, VictoryRewarded, Granted, LevelUp×2, Granted×2, BagUpdated, Granted, BagUpdated, Granted, ScrollsUpdated, Granted×2, ClassSwitched, BagUpdated×2`.

### CPU AI (W3, 02-05: `core/src/ai/{index,combat,opponent-model,tuning,exp}.ts`, subpath `@usurpia/core/ai`)
```ts
export type Difficulty = "easy" | "normal" | "hard";
export interface AiState { readonly rng: RngState; readonly playerId: PlayerId; readonly difficulty: Difficulty }
export function createAi(seed: string, playerId: PlayerId, difficulty: Difficulty): AiState;
  // rng = seedRng(`${seed}\u0000ai\u0000${playerId}\u0000${difficulty}`); seed = the game's settings.seed (the caller passes it)
export interface AiDecision { readonly action: Action | null; readonly ai: AiState }
export function decideCombat(view: PlayerView, rules: Rules, ai: AiState): AiDecision;   // pure; never mutates inputs
export interface Policy { readonly commands: readonly Command[]; readonly weights: readonly number[]; readonly ev: readonly number[] | null }
export function combatPolicy(view: PlayerView, rules: Rules, difficulty: Difficulty): Policy;   // no RNG
export const AI_TUNING = { healThresholdBp: 3500, easyForgetHealBp: 3000, koBonus: 0.5, normalTemp: 0.15, hardTemp: 0.04, hardPriorStrength: 4, weightScale: 1_000_000 } as const;
export function expNeg(x: number): number;                        // ai/exp.ts — see step 7
```
`decideCombat` returns `{action: null, ai}` (unchanged `ai`) unless `view.self?.prompt` is non-null, `view.public.pending` is non-null with `kind === "combat/exchange"`, `pending.id === prompt.decisionId` and the viewer has not committed. Otherwise it returns `{v:2, type:"decision/commit", playerId: viewer, decisionId, choice}` and the advanced `ai`. All random draws use `nextInt(ai.rng, …)` and thread the returned state.

**Algorithm** (floats allowed inside the AI but only IEEE `+ − × ÷`, comparisons and `Math.floor/round/min/max`; evaluate in exactly this order; `fl` = `Math.floor`):
1. Sides: `mi` = index of the player side with `playerId === viewer`, `oi = 1 − mi`; `me = snapshot(sides[mi])`, `op = snapshot(sides[oi])` via `snapshotPlayer(rules, public.characters[id], side.mods)` / `snapshotNpc`. Role: `attacker` iff `prompt.options` includes `"attack"`.
2. **Heal rule** (attacker only): if `me.hp × 10000 <= me.maxHp × healThresholdBp` and some option `item:<id>` has `effect.kind === "heal"`: Easy draws `u = nextInt(1, 10000)` and **forgets** iff `u <= easyForgetHealBp`. If not forgotten: `amount(o) = fl(maxHp × bp / 10000)`; among heal options with `amount ≥ maxHp − hp` pick the smallest amount, else the largest amount (ties: earlier option); commit it. AI never chooses `flee` or non-heal items in Phase 2.
3. `mine` = `ATTACK_COMMANDS` (attacker) or `DEFEND_COMMANDS` (defender), filtered to those in `prompt.options`, in that order. `base[k] = classes[public.characters[viewer].classId].aiBias[k]`; if all 0 → all 1.
4. **Easy:** weights = `base`; draw.
5. **Opponent distribution** `q` over `okeys`: if the opponent is the defender and stunned → `okeys = ["open"]`, `q = [1]`. Else `okeys` = `["attack","strike"]` + `["spell"]` iff `op.spell !== null` (opponent attacker) or `DEFEND_COMMANDS` (opponent defender). Prior weights `w`: opponent player → `classes[opp.classId].aiBias[k]`; npc → its `attackTable[k]` / `defendTable[k]` (flee ignored); all 0 → all 1; `pn = w / Σw`. **Normal:** `q = pn`. **Hard:** opponent player → `q_i = (n_i + α·pn_i) / (N + α)` with `n_i = public.choiceHistory[oppId][okeys_i]`, `N = Σ n_i`, `α = hardPriorStrength`; npc → `q = pn` (tables are public data).
6. **EV:** for my command `k`: `ev_k = Σ_i q_i × val(pair)` summed in `okeys` order from 0, where the pair is `(k, okeys_i)` if I attack, `(okeys_i, k)` if I defend. `val(a, d)`: `att/def` = the attacking/defending snapshot; `p = isCritEligible(a, d) ? critChanceBp(att) / 10000 : 0`; `r0 = computeCell(…, false)`, `r1 = p > 0 ? computeCell(…, true) : r0`; each of `toDefender, toAttacker, healAttacker, healDefender` is `(1 − p)·r0 + p·r1`; `v = (min(toDef, def.hp) − healDef)/def.maxHp − (min(toAtt, att.hp) − healAtt)/att.maxHp + (toDef ≥ def.hp ? koBonus : 0) − (toAtt ≥ att.hp ? koBonus : 0)`; return `v` if I attack, `−v` if I defend. Spell side effects are ignored by EV.
7. **Softmax (engine-independent):** `z_k = ev_k / T` with `T = normalTemp` (Normal) or `hardTemp` (Hard); `M = max z` (`Math.max`); `f_k` = Normal: `base_k > 0 ? base_k : 1e-9`, Hard: `1`; `e_k = f_k × expNeg(z_k − M)`; `s = Σ e_k` (in `mine` order from 0); integer weights `w_k = Math.round(e_k / s × weightScale)`. (Mathematically identical to the softmax of `ln f_k + z_k`, but it needs no `Math.log`.)
   `expNeg(x)` (`ai/exp.ts`, exported for tests; `x ≤ 0`, else `RangeError`): `if (x < -700) return 0`; `LN2 = 0.6931471805599453`; `k = Math.round(x / LN2)`; `r = x − k × LN2`; `p = 1`; `for (i = 13; i >= 1; i--) p = 1 + r × p / i`; then `-k` times `p = p × 0.5`; return `p`. Only IEEE-754 `+ − × ÷`, comparisons and `Math.round`/`Math.max` (all exactly specified by ECMAScript) are used anywhere in the AI, so every AI golden is identical on every conforming engine. `ai-exp.test.ts` pins `expNeg(0) === 1`, `expNeg(-1) === 0.36787944117144233`, `expNeg(-700.5) === 0`, `|expNeg(x) / Math.exp(x) − 1| < 1e-13` for 1 000 sampled `x ∈ [−40, 0]` (the only place `Math.exp` appears, in a test), and the `RangeError`.
8. **Draw:** `u = nextInt(1, Σw)`; pick the first `k` whose running sum ≥ `u`.

**AI goldens (`ai.test.ts`, TEST_RULES):** state = `createGame({v:2, seed:"ai", players:[p1 fighter, p2 caster]})` then `combat/start p1 vs player p2` (round 1 first = 0, p1 attacks, prompts `p1: [attack, strike, spell, flee, item:herb]`, `p2: [guard, counter, ward]`). `combatPolicy(viewFor(s, p), TEST_RULES, d)`:

| choiceHistory (both players) | viewer | difficulty | commands | weights | ev (6 dp) |
|---|---|---|---|---|---|
| all 0 | p1 | easy | attack, strike, spell | 40, 40, 20 | — |
| all 0 | p1 | normal | attack, strike, spell | 241220, 750409, 8371 | 0.427944, 0.598181, 0.027778 |
| all 0 | p1 | hard | attack, strike, spell | 13982, 986017, 1 | same |
| all 0 | p2 | easy | guard, counter, ward | 30, 20, 50 | — |
| all 0 | p2 | normal | guard, counter, ward | 152259, 752677, 95065 | −0.402472, −0.101944, −0.54975 |
| all 0 | p2 | hard | guard, counter, ward | 546, 999441, 14 | same |
| `strike: 20` | p2 | hard | guard, counter, ward | 0, 1000000, 0 | −0.704868, 0.278148, −0.823975 |
| `guard: 20` | p1 | hard | attack, strike, spell | 7, 999993, 0 | 0.260444, 0.737486, 0.027778 |
| `strike: 20` or `guard: 20` | any | normal | unchanged from the all-0 rows (Normal ignores history) | | |

(Revision 2 recomputed this table with the `expNeg` softmax: every weight and ev is unchanged.) `decideCombat` with `createAi("ai", p, d)` on the all-0 state chooses: p1 easy `strike` / normal `strike` / hard `strike`; p2 easy `counter` / normal `counter` / hard `counter`. Resulting `ai.rng`: p1 easy `[3331102407,1535445285,772308753,1112744324]`, p1 normal `[4183196888,813986969,677920980,3243803346]`, p1 hard `[1366581972,206714184,2346612497,1782913445]`, p2 easy `[3836409917,3572200996,801488308,1210260529]`, p2 normal `[91016355,297186996,1934346612,4099156348]`, p2 hard `[1549760109,3612060378,2996506608,524471693]`.

**Never reads hidden information:** enforced by (a) the signature (`PlayerView` + `Rules` only), (b) lint on `core/src/ai/**` banning imports of `reducer`, `handlers/*`, the core barrel `index`, `serialize`, `game`, `replay`, `@usurpia/core`, and the `GameState`/`HiddenState` names from any module (see *Lint and purity probe*), and (c) `ai-hidden.test.ts`: from a PvP state where the opponent has already committed, build variants that differ **only** in `hidden.rng`, `hidden.decision.choices[opponent]` (each of the 3 defend commands) and the opponent's `private` (bag contents and prompt options); assert `viewFor(variant, me)` is deep-equal across variants and `decideCombat` returns identical actions and identical `ai.rng` for all 3 difficulties. The test first asserts the variants really differ (`hashState` pairwise distinct) so it cannot pass vacuously (PIT-001).

### `@usurpia/content` (W2, 02-02)
```ts
// src/index.ts (browser-safe)
export { IdSchema } from "./schemas/common";             // CONTENT_ID_PATTERN, refine: not in RESERVED_CONTENT_IDS (message "reserved id")
export { ClassesFileSchema, GearFileSchema, ItemsFileSchema, SpellsFileSchema, MonstersFileSchema, TuningFileSchema } from "./schemas/…";
export { CONTENT_REGISTRY, REQUIRED_FILES } from "./registry";   // the 6 files below, all required
export { validateContent, type ContentEntry, type ContentError } from "./validate";   // schema + duplicate ids + cross-refs (via buildRules)
export { buildRules, type BuildResult } from "./build-rules";
// BuildResult = { ok: true; rules: Rules } | { ok: false; errors: ContentError[] }
// src/node.ts (Node-only; package export "./node")
export { loadContentDir } from "./load";
export function loadRules(dir?: string | URL): Rules;    // default dir = ../data/; throws Error("content invalid: <n> errors") on failure
```
- `buildRules(entries)` = `validateContent`-equivalent checks, then assembles `Rules` (records keyed by id, display text stripped, `v: 1`). `validateContent(entries)` returns `buildRules(entries).errors` (or `[]`), sorted by file then path, so the CLI gate, tests and `buildRules` share one code path.
- **File schemas** (`z.strictObject` everywhere; every file `{ v: 1, … }`; ints are `z.number().int()`):
  - `classes.json` `{v, classes: ClassEntry[]}`; `ClassEntry` = `ClassDef` fields + `name` (1..40), `description` (1..200); `passives[]` entries add `name`, `description`.
  - `gear.json` `{v, gear: (GearDef + name, description)[]}` (`stats` requires all six keys).
  - `items.json` `{v, items: (ItemDef + name, description)[]}` (replaces the Phase 1 schema; the old `kind: "gear"` value is gone).
  - `spells.json` `{v, battle: (BattleSpellDef + name, description)[], ward: (WardSpellDef + …)[], field: (FieldSpellDef + …)[]}`.
  - `monsters.json` `{v, curve: StatBlock[5], monsters: (MonsterDef + name, tagline 1..120)[], guardians: (GuardianDef + name, description)[], enforcer: EnforcerDef + name, description}`.
  - `tuning.json` `{v, combat: CombatTuning, progression: ProgressionTuning, economy: EconomyTuning}`.
  - Ranges: `statBp` 1..100000; hook `value` −10000..100000; table weights and `aiBias` 0..1000 / 0..100; prices 0..1_000_000; gear `stats` −999..999; curve stats 0..MAX_STAT with hp ≥ 1; `bagSize` 1..16; `maxRounds` 1..10; `maxLevel` 1..99; bp tuning fields −100000..100000.
- **Cross-reference rules** (each its own `ContentError` with a unique message; path like `classes.4.parents.1`): duplicate ids per collection; ≥ 1 base class; base ⇒ `parents` null and `starter` non-null; hybrid ⇒ `parents` = two distinct **base** class ids and `starter` null; `passives` length 5 with `rank === index + 1`; starter gear ids exist **with the matching slot**, spell ids exist in the right table, bag ids exist, `bag.length ≤ bagSize`; NPC `battleSpell`/`wardSpell` ids exist; `attackTable.spell === 0` when `battleSpell` is null; attack-table sum > 0 and defend-table sum > 0; `aiBias` attack+strike+spell > 0 and guard+counter+ward > 0; `curve` length 5; `xpCurve.length === maxLevel`, `xpCurve[0] === 0`, strictly increasing, ≤ MAX_COUNTER; `masteryWins` length 5, `[0] === 0`, strictly increasing; `hybridUnlockRank` 1..5; `enforcer.id === "crown-enforcer"`; NPC (monster, guardian, enforcer) hooks must not be sheet-stat hooks `hpBp`/`atkBp`/`defBp`/`magBp`/`spdBp`/`luckBp` (message "npc sheet-stat hooks are not applied", path e.g. `monsters.monsters.15.hooks.0.hook`); monster `zone` ∈ `{enchanted-forest, soggy-coast, goblin-mines, bureaucrat-bog}`.
- **Pinned:** `rulesHash(loadRules()) === "84a995db"` (`data.test.ts`). Any later tuning change must update this pin, the sim fixture, the sim goldens and the gate goldens in the same commit, with a note in the plan summary.
- The CLI build gate (`scripts/validate.ts`) is unchanged in behaviour (exit 0/1/2). Test fixture dirs `test/fixtures/{valid,invalid}` are **deleted**; tests build temp dirs by copying `data/` and corrupting exactly one file (PIT-001).

#### Content data (initial tuning)
Zones: `enchanted-forest` (T1), `soggy-coast` (T2), `goblin-mines` (T3), `bureaucrat-bog` (T4).

##### Classes (`classes.json`)
| id | name | kind | parents | statBp hp/atk/def/mag/spd/luck | bagSize | switchFee | aiBias atk/str/spl/grd/ctr/wrd |
|---|---|---|---|---|---|---|---|
| `warrior` | Warrior | base | — | 11500/11500/11500/8500/9000/9000 | 5 | 100 | 30/50/20/50/30/20 |
| `thief` | Thief | base | — | 9500/10000/9000/8000/13000/14000 | 8 | 100 | 50/30/20/35/40/25 |
| `mage` | Mage | base | — | 8500/7500/8500/13000/10000/10000 | 6 | 100 | 30/20/50/40/30/30 |
| `cleric` | Cleric | base | — | 10500/9500/11000/12000/9000/10000 | 6 | 100 | 35/20/45/35/25/40 |
| `spellblade` | Spellblade | hybrid | warrior + mage | 11000/11500/10000/11500/9500/9000 | 6 | 300 | 30/45/25/40/35/25 |
| `shadowpriest` | Shadowpriest | hybrid | thief + cleric | 10000/10000/9500/11000/12000/12000 | 7 | 300 | 45/30/25/35/35/30 |

Passives (rank 1 → 5; `{hook, value}`; ★ = combat hook implemented in Phase 2, ☐ = board hook, data-only until Phase 3/5):

| class | r1 | r2 | r3 | r4 | r5 (portable) |
|---|---|---|---|---|---|
| `warrior` | `brawler` "Brawler" ★ `strikeDmgBp` 1000 | `thick-skin` "Thick Skin" ★ `hpBp` 1000 | `shield-wall` "Shield Wall" ★ `defBp` 1000 | `battle-rhythm` "Battle Rhythm" ★ `attackDmgBp` 1000 | `unbreakable` "Unbreakable" ★ `guardVsStrikeBp` 5000 |
| `thief` | `sticky-fingers` "Sticky Fingers" ☐ `pvpExtraSteal` 1 | `quick-feet` "Quick Feet" ★ `fleeBp` 2000 | `lucky-break` "Lucky Break" ★ `critBp` 500 | `fleet` "Fleet" ★ `spdBp` 1000 | `pickpocket` "Pickpocket" ☐ `passPickpocketBp` 500 |
| `mage` | `frugal-caster` "Frugal Caster" ☐ `spellPriceBp` -2500 | `focus` "Focus" ★ `spellDmgBp` 1000 | `arcane-mind` "Arcane Mind" ★ `magBp` 1000 | `overcharge` "Overcharge" ★ `spellDmgBp` 1500 | `fieldcraft` "Fieldcraft" ☐ `fieldSpellMove` 1 |
| `cleric` | `mending` "Mending" ☐ `turnRegenBp` 1000 | `sanctuary` "Sanctuary" ★ `roundRegenBp` 500 | `faith` "Faith" ★ `defBp` 1000 | `devotion` "Devotion" ★ `magBp` 1000 | `mirror-ward` "Mirror Ward" ★ `wardReflectBp` 5000 |
| `spellblade` | `runic-edge` "Runic Edge" ★ `spellbladeStrike` 5000 | `arcane-muscle` "Arcane Muscle" ★ `magBp` 1000 | `honed-edge` "Honed Edge" ★ `strikeDmgBp` 1000 | `keen-eye` "Keen Eye" ★ `critBp` 500 | `twin-arts` "Twin Arts" ★ `spellDmgBp` 1500 |
| `shadowpriest` | `leech` "Leech" ★ `lifestealBp` 2500 | `shade-step` "Shade Step" ★ `spdBp` 1000 | `dark-litany` "Dark Litany" ★ `roundRegenBp` 500 | `cruel-luck` "Cruel Luck" ★ `critBp` 500 | `soul-tithe` "Soul Tithe" ★ `lifestealBp` 2500 |

Starter loadouts (base classes only; hybrids have `starter: null`):

| class | weapon | shield | accessory | battleSpell | wardSpell | bag |
|---|---|---|---|---|---|---|
| `warrior` | wooden-sword | pot-lid | null | spark | null | ["herb"] |
| `thief` | wooden-sword | pot-lid | lucky-sock | spark | null | ["herb","smoke-bomb"] |
| `mage` | wooden-sword | pot-lid | null | fireball | barrier | ["herb"] |
| `cleric` | wooden-sword | pot-lid | null | drain | barrier | ["herb","antidote"] |

##### Gear (`gear.json`, 15)
| id | name | slot | tier | price | stats (non-zero; others 0) | hooks |
|---|---|---|---|---|---|---|
| `wooden-sword` | Wooden Sword | weapon | 1 | 0 | atk +2 | — |
| `bronze-blade` | Bronze Blade | weapon | 1 | 150 | atk +5 | — |
| `knights-saber` | Knight's Saber | weapon | 2 | 400 | atk +9 | — |
| `goblin-cleaver` | Goblin Cleaver | weapon | 3 | 800 | atk +12, luck +4 | — |
| `royal-claymore` | Royal Claymore | weapon | 4 | 1600 | atk +18 | — |
| `pot-lid` | Pot Lid | shield | 1 | 0 | def +2 | — |
| `buckler` | Buckler | shield | 1 | 120 | def +5 | — |
| `tower-shield` | Tower Shield | shield | 2 | 380 | def +9, spd -2 | — |
| `mirror-shield` | Mirror Shield | shield | 3 | 750 | def +8 | `spellTakenBp` -2000 |
| `aegis-of-usurpia` | Aegis of Usurpia | shield | 4 | 1500 | hp +10, def +16 | — |
| `lucky-sock` | Lucky Sock | accessory | 1 | 60 | luck +5 | — |
| `speed-anklet` | Speed Anklet | accessory | 2 | 200 | spd +5 | — |
| `mage-ring` | Mage Ring | accessory | 2 | 350 | mag +6 | — |
| `tax-collectors-seal` | Tax Collector's Seal | accessory | 3 | 600 | — | `townTaxBp` 500 |
| `crown-ward-amulet` | Crown Ward Amulet | accessory | 4 | 900 | def +3 | `crownTaxResistBp` 5000 |

##### Items (`items.json`: 12 consumables + 5 joke items)
| id | name | kind | price | use | effect |
|---|---|---|---|---|---|
| `herb` | Herb | consumable | 20 | both | `{"kind":"heal","bp":3000}` |
| `big-herb` | Big Herb | consumable | 60 | both | `{"kind":"heal","bp":6000}` |
| `royal-elixir` | Royal Elixir | consumable | 200 | both | `{"kind":"heal","bp":10000}` |
| `antidote` | Antidote | consumable | 30 | both | `{"kind":"cleanse"}` |
| `swift-boots` | Swift Boots | consumable | 80 | board | `{"kind":"board","tag":"spinBonus","value":3}` |
| `lead-boots` | Lead Boots | consumable | 80 | board | `{"kind":"board","tag":"spinFixed","value":1}` |
| `homing-stone` | Homing Stone | consumable | 120 | board | `{"kind":"board","tag":"warpCastle","value":0}` |
| `pathfinder` | Pathfinder | consumable | 150 | board | `{"kind":"board","tag":"pickSpin","value":6}` |
| `smoke-bomb` | Smoke Bomb | consumable | 50 | combat | `{"kind":"flee"}` |
| `battle-tonic` | Battle Tonic | consumable | 70 | combat | `{"kind":"mod","stat":"atk","bp":2500}` |
| `iron-tonic` | Iron Tonic | consumable | 70 | combat | `{"kind":"mod","stat":"def","bp":2500}` |
| `coin-purse-lock` | Coin Purse Lock | consumable | 100 | board | `{"kind":"board","tag":"blockGoldSteal","value":1}` |
| `decoy-gold-bag` | Decoy Gold Bag | joke | 120 | none | `{"kind":"joke","tag":"decoyGoldBag"}` |
| `cursed-wig` | Cursed Wig | joke | 90 | none | `{"kind":"joke","tag":"cursedWig"}` |
| `whoopee-scroll` | Whoopee Scroll | joke | 60 | none | `{"kind":"joke","tag":"whoopeeScroll"}` |
| `royal-summons` | Royal Summons (fake) | joke | 150 | none | `{"kind":"joke","tag":"royalSummons"}` |
| `bag-of-bees` | Bag of Bees | joke | 80 | none | `{"kind":"joke","tag":"bagOfBees"}` |

##### Battle spells (`spells.json` → `battle`, 8)
| id | name | tier | price | powerBp | effect |
|---|---|---|---|---|---|
| `spark` | Spark | 1 | 50 | 9000 | `{"kind":"none"}` |
| `fireball` | Fireball | 2 | 200 | 14000 | `{"kind":"none"}` |
| `thunderclap` | Thunderclap | 3 | 600 | 16000 | `{"kind":"stun","chanceBp":2500}` |
| `frostbite` | Frostbite | 2 | 300 | 10000 | `{"kind":"mod","stat":"spd","bp":-2000}` |
| `drain` | Drain | 1 | 150 | 9000 | `{"kind":"drain","bp":5000}` |
| `hex` | Hex | 2 | 300 | 0 | `{"kind":"mod","stat":"atk","bp":-2500}` |
| `pickpocket-bolt` | Pickpocket Bolt | 2 | 250 | 7000 | `{"kind":"stealGold","bp":500}` |
| `royal-decree` | Royal Decree | 4 | 1500 | 20000 | `{"kind":"none"}` |

##### Ward spells (`spells.json` → `ward`, 4)
| id | name | tier | price | mode | valueBp |
|---|---|---|---|---|---|
| `barrier` | Barrier | 1 | 100 | barrier | 0 |
| `reflect` | Reflect | 2 | 400 | reflect | 5000 |
| `absorb` | Absorb | 3 | 500 | absorb | 0 |
| `counterspell` | Counterspell | 3 | 450 | counterspell | 12500 |

##### Field spells (`spells.json` → `field`, 8; data only until Phase 5)
| id | name | tier | price | tag | value | duration |
|---|---|---|---|---|---|---|
| `haste` | Haste | 1 | 120 | spinTwiceHigher | 0 | 1 |
| `snare` | Snare | 2 | 180 | spinCap | 2 | 2 |
| `usurp` | Usurp | 4 | 600 | seizeTown | 1000 | 0 |
| `blessing` | Blessing | 2 | 250 | fullHealCleanse | 0 | 0 |
| `fog` | Fog | 3 | 300 | hideAndImmune | 0 | 2 |
| `golden-touch` | Golden Touch | 2 | 200 | doubleGoldSpace | 0 | 1 |
| `swap` | Swap | 3 | 350 | swapPositions | 0 | 0 |
| `silence` | Silence | 3 | 300 | blockFieldSpells | 0 | 3 |

##### NPC stat curve (`monsters.json` → `curve`, index = tier − 1)
| tier | hp | atk | def | mag | spd | luck |
|---|---|---|---|---|---|---|
| T1 | 48 | 15 | 9 | 11 | 9 | 4 |
| T2 | 95 | 30 | 16 | 22 | 13 | 6 |
| T3 | 140 | 44 | 24 | 32 | 16 | 8 |
| T4 | 190 | 58 | 32 | 42 | 19 | 10 |
| T5 | 245 | 72 | 40 | 52 | 22 | 12 |

##### Monsters (`monsters.json` → `monsters`, 16)
| id | name | tier | zone | statBp hp/atk/def/mag/spd/luck | attackTable a/s/sp/flee | defendTable g/c/w | battle | ward | hooks | xp | gold | tagline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `slime-intern` | Slime Intern | 1 | enchanted-forest | 8000/8000/8000/8000/8000/8000 | 60/20/20/0 | 40/30/30 | spark | null | — | 15 | 20 | Unpaid, unbothered, unarmed. |
| `mushroom-mail-carrier` | Mushroom Mail Carrier | 1 | enchanted-forest | 9500/9500/9000/9000/9000/10000 | 50/30/20/0 | 40/30/30 | spark | null | `poisonOnHit` 1 | 20 | 25 | Neither rain nor spores. |
| `squirrel-pickpocket` | Squirrel Pickpocket | 1 | enchanted-forest | 8000/9000/8000/8000/14000/14000 | 50/20/10/20 | 30/40/30 | spark | null | `stealGoldOnHitBp` 500 | 20 | 40 | Takes a cut. Runs. |
| `treant-groundskeeper` | Treant Groundskeeper | 1 | enchanted-forest | 14000/10000/12500/8000/6000/8000 | 40/40/20/0 | 50/30/20 | spark | null | — | 25 | 25 | Keep off the grass. Forever. |
| `crab-customs-officer` | Crab Customs Officer | 2 | soggy-coast | 10000/9500/13000/8000/8500/9000 | 45/35/20/0 | 25/55/20 | spark | null | — | 45 | 50 | Anything to declare? |
| `seagull-debt-collector` | Seagull Debt Collector | 2 | soggy-coast | 9000/10000/9000/9000/12500/12000 | 55/25/20/0 | 35/35/30 | spark | null | `stealItemOnHit` 1 | 45 | 45 | Mine. Mine. Mine. |
| `mermaid-lifeguard` | Mermaid Lifeguard | 2 | soggy-coast | 10000/9000/9500/11500/10000/10000 | 35/20/45/0 | 35/25/40 | drain | barrier | `roundRegenBp` 800 | 50 | 50 | No running by the sea. |
| `pirate-accountant` | Pirate Accountant | 2 | soggy-coast | 9500/9000/9000/11000/10500/11000 | 30/20/50/0 | 35/30/35 | pickpocket-bolt | null | — | 50 | 70 | Arr-udits your books. |
| `goblin-tax-auditor` | Goblin Tax Auditor | 3 | goblin-mines | 10000/10000/10000/9000/10000/10000 | 50/30/20/0 | 35/35/30 | spark | null | `stealGoldOnHitBp` 800 | 90 | 100 | Your receipts are... concerning. |
| `golem-foreman` | Golem Foreman | 3 | goblin-mines | 12000/12000/11500/6000/7000/8000 | 30/60/10/0 | 45/35/20 | spark | null | — | 95 | 90 | Safety third. |
| `bat-night-shift` | Bat Night-Shift | 3 | goblin-mines | 8500/10000/8500/9000/14000/11000 | 55/25/20/0 | 30/40/30 | drain | null | `lifestealBp` 3000 | 90 | 80 | Clocked in at dusk. |
| `mimic-vault-clerk` | Mimic Vault Clerk | 3 | goblin-mines | 11000/11000/11000/9000/8000/12000 | 45/40/15/0 | 30/50/20 | spark | null | — | 110 | 250 | Please take a number. And a bite. |
| `swamp-witch-notary` | Swamp Witch Notary | 4 | bureaucrat-bog | 9500/8000/9000/12500/10000/10000 | 25/15/60/0 | 30/30/40 | hex | reflect | — | 160 | 150 | Sign here, here, and in blood. |
| `bog-troll-bouncer` | Bog Troll Bouncer | 4 | bureaucrat-bog | 15000/11500/10500/6000/7000/8000 | 45/45/10/0 | 50/35/15 | spark | null | — | 170 | 140 | You're not on the list. |
| `wisp-paperwork-spirit` | Wisp Paperwork Spirit | 4 | bureaucrat-bog | 8000/6000/9000/12500/12000/10000 | 10/10/80/0 | 20/20/60 | frostbite | absorb | `physTakenBp` -5000 | 160 | 130 | Form 27-B, stroke 6. |
| `ogre-middle-manager` | Ogre Middle Manager | 4 | bureaucrat-bog | 11500/11000/10500/10000/9000/9000 | 40/35/25/0 | 35/35/30 | fireball | barrier | `attackDmgBp` 1000 | 180 | 160 | Let's circle back on your face. |

##### Guardians (`monsters.json` → `guardians`, 3) and Crown Enforcer (`monsters.json` → `enforcer`)
| id | name | style | statBp | attackTable | defendTable | battle | ward | xpPerTier / xpPerLevel | goldPerTier / goldPerLevel |
|---|---|---|---|---|---|---|---|---|---|
| `landlord-lich` | Landlord Lich | magic | 11000/8000/9500/12500/10000/10000 | 20/15/65/0 | 30/25/45 | fireball | reflect | 60 | 0 |
| `tollbridge-troll` | Tollbridge Troll | physical | 13000/11500/11500/6000/8000/9000 | 40/50/10/0 | 45/40/15 | spark | null | 60 | 0 |
| `knight-of-foreclosure` | Knight of Foreclosure | balanced | 12000/10500/10500/10000/9500/9500 | 40/35/25/0 | 35/35/30 | spark | barrier | 60 | 0 |
| `crown-enforcer` | Crown Enforcer | — | 9000/12000/10000/8000/10000/10000 | 25/60/15/0 | 35/40/25 | spark | null | 10 | 0 |

All three guardians and the Crown Enforcer ship `hooks: []`. The enforcer row's "—" style means the field **does not exist** on `EnforcerDef` (the JSON object has no `style` key; `z.strictObject` rejects one).

##### Tuning (`tuning.json`; differs from TEST_RULES in `combat.kBp` 14500 vs 12500, `combat.jMagBp` 3500 vs 5000, `progression.growth.hp` 9 vs 8, and `progression.maxLevel`/`xpCurve`)
```json
{"v":1,
 "combat":{"kBp":14500,"jBp":5000,"jMagBp":3500,
   "matrix":{"attack":{"guard":5000,"counter":12500,"ward":10000,"open":10000},
             "strike":{"guard":15000,"counter":10000,"ward":17500,"open":15000},
             "spell":{"guard":10000,"counter":10000,"ward":4000,"open":10000}},
   "critBaseBp":300,"critPerLuckBp":25,"critCapBp":2000,"critMultBp":15000,"maxRounds":3,
   "fleeBaseBp":5000,"fleePerSpdBp":250,"fleeMinBp":1000,"fleeMaxBp":9000,
   "modMinBp":-5000,"modMaxBp":5000,"poisonBp":800,"seniorRewardBp":15000,"pvpXpPerLevel":10},
 "progression":{"maxLevel":20,"xpCurve":[0,50,150,300,500,750,1050,1400,1800,2250,2750,3300,3900,4550,5250,6000,6800,7650,8550,9500],
   "baseStats":{"hp":40,"atk":14,"def":10,"mag":12,"spd":10,"luck":5},"growth":{"hp":9,"atk":3,"def":2,"mag":3,"spd":1,"luck":1},
   "masteryWins":[0,3,7,12,18],"hybridUnlockRank":3},
 "economy":{"startingGold":100,"maxScrolls":3}}
```
(`xpCurve[i] = 25 × i × (i + 1)`.) The design doc's matrix starting values map to bp exactly (Attack 0.5/1.25/1.0, Strike 1.5/reflect 1.0/1.75, Spell 1.0/1.0/0.4 — the 0.4 Spell×Ward value applies only when the defender has a ward spell, D2); the `open` column (stunned defender) is new: 1.0/1.5/1.0.

**Revision 2 retune (D1), with the class identities kept:** Warrior aiBias leans harder into Strike/Guard (punishing Strike); Mage aiBias spams Spell/Ward less (50/30 instead of 60/45) so mage mirrors resolve; Fireball 11000 → 14000 ("mid" burst for the burst class), Thunderclap 13500 → 16000 and Royal Decree 17000 → 20000 so the damage order of the tiered nukes spark (9000) < fireball (14000) < thunderclap (16000) < royal-decree (20000) is preserved; `kBp` 12500 → 14500 and `jMagBp` 5000 → 3500 raise damage so 3 rounds usually produce a KO; `growth.hp` 8 → 9 keeps the fights long enough for Hard's reads to matter (Thief mirror). Ogre Middle Manager's hook became `attackDmgBp` 1000 (the old `atkBp` was a silent no-op on an NPC). Effect on the gate: see *Hard ≥ 70% gate*.

##### Display text (content JSON only; not part of `Rules`)
- **Classes:** warrior "Frontline brawler with a punishing Strike." · thief "Fast, lucky griefer who steals and flees." · mage "Burst Spells and field magic." · cleric "Sustain and support; the Crown hunter." · spellblade "Warrior + Mage: Strikes carry spell power." · shadowpriest "Thief + Cleric: drains HP and outlasts."
- **Passives:** brawler "+10% Strike damage." · thick-skin "+10% max HP." · shield-wall "+10% DEF." · battle-rhythm "+10% Attack damage." · unbreakable "Guard also halves Strike damage." · sticky-fingers "Steal an extra item on a PvP win." · quick-feet "+20% flee chance." · lucky-break "+5% crit chance." · fleet "+10% SPD." · pickpocket "Pickpocket 5% gold when passing players." · frugal-caster "Spells cost 25% less in shops." · focus "+10% Spell damage." · arcane-mind "+10% MAG." · overcharge "+15% Spell damage." · fieldcraft "Cast a field spell and still move." · mending "Heal 10% HP each turn." · sanctuary "Heal 5% HP at each round end." · faith "+10% DEF." · devotion "+10% MAG." · mirror-ward "Ward reflects 50% of Spell damage." · runic-edge "Strikes add 50% of your battle spell's power and its effect." · arcane-muscle "+10% MAG." · honed-edge "+10% Strike damage." · keen-eye "+5% crit chance." · twin-arts "+15% Spell damage." · leech "Heal 25% of Attack/Strike damage dealt." · shade-step "+10% SPD." · dark-litany "Heal 5% HP at each round end." · cruel-luck "+5% crit chance." · soul-tithe "Heal a further 25% of Attack/Strike damage dealt."
- **Gear:** wooden-sword "A stick with ambition." · bronze-blade "Reliable, if a little green." · knights-saber "Standard issue for knights who read the manual." · goblin-cleaver "Lucky, greasy, sharp." · royal-claymore "Too heavy for the actual royals." · pot-lid "Still smells of soup." · buckler "Small shield, big attitude." · tower-shield "A wall you can carry. Slowly." · mirror-shield "Weakens incoming Spells by 20%." · aegis-of-usurpia "The kingdom's finest, slightly used." · lucky-sock "One sock. Unwashed. Lucky." · speed-anklet "Your feet feel late for something." · mage-ring "Hums quietly with MAG." · tax-collectors-seal "+5% town tax income." · crown-ward-amulet "Resists the Cursed Crown's Tyrant's Tax."
- **Items:** herb "Heals 30% HP." · big-herb "Heals 60% HP." · royal-elixir "Fully restores HP." · antidote "Clears status effects." · swift-boots "Your next spin gets +3." · lead-boots "Target's next spin is fixed at 1." · homing-stone "Warp to the Castle." · pathfinder "Pick your exact spin result 1–6." · smoke-bomb "Guarantees escape from battle." · battle-tonic "+25% ATK for this battle." · iron-tonic "+25% DEF for this battle." · coin-purse-lock "Blocks the next gold steal against you." · decoy-gold-bag "Drop it; the next rival to land loses 10% gold to you." · cursed-wig "Force a hideous wig on a rival: −10% SPD for 3 turns." · whoopee-scroll "Target's next battle opens with a fanfare; they lose round-1 initiative." · royal-summons "A forged decree teleports a rival to the Castle." · bag-of-bees "A rival drops a random bag item on their space."
- **Spells:** spark "Low MAG damage, cheap." · fireball "Mid MAG damage." · thunderclap "High damage; 25% chance to stun." · frostbite "Damage and −20% SPD." · drain "Damage; heal half of it." · hex "No damage; −25% ATK for the battle." · pickpocket-bolt "Light damage; steal 5% gold." · royal-decree "Highest damage. Rare." · barrier "Standard spell resistance." · reflect "Reflect 50% of spell damage." · absorb "Heal from spell damage instead of taking it." · counterspell "Negate a Spell; take 1.25× from Attack/Strike." · haste "Spin twice, take the higher." · snare "Target spins max 2 for 2 turns." · usurp "Seize a rival's town (MAG vs MAG); lose 10% gold on failure." · blessing "Full heal and clear status." · fog "Hidden and untargetable for 2 turns." · golden-touch "Your next Gold space pays double." · swap "Swap positions with any player." · silence "Target can't use field spells for 3 turns."
- **Guardians / Enforcer:** landlord-lich "Magic guardian who collects rent in souls." · tollbridge-troll "Physical guardian; the toll is your teeth." · knight-of-foreclosure "Balanced guardian serving eviction notices." · crown-enforcer "A floating gilded helmet with arms. Strikes often."

### `@usurpia/sim` (W1 replay update in 02-01a/02-01b; duel + content rules in 02-05)
**Replay file v2:** `{ "rulesHash": "<8hex>", "settings": GameSettings, "actions": unknown[] }` (exact keys; actions untrusted, passed through `reduce`).
```ts
export class ReplayFileError extends Error {}                 // exit 2
export class RulesMismatchError extends ReplayFileError {}    // exit 3
export function replayFile(filePath: string, rules: Rules, opts?: { allowRulesMismatch?: boolean }): { line: string; result: ReplayResult };
  // line = `hash=<hashState> rules=<rulesHash(rules)> turn=<turn> events=<n> rejections=<n>`
  // file rulesHash !== rulesHash(rules): throw RulesMismatchError(`rules mismatch: file ${fileHash}, current ${hash}`)
  // unless allowRulesMismatch, in which case the line gets the suffix ` rules-mismatch=<fileHash>`
```
- `src/rules.ts` exports `replayRules(): Rules` — the **only** place the CLI and tests get rules. W1 (created by 02-01a): returns `KERNEL_RULES` from `kernel-rules.ts` (TEST_RULES copy); 02-01a's `replay-file.test.ts` uses a temp file `{rulesHash:"7433ea8b", settings:<W1a golden settings>, actions:[]}` → line `hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=0`; 02-01b adds fixture `fixtures/kernel-game.json` (the W1b golden). W3 (02-05): returns `loadRules()` from `@usurpia/content/node`; `kernel-rules.ts` and `kernel-game.json` are deleted; fixture `fixtures/combat-game.json`.
- 02-01b moves the Phase 1 CLI subprocess tests out of `replay-file.test.ts` into a new `test/cli.test.ts` (function tests stay in `replay-file.test.ts`); the CLI tests write their own temp replay files (valid, invalid JSON, wrong `rulesHash` → exit 3, usage errors) using `replayRules()`/`rulesHash`, so they survive the W3 rules switch unchanged except for fixture names.

**Sim combat fixture (W3, 02-05, `packages/sim/fixtures/combat-game.json`, content rules; only W1/W2 action types, and no combat is won by a player — no `VictoryRewarded` is emitted — so it does not depend on 02-04):** `{"rulesHash":"84a995db","settings":{"v":2,"seed":"sim-fixture","players":[{"id":"a","classId":"warrior"},{"id":"b","classId":"mage"}]},"actions":[…]}` with these 23 actions (Revision 2 rebuilt them for the retuned content; `a` has **no ward spell** so d3 exercises D2):
```json
[{"v":2,"type":"system/setCharacter","playerId":"system","target":"a","classId":"warrior","level":5,"weapon":"bronze-blade","shield":"buckler","accessory":"lucky-sock","battleSpell":"spark","wardSpell":null,"bag":["herb","smoke-bomb","battle-tonic"]},
 {"v":2,"type":"system/setCharacter","playerId":"system","target":"b","classId":"mage","level":5,"weapon":"wooden-sword","shield":"buckler","accessory":"mage-ring","battleSpell":"fireball","wardSpell":"barrier","bag":["herb"]},
 {"v":2,"type":"combat/start","playerId":"system","attacker":"a","opponent":{"kind":"npc","npc":{"kind":"monster","id":"seagull-debt-collector","senior":false}}},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d1","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d2","choice":"item:smoke-bomb"},
 {"v":2,"type":"combat/start","playerId":"system","attacker":"b","opponent":{"kind":"player","playerId":"a"}},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d3","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d3","choice":"ward"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d4","choice":"attack"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d4","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d5","choice":"attack"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d5","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d6","choice":"item:herb"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d6","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d7","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d7","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d8","choice":"attack"},
 {"v":2,"type":"timeout","playerId":"system","decisionId":"d8"},
 {"v":2,"type":"combat/start","playerId":"system","attacker":"b","opponent":{"kind":"npc","npc":{"kind":"guardian","id":"landlord-lich","townTier":1}}},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d9","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d10","choice":"ward"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d11","choice":"strike"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d12","choice":"counter"}]
```
→ 0 rejections ([]), 95 events, final hashState = 0483c0fa; `pnpm sim replay packages/sim/fixtures/combat-game.json` prints exactly `hash=0483c0fa rules=84a995db turn=1 events=95 rejections=0`.

| # | c | r.e | att | command / defense | damage | heal | effects | hp after |
|---|---|---|---|---|---|---|---|---|
| 1 | c1 | 1.1 | 1 | attack / guard | [15,0] | [0,0] | `steal-item:battle-tonic` | [72,85] |
| 2 | c1 | 1.2 | 0 | item:smoke-bomb / null | [0,0] | [0,0] | `item:smoke-bomb`, `fled` | [72,85] |
| end | c1 | — | — | `CombatEnded fled` winner null fled 0 | | | | [72,85] |
| 3 | c2 | 1.1 | 0 | spell / ward | [0,44] | [0,0] | — | [64,28] |
| 4 | c2 | 1.2 | 1 | attack / guard | [19,0] | [0,0] | — | [45,28] |
| 5 | c2 | 2.1 | 0 | attack / guard | [0,8] | [0,0] | — | [45,20] |
| 6 | c2 | 2.2 | 1 | item:herb / null | [0,0] | [0,26] | `item:herb` | [45,46] |
| 7 | c2 | 3.1 | 0 | spell / guard | [0,44] | [0,0] | — | [45,2] |
| 8 | c2 | 3.2 | 1 | attack / guard | [19,0] | [0,0] | — | [26,2] |
| end | c2 | — | — | `CombatEnded draw` winner null fled null | | | | [26,2] |
| 9 | c3 | 1.1 | 0 | spell / counter | [0,42] | [0,0] | — | [26,62] |
| 10 | c3 | 1.2 | 1 | spell / ward | [9,0] | [0,0] | — | [17,62] |
| 11 | c3 | 2.1 | 0 | strike / guard | [0,33] | [0,0] | — | [17,29] |
| 12 | c3 | 2.2 | 1 | spell / counter | [17,0] | [0,0] | — | [0,29] |
| end | c3 | — | — | `CombatEnded ko` winner 1 fled null | | | | [0,29] |

Checkpoints: c1 (a vs `seagull-debt-collector`, stats `85/30/14/19/16/7`, first = 1) — the gull's Attack steals `battle-tonic`, then a's `item:smoke-bomb` flees; c2 (b vs a; b first every round because b's SPD 14 > a's 12) — #3 is **Spell×Ward with no ward spell** (Guard multiplier: 44, not 17), #6 heals 26, d8 times out b → `guard`, ends `draw` after round 3; c3 (b vs guardian `landlord-lich` townTier 1, stats `104/24/15/27/13/6`, lich commands drawn) — #10 is Spell×Ward **with** Barrier (0.4×: 9), ends `ko` winner 1 at round 2.2 (b hp 0; npc win → no reward). Round starts: c1 `first` = 1; c2 `first` = 0, 0, 0; c3 `first` = 0, 0. Final: a `warrior L5 xp 500 gold 100 hp 2`, bag `[]`; b `mage L5 xp 500 gold 100 hp 0`, bag `["herb"]`; `choiceHistory.a = {attack:2,strike:0,spell:0,guard:3,counter:0,ward:1}`, `choiceHistory.b = {attack:1,strike:1,spell:3,guard:2,counter:1,ward:1}`; `hidden = {combatSeq:3, decisionSeq:12, decision:null, rng:[1644771214,1962754076,1815850500,733868240]}`. Event type sequence (95):
`CharacterSet, BagUpdated, CharacterSet, BagUpdated, CombatStarted, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, BagUpdated, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, BagUpdated, CombatEnded, CombatStarted, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, BagUpdated, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted, ChoiceTimedOut, ChoicesRevealed, ExchangeResolved, RoundEnded, CombatEnded, CombatStarted, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, CombatEnded`.

**CLI** (`pnpm sim <cmd>`, run from the repo root via tsx):
```
pnpm sim replay <file.json> [--allow-rules-mismatch]
pnpm sim duel [--n <int ≥ 1> (default 1000)] [--matchup <spec> (default all)] [--difficulty <d> | <dA>:<dB> (default normal)]
              [--seed <string> (default usurpia)] [--level <1..maxLevel> (default 5)] [--json]
```
Usage errors (unknown flag, missing value, bad int, unknown class/monster, bad difficulty) → stderr `usage: …` and exit 2. Exit 0 on success.

**Matchups** (class ids and monster ids each sorted ascending):
- `classes` — every ordered pair `(A, B)` of class ids including mirrors (36 with shipped content); `mirrors` — `(c, c)` for each class (6); `monsters` — every `(class, monster)` pair (96); `all` = `classes` then `monsters` (132); `<classA>:<classB>`; `<class>:monster/<monsterId>`.
- Duel `i` (0-based, `i < n`) uses matchup `M[i mod |M|]`, seed `` `${seed}/${i}` ``, side A difficulty `dA`, side B `dB` (ignored for monsters).

**`runDuel(rules, spec)`** (`src/duel.ts`, exported for tests):
```ts
export interface DuelSpec { seed: string; a: { classId: ContentId; difficulty: Difficulty }; b: { kind: "class"; classId: ContentId; difficulty: Difficulty } | { kind: "monster"; monsterId: ContentId }; level: number }
export interface DuelResult { outcome: "ko" | "fled" | "draw"; winner: 0 | 1 | null; fled: 0 | 1 | null; events: number; hash: string }
```
1. `createGame({v:2, seed, players: [{id:"a", classId: seatClass(A)}, ({id:"b", classId: seatClass(B)} for class duels)]}, rules)` where `seatClass(c) = kind === "base" ? c : parents[0]`.
2. `level` = spec level for class duels; for monster duels `TIER_LEVEL[tier − 1]` with `TIER_LEVEL = [1, 5, 9, 13]`. Kit tier `tierForLevel(L) = L ≥ 13 ? 4 : L ≥ 9 ? 3 : L ≥ 5 ? 2 : 1`.
3. `system/setCharacter` for `a` (then `b`) with `classId`, `level`, the kit row below and `bag: ["herb", "herb"]`.
4. `combat/start` attacker `a`, opponent player `b` or `{kind:"npc", npc:{kind:"monster", id, senior:false}}`.
5. `ai = {a: createAi(seed, "a", dA), b: createAi(seed, "b", dB)}`; loop while `phase === "decision"` (guard: > 100 iterations → throw): for each `pid` in `pending.required` order, skipping committed players and stopping if the decision changed: `decideCombat(viewFor(state, pid), rules, ai[pid])` → apply the action (a rejection throws — it is a bug).
6. Result: `outcome`/`winner`/`fled` from the last `CombatEnded`; `events` = total number of events returned by **all** `reduce` calls of the duel (setCharacter events included); `hash = hashState(final state)`.

**Reward coupling (critique #5):** after 02-04 lands, a KO won by a player appends `VictoryRewarded` (+ `LevelUp`/`MasteryRankUp`) and changes xp/gold/mastery, so `DuelResult.events` and `DuelResult.hash` of such duels differ between the W2 engine and the final W3 engine; `outcome`/`winner`/`fled` never do (the reward runs after `CombatEnded`; the reference proves it for all 2 400 gate duels). Therefore **02-05 must not pin `DuelResult.events` or `DuelResult.hash` in its W3 tasks 1–2**; the only reward-dependent goldens are the per-duel `events`/`hash` values in `traces/gate.trace.json`, pinned by the **W3 closing step** (02-05 task 3, after the 02-04 commit). Every stdout golden, the gate counts and the sim fixture are reward-independent and computed for the final W3 state.

**Report (stdout, deterministic; timing goes to stderr as `elapsed_ms=<n>`)**:
```
duel n=<n> seed=<seed> level=<L> difficulty=<dA>:<dB> rules=<rulesHash>
# class-vs-class                      (printed before the first class matchup, if any)
<A>:<B> n=<k> a=<aWins> b=<bWins> draw=<d> fled=<f> aRate=<x.xxx | n/a>
# class-vs-monster                    (before the first monster matchup, if any)
<A>:monster/<id> n=<k> a=<…> b=<…> draw=<…> fled=<…> aRate=<…>
total n=<n> a=<Σ> b=<Σ> draw=<Σ> fled=<Σ>
```
`aRate = aWins / (aWins + bWins)` via `toFixed(3)`, `n/a` when no decisive duel; matchups with `k = 0` are omitted. `--json` prints one `stableStringify` line `{n, seed, level, difficulty:[dA,dB], rulesHash, matchups:[{a, b, n, aWins, bWins, draws, fled}]}` instead.

**Kits (`src/kits.ts`; row = weapon, shield, accessory, battleSpell, wardSpell):**
| class | tier 1 | tier 2 | tier 3 | tier 4 |
|---|---|---|---|---|
| `warrior` | wooden-sword, pot-lid, null, spark, null | bronze-blade, buckler, lucky-sock, spark, barrier | knights-saber, tower-shield, speed-anklet, fireball, barrier | royal-claymore, aegis-of-usurpia, crown-ward-amulet, fireball, reflect |
| `thief` | wooden-sword, pot-lid, lucky-sock, spark, null | bronze-blade, buckler, speed-anklet, pickpocket-bolt, barrier | goblin-cleaver, buckler, speed-anklet, frostbite, barrier | royal-claymore, mirror-shield, speed-anklet, thunderclap, reflect |
| `mage` | wooden-sword, pot-lid, null, fireball, barrier | wooden-sword, buckler, mage-ring, fireball, barrier | bronze-blade, mirror-shield, mage-ring, thunderclap, reflect | knights-saber, aegis-of-usurpia, mage-ring, royal-decree, absorb |
| `cleric` | wooden-sword, pot-lid, null, drain, barrier | bronze-blade, buckler, mage-ring, drain, barrier | knights-saber, mirror-shield, mage-ring, drain, absorb | goblin-cleaver, aegis-of-usurpia, mage-ring, drain, counterspell |
| `spellblade` | wooden-sword, pot-lid, null, spark, null | bronze-blade, buckler, mage-ring, fireball, barrier | knights-saber, tower-shield, mage-ring, thunderclap, barrier | royal-claymore, aegis-of-usurpia, mage-ring, thunderclap, reflect |
| `shadowpriest` | wooden-sword, pot-lid, lucky-sock, drain, null | bronze-blade, buckler, speed-anklet, drain, barrier | goblin-cleaver, mirror-shield, speed-anklet, drain, absorb | royal-claymore, aegis-of-usurpia, speed-anklet, drain, counterspell |


**Sim goldens (`sim/test/duel.test.ts`, content rules; reward-independent):** `pnpm sim duel --n 60 --matchup mirrors --difficulty hard:easy --seed golden` prints exactly:
```
duel n=60 seed=golden level=5 difficulty=hard:easy rules=84a995db
# class-vs-class
cleric:cleric n=10 a=7 b=2 draw=1 fled=0 aRate=0.778
mage:mage n=10 a=5 b=0 draw=5 fled=0 aRate=1.000
shadowpriest:shadowpriest n=10 a=6 b=1 draw=3 fled=0 aRate=0.857
spellblade:spellblade n=10 a=9 b=1 draw=0 fled=0 aRate=0.900
thief:thief n=10 a=6 b=3 draw=1 fled=0 aRate=0.667
warrior:warrior n=10 a=9 b=1 draw=0 fled=0 aRate=0.900
total n=60 a=42 b=8 draw=10 fled=0
```
and `--n 36 --matchup classes --seed golden` ends with `total n=36 a=14 b=11 draw=11 fled=0`; the CI smoke `pnpm sim duel --n 264 --seed ci` ends with `total n=264 a=154 b=57 draw=51 fled=2`. Running any command twice yields byte-identical stdout (determinism test).

**Hard ≥ 70% gate (`sim/test/gate.test.ts`, Vitest timeout 120 s; user decision D1):** for each class `c` of the 6 classes (ascending id), `j = 0..399`: `runDuel(rules, {seed: "gate/" + c + "/" + j, a: {classId: c, difficulty: j even ? "hard" : "easy"}, b: {kind:"class", classId: c, difficulty: j even ? "easy" : "hard"}, level: 5})`; the hard side is `j even ? 0 : 1`. Per class: `hardWins` = KO wins by the hard side, `easyWins` = KO wins by the easy side, `draws` = `outcome === "draw"`, `fled` = `outcome === "fled"`; `decisive = hardWins + easyWins`; `rate = hardWins / decisive`; `drawRate = draws / 400`. **Requirement (asserted per class):** `decisive > 0`, `rate ≥ 0.70` **and** `drawRate ≤ 0.40`. **Reference golden** (asserted exactly — all four counts per class — as a determinism check; the rate columns are derived):

| class | hardWins | easyWins | draws | fled | decisive | Hard-decisive rate | draw rate |
|---|---|---|---|---|---|---|---|
| cleric | 221 | 65 | 114 | 0 | 286 | 0.773 | 0.285 |
| mage | 248 | 45 | 107 | 0 | 293 | 0.846 | 0.268 |
| shadowpriest | 247 | 67 | 86 | 0 | 314 | 0.787 | 0.215 |
| spellblade | 310 | 67 | 23 | 0 | 377 | 0.822 | 0.058 |
| thief | 263 | 68 | 69 | 0 | 331 | 0.795 | 0.172 |
| warrior | 306 | 60 | 34 | 0 | 366 | 0.836 | 0.085 |

Every mirror clears the D1 requirement with margin (min Hard-decisive rate 0.773 — cleric; max draw rate 0.285 — cleric). The four base-class mirrors named by D1 (warrior, thief, mage, cleric) are included; the two hybrid mirrors are kept as extra coverage. The first 20 duels per class are pinned per duel in `traces/gate.trace.json` as `{j, seed, hardSide, outcome, winner, fled, hp, events, hash, eventsPreRewards, hashPreRewards}`; `gate.test.ts` asserts `(outcome, winner)` of those 20 per class in task 2 and `(events, hash)` in the W3 closing step.

**Performance budget (critique #12, owner 02-05):** `pnpm sim duel --n 10000` (matchup `all`) ≤ 60 s wall on GitHub `ubuntu-latest`. Automated by `packages/sim/test/perf.test.ts` (Vitest timeout 180 s): spawns `pnpm sim duel --n 10000 --seed perf` from the repo root, measures wall time around the subprocess, asserts exit code 0, wall ≤ 60 000 ms, stdout contains `# class-vs-class` and `# class-vs-monster`, and the last stdout line is exactly `total n=10000 a=5411 b=2370 draw=2118 fled=101`. The CI smoke step (`pnpm sim duel --n 264 --seed ci`, after `pnpm build`) stays separate. The reference implementation ran 10 000 duels in 2.2 s.

### `@usurpia/client` (W1: 02-01a shell, 02-01b demo decision)
`main.ts`: `createGame({v:2, seed:"demo", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}, DEMO_RULES)`, then `decision/open` (system) with prompts `p1: ["yes","no"]/"no"` and `p2: ["red","green","blue"]/"red"`, then `decision/commit p1 "yes"`; render `renderView(viewFor(state,"p2"), eventsFor(events,"p2"))` into `<pre id="app">`. `DEMO_RULES` = `src/demo-rules.ts`, a verbatim `TEST_RULES` copy typed `Rules`. **02-01a interim:** no actions exist yet, so `main.ts` only creates the game and renders with `events = []`, and the player line omits the ` bag <counts[id].bag>` suffix (no `counts` yet); 02-01b adds the decision demo, the bag suffix and the pending/options lines as below.
`renderView(view, events)` returns lines joined with `\n`:
```
Usurpia — viewer: <viewer>
turn <turn> · active <activePlayer> · phase <phase>
<id> <classId> L<level> hp <hp> gold <gold> bag <counts[id].bag>          (one line per seated player, in players order)
pending: <id> (<kind>) committed: <comma list or —>                      (or "pending: —")
your options: <comma list> (default <default>)                            (only if view.self?.prompt)
events:
- <type>                                                                  (one per event)
```

### Test fixture `TEST_RULES` (`core/test/fixtures/test-rules.ts`; copies in `sim/src/kernel-rules.ts` (W1–W2) and `client/src/demo-rules.ts`)
Must satisfy `rulesHash(TEST_RULES) === "7433ea8b"` (a transcription check). Literal (helpers are local to the file):
```ts
const S = (hp, atk, def, mag, spd, luck) => ({ hp, atk, def, mag, spd, luck });
const Z = S(0, 0, 0, 0, 0, 0);
const P = (rank, id, hook, value) => ({ rank, id, hook, value });
const H = (hook, value) => ({ hook, value });
const AT = (attack, strike, spell, flee) => ({ attack, strike, spell, flee });
const DT = (guard, counter, ward) => ({ guard, counter, ward });
export const TEST_RULES: Rules = { v: 1,
  classes: {
    fighter: { id: "fighter", kind: "base", parents: null, statBp: S(12000, 12000, 10000, 8000, 10000, 10000), bagSize: 3, switchFee: 50,
      passives: [P(1, "f1", "strikeDmgBp", 1000), P(2, "f2", "hpBp", 1000), P(3, "f3", "guardVsStrikeBp", 5000), P(4, "f4", "counterDmgBp", 2000), P(5, "f5", "critBp", 1000)],
      starter: { weapon: "stick", shield: "lid", accessory: null, battleSpell: "zap", wardSpell: null, bag: ["herb"] },
      aiBias: { attack: 40, strike: 40, spell: 20, guard: 40, counter: 40, ward: 20 } },
    caster: { id: "caster", kind: "base", parents: null, statBp: S(9000, 8000, 9000, 13000, 10000, 10000), bagSize: 4, switchFee: 50,
      passives: [P(1, "c1", "spellDmgBp", 1000), P(2, "c2", "magBp", 1000), P(3, "c3", "wardReflectBp", 5000), P(4, "c4", "roundRegenBp", 1000), P(5, "c5", "spellTakenBp", -2000)],
      starter: { weapon: "stick", shield: "lid", accessory: "charm", battleSpell: "zap", wardSpell: "shell", bag: ["herb", "bomb"] },
      aiBias: { attack: 20, strike: 20, spell: 60, guard: 30, counter: 20, ward: 50 } },
    battlemage: { id: "battlemage", kind: "hybrid", parents: ["fighter", "caster"], statBp: S(11000, 11000, 10000, 11000, 10000, 10000), bagSize: 3, switchFee: 150,
      passives: [P(1, "b1", "spellbladeStrike", 5000), P(2, "b2", "lifestealBp", 2000), P(3, "b3", "atkBp", 1000), P(4, "b4", "physTakenBp", -1000), P(5, "b5", "fleeBp", 2000)],
      starter: null, aiBias: { attack: 30, strike: 40, spell: 30, guard: 35, counter: 35, ward: 30 } } },
  gear: {
    stick: { id: "stick", slot: "weapon", tier: 1, price: 0, stats: { ...Z, atk: 2 }, hooks: [] },
    sword: { id: "sword", slot: "weapon", tier: 2, price: 200, stats: { ...Z, atk: 6 }, hooks: [] },
    lid: { id: "lid", slot: "shield", tier: 1, price: 0, stats: { ...Z, def: 2 }, hooks: [] },
    mirror: { id: "mirror", slot: "shield", tier: 2, price: 300, stats: { ...Z, def: 4 }, hooks: [H("spellTakenBp", -2000)] },
    charm: { id: "charm", slot: "accessory", tier: 1, price: 50, stats: { ...Z, luck: 4 }, hooks: [] },
    band: { id: "band", slot: "accessory", tier: 2, price: 150, stats: { ...Z, spd: 3 }, hooks: [H("townTaxBp", 500)] } },
  items: {
    herb: { id: "herb", kind: "consumable", price: 20, use: "both", effect: { kind: "heal", bp: 3000 } },
    bomb: { id: "bomb", kind: "consumable", price: 50, use: "combat", effect: { kind: "flee" } },
    tonic: { id: "tonic", kind: "consumable", price: 70, use: "combat", effect: { kind: "mod", stat: "atk", bp: 2500 } },
    antidote: { id: "antidote", kind: "consumable", price: 30, use: "both", effect: { kind: "cleanse" } },
    boots: { id: "boots", kind: "consumable", price: 80, use: "board", effect: { kind: "board", tag: "spinBonus", value: 3 } },
    wig: { id: "wig", kind: "joke", price: 90, use: "none", effect: { kind: "joke", tag: "cursedWig" } } },
  battleSpells: {
    zap: { id: "zap", tier: 1, price: 50, powerBp: 10000, effect: { kind: "none" } },
    jolt: { id: "jolt", tier: 2, price: 300, powerBp: 12000, effect: { kind: "stun", chanceBp: 5000 } },
    leech: { id: "leech", tier: 1, price: 150, powerBp: 8000, effect: { kind: "drain", bp: 5000 } },
    hex: { id: "hex", tier: 2, price: 300, powerBp: 0, effect: { kind: "mod", stat: "atk", bp: -2500 } },
    frost: { id: "frost", tier: 2, price: 300, powerBp: 9000, effect: { kind: "mod", stat: "spd", bp: -2000 } },
    pilfer: { id: "pilfer", tier: 2, price: 250, powerBp: 6000, effect: { kind: "stealGold", bp: 1000 } } },
  wardSpells: {
    shell: { id: "shell", tier: 1, price: 100, mode: "barrier", valueBp: 0 },
    "mirror-ward": { id: "mirror-ward", tier: 2, price: 400, mode: "reflect", valueBp: 5000 },
    sponge: { id: "sponge", tier: 3, price: 500, mode: "absorb", valueBp: 0 },
    "null-ward": { id: "null-ward", tier: 3, price: 450, mode: "counterspell", valueBp: 12500 } },
  fieldSpells: {
    haste: { id: "haste", tier: 1, price: 120, tag: "spinTwiceHigher", value: 0, duration: 1 },
    fog: { id: "fog", tier: 3, price: 300, tag: "hideAndImmune", value: 0, duration: 2 } },
  monsters: {
    slime: { id: "slime", tier: 1, zone: "forest", statBp: S(10000, 10000, 10000, 10000, 10000, 10000), attackTable: AT(60, 20, 20, 0), defendTable: DT(40, 30, 30), battleSpell: "zap", wardSpell: null, hooks: [], xp: 20, gold: 30 },
    crab: { id: "crab", tier: 2, zone: "coast", statBp: S(10000, 10000, 12000, 8000, 8000, 10000), attackTable: AT(40, 40, 20, 0), defendTable: DT(20, 60, 20), battleSpell: "zap", wardSpell: "shell", hooks: [H("poisonOnHit", 1)], xp: 45, gold: 60 },
    gull: { id: "gull", tier: 1, zone: "coast", statBp: S(9000, 10000, 9000, 8000, 12000, 12000), attackTable: AT(50, 20, 0, 30), defendTable: DT(30, 30, 40), battleSpell: null, wardSpell: null, hooks: [H("stealItemOnHit", 1), H("stealGoldOnHitBp", 1000)], xp: 25, gold: 40 } },
  guardians: {
    lich: { id: "lich", style: "magic", statBp: S(12000, 9000, 10000, 12000, 10000, 10000), attackTable: AT(20, 20, 60, 0), defendTable: DT(30, 20, 50), battleSpell: "zap", wardSpell: "shell", hooks: [], xpPerTier: 50, goldPerTier: 0 } },
  enforcer: { id: "crown-enforcer", statBp: S(10000, 12000, 10000, 8000, 10000, 10000), attackTable: AT(20, 60, 20, 0), defendTable: DT(30, 40, 30), battleSpell: "zap", wardSpell: null, hooks: [], xpPerLevel: 10, goldPerLevel: 0 },
  npcCurve: [S(40, 12, 8, 10, 9, 4), S(80, 24, 15, 18, 12, 6), S(120, 36, 22, 26, 15, 8), S(160, 48, 29, 34, 18, 10), S(200, 60, 36, 42, 21, 12)],
  combat: { kBp: 12500, jBp: 5000, jMagBp: 5000,
    matrix: { attack: { guard: 5000, counter: 12500, ward: 10000, open: 10000 }, strike: { guard: 15000, counter: 10000, ward: 17500, open: 15000 }, spell: { guard: 10000, counter: 10000, ward: 4000, open: 10000 } },
    critBaseBp: 300, critPerLuckBp: 25, critCapBp: 2000, critMultBp: 15000, maxRounds: 3,
    fleeBaseBp: 5000, fleePerSpdBp: 250, fleeMinBp: 1000, fleeMaxBp: 9000, modMinBp: -5000, modMaxBp: 5000, poisonBp: 800, seniorRewardBp: 15000, pvpXpPerLevel: 10 },
  progression: { maxLevel: 10, xpCurve: [0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250], baseStats: S(40, 14, 10, 12, 10, 5), growth: S(8, 3, 2, 3, 1, 1), masteryWins: [0, 3, 7, 12, 18], hybridUnlockRank: 3 },
  economy: { startingGold: 100, maxScrolls: 3 } };
```
(TEST_RULES monster zones `forest`/`coast` are free-form: the zone whitelist is a content cross-ref rule, not a core rule.)

### Lint and purity probe (W3, 02-05)
- `eslint.config.js`: hoist the existing core `no-restricted-imports` options into a `CORE_IMPORT_RESTRICTIONS` constant (paths + patterns) and reuse it. Add two flat-config objects **after** the core override (a later object replaces the rule's options for its files, so each repeats the core restrictions):
  1. `files: ["packages/core/src/**/*.ts"], ignores: ["packages/core/src/ai/**"]`: core restrictions + pattern `{ regex: "(^|/)ai(/|$)", message: "reducer/handlers/core must not import the CPU AI (ai/ runs outside reduce)" }`.
  2. `files: ["packages/core/src/ai/**/*.ts"]`: core restrictions + patterns (critique #9 closes the re-export loophole):
     - `{ regex: "(^|/)(reducer|handlers|index|serialize|game|replay)(/|$)", message: "the AI reads PlayerView + Rules only (no reducer, handlers, or modules exposing GameState)" }` — `index` is the core barrel (re-exports `GameState`/`reduce`), `serialize`/`game`/`replay` return `GameState`;
     - `{ regex: "^@usurpia/core(/|$)", message: "the AI must use relative imports" }`;
     - `{ regex: ".*", importNames: ["GameState", "HiddenState"], message: "the AI reads PlayerView only" }` — the type names are banned from **every** module path.
     It also extends `no-restricted-properties` with `{ object: "Math", property: "exp" | "log" | "pow", message: "AI arithmetic must be engine-independent; use expNeg" }` (three entries) in addition to the core `Math.random` entry (critique #10). The existing core rule banning aliasing of `Math` makes this complete.
- `scripts/check-core-purity.mjs`: cases gain an optional `path` (default `packages/core/src/__purity_probe__.ts`); add `import "./ai/index";` (expects `no-restricted-imports`) and, at `packages/core/src/ai/__purity_probe__.ts`, each of `import type { GameState } from "../types";`, `import type { GameState } from "../views";` (name ban via any path), `import { reduce } from "../reducer";`, `import { createGame } from "../index";`, `import { deserialize } from "../serialize";` (each expects `no-restricted-imports`) and `export const e = Math.exp(1);` (expects `no-restricted-properties`). Every probe file is deleted in `finally`.

### Golden summary
| Golden | Value | Pinned in (plan, task) | Reward-dependent? |
|---|---|---|---|
| `rulesHash(TEST_RULES)` | `7433ea8b` | `core/test/rules.test.ts` (02-01a T1) | no |
| `createGame(fixture settings, TEST_RULES)` | `758ef72c` + canonical JSON above | `core/test/game.test.ts` (02-01a T2) | no |
| Empty replay file (W1a) | `hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=0` | `sim/test/replay-file.test.ts` (02-01a T3) | no |
| Poll replay (W1b fixture) | `9616698e`, 10 events, rejections at 2 and 5 | `core/test/replay.test.ts`, `sim/test/replay-file.test.ts` (02-01b T3) | no |
| Sheet/NPC stats (TEST_RULES) | table above | `core/test/stats.test.ts` (02-01a T1); `core/test/npc.test.ts` (02-03 T1) pins `drawNpcCommand`/`drawNpcDefense` mapping (e.g. slime table 60/20/20/0: `u` 1–60 attack, 61–80 strike, 81–100 spell; flee never) | no |
| Content NPC spot stats | table below | `sim/test/content-stats.test.ts` (02-05 T2) | no |
| Damage matrix + variants | tables above | `core/test/resolve.test.ts` (02-03 T1) | no |
| Combat golden replay | `ec0c3508`, 80 events, exchange table | `core/test/combat-golden.test.ts` (02-03 T3) | no (no player KO win) |
| `rulesHash(loadRules())` | `84a995db` | `content/test/data.test.ts` (02-02 T3) | no |
| Rewards/loadout replay | `57da3ea4`, 84 events | `core/test/rewards-golden.test.ts` (02-04 T3) | — (it *is* the reward golden) |
| Sim combat fixture | `hash=0483c0fa rules=84a995db turn=1 events=95 rejections=0` | `sim/test/replay-file.test.ts` (02-05 T2) | no (no `VictoryRewarded`) |
| AI policy weights / rng / `expNeg` | tables above | `core/test/ai.test.ts`, `core/test/ai-exp.test.ts` (02-05 T1) | no |
| Sim duel stdout (mirrors block, classes total, CI smoke total) | blocks above | `sim/test/duel.test.ts` (02-05 T2) | no (outcomes only) |
| 10k perf run total line | `total n=10000 …` above | `sim/test/perf.test.ts` (02-05 T2) | no |
| Hard vs Easy gate counts | table above | `sim/test/gate.test.ts` (02-05 T2) | no |
| Gate per-duel `(outcome, winner)` (first 20 per class) | `traces/gate.trace.json` | `sim/test/gate.test.ts` (02-05 T2) | no |
| Gate per-duel `(events, hash)` (first 20 per class) | `traces/gate.trace.json` (`events`, `hash`) | `sim/test/gate.test.ts` (02-05 **T3 = W3 closing step**) | **yes** |

Content NPC spot stats (content rules, `npcStats`; pins the Ogre fix — its hook is combat-time and does not change these numbers):

| NPC | Result |
|---|---|
| monster `ogre-middle-manager` (T4) | 218/63/33/42/17/9 |
| monster `slime-intern`, senior (T2 curve) | 76/24/12/17/10/4 |
| guardian `landlord-lich`, townTier 1 (T2 curve) | 104/24/15/27/13/6 |
| enforcer level 10 | 108/49/28/31/19/14 |

### Golden oracle and traces (critique #1)
- **Location:** `.planning/reference/phase-02/` — the reference implementation that computed every golden: `kernel.mjs` (rng/hash, identical to Phase 1), `engine.mjs` (createGame/reduce/stats/computeCell/rewards; reduced validation), `ai.mjs`, `sim.mjs`, `content-rules.mjs` (the content data incl. display text), `spec-test-rules.mjs` (TEST_RULES), `goldens.mjs` (scenarios + every snippet), `gen-goldens.mjs`, `verify-spec.mjs`, `parse-spec.py` (spec content tables → `spec-rules.json`), `gate.mjs`/`matrix.mjs`/`tune.mjs` (exploration), and `traces/`. It is **planning material, not product code**: no package imports it, no committed test reads it, and plans never edit it (a golden change goes through the spec author: Revision History row + `gen-goldens.mjs` + `verify-spec.mjs`).
- **Verification:** `node .planning/reference/phase-02/verify-spec.mjs` (needs `python3`) re-parses this spec's content tables and TEST_RULES literal, checks every action block against the reference scenarios, checks every golden snippet appears verbatim in this spec, checks `traces/*.json` are current, and checks the D1 margins; it prints `verify-spec: N passed, 0 failed`.
- **Tool exclusions (owner: 02-01a, T3):** the directory must stay outside every repo tool. Today no edit is needed and 02-01a must keep exactly these entries: `eslint.config.js` top-level `ignores` contains `".planning/**"`; `.prettierignore` contains the line `.planning/`; root `tsconfig.json` has `"files": []` and only `packages/*` references (tsc never sees `.planning`); `vitest.config.ts` `projects` only lists `packages/*`. If any entry is missing at execution time, 02-01a adds exactly that entry and nothing else. Acceptance: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` pass with the directory present.
- **Traces** (`traces/*.json`, regenerated by `gen-goldens.mjs`):
  - `kernel-game.trace.json`, `combat-golden.trace.json`, `rewards-golden.trace.json`, `combat-game.trace.json` (the sim fixture): `{scenario, rules, rulesHash, settings, initialHash, steps: [{i, type, ok, error, hash, events}], finalHash, finalState}` — one step per action; `hash` = `hashState` after the action (the unchanged input hash on a rejection); `events` = the full events that `reduce` returned (with `visibility`).
  - Trace values are goldens of this spec **by reference**: a test that pins them transcribes the values into the test source (committed tests never read `.planning/` at runtime).
  - `gate.trace.json`: per class, the first 20 gate duels `{j, seed, hardSide, outcome, winner, fled, hp, events, hash, eventsPreRewards, hashPreRewards}`; `events`/`hash` are for the final W3 engine (rewards on), the `…PreRewards` pair is the same duel with the 02-04 reward hook disabled (what 02-05 sees before the 02-04 commit).
- **Mismatch localisation protocol (binding for executors):** when a composite golden (hash, event count, stdout, gate count) disagrees, the executor must (1) write a throwaway script or `it.only` debug test (never committed) that replays the scenario action by action and prints `hashState` + events per step, (2) diff it against the corresponding `traces/*.json` and find the **first** differing step, (3) diff that step's events field by field to find the rule at fault, (4) fix the implementation against this spec's prose. For gate/stdout mismatches, diff per-duel `(outcome, winner)` against `gate.trace.json` first. Only if the spec prose is ambiguous is the orchestrator escalated; any golden change needs a Revision History row.

## File Placement
| Artifact | Path | Placement Rationale | Existing Pattern |
|----------|------|---------------------|------------------|
| Rules types + helpers | `packages/core/src/rules.ts` | Core owns the contract; content implements it | Phase 1 `types.ts` |
| State/settings types | `packages/core/src/types.ts` | Same module as v1 | Phase 1 |
| Pure combat math | `packages/core/src/combat/{passives,stats,options,resolve}.ts` | No `GameState` imports; unit-testable; reused by the AI | New subfolder |
| Handlers | `packages/core/src/handlers/{index,shared,decision,combat,system,loadout}.ts` | Replaces `handlers.ts`; one file per concern for wave-parallel ownership | Phase 1 handler map |
| Progression / inventory | `packages/core/src/{progression,inventory}.ts` | Pure domain helpers | — |
| CPU AI | `packages/core/src/ai/{index,combat,opponent-model,tuning,exp}.ts` → `@usurpia/core/ai` | Headless, in core per design doc; lint-isolated; `exp.ts` holds the engine-independent `expNeg` | Design doc CPU AI Spec |
| Core test fixture | `packages/core/test/fixtures/test-rules.ts` | User decision: core tests without content | Phase 1 `test/` layout |
| Content data | `packages/content/data/*.json` (6 files) | Data separate from schemas | Phase 1 `items.json` |
| Content build | `packages/content/src/{build-rules,node}.ts`, `src/schemas/*.ts` | Browser-safe index + Node-only loader | Phase 1 `load.ts` |
| Sim | `packages/sim/src/{cli,replay-file,duel,kits,report,rules}.ts`, `fixtures/combat-game.json`, `test/{duel,gate,perf,content-stats,cli,replay-file}.test.ts` | CLI package | Phase 1 sim |
| Golden oracle | `.planning/reference/phase-02/**` (incl. `traces/*.json`) | Planning material; excluded from every tool; spec-author owned | — |
| Client text shell | `packages/client/src/{main,render,demo-rules}.ts` | Phase 4 replaces it | Phase 1 client |

## Data and Control Flow
1. **Build time:** `content/data/*.json` → `loadContentDir` → `buildRules` (schema → duplicates → cross-refs → assemble, strip text) → `Rules`; the CLI gate fails `pnpm build` on any error.
2. **Game start:** host code obtains `rules` (sim: `loadRules()`; tests: `TEST_RULES`), computes `rulesHash(rules)`, calls `createGame(settings, rules)`.
3. **Turn loop (Phase 2 scope):** `reduce(state, action, rules)`; the precedence is Phase 1's. System actions (`combat/start`, `system/*`, `decision/open`, `timeout`) come from the host/sim; player actions (`decision/commit`, `loadout/*`) come from humans or the AI.
4. **Combat:** `combat/start` opens the first exchange decision; each player's prompt is private; commits are hidden until the last required player commits or the system times out; reveal updates the public choice history, draws NPC commands, resolves via pure `resolveExchange`, and either opens the next decision or ends the combat (+ rewards) — all inside one `reduce` call.
5. **CPU:** host loop calls `decideCombat(viewFor(state, cpuId), rules, ai)` → `action` → `reduce`; the AI's own RNG state is kept by the host (sim) and never enters `GameState`.
6. **Replay/sim files:** `{rulesHash, settings, actions}`; replay checks the hash first (mismatch → exit 3 unless allowed), then folds `reduce`.
7. **Views:** clients and (later) the server only ever send `viewFor`/`eventsFor` projections; prompts and bag/scroll events are private.
8. **CI:** install → lint → lint:purity → format:check → typecheck → test (includes the gate and the 10k perf test) → build → `pnpm sim duel --n 264 --seed ci`.

## Compatibility Constraints
- Everything from Phase 1 (Node ≥ 22.13 per root `engines`, pnpm 10.33.0, TypeScript ~6.0.3, ESM, strict tsconfig options, pinned versions). **No new third-party dependencies** in Phase 2; only workspace links (`@usurpia/content` → `@usurpia/core`, `@usurpia/sim` → `@usurpia/content`), added in W1 so later waves never touch `pnpm-lock.yaml`.
- Core stays pure: never `Math.random`. The AI additionally never uses `Math.exp`/`Math.log`/`Math.pow` (lint-enforced); it uses `expNeg` and only exactly-specified IEEE-754 operations, so **AI goldens are engine-independent**, not merely V8/Node-exact. (Floats never enter `GameState`: the AI's only output is a choice token.)
- State, actions and events contain only JSON values; all state numbers are integers (property test: every number in every reachable state satisfies `Number.isSafeInteger`).
- `@usurpia/core` gains `exports["./ai"] = "./src/ai/index.ts"`; `@usurpia/content` gains `exports["./node"] = "./src/node.ts"`. Package `index.ts` files stay browser-safe.
- Save/replay compatibility: v1 saves are rejected (`SchemaVersionError`); there is no v1 → v2 migration (no users yet).
- Tuning changes after Phase 2 must update `84a995db`, the sim fixture, sim stdout goldens, the perf total line, gate counts and `traces/` in one commit (regenerate with the golden oracle).
- The golden oracle requires Node ≥ 22.13 and `python3` (planning-time only; not a repo/CI dependency).

## Failure Modes
Every negative test is built from a **known-valid** fixture with **exactly one** mutation and asserts the **exact** code and message, so a test cannot pass because an earlier check fired (PIT-001). Records keyed by ids are exercised with `toString`/`valueOf`/`hasOwnProperty`/`constructor`-like ids where the pattern allows (PIT-002).

| Failure Mode | Expected Behavior | Verification (single-mutation design) |
|--------------|-------------------|---------------------------------------|
| Commit a choice not in the player's own options (e.g. defender commits `"attack"`, or `"item:bomb"` without a bomb) | `INVALID_PAYLOAD` "choice is not one of your options"; state `===` input | `decision.test.ts`: open fixture decision, uncommitted player, valid decision id, token-shaped choice ∉ options |
| Token length (critique #6) | `CHOICE_PATTERN` accepts 1..64 chars: `"item:" + <48-char content id>` (53 chars) and a 64-char token are valid options/choices; a 65-char token fails the shape guard (`INVALID_PAYLOAD`) | `decision.test.ts` (poll with the 53- and 64-char options, commit them; 65-char option rejected); `combat-flow.test.ts` (02-03): a bag item with a 48-char id yields option `item:<id>` and committing it resolves |
| Commit stale / twice | `STALE_DECISION` / `ALREADY_COMMITTED` (checked before the options check) | `decision.test.ts`: the double commit reuses an **in-options** choice |
| Poll with duplicate players, unseated player, duplicate options, default ∉ options | `INVALID_PAYLOAD` with the four distinct messages | `decision.test.ts`, each from the same valid prompt list with one field changed |
| `combat/start` invalid (unseated attacker, KO'd attacker, self-duel, KO'd opponent, unknown monster/guardian, enforcer level > max, seq overflow) | `INVALID_PAYLOAD`, unique messages | `combat-flow.test.ts`, one mutation each from a valid start |
| Combat actions in the wrong phase (`combat/start` during a decision, `loadout/*` during combat) | `WRONG_PHASE` | `combat-flow.test.ts`, `loadout.test.ts` |
| Player sends a system action / commit by a non-required player | `WRONG_ACTOR` | `reducer.test.ts`, `combat-flow.test.ts` |
| Stunned attacker / stunned defender | `ExchangeSkipped` / defender not in `required`, defense `"open"`, stun consumed once | `combat-flow.test.ts` (Jolt fixture) |
| Draw after `maxRounds`, double KO | `CombatEnded draw` | `combat-flow.test.ts` (crafted stats) |
| Bag overflow on grant / 4th scroll / class switch without the exact discard list / discarded item not in bag / hybrid not unlocked / not enough gold | `INVALID_PAYLOAD`, unique messages | `inventory.test.ts`, `loadout.test.ts`: a fixture exactly at the limit, one mutation each (e.g. overflow test has enough gold and an unlocked class) |
| Using a board-only or joke item outside combat; using an item while KO'd | `INVALID_PAYLOAD` | `loadout.test.ts` |
| Portable set without rank 5 | `INVALID_PAYLOAD` | `progression.test.ts` (fixture at 17 wins → 18 passes) |
| Counter overflow (`decisionSeq`, `combatSeq`, gold/xp grant) / saturating internal counters | reject / saturate at `MAX_COUNTER` | `counter-bounds.test.ts` |
| Deserialize: wrong version, any shape or referential error, npc snapshot ≠ recomputation, hp > max, level ≠ levelForXp(xp), prompt ≠ engine prompt, combat without decision | `SchemaVersionError` / `TypeError` with the unique message | `serialize.test.ts`: table of single mutations of the W2 mid-combat golden state; a meta-test asserts the table's messages are unique and that the unmutated base passes |
| Invalid content (schema, duplicate id, reserved id `constructor`, cross-ref) | `buildRules` `ok:false` with file/path/message; CLI exit 1; `pnpm build` fails | `build-rules.test.ts` (in-memory single mutations), `validate.test.ts` (temp-dir CLI subprocess, exit exactly 1) |
| Replay file with a different `rulesHash` | `RulesMismatchError`, CLI exit 3; `--allow-rules-mismatch` proceeds with suffix | `replay-file.test.ts` |
| Sim usage errors | stderr `usage: …`, exit 2 | `cli.test.ts` (subprocess) |
| Core/handlers import `ai/`; AI imports reducer/handlers/`GameState` | `pnpm lint` fails | `pnpm lint:purity` probe cases |
| AI peeking at hidden info | impossible by signature; identical decisions across hidden-only variants | `ai-hidden.test.ts` (variants proven distinct first) |
| Non-integer or non-finite number in state | never produced | property test over reachable states |

## Acceptance Checks
| Check | Command or Evidence | Required |
|-------|---------------------|----------|
| Full pipeline | `pnpm install --frozen-lockfile && pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` | true |
| Matrix cells + variants (R6) | `pnpm vitest run packages/core/test/resolve.test.ts` | true |
| Combat state machine + golden (R6) | `pnpm vitest run packages/core/test/combat-flow.test.ts packages/core/test/combat-golden.test.ts` | true |
| Classes, mastery, hybrids, portable (R5) | `pnpm vitest run packages/core/test/stats.test.ts packages/core/test/progression.test.ts packages/core/test/rewards.test.ts packages/core/test/rewards-golden.test.ts` | true |
| Limits and overflow (R7) | `pnpm vitest run packages/core/test/inventory.test.ts packages/core/test/loadout.test.ts` | true |
| Content loads with tiered curves (R8) | `pnpm vitest run packages/content/test/data.test.ts packages/content/test/build-rules.test.ts packages/core/test/npc.test.ts` | true |
| Kernel v2 properties (≥ 200 runs each: determinism, never throws, no mutation of frozen input, rejection identity, split-replay via `deserialize(serialize(s), rules)`, integers only, leak/structural redaction) | `pnpm vitest run packages/core/test/replay.test.ts packages/core/test/views.test.ts packages/core/test/serialize.test.ts` | true |
| Sim 10k duels (R9, critique #12; owner 02-05) | `pnpm vitest run packages/sim/test/perf.test.ts` — spawns `pnpm sim duel --n 10000 --seed perf`, asserts exit 0, wall ≤ 60 000 ms, both section headers, last line `total n=10000 a=5411 b=2370 draw=2118 fled=101` (also runs inside `pnpm test` in CI) | true |
| CI smoke (separate from the perf test) | CI step `pnpm sim duel --n 264 --seed ci` after `pnpm build`; last line `total n=264 a=154 b=57 draw=51 fled=2` (pinned in `duel.test.ts`) | true |
| Hard ≥ 70% vs Easy **and** draw rate ≤ 40% in every gate mirror (R9/R14 prep, D1) | `pnpm vitest run packages/sim/test/gate.test.ts` (exact counts per class; in the W3 closing step also the per-duel hashes) | true |
| Ward without a ward spell (D2) | `resolve.test.ts` Spell×Ward base cell = 18 with `ward: null` and 7 with Barrier; sim fixture row #3 | true |
| Golden oracle consistent with this spec | `node .planning/reference/phase-02/verify-spec.mjs` prints `0 failed` (spec author / orchestrator; not a plan task) | true |
| AI never reads hidden info | `pnpm vitest run packages/core/test/ai-hidden.test.ts` and `pnpm lint:purity` | true |
| Replay fixture | `pnpm sim replay packages/sim/fixtures/combat-game.json` prints `hash=0483c0fa rules=84a995db turn=1 events=95 rejections=0` | true |
| Sample module gone, README current (critique #13) | `! grep -rnE "sample/|setSecret|lastRoll|defaultChoice|sample-game|\{ settings, actions \}" packages/*/src packages/*/test packages/sim/fixtures README.md` (no matches) and `grep -q "rulesHash" README.md` — run at the end of 02-01a, 02-01b and 02-05 | true |
| CI green on `dev` with the sim smoke step | GitHub Actions run on the final W3 commit | true |

## Deliverables
**Six plans in four waves** (critique #4): **W1a** 02-01a → **W1b** 02-01b (sequential) → **W2** 02-02 ∥ 02-03 → **W3** 02-04 ∥ 02-05, where 02-05's task 3 is the **W3 closing step** that runs only after 02-04 is committed. Every plan has ≤ 3 tasks; each task is a coherent unit with its own verification command and ends green (`pnpm lint`, package-scoped `typecheck`/`test`). Same-wave plans own **disjoint** files (listed exhaustively; "C" create, "M" modify, "D" delete); sequential plans may touch the same file. Every plan also owns its own `SUMMARY.md`, runs package-scoped lint/typecheck/test while parallel, and ends with a commit on `dev` (no `.tsbuild`/`dist`/`node_modules`). No plan edits `.planning/reference/**`. Agents per PRF-003: executors `sonnet`, the mandatory testing role `testing-qa-verification-specialist` on every plan.

### Wave 1a — Plan 02-01a: Kernel v2 data model and Rules threading
- **Purpose:** binding decision OQ5a (content injection) and the v2 state shape; everything compiles and tests pass on v2, but the kernel has **no actions yet** (`Action` is the empty union, `ACTION_TYPES = []`, handler map `{}`: every versioned object is `UNKNOWN_ACTION`, every non-object/`v ≠ 2` is `UNSUPPORTED_VERSION`). Sample module removed.
- **Task 1 — Rules contract + TEST_RULES + stats.** C: `packages/core/src/rules.ts`, `packages/core/src/combat/{passives,stats}.ts`, `packages/core/test/fixtures/test-rules.ts`, `packages/core/test/{rules,stats}.test.ts`. Verify: `pnpm vitest run packages/core/test/rules.test.ts packages/core/test/stats.test.ts` (`rulesHash(TEST_RULES) = 7433ea8b`, the stats table, `applyPassives` exhaustiveness, `adjustHp`).
- **Task 2 — State v2 + reducer threading.** C: `packages/core/src/handlers/{index,shared}.ts` (empty exhaustive map, guards, `reject`, `overflow`), `packages/core/test/fixtures/build.ts`. M: `packages/core/src/{types,actions,events,reducer,validation,serialize,game,replay,views,index}.ts` — `serialize.ts` is a **compile shim** in W1a: `deserialize(json, rules)` does `JSON.parse`, plain-object and `v === 2` (`SchemaVersionError`) checks, then the root exact-key check, and otherwise throws `TypeError("deserialize: v2 validation lands in 02-01b")`; `views.ts` builds `{v, viewer, public, self}` (no `counts` yet). M tests (trimmed to what W1a can reach): `reducer.test.ts` (UNSUPPORTED_VERSION incl. `v:1` actions and Phase 1 sample types → UNKNOWN_ACTION with `v:2`, canonicalize-once, rejection identity, frozen input), `game.test.ts` (createGame golden `758ef72c` + canonical JSON, every `SettingsError` case incl. hybrid seat class), `views.test.ts` (`self` for seated players, `null` for spectators/unknown/prototype-like ids; never another player's private), `serialize.test.ts` (shim behaviour), `replay.test.ts` (empty replay, junk actions rejected and replay continues, determinism). D: `packages/core/src/handlers.ts`, `packages/core/test/{decision.test,counter-bounds.test,arbitraries}.ts` (they only exercise v1 sample/decision actions; 02-01b re-creates them for v2). Verify: `pnpm --filter @usurpia/core test && pnpm --filter @usurpia/core typecheck` (or `tsc -b packages/core`).
- **Task 3 — Workspace links, sim/client compile shims, README, tool exclusions.** C: `packages/sim/src/{kernel-rules,rules}.ts`, `packages/client/src/demo-rules.ts`. M: `packages/sim/src/{cli,replay-file}.ts` (v2 replay file with `rulesHash`, exit 3 on mismatch, `--allow-rules-mismatch`), `packages/sim/test/replay-file.test.ts` (function + Phase 1 CLI subprocess tests re-pointed at temp files; empty-replay line `hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=0`; mismatch exit 3), `packages/sim/{package.json,tsconfig.json}` (+`@usurpia/content` dep/reference), `packages/content/{package.json,tsconfig.json}` (+`@usurpia/core` dep/reference), `packages/client/src/{main,render}.ts` (W1a: `createGame` with `DEMO_RULES` and render only; player line without the ` bag <n>` suffix, no pending/options lines), `packages/client/test/render.test.ts`, `pnpm-lock.yaml`, `README.md` (critique #13: replay file is `{ rulesHash, settings, actions }`, `--allow-rules-mismatch`, exit codes 0/1/2/3; no sample references). D: `packages/sim/fixtures/sample-game.json`. Also checks (no edit expected) the golden-oracle exclusions listed in *Golden oracle and traces*. Verify: full pipeline + the sample/README grep acceptance check.
- **Dependencies:** none (Phase 1 complete). **Estimated size:** ~650 lines src, ~600 lines tests.

### Wave 1b — Plan 02-01b: Generic decisions, deserialize v2, views counts, property suite
- **Purpose:** binding decisions OQ5b–c; the W1 action set, full `deserialize(json, rules)` (combat still rejected), `viewFor.counts`, the Phase 1 property suite on v2, the kernel-game fixture and the sim CLI tests.
- **Task 1 — Decision module.** C: `packages/core/src/handlers/decision.ts` (`decision/open` poll, `decision/commit`, `timeout`, `openDecision`, reveal + resolver dispatch with `resolveUnsupported` for `combat/exchange`), `packages/core/test/decision.test.ts` (incl. the `CHOICE_PATTERN` 53/64/65-char cases). M: `packages/core/src/{actions,events}.ts` (W1 union, `ACTION_TYPES`, guards), `packages/core/src/handlers/{index,shared}.ts`, `packages/core/test/reducer.test.ts` (WRONG_PHASE / WRONG_ACTOR / state-validation precedence). Verify: `pnpm vitest run packages/core/test/decision.test.ts packages/core/test/reducer.test.ts`.
- **Task 2 — deserialize v2 + views counts.** M: `packages/core/src/{serialize,views}.ts`, `packages/core/test/{serialize,views}.test.ts` (single-mutation table, uniqueness meta-test, redaction/leak properties). Verify: `pnpm vitest run packages/core/test/serialize.test.ts packages/core/test/views.test.ts`.
- **Task 3 — Property suite, kernel fixture, CLI tests, client demo.** C: `packages/core/test/{arbitraries,counter-bounds.test}.ts`, `packages/sim/fixtures/kernel-game.json`, `packages/sim/test/cli.test.ts`. M: `packages/core/test/replay.test.ts` (≥ 200 runs per property; kernel golden `9616698e`), `packages/sim/test/replay-file.test.ts` (fixture line), `packages/client/src/{main,render}.ts` + `packages/client/test/render.test.ts` (demo decision; ` bag <n>` suffix, pending and options lines). Verify: full pipeline + sample/README grep.
- **Dependencies:** 02-01a. **Estimated size:** ~550 lines src, ~800 lines tests.

### Wave 2 — Plan 02-02: Content (schemas, data, `buildRules`)
- **Task 1 — Schemas + registry + validate.** C: `packages/content/src/schemas/{classes,gear,spells,monsters,tuning}.ts`. M: `packages/content/src/{index,registry,validate}.ts`, `packages/content/src/schemas/{common,items}.ts`. Verify: package typecheck.
- **Task 2 — Data + `buildRules` + Node loader.** C: `packages/content/src/{build-rules,node}.ts`, `packages/content/data/{classes,gear,spells,monsters,tuning}.json`. M: `packages/content/data/items.json`, `packages/content/package.json` (`exports["./node"]`, no dependency changes). Verify: `pnpm validate:content` exits 0.
- **Task 3 — Tests.** C: `packages/content/test/{build-rules,data}.test.ts`, `packages/content/test/helpers.ts`. M: `packages/content/test/validate.test.ts`. D: `packages/content/test/fixtures/**`. Verify: `pnpm --filter @usurpia/content test` (`rulesHash === "84a995db"`, counts, every cross-ref message incl. "npc sheet-stat hooks are not applied", reserved id).
- **Purpose:** R5/R7/R8 data; the only producer of `Rules`. **Dependencies:** 02-01b. **Parallel with 02-03** (no shared files). **Estimated size:** ~500 lines src, ~900 lines JSON, ~500 lines tests.

### Wave 2 — Plan 02-03: Combat engine (resolve → flow → golden)
- **Task 1 — Resolve (pure math).** C: `packages/core/src/combat/{options,resolve}.ts`, `packages/core/test/{resolve,npc}.test.ts`. M: `packages/core/src/index.ts` (exports). Verify: `pnpm vitest run packages/core/test/resolve.test.ts packages/core/test/npc.test.ts` (every matrix cell incl. D2, every variant row).
- **Task 2 — Flow (state machine, handlers, deserialize combat).** C: `packages/core/src/handlers/{combat,system}.ts`, `packages/core/test/combat-flow.test.ts`. M: `packages/core/src/{actions,events,serialize}.ts`, `packages/core/src/handlers/index.ts` (register `combat/start`, `system/setCharacter`, the `combat/exchange` resolver), `packages/core/test/{arbitraries,serialize.test,views.test,replay.test,counter-bounds.test}.ts`. Verify: `pnpm vitest run packages/core/test/combat-flow.test.ts packages/core/test/serialize.test.ts packages/core/test/replay.test.ts`.
- **Task 3 — Golden.** C: `packages/core/test/combat-golden.test.ts` (hash `ec0c3508`, 80 events, the exchange table, the type sequence, final hidden/choiceHistory; a mismatch is localised with `traces/combat-golden.trace.json`). Verify: `pnpm --filter @usurpia/core test`.
- **Purpose:** R6 and the NPC half of R8. **Dependencies:** 02-01b. **Parallel with 02-02.** **Estimated size:** ~900 lines src, ~1 000 lines tests.

### Wave 3 — Plan 02-04: Progression + inventory
- **Task 1 — Progression + reward hook.** C: `packages/core/src/progression.ts`, `packages/core/test/{progression,rewards}.test.ts`. M: `packages/core/src/handlers/combat.ts` (reward hook in `endCombat`), `packages/core/src/events.ts`. Verify: `pnpm vitest run packages/core/test/progression.test.ts packages/core/test/rewards.test.ts`.
- **Task 2 — Inventory + loadout handlers.** C: `packages/core/src/inventory.ts`, `packages/core/src/handlers/loadout.ts`, `packages/core/test/{inventory,loadout}.test.ts`. M: `packages/core/src/{actions,index}.ts`, `packages/core/src/handlers/index.ts`. Verify: `pnpm vitest run packages/core/test/inventory.test.ts packages/core/test/loadout.test.ts`.
- **Task 3 — Rewards golden + suites.** C: `packages/core/test/rewards-golden.test.ts` (`57da3ea4`, 84 events). M: `packages/core/test/{arbitraries,counter-bounds.test,views.test}.ts` (loadout actions; grant overflow; private `Granted`/`ScrollsUpdated` redaction). Verify: `pnpm --filter @usurpia/core test`.
- (no files outside `packages/core/`). **Purpose:** R5 progression/hybrids/portable, R7 limits and class-switch overflow, rewards. **Dependencies:** 02-02, 02-03. **Parallel with 02-05.** **Estimated size:** ~600 lines src, ~800 lines tests.

### Wave 3 — Plan 02-05: CPU AI + balance sim (+ W3 closing step)
- **Task 1 — CPU AI.** C: `packages/core/src/ai/{index,combat,opponent-model,tuning,exp}.ts`, `packages/core/test/{ai,ai-hidden,ai-exp}.test.ts`. M: `packages/core/package.json` (`exports["./ai"]`), `eslint.config.js`, `scripts/check-core-purity.mjs`. Verify: `pnpm vitest run packages/core/test/ai.test.ts packages/core/test/ai-hidden.test.ts packages/core/test/ai-exp.test.ts && pnpm lint && pnpm lint:purity`.
- **Task 2 — Sim duel, report, fixture, gate counts, perf.** C: `packages/sim/src/{duel,kits,report}.ts`, `packages/sim/test/{duel,gate,perf,content-stats}.test.ts`, `packages/sim/fixtures/combat-game.json`. M: `packages/sim/src/{cli,index,rules}.ts` (`duel` subcommand; `replayRules()` → `loadRules()`), `packages/sim/test/{cli,replay-file}.test.ts`, `.github/workflows/ci.yml` (smoke step after `pnpm build`), `README.md` (sim commands). D: `packages/sim/src/kernel-rules.ts`, `packages/sim/fixtures/kernel-game.json`. Pins **only reward-independent goldens**: stdout blocks, gate counts, gate per-duel `(outcome, winner)`, sim fixture line, content NPC spot stats, perf total line. **Must not** pin `DuelResult.events`/`hash`. Verify: `pnpm --filter @usurpia/sim test` + the sample/README grep.
- **Task 3 — W3 closing step (runs after the 02-04 commit is on `dev`; 02-05 rebases onto it first).** M: `packages/sim/test/gate.test.ts` only — add the per-duel `(events, hash)` pins for the first 20 gate duels per class (the `events`/`hash` fields of `traces/gate.trace.json`, i.e. with rewards). Then rerun **every composite golden** on the merged W3 state: `pnpm test` (all packages: combat golden, rewards golden, sim fixture, stdout, gate, perf), `pnpm sim replay packages/sim/fixtures/combat-game.json`, the full pipeline and CI. Any change to a reward-independent golden is a bug (stop and escalate); only the task-3 pins may depend on rewards. Commit; W3 (and Phase 2 execution) is complete only after this commit.
- **Purpose:** R9 and the combat half of R14 (binding OQ5d). **Dependencies:** 02-02, 02-03 (tasks 1–2); 02-04 (task 3 only). **Parallel with 02-04** for tasks 1–2 (disjoint files: 02-05 never touches `packages/core/src/**` outside `ai/`, nor `packages/core/test/{arbitraries,counter-bounds.test,views.test}.ts`, nor `packages/core/src/index.ts`). **Estimated size:** ~950 lines src, ~800 lines tests.

### File ownership matrix
| Path | 02-01a (W1a) | 02-01b (W1b) | 02-02 (W2) | 02-03 (W2) | 02-04 (W3) | 02-05 (W3) |
|---|---|---|---|---|---|---|
| `core/src/rules.ts`, `core/src/combat/{passives,stats}.ts` | C | | | | | |
| `core/src/{types,validation,game,replay}.ts` | M | | | | | |
| `core/src/reducer.ts` | M | | | | | |
| `core/src/actions.ts`, `core/src/events.ts` | M | M | | M | M | |
| `core/src/serialize.ts` | M (shim) | M | | M | | |
| `core/src/views.ts` | M | M | | | | |
| `core/src/index.ts` | M | | | M | M | |
| `core/src/handlers.ts` | D | | | | | |
| `core/src/handlers/{index,shared}.ts` | C | M | | M (index) | M (index) | |
| `core/src/handlers/decision.ts` | | C | | | | |
| `core/src/handlers/{combat,system}.ts` | | | | C | M (combat) | |
| `core/src/combat/{options,resolve}.ts` | | | | C | | |
| `core/src/{progression,inventory}.ts`, `core/src/handlers/loadout.ts` | | | | | C | |
| `core/src/ai/*.ts`, `core/package.json` | | | | | | C / M |
| `core/test/fixtures/{test-rules,build}.ts` | C | | | | | |
| `core/test/{rules,stats}.test.ts` | C | | | | | |
| `core/test/{reducer,game}.test.ts` | M | M (reducer) | | | | |
| `core/test/{views,serialize,replay}.test.ts` | M | M | | M | M (views) | |
| `core/test/{decision.test,counter-bounds.test,arbitraries}.ts` | D | C | | M (counter-bounds, arbitraries) | M (counter-bounds, arbitraries) | |
| `core/test/{resolve,npc,combat-flow,combat-golden}.test.ts` | | | | C | | |
| `core/test/{progression,inventory,loadout,rewards,rewards-golden}.test.ts` | | | | | C | |
| `core/test/{ai,ai-hidden,ai-exp}.test.ts` | | | | | | C |
| `content/**` except `package.json`/`tsconfig.json` | | | C/M/D | | | |
| `content/{package.json,tsconfig.json}` | M | | M (package.json) | | | |
| `sim/src/{kernel-rules,rules}.ts` | C | | | | | D / M |
| `sim/src/{cli,replay-file}.ts` | M | | | | | M (cli) |
| `sim/src/{duel,kits,report}.ts`, `sim/src/index.ts` | | | | | | C / M |
| `sim/test/replay-file.test.ts` | M | M | | | | M |
| `sim/test/cli.test.ts` | | C | | | | M |
| `sim/test/{duel,gate,perf,content-stats}.test.ts` | | | | | | C (gate also T3) |
| `sim/fixtures/sample-game.json` | D | | | | | |
| `sim/fixtures/kernel-game.json` | | C | | | | D |
| `sim/fixtures/combat-game.json` | | | | | | C |
| `sim/{package.json,tsconfig.json}`, `pnpm-lock.yaml` | M | | | | | |
| `client/src/demo-rules.ts` | C | | | | | |
| `client/src/{main,render}.ts`, `client/test/render.test.ts` | M | M | | | | |
| `README.md` | M | | | | | M |
| `eslint.config.js`, `scripts/check-core-purity.mjs`, `.github/workflows/ci.yml` | (check only) | | | | | M |
| `.planning/reference/phase-02/**` | — spec author only — | | | | | |

W2 columns (02-02, 02-03) and W3 columns (02-04, 02-05) share no path.

## Path Validation
**Status:** All paths valid. Re-verified against the working tree on `dev` (2026-09-29, Revision 2): every "M"/"D" path exists (`packages/core/src/handlers.ts`, `packages/core/test/{decision.test,counter-bounds.test,arbitraries}.ts`, `packages/sim/fixtures/sample-game.json`, `packages/sim/src/index.ts`, `packages/content/test/fixtures/{valid,invalid}/items.json`, `scripts/check-core-purity.mjs`, `.github/workflows/ci.yml`, `README.md`, `eslint.config.js`, …); every "C" path's parent directory exists or is created by the owning plan (`core/src/combat/`, `core/src/handlers/`, `core/src/ai/`, `core/test/fixtures/`). Paths deleted by 02-01a and re-created by 02-01b (`core/test/{decision.test,counter-bounds.test,arbitraries}.ts`) are sequential, not a conflict. The golden oracle `.planning/reference/phase-02/` (incl. `traces/`) exists; its tool exclusions (`eslint.config.js` `ignores: [".planning/**"]`, `.prettierignore` `.planning/`) are already present. No `.planning/config/directory-mappings.yaml` exists.

## Open Questions
| # | Question | Impact | Default Chosen by Spec | Planning Effect |
|---|----------|--------|------------------------|-----------------|
| 1 | Keep a generic `decision/open` system action after the sample removal? | Non-blocking | Yes, as kind `poll` (per-player options/defaults), satisfying "opened by system actions"; it gives W1 a testable decision flow and Phase 3 a generic prompt | Use the default |
| 2 | Draws dominate some mirrors (Mage mirror ~70% draws at L5) | Resolved (D1) | Retuned (Revision 2); the gate now caps draws at 40% per mirror (max observed 28.5%) | Use the default |
| 3 | Initial class balance (e.g. Mage beats Warrior at L5) | Non-blocking | Numbers are **initial tuning**; the sim's job is to report it; no balance gate in Phase 2 except the Hard-vs-Easy gate (≥ 70% decisive, ≤ 40% draws) | Use the default |
| 4 | Where do KO'd players go / how do they revive? | Non-blocking | Phase 2 leaves hp 0 (combat/start rejects KO'd fighters); `system/setCharacter` fully heals for sims/tests; Temple revival is Phase 3 | Use the default |
| 5 | PvP spoils (steal gold/item, seize, humiliate) and Thief/Shadowpriest board passives | Non-blocking | Phase 5 / Phase 3; PvP KO grants only `pvpXpPerLevel × loser level` XP and a mastery win | Use the default |
| 6 | Class switching location/fee timing | Non-blocking | Allowed in phase `turn` anywhere, fee charged; Phase 3 restricts to the Castle | Use the default |
| 7 | AI use of flee, tonics, Smoke Bomb, and poll decisions | Non-blocking | Not used by the Phase 2 AI (heal rule only); Phase 3 persona AI extends | Use the default |
| 8 | Damage variance roll | Non-blocking | None in Phase 2; adding one later is a tuning-contract change (new field + revision row) | Use the default |
| 9 | Temporary `TEST_RULES` copies in sim (W1–W2) and client (until Phase 4) | Non-blocking | Accept; both are typed `Rules`, the sim copy is deleted in 02-05; the client copy is replaced when Phase 4 wires content | Use the default |
| 10 | Fixture/golden churn on every content tuning change | Non-blocking | Accept (explicit rehash in the same commit); keeps "the sim ran on exactly these rules" provable | Use the default |
| 11 | Gate scope: D1 names the four base-class mirrors; should the two hybrid mirrors also be gated? | Non-blocking | Yes — all 6 mirrors are gated (all pass: min 0.773 / max draw 0.285); dropping hybrids later is a one-line test change | Use the default |
| 12 | D2 details: does Ward with no ward spell still block spell side effects, and does Cleric's `wardReflectBp` still reflect? | Non-blocking | Yes to both — D2 changes only the step-3 multiplier (Spell×Ward = Guard multiplier); the Ward command still blocks effects and the reflect hook still reflects (variant rows pin 18/9) | Use the default |
| 13 | 02-01a leaves an action-less kernel between W1a and W1b | Non-blocking | Accept: W1a/W1b are sequential, `dev` stays green, the v1 behavioural suites are deleted in 02-01a and re-created in 02-01b | Use the default |
| 14 | `perf.test.ts` runs 10 000 duels inside `pnpm test` (~3–20 s) | Non-blocking | Accept (critique #12 asks for automation); it is a single test with a 180 s timeout, separate from the n=264 CI smoke | Use the default |
| 15 | Sim kits keep two Herbs; heals prolong fights | Non-blocking | Keep; D1 was met by tuning content only (kits unchanged) | Use the default |
| 16 | Should NPC sheet-stat hooks be supported instead of rejected (critique #7)? | Non-blocking | Rejected by a content cross-ref rule; the Ogre uses `attackDmgBp` 1000. Supporting them later means applying `*Bp` hooks in `npcStats` + a revision row | Use the default |

No blocking questions.

## Complexity Assessment

**Rating:** Complex

| Metric | Value |
|--------|-------|
| Requirements | 5 (R5–R9) |
| Deliverables | 6 plans, 18 tasks (3 per plan), ~100 files (new ~60, modify ~42, delete ~7) |
| Estimated waves | 4: W1a (02-01a) → W1b (02-01b) → W2 (02-02 ∥ 02-03) → W3 (02-04 ∥ 02-05, then the 02-05 closing step) |
| Estimated plans | 6 |
| Competing proposals | Already run: "Hybrid: Pragmatic-based" selected by the user |

**Rationale:** Phase 2 replaces the kernel's gameplay layer while keeping every Phase 1 contract, introduces the first real rule data flow across packages, and pins integer combat math, AI behaviour and simulator output with golden values from a committed reference implementation (the golden oracle). The cross-cutting kernel change is split into two sequential plans (data model/threading, then behaviour/persistence/properties); later parallel plans own disjoint files; the only W3 cross-plan coupling (reward events inside duel hashes) is isolated in the 02-05 closing step.

**Recommended next step:** Decompose into the 6 plans above using this spec as the primary source; the orchestrator applies the follow-ups below.

## Orchestrator follow-ups
- **ROADMAP:** change Phase 2's plan count **5 → 6** (02-01 split into 02-01a and 02-01b; 4 waves: W1a → W1b → W2 → W3). Do not change anything else in Phase 2's scope.
- **ROADMAP:** note that "~20 monsters" is satisfied as **20 NPC definitions** = 16 zone monsters (4 per zone/tier) + 3 town guardians + the Crown Enforcer (plus data-only Senior variants).
- Keep `.planning/reference/phase-02/` in the repository (it is the golden oracle referenced by the plans); rerun `node .planning/reference/phase-02/verify-spec.mjs` after any spec edit.
- W3 is complete only after the 02-05 closing step (task 3) is committed on top of 02-04.
- **Golden maintenance after Phase 2 (Revision 2.15):** once the 02-05 closing step commits, freeze `.planning/reference/phase-02/` (kept for history, never regenerated); from Phase 3 on the reviewed TypeScript engine is the oracle (exact goldens re-pinned from engine output in the same commit that changes rules, diff reviewed; the D1 gate asserted as thresholds once rules change). Record this in the Phase 3 context.

## Revision History
| # | Section | Change | Reason |
|---|---------|--------|--------|
| 1 | All | Initial Phase 2 spec: binding OQ5 decisions encoded; Rules/state/actions/events/deserialize contracts; integer damage math with golden matrix; combat state machine and draw order; content data (initial tuning, pinned by `rulesHash 94160b70`); AI algorithm with policy goldens; sim CLI/report/gate goldens; 5-plan wave split with disjoint ownership. All goldens computed by the planner's reference implementation (Node scratch scripts, 2026-09-29) | Phase 2 planning (user-approved architecture "Hybrid: Pragmatic-based") |
| 2.1 | Key Decisions, R6, `computeCell` step 3/15, `DEFENDER_OPTIONS`, matrix + variants, combat golden #9–#10, content matrix note | **Ward without a ward spell uses the Guard multiplier** (`matrix.spell.guard`) for Spell×Ward; Barrier (`valueBp 0`) is the 0.4× baseline; the Ward command still blocks spell effects. Matrix base Spell×Ward 7 → **18**; new variant rows (Barrier Attack×Ward, `wardReflectBp` with/without Barrier, Hex/Leech vs Ward); combat golden row #9 damage 4 → 12 (hash `ec0c3508` unchanged: gull hp is not in the final state) | User decision D2; critique #3 |
| 2.2 | R9, Key Decisions, Content data (classes, battle spells, tuning), gate | **Gate = Hard ≥ 70% of decisive duels AND draw rate ≤ 40% in every mirror**, `decisive = hardWins + easyWins`, `rate = hardWins/decisive`, `drawRate = draws/400`, exact counts pinned. Retune: warrior aiBias 30/50/20/50/30/20, mage aiBias 30/20/50/40/30/30, fireball 14000, thunderclap 16000, royal-decree 20000, `kBp` 14500, `jMagBp` 3500, `growth.hp` 9. New gate table (min Hard-decisive 0.773, max draw 0.285) | User decision D1; critique #2 |
| 2.3 | Content data (monsters), `rules.ts` notes, cross-ref rules | Ogre Middle Manager hook `atkBp` → **`attackDmgBp` 1000**; new content rule "npc sheet-stat hooks are not applied"; content NPC spot-stat golden table | Critique #7 |
| 2.4 | Content hash and every content-derived golden | `rulesHash(loadRules())` `94160b70` → **`84a995db`**; sim fixture rebuilt (23 actions, `a` has no ward spell) → **`hash=0483c0fa rules=84a995db turn=1 events=95 rejections=0`**; mirrors stdout, classes total, CI smoke total and a new perf total line re-pinned | Consequence of 2.1–2.3 |
| 2.5 | Overview, Key Decisions, new *Golden oracle and traces*, Golden summary | Reference implementation committed at `.planning/reference/phase-02/` and named the golden oracle; tool exclusions stated (owner 02-01a, no edit needed today); per-action traces for kernel, combat, rewards and sim-fixture replays and per-duel traces for the first 20 gate duels per class under `traces/`; binding mismatch-localisation protocol; `verify-spec.mjs` | Critique #1 |
| 2.6 | `runDuel`, Golden summary, Deliverables (02-05 task 3) | `DuelResult.events`/`hash` defined and declared reward-dependent; 02-05 may pin them only in the **W3 closing step** after the 02-04 commit, which also reruns every composite golden | Critique #5 |
| 2.7 | Deliverables, ownership matrix, Complexity, follow-ups | 02-01 split into **02-01a** (rules/types/TEST_RULES/stats/createGame/reducer threading + sim/client shims + README) and **02-01b** (decision module, deserialize v2, views counts, property suite, kernel fixture, CLI tests); 6 plans, 4 waves, every plan ≤ 3 tasks (02-03: resolve → flow → golden); explicit per-path ownership matrix | Critique #4 |
| 2.8 | `types.ts`, Failure Modes | `CHOICE_PATTERN` `{0,47}` → **`{0,63}`** (fits `item:` + 48-char id) with 53/64/65-char tests | Critique #6 |
| 2.9 | `rules.ts` notes, guardians table | Guardians and enforcer ship `hooks: []`; `EnforcerDef` has no `style` | Critique #8 |
| 2.10 | Architecture dependency rules, Lint and purity probe | AI import ban extended to `index`/`serialize`/`game`/`replay`/`@usurpia/core` and the `GameState`/`HiddenState` names from any path; new probe cases | Critique #9 |
| 2.11 | AI algorithm step 7, Compatibility | Softmax via `expNeg` (no `Math.exp`/`log`/`pow`, lint-banned in `ai/`); AI goldens engine-independent; `ai-exp.test.ts`; every AI weight/ev/rng golden unchanged | Critique #10 |
| 2.12 | Overview, R8 | 20 NPC definitions = 16 zone monsters + 4 special NPCs, stated as the roadmap's "~20 monsters" | Critique #11 |
| 2.13 | R9, Performance, Acceptance | `perf.test.ts` (owner 02-05) runs `pnpm sim duel --n 10000 --seed perf` with exit/wall/total-line asserts; CI smoke n=264 kept separately and pinned | Critique #12 |
| 2.14 | Deliverables (02-01a), Acceptance | `README.md` updated in 02-01a (v2 replay file); README included in the sample-removal grep | Critique #13 |
| 2.15 | Golden oracle and traces, Deliverables (execution), Orchestrator follow-ups | **Golden maintenance (user decision "TS engine becomes the oracle"):** `.planning/reference/phase-02/` is the oracle only until the 02-05 closing step commits, then frozen (kept for history); later phases re-pin exact goldens from the reviewed TypeScript engine (`pnpm sim …`/test output) in the same commit that changes rules, with the diff reviewed, and assert the D1 gate (Hard ≥ 70% of decisive, ≤ 40% draws per mirror) as thresholds once rules change; Phase 2 still pins the exact reference values. **Execution protocol (supersedes the "same working tree / package-scoped while parallel / 02-05 task 3 pushes" wording in *Deliverables*):** W2/W3 plans run in per-plan git worktrees (`/home/user/usurpia-wt/<plan>`, branch `phase2/<plan>`) and run the full pipeline there; the orchestrator merges in plan order, gates on `dev`, pushes and proves CI after 02-01a, 02-01b, each wave merge and the closing step; 02-05 task 3 runs post-merge on `dev` and does not push. Ownership additions: 02-01b M `core/src/{reducer,index}.ts`; 02-03 M `core/src/handlers/decision.ts`; 02-05 M `.gitignore` (`**/__purity_probe__.ts`). No golden value changes | User-approved plan revision (2026-09-29) |
