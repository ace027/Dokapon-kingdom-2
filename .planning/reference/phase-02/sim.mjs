import {createGame,reduce,viewFor,rewardsEnabled} from './engine.mjs';
import {createAi,decideCombat} from './ai.mjs';
export const KITS={ // per class, tier 1..4
 warrior:[['wooden-sword','pot-lid',null,'spark',null],['bronze-blade','buckler','lucky-sock','spark','barrier'],['knights-saber','tower-shield','speed-anklet','fireball','barrier'],['royal-claymore','aegis-of-usurpia','crown-ward-amulet','fireball','reflect']],
 thief:[['wooden-sword','pot-lid','lucky-sock','spark',null],['bronze-blade','buckler','speed-anklet','pickpocket-bolt','barrier'],['goblin-cleaver','buckler','speed-anklet','frostbite','barrier'],['royal-claymore','mirror-shield','speed-anklet','thunderclap','reflect']],
 mage:[['wooden-sword','pot-lid',null,'fireball','barrier'],['wooden-sword','buckler','mage-ring','fireball','barrier'],['bronze-blade','mirror-shield','mage-ring','thunderclap','reflect'],['knights-saber','aegis-of-usurpia','mage-ring','royal-decree','absorb']],
 cleric:[['wooden-sword','pot-lid',null,'drain','barrier'],['bronze-blade','buckler','mage-ring','drain','barrier'],['knights-saber','mirror-shield','mage-ring','drain','absorb'],['goblin-cleaver','aegis-of-usurpia','mage-ring','drain','counterspell']],
 spellblade:[['wooden-sword','pot-lid',null,'spark',null],['bronze-blade','buckler','mage-ring','fireball','barrier'],['knights-saber','tower-shield','mage-ring','thunderclap','barrier'],['royal-claymore','aegis-of-usurpia','mage-ring','thunderclap','reflect']],
 shadowpriest:[['wooden-sword','pot-lid','lucky-sock','drain',null],['bronze-blade','buckler','speed-anklet','drain','barrier'],['goblin-cleaver','mirror-shield','speed-anklet','drain','absorb'],['royal-claymore','aegis-of-usurpia','speed-anklet','drain','counterspell']],
};
export const BAGS={warrior:['herb','herb'],thief:['herb','herb'],mage:['herb','herb'],cleric:['herb','herb'],spellblade:['herb','herb'],shadowpriest:['herb','herb']};
export const TIER_LEVEL=[1,5,9,13];
export const tierForLevel=L=>L>=13?4:L>=9?3:L>=5?2:1;
const seatClass=(R,c)=>R.classes[c].kind==='base'?c:R.classes[c].parents[0];
function setChar(R,target,cls,level){const t=tierForLevel(level);const k=KITS[cls][t-1];return {v:2,type:'system/setCharacter',playerId:'system',target,classId:cls,level,weapon:k[0],shield:k[1],accessory:k[2],battleSpell:k[3],wardSpell:k[4],bag:[...BAGS[cls]]};}
export function duel(R,seed,A,B,diffA,diffB,level){ // A,B: {kind:'class',id} | B {kind:'monster',id}
 let s=createGame({v:2,seed,players:[{id:'a',classId:seatClass(R,A.id)},...(B.kind==='class'?[{id:'b',classId:seatClass(R,B.id)}]:[])]},R);
 const ev=[];const app=a=>{const r=reduce(s,a,R);if(!r.ok)throw new Error('rej '+r.error.code+' '+JSON.stringify(a));s=r.state;ev.push(...r.events);};
 let lvl=level;if(B.kind==='monster')lvl=TIER_LEVEL[R.monsters[B.id].tier-1];
 app(setChar(R,'a',A.id,lvl));if(B.kind==='class')app(setChar(R,'b',B.id,lvl));
 app({v:2,type:'combat/start',playerId:'system',attacker:'a',opponent:B.kind==='class'?{kind:'player',playerId:'b'}:{kind:'monster',monsterId:B.id,senior:false}});
 const ais={a:createAi(seed,'a',diffA),b:createAi(seed,'b',diffB)};let guard=0;
 while(s.public.phase==='decision'){if(++guard>100)throw new Error('loop');const p=s.public.pending;
  for(const pid of p.required){if(s.public.phase!=='decision'||s.public.pending.id!==p.id)break;if(s.public.pending.committed.includes(pid))continue;
   const r=decideCombat(viewFor(s,pid),R,ais[pid]);ais[pid]=r.ai;app(r.action);}}
 const end=ev.findLast(e=>e.type==='CombatEnded');return {end,state:s,events:ev};}
