# Usurpia — Roadmap

## Phases

- [x] Phase 1: Foundations & Deterministic Engine (4 plans)
- [ ] Phase 2: Combat Core & Balance Sim (6 plans)
- [ ] Phase 3: Board, Economy & CPU AI Core (6 plans)
- [ ] Phase 4: Graybox Client & Hot-Seat Play (5 plans)
- [ ] Phase 5: Griefing, Cursed Crown & Boss (5 plans)
- [ ] Phase 6: Vertical Slice — Art, Audio, Onboarding & Accessibility (5 plans)
- [ ] Phase 7: MVP Completion & itch.io Release (4 plans)
- [ ] Phase 8: Release Prep (3 plans)

*Post-MVP milestone (not yet phased): **Online Multiplayer**, with a server-authoritative Colyseus server, room codes, reconnect with CPU takeover, and mixed local+online seats. See the design doc's Online Multiplayer Plan.*

## Phase Details

### Phase 1: Foundations & Deterministic Engine
**Goal**: A pnpm monorepo with CI and a pure, deterministic, online-ready rules-engine skeleton that every later system plugs into.
**Requirements**: R1, R2, R3, R4
**Recommended Agents**: engineering-senior-developer, engineering-infrastructure-devops, testing-qa-verification-specialist
**Success Criteria**:
- [ ] `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes locally and in GitHub Actions on `dev` and PRs to `main`.
- [ ] The `core` reducer applies a sample action and emits events; replaying `(seed, settings, actions)` reproduces an identical state hash (test).
- [ ] State, actions and events round-trip through JSON serialization with a schema version (test).
- [ ] An action from the wrong `playerId`/phase is rejected; `viewFor`/`redactEvent` hide a sample secret field (test).
- [ ] A commit/reveal sample flow and a `timeout` action resolve deterministically (test).
- [ ] Invalid content data fails the build via zod schema validation.
**Plans**: 4

### Phase 2: Combat Core & Balance Sim
**Goal**: The complete combat system, classes, progression, items/spells and monsters in `core`/`content`, validated headlessly by a balance simulator.
**Requirements**: R5, R6, R7, R8, R9
**Recommended Agents**: engineering-senior-developer, engineering-ai-engineer, project-management-experiment-tracker, testing-qa-verification-specialist
**Success Criteria**:
- [ ] Every cell of the resolution matrix (3×3) is unit-tested, including Strike reflection and a failed Counter.
- [ ] 4 base classes with mastery passives (ranks 1–5) and hybrid unlock logic (Spellblade, Shadowpriest) pass tests.
- [ ] Gear, spell slots, field-spell scrolls and class-sized bags enforce their limits; overflow on class switch is handled.
- [ ] ~20 monsters and 3 guardian archetypes load from `content` with tiered stat curves (satisfied as 20 NPC definitions: 16 zone monsters + 3 guardians + the Crown Enforcer).
- [ ] `pnpm sim duel --n 10000` completes and reports class-vs-class and class-vs-monster win rates.
- [ ] The combat CPU (Easy/Normal/Hard) runs headless; Hard beats Easy ≥ 70% in mirror matchups.
**Plans**: 6

### Phase 3: Board, Economy & CPU AI Core
**Goal**: A full game playable headlessly: map, movement, towns, weekly decrees/errands/Gazette, victory and persona-driven CPU AI.
**Requirements**: R10, R11, R12, R13, R14
**Recommended Agents**: engineering-senior-developer, engineering-ai-engineer, data-analytics-engineer, testing-qa-verification-specialist
**Success Criteria**:
- [ ] A Tiled-authored ~75-space open-web map loads; reachable-set and shortest-path queries are tested.
- [ ] Town liberate/invest/tax/seize and the Assets formula are tested.
- [ ] Decrees, errands (with reroll) and the Gazette deck resolve deterministically from `content` data.
- [ ] Deadline victory, the boss lair unlock, persistent boss HP, Royal Bonus Awards and the tally are tested (the boss fight uses a placeholder until Phase 5).
- [ ] `pnpm sim game --n 1000` runs all-CPU 4-player games to completion and reports length, asset variance and decree completion rate (target 70–85%).
- [ ] Sim health: Hard ≥ 60% vs Normal; no persona > 35% win rate at equal difficulty.
**Plans**: 6

### Phase 4: Graybox Client & Hot-Seat Play
**Goal**: A complete game playable end-to-end in the browser with placeholder art. This is the first human playtest.
**Requirements**: R15, R16
**Recommended Agents**: engineering-frontend-developer, design-ux-architect, testing-qa-verification-specialist
**Success Criteria**:
- [ ] The board scene shows the map, tokens, reachable-destination highlights with path preview, minimap and auto-framing camera.
- [ ] The battle scene lets the attacker choose Attack/Strike/Spell and the defender Guard/Counter/Ward, with a pass-the-device interstitial for human-vs-human choices.
- [ ] The setup screen supports 1–4 players (human/CPU, class, persona/difficulty) and 3/4/5 weeks.
- [ ] Autosave each turn, manual save/export and resume from the title all work.
- [ ] The client renders only from `viewFor` (a test or lint rule forbids raw-state access).
- [ ] **Playtest #1:** 2–4 people finish a full game in a browser; feedback is logged in `.planning/playtests/`.
**Plans**: 5

### Phase 5: Griefing, Cursed Crown & Boss
**Goal**: The signature identity: PvP griefing, joke items, field spells, the Cursed Crown and The Crown's Body boss.
**Requirements**: R17, R18, R13 (boss fight completion), R5 (hybrids in the client)
**Recommended Agents**: engineering-senior-developer, engineering-frontend-developer, design-whimsy-injector, testing-qa-verification-specialist
**Success Criteria**:
- [ ] PvP reward choices (steal gold, steal item, seize town, humiliate) work, with layered cosmetics on sprites and portraits.
- [ ] 5 joke items and 8 field spells work in `core` and the client.
- [ ] Cursed Crown trigger, 3-turn duration, 4 powers, hoard survival and bounty are tested; the final-week handoff to the boss is tested.
- [ ] The Crown's Body 3-phase boss fight with persistent HP and KO reward works end-to-end.
- [ ] Sim: crowned-player win rate is 15–25%; Menace doesn't lengthen games > 20%.
- [ ] Playtest #2 is logged.
**Plans**: 5

### Phase 6: Vertical Slice — Art, Audio, Onboarding & Accessibility
**Goal**: A presentable slice that new players can learn on their own, with licensed art/audio, tutorial, tips and the full accessibility set.
**Requirements**: R19, R20, R21
**Recommended Agents**: design-ui-designer, engineering-frontend-developer, design-ux-researcher, testing-qa-verification-specialist
**Success Criteria**:
- [ ] 640×360 integer-scaled pixel rendering with licensed/CC0 assets; every asset is listed in `CREDITS.md` with a license link.
- [ ] Zone music, battle/PvP/Crown/boss themes and comedic stingers play; music and SFX volumes are separate.
- [ ] The guided first week (~3 minutes, skippable) and one-time contextual tips work; the `?` glossary is available.
- [ ] Accessibility: colorblind presets with color+shape tokens, 3 text sizes, high contrast, dyslexia font, animation speed, reduced motion and full remapping (keyboard, gamepad, mouse-only).
- [ ] **Playtest #3:** new players learn via the tutorial; the median game is 45–60 minutes.
**Plans**: 5

### Phase 7: MVP Completion & itch.io Release
**Goal**: All MVP content complete and performant, released on itch.io.
**Requirements**: R22
**Recommended Agents**: engineering-frontend-developer, testing-performance-benchmarker, engineering-infrastructure-devops, project-manager-senior
**Success Criteria**:
- [ ] All MVP content from the design doc is implemented and sim-balanced.
- [ ] 60 fps on a mid-range laptop profile; production bundle < 15 MB.
- [ ] CI builds and deploys the HTML5 build to itch.io (unlisted) plus GitHub Pages previews from `dev`.
- [ ] The friends-and-family playtest is complete; blocking bugs are fixed; a public demo is published.
- [ ] `main` is tagged with the MVP release.
**Plans**: 4

### Phase 8: Release Prep
**Goal**: Legally and commercially ready for a wider indie release.
**Requirements**: R23
**Recommended Agents**: support-legal-compliance-checker, design-brand-guardian, project-management-studio-producer
**Success Criteria**:
- [ ] Trademark/Steam/itch/domain/social checks for "Usurpia" are complete; the final title is confirmed and the repo renamed.
- [ ] Commissions are briefed and budgeted (class sprites, Crown, boss, monarch, guardians, key art, main themes).
- [ ] A Steam page draft with capsule art and trailer plan exists.
- [ ] An online multiplayer technical spike (Colyseus room running `core`) is documented; the go/no-go for Next Fest or Early Access is recorded.
**Plans**: 3

## Progress

| Phase | Plans | Completed | Status |
|-------|-------|-----------|--------|
| 1. Foundations & Deterministic Engine | 4 | 4 | Complete (reviewed) |
| 2. Combat Core & Balance Sim | 6 | 0 | Not started |
| 3. Board, Economy & CPU AI Core | 6 | 0 | Not started |
| 4. Graybox Client & Hot-Seat Play | 5 | 0 | Not started |
| 5. Griefing, Cursed Crown & Boss | 5 | 0 | Not started |
| 6. Vertical Slice | 5 | 0 | Not started |
| 7. MVP Completion & itch.io Release | 4 | 0 | Not started |
| 8. Release Prep | 3 | 0 | Not started |
