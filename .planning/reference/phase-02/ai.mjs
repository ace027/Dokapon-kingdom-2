import {seedRng,nextInt} from './kernel.mjs';
import {snap,computeCell,critChance,critEligible,npcDef} from './engine.mjs';
// exp(x) for x <= 0 using only IEEE-754 +,-,*,/ and Math.round (exactly specified in ECMAScript), so results are engine-independent
export const LN2=0.6931471805599453;
export function expNeg(x){if(!(x<=0))throw new RangeError('expNeg: x must be <= 0');if(x<-700)return 0;
 const k=Math.round(x/LN2);const r=x-k*LN2;let p=1;for(let i=13;i>=1;i--)p=1+r*p/i;for(let j=0;j<-k;j++)p=p*0.5;return p;}
export const AI={healThresholdBp:3500,easyForgetHealBp:3000,koBonus:0.5,normalTemp:0.15,hardTemp:0.04,hardPriorStrength:4,weightScale:1000000};
export function createAi(seed,playerId,difficulty){return {rng:seedRng(`${seed}\u0000ai\u0000${playerId}\u0000${difficulty}`),playerId,difficulty};}
const ATT=['attack','strike','spell'],DEF=['guard','counter','ward'];
function pick(ai,keys,weights){const tot=weights.reduce((a,b)=>a+b,0);const [u,rng]=nextInt(ai.rng,1,tot);ai={...ai,rng};let acc=0;for(let i=0;i<keys.length;i++){acc+=weights[i];if(u<=acc)return {choice:keys[i],ai};}}
function oppPrior(R,view,side,role){if(side.kind==='player'){const b=R.classes[view.public.characters[side.playerId].classId].aiBias;return b;}
 const d=npcDef(R,side.npc);return role==='attacker'?d.attackTable:d.defendTable;}
export function decideCombat(view,R,ai){const self=view.self;const pend=view.public.pending;
 if(self===null||self.prompt===null||pend===null||pend.id!==self.prompt.decisionId||pend.committed.includes(view.viewer))return {action:null,ai};
 const prompt=self.prompt;const c=view.public.combat;const mi=c.sides.findIndex(s=>s.kind==='player'&&s.playerId===view.viewer);const oi=1-mi;
 const st={public:view.public};const me=snap(R,st,c.sides[mi]),op=snap(R,st,c.sides[oi]);
 const role=prompt.options.includes('attack')?'attacker':'defender';
 const commit=(choice,ai)=>({action:{v:2,type:'decision/commit',playerId:view.viewer,decisionId:prompt.decisionId,choice},ai});
 if(role==='attacker'&&me.hp*10000<=me.maxHp*AI.healThresholdBp){const heals=prompt.options.filter(o=>o.startsWith('item:')&&R.items[o.slice(5)].effect.kind==='heal');
  if(heals.length>0){let forget=false;if(ai.difficulty==='easy'){const [u,rng]=nextInt(ai.rng,1,10000);ai={...ai,rng};forget=u<=AI.easyForgetHealBp;}
   if(!forget){const missing=me.maxHp-me.hp;const amt=o=>Math.floor(me.maxHp*R.items[o.slice(5)].effect.bp/10000);
    const enough=heals.filter(o=>amt(o)>=missing);let best;
    if(enough.length>0)best=enough.reduce((b,o)=>amt(o)<amt(b)?o:b);else best=heals.reduce((b,o)=>amt(o)>amt(b)?o:b);return commit(best,ai);}}}
 const pol=combatPolicy(view,R,ai.difficulty);const r=pick(ai,pol.commands,pol.weights);return commit(r.choice,r.ai);}
export function combatPolicy(view,R,difficulty){const self=view.self;const prompt=self.prompt;const c=view.public.combat;const mi=c.sides.findIndex(s=>s.kind==='player'&&s.playerId===view.viewer);const oi=1-mi;
 const st={public:view.public};const me=snap(R,st,c.sides[mi]),op=snap(R,st,c.sides[oi]);const role=prompt.options.includes('attack')?'attacker':'defender';
 const mine=(role==='attacker'?ATT:DEF).filter(k=>prompt.options.includes(k));
 const bias=R.classes[view.public.characters[view.viewer].classId].aiBias;
 let base=mine.map(k=>bias[k]);if(base.every(w=>w===0))base=mine.map(()=>1);
 if(difficulty==='easy')return {commands:mine,weights:base};
 // opponent distribution
 const orole=role==='attacker'?'defender':'attacker';let okeys,q;
 if(orole==='defender'&&op.mods.stun){okeys=['open'];q=[1];}
 else{okeys=orole==='attacker'?['attack','strike',...(op.spell!==null?['spell']:[])]:DEF;
  const pr=oppPrior(R,view,c.sides[oi],orole);let w=okeys.map(k=>pr[k]);if(w.every(x=>x===0))w=okeys.map(()=>1);const tw=w.reduce((a,b)=>a+b,0);let pn=w.map(x=>x/tw);
  if(difficulty==='hard'&&c.sides[oi].kind==='player'){const h=view.public.choiceHistory[c.sides[oi].playerId];const n=okeys.map(k=>h[k]);const N=n.reduce((a,b)=>a+b,0);const al=AI.hardPriorStrength;
   q=okeys.map((k,i)=>(n[i]+al*pn[i])/(N+al));}else q=pn;}
 const val=(a,d)=>{const att=role==='attacker'?me:op,def=role==='attacker'?op:me;const p=critEligible(a,d)?critChance(R,att)/10000:0;
  const r0=computeCell(R,att,def,a,d,false),r1=p>0?computeCell(R,att,def,a,d,true):r0;
  const toDef=(1-p)*r0.toDef+p*r1.toDef,toAtt=(1-p)*r0.toAtt+p*r1.toAtt,hA=(1-p)*r0.healAtt+p*r1.healAtt,hD=(1-p)*r0.healDef+p*r1.healDef;
  let v=(Math.min(toDef,def.hp)-hD)/def.maxHp-(Math.min(toAtt,att.hp)-hA)/att.maxHp+(toDef>=def.hp?AI.koBonus:0)-(toAtt>=att.hp?AI.koBonus:0);
  return role==='attacker'?v:-v;};
 const ev=mine.map(k=>okeys.reduce((t,o,i)=>t+q[i]*(role==='attacker'?val(k,o):val(o,k)),0));
 const T=difficulty==='normal'?AI.normalTemp:AI.hardTemp;
 // engine-independent softmax: no Math.exp/Math.log (see expNeg); Normal multiplies by the bias instead of adding ln(bias)
 const z=ev.map(e=>e/T);const mx=Math.max(...z);
 const ex=mine.map((k,i)=>(difficulty==='normal'?(base[i]>0?base[i]:1e-9):1)*expNeg(z[i]-mx));const se=ex.reduce((a,b)=>a+b,0);
 const w=ex.map(e=>Math.round(e/se*AI.weightScale));
 return {commands:mine,weights:w,ev};}

