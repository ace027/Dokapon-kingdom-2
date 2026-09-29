# Plan 02-03 Summary: Combat engine (resolve, flow, golden)

Status: Complete (branch `phase2/02-03`, worktree `/home/user/usurpia-wt/02-03`).

## API
- `combat/options.ts`: `DEFENDER_OPTIONS`, `attackerOptions`, `exchangeRoles`, `requiredFor` (returns `[]` when the attacker is stunned).
- `combat/resolve.ts`: `ZERO_MODS`, `snapshotPlayer`, `snapshotNpc`, `isCritEligible`, `critChanceBp`, `fleeChanceBp`, `physBase`, `spellBase`, `computeCell`, `drawNpcCommand`, `drawNpcDefense`, `resolveExchange` and the spec types. Pure, no `GameState`.
- `handlers/combat.ts`: `combatStartHandler`, `resolveCombatExchange`, `openExchange`, `endCombat(state, outcome, winner, fled, rules, events)`.
  **Reward insertion point for 02-04:** the marked comment in `endCombat`, after `CombatEnded` is pushed and before `combat` is cleared is returned (the winner side is read from `activeCombat(state).sides`; `endCombat` builds `closed` then returns it).
- `handlers/system.ts`: `setCharacterHandler`. `handlers/index.ts`: resolver swap done (`resolveUnsupported` no longer imported).
- `actions.ts`: `Opponent`, `combat/start`, `system/setCharacter`, `ACTION_TYPES`. `events.ts`: `CombatStarted`, `RoundStarted`, `ExchangeSkipped`, `ExchangeResolved`, `RoundEnded`, `CombatEnded`, `CharacterSet`, `BagUpdated` (private). `index.ts` exports options/resolve.
- `serialize.ts`: full check 8.

## Tests
Core 628 tests (19 files repo-wide: 700 tests total). resolve.test: 71 (12 matrix cells, 23 variant rows, 12 crit-eligibility pairs, flee clamps, exchange draw order). npc.test: 9. combat-flow: 134. serialize: 204 (8 bases incl. mid-combat, npc, guardian, enforcer). combat-golden: 8.

## Golden values observed (all match the spec / trace)
`ec0c3508`, 18 actions, 0 rejections, 80 events, per-step hashes equal `traces/combat-golden.trace.json`, exchange table (10 rows, row 9 = `[0,12]`), final rng `[3200512360,239253250,3363130012,583700052]`, hidden `{combatSeq:2, decisionSeq:10}`, choiceHistory as spec. Fuzz: 20 000 property runs (throwaway, not committed) round-tripped every reachable state.

## Check-8 messages (`deserialize: ...`)
combat/exchange decision requires combat; combat requires a combat/exchange decision; combat must be an object; combat is missing/has unexpected key; combat.id does not match combatSeq; combat.round out of range; combat.exchange must be 1 or 2; combat.first must be 0 or 1; combat.sides must be an array / must hold two sides; combat.sides[i] must be an object / is missing key / has unexpected key; combat.sides[0] must be a player side; combat.sides[i].kind is unknown; combat.sides[i].playerId is not a seated player; combat.sides must not repeat a player; combat.sides[i].npc must be an object / is an unknown monster / is an unknown guardian / .senior must be a boolean / .townTier out of range / .level out of range / .kind is unknown / has unexpected key; combat.sides[i].stats must be an object / is missing key / does not match the npc snapshot; combat.sides[i].hp out of range; combat.sides[i].mods must be an object / is missing key / .<stat> out of range / .poison|.stun must be a boolean; combat side <id> is knocked out; pending.required does not match the combat exchange; private.<id>.prompt does not match the combat exchange.

## Mutation proof
Harness (throwaway, `/tmp/usurpia-scratch/02-03/mutate.py`) disabled or neutralised each check in turn, ran the owning suites (combat-flow, counter-bounds, replay for start/setCharacter; serialize for check 8) and restored the source (verified `git status` unchanged). 77 mutations: every `combat/start` state check (10), every shape-guard clause (~26), every `system/setCharacter` state check (11) and guard clause (~17), and every check-8 check (~46 incl. exact-key and object/array checks). Each mutation made its own dedicated test(s) fail; none survived after fixes. Findings that led to added tests: unguarded `isPlainObject`/`kind === "npc"`/`npc: null` and guardian/enforcer extra-key rows initially survived, and were closed with new rows. State-check mutations additionally failed the replay property tests (expected: the generators reach those paths). Equivalent-mutant note: none left.

## Pipeline (worktree, real exit codes)
install 0, lint 0, lint:purity 0 (11 cases), format:check 0, typecheck 0, test 0 (700 passed), build 0, `tsc -b packages/sim packages/client` 0, fresh-process tsx imports of rules.ts, serialize.ts, combat/options.ts and `@usurpia/core` (sim) all 0.

## Decisions and deviations
- `handlers/decision.ts`: NOT changed (no reveal-path fix needed).
- NPC attack draw: the handler zeroes the `spell` weight for an NPC without a battle spell before `drawNpcCommand` (reference oracle behaviour; identical for shipped tables where such NPCs have spell weight 0).
- `requiredFor` returns `[]` for a stunned attacker, so a save with a decision open on a stunned attacker fails check 8 with the `pending.required` message.
- Crafted rules use a JSON deep copy of `TEST_RULES` (`craft` helper) instead of `structuredClone`, because the core tsconfig has no `structuredClone` typing; `TEST_RULES` is never mutated.
- Golden actions/settings live in `test/arbitraries.ts` (`COMBAT_GOLDEN_ACTIONS`, `COMBAT_GOLDEN_SETTINGS`) so serialize/replay/views/flow suites share them without importing a test file.
- The stun-chain test uses seed `stun-3` (found with a throwaway search) and crafted rules; it asserts semantics, not recorded hashes.
- The spec's `ctx.int` is passed through a `drawOf(ctx)` wrapper (lint `unbound-method`).

## Pre-existing / notes
None found. Regression risk for 02-04: `endCombat` keeps the reveal-time phase `turn`; rewards must append events after `CombatEnded`.
