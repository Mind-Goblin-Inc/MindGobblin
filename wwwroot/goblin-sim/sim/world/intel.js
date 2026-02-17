function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function buildInitialIntel({ regionGrid, sitesById, startingSiteId }) {
  const knownRegions = {};
  const knownSites = {};

  const start = sitesById[startingSiteId];
  if (!start) return { knownRegions, knownSites };

  for (const [siteId, site] of Object.entries(sitesById)) {
    const dx = site.x - start.x;
    const dy = site.y - start.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    knownSites[siteId] = { confidence: clamp01(1 - d / 20), lastUpdatedTick: 0 };
  }

  for (let y = 0; y < regionGrid.length; y += 1) {
    for (let x = 0; x < regionGrid[y].length; x += 1) {
      const regionId = regionGrid[y][x];
      const dx = x - start.x;
      const dy = y - start.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      knownRegions[regionId] = { confidence: clamp01(1 - d / 28), lastUpdatedTick: 0 };
    }
  }

  return { knownRegions, knownSites };
}

export function decayIntel(worldMapState, currentTick) {
  if (currentTick % 7 !== 0) return;

  for (const record of Object.values(worldMapState.intel.knownRegions)) {
    record.confidence = clamp01(record.confidence - 0.01);
  }
  for (const record of Object.values(worldMapState.intel.knownSites)) {
    record.confidence = clamp01(record.confidence - 0.008);
  }
}

export function applyScoutUpdate(worldMapState, regionId, siteId, currentTick) {
  if (regionId && worldMapState.intel.knownRegions[regionId]) {
    worldMapState.intel.knownRegions[regionId].confidence = 1;
    worldMapState.intel.knownRegions[regionId].lastUpdatedTick = currentTick;
  }
  if (siteId && worldMapState.intel.knownSites[siteId]) {
    worldMapState.intel.knownSites[siteId].confidence = 1;
    worldMapState.intel.knownSites[siteId].lastUpdatedTick = currentTick;
  }
}
