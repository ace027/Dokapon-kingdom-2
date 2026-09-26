# Spec: Phase 1 — Foundations & Deterministic Engine

## Overview
Phase 1 lays the foundation every later Usurpia system plugs into:
- a pnpm monorepo with strict TypeScript, lint, format, test and CI;
- a **pure, deterministic, online-ready rules-engine kernel** in `packages/core`;
- a **zod content pipeline** in `packages/content` that fails the build on invalid data;
- thin `sim` and `client` shells that exercise the kernel end-to-end.

The gameplay here is a deliberately tiny *sample module* (increment, roll, private secret, hidden-choice decision). It exists only to prove the engine contracts: determinism, replay, serialization, actor/phase guards, redaction, commit/reveal and timeouts. Combat (Phase 2) and the board (Phase 3) will replace or extend it.

Architecture direction (user-selected, 2026-09-26): a **hybrid of Pragmatic + Clean**.
- From Pragmatic: sfc32 RNG, a handler map returning a `Result`, no immer, `tsc -b` project references and fast-check.
- From Clean: state partitioned into `public` / `private` / `hidden`, `PendingDecision` commit/reveal with a `system`-actor `timeout`, and an import-boundary lint for core.

## Requirements
| ID | Description | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| R1 | pnpm monorepo (`core`, `content`, `client`, `sim`), strict TS, Vite, Vitest, ESLint/Prettier, GitHub Actions CI on `dev`/`main` | Must | `pnpm install --frozen-lockfile && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` exits 0; `.github/workflows/ci.yml` runs the same steps on push to `dev`/`main` and on PRs targeting them |
| R2 | Pure deterministic `reduce(state, action) -> {state, events}` with seeded RNG in state; replay from `(settings, actions)` | Must | Vitest: replaying the same settings+actions twice yields identical `stableStringify(state)`; fast-check property over random action sequences passes (≥ 200 runs); golden sfc32 outputs for seed `"usurpia"` are pinned |
| R3 | Online readiness: JSON-serializable versioned state/actions/events; `playerId` on every action; per-player redacted views/events; commit/reveal; timeouts as actions | Must | Vitest: `deserialize(serialize(s))` deep-equals `s`; version mismatch throws `SchemaVersionError`; wrong actor/phase is rejected with a specific code; `viewFor` never contains `hidden` or other players' `private` (sentinel leak property test); commit/reveal and `timeout` resolve deterministically |
| R4 | Data-driven `content` package with zod schemas validated at build time | Must | `pnpm --filter @usurpia/content build` exits non-zero when any data file is invalid (proved by a Vitest test using an invalid fixture through the same `validateContent` function); valid shipped data passes |

## Architecture
```
repo root
├─ package.json            (private, "type":"module", packageManager pnpm@10.33.0, engines node >=22.12)
├─ pnpm-workspace.yaml     (packages: ["packages/*"])
├─ pnpm-lock.yaml
├─ tsconfig.base.json      (shared compilerOptions)
├─ tsconfig.json           (solution file: files [], references to all 4 packages)
├─ eslint.config.js        (flat config; typed strict; core purity + import boundaries)
├─ .prettierrc.json / .prettierignore / .gitignore / .nvmrc (22)
├─ scripts/check-core-purity.mjs  (scripted negative lint probe; run by `pnpm lint:purity` in CI)
├─ vitest.config.ts        (test.projects: ["packages/*"])
├─ .github/workflows/ci.yml
└─ packages/
   ├─ core/     @usurpia/core    zero runtime deps; lib ES2022, types []
   │  └─ src/{index,rng,hash,serialize,types,actions,events,reducer,handlers,game,replay,views}.ts + test/*.test.ts
   ├─ content/  @usurpia/content  dep: zod
   │  ├─ src/{index,schemas/common,schemas/items,registry,validate}.ts
   │  ├─ data/items.json
   │  ├─ scripts/validate.ts   (CLI wrapper; exit 1 on error)
   │  └─ test/{validate.test.ts, fixtures/invalid/items.json, fixtures/valid/items.json}
   ├─ sim/      @usurpia/sim      Node CLI via tsx: `replay <file>`
   │  └─ src/{cli,replay-file}.ts + test/replay-file.test.ts + fixtures/sample-game.json
   └─ client/   @usurpia/client   Vite app; lib DOM; text-only view stub (Phaser arrives in Phase 4)
      └─ index.html, vite.config.ts, src/{main,render}.ts + test/render.test.ts
```

**Dependency direction:**
- `client` → `core`
- `sim` → `core`
- `content` stands alone in Phase 1
- `core` → nothing. ESLint forbids core from importing `node:*`, `zod`, `@usurpia/client`, `@usurpia/sim` and `@usurpia/content`. Phase 2 decides how core receives content, likely as plain typed data passed in settings; that change will relax the rule deliberately.

### Key Decisions
| Decision | Choice | Rationale | Alternatives Considered |
|----------|--------|-----------|------------------------|
| RNG | sfc32 (4×u32 state) seeded by cyrb128(seed string) | Tiny, fast, well-distributed, passes PractRand to large sizes; 4-word state is trivially JSON; `Math.imul`/`>>>0` makes it bit-identical across JS engines | mulberry32 (32-bit state, weaker), xoshiro128** (similar quality, more code) |
| RNG threading | `RngState` stored in `state.hidden.rng`; handlers draw via a reducer-local `ctx.random` that updates `ctx.rng`; reducer writes it back | Keeps handlers readable while `reduce` stays pure from the outside; RNG is never visible to clients (hidden partition) | Returning `[value, rng']` tuples through every handler (noisy) |
| State shape | `GameState = { v, public, private: Record<PlayerId, PrivateState>, hidden }` | Redaction becomes structural (drop `hidden` and other players' `private`) instead of hand-written per field; every later module must choose a partition consciously | Flat state + `secrets[pid]` (Pragmatic) — easier now, leak-prone later |
| Reducer | Handler map `satisfies HandlerMap` (exhaustive over `Action['type']`), each handler declares `phases` + `actor` rule + optional `validate` + `apply`; `reduce` returns `ReduceResult` (`ok`/`error`) and never throws for bad input | Exhaustiveness checked by TS; guards are uniform; rejections are data (needed for server + CPU legal-move checks) | Declaration-merging registry (Clean) — heavier types; switch statement — no per-handler metadata |
| Immutability | Plain objects + spreads, `readonly` types; no immer | Sim hot loop in Phases 2–3 runs 10k+ games; avoid immer overhead; state is small | immer (ergonomic, slower), mutative |
| Commit/reveal | Server-authoritative: `decision/commit` stores choice in `hidden.decision.choices`; public only sees who committed; reveal when all required committed; `timeout` (actor `system`) fills missing with `defaultChoice` | Online plan is server-authoritative (design doc), so no hashing needed; same flow serves hot-seat, CPU and online | Salted hash commitments (only needed for P2P) |
| Serialization | `stableStringify` (sorted keys; throws on `undefined`, functions, non-finite numbers, non-plain objects) + `serialize`/`deserialize` with `SCHEMA_VERSION = 1` check | Canonical JSON gives deterministic hashes and catches non-JSON values early | `JSON.stringify` (key-order dependent, silently drops undefined) |
| State hash | FNV-1a 32-bit over canonical JSON, 8-char hex | Cheap desync/replay fingerprint for sim output; tests compare full canonical strings for strength | SHA-256 via `node:crypto` (not available in pure core) |
| TS toolchain | TypeScript **~6.0.3** | typescript-eslint 8.70.1 peer range is `typescript >=4.8.4 <6.1.0`; TS 7.0 would break typed lint | TS 7.0.2 (faster, but lint-incompatible today) |
| TS build | `tsc -b` project references used as the **type-check graph only**. Every package `tsconfig.json` is `composite: true`, `emitDeclarationOnly: true`, `outDir: ".tsbuild"` (gitignored), `rootDir: "."`, and `include`s `src/**`, `test/**` plus (where present) `scripts/**` and `*.config.ts`, so tests and tool configs are type-checked and visible to ESLint's project service. Packages that import `@usurpia/core` list `"references": [{ "path": "../core" }]`. Package `exports` point to `./src/index.ts`; no package emits runtime JS in Phase 1 (Vite bundles the client, tsx runs sim/scripts, Vitest runs tests) | One typecheck graph covering src **and** tests; no collision with Vite's `dist/`; future server adds a bundling step in Phase 8 | Separate src/test tsconfigs per package (more files); source-only `tsc --noEmit` (Minimal) |
| Test runner | Vitest 5 root `vitest.config.ts` with `test.projects: ["packages/*"]` | Single `pnpm test` across packages; Vitest 5 uses `projects` (workspace files are removed) | Per-package `vitest run` via `pnpm -r` |
| Lint | ESLint 10 flat config: `@eslint/js` recommended + `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked` with `parserOptions.projectService: { allowDefaultProject: ["eslint.config.js", "vitest.config.ts", "scripts/*.mjs"] }` and `tsconfigRootDir: import.meta.dirname`; `tseslint.configs.disableTypeChecked` applied to `**/*.{js,mjs}`; `eslint-config-prettier` last; ignores `**/dist/**`, `**/.tsbuild/**`, `**/coverage/**`, `.planning/**`. Core override (`packages/core/src/**/*.ts`) uses built-in `no-restricted-globals` (Date, performance, setTimeout, setInterval, setImmediate, crypto, window, document, process, globalThis, console), `no-restricted-properties` (Math.random), `no-restricted-imports` (patterns `node:*`, `fs`, `path`, `zod`, `@usurpia/client`, `@usurpia/sim`, `@usurpia/content`) | Purity and boundaries enforced without extra plugins; tool config files covered without being in a tsconfig | `eslint-plugin-import-x` (extra dep, not needed) |
| Content validation | `validateContent(entries)` pure function (schema parse + duplicate-id check) used by both the CLI script and tests; content `build` script = `tsx scripts/validate.ts && tsc -b` | One code path proves the gate; CI fails on invalid data | Validation only in tests (wouldn't fail `build`) |

## API and Type Contracts

### `@usurpia/core` (exported from `packages/core/src/index.ts`)
```ts
// types.ts
export const SCHEMA_VERSION = 1 as const;
export const SYSTEM_ACTOR = 'system' as const;
export type PlayerId = string;                 // /^[A-Za-z0-9_-]{1,32}$/; RESERVED (rejected by createGame): 'system', 'spectator', '__proto__', 'constructor', 'prototype'
export const RESERVED_IDS: readonly string[];  // exactly the five above
export type Actor = PlayerId | typeof SYSTEM_ACTOR;
export type Phase = 'turn' | 'decision';
export type Choice = 'A' | 'B' | 'C';          // sample hidden-choice alphabet
export interface GameSettings { readonly v: 1; readonly seed: string; readonly players: readonly PlayerId[] } // 1–4 unique ids
export interface PendingDecisionPublic { readonly id: string; readonly kind: 'sample'; readonly required: readonly PlayerId[]; readonly committed: readonly PlayerId[] }
export interface PublicState {
  readonly phase: Phase; readonly turn: number; readonly activePlayer: PlayerId;
  readonly players: readonly PlayerId[]; readonly counter: number;
  readonly lastRoll: { readonly playerId: PlayerId; readonly value: number } | null;
  readonly pending: PendingDecisionPublic | null;
  readonly lastReveal: { readonly decisionId: string; readonly choices: Readonly<Record<PlayerId, Choice>>; readonly timedOut: readonly PlayerId[] } | null;
}
export interface PrivateState { readonly note: string | null }
export interface HiddenState {
  readonly rng: RngState; readonly decisionSeq: number;
  readonly decision: { readonly id: string; readonly defaultChoice: Choice; readonly choices: Readonly<Record<PlayerId, Choice>> } | null;
}
export interface GameState { readonly v: typeof SCHEMA_VERSION; readonly public: PublicState; readonly private: Readonly<Record<PlayerId, PrivateState>>; readonly hidden: HiddenState }

// actions.ts — every action carries v + playerId
export type Action =
  | { v: 1; type: 'sample/increment'; playerId: PlayerId; amount: number }          // integer 1..10, active player, phase 'turn'
  | { v: 1; type: 'sample/roll'; playerId: PlayerId }                               // active player, phase 'turn'; d6 via RNG; advances activePlayer, turn += 1
  | { v: 1; type: 'sample/setSecret'; playerId: PlayerId; note: string }            // any player, any phase; 0..64 chars
  | { v: 1; type: 'decision/open'; playerId: typeof SYSTEM_ACTOR; required: PlayerId[]; defaultChoice: Choice } // system only, phase 'turn'; required = non-empty subset of players, unique
  | { v: 1; type: 'decision/commit'; playerId: PlayerId; decisionId: string; choice: Choice } // phase 'decision'; playerId ∈ required, not yet committed
  | { v: 1; type: 'timeout'; playerId: typeof SYSTEM_ACTOR; decisionId: string };  // system only, phase 'decision'

// events.ts
export type Visibility = { kind: 'public' } | { kind: 'players'; ids: readonly PlayerId[] };
export type GameEvent =
  | { v: 1; type: 'CounterIncremented'; visibility: Visibility; playerId: PlayerId; amount: number; counter: number }
  | { v: 1; type: 'Rolled'; visibility: Visibility; playerId: PlayerId; value: number }
  | { v: 1; type: 'TurnAdvanced'; visibility: Visibility; activePlayer: PlayerId; turn: number }
  | { v: 1; type: 'SecretSet'; visibility: Visibility; playerId: PlayerId; note: string }        // visibility = players [playerId]
  | { v: 1; type: 'DecisionOpened'; visibility: Visibility; decisionId: string; required: readonly PlayerId[] }
  | { v: 1; type: 'ChoiceCommitted'; visibility: Visibility; decisionId: string; playerId: PlayerId } // public; NO choice field
  | { v: 1; type: 'ChoiceTimedOut'; visibility: Visibility; decisionId: string; playerId: PlayerId }
  | { v: 1; type: 'ChoicesRevealed'; visibility: Visibility; decisionId: string; choices: Readonly<Record<PlayerId, Choice>>; timedOut: readonly PlayerId[] };

// reducer.ts
export type RejectCode = 'UNSUPPORTED_VERSION' | 'UNKNOWN_ACTION' | 'WRONG_ACTOR' | 'WRONG_PHASE' | 'INVALID_PAYLOAD' | 'STALE_DECISION' | 'ALREADY_COMMITTED';
export interface Reject { readonly code: RejectCode; readonly message: string }
export type ReduceResult = { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] } | { readonly ok: false; readonly error: Reject };
export function reduce(state: GameState, action: unknown): ReduceResult;  // accepts untrusted input (network/fuzz); never throws on bad actions; never mutates input
// Review cycle 1 amendment: reduce first canonicalizes `action` via JSON.parse(stableStringify(action)) inside try/catch (any throw → UNSUPPORTED_VERSION if not a plain object, else INVALID_PAYLOAD), so getters/Proxies/sparse arrays are read exactly once; all later steps use only the canonical copy. All lookups into records keyed by PlayerId use Object.hasOwn (never `in`/bare index + ??) so ids that collide with Object.prototype members (toString, valueOf, …) behave like any other id. Reject messages never echo more than 64 chars of attacker-supplied input.
export function isAction(value: unknown): value is Action;                // same shape guard reduce uses (exported for sim/tests)

// game.ts
export class SettingsError extends Error {}
export function createGame(settings: GameSettings): GameState;          // throws SettingsError on invalid settings (0 or >4 players, dupes, bad id, 'system', empty seed, v≠1)

// replay.ts
export interface ReplayResult { readonly state: GameState; readonly events: readonly GameEvent[]; readonly rejections: readonly { index: number; error: Reject }[] }
export function replay(settings: GameSettings, actions: readonly Action[]): ReplayResult;

// rng.ts
export type RngState = readonly [number, number, number, number];
export function seedRng(seed: string): RngState;                          // bryc cyrb128 over UTF-16 code units (charCodeAt) → [h1,h2,h3,h4]>>>0; if all four are 0, use [1,0,0,0]
export function nextU32(rng: RngState): [number, RngState];               // bryc sfc32 (one step; see reference below)
export function nextInt(rng: RngState, min: number, max: number): [number, RngState]; // inclusive; span=max-min+1; limit=2**32-(2**32%span); draw u=nextU32 until u<limit; return min+(u%span). Throws RangeError if min>max, non-safe-integers, or span>2**32

// hash.ts / serialize.ts
export function stableStringify(value: unknown): string;                  // sorted keys; throws TypeError on undefined/function/symbol/bigint/non-finite/non-plain object
export function fnv1a32(text: string): string;                            // FNV-1a 32 over UTF-16 code units (offset 0x811c9dc5, prime 0x01000193 via Math.imul), >>>0, 8 lowercase hex
export function hashState(state: GameState): string;                      // fnv1a32(stableStringify(state))
export class SchemaVersionError extends Error {}
export function serialize(state: GameState): string;                      // = stableStringify(state)
export function deserialize(json: string): GameState;                     // JSON.parse (SyntaxError propagates); value must be a plain object else TypeError; v !== 1 → SchemaVersionError; then FULL shape validation (review cycle 1 amendment) — TypeError unless ALL of: public/private/hidden are plain objects; public.players passes the same rules as createGame (1–4 unique ids matching PLAYER_ID_PATTERN, none in RESERVED_IDS); public.activePlayer ∈ players; public.phase ∈ {'turn','decision'}; public.turn, public.counter, hidden.decisionSeq are non-negative safe integers; own keys of private equal players exactly and each value is {note: string|null}; public.lastRoll is null or {playerId ∈ players, value int 1..6}; public.pending and hidden.decision are either both null (phase 'turn') or both valid (phase 'decision'): pending {id string, kind 'sample', required non-empty unique ⊆ players, committed unique ⊆ required}, decision {id === pending.id, defaultChoice ∈ Choice, choices plain object whose own keys equal committed and values ∈ Choice}; public.lastReveal is null or {decisionId string, choices plain object with own keys ⊆ players and values ∈ Choice, timedOut ⊆ players}; hidden.rng is an array of 4 integers in [0, 2**32)

// views.ts
export type Viewer = PlayerId | 'spectator';
export interface PlayerView { readonly v: typeof SCHEMA_VERSION; readonly viewer: Viewer; readonly public: PublicState; readonly self: PrivateState | null }
export function viewFor(state: GameState, viewer: Viewer): PlayerView;   // never includes hidden or others' private; self = state.private[viewer] if viewer ∈ players else null (spectator/unknown id)
export function redactEvent(event: GameEvent, viewer: Viewer): GameEvent | null; // null if not visible to viewer
export function eventsFor(events: readonly GameEvent[], viewer: Viewer): GameEvent[];
```
Initial state from `createGame`:
- `phase:'turn'`, `turn:1`, `activePlayer: players[0]`, `counter:0`, `lastRoll:null`, `pending:null`, `lastReveal:null`
- `private[p] = {note:null}` for each player
- `hidden = {rng: seedRng(seed), decisionSeq:0, decision:null}`
- Decision ids are `` `d${decisionSeq+1}` `` at open time, then `decisionSeq` increments.

**Reference algorithms and golden vectors.** These were computed by the planner from bryc's published reference JS (`github.com/bryc/code/blob/master/jshash/PRNGs.md`) and are pinned in `rng.test.ts` / `serialize.test.ts`. An implementation that disagrees is wrong.

```js
// cyrb128 (reference)
let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
for (let i=0,k;i<str.length;i++){ k=str.charCodeAt(i);
  h1=h2^Math.imul(h1^k,597399067); h2=h3^Math.imul(h2^k,2869860233);
  h3=h4^Math.imul(h3^k,951274213); h4=h1^Math.imul(h4^k,2716044179); }
h1=Math.imul(h3^(h1>>>18),597399067); h2=Math.imul(h4^(h2>>>22),2869860233);
h3=Math.imul(h1^(h3>>>17),951274213); h4=Math.imul(h2^(h4>>>19),2716044179);
h1^=(h2^h3^h4); h2^=h1; h3^=h1; h4^=h1; return [h1>>>0,h2>>>0,h3>>>0,h4>>>0];
// sfc32 step (reference) on state [a,b,c,d]
let t=(a+b)|0; a=b^(b>>>9); b=(c+(c<<3))|0; c=(c<<21)|(c>>>11); d=(d+1)|0; t=(t+d)|0; c=(c+t)|0;
// output t>>>0, new state [a>>>0,b>>>0,c>>>0,d>>>0]
```

| Vector | Expected |
|--------|----------|
| `seedRng("usurpia")` | `[2424685999, 2448471286, 44465632, 3153165131]` |
| first 5 `nextU32` from that seed | `[3731355121, 1703163097, 1097702884, 3554771409, 3521645566]` |
| first 10 `nextInt(·,1,6)` from that seed | `[2, 2, 5, 4, 5, 6, 4, 6, 1, 1]` |
| `fnv1a32("")`, `fnv1a32("a")`, `fnv1a32('{"a":1}')` | `811c9dc5`, `e40c292c` (matches the official FNV test vector), `8b9e4511` |

**Transition semantics:**

- **`sample/increment`**
  - `counter += amount`.
  - Emits `CounterIncremented`.
  - Does **not** advance the turn.
- **`sample/roll`**
  1. `value = nextInt(1,6)`.
  2. `lastRoll = {playerId, value}`.
  3. `activePlayer = players[(indexOf(activePlayer)+1) % players.length]` and `turn += 1`. This happens on every roll, including 1-player games, where the active player stays the same.
  4. Emits `Rolled`, then `TurnAdvanced`.
- **`sample/setSecret`**
  - Sets `private[playerId].note = note` (an empty string is allowed).
  - Emits `SecretSet`.
  - Allowed in both phases.
- **`decision/open`**
  - `id = "d"+(decisionSeq+1)` and `decisionSeq += 1`.
  - Sets `hidden.decision = {id, defaultChoice, choices:{}}`, `public.pending = {id, kind:'sample', required, committed:[]}` and `phase = 'decision'`.
  - Emits `DecisionOpened`.
  - `lastReveal` is left unchanged.
- **`decision/commit`**
  - Records the choice and appends the player to `committed`.
  - Emits `ChoiceCommitted`.
  - If every player in `required` has now committed, also runs **reveal** with `timedOut: []`. Event order is `ChoiceCommitted`, then `ChoicesRevealed`.
- **`timeout`**
  - For each player in `required` (in `required` order) who hasn't committed: `choices[p] = defaultChoice` and emit `ChoiceTimedOut`.
  - Then runs **reveal** with `timedOut` set to those players.
  - A timeout can only happen in phase `decision` with at least one player missing; once everyone has committed, the phase is already `turn`, so a later `timeout` gets `WRONG_PHASE`.

**Event visibility:** every event is `{kind:'public'}` except `SecretSet`, which is `{kind:'players', ids:[playerId]}`.

`redactEvent(e, viewer)` returns `e` when the event is public or the viewer is in `ids`, and `null` otherwise. Spectators only see public events.

**Replay:** keeps going after a rejection. A rejected action leaves state unchanged and is recorded in `rejections`.

**Reveal behavior:** when the last required player commits, or on `timeout`:
- emit `ChoicesRevealed` (public);
- set `public.lastReveal`;
- clear `public.pending` and `hidden.decision`;
- set `phase:'turn'`.

On `timeout`, emit one `ChoiceTimedOut` per missing player (in `required` order) **before** `ChoicesRevealed`. Choices are keyed in `required` order when building objects (`stableStringify` sorts anyway).

### `@usurpia/content` (exported from `packages/content/src/index.ts`)
```ts
export const IdSchema: z.ZodString;                // /^[a-z][a-z0-9-]{0,47}$/
export const ItemSchema: z.ZodObject<...>;         // { id: Id, name: string 1..40, kind: 'consumable'|'gear'|'joke', price: int >= 0, description: string 1..200 }
export const ItemsFileSchema: z.ZodObject<...>;    // { v: literal 1, items: ItemSchema[] (min 1) }
export type Item = z.infer<typeof ItemSchema>;
export interface ContentEntry { readonly file: string; readonly data: unknown }  // file = path relative to data dir, e.g. "items.json"
export interface ContentError { readonly file: string; readonly path: string; readonly message: string } // path like "items.2.price" or "" for file-level
export const CONTENT_REGISTRY: Readonly<Record<string, z.ZodType>>;  // { "items.json": ItemsFileSchema }
export function validateContent(entries: readonly ContentEntry[]): ContentError[]; // unknown file → error; missing registered file → error; schema issues; duplicate ids within a file
export function loadContentDir(dir: string | URL): ContentEntry[];  // in src/load.ts (Node-only, uses node:fs); reads every *.json (sorted by name) in dir; JSON parse failure → returns entry with data = undefined and validateContent reports "invalid JSON"; NOT re-exported from index.ts to keep index browser-safe
```
`scripts/validate.ts` works as follows:
- It accepts an optional `--dir <path>` argument (resolved against `process.cwd()`), defaulting to `new URL('../data/', import.meta.url)`. It calls `loadContentDir(dir)` and then `validateContent`.
- It prints each error as `✗ {file} {path}: {message}`, then `process.exit(1)`.
- On success it prints `✓ content valid ({n} files)`.

### `@usurpia/sim`
- CLI: `pnpm sim replay <path-to-json>`. The root script is `"sim": "tsx packages/sim/src/cli.ts"`, so cwd is the repo root and relative paths resolve from there; the CLI also resolves the path with `path.resolve(process.cwd(), arg)`. The file is `{ "settings": GameSettings, "actions": unknown[] }`, and actions pass through `reduce` untrusted.
  - Prints `hash=<8hex> turn=<n> counter=<n> events=<n> rejections=<n>` on one line, then exits 0.
  - Exits 2 on unreadable or invalid JSON (prints `error: …` to stderr).
- `replayFile(path: string): { line: string; result: ReplayResult }` is exported from `src/replay-file.ts` for tests.

### `@usurpia/client`
- `renderView(view: PlayerView, events: readonly GameEvent[]): string` is a pure text renderer, tested.
- `main.ts`:
  1. Creates a game (seed `"demo"`, players `["p1","p2"]`).
  2. Applies `sample/roll` for `p1` and `sample/setSecret` for `p1`.
  3. Renders `renderView(viewFor(state,'p2'), eventsFor(events,'p2'))` into `<pre id="app">`.

## File Placement
| Artifact | Path | Placement Rationale | Existing Pattern |
|----------|------|---------------------|------------------|
| Workspace root config | `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.nvmrc` | Standard pnpm monorepo root | Design doc Technical Direction |
| CI | `.github/workflows/ci.yml` | GitHub Actions convention | — |
| Core kernel | `packages/core/src/*.ts`, `packages/core/test/*.test.ts` | Package per design doc; tests outside `src` so `tsc -b` emit excludes them | PROJECT.md Architecture Influences |
| Content | `packages/content/{src,data,scripts,test}` | Data separate from schemas; script is a thin CLI | Design doc "packages/content" |
| Sim | `packages/sim/{src,test,fixtures}` | CLI package | Design doc balance sim |
| Client | `packages/client/{index.html,vite.config.ts,src,test}` | Vite app layout | Vite default |

## Data and Control Flow
1. `createGame(settings)` validates the settings, seeds the RNG and builds the partitioned state.
2. `reduce(state, action: unknown)` checks in this **exact precedence**; the first failure wins:
   1. `UNSUPPORTED_VERSION` if `action` is not a plain object, or its `v !== 1`.
   2. `UNKNOWN_ACTION` if `type` is not one of the six known strings.
   3. `INVALID_PAYLOAD` if the type's shape guard fails. The guard checks only field presence and types, plus state-independent ranges:
      - `playerId` is a string;
      - `amount` is an integer in 1..10;
      - `note` is a string of 0..64 chars;
      - `choice` is 'A', 'B' or 'C';
      - `required` is an array of strings;
      - `defaultChoice` is valid;
      - `decisionId` is a string;
      - no extra keys beyond those declared.
   4. `WRONG_PHASE` if the handler's `phases` don't include `public.phase`.
   5. `WRONG_ACTOR` if the handler's actor rule fails.
   6. State-dependent validation, in this order: `INVALID_PAYLOAD` → `STALE_DECISION` → `ALREADY_COMMITTED`.
      - `INVALID_PAYLOAD` covers `required` being non-empty, unique and a subset of players.
      - `STALE_DECISION` means `decisionId` doesn't match `pending.id`.
   7. `apply(state, action, ctx)`.
   8. Write `ctx.rng` into `hidden.rng`.
   9. Return `{ok:true, state, events}`.

   Rejections return the input state object untouched (the reference is not used).

   Actor rules:

   | Rule | Accepts |
   |------|---------|
   | `active` | `playerId === public.activePlayer` |
   | `any-player` | any `playerId` in `public.players` |
   | `system` | `playerId === 'system'` |
   | `required` | `playerId ∈ public.pending.required` |
3. `replay` folds `reduce` over the actions from `createGame(settings)`, collecting events and rejections (with the index).
4. `viewFor` and `redactEvent` project state and events for a viewer. Clients (Phase 4) and the server (post-MVP) only ever send projections.
5. Content: `data/*.json` → `loadContentDir` → `validateContent` → the CLI exit code gates `build`; tests call `validateContent` directly on fixtures.
6. CI: install (frozen lockfile) → lint → format:check → typecheck (`tsc -b`) → test (`vitest run`) → build (`pnpm -r run build`, which is topological: content validate + tsc, core/sim tsc, client vite build).

## Compatibility Constraints
- Node ≥ 22.12 (Vite 8 engines `^20.19 || >=22.12`); `.nvmrc` = `22`; CI uses Node 22.
- pnpm 10.33.0 via the `packageManager` field (CI uses `pnpm/action-setup@v4`, which reads it).
- **TypeScript ~6.0.3 (not 7.x)** because of the typescript-eslint peer range. TS 6 defaults `types` to `[]`, so tsconfigs that need Node types (`sim`, content scripts/load, root config files) must set `"types": ["node"]` explicitly. Core sets `"types": []` and `"lib": ["ES2022"]` (no DOM, no Node).
- All packages are ESM (`"type": "module"`). `tsconfig.base.json` sets these explicitly:

  | Option | Value |
  |--------|-------|
  | `target` | `"ES2022"` |
  | `module` | `"esnext"` |
  | `moduleResolution` | `"bundler"` |
  | `strict` | `true` |
  | `noUncheckedIndexedAccess` | `true` |
  | `exactOptionalPropertyTypes` | `true` |
  | `noImplicitOverride` | `true` |
  | `noFallthroughCasesInSwitch` | `true` |
  | `verbatimModuleSyntax` | `true` |
  | `isolatedModules` | `true` |
  | `skipLibCheck` | `true` |
  | `declaration` | `true` |
  | `composite` | `true` |
  | `emitDeclarationOnly` | `true` |
  | `forceConsistentCasingInFileNames` | `true` |

  Do **not** set `baseUrl`, `paths`, `esModuleInterop: false` or `moduleResolution: "node"`/`"node10"` (deprecated in TS 6).
- `.prettierignore` lists exactly: `pnpm-lock.yaml`, `.planning/`, `**/dist/`, `**/.tsbuild/`, `**/coverage/`.
- `.gitignore` lists: `node_modules/`, `**/dist/`, `**/.tsbuild/`, `**/coverage/`, `*.tsbuildinfo`, `.DS_Store`.
- `GameState`, `Action` and `GameEvent` must contain only JSON values (no `undefined`; use `null`). `exactOptionalPropertyTypes` helps enforce this.
- Pinned versions (caret ranges):

  | Package | Version |
  |---------|---------|
  | typescript | ~6.0.3 |
  | vite | ^8.3.1 |
  | vitest | ^5.0.2 |
  | eslint | ^10.11.0 |
  | @eslint/js | ^10.0.1 |
  | typescript-eslint | ^8.70.1 |
  | eslint-config-prettier | ^10.1.8 |
  | prettier | ^3.9.9 |
  | zod | ^4.6.5 |
  | tsx | ^4.23.15 |
  | @types/node | ^22.20.4 |
  | fast-check | ^4.10.2 |

## Failure Modes
| Failure Mode | Expected Behavior | Verification |
|--------------|-------------------|--------------|
| Action from wrong player / system spoof / player sending system action | `{ok:false, error.code:'WRONG_ACTOR'}`, state unchanged | reducer.test.ts |
| Action in wrong phase (e.g. roll during decision) | `WRONG_PHASE` | reducer.test.ts |
| Bad payload (amount 0/11/non-integer, note > 64 chars, empty/unknown/duplicate `required`) | `INVALID_PAYLOAD` | reducer.test.ts |
| Commit/timeout with an old decisionId | `STALE_DECISION` | decision.test.ts |
| Double commit | `ALREADY_COMMITTED` | decision.test.ts |
| Unknown action type or `v !== 1` | `UNKNOWN_ACTION` / `UNSUPPORTED_VERSION` | reducer.test.ts |
| Invalid settings (0 or 5 players, duplicate, `system`, bad chars, empty seed) | `createGame` throws `SettingsError` | game.test.ts |
| Deserializing wrong version / malformed JSON | `SchemaVersionError` / `SyntaxError` / `TypeError` | serialize.test.ts |
| `stableStringify` given undefined / NaN / function / Map | throws `TypeError` | serialize.test.ts |
| `nextInt` invalid range | throws `RangeError` | rng.test.ts |
| Invalid content data / unknown data file / duplicate id | `validateContent` returns errors; CLI exits 1; `pnpm build` fails | validate.test.ts + manual negative check in plan |
| Sim given missing/invalid file | exit code 2 with a stderr message | replay-file.test.ts (tests the function throwing a typed error; CLI maps it to exit 2) |
| Core imports `node:fs` or uses `Math.random`/`Date` | `pnpm lint` fails | `pnpm lint:purity` (scripted probe, runs in CI) |

## Acceptance Checks
| Check | Command or Evidence | Required |
|-------|---------------------|----------|
| Full local pipeline | `pnpm install --frozen-lockfile && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` | true |
| CI workflow present with dev/main triggers | `grep -Eq 'branches: \[dev, main\]' .github/workflows/ci.yml && grep -q 'pnpm test' .github/workflows/ci.yml && grep -q 'pnpm lint:purity' .github/workflows/ci.yml` | true |
| Determinism property test | `pnpm vitest run packages/core/test/replay.test.ts` | true |
| Leak property test | `pnpm vitest run packages/core/test/views.test.ts` | true |
| Content gate fails on bad data | `pnpm vitest run packages/content/test/validate.test.ts` (includes CLI subprocess test on the invalid fixture dir expecting exit 1) | true |
| Sim replays fixture | `pnpm sim replay packages/sim/fixtures/sample-game.json` prints a `hash=` line | true |
| Client builds | `pnpm --filter @usurpia/client build` produces `packages/client/dist/index.html` | true |
| Core purity lint (scripted negative probe) | `pnpm lint:purity`: `scripts/check-core-purity.mjs` writes `packages/core/src/__purity_probe__.ts` (uses `Math.random()`, `Date.now()`, `import 'node:fs'`), runs the ESLint Node API on it, and asserts ≥ 1 message each for `no-restricted-properties`, `no-restricted-globals` and `no-restricted-imports`. It always deletes the probe (`finally`) and exits 1 if any rule failed to fire | true |
| Serialization round-trip for state, actions and events | `serialize.test.ts`: `JSON.parse(stableStringify(x))` deep-equals `x` for fast-check-generated valid actions and for every event emitted during a scripted game; `deserialize(serialize(s))` deep-equals `s` at each step | true |

## Deliverables

### Monorepo tooling & CI
- **Path:** root config files listed above, `.github/workflows/ci.yml`, `packages/*/package.json`, `packages/*/tsconfig.json`, placeholder `packages/*/src/index.ts`, `pnpm-lock.yaml`, `README.md` (dev commands section).
- **Purpose:** R1; all dependencies installed once so later plans never touch the lockfile.
- **Key Content:**
  - Root scripts: `lint` (`eslint .`), `lint:purity` (`node scripts/check-core-purity.mjs`), `format`, `format:check`, `typecheck` (`tsc -b`), `test` (`vitest run`), `build` (`pnpm -r run build`), `sim` (`tsx packages/sim/src/cli.ts`), `validate:content` (`pnpm --filter @usurpia/content validate`).
  - The purity probe script `scripts/check-core-purity.mjs` is written here too: it only needs the ESLint config and the `packages/core/src/` directory, so CI is green from wave 1.
  - ESLint core purity override.
  - CI job `ci` on ubuntu-latest.
- **Dependencies:** none.
- **Estimated Size:** ~15 files, ~350 lines.

### Core kernel
- **Path:** `packages/core/src/{rng,hash,serialize,types,actions,events,reducer,handlers,game,replay,index}.ts`, `packages/core/test/{rng,serialize,game,reducer,decision,replay}.test.ts`
- **Purpose:** R2 plus the R3 serialization, actor, commit/reveal and timeout parts.
- **Key Content:** the contracts above, plus these tests:
  - **Golden vectors:** exactly the pinned table above.
  - **fast-check properties (≥ 200 runs each)** over arbitrary sequences of 0–60 inputs. The action arbitrary covers all 6 types with valid and invalid payloads, plus non-object junk (`null`, numbers, `{}`, missing `v`).
    1. Replaying twice gives an identical `stableStringify(state)`.
    2. `reduce` never throws and never mutates a deep-frozen input state.
    3. Every rejected action returns a state that `===` the input.
    4. Splitting a replay at a random index, then running `deserialize(serialize(state))` and continuing, gives the same `hashState` as an uninterrupted replay.
  - **Settings validation:** a test for every reserved id.
- **Dependencies:** Monorepo tooling.
- **Estimated Size:** ~700 lines src + ~600 lines tests.

### Content pipeline
- **Path:** `packages/content/src/{schemas/common,schemas/items,registry,validate,load,index}.ts`, `data/items.json` (Herb, Big Herb, Royal Elixir, Swift Boots, Smoke Bomb from the design doc), `scripts/validate.ts`, `test/validate.test.ts`, `test/fixtures/{valid,invalid}/items.json`.
- **Purpose:** R4.
- **Dependencies:** Monorepo tooling.
- **Estimated Size:** ~250 lines.

### Views, sim & client shells
- **Path:** `packages/core/src/views.ts`, `packages/core/test/views.test.ts`, `packages/sim/src/{cli,replay-file}.ts`, `packages/sim/test/replay-file.test.ts`, `packages/sim/fixtures/sample-game.json`, `packages/client/{index.html,vite.config.ts,src/main.ts,src/render.ts,test/render.test.ts}`.
- **Purpose:** R3 redaction; proves the kernel end-to-end in Node and the browser build.
- **Key Content:** leak property test sets sentinel notes `"__SECRET_<pid>__"` and open decisions with commits. It asserts:
  - `JSON.stringify(viewFor(s, other))` contains no other player's sentinel;
  - the view has no `hidden` key;
  - `eventsFor` never returns `SecretSet` for others;
  - `ChoiceCommitted` has no `choice` key.
- **Dependencies:** Core kernel.
- **Estimated Size:** ~400 lines.

## Path Validation
**Status:** All paths valid (greenfield; no `.planning/config/directory-mappings.yaml`, validation skipped).

## Open Questions
| # | Question | Impact | Default Chosen by Spec | Planning Effect |
|---|----------|--------|------------------------|-----------------|
| 1 | How will core consume content data in Phase 2 (import types vs. data passed in settings)? | Non-blocking | Phase 1 forbids core → content imports; Phase 2 revisits with a deliberate lint change | Use the default |
| 2 | Should CI also deploy client previews to GitHub Pages now? | Non-blocking | No; deploy is Phase 7 scope | Use the default |
| 3 | GitHub Action major versions (`actions/checkout`, `actions/setup-node`, `pnpm/action-setup`) | Non-blocking | `@v4` for all three: long-supported majors that work on Node 22 runners. Newer majors may exist; bumping is safe later | Use the default |
| 4 | Branch protection on `main` requiring CI | Non-blocking | Not configured by the plan (repo settings are the user's action); documented in the README | Use the default |
| 5 | Forward compatibility for Phase 2+ (from the plan critique) | Non-blocking for Phase 1 | Phase 1 code stays as specified. **Must be decided at Phase 2 planning:** (a) content injection: recommended `reduce(state, action, rules: Rules)`, where core defines the `Rules` type, content satisfies it, and rules are not serialized into state or saves; (b) `PendingDecision` generalizes to `kind` plus per-player `options`/`default` and can be opened by handlers internally, not only by `system` actions; (c) the `sample/*` module and the `counter`/`lastRoll` fields are deleted in Phase 2, with a `SCHEMA_VERSION` bump; the kernel (rng, serialize, reject precedence, views, replay) persists; (d) the CPU AI (Phase 3) uses its own seeded RNG outside `reduce`, and its choices enter the game only as recorded actions | Record in Phase 2 CONTEXT |

## Complexity Assessment

**Rating:** Complex

| Metric | Value |
|--------|-------|
| Requirements | 4 (R1–R4) |
| Deliverables | 4 groups, ~45 files (new: ~45, modify: 1 `README.md`, config: ~12) |
| Estimated waves | 3 (tooling → core kernel ∥ content → views/sim/client) |
| Estimated plans | 4 |
| Competing proposals | Recommended (already run: hybrid Pragmatic + Clean selected) |

**Rationale:** The phase sets the contracts every later phase depends on: determinism, redaction, the reject model and toolchain configs. A mistake here spreads to every later phase, so the precise contracts and golden vectors are worth the upfront cost.

**Recommended next step:** Decompose into 4 plans across 3 waves using this spec as the primary source.

## Revision History
| # | Section | Change | Reason |
|---|---------|--------|--------|
| 1 | Key Decisions (TS build) | Single composite `emitDeclarationOnly` project per package including src + test + scripts + configs, `outDir .tsbuild`, references to core | Critique #1, #3: tests/configs outside any tsconfig; tsc emit colliding with Vite dist |
| 2 | Key Decisions (Lint) | `allowDefaultProject` for root JS/TS configs, `disableTypeChecked` for JS, ignores | Critique #1 |
| 3 | sim contract | Root `sim` script runs tsx from repo root; CLI resolves paths from cwd | Critique #2 |
| 4 | content contract | `loadContentDir(string \| URL)`, CLI `--dir` flag, invalid JSON handling | Critique #4 |
| 5 | Data & Control Flow | Exact reject precedence: version → unknown → shape → phase → actor → state validation | Critique #5 |
| 6 | reduce signature | `action: unknown` + exported `isAction` shape guard | Critique #6 |
| 7 | PlayerId | Reserved ids list incl. `spectator` and prototype keys | Critique #7 |
| 8 | RNG/hash | Reference algorithms embedded; golden vectors computed independently by planner; FNV matches official vector | Critique #8 |
| 9 | Acceptance checks | Round-trip for actions + events; stronger determinism properties (no-mutation, rejection identity, mid-replay serialize) | Critique #9, #10 |
| 10 | Compatibility | Exact `.prettierignore`/`.gitignore`, explicit TS 6 options, forbidden deprecated options | Critique #11, #13 |
| 11 | Contracts | Transition semantics, event visibility table, viewFor non-player, replay continues after rejection, exact deserialize checks | Critique #12 |
| 12 | Versions | `@eslint/js` 10.0.1 and `@types/node` 22.20.4 confirmed on npm registry (2026-09-26) | Critique #14 |
| 13 | Acceptance checks | Precise CI branch grep; scripted purity probe `pnpm lint:purity` in CI | Critique #15 |
| 14 | Deliverables | Purity probe moved to the tooling deliverable (it only needs the ESLint config and core `src/`) | Planning: keeps CI green from wave 1 |
| 15 | reduce / deserialize contracts | Canonicalize untrusted actions once; Object.hasOwn for PlayerId-keyed records; full-shape `deserialize`; bounded echo in reject messages | Phase 1 review cycle 1 (BLOCKER: prototype-member player ids put functions into state; WARNINGs: getter/Proxy/sparse inputs, shallow deserialize) |
