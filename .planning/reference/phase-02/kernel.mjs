export function seedRng(str){let h1=1779033703,h2=3144134277,h3=1013904242,h4=2773480762;
for(let i=0,k;i<str.length;i++){k=str.charCodeAt(i);h1=h2^Math.imul(h1^k,597399067);h2=h3^Math.imul(h2^k,2869860233);h3=h4^Math.imul(h3^k,951274213);h4=h1^Math.imul(h4^k,2716044179);}
h1=Math.imul(h3^(h1>>>18),597399067);h2=Math.imul(h4^(h2>>>22),2869860233);h3=Math.imul(h1^(h3>>>17),951274213);h4=Math.imul(h2^(h4>>>19),2716044179);
h1^=(h2^h3^h4);h2^=h1;h3^=h1;h4^=h1;const s=[h1>>>0,h2>>>0,h3>>>0,h4>>>0];return s.every(w=>w===0)?[1,0,0,0]:s;}
export function nextU32(r){let [a,b,c,d]=r;let t=(a+b)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);d=(d+1)|0;t=(t+d)|0;c=(c+t)|0;return [t>>>0,[a>>>0,b>>>0,c>>>0,d>>>0]];}
export function nextInt(r,min,max){const span=max-min+1,U=2**32;if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min>max||span>U)throw new RangeError('bad');const limit=U-(U%span);let s=r;for(;;){const [u,n]=nextU32(s);s=n;if(u<limit)return [min+(u%span),s];}}
function write(v){if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v);
if(typeof v==='number'){if(!Number.isFinite(v))throw new TypeError('nf');return JSON.stringify(v);}
if(Array.isArray(v))return '['+v.map(write).join(',')+']';
if(typeof v==='object'){return '{'+Object.keys(v).sort((a,b)=>a<b?-1:a>b?1:0).map(k=>{if(v[k]===undefined)throw new TypeError('undef '+k);return JSON.stringify(k)+':'+write(v[k])}).join(',')+'}';}
throw new TypeError('bad '+typeof v);}
export const stableStringify=write;
export function fnv1a32(t){let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');}
export const hashState=s=>fnv1a32(stableStringify(s));
export const rulesHash=r=>fnv1a32(stableStringify(r));
