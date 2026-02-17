function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function hash() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function initRng(seedText) {
  const seed = xmur3(seedText)();
  return { state: seed || 1 };
}

export function nextU32(rng) {
  let x = rng.state | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  rng.state = x >>> 0;
  return rng.state;
}

export function randFloat(rng) {
  return nextU32(rng) / 0xffffffff;
}

export function randInt(rng, min, maxInclusive) {
  const span = maxInclusive - min + 1;
  return min + Math.floor(randFloat(rng) * span);
}

export function randChoice(rng, list) {
  if (!list.length) return undefined;
  return list[randInt(rng, 0, list.length - 1)];
}

export function randWeighted(rng, weighted) {
  let total = 0;
  for (const entry of weighted) total += entry.weight;
  if (total <= 0) return weighted[0]?.value;
  let roll = randFloat(rng) * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }
  return weighted[weighted.length - 1]?.value;
}
