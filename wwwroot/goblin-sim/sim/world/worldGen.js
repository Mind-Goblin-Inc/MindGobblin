import { generateRegions } from "./regionGen.js";
import { generateSites } from "./siteGen.js";
import { generateRoutes } from "./routeGen.js";
import { buildOverlays } from "./overlays.js";
import { buildInitialIntel } from "./intel.js";
import { randFloat, initRng } from "../rng.js";
import { TILES_PER_CHUNK, tileKey } from "./scale.js";

function worldSizeToDims(size) {
  const scale = 3;
  if (size === "small") return { width: 42 * scale, height: 28 * scale };
  if (size === "large") return { width: 72 * scale, height: 44 * scale };
  return { width: 56 * scale, height: 34 * scale };
}

function hashText(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function scoreStartSite(site, routesCount, region) {
  const resources = site.strategic.resourceNearby * 0.38;
  const safety = (100 - site.strategic.hazardNearby) * 0.34;
  const logistics = routesCount * 12;
  const politics = (100 - site.hostilityBaseline * 100) * 0.18;
  const biomeBonus = (region.biome === "forest" || region.biome === "hills") ? 6 : 0;
  return Math.round(resources + safety + logistics + politics + biomeBonus);
}

function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function buildWaterTiles({ seed, regionsById, regionGrid, width, height }) {
  const rng = initRng(`${seed}|waterTiles`);
  const byTileKey = {};
  const allKeys = [];

  function addTile(x, y, waterKind) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const key = `${x},${y}`;
    const regionId = regionGrid[y][x];
    if (!regionId) return;
    if (!byTileKey[key]) {
      byTileKey[key] = { key, tileX: x, tileY: y, regionId, waterKind };
      allKeys.push(key);
      return;
    }
    // Prefer lake marker if a tile belongs to both.
    if (waterKind === "lake") byTileKey[key].waterKind = "lake";
  }

  // Base moisture/swamp water tiles.
  for (const r of Object.values(regionsById)) {
    const wet = r.biome === "swamp" || r.moisture > 0.74;
    if (!wet) continue;
    addTile(r.x, r.y, "lake");
    // Slightly thicken naturally wet regions.
    if (randFloat(rng) < 0.45) addTile(r.x + 1, r.y, "lake");
    if (randFloat(rng) < 0.45) addTile(r.x - 1, r.y, "lake");
    if (randFloat(rng) < 0.35) addTile(r.x, r.y + 1, "lake");
    if (randFloat(rng) < 0.35) addTile(r.x, r.y - 1, "lake");
  }

  // Explicit lake clusters with weighted random placement and irregular satellites.
  const lakeCandidates = Object.values(regionsById)
    .filter((r) => r.moisture > 0.52 || r.biome === "swamp");
  const lakeCountBase = Math.max(4, Math.round((width * height) / 220));
  const lakeCount = Math.max(3, lakeCountBase + Math.floor(randFloat(rng) * 4) - 1);
  const chosenCenters = [];

  function pickWeightedLakeCenter(candidates) {
    let total = 0;
    const weights = candidates.map((c) => {
      const w = 0.12 + c.moisture * 0.8 + (c.biome === "swamp" ? 0.55 : 0);
      total += w;
      return w;
    });
    if (total <= 0) return null;
    let roll = randFloat(rng) * total;
    for (let i = 0; i < candidates.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1] || null;
  }

  function paintLakeBlob(cx, cy, rx, ry, roughness = 0.3) {
    for (let y = cy - ry - 1; y <= cy + ry + 1; y += 1) {
      for (let x = cx - rx - 1; x <= cx + rx + 1; x += 1) {
        const dx = (x - cx) / Math.max(1, rx);
        const dy = (y - cy) / Math.max(1, ry);
        const d = dx * dx + dy * dy;
        if (d <= 1.08 + randFloat(rng) * roughness) addTile(x, y, "lake");
      }
    }
  }

  for (let i = 0; i < lakeCount && lakeCandidates.length > 0; i += 1) {
    const c = pickWeightedLakeCenter(lakeCandidates);
    if (!c) break;

    // Keep center spacing loose so we form more natural spread.
    const tooNear = chosenCenters.some((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < 5);
    if (!tooNear || randFloat(rng) < 0.25) chosenCenters.push({ x: c.x, y: c.y });

    const rx = 1 + Math.floor(randFloat(rng) * 4); // 1..4
    const ry = 1 + Math.floor(randFloat(rng) * 4); // 1..4
    paintLakeBlob(c.x, c.y, rx, ry, 0.36);

    // 0-2 satellite blobs for less uniform oval lakes.
    const satellites = Math.floor(randFloat(rng) * 3);
    for (let s = 0; s < satellites; s += 1) {
      const ox = Math.floor(randFloat(rng) * (rx * 2 + 3)) - (rx + 1);
      const oy = Math.floor(randFloat(rng) * (ry * 2 + 3)) - (ry + 1);
      const srx = Math.max(1, rx - 1 + Math.floor(randFloat(rng) * 2));
      const sry = Math.max(1, ry - 1 + Math.floor(randFloat(rng) * 2));
      paintLakeBlob(c.x + ox, c.y + oy, srx, sry, 0.42);
    }
  }

  // River paths.
  const starts = Object.values(regionsById)
    .filter((r) => r.y < Math.floor(height * 0.45) && (r.moisture > 0.5 || r.elevation > 0.58))
    .sort((a, b) => (b.moisture + b.elevation * 0.6) - (a.moisture + a.elevation * 0.6));
  const riverCount = Math.max(7, Math.round(width / 5)); // many rivers

  const dirs = [
    [0, 1], [1, 0], [-1, 0], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1]
  ];
  for (let i = 0; i < starts.length && i < riverCount; i += 1) {
    const start = starts[i];
    const visited = new Set();
    let cx = start.x;
    let cy = start.y;
    const maxSteps = width + height + Math.floor(randFloat(rng) * (width * 0.5));

    for (let step = 0; step < maxSteps; step += 1) {
      const key = `${cx},${cy}`;
      if (visited.has(key)) break;
      visited.add(key);

      addTile(cx, cy, "river");
      // widen rivers as they flow down map.
      if (step > 10 && randFloat(rng) < 0.45) addTile(cx + 1, cy, "river");
      if (step > 10 && randFloat(rng) < 0.45) addTile(cx - 1, cy, "river");
      if (step > 20 && randFloat(rng) < 0.28) addTile(cx, cy + 1, "river");

      if (cy >= height - 1) break;

      let best = null;
      let bestScore = Infinity;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const rid = regionGrid[ny][nx];
        const nr = regionsById[rid];
        if (!nr) continue;

        const downwardBias = (height - ny) / Math.max(1, height);
        const score =
          nr.elevation * 0.85 +
          (1 - nr.moisture) * 0.35 +
          downwardBias * 0.25 +
          (dy > 0 ? -0.08 : 0) +
          randFloat(rng) * 0.07;

        if (score < bestScore) {
          bestScore = score;
          best = { x: nx, y: ny };
        }
      }

      if (!best) break;
      cx = best.x;
      cy = best.y;
    }
  }

  return { byTileKey, allKeys };
}

function buildResourceNodes({ seed, regionsById, waterTiles }) {
  const rng = initRng(`${seed}|resourceNodes`);
  const byTileKey = {};
  const allKeys = [];
  const waterByTileKey = waterTiles?.byTileKey || {};

  for (const region of Object.values(regionsById)) {
    let type = null;
    let chance = 0;

    if (region.biome === "forest") {
      type = "tree";
      chance = 0.72;
    } else if (region.biome === "swamp") {
      type = randFloat(rng) < 0.55 ? "mushroom" : "tree";
      chance = 0.58;
    } else if (region.biome === "caves" || region.biome === "ruins") {
      type = "mushroom";
      chance = 0.46;
    } else if (region.biome === "hills") {
      type = "tree";
      chance = 0.32;
    }

    if (!type) continue;
    if (waterByTileKey[`${region.x},${region.y}`]) continue;

    for (let my = 0; my < TILES_PER_CHUNK; my += 1) {
      for (let mx = 0; mx < TILES_PER_CHUNK; mx += 1) {
        if (randFloat(rng) > chance * 0.34) continue;
        const microX = region.x * TILES_PER_CHUNK + mx;
        const microY = region.y * TILES_PER_CHUNK + my;
        const key = tileKey(microX, microY);
        byTileKey[key] = {
          key,
          microX,
          microY,
          tileX: region.x,
          tileY: region.y,
          regionId: region.id,
          type,
          readyAtTick: 0,
          regrowTicks: type === "tree" ? 34 : 22
        };
        allKeys.push(key);
      }
    }
  }

  return { byTileKey, allKeys };
}

function buildWildlifeSpawners({ regionsById, waterSources, width, height }) {
  const fishByWaterRegion = {};
  for (const source of Object.values(waterSources.byTileKey || {})) {
    fishByWaterRegion[source.regionId] = (fishByWaterRegion[source.regionId] || 0) + 1;
  }

  const deerByBiomeRegion = {};
  const wolfByBiomeRegion = {};
  for (const region of Object.values(regionsById)) {
    if (region.biome === "forest" || region.biome === "hills") deerByBiomeRegion[region.id] = 1;
    if (region.biome === "forest" || region.biome === "hills" || region.biome === "badlands") wolfByBiomeRegion[region.id] = 1;
  }

  return {
    fishByWaterRegion,
    deerByBiomeRegion,
    wolfByBiomeRegion,
    barbarianEdgePressure: Math.max(1, Math.round((width + height) / 30))
  };
}

function buildInitialWildlife({ seed, width, height, regionsById, waterSources }) {
  const rng = initRng(`${seed}|wildlife-v1`);
  const maxMicroX = width * TILES_PER_CHUNK - 1;
  const maxMicroY = height * TILES_PER_CHUNK - 1;

  const byId = {};
  const allIds = [];
  const occupancyByMicroKey = {};
  const usedKeys = new Set();
  const packsById = {};
  const spawners = buildWildlifeSpawners({ regionsById, waterSources, width, height });

  function pushOccupancy(key, id) {
    if (!occupancyByMicroKey[key]) occupancyByMicroKey[key] = [];
    occupancyByMicroKey[key].push(id);
  }

  function spawnCreature({ kind, disposition, microX, microY, homeRadius = 6, packId = undefined, aiState = "idle" }) {
    const key = tileKey(microX, microY);
    if (usedKeys.has(key)) return null;
    usedKeys.add(key);
    const id = `wildlife-${kind}-${allIds.length + 1}`;
    const tileX = Math.floor(microX / TILES_PER_CHUNK);
    const tileY = Math.floor(microY / TILES_PER_CHUNK);
    byId[id] = {
      id,
      kind,
      disposition,
      microX,
      microY,
      tileX,
      tileY,
      homeMicroX: microX,
      homeMicroY: microY,
      homeRadius,
      alive: true,
      health: 100,
      stamina: 100,
      hunger: Math.floor(randFloat(rng) * 35),
      thirst: Math.floor(randFloat(rng) * 35),
      fear: Math.floor(randFloat(rng) * 25),
      aggression: Math.floor(randFloat(rng) * 25),
      packId,
      targetId: undefined,
      targetType: undefined,
      huntState: {
        mode: "patrol",
        targetGoblinId: undefined,
        lastKnownTargetTile: undefined,
        targetAcquiredTick: undefined,
        targetCommitUntilTick: undefined,
        breakoffUntilTick: undefined,
        retargetAfterTick: 0
      },
      aiState,
      lastDecisionTick: 0,
      lastActionTick: 0,
      spawnTick: 0
    };
    allIds.push(id);
    pushOccupancy(key, id);
    return id;
  }

  const waterKeys = Object.keys(waterSources.byTileKey || {});
  const fishCount = clamp(Math.floor(waterKeys.length / 80), 8, 56);
  for (let i = 0; i < fishCount && waterKeys.length > 0; i += 1) {
    const key = waterKeys[Math.floor(randFloat(rng) * waterKeys.length)];
    const source = waterSources.byTileKey[key];
    if (!source) continue;
    spawnCreature({
      kind: "fish",
      disposition: "passive",
      microX: source.microX,
      microY: source.microY,
      homeRadius: 8,
      aiState: "foraging"
    });
  }

  const deerRegions = Object.values(regionsById).filter((r) => r.biome === "forest" || r.biome === "hills");
  const deerCount = clamp(Math.floor((width * height) / 150), 6, 26);
  for (let i = 0; i < deerCount && deerRegions.length > 0; i += 1) {
    const region = deerRegions[Math.floor(randFloat(rng) * deerRegions.length)];
    let spawned = false;
    for (let tries = 0; tries < 6; tries += 1) {
      const microX = clamp(region.x * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroX);
      const microY = clamp(region.y * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroY);
      if (waterSources.byTileKey[tileKey(microX, microY)]) continue;
      const id = spawnCreature({
        kind: "deer",
        disposition: "skittish",
        microX,
        microY,
        homeRadius: 10,
        aiState: "foraging"
      });
      if (id) {
        spawned = true;
        break;
      }
    }
    if (!spawned) continue;
  }

  const wolfRegions = Object.values(regionsById).filter(
    (r) => r.biome === "forest" || r.biome === "hills" || r.biome === "badlands"
  );
  const wolfCount = clamp(Math.floor((width * height) / 700), 2, 7);
  const wolfPackId = "wild-pack-1";
  packsById[wolfPackId] = {
    id: wolfPackId,
    kind: "wolf-pack",
    memberIds: [],
    leaderId: null,
    targetSiteId: undefined,
    targetMicroX: undefined,
    targetMicroY: undefined,
    cohesion: 0.7
  };
  for (let i = 0; i < wolfCount && wolfRegions.length > 0; i += 1) {
    const region = wolfRegions[Math.floor(randFloat(rng) * wolfRegions.length)];
    const microX = clamp(region.x * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroX);
    const microY = clamp(region.y * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroY);
    if (waterSources.byTileKey[tileKey(microX, microY)]) continue;
    const wolfId = spawnCreature({
      kind: "wolf",
      disposition: "predator",
      microX,
      microY,
      homeRadius: 12,
      packId: wolfPackId,
      aiState: "hunting"
    });
    if (!wolfId) continue;
    packsById[wolfPackId].memberIds.push(wolfId);
  }
  packsById[wolfPackId].leaderId = packsById[wolfPackId].memberIds[0] || null;

  const barbarianBandId = "barbarian-band-1";
  packsById[barbarianBandId] = {
    id: barbarianBandId,
    kind: "barbarian-band",
    memberIds: [],
    leaderId: null,
    targetSiteId: undefined,
    targetMicroX: undefined,
    targetMicroY: undefined,
    cohesion: 0.8
  };
  const barbarianCount = clamp(Math.floor((width * height) / 520), 2, 8);
  for (let i = 0; i < barbarianCount; i += 1) {
    const edge = Math.floor(randFloat(rng) * 4);
    const microX = edge === 1 ? maxMicroX : edge === 3 ? 0 : Math.floor(randFloat(rng) * (maxMicroX + 1));
    const microY = edge === 0 ? 0 : edge === 2 ? maxMicroY : Math.floor(randFloat(rng) * (maxMicroY + 1));
    const barbarianId = spawnCreature({
      kind: "barbarian",
      disposition: "hostile",
      microX,
      microY,
      homeRadius: 14,
      packId: barbarianBandId,
      aiState: "raiding"
    });
    if (!barbarianId) continue;
    packsById[barbarianBandId].memberIds.push(barbarianId);
  }
  packsById[barbarianBandId].leaderId = packsById[barbarianBandId].memberIds[0] || null;

  return {
    byId,
    allIds,
    occupancyByMicroKey,
    packsById,
    spawners
  };
}

export function generateWorldMapState({ seed, size = "standard", climatePreset = "temperate", genVersion = 1 }) {
  const dims = worldSizeToDims(size);
  const { regionGrid, regionsById } = generateRegions({ seed, width: dims.width, height: dims.height, size });
  const { sitesById, siteIds } = generateSites({ seed, regionGrid, regionsById, size });
  const { routesById, adjacency } = generateRoutes({ seed, sitesById, siteIds, regionsById });
  const overlays = buildOverlays(regionsById);
  const waterTiles = buildWaterTiles({ seed, regionsById, regionGrid, width: dims.width, height: dims.height });
  const waterSources = {
    byTileKey: Object.fromEntries(
      Object.values(waterTiles.byTileKey).flatMap((tile) => {
        const out = [];
        for (let my = 0; my < TILES_PER_CHUNK; my += 1) {
          for (let mx = 0; mx < TILES_PER_CHUNK; mx += 1) {
            // Keep only half the micro cells as drink points to avoid over-saturation.
            if (((mx + my) & 1) !== 0) continue;
            const microX = tile.tileX * TILES_PER_CHUNK + mx;
            const microY = tile.tileY * TILES_PER_CHUNK + my;
            const key = tileKey(microX, microY);
            out.push([
              key,
              { key, microX, microY, tileX: tile.tileX, tileY: tile.tileY, regionId: tile.regionId }
            ]);
          }
        }
        return out;
      })
    )
  };
  const resourceNodes = buildResourceNodes({ seed, regionsById, waterTiles });
  const wildlife = buildInitialWildlife({
    seed,
    width: dims.width,
    height: dims.height,
    regionsById,
    waterSources
  });

  for (const siteId of siteIds) {
    const site = sitesById[siteId];
    site.strategic.centralityHint = adjacency[siteId]?.length || 0;
  }

  const drySiteIds = siteIds.filter((siteId) => {
    const site = sitesById[siteId];
    if (!site) return false;
    return !waterTiles.byTileKey?.[`${site.x},${site.y}`];
  });

  const candidatePool = drySiteIds.length ? drySiteIds : siteIds;
  const startCandidates = candidatePool
    .map((siteId) => {
      const site = sitesById[siteId];
      const region = regionsById[site.regionId];
      const score = scoreStartSite(site, adjacency[siteId]?.length || 0, region);
      return {
        siteId,
        score,
        breakdown: {
          resources: site.strategic.resourceNearby,
          safety: 100 - site.strategic.hazardNearby,
          logistics: (adjacency[siteId]?.length || 0) * 10,
          politics: Math.round((1 - site.hostilityBaseline) * 100)
        }
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const fallbackDrySiteId = drySiteIds[0] || null;
  const startingSiteId = startCandidates[0]?.siteId || fallbackDrySiteId || siteIds[0] || null;
  const intel = buildInitialIntel({ regionGrid, sitesById, startingSiteId });

  const worldHashPayload = JSON.stringify({
    seed,
    size,
    climatePreset,
    regionGrid,
    sitesById,
    routesById,
    waterTiles,
    wildlife
  });

  return {
    seed,
    genVersion,
    size,
    climatePreset,
    width: dims.width,
    height: dims.height,
    regionGrid,
    regionsById,
    sitesById,
    routesById,
    adjacency,
    overlays,
    intel,
    startCandidates,
    player: {
      selectedRegionId: startingSiteId ? sitesById[startingSiteId]?.regionId || null : null,
      selectedSiteId: startingSiteId,
      hoverRegionId: null,
      hoverSiteId: null,
      startingSiteId
    },
    camera: {
      x: 0,
      y: 0,
      zoom: 1,
      minZoom: 0.5,
      maxZoom: 8
    },
    render: {
      overlayMode: "biome",
      showDebugWildlife: true,
      showThreatOverlay: true,
      followTrackedGoblin: false,
      showLayers: {
        routes: true,
        water: true,
        resources: true,
        homes: true,
        walls: true,
        sites: true,
        goblins: true
      }
    },
    units: {
      byGoblinId: {}
    },
    structures: {
      wallsByTileKey: {},
      wallPlan: null
    },
    waterTiles,
    waterSources,
    wildlife,
    resourceNodes,
    worldHash: hashText(worldHashPayload)
  };
}
