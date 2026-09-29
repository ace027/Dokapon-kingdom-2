# Plan 02-05 Summary: CPU AI + balance sim (tasks 1-2)

Status: Complete (tasks 1-2 on branch `phase2/02-05`; task 3, the W3 closing step, on `dev`). Push and CI proof are the orchestrator's.

## API
- `@usurpia/core/ai` (`packages/core/package.json` `exports["./ai"]`): `Difficulty`, `AiState`, `createAi`, `AiDecision`, `decideCombat`, `Policy`, `combatPolicy`, `AI_TUNING`, `expNeg`.
  - `ai/exp.ts` `expNeg` (degree-13 Horner, LN2 range reduction, `RangeError` for `x > 0`); `ai/tuning.ts` `AI_TUNING`; `ai/opponent-model.ts` `opponentDistribution(view, rules, difficulty, meIndex)` + `snapshotSide`; `ai/combat.ts` steps 1-4 and 6-8.
  - Reads `PlayerView` + `Rules` only; imports only `../{views,rules,rng,actions,types,validation}` and `../combat/*`. Uses `ownGet` for every player-/content-keyed read (PIT-002).
- `@usurpia/sim`: `runDuel`, `DuelSpec`, `DuelResult`, `runReport`, `KITS`, `replayFile`, `ReplayFileError`, `RulesMismatchError` (index). Internal: `buildMatchups`, `UsageError` (`duel.ts`), `TIER_LEVEL`, `tierForLevel`, `seatClass` (`kits.ts`).
- CLI: `pnpm sim replay <file> [--allow-rules-mismatch]` (unchanged codes 2/3) and `pnpm sim duel [--n] [--matchup] [--difficulty] [--seed] [--level] [--json]`. Usage errors print `usage: <message>` plus the duel usage line on stderr, exit 2.
- `eslint.config.js`: `CORE_IMPORT_RESTRICTIONS` hoisted; core-not-ai object; ai-isolation object (regex bans, `importNames` ban on `GameState`/`HiddenState`, `Math.exp/log/pow` ban). `scripts/check-core-purity.mjs`: per-case `path`, 7 new ai-boundary cases (18 total). `.gitignore`: `**/__purity_probe__.ts`.
- `packages/sim/src/rules.ts` now returns `loadRules()`; `kernel-rules.ts` and `fixtures/kernel-game.json` deleted; new `fixtures/combat-game.json`; CI smoke step and README (`sim duel`) added.

## AI goldens observed (all equal the spec, none recorded from the engine)
- All 8 `combatPolicy` rows (exact integer weights, ev to 6 dp, `ev === null` for Easy), Normal ignores history.
- `decideCombat` on the all-0 state: p1 `strike` x3, p2 `counter` x3, and all six resulting `ai.rng` arrays exact.
- `expNeg(0) === 1`, `expNeg(-1) === 0.36787944117144233`, `expNeg(-700.5) === 0`, 1 000-sample relative error < 1e-13, `RangeError`.
- `ai-hidden.test.ts`: both directions (attacker p1 blind to p2's committed defence / hidden.rng / bag contents; defender p2 blind to p1's attack), variants pairwise-distinct by `hashState`, `viewFor` deep-equal, identical actions and `ai.rng` for all 3 difficulties.

## Sim goldens observed
- `pnpm sim replay packages/sim/fixtures/combat-game.json` -> `hash=0483c0fa rules=84a995db turn=1 events=95 rejections=0`; all 23 per-step hashes equal `traces/combat-game.trace.json`; the 12-exchange table, event type sequence, three `CombatEnded`, final state and hidden counters/rng match the spec (row #3 `[0,44]`, D2; row #10 `[9,0]`, Barrier).
- Mirrors block (byte-exact, 9 lines), `--n 36 --matchup classes` total `a=14 b=11 draw=11 fled=0`, CI smoke `total n=264 a=154 b=57 draw=51 fled=2`, perf `total n=10000 a=5411 b=2370 draw=2118 fled=101`.
- Content NPC spot stats: ogre `218/63/33/42/17/9`, senior slime-intern `76/24/12/17/10/4`, lich T1 `104/24/15/27/13/6`, enforcer L10 `108/49/28/31/19/14`.
- Tasks 1-2 pin **no** `DuelResult.events`/`hash` and no `...PreRewards` values (verified by the plan's grep).

## Gate table (D1; 400 duels per class, level 5; exact counts asserted)
| class | hardWins | easyWins | draws | fled | Hard-decisive rate | draw rate |
|---|---|---|---|---|---|---|
| cleric | 221 | 65 | 114 | 0 | 0.773 | 0.285 |
| mage | 248 | 45 | 107 | 0 | 0.846 | 0.268 |
| shadowpriest | 247 | 67 | 86 | 0 | 0.787 | 0.215 |
| spellblade | 310 | 67 | 23 | 0 | 0.822 | 0.058 |
| thief | 263 | 68 | 69 | 0 | 0.795 | 0.172 |
| warrior | 306 | 60 | 34 | 0 | 0.836 | 0.085 |

The first 20 per-duel `(outcome, winner)` pairs per class (transcribed from `gate.trace.json`) match.

## Performance (local wall time)
`pnpm sim duel --n 10000 --seed perf`: `elapsed_ms=5393` on stderr (about 6.3 s wall including pnpm/tsx start). Limit: 60 s CI budget (test) and 20 s local stop gate; well inside both. `perf.test.ts` asserts exit 0, wall <= 60 000 ms, both section headers and the pinned total line.

## Full pipeline (worktree, real exit codes)
- `pnpm install --frozen-lockfile` 0; `pnpm lint` 0; `pnpm lint:purity` 0 (`core purity rules active (18 cases)`); `pnpm format:check` 0; `pnpm typecheck` 0; `pnpm test` 0 (**28 files, 913 tests passed**); `pnpm build` 0 (content valid, client bundle built).
- Fresh-process imports: `tsx -e 'import "./packages/core/src/ai/index.ts"'` and sim `import * as a from "@usurpia/core/ai"` both 0 (no `ReferenceError`; the rules/serialize cycle guard holds).
- Every `> verification:` grep/sim line of Tasks 1-2 exits as required.

## Mutation proof
Throwaway harness `/tmp/usurpia-scratch/02-05/mutate.py` deleted or neutralised each check in turn, ran the owning test file, recorded the failing tests and restored the source. Every mutation failed only its own dedicated test(s):
- `decideCombat` guards (`ai.test.ts`): `prompt === null` (3 tests: no private state, no prompt, spectator), `pending === null` (1), `pending.kind` (1), `pending.id` (1), already-committed (2: crafted view + real commit), no-combat/viewer-not-seated (1).
- Sim usage checks (`cli.test.ts` duel usage cases): difficulty more than two parts (1), first difficulty unknown (2), second difficulty unknown (1), integer regex (2: `1e3`, `0x10`), not-safe-integer (4), min (2), max (1), flag value missing (3), flag value that is itself a flag (1: `--seed --json`), unknown argument (2), matchup part count (1), unknown class A (1).
- `buildMatchups` unknown monster and unknown class B are caught by `duel.test.ts` (`buildMatchups` rejects unknown names, 1 test each); through the CLI they are masked because `runDuel` throws `UsageError` for an unknown monster and `createGame` would fail, so the unit test is the proof.
- First pass survivors that led to new cases: `--n 1e3` / `--n 0x10` (regex), `--seed --json` (flag value guard), `--matchup warrior:mage:thief` (part count). All closed; a re-run of those mutations shows each now fails its test.

## Decisions
- `decideCombat` guards are written as separate early returns so each can be mutated independently. A viewer that is not a seated combat side, or a view with `combat === null`, also returns `{action: null, ai}` (defensive; not in the spec's list, no golden affected). `combatPolicy` throws `Error` when the viewer has no combat prompt.
- `--json` matchup entries use `a` = class id and `b` = class id or `monster/<id>` (the text label), and omit matchups with `n = 0` (spec left the exact shape open).
- `runDuel` gives the AI for an absent side `b` (monster duels) a `normal` placeholder that is never used.
- The eslint isolation objects repeat `CORE_IMPORT_RESTRICTIONS.paths`/`patterns` because a later flat-config object replaces the rule options. `no-restricted-properties` for `ai/` re-lists `Math.random` next to `exp`/`log`/`pow`.
- `duel.test.ts` wraps `reduce`/`createGame` with a partial `vi.mock("@usurpia/core")` to observe seating, `setCharacter` actions and `CharacterSet` events without exporting extra API from `duel.ts`.
- Sim tests that spawn the CLI (usage cases, stdout goldens, perf) take about 26 s for `packages/sim`; the whole suite about 29 s.

## Deviations
None from the plan's contracts. Notes: `packages/sim/src/index.ts` does not export `UsageError`/`buildMatchups` (internal, per the plan's export list). The CLI keeps the Phase 1 `error: ` prefix for replay errors, so the mismatch line is `error: rules mismatch: file 7433ea8b, current 84a995db` (function-level message has no prefix).

## Pre-existing / notes
None found. Not touched: 02-04-owned files, `.planning/reference/`, `.planning/specs/`.

## W3 closing step
Run on `dev` in the main checkout after both W3 merges (HEAD before the step: 6f114e3, clean tree).

- **Pins added:** 120 per-duel `(events, hash)` pairs (first 20 duels x 6 classes) in `packages/sim/test/gate.test.ts`, transcribed mechanically from `traces/gate.trace.json` `events`/`hash` (rewards-on), each cross-checked against the existing `(outcome, winner)` pin during transcription. The `eventsPreRewards`/`hashPreRewards` values are not used (`552fa6cf` absent). All 120 pass on the first run: no mismatch, no localisation needed (cleric j0 `31`/`4a4be739`, warrior j0 `48`/`058ba6df` included).
- **Composite golden rerun:** `pnpm vitest run packages/core/test/combat-golden.test.ts packages/core/test/rewards-golden.test.ts packages/core/test/replay.test.ts packages/sim` -> 9 files, 138 tests, exit 0. `pnpm sim replay packages/sim/fixtures/combat-game.json` -> `hash=0483c0fa rules=84a995db turn=1 events=95 rejections=0`, exit 0. No reward-independent golden changed (combat `ec0c3508`, kernel `9616698e`, fixture `0483c0fa`, stdout blocks, gate counts, `(outcome, winner)` pins, perf total line, NPC spot stats, AI goldens).
- **Full pipeline (real exit codes, all 0):** `pnpm install --frozen-lockfile` (up to date), `pnpm lint`, `pnpm lint:purity` (`core purity rules active (18 cases)`), `pnpm format:check` (all files formatted), `pnpm typecheck`, `pnpm test` (33 files, 1187 tests), `pnpm build` (client + content valid), `pnpm sim duel --n 264 --seed ci` (`total n=264 a=154 b=57 draw=51 fled=2`), `grep -q rulesHash README.md`.
- **Perf on the merged state:** `pnpm sim duel --n 10000 --seed perf` `elapsed_ms=5539`, about 6.5 s wall including pnpm/tsx start (limits 60 s CI test, 20 s local).
- **Reference oracle:** `.planning/reference/phase-02/` is frozen from this commit on (02-CONTEXT *Golden maintenance after Phase 2*). Never edited here. From Phase 3 the reviewed TS engine is the oracle; rule/content changes re-pin goldens in the same commit, and the balance gate becomes thresholds.
- **Final Phase 2 state:** 1187 tests green on `dev`, rulesHash `84a995db`. "Pipeline green on dev" in CI is recorded by the orchestrator after the push.

### ROADMAP Phase 2 success criteria to evidence
1. Resolution matrix 3x3 incl. Strike reflection and failed Counter: `packages/core/test/resolve.test.ts`, `combat-flow.test.ts`, `combat-golden.test.ts`.
2. 4 base classes, mastery passives ranks 1-5, hybrid unlock: `stats.test.ts`, `progression.test.ts`, `rewards.test.ts`, `rewards-golden.test.ts`, content `build-rules.test.ts`.
3. Gear, spell slots, field-spell scrolls, class-sized bags, overflow on class switch: `inventory.test.ts`, `loadout.test.ts`.
4. 20 NPC definitions (16 zone monsters, 3 guardians, Crown Enforcer) with tiered curves: `packages/content/test/data.test.ts`, `validate.test.ts`, `packages/sim/test/content-stats.test.ts`, `packages/core/test/npc.test.ts`.
5. `pnpm sim duel --n 10000` reports class-vs-class and class-vs-monster rates: `packages/sim/test/perf.test.ts`, `cli.test.ts`; command run above (exit 0).
6. Combat CPU Easy/Normal/Hard headless, Hard >= 70% in mirrors: `packages/core/test/ai.test.ts`, `ai-hidden.test.ts`, `packages/sim/test/gate.test.ts` (exact counts, D1 thresholds, 120 per-duel pins).
