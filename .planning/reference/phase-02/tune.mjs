import {CONTENT_RULES as R0} from './content-rules.mjs';
import {duel} from './sim.mjs';
const [kBp,hpBase,hpG]=process.argv.slice(2).map(Number);
const R=structuredClone(R0);R.combat.kBp=kBp;R.progression.baseStats.hp=hpBase;R.progression.growth.hp=hpG;
const n=200;
for(const [da,db] of [['normal','normal'],['hard','easy']]){let line=[];for(const L of [1,5,13]){for(const cls of Object.keys(R.classes)){let aw=0,bw=0,dr=0;
 for(let i=0;i<n;i++){const sw=i%2===0;const r=duel(R,`t/${cls}/${i}`,{kind:'class',id:cls},{kind:'class',id:cls},sw?da:db,sw?db:da,L);const e=r.end;
  if(e.outcome==='ko'){const aSide=sw?0:1;if(e.winner===aSide)aw++;else bw++;}else dr++;}
 line.push(`${L}${cls.slice(0,4)}:${((aw+bw)/n).toFixed(2)}/${(aw/(aw+bw)).toFixed(2)}`);}}console.log(da,db,line.join(' '));}
