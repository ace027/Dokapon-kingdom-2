# Plan 02-02 Summary: Content (schemas, data, buildRules)

**Status:** Complete. Executed in worktree `/home/user/usurpia-wt/02-02` on branch `phase2/02-02` (committed there, not pushed).

## What changed
- `packages/content/src/schemas/{common,items,classes,gear,spells,monsters,tuning}.ts`: strict zod schemas for the six files (`IdSchema` with the `reserved id` refine).
- `packages/content/src/registry.ts`: 6-file `CONTENT_REGISTRY`.
- `packages/content/src/build-rules.ts` (new): `buildRules`, stages file-set, schema, duplicate ids, cross-refs, assemble (stops after the first stage with errors); `validate.ts` delegates to it.
- `packages/content/src/node.ts` (new) and `package.json` `exports["./node"]`: `loadContentDir`, `loadRules(dir?)`.
- `packages/content/data/{classes,gear,items,spells,monsters,tuning}.json`: the spec's Revision 2 tables (generated once by a throwaway script in `/tmp/usurpia-scratch/02-02/` that parses the spec tables, then prettier-formatted; not committed).
- Tests: `helpers.ts`, `data.test.ts`, `build-rules.test.ts`, `validate.test.ts`; `test/fixtures/` deleted.

## Export list (`src/index.ts`, browser-safe)
`IdSchema`, `ClassesFileSchema`, `GearFileSchema`, `ItemsFileSchema`, `SpellsFileSchema`, `MonstersFileSchema`, `TuningFileSchema`, `CONTENT_REGISTRY`, `REQUIRED_FILES`, `validateContent`, `ContentEntry`, `ContentError`, `buildRules`, `BuildResult`. `./node`: `loadContentDir`, `loadRules`.

## Content counts
6 classes (4 base, 2 hybrid, 5 passives each), 15 gear, 17 items (12 consumables + 5 joke), 8 battle + 4 ward + 8 field spells, 16 monsters (4 per zone/tier), 3 guardians, 1 enforcer (no `style`), 5-row NPC curve = 20 NPC definitions.

## Observed rulesHash
`rulesHash(loadRules())` = `84a995db` on the first run (no mismatch localisation needed; the reference module was not read).

## Cross-reference message table (one unique message per rule)
Paths: classes/tuning/curve use the file's own structure (`classes.4.parents.1`, `progression.xpCurve.5`, `curve`); NPC rules use the spec's example form `monsters.monsters.<i>`, `monsters.guardians.<i>`, `monsters.enforcer` (e.g. `monsters.monsters.15.hooks.0.hook`).

| Message |
|---|
| `at least one base class is required` |
| `base class must not have parents` |
| `base class requires a starter loadout` |
| `hybrid class requires parents` |
| `hybrid parents must be two distinct base classes` |
| `hybrid parent must be an existing class` |
| `hybrid parent must be a base class` |
| `hybrid class must not have a starter` |
| `passives must have exactly 5 entries` |
| `passive rank must equal its position + 1` |
| `starter weapon must be an existing gear id` |
| `starter shield must be an existing gear id` |
| `starter accessory must be an existing gear id` |
| `starter weapon must be a weapon` |
| `starter shield must be a shield` |
| `starter accessory must be an accessory` |
| `starter battle spell must be an existing battle spell` |
| `starter ward spell must be an existing ward spell` |
| `starter bag item must be an existing item` |
| `starter bag exceeds bagSize` |
| `aiBias attack+strike+spell must be greater than 0` |
| `aiBias guard+counter+ward must be greater than 0` |
| `npc battleSpell must be an existing battle spell` |
| `npc wardSpell must be an existing ward spell` |
| `attackTable.spell must be 0 when battleSpell is null` |
| `attackTable must sum to more than 0` |
| `defendTable must sum to more than 0` |
| `npc sheet-stat hooks are not applied` |
| `monster zone must be one of the four zones` |
| `enforcer id must be crown-enforcer` |
| `curve must have exactly 5 tiers` |
| `xpCurve length must equal maxLevel` |
| `xpCurve[0] must be 0` |
| `xpCurve must be strictly increasing` |
| `xpCurve values must not exceed MAX_COUNTER` |
| `masteryWins must have exactly 5 entries` |
| `masteryWins[0] must be 0` |
| `masteryWins must be strictly increasing` |
| `hybridUnlockRank must be between 1 and 5` |

## Mutation proof
Method (PIT-001): a throwaway script (`/tmp/usurpia-scratch/02-02/mutate.mjs`, outside the repo) suppressed each cross-ref rule's error at its single reporting point (the `add` callback, equivalent to deleting the check), ran `pnpm vitest run packages/content/test/build-rules.test.ts`, recorded the failing tests and restored `build-rules.ts` byte-for-byte (verified with `cmp`). Only tests of the mutated rule fail; the two tests that mention several rules (`evaluates every cross-ref rule in one pass`) fail for the rules they use.

| Message suppressed | Rule key | Failing tests (only these) |
|---|---|---|
| `at least one base class is required` | noBaseClass | no base class |
| `base class must not have parents` | baseHasParents | base class with parents; evaluates every cross-ref rule in one pass (two mutations, two errors, sorted) |
| `base class requires a starter loadout` | baseNeedsStarter | base class without starter |
| `hybrid class requires parents` | hybridNeedsParents | hybrid without parents |
| `hybrid parents must be two distinct base classes` | hybridParentsDistinct | hybrid parents equal |
| `hybrid parent must be an existing class` | hybridParentUnknown | hybrid parent unknown (pattern-valid id, PIT-002) |
| `hybrid parent must be a base class` | hybridParentNotBase | hybrid parent is itself a hybrid |
| `hybrid class must not have a starter` | hybridHasStarter | hybrid with a starter |
| `passives must have exactly 5 entries` | passivesLength | passives length |
| `passive rank must equal its position + 1` | passiveRank | passive rank |
| `starter weapon must be an existing gear id` | starterWeaponUnknown | starter weapon unknown |
| `starter shield must be an existing gear id` | starterShieldUnknown | starter shield unknown |
| `starter accessory must be an existing gear id` | starterAccessoryUnknown | starter accessory unknown |
| `starter weapon must be a weapon` | starterWeaponSlot | starter weapon in the wrong slot |
| `starter shield must be a shield` | starterShieldSlot | starter shield in the wrong slot |
| `starter accessory must be an accessory` | starterAccessorySlot | starter accessory in the wrong slot |
| `starter battle spell must be an existing battle spell` | starterBattleSpell | starter battle spell unknown |
| `starter ward spell must be an existing ward spell` | starterWardSpell | starter ward spell unknown |
| `starter bag item must be an existing item` | starterBagItem | starter bag item unknown |
| `starter bag exceeds bagSize` | starterBagSize | starter bag larger than bagSize |
| `aiBias attack+strike+spell must be greater than 0` | aiBiasAttack | aiBias attack side is zero |
| `aiBias guard+counter+ward must be greater than 0` | aiBiasDefend | aiBias defend side is zero |
| `npc battleSpell must be an existing battle spell` | npcBattleSpell | npc battleSpell unknown; guardian battleSpell applies to guardians and the enforcer; enforcer battleSpell applies to guardians and the enforcer |
| `npc wardSpell must be an existing ward spell` | npcWardSpell | npc wardSpell unknown; guardian wardSpell applies to guardians and the enforcer; enforcer wardSpell applies to guardians and the enforcer |
| `attackTable.spell must be 0 when battleSpell is null` | npcSpellWeight | attackTable.spell > 0 without a battleSpell |
| `attackTable must sum to more than 0` | npcAttackSum | attack table sums to 0 |
| `defendTable must sum to more than 0` | npcDefendSum | defend table sums to 0 |
| `npc sheet-stat hooks are not applied` | npcSheetHook | npc sheet-stat hook (monster); rejects a sheet-stat hook on a guardian; rejects a sheet-stat hook on a enforcer |
| `monster zone must be one of the four zones` | monsterZone | monster zone |
| `enforcer id must be crown-enforcer` | enforcerId | enforcer id |
| `curve must have exactly 5 tiers` | curveLength | curve length |
| `xpCurve length must equal maxLevel` | xpCurveLength | xpCurve length |
| `xpCurve[0] must be 0` | xpCurveFirst | xpCurve[0] |
| `xpCurve must be strictly increasing` | xpCurveIncreasing | xpCurve strictly increasing |
| `xpCurve values must not exceed MAX_COUNTER` | xpCurveMax | xpCurve above MAX_COUNTER |
| `masteryWins must have exactly 5 entries` | masteryLength | masteryWins length |
| `masteryWins[0] must be 0` | masteryFirst | masteryWins[0] |
| `masteryWins must be strictly increasing` | masteryIncreasing | masteryWins strictly increasing |
| `hybridUnlockRank must be between 1 and 5` | hybridUnlockRank | hybridUnlockRank 0; hybridUnlockRank 6; evaluates every cross-ref rule in one pass (two mutations, two errors, sorted) |

## Test counts
Before (02-01b): 437 tests. After: **517** tests, 17 files, all passing. Content: `build-rules.test.ts` 79, `data.test.ts` 15, `validate.test.ts` 21 (`validate.test.ts` was 35).

## Pipeline (exit codes, worktree root, final run)
`pnpm install --frozen-lockfile` 0; `pnpm lint` 0; `pnpm lint:purity` 0 (11 cases); `pnpm format:check` 0; `pnpm typecheck` 0; `pnpm test` 0 (517 passed); `pnpm build` 0 (`✓ content valid (6 files)`); `pnpm validate:content` 0.

## Decisions
- Content imports from `@usurpia/core` are type-only (`Rules`) plus the pure values `CONTENT_ID_PATTERN`, `RESERVED_CONTENT_IDS`, `STAT_KEYS`, `COMBAT_HOOKS`, `BOARD_HOOKS`, `COMMANDS`, `MAX_COUNTER`, `MAX_STAT` (see Deviations). `RESERVED_CONTENT_IDS` and `COMMANDS` are used by `IdSchema` and the command-weight schema.
- Stage-stop rule: file set, then schema, then duplicates, then cross-refs; a later stage never runs after an earlier one produced errors. Within cross-refs every rule is evaluated.
- Structural counts (classes non-empty, curve length 5, passives length 5, xpCurve/masteryWins lengths, hybridUnlockRank 1..5) are cross-ref rules rather than schema constraints, as the spec lists them there; schemas only enforce types and per-value ranges.
- The single `as Rules` cast sits in `assemble`; records are built from a recursive `stripDisplayText` (removes `name`/`description`/`tagline` at every level).

## Deviations and notes
- Lookups use `Map` (never object bracket/`in` access), which is prototype-safe by construction, instead of `Object.hasOwn`/`ownGet`; the only lowercase prototype-member id, `constructor`, is rejected earlier as a reserved id. The PIT-002 test uses the pattern-valid id `tostring`.
- `MAX_COUNTER` and `MAX_STAT` (constants exported by core) are imported as values; they are not in the plan's helper list but are required by the spec's ranges/xpCurve rule and avoid duplicating the constants.
- The spec/plan path examples are not uniform (`classes.4.parents.1` vs `monsters.monsters.15.hooks.0.hook`; duplicate ids use `<collection>.<i>.id`, i.e. `monsters.3.id`). I followed both literally, so in `monsters.json` schema and duplicate paths are `monsters.3.…` while NPC cross-ref paths are `monsters.monsters.3.…`. Worth normalising in a later phase.
- The mutation proof suppresses the error at the reporting point instead of editing each condition; the effect is identical for the test outcomes.
- Zod's own messages are pinned in the schema-stage tests (zod 4.6.x wording).
