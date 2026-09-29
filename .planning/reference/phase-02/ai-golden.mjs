import {TEST_RULES as R} from './test-rules.mjs';
import {createGame,reduce,viewFor} from './engine.mjs';
import {createAi,decideCombat} from './ai.mjs';
import * as AIm from './ai.mjs';
let s=createGame({v:2,seed:'ai',players:[{id:'p1',classId:'fighter'},{id:'p2',classId:'caster'}]},R);
const r=reduce(s,{v:2,type:'combat/start',playerId:'system',attacker:'p1',opponent:{kind:'player',playerId:'p2'}},R);s=r.state;
console.log(JSON.stringify(s.public.combat), JSON.stringify(s.public.pending), JSON.stringify(s.private.p1.prompt), JSON.stringify(s.private.p2.prompt));
for(const hist of [null,{attack:0,strike:20,spell:0,guard:0,counter:0,ward:0},{attack:0,strike:0,spell:0,guard:20,counter:0,ward:0}]){
 let st=s; if(hist) st={...s,public:{...s.public,choiceHistory:{...s.public.choiceHistory,p1:hist,p2:hist}}};
 for(const pid of ['p1','p2'])for(const d of ['easy','normal','hard']){const ai=createAi('ai',pid,d);const out=decideCombat(viewFor(st,pid),R,ai);console.log(hist?JSON.stringify(hist).slice(0,40):'nohist',pid,d,out.action.choice,JSON.stringify(out.ai.rng));}}
import {combatPolicy} from './ai.mjs';
for(const hist of [null,{attack:0,strike:20,spell:0,guard:0,counter:0,ward:0},{attack:0,strike:0,spell:0,guard:20,counter:0,ward:0}]){
 let st=s; if(hist) st={...s,public:{...s.public,choiceHistory:{...s.public.choiceHistory,p1:hist,p2:hist}}};
 for(const pid of ['p1','p2'])for(const d of ['easy','normal','hard']){const p=combatPolicy(viewFor(st,pid),R,d);console.log('POLICY',hist?Object.entries(hist).filter(([k,v])=>v).map(([k,v])=>k+'='+v).join():'none',pid,d,JSON.stringify(p.commands),JSON.stringify(p.weights),p.ev?JSON.stringify(p.ev.map(x=>+x.toFixed(6))):'');}}
