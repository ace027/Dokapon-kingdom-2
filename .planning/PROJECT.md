# Usurpia

## What This Is
Usurpia (working title; repo codename `Dokapon-kingdom-2`) is a browser-based spiritual sequel to Dokapon Kingdom. It is a friendship-ruining board game + JRPG hybrid for 1–4 local hot-seat players plus CPU opponents. Players race across a single-region pixel-art kingdom to amass the most Assets in a 45–60 minute game. Along the way they liberate towns, battle monsters with hidden-choice combat, and betray each other.

## Core Value
"The RPG board game that ruins friendships, now in your browser, in under an hour."
- Deep RPG progression and mind-game combat in a party-game format.
- A risk/reward comeback villain (the Cursed Crown) and satirical griefing.
- Original IP aimed at an eventual indie release.

## Who It's For
- Friend groups of 2–4 who like party games with teeth.
- Fans of Dokapon Kingdom and 100% Orange Juice.
- Solo players versus CPU opponents.

## Requirements

### Validated
(None yet — ship to validate)

### Active
**Foundations & engine**
- [ ] R1: pnpm monorepo (`core`, `content`, `client`, `sim`) with strict TypeScript, Vite, Vitest, ESLint/Prettier, and GitHub Actions CI on `dev`/`main`.
- [ ] R2: pure deterministic rules engine, `reduce(state, action) -> {state, events}`, with seeded RNG held in state and replay from `(seed, settings, actions)`.
- [ ] R3: online-readiness constraints enforced by tests:
  - JSON-serializable, versioned state/actions/events
  - `playerId` on every action
  - per-player redacted views and events
  - commit/reveal for hidden choices
  - timeouts as actions
- [ ] R4: data-driven `content` package with zod schemas validated at build time.

**Combat core**
- [ ] R5: six stats (HP/ATK/DEF/MAG/SPD/LUCK), 4 base classes (Warrior, Thief, Mage, Cleric), character level plus per-class mastery (ranks 1–5 with passives), and hybrid unlocks at rank 3 in two classes (Spellblade, Shadowpriest in the MVP).
- [ ] R6: asymmetric combat: the attacker picks Attack/Strike/Spell, the defender picks Guard/Counter/Ward, resolved with the resolution matrix, SPD initiative, up to 3 rounds, and flee.
- [ ] R7: gear (Weapon/Shield/Accessory), Battle Spell + Ward Spell slots, up to 3 field-spell scrolls, class-sized bag, ~12 consumables, ~15 gear pieces, 8 battle spells, 4 ward spells and 8 field spells.
- [ ] R8: ~20 satirical "monsters with day jobs" across 4 zone tiers, 3 town-guardian archetypes and the Crown Enforcer, with weighted command tables.
- [ ] R9: headless balance simulator CLI (`pnpm sim`) reporting win rates, game length, asset variance and per-content stats.

**Board & economy core**
- [ ] R10: open-web graph map (60–90 spaces, Tiled JSON, 4 blended zones around a central Castle), spinner, reachable-set and path choice, and all space types.
- [ ] R11: invest-to-grow towns: liberate, invest (up to 3× base), 10% weekly tax, seize via PvP or Usurp. Assets = gold + items + towns + awards.
- [ ] R12: weekly cycle with a public Royal Decree race (~10), private Personal Errands (~12, one reroll per week) and a Kingdom Gazette event deck (~24).
- [ ] R13: victory by a 3/4/5-week deadline, the optional final-week boss (The Crown's Body, persistent HP, KO bonus + hoard), Royal Bonus Awards and a dramatic tally.
- [ ] R14: CPU AI: headless utility AI combining difficulty (Easy/Normal/Hard, never cheating) with a persona (Tycoon, Menace, Adventurer, Opportunist). Combat uses expected value plus opponent modeling.

**Client & play experience**
- [ ] R15: Phaser 3 client with board and battle scenes, path preview, minimap and camera framing, rendered from per-player views.
- [ ] R16: game setup (1–4 players, human/CPU, class, weeks), a pass-the-device hot-seat interstitial, fast-forwardable CPU turns, and autosave/manual save/export.
- [ ] R17: PvP griefing (steal gold/item, seize town, humiliate with layered cosmetics), 5 curated joke items and persona bark lines.
- [ ] R18: the Cursed Crown:
  - Trigger: last place < 40% of the leader's Assets at week start (can repeat on the same player).
  - Lasts 3 turns.
  - Powers: Tyrant's Tax, Blight, Summon, Crown Warp.
  - Hoard is kept if the wearer survives, or paid as a bounty to whoever defeats them.
- [ ] R19: art/audio pass: 640×360, 32px tiles, integer scaling, storybook palette with zone accents, licensed/CC0 packs tracked in `CREDITS.md`, jaunty chiptune-orchestral music and comedic stingers.
- [ ] R20: onboarding: a skippable ~3-minute guided first week, one-time contextual tips, and a rules glossary.
- [ ] R21: accessibility: colorblind-safe color+shape, text/UI scale and high contrast, dyslexia font, animation speed and reduced motion, full input remapping.
- [ ] R22: MVP completion: all MVP content, 60 fps on mid-range laptops, bundle < 15 MB, itch.io HTML5 release.
- [ ] R23: release prep: title/trademark clearance and repo rename, commissioned signature art and themes, Steam page, online multiplayer technical spike.

### Out of Scope
- Online multiplayer in the MVP (planned post-MVP: server-authoritative Colyseus rooms, private codes, reconnect with CPU takeover, mixed local+online seats).
- Public matchmaking, accounts, friends lists, ranked play, spectators, async play.
- Multi-region campaign and story cutscenes.
- Remaining 4 hybrids (Paladin, Rogue-Mage, Duelist, Oracle).
- Monetization and mobile-native builds.
- Any original Dokapon assets, names or text.
- AI-generated final art assets.

## Constraints
- Original IP only; "Dokapon" never appears in a public build. Asset licenses must permit commercial use.
- Browser-first (TypeScript + Phaser 3); static deploy.
- 60 fps on mid-range laptops; MVP bundle < 15 MB.
- `core` stays pure and deterministic (no `Date`/`Math.random`, no DOM). All randomness comes from the seeded RNG in state.
- Hard CPUs never read hidden information.
- Branching: `main` is release, `dev` is integration; feature branches merge into `dev`.
- Solo developer with AI assistance; no fixed timeline.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Design source | Full design exploration completed before init | `.planning/explorations/2026-09-26-dokapon-spiritual-sequel-design.md` |
| Codebase map | No source code at init (greenfield) | Skipped, not applicable |
| Architecture | Testable rules, headless AI/sim, online later without a rewrite | Headless TS core + Phaser client (Approach B) |
| Platform & multiplayer | Instant sharing; fastest route to validating fun | Web browser; local hot-seat + CPU for the MVP |
| Combat model | Proven, readable mind games | Asymmetric Attack/Strike/Spell vs Guard/Counter/Ward |
| Progression | Encourages class experimentation and depth | Character level + class mastery + hybrid unlocks |
| Comeback mechanic | Original, risk/reward instead of a free win | Cursed Crown with a hoard/bounty |
| Setting | Justifies the asset race; satirical tone | Satirical fairy-tale kingdom, "Heir Auction" premise |
| Working title | Clear search space; doubles as the world name | Usurpia (trademark clearance pending) |
| Map shape | Freedom and PvP crossings | Open web + readability safeguards |
| Online readiness | Avoid a rewrite later | Constraints enforced in `core` from Phase 1 |
| Milestone order | Validate rules via tests/sim before visuals | Rules-first; first human playtest at the graybox |
| Execution mode | Default recommendation | Guided |
| Planning depth | Complex, multi-system game | Deep Analysis |
| Cost profile | Default recommendation | Balanced |

## Architecture Influences
- **Packages:**
  - `packages/core`: pure rules, reducer, legal-move generator, AI, redacted views.
  - `packages/content`: typed data + zod.
  - `packages/client`: Phaser 3 scenes rendering the event stream.
  - `packages/sim`: balance simulator CLI.
  - Future `packages/server`: Colyseus wrapper around `core`.
- **Tooling:** pnpm workspaces, Vite, Vitest, ESLint/Prettier, GitHub Actions. Tiled for maps; Aseprite for sprites.
- **Persistence:** localStorage snapshots with a versioned save schema and export file.
- **Deploy:** itch.io HTML5 and GitHub Pages previews.
- **Competitive context:** Dokapon Kingdom / Connect (the closest reference), 100% Orange Juice (indie peer), Mario Party (lacks RPG depth).

---
*Last updated: 2026-09-26 after initialization*
