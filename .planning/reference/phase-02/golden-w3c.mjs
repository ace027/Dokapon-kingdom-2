import {TEST_RULES as R} from './test-rules.mjs';
import {createGame,reduce} from './engine.mjs';
import {hashState,stableStringify} from './kernel.mjs';
const settings={v:2,seed:'rewards-golden',players:[{id:'p1',classId:'fighter'},{id:'p2',classId:'caster'}]};
const scriptQ=JSON.parse(process.argv[2]); // {p1:[...],p2:[...]} ; 'T' means timeout for this decision
const pre=JSON.parse(process.argv[3]||'[]');
let s=createGame(settings,R);const ev=[];const actions=[];
const app=a=>{actions.push(a);const r=reduce(s,a,R);if(!r.ok){console.log('REJ',JSON.stringify(a),r.error.code);return;}s=r.state;ev.push(...r.events);};
outer: for(const a of pre){app(a);
 while(s.public.phase==='decision'){const p=s.public.pending;let to=false;
  const step=scriptQ.shift();if(step===undefined){console.log('STOP');break;}console.log('#',p.id,JSON.stringify(p.required),JSON.stringify(Object.fromEntries(p.required.map(q=>[q,s.private[q].prompt.options]))));
  for(const pid of p.required){const c=step[pid];if(c===undefined){console.log('NOCHOICE',pid);process.exitCode=1;}if(c==='T'){to=true;continue;}app({v:2,type:'decision/commit',playerId:pid,decisionId:p.id,choice:c});if(s.public.phase!=='decision'||s.public.pending?.id!==p.id)break;}
  if(to&&s.public.phase==='decision'&&s.public.pending.id===p.id)app({v:2,type:'timeout',playerId:'system',decisionId:p.id});}}
for(const e of ev){const {v,visibility,type,...rest}=e;console.log(type,visibility.kind==='public'?'':'[private '+visibility.ids+']',JSON.stringify(rest));}
console.log('FINAL',hashState(s),'events',ev.length,'actions',actions.length);
console.log('ACTIONS',JSON.stringify(actions));
console.log('STATE',stableStringify(s));
