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
- [ ] **Turn flow:** spinner (1–6, modifiable by items/magic), movement with path choice, space resolution, end turn. Weekly cycle (every N rounds) with a public Royal Decree race plus a private Personal Errand per player; Event spaces draw Kingdom Gazette cards. See *Events & Weekly Quests Spec*.
- [ ] **Classes:** 4 base classes (Warrior, Thief, Mage, Cleric) plus 2 hybrids (Spellblade, Shadowpriest). Character level combined with per-class mastery; see *Classes & Combat Spec*.
- [ ] **Combat:** asymmetric attacker/defender exchanges. Attacker picks Attack / Strike / Spell; defender picks Guard / Counter / Ward. Monsters use a weighted AI. The same system is used for PvP; see *Classes & Combat Spec*.
- [ ] **Gear & items:** weapon, shield and accessory slots; class-sized bag; ~12 consumables, 5 joke items, ~15 gear pieces, 8 battle + 4 ward spells, 8 field spells. See *Items & Spells Spec*.
- [ ] **Towns & assets:** 8–10 towns held by monsters. Liberate to own, invest gold to raise value, and collect weekly tax as a % of value. Rivals can seize them via PvP or a field spell.
- [ ] **PvP griefing:** on a PvP win, choose Steal Gold / Steal Item / Seize Town / Humiliate (rename, cosmetic "hairdo" debuff, face paint).
- [ ] **Villain mechanic, the Cursed Crown:** a sentient crown possesses the trailing player for a few turns, granting sabotage powers with risk/reward stakes. This is the main comeback engine; see *Cursed Crown Spec* below.
- [ ] **Victory:** deadline of 3/4/5 weeks (chosen at setup). The optional region boss unlocks in the final week, and defeating it ends the game immediately with a big asset bonus. **Royal Bonus Awards** are revealed before the final tally. Winner = highest Assets.
- [ ] **Players:** 1–4 humans in hot-seat plus CPU fill. CPUs combine a skill level (Easy/Normal/Hard, never cheating) with a personality (Tycoon/Menace/Adventurer/Opportunist). See *CPU AI Spec*.
- [ ] **Presentation:** 640×360 pixel art (32px tiles, integer-scaled) with layered cosmetic sprites; licensed packs first; jaunty chiptune-orchestral audio; keyboard/mouse plus gamepad basics. See *Art & Audio Spec*.
- [ ] **Onboarding & accessibility:** skippable ~3-minute guided first week, one-time contextual tips, a pass-the-device hot-seat interstitial, and the full accessibility set (colorblind-safe color+shape, text/UI scale, speed/motion, full remapping). See *Onboarding & UX Spec*.
- [ ] **Save/Load:** serialize `GameState` to localStorage (with export file).
- [ ] **Quality:** Vitest rules suite, headless balance simulator CLI, static web deploy.

### Later
- [ ] Online multiplayer: server-authoritative `core` on Colyseus, private room codes, reconnect with CPU takeover, mixed local + online seats. See *Online Multiplayer Plan*.
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
- Hot-seat secrecy: pass-the-device interstitial between choices (see *Onboarding & UX Spec*).
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
- **Region boss: The Crown's Body** (see *Monster Roster Spec*):
  - The Boss Lair unlocks at the start of the final week.
  - Any player may challenge it (a solo fight, rematches allowed on later visits). Its HP persists between challengers.
  - Whoever lands the KO gets a large asset bonus (tuning start: 25% of the leader's assets, minimum 3,000 G) plus the boss's hoard, and the game ends immediately after that turn.
- **Royal Bonus Awards:** before the final tally, the monarch reveals 3 random awards from a pool, each worth a fixed asset bonus (tuning start: 1,000 G). The pool:
  - Most Monsters Slain
  - Most Humiliated
  - Best Investor
  - Biggest Thief
  - Crown Survivor
  - Most Steps Walked

  Keep them cheeky and keep losers in contention.
- **Reveal sequence:** awards → each player's asset breakdown, bottom to top → heir coronation plus humiliation montage of the runner-ups.

### Items & Spells Spec
**Loadout model:**
- **Gear slots:** Weapon, Shield, Accessory.
- **Spell slots:** 1 **Battle Spell** (offense, used with the attacker's *Spell* command) and 1 **Ward Spell** (defense, used with the defender's *Ward* command). Buying or looting a new one swaps it.
- **Field spells:** consumable scrolls, up to 3 carried. They take no bag space, but a Thief steal can take them.
- **Bag (consumables and joke items), size by class:**
  | Class | Bag |
  |-------|-----|
  | Warrior | 5 |
  | Mage | 6 |
  | Cleric | 6 |
  | Thief | 8 |
  | Spellblade | 6 |
  | Shadowpriest | 7 |
- Switching to a smaller bag forces you to sell or discard the overflow at the Castle, a small switching cost.
- **Acquisition:** shops (zone-specific stock), Item/Loot spaces (random by zone tier, with LUCK improving the rarity roll), monster drops, and PvP steals.

**Consumables (~12):**
| Item | Effect |
|------|--------|
| Herb / Big Herb / Royal Elixir | Heal 30% / 60% / 100% HP |
| Antidote | Clear status effects |
| Swift Boots | Next spin +3 |
| Lead Boots | Next spin fixed at 1 (throw at a rival, or use to stop on a space) |
| Homing Stone | Warp to the Castle |
| Pathfinder | Pick your exact spin result 1–6 |
| Smoke Bomb | Guaranteed flee |
| Battle Tonic | +25% ATK for one battle |
| Iron Tonic | +25% DEF for one battle |
| Coin Purse Lock | Blocks the next gold steal against you |

**Joke / griefing items (5 curated):**
| Item | Effect |
|------|--------|
| **Decoy Gold Bag** | Drop on a space. The next rival to land "picks it up" and loses 10% of their gold to you. |
| **Cursed Wig** | Force on a rival: a hideous wig. −10% SPD for 3 turns, and it appears on their portrait. |
| **Whoopee Scroll** | Target rival's next battle opens with an embarrassing fanfare; they lose initiative in round 1. |
| **Royal Summons (fake)** | Forged decree: teleports a rival to the Castle, wasting their next move. |
| **Bag of Bees** | Throw at a rival: they drop a random bag item on their current space for anyone to grab. |

**Gear (~15 for MVP, 5 per slot, tiered by zone):**
- **Weapons:** Wooden Sword → Bronze Blade → Knight's Saber → Goblin Cleaver (+LUCK) → Royal Claymore
- **Shields:** Pot Lid → Buckler → Tower Shield → Mirror Shield (weakens Spells) → Aegis of Usurpia
- **Accessories:** Lucky Sock (+LUCK) → Speed Anklet (+SPD) → Mage Ring (+MAG) → Tax Collector's Seal (+5% town tax) → Crown Ward Amulet (resists Cursed Crown Tax)

**Battle spells (8 offense):**
| Spell | Effect |
|-------|--------|
| Spark | Low MAG damage, cheap |
| Fireball | Mid damage |
| Thunderclap | High damage, may stun (skip next choice) |
| Frostbite | Damage + SPD −20% |
| Drain | Damage, heal half |
| Hex | No damage; ATK −25% for the rest of the battle |
| Pickpocket Bolt | Light damage + steal gold on hit |
| Royal Decree | Highest damage; rare/late |

**Ward spells (4 defense):**
| Spell | Effect |
|-------|--------|
| Barrier | Standard spell resist (the matrix value) |
| Reflect | Reflect 50% of spell damage |
| Absorb | Heal from spell damage |
| Counterspell | Negate the spell entirely, but take 1.25× from Attack/Strike this exchange |

**Field spells (8, consumable scrolls):**
| Spell | Effect |
|-------|--------|
| Haste | Spin twice, take the higher result |
| Snare | Target rival spins with a max of 2 for 2 turns |
| Usurp | Attempt to seize a rival's town (MAG vs MAG check); on failure you lose 10% gold |
| Blessing | Heal fully + clear status |
| Fog | Rivals can't see your position/stats for 2 turns; immune to targeting |
| Golden Touch | Your next Gold space pays double |
| Swap | Swap positions with any player |
| Silence | Target rival can't use field spells for 3 turns |

**Balance notes:** item and spell data live in `packages/content` with zod schemas. The balance sim reports pick/win rates per item and spell; flag anything above a 60% win-rate delta.

### Monster Roster Spec
**Tone:** "monsters with day jobs." Every monster is a satirical worker of Usurpia's collapsing bureaucracy or economy. Battle flavor text is part of the joke (e.g. the Slime Intern's Counter is "Asks a clarifying question").

**Tiers:** each zone is a difficulty tier by distance from the Castle. Palette-swapped "Senior" variants appear in the final week, +1 tier.

| Zone (tier) | Monsters (4 each) |
|---|---|
| **Enchanted Forest** (T1) | Slime Intern (weak, tutorial-friendly); Mushroom Mail Carrier (poison); Squirrel Pickpocket (steals gold, flees fast); Treant Groundskeeper (tanky, slow) |
| **Soggy Coast** (T2) | Crab Customs Officer (high DEF, Counter-heavy); Seagull Debt Collector (steals items); Mermaid Lifeguard (heals self); Pirate Accountant (Pickpocket Bolt caster) |
| **Goblin Mines** (T3) | Goblin Tax Auditor (fines gold on hit); Golem Foreman (Strike-heavy); Bat Night-Shift (high SPD, drains); Mimic Vault Clerk (disguised as a Loot space, big drop) |
| **Bureaucrat Bog** (T4) | Swamp Witch Notary (Hex); Bog Troll Bouncer (huge HP); Wisp Paperwork Spirit (Ward-heavy, magic-only damage); Ogre Middle Manager (buffs allies, strong all-rounder) |

**Town guardians (3 archetypes, scaled per town tier):**
| Guardian | Style |
|----------|-------|
| Landlord Lich | Magic |
| Tollbridge Troll | Physical |
| Knight of Foreclosure | Balanced |

Each town also has a town-flavored name and title, e.g. "Knight of Foreclosure of Mudwick".

**Cursed Crown summon (Summon power):** the **Crown Enforcer**, a floating gilded helmet with arms. Its stats scale with the wearer's level, and it Strikes often. A victim who loses pays a gold penalty into the Crown Hoard.

**Region boss: The Crown's Body.**
- **Awakening:** at the start of the final week, the Cursed Crown abandons any current wearer and forges a colossal golem body from the kingdom's melted treasury in the Boss Lair.
  - A current wearer is treated as having *survived*, so they keep their hoard.
  - The Crown no longer possesses players for the rest of the game.
- **Fight:**
  - Solo challenge, up to 5 rounds (a longer fight than standard battles).
  - Boss HP persists between challengers: damage from failed attempts sticks, so late challengers can snipe the kill. This creates a tense race.
  - Phases:
    1. **Gilded Guard** (heavy Guard/Counter).
    2. **Tax Frenzy** (steals gold on every hit into its own hoard).
    3. **Last Decree** (Royal Decree spell, all-out).
- **Reward:** whoever lands the KO gets the boss asset bonus (see Victory) **plus the boss's accumulated hoard**, and the game ends immediately after that turn.
- **Failure:** challengers who lose are KO'd to the Temple, and their stolen gold stays in the boss's hoard.

**AI notes:** each monster has a weighted command table (e.g. the Crab's Counter weight is high) plus 1–2 signature abilities. All definitions live in `packages/content` with tier stat curves so palette-swap variants are data-only.

### Art & Audio Spec
**Visuals:**
- **Resolution:** 640×360 internal, integer-scaled (×3 = 1080p, ×6 = 4K) with pixel-perfect rendering (Phaser `pixelArt: true`, `roundPixels`). Letterbox to preserve integer scaling.
- **Tiles:** 32×32 board tiles.
- **Sprite sizes:**
  - Overworld player sprites: 32×32.
  - Battle sprites: 64×64 for players and regular monsters, 96×96 for guardians, 192×192+ for The Crown's Body.
  - Portraits: 64×64.
- **Cosmetic layers:** player sprites and portraits are built from layers (body, hair/wig, face paint, hat/crown) so the humiliation cosmetics and the Cursed Crown transformation are data-driven overlays.
- **Palette:** bright storybook palette (target ≤ 48 colors, e.g. based on a public palette like Resurrect 64). Each zone has an accent hue: Forest green, Coast teal, Mines amber, Bog violet. The Cursed Crown and boss use a unique sickly gold that appears nowhere else.
- **UI:** chunky pixel fonts (open-licensed, commercial use OK) and 9-slice panels. Keep text readable at ×2.
- **Sourcing:**
  - MVP uses commercial-use licensed or CC0 packs (itch.io, OpenGameArt), tracked in `CREDITS.md` with license links.
  - **Commission before release:** the 4 base plus 2 hybrid class sprites, the Cursed Crown/Crown Enforcer, The Crown's Body, the monarch, the town guardians and key art/capsule images.
  - No AI-generated final assets.
- **Tooling:** Aseprite for sprites (JSON atlas export), Tiled for the map, TexturePacker or the Aseprite CLI in the build pipeline.

**Audio:**
- **Music:** jaunty chiptune-orchestral hybrid.
  - Main royal-fanfare theme and title/menu.
  - 4 zone themes, a battle theme, a PvP battle theme, a Cursed Crown theme (a sinister remix of the royal theme) and the boss theme.
  - Final tally/coronation theme.
- **SFX:** comedic stingers for griefing moments (sad trombone on losses, kazoo fanfare on humiliation), plus the spinner tick, coins and battle hits.
- **Sourcing:** licensed or royalty-free packs for the MVP (tracked in `CREDITS.md`); commission the main theme and Crown/boss themes before release.
- **Tech:** Phaser sound with OGG + M4A fallbacks, music ducking during stingers, separate music/SFX volume sliders.

### Events & Weekly Quests Spec
**Weekly structure (shared + personal):** at each week start (after tax and the Crown check), the monarch issues:
1. **Royal Decree (public race):** one objective all players race for.
   - The first player to complete it wins the full reward (tuning start: 1,500 G + a rare item), and the decree closes.
   - If nobody finishes by week end, the monarch is "disappointed" and the leader pays a 5% "disappointment tax" split among the others (a mild anti-snowball).
2. **Personal Errand (private side-quest):** each player privately gets one smaller objective.
   - Reward: ~500 G, a consumable or field scroll, or +1 class mastery progress.
   - Errands are hidden from rivals until completed; in hot-seat they're shown behind the pass-the-device interstitial.
   - CPUs only know their own.
   - You can reroll your errand once per week at the Castle for a fee.

**Royal Decree pool (~10; no repeat within a game):**
| Decree | Objective |
|--------|-----------|
| Liberate the Town | Liberate a specific named town |
| Wanted Poster | Defeat a specific monster type |
| Royal Delivery | Bring a specific item to the Castle |
| Tax Season | Be first to collect X gold in tax this week |
| Monster Census | Win 3 monster battles this week |
| Crown Hunt | Defeat the current Crown wearer (only when one exists) |
| Treasure Survey | Visit a specific far-off space |
| Invest in Usurpia | Invest X gold into your towns this week |
| Duel of Honor | Win a PvP battle |
| Royal Portrait | Be at the Castle with ≥ Y gold at week end |

**Personal Errand pool (~12):** tuned so any class can do them in 1–2 weeks.
- Slay two Forest monsters
- Buy anything from a Coast shop
- Use two consumables
- Land on a Gold space
- Win a battle using only Strikes
- Visit a Temple
- Cast a field spell on a rival
- Pass through three towns
- Survive a PvP battle
- Sell an item
- Humiliate a rival
- End a turn on a Warp gate

**Kingdom Gazette (Event/Chance spaces):** drawing a card shows a satirical newspaper headline with an effect.
- ~24 cards: ~60% mild/personal, ~30% board-wide, ~10% wild.
- Deck-based: shuffle, draw without replacement, reshuffle when empty.
- Samples:
  | Headline | Effect |
  |----------|--------|
  | "MONARCH DECLARES TAX HOLIDAY" | No tax is collected next week start (board-wide) |
  | "GOBLIN UNION STRIKES!" | All shops closed for 1 round |
  | "BARD WRITES BALLAD ABOUT YOU" | Lander gets +20% ATK for 2 battles |
  | "BARD WRITES *MEAN* BALLAD ABOUT YOU" | Lander gets −20% DEF for 2 battles |
  | "LOST WALLET RETURNED" | Lander gains 300 G |
  | "WALLET NOT RETURNED" | Lander loses 10% gold (to the Crown Hoard if a Crown is active, else to the bank) |
  | "HOUSING BOOM IN {TOWN}" | A random town gains +20% value |
  | "SLIME INFESTATION IN {TOWN}" | A random owned town loses 15% value |
  | "ROYAL PARADE!" | All players warp to the Castle (wild) |
  | "MARKET CRASH" | Everyone loses 15% gold, including the lander (wild) |
  | "ROYAL GIVEAWAY" | Lowest-asset player gains 1,000 G |
  | "DOPPELGANGER SPOTTED" | Lander swaps positions with a random player |
- Wild cards can't trigger in the first week.

**Data:** decrees, errands and Gazette cards live as data in `packages/content` with typed effect definitions (`{trigger, condition, effect}`). The `core` rules engine resolves them deterministically. The balance sim reports decree completion rate (target 70–85%) and each card's impact on asset variance.

### CPU AI Spec
**Model: skill level × personality.** Each CPU slot picks a difficulty and a personality independently (plus a "Random" option for each).

**Architecture (in `packages/core`, headless):**
- **Board decisions:** a utility AI. Enumerate the legal actions and reachable destinations after the spin, score each with `Σ(weight_personality[f] × feature_f)`, and pick by difficulty rule.
  - Features: gold gain, town value gain, decree/errand progress, PvP win probability × spoils, risk (HP, monster tier), distance to Castle/Temple/shop, Crown bounty, leader proximity.
- **Combat decisions:** choice weights come from a mix of:
  1. a base table (by class/stat matchup),
  2. an expected-value estimate from the resolution matrix, and
  3. an **opponent model**: frequency counts of the opponent's past choices (per human, persisting across the game), exploited at higher skill.
- **Item/spell use:** rule triggers (heal below X% HP, Pathfinder when the target is 1–6 away, joke items vs the leader), with thresholds shaped by personality.
- **Shop/equip:** greedy upgrade by stat-value per gold, with personality bias (Tycoon saves gold; Adventurer buys weapons).
- **Determinism:** all AI randomness uses the seeded RNG, so games and sims are replayable.

**Difficulty (decision quality only; never cheats):**
| Level | Board | Combat | Mistakes |
|-------|-------|--------|----------|
| Easy | Softmax over utilities with high temperature, 1-step horizon | Base table only | Forgets to heal ~30% of the time, ignores decrees sometimes |
| Normal | Softmax, medium temperature, considers the next week's tax | Base table + EV | Occasional suboptimal target |
| Hard | Near-argmax + 2-turn lookahead on key choices (Usurp, boss attempts, Crown hunts) | Base + EV + opponent model | None intentional; uses only information a human could see |

Hard CPUs **never** see hidden info (rivals' secret choices, errands, future cards or RNG). Hard's edge must come from better play so players trust the AI and balance-sim results stay valid.

**Personalities (MVP):**
| Persona | Priorities (high weight) | Avoids | Signature behaviors |
|---------|--------------------------|--------|---------------------|
| **Tycoon** | Town liberation/investment, gold decrees, tax accessories | Unprofitable PvP, wild risks | Invests heavily; buys Coin Purse Lock; Usurps weakly-defended high-value towns |
| **Menace** | PvP vs the leader, humiliations, joke items, Crown Warp | Slow investing | Chases players across the map; always picks Humiliate when ahead; hoards Decoy Gold Bags |
| **Adventurer** | XP, monster battles, far-tier towns, boss attempts, mastery/hybrids | Shops beyond essentials | Pushes to the Bog early; first to challenge the boss |
| **Opportunist** | Loot/Gold/Event spaces, Crown bounty, sniping weakened players and the boss's final HP | Fair fights | Waits near the Temple; strikes after others soften the target; loves Swap and Fog |

**Flavor:** each persona has short bark lines per event (win/lose/humiliated/crowned), displayed in speech bubbles and togglable off.

**Sim use:** the balance simulator runs all-CPU games across persona/difficulty mixes. Health checks:
- Hard beats Normal ≥ 60%.
- No persona exceeds 35% win rate in 4-player mixes at equal difficulty.
- Menace doesn't make games run > 20% longer.

### Onboarding & UX Spec
**Onboarding:**
- **Guided first week (~3 minutes, skippable):** offered on the first launch and from the title menu. It's a scripted short game vs 1–3 Easy CPUs on a trimmed map that teaches:
  - spin and path choice,
  - a monster battle (Attack/Strike/Spell vs Guard/Counter/Ward, explained with the matrix as a visual),
  - liberating a town,
  - investing,
  - a Gazette card.

  It ends with the monarch's Heir Auction speech and drops into a normal game or back to the title.
- **Contextual tips:** a one-time popup the first time each mechanic appears (PvP rewards, the Cursed Crown, decrees/errands, field spells, class switching, hybrids, the boss). Tips are per player profile, can be reset, and can be switched off globally.
- **Help everywhere:**
  - A `?` hotkey opens a rules glossary.
  - Hover/long-press shows tooltips on spaces, items, stats and status effects.
  - The battle screen always shows a compact resolution-matrix hint.

**Hot-seat flow:**
- **Pass-the-device interstitial** before any hidden input (combat choices, errand viewing, secret targets): a full-screen "Hand the controller to **Alex**" card with their color and portrait, then "Press to continue". This is auto-skipped when the other side is a CPU or when only one human is in the game.
- Visible turn banner with player name, color and shape icon; the camera auto-frames the active player.
- **Speed:** CPU turns are fast-forwardable (hold to 3×, or instant); humans can end their turn early; there's an optional turn timer for parties.
- **Save anytime:** autosave at every turn start and manual save/export; resume from the title.

**Accessibility (all MVP):**
- **Colorblind-safe:** each player has a color **and** a shape/icon (crown, shield, star, moon) on their token, portrait and UI. Zone accents and status effects use icons plus color. Colorblind presets (deuteranopia/protanopia/tritanopia) adjust the palette.
- **Text & UI scale:** 3 text sizes (100/125/150%) with UI panels reflowing, a high-contrast UI theme, and a dyslexia-friendly font option.
- **Speed & motion:** animation speed 1×/2×/instant; reduce screen shake and flashing (on by default for flashes > 3 Hz); disable parallax.
- **Full remapping:** rebind every keyboard and gamepad action. Mouse-only play and one-handed layouts are supported; no required simultaneous presses.
- Settings persist per browser (localStorage) and are accessible from the pause menu mid-game.

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
4. **Weekly cycle:** towns pay tax, the Cursed Crown check runs, and the monarch announces the public Royal Decree. Each player privately views their Personal Errand behind a pass-the-device screen, and the leaderboard updates.
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

## Online Multiplayer Plan (post-MVP, constraints enforced now)
**Model: server-authoritative rooms.**
- A Node server runs the **same `packages/core` reducer** as the client.
- Clients send `Action`s (with `playerId`); the server validates them against the legal-move generator, applies them, and broadcasts **per-player redacted events and state views**.
- Hidden combat choices, errands and RNG never leave the server until revealed, so peeking or cheating isn't possible.

**Stack:**
- **Colyseus** (TypeScript) rooms: one room per game, with room codes/links from Colyseus' matchmaker.
- Self-host on Fly.io/Render (or Colyseus Cloud).
- `packages/server` wraps `core`. Colyseus schema sync is used only for lobby metadata; game state goes through our own event stream so `core` stays framework-agnostic.

**Launch features:**
- **Private room codes:** the host creates a room (game settings, week count) and shares a code/link. Empty seats can be filled with CPUs (persona and difficulty picked by the host). No public matchmaking or accounts at launch; players pick a display name per session.
- **Reconnect & CPU takeover:**
  - On disconnect, a CPU (the player's chosen persona, Normal) plays their turns.
  - Rejoining the same seat via a session token restores control at the next decision point.
  - Rooms persist while ≥ 1 human is connected, plus a grace timeout (e.g. 10 minutes).
- **Mixed local + online:**
  - One browser can hold multiple seats (couch players), each with its own `playerId`.
  - Hidden choices for co-located seats use the existing pass-the-device interstitial.
  - The server treats each seat independently.
- Deferred: public matchmaking, accounts, friends lists, moderation, ranked play, spectators, async play.

**Online-readiness constraints (enforced in MVP code from M0, with tests):**
1. **Pure, serializable core:** `GameState`, `Action` and `GameEvent` are plain JSON with no classes, functions or cycles, and are versioned. A round-trip serialization test runs in CI.
2. **Actor on every action:** each `Action` carries `playerId`; the reducer rejects actions from the wrong actor or phase.
3. **Server-side RNG only:** RNG state lives in `GameState` and advances only inside the reducer. The client never supplies random values; the spinner result is an event, not an input.
4. **Per-player views:**
   - `viewFor(state, playerId)` and `redactEvent(event, playerId)` hide rivals' pending combat choices, errands, RNG state and the Gazette deck order.
   - Hot-seat and the client already render from views, not raw state.
   - A test asserts no hidden field leaks.
5. **Simultaneous-choice protocol:** hidden choices are `commit` actions resolved when all required commits arrive, the same flow for hot-seat, CPU and online.
6. **Timeouts as actions:** a `timeout` action with a deterministic default (e.g. Guard / end turn) lets online turn timers and CPU takeover reuse the reducer.
7. **Deterministic replay:** a game is fully reproducible from `(seed, settings, actions[])`. This powers desync checks, bug reports and replays.

**Rough online milestone (after M6):**
- M8a: `packages/server` + Colyseus room + room codes.
- M8b: redacted views over the wire + commit/reveal.
- M8c: reconnect/CPU takeover + mixed local seats.
- M8d: load test (≥ 100 concurrent rooms on a small instance) + closed online beta.

## Milestone Plan
Rules-first: the headless `core` and balance sim come before visuals. Human playtests start at M3 (first fully playable graybox game) and continue every milestone after; before M3, validation comes from unit tests and the all-CPU sim.

| # | Milestone | Scope | Exit criteria |
|---|-----------|-------|---------------|
| M0 | **Foundations** | pnpm monorepo (`core`, `content`, `client`, `sim`), TS strict, Vite, Vitest, ESLint/Prettier, GitHub Actions CI on `dev`/`main`, seeded RNG, `reduce(state, action)` + event skeleton, zod content schemas | CI green; example action round-trips with deterministic replay test |
| M1 | **Combat core** | 6 stats, Attack/Strike/Spell vs Guard/Counter/Ward matrix, 4 base classes + mastery, gear/spell slots, monster AI tables, combat CPU (all difficulties) | Full combat unit suite; sim CLI runs 10k duels and reports class/matchup win rates; debug text duel for dev use |
| M2 | **Board core** | Graph map from Tiled JSON, spin/movement/reachable-set, all space types, towns (liberate/invest/tax/seize), weeks, decrees/errands, Gazette deck, victory/tally, board utility AI + personalities | Headless all-CPU full games complete; sim reports game length, asset variance, decree completion rate |
| M3 | **Graybox client** | Phaser board + battle scenes with placeholder art, path preview, pass-the-device hot-seat, save/load/autosave, basic menus/setup | **First human playtest:** 2–4 people finish a full game in a browser; feedback log started |
| M4 | **Griefing & Crown** | PvP rewards/humiliations with layered cosmetics, joke items, field spells, Cursed Crown (trigger, powers, hoard), Crown's Body boss, hybrids, persona barks | Playtest #2; sim health checks (crowned win rate 15–25%, no persona > 35%, Hard ≥ 60% vs Normal) |
| M5 | **Vertical slice** | Licensed art + audio pass, guided first week, contextual tips, full accessibility set, Gazette/decree content complete, balance tuning | Playtest #3 with new players who learn via the tutorial; 45–60 min median game |
| M6 | **MVP complete** | All MVP content, polish, performance (60 fps, < 15 MB), `CREDITS.md`, itch.io HTML5 build | Unlisted itch release → friends-and-family playtest → public demo |
| M7 | **Release prep** | Title/trademark clearance + repo rename, commissions (characters, Crown, boss, key art, themes), Steam page, online multiplayer technical spike | Go/no-go decision for Steam Next Fest / Early Access |

## Open Questions
- **Cursed Crown numbers** (threshold, tax %, buff size). Tune via the balance simulator; the starting values are listed in the spec.
- **Title clearance for "Usurpia".** An informal web search (2026-09-26) found no exact-match game; the nearest are *Usurper*-named titles. Before any public build, do a formal trademark search (USPTO/EUIPO), check Steam/itch/domain/social handles, then rename the repo.
  - Rejected: *Crownfall* is heavily used (Steam, Switch, board game, mobile, Dota 2 event).
  - Backups: *Crownmongers*, *Kingsnatch*, *Heirloot*.
- **Combat matrix multipliers, damage constants and LUCK caps.** Starting values are in the spec; tune with the balance simulator.
- **Hybrid unlock threshold** (mastery rank 3 in two classes). Validate in playtests that hybrids are reachable within a 45–60 minute game.
- **Economy numbers** (town base values, investment cap, 10% tax, boss bonus, award value, turns per week). Tune with the balance sim toward 45–60 minute games and a last-week comeback rate of ~30%.
- **Open-web map readability.** Validate with a first playtest; fall back to fewer junctions if players feel lost.
- **Item/spell prices and drop tables.** Set during content authoring; validate with the sim and playtests. Watch the Usurp field spell and Royal Summons for frustration.
- **Commission budget and artists.** Decided: licensed packs for the MVP, commission signature characters, Crown, boss, key art and main themes before release. Pick artists and composer and set a budget at the vertical-slice milestone.
- **Online hosting and cost.** Decided: Colyseus, server-authoritative. Still open: Fly.io vs Render vs Colyseus Cloud and monthly budget. Decide at M8a after a load test.

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

**Events & quests:**
- Each week brings one public Royal Decree race (~10 in the pool; the first to complete it wins a big reward) plus a private Personal Errand per player (~12 in the pool, rerollable once per week).
- Event spaces draw satirical Kingdom Gazette cards (~24; mostly mild, a few board-wide wild cards).

**CPU AI:**
- Headless utility AI in `core`: skill level (Easy/Normal/Hard) × personality (Tycoon, Menace, Adventurer, Opportunist).
- Combat uses matchup tables, expected value and opponent modeling.
- Hard never cheats; all AI randomness is seeded; the sim validates balance.

**UX:**
- Guided ~3-minute first week plus one-time contextual tips.
- Pass-the-device interstitial for hidden choices, with fast-forwardable CPU turns and autosave.
- MVP accessibility: colorblind-safe color+shape, text/UI scale and high contrast, animation speed and reduced motion, full input remapping.

**Art & audio:**
- 640×360 internal resolution, 32px tiles, integer scaling.
- Layered cosmetic sprites for humiliations and the Crown transformation.
- Storybook palette with a per-zone accent.
- Licensed/CC0 packs for the MVP (tracked in `CREDITS.md`); commission signature art and themes before release; no AI-generated final assets.
- Jaunty chiptune-orchestral music with comedic stingers.

**Monsters:**
- ~20 satirical "monsters with day jobs", 4 per zone across 4 tiers (Forest → Coast → Mines → Bog).
- 3 town-guardian archetypes and a Crown Enforcer summon.
- Final boss **The Crown's Body**: the Cursed Crown's golem form. It awakens in the final week, ends all possession, keeps persistent HP across challengers and pays its hoard to whoever lands the KO.

**Items & spells:**
- Gear slots: Weapon/Shield/Accessory.
- 1 equipped Battle Spell + 1 Ward Spell.
- Up to 3 consumable field-spell scrolls.
- Class-sized bag: Warrior 5, Mage/Cleric/Spellblade 6, Shadowpriest 7, Thief 8.
- ~12 consumables, 5 curated joke/griefing items, ~15 gear pieces, 8 battle spells, 4 ward spells and 8 field spells.

**Map & economy:**
- Open-web graph map (60–90 spaces, Tiled-authored, 4 blended zones around a central Castle) with reachable-space previews.
- Invest-to-grow towns: liberate at base value, invest to raise value up to 3×, weekly 10% tax, rivals can seize.
- Deadline of 3/4/5 weeks, with an optional final-week region boss that ends the game with a big asset bonus.
- Royal Bonus Awards revealed before the tally.

**Setting:** a satirical fairy-tale kingdom. A vain, bankrupt monarch will name as heir whoever brings in the most wealth by the deadline (the "Heir Auction"). The Cursed Crown is the monarch's pawned, sentient old crown. Working title: **Usurpia** (also the kingdom's name), pending trademark clearance; `Dokapon-kingdom-2` is only an internal codename.

**Milestones (rules-first):**
- M0 foundations → M1 combat core → M2 board core → M3 graybox client (first human playtest) → M4 griefing & Crown → M5 vertical slice → M6 MVP complete (itch.io) → M7 release prep → M8 online (Colyseus).

**Online readiness (enforced in `core` from M0 with tests):**
- JSON-serializable, versioned state/actions/events.
- `playerId` on every action.
- RNG only inside the reducer.
- Per-player redacted views and events.
- Commit/reveal for hidden choices.
- Timeouts as actions.
- Deterministic replay from `(seed, settings, actions)`.

The post-MVP online plan uses server-authoritative Colyseus rooms with private codes, reconnect with CPU takeover, and mixed local + online seats.
- Validation before M3 comes from unit tests and the headless balance sim.

**Process:** work on `dev` and release from `main`. No fixed timeline. Online multiplayer, multi-region campaign and Steam packaging are post-MVP.
