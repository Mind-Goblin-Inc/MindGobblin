import { generateWorldMapState } from './worldGen.js';

const a = generateWorldMapState({ seed: 'map-seed', size: 'standard', climatePreset: 'temperate', genVersion: 1 });
const b = generateWorldMapState({ seed: 'map-seed', size: 'standard', climatePreset: 'temperate', genVersion: 1 });
const c = generateWorldMapState({ seed: 'map-seed-different', size: 'standard', climatePreset: 'temperate', genVersion: 1 });

if (a.worldHash !== b.worldHash) {
  throw new Error('World determinism test failed: identical seed/params produced different hash.');
}

if (a.worldHash === c.worldHash) {
  throw new Error('World variance test failed: different seed produced identical hash.');
}

if (!a.player.startingSiteId || !a.sitesById[a.player.startingSiteId]) {
  throw new Error('World validity test failed: startingSiteId is invalid.');
}

console.log('worldGen deterministic hash tests passed');
