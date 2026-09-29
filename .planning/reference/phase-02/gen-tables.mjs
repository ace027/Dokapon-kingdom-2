import {CONTENT_RULES as C} from './content-rules.mjs';
import {KITS,BAGS} from './sim.mjs';
const st=s=>`${s.hp}/${s.atk}/${s.def}/${s.mag}/${s.spd}/${s.luck}`;
const out=[];const p=x=>out.push(x);
p('#### Classes (`classes.json`)');
p('| id | name | kind | parents | statBp hp/atk/def/mag/spd/luck | bagSize | switchFee | aiBias atk/str/spl/grd/ctr/wrd |');p('|---|---|---|---|---|---|---|---|');
for(const c of Object.values(C.classes))p(`| \`${c.id}\` | ${c.name} | ${c.kind} | ${c.parents?c.parents.join(' + '):'—'} | ${st(c.statBp)} | ${c.bagSize} | ${c.switchFee} | ${[c.aiBias.attack,c.aiBias.strike,c.aiBias.spell,c.aiBias.guard,c.aiBias.counter,c.aiBias.ward].join('/')} |`);
p('');p('Passives (rank 1 → 5; `{hook, value}`; ★ = combat hook implemented in Phase 2, ☐ = board hook, data-only until Phase 3/5):');p('');
p('| class | r1 | r2 | r3 | r4 | r5 (portable) |');p('|---|---|---|---|---|---|');
const board=new Set(['pvpExtraSteal','passPickpocketBp','spellPriceBp','fieldSpellMove','turnRegenBp','townTaxBp','crownTaxResistBp','lootLuckBp']);
for(const c of Object.values(C.classes))p(`| \`${c.id}\` | ${c.passives.map(x=>`\`${x.id}\` "${x.name}" ${board.has(x.hook)?'☐':'★'} \`${x.hook}\` ${x.value}`).join(' | ')} |`);
p('');p('Starter loadouts (base classes only; hybrids have `starter: null`):');p('');p('| class | weapon | shield | accessory | battleSpell | wardSpell | bag |');p('|---|---|---|---|---|---|---|');
for(const c of Object.values(C.classes))if(c.starter){const s=c.starter;p(`| \`${c.id}\` | ${s.weapon??'null'} | ${s.shield??'null'} | ${s.accessory??'null'} | ${s.battleSpell??'null'} | ${s.wardSpell??'null'} | ${JSON.stringify(s.bag)} |`);}
p('');p('#### Gear (`gear.json`, 15)');p('| id | name | slot | tier | price | stats (non-zero; others 0) | hooks |');p('|---|---|---|---|---|---|---|');
for(const g of Object.values(C.gear))p(`| \`${g.id}\` | ${g.name} | ${g.slot} | ${g.tier} | ${g.price} | ${Object.entries(g.stats).filter(([k,v])=>v).map(([k,v])=>`${k} ${v>0?'+':''}${v}`).join(', ')||'—'} | ${g.hooks.map(h=>`\`${h.hook}\` ${h.value}`).join(', ')||'—'} |`);
p('');p('#### Items (`items.json`: 12 consumables + 5 joke items)');p('| id | name | kind | price | use | effect |');p('|---|---|---|---|---|---|');
for(const i of Object.values(C.items))p(`| \`${i.id}\` | ${i.name} | ${i.kind} | ${i.price} | ${i.use} | \`${JSON.stringify(i.effect)}\` |`);
p('');p('#### Battle spells (`spells.json` → `battle`, 8)');p('| id | name | tier | price | powerBp | effect |');p('|---|---|---|---|---|---|');
for(const s of Object.values(C.battleSpells))p(`| \`${s.id}\` | ${s.name} | ${s.tier} | ${s.price} | ${s.powerBp} | \`${JSON.stringify(s.effect)}\` |`);
p('');p('#### Ward spells (`spells.json` → `ward`, 4)');p('| id | name | tier | price | mode | valueBp |');p('|---|---|---|---|---|---|');
for(const s of Object.values(C.wardSpells))p(`| \`${s.id}\` | ${s.name} | ${s.tier} | ${s.price} | ${s.mode} | ${s.valueBp} |`);
p('');p('#### Field spells (`spells.json` → `field`, 8; data only until Phase 5)');p('| id | name | tier | price | tag | value | duration |');p('|---|---|---|---|---|---|---|');
for(const s of Object.values(C.fieldSpells))p(`| \`${s.id}\` | ${s.name} | ${s.tier} | ${s.price} | ${s.tag} | ${s.value} | ${s.duration} |`);
p('');p('#### NPC stat curve (`monsters.json` → `curve`, index = tier − 1)');p('| tier | hp | atk | def | mag | spd | luck |');p('|---|---|---|---|---|---|---|');
C.npcCurve.forEach((s,i)=>p(`| T${i+1} | ${s.hp} | ${s.atk} | ${s.def} | ${s.mag} | ${s.spd} | ${s.luck} |`));
p('');p('#### Monsters (`monsters.json` → `monsters`, 16)');p('| id | name | tier | zone | statBp hp/atk/def/mag/spd/luck | attackTable a/s/sp/flee | defendTable g/c/w | battle | ward | hooks | xp | gold | tagline |');p('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for(const m of Object.values(C.monsters)){const a=m.attackTable,d=m.defendTable;p(`| \`${m.id}\` | ${m.name} | ${m.tier} | ${m.zone} | ${st(m.statBp)} | ${a.attack}/${a.strike}/${a.spell}/${a.flee} | ${d.guard}/${d.counter}/${d.ward} | ${m.battleSpell??'null'} | ${m.wardSpell??'null'} | ${m.hooks.map(h=>`\`${h.hook}\` ${h.value}`).join(', ')||'—'} | ${m.xp} | ${m.gold} | ${m.tagline} |`);}
p('');p('#### Guardians (`monsters.json` → `guardians`, 3) and Crown Enforcer (`monsters.json` → `enforcer`)');p('| id | name | style | statBp | attackTable | defendTable | battle | ward | xpPerTier / xpPerLevel | goldPerTier / goldPerLevel |');p('|---|---|---|---|---|---|---|---|---|---|');
for(const m of Object.values(C.guardians)){const a=m.attackTable,d=m.defendTable;p(`| \`${m.id}\` | ${m.name} | ${m.style} | ${st(m.statBp)} | ${a.attack}/${a.strike}/${a.spell}/${a.flee} | ${d.guard}/${d.counter}/${d.ward} | ${m.battleSpell??'null'} | ${m.wardSpell??'null'} | ${m.xpPerTier} | ${m.goldPerTier} |`);}
{const m=C.enforcer;const a=m.attackTable,d=m.defendTable;p(`| \`${m.id}\` | ${m.name} | — | ${st(m.statBp)} | ${a.attack}/${a.strike}/${a.spell}/${a.flee} | ${d.guard}/${d.counter}/${d.ward} | ${m.battleSpell??'null'} | ${m.wardSpell??'null'} | ${m.xpPerLevel} | ${m.goldPerLevel} |`);}
p('');p('#### Tuning (`tuning.json`)');p('```json');p(JSON.stringify({combat:C.combat,progression:C.progression,economy:C.economy},null,1).replace(/\n\s*(\d|-)/g,' $1').replace(/\n\s*\]/g,']'));p('```');
p('');p('#### Sim kits');p('| class | tier 1 | tier 2 | tier 3 | tier 4 |');p('|---|---|---|---|---|');
for(const [c,k] of Object.entries(KITS))p(`| \`${c}\` | ${k.map(t=>t.map(x=>x??'null').join(', ')).join(' | ')} |`);
console.log(out.join('\n'));
