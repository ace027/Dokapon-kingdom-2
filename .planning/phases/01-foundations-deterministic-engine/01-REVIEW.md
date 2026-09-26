# Phase 1: Foundations & Deterministic Engine — Review Summary

## Result: ESCALATED → ACCEPTED (user override)

- **Cycles used:** 3 of 3 (maximum reached)
- **Mode:** Dynamic review panel (4 reviewers, non-overlapping rubrics)
- **Reviewers:**
  - testing-qa-verification-specialist (Production Readiness)
  - testing-test-results-analyzer (Verification & Test Quality)
  - engineering-security-engineer (hidden information & untrusted input)
  - engineering-infrastructure-devops (Operational Readiness)
- **Fix agents:** engineering-backend-architect (cycles 1–2), engineering-infrastructure-devops (cycle 1)
- **Completed:** 2026-09-26
- **Unresolved at escalation:** 1 WARNING, test-only. It was fixed and verified in the acceptance commit, so 0 remain.

## Findings Summary

| Severity | Found | Resolved | Deferred / accepted |
|----------|-------|----------|---------------------|
| BLOCKER | 1 | 1 | 0 |
| WARNING | 13 | 13 | 0 |
| SUGGESTION | 13 | 7 | 6 |

## Findings Detail

| Cycle | Severity | File | Issue | Fix | Cycle fixed |
|-------|----------|------|-------|-----|-------------|
| 1 | BLOCKER | core/src/handlers.ts | Player ids named after `Object.prototype` members (`toString`, `valueOf`…) put a function into `GameState` on timeout. This broke serialize and hash, crashed the sim CLI, and silently dropped the choice from views | `Object.hasOwn`/`ownGet` for every PlayerId-keyed record; regression tests; PROTO_IDS added to the arbitraries | 1 |
| 1 | WARNING | core/src/reducer.ts | Getters, Proxies and sparse arrays got past the shape guard | Canonicalize the action once via `JSON.parse(stableStringify(action))` | 1 |
| 1 | WARNING | core/src/serialize.ts | Shallow `deserialize`; a malformed save made `reduce` throw | Full-shape validation plus reducer tolerance guards | 1 |
| 1 | WARNING | eslint.config.js | Purity lint bypasses (`Math` alias, `Reflect`, `Intl` as a clock, `import()`, bare builtins, inline disable) | Extended restrictions, `noInlineConfig`, 8-case probe | 1 |
| 1 | WARNING | package.json / .nvmrc | Node floor below ESLint 10's supported range | `>=22.13`, `.nvmrc` 22.22 | 1 |
| 1 | WARNING | core/test/views.test.ts | Leak property did not guard hidden commit choices | Exact-view assertions; `arbGame` biased toward 3–4 players | 1 |
| 1 | WARNING | content tests | No test proved the build→validator wiring | `USURPIA_CONTENT_DIR` plus a real `pnpm build` subprocess test | 1 |
| 1 | WARNING | sim tests | Fixture hash not pinned | `595a3c9a` / `edac7d4a` pinned | 1 |
| 2 | WARNING | eslint.config.js | Function constructor reachable via `.constructor`; locale APIs unflagged | Lint selectors plus runtime backstop (`--disallow-code-generation-from-strings`, Math.random/Date.now traps), 11-case probe | 2 |
| 2 | WARNING | core/src/serialize.ts | Extra deeply-nested keys in a save poisoned serialize/hash | Exact own keys at every level; unique timedOut/committed; `MAX_COUNTER` bounds; overflow-rejecting handlers | 2 |
| 2 | WARNING | core/test/serialize.test.ts | "bad phase" / "required empty" tests passed only because another check failed first | Rebuilt from a valid decision state | 2 |
| 2 | WARNING | core/test/serialize.test.ts | Numeric `pending.id` / `lastReveal.decisionId` checks untested | New rows, each proven by mutation | 2 |
| 3 | WARNING | core/test/serialize.test.ts:471 | "duplicate pending.committed" test passed only because a length mismatch failed first | Row now also sets `choices = {p1, p2}`. Verified: deleting `isUnique(committed)` fails exactly this test | Acceptance commit |

## Reviewer Verdicts (final cycle)

| Reviewer | Verdict | Key observations |
|----------|---------|------------------|
| testing-qa-verification-specialist | PASS | 209k random reduce steps and 2.9k save mutations: no legitimate state rejected, every invalid one rejected |
| testing-test-results-analyzer | NEEDS WORK → resolved | 26/27 mutants caught; the survivor (M6b) is now caught; all 6 ROADMAP criteria proven |
| engineering-security-engineer | PASS | All prior findings resolved; string→code routes throw at runtime; no hidden-info regression |
| engineering-infrastructure-devops | PASS | Vitest split runs every test exactly once; `execArgv` confirmed applied; CI green on `1f24e28` (run 36261733021) |

## ROADMAP Phase 1 Success Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Pipeline passes locally and in GitHub Actions on `dev` (the PR-to-`main` trigger is configured but not yet exercised) | Proven |
| 2 | Replay reproduces an identical state hash | Proven (pinned hashes) |
| 3 | JSON round-trip with schema version | Proven |
| 4 | Wrong player/phase rejected; views hide secrets | Proven |
| 5 | Commit/reveal and timeout deterministic | Proven |
| 6 | Invalid content fails the build | Proven |

## Suggestions (noted, not required)
- Pin GitHub Actions to commit SHAs. The runner also warns that the v4 actions target Node 20.
- `pnpm build` does not typecheck on its own; CI runs typecheck first.
- Keep IO/parse error detail and strip a UTF-8 BOM in the sim/content loaders.
- Document the fast-check seed policy; the purity traps now pin the seed per test.
- Views reference live state objects. Freeze them or copy them before a transport layer mutates anything (accepted as-is for Phase 1).
- Residual obfuscated lint bypasses:
  - Descriptor or computed `constructor` access is caught at runtime by the backstop.
  - `String.prototype.localeCompare.call` and computed locale keys are not caught at runtime.
  - Optional selectors: `callee.property.value`, and banning `.prototype` and `getOwnPropertyDescriptor(s)` in core.

## User Override
The review escalated after 3 cycles with 1 unresolved test-only WARNING. The user accepted Phase 1 as-is on 2026-09-26. The one-line test fix was then applied and verified: the mutant is caught and the full pipeline passes with 263 tests. So no findings remain unresolved.

## Commits
- `8cc8270`, `931c658`: spec amendments (review cycles 1–2)
- `ad5eca6`, `45a8813`: cycle 1 fixes
- `1f24e28`: cycle 2 fixes
- Acceptance commit: this file plus the cycle 3 test fix
