import { generateRegions } from "./regionGen.js";
import { generateSites } from "./siteGen.js";
import { generateRoutes } from "./routeGen.js";
import { buildOverlays } from "./overlays.js";
import { buildInitialIntel } from "./intel.js";
import { randFloat, initRng } from "../rng.js";
import { TILES_PER_CHUNK, tileKey } from "./scale.js";
import { defaultRaceRuntimeConfigByKind } from "./raceRuntimeConfig.js";

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

  // Shoreline irregularity pass (lakes only): soften grid-like edges without breaking rivers.
  const riverKeys = new Set(
    Object.entries(byTileKey)
      .filter(([, v]) => v?.waterKind === "river")
      .map(([k]) => k)
  );
  const neighbor8 = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1]
  ];

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < width && y < height;
  }

  function lakeNeighborCount(x, y) {
    let count = 0;
    for (const [dx, dy] of neighbor8) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const k = `${nx},${ny}`;
      const cell = byTileKey[k];
      if (cell && cell.waterKind === "lake") count += 1;
    }
    return count;
  }

  for (let pass = 0; pass < 2; pass += 1) {
    const removeKeys = [];
    const addTiles = [];

    // Erode tiny corners/spikes and square artifacts.
    for (const [key, cell] of Object.entries(byTileKey)) {
      if (!cell || cell.waterKind !== "lake") continue;
      if (riverKeys.has(key)) continue;
      const x = cell.tileX;
      const y = cell.tileY;
      const n = lakeNeighborCount(x, y);
      if (n <= 2 && randFloat(rng) < 0.72) {
        removeKeys.push(key);
        continue;
      }
      if (n === 3 && randFloat(rng) < 0.34) {
        removeKeys.push(key);
      }
    }

    // Fill jagged inlets where lake mass already surrounds a tile.
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const key = `${x},${y}`;
        if (byTileKey[key]) continue;
        const n = lakeNeighborCount(x, y);
        if (n >= 6 && randFloat(rng) < 0.58) {
          addTiles.push({ x, y });
          continue;
        }
        if (n === 5 && randFloat(rng) < 0.28) {
          addTiles.push({ x, y });
        }
      }
    }

    for (const key of removeKeys) delete byTileKey[key];
    for (const tile of addTiles) addTile(tile.x, tile.y, "lake");
  }

  const finalKeys = Object.keys(byTileKey).sort((a, b) => {
    const [ax, ay] = a.split(",").map(Number);
    const [bx, by] = b.split(",").map(Number);
    if (ay !== by) return ay - by;
    return ax - bx;
  });
  return { byTileKey, allKeys: finalKeys };
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

function buildAdvancedResourceNodes({ seed, regionsById, waterTiles }) {
  const rng = initRng(`${seed}|advanced-resource-nodes`);
  const waterByTileKey = waterTiles?.byTileKey || {};
  const oreNodesByTileKey = {};
  const fiberNodesByTileKey = {};
  const herbNodesByTileKey = {};
  const salvageNodesByTileKey = {};

  function isNearWater(tileX, tileY) {
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        if (waterByTileKey[`${tileX + ox},${tileY + oy}`]) return true;
      }
    }
    return false;
  }

  function maybeCreateNode(store, prefix, region, chance, config) {
    if (randFloat(rng) > chance) return;
    const key = `${region.x},${region.y}`;
    if (store[key]) return;
    const capacity = config.minCapacity + Math.floor(randFloat(rng) * (config.maxCapacity - config.minCapacity + 1));
    store[key] = {
      id: `${prefix}-${region.id}`,
      key,
      tileX: region.x,
      tileY: region.y,
      regionId: region.id,
      kind: config.kind,
      capacity,
      remaining: capacity,
      regenPerDay: config.regenPerDay,
      danger: config.danger,
      lastHarvestTick: 0
    };
  }

  for (const region of Object.values(regionsById)) {
    const tileKeyId = `${region.x},${region.y}`;
    const onWater = Boolean(waterByTileKey[tileKeyId]);
    const nearWater = isNearWater(region.x, region.y);

    if (region.biome === "hills") {
      if (!onWater) {
        maybeCreateNode(oreNodesByTileKey, "ore", region, 0.36, {
          kind: "metal_ore",
          minCapacity: 14,
          maxCapacity: 26,
          regenPerDay: 0.35,
          danger: 0.38
        });
      }
      maybeCreateNode(herbNodesByTileKey, "herb", region, 0.06, {
        kind: "herbs",
        minCapacity: 4,
        maxCapacity: 9,
        regenPerDay: 0.18,
        danger: 0.2
      });
      continue;
    }

    if (region.biome === "caves") {
      if (!onWater) {
        maybeCreateNode(oreNodesByTileKey, "ore", region, 0.48, {
          kind: "metal_ore",
          minCapacity: 18,
          maxCapacity: 30,
          regenPerDay: 0.22,
          danger: 0.62
        });
      }
      continue;
    }

    if (region.biome === "ruins") {
      maybeCreateNode(salvageNodesByTileKey, "salvage", region, 0.32, {
        kind: "salvage",
        minCapacity: 8,
        maxCapacity: 18,
        regenPerDay: 0.08,
        danger: 0.55
      });
      if (!onWater) {
        maybeCreateNode(oreNodesByTileKey, "ore", region, 0.18, {
          kind: "metal_ore",
          minCapacity: 10,
          maxCapacity: 18,
          regenPerDay: 0.15,
          danger: 0.46
        });
      }
      continue;
    }

    if (region.biome === "swamp") {
      maybeCreateNode(fiberNodesByTileKey, "fiber", region, nearWater ? 0.55 : 0.36, {
        kind: "fiber",
        minCapacity: 10,
        maxCapacity: 22,
        regenPerDay: 0.75,
        danger: 0.34
      });
      maybeCreateNode(herbNodesByTileKey, "herb", region, 0.28, {
        kind: "herbs",
        minCapacity: 6,
        maxCapacity: 14,
        regenPerDay: 0.58,
        danger: 0.26
      });
      continue;
    }

    if (region.biome === "forest") {
      maybeCreateNode(fiberNodesByTileKey, "fiber", region, 0.18, {
        kind: "fiber",
        minCapacity: 7,
        maxCapacity: 14,
        regenPerDay: 0.52,
        danger: 0.16
      });
      maybeCreateNode(herbNodesByTileKey, "herb", region, 0.31, {
        kind: "herbs",
        minCapacity: 8,
        maxCapacity: 16,
        regenPerDay: 0.62,
        danger: 0.14
      });
      continue;
    }

    if (region.biome === "badlands") {
      if (!onWater) {
        maybeCreateNode(oreNodesByTileKey, "ore", region, 0.14, {
          kind: "metal_ore",
          minCapacity: 9,
          maxCapacity: 16,
          regenPerDay: 0.12,
          danger: 0.69
        });
      }
    }
  }

  return {
    oreNodesByTileKey,
    fiberNodesByTileKey,
    herbNodesByTileKey,
    salvageNodesByTileKey
  };
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

  const bearRegions = Object.values(regionsById).filter((r) => r.biome === "forest" || r.biome === "hills");
  const bearCount = clamp(Math.floor((width * height) / 2600), 1, 3);
  for (let i = 0; i < bearCount && bearRegions.length > 0; i += 1) {
    const region = bearRegions[Math.floor(randFloat(rng) * bearRegions.length)];
    const microX = clamp(region.x * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroX);
    const microY = clamp(region.y * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroY);
    if (waterSources.byTileKey[tileKey(microX, microY)]) continue;
    spawnCreature({
      kind: "bear",
      disposition: "territorial",
      microX,
      microY,
      homeRadius: 8,
      aiState: "territorial"
    });
  }

  const snakeRegions = Object.values(regionsById).filter((r) => r.biome === "swamp" || r.biome === "badlands");
  const snakeCount = clamp(Math.floor((width * height) / 1500), 2, 7);
  for (let i = 0; i < snakeCount && snakeRegions.length > 0; i += 1) {
    const region = snakeRegions[Math.floor(randFloat(rng) * snakeRegions.length)];
    const microX = clamp(region.x * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroX);
    const microY = clamp(region.y * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroY);
    if (waterSources.byTileKey[tileKey(microX, microY)]) continue;
    spawnCreature({
      kind: "snake",
      disposition: "ambush",
      microX,
      microY,
      homeRadius: 6,
      aiState: "hiding"
    });
  }

  const boarRegions = Object.values(regionsById).filter((r) => r.biome === "forest" || r.biome === "hills");
  const boarCount = clamp(Math.floor((width * height) / 1700), 2, 6);
  for (let i = 0; i < boarCount && boarRegions.length > 0; i += 1) {
    const region = boarRegions[Math.floor(randFloat(rng) * boarRegions.length)];
    const microX = clamp(region.x * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroX);
    const microY = clamp(region.y * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroY);
    if (waterSources.byTileKey[tileKey(microX, microY)]) continue;
    spawnCreature({
      kind: "boar",
      disposition: "defensive",
      microX,
      microY,
      homeRadius: 7,
      aiState: "grazing"
    });
  }

  const crowRegions = Object.values(regionsById).filter((r) => r.biome === "forest" || r.biome === "hills" || r.biome === "ruins");
  const crowCount = clamp(Math.floor((width * height) / 1200), 3, 9);
  for (let i = 0; i < crowCount && crowRegions.length > 0; i += 1) {
    const region = crowRegions[Math.floor(randFloat(rng) * crowRegions.length)];
    const microX = clamp(region.x * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroX);
    const microY = clamp(region.y * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroY);
    spawnCreature({
      kind: "crow",
      disposition: "nuisance",
      microX,
      microY,
      homeRadius: 10,
      aiState: "scouting"
    });
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

  const raiderRegions = Object.values(regionsById).filter(
    (r) => r.biome === "hills" || r.biome === "forest" || r.biome === "badlands"
  );
  const raiderCount = clamp(Math.floor((width * height) / 1400), 1, 4);
  const raiderPackId = "raider-band-1";
  packsById[raiderPackId] = {
    id: raiderPackId,
    kind: "raider-band",
    memberIds: [],
    leaderId: null,
    targetSiteId: undefined,
    targetMicroX: undefined,
    targetMicroY: undefined,
    cohesion: 0.75
  };
  for (let i = 0; i < raiderCount && raiderRegions.length > 0; i += 1) {
    const region = raiderRegions[Math.floor(randFloat(rng) * raiderRegions.length)];
    const microX = clamp(region.x * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroX);
    const microY = clamp(region.y * TILES_PER_CHUNK + Math.floor(randFloat(rng) * TILES_PER_CHUNK), 0, maxMicroY);
    if (waterSources.byTileKey[tileKey(microX, microY)]) continue;
    const raiderId = spawnCreature({
      kind: "human_raider",
      disposition: "hostile",
      microX,
      microY,
      homeRadius: 12,
      packId: raiderPackId,
      aiState: "harassing"
    });
    if (!raiderId) continue;
    packsById[raiderPackId].memberIds.push(raiderId);
  }
  packsById[raiderPackId].leaderId = packsById[raiderPackId].memberIds[0] || null;
  if (!packsById[raiderPackId].leaderId) delete packsById[raiderPackId];

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

function outpostDescriptorForPack(packKind, raceRuntimeConfigByKind) {
  const raceKind = packKind === "barbarian-band"
    ? "barbarian"
    : packKind === "wolf-pack"
      ? "wolf"
      : packKind === "raider-band"
        ? "human_raider"
        : packKind === "ogre-warband"
          ? "ogre"
          : packKind === "ritual-coven"
            ? "shaman"
            : packKind === "watch-band"
              ? "elf_ranger"
        : null;
  if (!raceKind) return null;
  const cfg = raceRuntimeConfigByKind?.[raceKind]?.outpostPolicy;
  if (!cfg || cfg.enabled === false) return null;
  const defaultOutpostKind = raceKind === "barbarian"
    ? "warcamp"
    : raceKind === "human_raider"
      ? "raider-camp"
      : raceKind === "ogre"
        ? "siege-den"
        : raceKind === "shaman"
          ? "ritual-circle"
          : raceKind === "elf_ranger"
            ? "watch-lodge"
      : "wolf-pack";
  const defaultOutpostName = raceKind === "barbarian"
    ? "Barbarian Warcamp"
    : raceKind === "human_raider"
      ? "Raider Camp"
      : raceKind === "ogre"
        ? "Siege Den"
        : raceKind === "shaman"
          ? "Ritual Circle"
          : raceKind === "elf_ranger"
            ? "Watch Lodge"
      : "Wolf Lair";
  const defaultThreatTier = raceKind === "barbarian"
    ? 3
    : raceKind === "human_raider"
      ? 2
      : raceKind === "ogre"
        ? 4
        : 3;
  const defaultRadiusTiles = raceKind === "barbarian" || raceKind === "ogre" ? 5 : 4;
  return {
    kind: String(cfg.outpostKind || defaultOutpostKind),
    ownerFactionId: cfg.ownerFactionId ? String(cfg.ownerFactionId) : null,
    name: String(cfg.outpostName || defaultOutpostName),
    threatTier: Number.isFinite(cfg.threatTier) ? Math.max(1, Math.round(cfg.threatTier)) : defaultThreatTier,
    radiusTiles: Number.isFinite(cfg.radiusTiles) ? Math.max(1, Math.round(cfg.radiusTiles)) : defaultRadiusTiles
  };
}

function buildInitialEnemyOutposts({ wildlife, width, height, waterTiles, raceRuntimeConfigByKind }) {
  const outposts = {};
  const occupiedTiles = new Set();
  const waterByTileKey = waterTiles?.byTileKey || {};
  const maxTileX = Math.max(0, width - 1);
  const maxTileY = Math.max(0, height - 1);
  const tileOffsets = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1]
  ];

  for (const pack of Object.values(wildlife?.packsById || {})) {
    const desc = outpostDescriptorForPack(pack?.kind, raceRuntimeConfigByKind);
    if (!desc) continue;
    const members = (pack.memberIds || [])
      .map((id) => wildlife.byId?.[id])
      .filter(Boolean);
    if (!members.length) continue;

    const leader = (pack.leaderId && wildlife.byId?.[pack.leaderId]) || members[0];
    if (!leader) continue;
    const homeMicroX = Number.isFinite(leader.homeMicroX) ? leader.homeMicroX : leader.microX;
    const homeMicroY = Number.isFinite(leader.homeMicroY) ? leader.homeMicroY : leader.microY;
    let baseTileX = clamp(Math.floor(homeMicroX / TILES_PER_CHUNK), 0, maxTileX);
    let baseTileY = clamp(Math.floor(homeMicroY / TILES_PER_CHUNK), 0, maxTileY);
    let tileX = null;
    let tileY = null;
    for (const [dx, dy] of tileOffsets) {
      const tx = clamp(baseTileX + dx, 0, maxTileX);
      const ty = clamp(baseTileY + dy, 0, maxTileY);
      const tk = `${tx},${ty}`;
      if (waterByTileKey[tk]) continue;
      if (occupiedTiles.has(tk)) continue;
      occupiedTiles.add(tk);
      tileX = tx;
      tileY = ty;
      break;
    }
    if (tileX === null || tileY === null) continue;
    const microX = tileX * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
    const microY = tileY * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
    const key = tileKey(microX, microY);

    outposts[key] = {
      key,
      id: `enemy-outpost-${pack.id}`,
      kind: desc.kind,
      status: "active",
      name: desc.name,
      ownerFactionId: desc.ownerFactionId,
      originPackId: pack.id,
      tileX,
      tileY,
      microX,
      microY,
      strength: Math.max(1, members.length),
      threatTier: desc.threatTier,
      radiusTiles: desc.radiusTiles,
      createdTick: 0,
      updatedTick: 0,
      metadata: {
        packKind: pack.kind,
        memberCount: members.length,
        aliveMemberCount: members.length
      }
    };
    pack.outpostKey = key;
    pack.outpostTileX = tileX;
    pack.outpostTileY = tileY;
  }

  return outposts;
}

function buildInitialAutomatedDefenses({ startingSiteId, sitesById, width, height, waterTiles }) {
  const out = {};
  if (!startingSiteId || !sitesById?.[startingSiteId]) return out;
  const site = sitesById[startingSiteId];
  const maxTileX = Math.max(0, width - 1);
  const maxTileY = Math.max(0, height - 1);
  const waterByTileKey = waterTiles?.byTileKey || {};
  const occupied = new Set();
  const tileOffsets = [
    [2, 0], [0, 2], [-2, 0], [0, -2],
    [2, 1], [1, 2], [-2, -1], [-1, -2],
    [3, 0], [0, 3], [-3, 0], [0, -3]
  ];

  function place(kind) {
    for (const [dx, dy] of tileOffsets) {
      const tileX = clamp(site.x + dx, 0, maxTileX);
      const tileY = clamp(site.y + dy, 0, maxTileY);
      const tileK = `${tileX},${tileY}`;
      if (waterByTileKey[tileK]) continue;
      if (occupied.has(tileK)) continue;
      occupied.add(tileK);
      const microX = tileX * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
      const microY = tileY * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
      const key = tileKey(microX, microY);
      out[key] = {
        key,
        id: `def-${kind}-${tileX}-${tileY}`,
        kind,
        tileX,
        tileY,
        microX,
        microY,
        status: "active",
        ammo: kind === "spring_turret" ? 5 : 0,
        maxAmmo: kind === "spring_turret" ? 10 : 0,
        durability: 100,
        maxDurability: 100,
        cooldownTicks: kind === "spring_turret" ? 4 : 7,
        range: kind === "spring_turret" ? 7 : 1.4,
        lastActionTick: -1000,
        maintenanceClaimedByGoblinId: null,
        maintenanceClaimUntilTick: -1,
        maintenanceNeeded: false
      };
      return true;
    }
    return false;
  }

  place("spring_turret");
  place("spike_trap");
  return out;
}

export function generateWorldMapState({ seed, size = "large", climatePreset = "temperate", genVersion = 1 }) {
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
  const resources = buildAdvancedResourceNodes({ seed, regionsById, waterTiles });
  const raceRuntimeConfigByKind = defaultRaceRuntimeConfigByKind();
  const wildlife = buildInitialWildlife({
    seed,
    width: dims.width,
    height: dims.height,
    regionsById,
    waterSources
  });
  wildlife.raceRuntimeConfigByKind = raceRuntimeConfigByKind;
  const enemyOutpostsByTileKey = buildInitialEnemyOutposts({
    wildlife,
    width: dims.width,
    height: dims.height,
    waterTiles,
    raceRuntimeConfigByKind
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
  const automatedDefensesByTileKey = buildInitialAutomatedDefenses({
    startingSiteId,
    sitesById,
    width: dims.width,
    height: dims.height,
    waterTiles
  });

  const worldHashPayload = JSON.stringify({
    seed,
    size,
    climatePreset,
    regionGrid,
    sitesById,
    routesById,
    waterTiles,
    resources,
    wildlife,
    automatedDefensesByTileKey
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
        enemyOutposts: true,
        sites: true,
        goblins: true
      }
    },
    units: {
      byGoblinId: {}
    },
    structures: {
      wallsByTileKey: {},
      enemyOutpostsByTileKey,
      automatedDefensesByTileKey,
      wallPlan: null,
      wallPlansBySiteId: {}
    },
    waterTiles,
    waterSources,
    wildlife,
    resourceNodes,
    resources,
    worldHash: hashText(worldHashPayload)
  };
}
