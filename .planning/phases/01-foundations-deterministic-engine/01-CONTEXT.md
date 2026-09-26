# Phase 1: Foundations & Deterministic Engine -- Context

## Phase Goal
A pnpm monorepo with CI and a pure, deterministic, online-ready rules-engine skeleton that every later system plugs into.

## Requirements Covered
- **R1:** pnpm monorepo (`core`, `content`, `client`, `sim`) with strict TypeScript, Vite, Vitest, ESLint/Prettier, and GitHub Actions CI on `dev`/`main`.
- **R2:** pure deterministic rules engine, `reduce(state, action) -> {state, events}`, with seeded RNG held in state and replay from `(settings, actions)`.
- **R3:** online-readiness constraints enforced by tests:
  - JSON-serializable, versioned state/actions/events
  - `playerId` on every action
  - per-player redacted views and events
  - commit/reveal for hidden choices
  - timeouts as actions
- **R4:** data-driven `content` package with zod schemas validated at build time.

`.planning/REQUIREMENTS.md` does not exist; requirement text comes from PROJECT.md/ROADMAP.md. **The authoritative contract source is the spec:** `.planning/specs/01-foundations-deterministic-engine-spec.md`. Its API/type contracts, transition semantics, reject precedence, golden vectors, compatibility table and failure modes are binding for every plan in this phase.

## What Already Exists (from prior phases)
None; this is the first phase and the repo is greenfield. Current contents:
- `README.md`: one line, `# Dokapon Kingdom 2`
- `.planning/`: PROJECT, ROADMAP, STATE, the exploration design doc, and the spec above

Branches: `main` (initial commit) and `dev` (the working branch; all phase work lands here).

Environment verified 2026-09-26: Node 22.22.2, pnpm 10.33.0.

## Key Design Decisions
- **Architecture:** a hybrid of Pragmatic + Clean, chosen by the user from three competing proposals.
  - From Pragmatic: sfc32 RNG, a handler-map reducer returning a `Result`, no immer, `tsc -b` project references, fast-check.
  - From Clean: `public` / `private` / `hidden` state partitions, `PendingDecision` commit/reveal with a `system`-actor `timeout`, and a core import-boundary lint.
- **Spec pipeline was run** (gather → research → write → critique → assess). The critique returned REWORK with 15 findings, all resolved (see the spec's Revision History). Notable outcomes:
  - **TypeScript ~6.0.3, not 7.x.** typescript-eslint 8.70.1 supports TS `<6.1.0` only.
  - **One composite tsconfig per package**, `emitDeclarationOnly`, `outDir .tsbuild`, including src + test + scripts + configs. No runtime JS emit in Phase 1.
  - **`reduce(state, action: unknown)`**: untrusted input, exact reject precedence, never throws.
  - **Golden RNG/hash vectors** were computed independently from the reference algorithms and are pinned in the spec.
  - The root `sim` script runs tsx from the repo root.
- **Waves:**
  1. Tooling.
  2. Core kernel ∥ content pipeline. They share no files; all dependencies and the lockfile come from wave 1, so wave-2 plans never run `pnpm add`.
  3. Views + sim + client shells, which depend on the core kernel.
- **Ownership rules:**
  - Plan 01-01 creates every `package.json` and `tsconfig.json`.
  - Plan 01-03 may edit only the `scripts` field of `packages/content/package.json`.
  - Plan 01-04 edits `packages/core/src/index.ts` (created by 01-02) to add view exports, and replaces the client/sim placeholders created by 01-01.
- **Agents:** `engineering-infrastructure-devops` for toolchain/CI; `engineering-senior-developer` for the TypeScript kernel, content and shells; `testing-qa-verification-specialist` on every plan (mandatory testing role).

## Plan Structure
- **Plan 01-01 (Wave 1): Monorepo Tooling & CI.** Root configs, 4 package skeletons with smoke tests, all dependencies plus the lockfile, the purity probe, and CI plus README.
- **Plan 01-02 (Wave 2): Core Kernel.** RNG/hash/serialize, types, reducer with handlers (sample + decision/commit/timeout), `createGame`, replay, and determinism property tests.
- **Plan 01-03 (Wave 2): Content Pipeline.** zod schemas, sample data, `validateContent`/`loadContentDir`, the validate CLI build gate, and fixture/subprocess tests.
- **Plan 01-04 (Wave 3): Views, Sim & Client Shells.** `viewFor`/`redactEvent`/`eventsFor` with leak properties, the `pnpm sim replay` CLI with a fixture, the Vite text client, and a final full-pipeline run.
