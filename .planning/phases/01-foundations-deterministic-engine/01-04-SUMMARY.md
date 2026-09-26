# Plan 01-04 Summary: Views, Sim & Client Shells

**Status:** Complete with Warnings. All verification is green; one test expectation in the plan was unsatisfiable under the plan's own render/view contracts and was adapted (Decision 1).
**Agent:** engineering-senior-developer-01-04 (leak properties and final pipeline sign-off done in-agent; no separate QA agent spawned)
**Requirements:** R3 (redaction), R1 (end-to-end green)

## Files
**Created**
- `packages/core/src/views.ts`: `Viewer`, `PlayerView`, `viewFor`, `redactEvent`, `eventsFor`. `viewFor` builds a new `{ v, viewer, public, self }` object and never spreads `state`.
- `packages/core/test/views.test.ts`: 9 example tests plus the sentinel leak property (`numRuns: 200`).
- `packages/sim/src/replay-file.ts`: `ReplayFileError`, `replayFile(filePath)`.
- `packages/sim/src/cli.ts`: `pnpm sim replay <file>` (usage / `ReplayFileError` → exit 2).
- `packages/sim/fixtures/sample-game.json`: the plan's fixture, verbatim.
- `packages/sim/test/replay-file.test.ts`: 11 tests (fixture line, determinism, rejection/events/lastReveal, 4 error cases, 4 CLI subprocess tests).
- `packages/client/src/render.ts`: pure `renderView(view, events)`.
- `packages/client/test/render.test.ts`: 4 tests.

**Modified**
- `packages/core/src/index.ts`: adds `viewFor`, `redactEvent`, `eventsFor` and the `Viewer`, `PlayerView` types.
- `packages/sim/src/index.ts`: now `export { replayFile, ReplayFileError } from "./replay-file";`.
- `packages/client/src/main.ts`: creates the demo game, applies roll + setSecret by p1, renders p2's view into `#app`.

**Deleted**
- `packages/sim/test/smoke.test.ts`, `packages/client/test/smoke.test.ts`. No `packages/*/test/smoke.test.ts` remains.

## Fixture
`pnpm sim replay packages/sim/fixtures/sample-game.json` prints:

```
hash=595a3c9a turn=3 counter=3 events=10 rejections=1
```

Fixture hash: **`595a3c9a`**. The third action (p1 rolling out of turn) is rejected with `WRONG_ACTOR` at index 2; the event sequence and `lastReveal = {decisionId:"d1", choices:{p1:"B", p2:"A"}, timedOut:["p2"]}` match the plan exactly.

## Leak Property
For each of 200 generated games (`arbSettings` × `arbScript`), every player first sets the note `__SECRET_<pid>__`; the arbitrary script is then folded. Before the first scripted action and after every one, for every viewer in `[...players, "spectator"]`:
- `JSON.stringify(viewFor(state, viewer))` contains no other player's sentinel, no `"rng"`, no `"decisionSeq"`, and the view has no `hidden` key;
- `JSON.stringify(eventsFor(events, viewer))` contains no other player's sentinel;
- every `SecretSet` returned by `eventsFor` belongs to the viewer, and no `ChoiceCommitted` has a `choice` key.

A sanity assertion confirms each owner *does* see their own sentinel after setup, so the negative checks are meaningful.

**Negative check:** I temporarily made `viewFor` also return `state.private`. The property failed immediately (counterexample `[{"v":1,"seed":" ","players":["p1"]},[]]`: the spectator saw p1's sentinel), as did two example tests. Reverted; the file matches the committed version.

## Pipeline Output (tails, run from the repo root in plan order)
| Command | Result |
|---------|--------|
| `pnpm install --frozen-lockfile` | `Lockfile is up to date … Already up to date` (exit 0) |
| `pnpm lint` | `eslint .`, no output (exit 0) |
| `pnpm lint:purity` | `✓ core purity rules active` |
| `pnpm format` then `pnpm format:check` | `All matched files use Prettier code style!` |
| `pnpm typecheck` | `tsc -b`, exit 0 |
| `pnpm test` | `Test Files 10 passed (10)` / `Tests 181 passed (181)` |
| `pnpm build` | `content build: ✓ content valid (1 files)`; `client build: dist/index.html 0.31 kB … ✓ built` |
| sim replay grep | exit 0 (line above) |
| `test -f packages/client/dist/index.html` | exit 0 |
| no smoke tests | `ls packages/*/test/smoke.test.ts \| wc -l` → 0 |

Task-level `> verification:` lines: Task 1 4/4, Task 2 3/3, Task 3 5/5. Frontmatter `verification_commands`: 10/10.

## ROADMAP Phase 1 Success Criteria → Evidence
| # | Criterion | Evidence command |
|---|-----------|------------------|
| 1 | install/lint/typecheck/test/build pass locally and in GitHub Actions on `dev` | Local: the pipeline table above. CI: see the **CI** section below. Trigger check: `grep -Eq 'branches: \[dev, main\]' .github/workflows/ci.yml` |
| 2 | Reducer applies a sample action and emits events; replay reproduces an identical state hash | `pnpm vitest run packages/core/test/replay.test.ts` (determinism + mid-replay serialize properties, 200 runs each); `pnpm vitest run packages/sim` (fixture replayed twice gives the identical `hash=595a3c9a` line) |
| 3 | State, actions and events round-trip through JSON with a schema version | `pnpm vitest run packages/core/test/serialize.test.ts` |
| 4 | Wrong `playerId`/phase rejected; `viewFor`/`redactEvent` hide a sample secret | `pnpm vitest run packages/core/test/reducer.test.ts packages/core/test/views.test.ts` |
| 5 | Commit/reveal and `timeout` resolve deterministically | `pnpm vitest run packages/core/test/decision.test.ts`; fixture `lastReveal` assertion in `packages/sim/test/replay-file.test.ts` |
| 6 | Invalid content data fails the build via zod | `pnpm vitest run packages/content/test/validate.test.ts` (CLI subprocess on the invalid fixture exits 1) |

## CI
- **Run:** https://github.com/ace027/Dokapon-kingdom-2/actions/runs/36259612598 (CI run #4, event `push`, branch `dev`)
- **Head SHA:** `c7c50743132aab06fbbc2c2d09a75f7f1455c535` (the plan 01-04 commit)
- **Result:** `status: completed`, `conclusion: success`

This commit only adds the run URL to this SUMMARY; `.planning/` is excluded from Prettier, and no code changed.

## Decisions / Deviations
1. **p2 render assertion adapted (plan-internal conflict).** Task 3 asked that p2's render *not* contain `your note`. But the execution contract says the note line appears whenever `self` is non-null (`(none)` for a null note), and `viewFor` gives a seated player their own `self` (`{note: null}` for p2). Both contracts are kept; the test instead asserts that p2's render contains `your note: (none)` and does not contain `p1 secret` or `SecretSet`. The "no `your note` line" case is covered by the spectator render test. This preserves the assertion's intent (p2 never sees p1's note).
2. **`Viewer` keeps the spec union `PlayerId | "spectator"`** with the same `no-redundant-type-constituents` eslint-disable that 01-02 used for `Actor`.
3. **`viewFor` sets `v: state.v`** (typed `typeof SCHEMA_VERSION`), rather than importing the constant as a value.
4. **`replayFile` treats settings and actions as untrusted.** It casts them to the spec types only to call `replay`; `createGame` re-validates settings and `reduce` guards every action. Non-`SettingsError` exceptions are rethrown (the CLI then crashes loudly rather than masking a core bug).
5. **The shape check is "plain object with a `settings` key and an `actions` array"**, so arrays, `null` and `{actions:{}}` all give `expected {settings, actions[]}` (tested).
6. **CLI subprocess method** is the one from 01-03 (`spawnSync(process.execPath, [require.resolve("tsx/cli"), cliPath, …], { cwd: repoRoot })`), with `repoRoot = ../../../` from `packages/sim/test/`.
7. **Extra tests beyond the plan list:** CLI exit 0 on the relative fixture path from the repo root, exit 2 for an unknown command / extra argument / missing file, and an exact line-layout render test.

## Issues
- The plan-internal conflict in Decision 1. No core semantics were changed; no leak or determinism counterexample was found.
- No files outside `files_modified` were changed. No dependencies changed.
