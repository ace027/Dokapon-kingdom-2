import {RULES as R} from './content-rules.mjs';
import {duel} from './sim.mjs';
import {rulesHash} from './kernel.mjs';
const args=Object.fromEntries(process.argv.slice(2).reduce((acc,x,i,arr)=>{if(x.startsWith('--'))acc.push([x.slice(2),arr[i+1]]);return acc;},[]));
const n=+(args.n??1000),seed=args.seed??'usurpia',level=+(args.level??5);const [dA,dB]=(args.difficulty??'normal').includes(':')?args.difficulty.split(':'):[args.difficulty??'normal',args.difficulty??'normal'];
const cls=Object.keys(R.classes).sort(),mons=Object.keys(R.monsters).sort();
const classes=[];for(const a of cls)for(const b of cls)classes.push({a,b:{kind:'class',id:b},group:'class-vs-class'});
const monsters=[];for(const a of cls)for(const m of mons)monsters.push({a,b:{kind:'monster',id:m},group:'class-vs-monster'});
const spec=args.matchup??'all';let M;
if(spec==='all')M=[...classes,...monsters];else if(spec==='classes')M=classes;else if(spec==='monsters')M=monsters;else if(spec==='mirrors')M=cls.map(c=>({a:c,b:{kind:'class',id:c},group:'class-vs-class'}));
else{const [a,b]=spec.split(':');M=[b.startsWith('monster/')?{a,b:{kind:'monster',id:b.slice(8)},group:'class-vs-monster'}:{a,b:{kind:'class',id:b},group:'class-vs-class'}];}
const stats=M.map(()=>({n:0,a:0,b:0,draw:0,fled:0}));const t0=Date.now();
for(let i=0;i<n;i++){const k=i%M.length;const m=M[k];const r=duel(R,`${seed}/${i}`,{kind:'class',id:m.a},m.b,dA,dB,level);const e=r.end;const st=stats[k];st.n++;
 if(e.outcome==='ko'){if(e.winner===0)st.a++;else st.b++;}else if(e.outcome==='draw')st.draw++;else st.fled++;}
const out=[`duel n=${n} seed=${seed} level=${level} difficulty=${dA}:${dB} rules=${rulesHash(R)}`];let group='';const tot={a:0,b:0,draw:0,fled:0};
M.forEach((m,k)=>{const st=stats[k];if(st.n===0)return;if(m.group!==group){group=m.group;out.push('# '+group);}const name=m.b.kind==='class'?`${m.a}:${m.b.id}`:`${m.a}:monster/${m.b.id}`;
 out.push(`${name} n=${st.n} a=${st.a} b=${st.b} draw=${st.draw} fled=${st.fled} aRate=${st.a+st.b>0?(st.a/(st.a+st.b)).toFixed(3):'n/a'}`);tot.a+=st.a;tot.b+=st.b;tot.draw+=st.draw;tot.fled+=st.fled;});
out.push(`total n=${n} a=${tot.a} b=${tot.b} draw=${tot.draw} fled=${tot.fled}`);console.log(out.join('\n'));console.error('elapsed_ms='+(Date.now()-t0));
