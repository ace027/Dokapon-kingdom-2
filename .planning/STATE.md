# Project State

## Current Position
- **Phase**: 2 of 8 (planned)
- **Status**: Phase 2 planned — 6 plans across 4 waves (W1a → W1b → W2 ∥ → W3 ∥ + closing step)
- **Last Activity**: Phase 2 planning (2026-09-29)

## Progress
```
[####·································] 11% — 4/37 plans complete
```

## Recent Decisions
- Execution mode: Guided
- Planning depth: Deep Analysis (8 phases mirroring milestones M0–M7; online multiplayer is a post-MVP milestone)
- Cost profile: Balanced — from Phase 2 on, applied explicitly per agent role (planning/review → Opus 5.5, execution/fix → Sonnet 5, checks → Haiku 4.5); Phase 1 ran all agents on Opus (see memory PRF-003)
- Design source: `.planning/explorations/2026-09-26-dokapon-spiritual-sequel-design.md`
- Codebase map: skipped (greenfield, no source code)
- Branching: work on `dev`, release from `main`
- Phase 1 architecture: hybrid of Pragmatic + Clean (sfc32 RNG, handler-map reducer returning Result, partitioned public/private/hidden state, commit/reveal + system timeout, tsc -b)
- Phase 1 spec: `.planning/specs/01-foundations-deterministic-engine-spec.md` (critiqued, revised); TypeScript pinned ~6.0.3 because of typescript-eslint peer range
- Phase 1 plan critique: REWORK/CAUTION → plans revised; wave 2 runs in parallel with package-scoped commands
- Phase 1 executed: 4/4 plans (01af5fa, 3fe9c24, b64661f, c7c5074); 181 tests; CI green on dev (run 36259658975); fixture hash 595a3c9a
- Phase 1 review: 3 cycles, 1 blocker + 13 warnings fixed; 263 tests; CI green on 1f24e28; see 01-REVIEW.md
- Phase 2 forward-compat: reduce(state, action, rules) with data-only Rules (rulesHash in replays); generic decisions opened internally; sample module deleted, schema v2; CPU AI own RNG, PlayerView-only
- Phase 2 architecture: Hybrid Pragmatic-based (combat/{stats,resolve}, progression, inventory, handlers/*, ai/; data-tagged passives; public choiceHistory; switchClass explicit discard)
- Phase 2 spec: critiqued (CAUTION) and revised; verify-spec 56/56; golden oracle .planning/reference/phase-02; D1 gate = Hard ≥70% of decisive AND ≤40% draws per mirror; D2 Ward without ward spell = Guard multiplier; 20 NPC definitions
- Phase 2 plans: critiqued (CAUTION/CAUTION) and revised; parallel waves run in separate git worktrees, orchestrator merges, runs full pipeline, pushes and checks CI after every wave
- Golden policy after Phase 2: reference oracle frozen after 02-05 closing step; later phases re-pin from the TS engine; balance gates become thresholds
- 01-04 deviation accepted: seated player with no note renders `your note: (none)` (plan-internal conflict; render contract wins)

## Next Action
Run `/legion:build` to execute Phase 2: Combat Core & Balance Sim (see 02-CONTEXT.md "Wave execution protocol")

## GitHub
- Phase 1 issue: #1 — https://github.com/ace027/Dokapon-kingdom-2/issues/1 (label: legion) — closed after review
- GitHub access: via GitHub MCP tools (no `gh` CLI in this environment)
