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
| `pnpm sim replay <file>` | Replay a recorded game (`{ rulesHash, settings, actions }` JSON).      |

### Replay files

`pnpm sim replay <file.json> [--allow-rules-mismatch]` replays a recorded game headlessly. The file is a JSON object with exactly the keys `{ rulesHash, settings, actions }`:

- `rulesHash`: the 8-hex-digit hash of the `Rules` the game was recorded with.
- `settings`: the game settings (`{ v: 2, seed, players: [{ id, classId }] }`).
- `actions`: an array of untrusted actions, each passed through `reduce` (rejections are counted, not thrown).

The hash is checked before replaying. On success the CLI prints `hash=<hashState> rules=<rulesHash> turn=<n> events=<n> rejections=<n>`. `--allow-rules-mismatch` replays despite a different `rulesHash` and appends ` rules-mismatch=<fileHash>` to that line.

Exit codes: `0` ok, `1` invalid content (content gate), `2` usage or file error, `3` rules mismatch.

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
