import {RULES as R} from './content-rules.mjs';
import {duel} from './sim.mjs';
const n=+process.argv[2]||400;const level=+process.argv[3]||5;
const t0=Date.now();
for(const cls of Object.keys(R.classes)){let hw=0,ew=0,dr=0,fl=0;
 for(let i=0;i<n;i++){const hardA=i%2===0;const r=duel(R,`gate/${cls}/${i}`,{kind:'class',id:cls},{kind:'class',id:cls},hardA?'hard':'easy',hardA?'easy':'hard',level);
  const e=r.end;if(e.outcome==='ko'){const hardSide=hardA?0:1;if(e.winner===hardSide)hw++;else ew++;}else if(e.outcome==='draw')dr++;else fl++;}
 console.log(cls,'hardWins',hw,'easyWins',ew,'draws',dr,'fled',fl,'decisiveRate',((hw+ew)/n).toFixed(3),'hardRate',(hw/(hw+ew)).toFixed(3));}
console.error('ms',Date.now()-t0);
