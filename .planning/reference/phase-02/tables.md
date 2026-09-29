#### Classes (`classes.json`)
| id | name | kind | parents | statBp hp/atk/def/mag/spd/luck | bagSize | switchFee | aiBias atk/str/spl/grd/ctr/wrd |
|---|---|---|---|---|---|---|---|
| `warrior` | Warrior | base | — | 11500/11500/11500/8500/9000/9000 | 5 | 100 | 35/45/20/45/35/20 |
| `thief` | Thief | base | — | 9500/10000/9000/8000/13000/14000 | 8 | 100 | 50/30/20/35/40/25 |
| `mage` | Mage | base | — | 8500/7500/8500/13000/10000/10000 | 6 | 100 | 25/15/60/30/25/45 |
| `cleric` | Cleric | base | — | 10500/9500/11000/12000/9000/10000 | 6 | 100 | 35/20/45/35/25/40 |
| `spellblade` | Spellblade | hybrid | warrior + mage | 11000/11500/10000/11500/9500/9000 | 6 | 300 | 30/45/25/40/35/25 |
| `shadowpriest` | Shadowpriest | hybrid | thief + cleric | 10000/10000/9500/11000/12000/12000 | 7 | 300 | 45/30/25/35/35/30 |

Passives (rank 1 → 5; `{hook, value}`; ★ = combat hook implemented in Phase 2, ☐ = board hook, data-only until Phase 3/5):

| class | r1 | r2 | r3 | r4 | r5 (portable) |
|---|---|---|---|---|---|
| `warrior` | `brawler` "Brawler" ★ `strikeDmgBp` 1000 | `thick-skin` "Thick Skin" ★ `hpBp` 1000 | `shield-wall` "Shield Wall" ★ `defBp` 1000 | `battle-rhythm` "Battle Rhythm" ★ `attackDmgBp` 1000 | `unbreakable` "Unbreakable" ★ `guardVsStrikeBp` 5000 |
| `thief` | `sticky-fingers` "Sticky Fingers" ☐ `pvpExtraSteal` 1 | `quick-feet` "Quick Feet" ★ `fleeBp` 2000 | `lucky-break` "Lucky Break" ★ `critBp` 500 | `fleet` "Fleet" ★ `spdBp` 1000 | `pickpocket` "Pickpocket" ☐ `passPickpocketBp` 500 |
| `mage` | `frugal-caster` "Frugal Caster" ☐ `spellPriceBp` -2500 | `focus` "Focus" ★ `spellDmgBp` 1000 | `arcane-mind` "Arcane Mind" ★ `magBp` 1000 | `overcharge` "Overcharge" ★ `spellDmgBp` 1500 | `fieldcraft` "Fieldcraft" ☐ `fieldSpellMove` 1 |
| `cleric` | `mending` "Mending" ☐ `turnRegenBp` 1000 | `sanctuary` "Sanctuary" ★ `roundRegenBp` 500 | `faith` "Faith" ★ `defBp` 1000 | `devotion` "Devotion" ★ `magBp` 1000 | `mirror-ward` "Mirror Ward" ★ `wardReflectBp` 5000 |
| `spellblade` | `runic-edge` "Runic Edge" ★ `spellbladeStrike` 5000 | `arcane-muscle` "Arcane Muscle" ★ `magBp` 1000 | `honed-edge` "Honed Edge" ★ `strikeDmgBp` 1000 | `keen-eye` "Keen Eye" ★ `critBp` 500 | `twin-arts` "Twin Arts" ★ `spellDmgBp` 1500 |
| `shadowpriest` | `leech` "Leech" ★ `lifestealBp` 2500 | `shade-step` "Shade Step" ★ `spdBp` 1000 | `dark-litany` "Dark Litany" ★ `roundRegenBp` 500 | `cruel-luck` "Cruel Luck" ★ `critBp` 500 | `soul-tithe` "Soul Tithe" ★ `lifestealBp` 2500 |

Starter loadouts (base classes only; hybrids have `starter: null`):

| class | weapon | shield | accessory | battleSpell | wardSpell | bag |
|---|---|---|---|---|---|---|
| `warrior` | wooden-sword | pot-lid | null | spark | null | ["herb"] |
| `thief` | wooden-sword | pot-lid | lucky-sock | spark | null | ["herb","smoke-bomb"] |
| `mage` | wooden-sword | pot-lid | null | fireball | barrier | ["herb"] |
| `cleric` | wooden-sword | pot-lid | null | drain | barrier | ["herb","antidote"] |

#### Gear (`gear.json`, 15)
| id | name | slot | tier | price | stats (non-zero; others 0) | hooks |
|---|---|---|---|---|---|---|
| `wooden-sword` | Wooden Sword | weapon | 1 | 0 | atk +2 | — |
| `bronze-blade` | Bronze Blade | weapon | 1 | 150 | atk +5 | — |
| `knights-saber` | Knight's Saber | weapon | 2 | 400 | atk +9 | — |
| `goblin-cleaver` | Goblin Cleaver | weapon | 3 | 800 | atk +12, luck +4 | — |
| `royal-claymore` | Royal Claymore | weapon | 4 | 1600 | atk +18 | — |
| `pot-lid` | Pot Lid | shield | 1 | 0 | def +2 | — |
| `buckler` | Buckler | shield | 1 | 120 | def +5 | — |
| `tower-shield` | Tower Shield | shield | 2 | 380 | def +9, spd -2 | — |
| `mirror-shield` | Mirror Shield | shield | 3 | 750 | def +8 | `spellTakenBp` -2000 |
| `aegis-of-usurpia` | Aegis of Usurpia | shield | 4 | 1500 | hp +10, def +16 | — |
| `lucky-sock` | Lucky Sock | accessory | 1 | 60 | luck +5 | — |
| `speed-anklet` | Speed Anklet | accessory | 2 | 200 | spd +5 | — |
| `mage-ring` | Mage Ring | accessory | 2 | 350 | mag +6 | — |
| `tax-collectors-seal` | Tax Collector's Seal | accessory | 3 | 600 | — | `townTaxBp` 500 |
| `crown-ward-amulet` | Crown Ward Amulet | accessory | 4 | 900 | def +3 | `crownTaxResistBp` 5000 |

#### Items (`items.json`: 12 consumables + 5 joke items)
| id | name | kind | price | use | effect |
|---|---|---|---|---|---|
| `herb` | Herb | consumable | 20 | both | `{"kind":"heal","bp":3000}` |
| `big-herb` | Big Herb | consumable | 60 | both | `{"kind":"heal","bp":6000}` |
| `royal-elixir` | Royal Elixir | consumable | 200 | both | `{"kind":"heal","bp":10000}` |
| `antidote` | Antidote | consumable | 30 | both | `{"kind":"cleanse"}` |
| `swift-boots` | Swift Boots | consumable | 80 | board | `{"kind":"board","tag":"spinBonus","value":3}` |
| `lead-boots` | Lead Boots | consumable | 80 | board | `{"kind":"board","tag":"spinFixed","value":1}` |
| `homing-stone` | Homing Stone | consumable | 120 | board | `{"kind":"board","tag":"warpCastle","value":0}` |
| `pathfinder` | Pathfinder | consumable | 150 | board | `{"kind":"board","tag":"pickSpin","value":6}` |
| `smoke-bomb` | Smoke Bomb | consumable | 50 | combat | `{"kind":"flee"}` |
| `battle-tonic` | Battle Tonic | consumable | 70 | combat | `{"kind":"mod","stat":"atk","bp":2500}` |
| `iron-tonic` | Iron Tonic | consumable | 70 | combat | `{"kind":"mod","stat":"def","bp":2500}` |
| `coin-purse-lock` | Coin Purse Lock | consumable | 100 | board | `{"kind":"board","tag":"blockGoldSteal","value":1}` |
| `decoy-gold-bag` | Decoy Gold Bag | joke | 120 | none | `{"kind":"joke","tag":"decoyGoldBag"}` |
| `cursed-wig` | Cursed Wig | joke | 90 | none | `{"kind":"joke","tag":"cursedWig"}` |
| `whoopee-scroll` | Whoopee Scroll | joke | 60 | none | `{"kind":"joke","tag":"whoopeeScroll"}` |
| `royal-summons` | Royal Summons (fake) | joke | 150 | none | `{"kind":"joke","tag":"royalSummons"}` |
| `bag-of-bees` | Bag of Bees | joke | 80 | none | `{"kind":"joke","tag":"bagOfBees"}` |

#### Battle spells (`spells.json` → `battle`, 8)
| id | name | tier | price | powerBp | effect |
|---|---|---|---|---|---|
| `spark` | Spark | 1 | 50 | 9000 | `{"kind":"none"}` |
| `fireball` | Fireball | 2 | 200 | 11000 | `{"kind":"none"}` |
| `thunderclap` | Thunderclap | 3 | 600 | 13500 | `{"kind":"stun","chanceBp":2500}` |
| `frostbite` | Frostbite | 2 | 300 | 10000 | `{"kind":"mod","stat":"spd","bp":-2000}` |
| `drain` | Drain | 1 | 150 | 9000 | `{"kind":"drain","bp":5000}` |
| `hex` | Hex | 2 | 300 | 0 | `{"kind":"mod","stat":"atk","bp":-2500}` |
| `pickpocket-bolt` | Pickpocket Bolt | 2 | 250 | 7000 | `{"kind":"stealGold","bp":500}` |
| `royal-decree` | Royal Decree | 4 | 1500 | 17000 | `{"kind":"none"}` |

#### Ward spells (`spells.json` → `ward`, 4)
| id | name | tier | price | mode | valueBp |
|---|---|---|---|---|---|
| `barrier` | Barrier | 1 | 100 | barrier | 0 |
| `reflect` | Reflect | 2 | 400 | reflect | 5000 |
| `absorb` | Absorb | 3 | 500 | absorb | 0 |
| `counterspell` | Counterspell | 3 | 450 | counterspell | 12500 |

#### Field spells (`spells.json` → `field`, 8; data only until Phase 5)
| id | name | tier | price | tag | value | duration |
|---|---|---|---|---|---|---|
| `haste` | Haste | 1 | 120 | spinTwiceHigher | 0 | 1 |
| `snare` | Snare | 2 | 180 | spinCap | 2 | 2 |
| `usurp` | Usurp | 4 | 600 | seizeTown | 1000 | 0 |
| `blessing` | Blessing | 2 | 250 | fullHealCleanse | 0 | 0 |
| `fog` | Fog | 3 | 300 | hideAndImmune | 0 | 2 |
| `golden-touch` | Golden Touch | 2 | 200 | doubleGoldSpace | 0 | 1 |
| `swap` | Swap | 3 | 350 | swapPositions | 0 | 0 |
| `silence` | Silence | 3 | 300 | blockFieldSpells | 0 | 3 |

#### NPC stat curve (`monsters.json` → `curve`, index = tier − 1)
| tier | hp | atk | def | mag | spd | luck |
|---|---|---|---|---|---|---|
| T1 | 48 | 15 | 9 | 11 | 9 | 4 |
| T2 | 95 | 30 | 16 | 22 | 13 | 6 |
| T3 | 140 | 44 | 24 | 32 | 16 | 8 |
| T4 | 190 | 58 | 32 | 42 | 19 | 10 |
| T5 | 245 | 72 | 40 | 52 | 22 | 12 |

#### Monsters (`monsters.json` → `monsters`, 16)
| id | name | tier | zone | statBp hp/atk/def/mag/spd/luck | attackTable a/s/sp/flee | defendTable g/c/w | battle | ward | hooks | xp | gold | tagline |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `slime-intern` | Slime Intern | 1 | enchanted-forest | 8000/8000/8000/8000/8000/8000 | 60/20/20/0 | 40/30/30 | spark | null | — | 15 | 20 | Unpaid, unbothered, unarmed. |
| `mushroom-mail-carrier` | Mushroom Mail Carrier | 1 | enchanted-forest | 9500/9500/9000/9000/9000/10000 | 50/30/20/0 | 40/30/30 | spark | null | `poisonOnHit` 1 | 20 | 25 | Neither rain nor spores. |
| `squirrel-pickpocket` | Squirrel Pickpocket | 1 | enchanted-forest | 8000/9000/8000/8000/14000/14000 | 50/20/10/20 | 30/40/30 | spark | null | `stealGoldOnHitBp` 500 | 20 | 40 | Takes a cut. Runs. |
| `treant-groundskeeper` | Treant Groundskeeper | 1 | enchanted-forest | 14000/10000/12500/8000/6000/8000 | 40/40/20/0 | 50/30/20 | spark | null | — | 25 | 25 | Keep off the grass. Forever. |
| `crab-customs-officer` | Crab Customs Officer | 2 | soggy-coast | 10000/9500/13000/8000/8500/9000 | 45/35/20/0 | 25/55/20 | spark | null | — | 45 | 50 | Anything to declare? |
| `seagull-debt-collector` | Seagull Debt Collector | 2 | soggy-coast | 9000/10000/9000/9000/12500/12000 | 55/25/20/0 | 35/35/30 | spark | null | `stealItemOnHit` 1 | 45 | 45 | Mine. Mine. Mine. |
| `mermaid-lifeguard` | Mermaid Lifeguard | 2 | soggy-coast | 10000/9000/9500/11500/10000/10000 | 35/20/45/0 | 35/25/40 | drain | barrier | `roundRegenBp` 800 | 50 | 50 | No running by the sea. |
| `pirate-accountant` | Pirate Accountant | 2 | soggy-coast | 9500/9000/9000/11000/10500/11000 | 30/20/50/0 | 35/30/35 | pickpocket-bolt | null | — | 50 | 70 | Arr-udits your books. |
| `goblin-tax-auditor` | Goblin Tax Auditor | 3 | goblin-mines | 10000/10000/10000/9000/10000/10000 | 50/30/20/0 | 35/35/30 | spark | null | `stealGoldOnHitBp` 800 | 90 | 100 | Your receipts are... concerning. |
| `golem-foreman` | Golem Foreman | 3 | goblin-mines | 12000/12000/11500/6000/7000/8000 | 30/60/10/0 | 45/35/20 | spark | null | — | 95 | 90 | Safety third. |
| `bat-night-shift` | Bat Night-Shift | 3 | goblin-mines | 8500/10000/8500/9000/14000/11000 | 55/25/20/0 | 30/40/30 | drain | null | `lifestealBp` 3000 | 90 | 80 | Clocked in at dusk. |
| `mimic-vault-clerk` | Mimic Vault Clerk | 3 | goblin-mines | 11000/11000/11000/9000/8000/12000 | 45/40/15/0 | 30/50/20 | spark | null | — | 110 | 250 | Please take a number. And a bite. |
| `swamp-witch-notary` | Swamp Witch Notary | 4 | bureaucrat-bog | 9500/8000/9000/12500/10000/10000 | 25/15/60/0 | 30/30/40 | hex | reflect | — | 160 | 150 | Sign here, here, and in blood. |
| `bog-troll-bouncer` | Bog Troll Bouncer | 4 | bureaucrat-bog | 15000/11500/10500/6000/7000/8000 | 45/45/10/0 | 50/35/15 | spark | null | — | 170 | 140 | You're not on the list. |
| `wisp-paperwork-spirit` | Wisp Paperwork Spirit | 4 | bureaucrat-bog | 8000/6000/9000/12500/12000/10000 | 10/10/80/0 | 20/20/60 | frostbite | absorb | `physTakenBp` -5000 | 160 | 130 | Form 27-B, stroke 6. |
| `ogre-middle-manager` | Ogre Middle Manager | 4 | bureaucrat-bog | 11500/11000/10500/10000/9000/9000 | 40/35/25/0 | 35/35/30 | fireball | barrier | `atkBp` 1000 | 180 | 160 | Let's circle back on your face. |

#### Guardians (`monsters.json` → `guardians`, 3) and Crown Enforcer (`monsters.json` → `enforcer`)
| id | name | style | statBp | attackTable | defendTable | battle | ward | xpPerTier / xpPerLevel | goldPerTier / goldPerLevel |
|---|---|---|---|---|---|---|---|---|---|
| `landlord-lich` | Landlord Lich | magic | 11000/8000/9500/12500/10000/10000 | 20/15/65/0 | 30/25/45 | fireball | reflect | 60 | 0 |
| `tollbridge-troll` | Tollbridge Troll | physical | 13000/11500/11500/6000/8000/9000 | 40/50/10/0 | 45/40/15 | spark | null | 60 | 0 |
| `knight-of-foreclosure` | Knight of Foreclosure | balanced | 12000/10500/10500/10000/9500/9500 | 40/35/25/0 | 35/35/30 | spark | barrier | 60 | 0 |
| `crown-enforcer` | Crown Enforcer | — | 9000/12000/10000/8000/10000/10000 | 25/60/15/0 | 35/40/25 | spark | null | 10 | 0 |

#### Tuning (`tuning.json`)
```json
{
 "combat": {
  "kBp": 12500,
  "jBp": 5000,
  "jMagBp": 5000,
  "matrix": {
   "attack": {
    "guard": 5000,
    "counter": 12500,
    "ward": 10000,
    "open": 10000
   },
   "strike": {
    "guard": 15000,
    "counter": 10000,
    "ward": 17500,
    "open": 15000
   },
   "spell": {
    "guard": 10000,
    "counter": 10000,
    "ward": 4000,
    "open": 10000
   }
  },
  "critBaseBp": 300,
  "critPerLuckBp": 25,
  "critCapBp": 2000,
  "critMultBp": 15000,
  "maxRounds": 3,
  "fleeBaseBp": 5000,
  "fleePerSpdBp": 250,
  "fleeMinBp": 1000,
  "fleeMaxBp": 9000,
  "modMinBp": -5000,
  "modMaxBp": 5000,
  "poisonBp": 800,
  "seniorRewardBp": 15000,
  "pvpXpPerLevel": 10
 },
 "progression": {
  "maxLevel": 20,
  "xpCurve": [ 0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250, 2750, 3300, 3900, 4550, 5250, 6000, 6800, 7650, 8550, 9500],
  "baseStats": {
   "hp": 40,
   "atk": 14,
   "def": 10,
   "mag": 12,
   "spd": 10,
   "luck": 5
  },
  "growth": {
   "hp": 8,
   "atk": 3,
   "def": 2,
   "mag": 3,
   "spd": 1,
   "luck": 1
  },
  "masteryWins": [ 0, 3, 7, 12, 18],
  "hybridUnlockRank": 3
 },
 "economy": {
  "startingGold": 100,
  "maxScrolls": 3
 }
}
```

#### Sim kits
| class | tier 1 | tier 2 | tier 3 | tier 4 |
|---|---|---|---|---|
| `warrior` | wooden-sword, pot-lid, null, spark, null | bronze-blade, buckler, lucky-sock, spark, barrier | knights-saber, tower-shield, speed-anklet, fireball, barrier | royal-claymore, aegis-of-usurpia, crown-ward-amulet, fireball, reflect |
| `thief` | wooden-sword, pot-lid, lucky-sock, spark, null | bronze-blade, buckler, speed-anklet, pickpocket-bolt, barrier | goblin-cleaver, buckler, speed-anklet, frostbite, barrier | royal-claymore, mirror-shield, speed-anklet, thunderclap, reflect |
| `mage` | wooden-sword, pot-lid, null, fireball, barrier | wooden-sword, buckler, mage-ring, fireball, barrier | bronze-blade, mirror-shield, mage-ring, thunderclap, reflect | knights-saber, aegis-of-usurpia, mage-ring, royal-decree, absorb |
| `cleric` | wooden-sword, pot-lid, null, drain, barrier | bronze-blade, buckler, mage-ring, drain, barrier | knights-saber, mirror-shield, mage-ring, drain, absorb | goblin-cleaver, aegis-of-usurpia, mage-ring, drain, counterspell |
| `spellblade` | wooden-sword, pot-lid, null, spark, null | bronze-blade, buckler, mage-ring, fireball, barrier | knights-saber, tower-shield, mage-ring, thunderclap, barrier | royal-claymore, aegis-of-usurpia, mage-ring, thunderclap, reflect |
| `shadowpriest` | wooden-sword, pot-lid, lucky-sock, drain, null | bronze-blade, buckler, speed-anklet, drain, barrier | goblin-cleaver, mirror-shield, speed-anklet, drain, absorb | royal-claymore, aegis-of-usurpia, speed-anklet, drain, counterspell |
