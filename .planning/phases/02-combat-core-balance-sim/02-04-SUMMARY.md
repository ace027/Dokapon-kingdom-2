# Plan 02-04 Summary: Progression + inventory

Status: Complete (branch `phase2/02-04`, worktree `/home/user/usurpia-wt/02-04`).

## API
- `progression.ts`: `hybridsUnlocked`, `applyXp`, `victoryReward`, `awardVictory` (spec signatures). `awardVictory` returns `{character, events}` where `events` are bare `ProgressionEvent`s (`VictoryRewarded`, `LevelUp`×n, `MasteryRankUp`?, `HybridUnlocked`×m, in spec order; no `playerId`/`visibility`, because the spec signature has no player id). Module-level helpers not exported from `index.ts`: `progressionEvent(playerId, e)` (stamps `v`, `PUBLIC`, `playerId`) and `withAdjustedHp(rules, before, after)`.
- `inventory.ts`: `InvResult<T>`, `isReject`, `addItem`, `removeItem`, `addScroll`, `equipGear`, `setSpell`, `planClassSwitch`. `equipGear`, `setSpell` and `planClassSwitch` return the character with hp already run through `adjustHp`.
- `handlers/loadout.ts`: `grantHandler` (`system/grant`; actor `system`, phase `turn`), `switchClassHandler`, `discardHandler`, `useItemHandler`, `setPortableHandler` (actor `any-player`, phase `turn`). Validate and apply share one planner (`planGrant`, `planClassSwitch`, `removeItem`), so the checks that reject are the checks apply relies on.
- `handlers/combat.ts`: `endCombat` now emits `CombatEnded`, clears `combat`, and for `outcome === "ko"` with a player winner calls `victoryReward` + `awardVictory` (private `rewardWinner`) and appends its events after `CombatEnded`. The `_rules` parameter became `rules`; nothing else in combat changed.
- `actions.ts`: `Grant`, `system/grant`, `loadout/switchClass|discard|useItem|setPortable`, `ACTION_TYPES` extended in spec order. `events.ts`: `ScrollsUpdated` (private), `Granted` (private for `item`/`scroll`, else public), `LevelUp`, `VictoryRewarded`, `MasteryRankUp`, `HybridUnlocked`, `ClassSwitched`, `ItemUsed`, `PortableSet`. `index.ts` exports the progression + inventory public functions/types and `Grant` (never `ai/`).

## Tests (core: 902; repo: 1054, was 700)
| file | tests |
|---|---|
| progression.test.ts | 53 (ranks, passives, portable, hybrids, applyXp, victoryReward, awardVictory, `loadout/setPortable` handler incl. shape) |
| rewards.test.ts | 14 (PvP, monster, senior, guardian, enforcer, level-up, rank-up, hybrid once, NPC win / draw / flee = no reward) |
| inventory.test.ts | 67 |
| loadout.test.ts | 120 |
| rewards-golden.test.ts | 7 |
| counter-bounds.test.ts | 11 (+4: gold/xp grant bounds, reward saturation) |
| views.test.ts | 33 (+ `Granted`/`ScrollsUpdated` redaction, counts) |
| arbitraries.ts | `system/grant` + four `loadout/*` generators (prototype ids included, amounts 0..1_000_001) folded into `arbInputFor`; the property suites (replay, views) pass unchanged with the new inputs, every reachable state round-trips `deserialize` |

## Golden values observed (match spec and trace)
- Rewards golden: 25 actions, 0 rejections, 84 events, `hashState` `57da3ea4`; initial `8823afb2`; all 25 per-step hashes equal `traces/rewards-golden.trace.json`; 84-event type sequence, 9-row exchange table, all checkpoints (`VictoryRewarded` ×2, `ItemUsed` healed 14 hp 36, `LevelUp` 2 and 3, `ScrollsUpdated ["haste"]`, `ClassSwitched` fee 50 hp 67, `BagUpdated` `["herb","bomb","antidote"]` then p1 `[]`), final characters, both `choiceHistory` records and `hidden {combatSeq 2, decisionSeq 9, rng [2320551141,1615250627,3129816856,743918455]}`. Passed on the first run; no mismatch localisation needed.
- Combat golden `ec0c3508` unchanged (8 tests green): it has no player KO win.

## Reward table
| loser | xp | gold |
|---|---|---|
| player | `pvpXpPerLevel × loser.level` | 0 |
| monster | `fl(xp × m / 10000)` | `fl(gold × m / 10000)`, `m = senior ? seniorRewardBp : 10000` |
| guardian | `xpPerTier × townTier` | `goldPerTier × townTier` |
| enforcer | `xpPerLevel × level` | `goldPerLevel × level` |

Awards saturate at `MAX_COUNTER`; one mastery win for the winner's current class; `VictoryRewarded.xp/gold` are the reward amounts (not the saturated deltas). Draws, flees and NPC wins award nothing.

## Validation messages (all `INVALID_PAYLOAD`, unique)
- `system/grant`: target must be a seated player; unknown item / unknown field spell / unknown gear / unknown battle spell / unknown ward spell; bag is full; scroll limit reached; gold would exceed MAX_COUNTER; xp would exceed MAX_COUNTER. Shape failures: `invalid payload for system/grant`.
- `loadout/switchClass`: unknown class; already that class; hybrid not unlocked; not enough gold; discard must list exactly the overflow items; discarded item not in bag.
- `loadout/discard`: item not in bag. `loadout/useItem`: item not in bag; item is not usable outside combat; knocked out. `loadout/setPortable`: unknown class; portable passive requires mastery rank 5. Every `loadout/*` in a combat decision is `WRONG_PHASE`; `system` sending one, or a player sending `system/grant`, is `WRONG_ACTOR`.

## Mutation proof
Harness: throwaway `/tmp/usurpia-scratch/02-04/mutate.py`. It deleted or inverted one check at a time in `inventory.ts` / `handlers/loadout.ts`, ran the owning suites (inventory, loadout, progression, counter-bounds), recorded the failing tests, then restored the source (`git status` verified unchanged after each run and at the end). 70 mutations:
- Every `Reject` branch of `inventory.ts` (addItem unknown item / unknown class / bag is full; removeItem; addScroll unknown / limit; equipGear; setSpell battle / ward; planClassSwitch unknown class / already / hybrid / gold / discard length (both directions) / not in bag; the new-class-fee choice) and every clause of `isReject`.
- Every validation check of the five handlers (grant target, gold and xp overflow, `Granted` visibility; useItem bag / use kind / effect kind / knocked out / heal clamp; discard; portable unknown class and rank 5; switch validate delegation and the `BagUpdated`-iff-discard rule) and every shape-guard clause (exact keys, envelope, target/classId/itemId types, `isGrant` per kind, amount range bounds, `isStringList` array / length / entries) plus every handler's `phases` and `actor`.
- Result: 70 killed, and each kill was by its own dedicated tests (grant `actor`/`switch actor`/`useItem actor` also fail the many tests that use those actors; expected). Nine mutations first survived; eight were closed with new tests, re-run and killed: the `playerId` string clause of `isEnvelope` in all four guards (new "non-string playerId" rows), `useItem` `use === "both"` (crafted `use: "combat"` heal item), and the three `loadout/setPortable` guard clauses (new shape rows); the ninth (`isPlainObject` in `isGrant`) is an equivalent mutant (below).
- Equivalent mutants left (not counted as killed): the `v === 2` and `type === <own type>` clauses of `isEnvelope` (reduce has already rejected any other version or type before the guard runs) and `isPlainObject` in `isGrant` (input is canonical JSON, arrays and primitives already fail on `kind`).
- Fixtures for every negative are one mutation from a fixture exactly at the limit (bag at `bagSize`, 3 scrolls, gold at fee-1, 17 vs 18 wins, overflow ± 1), so an earlier check cannot be the reason a test passes. Prototype-member ids (`toString`, `constructor`, `__proto__`, `valueOf`) are covered for every content-id and player-id lookup.

## Pipeline (worktree, real exit codes)
install 0 (`pnpm install --frozen-lockfile`), lint 0, lint:purity 0, format:check 0, typecheck 0, test 0 (26 files, 1054 tests passed), build 0, `pnpm exec tsc -b packages/sim packages/client` 0, fresh-process tsx imports of `core/src/index.ts`, `progression.ts`, `inventory.ts`, `handlers/loadout.ts` and `@usurpia/core` from sim all 0. Plan verification greps (57da3ea4, 2320551141, `awardVictory(`, the two message literals) exit 0.

## Decisions
- All W3 events were added in Task 1 (`events.ts`), including those first emitted by Task 2 handlers; `events.ts` imports the `Grant` type from `actions.ts` (type-only).
- `loadout/setPortable` handler cases live in `progression.test.ts`, as planned.
- `awardVictory` returns bare `ProgressionEvent`s and `progressionEvent()` stamps them (see API), because the spec's `awardVictory(rules, ch, reward)` has no player id.
- The class-switch fee is the new class's `switchFee` (the reference engine does the same); it is asserted by a mutation test (TEST_RULES fighter and caster both cost 50, so the golden does not pin it; battlemage 150 does).
- `discard must list exactly the overflow items` lives in `inventory.ts` (`planClassSwitch`, spec: helpers return handler-table messages). The plan's verification grep targets `handlers/loadout.ts`, so the switch handler's doc comment lists the table order and this literal.
- Crafted rules in the new suites use a JSON deep copy of `TEST_RULES` (`craft`), as in 02-03; reward fixtures use fragile NPCs (hp 1, def 0, spd 0) so a single Attack ends a combat.

## Deviations
- None from `files_modified` / `files_forbidden`. Nothing under `packages/core/src/ai/`, `package.json`, `packages/sim`, `eslint.config.js`, `scripts/` or `.gitignore` was touched.
- No test fixture (`test/fixtures/`) was added or changed, so `make`/`craft` helpers are duplicated locally per test file.

## Notes for the orchestrator / 02-05 task 3
- Player KO wins now append `VictoryRewarded` etc. after `CombatEnded`, which changes `DuelResult.events`/`hash` but not `outcome`/`winner`/`fled`. The 02-05 closing step pins the reward-dependent sim hashes after the merge.
- Pre-existing issues found: none.
