import { createGoblin } from './goblinFactory.js';
import { initRng } from './rng.js';

function snapshot(seed) {
  const rng = initRng(seed);
  return createGoblin({ id: 'g-test', rng, tick: 0 });
}

const a = snapshot('deterministic');
const b = snapshot('deterministic');
const c = snapshot('deterministic-alt');

if (JSON.stringify(a) !== JSON.stringify(b)) {
  throw new Error('Determinism test failed: same seed produced different goblin.');
}

if (JSON.stringify(a) === JSON.stringify(c)) {
  throw new Error('Seed variance test failed: different seed produced identical goblin.');
}

console.log('goblinFactory deterministic seed tests passed');
