import {TEST_RULES as R} from './test-rules.mjs';
import {createGame,reduce,sheetStats} from './engine.mjs';
import {hashState,stableStringify} from './kernel.mjs';
const settings={v:2,seed:'fixture',players:[{id:'p1',classId:'fighter'},{id:'p2',classId:'caster'}]};
const actions=[
 {v:2,type:'decision/open',playerId:'system',prompts:[{playerId:'p1',options:['yes','no'],default:'no'},{playerId:'p2',options:['red','green','blue'],default:'red'}]},
 {v:2,type:'decision/commit',playerId:'p1',decisionId:'d1',choice:'yes'},
 {v:2,type:'decision/commit',playerId:'p1',decisionId:'d1',choice:'no'},
 {v:2,type:'timeout',playerId:'system',decisionId:'d1'},
 {v:2,type:'decision/open',playerId:'system',prompts:[{playerId:'p2',options:['a','b'],default:'a'}]},
 {v:2,type:'decision/commit',playerId:'p2',decisionId:'d2',choice:'c'},
 {v:2,type:'decision/commit',playerId:'p2',decisionId:'d2',choice:'b'},
];
let s=createGame(settings,R);console.log('initial',hashState(s));console.log(JSON.stringify(s));
const ev=[];let rej=[];actions.forEach((a,i)=>{const r=reduce(s,a,R);if(r.ok){s=r.state;ev.push(...r.events);}else rej.push([i,r.error.code]);});
console.log('final',hashState(s),'events',ev.length,'rej',JSON.stringify(rej));console.log(ev.map(e=>e.type).join(','));
console.log(stableStringify(s));
console.log(JSON.stringify({settings,actions}));
