---
phase: 02-combat-core-balance-sim
plan: 01b
type: execute
wave: 2
depends_on: ["02-01a"]
files_modified:
  - packages/core/src/handlers/decision.ts
  - packages/core/src/handlers/index.ts
  - packages/core/src/handlers/shared.ts
  - packages/core/src/actions.ts
  - packages/core/src/events.ts
  - packages/core/src/serialize.ts
  - packages/core/src/views.ts
  - packages/core/src/reducer.ts
  - packages/core/src/index.ts
  - packages/core/test/decision.test.ts
  - packages/core/test/reducer.test.ts
  - packages/core/test/serialize.test.ts
  - packages/core/test/views.test.ts
  - packages/core/test/arbitraries.ts
  - packages/core/test/counter-bounds.test.ts
  - packages/core/test/replay.test.ts
  - packages/sim/fixtures/kernel-game.json
  - packages/sim/test/cli.test.ts
  - packages/sim/test/replay-file.test.ts
  - packages/client/src/main.ts
  - packages/client/src/render.ts
  - packages/client/test/render.test.ts
  - .planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md
files_forbidden:
  - .planning/specs/
  - .planning/reference/
  - .planning/ROADMAP.md
  - .planning/PROJECT.md
  - .planning/STATE.md
  - .planning/memory/
  - .planning/phases/01-foundations-deterministic-engine/
  - packages/core/src/rules.ts
  - packages/core/src/types.ts
  - packages/core/src/game.ts
  - packages/core/src/replay.ts
  - packages/core/src/validation.ts
  - packages/core/src/combat/
  - packages/core/src/rng.ts
  - packages/core/src/hash.ts
  - packages/core/test/fixtures/
  - packages/core/test/rules.test.ts
  - packages/core/test/stats.test.ts
  - packages/core/test/game.test.ts
  - packages/core/test/purity-traps.ts
  - packages/core/package.json
  - packages/content/
  - packages/sim/src/
  - packages/sim/package.json
  - packages/sim/tsconfig.json
  - packages/client/src/demo-rules.ts
  - packages/client/package.json
  - package.json
  - pnpm-lock.yaml
  - tsconfig.json
  - vitest.config.ts
  - eslint.config.js
  - scripts/
  - .github/
  - README.md
sequential_files: []
expected_artifacts:
  - path: "packages/core/src/handlers/decision.ts"
    provides: "decision/open (poll), decision/commit, timeout, openDecision, revealDecision with per-kind resolver dispatch"
    required: true
  - path: "packages/core/src/serialize.ts"
    provides: "Full deserialize(json, rules) v2 checks 1–8 (W1b: combat rejected)"
    required: true
  - path: "packages/core/src/views.ts"
    provides: "viewFor with per-player bag/scroll counts"
    required: true
  - path: "packages/core/test/arbitraries.ts"
    provides: "v2 fast-check arbitraries (arbSettings, arbInput, arbScript, arbGame) incl. prototype-member ids"
    required: true
  - path: "packages/core/test/replay.test.ts"
    provides: "≥ 200-run v2 property suite + kernel golden 9616698e"
    required: true
  - path: "packages/sim/fixtures/kernel-game.json"
    provides: "Kernel poll replay fixture (rulesHash 7433ea8b)"
    required: true
  - path: "packages/sim/test/cli.test.ts"
    provides: "CLI subprocess tests on temp files (exit 0/2/3)"
    required: true
  - path: ".planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md"
    provides: "Plan summary incl. mutation-proof tables"
    required: true
autonomous: false
agents: ["engineering-senior-developer", "testing-qa-verification-specialist"]
requirements: [R3]
user_setup: []
verification_commands:
  - "pnpm install --frozen-lockfile"
  - "pnpm lint"
  - "pnpm lint:purity"
  - "pnpm format:check"
  - "pnpm typecheck"
  - "pnpm test"
  - "pnpm build"
  - "pnpm sim replay packages/sim/fixtures/kernel-game.json | grep -qx 'hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2'"
  - "grep -q '9616698e' packages/core/test/replay.test.ts"
  - "grep -c 'numRuns: 200' packages/core/test/replay.test.ts | xargs test 6 -le"
  - "grep -rnE 'sample/|setSecret|lastRoll|defaultChoice|sample-game|\\{ settings, actions \\}' packages/*/src packages/*/test packages/sim/fixtures README.md; test $? -eq 1"
  - "grep -q 'rulesHash' README.md"
  - "grep -q 'Mutation proof' .planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md"
  - "grep -q '^## arbitraries exports' .planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md"
  - "grep -q '^## Resolver/ResolverTable signatures' .planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/rules.ts\"'"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/serialize.ts\"'"
  - "pnpm --filter @usurpia/sim exec tsx --input-type=module -e 'import * as c from \"@usurpia/core\"; if (typeof c.deserialize !== \"function\" || typeof c.rulesHash !== \"function\") throw new Error(\"core exports missing\")'"
  - "git log -1 --format=%s | grep -q '^Phase 2 plan 02-01b:'"
  - "git show --name-only --format= HEAD | grep -E '(^|/)(\\.tsbuild|dist|node_modules)/'; test $? -eq 1"

must_haves:
  truths:
    - "A commit is accepted only when the choice is one of the committing player's own prompt options; STALE_DECISION and ALREADY_COMMITTED are checked before the options check"
    - "timeout fills each missing player's own prompt default, and ChoiceCommitted never carries the choice"
    - "Every state reduce produces passes deserialize(serialize(s), rules), and every deserialize check has a unique message proven by a single-mutation test"
    - "viewFor exposes other players' bag/scroll counts only, never their options, bag contents, scrolls or unrevealed choices"
    - "The kernel poll replay reproduces hashState 9616698e with rejections at indices 2 (ALREADY_COMMITTED) and 5 (INVALID_PAYLOAD)"
  artifacts:
    - path: "packages/core/src/handlers/decision.ts"
      provides: "Decision module"
      min_lines: 120
      contains: "openDecision"
    - path: "packages/core/src/serialize.ts"
      provides: "deserialize v2"
      min_lines: 200
      contains: "combat decisions unsupported"
    - path: "packages/core/test/serialize.test.ts"
      provides: "Single-mutation table + uniqueness meta-test"
      min_lines: 150
      contains: "deserialize: "
    - path: "packages/core/test/replay.test.ts"
      provides: "Property suite"
      min_lines: 120
      contains: "fc.assert"
  key_links:
    - from: "packages/core/src/handlers/index.ts"
      to: "packages/core/src/handlers/decision.ts"
      via: "resolver table passed into the decision handlers"
      pattern: "resolveUnsupported"
    - from: "packages/core/test/views.test.ts"
      to: "packages/core/test/arbitraries.ts"
      via: "leak property over arbitrary games"
      pattern: "arbGame"
    - from: "packages/client/src/main.ts"
      to: "packages/core/src/views.ts"
      via: "viewFor/eventsFor"
      pattern: "eventsFor\\("
---

<objective>
Give the v2 kernel its behaviour and persistence:
- the generic multi-player decision module (`decision/open` kind `poll`, `decision/commit`, `timeout`, reveal with per-kind resolver dispatch);
- the full `deserialize(json, rules)` (checks 1–8, combat still rejected);
- `viewFor.counts`;
- the Phase 1 property suite rebuilt on v2 (≥ 200 runs);
- the kernel-game replay fixture (`9616698e`);
- the sim CLI tests moved to `cli.test.ts`;
- the client demo decision.

Purpose: binding decisions OQ5b (generic decisions) and OQ5c (sample removal completed), R3 on v2. W2 plans extend these files.
Output: `packages/core/src/handlers/decision.ts`, updated `actions/events/serialize/views`, the v2 test suites, `packages/sim/fixtures/kernel-game.json`, `packages/sim/test/cli.test.ts`, the client demo.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-combat-core-balance-sim/02-CONTEXT.md
@.planning/specs/02-combat-core-balance-sim-spec.md
@.planning/phases/02-combat-core-balance-sim/02-01a-SUMMARY.md
@.planning/phases/01-foundations-deterministic-engine/01-REVIEW.md
@.planning/memory/ERRORS.md

Relevant source files:
@packages/core/src/types.ts
@packages/core/src/rules.ts
@packages/core/src/actions.ts
@packages/core/src/events.ts
@packages/core/src/reducer.ts
@packages/core/src/validation.ts
@packages/core/src/serialize.ts
@packages/core/src/views.ts
@packages/core/src/handlers/index.ts
@packages/core/src/handlers/shared.ts
@packages/core/src/combat/stats.ts
@packages/core/test/fixtures/build.ts
@packages/core/test/fixtures/test-rules.ts
@packages/core/test/reducer.test.ts
@packages/core/test/serialize.test.ts
@packages/core/test/views.test.ts
@packages/core/test/replay.test.ts
@packages/sim/src/replay-file.ts
@packages/sim/src/rules.ts
@packages/sim/src/cli.ts
@packages/sim/test/replay-file.test.ts
@packages/client/src/main.ts
@packages/client/src/render.ts
@.planning/reference/phase-02/traces/kernel-game.trace.json
</context>

<execution_contract>
Harness: read-before-write -> evidence-before-action -> minimal diff -> verify-before-report

Role: engineering-senior-developer (executor, model `sonnet`); testing-qa-verification-specialist (property suite, single-mutation tables, mutation proofs, pipeline sign-off).
Task: implement spec *Deliverables → Wave 1b — Plan 02-01b* exactly, with contracts from:
- *Transition semantics — kernel (W1b, 02-01b)*
- *`reducer.ts` — precedence and handler table* (the rows `decision/open`, `decision/commit`, `timeout`)
- *`actions.ts`* (the W1b members)
- *`events.ts`* (the decision events)
- *`serialize.ts` — `deserialize(json, rules)` v2* (checks 1–8, W1b version of check 8)
- *`views.ts`* (`counts`)
- *`@usurpia/sim`* (the kernel fixture, `cli.test.ts`)
- *`@usurpia/client`* (demo decision)
- *Failure Modes*

Requirement: R3.
Scope:
- Read targets: the spec sections above, 02-CONTEXT.md, 02-01a-SUMMARY.md (helper names in `test/fixtures/build.ts`, API list), 01-REVIEW.md, ERRORS.md, every file in `<context>`.
- Write targets: exactly `files_modified`.
- Forbidden targets: `files_forbidden`.
Allowed tools/actions:
- Edit listed files. Run any root script: this plan runs alone in its wave, in the main checkout `/home/user/Dokapon-kingdom-2` on `dev`, so the repo-wide pipeline is allowed. Run `pnpm sim replay <file>`, and `git add`/`git commit` on `dev`.
- `reducer.ts` and `index.ts` (finished by 02-01a) may be edited **only** where the now non-empty W1b action union requires it (e.g. removing 02-01a's `never` workarounds, `ACTION_TYPES` checks, exports of the new decision API); the Phase 1 precedence order and the documented single widening cast stay. Any such edit is listed under Deviations in the SUMMARY.
- Read `.planning/reference/phase-02/**` (traces) for debugging; never edit it.
Forbidden actions:
- Do not modify files outside files_modified.
- Do not add unplanned dependencies.
- Do not change public APIs, schemas, migrations, auth, CI, or deployment unless explicitly listed in this plan.
- Do not self-defer planned work.
- Do not record goldens from your implementation (`9616698e`, the event list and the rejections come from the spec). On a mismatch, diff per-action `hashState`/events against `traces/kernel-game.trace.json` (step hashes) and emit `BLOCKED` naming the first diverging action if it cannot be reconciled with the spec prose.
- Do not push and do not use GitHub MCP (the orchestrator pushes and proves CI after this plan; 02-CONTEXT *Wave execution protocol*). Do not use eslint-disable comments or impure globals in core src.
- Mismatch-localisation throwaway scripts live outside the repo in `/tmp/usurpia-scratch/02-01b/`, so `git status --porcelain` stays clean.
- **Import-cycle guard:** `serialize.ts` now imports `levelForXp`/`masteryRank` from `../rules` and `sheetStats` from `../combat/stats`, while `rules.ts` imports `stableStringify` from `./serialize`. Use those values **only inside function bodies** in `serialize.ts` (never in a module-top-level constant or table), and never add a top-level use of a `serialize` value in `rules.ts`. Verified by fresh-process `tsx` imports (Task 3).
Implementation sequence:
1. Read 02-01a-SUMMARY.md and the spec sections. Run `pnpm test` to confirm a green start.
2. Task 1: decision module, W1 action union/events, handler registration, `decision.test.ts`, `reducer.test.ts`.
3. Task 2: `deserialize` v2 + `views.counts` + their tests.
4. Task 3: arbitraries, property suite, counter bounds, kernel fixture, CLI tests, client demo; full pipeline; SUMMARY; commit.
Required interfaces/content structure:
- `actions.ts`: `Action` = the three W1b members from the spec union; `ACTION_TYPES = ["decision/open", "decision/commit", "timeout"] as const`-compatible readonly array in that order.
- `handlers/shared.ts` adds:
  - `export type Resolver = (state: GameState, choices: Readonly<Record<PlayerId, string>>, ctx: Ctx, rules: Rules, events: GameEvent[]) => GameState;`
  - `export type ResolverTable = Readonly<Record<DecisionKind, Resolver>>;`
- `handlers/decision.ts` exports:
  - `openDecision(state, kind, prompts: readonly {playerId, options, default}[], events: GameEvent[]): GameState`;
  - `revealDecision(state, timedOut: readonly PlayerId[], ctx, rules, events, resolvers): GameState`;
  - `resolvePoll: Resolver` (returns the state unchanged);
  - `resolveUnsupported: Resolver` (returns the state unchanged);
  - `decisionHandlers(resolvers: ResolverTable)`, returning the three `Handler`s (`decision/open`, `decision/commit`, `timeout`).
  - There is no mutable module-level registry.
- `handlers/index.ts`:
  ```ts
  const resolvers = { poll: resolvePoll, "combat/exchange": resolveUnsupported } satisfies ResolverTable;
  export const handlers = { ...decisionHandlers(resolvers) } satisfies HandlerMap;
  ```
  02-03 replaces `resolveUnsupported` here.
- Validation messages are exactly the quoted strings in the spec's handler table (ids clipped to 64 chars).
- `views.ts`: `PlayerView.counts` = `Object.fromEntries(players.map(p => [p, {bag: private[p].bag.length, scrolls: private[p].scrolls.length}]))` via `ownGet`, for every seated player (including the viewer). It is present for spectators too.
- `deserialize` messages: `"deserialize: <unique message>"`. Choose a unique, descriptive message per check (e.g. `deserialize: characters.p1.level does not match xp`), with ids clipped to 64 chars. W1b check 8 is:
  - `public.combat` must be `null` (`deserialize: combat must be null`);
  - a `pending.kind === "combat/exchange"` is rejected (`deserialize: combat decisions unsupported`).

  Check 3 uses `sheetStats` from `../combat/stats` and `levelForXp`/`masteryRank` from `../rules`. Prompt-vs-engine equality for poll prompts is structural only (checks 5 and 6).
- `arbitraries.ts` exports **by these exact names**:
  - `PROTO_IDS`: `["toString","valueOf","hasOwnProperty","isPrototypeOf"]`, kept from Phase 1.
  - `PLAYER_POOL`: `["p1","p2","p3","p4", ...PROTO_IDS]`.
  - `arbSettings`: 1–4 unique seats from `PLAYER_POOL`, with `classId` from `["fighter","caster"]` and seed `fc.string({minLength:1,maxLength:12})`. Bias toward 3–4 seats.
  - `arbInput`: `fc.oneof` over:
    - `decision/open` with 1–4 prompts (players from `PLAYER_POOL` plus `"ghost"`; options 1–8 tokens from a pool containing per-seat sentinel tokens `s0-a`…`s3-d`, `yes`, `no`, and one 64-char token; default from the pool);
    - `decision/commit` (players from the pool plus `"system"`, decisionIds `d1`…`d4` and `x`, choices from the token pool plus `"Bad Token"` and a 65-char token);
    - `timeout`;
    - junk (`null`, an integer, `{}`, `{v:1,…}`, a valid action with an extra key `zzz: 1`).
  - `arbInputFor(ids)`: the same generator with player ids biased toward `ids`.
  - `arbScript = fc.array(arbInput, {maxLength: 60})`.
  - `arbGame: fc.Arbitrary<[GameSettings, unknown[]]>` = `arbSettings.chain(s => fc.tuple(fc.constant(s), fc.array(arbInputFor(seatIds(s)), {maxLength: 60})))`. This keeps the Phase 1 shape, so most commits/opens target seated players.
  - 02-03/02-04 extend these arbitraries.
Edge/error cases (all tested; each negative test is a single mutation from a valid fixture, asserting the exact code and message, PIT-001):
- `decision/open` messages:
  - "prompt players must be unique"
  - "prompt player must be seated" (including `"toString"` in a game where it is not seated)
  - "prompt options must be unique"
  - "prompt default must be one of its options"
  - "decisionSeq would exceed MAX_COUNTER" (in `counter-bounds.test.ts`)
- `decision/open` shape: 0 prompts, 5 prompts, 0 options, 9 options, a 65-char option token and an extra prompt key are all `INVALID_PAYLOAD`. A 53-char option (`"item:" + 48 × "a"`) and a 64-char option are accepted, and committing each reveals it.
- `decision/commit`:
  - `STALE_DECISION` "decision <id> is not the open decision";
  - `ALREADY_COMMITTED` "<p> already committed", with the double commit reusing an **in-options** choice;
  - "choice is not one of your options", from an uncommitted player with a valid id and a token-shaped choice ∉ options, including another player's option.
- Precedence:
  - a commit in phase `turn` → `WRONG_PHASE`;
  - a player sending `decision/open`/`timeout` → `WRONG_ACTOR`;
  - a non-required seated player committing → `WRONG_ACTOR`;
  - `system` committing → `WRONG_ACTOR`;
  - `decision/open` during a decision → `WRONG_PHASE`.
- Players named `toString`/`valueOf` commit and time out correctly (their own default via `ownGet`; no inherited function is ever read).
- `deserialize`: one row per check in checks 1–8 (W1b version), each a single mutation of a **valid** base. Use three bases:
  1. `turnBase`: after the kernel poll replay;
  2. `pollBase`: mid-decision after `decision/open` + one commit;
  3. `lastRevealBase`: after a reveal with `timedOut`.

  Rows include at least:
  - an extra key and a missing key at every object level;
  - `activePlayer ∉ players`;
  - a bad phase;
  - counters out of `[0, MAX_COUNTER]`;
  - a bad rng;
  - an unknown `classId`;
  - a `toString` classId;
  - `level ≠ levelForXp(xp)`;
  - gear in the wrong slot;
  - an unknown spell;
  - `hp > sheet max`;
  - mastery keys ≠ rule class ids;
  - `portable` below rank 5;
  - `choiceHistory` with a missing command key;
  - a bag longer than `bagSize`;
  - an unknown item;
  - scrolls > `maxScrolls`;
  - prompt options with a duplicate or 25 entries;
  - default ∉ options;
  - `pending.id ≠ "d" + decisionSeq`;
  - `committed` not ⊆ `required`;
  - duplicate `committed` (with `choices` keys adjusted so only the uniqueness check fires, PIT-001 / Phase 1 cycle-3 lesson);
  - `committed.length === required.length`;
  - `choices` keys ≠ `committed`;
  - a choice ∉ options;
  - a prompt present for a non-required player;
  - a prompt `decisionId` mismatch;
  - `lastReveal.timedOut` not ⊆ choice keys;
  - `combat` non-null;
  - `pending.kind === "combat/exchange"`.

  A meta-test asserts that all row messages are unique and that each base deserializes to a deep-equal state.
Verification criteria:
- Every `> verification:` line and every `verification_commands` entry exits 0.
- **Mutation proof (PIT-001):** for each check of the three decision validation handlers and each `deserialize` check, temporarily delete the check, run the owning test file, and confirm that only that check's test(s) fail; then restore. Record the table (check → failing test name) under a `## Mutation proof` heading in the SUMMARY.
Final result format:
- Status: Complete | Partial | Failed | BLOCKED
- Files changed
- Verification commands and outputs
- Decisions made
- Issues/errors
</execution_contract>

<stop_gates>
Emit `BLOCKED` and stop instead of guessing when:
- A read target listed in `<context>` or `<execution_contract>` is missing or unreadable (a missing 02-01a-SUMMARY.md means W1a is incomplete).
- Required source evidence contradicts the plan (e.g. the kernel poll replay cannot reach `9616698e` after diffing per step against `traces/kernel-game.trace.json`).
- Completing the task requires a file not listed in `files_modified` (e.g. a change to `types.ts`, `game.ts` or `validation.ts`, which 02-01a finished).
- Any instruction conflicts with `files_forbidden`, authority boundaries, control mode, or user_setup.
- An API/type/schema/validation/architecture decision is not specified.
- A required helper, pattern, or test location is named vaguely or cannot be found.
- Verification commands are missing, non-deterministic, fail after one focused fix attempt, or cannot run in the environment.
</stop_gates>

<recovery>
After compaction, interruption, or context loss:
1. Re-read this PLAN.md, the phase CONTEXT.md, and any RESULT/SUMMARY artifact for this plan.
2. Run `git diff --stat` and inspect `git diff` for every file already changed.
3. Compare changed files against `files_modified` and `files_forbidden`; if any unapproved change exists, emit `BLOCKED`.
4. Re-run completed task verification commands before continuing.
5. Continue only from the next unverified task; do not rely on memory-only claims.
</recovery>

<tasks>

<task type="auto">
  <name>Task 1: Decision module (poll, commit, timeout, reveal + resolver dispatch)</name>
  <files>packages/core/src/handlers/decision.ts, packages/core/src/handlers/index.ts, packages/core/src/handlers/shared.ts, packages/core/src/actions.ts, packages/core/src/events.ts, packages/core/src/reducer.ts, packages/core/src/index.ts, packages/core/test/decision.test.ts, packages/core/test/reducer.test.ts</files>
  <action>
Read the spec's *Transition semantics — kernel (W1b, 02-01b)* and the three handler-table rows.

1. **`actions.ts`:** add the three W1b members exactly (exact keys `v`, `type`, `playerId` plus the payload keys) and `ACTION_TYPES` in spec order. **`events.ts`:** keep the 5 decision events, now emitted. `PromptOpened` uses `onlyPlayers([playerId])`; all others use `PUBLIC`.
2. **`handlers/shared.ts`:** add `Resolver`/`ResolverTable` (execution contract), plus the shape-guard helpers the three guards need (`isTokenArray(x, min, max)`, `hasExactKeys`).
3. **`handlers/decision.ts`:**
   - Guards exactly per the handler table's shape column.
   - `validate` checks in table order, returning the first failure with the exact message.
   - `apply`:
     - `openDecision`: `decisionSeq += 1`; `id = "d" + decisionSeq`; set `public.pending`, `hidden.decision {id, choices: {}}` and each `private[p].prompt` (options copied); `phase = "decision"`; emit `DecisionOpened`, then one `PromptOpened` per prompt in order.
     - commit: append to `committed`; store `choices[p]` (new object via `Object.fromEntries`); emit `ChoiceCommitted` with **no** `choice` key; reveal when everyone has committed.
     - timeout: emit `ChoiceTimedOut` per missing player in `required` order, then reveal with them as `timedOut`.
     - reveal:
       1. build `choices` in `required` order (committed via `ownGet`, else the player's **own** `prompt.default` via `ownGet`);
       2. set `lastReveal`;
       3. clear `pending`, `hidden.decision` and the required players' prompts;
       4. `phase = "turn"`;
       5. emit `ChoicesRevealed`;
       6. if `kind === "combat/exchange"`, increment `choiceHistory[p][choice]` (saturating at `MAX_COUNTER`) for non-timed-out players whose choice is one of `COMMANDS`;
       7. call `resolvers[kind]`.
   - All records via `Object.fromEntries`/`ownGet` (PIT-002).
4. **`handlers/index.ts`:** register as in the execution contract. If the non-empty union makes 02-01a's `never` workarounds in `reducer.ts` unnecessary or wrong, adjust `reducer.ts` minimally (precedence unchanged); export the public decision API (`openDecision`, `revealDecision`, `Resolver`, `ResolverTable` types if the spec lists them) from `index.ts` only if the spec's export list requires it.
5. **`decision.test.ts`** (call `usePurityTraps()`; use `newGame`/`applyAll`/`deepFreeze` from `./fixtures/build`):
   - Full flow: open with p1 `["yes","no"]`/`"no"` and p2 `["red","green","blue"]`/`"red"` → commit p1 → commit p2. Assert:
     - exact event types/order;
     - `ChoiceCommitted` has no `choice` key (`"choice" in e === false`);
     - `lastReveal = {decisionId:"d1", kind:"poll", choices:{p1,p2}, timedOut:[]}`;
     - `pending`/`hidden.decision`/prompts null; phase `turn`;
     - `choiceHistory` unchanged (poll).
   - Timeout flow: p2 gets its **own** default `"red"`, and a `ChoiceTimedOut` precedes `ChoicesRevealed`.
   - The second decision id is `d2`.
   - Every edge/error case in the execution contract (the 53/64/65-char token cases included).
   - A 3-seat game with ids `toString`, `valueOf`, `hasOwnProperty` that opens, commits one and times out, then asserts `typeof` of every revealed choice is `"string"` and `stableStringify(state)` does not throw.
   - **Direct reveal-path unit test (`combat/exchange` choiceHistory counting):** call `revealDecision` directly (not through `reduce`, since W1b `deserialize`/handlers never produce a combat pending):
     - Hand-build the input: open a poll for p1/p2 via `applyAll`, then make a structural copy whose `public.pending.kind` is `"combat/exchange"` and whose prompts/`hidden.decision.choices` hold the scenario's options/choices (the state is not passed through `deserialize`).
     - Use a stub `ResolverTable` whose `"combat/exchange"` entry records its arguments and returns the state unchanged, and whose `poll` entry throws; a `Ctx` built from `seedRng("reveal")` whose `int` throws (the stub never draws).
     - Cases (each asserts `choiceHistory` exactly and that the stub resolver was called once with `choices` in `required` order):
       1. p1 committed `strike`, p2 timed out (`timedOut: ["p2"]`, own default `guard`): p1 `strike` +1; p2's `guard` **not** counted.
       2. p1 committed `flee`, p2 committed `counter`: `flee` is not one of the 6 `COMMANDS`, so p1's record is unchanged; p2 `counter` +1.
       3. p1 committed `item:herb`, p2 committed `ward`: `item:<id>` is not counted; p2 `ward` +1.
       4. Saturation: p1's `choiceHistory.strike = MAX_COUNTER` in the hand-built copy; p1 commits `strike` → stays `MAX_COUNTER` (no overflow, still a safe integer).
     - And a `poll` reveal with the same choices leaves `choiceHistory` unchanged.
6. **`reducer.test.ts`:** add the `WRONG_PHASE`/`WRONG_ACTOR`/state-validation precedence cases from the execution contract. Each asserts the exact code and that the input state is returned (`===`).

> verification: pnpm vitest run packages/core/test/decision.test.ts packages/core/test/reducer.test.ts
> verification: grep -q 'resolveUnsupported' packages/core/src/handlers/index.ts
> verification: grep -q 'choice is not one of your options' packages/core/src/handlers/decision.ts
> verification: pnpm exec tsc -b packages/core
> verification: pnpm exec eslint packages/core
  </action>
  <verify>
pnpm vitest run packages/core/test/decision.test.ts packages/core/test/reducer.test.ts
grep -q 'resolveUnsupported' packages/core/src/handlers/index.ts
grep -q 'choice is not one of your options' packages/core/src/handlers/decision.ts
pnpm exec tsc -b packages/core
pnpm exec eslint packages/core
  </verify>
  <done>Generic multi-player decisions (open/commit/timeout/reveal) work with per-player options and defaults, dispatching reveal to a per-kind resolver table.</done>
</task>

<task type="auto">
  <name>Task 2: deserialize v2 and views counts</name>
  <files>packages/core/src/serialize.ts, packages/core/src/views.ts, packages/core/test/serialize.test.ts, packages/core/test/views.test.ts</files>
  <action>
Read the spec's *`serialize.ts` — `deserialize(json, rules)` v2* and *`views.ts`*.

1. **`serialize.ts`:** replace the W1a shim with the full `deserialize(json, rules)`:
   - `JSON.parse` (a `SyntaxError` propagates) → plain object (`TypeError`) → `v !== 2` → `SchemaVersionError`;
   - then checks 1–8 in spec order. Check 8 is the W1b version: `combat` must be null, and a `combat/exchange` pending kind is rejected with "combat decisions unsupported".
   - Exact own keys at every object level. Every player-/content-keyed lookup via `ownGet`.
   - Each failure throws `TypeError("deserialize: <unique message>")`.
   - Return the parsed value typed `GameState`, only after all checks pass.
2. **`views.ts`:** add `counts` per the execution contract. `viewFor` still builds a fresh object and never spreads `state`.
3. **`serialize.test.ts`** (call `usePurityTraps()`):
   - The three bases from the execution contract, built via `applyAll` on `FIXTURE_SETTINGS`/`TEST_RULES`.
   - A `ROWS` table: `{name, base, mutate(json) → json, message}`, one row per check, each a single mutation. Assert `toThrow(new TypeError(message))`, or `SchemaVersionError` for `v:1`/`v:3`, or `SyntaxError`.
   - The meta-test (unique messages; bases pass and round-trip deep-equal).
   - A round-trip example: `deserialize(serialize(s), TEST_RULES)` deep-equals `s` for each base.
4. **`views.test.ts`:**
   - `counts` for p1/p2 is `{p1:{bag:1,scrolls:0}, p2:{bag:2,scrolls:0}}` on `newGame()`; the spectator gets the same counts and `self: null`.
   - An exact-view assertion: `viewFor(s, q)` deep-equals `{v:2, viewer:q, public:s.public, self: seated ? s.private[q] : null, counts}`.
   - `viewFor` output has no `hidden` key.
   - The p2 view during an open poll has `self.prompt` for p2 only, and p1's options never appear.
   - The leak property lives in Task 3 (it needs arbitraries).

> verification: pnpm vitest run packages/core/test/serialize.test.ts packages/core/test/views.test.ts
> verification: grep -q 'combat decisions unsupported' packages/core/src/serialize.ts
> verification: grep -q 'counts' packages/core/src/views.ts
> verification: grep -c 'deserialize: ' packages/core/test/serialize.test.ts | xargs test 30 -le
> verification: pnpm exec tsc -b packages/core
  </action>
  <verify>
pnpm vitest run packages/core/test/serialize.test.ts packages/core/test/views.test.ts
grep -q 'combat decisions unsupported' packages/core/src/serialize.ts
grep -q 'counts' packages/core/src/views.ts
grep -c 'deserialize: ' packages/core/test/serialize.test.ts | xargs test 30 -le
pnpm exec tsc -b packages/core
  </verify>
  <done>deserialize validates every v2 shape, referential and derived invariant against Rules with unique single-mutation-proven messages, and views expose only bag/scroll counts of other players.</done>
</task>

<task type="auto">
  <name>Task 3: Property suite, kernel fixture, CLI tests, client demo, full pipeline and commit</name>
  <files>packages/core/test/arbitraries.ts, packages/core/test/counter-bounds.test.ts, packages/core/test/replay.test.ts, packages/core/test/views.test.ts, packages/sim/fixtures/kernel-game.json, packages/sim/test/cli.test.ts, packages/sim/test/replay-file.test.ts, packages/client/src/main.ts, packages/client/src/render.ts, packages/client/test/render.test.ts, .planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md</files>
  <action>
Read the spec's golden block *Golden (W1b, `packages/sim/fixtures/kernel-game.json`, core `replay.test.ts`)*, *`@usurpia/sim`* (`cli.test.ts` bullet), *`@usurpia/client`* and the *Acceptance Checks* property row.

1. **`arbitraries.ts`:** create it exactly as in the execution contract.
2. **`replay.test.ts`** (call `usePurityTraps()`):
   - **Kernel golden:** `replay({v:2, seed:"fixture", players:[p1 fighter, p2 caster]}, <the 7 spec actions>, TEST_RULES)`. Assert:
     - rejections `[{index:2, code ALREADY_COMMITTED}, {index:5, code INVALID_PAYLOAD}]`;
     - the 10 event types in spec order;
     - `hashState = "9616698e"`;
     - `lastReveal = {decisionId:"d2", kind:"poll", choices:{p2:"b"}, timedOut:[]}`;
     - the first `ChoicesRevealed` has choices `{p1:"yes", p2:"red"}` and `timedOut ["p2"]`.
     - Also transcribe the 7 per-step `hash` values from `.planning/reference/phase-02/traces/kernel-game.trace.json` into a constant and assert `hashState` after each fold step (the test never reads `.planning/` at runtime).
   - **Properties**, each `fc.assert(fc.property(arbGame, …), { numRuns: 200 })` (write `numRuns: 200` literally in each):
     1. determinism (two replays equal: state `stableStringify` and events);
     2. `reduce` never throws on a deep-frozen state, and the frozen state's `stableStringify` is unchanged after each call;
     3. rejection identity (`!ok` ⇒ the same state object; the fold continuing from it equals `replay`);
     4. split replay: for `k = fc.nat` clamped, replay the prefix, then `deserialize(serialize(s), TEST_RULES)`, then fold the rest; equal final `hashState`;
     5. every reachable state passes `deserialize(serialize(s), TEST_RULES)` and deep-equals `s`;
     6. integers only: every number in every reachable state satisfies `Number.isSafeInteger`.
3. **`views.test.ts`:** add the leak property (`numRuns: 200`, `arbGame`, seats biased 3–4). At every step and for every viewer in `[...players, "spectator"]`, assert:
   - the exact-view equality;
   - no `hidden` key;
   - JSON contains no `"decisionSeq"` or `"rng"`;
   - with `public.lastReveal` blanked out, the view JSON contains no sentinel token `s<i>-…` belonging to another seat index `i` (the sentinels only ever appear in that seat's prompt options);
   - `eventsFor(events, q)` contains no `PromptOpened` addressed to another player and no `ChoiceCommitted` carrying `choice`.
4. **`counter-bounds.test.ts`:**
   - A state with `hidden.decisionSeq = MAX_COUNTER`, built by mutating `serialize(newGame())` and loading it with `deserialize` (this also proves it is a valid save). `decision/open` → `INVALID_PAYLOAD` "decisionSeq would exceed MAX_COUNTER".
   - At `MAX_COUNTER - 1` it opens `d2147483647`.
   - `choiceHistory` saturation is unit-tested at the reveal path in `decision.test.ts` (Task 1); the reduce-level saturation test follows in 02-03 once combat exists.
5. **`packages/sim/fixtures/kernel-game.json`:** `{"rulesHash":"7433ea8b","settings":{…the W1b settings…},"actions":[…the 7 spec actions…]}`. Format it with prettier.
6. **`packages/sim/test/replay-file.test.ts`:**
   - `replayFile(<fixture>, replayRules())` gives the line exactly `hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2`, and is deterministic (twice).
   - **Move** every CLI subprocess test out of this file (function tests stay).
7. **`packages/sim/test/cli.test.ts`:** the CLI subprocess tests, using `spawnSync(process.execPath, [tsxCli, cliPath, …], {cwd: repoRoot, encoding: "utf8"})`. They write their own temp replay files using `replayRules()`/`rulesHash`, so they survive the W3 rules switch:
   - no args → 2 + usage;
   - an unknown command → 2;
   - an extra positional → 2;
   - a valid temp file → 0 with stdout `hash=… rules=<rulesHash(replayRules())> …`;
   - a wrong `rulesHash` → exactly 3;
   - the same with `--allow-rules-mismatch` → 0 and the ` rules-mismatch=` suffix;
   - invalid JSON → 2;
   - a missing file → 2.
8. **Client:**
   - `main.ts`: `createGame` (demo settings, `DEMO_RULES`), then `decision/open` (system) with prompts `p1: ["yes","no"]/"no"` and `p2: ["red","green","blue"]/"red"`, then `decision/commit` p1 `"yes"`. Throw on any rejection. Render `renderView(viewFor(state,"p2"), eventsFor(events,"p2"))`.
   - `render.ts`: the full spec line set. The player line adds ` bag <counts[id].bag>`. Then `pending: <id> (<kind>) committed: <comma list or —>` (or `pending: —`), and `your options: <comma list> (default <default>)` only if `view.self?.prompt`. **Comma lists are joined with `", "`** (decided here; the spec does not fix the separator).
   - `render.test.ts`: reproduce the demo state. The p2 render contains:
     - `p1 fighter L1 hp 48 gold 100 bag 1`
     - `p2 caster L1 hp 36 gold 100 bag 2`
     - `pending: d1 (poll) committed: p1`
     - `your options: red, green, blue (default red)`
     - `- DecisionOpened`, `- ChoiceCommitted`

     It has exactly one `- PromptOpened` line and does not contain `yes`. The spectator render has `pending: d1 (poll) committed: p1` and no `your options` line. `rulesHash(DEMO_RULES)` is still `7433ea8b`.
9. **Full pipeline** from the repo root:
   1. `pnpm install --frozen-lockfile`
   2. `pnpm lint`
   3. `pnpm lint:purity`
   4. `pnpm format` then `pnpm format:check`
   5. `pnpm typecheck`
   6. `pnpm test`
   7. `pnpm build`
   8. `pnpm sim replay packages/sim/fixtures/kernel-game.json`
   9. the sample/README grep
   10. `grep -q "rulesHash" README.md`
   11. the import-cycle guard (fresh-process imports of `rules.ts`, `serialize.ts` and `@usurpia/core`; no `ReferenceError`)
10. **Mutation proofs:** perform them per the execution contract and record them in the SUMMARY under `## Mutation proof`.
11. **Commit** (last step):
    1. Write `02-01b-SUMMARY.md`. It contains:
       - the API list;
       - test counts;
       - property run counts;
       - the observed goldens;
       - the deserialize message table;
       - the mutation-proof tables;
       - pipeline tails;
       - a section headed exactly `## arbitraries exports` (every export name and its type/shape, reused by 02-03/02-04);
       - a section headed exactly `## Resolver/ResolverTable signatures` (the verbatim `Resolver`/`ResolverTable` type declarations and the `openDecision`/`revealDecision`/`decisionHandlers` signatures);
       - decisions (the comma separator, the resolver types);
       - deviations (including any `reducer.ts`/`index.ts` edit).
    2. `git add packages/core packages/sim packages/client .planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md`
    3. Commit on `dev` with message `Phase 2 plan 02-01b: Generic decisions, deserialize v2, views counts, property suite`, ending with the attribution trailer lines provided in the execution prompt.
    4. Confirm there are no `.tsbuild/`, `dist/` or `node_modules/` paths in `git show --name-only --format= HEAD`, and that `git status --porcelain` is empty.
    5. Do not push (the orchestrator pushes and proves CI).

> verification: pnpm install --frozen-lockfile
> verification: pnpm lint
> verification: pnpm lint:purity
> verification: pnpm format:check
> verification: pnpm typecheck
> verification: pnpm test
> verification: pnpm build
> verification: pnpm sim replay packages/sim/fixtures/kernel-game.json | grep -qx 'hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2'
> verification: grep -c 'numRuns: 200' packages/core/test/replay.test.ts | xargs test 6 -le
> verification: grep -q 'numRuns: 200' packages/core/test/views.test.ts
> verification: grep -rnE 'sample/|setSecret|lastRoll|defaultChoice|sample-game|\{ settings, actions \}' packages/*/src packages/*/test packages/sim/fixtures README.md; test $? -eq 1
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/rules.ts"'
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/serialize.ts"'
> verification: pnpm --filter @usurpia/sim exec tsx --input-type=module -e 'import * as c from "@usurpia/core"; if (typeof c.deserialize !== "function" || typeof c.rulesHash !== "function") throw new Error("core exports missing")'
> verification: grep -q '^## arbitraries exports' .planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md
> verification: grep -q '^## Resolver/ResolverTable signatures' .planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md
> verification: git log -1 --format=%s | grep -q '^Phase 2 plan 02-01b:'
> verification: git show --name-only --format= HEAD | grep -E '(^|/)(\.tsbuild|dist|node_modules)/'; test $? -eq 1
  </action>
  <verify>
pnpm install --frozen-lockfile
pnpm lint
pnpm lint:purity
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm sim replay packages/sim/fixtures/kernel-game.json | grep -qx 'hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2'
grep -c 'numRuns: 200' packages/core/test/replay.test.ts | xargs test 6 -le
grep -q 'numRuns: 200' packages/core/test/views.test.ts
grep -rnE 'sample/|setSecret|lastRoll|defaultChoice|sample-game|\{ settings, actions \}' packages/*/src packages/*/test packages/sim/fixtures README.md; test $? -eq 1
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/rules.ts"'
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/serialize.ts"'
pnpm --filter @usurpia/sim exec tsx --input-type=module -e 'import * as c from "@usurpia/core"; if (typeof c.deserialize !== "function" || typeof c.rulesHash !== "function") throw new Error("core exports missing")'
grep -q '^## arbitraries exports' .planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md
grep -q '^## Resolver/ResolverTable signatures' .planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md
git log -1 --format=%s | grep -q '^Phase 2 plan 02-01b:'
git show --name-only --format= HEAD | grep -E '(^|/)(\.tsbuild|dist|node_modules)/'; test $? -eq 1
  </verify>
  <done>The v2 kernel passes a ≥ 200-run property suite, the kernel fixture replays to 9616698e through the CLI, the client shows the demo decision, and the plan is committed on dev with a green full pipeline.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Every command in `verification_commands` exits 0
- [ ] Kernel golden `9616698e`, per-step trace hashes, rejections and event order are asserted in `replay.test.ts`
- [ ] 6 replay properties + 1 leak property run at `numRuns: 200`; arbitraries include `toString`/`valueOf`/`hasOwnProperty` player ids (PIT-002)
- [ ] `## Mutation proof` in the SUMMARY covers every decision validation check and every deserialize check (PIT-001)
- [ ] `git status --porcelain` is empty; nothing in `files_forbidden` changed
- [ ] Every planned task is completed, blocked with evidence, or escalated; no planned work is self-deferred.
</verification>

<success_criteria>
- Decisions are generic, per-player, commit/reveal with private options and own-default timeouts; choices never leak before reveal.
- `deserialize(json, rules)` rejects every malformed or rules-inconsistent v2 save with a unique message.
- The v2 property suite (determinism, purity, rejection identity, split replay, integers only, redaction) passes at ≥ 200 runs.
- `pnpm sim replay packages/sim/fixtures/kernel-game.json` prints `hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2`.
</success_criteria>

<output>
After completion, create `.planning/phases/02-combat-core-balance-sim/02-01b-SUMMARY.md` with: the API list (`openDecision`, `revealDecision`, `decisionHandlers`, `Resolver`, `ResolverTable`), a `## arbitraries exports` section, a `## Resolver/ResolverTable signatures` section, test counts, property run counts, the deserialize message table, `## Mutation proof`, pipeline tails, decisions, deviations. It is committed in the Task 3 commit.
</output>
