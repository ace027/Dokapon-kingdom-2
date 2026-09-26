# Design Exploration — Dokapon-Style Spiritual Sequel (working title "Dokapon Kingdom 2")

## Initial Ask
Build a **spiritual sequel** to Dokapon Kingdom: a friendship-ruining party game that fuses a board game with a JRPG. Keep the familiar core loop, add fresh twists, and ship as original IP with the goal of an eventual indie release.

## Research Summary
- **Facts**
  - Dokapon Kingdom (Sting/Atlus, 2008 Wii/PS2; *Dokapon Kingdom: Connect* for Switch/PC, 2022) is a 1–4 player board game + RPG hybrid.
  - Victory goes to the most **Assets**: gold + item value + owned towns.
  - The core loop is to spin to move, land on spaces (battle, item, loot, town, shop, and so on), free monster-held towns, invest in them, and complete weekly chapter quests from the King.
  - Combat uses a hidden-choice triangle: **Attack / Strike / Counter** (Strike beats Attack, Counter beats Strike, Attack beats Counter), plus Magic (offensive/defensive) and Defend.
  - There are jobs/classes with levels, gear (weapon/shield/accessory), battle magic and field magic (curses and buffs cast on the board).
  - PvP griefing is the signature: the winner steals gold, items or a town, or humiliates the loser (haircut, face paint, rename). A losing or KO'd player can become the **Darkling**, a temporary villain with powerful abilities.
  - *Connect* added online play, which shows ongoing demand. The genre is small, with few modern competitors (Mario Party lacks RPG depth; 100% Orange Juice is the closest indie peer).
- **Inferences**
  - The fun comes from **social volatility**: comeback swings, hidden-choice mind games and griefing. Rules must keep every player in contention late.
  - A deterministic, headless rules engine makes CPU opponents, balance simulation, replays and later online play all much cheaper.
  - Short sessions (45–60 min) fit modern friend groups better than the original's multi-hour campaign.
- **Assumptions**
  - Names, characters, art, music and text will be fully original. "Dokapon" is Sting/Idea Factory IP and appears only as the working repo name.
  - Players accept a pixel-art presentation.
  - Solo developer (plus AI assistance) with no fixed timeline.

## Product Definition
- **Target users:** friend groups (2–4) who like party games with teeth, fans of Dokapon/100% Orange Juice, and solo players against CPUs.
- **Primary outcome:** a 45–60 minute browser game where 1–4 humans (hot-seat) plus CPUs race for Assets on one region map, with meaningful RPG progression and hilarious betrayal.
- **Value proposition:** "The RPG board game that ruins friendships, now in your browser, in under an hour."
- **Non-goals (MVP):**
  - Online multiplayer, accounts, matchmaking
  - Multi-region campaign, story cutscenes
  - Monetization, mobile-native builds, controller-perfect UX
  - Any original-game assets, names or text

## Recommended Approach
**B. Balanced: a headless TypeScript rules engine plus a Phaser 3 renderer in a monorepo.**

- `packages/core`: pure TS game rules with no rendering or DOM. It uses seeded RNG, an immutable `GameState` and a `reduce(state, action) -> {state, events}` action/event model. It is 100% unit-testable, and CPU AI and balance simulations run against it.
- `packages/client`: Phaser 3 scenes (board, battle, menus) that dispatch actions to `core` and animate the emitted events.
- `packages/content`: data-driven JSON/TS definitions for map, classes, monsters, items, spells and events, with schemas validated at build time.
- Tooling: Vite, Vitest, ESLint/Prettier, pnpm workspaces. Deploy the static client to itch.io / GitHub Pages.

**Rationale:** there is no timeline, so doing the architecture upfront costs little. The separation lets us:
1. Build and balance the rules test-first.
2. Write CPU AI that simulates thousands of headless games.
3. Add online play later by running the same `core` on a server (e.g. Colyseus) without a rewrite.

This is essential for the indie-release goal.

## Alternatives Considered
| Approach | Strengths | Tradeoffs | Decision |
|----------|-----------|-----------|----------|
| A. Minimal: all logic in Phaser scenes | Fastest to first playable | Hard to test/balance; online requires a rewrite | Rejected |
| **B. Balanced: headless core + Phaser client** | Testable, AI/sim-friendly, online-ready later | Moderate upfront structure | **Chosen** |
| C. Extensible: core + React UI + Pixi + server stub | Online-ready now, rich UI | Most complex; slowest to reach "is it fun?" | Deferred; B can grow into it |
| Godot / Unity desktop engine | Strong tooling, console path | Less instant sharing; user chose web | Rejected for MVP |

## Feature Scope
### MVP
- [ ] **Board:** one region map, 60–90 spaces with branches. Space types: Battle, Item, Loot, Gold, Town, Castle (home/quest giver), Shop, Temple (heal/revive), Event/Chance.
- [ ] **Turn flow:** spinner (1–6, modifiable by items/magic), movement with path choice, space resolution, end turn. Weekly cycle (every N rounds) with a quest from the Castle.
- [ ] **Classes (4):** Warrior, Mage, Thief, Cleric (renamed/rethemed originals), levels 1–~20, stat growth and one passive each. Class switching at the Castle.
- [ ] **Combat:** hidden simultaneous choice among Attack / Strike / Counter / Magic / Defend. Speed determines initiative. Monsters use a weighted AI. The same system is used for PvP.
- [ ] **Gear & items:** weapon, shield, accessory slots, ~30 items, ~12 battle spells, ~8 field spells.
- [ ] **Towns & assets:** 8–10 towns held by monsters. Liberate to own, invest gold to raise value, pay tax income each week. Rivals can seize them via PvP or a field spell.
- [ ] **PvP griefing:** on a PvP win, choose Steal Gold / Steal Item / Seize Town / Humiliate (rename, cosmetic "hairdo" debuff, face paint).
- [ ] **Villain mechanic ("fresh twist" slot, name TBD):** the last-place or KO'd player may be possessed by a villain spirit for a few turns, gaining board-wide sabotage powers. This is the main comeback engine.
- [ ] **Victory:** turn limit (e.g. 4 weeks) or defeating the region boss; winner = highest Assets. Final-week bonus events keep races tight.
- [ ] **Players:** 1–4 humans in hot-seat plus CPU fill (Easy/Normal/Hard).
- [ ] **Presentation:** 2D pixel art (placeholder/licensed packs first), basic SFX/music, keyboard/mouse plus gamepad basics.
- [ ] **Save/Load:** serialize `GameState` to localStorage (with export file).
- [ ] **Quality:** Vitest rules suite, headless balance simulator CLI, static web deploy.

### Later
- [ ] Online multiplayer (server-authoritative `core` on Node/Colyseus, room codes, reconnection)
- [ ] Additional regions, full campaign mode, region bosses, story
- [ ] More classes (tiered/advanced classes), more monsters/spells
- [ ] Deeper cosmetics/customization, emotes, replays (event log is already replayable)
- [ ] Steam build (Electron/Tauri wrapper), achievements, controller polish, localization
- [ ] Mod/content-pack support via the data-driven `content` package

## Experience / Workflow
1. **Title** → New Game → pick the number of players (1–4), each human/CPU, name, class and color → choose game length.
2. **Board turn:**
   - Start-of-turn phase (status effects, field magic prompt).
   - Spin → move (choose branches) → resolve the space.
   - Passing another player can trigger PvP.
3. **Battle:**
   - Each side secretly picks a command (hot-seat hides the screen via a "pass the device" interstitial).
   - Resolve the triangle → damage/effects → repeat until KO or flee.
   - Show the rewards/griefing menu.
4. **Weekly cycle:** a Castle announcement names the quest (e.g. "liberate X", "defeat monster Y"), towns pay income and the leaderboard updates.
5. **Endgame:** after the final week or boss defeat, an Asset tally with dramatic reveal → results → rematch.

## Technical Direction
- **Language/tooling:** TypeScript (strict), pnpm workspaces, Vite, Vitest, ESLint + Prettier, GitHub Actions CI (lint, typecheck, test, build).
- **Architecture:**
  - `core` is pure and deterministic: `(state, action, rng) -> (state', events[])`, with no `Date`/`Math.random`.
  - Actions are validated (legal-move generator), which also powers the CPU AI (utility scoring + light lookahead in combat).
  - The client subscribes to the event stream and plays animations sequentially; input maps to actions.
- **Renderer:** Phaser 3 (tilemap board from Tiled JSON, sprite atlases, scene per mode).
- **Content:** typed data files plus zod schemas, and a balance sim CLI (`pnpm sim --games 5000`) reporting win rates by class/seat.
- **Persistence:** localStorage snapshot + versioned save schema.
- **Deploy:** static build to itch.io (HTML5) and GitHub Pages previews.
- **Branching:** `main` (release) and `dev` (integration); feature branches merge into `dev`.
- **Constraints:** original IP only; asset licenses must allow commercial use; 60 fps on mid-range laptops; bundle < 15 MB for MVP.

## Open Questions
- **Final game title, setting and villain-mechanic name** (must be original, not "Dokapon"). Resolve during `/legion:start` brand pass before any public build.
- **Exact number of combat commands and magic balance.** Resolve by prototyping plus the balance simulator.
- **Hot-seat secrecy UX** (pass-the-device vs simultaneous split input). Prototype both in the first combat milestone.
- **Art sourcing** (commissioned vs licensed packs). Placeholder packs first; decide before the vertical slice.
- **Online stack choice** (Colyseus vs custom WebSocket). Deferred to post-MVP; the core design keeps it open.

## Start Input
Web-based (TypeScript, Phaser 3) spiritual sequel to Dokapon Kingdom as original IP aimed at an eventual indie release. It's a 45–60 minute board-game/JRPG hybrid for 1–4 local hot-seat players plus CPU opponents on a single-region pixel-art map.

**MVP pillars:**
- Board movement with branching spaces
- Attack/Strike/Counter/Magic/Defend hidden-choice combat with 4 classes and gear
- Town liberation/investment with asset-based victory
- PvP griefing (steal gold/items/towns, humiliation)
- An original villain-possession comeback mechanic

**Architecture:** pnpm monorepo with a pure deterministic headless rules engine (`core`, fully unit-tested, drives CPU AI and a balance simulator), a Phaser client (`client`) and data-driven content (`content`).

**Process:** work on `dev` and release from `main`. No fixed timeline. Online multiplayer, multi-region campaign and Steam packaging are post-MVP.
