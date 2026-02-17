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

function drawGrid(ctx, canvas, worldMap) {
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
}

function drawWalls(ctx, canvas, state) {
  const wm = state.worldMap;
  const assets = state.graphics;
  const style = entityRenderStyle(wm.camera.zoom);
  const bounds = visibleRegionBounds(wm, canvas);
  for (const wall of Object.values(wm.structures?.wallsByTileKey || {})) {
    const tileX = tileToChunkCoord(wall.microX);
    const tileY = tileToChunkCoord(wall.microY);
    if (tileX < bounds.minX || tileX > bounds.maxX || tileY < bounds.minY || tileY > bounds.maxY) continue;
    const px = tileToWorldCell(wall.microX + 0.5) * TILE;
    const py = tileToWorldCell(wall.microY + 0.5) * TILE;
    const size = UNIFORM_ENTITY_SIZE * style.sizeMul;
    drawEntityBackdrop(ctx, px, py, style);
    if (!drawIndexedSprite(ctx, assets, "wall", px - size * 0.5, py - size * 0.5, size, size)) {
      ctx.fillStyle = "rgba(130,130,130,0.92)";
      ctx.fillRect(px - size * 0.25, py - size * 0.25, size * 0.5, size * 0.5);
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

function drawMinimap(state, miniCtx, miniCanvas) {
  const worldMap = state.worldMap;
  const w = miniCanvas.width;
  const h = miniCanvas.height;
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
      }
    }
    worldMap.render.__minimapCache = { key: cacheKey, canvas: offscreen };
  }

  miniCtx.drawImage(worldMap.render.__minimapCache.canvas, 0, 0);

  miniCtx.strokeStyle = "#f8eab8";
  miniCtx.lineWidth = 1;
  const cellW = w / worldMap.width;
  const cellH = h / worldMap.height;
  const viewW = state.ui.mapCanvas.width / TILE / worldMap.camera.zoom;
  const viewH = state.ui.mapCanvas.height / TILE / worldMap.camera.zoom;
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
  if (!worldMap || !canvas) return;
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

  drawGrid(ctx, canvas, worldMap);
  if (layers.water !== false) drawWaterTiles(ctx, canvas, state);
  drawRegionMicroDetails(ctx, canvas, state);
  if (layers.resources !== false) drawHarvestNodes(ctx, canvas, state);
  drawDebugWildlife(ctx, canvas, state);
  if (layers.homes !== false) drawHomes(ctx, canvas, state);
  if (layers.walls !== false) drawWalls(ctx, canvas, state);
  if (layers.sites !== false) drawSites(ctx, state);
  if (layers.goblins !== false) drawGoblins(ctx, state);

  ctx.restore();

  miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawMinimap(state, miniCtx, miniCanvas);
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
  const wildlifeIds = state.worldMap.wildlife?.occupancyByMicroKey?.[microKeyStr] || [];
  const wildlifeId = wildlifeIds[0] || null;

  return { gx, gy, regionId, siteId, microX, microY, wildlifeId };
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
    homes: {
      count: Object.keys(wm.units.byGoblinId || {}).length,
      wallsBuilt: Object.keys(wm.structures?.wallsByTileKey || {}).length,
      threatMemory: {
        activeThreats: wm.structures?.threatMemory?.allIds?.length || 0,
        recentBreaches: wm.structures?.threatMemory?.recentBreaches?.length || 0
      }
    },
    wildlife: {
      total: wm.wildlife?.allIds?.length || 0,
      packs: Object.keys(wm.wildlife?.packsById || {}).length,
      visible: Boolean(wm.render.showDebugWildlife)
    },
    camera: {
      mode: wm.render.followTrackedGoblin ? "follow-tracked-goblin" : "free-roam",
      trackedGoblinId: state.debug?.trackedGoblinId || null,
      trackedWildlifeId: state.debug?.trackedWildlifeId || null
    },
    layers: wm.render?.showLayers || null,
    selectedWildlife,
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
