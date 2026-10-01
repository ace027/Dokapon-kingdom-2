# Phase 2: Combat Core & Balance Sim — Review Summary

## Result: PASSED

- **Cycles used:** 2 of 3 (cycle 1 found 17 warnings; cycle 2 found none)
- **Mode:** Dynamic review panel (4 reviewers, non-overlapping rubrics; all on Sonnet 5.5 per PRF-006)
- **Reviewers:**
  - testing-qa-verification-specialist (Production Readiness)
  - testing-test-results-analyzer (Verification & Test Quality)
  - engineering-security-engineer (hidden information & untrusted input)
  - engineering-senior-developer (Code Architecture)
- **Fix agents:** engineering-backend-architect (core scope; content/client/sim scope), run in parallel worktrees
- **Completed:** 2026-10-01
- **Post-review polish:** skipped. The phase is 105 files and the fix cycle already consolidated duplication; a repo-wide polish pass was not worth the usage cost.

## Findings Summary

| Severity | Found | Resolved | Deferred / accepted |
|----------|-------|----------|---------------------|
| BLOCKER | 0 | 0 | 0 |
| WARNING | 17 (cycle 1) | 17 | 0 |
| LOW / SUGGESTION | 9 (cycle 1) + 6 (cycle 2) | 8 | 7 |

## Cycle 1 findings (all WARNING, all fixed in 558168e / 2ae5f88)

| Reviewer | Issue | Fix |
|----------|-------|-----|
| Security | Schema-legal content bp values (negative heal/drain/steal, oversized) could push hp, gold, xp or sheet stats out of the ranges `deserialize` enforces | Engine clamps at every consumer; content schemas bounded per field and per hook (`HOOK_RANGES`); worst-case MAX_STAT sheet check |
| Security | `deserialize` accepted a combat with no `decisionSeq` headroom; the next `openDecision` overflowed | Exact slot-based bound (`decisionSeq + 2*maxRounds - slot <= MAX_COUNTER`), proven both ways in cycle 2 |
| Security | `reduce` trusts the `playerId` on an action | New `reduceAs(state, action, rules, actor)`; `reduce` documented as host-internal |
| Architecture | `assemble` built `Rules` through an unchecked `as Rules` | Typed `const rules: Rules`; compiler now rejects a missing field |
| Architecture | `DECISION_KINDS` / `ACTION_TYPES` unchecked mirrors of closed unions | `Record<DecisionKind,true>` via `ownGet`; unused `ACTION_TYPES` removed |
| Architecture | Copy-pasted helpers across handlers/validation | One definition each in `handlers/shared.ts` / `validation.ts` |
| Architecture | `v: 2` literal in ~70 places | `SCHEMA_VERSION` in core src (a few literals remain in client/sim input construction) |
| Architecture | 312-line `TEST_RULES` copy shipped in the client | Client builds rules from real content via `@usurpia/content/shipped` |
| Architecture | Two error-path forms in content validation | Normalised to root-relative paths; `battle`/`ward` labels were already root keys of spells.json (dispute upheld) |
| Architecture | Runtime import cycle rules → serialize → combat/stats → rules | New leaf `canonical.ts`; no cycles in the core import graph |
| Production readiness | `loadRules` threw `content invalid: N errors` and dropped the list | `ContentInvalidError` with `file path: message` lines; sim CLI prints them, exit 1 |
| Test quality (x6) | `n/a` report branch untested; regen clamp, crit cap and crit hook, three AI branches, AI-ban probe cases, shipped hybrid unlock all untested | New tests; each mutation that survived in cycle 1 is killed by its own test in cycle 2 |

## Cycle 2 verdicts

| Reviewer | Verdict | Key observations |
|----------|---------|------------------|
| testing-qa-verification-specialist | PASS | ~15.6k reachable-state round-trips, 283 forged states at the exact `decisionSeq` bound, 1,800 combats with extreme crafted rules, 6,000 mutated saves: no invariant break, every rejection typed |
| testing-test-results-analyzer | PASS | 59 new mutations, 55 killed; T1–T6 re-verified; pre-existing goldens byte-identical; client goldens hand-verified (warrior hp 46, mage hp 34) |
| engineering-security-engineer | PASS | No bypass of the clamps, the bound or `reduceAs`; no hidden-information regression |
| engineering-senior-developer | PASS | All nine cycle-1 findings verified; no import cycle; client→content coupling accepted |

## Cycle 2 follow-ups (applied at completion)

- `isDecisionKind`'s `typeof === "string"` guard now has array-valued `pending.kind` / `lastReveal.kind` rows
- `createGame` specific-`SettingsError` precedence test added
- `ContentInvalidError.name` asserted
- `02-REVIEW-FIX-core.md` corrected to the real `reduceAs(state, action, rules, actor)` signature
- Each proven by mutation; full pipeline green with 1465 tests

## Suggestions / deferred (noted, not required)

- **Spec decision needed:** the public `steal-item:<id>` effect tag names the stolen item to every viewer (the spec mandates the tag; bag contents are otherwise private). Decide whether to publish the id or emit a private event.
- `viewFor` / events share live state objects (accepted in Phase 1; copy or freeze before a transport layer exists).
- `reduceAs` has no in-repo consumer until Phase 5; `reduce` still canonicalizes before any size check (host should cap body size).
- Several `wardReflectBp` / `stealGoldOnHitBp` hooks can sum past 100% (clamped by hp / gold, balance only); stolen on-hit gold is destroyed rather than credited. Confirm against the design.
- Board hooks (`spellPriceBp`, `lootLuckBp`, `pvpExtraSteal`, `fieldSpellMove`) are only per-hook bounded; Phase 3 must add engine clamps when it applies them.
- No lint guard keeps content's browser entries off `node:*`, or the client off `@usurpia/content/node`.
- CLI: a nonexistent `USURPIA_CONTENT_DIR` prints a raw stack; `duel` loads content before parsing flags; `--n` is uncapped; the perf test has a wall-clock bound.
- `buildShippedRules` failure branch is untested (unreachable with valid data).
- `revealDecision` hard-codes `combat/exchange` for `choiceHistory`; `isNpcRef` / `checkNpcRef` overlap; `serialize.ts` is still the largest module (split per partition in Phase 3).
- v2 saves will not load after a v3 bump without an explicit migration step (documented at `deserialize`).
- Client bundle grew from 15 to 50 kB gzip (zod and validators); prebuild the `Rules` JSON if size matters later.

## ROADMAP Phase 2 Success Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | 12 matrix cells unit-tested incl. Strike reflection and failed Counter | Proven |
| 2 | 4 classes, mastery passives ranks 1–5, hybrid unlocks | Proven (shipped hybrids now tested with shipped content) |
| 3 | Gear, spell slots, scrolls, bags enforce limits; class-switch overflow | Proven |
| 4 | 20 NPC definitions with tiered curves | Proven |
| 5 | `pnpm sim duel --n 10000` completes and reports win rates | Proven (about 6 s) |
| 6 | Hard ≥ 70% of decisive duels, ≤ 40% draws per mirror | Proven; QA re-ran on a different seed: 74–87% decisive, 8–26% draws |

## Commits
- `ee47b8f`: Phase 2 build results (review start)
- `558168e`, `2ae5f88`: cycle 1 fix merges (core; content/client/sim)
- Acceptance commit: this file plus the cycle 2 follow-ups
