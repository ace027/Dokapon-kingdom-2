import {RULES as R} from './content-rules.mjs';
import {duel} from './sim.mjs';
const n=+process.argv[2]||100;const diff=process.argv[3]||'normal';const L=+process.argv[4]||5;
const cls=Object.keys(R.classes);
console.log('class vs class L'+L+' (A win share of all duels / draws)');
for(const a of cls){const row=[];for(const b of cls){let aw=0,bw=0,d=0;for(let i=0;i<n;i++){const r=duel(R,`m/${a}/${b}/${i}`,{kind:'class',id:a},{kind:'class',id:b},diff,diff,L);const e=r.end;if(e.outcome==='ko'){if(e.winner===0)aw++;else bw++;}else d++;}
 row.push(`${(aw/n).toFixed(2)}/${(bw/n).toFixed(2)}`);}console.log(a.padEnd(13),row.join(' '));}
console.log('class vs monster (player win / monster win) at tier level');
for(const m of Object.keys(R.monsters)){const row=[];for(const a of cls){let aw=0,bw=0;for(let i=0;i<n;i++){const r=duel(R,`mm/${a}/${m}/${i}`,{kind:'class',id:a},{kind:'monster',id:m},diff,diff,L);const e=r.end;if(e.outcome==='ko'){if(e.winner===0)aw++;else bw++;}}
 row.push(`${(aw/n).toFixed(2)}/${(bw/n).toFixed(2)}`);}console.log(m.padEnd(24),row.join(' '));}
