import { initRng, randInt } from "../rng.js";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fade(t) {
  // Improved Perlin fade curve.
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function grad(hash, x, y) {
  // 8 directional gradients.
  switch (hash & 7) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}

export function createPerlin2D(seedText) {
  const rng = initRng(`${seedText}|perlin2d`);
  const p = new Uint8Array(512);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) perm[i] = i;

  // Fisher-Yates
  for (let i = 255; i > 0; i -= 1) {
    const j = randInt(rng, 0, i);
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }

  for (let i = 0; i < 512; i += 1) p[i] = perm[i & 255];

  return function perlin2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = fade(xf);
    const v = fade(yf);

    const aa = p[p[xi] + yi];
    const ab = p[p[xi] + yi + 1];
    const ba = p[p[xi + 1] + yi];
    const bb = p[p[xi + 1] + yi + 1];

    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    const n = lerp(x1, x2, v);

    // Normalize approximately to 0..1
    return (n + 1) * 0.5;
  };
}

export function fbm2D(noise2D, x, y, octaves = 4, gain = 0.5, lacunarity = 2) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;

  for (let i = 0; i < octaves; i += 1) {
    sum += noise2D(x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }

  if (norm <= 0) return 0.5;
  return sum / norm;
}

