/** sfc32 state: four unsigned 32-bit words. Plain JSON, lives in `state.hidden.rng`. */
export type RngState = readonly [number, number, number, number];

const U32 = 2 ** 32;

/** An all-zero sfc32 state is degenerate; replace it with a fixed non-zero state. */
export function normalizeSeedState(state: RngState): RngState {
  return state.every((word) => word === 0) ? [1, 0, 0, 0] : state;
}

/** bryc cyrb128 over UTF-16 code units, transcribed from the reference in the phase spec. */
export function seedRng(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return normalizeSeedState([h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]);
}

/** One bryc sfc32 step. Returns the output word and the next state; never mutates `rng`. */
export function nextU32(rng: RngState): [number, RngState] {
  let [a, b, c, d] = rng;
  let t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  return [t >>> 0, [a >>> 0, b >>> 0, c >>> 0, d >>> 0]];
}

/** Unbiased integer in [min, max] (inclusive) by rejection sampling. */
export function nextInt(rng: RngState, min: number, max: number): [number, RngState] {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new RangeError(`nextInt: invalid range [${String(min)}, ${String(max)}]`);
  }
  const span = max - min + 1;
  if (span > U32) {
    throw new RangeError(`nextInt: span ${span} exceeds 2**32`);
  }
  const limit = U32 - (U32 % span);
  let state = rng;
  for (;;) {
    const [u, next] = nextU32(state);
    state = next;
    if (u < limit) {
      return [min + (u % span), state];
    }
  }
}
