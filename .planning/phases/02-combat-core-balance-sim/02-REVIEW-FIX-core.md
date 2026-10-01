# Phase 2 review cycle 1: CORE fixes

Branch `review2/c1-core`. Scope: `packages/core/**`, `eslint.config.js`, `scripts/check-core-purity.mjs`.
No golden or hash changed (758ef72c, 9616698e, ec0c3508, 57da3ea4, 0483c0fa, rulesHash 84a995db, per-duel pins all pass untouched).

## Findings

| Id | Status | Notes |
|----|--------|-------|
| S1 | fixed | Heals (item, in-combat item, drain, useItem) clamped `max(0, min(missing, ..))`; steal gold `min(dGold, ..)` with `n > 0` guard; victoryReward xp/gold >= 0; sheet/NPC stats `min(MAX_STAT, ..)`. |
| S2 | fixed, deviation | deserialize rejects an open combat whose decisionSeq has no headroom. Uses the tight slot-based bound `decisionSeq + 2*maxRounds - slot > MAX_COUNTER` (slot = 2*(round-1)+exchange), not the literal `seq + 2*maxRounds <= MAX`, which rejects reachable states (mutation S2-d). |
| S3 | fixed | `reduceAs(state, action, rules, actor)` wrapper; trust-boundary doc on `reduce`. |
| S5 | fixed | `createGame` canonicalizes settings once (`canonicalSettings`); getter and Proxy tests. |
| S7 | fixed | TSImportType banned core-wide; AI Math ban list (22 members) and `**` / `**=` ban; the AI block restates `no-restricted-syntax`. |
| A2 | fixed | `DECISION_KINDS` is `Readonly<Record<DecisionKind,true>>` read via ownGet (PIT-002). ACTION_TYPES deleted (no consumer). |
| A3 | fixed | `isInt`, `sameStrings`, `isEnvelope`, `bagEvent` shared. |
| A4 | fixed | `SCHEMA_VERSION` used for `v`. |
| A7 | fixed | `canonical.ts` (stableStringify/hashState); no runtime import cycle (checked with cyc.py). |
| A8 | fixed | `resolveUnsupported` deleted; stale comments rewritten. Redundant `npcSide` MAX_STAT clamp removed. |
| A9 | fixed | helpers moved to `test/fixtures/build.ts`. |
| T2 | fixed | regen clamp test. |
| T3 | fixed | critChanceBp rows. |
| T4 | fixed | AI heal pick, threshold, stunned-opponent tests. |
| T5 | fixed | purity probes per AI ban (50 cases). |

Not done on purpose: no `max(0)` on steal (the `n > 0` guard covers it); no clamp on healD (non-negative by construction).

## Mutation table (PIT-001 / PIT-002)

Each mutation changes one check, runs the whole core suite, and lists the tests that fail. All were killed by their own tests only.

| Mutation | Killed by (failing count) |
|----------|---------------------------|
| S1-a item-heal max(0) removed | 2 (negative heal bp tests) |
| S1-b item-heal min(missing) removed | 9 |
| S1-c hit-heal max(0) removed | 1 |
| S1-d hit-heal min(missing) removed | 2 |
| S1-e stealGold spell min(dGold) removed | 1 |
| S1-f stealGold spell n>0 removed | 1 |
| S1-g on-hit steal min(dGold) removed | 1 |
| S1-h on-hit steal `n > 0` -> `n >= 0` | 1 ("rounds down to 0 gold" test; first run was an equivalent mutant `!== 0`, so test added) |
| S1-h' spell steal `n > 0` -> `n >= 0` | 1 (same test) |
| S1-i useItem max(0) removed | 1 |
| S1-j useItem min(missing) removed | 5 |
| S1-k victoryReward xp clamp removed | 5 |
| S1-l victoryReward gold clamp removed | 4 |
| S1-m buildBlock MAX_STAT clamp removed | 2 |
| S2-a headroom check removed | 1 |
| S2-b bound one too strict | 3 |
| S2-c bound one too loose | 1 |
| S2-d literal task formula | 3 (shows the literal formula rejects reachable states) |
| S3-a reduceAs actor check removed | 7 |
| S5-a createGame uses raw settings | 2 |
| A2-a DECISION_KINDS ownGet -> `in` (PIT-002) | 8 (toString, constructor, hasOwnProperty, __proto__ for pending and lastReveal) |
| T2-a regen min(missing) removed | 2 |
| T3-a crit cap removed | 1 |
| T3-b crit hook term removed | 1 |
| T3-c crit per-luck term wrong | 12 (goldens plus the row) |
| T4-a heal pick reversed | 3 |
| T4-b covering tie -> later | 1 |
| T4-c non-covering tie -> later | 1 |
| T4-d covers `>` instead of `>=` | 1 |
| T4-e threshold `>=` | 1 |
| T4-f threshold +1 | 2 |
| T4-g stunned opponent not modelled as open | 3 |

## Purity probe mutations (T5 / S7)

Each eslint.config.js mutation makes `scripts/check-core-purity.mjs` exit 1 with only the matching probe(s) failing.

| Mutation | Failing probes |
|----------|----------------|
| ai regex alternative reducer / handlers / index / serialize / game / replay removed | one probe each (ai imports that module) |
| `@usurpia/core` regex broken | ai imports @usurpia/core |
| importNames HiddenState / GameState removed | name-ban probe(s) for that name |
| core ai-import ban broken | core imports the CPU AI |
| TSImportType selector broken | core and ai type-level import probes |
| `**` selector broken (both / Binary only / Assignment only) | `**` and/or `**=` probe |
| each of 22 Math members unbanned (acos .. tanh) | `ai uses Math.<name>` only |
| Math.random AI ban removed (control) | ai uses Math.random |

