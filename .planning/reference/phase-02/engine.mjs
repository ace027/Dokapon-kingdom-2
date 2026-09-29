import {seedRng,nextInt,stableStringify} from './kernel.mjs';
export const MAX_COUNTER=2**31-1;
const V=2;
const own=(o,k)=>Object.hasOwn(o,k)?o[k]:undefined;
const STATS=['hp','atk','def','mag','spd','luck'];
const COMBAT_HOOKS=['hpBp','atkBp','defBp','magBp','spdBp','luckBp','attackDmgBp','strikeDmgBp','spellDmgBp','guardVsStrikeBp','counterDmgBp','wardReflectBp','critBp','fleeBp','lifestealBp','roundRegenBp','spellTakenBp','physTakenBp','spellbladeStrike','poisonOnHit','stealGoldOnHitBp','stealItemOnHit'];
export const COMMANDS=['attack','strike','spell','guard','counter','ward'];
const ZERO_MODS=()=>({atk:0,def:0,mag:0,spd:0,poison:false,stun:false});
const fl=Math.floor;
export function applyPassives(hooks){const t={};for(const h of COMBAT_HOOKS)t[h]=0;for(const {hook,value} of hooks){if(hook in t)t[hook]+=value;}return t;}
export function rankFor(R,wins){let r=0;R.progression.masteryWins.forEach((w,i)=>{if(wins>=w)r=i+1});return r;}
export function levelFor(R,xp){let L=1;R.progression.xpCurve.forEach((x,i)=>{if(xp>=x)L=i+1});return L;}
export function playerHooks(R,ch){const cls=R.classes[ch.classId];const rank=rankFor(R,ch.mastery[ch.classId]);const hs=[];
 for(const p of cls.passives)if(p.rank<=rank)hs.push(p);
 if(ch.portable!==null&&ch.portable!==ch.classId){hs.push(R.classes[ch.portable].passives[4]);}
 for(const slot of ['weapon','shield','accessory']){const g=ch[slot];if(g!==null)hs.push(...R.gear[g].hooks);}
 return hs;}
export function sheetStats(R,ch){const cls=R.classes[ch.classId];const t=applyPassives(playerHooks(R,ch));const out={};
 for(const s of STATS){let x=R.progression.baseStats[s]+R.progression.growth[s]*(ch.level-1);x=fl(x*cls.statBp[s]/10000);
  for(const slot of ['weapon','shield','accessory']){const g=ch[slot];if(g!==null)x+=R.gear[g].stats[s];}
  x=fl(x*(10000+t[s+'Bp'])/10000);out[s]=Math.max(s==='hp'?1:0,x);}return out;}
export function npcDef(R,ref){if(ref.kind==='monster')return R.monsters[ref.id];if(ref.kind==='guardian')return R.guardians[ref.id];return R.enforcer;}
export function npcStats(R,ref){const d=npcDef(R,ref);let curve;
 if(ref.kind==='monster')curve=R.npcCurve[d.tier-1+(ref.senior?1:0)];
 else if(ref.kind==='guardian')curve=R.npcCurve[ref.townTier];
 else {const c={};for(const s of STATS)c[s]=R.progression.baseStats[s]+R.progression.growth[s]*(ref.level-1);curve=c;}
 const out={};for(const s of STATS)out[s]=Math.max(s==='hp'?1:0,fl(curve[s]*d.statBp[s]/10000));return out;}
function battle(st,mods){const o={...st};for(const s of ['atk','def','mag','spd'])o[s]=Math.max(0,fl(st[s]*(10000+mods[s])/10000));return o;}
// snapshot of a side for resolution
export function snap(R,state,side){if(side.kind==='player'){const ch=state.public.characters[side.playerId];const sh=sheetStats(R,ch);
  return {kind:'player',id:side.playerId,stats:battle(sh,side.mods),maxHp:sh.hp,hp:ch.hp,h:applyPassives(playerHooks(R,ch)),spell:ch.battleSpell===null?null:R.battleSpells[ch.battleSpell],ward:ch.wardSpell===null?null:R.wardSpells[ch.wardSpell],mods:side.mods};}
 const d=npcDef(R,side.npc);return {kind:'npc',stats:battle(side.stats,side.mods),maxHp:side.stats.hp,hp:side.hp,h:applyPassives(d.hooks),spell:d.battleSpell===null?null:R.battleSpells[d.battleSpell],ward:d.wardSpell===null?null:R.wardSpells[d.wardSpell],mods:side.mods,def:d};}
export function critChance(R,att){return Math.min(R.combat.critCapBp,R.combat.critBaseBp+att.stats.luck*R.combat.critPerLuckBp+att.h.critBp);}
export function critEligible(a,d){return (a==='attack'||a==='strike')&&!(a==='strike'&&d==='counter');}
export function spellBase(R,att,def){const sp=att.spell;if(sp.powerBp===0)return 0;return Math.max(1,fl((att.stats.mag*sp.powerBp-def.stats.mag*R.combat.jMagBp)/10000));}
export function physBase(R,att,def){return Math.max(1,fl((att.stats.atk*R.combat.kBp-def.stats.def*R.combat.jBp)/10000));}
export function computeCell(R,att,def,a,d,crit){const m=R.combat.matrix;const out={toDef:0,toAtt:0,healAtt:0,healDef:0,tags:[],effectLands:false};
 const base=a==='spell'?spellBase(R,att,def):physBase(R,att,def);
 if(a==='strike'&&d==='counter'){let r=fl(base*m.strike.counter/10000);r=fl(r*(10000+def.h.counterDmgBp)/10000);out.toAtt=Math.max(1,r);out.tags.push('reflected');return out;}
 let dmg=fl(base*m[a][d]/10000);
 const bonus=a==='attack'?att.h.attackDmgBp:a==='strike'?att.h.strikeDmgBp:att.h.spellDmgBp;
 dmg=fl(dmg*(10000+bonus)/10000);
 if(a==='strike'&&d==='guard'&&def.h.guardVsStrikeBp>0)dmg=fl(dmg*(10000-Math.min(10000,def.h.guardVsStrikeBp))/10000);
 if(a==='spell')dmg=fl(dmg*Math.max(0,10000+def.h.spellTakenBp)/10000);else dmg=fl(dmg*Math.max(0,10000+def.h.physTakenBp)/10000);
 const ward=d==='ward'?def.ward:null;let negated=false;
 if(ward!==null&&ward.mode==='counterspell'){if(a==='spell'){dmg=0;negated=true;out.tags.push('negated');}else dmg=fl(dmg*ward.valueBp/10000);}
 if(crit&&a!=='spell')dmg=fl(dmg*R.combat.critMultBp/10000);
 if(a==='strike'&&att.h.spellbladeStrike>0&&att.spell!==null&&att.spell.powerBp>0){dmg+=fl(spellBase(R,att,def)*att.h.spellbladeStrike/10000);}
 if(base>0&&!negated)dmg=Math.max(1,dmg);
 if(ward!==null&&ward.mode==='absorb'&&a==='spell'&&dmg>0){out.healDef=dmg;dmg=0;out.tags.push('absorbed');}
 out.toDef=dmg;
 if(d==='ward'&&a==='spell'&&base>0&&!negated){const rbp=(ward!==null&&ward.mode==='reflect'?ward.valueBp:0)+def.h.wardReflectBp;
  if(rbp>0){const sraw=fl(base*(10000+att.h.spellDmgBp)/10000);out.toAtt=Math.max(1,fl(sraw*rbp/10000));out.tags.push('reflected');}}
 if(a!=='spell'&&dmg>0&&att.h.lifestealBp>0)out.healAtt+=fl(dmg*att.h.lifestealBp/10000);
 const carries=(a==='spell')||(a==='strike'&&att.h.spellbladeStrike>0&&att.spell!==null);
 out.effectLands=carries&&d!=='ward'&&(dmg>0||(a==='spell'&&att.spell.powerBp===0));
 if(out.effectLands&&att.spell.effect.kind==='drain')out.healAtt+=fl(dmg*att.spell.effect.bp/10000);
 return out;}
// ---------------- state helpers
function setChar(s,pid,ch){return {...s,public:{...s.public,characters:{...s.public.characters,[pid]:ch}}};}
function setPriv(s,pid,p){return {...s,private:{...s.private,[pid]:p}};}
const addSat=(a,b)=>Math.min(MAX_COUNTER,a+b);
// ---------------- createGame
export class SettingsError extends Error{}
export function createGame(settings,R){
 if(settings.v!==V)throw new SettingsError('v');
 const seats=settings.players;const players=seats.map(p=>p.id);
 const characters={},priv={},hist={};
 for(const seat of seats){const cls=own(R.classes,seat.classId);if(!cls||cls.kind!=='base')throw new SettingsError('class');
  const st=cls.starter;const mastery={};for(const c of Object.keys(R.classes).sort())mastery[c]=0;
  const ch={classId:seat.classId,level:1,xp:0,hp:0,gold:R.economy.startingGold,mastery,portable:null,weapon:st.weapon,shield:st.shield,accessory:st.accessory,battleSpell:st.battleSpell,wardSpell:st.wardSpell};
  ch.hp=sheetStats(R,ch).hp;characters[seat.id]=ch;priv[seat.id]={bag:[...st.bag],scrolls:[],prompt:null};
  hist[seat.id]={attack:0,strike:0,spell:0,guard:0,counter:0,ward:0};}
 return {v:V,public:{phase:'turn',turn:1,activePlayer:players[0],players,characters,choiceHistory:hist,pending:null,lastReveal:null,combat:null},
  private:priv,hidden:{rng:seedRng(settings.seed),decisionSeq:0,combatSeq:0,decision:null}};}
// ---------------- decisions
function openDecision(s,kind,prompts,events){ // prompts: [{playerId,options,default}]
 const seq=s.hidden.decisionSeq+1;const id='d'+seq;const required=prompts.map(p=>p.playerId);
 let n={...s,public:{...s.public,phase:'decision',pending:{id,kind,required,committed:[]}},hidden:{...s.hidden,decisionSeq:seq,decision:{id,choices:{}}}};
 events.push({v:V,type:'DecisionOpened',visibility:{kind:'public'},decisionId:id,kind,required});
 for(const p of prompts){n=setPriv(n,p.playerId,{...n.private[p.playerId],prompt:{decisionId:id,options:[...p.options],default:p.default}});
  events.push({v:V,type:'PromptOpened',visibility:{kind:'players',ids:[p.playerId]},decisionId:id,playerId:p.playerId,options:[...p.options],default:p.default});}
 return n;}
function reveal(s,timedOut,events,ctx,R){const pend=s.public.pending,dec=s.hidden.decision;const choices={};
 for(const p of pend.required){const c=own(dec.choices,p);choices[p]=c!==undefined?c:s.private[p].prompt.default;}
 let n={...s,public:{...s.public,phase:'turn',pending:null,lastReveal:{decisionId:pend.id,kind:pend.kind,choices,timedOut}},hidden:{...s.hidden,decision:null}};
 for(const p of pend.required)n=setPriv(n,p,{...n.private[p],prompt:null});
 events.push({v:V,type:'ChoicesRevealed',visibility:{kind:'public'},decisionId:pend.id,kind:pend.kind,choices,timedOut});
 if(pend.kind==='combat/exchange'){let hist={...n.public.choiceHistory};
  for(const p of pend.required){if(timedOut.includes(p))continue;const c=choices[p];if(COMMANDS.includes(c))hist[p]={...hist[p],[c]:addSat(hist[p][c],1)};}
  n={...n,public:{...n.public,choiceHistory:hist}};
  n=resolveExchange(n,choices,events,ctx,R);}
 return n;}
// ---------------- combat
const sideHp=(s,side)=>side.kind==='player'?s.public.characters[side.playerId].hp:side.hp;
function hpPair(s){const c=s.public.combat;return [sideHp(s,c.sides[0]),sideHp(s,c.sides[1])];}
function setSide(s,i,side){const c=s.public.combat;const sides=[...c.sides];sides[i]=side;return {...s,public:{...s.public,combat:{...c,sides}}};}
function setHp(s,i,hp){const side=s.public.combat.sides[i];if(side.kind==='player'){const ch=s.public.characters[side.playerId];return setChar(s,side.playerId,{...ch,hp});}return setSide(s,i,{...side,hp});}
function setMods(s,i,mods){return setSide(s,i,{...s.public.combat.sides[i],mods});}
function setCombat(s,patch){return {...s,public:{...s.public,combat:{...s.public.combat,...patch}}};}
function initiative(s,ctx,R){const a=snap(R,s,s.public.combat.sides[0]),b=snap(R,s,s.public.combat.sides[1]);
 if(a.stats.spd!==b.stats.spd)return a.stats.spd>b.stats.spd?0:1;
 const u=ctx.int(1,a.stats.luck+b.stats.luck+2);return u<=a.stats.luck+1?0:1;}
function startRound(s,round,ctx,R,events){const first=initiative(s,ctx,R);s=setCombat(s,{round,exchange:1,first});
 events.push({v:V,type:'RoundStarted',visibility:{kind:'public'},combatId:s.public.combat.id,round,first});return openExchange(s,ctx,R,events);}
export function attackerOptions(R,s,pid){const ch=s.public.characters[pid];const o=['attack','strike'];if(ch.battleSpell!==null)o.push('spell');o.push('flee');
 const seen=new Set();for(const it of s.private[pid].bag){const d=R.items[it];if((d.use==='combat'||d.use==='both')&&!seen.has(it)){seen.add(it);o.push('item:'+it);}}return o;}
function openExchange(s,ctx,R,events){for(;;){const c=s.public.combat;const ai=c.exchange===1?c.first:1-c.first,di=1-ai;const A=c.sides[ai],D=c.sides[di];
  if(A.mods.stun){s=setMods(s,ai,{...A.mods,stun:false});events.push({v:V,type:'ExchangeSkipped',visibility:{kind:'public'},combatId:c.id,round:c.round,exchange:c.exchange,attacker:ai,reason:'stunned'});
   const r=advance(s,ctx,R,events);if(r.done)return r.s;s=r.s;continue;}
  const prompts=[];if(A.kind==='player')prompts.push({playerId:A.playerId,options:attackerOptions(R,s,A.playerId),default:'attack'});
  if(D.kind==='player'&&!D.mods.stun)prompts.push({playerId:D.playerId,options:['guard','counter','ward'],default:'guard'});
  if(prompts.length>0)return openDecision(s,'combat/exchange',prompts,events);
  const r=resolveCore(s,{},ctx,R,events);if(r.done)return r.s;s=r.s;}}
function resolveExchange(s,choices,events,ctx,R){const r=resolveCore(s,choices,ctx,R,events);return r.done?r.s:openExchange(r.s,ctx,R,events);}
function drawTable(ctx,table,keys){const tot=keys.reduce((t,k)=>t+table[k],0);const u=ctx.int(1,tot);let acc=0;for(const k of keys){acc+=table[k];if(u<=acc)return k;}}
export function npcAttackKeys(R,side){const d=npcDef(R,side.npc);return ['attack','strike',...(d.battleSpell!==null?['spell']:[]),'flee'];}
// returns {s,done}; done => combat ended (state already closed) ; else caller opens next exchange
function resolveCore(s,choices,ctx,R,events){const c=s.public.combat;const ai=c.exchange===1?c.first:1-c.first,di=1-ai;const A=c.sides[ai],D=c.sides[di];
 let a,d;const post=[];
 a=A.kind==='player'?choices[A.playerId]:drawTable(ctx,npcDef(R,A.npc).attackTable,npcAttackKeys(R,A));
 const isCmd=a==='attack'||a==='strike'||a==='spell';
 if(D.mods.stun){d='open';}else if(D.kind==='player')d=isCmd?choices[D.playerId]:null;else d=isCmd?drawTable(ctx,npcDef(R,D.npc).defendTable,['guard','counter','ward']):null;
 // D not player & not cmd: no draw. D player & not cmd: their choice ignored
 if(D.kind==='player'&&!D.mods.stun&&!isCmd)d=null;
 if(D.mods.stun&&!isCmd)d=null;
 const ev={v:V,type:'ExchangeResolved',visibility:{kind:'public'},combatId:c.id,round:c.round,exchange:c.exchange,attacker:ai,command:a,defense:d,crit:false,damage:[0,0],heal:[0,0],effects:[],hp:[0,0]};
 let ended=null;
 if(D.mods.stun)s=setMods(s,di,{...D.mods,stun:false});
 if(a==='flee'){const as=snap(R,s,A),ds=snap(R,s,D);const cc=R.combat;
  const ch=Math.min(cc.fleeMaxBp,Math.max(cc.fleeMinBp,cc.fleeBaseBp+(as.stats.spd-ds.stats.spd)*cc.fleePerSpdBp+as.h.fleeBp));
  const u=ctx.int(1,10000);if(u<=ch){ev.effects.push('fled');ended={outcome:'fled',winner:null,fled:ai};}else ev.effects.push('flee-failed');}
 else if(a.startsWith('item:')){const id=a.slice(5);const it=R.items[id];const pid=A.playerId;const bag=[...s.private[pid].bag];bag.splice(bag.indexOf(id),1);
  s=setPriv(s,pid,{...s.private[pid],bag});post.push({v:V,type:'BagUpdated',visibility:{kind:'players',ids:[pid]},playerId:pid,bag});
  ev.effects.push(a);const as=snap(R,s,s.public.combat.sides[ai]);const e=it.effect;
  if(e.kind==='heal'){const h=Math.min(as.maxHp-as.hp,fl(as.maxHp*e.bp/10000));s=setHp(s,ai,as.hp+h);ev.heal[ai]=h;}
  else if(e.kind==='cleanse'){const m=s.public.combat.sides[ai].mods;s=setMods(s,ai,{atk:Math.max(0,m.atk),def:Math.max(0,m.def),mag:Math.max(0,m.mag),spd:Math.max(0,m.spd),poison:false,stun:false});}
  else if(e.kind==='flee'){ev.effects.push('fled');ended={outcome:'fled',winner:null,fled:ai};}
  else if(e.kind==='mod'){const m=s.public.combat.sides[ai].mods;s=setMods(s,ai,{...m,[e.stat]:Math.min(R.combat.modMaxBp,Math.max(R.combat.modMinBp,m[e.stat]+e.bp))});}}
 else {const as=snap(R,s,s.public.combat.sides[ai]),ds=snap(R,s,s.public.combat.sides[di]);let crit=false;
  if(critEligible(a,d)){const u=ctx.int(1,10000);crit=u<=critChance(R,as);}
  const r=computeCell(R,as,ds,a,d,crit);ev.crit=crit;
  let hpA=Math.max(0,as.hp-r.toAtt),hpD=Math.max(0,ds.hp-r.toDef);ev.damage[ai]=as.hp-hpA;ev.damage[di]=ds.hp-hpD;
  if(hpA>0&&r.healAtt>0){const h=Math.min(as.maxHp-hpA,r.healAtt);hpA+=h;ev.heal[ai]=h;}
  if(hpD>0&&r.healDef>0){const h=Math.min(ds.maxHp-hpD,r.healDef);hpD+=h;ev.heal[di]=h;}
  s=setHp(s,ai,hpA);s=setHp(s,di,hpD);ev.effects.push(...r.tags);
  if(r.effectLands){const e=as.spell.effect;
   if(e.kind==='stun'){const u=ctx.int(1,10000);if(u<=e.chanceBp){s=setMods(s,di,{...s.public.combat.sides[di].mods,stun:true});ev.effects.push('stun');}}
   else if(e.kind==='mod'){const m=s.public.combat.sides[di].mods;const v=Math.min(R.combat.modMaxBp,Math.max(R.combat.modMinBp,m[e.stat]+e.bp));s=setMods(s,di,{...m,[e.stat]:v});ev.effects.push(`mod:${e.stat}:${e.bp}`);}
   else if(e.kind==='stealGold'){const Dn=s.public.combat.sides[di];if(Dn.kind==='player'){const dch=s.public.characters[Dn.playerId];const amt=fl(dch.gold*e.bp/10000);
     if(amt>0){s=setChar(s,Dn.playerId,{...dch,gold:dch.gold-amt});const An=s.public.combat.sides[ai];if(An.kind==='player'){const ach=s.public.characters[An.playerId];s=setChar(s,An.playerId,{...ach,gold:addSat(ach.gold,amt)});}ev.effects.push('steal-gold:'+amt);}}}
   if(e.kind==='drain'&&ev.heal[ai]>0)ev.effects.push('drain');}
  if((a==='attack'||a==='strike')&&r.toDef>0){const h=as.h;const Dn=()=>s.public.combat.sides[di];
   if(h.poisonOnHit>0){s=setMods(s,di,{...Dn().mods,poison:true});ev.effects.push('poison');}
   if(h.stealGoldOnHitBp>0&&Dn().kind==='player'){const dch=s.public.characters[Dn().playerId];const amt=fl(dch.gold*h.stealGoldOnHitBp/10000);if(amt>0){s=setChar(s,Dn().playerId,{...dch,gold:dch.gold-amt});ev.effects.push('steal-gold:'+amt);}}
   if(h.stealItemOnHit>0&&Dn().kind==='player'){const pid=Dn().playerId;const bag=[...s.private[pid].bag];if(bag.length>0){const i=ctx.int(0,bag.length-1);const [it]=bag.splice(i,1);s=setPriv(s,pid,{...s.private[pid],bag});ev.effects.push('steal-item:'+it);post.push({v:V,type:'BagUpdated',visibility:{kind:'players',ids:[pid]},playerId:pid,bag});}}}
  const hp=hpPair(s);if(hp[0]===0&&hp[1]===0)ended={outcome:'draw',winner:null,fled:null};else if(hp[ai]===0)ended={outcome:'ko',winner:di,fled:null};else if(hp[di]===0)ended={outcome:'ko',winner:ai,fled:null};}
 ev.hp=hpPair(s);
events.push(ev,...post);
 if(ended)return {s:endCombat(s,ended,events,R),done:true};
 return advance(s,ctx,R,events);}
function advance(s,ctx,R,events){const c=s.public.combat;
 if(c.exchange===1){s=setCombat(s,{exchange:2});return {s,done:false};}
 const regen=[0,0],poison=[0,0];
 for(const i of [0,1]){const sn=snap(R,s,s.public.combat.sides[i]);let hp=sn.hp;if(hp===0)continue;
  if(sn.mods.poison){const p=Math.max(1,fl(sn.maxHp*R.combat.poisonBp/10000));const nh=Math.max(1,hp-p);poison[i]=hp-nh;hp=nh;}
  if(sn.h.roundRegenBp>0){const g=Math.min(sn.maxHp-hp,fl(sn.maxHp*sn.h.roundRegenBp/10000));regen[i]=g;hp+=g;}
  s=setHp(s,i,hp);}
 events.push({v:V,type:'RoundEnded',visibility:{kind:'public'},combatId:c.id,round:c.round,poison,regen,hp:hpPair(s)});
 if(c.round>=R.combat.maxRounds)return {s:endCombat(s,{outcome:'draw',winner:null,fled:null},events,R),done:true};
 const r=startRoundNoOpen(s,c.round+1,ctx,R,events);return {s:r,done:false};}
function startRoundNoOpen(s,round,ctx,R,events){const first=initiative(s,ctx,R);s=setCombat(s,{round,exchange:1,first});
 events.push({v:V,type:'RoundStarted',visibility:{kind:'public'},combatId:s.public.combat.id,round,first});return s;}
export let rewardsEnabled=true;
function endCombat(s,{outcome,winner,fled},events,R){const c=s.public.combat;
 events.push({v:V,type:'CombatEnded',visibility:{kind:'public'},combatId:c.id,outcome,winner,fled,hp:hpPair(s)});
 const sides=c.sides;s={...s,public:{...s.public,combat:null}};
 if(rewardsEnabled&&outcome==='ko'){const W=sides[winner],L=sides[1-winner];if(W.kind==='player')s=reward(s,W.playerId,L,R,events);}
 return s;}
function reward(s,pid,L,R,events){let xp,gold;
 if(L.kind==='player'){xp=R.combat.pvpXpPerLevel*s.public.characters[L.playerId].level;gold=0;}
 else{const ref=L.npc;const d=npcDef(R,ref);
  if(ref.kind==='monster'){const m=ref.senior?R.combat.seniorRewardBp:10000;xp=fl(d.xp*m/10000);gold=fl(d.gold*m/10000);}
  else if(ref.kind==='guardian'){xp=d.xpPerTier*ref.townTier;gold=d.goldPerTier*ref.townTier;}
  else{xp=d.xpPerLevel*ref.level;gold=d.goldPerLevel*ref.level;}}
 let ch=s.public.characters[pid];const oldMax=sheetStats(R,ch).hp;const oldLevel=ch.level;const cls=ch.classId;const oldRank=rankFor(R,ch.mastery[cls]);
 const unlockedBefore=hybridsUnlocked(R,ch.mastery);
 const nxp=addSat(ch.xp,xp);const nlevel=levelFor(R,nxp);const wins=addSat(ch.mastery[cls],1);
 ch={...ch,xp:nxp,level:nlevel,gold:addSat(ch.gold,gold),mastery:{...ch.mastery,[cls]:wins}};
 const newMax=sheetStats(R,ch).hp;ch={...ch,hp:adjustHp(oldMax,newMax,ch.hp)};
 s=setChar(s,pid,ch);
 events.push({v:V,type:'VictoryRewarded',visibility:{kind:'public'},playerId:pid,xp,gold,classId:cls,masteryWins:wins});
 for(let L=oldLevel+1;L<=nlevel;L++)events.push({v:V,type:'LevelUp',visibility:{kind:'public'},playerId:pid,level:L});
 const nr=rankFor(R,wins);if(nr>oldRank)events.push({v:V,type:'MasteryRankUp',visibility:{kind:'public'},playerId:pid,classId:cls,rank:nr});
 for(const h of hybridsUnlocked(R,ch.mastery))if(!unlockedBefore.includes(h))events.push({v:V,type:'HybridUnlocked',visibility:{kind:'public'},playerId:pid,classId:h});
 return s;}
export const adjustHp=(oldMax,newMax,hp)=>hp===0?0:Math.min(newMax,hp+Math.max(0,newMax-oldMax));
export function hybridsUnlocked(R,mastery){return Object.keys(R.classes).sort().filter(c=>{const d=R.classes[c];return d.kind==='hybrid'&&d.parents.every(p=>rankFor(R,mastery[p])>=R.progression.hybridUnlockRank);});}
// ---------------- reduce (reference: assumes well-formed actions for goldens; validation minimal)
function mkctx(rng){const ctx={rng,int(min,max){const [v,n]=nextInt(ctx.rng,min,max);ctx.rng=n;return v;}};return ctx;}
export function reduce(s,a,R){const ctx=mkctx(s.hidden.rng);const events=[];let n;
 const fail=(code)=>({ok:false,error:{code}});
 switch(a.type){
 case 'decision/open':{if(s.public.phase!=='turn')return fail('WRONG_PHASE');n=openDecision(s,'poll',a.prompts,events);break;}
 case 'decision/commit':{if(s.public.phase!=='decision')return fail('WRONG_PHASE');const pend=s.public.pending;if(!pend.required.includes(a.playerId))return fail('WRONG_ACTOR');
  if(pend.id!==a.decisionId)return fail('STALE_DECISION');if(pend.committed.includes(a.playerId))return fail('ALREADY_COMMITTED');
  if(!s.private[a.playerId].prompt.options.includes(a.choice))return fail('INVALID_PAYLOAD');
  const committed=[...pend.committed,a.playerId];n={...s,public:{...s.public,pending:{...pend,committed}},hidden:{...s.hidden,decision:{...s.hidden.decision,choices:{...s.hidden.decision.choices,[a.playerId]:a.choice}}}};
  events.push({v:V,type:'ChoiceCommitted',visibility:{kind:'public'},decisionId:pend.id,playerId:a.playerId});
  if(pend.required.every(p=>committed.includes(p)))n=reveal(n,[],events,ctx,R);break;}
 case 'timeout':{if(s.public.phase!=='decision')return fail('WRONG_PHASE');const pend=s.public.pending;const to=pend.required.filter(p=>!pend.committed.includes(p));
  for(const p of to)events.push({v:V,type:'ChoiceTimedOut',visibility:{kind:'public'},decisionId:pend.id,playerId:p});n=reveal(s,to,events,ctx,R);break;}
 case 'combat/start':{if(s.public.phase!=='turn')return fail('WRONG_PHASE');const seq=s.hidden.combatSeq+1;const id='c'+seq;const o=a.opponent;let side1;
  if(o.kind==='player')side1={kind:'player',playerId:o.playerId,mods:ZERO_MODS()};
  else{const ref=o.kind==='npc'?o.npc:o.kind==='monster'?{kind:'monster',id:o.monsterId,senior:o.senior}:o.kind==='guardian'?{kind:'guardian',id:o.guardianId,townTier:o.townTier}:{kind:'enforcer',level:o.level};
   const st=npcStats(R,ref);side1={kind:'npc',npc:ref,stats:st,hp:st.hp,mods:ZERO_MODS()};}
  n={...s,public:{...s.public,combat:{id,round:1,exchange:1,first:0,sides:[{kind:'player',playerId:a.attacker,mods:ZERO_MODS()},side1]}},hidden:{...s.hidden,combatSeq:seq}};
  events.push({v:V,type:'CombatStarted',visibility:{kind:'public'},combatId:id,sides:n.public.combat.sides});
  n=startRound(n,1,ctx,R,events);break;}
 case 'system/setCharacter':{const ch0=s.public.characters[a.target];let ch={...ch0,classId:a.classId,level:a.level,xp:R.progression.xpCurve[a.level-1],weapon:a.weapon,shield:a.shield,accessory:a.accessory,battleSpell:a.battleSpell,wardSpell:a.wardSpell};
  ch={...ch,hp:sheetStats(R,ch).hp};n=setChar(s,a.target,ch);n=setPriv(n,a.target,{...n.private[a.target],bag:[...a.bag]});
  events.push({v:V,type:'CharacterSet',visibility:{kind:'public'},playerId:a.target,classId:a.classId,level:a.level,hp:ch.hp});
  events.push({v:V,type:'BagUpdated',visibility:{kind:'players',ids:[a.target]},playerId:a.target,bag:[...a.bag]});break;}

 case 'system/grant':{const g=a.grant;const t=a.target;let ch=s.public.characters[t];const pv=s.private[t];const oldMax=sheetStats(R,ch).hp;
  const pub=(g.kind==='item'||g.kind==='scroll')?{kind:'players',ids:[t]}:{kind:'public'};
  events.push({v:V,type:'Granted',visibility:pub,playerId:t,grant:g});n=s;
  if(g.kind==='item'){if(pv.bag.length>=R.classes[ch.classId].bagSize)return fail('INVALID_PAYLOAD');const bag=[...pv.bag,g.id];n=setPriv(n,t,{...pv,bag});events.push({v:V,type:'BagUpdated',visibility:{kind:'players',ids:[t]},playerId:t,bag});}
  else if(g.kind==='scroll'){if(pv.scrolls.length>=R.economy.maxScrolls)return fail('INVALID_PAYLOAD');const scrolls=[...pv.scrolls,g.id];n=setPriv(n,t,{...pv,scrolls});events.push({v:V,type:'ScrollsUpdated',visibility:{kind:'players',ids:[t]},playerId:t,scrolls});}
  else {if(g.kind==='gear')ch={...ch,[R.gear[g.id].slot]:g.id};else if(g.kind==='battleSpell')ch={...ch,battleSpell:g.id};else if(g.kind==='wardSpell')ch={...ch,wardSpell:g.id};
   else if(g.kind==='gold'){if(ch.gold>MAX_COUNTER-g.amount)return fail('INVALID_PAYLOAD');ch={...ch,gold:ch.gold+g.amount};}
   else if(g.kind==='xp'){if(ch.xp>MAX_COUNTER-g.amount)return fail('INVALID_PAYLOAD');const xp=ch.xp+g.amount;const lv=levelFor(R,xp);for(let L=ch.level+1;L<=lv;L++)events.push({v:V,type:'LevelUp',visibility:{kind:'public'},playerId:t,level:L});ch={...ch,xp,level:lv};}
   ch={...ch,hp:adjustHp(oldMax,sheetStats(R,ch).hp,ch.hp)};n=setChar(n,t,ch);}
  break;}
 case 'loadout/discard':{const pv=s.private[a.playerId];const i=pv.bag.indexOf(a.itemId);if(i<0)return fail('INVALID_PAYLOAD');const bag=[...pv.bag];bag.splice(i,1);n=setPriv(s,a.playerId,{...pv,bag});
  events.push({v:V,type:'BagUpdated',visibility:{kind:'players',ids:[a.playerId]},playerId:a.playerId,bag});break;}
 case 'loadout/switchClass':{const p=a.playerId;let ch=s.public.characters[p];const pv=s.private[p];const cls=own(R.classes,a.classId);
  if(!cls||a.classId===ch.classId)return fail('INVALID_PAYLOAD');
  if(cls.kind==='hybrid'&&!hybridsUnlocked(R,ch.mastery).includes(a.classId))return fail('INVALID_PAYLOAD');
  if(ch.gold<cls.switchFee)return fail('INVALID_PAYLOAD');
  const over=Math.max(0,pv.bag.length-cls.bagSize);if(a.discard.length!==over)return fail('INVALID_PAYLOAD');
  const bag=[...pv.bag];for(const d of a.discard){const i=bag.indexOf(d);if(i<0)return fail('INVALID_PAYLOAD');bag.splice(i,1);}
  const oldMax=sheetStats(R,ch).hp;const from=ch.classId;ch={...ch,classId:a.classId,gold:ch.gold-cls.switchFee};ch={...ch,hp:adjustHp(oldMax,sheetStats(R,ch).hp,ch.hp)};
  n=setChar(s,p,ch);events.push({v:V,type:'ClassSwitched',visibility:{kind:'public'},playerId:p,from,to:a.classId,fee:cls.switchFee,hp:ch.hp});
  if(a.discard.length>0){n=setPriv(n,p,{...pv,bag});events.push({v:V,type:'BagUpdated',visibility:{kind:'players',ids:[p]},playerId:p,bag});}
  break;}

 case 'loadout/useItem':{const p=a.playerId;const pv=s.private[p];const i=pv.bag.indexOf(a.itemId);if(i<0)return fail('INVALID_PAYLOAD');const it=R.items[a.itemId];if(!(it.use==='both'&&it.effect.kind==='heal'))return fail('INVALID_PAYLOAD');
  let ch=s.public.characters[p];if(ch.hp===0)return fail('INVALID_PAYLOAD');const max=sheetStats(R,ch).hp;const healed=Math.min(max-ch.hp,fl(max*it.effect.bp/10000));ch={...ch,hp:ch.hp+healed};
  const bag=[...pv.bag];bag.splice(i,1);n=setChar(s,p,ch);n=setPriv(n,p,{...pv,bag});events.push({v:V,type:'ItemUsed',visibility:{kind:'public'},playerId:p,itemId:a.itemId,healed,hp:ch.hp});events.push({v:V,type:'BagUpdated',visibility:{kind:'players',ids:[p]},playerId:p,bag});break;}
 default: return fail('UNKNOWN_ACTION');}
 return {ok:true,state:{...n,hidden:{...n.hidden,rng:ctx.rng}},events};}
export function viewFor(s,viewer){const self=s.public.players.includes(viewer)?s.private[viewer]:null;
 const others={};for(const p of s.public.players)others[p]={bagCount:s.private[p].bag.length,scrollCount:s.private[p].scrolls.length};
 return {v:V,viewer,public:s.public,self,counts:others};}
