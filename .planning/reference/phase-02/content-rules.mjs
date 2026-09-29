// Reference CONTENT rules (what buildRules(content data) must return). Initial tuning.
const S=(hp,atk,def,mag,spd,luck)=>({hp,atk,def,mag,spd,luck});
const Z=S(0,0,0,0,0,0);
const P=(rank,id,name,hook,value)=>({rank,id,name,hook,value});
const W=(a,b,c)=>({attack:a,strike:b,spell:c});
export const classes={
 warrior:{id:'warrior',name:'Warrior',kind:'base',parents:null,statBp:S(11500,11500,11500,8500,9000,9000),bagSize:5,switchFee:100,
  passives:[P(1,'brawler','Brawler','strikeDmgBp',1000),P(2,'thick-skin','Thick Skin','hpBp',1000),P(3,'shield-wall','Shield Wall','defBp',1000),P(4,'battle-rhythm','Battle Rhythm','attackDmgBp',1000),P(5,'unbreakable','Unbreakable','guardVsStrikeBp',5000)],
  starter:{weapon:'wooden-sword',shield:'pot-lid',accessory:null,battleSpell:'spark',wardSpell:null,bag:['herb']},
  aiBias:{attack:30,strike:50,spell:20,guard:50,counter:30,ward:20}},
 thief:{id:'thief',name:'Thief',kind:'base',parents:null,statBp:S(9500,10000,9000,8000,13000,14000),bagSize:8,switchFee:100,
  passives:[P(1,'sticky-fingers','Sticky Fingers','pvpExtraSteal',1),P(2,'quick-feet','Quick Feet','fleeBp',2000),P(3,'lucky-break','Lucky Break','critBp',500),P(4,'fleet','Fleet','spdBp',1000),P(5,'pickpocket','Pickpocket','passPickpocketBp',500)],
  starter:{weapon:'wooden-sword',shield:'pot-lid',accessory:'lucky-sock',battleSpell:'spark',wardSpell:null,bag:['herb','smoke-bomb']},
  aiBias:{attack:50,strike:30,spell:20,guard:35,counter:40,ward:25}},
 mage:{id:'mage',name:'Mage',kind:'base',parents:null,statBp:S(8500,7500,8500,13000,10000,10000),bagSize:6,switchFee:100,
  passives:[P(1,'frugal-caster','Frugal Caster','spellPriceBp',-2500),P(2,'focus','Focus','spellDmgBp',1000),P(3,'arcane-mind','Arcane Mind','magBp',1000),P(4,'overcharge','Overcharge','spellDmgBp',1500),P(5,'fieldcraft','Fieldcraft','fieldSpellMove',1)],
  starter:{weapon:'wooden-sword',shield:'pot-lid',accessory:null,battleSpell:'fireball',wardSpell:'barrier',bag:['herb']},
  aiBias:{attack:30,strike:20,spell:50,guard:40,counter:30,ward:30}},
 cleric:{id:'cleric',name:'Cleric',kind:'base',parents:null,statBp:S(10500,9500,11000,12000,9000,10000),bagSize:6,switchFee:100,
  passives:[P(1,'mending','Mending','turnRegenBp',1000),P(2,'sanctuary','Sanctuary','roundRegenBp',500),P(3,'faith','Faith','defBp',1000),P(4,'devotion','Devotion','magBp',1000),P(5,'mirror-ward','Mirror Ward','wardReflectBp',5000)],
  starter:{weapon:'wooden-sword',shield:'pot-lid',accessory:null,battleSpell:'drain',wardSpell:'barrier',bag:['herb','antidote']},
  aiBias:{attack:35,strike:20,spell:45,guard:35,counter:25,ward:40}},
 spellblade:{id:'spellblade',name:'Spellblade',kind:'hybrid',parents:['warrior','mage'],statBp:S(11000,11500,10000,11500,9500,9000),bagSize:6,switchFee:300,
  passives:[P(1,'runic-edge','Runic Edge','spellbladeStrike',5000),P(2,'arcane-muscle','Arcane Muscle','magBp',1000),P(3,'honed-edge','Honed Edge','strikeDmgBp',1000),P(4,'keen-eye','Keen Eye','critBp',500),P(5,'twin-arts','Twin Arts','spellDmgBp',1500)],
  starter:null,aiBias:{attack:30,strike:45,spell:25,guard:40,counter:35,ward:25}},
 shadowpriest:{id:'shadowpriest',name:'Shadowpriest',kind:'hybrid',parents:['thief','cleric'],statBp:S(10000,10000,9500,11000,12000,12000),bagSize:7,switchFee:300,
  passives:[P(1,'leech','Leech','lifestealBp',2500),P(2,'shade-step','Shade Step','spdBp',1000),P(3,'dark-litany','Dark Litany','roundRegenBp',500),P(4,'cruel-luck','Cruel Luck','critBp',500),P(5,'soul-tithe','Soul Tithe','lifestealBp',2500)],
  starter:null,aiBias:{attack:45,strike:30,spell:25,guard:35,counter:35,ward:30}},
};
const G=(id,name,slot,tier,price,stats,hooks=[])=>({id,name,slot,tier,price,stats:{...Z,...stats},hooks});
export const gear={
 'wooden-sword':G('wooden-sword','Wooden Sword','weapon',1,0,{atk:2}),
 'bronze-blade':G('bronze-blade','Bronze Blade','weapon',1,150,{atk:5}),
 'knights-saber':G('knights-saber',"Knight's Saber",'weapon',2,400,{atk:9}),
 'goblin-cleaver':G('goblin-cleaver','Goblin Cleaver','weapon',3,800,{atk:12,luck:4}),
 'royal-claymore':G('royal-claymore','Royal Claymore','weapon',4,1600,{atk:18}),
 'pot-lid':G('pot-lid','Pot Lid','shield',1,0,{def:2}),
 'buckler':G('buckler','Buckler','shield',1,120,{def:5}),
 'tower-shield':G('tower-shield','Tower Shield','shield',2,380,{def:9,spd:-2}),
 'mirror-shield':G('mirror-shield','Mirror Shield','shield',3,750,{def:8},[{hook:'spellTakenBp',value:-2000}]),
 'aegis-of-usurpia':G('aegis-of-usurpia','Aegis of Usurpia','shield',4,1500,{hp:10,def:16}),
 'lucky-sock':G('lucky-sock','Lucky Sock','accessory',1,60,{luck:5}),
 'speed-anklet':G('speed-anklet','Speed Anklet','accessory',2,200,{spd:5}),
 'mage-ring':G('mage-ring','Mage Ring','accessory',2,350,{mag:6}),
 'tax-collectors-seal':G('tax-collectors-seal',"Tax Collector's Seal",'accessory',3,600,{},[{hook:'townTaxBp',value:500}]),
 'crown-ward-amulet':G('crown-ward-amulet','Crown Ward Amulet','accessory',4,900,{def:3},[{hook:'crownTaxResistBp',value:5000}]),
};
const I=(id,name,kind,price,use,effect)=>({id,name,kind,price,use,effect});
export const items={
 'herb':I('herb','Herb','consumable',20,'both',{kind:'heal',bp:3000}),
 'big-herb':I('big-herb','Big Herb','consumable',60,'both',{kind:'heal',bp:6000}),
 'royal-elixir':I('royal-elixir','Royal Elixir','consumable',200,'both',{kind:'heal',bp:10000}),
 'antidote':I('antidote','Antidote','consumable',30,'both',{kind:'cleanse'}),
 'swift-boots':I('swift-boots','Swift Boots','consumable',80,'board',{kind:'board',tag:'spinBonus',value:3}),
 'lead-boots':I('lead-boots','Lead Boots','consumable',80,'board',{kind:'board',tag:'spinFixed',value:1}),
 'homing-stone':I('homing-stone','Homing Stone','consumable',120,'board',{kind:'board',tag:'warpCastle',value:0}),
 'pathfinder':I('pathfinder','Pathfinder','consumable',150,'board',{kind:'board',tag:'pickSpin',value:6}),
 'smoke-bomb':I('smoke-bomb','Smoke Bomb','consumable',50,'combat',{kind:'flee'}),
 'battle-tonic':I('battle-tonic','Battle Tonic','consumable',70,'combat',{kind:'mod',stat:'atk',bp:2500}),
 'iron-tonic':I('iron-tonic','Iron Tonic','consumable',70,'combat',{kind:'mod',stat:'def',bp:2500}),
 'coin-purse-lock':I('coin-purse-lock','Coin Purse Lock','consumable',100,'board',{kind:'board',tag:'blockGoldSteal',value:1}),
 'decoy-gold-bag':I('decoy-gold-bag','Decoy Gold Bag','joke',120,'none',{kind:'joke',tag:'decoyGoldBag'}),
 'cursed-wig':I('cursed-wig','Cursed Wig','joke',90,'none',{kind:'joke',tag:'cursedWig'}),
 'whoopee-scroll':I('whoopee-scroll','Whoopee Scroll','joke',60,'none',{kind:'joke',tag:'whoopeeScroll'}),
 'royal-summons':I('royal-summons','Royal Summons (fake)','joke',150,'none',{kind:'joke',tag:'royalSummons'}),
 'bag-of-bees':I('bag-of-bees','Bag of Bees','joke',80,'none',{kind:'joke',tag:'bagOfBees'}),
};
const B=(id,name,tier,price,powerBp,effect)=>({id,name,tier,price,powerBp,effect});
export const battleSpells={
 'spark':B('spark','Spark',1,50,9000,{kind:'none'}),
 'fireball':B('fireball','Fireball',2,200,14000,{kind:'none'}),
 'thunderclap':B('thunderclap','Thunderclap',3,600,16000,{kind:'stun',chanceBp:2500}),
 'frostbite':B('frostbite','Frostbite',2,300,10000,{kind:'mod',stat:'spd',bp:-2000}),
 'drain':B('drain','Drain',1,150,9000,{kind:'drain',bp:5000}),
 'hex':B('hex','Hex',2,300,0,{kind:'mod',stat:'atk',bp:-2500}),
 'pickpocket-bolt':B('pickpocket-bolt','Pickpocket Bolt',2,250,7000,{kind:'stealGold',bp:500}),
 'royal-decree':B('royal-decree','Royal Decree',4,1500,20000,{kind:'none'}),
};
const WS=(id,name,tier,price,mode,valueBp)=>({id,name,tier,price,mode,valueBp});
export const wardSpells={
 'barrier':WS('barrier','Barrier',1,100,'barrier',0),
 'reflect':WS('reflect','Reflect',2,400,'reflect',5000),
 'absorb':WS('absorb','Absorb',3,500,'absorb',0),
 'counterspell':WS('counterspell','Counterspell',3,450,'counterspell',12500),
};
const F=(id,name,tier,price,tag,value,duration)=>({id,name,tier,price,tag,value,duration});
export const fieldSpells={
 'haste':F('haste','Haste',1,120,'spinTwiceHigher',0,1),
 'snare':F('snare','Snare',2,180,'spinCap',2,2),
 'usurp':F('usurp','Usurp',4,600,'seizeTown',1000,0),
 'blessing':F('blessing','Blessing',2,250,'fullHealCleanse',0,0),
 'fog':F('fog','Fog',3,300,'hideAndImmune',0,2),
 'golden-touch':F('golden-touch','Golden Touch',2,200,'doubleGoldSpace',0,1),
 'swap':F('swap','Swap',3,350,'swapPositions',0,0),
 'silence':F('silence','Silence',3,300,'blockFieldSpells',0,3),
};
const AT=(attack,strike,spell,flee)=>({attack,strike,spell,flee});
const DT=(guard,counter,ward)=>({guard,counter,ward});
const M=(id,name,tier,zone,tagline,statBp,attackTable,defendTable,battleSpell,wardSpell,hooks,xp,gold)=>({id,name,tier,zone,tagline,statBp,attackTable,defendTable,battleSpell,wardSpell,hooks,xp,gold});
const H=(hook,value)=>({hook,value});
export const monsters={
 'slime-intern':M('slime-intern','Slime Intern',1,'enchanted-forest','Unpaid, unbothered, unarmed.',S(8000,8000,8000,8000,8000,8000),AT(60,20,20,0),DT(40,30,30),'spark',null,[],15,20),
 'mushroom-mail-carrier':M('mushroom-mail-carrier','Mushroom Mail Carrier',1,'enchanted-forest','Neither rain nor spores.',S(9500,9500,9000,9000,9000,10000),AT(50,30,20,0),DT(40,30,30),'spark',null,[H('poisonOnHit',1)],20,25),
 'squirrel-pickpocket':M('squirrel-pickpocket','Squirrel Pickpocket',1,'enchanted-forest','Takes a cut. Runs.',S(8000,9000,8000,8000,14000,14000),AT(50,20,10,20),DT(30,40,30),'spark',null,[H('stealGoldOnHitBp',500)],20,40),
 'treant-groundskeeper':M('treant-groundskeeper','Treant Groundskeeper',1,'enchanted-forest','Keep off the grass. Forever.',S(14000,10000,12500,8000,6000,8000),AT(40,40,20,0),DT(50,30,20),'spark',null,[],25,25),
 'crab-customs-officer':M('crab-customs-officer','Crab Customs Officer',2,'soggy-coast','Anything to declare?',S(10000,9500,13000,8000,8500,9000),AT(45,35,20,0),DT(25,55,20),'spark',null,[],45,50),
 'seagull-debt-collector':M('seagull-debt-collector','Seagull Debt Collector',2,'soggy-coast','Mine. Mine. Mine.',S(9000,10000,9000,9000,12500,12000),AT(55,25,20,0),DT(35,35,30),'spark',null,[H('stealItemOnHit',1)],45,45),
 'mermaid-lifeguard':M('mermaid-lifeguard','Mermaid Lifeguard',2,'soggy-coast','No running by the sea.',S(10000,9000,9500,11500,10000,10000),AT(35,20,45,0),DT(35,25,40),'drain','barrier',[H('roundRegenBp',800)],50,50),
 'pirate-accountant':M('pirate-accountant','Pirate Accountant',2,'soggy-coast','Arr-udits your books.',S(9500,9000,9000,11000,10500,11000),AT(30,20,50,0),DT(35,30,35),'pickpocket-bolt',null,[],50,70),
 'goblin-tax-auditor':M('goblin-tax-auditor','Goblin Tax Auditor',3,'goblin-mines','Your receipts are... concerning.',S(10000,10000,10000,9000,10000,10000),AT(50,30,20,0),DT(35,35,30),'spark',null,[H('stealGoldOnHitBp',800)],90,100),
 'golem-foreman':M('golem-foreman','Golem Foreman',3,'goblin-mines','Safety third.',S(12000,12000,11500,6000,7000,8000),AT(30,60,10,0),DT(45,35,20),'spark',null,[],95,90),
 'bat-night-shift':M('bat-night-shift','Bat Night-Shift',3,'goblin-mines','Clocked in at dusk.',S(8500,10000,8500,9000,14000,11000),AT(55,25,20,0),DT(30,40,30),'drain',null,[H('lifestealBp',3000)],90,80),
 'mimic-vault-clerk':M('mimic-vault-clerk','Mimic Vault Clerk',3,'goblin-mines','Please take a number. And a bite.',S(11000,11000,11000,9000,8000,12000),AT(45,40,15,0),DT(30,50,20),'spark',null,[],110,250),
 'swamp-witch-notary':M('swamp-witch-notary','Swamp Witch Notary',4,'bureaucrat-bog','Sign here, here, and in blood.',S(9500,8000,9000,12500,10000,10000),AT(25,15,60,0),DT(30,30,40),'hex','reflect',[],160,150),
 'bog-troll-bouncer':M('bog-troll-bouncer','Bog Troll Bouncer',4,'bureaucrat-bog',"You're not on the list.",S(15000,11500,10500,6000,7000,8000),AT(45,45,10,0),DT(50,35,15),'spark',null,[],170,140),
 'wisp-paperwork-spirit':M('wisp-paperwork-spirit','Wisp Paperwork Spirit',4,'bureaucrat-bog','Form 27-B, stroke 6.',S(8000,6000,9000,12500,12000,10000),AT(10,10,80,0),DT(20,20,60),'frostbite','absorb',[H('physTakenBp',-5000)],160,130),
 'ogre-middle-manager':M('ogre-middle-manager','Ogre Middle Manager',4,'bureaucrat-bog',"Let's circle back on your face.",S(11500,11000,10500,10000,9000,9000),AT(40,35,25,0),DT(35,35,30),'fireball','barrier',[H('attackDmgBp',1000)],180,160),
};
const GD=(id,name,style,statBp,attackTable,defendTable,battleSpell,wardSpell,hooks,xpPerTier,goldPerTier)=>({id,name,style,statBp,attackTable,defendTable,battleSpell,wardSpell,hooks,xpPerTier,goldPerTier});
export const guardians={
 'landlord-lich':GD('landlord-lich','Landlord Lich','magic',S(11000,8000,9500,12500,10000,10000),AT(20,15,65,0),DT(30,25,45),'fireball','reflect',[],60,0),
 'tollbridge-troll':GD('tollbridge-troll','Tollbridge Troll','physical',S(13000,11500,11500,6000,8000,9000),AT(40,50,10,0),DT(45,40,15),'spark',null,[],60,0),
 'knight-of-foreclosure':GD('knight-of-foreclosure','Knight of Foreclosure','balanced',S(12000,10500,10500,10000,9500,9500),AT(40,35,25,0),DT(35,35,30),'spark','barrier',[],60,0),
};
export const enforcer={id:'crown-enforcer',name:'Crown Enforcer',statBp:S(9000,12000,10000,8000,10000,10000),attackTable:AT(25,60,15,0),defendTable:DT(35,40,25),battleSpell:'spark',wardSpell:null,hooks:[],xpPerLevel:10,goldPerLevel:0};
export const npcCurve=[S(48,15,9,11,9,4),S(95,30,16,22,13,6),S(140,44,24,32,16,8),S(190,58,32,42,19,10),S(245,72,40,52,22,12)];
export const combat={kBp:14500,jBp:5000,jMagBp:3500,
 matrix:{attack:{guard:5000,counter:12500,ward:10000,open:10000},strike:{guard:15000,counter:10000,ward:17500,open:15000},spell:{guard:10000,counter:10000,ward:4000,open:10000}},
 critBaseBp:300,critPerLuckBp:25,critCapBp:2000,critMultBp:15000,maxRounds:3,
 fleeBaseBp:5000,fleePerSpdBp:250,fleeMinBp:1000,fleeMaxBp:9000,modMinBp:-5000,modMaxBp:5000,poisonBp:800,seniorRewardBp:15000,pvpXpPerLevel:10};
const xpCurve=[];for(let L=1;L<=20;L++)xpCurve.push(25*(L-1)*L);
export const progression={maxLevel:20,xpCurve,baseStats:S(40,14,10,12,10,5),growth:S(9,3,2,3,1,1),masteryWins:[0,3,7,12,18],hybridUnlockRank:3};
export const economy={startingGold:100,maxScrolls:3};
export const CONTENT_RULES={v:1,classes,gear,items,battleSpells,wardSpells,fieldSpells,monsters,guardians,enforcer,npcCurve,combat,progression,economy};
function strip(v){if(Array.isArray(v))return v.map(strip);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v)){if(k==='name'||k==='tagline')continue;o[k]=strip(v[k]);}return o;}return v;}
export const RULES=strip(CONTENT_RULES);
