# Outcomes

Agent execution outcomes recorded by `/legion:build` (memory-manager Section 3).

| Date | Phase | Plan | Agent | Task Type | Outcome | Importance | Tags | Summary |
|------|-------|------|-------|-----------|---------|------------|------|---------|
| 2026-09-26 | 01 | 01-01 | engineering-infrastructure-devops | ci-cd, tooling | success | 2 | foundations-deterministic-engine, engineering, json, yaml, ts | Monorepo + CI green; ESLint block-order fix for vitest.config.ts |
| 2026-09-26 | 01 | 01-02 | engineering-senior-developer | implementation, testing | success | 2 | foundations-deterministic-engine, engineering, ts | Core kernel: 125 tests, golden vectors matched, 6×200-run properties |
| 2026-09-26 | 01 | 01-03 | engineering-senior-developer | implementation, testing | success | 2 | foundations-deterministic-engine, engineering, ts, json | Content pipeline: 31 tests, build gate exits 1 on invalid data |
| 2026-09-26 | 01 | 01-04 | engineering-senior-developer | implementation, testing | success | 2 | foundations-deterministic-engine, engineering, ts | Views/sim/client; 181 tests; CI green via GitHub MCP; resolved plan-internal render conflict |
| 2026-09-26 | 01 | review | testing-qa-verification-specialist, testing-test-results-analyzer, engineering-security-engineer, engineering-infrastructure-devops | quality-review | failed | 5 | foundations-deterministic-engine, review-escalated, 3-cycles, serialize.test.ts | Phase 1 review escalated after 3 cycles — 1 test-only warning (vacuous duplicate-committed row); user accepted, fixed at acceptance |
| 2026-09-26 | 01 | review-fix | engineering-backend-architect, engineering-infrastructure-devops | bug-fix, hardening | success | 3 | foundations-deterministic-engine, engineering | 1 blocker (prototype-member player ids) + 12 warnings fixed across 2 fix cycles; tests 181→263 |
| 2026-09-29 | 02 | 02-01a | engineering-senior-developer | implementation, testing | success | 2 | combat-core-balance-sim, engineering, ts | Kernel v2 + Rules; resumed after API limit and a permission denial (user approved deletions); 209 tests |
| 2026-09-29 | 02 | 02-01b | engineering-senior-developer | implementation, testing | success | 1 | combat-core-balance-sim, engineering, ts | Decisions, deserialize v2, property suite; 437 tests; golden 9616698e |
| 2026-09-29 | 02 | 02-02 | engineering-senior-developer | implementation, testing | success | 1 | combat-core-balance-sim, content, ts | Content schemas/data/buildRules; rulesHash 84a995db; 39 cross-ref mutations proven |
| 2026-09-29 | 02 | 02-03 | engineering-senior-developer | implementation, testing | success | 1 | combat-core-balance-sim, engineering, ts | Combat engine; golden ec0c3508; ~77 mutations proven |
| 2026-09-29 | 02 | 02-04 | engineering-senior-developer | implementation, testing | success | 1 | combat-core-balance-sim, engineering, ts | Progression/inventory; rewards golden 57da3ea4; 70 mutations |
| 2026-09-29 | 02 | 02-05 | engineering-senior-developer | implementation, testing | success | 1 | combat-core-balance-sim, sim, ai, ts | CPU AI + sim, D1 gate; closing step pinned 120 per-duel hashes; 1187 tests total |
| 2026-10-01 | 02 | review | testing-qa-verification-specialist, testing-test-results-analyzer, engineering-security-engineer, engineering-senior-developer | quality-review | success | 2 | combat-core-balance-sim, review-passed, 2-cycles | Phase 2 review passed in 2 cycles; 17 warnings fixed (0 blockers); tests 1187→1465 |
| 2026-10-01 | 02 | review-fix | engineering-backend-architect | bug-fix, hardening | success | 2 | combat-core-balance-sim, engineering | Parallel worktree fixes (core; content/client/sim); all goldens unchanged |
