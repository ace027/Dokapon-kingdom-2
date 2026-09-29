import fs from 'node:fs';
import {createGame,reduce} from './engine.mjs';
import {hashState} from './kernel.mjs';
import {TEST_RULES} from './spec-test-rules.mjs';
const specRules=JSON.parse(fs.readFileSync('spec-rules.json','utf8'));
const s=fs.readFileSync('/home/user/Dokapon-kingdom-2/.planning/specs/02-combat-core-balance-sim-spec.md','utf8');
function block(marker){const i=s.indexOf(marker);if(i<0)throw new Error('no marker '+marker);const j=s.indexOf('```json',i)+7;const k=s.indexOf('```',j);return JSON.parse(s.slice(j,k));}
function run(name,settings,actions,R){let st=createGame(settings,R);let ev=0,rej=[];actions.forEach((a,i)=>{const r=reduce(st,a,R);if(r.ok){st=r.state;ev+=r.events.length}else rej.push([i,r.error.code])});console.log(name,hashState(st),ev,JSON.stringify(rej));}
run('W1',{v:2,seed:'fixture',players:[{id:'p1',classId:'fighter'},{id:'p2',classId:'caster'}]},block('**Golden (W1, `packages/sim/fixtures/kernel-game.json`'),TEST_RULES);
run('W2',{v:2,seed:'combat-golden',players:[{id:'p1',classId:'fighter'},{id:'p2',classId:'caster'}]},block('**Combat golden (W2'),TEST_RULES);
run('W3core',{v:2,seed:'rewards-golden',players:[{id:'p1',classId:'fighter'},{id:'p2',classId:'caster'}]},block('**Rewards/loadout golden'),TEST_RULES);
run('W3sim',{v:2,seed:'sim-fixture',players:[{id:'a',classId:'warrior'},{id:'b',classId:'mage'}]},block('**Sim combat fixture (W3'),specRules);
console.log('initial',hashState(createGame({v:2,seed:'fixture',players:[{id:'p1',classId:'fighter'},{id:'p2',classId:'caster'}]},TEST_RULES)));
