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
| `pnpm sim duel [flags]`  | Headless balance simulator: CPU-vs-CPU / CPU-vs-monster win rates.     |

### Replay files

`pnpm sim replay <file.json> [--allow-rules-mismatch]` replays a recorded game headlessly. The file is a JSON object with exactly the keys `{ rulesHash, settings, actions }`:

- `rulesHash`: the 8-hex-digit hash of the `Rules` the game was recorded with.
- `settings`: the game settings (`{ v: 2, seed, players: [{ id, classId }] }`).
- `actions`: an array of untrusted actions, each passed through `reduce` (rejections are counted, not thrown).

The hash is checked before replaying. On success the CLI prints `hash=<hashState> rules=<rulesHash> turn=<n> events=<n> rejections=<n>`. `--allow-rules-mismatch` replays despite a different `rulesHash` and appends ` rules-mismatch=<fileHash>` to that line.

Exit codes: `0` ok, `1` invalid content (content gate), `2` usage or file error, `3` rules mismatch.

### Balance simulator

`pnpm sim duel` runs CPU-vs-CPU class duels and class-vs-monster duels headlessly, every one through `reduce`, and prints a deterministic report (the same flags always give byte-identical stdout).

```
pnpm sim duel [--n <int >= 1>] [--matchup <spec>] [--difficulty <d> | <dA>:<dB>]
              [--seed <string>] [--level <1..maxLevel>] [--json]
```

| Flag           | Default   | Meaning                                                                                                    |
| -------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `--n`          | `1000`    | Number of duels. Duel `i` uses matchup `M[i mod \|M\|]` and seed `<seed>/<i>`.                             |
| `--matchup`    | `all`     | `classes`, `mirrors`, `monsters`, `all`, `<classA>:<classB>` or `<class>:monster/<id>` (ids sorted).       |
| `--difficulty` | `normal`  | `easy`, `normal` or `hard` for both sides, or `<dA>:<dB>` (side B is ignored for monster duels).           |
| `--seed`       | `usurpia` | Base seed string.                                                                                          |
| `--level`      | `5`       | Class-duel character level (1 to the rules' max level). Monster duels use the level of the monster's tier. |
| `--json`       | off       | Print one `stableStringify` JSON line instead of the text report.                                          |

Report (stdout):

```
duel n=<n> seed=<seed> level=<L> difficulty=<dA>:<dB> rules=<rulesHash>
# class-vs-class
<A>:<B> n=<k> a=<aWins> b=<bWins> draw=<d> fled=<f> aRate=<x.xxx | n/a>
# class-vs-monster
<A>:monster/<id> n=<k> a=<...> b=<...> draw=<...> fled=<...> aRate=<...>
total n=<n> a=<sum> b=<sum> draw=<sum> fled=<sum>
```

Section headers appear only when that kind of matchup ran, matchups with no duel are omitted, and `aRate = a / (a + b)` (`n/a` without a decisive duel). Timing goes to stderr as `elapsed_ms=<n>`. Every duel is seeded from the base seed, so results are reproducible. A usage error prints a `usage: ...` line to stderr and exits `2`.

`packages/sim/test/gate.test.ts` holds the balance gate: in every class mirror the Hard CPU must beat the Easy CPU in at least 70% of decisive duels with at most 40% draws. CI runs the smoke check `pnpm sim duel --n 264 --seed ci` after the build.

### Branch model

- `main`: release branch.
- `dev`: integration branch; all work lands here first.

CI (`.github/workflows/ci.yml`) runs install, lint, lint:purity, format:check, typecheck, test, build and the `pnpm sim duel --n 264 --seed ci` smoke check on pushes to and pull requests targeting both `dev` and `main`.

Branch protection on `main` that requires the CI check must be enabled by the repository owner in GitHub settings (Settings → Branches); it is not configured from this repo.

## Packages

- `packages/core` (`@usurpia/core`): pure, deterministic rules engine with no runtime dependencies. The combat CPU lives in `@usurpia/core/ai` (Easy/Normal/Hard) and is lint-isolated from the reducer.
- `packages/content` (`@usurpia/content`): game data with zod schemas validated at build time.
- `packages/sim` (`@usurpia/sim`): headless Node CLI: game replays and the CPU balance simulator (`pnpm sim duel`).
- `packages/client` (`@usurpia/client`): Vite browser client (a text-only stub for now).
