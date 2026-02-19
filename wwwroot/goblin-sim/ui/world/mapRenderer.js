import { biomeColor, factionName } from "../../sim/world/regionGen.js";
import { drawIndexedSprite } from "../../graphics/indexedBitmap.js";
import { createPerlin2D, fbm2D } from "../../sim/world/noise.js";
import { TILES_PER_CHUNK, tileToChunkCoord, tileToWorldCell } from "../../sim/world/scale.js";

const TILE = 24;
const UNIFORM_ENTITY_SIZE = 6;
const MICRO_VISUAL_SUBDIVISION = 8;
const SITE_COLORS = {
  "goblin-camp": "#7fe38f",
  "trade-outpost": "#e4c066",
  ruin: "#c7a07f",
  fortress: "#d87962",
  den: "#96b3cc",
  shrine: "#bea7dd"
};

const FALLBACK_RESOURCE_PURPOSES = {
  food: "Consumed regularly to reduce hunger and keep the tribe functional.",
  water: "Consumed regularly to reduce thirst and avoid stress spikes.",
  wood: "Burned for camp warmth and safety stability over time.",
  mushrooms: "Gathered from wild nodes; can be cooked into emergency food.",
  ore: "Strategic stock for future crafting and fortification systems.",
  lore: "Knowledge reserve used for advanced rituals/research later."
};

const ENEMY_OUTPOST_SPRITE_BY_KIND = {
  warcamp: "barbarian",
  "raider-camp": "human_raider",
  "ritual-circle": "shaman",
  "watch-lodge": "elf_ranger",
  "siege-den": "ogre",
  "barbarian-band": "barbarian",
  "wolf-pack": "wolf",
  "raider-band": "human_raider",
  "watch-band": "elf_ranger",
  "ritual-coven": "shaman",
  "ogre-warband": "ogre"
};

const ENEMY_OUTPOST_COLOR_BY_KIND = {
  warcamp: "rgba(223,126,94,0.95)",
  "raider-camp": "rgba(232,148,103,0.95)",
  "ritual-circle": "rgba(190,141,216,0.95)",
  "watch-lodge": "rgba(128,193,159,0.95)",
  "siege-den": "rgba(204,119,96,0.95)",
  "barbarian-band": "rgba(223,126,94,0.95)",
  "wolf-pack": "rgba(163,176,210,0.95)",
  "raider-band": "rgba(232,148,103,0.95)",
  "watch-band": "rgba(128,193,159,0.95)",
  "ritual-coven": "rgba(190,141,216,0.95)",
  "ogre-warband": "rgba(204,119,96,0.95)"
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function entityRenderStyle(zoom) {
  if (zoom >= 5.5) {
    return {
      sizeMul: 1.45,
      glow: "rgba(245,244,225,0.2)",
      glowRadius: 3.6,
      alpha: 1
    };
  }
  if (zoom >= 3.4) {
    return {
      sizeMul: 1.2,
      glow: "rgba(245,244,225,0.17)",
      glowRadius: 2.9,
      alpha: 0.96
    };
  }
  if (zoom >= 2.2) {
    return {
      sizeMul: 1,
      glow: "rgba(245,244,225,0.14)",
      glowRadius: 2.4,
      alpha: 0.92
    };
  }
  return {
    sizeMul: 0.9,
    glow: "rgba(245,244,225,0.1)",
    glowRadius: 1.9,
    alpha: 0.88
  };
}

function drawEntityBackdrop(ctx, x, y, style) {
  ctx.fillStyle = style.glow;
  ctx.beginPath();
  ctx.arc(x, y, style.glowRadius, 0, Math.PI * 2);
  ctx.fill();
}

function getNoiseSampler(worldMap) {
  const key = `${worldMap.seed}|${worldMap.worldHash}|terrain-noise-v1`;
  if (worldMap.render.__noiseKey === key && worldMap.render.__noise2D) {
    return worldMap.render.__noise2D;
  }
  const noise2D = createPerlin2D(key);
  worldMap.render.__noiseKey = key;
  worldMap.render.__noise2D = noise2D;
  return noise2D;
}

function overlayColor(mode, region, worldMap) {
  if (mode === "biome") return biomeColor(region.biome);
  if (mode === "hazard") {
    const v = worldMap.overlays.hazardByRegion[region.id] || 0;
    const r = Math.round(lerp(50, 220, v));
    const g = Math.round(lerp(110, 70, v));
    const b = Math.round(lerp(90, 70, v));
    return `rgb(${r},${g},${b})`;
  }
  if (mode === "resources") {
    const v = worldMap.overlays.resourceByRegion[region.id] || 0;
    const r = Math.round(lerp(55, 105, v));
    const g = Math.round(lerp(85, 190, v));
    const b = Math.round(lerp(55, 90, v));
    return `rgb(${r},${g},${b})`;
  }
  if (mode === "influence") {
    const inf = worldMap.overlays.influenceByFactionByRegion[region.id] || {};
    const ash = inf["faction-ashcap"] || 0;
    const ivory = inf["faction-ivory"] || 0;
    const red = inf["faction-redtooth"] || 0;
    const r = Math.round(90 + red * 130);
    const g = Math.round(70 + ash * 130);
    const b = Math.round(80 + ivory * 130);
    return `rgb(${r},${g},${b})`;
  }
  return biomeColor(region.biome);
}

function chooseGroundTileSprite(worldMap, region, x, y) {
  if (!region) return null;
  const variantsByBiome = {
    forest: ["grass_tile", "grass_tile_2", "grass_tile_3", "grass_tile_4", "grass_tile_5", "grass_tile_6", "grass_tile_7", "grass_tile_8"],
    swamp: ["swamp_tile_1", "swamp_tile_2", "swamp_tile_3", "swamp_tile_4", "swamp_tile_5", "swamp_tile_6", "swamp_tile_7", "swamp_tile_8"],
    hills: ["hills_tile_1", "hills_tile_2", "hills_tile_3", "hills_tile_4", "hills_tile_5", "hills_tile_6", "hills_tile_7", "hills_tile_8"],
    caves: ["caves_tile_1", "caves_tile_2", "caves_tile_3", "caves_tile_4", "caves_tile_5", "caves_tile_6", "caves_tile_7", "caves_tile_8"],
    ruins: ["ruins_tile_1", "ruins_tile_2", "ruins_tile_3", "ruins_tile_4", "ruins_tile_5", "ruins_tile_6", "ruins_tile_7", "ruins_tile_8"],
    badlands: ["badlands_tile_1", "badlands_tile_2", "badlands_tile_3", "badlands_tile_4", "badlands_tile_5", "badlands_tile_6", "badlands_tile_7", "badlands_tile_8"]
  };
  const variants = variantsByBiome[region.biome];
  if (!variants) return null;
  const h = hash32(`${worldMap.seed}|ground|${region.id}|${x},${y}`);
  return variants[h % variants.length];
}

function visibleRegionBounds(worldMap, canvas) {
  const worldLeft = (-worldMap.camera.x / worldMap.camera.zoom) / TILE;
  const worldTop = (-worldMap.camera.y / worldMap.camera.zoom) / TILE;
  const worldRight = worldLeft + canvas.clientWidth / (TILE * worldMap.camera.zoom);
  const worldBottom = worldTop + canvas.clientHeight / (TILE * worldMap.camera.zoom);

  return {
    minX: clamp(Math.floor(worldLeft) - 1, 0, worldMap.width - 1),
    minY: clamp(Math.floor(worldTop) - 1, 0, worldMap.height - 1),
    maxX: clamp(Math.ceil(worldRight) + 1, 0, worldMap.width - 1),
    maxY: clamp(Math.ceil(worldBottom) + 1, 0, worldMap.height - 1)
  };
}

function drawGrid(ctx, canvas, state) {
  const worldMap = state.worldMap;
  const bounds = visibleRegionBounds(worldMap, canvas);
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const regionId = worldMap.regionGrid[y][x];
      const region = worldMap.regionsById[regionId];
      if (!region) continue;
      const tileIsWater = Boolean(worldMap.waterTiles?.byTileKey?.[`${x},${y}`]);

      const intel = worldMap.intel.knownRegions[regionId]?.confidence ?? 0;
      const alpha = 0.2 + intel * 0.8;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = overlayColor(worldMap.render.overlayMode, region, worldMap);
      ctx.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);

      if (!tileIsWater && worldMap.render.overlayMode === "biome") {
        const spriteId = chooseGroundTileSprite(worldMap, region, x, y);
        if (spriteId) {
          ctx.globalAlpha = Math.min(1, alpha * 0.34);
          drawIndexedSprite(ctx, state.graphics, spriteId, x * TILE, y * TILE, TILE, TILE);
          ctx.globalAlpha = alpha;
        }
      }
    }
  }

  ctx.globalAlpha = 1;
  if (worldMap.camera.zoom < 1.8) {
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.lineWidth = 1;
    for (let x = bounds.minX; x <= bounds.maxX + 1; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * TILE, bounds.minY * TILE);
      ctx.lineTo(x * TILE, (bounds.maxY + 1) * TILE);
      ctx.stroke();
    }
    for (let y = bounds.minY; y <= bounds.maxY + 1; y += 1) {
      ctx.beginPath();
      ctx.moveTo(bounds.minX * TILE, y * TILE);
      ctx.lineTo((bounds.maxX + 1) * TILE, y * TILE);
      ctx.stroke();
    }
  }

  const selectedRegion = worldMap.player.selectedRegionId;
  if (selectedRegion) {
    const region = worldMap.regionsById[selectedRegion];
    ctx.strokeStyle = "#ffe49c";
    ctx.lineWidth = 2;
    ctx.strokeRect(region.x * TILE + 1, region.y * TILE + 1, TILE - 2, TILE - 2);
  }
}

function subTileShade(region, n) {
  if (region.biome === "forest") return `rgba(35,${85 + Math.round(n * 35)},40,0.42)`;
  if (region.biome === "swamp") return `rgba(35,${75 + Math.round(n * 30)},65,0.48)`;
  if (region.biome === "hills") return `rgba(${90 + Math.round(n * 30)},80,55,0.38)`;
  if (region.biome === "caves") return `rgba(${50 + Math.round(n * 20)},58,70,0.44)`;
  if (region.biome === "ruins") return `rgba(${95 + Math.round(n * 28)},78,62,0.42)`;
  return `rgba(${105 + Math.round(n * 24)},72,52,0.42)`;
}

function propForBiome(region, n) {
  if (region.biome === "forest") return n > 0.6 ? "tree" : null;
  if (region.biome === "swamp") return n > 0.72 ? "mushroom" : null;
  if (region.biome === "hills") return n > 0.67 ? "rock" : null;
  if (region.biome === "caves") return n > 0.58 ? "rock" : n > 0.48 ? "mushroom" : null;
  if (region.biome === "ruins") return n > 0.55 ? "rock" : null;
  if (region.biome === "badlands") return n > 0.62 ? "rock" : null;
  return null;
}

function drawRegionMicroDetails(ctx, canvas, state) {
  const worldMap = state.worldMap;
  const assets = state.graphics;
  const zoom = worldMap.camera.zoom;
  if (zoom < 1.3) return;
  const noise2D = getNoiseSampler(worldMap);

  const bounds = visibleRegionBounds(worldMap, canvas);
  const sub = MICRO_VISUAL_SUBDIVISION;
  const subSize = TILE / sub;

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const regionId = worldMap.regionGrid[y][x];
      const region = worldMap.regionsById[regionId];
      if (!region) continue;
      const tileIsWater = Boolean(worldMap.waterTiles?.byTileKey?.[`${x},${y}`]);

      const baseX = x * TILE;
      const baseY = y * TILE;

      for (let sy = 0; sy < sub; sy += 1) {
        for (let sx = 0; sx < sub; sx += 1) {
          const wx = (x * sub + sx) / 7.25;
          const wy = (y * sub + sy) / 7.25;
          const macro = fbm2D(noise2D, wx * 0.42, wy * 0.42, 3, 0.55, 2.05);
          const micro = fbm2D(noise2D, wx * 1.38 + 13.1, wy * 1.38 - 9.3, 2, 0.5, 2.0);
          const n = clamp(macro * 0.72 + micro * 0.28, 0, 1);
          ctx.fillStyle = subTileShade(region, n);
          ctx.fillRect(baseX + sx * subSize, baseY + sy * subSize, subSize + 0.4, subSize + 0.4);

          if (zoom < 1.8 || tileIsWater) continue;
          const propNoise = fbm2D(noise2D, wx * 0.9 + 27.7, wy * 0.9 + 41.2, 2, 0.56, 2.0);
          const prop = propForBiome(region, n * 0.65 + propNoise * 0.35);
          if (!prop) continue;

          const px = baseX + sx * subSize + subSize * 0.15;
          const py = baseY + sy * subSize + subSize * 0.12;
          const size = Math.max(3.5, subSize * 0.78);
          if (!drawIndexedSprite(ctx, assets, prop, px, py, size, size)) {
            ctx.fillStyle = "rgba(20,20,20,0.35)";
            ctx.fillRect(px, py, size * 0.65, size * 0.65);
          }
        }
      }
    }
  }
}

function drawWaterTiles(ctx, canvas, state) {
  const wm = state.worldMap;
  const bounds = visibleRegionBounds(wm, canvas);
  const assets = state.graphics;
  const tiles = wm.waterTiles?.byTileKey || wm.waterSources?.byTileKey || {};

  for (const node of Object.values(tiles)) {
    if (node.tileX < bounds.minX || node.tileX > bounds.maxX || node.tileY < bounds.minY || node.tileY > bounds.maxY) {
      continue;
    }

    const x = node.tileX * TILE;
    const y = node.tileY * TILE;

    // soft bank underlay
    ctx.fillStyle = "rgba(12,38,58,0.24)";
    ctx.fillRect(x, y, TILE, TILE);

    // tile sprite water pattern
    const drew = drawIndexedSprite(ctx, assets, "water_tile", x, y, TILE, TILE);
    if (!drew) {
      ctx.fillStyle = "rgba(58,138,188,0.82)";
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    }

    // subtle highlight by water kind
    const kind = node.waterKind || "river";
    if (kind === "lake") {
      ctx.fillStyle = "rgba(166,224,255,0.18)";
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    } else {
      ctx.fillStyle = "rgba(166,224,255,0.13)";
      ctx.fillRect(x + 4, y + 3, TILE - 9, TILE - 8);
    }
  }
}

function drawHarvestNodes(ctx, canvas, state) {
  const wm = state.worldMap;
  const zoom = wm.camera.zoom;
  if (zoom < 1.6) return;

  const assets = state.graphics;
  const bounds = visibleRegionBounds(wm, canvas);
  const style = entityRenderStyle(zoom);

  for (const node of Object.values(wm.resourceNodes.byTileKey)) {
    const tileX = tileToChunkCoord(node.microX);
    const tileY = tileToChunkCoord(node.microY);
    if (wm.waterTiles?.byTileKey?.[`${tileX},${tileY}`]) continue;
    if (tileX < bounds.minX || tileX > bounds.maxX || tileY < bounds.minY || tileY > bounds.maxY) {
      continue;
    }

    const ready = node.readyAtTick <= state.meta.tick;
    const px = tileToWorldCell(node.microX + 0.5) * TILE;
    const py = tileToWorldCell(node.microY + 0.5) * TILE;
    const spriteId = node.type === "tree" ? "tree" : "mushroom";
    const size = UNIFORM_ENTITY_SIZE * style.sizeMul;

    drawEntityBackdrop(ctx, px, py, style);
    ctx.globalAlpha = ready ? style.alpha : 0.4;
    const drew = drawIndexedSprite(ctx, assets, spriteId, px - size * 0.5, py - size * 0.5, size, size);
    if (!drew) {
      ctx.fillStyle = node.type === "tree" ? "#6ea96d" : "#b79ad6";
      ctx.fillRect(px - size * 0.25, py - size * 0.25, size * 0.5, size * 0.5);
    }
    ctx.globalAlpha = 1;
  }
}

function drawHomes(ctx, canvas, state) {
  const wm = state.worldMap;
  const assets = state.graphics;
  const style = entityRenderStyle(wm.camera.zoom);
  const bounds = visibleRegionBounds(wm, canvas);
  const seen = new Set();
  for (const unit of Object.values(wm.units.byGoblinId)) {
    const tileX = tileToChunkCoord(unit.homeMicroX);
    const tileY = tileToChunkCoord(unit.homeMicroY);
    if (tileX < bounds.minX || tileX > bounds.maxX || tileY < bounds.minY || tileY > bounds.maxY) continue;
    const key = `${unit.homeMicroX},${unit.homeMicroY}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const px = tileToWorldCell(unit.homeMicroX + 0.5) * TILE;
    const py = tileToWorldCell(unit.homeMicroY + 0.5) * TILE;
    const size = UNIFORM_ENTITY_SIZE * style.sizeMul;
    drawEntityBackdrop(ctx, px, py, style);
    if (!drawIndexedSprite(ctx, assets, "home", px - size * 0.5, py - size * 0.5, size, size)) {
      ctx.fillStyle = "rgba(218,173,103,0.9)";
      ctx.fillRect(px - size * 0.25, py - size * 0.25, size * 0.5, size * 0.5);
    }
  }
  for (const home of Object.values(wm.structures?.villageHomesByTileKey || {})) {
    const tileX = tileToChunkCoord(home.microX);
    const tileY = tileToChunkCoord(home.microY);
    if (tileX < bounds.minX || tileX > bounds.maxX || tileY < bounds.minY || tileY > bounds.maxY) continue;
    const key = `${home.microX},${home.microY}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const px = tileToWorldCell(home.microX + 0.5) * TILE;
    const py = tileToWorldCell(home.microY + 0.5) * TILE;
    const size = UNIFORM_ENTITY_SIZE * style.sizeMul;
    drawEntityBackdrop(ctx, px, py, style);
    if (!drawIndexedSprite(ctx, assets, "home", px - size * 0.5, py - size * 0.5, size, size)) {
      ctx.fillStyle = "rgba(218,173,103,0.9)";
      ctx.fillRect(px - size * 0.25, py - size * 0.25, size * 0.5, size * 0.5);
    }
  }
}

function drawColonyOutposts(ctx, canvas, state) {
  const wm = state.worldMap;
  const assets = state.graphics;
  const style = entityRenderStyle(wm.camera.zoom);
  const bounds = visibleRegionBounds(wm, canvas);
  for (const outpost of Object.values(wm.structures?.colonyOutpostsByTileKey || {})) {
    const tileX = tileToChunkCoord(outpost.microX);
    const tileY = tileToChunkCoord(outpost.microY);
    if (tileX < bounds.minX || tileX > bounds.maxX || tileY < bounds.minY || tileY > bounds.maxY) continue;

    const px = tileToWorldCell(outpost.microX + 0.5) * TILE;
    const py = tileToWorldCell(outpost.microY + 0.5) * TILE;
    const size = UNIFORM_ENTITY_SIZE * style.sizeMul;
    drawEntityBackdrop(ctx, px, py, style);
    if (!drawIndexedSprite(ctx, assets, "outpost", px - size * 0.5, py - size * 0.5, size, size)) {
      ctx.fillStyle = "rgba(206,112,80,0.92)";
      ctx.fillRect(px - size * 0.25, py - size * 0.25, size * 0.5, size * 0.5);
    }
    if (wm.camera.zoom >= 2.6) {
      ctx.strokeStyle = "rgba(252,216,146,0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px - size * 0.35, py - size * 0.35, size * 0.7, size * 0.7);
    }
  }
}

function drawEnemyOutposts(ctx, canvas, state) {
  const wm = state.worldMap;
  const assets = state.graphics;
  const style = entityRenderStyle(wm.camera.zoom);
  const bounds = visibleRegionBounds(wm, canvas);
  const size = UNIFORM_ENTITY_SIZE * style.sizeMul;
  const seen = new Set();
  const representedPackIds = new Set();

  for (const outpost of Object.values(wm.structures?.enemyOutpostsByTileKey || {})) {
    const microX = Number.isFinite(outpost?.microX) ? outpost.microX : null;
    const microY = Number.isFinite(outpost?.microY) ? outpost.microY : null;
    if (microX === null || microY === null) continue;
    const tileX = tileToChunkCoord(microX);
    const tileY = tileToChunkCoord(microY);
    if (tileX < bounds.minX || tileX > bounds.maxX || tileY < bounds.minY || tileY > bounds.maxY) continue;

    const kind = String(outpost.kind || outpost.type || "warcamp");
    const px = tileToWorldCell(microX + 0.5) * TILE;
    const py = tileToWorldCell(microY + 0.5) * TILE;
    drawEntityBackdrop(ctx, px, py, style);
    const sprite = ENEMY_OUTPOST_SPRITE_BY_KIND[kind] || "barbarian";
    const drew = drawIndexedSprite(ctx, assets, sprite, px - size * 0.5, py - size * 0.5, size, size);
    if (!drew) {
      ctx.fillStyle = ENEMY_OUTPOST_COLOR_BY_KIND[kind] || "rgba(223,126,94,0.95)";
      ctx.fillRect(px - size * 0.28, py - size * 0.28, size * 0.56, size * 0.56);
    }
    seen.add(`${microX},${microY}`);
    if (outpost.originPackId) representedPackIds.add(String(outpost.originPackId));
  }

  for (const pack of Object.values(wm.wildlife?.packsById || {})) {
    if (
      pack?.kind !== "barbarian-band"
      && pack?.kind !== "wolf-pack"
      && pack?.kind !== "raider-band"
      && pack?.kind !== "watch-band"
      && pack?.kind !== "ritual-coven"
      && pack?.kind !== "ogre-warband"
    ) continue;
    if (representedPackIds.has(String(pack.id))) continue;
    const leader = pack.leaderId ? wm.wildlife?.byId?.[pack.leaderId] : null;
    const microX = Number.isFinite(leader?.homeMicroX) ? leader.homeMicroX : Number.isFinite(leader?.microX) ? leader.microX : null;
    const microY = Number.isFinite(leader?.homeMicroY) ? leader.homeMicroY : Number.isFinite(leader?.microY) ? leader.microY : null;
    if (microX === null || microY === null) continue;
    const key = `${microX},${microY}`;
    if (seen.has(key)) continue;

    const tileX = tileToChunkCoord(microX);
    const tileY = tileToChunkCoord(microY);
    if (tileX < bounds.minX || tileX > bounds.maxX || tileY < bounds.minY || tileY > bounds.maxY) continue;

    const px = tileToWorldCell(microX + 0.5) * TILE;
    const py = tileToWorldCell(microY + 0.5) * TILE;
    drawEntityBackdrop(ctx, px, py, style);
    const sprite = ENEMY_OUTPOST_SPRITE_BY_KIND[pack.kind];
    const drew = drawIndexedSprite(ctx, assets, sprite, px - size * 0.5, py - size * 0.5, size, size);
    if (!drew) {
      ctx.fillStyle = ENEMY_OUTPOST_COLOR_BY_KIND[pack.kind];
      ctx.fillRect(px - size * 0.28, py - size * 0.28, size * 0.56, size * 0.56);
    }
    if (wm.camera.zoom >= 2.4) {
      ctx.strokeStyle = "rgba(255,231,173,0.85)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px - size * 0.4, py - size * 0.4, size * 0.8, size * 0.8);
    }
    seen.add(key);
  }
}

function drawWalls(ctx, canvas, state) {
  const wm = state.worldMap;
  const bounds = visibleRegionBounds(wm, canvas);
  const cell = TILE / TILES_PER_CHUNK;
  const zoom = wm.camera.zoom;
  const wallByKey = wm.structures?.wallsByTileKey || {};
  const keys = Object.keys(wallByKey);
  const keySet = new Set(keys);

  for (const key of keys) {
    const wall = wallByKey[key];
    if (!wall) continue;
    const tileX = tileToChunkCoord(wall.microX);
    const tileY = tileToChunkCoord(wall.microY);
    if (tileX < bounds.minX || tileX > bounds.maxX || tileY < bounds.minY || tileY > bounds.maxY) continue;

    const px = tileToWorldCell(wall.microX + 0.5) * TILE;
    const py = tileToWorldCell(wall.microY + 0.5) * TILE;
    const half = cell * 0.5;
    const thickness = cell * 0.68;
    const stem = thickness * 0.54;

    const n = keySet.has(`${wall.microX},${wall.microY - 1}`);
    const s = keySet.has(`${wall.microX},${wall.microY + 1}`);
    const w = keySet.has(`${wall.microX - 1},${wall.microY}`);
    const e = keySet.has(`${wall.microX + 1},${wall.microY}`);

    // soft occlusion so wall lines feel grounded.
    ctx.fillStyle = "rgba(11,12,16,0.22)";
    ctx.fillRect(px - half * 0.9, py - half * 0.25, half * 1.8, half * 1.4);

    ctx.fillStyle = "rgba(125,127,133,0.98)";
    ctx.fillRect(px - stem * 0.5, py - stem * 0.5, stem, stem);
    if (n) ctx.fillRect(px - stem * 0.5, py - half, stem, half);
    if (s) ctx.fillRect(px - stem * 0.5, py, stem, half);
    if (w) ctx.fillRect(px - half, py - stem * 0.5, half, stem);
    if (e) ctx.fillRect(px, py - stem * 0.5, half, stem);

    ctx.fillStyle = "rgba(178,181,188,0.95)";
    ctx.fillRect(px - stem * 0.5, py - stem * 0.5, stem, stem * 0.33);
    if (n) ctx.fillRect(px - stem * 0.5, py - half, stem, half * 0.36);
    if (w) ctx.fillRect(px - half, py - stem * 0.5, half * 0.36, stem);

    if (zoom >= 2.2) {
      const cap = Math.max(1.1, cell * 0.2);
      ctx.fillStyle = "rgba(94,97,104,0.95)";
      if (!n) ctx.fillRect(px - stem * 0.55, py - half, stem * 1.1, cap);
      if (!s) ctx.fillRect(px - stem * 0.55, py + half - cap, stem * 1.1, cap);
      if (!w) ctx.fillRect(px - half, py - stem * 0.55, cap, stem * 1.1);
      if (!e) ctx.fillRect(px + half - cap, py - stem * 0.55, cap, stem * 1.1);
    }

    if (zoom >= 3.2) {
      const crenelW = Math.max(0.8, stem * 0.24);
      const crenelH = Math.max(0.55, stem * 0.18);
      ctx.fillStyle = "rgba(208,211,216,0.92)";
      if (n || (!s && !e && !w)) {
        ctx.fillRect(px - stem * 0.48, py - half, crenelW, crenelH);
        ctx.fillRect(px - crenelW * 0.5, py - half, crenelW, crenelH);
        ctx.fillRect(px + stem * 0.24, py - half, crenelW, crenelH);
      }
    }
  }
}

function siteSprite(siteType) {
  if (siteType === "goblin-camp") return "goblin";
  if (siteType === "ruin") return "rock";
  if (siteType === "den") return "mushroom";
  if (siteType === "trade-outpost") return "tree";
  if (siteType === "fortress") return "rock";
  if (siteType === "shrine") return "mushroom";
  return null;
}

function drawSites(ctx, state) {
  const worldMap = state.worldMap;
  const assets = state.graphics;
  for (const site of Object.values(worldMap.sitesById)) {
    const x = site.x * TILE + TILE * 0.5;
    const y = site.y * TILE + TILE * 0.5;
    const selected = site.id === worldMap.player.selectedSiteId;

    const spr = siteSprite(site.type);
    const size = UNIFORM_ENTITY_SIZE;
    const drewSprite =
      spr && assets?.indexed8?.spritesById
        ? drawIndexedSprite(ctx, assets, spr, x - size * 0.5, y - size * 0.5, size, size)
        : false;

    if (!drewSprite) {
      ctx.fillStyle = SITE_COLORS[site.type] || "#ddd";
      ctx.beginPath();
      ctx.arc(x, y, selected ? 2.8 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (selected) {
      ctx.strokeStyle = "#fff8d4";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, 4.8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawGoblins(ctx, state) {
  const worldMap = state.worldMap;
  const assets = state.graphics;
  const style = entityRenderStyle(worldMap.camera.zoom);

  for (const unit of Object.values(worldMap.units.byGoblinId)) {
    const goblin = state.goblins.byId[unit.goblinId];
    if (!goblin) continue;
    const px = (unit.posX ?? unit.tileX + 0.5) * TILE;
    const py = (unit.posY ?? unit.tileY + 0.5) * TILE;
    const size = UNIFORM_ENTITY_SIZE * style.sizeMul;

    const moodTint =
      goblin.psyche.moodState === "breaking"
        ? "#ff8f84"
        : goblin.psyche.moodState === "volatile"
          ? "#ffc08f"
          : goblin.psyche.moodState === "agitated"
            ? "#e8e083"
            : "#3ef0c0";

    drawEntityBackdrop(ctx, px, py, style);
    if (!drawIndexedSprite(ctx, assets, "goblin", px - size * 0.5, py - size * 0.5, size, size)) {
      ctx.fillStyle = moodTint;
      ctx.fillRect(px - size * 0.3, py - size * 0.3, size * 0.6, size * 0.6);
    }
    if (worldMap.camera.zoom >= 3) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(px - 2.2, py + 2.1, 4.4, 1);
    }
  }
}

function drawDebugWildlife(ctx, canvas, state) {
  const wm = state.worldMap;
  if (!wm.render.showDebugWildlife) return;
  const hasLive = Boolean(wm.wildlife?.allIds?.length);
  if (!hasLive) return;

  const bounds = visibleRegionBounds(wm, canvas);
  const style = entityRenderStyle(wm.camera.zoom);
  const assets = state.graphics;

  function drawUnit(unit) {
    if (!unit) return;
    if (unit.tileX < bounds.minX || unit.tileX > bounds.maxX || unit.tileY < bounds.minY || unit.tileY > bounds.maxY) return;

    const px = tileToWorldCell(unit.microX + 0.5) * TILE;
    const py = tileToWorldCell(unit.microY + 0.5) * TILE;
    const size = UNIFORM_ENTITY_SIZE * style.sizeMul;
    drawEntityBackdrop(ctx, px, py, style);

    const drew = drawIndexedSprite(ctx, assets, unit.kind, px - size * 0.5, py - size * 0.5, size, size);
    if (!drew) {
      ctx.fillStyle = unit.kind === "fish"
        ? "#6ac8ff"
        : unit.kind === "deer"
          ? "#d39a72"
          : unit.kind === "wolf"
            ? "#9ea5b6"
            : "#d8766f";
      ctx.fillRect(px - size * 0.28, py - size * 0.28, size * 0.56, size * 0.56);
    }
    if (state.debug?.selectedWildlifeId === unit.id) {
      ctx.strokeStyle = "rgba(255,241,184,0.95)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (hasLive) {
    for (const id of wm.wildlife.allIds) {
      const unit = wm.wildlife.byId[id];
      if (!unit || !unit.alive) continue;
      drawUnit(unit);
    }
  }

}

function drawThreatOverlay(ctx, canvas, state) {
  const wm = state.worldMap;
  if (wm.render.showThreatOverlay === false) return;
  if (!wm.wildlife?.allIds?.length) return;
  const bounds = visibleRegionBounds(wm, canvas);

  const toPx = (microX, microY) => ({
    x: tileToWorldCell(microX + 0.5) * TILE,
    y: tileToWorldCell(microY + 0.5) * TILE
  });

  for (const id of wm.wildlife.allIds) {
    const creature = wm.wildlife.byId[id];
    if (!creature || !creature.alive) continue;
    if (creature.tileX < bounds.minX || creature.tileX > bounds.maxX || creature.tileY < bounds.minY || creature.tileY > bounds.maxY) continue;
    if (
      creature.kind !== "wolf"
      && creature.kind !== "barbarian"
      && creature.kind !== "human_raider"
      && creature.kind !== "elf_ranger"
      && creature.kind !== "shaman"
      && creature.kind !== "ogre"
    ) continue;
    const hunt = creature.huntState || {};
    const from = toPx(creature.microX, creature.microY);

    if (hunt.targetGoblinId) {
      const target = wm.units?.byGoblinId?.[hunt.targetGoblinId];
      if (target) {
        const to = toPx(target.microX, target.microY);
        ctx.strokeStyle = creature.kind === "wolf"
          ? "rgba(214,228,255,0.5)"
          : creature.kind === "human_raider"
            ? "rgba(255,206,134,0.58)"
            : creature.kind === "elf_ranger"
              ? "rgba(196,240,184,0.6)"
              : creature.kind === "shaman"
                ? "rgba(189,166,255,0.58)"
                : creature.kind === "ogre"
                  ? "rgba(255,148,122,0.62)"
            : "rgba(255,170,145,0.55)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (hunt.lastKnownTargetTile) {
      const to = toPx(hunt.lastKnownTargetTile.tileX, hunt.lastKnownTargetTile.tileY);
      ctx.strokeStyle = "rgba(245,224,154,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  for (const [goblinId, unit] of Object.entries(wm.units?.byGoblinId || {})) {
    const goblin = state.goblins.byId[goblinId];
    const response = goblin?.modData?.threatResponse;
    if (!goblin || !response || response.mode === "none") continue;
    if (unit.tileX < bounds.minX || unit.tileX > bounds.maxX || unit.tileY < bounds.minY || unit.tileY > bounds.maxY) continue;
    const p = toPx(unit.microX, unit.microY);
    const score = Math.max(0, Math.min(100, response.threatScore || 0));
    const r = 2.2 + (score / 100) * 2.6;
    ctx.strokeStyle = response.mode === "defend"
      ? "rgba(252,214,125,0.7)"
      : response.mode === "flee"
        ? "rgba(255,140,140,0.74)"
        : "rgba(145,207,255,0.64)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMigrationOverlay(ctx, canvas, state) {
  const wm = state.worldMap;
  const migration = wm.structures?.migration;
  if (!migration?.queueIds?.length) return;
  const bounds = visibleRegionBounds(wm, canvas);
  const toPx = (microX, microY) => ({
    x: tileToWorldCell(microX + 0.5) * TILE,
    y: tileToWorldCell(microY + 0.5) * TILE
  });

  for (const jobId of migration.queueIds) {
    const job = migration.jobsById?.[jobId];
    if (!job || (job.status !== "queued" && job.status !== "active")) continue;
    const unit = wm.units?.byGoblinId?.[job.goblinId];
    if (!unit) continue;
    const tileX = tileToChunkCoord(unit.microX);
    const tileY = tileToChunkCoord(unit.microY);
    if (tileX < bounds.minX || tileX > bounds.maxX || tileY < bounds.minY || tileY > bounds.maxY) continue;
    const from = toPx(unit.microX, unit.microY);
    const to = toPx(job.targetMicroX, job.targetMicroY);
    ctx.strokeStyle = job.status === "active" ? "rgba(110,227,210,0.62)" : "rgba(190,224,250,0.42)";
    ctx.lineWidth = 1;
    ctx.setLineDash(job.status === "active" ? [5, 3] : [2, 4]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (wm.camera.zoom >= 2) {
      ctx.fillStyle = "rgba(245,234,178,0.78)";
      ctx.beginPath();
      ctx.arc(to.x, to.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawMinimap(state, miniCtx, miniCanvas, miniCssWidth, miniCssHeight) {
  const worldMap = state.worldMap;
  const w = miniCssWidth;
  const h = miniCssHeight;
  miniCtx.clearRect(0, 0, w, h);

  const cacheKey = `${worldMap.worldHash}|${w}x${h}`;
  if (!worldMap.render.__minimapCache || worldMap.render.__minimapCache.key !== cacheKey) {
    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext("2d");
    const cellW = w / worldMap.width;
    const cellH = h / worldMap.height;
    for (let y = 0; y < worldMap.height; y += 1) {
      for (let x = 0; x < worldMap.width; x += 1) {
        const id = worldMap.regionGrid[y][x];
        const region = worldMap.regionsById[id];
        offCtx.fillStyle = overlayColor("biome", region, worldMap);
        offCtx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
        if (worldMap.waterTiles?.byTileKey?.[`${x},${y}`]) {
          offCtx.fillStyle = "rgba(66,150,206,0.95)";
          offCtx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
        }
      }
    }
    worldMap.render.__minimapCache = { key: cacheKey, canvas: offscreen };
  }

  miniCtx.drawImage(worldMap.render.__minimapCache.canvas, 0, 0);

  miniCtx.strokeStyle = "#f8eab8";
  miniCtx.lineWidth = 1;
  const cellW = w / worldMap.width;
  const cellH = h / worldMap.height;
  const viewW = state.ui.mapCanvas.clientWidth / TILE / worldMap.camera.zoom;
  const viewH = state.ui.mapCanvas.clientHeight / TILE / worldMap.camera.zoom;
  miniCtx.strokeRect(
    (-worldMap.camera.x / TILE) * cellW,
    (-worldMap.camera.y / TILE) * cellH,
    viewW * cellW,
    viewH * cellH
  );
}

function applyTrackedEntityCamera(state, canvas) {
  if (!state.worldMap?.render?.followTrackedGoblin) return;

  const wm = state.worldMap;
  const trackedWildlifeId = state.debug?.trackedWildlifeId;
  const trackedGoblinId = state.debug?.trackedGoblinId;
  const unit = trackedWildlifeId
    ? wm?.wildlife?.byId?.[trackedWildlifeId]
    : wm?.units?.byGoblinId?.[trackedGoblinId];
  if (!unit) return;

  const tx = (unit.posX ?? unit.tileX + 0.5) * TILE;
  const ty = (unit.posY ?? unit.tileY + 0.5) * TILE;
  const targetX = canvas.clientWidth * 0.5 - tx * wm.camera.zoom;
  const targetY = canvas.clientHeight * 0.5 - ty * wm.camera.zoom;

  // Smooth follow to avoid jumpy camera while unit moves.
  const a = 0.25;
  wm.camera.x = wm.camera.x + (targetX - wm.camera.x) * a;
  wm.camera.y = wm.camera.y + (targetY - wm.camera.y) * a;
}

export function renderWorldMap(state, canvas, miniCanvas) {
  const worldMap = state.worldMap;
  if (!worldMap || !canvas || !miniCanvas) return;
  const layers = worldMap.render?.showLayers || {};

  const ctx = canvas.getContext("2d");
  const miniCtx = miniCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const nextCanvasW = Math.max(1, Math.floor(cssWidth * dpr));
  const nextCanvasH = Math.max(1, Math.floor(cssHeight * dpr));
  if (canvas.width !== nextCanvasW) canvas.width = nextCanvasW;
  if (canvas.height !== nextCanvasH) canvas.height = nextCanvasH;

  const miniCssWidth = miniCanvas.clientWidth;
  const miniCssHeight = miniCanvas.clientHeight;
  const nextMiniW = Math.max(1, Math.floor(miniCssWidth * dpr));
  const nextMiniH = Math.max(1, Math.floor(miniCssHeight * dpr));
  if (miniCanvas.width !== nextMiniW) miniCanvas.width = nextMiniW;
  if (miniCanvas.height !== nextMiniH) miniCanvas.height = nextMiniH;

  applyTrackedEntityCamera(state, canvas);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  ctx.save();
  ctx.translate(worldMap.camera.x, worldMap.camera.y);
  ctx.scale(worldMap.camera.zoom, worldMap.camera.zoom);

  drawGrid(ctx, canvas, state);
  if (layers.water !== false) drawWaterTiles(ctx, canvas, state);
  drawRegionMicroDetails(ctx, canvas, state);
  if (layers.resources !== false) drawHarvestNodes(ctx, canvas, state);
  drawDebugWildlife(ctx, canvas, state);
  drawThreatOverlay(ctx, canvas, state);
  drawMigrationOverlay(ctx, canvas, state);
  if (layers.homes !== false) drawHomes(ctx, canvas, state);
  if (layers.homes !== false) drawColonyOutposts(ctx, canvas, state);
  if (layers.enemyOutposts !== false) drawEnemyOutposts(ctx, canvas, state);
  if (layers.walls !== false) drawWalls(ctx, canvas, state);
  if (layers.sites !== false) drawSites(ctx, state);
  if (layers.goblins !== false) drawGoblins(ctx, state);

  ctx.restore();

  miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawMinimap(state, miniCtx, miniCanvas, miniCssWidth, miniCssHeight);
}

export function pickCellFromCanvas(state, canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const worldX = (x - state.worldMap.camera.x) / state.worldMap.camera.zoom;
  const worldY = (y - state.worldMap.camera.y) / state.worldMap.camera.zoom;

  const gx = Math.floor(worldX / TILE);
  const gy = Math.floor(worldY / TILE);

  if (gx < 0 || gy < 0 || gx >= state.worldMap.width || gy >= state.worldMap.height) return null;
  const regionId = state.worldMap.regionGrid[gy][gx];

  const wm = state.worldMap;
  const siteCount = Object.keys(wm.sitesById || {}).length;
  if (!wm.__sitePickIndex || wm.__sitePickIndexCount !== siteCount) {
    wm.__sitePickIndex = {};
    for (const site of Object.values(wm.sitesById)) {
      wm.__sitePickIndex[`${site.x},${site.y}`] = site.id;
    }
    wm.__sitePickIndexCount = siteCount;
  }
  const siteId = wm.__sitePickIndex[`${gx},${gy}`] || null;
  const microX = Math.floor((worldX / TILE) * TILES_PER_CHUNK);
  const microY = Math.floor((worldY / TILE) * TILES_PER_CHUNK);
  const microKeyStr = `${microX},${microY}`;
  const wildlifeOcc = state.worldMap.wildlife?.occupancyByMicroKey || {};
  const wildlifeId = (wildlifeOcc[microKeyStr] || [])[0] || null;
  let goblinRenderOcc = state.worldMap.units?.renderOccupancyByMicroKey || null;
  let goblinOcc = state.worldMap.units?.occupancyByMicroKey || null;
  if (!goblinOcc || !goblinRenderOcc) {
    // Runtime-safe parity fallback until first world sim tick initializes occupancy map.
    goblinOcc = {};
    goblinRenderOcc = {};
    for (const unit of Object.values(state.worldMap.units?.byGoblinId || {})) {
      const key = `${unit.microX},${unit.microY}`;
      if (!goblinOcc[key]) goblinOcc[key] = [];
      goblinOcc[key].push(unit.goblinId);
      const rx = Math.floor((unit.posX ?? unit.tileX + 0.5) * TILES_PER_CHUNK);
      const ry = Math.floor((unit.posY ?? unit.tileY + 0.5) * TILES_PER_CHUNK);
      const rKey = `${rx},${ry}`;
      if (!goblinRenderOcc[rKey]) goblinRenderOcc[rKey] = [];
      goblinRenderOcc[rKey].push(unit.goblinId);
    }
  }
  // Prefer render occupancy so click matches visible sprite location.
  const goblinId = (goblinRenderOcc[microKeyStr] || goblinOcc[microKeyStr] || [])[0] || null;

  return { gx, gy, regionId, siteId, microX, microY, wildlifeId, goblinId };
}

export function buildMapInspector(state) {
  const wm = state.worldMap;
  const region = wm.player.selectedRegionId ? wm.regionsById[wm.player.selectedRegionId] : null;
  const site = wm.player.selectedSiteId ? wm.sitesById[wm.player.selectedSiteId] : null;

  const startCandidates = wm.startCandidates.slice(0, 5).map((c) => ({
    siteId: c.siteId,
    siteName: wm.sitesById[c.siteId]?.name,
    score: c.score,
    breakdown: c.breakdown
  }));

  const selectedFaction = region
    ? Object.entries(region.factionInfluence)
        .sort((a, b) => b[1] - a[1])[0]
    : null;
  const selectedWildlife = state.debug?.selectedWildlifeId
    ? wm.wildlife?.byId?.[state.debug.selectedWildlifeId] || null
    : null;
  const roleCounts = {
    forager: 0, woodcutter: 0, fisherman: 0, hunter: 0, builder: 0, homebuilder: 0, sentinel: 0, lookout: 0,
    hauler: 0, "water-runner": 0, caretaker: 0, quartermaster: 0, scout: 0, "colony-establisher": 0, reproducer: 0,
    miner: 0, "fiber-harvester": 0, herbalist: 0, smelter: 0, "rope-maker": 0, carpenter: 0, "charcoal-burner": 0, fletcher: 0, mechanist: 0
  };
  for (const unit of Object.values(wm.units?.byGoblinId || {})) {
    const role = unit?.roleState?.role || "forager";
    if (!Object.prototype.hasOwnProperty.call(roleCounts, role)) continue;
    roleCounts[role] += 1;
  }
  const governance = state.tribe?.governance || {};
  const leaderGoblinId = governance.leaderGoblinId || null;
  const leaderGoblin = leaderGoblinId ? state.goblins?.byId?.[leaderGoblinId] || null : null;

  return {
    worldHash: wm.worldHash,
    randomization: state.meta?.randomizationProfile
      ? {
          variantId: state.meta.randomizationProfile.variantId,
          worldSeed: state.meta.randomizationProfile.worldSeed,
          wildlifeSeed: state.meta.randomizationProfile.wildlifeSeed,
          flavorSeed: state.meta.randomizationProfile.flavorSeed,
          speciesKnobs: state.meta.randomizationProfile.speciesKnobs
        }
      : null,
    size: wm.size,
    overlayMode: wm.render.overlayMode,
    resources: {
      stock: state.tribe.resources,
      purposes: state.tribe.resourcePurposes || FALLBACK_RESOURCE_PURPOSES
    },
    governance: {
      leaderGoblinId,
      leaderName: leaderGoblin?.identity?.name || null,
      leaderAlive: Boolean(leaderGoblin?.flags?.alive && !leaderGoblin?.flags?.missing),
      policy: governance.policy || null,
      recommendations: governance.recommendations || null,
      runtime: governance.runtime || null
    },
    processing: {
      queue: state.worldMap?.structures?.processing?.queueIds?.length || 0,
      prioritySnapshot: state.worldMap?.structures?.processing?.prioritySnapshot || null
    },
    homes: {
      count: Object.keys(wm.units.byGoblinId || {}).length,
      villageHomes: Object.keys(wm.structures?.villageHomesByTileKey || {}).length,
      colonyOutposts: Object.keys(wm.structures?.colonyOutpostsByTileKey || {}).length,
      wallPlanCount: Object.keys(wm.structures?.wallPlansBySiteId || {}).length,
      wallPlanSiteIds: Object.keys(wm.structures?.wallPlansBySiteId || {}),
      outposts: Object.values(wm.structures?.outpostsById || {}).map((o) => ({
        id: o.id,
        kind: o.kind,
        priority: o.priority || "normal",
        tileX: o.tileX,
        tileY: o.tileY,
        status: o.runtime?.status || "seeded",
        unstableSinceTick: o.runtime?.unstableSinceTick ?? null,
        population: o.runtime?.population || 0,
        targetPopulation: o.runtime?.targetPopulation || 0,
        populationDeficit: o.runtime?.populationDeficit || 0,
        deficitByRole: o.runtime?.deficitByRole || null
      })),
      wallsBuilt: Object.keys(wm.structures?.wallsByTileKey || {}).length,
      threatMemory: {
        activeThreats: wm.structures?.threatMemory?.allIds?.length || 0,
        recentBreaches: wm.structures?.threatMemory?.recentBreaches?.length || 0
      },
      logistics: {
        drops: Object.keys(wm.structures?.resourceDropsByTileKey || {}).length,
        queue: wm.structures?.logistics?.queueIds?.length || 0
      },
      migration: {
        queue: wm.structures?.migration?.queueIds?.length || 0,
        created: wm.structures?.migration?.metrics?.jobsCreated || 0,
        completed: wm.structures?.migration?.metrics?.jobsCompleted || 0,
        failed: wm.structures?.migration?.metrics?.jobsFailed || 0
      },
      roles: roleCounts,
      rolePolicy: wm.structures?.rolePolicy || null,
      criticalNeedPreemption: wm.structures?.criticalNeedPreemption || null
    },
    wildlife: {
      total: wm.wildlife?.allIds?.length || 0,
      packs: Object.keys(wm.wildlife?.packsById || {}).length,
      hostileByKind: summarizeHostileWildlife(wm.wildlife),
      enemyOutposts: Object.keys(wm.structures?.enemyOutpostsByTileKey || {}).length,
      raceRuntimeConfigByKind: wm.wildlife?.raceRuntimeConfigByKind || null,
      visible: Boolean(wm.render.showDebugWildlife)
    },
    camera: {
      mode: wm.render.followTrackedGoblin ? "follow-tracked-goblin" : "free-roam",
      trackedGoblinId: state.debug?.trackedGoblinId || null,
      trackedWildlifeId: state.debug?.trackedWildlifeId || null
    },
    tuning: state.meta?.tuning || null,
    layers: wm.render?.showLayers || null,
    threatOverlayVisible: wm.render.showThreatOverlay !== false,
    selectedWildlife,
    selectedWildlifeHunt: selectedWildlife
      ? {
          id: selectedWildlife.id,
          kind: selectedWildlife.kind,
          aiState: selectedWildlife.aiState,
          targetType: selectedWildlife.targetType || null,
          targetId: selectedWildlife.targetId || null,
          huntState: selectedWildlife.huntState || null
        }
      : null,
    selectedRegion: region
      ? {
          id: region.id,
          biome: region.biome,
          elevation: Math.round(region.elevation * 100),
          moisture: Math.round(region.moisture * 100),
          temperature: Math.round(region.temperature * 100),
          resourcePotential: region.resourcePotential,
          hazardPressure: Math.round(region.hazardPressure * 100),
          topInfluence: selectedFaction
            ? { faction: factionName(selectedFaction[0]), value: Math.round(selectedFaction[1] * 100) }
            : null
        }
      : null,
    selectedSite: site,
    startCandidates
  };
}

function summarizeHostileWildlife(wildlife) {
  const out = { wolf: 0, barbarian: 0, human_raider: 0, elf_ranger: 0, shaman: 0, ogre: 0 };
  if (!wildlife?.allIds?.length) return out;
  for (const id of wildlife.allIds) {
    const creature = wildlife.byId?.[id];
    if (!creature || !creature.alive || !Object.prototype.hasOwnProperty.call(out, creature.kind)) continue;
    out[creature.kind] += 1;
  }
  return out;
}

function classify(v) {
  if (v >= 0.75) return "very high";
  if (v >= 0.55) return "high";
  if (v >= 0.35) return "moderate";
  if (v >= 0.2) return "low";
  return "very low";
}

function dominantInfluence(region) {
  return Object.entries(region.factionInfluence).sort((a, b) => b[1] - a[1])[0] || null;
}

export function buildHoverSummary(state) {
  const wm = state.worldMap;
  const regionId = wm.player.hoverRegionId || wm.player.selectedRegionId;
  if (!regionId || !wm.regionsById[regionId]) {
    return "Hover a region to see a plain-language summary of danger, resources, and faction pressure.";
  }

  const region = wm.regionsById[regionId];
  const intel = wm.intel.knownRegions[regionId]?.confidence ?? 0;
  const influence = dominantInfluence(region);
  const topFactionText = influence
    ? `${factionName(influence[0])} (${Math.round(influence[1] * 100)}% influence)`
    : "No dominant faction";

  const knownText = intel >= 0.8 ? "well-known" : intel >= 0.45 ? "partially known" : "mostly unknown";
  return `${region.biome} region (${knownText}). Danger is ${classify(region.hazardPressure)}; resources are ${classify(
    (region.resourcePotential.food + region.resourcePotential.ore + region.resourcePotential.salvage) / 3
  )}; dominant pressure: ${topFactionText}.`;
}

export function buildOverlayLegend(mode) {
  if (mode === "biome") {
    return [
      { label: "Forest", color: "#2d5a34", note: "balanced growth and food" },
      { label: "Swamp", color: "#35534a", note: "wet, slow travel, unstable" },
      { label: "Hills", color: "#635d44", note: "ore-rich, moderate risk" },
      { label: "Caves", color: "#3f4654", note: "resource pockets, hidden threats" },
      { label: "Ruins", color: "#6a5747", note: "salvage and relic potential" },
      { label: "Badlands", color: "#78513d", note: "harsh and dangerous" }
    ];
  }
  if (mode === "resources") {
    return [
      { label: "Low", color: "rgb(55,85,55)", note: "poor yields and slower growth" },
      { label: "Medium", color: "rgb(80,140,70)", note: "stable mixed output" },
      { label: "High", color: "rgb(105,190,90)", note: "strong food/ore/salvage value" }
    ];
  }
  if (mode === "hazard") {
    return [
      { label: "Low", color: "rgb(60,110,90)", note: "safer routes and events" },
      { label: "Medium", color: "rgb(140,95,80)", note: "regular interruptions" },
      { label: "High", color: "rgb(220,70,70)", note: "frequent danger and instability" }
    ];
  }
  return [
    { label: "Ashcap", color: "rgb(90,200,100)", note: "green channel intensity" },
    { label: "Ivory March", color: "rgb(120,130,220)", note: "blue channel intensity" },
    { label: "Redtooth", color: "rgb(220,80,90)", note: "red channel intensity" }
  ];
}
