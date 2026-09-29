# Preferences

Project-specific preferences recorded via `/legion:learn`.
Referenced by `/legion:plan` and `/legion:build` for context-aware execution.

## PRF-001: Use GitHub MCP tools for all GitHub operations, not the gh CLI
- **Date**: 2026-09-26
- **Type**: preference
- **Tags**: github, mcp, ci, issues, gh
- **Phase**: Phase 1 (planned)

Use the GitHub MCP tools (`mcp__github__*`) for all GitHub operations:
- issues and labels (`issue_write`, `get_label`, `search_issues`)
- PRs (`create_pull_request`, `pull_request_read`)
- CI run status and job logs (`actions_list`, `actions_get`, `get_job_logs`)

The `gh` CLI is not available in this environment. When a Legion step says to check `gh auth status`, treat GitHub as **available** through MCP, and never skip a GitHub step because `gh` is missing. Labels that don't exist yet are auto-created when passed to `issue_write` on create.

---

## PRF-002: Review-override — accept when only test-guard gaps remain
- **Date**: 2026-09-26
- **Type**: preference
- **Tags**: review-override, accepted-with-issues, foundations-deterministic-engine
- **Phase**: Phase 1
- **Signal**: corrective

Phase 1 review escalated after 3 cycles with 1 test-only WARNING. Production code was correct, and the finding was a vacuous negative test. The user accepted as-is and moved on to planning the next phase. The one-line fix was applied at acceptance.

Implication: once production code is verified correct, residual test-assertion gaps should not block phase completion.

---

## PRF-003: Balanced cost profile — per-role model tiers from Phase 2 on
- **Date**: 2026-09-29
- **Type**: preference
- **Tags**: cost-profile, models, agents, subagents
- **Phase**: Phase 2 onward

Apply the Balanced cost profile explicitly by passing `model` on every spawned agent. Phase 1 ran everything on Opus because no override was passed.

| Role | Model | Examples |
|------|-------|----------|
| Planning / design | `opus` (Opus 5.5) | architecture proposals, spec pipeline and spec critique, plan critique (pre-mortem, assumptions), phase decomposition |
| Review | `opus` | `/legion:review` panel reviewers and re-reviewers |
| Execution | `sonnet` (Sonnet 5) | `/legion:build` plan executors, review fix agents, code polish |
| Checks | `haiku` (Haiku 4.5) | read-only verification sweeps, CI-run polling, simple lookups and status checks |

The orchestrator (main session) stays on the session model. If a Sonnet executor fails a plan twice on complexity (not environment), escalate that plan to Opus and note it in the SUMMARY.

---
