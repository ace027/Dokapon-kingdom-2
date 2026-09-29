# Spec: Phase 2 — Combat Core & Balance Sim

## Overview
Phase 2 turns the Phase 1 kernel into a real game engine for **combat, classes, progression, items/spells and monsters**, and proves balance headlessly with a **duel simulator** and a **combat CPU**:
- **Kernel v2** (`packages/core`): `reduce(state, action, rules)` with data-only `Rules`, a generic multi-player `PendingDecision` with per-player options/defaults, schema v2 state (characters, loadouts, combat, public choice history), and the Phase 1 sample module deleted.
- **Combat engine** (`core/src/combat/*`, `core/src/handlers/combat.ts`): asymmetric Attack/Strike/Spell vs Guard/Counter/Ward, SPD initiative with a LUCK tie roll, up to 3 rounds, flee, items, battle/ward spells, statuses, integer-only damage math, monsters/guardians/Crown Enforcer as non-player combatants whose commands are drawn inside `reduce`.
- **Progression + inventory** (`core/src/progression.ts`, `core/src/inventory.ts`, `core/src/handlers/loadout.ts`): XP/levels, class mastery ranks 1–5 with data-tagged passives, hybrid unlock, portable rank-5 passive, class switching with explicit overflow discards, bag/scroll/gear/spell limits.
- **Content** (`packages/content`): six zod-validated data files → `buildRules()` → `Rules`, with 6 classes, 15 gear, 17 items (12 consumables + 5 joke items), 8 battle + 4 ward + 8 field spells, 16 monsters, 3 guardians and the Crown Enforcer. **All numbers in this spec are initial tuning** for the sim to refine.
- **CPU AI** (`core/src/ai/*`, exported as `@usurpia/core/ai`): Easy/Normal/Hard combat policies reading only `PlayerView` + `Rules`, with their own seeded RNG outside `reduce`.
- **Balance sim** (`packages/sim`): `pnpm sim duel` runs thousands of duels through `reduce` and reports class×class and class×monster win rates; `pnpm sim replay` replays v2 files and checks a `rulesHash`.

Architecture direction (user-selected, 2026-09-29): **Hybrid: Pragmatic-based**, with the forward-compat decisions from Phase 1 Open Question 5 bound as written in *Key Decisions*. This spec was produced with a **reference implementation run by the planner** (Node scratch scripts); every golden value below was computed by it. An implementation that disagrees with a golden value is wrong unless a Revision History row says otherwise.

## Requirements
| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| R5 | Six stats; 4 base classes; level + per-class mastery ranks 1–5 with passives; hybrid unlock at rank 3 in two classes (Spellblade, Shadowpriest) | Must | `stats.test.ts`, `progression.test.ts`, `rewards.test.ts`: sheet-stat goldens; rank thresholds `[0,3,7,12,18]` wins; passives of ranks ≤ current rank active; hybrid unlock exactly when both parents reach rank 3; portable rank-5 passive active only outside its own class; content `data.test.ts` pins every class and passive |
| R6 | Asymmetric combat: attacker Attack/Strike/Spell vs defender Guard/Counter/Ward via the resolution matrix, SPD initiative, ≤ 3 rounds, flee | Must | `resolve.test.ts` pins **every matrix cell** (incl. Strike×Counter reflection and failed Counter = Attack×Counter 1.25×) against the golden table; `combat-flow.test.ts` pins the state machine and the combat golden replay (hash `ec0c3508`) |
| R7 | Gear (Weapon/Shield/Accessory), Battle + Ward spell slot, ≤ 3 field-spell scrolls, class-sized bag, ~12 consumables, ~15 gear, 8 battle, 4 ward, 8 field spells | Must | `inventory.test.ts` / `loadout.test.ts`: slot/kind checks, bag capacity, 3-scroll cap, class-switch overflow requires an exact `discard` list; content counts pinned in `data.test.ts` |
| R8 | ~20 "monsters with day jobs" across 4 tiers, 3 guardian archetypes, the Crown Enforcer, weighted command tables | Must | Content ships 16 monsters (4 per tier) + 3 guardians + 1 enforcer = 20 NPC definitions, plus data-only Senior variants (tier + 1); `npc.test.ts` pins tier-curve stats; command draws are seeded and pinned |
| R9 | Headless balance simulator CLI reporting win rates (game length/assets arrive in Phase 3) | Must | `pnpm sim duel --n 10000` exits 0 within the performance budget and prints class-vs-class and class-vs-monster sections; `gate.test.ts`: Hard beats Easy ≥ 70% of decisive duels in every class mirror at the pinned seed |

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
│  ├─ ai/                 index.ts (public AI API), combat.ts (policy), opponent-model.ts, tuning.ts
│  ├─ game.ts  replay.ts  views.ts  serialize.ts  validation.ts  rng.ts  hash.ts  index.ts
├─ core/test/fixtures/test-rules.ts   TEST_RULES (small Rules literal; no content dependency)
├─ content/  data/{classes,gear,items,spells,monsters,tuning}.json, src/schemas/*, src/build-rules.ts, src/node.ts
├─ sim/      src/{cli,replay-file,duel,kits,report,rules}.ts, fixtures/combat-game.json
└─ client/   text shell updated to the v2 view (Phaser arrives in Phase 4)
```

**Dependency direction (Phase 2):**
- `core` → nothing (unchanged lint). `core/src/**` except `core/src/ai/**` must not import `ai/` (new lint). `core/src/ai/**` must not import `reducer`/`handlers` or the `GameState`/`HiddenState` types (new lint).
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
| Sim/client rules in W1 | Until W3 the sim uses `packages/sim/src/kernel-rules.ts` and the client uses `packages/client/src/demo-rules.ts`, both **verbatim copies of `TEST_RULES` typed as `Rules`**; W3 (02-05) deletes the sim copy and loads content rules | `buildRules` does not exist until W2; core test fixtures cannot be imported across packages (composite `rootDir`) | Exporting test fixtures from core `src` |
| Performance | `pnpm sim duel --n 10000` ≤ 60 s wall on `ubuntu-latest` (target ≤ 20 s; reference JS ran 10 000 duels in 1.9 s) | Headroom for per-action validation in `reduce` | Bypassing `reduce` in the sim (forbidden: user requirement) |

## API and Type Contracts
Unchanged from Phase 1 and still binding: `rng.ts` (sfc32/cyrb128 + golden vectors), `hash.ts`, `stableStringify`, the canonicalize-once rule for untrusted actions, `Object.hasOwn`/`ownGet` for every record keyed by player ids **or content ids**, bounded echo (≤ 64 chars) in reject messages, `RESERVED_IDS`, `PLAYER_ID_PATTERN`, `MAX_COUNTER = 2**31 − 1`, frozen `PUBLIC` visibility, `onlyPlayers()`, replay-continues-after-rejection.

### `rules.ts` — the `Rules` contract (W1, 02-01)
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

### `types.ts` — GameState v2 (W1, 02-01)
```ts
export const SCHEMA_VERSION = 2 as const;
export const MAX_COUNTER = 2 ** 31 - 1;       // turn, decisionSeq, combatSeq, xp, gold, mastery wins, choiceHistory counts
export const MAX_STAT = 99_999;               // hp and npc stat snapshots
export const CHOICE_PATTERN = /^[a-z][a-z0-9:-]{0,47}$/;   // decision option / choice tokens
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

**`createGame(settings, rules)`** (W1) throws `SettingsError` unless: settings is an object; `v === 2`; `seed` is a non-empty string; `players` is an array of 1–4 plain objects with exactly the keys `id`, `classId`; ids pass `playersError` (pattern, reserved, unique); each `classId` is an own key of `rules.classes` whose `kind === "base"`. It returns:
- `public = {phase:"turn", turn:1, activePlayer: players[0].id, players: ids, characters, choiceHistory, pending:null, lastReveal:null, combat:null}`;
- `characters[id] = {classId, level:1, xp:0, gold: rules.economy.startingGold, mastery: {every class id (sorted): 0}, portable:null, weapon/shield/accessory/battleSpell/wardSpell from classes[classId].starter, hp: sheetStats(...).hp}`;
- `choiceHistory[id] = {attack:0, strike:0, spell:0, guard:0, counter:0, ward:0}`;
- `private[id] = {bag: [...starter.bag], scrolls: [], prompt: null}`;
- `hidden = {rng: seedRng(seed), decisionSeq: 0, combatSeq: 0, decision: null}`.
All records are built with `Object.fromEntries` (PIT-002).

**Golden (W1):** `createGame({v:2, seed:"fixture", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}, TEST_RULES)` has `hashState = 758ef72c` and canonical JSON:
```json
{"hidden":{"combatSeq":0,"decision":null,"decisionSeq":0,"rng":[2094061593,184016598,2753665883,215806170]},"private":{"p1":{"bag":["herb"],"prompt":null,"scrolls":[]},"p2":{"bag":["herb","bomb"],"prompt":null,"scrolls":[]}},"public":{"activePlayer":"p1","characters":{"p1":{"accessory":null,"battleSpell":"zap","classId":"fighter","gold":100,"hp":48,"level":1,"mastery":{"battlemage":0,"caster":0,"fighter":0},"portable":null,"shield":"lid","wardSpell":null,"weapon":"stick","xp":0},"p2":{"accessory":"charm","battleSpell":"zap","classId":"caster","gold":100,"hp":36,"level":1,"mastery":{"battlemage":0,"caster":0,"fighter":0},"portable":null,"shield":"lid","wardSpell":"shell","weapon":"stick","xp":0}},"choiceHistory":{"p1":{"attack":0,"counter":0,"guard":0,"spell":0,"strike":0,"ward":0},"p2":{"attack":0,"counter":0,"guard":0,"spell":0,"strike":0,"ward":0}},"combat":null,"lastReveal":null,"pending":null,"phase":"turn","players":["p1","p2"],"turn":1},"v":2}
```

### `game.ts` / `replay.ts` signatures (W1)
```ts
export class SettingsError extends Error {}
export function createGame(settings: GameSettings, rules: Rules): GameState;
export interface ReplayResult { readonly state: GameState; readonly events: readonly GameEvent[]; readonly rejections: readonly { index: number; error: Reject }[] }
export function replay(settings: GameSettings, actions: readonly unknown[], rules: Rules): ReplayResult;   // continues after rejections (unchanged)
export function hashState(state: GameState): string;                                                     // unchanged
```
`packages/core/src/index.ts` exports everything in this section plus `rules.ts`, `combat/{passives,stats,options,resolve}.ts`, `progression.ts` and `inventory.ts` public functions (added by the owning plan); it never re-exports `ai/`.

### `views.ts` (W1)
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
  // W1 (02-01)
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

### Transition semantics — kernel (W1)
- **`openDecision(state, kind, prompts, events)`**: `decisionSeq += 1`; `id = "d" + decisionSeq`; `public.pending = {id, kind, required: prompts.map(p ⇒ p.playerId), committed: []}`; `hidden.decision = {id, choices: {}}`; each `private[p].prompt = {decisionId: id, options, default}`; `phase = "decision"`; emit `DecisionOpened`, then one `PromptOpened` per prompt in order.
- **`decision/open`** (kind `poll`): `openDecision` with the action's prompts (options copied).
- **`decision/commit`**: append to `committed`, store `choices[p]`, emit `ChoiceCommitted`; if all required committed → **reveal** with `timedOut: []`.
- **`timeout`**: for each required player not committed (in `required` order) emit `ChoiceTimedOut`; then **reveal** with those players as `timedOut`; their choice is their own `prompt.default`.
- **reveal**: `choices` built in `required` order (committed choice via `ownGet`, else own default); `lastReveal = {decisionId, kind, choices, timedOut}`; clear `pending`, `hidden.decision` and every required player's `prompt`; `phase = "turn"`; emit `ChoicesRevealed`. If `kind === "combat/exchange"`: for each required player **not** in `timedOut` whose choice is one of the 6 `COMMANDS`, `choiceHistory[p][choice] = min(MAX_COUNTER, n + 1)`; then call the kind's resolver `resolvers[kind](state, choices, ctx, rules, events)`. The `poll` resolver returns the state unchanged. In W1 the `combat/exchange` resolver slot holds `resolveUnsupported` (returns the state unchanged; unreachable because W1 `deserialize` rejects combat decisions); 02-03 replaces it.

**Golden (W1, `packages/sim/fixtures/kernel-game.json`, core `replay.test.ts`)** — settings `{v:2, seed:"fixture", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}`, rules `TEST_RULES`, actions:
```json
[{"v":2,"type":"decision/open","playerId":"system","prompts":[{"playerId":"p1","options":["yes","no"],"default":"no"},{"playerId":"p2","options":["red","green","blue"],"default":"red"}]},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d1","choice":"yes"},
 {"v":2,"type":"decision/commit","playerId":"p1","decisionId":"d1","choice":"no"},
 {"v":2,"type":"timeout","playerId":"system","decisionId":"d1"},
 {"v":2,"type":"decision/open","playerId":"system","prompts":[{"playerId":"p2","options":["a","b"],"default":"a"}]},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d2","choice":"c"},
 {"v":2,"type":"decision/commit","playerId":"p2","decisionId":"d2","choice":"b"}]
```
→ rejections `[{index:2, ALREADY_COMMITTED}, {index:5, INVALID_PAYLOAD}]`; 10 events `DecisionOpened, PromptOpened, PromptOpened, ChoiceCommitted, ChoiceTimedOut, ChoicesRevealed, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed`; final `hashState = 9616698e`; `lastReveal = {decisionId:"d2", kind:"poll", choices:{p2:"b"}, timedOut:[]}`; the first reveal's choices are `{p1:"yes", p2:"red"}` with `timedOut:["p2"]`; `rulesHash(TEST_RULES) = 7433ea8b`. Sim line: `hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2`.

### `combat/passives.ts` + `combat/stats.ts` — stats (W1, 02-01; pure, no GameState)
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
3. `dmg = fl(base × m[a][d] / 10000)`.
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
15. `carries = a === "spell" || (a === "strike" && att.h.spellbladeStrike > 0 && att.spell !== null)`; `effectLands = carries && d !== "ward" && (dmg > 0 || (a === "spell" && att.spell.powerBp === 0))`.
16. If `effectLands && att.spell.effect.kind === "drain"`: `healAttacker += fl(dmg × effect.bp / 10000)`.

**Golden matrix (`resolve.test.ts`)** — tuning = `TEST_RULES.combat` (identical to shipped initial tuning: `kBp 12500, jBp 5000, jMagBp 5000`, matrix below, `critMultBp 15000`). Fixture: attacker battle stats `{hp:100, atk:30, def:20, mag:24, spd:10, luck:8}`, hp 100/100, all hooks 0, spell `{powerBp:12000, effect:none}`, ward null; defender `{hp:90, atk:26, def:18, mag:20, spd:9, luck:4}`, hp 90/90, hooks 0, ward null. So `physBase = 28`, `spellBase = 18`, `critChanceBp(att) = 500`.

| Attacker \ Defender | Guard (m) | Counter (m) | Ward (m) | Open (m) |
|---|---|---|---|---|
| **Attack** | 5000 → **14** (crit 21) | 12500 → **35** (crit 52) — failed Counter | 10000 → **28** (crit 42) | 10000 → **28** (crit 42) |
| **Strike** | 15000 → **42** (crit 63) — pierces Guard | reflection 10000 → **attacker takes 28**, defender 0 (no crit) | 17500 → **49** (crit 73) | 15000 → **42** (crit 63) |
| **Spell** | 10000 → **18**, effectLands | 10000 → **18**, effectLands | 4000 → **7**, no effect | 10000 → **18**, effectLands |

Variant rows (same fixture, one change each; `toDefender / toAttacker / healAttacker / healDefender / tags`):

| Variant | Cell | Result (no crit) | Crit |
|---|---|---|---|
| att `strikeDmgBp +1000` | Strike×Ward | 53 / 0 | 79 |
| def `guardVsStrikeBp 5000` (Warrior r5) | Strike×Guard | 21 / 0 | 31 |
| def `counterDmgBp +2000` | Strike×Counter | 0 / 33 / `reflected` | n/a |
| def `spellTakenBp −2000` (Mirror Shield) | Spell×Guard | 14 / 0 | n/a |
| def `physTakenBp −5000` (Wisp) | Attack×Ward | 14 / 0 | 21 |
| def ward Barrier | Spell×Ward | 7 / 0 | n/a |
| def ward Reflect (5000) | Spell×Ward | 7 / 9 / `reflected` | n/a |
| def ward Absorb | Spell×Ward | 0 / 0 / heal def 7 / `absorbed` | n/a |
| def ward Counterspell (12500) | Spell×Ward | 0 / 0 / `negated` | n/a |
| def ward Counterspell | Attack×Ward | 35 / 0 | 52 |
| def ward Counterspell | Strike×Ward | 61 / 0 | 91 |
| def `wardReflectBp 5000` (Cleric r5) | Spell×Ward | 7 / 9 / `reflected` | n/a |
| att spell Hex (power 0) | Spell×Guard | 0 / 0, effectLands **true** | n/a |
| att spell Hex | Spell×Ward | 0 / 0, effectLands false | n/a |
| att spell Leech (power 8000, drain 5000) | Spell×Counter | 9 / 0 / heal att 4, effectLands | n/a |
| att `lifestealBp 2000` | Attack×Counter | 35 / 0 / heal att 7 | 52 |
| att `spellbladeStrike 5000` | Strike×Guard | 51 / 0, effectLands | 72 |
| att `spellbladeStrike 5000` | Strike×Ward | 58 / 0, effectLands false | 82 |
| att `spellbladeStrike 5000` | Strike×Counter | 0 / 28 / `reflected` | n/a |
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

**Combat golden (W2, `core/test/combat-golden.test.ts`, TEST_RULES)** — settings `{v:2, seed:"combat-golden", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}`, 18 actions, 0 rejections, 80 events, final `hashState = ec0c3508`:
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
`ExchangeResolved` sequence (combat, round.exchange, attacker, command/defense → damage, heal, effects, hp):

| # | c | r.e | att | command / defense | damage [s0,s1] | heal | effects | hp after |
|---|---|---|---|---|---|---|---|---|
| 1 | c1 | 1.1 | 0 | spell / counter | [0,8] | [0,0] | `stun` | [44,28] |
| — | c1 | 1.2 | 1 | `ExchangeSkipped` (stunned) | | | | |
| 2 | c1 | 2.1 | 0 | item:tonic / null (p2 timed out → guard, ignored) | [0,0] | [0,0] | `item:tonic` | [44,28] |
| 3 | c1 | 2.2 | 1 | spell / ward (Reflect ward + Mirror Shield) | [2,4] | [0,0] | `reflected` | [42,24] |
| 4 | c1 | 3.1 | 0 | strike / counter | [20,0] | [0,0] | `reflected` | [22,24] |
| 5 | c1 | 3.2 | 1 | item:bomb / null | [0,0] | [0,0] | `item:bomb`, `fled` | [22,24] → `CombatEnded fled, fled:1` |
| 6 | c2 | 1.1 | 1 (gull) | strike / guard | [13,0] | [0,0] | `steal-gold:10`, `steal-item:herb` | [11,36] |
| 7 | c2 | 1.2 | 0 | attack / guard (drawn) | [0,6] | [0,0] | — | [11,30] |
| 8 | c2 | 2.1 | 1 | flee / null | [0,0] | [0,0] | `flee-failed` | [11,30] |
| 9 | c2 | 2.2 | 0 | spell / ward (drawn) | [0,4] | [0,0] | — | [11,26] |
| 10 | c2 | 3.1 | 0 | strike / counter (drawn) | [11,0] | [0,0] | `reflected` | [0,26] → `CombatEnded ko, winner:1` (npc: no reward) |

Round starts: c1 `first` = 0, 0, 0; c2 `first` = 1, 1, 0. Final: p1 hp 22, bag `["herb"]`; p2 hp 0, gold 90, bag `[]`; `choiceHistory.p1 = {attack:0,strike:1,spell:1,guard:1,counter:0,ward:1}`, `choiceHistory.p2 = {attack:1,strike:1,spell:2,guard:1,counter:3,ward:0}` (the timed-out `guard` at d2 is not counted); `hidden = {combatSeq:2, decisionSeq:10, decision:null, rng:[3200512360,239253250,3363130012,583700052]}`. Event type sequence (80):
`CharacterSet, BagUpdated, CombatStarted, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, ExchangeSkipped, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted, ChoiceTimedOut, ChoicesRevealed, ExchangeResolved, BagUpdated, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, BagUpdated, CombatEnded, CombatStarted, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, BagUpdated, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, RoundEnded, RoundStarted, DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved, CombatEnded`.
The scenario ends every combat without a player KO win, so the W3 reward logic cannot change this hash.

### `serialize.ts` — `deserialize(json, rules)` v2
`serialize(state)` = `stableStringify(state)` (unchanged). `deserialize(json: string, rules: Rules): GameState`: `JSON.parse` (SyntaxError propagates); not a plain object → `TypeError`; `v !== 2` → `SchemaVersionError`; then every check below, in this order, each throwing `TypeError("deserialize: <unique message>")`. **Exact own keys at every object level** (root, public, private entries, hidden, characters, mastery, choiceHistory entries, prompt, pending, decision, lastReveal, combat, sides, npc refs, stats, mods). All player-/content-keyed lookups via `ownGet`.
1. Root / partitions: plain objects, exact keys (`v, public, private, hidden`; public: `phase, turn, activePlayer, players, characters, choiceHistory, pending, lastReveal, combat`; hidden: `rng, decisionSeq, combatSeq, decision`).
2. `players` (same rules as `createGame`), `activePlayer ∈ players`, `phase ∈ {turn, decision}`, `turn`, `decisionSeq`, `combatSeq` integers in `[0, MAX_COUNTER]`, `rng` 4 × u32.
3. `characters`: own keys = players; each: `classId` ∈ rules.classes; `level` int in `[1, maxLevel]`; `xp` in `[0, MAX_COUNTER]` and `level === levelForXp(xp)`; `gold` in `[0, MAX_COUNTER]`; `mastery` own keys = all rule class ids, values in `[0, MAX_COUNTER]`; `portable` null or a class id with `masteryRank === 5`; each gear slot null or a gear id **of that slot**; spells null or ids in the right table; `hp` int in `[0, MAX_STAT]` and `hp <= sheetStats(...).hp`.
4. `choiceHistory`: own keys = players; each exactly the 6 command keys, values in `[0, MAX_COUNTER]`.
5. `private`: own keys = players; `bag` array of item ids, length ≤ class `bagSize`; `scrolls` array of field-spell ids, length ≤ `maxScrolls`; `prompt` null or `{decisionId, options, default}` (options: 1..24 unique tokens; default ∈ options).
6. Decision consistency: `phase === "turn"` ⇒ `pending`, `hidden.decision`, every `prompt` null and `combat` null. `phase === "decision"` ⇒ `pending` `{id, kind, required, committed}` with `id === "d" + decisionSeq`, `kind ∈ DecisionKind`, `required` non-empty unique ⊆ players, `committed` unique ⊆ required and `committed.length < required.length`; `hidden.decision {id === pending.id, choices}` with own keys = committed and each value ∈ that player's prompt options; `prompt !== null` exactly for required players, each with `decisionId === pending.id`.
7. `lastReveal`: null or `{decisionId, kind, choices, timedOut}`: choices own keys ⊆ players, values tokens; `timedOut` unique ⊆ choice keys.
8. Combat (**02-03 adds this; in W1 the check is "combat must be null" and `kind === "combat/exchange"` is rejected with "combat decisions unsupported"**): `combat !== null` ⇔ `pending?.kind === "combat/exchange"`; `id === "c" + combatSeq`; `round ∈ [1, maxRounds]`; `exchange ∈ {1,2}`; `first ∈ {0,1}`; `sides` length 2, `sides[0]` a player side; player sides: seated, distinct; npc sides: valid `NpcRef` (ids exist, `townTier` 1..4, `level` 1..maxLevel), `stats` deep-equal `npcStats(rules, npc)`, `hp` in `[1, stats.hp]`; `mods` ints in `[modMinBp, modMaxBp]` and booleans; every player side's character `hp >= 1`; `pending.required` equals `requiredFor(combat)`; each prompt deep-equals the one `openExchange` would build.

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

**Rewards/loadout golden (W3, 02-04, `core/test/rewards-golden.test.ts`, TEST_RULES)** — settings `{v:2, seed:"rewards-golden", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}`, these 25 actions, 0 rejections, 84 events, final `hashState = 57da3ea4`:
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
Checkpoints: c1 (p1 vs slime, stats `40/12/8/10/9/4`) ends `ko` winner 0 in round 3.2 (the slime's Strike is reflected) → `VictoryRewarded {p1, xp:20, gold:30, classId:"fighter", masteryWins:1}`; `loadout/useItem herb` → `ItemUsed {p1, herb, healed:14, hp:36}` then `BagUpdated`; c2 (p2 vs p1) ends `ko` winner 0 at round 2.1 → `VictoryRewarded {p2, xp:10, gold:0, classId:"caster", masteryWins:1}`; the xp grant emits `LevelUp` 2 and 3 (p2 hp 36 → 50 via `adjustHp`); the scroll grant emits `ScrollsUpdated ["haste"]`; `ClassSwitched {p2, from:"caster", to:"fighter", fee:50, hp:67}` then `BagUpdated ["herb","bomb","antidote"]`; finally `BagUpdated` for p1 (`[]`). Final characters: p1 `{fighter, L1, xp 20, gold 130, hp 0, mastery.fighter 1, bag []}`; p2 `{fighter, L3, xp 160, gold 250, hp 67, weapon "sword", wardSpell "sponge", mastery.caster 1, scrolls ["haste"]}`. Event type sequence: `Granted, BagUpdated, CombatStarted, RoundStarted, (DecisionOpened, PromptOpened, ChoiceCommitted, ChoicesRevealed, ExchangeResolved)×2, RoundEnded, RoundStarted, (…)×2, RoundEnded, RoundStarted, (…)×2, CombatEnded, VictoryRewarded, ItemUsed, BagUpdated, CombatStarted, RoundStarted, (DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved)×2, RoundEnded, RoundStarted, DecisionOpened, PromptOpened×2, ChoiceCommitted×2, ChoicesRevealed, ExchangeResolved, CombatEnded, VictoryRewarded, Granted, LevelUp, LevelUp, Granted, Granted, BagUpdated, Granted, BagUpdated, Granted, ScrollsUpdated, Granted, Granted, ClassSwitched, BagUpdated, BagUpdated`.

### CPU AI (W3, 02-05: `core/src/ai/{index,combat,opponent-model,tuning}.ts`, subpath `@usurpia/core/ai`)
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
```
`decideCombat` returns `{action: null, ai}` (unchanged `ai`) unless `view.self?.prompt` is non-null, `view.public.pending` is non-null with `kind === "combat/exchange"`, `pending.id === prompt.decisionId` and the viewer has not committed. Otherwise it returns `{v:2, type:"decision/commit", playerId: viewer, decisionId, choice}` and the advanced `ai`. All random draws use `nextInt(ai.rng, …)` and thread the returned state.

**Algorithm** (floats allowed inside AI; evaluate in exactly this order; `fl` = `Math.floor`):
1. Sides: `mi` = index of the player side with `playerId === viewer`, `oi = 1 − mi`; `me = snapshot(sides[mi])`, `op = snapshot(sides[oi])` via `snapshotPlayer(rules, public.characters[id], side.mods)` / `snapshotNpc`. Role: `attacker` iff `prompt.options` includes `"attack"`.
2. **Heal rule** (attacker only): if `me.hp × 10000 <= me.maxHp × healThresholdBp` and some option `item:<id>` has `effect.kind === "heal"`: Easy draws `u = nextInt(1, 10000)` and **forgets** iff `u <= easyForgetHealBp`. If not forgotten: `amount(o) = fl(maxHp × bp / 10000)`; among heal options with `amount ≥ maxHp − hp` pick the smallest amount, else the largest amount (ties: earlier option); commit it. AI never chooses `flee` or non-heal items in Phase 2.
3. `mine` = `ATTACK_COMMANDS` (attacker) or `DEFEND_COMMANDS` (defender), filtered to those in `prompt.options`, in that order. `base[k] = classes[public.characters[viewer].classId].aiBias[k]`; if all 0 → all 1.
4. **Easy:** weights = `base`; draw.
5. **Opponent distribution** `q` over `okeys`: if the opponent is the defender and stunned → `okeys = ["open"]`, `q = [1]`. Else `okeys` = `["attack","strike"]` + `["spell"]` iff `op.spell !== null` (opponent attacker) or `DEFEND_COMMANDS` (opponent defender). Prior weights `w`: opponent player → `classes[opp.classId].aiBias[k]`; npc → its `attackTable[k]` / `defendTable[k]` (flee ignored); all 0 → all 1; `pn = w / Σw`. **Normal:** `q = pn`. **Hard:** opponent player → `q_i = (n_i + α·pn_i) / (N + α)` with `n_i = public.choiceHistory[oppId][okeys_i]`, `N = Σ n_i`, `α = hardPriorStrength`; npc → `q = pn` (tables are public data).
6. **EV:** for my command `k`: `ev_k = Σ_i q_i × val(pair)` summed in `okeys` order from 0, where the pair is `(k, okeys_i)` if I attack, `(okeys_i, k)` if I defend. `val(a, d)`: `att/def` = the attacking/defending snapshot; `p = isCritEligible(a, d) ? critChanceBp(att) / 10000 : 0`; `r0 = computeCell(…, false)`, `r1 = p > 0 ? computeCell(…, true) : r0`; each of `toDefender, toAttacker, healAttacker, healDefender` is `(1 − p)·r0 + p·r1`; `v = (min(toDef, def.hp) − healDef)/def.maxHp − (min(toAtt, att.hp) − healAtt)/att.maxHp + (toDef ≥ def.hp ? koBonus : 0) − (toAtt ≥ att.hp ? koBonus : 0)`; return `v` if I attack, `−v` if I defend. Spell side effects are ignored by EV.
7. **Logits:** Normal `ℓ_k = ln(base_k > 0 ? base_k : 1e-9) + ev_k / normalTemp`; Hard `ℓ_k = ev_k / hardTemp`. Softmax: `e_k = exp(ℓ_k − max ℓ)`, `s = Σ e_k`, integer weights `w_k = Math.round(e_k / s × weightScale)`.
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

`decideCombat` with `createAi("ai", p, d)` on the all-0 state chooses: p1 `strike` for easy/normal/hard; p2 `counter` for easy/normal/hard. Resulting `ai.rng`: p1 easy `[3331102407,1535445285,772308753,1112744324]`, p1 normal `[4183196888,813986969,677920980,3243803346]`, p1 hard `[1366581972,206714184,2346612497,1782913445]`, p2 easy `[3836409917,3572200996,801488308,1210260529]`, p2 normal `[91016355,297186996,1934346612,4099156348]`, p2 hard `[1549760109,3612060378,2996506608,524471693]`.

**Never reads hidden information:** enforced by (a) the signature (`PlayerView` + `Rules` only), (b) lint on `core/src/ai/**` banning imports of `reducer`, `handlers/*` and the `GameState`/`HiddenState` type names, and (c) `ai-hidden.test.ts`: from a PvP state where the opponent has already committed, build variants that differ **only** in `hidden.rng`, `hidden.decision.choices[opponent]` (each of the 3 defend commands) and the opponent's `private` (bag contents and prompt options); assert `viewFor(variant, me)` is deep-equal across variants and `decideCombat` returns identical actions and identical `ai.rng` for all 3 difficulties. The test first asserts the variants really differ (`hashState` pairwise distinct) so it cannot pass vacuously (PIT-001).

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
- **Cross-reference rules** (each its own `ContentError` with a unique message; path like `classes.4.parents.1`): duplicate ids per collection; ≥ 1 base class; base ⇒ `parents` null and `starter` non-null; hybrid ⇒ `parents` = two distinct **base** class ids and `starter` null; `passives` length 5 with `rank === index + 1`; starter gear ids exist **with the matching slot**, spell ids exist in the right table, bag ids exist, `bag.length ≤ bagSize`; NPC `battleSpell`/`wardSpell` ids exist; `attackTable.spell === 0` when `battleSpell` is null; attack-table sum > 0 and defend-table sum > 0; `aiBias` attack+strike+spell > 0 and guard+counter+ward > 0; `curve` length 5; `xpCurve.length === maxLevel`, `xpCurve[0] === 0`, strictly increasing, ≤ MAX_COUNTER; `masteryWins` length 5, `[0] === 0`, strictly increasing; `hybridUnlockRank` 1..5; `enforcer.id === "crown-enforcer"`; monster `zone` ∈ `{enchanted-forest, soggy-coast, goblin-mines, bureaucrat-bog}`.
- **Pinned:** `rulesHash(loadRules()) === "94160b70"` (`data.test.ts`). Any later tuning change must update this pin, the sim fixture, the sim goldens and the gate goldens in the same commit, with a note in the plan summary.
- The CLI build gate (`scripts/validate.ts`) is unchanged in behaviour (exit 0/1/2). Test fixture dirs `test/fixtures/{valid,invalid}` are **deleted**; tests build temp dirs by copying `data/` and corrupting exactly one file (PIT-001).

#### Content data (initial tuning)
Zones: `enchanted-forest` (T1), `soggy-coast` (T2), `goblin-mines` (T3), `bureaucrat-bog` (T4).

##### Classes (`classes.json`)
| id | name | kind | parents | statBp hp/atk/def/mag/spd/luck | bagSize | switchFee | aiBias atk/str/spl/grd/ctr/wrd |
|---|---|---|---|---|---|---|---|
| `warrior` | Warrior | base | — | 11500/11500/11500/8500/9000/9000 | 5 | 100 | 35/45/20/45/35/20 |
| `thief` | Thief | base | — | 9500/10000/9000/8000/13000/14000 | 8 | 100 | 50/30/20/35/40/25 |
| `mage` | Mage | base | — | 8500/7500/8500/13000/10000/10000 | 6 | 100 | 25/15/60/30/25/45 |
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
| `fireball` | Fireball | 2 | 200 | 11000 | `{"kind":"none"}` |
| `thunderclap` | Thunderclap | 3 | 600 | 13500 | `{"kind":"stun","chanceBp":2500}` |
| `frostbite` | Frostbite | 2 | 300 | 10000 | `{"kind":"mod","stat":"spd","bp":-2000}` |
| `drain` | Drain | 1 | 150 | 9000 | `{"kind":"drain","bp":5000}` |
| `hex` | Hex | 2 | 300 | 0 | `{"kind":"mod","stat":"atk","bp":-2500}` |
| `pickpocket-bolt` | Pickpocket Bolt | 2 | 250 | 7000 | `{"kind":"stealGold","bp":500}` |
| `royal-decree` | Royal Decree | 4 | 1500 | 17000 | `{"kind":"none"}` |

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
| `ogre-middle-manager` | Ogre Middle Manager | 4 | bureaucrat-bog | 11500/11000/10500/10000/9000/9000 | 40/35/25/0 | 35/35/30 | fireball | barrier | `atkBp` 1000 | 180 | 160 | Let's circle back on your face. |

##### Guardians (`monsters.json` → `guardians`, 3) and Crown Enforcer (`monsters.json` → `enforcer`)
| id | name | style | statBp | attackTable | defendTable | battle | ward | xpPerTier / xpPerLevel | goldPerTier / goldPerLevel |
|---|---|---|---|---|---|---|---|---|---|
| `landlord-lich` | Landlord Lich | magic | 11000/8000/9500/12500/10000/10000 | 20/15/65/0 | 30/25/45 | fireball | reflect | 60 | 0 |
| `tollbridge-troll` | Tollbridge Troll | physical | 13000/11500/11500/6000/8000/9000 | 40/50/10/0 | 45/40/15 | spark | null | 60 | 0 |
| `knight-of-foreclosure` | Knight of Foreclosure | balanced | 12000/10500/10500/10000/9500/9500 | 40/35/25/0 | 35/35/30 | spark | barrier | 60 | 0 |
| `crown-enforcer` | Crown Enforcer | — | 9000/12000/10000/8000/10000/10000 | 25/60/15/0 | 35/40/25 | spark | null | 10 | 0 |

##### Tuning (`tuning.json`, shipped values = TEST_RULES values except `progression.maxLevel`/`xpCurve`)
```json
{"v":1,
 "combat":{"kBp":12500,"jBp":5000,"jMagBp":5000,
   "matrix":{"attack":{"guard":5000,"counter":12500,"ward":10000,"open":10000},
             "strike":{"guard":15000,"counter":10000,"ward":17500,"open":15000},
             "spell":{"guard":10000,"counter":10000,"ward":4000,"open":10000}},
   "critBaseBp":300,"critPerLuckBp":25,"critCapBp":2000,"critMultBp":15000,"maxRounds":3,
   "fleeBaseBp":5000,"fleePerSpdBp":250,"fleeMinBp":1000,"fleeMaxBp":9000,
   "modMinBp":-5000,"modMaxBp":5000,"poisonBp":800,"seniorRewardBp":15000,"pvpXpPerLevel":10},
 "progression":{"maxLevel":20,"xpCurve":[0,50,150,300,500,750,1050,1400,1800,2250,2750,3300,3900,4550,5250,6000,6800,7650,8550,9500],
   "baseStats":{"hp":40,"atk":14,"def":10,"mag":12,"spd":10,"luck":5},"growth":{"hp":8,"atk":3,"def":2,"mag":3,"spd":1,"luck":1},
   "masteryWins":[0,3,7,12,18],"hybridUnlockRank":3},
 "economy":{"startingGold":100,"maxScrolls":3}}
```
(`xpCurve[i] = 25 × i × (i + 1)`.) The design doc's matrix starting values map to bp exactly (Attack 0.5/1.25/1.0, Strike 1.5/reflect 1.0/1.75, Spell 1.0/1.0/0.4); the `open` column (stunned defender) is new: 1.0/1.5/1.0.

##### Display text (content JSON only; not part of `Rules`)
- **Classes:** warrior "Frontline brawler with a punishing Strike." · thief "Fast, lucky griefer who steals and flees." · mage "Burst Spells and field magic." · cleric "Sustain and support; the Crown hunter." · spellblade "Warrior + Mage: Strikes carry spell power." · shadowpriest "Thief + Cleric: drains HP and outlasts."
- **Passives:** brawler "+10% Strike damage." · thick-skin "+10% max HP." · shield-wall "+10% DEF." · battle-rhythm "+10% Attack damage." · unbreakable "Guard also halves Strike damage." · sticky-fingers "Steal an extra item on a PvP win." · quick-feet "+20% flee chance." · lucky-break "+5% crit chance." · fleet "+10% SPD." · pickpocket "Pickpocket 5% gold when passing players." · frugal-caster "Spells cost 25% less in shops." · focus "+10% Spell damage." · arcane-mind "+10% MAG." · overcharge "+15% Spell damage." · fieldcraft "Cast a field spell and still move." · mending "Heal 10% HP each turn." · sanctuary "Heal 5% HP at each round end." · faith "+10% DEF." · devotion "+10% MAG." · mirror-ward "Ward reflects 50% of Spell damage." · runic-edge "Strikes add 50% of your battle spell's power and its effect." · arcane-muscle "+10% MAG." · honed-edge "+10% Strike damage." · keen-eye "+5% crit chance." · twin-arts "+15% Spell damage." · leech "Heal 25% of Attack/Strike damage dealt." · shade-step "+10% SPD." · dark-litany "Heal 5% HP at each round end." · cruel-luck "+5% crit chance." · soul-tithe "Heal a further 25% of Attack/Strike damage dealt."
- **Gear:** wooden-sword "A stick with ambition." · bronze-blade "Reliable, if a little green." · knights-saber "Standard issue for knights who read the manual." · goblin-cleaver "Lucky, greasy, sharp." · royal-claymore "Too heavy for the actual royals." · pot-lid "Still smells of soup." · buckler "Small shield, big attitude." · tower-shield "A wall you can carry. Slowly." · mirror-shield "Weakens incoming Spells by 20%." · aegis-of-usurpia "The kingdom's finest, slightly used." · lucky-sock "One sock. Unwashed. Lucky." · speed-anklet "Your feet feel late for something." · mage-ring "Hums quietly with MAG." · tax-collectors-seal "+5% town tax income." · crown-ward-amulet "Resists the Cursed Crown's Tyrant's Tax."
- **Items:** herb "Heals 30% HP." · big-herb "Heals 60% HP." · royal-elixir "Fully restores HP." · antidote "Clears status effects." · swift-boots "Your next spin gets +3." · lead-boots "Target's next spin is fixed at 1." · homing-stone "Warp to the Castle." · pathfinder "Pick your exact spin result 1–6." · smoke-bomb "Guarantees escape from battle." · battle-tonic "+25% ATK for this battle." · iron-tonic "+25% DEF for this battle." · coin-purse-lock "Blocks the next gold steal against you." · decoy-gold-bag "Drop it; the next rival to land loses 10% gold to you." · cursed-wig "Force a hideous wig on a rival: −10% SPD for 3 turns." · whoopee-scroll "Target's next battle opens with a fanfare; they lose round-1 initiative." · royal-summons "A forged decree teleports a rival to the Castle." · bag-of-bees "A rival drops a random bag item on their space."
- **Spells:** spark "Low MAG damage, cheap." · fireball "Mid MAG damage." · thunderclap "High damage; 25% chance to stun." · frostbite "Damage and −20% SPD." · drain "Damage; heal half of it." · hex "No damage; −25% ATK for the battle." · pickpocket-bolt "Light damage; steal 5% gold." · royal-decree "Highest damage. Rare." · barrier "Standard spell resistance." · reflect "Reflect 50% of spell damage." · absorb "Heal from spell damage instead of taking it." · counterspell "Negate a Spell; take 1.25× from Attack/Strike." · haste "Spin twice, take the higher." · snare "Target spins max 2 for 2 turns." · usurp "Seize a rival's town (MAG vs MAG); lose 10% gold on failure." · blessing "Full heal and clear status." · fog "Hidden and untargetable for 2 turns." · golden-touch "Your next Gold space pays double." · swap "Swap positions with any player." · silence "Target can't use field spells for 3 turns."
- **Guardians / Enforcer:** landlord-lich "Magic guardian who collects rent in souls." · tollbridge-troll "Physical guardian; the toll is your teeth." · knight-of-foreclosure "Balanced guardian serving eviction notices." · crown-enforcer "A floating gilded helmet with arms. Strikes often."

### `@usurpia/sim` (W1 replay update in 02-01; duel + content rules in 02-05)
**Replay file v2:** `{ "rulesHash": "<8hex>", "settings": GameSettings, "actions": unknown[] }` (exact keys; actions untrusted, passed through `reduce`).
```ts
export class ReplayFileError extends Error {}                 // exit 2
export class RulesMismatchError extends ReplayFileError {}    // exit 3
export function replayFile(filePath: string, rules: Rules, opts?: { allowRulesMismatch?: boolean }): { line: string; result: ReplayResult };
  // line = `hash=<hashState> rules=<rulesHash(rules)> turn=<turn> events=<n> rejections=<n>`
  // file rulesHash !== rulesHash(rules): throw RulesMismatchError(`rules mismatch: file ${fileHash}, current ${hash}`)
  // unless allowRulesMismatch, in which case the line gets the suffix ` rules-mismatch=<fileHash>`
```
- `src/rules.ts` exports `replayRules(): Rules` — the **only** place the CLI and tests get rules. W1: returns `KERNEL_RULES` from `kernel-rules.ts` (TEST_RULES copy); fixture `fixtures/kernel-game.json` (the W1 golden). W3 (02-05): returns `loadRules()` from `@usurpia/content/node`; `kernel-rules.ts` and `kernel-game.json` are deleted; fixture `fixtures/combat-game.json`.
- W1 moves the Phase 1 CLI subprocess tests out of `replay-file.test.ts` into a new `test/cli.test.ts` (function tests stay in `replay-file.test.ts`); the CLI tests write their own temp replay files (valid, invalid JSON, wrong `rulesHash` → exit 3, usage errors) using `replayRules()`/`rulesHash`, so they survive the W3 rules switch unchanged except for fixture names.

**Sim combat fixture (W3, 02-05, `packages/sim/fixtures/combat-game.json`, content rules; only W1/W2 action types, and no combat is won by a player, so it does not depend on 02-04):** `{"rulesHash":"94160b70","settings":{"v":2,"seed":"sim-fixture","players":[{"id":"a","classId":"warrior"},{"id":"b","classId":"mage"}]},"actions":[…]}` with these 25 actions:
```json
[{"v":2,"type":"system/setCharacter","playerId":"system","target":"a","classId":"warrior","level":5,"weapon":"bronze-blade","shield":"buckler","accessory":"lucky-sock","battleSpell":"spark","wardSpell":"barrier","bag":["herb","smoke-bomb","battle-tonic"]},
 {"v":2,"type":"system/setCharacter","playerId":"system","target":"b","classId":"mage","level":5,"weapon":"wooden-sword","shield":"buckler","accessory":"mage-ring","battleSpell":"fireball","wardSpell":"barrier","bag":["herb"]},
 {"v":2,"type":"combat/start","playerId":"system","attacker":"a","opponent":{"kind":"npc","npc":{"kind":"monster","id":"seagull-debt-collector","senior":false}}},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d1","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d2","choice":"item:smoke-bomb"},
 {"v":2,"type":"combat/start","playerId":"system","attacker":"b","opponent":{"kind":"player","playerId":"a"}},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d3","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d3","choice":"ward"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d4","choice":"strike"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d4","choice":"counter"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d5","choice":"attack"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d5","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d6","choice":"item:herb"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d6","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d7","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d7","choice":"counter"},
 {"v":2,"type":"decision/commit","playerId":"a","decisionId":"d8","choice":"attack"},
 {"v":2,"type":"timeout","playerId":"system","decisionId":"d8"},
 {"v":2,"type":"combat/start","playerId":"system","attacker":"b","opponent":{"kind":"npc","npc":{"kind":"guardian","id":"landlord-lich","townTier":1}}},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d9","choice":"spell"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d10","choice":"guard"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d11","choice":"strike"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d12","choice":"counter"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d13","choice":"attack"},
 {"v":2,"type":"decision/commit","playerId":"b","decisionId":"d14","choice":"ward"}]
```
→ 0 rejections, 107 events, final `hashState = 60d64975`; `pnpm sim replay packages/sim/fixtures/combat-game.json` prints exactly `hash=60d64975 rules=94160b70 turn=1 events=107 rejections=0`. Checkpoints: c1 (a vs seagull-debt-collector, stats `85/30/14/19/16/7`, first = 1) — the gull's Attack steals `battle-tonic` (`steal-item:battle-tonic`), then a's `item:smoke-bomb` flees (`CombatEnded fled, fled:0`); c2 (b vs a) ends `draw` after round 3 with hp `[45, 14]` (d8 times out b → `guard`); c3 (b vs guardian `landlord-lich` townTier 1, stats `104/24/15/27/13/6`) ends `ko` winner 1 at round 3.2 (b hp 0; npc win → no reward). Final: a hp 14, bag `[]`; b hp 0, bag `["herb"]`; `choiceHistory.a = {attack:1,strike:1,spell:0,guard:2,counter:1,ward:1}`, `choiceHistory.b = {attack:2,strike:1,spell:3,guard:2,counter:2,ward:1}`; `hidden = {combatSeq:3, decisionSeq:14, decision:null, rng:[3523559772,2254657508,341100899,733868244]}`.

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
6. Result from the last `CombatEnded`.

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


**Sim goldens (`sim/test/duel.test.ts`, content rules):** `pnpm sim duel --n 60 --matchup mirrors --difficulty hard:easy --seed golden` prints exactly:
```
duel n=60 seed=golden level=5 difficulty=hard:easy rules=94160b70
# class-vs-class
cleric:cleric n=10 a=5 b=3 draw=2 fled=0 aRate=0.625
mage:mage n=10 a=2 b=0 draw=8 fled=0 aRate=1.000
shadowpriest:shadowpriest n=10 a=5 b=0 draw=5 fled=0 aRate=1.000
spellblade:spellblade n=10 a=7 b=2 draw=1 fled=0 aRate=0.778
thief:thief n=10 a=4 b=3 draw=3 fled=0 aRate=0.571
warrior:warrior n=10 a=8 b=1 draw=1 fled=0 aRate=0.889
total n=60 a=31 b=9 draw=20 fled=0
```
and `--n 36 --matchup classes --seed golden` ends with `total n=36 a=12 b=11 draw=13 fled=0`. Running any command twice yields byte-identical stdout (determinism test).

**Hard ≥ 70% gate (`sim/test/gate.test.ts`, Vitest timeout 120 s):** for each class `c` (6 classes), `j = 0..399`: `runDuel(rules, {seed: "gate/" + c + "/" + j, a: {c, j even ? "hard" : "easy"}, b: {kind:"class", c, j even ? "easy" : "hard"}, level: 5})`. Count `hardWins`, `easyWins` (KO wins by the hard/easy side), draws. **Requirement:** for every class `hardWins / (hardWins + easyWins) ≥ 0.70` and `(hardWins + easyWins) ≥ 80` (≥ 20% decisive). **Reference golden** (asserted exactly as a determinism check):

| class | hardWins | easyWins | draws | hard rate |
|---|---|---|---|---|
| cleric | 193 | 44 | 163 | 0.814 |
| mage | 89 | 28 | 283 | 0.761 |
| shadowpriest | 215 | 38 | 147 | 0.850 |
| spellblade | 272 | 51 | 77 | 0.842 |
| thief | 232 | 83 | 85 | 0.737 |
| warrior | 268 | 38 | 94 | 0.876 |

**Performance budget:** `pnpm sim duel --n 10000` (matchup `all`) ≤ 60 s wall on GitHub `ubuntu-latest`; CI runs the smoke `pnpm sim duel --n 264 --seed ci` (2 duels per matchup). The reference implementation ran 10 000 duels in 1.9 s.

### `@usurpia/client` (W1, 02-01)
`main.ts`: `createGame({v:2, seed:"demo", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}, DEMO_RULES)`, then `decision/open` (system) with prompts `p1: ["yes","no"]/"no"` and `p2: ["red","green","blue"]/"red"`, then `decision/commit p1 "yes"`; render `renderView(viewFor(state,"p2"), eventsFor(events,"p2"))` into `<pre id="app">`. `DEMO_RULES` = `src/demo-rules.ts`, a verbatim `TEST_RULES` copy typed `Rules`.
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
  2. `files: ["packages/core/src/ai/**/*.ts"]`: core restrictions + patterns `{ regex: "(^|/)(reducer|handlers)(/|$)", message: "the AI must not call the reducer or handlers" }` and `{ regex: "(^|/)types$", importNames: ["GameState", "HiddenState"], message: "the AI reads PlayerView only" }`.
- `scripts/check-core-purity.mjs`: cases gain an optional `path` (default `packages/core/src/__purity_probe__.ts`); add `import "./ai/index";` (expects `no-restricted-imports`) and, at `packages/core/src/ai/__purity_probe__.ts`, `import type { GameState } from "../types";` and `import { reduce } from "../reducer";` (each expects `no-restricted-imports`). Every probe file is deleted in `finally`.

### Golden summary
| Golden | Value | Pinned in |
|---|---|---|
| `rulesHash(TEST_RULES)` | `7433ea8b` | `core/test/rules.test.ts` (W1) |
| `createGame(fixture settings, TEST_RULES)` | `758ef72c` + canonical JSON above | `core/test/game.test.ts` (W1) |
| Poll replay (W1 fixture) | `9616698e`, 10 events, rejections at 2 and 5 | `core/test/replay.test.ts`, `sim/test/replay-file.test.ts` (W1) |
| Sheet/NPC stats | table above | `core/test/stats.test.ts` (W1); `core/test/npc.test.ts` (W2) pins `drawNpcCommand`/`drawNpcDefense` mapping (e.g. slime table 60/20/20/0: `u` 1–60 attack, 61–80 strike, 81–100 spell; flee never) |
| Damage matrix + variants | tables above | `core/test/resolve.test.ts` (W2) |
| Combat golden replay | `ec0c3508`, 80 events | `core/test/combat-golden.test.ts` (W2) |
| `rulesHash(loadRules())` | `94160b70` | `content/test/data.test.ts` (W2) |
| Rewards/loadout replay | `57da3ea4`, 84 events | `core/test/rewards-golden.test.ts` (W3, 02-04) |
| Sim combat fixture | `hash=60d64975 rules=94160b70 turn=1 events=107 rejections=0` | `sim/test/replay-file.test.ts` (W3, 02-05) |
| AI policy weights / rng | tables above | `core/test/ai.test.ts` (W3) |
| Sim duel stdout | mirrors block above; classes total line | `sim/test/duel.test.ts` (W3) |
| Hard vs Easy gate counts | table above | `sim/test/gate.test.ts` (W3) |

If an implementation disagrees with a composite golden (hash, stdout, gate counts) while all component goldens (stats, matrix, AI policy) pass, the executor diffs its behaviour against the prose of this spec, fixes the implementation, and only if the spec itself is ambiguous escalates to the orchestrator; any golden change needs a Revision History row.

## File Placement
| Artifact | Path | Placement Rationale | Existing Pattern |
|----------|------|---------------------|------------------|
| Rules types + helpers | `packages/core/src/rules.ts` | Core owns the contract; content implements it | Phase 1 `types.ts` |
| State/settings types | `packages/core/src/types.ts` | Same module as v1 | Phase 1 |
| Pure combat math | `packages/core/src/combat/{passives,stats,options,resolve}.ts` | No `GameState` imports; unit-testable; reused by the AI | New subfolder |
| Handlers | `packages/core/src/handlers/{index,shared,decision,combat,system,loadout}.ts` | Replaces `handlers.ts`; one file per concern for wave-parallel ownership | Phase 1 handler map |
| Progression / inventory | `packages/core/src/{progression,inventory}.ts` | Pure domain helpers | — |
| CPU AI | `packages/core/src/ai/*.ts` → `@usurpia/core/ai` | Headless, in core per design doc; lint-isolated | Design doc CPU AI Spec |
| Core test fixture | `packages/core/test/fixtures/test-rules.ts` | User decision: core tests without content | Phase 1 `test/` layout |
| Content data | `packages/content/data/*.json` (6 files) | Data separate from schemas | Phase 1 `items.json` |
| Content build | `packages/content/src/{build-rules,node}.ts`, `src/schemas/*.ts` | Browser-safe index + Node-only loader | Phase 1 `load.ts` |
| Sim | `packages/sim/src/{cli,replay-file,duel,kits,report,rules}.ts`, `fixtures/combat-game.json` | CLI package | Phase 1 sim |
| Client text shell | `packages/client/src/{main,render,demo-rules}.ts` | Phase 4 replaces it | Phase 1 client |

## Data and Control Flow
1. **Build time:** `content/data/*.json` → `loadContentDir` → `buildRules` (schema → duplicates → cross-refs → assemble, strip text) → `Rules`; the CLI gate fails `pnpm build` on any error.
2. **Game start:** host code obtains `rules` (sim: `loadRules()`; tests: `TEST_RULES`), computes `rulesHash(rules)`, calls `createGame(settings, rules)`.
3. **Turn loop (Phase 2 scope):** `reduce(state, action, rules)`; the precedence is Phase 1's. System actions (`combat/start`, `system/*`, `decision/open`, `timeout`) come from the host/sim; player actions (`decision/commit`, `loadout/*`) come from humans or the AI.
4. **Combat:** `combat/start` opens the first exchange decision; each player's prompt is private; commits are hidden until the last required player commits or the system times out; reveal updates the public choice history, draws NPC commands, resolves via pure `resolveExchange`, and either opens the next decision or ends the combat (+ rewards) — all inside one `reduce` call.
5. **CPU:** host loop calls `decideCombat(viewFor(state, cpuId), rules, ai)` → `action` → `reduce`; the AI's own RNG state is kept by the host (sim) and never enters `GameState`.
6. **Replay/sim files:** `{rulesHash, settings, actions}`; replay checks the hash first (mismatch → exit 3 unless allowed), then folds `reduce`.
7. **Views:** clients and (later) the server only ever send `viewFor`/`eventsFor` projections; prompts and bag/scroll events are private.
8. **CI:** install → lint → lint:purity → format:check → typecheck → test (includes the gate) → build → `pnpm sim duel --n 264 --seed ci`.

## Compatibility Constraints
- Everything from Phase 1 (Node ≥ 22.13 per root `engines`, pnpm 10.33.0, TypeScript ~6.0.3, ESM, strict tsconfig options, pinned versions). **No new third-party dependencies** in Phase 2; only workspace links (`@usurpia/content` → `@usurpia/core`, `@usurpia/sim` → `@usurpia/content`), added in W1 so later waves never touch `pnpm-lock.yaml`.
- Core stays pure: the AI may use `Math.exp`/`Math.log`/`Math.round` (allowed members), never `Math.random`.
- State, actions and events contain only JSON values; all state numbers are integers (property test: every number in every reachable state satisfies `Number.isSafeInteger`).
- `@usurpia/core` gains `exports["./ai"] = "./src/ai/index.ts"`; `@usurpia/content` gains `exports["./node"] = "./src/node.ts"`. Package `index.ts` files stay browser-safe.
- Save/replay compatibility: v1 saves are rejected (`SchemaVersionError`); there is no v1 → v2 migration (no users yet).
- Tuning changes after Phase 2 must update `94160b70`, the sim fixture, sim stdout goldens and gate counts in one commit.

## Failure Modes
Every negative test is built from a **known-valid** fixture with **exactly one** mutation and asserts the **exact** code and message, so a test cannot pass because an earlier check fired (PIT-001). Records keyed by ids are exercised with `toString`/`valueOf`/`hasOwnProperty`/`constructor`-like ids where the pattern allows (PIT-002).

| Failure Mode | Expected Behavior | Verification (single-mutation design) |
|--------------|-------------------|---------------------------------------|
| Commit a choice not in the player's own options (e.g. defender commits `"attack"`, or `"item:bomb"` without a bomb) | `INVALID_PAYLOAD` "choice is not one of your options"; state `===` input | `decision.test.ts`: open fixture decision, uncommitted player, valid decision id, token-shaped choice ∉ options |
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
| Sim 10k duels (R9) | `time pnpm sim duel --n 10000` exits 0, ≤ 60 s, stdout has `# class-vs-class` and `# class-vs-monster` sections and a `total n=10000` line | true |
| Hard ≥ 70% vs Easy (R9/R14 prep) | `pnpm vitest run packages/sim/test/gate.test.ts` | true |
| AI never reads hidden info | `pnpm vitest run packages/core/test/ai-hidden.test.ts` and `pnpm lint:purity` | true |
| Replay fixture | `pnpm sim replay packages/sim/fixtures/combat-game.json` prints `hash=60d64975 rules=94160b70 turn=1 events=107 rejections=0` | true |
| Sample module gone | `! grep -rnE "sample/|setSecret|lastRoll|defaultChoice|sample-game" packages/*/src packages/*/test packages/sim/fixtures` (no matches) | true |
| CI green on `dev` with the sim smoke step | GitHub Actions run on the final W3 commit | true |

## Deliverables
Five plans in three waves. Same-wave plans own **disjoint** files (listed exhaustively; "C" create, "M" modify, "D" delete). Every plan also owns its own `SUMMARY.md`, runs package-scoped lint/typecheck/test while parallel, and ends with a commit on `dev` (no `.tsbuild`/`dist`/`node_modules`). Agents per PRF-003: executors `sonnet`, the mandatory testing role `testing-qa-verification-specialist` on every plan.

### Wave 1 — Plan 02-01: Kernel v2 (Rules threading, generic decisions, sample removal, schema v2)
- **Paths:**
  - C: `packages/core/src/rules.ts`, `packages/core/src/combat/passives.ts`, `packages/core/src/combat/stats.ts`, `packages/core/src/handlers/{index,shared,decision}.ts`, `packages/core/test/fixtures/test-rules.ts`, `packages/core/test/fixtures/build.ts` (state/action builders for tests), `packages/core/test/{rules,stats}.test.ts`, `packages/sim/src/{kernel-rules,rules}.ts`, `packages/sim/fixtures/kernel-game.json`, `packages/sim/test/cli.test.ts`, `packages/client/src/demo-rules.ts`
  - M: `packages/core/src/{types,actions,events,reducer,validation,serialize,game,replay,views,index}.ts`, `packages/core/test/{arbitraries,reducer.test,decision.test,views.test,serialize.test,replay.test,counter-bounds.test,game.test}.ts`, `packages/sim/src/{cli,replay-file}.ts`, `packages/sim/test/replay-file.test.ts`, `packages/sim/{package.json,tsconfig.json}` (+`@usurpia/content` dep/reference), `packages/content/{package.json,tsconfig.json}` (+`@usurpia/core` dep/reference), `packages/client/src/{main,render}.ts`, `packages/client/test/render.test.ts`, `pnpm-lock.yaml`
  - D: `packages/core/src/handlers.ts`, `packages/sim/fixtures/sample-game.json`
- **Purpose:** binding decisions OQ5a–c; everything later waves build on (full v2 state shape incl. combat types, `deserialize(json, rules)` with combat rejected, `reduce(…, rules)`, poll decisions, `viewFor.counts`, stats/passives).
- **Key content:** kernel goldens (`7433ea8b`, `758ef72c`, `9616698e`), stats goldens, arbitraries over the W1 action set with `PROTO_IDS` seats, the Phase 1 property suite re-pointed at v2 (≥ 200 runs), client/sim shells on v2.
- **Dependencies:** none (Phase 1 complete).
- **Estimated size:** ~1 100 lines src, ~1 300 lines tests.

### Wave 2 — Plan 02-02: Content (schemas, data, `buildRules`)
- **Paths (all under `packages/content/`):**
  - C: `src/schemas/{classes,gear,spells,monsters,tuning}.ts`, `src/{build-rules,node}.ts`, `data/{classes,gear,spells,monsters,tuning}.json`, `test/{build-rules,data}.test.ts`, `test/helpers.ts`
  - M: `src/{index,registry,validate}.ts`, `src/schemas/{common,items}.ts`, `data/items.json`, `test/validate.test.ts`, `package.json` (`exports["./node"]`, no dependency changes)
  - D: `test/fixtures/**`
- **Purpose:** R5/R7/R8 data; the only producer of `Rules`.
- **Key content:** every table in *Content data* transcribed exactly (pinned by `rulesHash === "94160b70"`), display text, cross-ref rules with unique messages, temp-dir CLI gate test.
- **Dependencies:** 02-01 (type imports from `@usurpia/core`). **Parallel with 02-03** (no shared files).
- **Estimated size:** ~500 lines src, ~900 lines JSON, ~500 lines tests.

### Wave 2 — Plan 02-03: Combat engine
- **Paths (all under `packages/core/`):**
  - C: `src/combat/{options,resolve}.ts`, `src/handlers/{combat,system}.ts`, `test/{resolve,npc,combat-flow,combat-golden}.test.ts`
  - M: `src/{actions,events,serialize,index}.ts`, `src/handlers/index.ts` (register `combat/start`, `system/setCharacter`, the `combat/exchange` resolver), `test/{arbitraries,serialize.test,views.test,replay.test,counter-bounds.test}.ts`
- **Purpose:** R6 and the NPC half of R8.
- **Key content:** `computeCell`/`resolveExchange` exactly as specified, state machine, draw order, deserialize combat checks, matrix + variant goldens, combat golden `ec0c3508`, arbitraries extended with `combat/start`, `system/setCharacter` and combat-token commits.
- **Dependencies:** 02-01. **Parallel with 02-02.**
- **Estimated size:** ~900 lines src, ~1 000 lines tests.

### Wave 3 — Plan 02-04: Progression + inventory
- **Paths:**
  - C: `packages/core/src/{progression,inventory}.ts`, `packages/core/src/handlers/loadout.ts`, `packages/core/test/{progression,inventory,loadout,rewards,rewards-golden}.test.ts`
  - M: `packages/core/src/{actions,events,index}.ts`, `packages/core/src/handlers/{index,combat}.ts` (reward hook in `endCombat`), `packages/core/test/{arbitraries,counter-bounds.test,views.test}.ts` (loadout actions; grant overflow; private `Granted`/`ScrollsUpdated` redaction)
  - (no files outside `packages/core/`)
- **Purpose:** R5 progression/hybrids/portable, R7 limits and class-switch overflow, rewards.
- **Key content:** reward formulas, events order, `adjustHp`, exact-discard rule, rewards/loadout golden `57da3ea4`.
- **Dependencies:** 02-02, 02-03. **Parallel with 02-05.**
- **Estimated size:** ~600 lines src, ~800 lines tests.

### Wave 3 — Plan 02-05: CPU AI + balance sim
- **Paths:**
  - C: `packages/core/src/ai/{index,combat,opponent-model,tuning}.ts`, `packages/core/test/{ai,ai-hidden}.test.ts`, `packages/sim/src/{duel,kits,report}.ts`, `packages/sim/test/{duel,gate}.test.ts`, `packages/sim/fixtures/combat-game.json`
  - M: `packages/core/package.json` (`exports["./ai"]`), `eslint.config.js`, `scripts/check-core-purity.mjs`, `packages/sim/src/{cli,index,rules}.ts` (`duel` subcommand; `replayRules()` → `loadRules()`), `packages/sim/test/{cli,replay-file}.test.ts`, `.github/workflows/ci.yml` (smoke step after `pnpm build`), `README.md` (sim commands)
  - D: `packages/sim/src/kernel-rules.ts`, `packages/sim/fixtures/kernel-game.json`
- **Purpose:** R9 and the combat half of R14 (binding OQ5d).
- **Key content:** AI algorithm and goldens, hidden-info test, lint isolation, CLI contract/report, stdout goldens, the Hard ≥ 70% gate, performance budget.
- **Dependencies:** 02-02, 02-03 (not 02-04: duel outcomes are decided before rewards, duel goldens contain no state hash, and the sim fixture uses only W1/W2 actions with no player KO win). **Parallel with 02-04.**
- **Estimated size:** ~900 lines src, ~700 lines tests.

## Path Validation
**Status:** All paths valid. Verified against the working tree on `dev` (2026-09-29): every "M"/"D" path exists (`packages/core/src/handlers.ts`, `packages/sim/fixtures/sample-game.json`, `packages/content/test/fixtures/{valid,invalid}/items.json`, `scripts/check-core-purity.mjs`, `.github/workflows/ci.yml`, …); every "C" path's parent directory exists or is created by the owning plan (`core/src/combat/`, `core/src/handlers/`, `core/src/ai/`, `core/test/fixtures/`). No `.planning/config/directory-mappings.yaml` exists.

## Open Questions
| # | Question | Impact | Default Chosen by Spec | Planning Effect |
|---|----------|--------|------------------------|-----------------|
| 1 | Keep a generic `decision/open` system action after the sample removal? | Non-blocking | Yes, as kind `poll` (per-player options/defaults), satisfying "opened by system actions"; it gives W1 a testable decision flow and Phase 3 a generic prompt | Use the default |
| 2 | Draws dominate some mirrors (Mage mirror ~70% draws at L5) | Non-blocking | Accept for Phase 2; draw rate is reported by the sim; tuning is Phase 3/7 work | Use the default |
| 3 | Initial class balance (e.g. Mage beats Warrior at L5, Cleric low KO rate) | Non-blocking | Numbers are **initial tuning**; the sim's job is to report it; no balance gate in Phase 2 except Hard ≥ 70% | Use the default |
| 4 | Where do KO'd players go / how do they revive? | Non-blocking | Phase 2 leaves hp 0 (combat/start rejects KO'd fighters); `system/setCharacter` fully heals for sims/tests; Temple revival is Phase 3 | Use the default |
| 5 | PvP spoils (steal gold/item, seize, humiliate) and Thief/Shadowpriest board passives | Non-blocking | Phase 5 / Phase 3; PvP KO grants only `pvpXpPerLevel × loser level` XP and a mastery win | Use the default |
| 6 | Class switching location/fee timing | Non-blocking | Allowed in phase `turn` anywhere, fee charged; Phase 3 restricts to the Castle | Use the default |
| 7 | AI use of flee, tonics, Smoke Bomb, and poll decisions | Non-blocking | Not used by the Phase 2 AI (heal rule only); Phase 3 persona AI extends | Use the default |
| 8 | Damage variance roll | Non-blocking | None in Phase 2; adding one later is a tuning-contract change (new field + revision row) | Use the default |
| 9 | Temporary `TEST_RULES` copies in sim (W1–W2) and client (until Phase 4) | Non-blocking | Accept; both are typed `Rules`, the sim copy is deleted in 02-05; the client copy is replaced when Phase 4 wires content | Use the default |
| 10 | Fixture/golden churn on every content tuning change | Non-blocking | Accept (explicit rehash in the same commit); keeps "the sim ran on exactly these rules" provable | Use the default |

No blocking questions.

## Complexity Assessment

**Rating:** Complex

| Metric | Value |
|--------|-------|
| Requirements | 5 (R5–R9) |
| Deliverables | 5 plans, ~95 files (new ~55, modify ~40, delete ~4) |
| Estimated waves | 3 (kernel v2 → content ∥ combat → progression/inventory ∥ AI/sim) |
| Estimated plans | 5 |
| Competing proposals | Already run: "Hybrid: Pragmatic-based" selected by the user |

**Rationale:** Phase 2 replaces the kernel's gameplay layer while keeping every Phase 1 contract, introduces the first real rule data flow across packages, and pins integer combat math, AI behaviour and simulator output with golden values from a reference implementation. The wave split keeps the one cross-cutting change (schema v2 + `Rules` threading) in a single plan and gives later parallel plans disjoint files.

**Recommended next step:** Decompose into the 5 plans above using this spec as the primary source; run a plan critique focused on the W1 size and the golden-value protocol.

## Revision History
| # | Section | Change | Reason |
|---|---------|--------|--------|
| 1 | All | Initial Phase 2 spec: binding OQ5 decisions encoded; Rules/state/actions/events/deserialize contracts; integer damage math with golden matrix; combat state machine and draw order; content data (initial tuning, pinned by `rulesHash 94160b70`); AI algorithm with policy goldens; sim CLI/report/gate goldens; 5-plan wave split with disjoint ownership. All goldens computed by the planner's reference implementation (Node scratch scripts, 2026-09-29) | Phase 2 planning (user-approved architecture "Hybrid: Pragmatic-based") |
