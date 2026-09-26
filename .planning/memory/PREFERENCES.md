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
