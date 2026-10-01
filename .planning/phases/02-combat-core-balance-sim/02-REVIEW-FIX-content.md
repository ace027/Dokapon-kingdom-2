# Phase 2 review cycle 1: content / client / sim fixes

Branch `review2/c1-content`. Goldens unchanged: rulesHash `84a995db` (shipped), TEST_RULES `7433ea8b`, sim fixture `0483c0fa` and all sim gate pins pass untouched. Full suite: 36 files, 1394 tests (was 1187).

Method: each mutation edits one line of source, runs the named test file(s), and restores the line. "only" means every failing test is a row of that rule.

## S1 (content ranges and ceilings)

Tests: `packages/content/test/limits.test.ts`. Each row sets one field one past its bound and expects exactly one error (`toEqual([one])`), so no second check can reject it.

| Rule | Mutation (widen or remove) | Failing tests |
| --- | --- | --- |
| heal bp 0..10000 | items.ts heal bp -> wide int | `items.0.effect.bp` below + above only |
| drain bp 0..10000 | spells.ts drain bp wide | `battle.4.effect.bp` below + above only |
| stealGold bp 0..10000 | spells.ts stealGold bp wide | `battle.6.effect.bp` below + above only |
| ward valueBp 0..100000 | spells.ts valueBp wide | `ward.0` / `ward.3` below + above only (4) |
| reflect valueBp <= 10000 | threshold 10_000 -> 10_000_000 | the reflect row only |
| fleeMin <= fleeMax | condition -> false | the cross-field row only |
| kBp, jBp, jMagBp, critMultBp, seniorRewardBp (0..100000) | each field wide | that field's below + above only (5 runs) |
| critBase, critPerLuck, critCap, fleeBase, fleeMin, fleeMax, poisonBp (0..10000) | each field wide | that field's below + above only (7 runs) |
| fleePerSpdBp, modMinBp (<= 0), modMaxBp (>= 0) | each wide | that field's below + above only |
| matrix cells guard/counter/ward/open | shared cell schema wide | the 3 rows (attack/strike/spell) of that cell, below + above (6 each) |
| 30 hook ranges (`HOOK_RANGES`) | each hook's range -> +-1e9 | that hook's below + above only (30 runs; lifesteal also fails the passive/NPC row that uses it) |
| hook check on class passives (spread shape) | drop `.superRefine` on PassiveEntrySchema | the passive/NPC row only |
| hook check on gear/NPC hooks | drop `.superRefine` on HookSchema | all hook rows (61) |
| class worst-case ceiling | hook bp ignored | class ceiling row only |
| class ceiling off / monster off / monster tier row / guardian off / enforcer off | each disabled | the matching ceiling row only (1 each) |

Notes: `modMinBp <= 0 <= modMaxBp` is enforced by field ranges (modMin max 0, modMax min 0), which also covers the cross-field wording. The fleeMin/fleeMax rule only fires when both bounds are individually valid (first draft double-reported, caught by the exact-error rows). The enforcer row uses `toContainEqual` because a single field change cannot isolate the enforcer from the classes.

## A1 (typed assemble)

`assemble` now builds `const rules: Rules = {...}` with `RULES_VERSION`; `keyed<T>` / `stripDisplayText<T>` are generic over a type-level `Stripped<T>`; tier/rank schemas are literal unions. Proof: temporarily added `readonly dummyPhase3Field: number` to `Rules` in core/src/rules.ts (reverted with `git checkout`, not committed): `tsc -b` failed with `packages/content/src/build-rules.ts(399,9): error TS2741: Property 'dummyPhase3Field' is missing in type ...`.

## A6 (paths)

Cross-ref paths are now from the file root (`monsters.3.battleSpell`, `guardians.1.x`, `enforcer.id`). Duplicate-id labels such as `battle` / `ward` were already root paths in spells.json (its root keys are `battle`, `ward`, `field`), so only the monsters.json cross-ref forms were wrong. New test: every cross-ref error path resolves inside the mutated file's JSON. Mutations: monsters path regress (7 failing), guardian path regress (3), enforcer path regress (3), enforcer id path regress (1). rulesHash unchanged.

## A5 (client demo rules from content)

`demo-rules.ts` is now `buildShippedRules()` from `@usurpia/content/shipped` (new browser-safe entry importing `data/*.json` via `resolveJsonModule`, no `node:fs`). Goldens re-pinned from engine output: `p1 warrior L1 hp 46 gold 100 bag 1`, `p2 mage L1 hp 34 gold 100 bag 1` (check: 40 * 11500 / 10000 = 46, 40 * 8500 / 10000 = 34). DEMO_RULES pin is `84a995db`. Mutation: warrior hp 11500 -> 12000 in data fails 4 client tests. Bundle: 45.06 kB (14.82 kB gzip) -> 166.23 kB (49.68 kB gzip); the growth is zod plus the validators and data.

## Q1 (invalid content diagnostics)

`loadRules` throws `ContentInvalidError` (message `content invalid: N errors` plus one `file path: message` line per error, `.errors` property). The sim CLI catches it for `replay` and `duel`, prints the message to stderr and exits 1 (README: `1` = invalid content). `replayRules` honours `USURPIA_CONTENT_DIR` (same variable as the content gate) so the CLI is testable against a bad copy. Mutations: old one-line message (1 failing), catch removed (2 failing), exit code 2 (2 failing).

## T1 (aRate=n/a)

`sim duel --n 1 --matchup mage:mage --seed na5` is a draw (a=0 b=0 draw=1); the test asserts the exact line `mage:mage n=1 a=0 b=0 draw=1 fled=0 aRate=n/a`, plus a decisive-seed numeric counterpart. Mutation: `const rate = (t.aWins / decisive).toFixed(3)` fails the n/a test only.

## T6 (hybrids unlock)

`data.test.ts` pins `hybridUnlockRank === 3`, `masteryWins === [0,3,7,12,18]`, and `hybridsUnlocked` for warrior+mage (7/7 -> spellblade, 6/7 and 7/6 -> none) and thief+cleric (shadowpriest). Mutations (data edits, so the hash pin fails too): masteryWins[2] 7->8, hybridUnlockRank 3->2, spellblade parents changed; the new test fails in each.

## Residual risks

- Hook sums are not capped across a hook list (e.g. several `stealGoldOnHitBp` on one NPC could exceed 10000 in total); engine-side clamping belongs to core.
- Content-side ceiling uses an upper bound (best gear per slot, all passives, best portable passive), so it can reject content that no single character can actually build.
- pnpm-lock.yaml changed (client now depends on @usurpia/content); outside the stated ownership but required by `--frozen-lockfile`.
