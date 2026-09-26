# Design Exploration — Usurpia (Dokapon-Style Spiritual Sequel)

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

## Setting & Premise
- **World:** the Kingdom of **Usurpia**, a satirical fairy-tale kingdom. Bright storybook visuals and absurdist humor: pompous nobles, bureaucratic goblins, monsters with day jobs.
- **Premise (Heir Auction):** the vain, bankrupt monarch announces that whoever brings the kingdom the most wealth by the deadline will be named heir. This directly justifies the asset race, the weekly "royal decree" quests, and why the monarch doesn't care how you got the money.
- **Cursed Crown lore:** the monarch's old crown, pawned long ago and now sentient, jealous and greedy. It possesses the "least worthy" (poorest) contender to prove it can pick a better heir. Its hoard is literally the crown trying to buy the throne back.
- **Griefing flavor:** humiliations are royal-court themed, e.g. forced jester haircut, an embarrassing noble title as the rename ("Sir Soggybottom"), and "court portrait" face paint.
- **Tone guardrails:** mean-spirited *toward characters*, never toward real groups; PG, cartoon violence.
- **Title:** **Usurpia** (working title; it doubles as the kingdom's name). A formal trademark clearance is still pending; see Open Questions. The repo name `Dokapon-kingdom-2` stays as an internal codename only and must not appear in any public build.

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
- [ ] **Board:** one region map as an **open web** graph of 60–90 spaces with many branches; see *Map & Economy Spec*. Space types: Battle, Item, Loot, Gold, Town, Castle (home/quest giver), Shop, Temple (heal/revive), Event/Chance.
- [ ] **Turn flow:** spinner (1–6, modifiable by items/magic), movement with path choice, space resolution, end turn. Weekly cycle (every N rounds) with a quest from the Castle.
- [ ] **Classes:** 4 base classes (Warrior, Thief, Mage, Cleric) plus 2 hybrids (Spellblade, Shadowpriest). Character level combined with per-class mastery; see *Classes & Combat Spec*.
- [ ] **Combat:** asymmetric attacker/defender exchanges. Attacker picks Attack / Strike / Spell; defender picks Guard / Counter / Ward. Monsters use a weighted AI. The same system is used for PvP; see *Classes & Combat Spec*.
- [ ] **Gear & items:** weapon, shield, accessory slots, ~30 items, ~12 battle spells, ~8 field spells.
- [ ] **Towns & assets:** 8–10 towns held by monsters. Liberate to own, invest gold to raise value, and collect weekly tax as a % of value. Rivals can seize them via PvP or a field spell.
- [ ] **PvP griefing:** on a PvP win, choose Steal Gold / Steal Item / Seize Town / Humiliate (rename, cosmetic "hairdo" debuff, face paint).
- [ ] **Villain mechanic, the Cursed Crown:** a sentient crown possesses the trailing player for a few turns, granting sabotage powers with risk/reward stakes. This is the main comeback engine; see *Cursed Crown Spec* below.
- [ ] **Victory:** deadline of 3/4/5 weeks (chosen at setup). The optional region boss unlocks in the final week, and defeating it ends the game immediately with a big asset bonus. **Royal Bonus Awards** are revealed before the final tally. Winner = highest Assets.
- [ ] **Players:** 1–4 humans in hot-seat plus CPU fill (Easy/Normal/Hard).
- [ ] **Presentation:** 2D pixel art (placeholder/licensed packs first), basic SFX/music, keyboard/mouse plus gamepad basics.
- [ ] **Save/Load:** serialize `GameState` to localStorage (with export file).
- [ ] **Quality:** Vitest rules suite, headless balance simulator CLI, static web deploy.

### Later
- [ ] Online multiplayer (server-authoritative `core` on Node/Colyseus, room codes, reconnection)
- [ ] Additional regions, full campaign mode, region bosses, story
- [ ] Remaining 4 hybrids (Paladin, Rogue-Mage, Duelist, Oracle), more monsters/spells
- [ ] Deeper cosmetics/customization, emotes, replays (event log is already replayable)
- [ ] Steam build (Electron/Tauri wrapper), achievements, controller polish, localization
- [ ] Mod/content-pack support via the data-driven `content` package

### Classes & Combat Spec
**Stats (6):** HP, ATK, DEF, MAG, SPD, LUCK.
- **MAG** powers Spell damage and Ward strength.
- **SPD** decides who attacks first each round and the odds of fleeing.
- **LUCK** affects crit chance, loot quality and one spinner reroll chance per week. Keep LUCK's effects small and capped so it doesn't dominate balance.

**Progression:** character level plus class mastery, with hybrid unlocks.
- **Character level** (1–~20) comes from XP and raises base stats. It is kept when switching class.
- **Class mastery** (ranks 1–5 per class) comes from battles won as that class.
  - Each rank unlocks a passive.
  - Rank 5 passives are portable: you keep one equipped after switching.
- **Hybrid unlock:** reaching mastery rank 3 in **two** base classes unlocks their hybrid at the Castle.
- **Class switching:** at the Castle for a gold fee. Class sets stat multipliers, the Strike/Counter flavor and the passive list.

**Base classes (MVP):**
| Class | Stat lean | Identity | Sample passives (rank 1 → 5) |
|-------|-----------|----------|------------------------------|
| Warrior | HP/ATK/DEF | Frontline brawler, strong Strike | +10% Strike damage → Guard also reduces Strike damage by half |
| Thief | SPD/LUCK | Griefer, steals, flees | Steal an extra item on PvP win → Pickpocket gold when passing players |
| Mage | MAG | Burst Spells, field magic | Spells cost less → Cast a field spell and still move |
| Cleric | MAG/DEF | Sustain, support, Crown hunter | Heal 10% HP each turn → Ward reflects Spells |

**Hybrids:** MVP ships 2 of the 6 possible pairs.
| Hybrid | Pair | Identity | MVP? |
|--------|------|----------|------|
| Spellblade | Warrior + Mage | Strikes carry spell effects | ✅ |
| Shadowpriest | Thief + Cleric | Drains/steals HP & buffs | ✅ |
| Paladin | Warrior + Cleric | Tank-healer, bounty bonus vs Crown | Later |
| Rogue-Mage | Thief + Mage | Hex/curse specialist | Later |
| Duelist | Warrior + Thief | Speed crits, forced PvP | Later |
| Oracle | Mage + Cleric | Spinner/fate manipulation | Later |

**Combat structure (asymmetric):**
- Each round, both combatants take one attack turn in SPD order. Ties go to a LUCK roll.
- The attacker secretly picks one of:
  - **Attack:** normal damage.
  - **Strike:** high damage, pierces Guard, but can be reflected.
  - **Spell:** MAG damage or an effect.
- The defender secretly picks one of:
  - **Guard:** halves Attack damage.
  - **Counter:** reflects Strike.
  - **Ward:** resists Spells.

Resolution matrix (damage to defender unless noted; starting values for the sim):
| Attacker \ Defender | Guard | Counter | Ward |
|---|---|---|---|
| Attack | 0.5× | 1.25× (a failed counter leaves the defender open) | 1.0× |
| Strike | 1.5× (pierces) | **attacker takes 1.0×** (reflected) | 1.75× |
| Spell | 1.0× (MAG-based) | 1.0× | 0.4× |

- Base damage = `max(1, ATK×k − DEF×j)`, and crits come from LUCK. The sim tunes `k`/`j`.
- Battles last up to 3 rounds, then the fight ends as a draw, KO, or flee (SPD-based).
- Hot-seat secrecy: pass-the-device interstitial between choices (per Open Questions).
- CPU/monster AI uses weighted choice tables that adapt to the opponent's history (e.g. CPUs learn when a player spams Strike).

### Map & Economy Spec
**Map shape: open web.**
- A dense graph of 60–90 spaces with many junctions, similar to the original's overworld.
- The Castle sits roughly central. Four themed zones (e.g. Enchanted Forest, Goblin Mines, Soggy Coast, Bureaucrat Bog) blend into each other with no hard walls.
- Monster strength scales with distance from the Castle.
- Authored in **Tiled**, exported to JSON. Nodes are spaces; edges are walkable links (bidirectional by default, some one-way).
- **Readability safeguards:**
  - After spinning, every reachable destination is highlighted with a path preview.
  - Hover shows the space type and town info.
  - The minimap shows player positions.
  - The camera auto-frames the moving player.
- **AI safeguards:** the `core` graph provides reachable-set and shortest-path queries. CPUs score destinations by utility (town targets, PvP opportunity, shop needs, risk).
- **Space mix (starting ratio for ~75 spaces):**
  | Type | Count |
  |------|-------|
  | Battle | 22 |
  | Item / Loot / Gold | 16 |
  | Town | 10 |
  | Event/Chance | 8 |
  | Empty | 6 |
  | Shop | 4 |
  | Temple | 3 |
  | Crown Shrine (flavor; Summon target hotspot) | 2 |
  | Castle, Boss Lair | 1 each |
  | Warp gates (pairs) | 2 |
- **Tuning target:** 2–3 PvP encounters per player per week.

**Town economy: invest-to-grow.**
- **Liberation:** landing on a monster-held town triggers a fight against its guardian. Winning grants ownership at **base value** (tuning start: 500–1,500 G, higher farther from the Castle).
- **Invest:** when the owner lands on or passes through their town, they may invest gold, which raises town value 1:1 up to a cap (e.g. 3× base).
- **Tax:** at each week start, owners receive **10% of each town's current value** as gold.
- **Seizure:** a rival takes a town (keeping its full invested value) by:
  - winning a PvP reward choice,
  - the "Usurp" field spell, or
  - defeating the town's re-spawned guardian if the town was Blighted.

  This makes investment a big stored-wealth prize: safe-ish, not safe.
- **Assets formula:** `gold + Σ(item sell value) + Σ(town value) + bonus awards`.
- **Snowball brakes:** Cursed Crown targets the leader's wealth via Tax and Blight; the Cleric/Thief kits; the rival "seize" path; and the tax cap per player (tuning knob if the sim shows runaway leads).

**Victory & endgame.**
- **Deadline:** 3, 4 or 5 weeks (a week is one round-robin cycle × N turns, tuned for 45–60 minutes at 4 weeks with 4 players).
- **Region boss:**
  - The Boss Lair unlocks at the start of the final week.
  - Any player may challenge it (a solo fight, rematches allowed on later visits).
  - The victor gets a large asset bonus (tuning start: 25% of the leader's assets, minimum 3,000 G), and the game ends immediately after that turn.
- **Royal Bonus Awards:** before the final tally, the monarch reveals 3 random awards from a pool, each worth a fixed asset bonus (tuning start: 1,000 G). The pool:
  - Most Monsters Slain
  - Most Humiliated
  - Best Investor
  - Biggest Thief
  - Crown Survivor
  - Most Steps Walked

  Keep them cheeky and keep losers in contention.
- **Reveal sequence:** awards → each player's asset breakdown, bottom to top → heir coronation plus humiliation montage of the runner-ups.

### Cursed Crown Spec (comeback/villain mechanic)
Original replacement for the Darkling. Design goal: the crown gives the trailing player real power, but most of the value is **at risk** until they survive, so the crown is never a free win and always creates a hunt.

- **Trigger:** checked at the start of each week. If the last-place player's Assets are below **40% of the leader's**, the Crown claims them.
  - At most one Crown per week.
  - The **same player can be claimed in consecutive weeks** (per the user's decision; no repeat restriction).
  - Ties for last place go to the lowest Assets, then random.
- **Duration:** **3 of the wearer's turns**. It ends early if any player defeats the wearer in PvP.
- **Hoard:** everything the Crown takes (gold from Tyrant's Tax, winnings from Crown Warp battles) goes into a separate **Crown Hoard**, not the wearer's purse.
  - **Survive** all 3 turns: the wearer keeps the entire hoard.
  - **Defeated in PvP:** the victor claims the hoard as a **bounty**, plus the normal PvP reward. The wearer keeps nothing from the hoard.
- **Powers (MVP kit, one per turn in place of a normal action unless noted):**
  1. **Tyrant's Tax (passive, every wearer turn):** take X% (tuning start: 10%) of each other player's gold into the hoard.
  2. **Blight:** curse one town. It pays no income and loses value each turn until the Crown leaves.
  3. **Summon:** place a Crown monster on a board space. The next player to land there must fight it; a loss sends a penalty to the hoard.
  4. **Crown Warp:** teleport to any player and force PvP with a large stat buff. A win sends that PvP's spoils to the hoard.
- **While crowned:** the wearer is visibly transformed, can't enter towns or shops, and the other players see a bounty marker with the current hoard size.
- **Tuning knobs (sim-driven):** gap threshold (40%), duration (3), tax % (10), wearer stat buff, Blight value loss/turn, Summon monster strength.
- **Design risks:** repeat crowning of the same player could feel oppressive to others. Monitor via the balance sim (crown frequency per player, win rate of crowned players, target ≈ 15–25%).

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
- **Cursed Crown numbers** (threshold, tax %, buff size). Tune via the balance simulator; the starting values are listed in the spec.
- **Title clearance for "Usurpia".** An informal web search (2026-09-26) found no exact-match game; the nearest are *Usurper*-named titles. Before any public build, do a formal trademark search (USPTO/EUIPO), check Steam/itch/domain/social handles, then rename the repo.
  - Rejected: *Crownfall* is heavily used (Steam, Switch, board game, mobile, Dota 2 event).
  - Backups: *Crownmongers*, *Kingsnatch*, *Heirloot*.
- **Combat matrix multipliers, damage constants and LUCK caps.** Starting values are in the spec; tune with the balance simulator.
- **Hybrid unlock threshold** (mastery rank 3 in two classes). Validate in playtests that hybrids are reachable within a 45–60 minute game.
- **Economy numbers** (town base values, investment cap, 10% tax, boss bonus, award value, turns per week). Tune with the balance sim toward 45–60 minute games and a last-week comeback rate of ~30%.
- **Open-web map readability.** Validate with a first playtest; fall back to fewer junctions if players feel lost.
- **Hot-seat secrecy UX** (pass-the-device vs simultaneous split input). Prototype both in the first combat milestone.
- **Art sourcing** (commissioned vs licensed packs). Placeholder packs first; decide before the vertical slice.
- **Online stack choice** (Colyseus vs custom WebSocket). Deferred to post-MVP; the core design keeps it open.

## Start Input
Web-based (TypeScript, Phaser 3) spiritual sequel to Dokapon Kingdom as original IP aimed at an eventual indie release. It's a 45–60 minute board-game/JRPG hybrid for 1–4 local hot-seat players plus CPU opponents on a single-region pixel-art map.

**MVP pillars:**
- Board movement with branching spaces
- Asymmetric hidden-choice combat: attacker picks Attack/Strike/Spell, defender picks Guard/Counter/Ward
- Six stats (HP/ATK/DEF/MAG/SPD/LUCK) and gear
- 4 base classes (Warrior, Thief, Mage, Cleric) with character level plus per-class mastery (ranks 1–5); rank 3 in two classes unlocks a hybrid, and 2 hybrids (Spellblade, Shadowpriest) ship in the MVP
- Town liberation/investment with asset-based victory
- PvP griefing (steal gold/items/towns, humiliation)
- The **Cursed Crown**, an original comeback mechanic: it claims the trailing player (<40% of the leader's Assets at week start) for 3 turns and grants Tyrant's Tax, Blight, Summon and Crown Warp. Spoils go to a hoard the wearer keeps only by surviving; defeating the wearer claims it as a bounty.

**Architecture:** pnpm monorepo with a pure deterministic headless rules engine (`core`, fully unit-tested, drives CPU AI and a balance simulator), a Phaser client (`client`) and data-driven content (`content`).

**Map & economy:**
- Open-web graph map (60–90 spaces, Tiled-authored, 4 blended zones around a central Castle) with reachable-space previews.
- Invest-to-grow towns: liberate at base value, invest to raise value up to 3×, weekly 10% tax, rivals can seize.
- Deadline of 3/4/5 weeks, with an optional final-week region boss that ends the game with a big asset bonus.
- Royal Bonus Awards revealed before the tally.

**Setting:** a satirical fairy-tale kingdom. A vain, bankrupt monarch will name as heir whoever brings in the most wealth by the deadline (the "Heir Auction"). The Cursed Crown is the monarch's pawned, sentient old crown. Working title: **Usurpia** (also the kingdom's name), pending trademark clearance; `Dokapon-kingdom-2` is only an internal codename.

**Process:** work on `dev` and release from `main`. No fixed timeline. Online multiplayer, multi-region campaign and Steam packaging are post-MVP.
