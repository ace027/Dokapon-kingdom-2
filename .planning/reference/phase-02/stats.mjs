import {RULES as R} from './content-rules.mjs';
import {sheetStats,npcStats} from './engine.mjs';
import {KITS,tierForLevel} from './sim.mjs';
for(const L of [1,5,9,13])for(const c of Object.keys(R.classes)){const k=KITS[c][tierForLevel(L)-1];const mastery={};for(const x in R.classes)mastery[x]=0;
 const ch={classId:c,level:L,mastery,portable:null,weapon:k[0],shield:k[1],accessory:k[2]};console.log(L,c,JSON.stringify(sheetStats(R,ch)));}
for(const m of Object.values(R.monsters))console.log(m.tier,m.id,JSON.stringify(npcStats(R,{kind:'monster',id:m.id,senior:false})));
