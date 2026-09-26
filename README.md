# Usurpia

A browser-based, friendship-ruining RPG board game for 1–4 players ("Dokapon-kingdom-2" is the internal codename for this repository).

## Development

### Prerequisites

- Node 22 (see `.nvmrc`; run `nvm use` if you use nvm).
- pnpm 10, pinned through the `packageManager` field. Enable it with `corepack enable`.

### Commands

| Command                  | What it does                                                           |
| ------------------------ | ---------------------------------------------------------------------- |
| `pnpm install`           | Install all workspace dependencies (CI uses `--frozen-lockfile`).      |
| `pnpm lint`              | Typed ESLint across the repo, including core purity/boundary rules.    |
| `pnpm lint:purity`       | Scripted negative probe proving the core purity lint rules still fire. |
| `pnpm format`            | Format everything with Prettier (`pnpm format:check` verifies only).   |
| `pnpm typecheck`         | `tsc -b` over the project-reference graph (sources and tests).         |
| `pnpm test`              | Run every package's Vitest suite.                                      |
| `pnpm build`             | Run each package's `build` script (content validation, client bundle). |
| `pnpm sim replay <file>` | Replay a recorded game (`{ settings, actions }` JSON) headlessly.      |

### Branch model

- `main`: release branch.
- `dev`: integration branch; all work lands here first.

CI (`.github/workflows/ci.yml`) runs install, lint, lint:purity, format:check, typecheck, test and build on pushes to and pull requests targeting both `dev` and `main`.

Branch protection on `main` that requires the CI check must be enabled by the repository owner in GitHub settings (Settings → Branches); it is not configured from this repo.

## Packages

- `packages/core` (`@usurpia/core`): pure, deterministic rules engine with no runtime dependencies.
- `packages/content` (`@usurpia/content`): game data with zod schemas validated at build time.
- `packages/sim` (`@usurpia/sim`): headless Node CLI for replays and, later, balance simulation.
- `packages/client` (`@usurpia/client`): Vite browser client (a text-only stub for now).
