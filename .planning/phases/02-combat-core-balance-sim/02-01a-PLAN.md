---
phase: 02-combat-core-balance-sim
plan: 01a
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/core/src/rules.ts
  - packages/core/src/combat/passives.ts
  - packages/core/src/combat/stats.ts
  - packages/core/src/types.ts
  - packages/core/src/actions.ts
  - packages/core/src/events.ts
  - packages/core/src/reducer.ts
  - packages/core/src/validation.ts
  - packages/core/src/serialize.ts
  - packages/core/src/game.ts
  - packages/core/src/replay.ts
  - packages/core/src/views.ts
  - packages/core/src/index.ts
  - packages/core/src/handlers.ts
  - packages/core/src/handlers/index.ts
  - packages/core/src/handlers/shared.ts
  - packages/core/test/fixtures/test-rules.ts
  - packages/core/test/fixtures/build.ts
  - packages/core/test/rules.test.ts
  - packages/core/test/stats.test.ts
  - packages/core/test/reducer.test.ts
  - packages/core/test/game.test.ts
  - packages/core/test/views.test.ts
  - packages/core/test/serialize.test.ts
  - packages/core/test/replay.test.ts
  - packages/core/test/decision.test.ts
  - packages/core/test/counter-bounds.test.ts
  - packages/core/test/arbitraries.ts
  - packages/sim/src/kernel-rules.ts
  - packages/sim/src/rules.ts
  - packages/sim/src/cli.ts
  - packages/sim/src/replay-file.ts
  - packages/sim/test/replay-file.test.ts
  - packages/sim/package.json
  - packages/sim/tsconfig.json
  - packages/sim/fixtures/sample-game.json
  - packages/content/package.json
  - packages/content/tsconfig.json
  - packages/client/src/demo-rules.ts
  - packages/client/src/main.ts
  - packages/client/src/render.ts
  - packages/client/test/render.test.ts
  - pnpm-lock.yaml
  - README.md
  - .planning/phases/02-combat-core-balance-sim/02-01a-SUMMARY.md
files_forbidden:
  - .planning/specs/
  - .planning/reference/
  - .planning/ROADMAP.md
  - .planning/PROJECT.md
  - .planning/STATE.md
  - .planning/memory/
  - .planning/phases/01-foundations-deterministic-engine/
  - packages/content/src/
  - packages/content/data/
  - packages/content/scripts/
  - packages/content/test/
  - packages/core/package.json
  - packages/core/tsconfig.json
  - packages/core/src/rng.ts
  - packages/core/src/hash.ts
  - packages/core/test/rng.test.ts
  - packages/core/test/purity.test.ts
  - packages/core/test/purity-traps.ts
  - packages/sim/src/index.ts
  - packages/client/package.json
  - packages/client/tsconfig.json
  - packages/client/index.html
  - packages/client/vite.config.ts
  - package.json
  - tsconfig.json
  - tsconfig.base.json
  - vitest.config.ts
  - eslint.config.js
  - .prettierignore
  - .prettierrc.json
  - scripts/
  - .github/
sequential_files: []
expected_artifacts:
  - path: "packages/core/src/rules.ts"
    provides: "Data-only Rules contract, CONTENT_ID_PATTERN, STAT_KEYS, COMBAT_HOOKS/BOARD_HOOKS, rulesHash, masteryRank, levelForXp"
    required: true
  - path: "packages/core/src/combat/stats.ts"
    provides: "activeHooks, sheetStats, npcDef, npcStats, battleStats, adjustHp (pure)"
    required: true
  - path: "packages/core/src/combat/passives.ts"
    provides: "applyPassives exhaustive hook switch → HookTotals"
    required: true
  - path: "packages/core/test/fixtures/test-rules.ts"
    provides: "TEST_RULES literal with rulesHash 7433ea8b"
    required: true
  - path: "packages/core/src/handlers/index.ts"
    provides: "Empty exhaustive handler map (satisfies HandlerMap) for the action-less W1a kernel"
    required: true
  - path: "packages/core/src/reducer.ts"
    provides: "reduce(state, action, rules) with the Phase 1 precedence on v2"
    required: true
  - path: "packages/core/src/game.ts"
    provides: "createGame(settings, rules) producing the v2 initial state (golden 758ef72c)"
    required: true
  - path: "packages/sim/src/rules.ts"
    provides: "replayRules(): the single rules source for the sim CLI and tests (W1: KERNEL_RULES)"
    required: true
  - path: "packages/sim/src/replay-file.ts"
    provides: "v2 replay file {rulesHash, settings, actions} with RulesMismatchError (exit 3)"
    required: true
  - path: "packages/client/src/demo-rules.ts"
    provides: "DEMO_RULES verbatim TEST_RULES copy typed Rules"
    required: true
  - path: "README.md"
    provides: "v2 replay file format, --allow-rules-mismatch, exit codes 0/1/2/3, no sample references"
    required: true
  - path: ".planning/phases/02-combat-core-balance-sim/02-01a-SUMMARY.md"
    provides: "Plan summary with pipeline outputs and decisions"
    required: true
autonomous: false
agents: ["engineering-senior-developer", "testing-qa-verification-specialist"]
requirements: [R5, R2, R3]
user_setup: []
verification_commands:
  - "pnpm install --frozen-lockfile"
  - "pnpm lint"
  - "pnpm lint:purity"
  - "pnpm format:check"
  - "pnpm typecheck"
  - "pnpm test"
  - "pnpm build"
  - "grep -q '7433ea8b' packages/core/test/rules.test.ts"
  - "grep -q '758ef72c' packages/core/test/game.test.ts"
  - "grep -q 'hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=0' packages/sim/test/replay-file.test.ts"
  - "test ! -f packages/core/src/handlers.ts"
  - "test ! -f packages/sim/fixtures/sample-game.json"
  - "test ! -f packages/core/test/decision.test.ts"
  - "grep -rnE 'sample/|setSecret|lastRoll|defaultChoice|sample-game|\\{ settings, actions \\}' packages/*/src packages/*/test packages/sim/fixtures README.md; test $? -eq 1"
  - "grep -q 'rulesHash' README.md"
  - "grep -q 'allow-rules-mismatch' README.md"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/rules.ts\"'"
  - "pnpm exec tsx --input-type=module -e 'import \"./packages/core/src/serialize.ts\"'"
  - "pnpm --filter @usurpia/sim exec tsx --input-type=module -e 'import * as c from \"@usurpia/core\"; if (typeof c.rulesHash !== \"function\") throw new Error(\"rulesHash missing\")'"
  - "grep -q '^## fixtures/build.ts helpers' .planning/phases/02-combat-core-balance-sim/02-01a-SUMMARY.md"
  - "git log -1 --format=%s | grep -q '^Phase 2 plan 02-01a:'"
  - "git show --name-only --format= HEAD | grep -E '(^|/)(\\.tsbuild|dist|node_modules)/'; test $? -eq 1"

must_haves:
  truths:
    - "reduce(state, action, rules) keeps the Phase 1 precedence: every non-object or v !== 2 input is UNSUPPORTED_VERSION, every other versioned object is UNKNOWN_ACTION (Action is the empty union in W1a), and rejections return the identical input state"
    - "rulesHash(TEST_RULES) === '7433ea8b' in core, and the sim KERNEL_RULES and client DEMO_RULES copies hash to the same value"
    - "createGame(fixture settings, TEST_RULES) has hashState 758ef72c and exactly the spec's canonical JSON"
    - "sheetStats/npcStats reproduce every row of the spec's stats golden table using only integer floor steps"
    - "No sample module, counter, lastRoll, note or defaultChoice remains in packages/*/src, packages/*/test, packages/sim/fixtures or README.md"
  artifacts:
    - path: "packages/core/src/rules.ts"
      provides: "Rules contract"
      min_lines: 120
      contains: "COMBAT_HOOKS"
    - path: "packages/core/src/combat/passives.ts"
      provides: "Exhaustive hook switch"
      min_lines: 40
      contains: "switch (hook.hook)"
    - path: "packages/core/test/stats.test.ts"
      provides: "Sheet/NPC stat goldens"
      min_lines: 60
      contains: "94, 37, 20, 19, 14, 9"
    - path: "packages/core/test/game.test.ts"
      provides: "createGame golden + SettingsError cases"
      min_lines: 60
      contains: "758ef72c"
    - path: "packages/sim/src/replay-file.ts"
      provides: "v2 replay file loader"
      min_lines: 40
      contains: "RulesMismatchError"
  key_links:
    - from: "packages/core/src/reducer.ts"
      to: "packages/core/src/handlers/index.ts"
      via: "handler map lookup"
      pattern: "handlers\\["
    - from: "packages/core/src/game.ts"
      to: "packages/core/src/combat/stats.ts"
      via: "initial hp from sheetStats"
      pattern: "sheetStats\\("
    - from: "packages/sim/src/cli.ts"
      to: "packages/sim/src/rules.ts"
      via: "replayRules()"
      pattern: "replayRules\\("
    - from: "packages/client/src/main.ts"
      to: "packages/client/src/demo-rules.ts"
      via: "DEMO_RULES"
      pattern: "DEMO_RULES"
---

<objective>
Move the Phase 1 kernel to schema v2 and thread a data-only `Rules` object through `reduce`, `createGame`, `replay`, `deserialize` and `views`. Specifically:
- Create the `Rules` contract, the `TEST_RULES` fixture and the pure stat math (`applyPassives`, `sheetStats`, `npcStats`, `adjustHp`).
- Delete the sample module.
- Point sim/client at verbatim `TEST_RULES` copies. The sim gets a v2 replay file with a `rulesHash` check (exit 3 on mismatch).
- Leave the whole repo pipeline green on an **action-less** kernel. `Action` is the empty union and every versioned object is `UNKNOWN_ACTION`.

Purpose: binding decision OQ5a (content injection) and the v2 data model (OQ5c), R5 stats, and the R2/R3 kernel carry-over. It is the foundation every other Phase 2 plan builds on.
Output: `packages/core/src/{rules,combat/passives,combat/stats,handlers/index,handlers/shared}.ts`, v2 core modules, `TEST_RULES`, W1a tests, sim/client shims, README.
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-combat-core-balance-sim/02-CONTEXT.md
@.planning/specs/02-combat-core-balance-sim-spec.md
@.planning/phases/01-foundations-deterministic-engine/01-REVIEW.md
@.planning/memory/ERRORS.md

Relevant source files:
@packages/core/src/types.ts
@packages/core/src/actions.ts
@packages/core/src/events.ts
@packages/core/src/handlers.ts
@packages/core/src/reducer.ts
@packages/core/src/validation.ts
@packages/core/src/serialize.ts
@packages/core/src/game.ts
@packages/core/src/replay.ts
@packages/core/src/views.ts
@packages/core/src/index.ts
@packages/core/test/reducer.test.ts
@packages/core/test/game.test.ts
@packages/core/test/views.test.ts
@packages/core/test/serialize.test.ts
@packages/core/test/replay.test.ts
@packages/core/test/purity-traps.ts
@packages/sim/src/cli.ts
@packages/sim/src/replay-file.ts
@packages/sim/test/replay-file.test.ts
@packages/client/src/main.ts
@packages/client/src/render.ts
@packages/client/test/render.test.ts
@README.md
@eslint.config.js
@vitest.config.ts
@.prettierignore
@tsconfig.json
</context>

<execution_contract>
Harness: read-before-write -> evidence-before-action -> minimal diff -> verify-before-report

Role: engineering-senior-developer (executor, model `sonnet`); testing-qa-verification-specialist (golden transcription, PIT-001 single-mutation negative tests, final pipeline sign-off).
Task: implement spec *Deliverables → Wave 1a — Plan 02-01a* exactly, with contracts from these spec sections:
- *`rules.ts` — the `Rules` contract*
- *`types.ts` — GameState v2*
- *`game.ts` / `replay.ts` signatures*
- *`views.ts`* (W1a shape)
- *`actions.ts` — Action union v2* (W1a: empty union)
- *`events.ts`*
- *`reducer.ts` — precedence and handler table*
- *`combat/passives.ts` + `combat/stats.ts`*
- *`serialize.ts`* (W1a shim only)
- *`@usurpia/sim`* (W1 replay update)
- *`@usurpia/client`* (02-01a interim)
- *Test fixture `TEST_RULES`*
- *Golden oracle and traces* (tool exclusions)

Requirements: R5 (stats), R2/R3 kernel carry-over.
Scope:
- Read targets: the spec (whole file; especially the sections above plus *Failure Modes* and *Acceptance Checks*), 02-CONTEXT.md, 01-REVIEW.md, `.planning/memory/ERRORS.md` (PIT-001/PIT-002), every file in `<context>`.
- Write targets: exactly `files_modified`.
  - `packages/core/src/handlers.ts`, `packages/core/test/{decision.test,counter-bounds.test,arbitraries}.ts` and `packages/sim/fixtures/sample-game.json` are **deleted** (02-01b re-creates the three core test files for v2).
- Forbidden targets: `files_forbidden`.
Allowed tools/actions:
- Edit listed files. Run any root script (this plan runs alone in wave 1, so repo-wide `pnpm lint|lint:purity|format|format:check|typecheck|test|build` are allowed). `pnpm install` (only to refresh `pnpm-lock.yaml` after the workspace-link edits in Task 3). `pnpm sim replay <tmpfile>`. `git add`/`git commit` on `dev`.
- Read `.planning/reference/phase-02/**` for debugging (never edit it; committed tests never read it).
Forbidden actions:
- Do not modify files outside files_modified.
- Do not add unplanned dependencies (only the two workspace links: `@usurpia/core` in content, `@usurpia/content` in sim).
- Do not change public APIs, schemas, migrations, auth, CI, or deployment unless explicitly listed in this plan.
- Do not self-defer planned work.
- Do not "record" goldens from your implementation: `7433ea8b`, `758ef72c`, the canonical JSON and the stats table come from the spec. On a mismatch, follow the spec's *Mismatch localisation protocol* (the `createGame` golden equals `traces/kernel-game.trace.json` `initialHash`).
- Do not push and do not use GitHub MCP. This plan runs in the main checkout `/home/user/Dokapon-kingdom-2` on `dev` and commits on `dev`; the orchestrator pushes and proves CI after this plan (02-CONTEXT *Wave execution protocol*).
- Mismatch-localisation throwaway scripts live outside the repo in `/tmp/usurpia-scratch/02-01a/` (never inside the checkout), so `git status --porcelain` stays clean.
- Do not use `eslint-disable` comments (`noInlineConfig` is on in `packages/core/src`), `Math.random`, `Date`, `Intl`, `Reflect`, `.constructor`, `localeCompare` or `import()` in core src.
Implementation sequence:
1. Read the spec sections listed above and every context file. Confirm the tool exclusions (see Task 3). Record the pre-change test count (`pnpm test`, expected 263).
2. Task 1: `rules.ts`, `combat/{passives,stats}.ts`, `TEST_RULES`, and the additive v2 type exports in `types.ts`; `rules.test.ts`, `stats.test.ts`.
3. Task 2: v2 state, the empty action union, the `handlers/` split, reducer threading, the `createGame` golden, the shim `deserialize`, W1a views; trim/delete the v1 tests.
4. Task 3: workspace links, sim/client shims, the v2 replay file, README; full pipeline; SUMMARY; commit.
Required interfaces/content structure:
- Exactly the signatures and constants in the spec sections above.
  - `rules.ts` exports: `RULES_VERSION`, `ContentId`, `CONTENT_ID_PATTERN`, `RESERVED_CONTENT_IDS`, `StatKey`, `STAT_KEYS`, `StatBlock`, `ModStat`, the command types and arrays, `COMBAT_HOOKS`, `BOARD_HOOKS`, `CombatHook`/`BoardHook`/`HookName`/`Hook`/`PassiveDef`/`CommandWeights`, every `*Def`/tuning interface, `Rules`, `rulesHash`, `masteryRank`, `levelForXp`.
  - `rulesHash(rules) = fnv1a32(stableStringify(rules))`, reusing `hash.ts`/`serialize.ts`.
  - `types.ts` adds `SCHEMA_VERSION = 2`, `MAX_STAT = 99_999`, `CHOICE_PATTERN = /^[a-z][a-z0-9:-]{0,63}$/` and every v2 interface, and removes `Choice`, `counter`, `lastRoll`, `PrivateState.note`, `hidden.decision.defaultChoice`. It keeps `MAX_COUNTER`, `RESERVED_IDS`, `PLAYER_ID_PATTERN`, `SYSTEM_ACTOR`, `Actor`/`Viewer` aliases.
- `handlers/shared.ts`: `Ctx` (unchanged: `{ rng: RngState; int(min, max): number }`), `Handler<A>`, and `HandlerMap = { [K in Action["type"]]: Handler<Extract<Action, {type: K}>> }`.
  - `Handler<A>` is `{ phases; actor: "active" | "any-player" | "system" | "required"; guard(raw): raw is A; validate?(s, a, rules): Reject | null; apply(s, a, ctx, rules): {state, events} }`.
  - Guards `isPlainObject`, `hasExactKeys(raw, keys)`, `isChoiceToken(x)` (`CHOICE_PATTERN`), `isInt(x, min, max)`; `reject(code, message)` (bounded echo: ids clipped to 64 chars); `overflow(n, by)` (`n + by > MAX_COUNTER`); `ownGet(record, key)` re-exported from `validation.ts` if it lives there.
- `handlers/index.ts`: `export const handlers = {} satisfies HandlerMap;`. The reducer keeps Phase 1's single documented widening cast for the handler lookup.
- `ACTION_TYPES` is an empty readonly array typed `readonly Action["type"][]`; `Action` is `never`.
- **`never` typing traps (W1a only; decided here):** with `Action = never`, `ACTION_TYPES` is `readonly never[]` and `Action["type"]` is `never`.
  - `ACTION_TYPES.includes(type)` with a `string` argument fails typecheck. Use `(ACTION_TYPES as readonly string[]).includes(type)`.
  - `@typescript-eslint/restrict-template-expressions` rejects interpolating a `never`-typed value (e.g. `` `unknown action ${action.type}` ``). Widen first (`const type: string = raw.type as string;` after the plain-object check, or `String(x)`) and interpolate the `string`.
  - The handler lookup keeps Phase 1's single documented widening cast (e.g. `(handlers as Readonly<Record<string, Handler<Action> | undefined>>)`), guarded by `Object.hasOwn(handlers, type)`.
  - No `eslint-disable` is possible in core src (`noInlineConfig`), so these workarounds are mandatory. 02-01b may adjust `reducer.ts`/`index.ts` again once the union is non-empty.
- **Import-cycle guard:** `rules.ts` imports `stableStringify` from `./serialize` (which, from 02-01b on, imports `levelForXp`/`masteryRank` from `./rules`). `rules.ts` uses `serialize`/`hash` values **only inside function bodies** (`rulesHash`), never at module top level (no top-level constant computed from `stableStringify`/`fnv1a32`); `serialize.ts` likewise never uses `rules.ts` values at top level. Verified by fresh-process `tsx` imports of each entry point (Task 3).
- `events.ts` (W1a): `Visibility`, frozen `PUBLIC`, `onlyPlayers()`, and the `GameEvent` union declared with the five decision events of the spec's *`events.ts` — GameEvent union v2* table (`DecisionOpened`, `PromptOpened` private, `ChoiceCommitted`, `ChoiceTimedOut`, `ChoicesRevealed`), every event `{v: 2, type, visibility, …}`. They are declared (types only) so views/replay compile and redaction can be unit-tested; nothing emits them until 02-01b.
- `packages/core/test/fixtures/build.ts` (test helpers, decided here because the spec does not detail them):
  - `FIXTURE_SETTINGS` (`{v:2, seed:"fixture", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}`)
  - `newGame(settings = FIXTURE_SETTINGS, rules = TEST_RULES): GameState`
  - `applyAll(state, actions, rules = TEST_RULES): {state, events}` (throws `Error("rejected at <i>: <code> <message>")` on any rejection)
  - `deepFreeze<T>(x: T): T`
  - 02-01b onward reuse these by name.
Edge/error cases:
- `createGame`: `SettingsError` for each of these (one mutation each from `FIXTURE_SETTINGS`):
  - not an object; `v: 1`; empty seed; 0 players; 5 players
  - a seat that is a string (the v1 shape); a seat with an extra key; a seat missing `classId`
  - a duplicate id; each reserved id; the id `"bad id"`; a 33-char id
  - `classId` `"battlemage"` (hybrid); `classId` `"wizard"` (unknown)
  - `classId` `"toString"` and `"constructor"` (PIT-002: prototype members are unknown classes, via `ownGet`)
- `reduce`: `null`, `42`, `[]`, `{}`, `{v:1,type:"decision/open",…}` → `UNSUPPORTED_VERSION`; `{v:2,type:"decision/open",…}` and the v1 sample types sent with `v:2` → `UNKNOWN_ACTION`; the input state object is returned (`===`) and a deep-frozen input never throws.
- The v1 sample type strings must be built without the literal banned substrings, because the sample grep scans `packages/*/test`: use `["sample", "roll"].join("/")`, `["sample", "increment"].join("/")`, `["sample", "set" + "Secret"].join("/")`.
- `viewFor` for `"spectator"`, `"ghost"`, `"toString"`, `"valueOf"`, `"hasOwnProperty"` → `self: null`.
- The shim `deserialize`: `SyntaxError` (bad JSON), `TypeError` (non-object/array), `SchemaVersionError` (`v:1` save and `v:3`), `TypeError` for a root with an extra/missing key, else `TypeError("deserialize: v2 validation lands in 02-01b")`.
- A replay file whose `rulesHash` differs → `RulesMismatchError` (exit 3); with `--allow-rules-mismatch` the line gets ` rules-mismatch=<fileHash>`; a missing `rulesHash` key or extra key → `ReplayFileError` (exit 2).
Verification criteria:
- Every `> verification:` line and every command in `verification_commands` exits 0.
Final result format:
- Status: Complete | Partial | Failed | BLOCKED
- Files changed
- Verification commands and outputs
- Decisions made
- Issues/errors
</execution_contract>

<stop_gates>
Emit `BLOCKED` and stop instead of guessing when:
- A read target listed in `<context>` or `<execution_contract>` is missing or unreadable.
- Required source evidence contradicts the plan (e.g. a faithful transcription of `TEST_RULES` does not hash to `7433ea8b`, or `createGame` cannot reach `758ef72c` after diffing against `traces/kernel-game.trace.json` `initialHash` and the spec's canonical JSON).
- Completing the task requires a file not listed in `files_modified`. This includes a missing golden-oracle exclusion: all four were verified present at planning time (`eslint.config.js` `ignores` has `".planning/**"`, `.prettierignore` has `.planning/`, root `tsconfig.json` has `"files": []`, `vitest.config.ts` projects list only `packages/*`). If one is missing now, report it instead of editing a forbidden file.
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
  <name>Task 1: Rules contract, TEST_RULES and pure stat math</name>
  <files>packages/core/src/rules.ts, packages/core/src/combat/passives.ts, packages/core/src/combat/stats.ts, packages/core/src/types.ts, packages/core/test/fixtures/test-rules.ts, packages/core/test/rules.test.ts, packages/core/test/stats.test.ts</files>
  <action>
Read the spec sections *`rules.ts` — the `Rules` contract*, *`combat/passives.ts` + `combat/stats.ts`* and *Test fixture `TEST_RULES`*.

1. **`packages/core/src/rules.ts`:** transcribe the spec's code block exactly (types, constants, `COMBAT_HOOKS`/`BOARD_HOOKS` `as const` in the listed order). Implement:
   - `rulesHash(rules) = fnv1a32(stableStringify(rules))` (import from `./hash` and `./serialize`).
   - `masteryRank(rules, wins)` = max `r` in 1..5 with `wins >= progression.masteryWins[r-1]`.
   - `levelForXp(rules, xp)` = max `L` with `xp >= progression.xpCurve[L-1]`.
   - Loops only, no floats.
   - Core trusts `Rules` (no re-validation).
   - Import-cycle guard (execution contract): `stableStringify`/`fnv1a32` are used only inside `rulesHash`'s body; no module-top-level value in `rules.ts` depends on `./serialize` or `./hash`.
2. **`packages/core/src/types.ts` (additive in this task):** add the exports Task 1 needs from the spec's *`types.ts` — GameState v2* block: `MAX_STAT`, `CharacterPublic`, `BattleMods`, `NpcRef`, `CombatSide`. Import `ContentId`/`StatBlock` types from `./rules`. Do **not** remove v1 declarations yet (Task 2 finishes the migration). This keeps core compiling between tasks.
3. **`packages/core/src/combat/passives.ts`:**
   - `export type HookTotals = Readonly<Record<CombatHook, number>>;`
   - `applyPassives(hooks)` starts every `COMBAT_HOOKS` key at 0, built via `Object.fromEntries`.
   - It then loops with **one exhaustive `switch (hook.hook)`**: one `case` per combat hook adding `value`, and explicit `case`s for every `BOARD_HOOKS` member doing nothing. There is **no `default`**, and an exhaustiveness helper `const _never: never = hook.hook` sits after the switch, so a new hook name fails typecheck.
4. **`packages/core/src/combat/stats.ts`** (pure; imports only `../rules`, `../types` types, `./passives`):
   - `activeHooks`, `sheetStats`, `npcDef`, `npcStats`, `battleStats`, `adjustHp`, exactly per the spec's numbered steps: `fl = Math.floor`, applied step by step; hp `max(1, x)`; other stats `max(0, x)`.
   - Every rules-record lookup (`classes`, `gear`, `monsters`, `guardians`, `battleSpells`, `wardSpells`) goes through `ownGet` from `../validation`, or an equivalent `Object.hasOwn` helper (PIT-002). A missing id is impossible for trusted rules plus validated state; throw `Error("unknown <kind> <id>")` in that case.
   - `npcStats` never reads hooks.
   - Guardian curve = `npcCurve[townTier]`; monster curve = `npcCurve[tier - 1 + (senior ? 1 : 0)]`; enforcer curve = `baseStats + growth × (level − 1)`.
5. **`packages/core/test/fixtures/test-rules.ts`:** transcribe the spec's `TEST_RULES` literal verbatim, with the local helpers `S`, `Z`, `P`, `H`, `AT`, `DT` typed so the object satisfies `Rules`. Export `TEST_RULES: Rules`.
6. **`packages/core/test/rules.test.ts`** (call `usePurityTraps()`):
   - `rulesHash(TEST_RULES) === "7433ea8b"`.
   - `CONTENT_ID_PATTERN` accepts a 48-char id and rejects 49 chars, uppercase and a leading digit.
   - `RESERVED_CONTENT_IDS` deep-equals `["constructor","prototype"]`.
   - `STAT_KEYS` order.
   - `masteryRank` at wins `0,2,3,6,7,11,12,17,18,1000` → `1,1,2,2,3,3,4,4,5,5`.
   - `levelForXp` at `0,49,50,149,150,2250,99999` → `1,1,2,2,3,10,10`.
   - `rulesHash` changes when one tuning number changes and is independent of key insertion order.
7. **`packages/core/test/stats.test.ts`** (call `usePurityTraps()`):
   - One `it` per row of the spec's stats golden table (stat order hp/atk/def/mag/spd/luck; build each `CharacterPublic` literally, with `mastery` = all TEST_RULES class ids at 0 plus the row's wins). Assert the exact object, e.g. `expect(sheetStats(TEST_RULES, ch)).toEqual({hp:94, atk:37, def:20, mag:19, spd:14, luck:9})`.
     - Also keep a compact array literal `[94, 37, 20, 19, 14, 9]` in the file, so the artifact grep `94, 37, 20, 19, 14, 9` matches.
   - NPC rows use `npcStats`.
   - `applyPassives([])` gives all zeros, with exactly the `COMBAT_HOOKS` keys.
   - `applyPassives` sums duplicates and ignores every `BOARD_HOOKS` member (one test iterating all 8).
   - `activeHooks` order (class passives by rank, then the portable rank-5, then weapon/shield/accessory hooks).
   - The portable is ignored when `portable === classId`.
   - `battleStats` with `atk: -5000` → floor, and `max(0)`.
   - `adjustHp(50, 60, 40) === 50`, `adjustHp(60, 50, 55) === 50`, `adjustHp(50, 60, 0) === 0`.

> verification: pnpm vitest run packages/core/test/rules.test.ts packages/core/test/stats.test.ts
> verification: grep -q '"7433ea8b"' packages/core/test/rules.test.ts
> verification: grep -q 'switch (hook.hook)' packages/core/src/combat/passives.ts
> verification: pnpm exec tsc -b packages/core
> verification: pnpm exec eslint packages/core
  </action>
  <verify>
pnpm vitest run packages/core/test/rules.test.ts packages/core/test/stats.test.ts
grep -q '"7433ea8b"' packages/core/test/rules.test.ts
grep -q 'switch (hook.hook)' packages/core/src/combat/passives.ts
pnpm exec tsc -b packages/core
pnpm exec eslint packages/core
  </verify>
  <done>The data-only Rules contract, the TEST_RULES fixture (7433ea8b) and the pure stat math exist, and every stats golden row passes.</done>
</task>

<task type="auto">
  <name>Task 2: GameState v2, empty action union and reducer/Rules threading</name>
  <files>packages/core/src/types.ts, packages/core/src/actions.ts, packages/core/src/events.ts, packages/core/src/reducer.ts, packages/core/src/validation.ts, packages/core/src/serialize.ts, packages/core/src/game.ts, packages/core/src/replay.ts, packages/core/src/views.ts, packages/core/src/index.ts, packages/core/src/handlers.ts, packages/core/src/handlers/index.ts, packages/core/src/handlers/shared.ts, packages/core/test/fixtures/build.ts, packages/core/test/reducer.test.ts, packages/core/test/game.test.ts, packages/core/test/views.test.ts, packages/core/test/serialize.test.ts, packages/core/test/replay.test.ts, packages/core/test/decision.test.ts, packages/core/test/counter-bounds.test.ts, packages/core/test/arbitraries.ts</files>
  <action>
Read the spec sections *`types.ts` — GameState v2*, *`game.ts` / `replay.ts` signatures*, *`views.ts`*, *`actions.ts`*, *`events.ts`*, *`reducer.ts` — precedence and handler table*, *`serialize.ts`* (and the 02-01a shim in *Deliverables*).

1. **`types.ts`:** complete the v2 migration per the spec block and remove the v1-only declarations listed there.
2. **`actions.ts`:** `export type Action = never;` plus `export const ACTION_TYPES: readonly Action["type"][] = [];`, with a comment naming 02-01b as the plan that adds the W1 members. Keep `Opponent`/`Grant` out until their waves.
3. **`events.ts`:** per the execution contract (5 decision events declared, `PUBLIC`, `onlyPlayers`).
4. **`handlers/shared.ts` + `handlers/index.ts`:** create them per the execution contract. **Delete `packages/core/src/handlers.ts`.**
5. **`reducer.ts`:** `reduce(state, action: unknown, rules: Rules): ReduceResult` and `isAction(value)`, keeping the Phase 1 order:
   1. canonicalize once;
   2. `UNSUPPORTED_VERSION` (not a plain object, or `v !== 2`);
   3. `UNKNOWN_ACTION` (`type` not an own key of `handlers`, checked via `Object.hasOwn`);
   4. `INVALID_PAYLOAD`;
   5. `WRONG_PHASE`;
   6. `WRONG_ACTOR`;
   7. `validate(state, action, rules)`;
   8. `apply(state, action, ctx, rules)`;
   9. write `ctx.rng` back.

   `RejectCode` keeps its 7 codes.
6. **`validation.ts`:** keep `playersError`/`ownGet`/pattern helpers. Add `seatsError(seats, rules)` for the createGame seat rules: exact keys `id`/`classId`, and a base class via `ownGet(rules.classes, classId)?.kind === "base"`. It returns a unique message per failure.
7. **`game.ts`:** `createGame(settings, rules)` exactly per the spec paragraph. All records are built via `Object.fromEntries` (PIT-002); mastery keys are every class id sorted; hp comes from `sheetStats`.
8. **`replay.ts`:** `replay(settings, actions, rules)` (it continues after rejections).
9. **`serialize.ts`:** keep `stableStringify`/`serialize`/`hashState`/`SchemaVersionError`. Replace `deserialize` with the **W1a shim** `deserialize(json: string, rules: Rules): GameState`:
   - `JSON.parse`;
   - plain-object check (`TypeError`);
   - `v !== 2` → `SchemaVersionError`;
   - root exact keys `v, public, private, hidden` (`TypeError("deserialize: root keys")`);
   - otherwise `throw new TypeError("deserialize: v2 validation lands in 02-01b")`.

   Reference `rules` in a `void rules;` statement so lint does not flag it as unused.
10. **`views.ts`:** `PlayerView = {v, viewer, public, self}` (no `counts` until 02-01b). Build it without spreading `state`; `self` comes from `ownGet(state.private, viewer)` only when `viewer` is in `players`, else `null`. `redactEvent`/`eventsFor` keep their semantics.
11. **`index.ts`:** re-export everything in *`game.ts` / `replay.ts` signatures*, `rules.ts`, `combat/passives.ts`, `combat/stats.ts`, types, rng, hash, serialize, actions, events, reducer (not handlers), views. It never re-exports `ai/`.
12. **Tests** (every file calls `usePurityTraps()`; import helpers from `./fixtures/build` and `./fixtures/test-rules`):
    - **`fixtures/build.ts`:** create it per the execution contract.
    - **`game.test.ts`:**
      - `hashState(createGame(FIXTURE_SETTINGS, TEST_RULES)) === "758ef72c"`.
      - `stableStringify(...)` equals the spec's canonical JSON string verbatim (paste it as a single-line string constant).
      - Every `SettingsError` case in the execution contract, one mutation each; assert `toThrow(SettingsError)`.
      - Same seed gives equal states; a different seed gives a different `hidden.rng`.
      - Removed v1 fields are covered by asserting `Object.keys(state.public).sort()` equals the 9 v2 keys and `Object.keys(state.private.p1).sort()` equals `["bag","prompt","scrolls"]` (do not write the removed field names).
    - **`reducer.test.ts`:** replace the v1 cases.
      - `UNSUPPORTED_VERSION` for the non-object/`v:1` inputs.
      - `UNKNOWN_ACTION` for the `v:2` decision types and the joined v1 sample type strings.
      - Canonicalize-once: an action object with a getter/Proxy is rejected identically and the getter runs at most once.
      - Rejection identity: `result.ok === false` and the input returned is `===`; deep-frozen input never throws.
      - `isAction` is false for all of these.
    - **`views.test.ts`:** `self` equals `state.private.p1` for p1. `self === null` for spectator/ghost/prototype-like ids. `JSON.stringify(viewFor(s,"p2"))` contains no `"hidden"`, no `"rng"` and not p1's private bag once p1's bag gets a sentinel. Build that state with the Task 2 `newGame`, then replace `private.p1.bag` in a structural copy with `["__SECRET_p1__"]`. `redactEvent` on a hand-built private `PromptOpened` for p1 → `null` for p2 and the spectator, and the event for p1.
    - **`serialize.test.ts`:** keep the `stableStringify`/`fnv1a32`/TypeError unit cases that do not use v1 state. Add the shim cases from the execution contract (one mutation each from `serialize(newGame())`).
    - **`replay.test.ts`:** `replay(FIXTURE_SETTINGS, [], TEST_RULES)` → 0 events, 0 rejections, hash `758ef72c`. A junk script `[null, 42, {v:1,type:"x"}, {v:2,type:"decision/open",playerId:"system",prompts:[]}]` → 4 rejections with codes `UNSUPPORTED_VERSION ×3, UNKNOWN_ACTION`, and the state still equals the initial state. Determinism: the same inputs twice give equal `stableStringify`.
    - **Delete** `packages/core/test/decision.test.ts`, `packages/core/test/counter-bounds.test.ts` and `packages/core/test/arbitraries.ts`; they exercise only v1 actions, and 02-01b re-creates them for v2.
13. Run `pnpm exec prettier --write packages/core`, then the verification lines. `pnpm exec tsc -b packages/core` must pass. Do not run `pnpm typecheck` yet: sim/client still use the v1 API until Task 3.

> verification: pnpm vitest run packages/core
> verification: pnpm exec tsc -b packages/core
> verification: pnpm exec eslint packages/core
> verification: pnpm lint:purity
> verification: test ! -f packages/core/src/handlers.ts
> verification: grep -q '"758ef72c"' packages/core/test/game.test.ts
> verification: grep -q 'satisfies HandlerMap' packages/core/src/handlers/index.ts
> verification: grep -q 'v2 validation lands in 02-01b' packages/core/src/serialize.ts
  </action>
  <verify>
pnpm vitest run packages/core
pnpm exec tsc -b packages/core
pnpm exec eslint packages/core
pnpm lint:purity
test ! -f packages/core/src/handlers.ts
grep -q '"758ef72c"' packages/core/test/game.test.ts
grep -q 'satisfies HandlerMap' packages/core/src/handlers/index.ts
grep -q 'v2 validation lands in 02-01b' packages/core/src/serialize.ts
  </verify>
  <done>Core compiles and tests green on schema v2 with Rules threaded through reduce/createGame/replay/deserialize/views, an empty action union, and the createGame golden 758ef72c.</done>
</task>

<task type="auto">
  <name>Task 3: Workspace links, sim/client shims, README, full pipeline and commit</name>
  <files>packages/sim/src/kernel-rules.ts, packages/sim/src/rules.ts, packages/sim/src/cli.ts, packages/sim/src/replay-file.ts, packages/sim/test/replay-file.test.ts, packages/sim/package.json, packages/sim/tsconfig.json, packages/sim/fixtures/sample-game.json, packages/content/package.json, packages/content/tsconfig.json, packages/client/src/demo-rules.ts, packages/client/src/main.ts, packages/client/src/render.ts, packages/client/test/render.test.ts, pnpm-lock.yaml, README.md, .planning/phases/02-combat-core-balance-sim/02-01a-SUMMARY.md</files>
  <action>
Read the spec sections *`@usurpia/sim`* (the replay file v2 bullets for W1), *`@usurpia/client`* (the 02-01a interim) and *Compatibility Constraints* (workspace links only).

1. **Workspace links:**
   - `packages/content/package.json` gets `"dependencies": {"@usurpia/core": "workspace:*", "zod": …}` (keep zod as is).
   - `packages/content/tsconfig.json` gets `"references": [{ "path": "../core" }]`.
   - `packages/sim/package.json` gets `"@usurpia/content": "workspace:*"` next to core.
   - `packages/sim/tsconfig.json` references gain `{ "path": "../content" }`.
   - Run `pnpm install` (it updates `pnpm-lock.yaml` with the two links only), then `pnpm install --frozen-lockfile`.
2. **`packages/sim/src/kernel-rules.ts`:** `export const KERNEL_RULES: Rules = …`, a **verbatim copy** of `TEST_RULES` (same literal and helpers), with a header comment saying it is deleted by 02-05.
   - **`packages/sim/src/rules.ts`:** `export function replayRules(): Rules { return KERNEL_RULES; }`. It is the only place the CLI and tests get rules.
3. **`packages/sim/src/replay-file.ts`:** implement the spec contract.
   - `ReplayFileError`, `RulesMismatchError extends ReplayFileError`.
   - `replayFile(filePath, rules, opts?)`. The file must be a plain object with **exactly** the keys `rulesHash` (8-hex string), `settings`, `actions` (array); otherwise throw `ReplayFileError("expected {rulesHash, settings, actions[]}")`.
   - Check the hash before replaying.
   - `line = hash=<hashState> rules=<rulesHash(rules)> turn=<turn> events=<n> rejections=<n>`, plus the ` rules-mismatch=<fileHash>` suffix when `allowRulesMismatch`.
   - Keep the Phase 1 read/JSON/SettingsError messages.
4. **`packages/sim/src/cli.ts`:**
   - Usage `usage: sim replay <file.json> [--allow-rules-mismatch]`, printed to stderr with exit 2 on a bad argv.
   - Call `replayFile(path.resolve(cwd, file), replayRules(), {allowRulesMismatch})`.
   - `RulesMismatchError` → `error: <msg>` on stderr, exit 3. Any other `ReplayFileError` → exit 2.
   - `packages/sim/src/index.ts` is **not** edited (02-05 owns it); tests import `RulesMismatchError` from `../src/replay-file`.
5. **Delete** `packages/sim/fixtures/sample-game.json`.
6. **`packages/sim/test/replay-file.test.ts`:** rewrite on temp files (`os.tmpdir()`), keeping the Phase 1 CLI subprocess tests in this file (02-01b moves them to `cli.test.ts`):
   - `rulesHash(replayRules()) === "7433ea8b"`.
   - A temp file `{rulesHash:"7433ea8b", settings:<FIXTURE settings>, actions:[]}` → line exactly `hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=0`.
   - `rulesHash:"deadbeef"` → throws `RulesMismatchError` with message `rules mismatch: file deadbeef, current 7433ea8b`.
   - The same file with `{allowRulesMismatch:true}` → the line ends with ` rules-mismatch=deadbeef`.
   - Missing `rulesHash`, an extra key, invalid JSON, a missing file and `players: []` → `ReplayFileError` (message prefixes).
   - CLI subprocesses via `spawnSync(process.execPath, [tsxCli, cliPath, …], {cwd: repoRoot})`: no args → status 2 + usage; the mismatch file → status exactly 3; the valid file → status 0 and stdout the golden line.
7. **Client:**
   - `packages/client/src/demo-rules.ts`: `export const DEMO_RULES: Rules = …`, a verbatim `TEST_RULES` copy.
   - `main.ts`: `createGame({v:2, seed:"demo", players:[{id:"p1",classId:"fighter"},{id:"p2",classId:"caster"}]}, DEMO_RULES)`; render `renderView(viewFor(state,"p2"), [])` into `#app` (with a null check).
   - `render.ts`: the spec's `renderView` lines **without** the ` bag <n>` suffix and without the pending/options lines (02-01a interim). The player line is `<id> <classId> L<level> hp <hp> gold <gold>`.
   - `render.test.ts`: `rulesHash(DEMO_RULES) === "7433ea8b"`. The p2 render contains `Usurpia — viewer: p2`, `turn 1 · active p1 · phase turn`, `p1 fighter L1 hp 48 gold 100`, `p2 caster L1 hp 36 gold 100` and `events:`. The spectator render has the same player lines.
8. **README.md** (critique #13):
   - The replay file is `{ rulesHash, settings, actions }` (write it exactly this way).
   - Document `--allow-rules-mismatch`.
   - CLI exit codes: 0 ok, 1 invalid content (content gate), 2 usage/file error, 3 rules mismatch.
   - Remove every sample/`{ settings, actions }` reference.
   - Do not document `pnpm sim duel` yet (02-05 does).
9. **Tool exclusions (check only):**
   - `grep -qF '.planning/**' eslint.config.js`
   - `grep -qx '.planning/' .prettierignore`
   - `grep -q '"files": \[\]' tsconfig.json`
   - `grep -q '"packages/\*"' vitest.config.ts`

   All four were present at planning time. If any fails, emit `BLOCKED` (the files are forbidden here).
10. **Full pipeline** from the repo root, in order:
    1. `pnpm install --frozen-lockfile`
    2. `pnpm lint`
    3. `pnpm lint:purity`
    4. `pnpm format` (normalize), then `pnpm format:check`
    5. `pnpm typecheck`
    6. `pnpm test`
    7. `pnpm build`
    8. the sample/README grep
    9. `grep -q "rulesHash" README.md`
    10. the import-cycle guard: `pnpm exec tsx --input-type=module -e 'import "./packages/core/src/rules.ts"'`, `pnpm exec tsx --input-type=module -e 'import "./packages/core/src/serialize.ts"'`, and the `@usurpia/core` package import via `pnpm --filter @usurpia/sim exec tsx --input-type=module -e …` (each a fresh process; none may throw a `ReferenceError`)

    Record each command's tail output and the new total test count in the SUMMARY.
11. **Commit** (last step):
    1. Write `.planning/phases/02-combat-core-balance-sim/02-01a-SUMMARY.md`. It contains:
       - the exported API list;
       - test counts (before/after);
       - the golden values observed (`7433ea8b`, `758ef72c`, the W1a replay line);
       - a section headed exactly `## fixtures/build.ts helpers` listing each helper's name and signature (`FIXTURE_SETTINGS`, `newGame`, `applyAll`, `deepFreeze`), reused by name by every later plan;
       - decisions (including the additive `types.ts` step in Task 1);
       - deviations.
    2. `git add packages/core packages/sim packages/content/package.json packages/content/tsconfig.json packages/client pnpm-lock.yaml README.md .planning/phases/02-combat-core-balance-sim/02-01a-SUMMARY.md` (`git add` also stages the deletions under `packages/core` and `packages/sim`).
    3. `git commit` on `dev` with message `Phase 2 plan 02-01a: Kernel v2 data model and Rules threading`, ending with the attribution trailer lines provided in the execution prompt.
    4. Confirm `git show --name-only --format= HEAD` lists no `.tsbuild/`, `dist/` or `node_modules/` path, and that `git status --porcelain` is empty.
    5. Do **not** push (the orchestrator pushes and proves CI).

> verification: pnpm install --frozen-lockfile
> verification: pnpm lint
> verification: pnpm lint:purity
> verification: pnpm format:check
> verification: pnpm typecheck
> verification: pnpm test
> verification: pnpm build
> verification: grep -q 'hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=0' packages/sim/test/replay-file.test.ts
> verification: grep -rnE 'sample/|setSecret|lastRoll|defaultChoice|sample-game|\{ settings, actions \}' packages/*/src packages/*/test packages/sim/fixtures README.md; test $? -eq 1
> verification: grep -q 'rulesHash' README.md
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/rules.ts"'
> verification: pnpm exec tsx --input-type=module -e 'import "./packages/core/src/serialize.ts"'
> verification: pnpm --filter @usurpia/sim exec tsx --input-type=module -e 'import * as c from "@usurpia/core"; if (typeof c.rulesHash !== "function") throw new Error("rulesHash missing")'
> verification: grep -q '^## fixtures/build.ts helpers' .planning/phases/02-combat-core-balance-sim/02-01a-SUMMARY.md
> verification: git log -1 --format=%s | grep -q '^Phase 2 plan 02-01a:'
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
grep -q 'hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=0' packages/sim/test/replay-file.test.ts
grep -rnE 'sample/|setSecret|lastRoll|defaultChoice|sample-game|\{ settings, actions \}' packages/*/src packages/*/test packages/sim/fixtures README.md; test $? -eq 1
grep -q 'rulesHash' README.md
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/rules.ts"'
pnpm exec tsx --input-type=module -e 'import "./packages/core/src/serialize.ts"'
pnpm --filter @usurpia/sim exec tsx --input-type=module -e 'import * as c from "@usurpia/core"; if (typeof c.rulesHash !== "function") throw new Error("rulesHash missing")'
grep -q '^## fixtures/build.ts helpers' .planning/phases/02-combat-core-balance-sim/02-01a-SUMMARY.md
git log -1 --format=%s | grep -q '^Phase 2 plan 02-01a:'
git show --name-only --format= HEAD | grep -E '(^|/)(\.tsbuild|dist|node_modules)/'; test $? -eq 1
  </verify>
  <done>The whole repo is green on the v2 action-less kernel: sim replays v2 files with a rulesHash check (exit 3 on mismatch), the client renders the v2 view, the README is current, and the plan is committed on dev.</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Every command in `verification_commands` exits 0 (full pipeline, goldens, deletions, sample grep, commit checks)
- [ ] `rulesHash` of `TEST_RULES`, `KERNEL_RULES` and `DEMO_RULES` is `7433ea8b` in their respective tests
- [ ] `createGame` golden `758ef72c` plus the canonical JSON string asserted verbatim
- [ ] Every negative test (SettingsError, reducer rejects, shim deserialize, replay file) is a single mutation from a valid fixture (PIT-001), and prototype-member ids are covered (PIT-002)
- [ ] `git status --porcelain` is empty after the commit; nothing in `files_forbidden` changed (`git diff --name-only HEAD~1..HEAD`)
- [ ] Every planned task is completed, blocked with evidence, or escalated; no planned work is self-deferred.
</verification>

<success_criteria>
- Core runs on schema v2 with `reduce(state, action, rules)` and a data-only `Rules`; the sample module is gone.
- `TEST_RULES` hashes to `7433ea8b`; every stats golden row and the `createGame` golden `758ef72c` pass.
- The sim replays v2 files, pins the empty-replay line, and exits 3 on a rules mismatch.
- The full pipeline (install, lint, lint:purity, format:check, typecheck, test, build) is green and committed on `dev`.
</success_criteria>

<output>
After completion, create `.planning/phases/02-combat-core-balance-sim/02-01a-SUMMARY.md` with: the exported API list, test counts (before 263 / after), the observed goldens, the full-pipeline tail outputs, a `## fixtures/build.ts helpers` section (helper names and signatures, reused by later plans), decisions and deviations. It is committed in the Task 3 commit.
</output>
