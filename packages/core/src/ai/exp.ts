// Engine-independent exp(x) for x <= 0. Only IEEE-754 + - * / and Math.round (all exactly
// specified by ECMAScript) are used, so every AI weight is identical on every conforming engine.
const LN2 = 0.6931471805599453;
const UNDERFLOW = -700;
const TERMS = 13;

export function expNeg(x: number): number {
  if (!(x <= 0)) throw new RangeError(`expNeg: x must be <= 0, got ${String(x)}`);
  if (x < UNDERFLOW) return 0;
  const k = Math.round(x / LN2);
  const r = x - k * LN2;
  let p = 1;
  for (let i = TERMS; i >= 1; i--) p = 1 + (r * p) / i;
  for (let j = 0; j < -k; j++) p = p * 0.5;
  return p;
}
