# Plan 01-03 Summary: Content Pipeline

**Status:** Complete. All verification is green; the one small ordering deviation is noted under Decisions.
**Agent:** engineering-senior-developer-01-03. The negative and subprocess test work was done in-agent.
**Requirement:** R4

## Files
**Created**
- **`src/schemas/common.ts`:** `IdSchema` (`/^[a-z][a-z0-9-]{0,47}$/`).
- **`src/schemas/items.ts`:**
  - `ItemSchema`, a `z.strictObject`.
  - `ItemsFileSchema`, which is `{v: 1, items: min 1}`.
  - `type Item`.
- **`src/registry.ts`:**
  - `CONTENT_REGISTRY`, typed `{ "items.json": ItemsFileSchema } as const satisfies Record<string, z.ZodType>`.
  - `REQUIRED_FILES`, sorted.
- **`src/validate.ts`:** `ContentEntry`, `ContentError`, and the pure `validateContent`. It checks, in order:
  1. missing, unknown or invalid-JSON files;
  2. `safeParse` issues;
  3. the generic duplicate-id check on any `items` array.

  Output is sorted by file, then path.
- **`src/load.ts`:** the Node-only `loadContentDir(dir: string | URL)`. It is **not** re-exported.
- **`scripts/validate.ts`:** the CLI build gate.
- **`data/items.json`:** 5 consumables: herb, big-herb, royal-elixir, swift-boots, smoke-bomb.
- **`test/validate.test.ts`**, **`test/fixtures/valid/items.json`** (2 items) and **`test/fixtures/invalid/items.json`** (verbatim from the plan).

**Modified**
- **`src/index.ts`:** browser-safe re-exports. `PACKAGE_NAME` is removed.
- **`package.json`:** the `scripts` field only, with `validate` and `build` both set to `tsx scripts/validate.ts`.

**Deleted**
- `test/smoke.test.ts`

All paths above are under `packages/content/`.

## Error Message Catalog
| Case | path | message |
|------|------|---------|
| File not in registry | `""` | `unknown content file (not in CONTENT_REGISTRY)` |
| Registered file absent | `""` | `missing required content file` |
| `data === undefined` (JSON parse failed) | `""` | `invalid JSON` |
| Schema issue | `issue.path.join(".")` | zod's `issue.message` |
| Duplicate id (only after a successful parse) | `items.<j>.id` | `duplicate id "<id>" (first at items.<i>)` |

zod 4 reports unknown keys as one `unrecognized_keys` issue at the **object** path (e.g. `items.0`, message `Unrecognized key: "extra"`). An unknown top-level key gets path `""`.

## CLI (`scripts/validate.ts`)
- **Arguments:** `process.argv.slice(2)`, with an optional `--dir <path>` resolved via `path.resolve(process.cwd(), value)`. The default is `fileURLToPath(new URL("../data/", import.meta.url))`.
- **Exit codes:**
  - **0:** prints `✓ content valid (N files)`.
  - **1:** prints one `✗ <file> <path>: <message>` line per error to stdout.
  - **2:** an unknown or incomplete argument prints `usage: validate [--dir <path>]` to stderr; a loader throw prints `error: content dir not found: <dir>` to stderr.

## Subprocess Invocation Method (reused by 01-04)
`tsx/cli` resolved successfully, so the `--import tsx` fallback was **not** needed.
```ts
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli"); // → node_modules/.pnpm/tsx@4.23.15/node_modules/tsx/dist/cli.mjs
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const scriptPath = fileURLToPath(new URL("../scripts/validate.ts", import.meta.url));
spawnSync(process.execPath, [tsxCli, scriptPath, ...args], { encoding: "utf8", cwd: repoRoot });
```
`--dir` arguments are absolute fixture paths. `node_modules/.bin/tsx` is never executed via node.

## Tests
`test/validate.test.ts` has **31 tests** in 1 file, all passing.

**`validateContent` (21 tests)**
- valid → `[]`
- bad id and a digit-leading id
- empty name and a name over 40 chars
- unknown kind
- negative and fractional price
- empty description
- boundary cases (a 40-char name and price 0) that should pass
- an extra key at `items.0`
- an unknown top-level key
- `items: []` (path `items`) and a bare `[]` (path `""`)
- `v: 2` (path `v`)
- a duplicate id at `items.2.id`, with the exact message
- an unknown file
- a `constructor` file name, which the `Object.hasOwn` guard rejects
- a missing `items.json`
- invalid JSON
- deterministic sort that is independent of input order

**`loadContentDir` (5 tests)**
- the valid fixture
- a URL input
- a temp dir with `broken.json`, a non-JSON file ignored, and sorted output
- an empty dir, which reports `missing required content file`
- a missing dir, which throws

**CLI subprocess (5 tests)**
- valid → 0
- `fixtures/invalid` → 1, with `✗ items.json items.0.id:` / `items.2.price:`
- the default shipped data → 0
- `--bogus` → 2
- a missing dir → 2

**Manual negative check:** I temporarily set a negative price in `data/items.json`, and `pnpm --filter @usurpia/content run build` exited 1. After I restored the file, it exited 0.

## Verification (frontmatter `verification_commands`, all exit 0)
- `pnpm vitest run packages/content`: 31 passed
- `pnpm --filter @usurpia/content run validate` and `run build`: `✓ content valid (1 files)`
- the direct tsx run on `test/fixtures/invalid`: exit 1, so `test $? -eq 1` passes
- `pnpm exec tsc -b packages/content`, `pnpm exec eslint packages/content`, `pnpm exec prettier --check packages/content`: all clean
- `test ! -f packages/content/test/smoke.test.ts`: passes

All task-level `> verification:` lines passed (Task 1: 4/4, Task 2: 4/4, Task 3: 5/5).

## Decisions / Deviations
1. **Intentional spec deviation:** the content `build` script is just `tsx scripts/validate.ts`, without `&& tsc -b`, because type checking is covered by the root `tsc -b`.
2. **`smoke.test.ts` deleted during Task 1 instead of Task 3.** Removing `PACKAGE_NAME` breaks the smoke test's import, and Task 1's `tsc -b packages/content` compiles `test/`. The file is in the plan's `files_modified` for deletion either way.
3. **Registry lookup uses `Object.hasOwn`**, so prototype keys (e.g. `constructor.json`, `toString`) cannot resolve to a schema. The public type of `CONTENT_REGISTRY` is the `as const satisfies` literal, which is assignable to the spec's `Readonly<Record<string, z.ZodType>>`.
4. **An incomplete `--dir` (no value) is a usage error** (exit 2), handled the same way as an unknown argument.
5. **`loadContentDir` also throws `content dir not found` when the path exists but isn't a directory.**

## Notes
- No dependencies changed. No files outside `packages/content` and this SUMMARY were touched.
- Plan 01-02 ran in parallel in the same tree. Only package-scoped commands were used.
