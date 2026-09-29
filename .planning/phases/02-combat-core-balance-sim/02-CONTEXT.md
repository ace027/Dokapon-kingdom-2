# Phase 2: Combat Core & Balance Sim -- Context

## Phase Goal
The complete combat system, classes, progression, items/spells and monsters in `core`/`content`, validated headlessly by a balance simulator (ROADMAP Phase 2).

**The authoritative contract source is the spec:** `.planning/specs/02-combat-core-balance-sim-spec.md` (Revision 2, critiqued; `node .planning/reference/phase-02/verify-spec.mjs` reports 56 passed, 0 failed). All of the following are binding for every plan in this phase:
- API/type contracts
- transition semantics
- the reject precedence and the validation-message table
- `computeCell` / `resolveExchange` / the combat flow state machine and RNG draw order
- the content data tables
- the AI algorithm
- the sim CLI/report contracts
- the failure modes
- the acceptance checks
- the goldens

Plans point to spec sections **by heading**, for example *`combat/resolve.ts` — damage math*. They do not re-derive contracts.

## Requirements Covered
`.planning/REQUIREMENTS.md` does not exist. Requirement text comes from PROJECT.md, and the acceptance criteria come from the spec's *Requirements* table.
- **R5:** six stats (HP/ATK/DEF/MAG/SPD/LUCK); 4 base classes (Warrior, Thief, Mage, Cleric); character level plus per-class mastery (ranks 1–5 with passives); hybrid unlocks at rank 3 in two classes (Spellblade, Shadowpriest).
  - Acceptance: sheet-stat goldens; rank thresholds `[0,3,7,12,18]` wins; passives of ranks ≤ the current rank are active; hybrid unlock happens exactly when both parents reach rank 3; the portable rank-5 passive is active only outside its own class; content `data.test.ts` pins every class and passive.
- **R6:** asymmetric combat. The attacker picks Attack/Strike/Spell and the defender picks Guard/Counter/Ward, resolved with the resolution matrix, SPD initiative, ≤ 3 rounds, and flee. The Ward command works with the equipped Ward Spell; with no ward spell, Spell×Ward uses the Guard multiplier (D2).
  - Acceptance: `resolve.test.ts` pins every matrix cell; `combat-flow.test.ts` pins the state machine; `combat-golden.test.ts` pins the `ec0c3508` replay.
- **R7:** gear (Weapon/Shield/Accessory), Battle Spell + Ward Spell slots, ≤ 3 field-spell scrolls, a class-sized bag, ~12 consumables, ~15 gear, 8 battle, 4 ward and 8 field spells.
  - Acceptance: `inventory.test.ts` / `loadout.test.ts`, and content counts in `data.test.ts`.
- **R8:** ~20 "monsters with day jobs" across 4 tiers, 3 guardian archetypes, the Crown Enforcer, and weighted command tables. **Satisfied as 20 NPC definitions:** 16 zone monsters (4 per zone/tier) + 3 town guardians + the Crown Enforcer, plus data-only Senior variants (tier + 1).
  - Acceptance: `npc.test.ts` pins the tier curves and the seeded command draws.
- **R9:** a headless balance simulator CLI reporting win rates (game length and assets arrive in Phase 3).
  - Acceptance: `perf.test.ts` (10 000 duels ≤ 60 s, pinned total line); `gate.test.ts` (Hard ≥ 70% of decisive duels **and** ≤ 40% draws in every mirror, exact counts).
- **R14 (combat half only):** Easy/Normal/Hard combat CPU using expected value plus opponent modelling, never reading hidden information. The board/persona half is Phase 3.
- **R2/R3 carry-over:** the kernel moves to v2 (`reduce(state, action, rules)`, generic per-player decisions, schema v2, full `deserialize(json, rules)`). All Phase 1 guarantees stay tested:
  - determinism
  - no mutation
  - rejection identity
  - split replay
  - structural redaction
  - canonicalize-once
  - `ownGet`

## What Already Exists (from prior phases)
Phase 1 is complete. Review accepted 2026-09-26 (see `01-REVIEW.md`); **263 tests**; CI green on `dev` (run 36261733021 on `1f24e28`).
- **Monorepo:**
  - pnpm 10.33.0; Node ≥ 22.13 (`.nvmrc` 22.22)
  - TypeScript ~6.0.3, with one composite tsconfig per package (`outDir .tsbuild`, `tsc -b`)
  - Vitest 5 projects (`vitest.config.ts`). The core project runs with `execArgv: ["--disallow-code-generation-from-strings"]`, and core tests call `usePurityTraps()` from `packages/core/test/purity-traps.ts`.
  - ESLint 10 + typescript-eslint 8.70.1. `restrict-template-expressions` allows numbers. `noInlineConfig` is on for `packages/core/src/**`, so no eslint-disable comments are possible there. Core purity rules ban `Date`, `Math.random`, `Intl`, `Reflect`, `.constructor`, `localeCompare`, `import()`, `node:*` and cross-package imports.
  - Prettier; `scripts/check-core-purity.mjs` (`pnpm lint:purity`, 11-case probe).
- **Root scripts:** `lint`, `lint:purity`, `format`, `format:check`, `typecheck` (`tsc -b`), `test` (`vitest run`), `build`, `sim` (`tsx packages/sim/src/cli.ts`), `validate:content`. Packages have **no** `test`/`typecheck` scripts, so every package-scoped check in these plans uses `pnpm vitest run packages/<pkg>…` and `pnpm exec tsc -b packages/<pkg>`.
- **`@usurpia/core` (v1 kernel):**
  - `types.ts`, `rng.ts` (sfc32/cyrb128), `hash.ts` (fnv1a32), `serialize.ts` (`stableStringify`, full v1 `deserialize`), `actions.ts`, `events.ts`, `handlers.ts` (sample + decision), `reducer.ts` (canonicalize-once precedence), `validation.ts`, `game.ts`, `replay.ts`, `views.ts`, `index.ts`
  - tests `arbitraries`, `counter-bounds`, `decision`, `game`, `purity`, `reducer`, `replay`, `rng`, `serialize`, `views`
- **`@usurpia/content`:** `items.json` only; zod 4 `ItemsFileSchema`; `validateContent`; `loadContentDir` (`src/load.ts`, Node-only, not exported from `index.ts`); the CLI build gate `scripts/validate.ts` (exit 0/1/2, `USURPIA_CONTENT_DIR`); fixtures `test/fixtures/{valid,invalid}`.
- **`@usurpia/sim`:** `pnpm sim replay <file>` (`{settings, actions}` v1 file, exit 2 on errors), with `fixtures/sample-game.json`.
- **`@usurpia/client`:** a Vite text shell (`main.ts`, `render.ts`).
- **CI:** `.github/workflows/ci.yml` runs install → lint → lint:purity → format:check → typecheck → test → build on push/PR to `dev`/`main`.
- **Golden oracle:** `.planning/reference/phase-02/` holds the reference JS that computed every golden:
  - `verify-spec.mjs`, `gen-goldens.mjs`
  - `traces/{kernel-game,combat-golden,rewards-golden,combat-game,gate}.trace.json`
  - It is excluded from eslint (`ignores: ".planning/**"`), prettier (`.prettierignore: .planning/`), tsc (root `files: []`) and vitest (`projects: packages/*`).
  - **No plan edits it; no committed test reads it.**
- **Memory to honour:** PIT-001 (single-mutation negative tests), PIT-002 (`Object.hasOwn`/`ownGet`), PRF-001 (GitHub MCP, no `gh`; used by the **orchestrator only** in Phase 2), PRF-003 (model split).

## Key Design Decisions
- **Architecture:** "Hybrid: Pragmatic-based", selected by the user on 2026-09-29. It keeps Phase 1's handler-map reducer and partitions, splits handlers into `handlers/{shared,decision,combat,system,loadout,index}.ts`, and puts pure combat math in `combat/*`.
- **Phase 1 Open Question 5, all four bound in the spec's *Key Decisions*:**
  1. **Content injection:** `reduce(state, action, rules: Rules)`. `Rules` is data-only (no functions, no display text) and is never stored in state. Replay/sim files record `rulesHash`.
  2. **Generic decisions:** `public.pending {id, kind, required, committed}`; per-player `private[p].prompt {decisionId, options, default}`; `hidden.decision {id, choices}`; the `decision/open` system action (kind `poll`); timeout fills each player's **own** default.
  3. **Sample removal:** `sample/*`, `counter`, `lastRoll`, `note` and the A/B/C alphabet are deleted; `SCHEMA_VERSION` 1 → 2.
  4. **CPU RNG:** the AI has its own `RngState`, seeded `seedRng(seed + "\u0000ai\u0000" + playerId + "\u0000" + difficulty)`. It reads only `PlayerView` + `Rules` and returns an `Action`.
- **User decision D1 (gate):** in **every** class mirror, `hardWins / (hardWins + easyWins) ≥ 0.70` **and** `draws / 400 ≤ 0.40`, with the exact counts pinned. Revision 2 retuned the content so the minimum rate is 0.773 and the maximum draw rate is 0.285.
- **User decision D2 (Ward without a ward spell):** the Ward command is always offered. With no ward spell equipped, Spell×Ward uses the **Guard multiplier** (`matrix.spell.guard`). Barrier (`valueBp 0`) is the 0.4× baseline, and the Ward command still blocks spell side effects.
- **Spec critique:** verdict CAUTION, then revised (Revision 2.1–2.14). `verify-spec` passes 56/56. The critique's outcomes that shape these plans:
  - 02-01 was split into 02-01a/02-01b.
  - A W3 closing step was added.
  - A committed golden oracle with per-action traces.
  - `CHOICE_PATTERN` is `{0,63}`.
  - The `expNeg` softmax (engine-independent AI goldens).
  - The Ogre hook fix, plus the "npc sheet-stat hooks are not applied" content rule.
  - An automated perf test.
  - A README update.
- **20 NPC definitions reconciliation:** the roadmap's "~20 monsters" = 16 zone monsters + 3 guardians + 1 Crown Enforcer. The ROADMAP was already updated by the orchestrator (6 plans; the 20-NPC note).
- **Golden discipline (binding):**
  - Goldens come from the spec (computed by the oracle). Executors never "record" a golden from their own implementation.
  - On a mismatch, follow the spec's *Mismatch localisation protocol*:
    1. Replay per action with a throwaway, uncommitted script or `it.only`. Throwaway scripts live **outside** the checkout/worktree, in `/tmp/usurpia-scratch/<plan>/` (import sources by absolute path, e.g. `/home/user/usurpia-wt/02-03/packages/core/src/index.ts`, and run them with `pnpm exec tsx <script>` from the checkout root), so every `git status --porcelain` check stays clean. An `it.only` is reverted before the next verification run.
    2. Diff `hashState` + events against `traces/*.trace.json`.
    3. Find the first diverging step.
    4. Fix against the spec prose.
  - If it cannot be reconciled, emit `BLOCKED` naming the first diverging action index and field.
- **Model split (PRF-003):**
  - All agents run on `sonnet` (Sonnet 5.5): executors, fix agents, planning, critique, review and checks (memory PRF-006, supersedes PRF-003). No automatic escalation to Opus; if a plan fails twice on complexity, the orchestrator stops and asks the user.
- **Agents:**
  - `engineering-senior-developer` for kernel, content, progression and inventory work.
  - `engineering-backend-architect` for the combat engine (state machine and integer math, 02-03).
  - `engineering-ai-engineer` for the CPU AI and balance sim (02-05).
  - `testing-qa-verification-specialist` on every plan (the mandatory testing role: goldens, property suites, mutation proofs).

### Wave rationale
Wave names vs plan frontmatter `wave:` numbers: **W1a** = `wave: 1` (02-01a), **W1b** = `wave: 2` (02-01b), **W2** = `wave: 3` (02-02 ∥ 02-03), **W3** = `wave: 4` (02-04 ∥ 02-05).
- **W1a 02-01a → W1b 02-01b (sequential).** The cross-cutting kernel change is too large for one plan. 02-01a changes the data model and threads `Rules`, leaving an action-less kernel. 02-01b adds the behaviour (decisions), persistence (`deserialize` v2), `views.counts` and the property suite; it may also fix 02-01a's `reducer.ts`/`index.ts` (sequential, so safe). Both run in the main checkout on `dev` and run the full repo pipeline.
- **W2 02-02 ∥ 02-03.** Content (`packages/content/**` + `content/package.json`) and the combat engine (`packages/core/**`, including `handlers/decision.ts`, which 02-03 owns in W2) share no files.
- **W3 02-04 ∥ 02-05 (tasks 1–2).**
  - 02-04 owns `core/src/{progression,inventory,index,actions,events}.ts`, `handlers/{combat,loadout,index}.ts` and the core suites (`arbitraries`, `counter-bounds`, `views`).
  - 02-05 owns `core/src/ai/**`, `core/package.json`, `eslint.config.js`, `scripts/check-core-purity.mjs`, `.gitignore`, `packages/sim/**`, `ci.yml` and `README.md`.
- **Parallel-plan rules:** same-wave plans run in **separate git worktrees** (see *Wave execution protocol*), so each executor sees only `dev` + its own edits. Executors may and must run the full repo pipeline inside their own worktree. `files_forbidden` still lists the sibling's owned files as a safety net; disjointness is what makes the orchestrator's merges clean.

### Wave execution protocol (orchestrator-owned)
Executors never push, never use GitHub MCP, and never touch another worktree or (for W2/W3 plans) the main checkout `/home/user/Dokapon-kingdom-2`. The orchestrator does every step below.

**Sequential plans (02-01a, 02-01b).** They run in the main checkout on `dev` and commit on `dev` without pushing. After each one reports Complete, the orchestrator:
1. pushes `dev` (`git push -u origin dev`, retrying network failures up to 4 times with 2/4/8/16 s backoff);
2. verifies CI through GitHub MCP (PRF-001): `mcp__github__actions_list` (owner `ace027`, repo `Dokapon-kingdom-2`, branch `dev`) → the `CI` run whose `head_sha` equals the pushed HEAD → poll `mcp__github__actions_get` until it completes with `conclusion: success`; on failure, read `mcp__github__get_job_logs` and re-dispatch a fix to the plan's executor (which commits on `dev`, no push), then push and re-check;
3. records the run URL (`https://github.com/ace027/Dokapon-kingdom-2/actions/runs/<id>`) in its own build log / STATE update (not in a plan SUMMARY). Proving CI after W1a surfaces environment issues early.

**Parallel waves (W2: 02-02 ∥ 02-03; W3: 02-04 ∥ 02-05 tasks 1–2).**
1. **Create worktrees** from the current `dev` HEAD (main checkout clean, `dev` pushed and CI green), one per plan:
   - W2: `git worktree add ../usurpia-wt/02-02 -b phase2/02-02 dev` and `git worktree add ../usurpia-wt/02-03 -b phase2/02-03 dev`
   - W3: `git worktree add ../usurpia-wt/02-04 -b phase2/02-04 dev` and `git worktree add ../usurpia-wt/02-05 -b phase2/02-05 dev`
   - (run from `/home/user/Dokapon-kingdom-2`; the absolute paths are `/home/user/usurpia-wt/<plan>`).
2. **Install** in each worktree: `cd /home/user/usurpia-wt/<plan> && (pnpm install --frozen-lockfile --offline || pnpm install --frozen-lockfile)`.
3. **Dispatch** both executors in parallel, each told its absolute worktree path and branch. Every executor command `cd`s into its worktree; every `> verification:` line is run from the worktree root (relative paths). Executors commit on their own branch (`phase2/<plan>`), never on `dev`.
4. **Merge** after both plans report Complete, in the main checkout on `dev`, in plan order:
   - W2: `git merge --no-ff phase2/02-02`, then `git merge --no-ff phase2/02-03`
   - W3: `git merge --no-ff phase2/02-04`, then `git merge --no-ff phase2/02-05`
   - Files are disjoint, so merges are clean. **If any conflict appears, `git merge --abort` and stop: escalate to the user.** Never resolve a conflict by hand.
5. **Gate on `dev`:** run the full pipeline in the main checkout (`pnpm install --frozen-lockfile && pnpm lint && pnpm lint:purity && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`). A failure here (an integration issue neither worktree could see) is escalated / re-dispatched as a fix plan; never pushed red.
6. **Push + CI** exactly as for sequential plans (steps 1–3 above).
7. **Remove the worktrees:** `git worktree remove ../usurpia-wt/<plan>` for both, then `git branch -d phase2/<plan>` (merged, so `-d` succeeds).
- After W3's merge + green gate + push, the orchestrator dispatches **02-05 task 3** (the W3 closing step) in the main checkout on `dev`, then runs the full pipeline again, pushes, and verifies CI (the final Phase 2 CI proof).
- If a plan in a parallel wave fails and must be re-run, its worktree is reset from the plan branch; the sibling's worktree is untouched.

### W3 closing-step rule
Rewards (02-04) append `VictoryRewarded`/`LevelUp`/`MasteryRankUp` after `CombatEnded` for player KO wins. That changes `DuelResult.events`/`hash` but never `outcome`/`winner`/`fled`. Therefore:
- 02-05 tasks 1–2 (in worktree `phase2/02-05`, without 02-04's code) pin **only reward-independent goldens**: stdout blocks, gate counts, per-duel `(outcome, winner)`, the sim fixture line, content NPC spot stats and the perf total line.
- 02-05 task 3 is a **post-merge task on `dev` in the main checkout**. Its precondition is that `git log dev` contains the merge commits of both `phase2/02-04` and `phase2/02-05` and the orchestrator's post-merge full pipeline was green. It:
  1. adds the per-duel `(events, hash)` pins from `traces/gate.trace.json` (the `events`/`hash` fields, not the `…PreRewards` pair);
  2. reruns every composite golden and the full pipeline;
  3. commits on `dev` (no push; the orchestrator pushes and proves CI).
- Any change to a reward-independent golden at that point is a bug: stop and escalate.
- W3, and Phase 2 execution, is complete only after this commit is pushed and CI is green.

### Golden maintenance after Phase 2 (user decision: "TS engine becomes the oracle")
- The reference implementation `.planning/reference/phase-02/` is the golden oracle **only until the 02-05 closing step (task 3) commits**. After that it is **frozen**: kept in the repository for history, never regenerated, never edited, and no longer authoritative.
- From Phase 3 on, the reviewed TypeScript engine is the oracle. A phase that changes content or rules re-pins the affected exact goldens (hashes, event counts, stdout blocks, gate counts) from the engine's own output (`pnpm sim …` / test output) **in the same commit that changes the rules**, and the golden diff is reviewed as part of that change.
- Once rules change, the balance gate (Hard ≥ 70% of decisive duels and ≤ 40% draws in every mirror, D1) is asserted as **thresholds**, not exact counts.
- Phase 2 itself still pins the exact values from the reference; "never record a golden from your implementation" stays binding for every Phase 2 plan.

### Known Phase 3+ inputs (notes only; no Phase 2 work)
- `decision/open` / prompt caps (≤ 8 options per prompt, 1–4 prompts) are sized for combat and polls; board movement will likely need a larger option cap.
- `public.choiceHistory` is pooled per player across all opponents (not per opponent pair); Phase 3 board AI/personas may want per-opponent memory.
- Saves carry no `rulesHash`; Phase 4 persistence needs a save wrapper `{rulesHash, state}` (as replay files already do).

## Plan Structure
- **Plan 02-01a (Wave 1): Kernel v2 data model and Rules threading.**
  - the `Rules` contract + `TEST_RULES` + stats (`7433ea8b`, sheet/NPC stat goldens)
  - GameState v2 + `reduce(state, action, rules)` with an empty action union + `createGame` golden `758ef72c`
  - the sample module deleted
  - sim/client compile shims (`kernel-rules.ts`, `demo-rules.ts`), a v2 replay file with `rulesHash` / exit 3, workspace links, README
  - full pipeline
- **Plan 02-01b (Wave 2): Generic decisions, deserialize v2, views counts, property suite.**
  - `handlers/decision.ts` (poll/commit/timeout/reveal + resolver dispatch)
  - the full `deserialize(json, rules)` (combat rejected)
  - `viewFor.counts`
  - the v2 property suite (≥ 200 runs)
  - the kernel fixture `9616698e`, sim `cli.test.ts`, the client demo decision
  - full pipeline
- **Plan 02-02 (Wave 3): Content (schemas, data, buildRules).**
  - six zod-validated data files
  - `buildRules` / `validateContent` / `loadRules`
  - `rulesHash(loadRules()) = 84a995db`
  - counts, cross-ref messages
  - worktree `/home/user/usurpia-wt/02-02`, branch `phase2/02-02`; full pipeline in the worktree
- **Plan 02-03 (Wave 3): Combat engine (resolve → flow → golden).**
  - pure `computeCell` / `resolveExchange` with the matrix + variant goldens
  - the combat state machine (`combat/start`, `system/setCharacter`, the exchange resolver, deserialize check 8); owns `handlers/decision.ts` in W2 (reveal logic)
  - the combat golden `ec0c3508`
  - worktree `/home/user/usurpia-wt/02-03`, branch `phase2/02-03`; full pipeline in the worktree
- **Plan 02-04 (Wave 4): Progression + inventory.**
  - XP/levels/mastery/hybrids/portable + the reward hook
  - inventory helpers + `system/grant` / `loadout/*` handlers
  - the rewards golden `57da3ea4`
  - worktree `/home/user/usurpia-wt/02-04`, branch `phase2/02-04`; full pipeline in the worktree
- **Plan 02-05 (Wave 4): CPU AI + balance sim (+ W3 closing step).**
  - `@usurpia/core/ai` (Easy/Normal/Hard, `expNeg`) with lint isolation + purity probes
  - `pnpm sim duel`, the report, kits, the fixture `0483c0fa`, gate counts, the perf test, the CI smoke step
  - tasks 1–2 in worktree `/home/user/usurpia-wt/02-05`, branch `phase2/02-05`
  - task 3: the W3 closing step, post-merge on `dev` in the main checkout (reward-dependent gate pins, composite goldens, full pipeline, commit; the orchestrator pushes and proves CI)

## Pinned values summary
| Golden | Value | Plan / task |
|---|---|---|
| `rulesHash(TEST_RULES)` | `7433ea8b` | 02-01a T1 (`rules.test.ts`); also sim `kernel-rules.ts` and client `demo-rules.ts` copies (02-01a T3) |
| `createGame(fixture settings, TEST_RULES)` | `hashState 758ef72c` + the spec's canonical JSON | 02-01a T2 (`game.test.ts`) |
| Empty replay file (W1a) | `hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=0` | 02-01a T3 (`replay-file.test.ts`) |
| Kernel poll replay | `9616698e`, 10 events, rejections `[{2, ALREADY_COMMITTED}, {5, INVALID_PAYLOAD}]`; sim line `hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2` | 02-01b T3 |
| Sheet/NPC stats (TEST_RULES) | spec table in *`combat/passives.ts` + `combat/stats.ts`* | 02-01a T1 (`stats.test.ts`) |
| Damage matrix + 23 variant rows | spec *Golden matrix (`resolve.test.ts`)* | 02-03 T1 |
| Combat golden replay | `ec0c3508`, 18 actions, 0 rejections, 80 events, final rng `[3200512360,239253250,3363130012,583700052]` | 02-03 T3 |
| `rulesHash(loadRules())` | `84a995db` | 02-02 T3 (`data.test.ts`) |
| Rewards/loadout replay | `57da3ea4`, 25 actions, 0 rejections, 84 events | 02-04 T3 |
| Sim combat fixture | `hash=0483c0fa rules=84a995db turn=1 events=95 rejections=0` | 02-05 T2 |
| AI policy weights / rng / `expNeg` | spec *AI goldens* | 02-05 T1 |
| Sim mirrors stdout | `total n=60 a=42 b=8 draw=10 fled=0` (the full block in the spec) | 02-05 T2 |
| Classes total | `total n=36 a=14 b=11 draw=11 fled=0` | 02-05 T2 |
| CI smoke total | `total n=264 a=154 b=57 draw=51 fled=2` | 02-05 T2 |
| Perf total (10 000 duels, ≤ 60 s) | `total n=10000 a=5411 b=2370 draw=2118 fled=101` | 02-05 T2 |
| Content NPC spot stats | ogre `218/63/33/42/17/9`; senior slime-intern `76/24/12/17/10/4`; lich t1 `104/24/15/27/13/6`; enforcer L10 `108/49/28/31/19/14` | 02-05 T2 (`content-stats.test.ts`) |
| Gate per-duel `(outcome, winner)`, first 20 per class | `traces/gate.trace.json` | 02-05 T2 |
| Gate per-duel `(events, hash)`, first 20 per class | `traces/gate.trace.json` `events`/`hash` (e.g. cleric j0 `31`/`4a4be739`) | 02-05 **T3** |

Gate counts (asserted exactly; 400 duels per class, level 5):

| class | hardWins | easyWins | draws | fled | Hard-decisive rate | draw rate |
|---|---|---|---|---|---|---|
| cleric | 221 | 65 | 114 | 0 | 0.773 | 0.285 |
| mage | 248 | 45 | 107 | 0 | 0.846 | 0.268 |
| shadowpriest | 247 | 67 | 86 | 0 | 0.787 | 0.215 |
| spellblade | 310 | 67 | 23 | 0 | 0.822 | 0.058 |
| thief | 263 | 68 | 69 | 0 | 0.795 | 0.172 |
| warrior | 306 | 60 | 34 | 0 | 0.836 | 0.085 |

Oracle trace endpoints (`initialHash → finalHash`, steps):
- kernel-game `758ef72c → 9616698e` (7)
- combat-golden `a53e747c → ec0c3508` (18)
- rewards-golden `8823afb2 → 57da3ea4` (25)
- combat-game `8110a5ee → 0483c0fa` (23)

## Conventions for every plan
- Each plan owns `.planning/phases/02-combat-core-balance-sim/02-XX-SUMMARY.md` (in its `files_modified`).
- No plan edits these: `.planning/specs/`, `.planning/reference/`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/memory/`, `.planning/phases/01-foundations-deterministic-engine/`.
- Every plan ends with a commit: on `dev` for 02-01a, 02-01b and 02-05 task 3 (main checkout); on the plan's own branch `phase2/02-0X` for 02-02, 02-03, 02-04 and 02-05 tasks 1–2 (worktree):
  - message `Phase 2 plan 02-XX: <plan name>`, ending with the attribution trailer lines provided in the execution prompt;
  - verify with `git show --name-only --format= HEAD` that no `.tsbuild/`, `dist/` or `node_modules/` path is committed.
  - **No executor pushes or uses GitHub MCP.** The orchestrator pushes and proves CI after 02-01a, after 02-01b, after each wave merge, and after the closing step (*Wave execution protocol*).
- **Import-cycle guard:** `rules.ts` ↔ `serialize.ts` form an import cycle (`rulesHash` needs `stableStringify`; `deserialize` needs `levelForXp`/`masteryRank`/`sheetStats`). Neither module may use the other's values at module top level (only inside function bodies). Plans touching them verify fresh-process imports with `pnpm exec tsx --input-type=module -e 'import "./packages/core/src/<entry>.ts"'` per entry point and `pnpm --filter @usurpia/sim exec tsx --input-type=module -e 'import * as c from "@usurpia/core"; …'` (no `ReferenceError`).
- **Negative tests (PIT-001):** built from a known-valid fixture with exactly one mutation, asserting the exact code **and** message. For every new validation check group, a mutation proof is recorded in the SUMMARY: temporarily delete (or invert) each check, confirm that only its own test(s) fail, then restore.
- **Id-keyed records (PIT-002):** every record keyed by a player id **or content id** is read with `Object.hasOwn`/`ownGet`. Arbitraries and negative tests include prototype-member ids (`toString`, `valueOf`, `hasOwnProperty` for players; `toString`, `valueOf`, `constructor`, `__proto__` as raw content-id strings in actions and saves).
- **Verification lines** are deterministic and exit 0 on success. Negative checks assert an exact exit code (`…; test $? -eq 1`), and greps use specific patterns.
