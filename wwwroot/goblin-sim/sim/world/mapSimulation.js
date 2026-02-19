import { decayIntel } from "./intel.js";
import { TILES_PER_CHUNK, tileKey, tileToChunkCoord, regionToMicroCenter } from "./scale.js";
import { createGoblin } from "../goblinFactory.js";
import { nextId } from "../ids.js";
import { initRng } from "../rng.js";

const NEIGHBOR_OFFSETS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 }
];

const HOME_RING = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 },
  { x: 2, y: 0 }, { x: -2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: -2 },
  { x: 2, y: 1 }, { x: -2, y: -1 }, { x: 1, y: 2 }, { x: -1, y: -2 }
];
const WALL_PLAN_BASE_RADIUS = 8;
const WALL_PLAN_MAX_RADIUS = 20;
const WALL_RESERVATION_TICKS = 18;
const ROLE_TASK_BLOCKED_COOLDOWN = 12;
const DEFAULT_ROLES = [
  "forager", "woodcutter", "fisherman", "hunter", "builder", "homebuilder", "sentinel", "lookout",
  "hauler", "water-runner", "caretaker", "quartermaster", "scout", "colony-establisher", "reproducer",
  "miner", "fiber-harvester", "herbalist", "smelter", "rope-maker", "carpenter", "charcoal-burner", "fletcher", "mechanist"
];
const THREAT_MEMORY_DECAY_TICKS = 160;
const LOOKOUT_DETECTION_RADIUS = 11;
const SCOUT_THREAT_DETECTION_RADIUS = 9;
const SCOUT_REPORT_COOLDOWN = 14;
const THREAT_DIRECT_RADIUS = 4.5;
const THREAT_LOCAL_RADIUS = 9;
const THREAT_RESPONSE_MEMORY_TICKS = 14;
const THREAT_MODE_EVENT_COOLDOWN = 6;
const THREAT_DEADLOCK_NO_PATH_TICKS = 10;
const THREAT_DEADLOCK_SUPPRESS_TICKS = 36;
const DEFENDER_MIN_VITALITY = 58;
const DEFENDER_MIN_MORALE = 42;
const DEFENDER_MAX_STRESS = 72;
const DEFEND_ATTACK_RANGE = 1.6;
const DEFEND_ATTACK_COOLDOWN_TICKS = 2;
const DEFEND_RANGED_ATTACK_RANGE = 6.5;
const DEFEND_RANGED_ATTACK_COOLDOWN_TICKS = 3;
const OUTPOST_FAILING_TICKS = 96;
const AUTO_CLOSE_FAILING_TICKS = 192;
const EVACUATION_MAX_TICKS = 144;
const EVACUATION_PROGRESS_EVENT_COOLDOWN = 16;
const DEFENSE_MAINTENANCE_CLAIM_TICKS = 20;
const CRITICAL_NEEDS_PREEMPTION_MIN_HOLD_TICKS = 18;
const CRITICAL_NEEDS_TRIGGER_COUNT = 6;
const CRITICAL_NEEDS_RELEASE_COUNT = 3;

function threatTuning(state) {
  const t = state.meta?.tuning?.threat || {};
  return {
    localRadius: Number.isFinite(t.localRadius) ? t.localRadius : THREAT_LOCAL_RADIUS,
    directRadius: Number.isFinite(t.directRadius) ? t.directRadius : THREAT_DIRECT_RADIUS
  };
}
const HYDRATION_REEVALUATE_TICKS = 3;
const ROLE_KEYS = [
  "forager", "woodcutter", "fisherman", "hunter", "builder", "homebuilder", "sentinel", "lookout",
  "hauler", "water-runner", "caretaker", "quartermaster", "scout", "colony-establisher", "reproducer",
  "miner", "fiber-harvester", "herbalist", "smelter", "rope-maker", "carpenter", "charcoal-burner", "fletcher", "mechanist"
];
const COLONY_ESTABLISH_COOLDOWN_TICKS = 28;
const REPRO_DAY_TICKS = 144;
const HOME_BUILD_COST_WOOD = 6;
const HOME_BUILD_COST_FOOD = 3;
const HOME_BUILD_COST_WATER = 2;
const HAULABLE_DROP_RESOURCES = ["wood", "mushrooms", "metal_ore", "fiber", "herbs", "metal_parts"];
const ADVANCED_NODE_REGEN_DAY_TICKS = 144;
const ADVANCED_GATHER_COOLDOWN_TICKS = 6;
const HOME_ACTION_RADIUS = 2.2;
const HOME_REST_RADIUS = 2.4;
const PROCESS_RECIPE_DEFS = {
  smelt_metal_parts: {
    key: "smelt_metal_parts",
    station: "smelter",
    durationTicks: 8,
    inputs: { metal_ore: 2, charcoal: 1 },
    outputs: { metal_parts: 1 }
  },
  craft_rope: {
    key: "craft_rope",
    station: "workshop",
    durationTicks: 6,
    inputs: { fiber: 2 },
    outputs: { rope: 1 }
  },
  craft_planks: {
    key: "craft_planks",
    station: "workshop",
    durationTicks: 6,
    inputs: { wood: 2 },
    outputs: { wood_planks: 1 }
  },
  burn_charcoal: {
    key: "burn_charcoal",
    station: "kiln",
    durationTicks: 7,
    inputs: { wood: 2 },
    outputs: { charcoal: 1, fuel: 1 }
  },
  craft_ammo_bolts: {
    key: "craft_ammo_bolts",
    station: "workshop",
    durationTicks: 8,
    inputs: { wood_planks: 1, metal_parts: 1 },
    outputs: { ammo_bolts: 2 }
  },
  craft_springs: {
    key: "craft_springs",
    station: "workshop",
    durationTicks: 9,
    inputs: { metal_parts: 2 },
    outputs: { springs: 1 }
  }
};
const PROCESS_PRIORITY_RULES = {
  smelt_metal_parts: { targetStock: 18, maxQueued: 3, basePriority: 1.05 },
  craft_rope: { targetStock: 16, maxQueued: 2, basePriority: 0.9 },
  craft_planks: { targetStock: 22, maxQueued: 3, basePriority: 1.0 },
  burn_charcoal: { targetStock: 16, maxQueued: 3, basePriority: 0.95 },
  craft_ammo_bolts: { targetStock: 14, maxQueued: 2, basePriority: 1.1 },
  craft_springs: { targetStock: 10, maxQueued: 2, basePriority: 0.95 }
};

function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash32(parts) {
  const text = parts.join("|");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand01(...parts) {
  return hash32(parts) / 4294967295;
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isWaterMicroTile(wm, microX, microY) {
  const tileX = clamp(tileToChunkCoord(microX), 0, wm.width - 1);
  const tileY = clamp(tileToChunkCoord(microY), 0, wm.height - 1);
  return Boolean(wm.waterTiles?.byTileKey?.[`${tileX},${tileY}`]);
}

function isHostileWildlifeKind(kind) {
  return kind === "wolf"
    || kind === "barbarian"
    || kind === "human_raider"
    || kind === "elf_ranger"
    || kind === "shaman"
    || kind === "ogre";
}

function nearSiteByTile(worldMap, x, y) {
  for (const site of Object.values(worldMap.sitesById)) {
    if (site.x === x && site.y === y) return site;
  }
  return null;
}

function parseMicroKey(key) {
  const [xText, yText] = String(key).split(",");
  return { microX: Number(xText), microY: Number(yText) };
}

function rasterizeLine(a, b) {
  const points = [];
  let x0 = a.x;
  let y0 = a.y;
  const x1 = b.x;
  const y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
}

function primaryWallPlanSiteId(wm) {
  return wm.player?.startingSiteId || "home";
}

function buildWallPlanSiteContexts(wm) {
  const contexts = [];
  const homeSiteId = wm.player?.startingSiteId || null;
  const homeSite = homeSiteId ? wm.sitesById?.[homeSiteId] : null;
  if (homeSite) {
    contexts.push({
      siteId: homeSiteId,
      kind: "home-site",
      homeSiteId,
      centerTileX: homeSite.x,
      centerTileY: homeSite.y,
      centerMicroX: regionToMicroCenter(homeSite.x),
      centerMicroY: regionToMicroCenter(homeSite.y)
    });
  }
  for (const outpost of Object.values(wm.structures?.colonyOutpostsByTileKey || {})) {
    contexts.push({
      siteId: `outpost:${outpost.outpostId || outpost.key}`,
      kind: "outpost",
      homeSiteId,
      centerTileX: outpost.tileX,
      centerTileY: outpost.tileY,
      centerMicroX: outpost.microX,
      centerMicroY: outpost.microY
    });
  }
  return contexts;
}

function wallPlanContextBySiteId(wm, siteId) {
  const contexts = buildWallPlanSiteContexts(wm);
  return contexts.find((ctx) => ctx.siteId === siteId) || null;
}

function primaryWallPlanContext(wm) {
  const primarySiteId = primaryWallPlanSiteId(wm);
  const found = wallPlanContextBySiteId(wm, primarySiteId);
  if (found) return found;
  return {
    siteId: primarySiteId,
    kind: "home-site",
    homeSiteId: primarySiteId,
    centerTileX: 0,
    centerTileY: 0,
    centerMicroX: 0,
    centerMicroY: 0
  };
}

function settlementFootprintHash(wm, siteContext = primaryWallPlanContext(wm)) {
  const items = [];
  const include = (microX, microY) => {
    if (siteContext.kind === "home-site") return true;
    const d = dist({ x: microX, y: microY }, { x: siteContext.centerMicroX, y: siteContext.centerMicroY });
    return d <= 48;
  };
  for (const unit of Object.values(wm.units?.byGoblinId || {})) {
    if (include(unit.homeMicroX, unit.homeMicroY)) items.push(`u:${unit.homeMicroX},${unit.homeMicroY}`);
  }
  for (const home of Object.values(wm.structures?.villageHomesByTileKey || {})) {
    if (include(home.microX, home.microY)) items.push(`h:${home.microX},${home.microY}`);
  }
  for (const outpost of Object.values(wm.structures?.colonyOutpostsByTileKey || {})) {
    if (include(outpost.microX, outpost.microY)) items.push(`o:${outpost.microX},${outpost.microY}`);
  }
  items.sort();
  return items.join("|");
}

function settlementAnchorOffsets(wm, centerMicroX, centerMicroY, radius, siteContext = primaryWallPlanContext(wm)) {
  const anchors = [];
  const seen = new Set();
  const tryAdd = (microX, microY) => {
    const k = `${microX},${microY}`;
    if (seen.has(k)) return;
    seen.add(k);
    const dx = microX - centerMicroX;
    const dy = microY - centerMicroY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < Math.max(2, radius * 0.55)) return;
    anchors.push({ angle: Math.atan2(dy, dx), distance });
  };
  const include = (microX, microY) => {
    if (siteContext.kind === "home-site") return true;
    const d = dist({ x: microX, y: microY }, { x: siteContext.centerMicroX, y: siteContext.centerMicroY });
    return d <= 48;
  };
  for (const unit of Object.values(wm.units?.byGoblinId || {})) {
    if (include(unit.homeMicroX, unit.homeMicroY)) tryAdd(unit.homeMicroX, unit.homeMicroY);
  }
  for (const home of Object.values(wm.structures?.villageHomesByTileKey || {})) {
    if (include(home.microX, home.microY)) tryAdd(home.microX, home.microY);
  }
  for (const outpost of Object.values(wm.structures?.colonyOutpostsByTileKey || {})) {
    if (include(outpost.microX, outpost.microY)) tryAdd(outpost.microX, outpost.microY);
  }
  return anchors;
}

function angleDelta(a, b) {
  let d = Math.abs(a - b);
  while (d > Math.PI) d = Math.abs(d - Math.PI * 2);
  return d;
}

function buildTexturedPerimeterOffsets(wm, siteId, radius, centerMicroX, centerMicroY, siteContext = primaryWallPlanContext(wm)) {
  const sampleCount = Math.max(56, radius * 28);
  const noisyPoints = [];
  const jitter = 0.85;
  const anchors = settlementAnchorOffsets(wm, centerMicroX, centerMicroY, radius, siteContext);
  const phaseA = rand01("wall-lobe-a", wm.seed, siteId || "none", radius) * Math.PI * 2;
  const phaseB = rand01("wall-lobe-b", wm.seed, siteId || "none", radius) * Math.PI * 2;

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleCount;
    const angle = t * Math.PI * 2;
    const n = rand01("wall-texture", wm.seed, siteId || "none", radius, i);
    let noisyRadius = radius + (n - 0.5) * jitter * 2;

    // Keep the wall organic and explicitly non-circular.
    const lobe = Math.sin(angle * 2 + phaseA) * 0.65 + Math.sin(angle * 3 + phaseB) * 0.4;
    noisyRadius += lobe;

    // Pull perimeter outward toward outer homes/outposts in matching directions.
    for (const anchor of anchors) {
      const dAng = angleDelta(angle, anchor.angle);
      if (dAng > 0.72) continue;
      const influence = 1 - (dAng / 0.72);
      const targetRadius = anchor.distance + 2.4;
      if (targetRadius > noisyRadius) noisyRadius = lerp(noisyRadius, targetRadius, influence * influence * 0.9);
    }

    noisyRadius = clamp(noisyRadius, 1.5, WALL_PLAN_MAX_RADIUS + 1.5);
    noisyPoints.push({
      x: Math.round(Math.cos(angle) * noisyRadius),
      y: Math.round(Math.sin(angle) * noisyRadius)
    });
  }

  const keySet = new Set();
  const points = [];
  for (let i = 0; i < noisyPoints.length; i += 1) {
    const from = noisyPoints[i];
    const to = noisyPoints[(i + 1) % noisyPoints.length];
    for (const p of rasterizeLine(from, to)) {
      const key = `${p.x},${p.y}`;
      if (keySet.has(key)) continue;
      keySet.add(key);
      points.push(p);
    }
  }

  points.sort((a, b) => {
    const angleA = Math.atan2(a.x, -a.y);
    const angleB = Math.atan2(b.x, -b.y);
    if (angleA !== angleB) return angleA - angleB;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  return points;
}

function isWallBlockedTile(wm, microX, microY, centerMicroX, centerMicroY) {
  if (microX < 0 || microY < 0 || microX >= wm.width * TILES_PER_CHUNK || microY >= wm.height * TILES_PER_CHUNK) return true;
  const key = tileKey(microX, microY);
  if (wm.waterSources.byTileKey[key]) return true;
  if (microX === centerMicroX && microY === centerMicroY) return true;
  const tileX = tileToChunkCoord(microX);
  const tileY = tileToChunkCoord(microY);
  if (nearSiteByTile(wm, tileX, tileY)) return true;
  return false;
}

function countWallNeighbors(plan, key) {
  const { microX, microY } = parseMicroKey(key);
  const step = 1;
  let neighbors = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nKey = tileKey(microX + dx * step, microY + dy * step);
      const status = plan.tileStatusByKey[nKey];
      if (status === "planned" || status === "built") neighbors += 1;
    }
  }
  return neighbors;
}

function isAdjacentWallKey(aKey, bKey) {
  const a = parseMicroKey(aKey);
  const b = parseMicroKey(bKey);
  const step = 1;
  const dx = Math.abs(a.microX - b.microX);
  const dy = Math.abs(a.microY - b.microY);
  if (dx === 0 && dy === 0) return false;
  return dx <= step && dy <= step;
}

function wallStatusIsActive(status) {
  return status === "planned" || status === "built";
}

function isBuildableBridgeTile(wm, microX, microY, centerMicroX, centerMicroY) {
  return !isWallBlockedTile(wm, microX, microY, centerMicroX, centerMicroY);
}

function tilePathBetween(aTile, bTile) {
  const points = [];
  let x0 = aTile.x;
  let y0 = aTile.y;
  const x1 = bTile.x;
  const y1 = bTile.y;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
}

function bridgeWallGapIfPossible(plan, wm, fromKey, toKey, centerMicroX, centerMicroY) {
  if (isAdjacentWallKey(fromKey, toKey)) return true;
  const from = parseMicroKey(fromKey);
  const to = parseMicroKey(toKey);
  const path = tilePathBetween({ x: from.microX, y: from.microY }, { x: to.microX, y: to.microY });

  for (const tile of path) {
    if (tile.x < 0 || tile.y < 0 || tile.x >= wm.width * TILES_PER_CHUNK || tile.y >= wm.height * TILES_PER_CHUNK) return false;
    const microX = tile.x;
    const microY = tile.y;
    const key = tileKey(microX, microY);
    const status = plan.tileStatusByKey[key];
    if (wallStatusIsActive(status)) continue;
    if (!isBuildableBridgeTile(wm, microX, microY, centerMicroX, centerMicroY)) return false;
    plan.tileStatusByKey[key] = "planned";
    if (!Object.prototype.hasOwnProperty.call(plan.assignedGoblinByKey, key)) {
      plan.assignedGoblinByKey[key] = null;
      plan.assignedUntilTickByKey[key] = 0;
      plan.orderedTileKeys.push(key);
    }
  }
  return true;
}

function enforceWallContinuity(plan, wm, centerMicroX, centerMicroY) {
  const activeLoopKeys = plan.orderedTileKeys.filter((key) => wallStatusIsActive(plan.tileStatusByKey[key]));
  if (activeLoopKeys.length < 3) return { ok: false, gaps: 1 };

  let gaps = 0;
  for (let i = 0; i < activeLoopKeys.length; i += 1) {
    const a = activeLoopKeys[i];
    const b = activeLoopKeys[(i + 1) % activeLoopKeys.length];
    if (!bridgeWallGapIfPossible(plan, wm, a, b, centerMicroX, centerMicroY)) gaps += 1;
  }

  // Verify one connected component after bridging.
  const active = plan.orderedTileKeys.filter((key) => wallStatusIsActive(plan.tileStatusByKey[key]));
  if (!active.length) return { ok: false, gaps: gaps + 1 };
  const visited = new Set();
  const stack = [active[0]];
  visited.add(active[0]);
  while (stack.length) {
    const key = stack.pop();
    const base = parseMicroKey(key);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nextKey = tileKey(base.microX + dx, base.microY + dy);
        if (!wallStatusIsActive(plan.tileStatusByKey[nextKey])) continue;
        if (visited.has(nextKey)) continue;
        visited.add(nextKey);
        stack.push(nextKey);
      }
    }
  }
  if (visited.size !== active.length) return { ok: false, gaps: gaps + 1 };
  return { ok: gaps === 0, gaps };
}

function pruneWallCaps(plan) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of plan.orderedTileKeys) {
      if (plan.tileStatusByKey[key] !== "planned") continue;
      const neighbors = countWallNeighbors(plan, key);
      if (neighbors <= 1) {
        plan.tileStatusByKey[key] = "blocked";
        changed = true;
      }
    }
  }
}

function buildWallPlanForRadius(wm, tick, radius, siteContext = primaryWallPlanContext(wm)) {
  if (!siteContext) return null;
  const centerTileX = siteContext.centerTileX;
  const centerTileY = siteContext.centerTileY;
  const centerMicroX = siteContext.centerMicroX;
  const centerMicroY = siteContext.centerMicroY;
  const offsets = buildTexturedPerimeterOffsets(wm, siteContext.siteId, radius, centerMicroX, centerMicroY, siteContext);
  const gateKeys = [];

  const tileStatusByKey = {};
  const assignedGoblinByKey = {};
  const assignedUntilTickByKey = {};
  const orderedTileKeys = [];
  let blockedCount = 0;

  for (const off of offsets) {
    const microX = centerMicroX + off.x;
    const microY = centerMicroY + off.y;
    if (microX < 0 || microY < 0 || microX >= wm.width * TILES_PER_CHUNK || microY >= wm.height * TILES_PER_CHUNK) continue;
    const key = tileKey(microX, microY);
    const blocked = isWallBlockedTile(wm, microX, microY, centerMicroX, centerMicroY);
    const built = Boolean(wm.structures?.wallsByTileKey?.[key]);
    if (blocked) blockedCount += 1;
    if (built) tileStatusByKey[key] = "built";
    else if (gateKeys.includes(key)) tileStatusByKey[key] = "reserved";
    else if (blocked) tileStatusByKey[key] = "blocked";
    else tileStatusByKey[key] = "planned";
    assignedGoblinByKey[key] = null;
    assignedUntilTickByKey[key] = 0;
    orderedTileKeys.push(key);
  }

  const blockedRatio = orderedTileKeys.length ? blockedCount / orderedTileKeys.length : 1;
  const plan = {
    siteId: siteContext.siteId,
    planId: `wallplan-${siteContext.siteId}-${tick}-${radius}`,
    homeSiteId: siteContext.homeSiteId || siteContext.siteId,
    centerTileX,
    centerTileY,
    desiredRadius: radius,
    gateTileKeys: gateKeys,
    orderedTileKeys,
    tileStatusByKey,
    assignedGoblinByKey,
    assignedUntilTickByKey,
    lastPlannedTick: tick,
    completedAtTick: null,
    blockedRatio,
    continuityGaps: 0
  };
  plan.footprintHash = settlementFootprintHash(wm, siteContext);
  const continuity = enforceWallContinuity(plan, wm, centerMicroX, centerMicroY);
  plan.continuityGaps = continuity.gaps;
  pruneWallCaps(plan);
  const blockedAfterPrune = plan.orderedTileKeys.reduce((count, key) => count + (plan.tileStatusByKey[key] === "blocked" ? 1 : 0), 0);
  plan.blockedRatio = plan.orderedTileKeys.length ? blockedAfterPrune / plan.orderedTileKeys.length : 1;
  return plan;
}

function createWallPlan(wm, tick, siteContext = primaryWallPlanContext(wm)) {
  const attemptStart = suggestedWallPlanRadius(wm, siteContext);
  let attemptRadius = attemptStart;
  while (attemptRadius <= WALL_PLAN_MAX_RADIUS) {
    const plan = buildWallPlanForRadius(wm, tick, attemptRadius, siteContext);
    if (!plan) return null;
    if (plan.continuityGaps === 0 && plan.blockedRatio <= 0.35) return plan;
    attemptRadius += 1;
  }
  return buildWallPlanForRadius(wm, tick, Math.max(WALL_PLAN_MAX_RADIUS, attemptStart), siteContext);
}

function suggestedWallPlanRadius(wm, siteContext = primaryWallPlanContext(wm)) {
  if (!siteContext) return WALL_PLAN_BASE_RADIUS;
  const center = { x: siteContext.centerMicroX, y: siteContext.centerMicroY };
  let maxDist = 0;
  const include = (microX, microY) => {
    if (siteContext.kind === "home-site") return true;
    const d = dist({ x: microX, y: microY }, center);
    return d <= 52;
  };

  for (const unit of Object.values(wm.units?.byGoblinId || {})) {
    if (!include(unit.homeMicroX, unit.homeMicroY)) continue;
    const d = dist(center, { x: unit.homeMicroX, y: unit.homeMicroY });
    if (d > maxDist) maxDist = d;
  }
  for (const home of Object.values(wm.structures?.villageHomesByTileKey || {})) {
    if (!include(home.microX, home.microY)) continue;
    const d = dist(center, { x: home.microX, y: home.microY });
    if (d > maxDist) maxDist = d;
  }
  for (const outpost of Object.values(wm.structures?.colonyOutpostsByTileKey || {})) {
    if (!include(outpost.microX, outpost.microY)) continue;
    const d = dist(center, { x: outpost.microX, y: outpost.microY });
    if (d > maxDist) maxDist = d;
  }

  return clamp(Math.ceil(maxDist + 3), WALL_PLAN_BASE_RADIUS, WALL_PLAN_MAX_RADIUS);
}

function ensureWallPlanStorage(wm) {
  wm.structures = wm.structures || {};
  wm.structures.wallPlansBySiteId = wm.structures.wallPlansBySiteId || {};
  wm.structures.wallPlanFootprintHashBySiteId = wm.structures.wallPlanFootprintHashBySiteId || {};
  const primarySiteId = primaryWallPlanSiteId(wm);
  const plansBySiteId = wm.structures.wallPlansBySiteId;
  if (wm.structures.wallPlan && !plansBySiteId[primarySiteId]) {
    plansBySiteId[primarySiteId] = wm.structures.wallPlan;
  }
  if (!wm.structures.wallPlan && plansBySiteId[primarySiteId]) {
    wm.structures.wallPlan = plansBySiteId[primarySiteId];
  }
  for (const [siteId, plan] of Object.entries(plansBySiteId)) {
    if (!plan) continue;
    if (!plan.siteId) plan.siteId = siteId;
  }
  return { plansBySiteId, primarySiteId };
}

function getPrimaryWallPlan(wm) {
  ensureWallPlanStorage(wm);
  return wm.structures.wallPlan || null;
}

function getWallPlanForSite(wm, siteId) {
  const { plansBySiteId } = ensureWallPlanStorage(wm);
  return plansBySiteId[siteId] || null;
}

function setWallPlanForSite(wm, siteId, plan) {
  const { plansBySiteId, primarySiteId } = ensureWallPlanStorage(wm);
  if (plan) {
    plan.siteId = siteId;
    plansBySiteId[siteId] = plan;
  } else {
    delete plansBySiteId[siteId];
  }
  wm.structures.wallPlan = plansBySiteId[primarySiteId] || null;
  return plansBySiteId[siteId] || null;
}

function setPrimaryWallPlan(wm, plan) {
  const { primarySiteId } = ensureWallPlanStorage(wm);
  setWallPlanForSite(wm, primarySiteId, plan);
  return getPrimaryWallPlan(wm);
}

function allWallPlans(wm) {
  const { plansBySiteId } = ensureWallPlanStorage(wm);
  return Object.values(plansBySiteId).filter(Boolean);
}

function countPlannedWallsInPlan(plan) {
  if (!plan?.orderedTileKeys?.length) return 0;
  return plan.orderedTileKeys.reduce((n, key) => n + (plan.tileStatusByKey[key] === "planned" ? 1 : 0), 0);
}

function countPlannedWallsAcrossPlans(wm) {
  return allWallPlans(wm).reduce((sum, plan) => sum + countPlannedWallsInPlan(plan), 0);
}

function findWallPlanContainingKey(wm, wallKey) {
  for (const plan of allWallPlans(wm)) {
    if (Object.prototype.hasOwnProperty.call(plan.tileStatusByKey || {}, wallKey)) return plan;
  }
  return null;
}

function wallPlanContextLabel(wm, siteContext) {
  if (siteContext.kind === "home-site") return wm.sitesById?.[siteContext.siteId]?.name || "home site";
  return `outpost ${siteContext.siteId.replace(/^outpost:/, "")}`;
}

function assignWallPlanForContextIfNeeded(state, siteContext, tick, events) {
  const wm = state.worldMap;
  const existing = getWallPlanForSite(wm, siteContext.siteId);
  const siteId = siteContext.siteId;
  const shouldRebuild = !existing || existing.siteId !== siteId || existing.homeSiteId !== siteContext.homeSiteId;
  if (!shouldRebuild) return existing;

  const nextPlan = createWallPlan(wm, tick, siteContext);
  setWallPlanForSite(wm, siteId, nextPlan);
  if (nextPlan) {
    events.push({
      type: "WALL_PLAN_CREATED",
      siteId,
      planId: nextPlan.planId,
      text: `Wall plan created around ${wallPlanContextLabel(wm, siteContext)} (radius ${nextPlan.desiredRadius}).`
    });
  }
  return nextPlan;
}

function refreshWallPlan(state, tick, events) {
  const wm = state.worldMap;
  const { plansBySiteId, primarySiteId } = ensureWallPlanStorage(wm);
  const contexts = buildWallPlanSiteContexts(wm);
  const validSiteIds = new Set(contexts.map((ctx) => ctx.siteId));
  for (const siteId of Object.keys(plansBySiteId)) {
    if (siteId === primarySiteId) continue;
    if (!validSiteIds.has(siteId)) delete plansBySiteId[siteId];
  }

  wm.structures.wallPlanFootprintHashBySiteId = wm.structures.wallPlanFootprintHashBySiteId || {};
  for (const siteContext of contexts) {
    wm.structures.wallPlanFootprintHashBySiteId[siteContext.siteId] = settlementFootprintHash(wm, siteContext);
    let plan = assignWallPlanForContextIfNeeded(state, siteContext, tick, events);
    if (!plan) continue;

    const currentFootprintHash = settlementFootprintHash(wm, siteContext);
    const requiredRadius = suggestedWallPlanRadius(wm, siteContext);
    if (requiredRadius > (plan.desiredRadius || WALL_PLAN_BASE_RADIUS) || plan.footprintHash !== currentFootprintHash) {
      plan = setWallPlanForSite(wm, siteContext.siteId, createWallPlan(wm, tick, siteContext));
      if (plan) {
        events.push({
          type: "WALL_PLAN_REPLANNED",
          siteId: siteContext.siteId,
          planId: plan.planId,
          text: `Wall plan adjusted to settlement footprint (radius ${plan.desiredRadius}).`
        });
      }
      continue;
    }

    let needsReplan = false;
    for (const key of plan.orderedTileKeys) {
      const status = plan.tileStatusByKey[key];
      if (status === "built") continue;
      const { microX, microY } = parseMicroKey(key);
      const blocked = isWallBlockedTile(wm, microX, microY, regionToMicroCenter(plan.centerTileX), regionToMicroCenter(plan.centerTileY));
      if (status === "reserved" && blocked) needsReplan = true;
      if (status === "planned" && blocked) plan.tileStatusByKey[key] = "blocked";

      const assignedGoblinId = plan.assignedGoblinByKey[key];
      const assignedUntil = plan.assignedUntilTickByKey[key] || 0;
      if (assignedGoblinId && assignedUntil < tick) {
        plan.assignedGoblinByKey[key] = null;
        plan.assignedUntilTickByKey[key] = 0;
      }
    }

    if (needsReplan) {
      plan = setWallPlanForSite(wm, siteContext.siteId, createWallPlan(wm, tick, siteContext));
      if (plan) {
        events.push({
          type: "WALL_PLAN_REPLANNED",
          siteId: siteContext.siteId,
          planId: plan.planId,
          text: "Wall plan was replanned due to blocked gate access."
        });
      }
    }
  }
  return getPrimaryWallPlan(wm);
}

function maybeCompleteWallPlan(state, tick, events) {
  const wm = state.worldMap;
  const { plansBySiteId } = ensureWallPlanStorage(wm);
  for (const plan of Object.values(plansBySiteId)) {
    if (!plan || plan.completedAtTick !== null) continue;
    const remaining = plan.orderedTileKeys.some((key) => plan.tileStatusByKey[key] === "planned");
    if (remaining) continue;
    plan.completedAtTick = tick;
    events.push({
      type: "WALL_PLAN_COMPLETED",
      siteId: plan.siteId || plan.homeSiteId,
      planId: plan.planId,
      text: "Settlement wall plan completed."
    });
  }
}

function ensureThreatMemory(wm) {
  wm.structures = wm.structures || {};
  const fallback = {
    itemsById: {},
    allIds: [],
    cursor: 0,
    lastThreatEventTickBySource: {},
    recentBreaches: []
  };
  if (!wm.structures.threatMemory) {
    wm.structures.threatMemory = fallback;
    return wm.structures.threatMemory;
  }
  const mem = wm.structures.threatMemory;
  mem.itemsById = mem.itemsById || {};
  mem.allIds = mem.allIds || [];
  if (typeof mem.cursor !== "number") mem.cursor = 0;
  mem.lastThreatEventTickBySource = mem.lastThreatEventTickBySource || {};
  mem.recentBreaches = mem.recentBreaches || [];
  return mem;
}

function upsertThreatMemory(state, tick, data) {
  const wm = state.worldMap;
  const mem = ensureThreatMemory(wm);
  const id = data.id || `threat-${++mem.cursor}`;
  let item = mem.itemsById[id];
  if (!item) {
    item = {
      id,
      kind: data.kind || "unknown",
      sourceId: data.sourceId || null,
      microX: data.microX,
      microY: data.microY,
      confidence: data.confidence || 0.4,
      firstSeenTick: tick,
      lastSeenTick: tick
    };
    mem.itemsById[id] = item;
    mem.allIds.push(id);
  } else {
    item.kind = data.kind || item.kind;
    item.sourceId = data.sourceId || item.sourceId || null;
    item.microX = data.microX;
    item.microY = data.microY;
    item.confidence = Math.max(item.confidence || 0, data.confidence || 0.4);
    item.lastSeenTick = tick;
  }
  return item;
}

function decayThreatMemory(state, tick) {
  const wm = state.worldMap;
  const mem = ensureThreatMemory(wm);
  const keepIds = [];
  for (const id of mem.allIds) {
    const item = mem.itemsById[id];
    if (!item) continue;
    const age = tick - (item.lastSeenTick || 0);
    if (age > THREAT_MEMORY_DECAY_TICKS) {
      delete mem.itemsById[id];
      continue;
    }
    if (age > 0) {
      const decay = 1 - age / (THREAT_MEMORY_DECAY_TICKS * 1.2);
      item.confidence = clamp((item.confidence || 0.5) * decay, 0.08, 1);
    }
    keepIds.push(id);
  }
  mem.allIds = keepIds;
  mem.recentBreaches = mem.recentBreaches.filter((b) => tick - b.tick <= THREAT_MEMORY_DECAY_TICKS);
}

function nearestHomeDistance(wm, point) {
  let best = Infinity;
  for (const unit of Object.values(wm.units?.byGoblinId || {})) {
    const d = dist(point, { x: unit.homeMicroX, y: unit.homeMicroY });
    if (d < best) best = d;
  }
  return best;
}

function updateThreatMemoryFromWildlife(state, tick) {
  const wm = state.worldMap;
  const wildlife = wm.wildlife;
  if (!wildlife?.allIds?.length) return;
  for (const id of wildlife.allIds) {
    const creature = wildlife.byId[id];
    if (!creature || !creature.alive || !isHostileWildlifeKind(creature.kind)) continue;
    const nearestHome = nearestHomeDistance(wm, { x: creature.microX, y: creature.microY });
    if (!Number.isFinite(nearestHome) || nearestHome > 20) continue;
    const confidence = clamp(1 - nearestHome / 20, 0.2, 0.95);
    upsertThreatMemory(state, tick, {
      id: `threat-${creature.id}`,
      sourceId: creature.id,
      kind: creature.kind,
      microX: creature.microX,
      microY: creature.microY,
      confidence
    });
  }
}

function syncWallPlanBreaches(state, tick, events) {
  const wm = state.worldMap;
  const { plansBySiteId } = ensureWallPlanStorage(wm);
  const mem = ensureThreatMemory(wm);
  for (const plan of Object.values(plansBySiteId)) {
    if (!plan) continue;
    for (const key of plan.orderedTileKeys) {
      const status = plan.tileStatusByKey[key];
      if (status !== "built") continue;
      if (wm.structures.wallsByTileKey[key]) continue;
      plan.tileStatusByKey[key] = "planned";
      plan.breachedByKey = plan.breachedByKey || {};
      plan.breachedByKey[key] = tick;
      const { microX, microY } = parseMicroKey(key);
      mem.recentBreaches.push({ key, microX, microY, tick, siteId: plan.siteId || plan.homeSiteId });
      events.push({
        type: "WALL_BREACHED",
        siteId: plan.siteId || plan.homeSiteId,
        microX,
        microY,
        tileX: tileToChunkCoord(microX),
        tileY: tileToChunkCoord(microY),
        text: "A wall segment was breached and marked for rebuild."
      });
    }
  }
}

function assignHomeTile(worldMap, index) {
  const start = worldMap.player.startingSiteId ? worldMap.sitesById[worldMap.player.startingSiteId] : null;
  if (!start) return { x: 0, y: 0 };
  const maxSearch = Math.max(96, worldMap.width * worldMap.height);
  const tried = new Set();
  for (let step = 0; step < maxSearch; step += 1) {
    const offset = homeOffsetForIndex(index + step);
    const x = clamp(start.x + offset.x, 0, worldMap.width - 1);
    const y = clamp(start.y + offset.y, 0, worldMap.height - 1);
    const key = `${x},${y}`;
    if (tried.has(key)) continue;
    tried.add(key);
    if (homeTileBlocked(worldMap, x, y)) continue;
    return { x, y };
  }
  return { x: start.x, y: start.y };
}

function homeOffsetForIndex(index) {
  if (index < HOME_RING.length) return HOME_RING[index];
  let remaining = index - HOME_RING.length;
  for (let radius = 3; radius <= 80; radius += 1) {
    const ring = [];
    for (let dx = -radius; dx <= radius; dx += 1) {
      const dy = radius - Math.abs(dx);
      ring.push({ x: dx, y: dy });
      if (dy !== 0) ring.push({ x: dx, y: -dy });
    }
    if (remaining < ring.length) return ring[remaining];
    remaining -= ring.length;
  }
  return { x: 0, y: 0 };
}

function homeTileBlocked(worldMap, tileX, tileY) {
  const microX = regionToMicroCenter(tileX);
  const microY = regionToMicroCenter(tileY);
  if (isWaterMicroTile(worldMap, microX, microY)) return true;
  if (worldMap.structures?.wallsByTileKey?.[tileKey(microX, microY)]) return true;
  for (const unit of Object.values(worldMap.units?.byGoblinId || {})) {
    if (!unit) continue;
    if (unit.homeTileX === tileX && unit.homeTileY === tileY) return true;
  }
  return false;
}

function ensureOutpostState(state) {
  const wm = state.worldMap;
  wm.structures = wm.structures || {};
  wm.structures.outpostsById = wm.structures.outpostsById || {};
  wm.structures.outpostIds = wm.structures.outpostIds || [];
  wm.structures.outpostIndexByTileKey = wm.structures.outpostIndexByTileKey || {};
  const outpostsById = wm.structures.outpostsById;
  const outpostIds = wm.structures.outpostIds;
  const indexByTile = wm.structures.outpostIndexByTileKey;

  const startId = "outpost-start";
  const startSiteId = wm.player?.startingSiteId || null;
  const startSite = startSiteId ? wm.sitesById?.[startSiteId] : null;
  if (startSite) {
    const microX = regionToMicroCenter(startSite.x);
    const microY = regionToMicroCenter(startSite.y);
    outpostsById[startId] = {
      id: startId,
      kind: "starting",
      key: tileKey(microX, microY),
      siteId: startSite.id,
      tileX: startSite.x,
      tileY: startSite.y,
      microX,
      microY,
      foundedAtTick: 0,
      priority: outpostsById[startId]?.priority || "normal",
      runtime: outpostsById[startId]?.runtime || null
    };
    if (!outpostIds.includes(startId)) outpostIds.push(startId);
    indexByTile[`${startSite.x},${startSite.y}`] = startId;
  }

  const liveFrontierIds = new Set();
  for (const cp of Object.values(wm.structures.colonyOutpostsByTileKey || {})) {
    if (!cp) continue;
    if (cp.abandoned) continue;
    const id = cp.outpostId || `outpost-frontier-${cp.key}`;
    cp.outpostId = id;
    liveFrontierIds.add(id);
    outpostsById[id] = {
      id,
      kind: "frontier",
      key: cp.key,
      siteId: null,
      tileX: cp.tileX,
      tileY: cp.tileY,
      microX: cp.microX,
      microY: cp.microY,
      foundedAtTick: cp.foundedAtTick || state.meta.tick || 0,
      priority: outpostsById[id]?.priority || "frontier",
      founderGoblinId: cp.founderGoblinId,
      runtime: outpostsById[id]?.runtime || null
    };
    if (!outpostIds.includes(id)) outpostIds.push(id);
    indexByTile[`${cp.tileX},${cp.tileY}`] = id;
  }

  for (const id of Object.keys(outpostsById)) {
    if (id === startId) continue;
    if (outpostsById[id]?.kind !== "frontier") continue;
    if (!liveFrontierIds.has(id)) {
      delete outpostsById[id];
      const idx = outpostIds.indexOf(id);
      if (idx >= 0) outpostIds.splice(idx, 1);
    }
  }

  const totalGoblins = Math.max(1, state.goblins?.allIds?.length || 1);
  const defaultFrontierTarget = clamp(Math.round(totalGoblins * 0.2), 2, 8);
  const roleKeys = ["forager", "builder", "water-runner", "sentinel"];
  const populations = {};
  const roleCountsByOutpost = {};
  for (const id of outpostIds) {
    populations[id] = 0;
    roleCountsByOutpost[id] = {};
    for (const rk of roleKeys) roleCountsByOutpost[id][rk] = 0;
  }

  for (const goblinId of state.goblins.allIds) {
    const unit = wm.units?.byGoblinId?.[goblinId];
    if (!unit?.home?.outpostId || !outpostsById[unit.home.outpostId]) continue;
    const outpostId = unit.home.outpostId;
    populations[outpostId] = (populations[outpostId] || 0) + 1;
    const role = unit.roleState?.role || "forager";
    if (Object.prototype.hasOwnProperty.call(roleCountsByOutpost[outpostId], role)) {
      roleCountsByOutpost[outpostId][role] += 1;
    }
  }

  for (const id of outpostIds) {
    const outpost = outpostsById[id];
    const isFrontier = outpost.kind === "frontier";
    let targetPopulation = isFrontier
      ? defaultFrontierTarget
      : Math.max(1, totalGoblins - (outpostIds.length - 1) * Math.max(2, Math.floor(defaultFrontierTarget * 0.75)));
    if (outpost.priority === "critical") targetPopulation += 2;
    const minWorkersByRole = isFrontier
      ? { forager: 1, builder: 1, "water-runner": 1, sentinel: 1 }
      : { forager: 1, builder: 1, "water-runner": 1, sentinel: 1 };
    const deficitByRole = {};
    for (const rk of roleKeys) {
      deficitByRole[rk] = Math.max(0, (minWorkersByRole[rk] || 0) - (roleCountsByOutpost[id]?.[rk] || 0));
    }
    const previousRuntime = outpost.runtime || {};
    outpost.runtime = {
      ...previousRuntime,
      targetPopulation,
      maxPopulation: Math.max(targetPopulation, targetPopulation + 4),
      minWorkersByRole,
      deficitByRole,
      population: populations[id] || 0,
      populationDeficit: Math.max(0, targetPopulation - (populations[id] || 0)),
      lastComputedTick: state.meta.tick
    };
  }
}

function syncUnitHomeRecord(state, unit, goblin, tick) {
  const wm = state.worldMap;
  wm.structures = wm.structures || {};
  wm.structures.outpostIndexByTileKey = wm.structures.outpostIndexByTileKey || {};
  const startOutpostId = "outpost-start";

  const fallbackMicroX = Number.isFinite(unit.homeMicroX) ? unit.homeMicroX : unit.microX;
  const fallbackMicroY = Number.isFinite(unit.homeMicroY) ? unit.homeMicroY : unit.microY;
  const fallbackTileX = Number.isFinite(unit.homeTileX) ? unit.homeTileX : tileToChunkCoord(fallbackMicroX);
  const fallbackTileY = Number.isFinite(unit.homeTileY) ? unit.homeTileY : tileToChunkCoord(fallbackMicroY);
  const mappedOutpostId = wm.structures.outpostIndexByTileKey?.[`${fallbackTileX},${fallbackTileY}`];
  const outpostId = unit.home?.outpostId || mappedOutpostId || startOutpostId;

  if (!unit.home) {
    unit.home = {
      outpostId,
      microX: fallbackMicroX,
      microY: fallbackMicroY,
      claimedAtTick: tick,
      status: "resident"
    };
  } else {
    if (!unit.home.outpostId) unit.home.outpostId = outpostId;
    if (!Number.isFinite(unit.home.microX)) unit.home.microX = fallbackMicroX;
    if (!Number.isFinite(unit.home.microY)) unit.home.microY = fallbackMicroY;
    if (!Number.isFinite(unit.home.claimedAtTick)) unit.home.claimedAtTick = tick;
    if (!unit.home.status) unit.home.status = "resident";
  }

  unit.homeMicroX = unit.home.microX;
  unit.homeMicroY = unit.home.microY;
  unit.homeTileX = tileToChunkCoord(unit.home.microX);
  unit.homeTileY = tileToChunkCoord(unit.home.microY);

  if (goblin) {
    goblin.modData = goblin.modData || {};
    goblin.modData.home = {
      outpostId: unit.home.outpostId,
      tileX: unit.homeTileX,
      tileY: unit.homeTileY,
      siteId: unit.homeSiteId
    };
  }
}

function initUnitState(state) {
  const wm = state.worldMap;
  if (!wm?.player?.startingSiteId) return;

  let idx = 0;
  const claimedHomeKeys = new Set();
  for (const goblinId of state.goblins.allIds) {
    const goblin = state.goblins.byId[goblinId];
    if (!goblin) continue;

    if (!wm.units.byGoblinId[goblinId]) {
      const home = assignHomeTile(wm, idx);
      const role = defaultRoleForIndex(idx);
      idx += 1;
      const homeMicroX = regionToMicroCenter(home.x);
      const homeMicroY = regionToMicroCenter(home.y);
      goblin.social = goblin.social || {};
      if (!goblin.social.role) goblin.social.role = role;

      wm.units.byGoblinId[goblinId] = {
        goblinId,
        microX: homeMicroX,
        microY: homeMicroY,
        tileX: home.x,
        tileY: home.y,
        posX: (homeMicroX + 0.5) / TILES_PER_CHUNK,
        posY: (homeMicroY + 0.5) / TILES_PER_CHUNK,
        homeMicroX,
        homeMicroY,
        homeTileX: home.x,
        homeTileY: home.y,
        homeSiteId: wm.player.startingSiteId,
        home: {
          outpostId: "outpost-start",
          microX: homeMicroX,
          microY: homeMicroY,
          claimedAtTick: state.meta.tick,
          status: "resident"
        },
        lastInteractionTick: 0,
        lastGoal: "idle",
        roleState: {
          role,
          rolePriority: 1,
          roleCooldownUntilTick: 0,
          roleAssignedTick: 0,
          manualLock: false,
          roleTask: undefined,
          carried: null,
          lastBlockedReason: null,
          lastBlockedTick: 0,
          lastScoutIntelTick: -1000,
          lastScoutThreatTick: -1000,
          lastScoutResourceTick: -1000,
          lastCoordinationTick: -1000
        }
      };
    }

    const unit = wm.units.byGoblinId[goblinId];
    const fallbackTileX = Number.isFinite(unit.homeTileX) ? unit.homeTileX : tileToChunkCoord(unit.homeMicroX);
    const fallbackTileY = Number.isFinite(unit.homeTileY) ? unit.homeTileY : tileToChunkCoord(unit.homeMicroY);
    const currentHomeKey = `${fallbackTileX},${fallbackTileY}`;
    const currentHomeMicroX = regionToMicroCenter(fallbackTileX);
    const currentHomeMicroY = regionToMicroCenter(fallbackTileY);
    const invalidHomeTile = (
      claimedHomeKeys.has(currentHomeKey)
      || isWaterMicroTile(wm, currentHomeMicroX, currentHomeMicroY)
      || Boolean(wm.structures?.wallsByTileKey?.[tileKey(currentHomeMicroX, currentHomeMicroY)])
    );
    if (invalidHomeTile) {
      const reassignedHome = assignHomeTile(wm, idx + claimedHomeKeys.size + state.goblins.allIds.length);
      const reassignedHomeMicroX = regionToMicroCenter(reassignedHome.x);
      const reassignedHomeMicroY = regionToMicroCenter(reassignedHome.y);
      unit.homeMicroX = reassignedHomeMicroX;
      unit.homeMicroY = reassignedHomeMicroY;
      unit.homeTileX = reassignedHome.x;
      unit.homeTileY = reassignedHome.y;
      unit.home = unit.home || {};
      unit.home.microX = reassignedHomeMicroX;
      unit.home.microY = reassignedHomeMicroY;
      if (!unit.home.outpostId) unit.home.outpostId = "outpost-start";
    }
    claimedHomeKeys.add(`${unit.homeTileX},${unit.homeTileY}`);
    ensureRoleState(goblin, unit, idx);
    goblin.assignment.locationId = wm.regionGrid[unit.tileY][unit.tileX];
    syncUnitHomeRecord(state, unit, goblin, state.meta.tick);
  }
  ensureOutpostState(state);
}

function buildOccupancyMap(wm) {
  const map = new Map();
  for (const unit of Object.values(wm.units.byGoblinId)) {
    map.set(tileKey(unit.microX, unit.microY), unit.goblinId);
  }
  return map;
}

function syncGoblinOccupancyByMicroKey(wm, occupancyMap) {
  const out = {};
  for (const [key, goblinId] of occupancyMap.entries()) {
    out[key] = [goblinId];
  }
  wm.units.occupancyByMicroKey = out;

  const renderOut = {};
  for (const unit of Object.values(wm.units.byGoblinId || {})) {
    const rx = Math.floor((unit.posX ?? unit.tileX + 0.5) * TILES_PER_CHUNK);
    const ry = Math.floor((unit.posY ?? unit.tileY + 0.5) * TILES_PER_CHUNK);
    const rKey = tileKey(clamp(rx, 0, wm.width * TILES_PER_CHUNK - 1), clamp(ry, 0, wm.height * TILES_PER_CHUNK - 1));
    if (!renderOut[rKey]) renderOut[rKey] = [];
    renderOut[rKey].push(unit.goblinId);
  }
  wm.units.renderOccupancyByMicroKey = renderOut;
}

function getResourceNodeList(wm) {
  if (!wm.__resourceNodeList) wm.__resourceNodeList = Object.values(wm.resourceNodes.byTileKey || {});
  return wm.__resourceNodeList;
}

function getWaterSourceList(wm) {
  if (!wm.__waterSourceList) wm.__waterSourceList = Object.values(wm.waterSources.byTileKey || {});
  return wm.__waterSourceList;
}

function waterSourceIsReachable(wm, source) {
  if (!source) return false;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = source.microX + dx;
      const ny = source.microY + dy;
      if (nx < 0 || ny < 0 || nx >= wm.width * TILES_PER_CHUNK || ny >= wm.height * TILES_PER_CHUNK) continue;
      if (!isWaterMicroTile(wm, nx, ny)) return true;
    }
  }
  return false;
}

function getReachableWaterSourceList(wm) {
  if (!wm.__reachableWaterSourceList) {
    wm.__reachableWaterSourceList = getWaterSourceList(wm).filter((source) => waterSourceIsReachable(wm, source));
  }
  return wm.__reachableWaterSourceList;
}

function getAdvancedResourceNodeList(wm, storeKey) {
  wm.resources = wm.resources || {};
  const cacheKey = `__${storeKey}List`;
  if (!wm[cacheKey]) wm[cacheKey] = Object.values(wm.resources[storeKey] || {});
  return wm[cacheKey];
}

function hasNearbyWaterSource(wm, microX, microY, maxDist = 1.5) {
  for (const source of getReachableWaterSourceList(wm)) {
    const d = dist({ x: microX, y: microY }, { x: source.microX, y: source.microY });
    if (d <= maxDist) return true;
  }
  return false;
}

function findClosestReadyNode(wm, from, type, tick) {
  let best = null;
  let bestDist = Infinity;
  for (const node of getResourceNodeList(wm)) {
    if (node.type !== type) continue;
    if (node.readyAtTick > tick) continue;
    const d = dist(from, { x: node.microX, y: node.microY });
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best;
}

function findClosestReadyAdvancedNode(wm, from, storeKey, tick) {
  let best = null;
  let bestDist = Infinity;
  for (const node of getAdvancedResourceNodeList(wm, storeKey)) {
    if (!node || Number(node.remaining || 0) <= 0) continue;
    const nextReadyTick = Number(node.nextReadyTick || 0);
    if (tick < nextReadyTick) continue;
    const microX = regionToMicroCenter(node.tileX);
    const microY = regionToMicroCenter(node.tileY);
    const d = dist(from, { x: microX, y: microY });
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best;
}

function findAdvancedNodeAtTile(wm, storeKey, tileX, tileY) {
  return wm.resources?.[storeKey]?.[`${tileX},${tileY}`] || null;
}

function findClosestWaterSource(wm, from) {
  let best = null;
  let bestDist = Infinity;
  for (const source of getReachableWaterSourceList(wm)) {
    const d = dist(from, { x: source.microX, y: source.microY });
    if (d < bestDist) {
      bestDist = d;
      best = source;
    }
  }
  return best;
}

function hasOutpostRecoveryNeedForRole(outpost, role) {
  if (!outpost) return false;
  const priority = outpost.priority || "normal";
  const status = outpost.runtime?.status || "seeded";
  if (priority !== "critical" && status !== "failing") return false;
  const def = outpost.runtime?.deficitByRole || {};
  if ((def[role] || 0) > 0) return true;
  return (outpost.runtime?.populationDeficit || 0) > 0;
}

function selectRecoveryOutpostForRole(state, unit, role) {
  const wm = state.worldMap;
  const outposts = Object.values(wm.structures?.outpostsById || {})
    .filter((o) => hasOutpostRecoveryNeedForRole(o, role))
    .sort((a, b) => {
      const ap = outpostPriorityRank(a.priority);
      const bp = outpostPriorityRank(b.priority);
      if (bp !== ap) return bp - ap;
      const ad = (a.runtime?.deficitByRole?.[role] || 0) + (a.runtime?.populationDeficit || 0) * 0.5;
      const bd = (b.runtime?.deficitByRole?.[role] || 0) + (b.runtime?.populationDeficit || 0) * 0.5;
      if (bd !== ad) return bd - ad;
      const da = dist({ x: unit.microX, y: unit.microY }, { x: a.microX, y: a.microY });
      const db = dist({ x: unit.microX, y: unit.microY }, { x: b.microX, y: b.microY });
      return da - db;
    });
  return outposts[0] || null;
}

function normalizeRole(role) {
  if (role === "woodcutter") return "woodcutter";
  if (role === "fisherman") return "fisherman";
  if (role === "hunter") return "hunter";
  if (role === "builder") return "builder";
  if (role === "homebuilder") return "homebuilder";
  if (role === "sentinel") return "sentinel";
  if (role === "lookout") return "lookout";
  if (role === "hauler") return "hauler";
  if (role === "water-runner") return "water-runner";
  if (role === "caretaker") return "caretaker";
  if (role === "quartermaster") return "quartermaster";
  if (role === "scout") return "scout";
  if (role === "colony-establisher") return "colony-establisher";
  if (role === "reproducer") return "reproducer";
  if (role === "miner") return "miner";
  if (role === "fiber-harvester") return "fiber-harvester";
  if (role === "herbalist") return "herbalist";
  if (role === "smelter") return "smelter";
  if (role === "rope-maker") return "rope-maker";
  if (role === "carpenter") return "carpenter";
  if (role === "charcoal-burner") return "charcoal-burner";
  if (role === "fletcher") return "fletcher";
  if (role === "mechanist") return "mechanist";
  return "forager";
}

function defaultRoleForIndex(index) {
  return DEFAULT_ROLES[index % DEFAULT_ROLES.length];
}

function ensureRoleState(goblin, unit, indexHint = 0) {
  const fallbackRole = defaultRoleForIndex(indexHint);
  const role = normalizeRole(goblin.social?.role || unit.roleState?.role || fallbackRole);
  goblin.social = goblin.social || {};
  goblin.social.role = role;
  unit.roleState = unit.roleState || {};
  unit.roleState.role = role;
  if (typeof unit.roleState.rolePriority !== "number") unit.roleState.rolePriority = 1;
  if (typeof unit.roleState.roleCooldownUntilTick !== "number") unit.roleState.roleCooldownUntilTick = 0;
  if (typeof unit.roleState.lastBlockedTick !== "number") unit.roleState.lastBlockedTick = 0;
  if (typeof unit.roleState.lastScoutIntelTick !== "number") unit.roleState.lastScoutIntelTick = -1000;
  if (typeof unit.roleState.lastScoutThreatTick !== "number") unit.roleState.lastScoutThreatTick = -1000;
  if (typeof unit.roleState.lastScoutResourceTick !== "number") unit.roleState.lastScoutResourceTick = -1000;
  if (typeof unit.roleState.lastCoordinationTick !== "number") unit.roleState.lastCoordinationTick = -1000;
  if (typeof unit.roleState.lastHydrationTaskTick !== "number") unit.roleState.lastHydrationTaskTick = -1000;
  if (typeof unit.roleState.lastColonyEstablishTick !== "number") unit.roleState.lastColonyEstablishTick = -1000;
  if (!unit.roleState.hydrationPriority) unit.roleState.hydrationPriority = "sated";
  if (typeof unit.roleState.roleAssignedTick !== "number") unit.roleState.roleAssignedTick = 0;
  if (typeof unit.roleState.manualLock !== "boolean") unit.roleState.manualLock = false;
  if (!Object.prototype.hasOwnProperty.call(unit.roleState, "carried")) unit.roleState.carried = null;
  return role;
}

function hydrationProfileForGoblin(state, goblin, indexHint = 0) {
  goblin.modData = goblin.modData || {};
  if (!goblin.modData.hydrationProfile) {
    const seed = state.meta?.seed || "default-seed";
    const keyParts = [seed, goblin.id, goblin.identity?.name || "goblin", indexHint];
    const seekThreshold = Math.round(78 + rand01("hyd-seek", ...keyParts) * 12); // 78..90
    const highThreshold = Math.round(90 + rand01("hyd-high", ...keyParts) * 7); // 90..97
    const criticalThreshold = Math.round(96 + rand01("hyd-critical", ...keyParts) * 4); // 96..100
    const satedThreshold = Math.round(8 + rand01("hyd-sated", ...keyParts) * 14); // 8..22
    const drinkPerTick = Math.round(30 + rand01("hyd-drink", ...keyParts) * 16); // 30..46
    const thirstDecayMul = Number((0.08 + rand01("hyd-decay", ...keyParts) * 0.08).toFixed(3)); // 0.08..0.16
    const waterNeedMul = Number((0.1 + rand01("hyd-water-need", ...keyParts) * 0.1).toFixed(3)); // 0.10..0.20
    const thirstStartOffset = Math.round(-12 + rand01("hyd-start", ...keyParts) * 18); // -12..+6

    goblin.modData.hydrationProfile = {
      seekThreshold: Math.min(seekThreshold, highThreshold - 2),
      highThreshold: Math.min(highThreshold, criticalThreshold - 2),
      criticalThreshold,
      satedThreshold,
      drinkPerTick,
      thirstDecayMul,
      waterNeedMul
    };
    goblin.needs.thirst = clamp(goblin.needs.thirst + thirstStartOffset, 0, 100);
  }
  return goblin.modData.hydrationProfile;
}

function hydrationPriorityFor(thirst, profile) {
  if (thirst >= profile.criticalThreshold) return "critical";
  if (thirst >= profile.highThreshold) return "high";
  if (thirst >= profile.seekThreshold) return "moderate";
  if (thirst > profile.satedThreshold) return "low";
  return "sated";
}

function buildDrinkTask(source) {
  return {
    kind: "drink",
    targetMicroX: source.microX,
    targetMicroY: source.microY,
    targetTileX: source.tileX,
    targetTileY: source.tileY
  };
}

function buildDrinkFromStorageTask(unit) {
  return {
    kind: "drink-stored-water",
    targetMicroX: unit.homeMicroX,
    targetMicroY: unit.homeMicroY,
    targetTileX: unit.homeTileX,
    targetTileY: unit.homeTileY
  };
}

function buildRestTask(unit) {
  return {
    kind: "rest",
    targetMicroX: unit.homeMicroX,
    targetMicroY: unit.homeMicroY,
    targetTileX: unit.homeTileX,
    targetTileY: unit.homeTileY
  };
}

function ensureReproductionState(state) {
  const structures = state.worldMap.structures = state.worldMap.structures || {};
  if (!structures.reproduction) {
    structures.reproduction = {
      enabled: true,
      singleGoblinMode: true,
      cooldownTicks: 120,
      pairDurationTicks: 10,
      minIdleTicks: 12,
      maxBirthsPerDay: 2,
      maxPairDistance: 6,
      safePredatorRadius: 10,
      minWallProtectionScore: 0.45,
      minWallsForSafety: 10,
      forceWhenStalled: true,
      forceAfterTicks: 96,
      forceIgnoreSafety: true,
      forceIgnoreBirthCap: true,
      lastBirthTick: -1000,
      birthsThisDay: 0,
      birthDayBucket: 0,
      pairByGoblinId: {},
      recentPartnerByGoblinId: {},
      lastSnapshot: {
        eligibleCount: 0,
        activePairs: 0,
        birthsThisDay: 0,
        safetyReason: "NONE"
      }
    };
  }
  return structures.reproduction;
}

function reproductionDayBucketForTick(tick) {
  return Math.floor(Math.max(0, tick) / REPRO_DAY_TICKS);
}

function isCriticalNeedForReproduction(goblin) {
  return (
    (goblin.needs.hunger || 0) >= 85
    || (goblin.needs.thirst || 0) >= 90
    || (goblin.needs.rest || 0) >= 90
    || (goblin.needs.warmth || 0) >= 90
    || (goblin.psyche.morale || 0) <= 25
  );
}

function wallProtectionScore(state) {
  const builtWalls = Object.keys(state.worldMap?.structures?.wallsByTileKey || {}).length;
  return clamp(builtWalls / 22, 0, 1);
}

function reproductionSafety(state, repro) {
  const center = defensePointForMap(state);
  const hostiles = hostileWildlifeList(state);
  let nearPredators = 0;
  for (const hostile of hostiles) {
    const d = dist(center, { x: hostile.microX, y: hostile.microY });
    if (d <= repro.safePredatorRadius) nearPredators += 1;
  }
  const safeByPredator = nearPredators === 0;
  const builtWalls = Object.keys(state.worldMap?.structures?.wallsByTileKey || {}).length;
  const safeByWalls = builtWalls >= repro.minWallsForSafety || wallProtectionScore(state) >= repro.minWallProtectionScore;
  const safe = safeByPredator || safeByWalls;
  let reason = "NONE";
  if (safeByPredator) reason = "NO_ACTIVE_PREDATOR";
  else if (safeByWalls) reason = "WALL_PROTECTION";
  return { safe, reason };
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function cancelReproductionPair(repro, a, b) {
  delete repro.pairByGoblinId[a];
  delete repro.pairByGoblinId[b];
}

function markRecentPartners(repro, a, b, tick) {
  repro.recentPartnerByGoblinId[a] = { partnerId: b, lastTick: tick };
  repro.recentPartnerByGoblinId[b] = { partnerId: a, lastTick: tick };
}

function refreshReproductionDayCounters(repro, tick) {
  const dayBucket = reproductionDayBucketForTick(tick);
  if (repro.birthDayBucket !== dayBucket) {
    repro.birthDayBucket = dayBucket;
    repro.birthsThisDay = 0;
  }
}

function reproductionEligibility(state, tick, safety) {
  const repro = ensureReproductionState(state);
  const list = [];
  for (const goblinId of state.goblins.allIds) {
    const goblin = state.goblins.byId[goblinId];
    const unit = state.worldMap?.units?.byGoblinId?.[goblinId];
    if (!goblin || !unit || !goblin.flags.alive || goblin.flags.missing || goblin.flags.imprisoned || goblin.flags.exiled) continue;

    goblin.modData = goblin.modData || {};
    goblin.modData.reproduction = goblin.modData.reproduction || {
      idleSinceTick: tick,
      lastBirthContributionTick: -1000
    };
    const rep = goblin.modData.reproduction;
    const role = unit.roleState?.role || "";
    const isReproducer = role === "reproducer";
    if (!isReproducer) rep.idleSinceTick = tick;

    if (!safety.safe) continue;
    if (!isReproducer) continue;
    if (unit.roleState?.carried?.amount > 0) continue;
    if (isCriticalNeedForReproduction(goblin)) continue;
    if ((tick - (rep.lastBirthContributionTick || -1000)) < repro.cooldownTicks) continue;
    list.push({ goblinId, unit, goblin });
  }
  return list;
}

function selectReproductionPairs(state, tick, eligible, safety, events) {
  const repro = ensureReproductionState(state);
  const used = new Set();
  const sorted = [...eligible].sort((a, b) => a.goblinId.localeCompare(b.goblinId));
  for (const a of sorted) {
    if (used.has(a.goblinId)) continue;
    if (repro.pairByGoblinId[a.goblinId]) continue;
    let best = null;
    let bestDist = Infinity;
    for (const b of sorted) {
      if (b.goblinId === a.goblinId) continue;
      if (used.has(b.goblinId)) continue;
      if (repro.pairByGoblinId[b.goblinId]) continue;
      const recent = repro.recentPartnerByGoblinId[a.goblinId];
      if (recent && recent.partnerId === b.goblinId && (tick - (recent.lastTick || 0)) < repro.cooldownTicks) continue;
      const d = dist({ x: a.unit.microX, y: a.unit.microY }, { x: b.unit.microX, y: b.unit.microY });
      if (d > repro.maxPairDistance) continue;
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    if (!best) continue;
    used.add(a.goblinId);
    used.add(best.goblinId);
    const completesAtTick = tick + repro.pairDurationTicks;
    repro.pairByGoblinId[a.goblinId] = {
      partnerId: best.goblinId,
      startedTick: tick,
      completesAtTick,
      safetyReason: safety.reason
    };
    repro.pairByGoblinId[best.goblinId] = {
      partnerId: a.goblinId,
      startedTick: tick,
      completesAtTick,
      safetyReason: safety.reason
    };
    events.push({
      type: "GOBLIN_REPRO_ATTEMPT_STARTED",
      goblinAId: a.goblinId,
      goblinBId: best.goblinId,
      completesAtTick,
      safetyReason: safety.reason,
      text: `${a.goblin.identity.name} and ${best.goblin.identity.name} started a nesting attempt.`
    });
  }
}

function tryCreateSoloBirth(state, tick, repro, parentId, events, forced = false) {
  const parent = state.goblins.byId[parentId];
  const unit = state.worldMap?.units?.byGoblinId?.[parentId];
  if (!parent || !unit || !parent.flags?.alive || parent.flags?.missing) return false;

  const childId = nextId(state, "goblin");
  const siteId = state.worldMap?.player?.startingSiteId || parent.identity?.originSiteId || null;
  const rng = initRng(`${state.meta.seed}|birth|solo|${tick}|${parentId}|${childId}|${forced ? "forced" : "normal"}`);
  const child = createGoblin({
    id: childId,
    rng,
    tick,
    originSiteId: siteId
  });
  child.identity.ageStage = "whelp";
  child.modData = child.modData || {};
  child.modData.reproduction = {
    parentAId: parentId,
    parentBId: null,
    bornAtTick: tick,
    idleSinceTick: tick,
    lastBirthContributionTick: -1000
  };
  state.goblins.byId[childId] = child;
  state.goblins.allIds.push(childId);

  parent.modData = parent.modData || {};
  parent.modData.reproduction = parent.modData.reproduction || {};
  parent.modData.reproduction.lastBirthContributionTick = tick;
  repro.lastBirthTick = tick;
  repro.birthsThisDay += 1;

  events.push({
    type: forced ? "GOBLIN_BORN_FORCED" : "GOBLIN_BORN",
    newGoblinId: childId,
    parentAId: parentId,
    parentBId: null,
    siteId,
    text: forced
      ? `${parent.identity.name} produced a forced offspring event (${child.identity.name}).`
      : `${parent.identity.name} brought forth ${child.identity.name}.`
  });
  return true;
}

function tryCreateBirthFromPair(state, tick, repro, aId, bId, events, forced = false) {
  const goblinA = state.goblins.byId[aId];
  const goblinB = state.goblins.byId[bId];
  const unitA = state.worldMap?.units?.byGoblinId?.[aId];
  const unitB = state.worldMap?.units?.byGoblinId?.[bId];
  if (!goblinA || !goblinB || !unitA || !unitB || !goblinA.flags.alive || !goblinB.flags.alive || goblinA.flags.missing || goblinB.flags.missing) {
    return false;
  }

  const childId = nextId(state, "goblin");
  const siteId = state.worldMap?.player?.startingSiteId || goblinA.identity?.originSiteId || goblinB.identity?.originSiteId || null;
  const rng = initRng(`${state.meta.seed}|birth|${tick}|${aId}|${bId}|${childId}|${forced ? "forced" : "normal"}`);
  const child = createGoblin({
    id: childId,
    rng,
    tick,
    originSiteId: siteId
  });
  child.identity.ageStage = "whelp";
  child.modData = child.modData || {};
  child.modData.reproduction = {
    parentAId: aId,
    parentBId: bId,
    bornAtTick: tick,
    idleSinceTick: tick,
    lastBirthContributionTick: -1000
  };
  state.goblins.byId[childId] = child;
  state.goblins.allIds.push(childId);

  goblinA.modData = goblinA.modData || {};
  goblinB.modData = goblinB.modData || {};
  goblinA.modData.reproduction = goblinA.modData.reproduction || {};
  goblinB.modData.reproduction = goblinB.modData.reproduction || {};
  goblinA.modData.reproduction.lastBirthContributionTick = tick;
  goblinB.modData.reproduction.lastBirthContributionTick = tick;
  markRecentPartners(repro, aId, bId, tick);
  repro.lastBirthTick = tick;
  repro.birthsThisDay += 1;

  events.push({
    type: forced ? "GOBLIN_BORN_FORCED" : "GOBLIN_BORN",
    newGoblinId: childId,
    parentAId: aId,
    parentBId: bId,
    siteId,
    text: forced
      ? `${goblinA.identity.name} and ${goblinB.identity.name} produced a forced offspring event (${child.identity.name}).`
      : `${goblinA.identity.name} and ${goblinB.identity.name} welcomed ${child.identity.name}.`
  });
  return true;
}

function forceReproductionIfStalled(state, tick, repro, safety, events) {
  if (!repro.forceWhenStalled) return false;
  const sinceBirth = tick - (repro.lastBirthTick || -1000);
  if (sinceBirth < (repro.forceAfterTicks || 96)) return false;
  if (!repro.forceIgnoreBirthCap && repro.birthsThisDay >= repro.maxBirthsPerDay) return false;
  if (!repro.forceIgnoreSafety && !safety.safe) return false;

  const candidates = state.goblins.allIds
    .map((id) => ({ id, g: state.goblins.byId[id], u: state.worldMap?.units?.byGoblinId?.[id] }))
    .filter((x) => x.g && x.u && x.g.flags?.alive && !x.g.flags?.missing && !x.g.flags?.imprisoned && !x.g.flags?.exiled)
    .filter((x) => !isCriticalNeedForReproduction(x.g))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!candidates.length) return false;
  const reproRole = candidates.filter((x) => x.u.roleState?.role === "reproducer");
  const pick = (reproRole.length ? reproRole : candidates)[0];
  const ok = tryCreateSoloBirth(state, tick, repro, pick.id, events, true);
  if (!ok) return false;
  events.push({
    type: "REPRO_FORCE_TRIGGERED",
    goblinAId: pick.id,
    goblinBId: null,
    reasonCode: "STALL_TIMEOUT",
    text: "Forced solo reproduction triggered to prevent population stall."
  });
  return true;
}

function resolveReproductionPairs(state, tick, safety, events) {
  const repro = ensureReproductionState(state);
  refreshReproductionDayCounters(repro, tick);
  const processed = new Set();
  for (const aId of Object.keys(repro.pairByGoblinId)) {
    const pair = repro.pairByGoblinId[aId];
    if (!pair) continue;
    const bId = pair.partnerId;
    const key = pairKey(aId, bId);
    if (processed.has(key)) continue;
    processed.add(key);
    const pairB = repro.pairByGoblinId[bId];
    if (!pairB || pairB.partnerId !== aId) {
      cancelReproductionPair(repro, aId, bId);
      events.push({
        type: "GOBLIN_REPRO_ATTEMPT_CANCELED",
        goblinAId: aId,
        goblinBId: bId,
        reasonCode: "INVALID_PAIR",
        text: "A nesting attempt was canceled due to invalid pairing state."
      });
      continue;
    }
    if (pair.completesAtTick > tick || pairB.completesAtTick > tick) continue;

    const goblinA = state.goblins.byId[aId];
    const goblinB = state.goblins.byId[bId];
    const unitA = state.worldMap?.units?.byGoblinId?.[aId];
    const unitB = state.worldMap?.units?.byGoblinId?.[bId];
    if (!goblinA || !goblinB || !unitA || !unitB || !goblinA.flags.alive || !goblinB.flags.alive || goblinA.flags.missing || goblinB.flags.missing) {
      cancelReproductionPair(repro, aId, bId);
      events.push({
        type: "GOBLIN_REPRO_ATTEMPT_CANCELED",
        goblinAId: aId,
        goblinBId: bId,
        reasonCode: "INVALID_PAIR",
        text: "A nesting attempt was canceled because one partner became unavailable."
      });
      continue;
    }
    if (!safety.safe) {
      cancelReproductionPair(repro, aId, bId);
      events.push({
        type: "GOBLIN_REPRO_ATTEMPT_CANCELED",
        goblinAId: aId,
        goblinBId: bId,
        reasonCode: "THREAT_ACTIVE",
        text: `${goblinA.identity.name} and ${goblinB.identity.name} aborted nesting due to nearby danger.`
      });
      continue;
    }
    if (repro.birthsThisDay >= repro.maxBirthsPerDay) {
      cancelReproductionPair(repro, aId, bId);
      events.push({
        type: "GOBLIN_REPRO_ATTEMPT_CANCELED",
        goblinAId: aId,
        goblinBId: bId,
        reasonCode: "BIRTH_CAP_REACHED",
        text: "A nesting attempt was delayed because this day's birth cap was reached."
      });
      continue;
    }

    const pairDistance = dist({ x: unitA.microX, y: unitA.microY }, { x: unitB.microX, y: unitB.microY });
    if (pairDistance > 1.6) {
      pair.completesAtTick = tick + 2;
      pairB.completesAtTick = tick + 2;
      continue;
    }

    const born = tryCreateBirthFromPair(state, tick, repro, aId, bId, events, false);
    cancelReproductionPair(repro, aId, bId);
    if (!born) continue;
  }
}

function runReproductionSystem(state, tick, events) {
  const repro = ensureReproductionState(state);
  refreshReproductionDayCounters(repro, tick);
  if (!repro.enabled) return;
  const safety = reproductionSafety(state, repro);
  const eligible = reproductionEligibility(state, tick, safety);
  const canBirthNow = safety.safe && (tick - (repro.lastBirthTick || -1000)) >= repro.cooldownTicks && repro.birthsThisDay < repro.maxBirthsPerDay;
  if (repro.singleGoblinMode !== false && canBirthNow && eligible.length > 0) {
    const pick = eligible
      .slice()
      .sort((a, b) => {
        const ar = a.goblin.modData?.reproduction?.lastBirthContributionTick || -1000;
        const br = b.goblin.modData?.reproduction?.lastBirthContributionTick || -1000;
        if (ar !== br) return ar - br;
        return a.goblinId.localeCompare(b.goblinId);
      })[0];
    tryCreateSoloBirth(state, tick, repro, pick.goblinId, events, false);
  } else if (repro.singleGoblinMode === false) {
    if (canBirthNow) selectReproductionPairs(state, tick, eligible, safety, events);
    resolveReproductionPairs(state, tick, safety, events);
  } else if (Object.keys(repro.pairByGoblinId).length > 0) {
    repro.pairByGoblinId = {};
  }
  if (Math.floor(Object.keys(repro.pairByGoblinId).length / 2) === 0) {
    forceReproductionIfStalled(state, tick, repro, safety, events);
  }
  repro.lastSnapshot = {
    eligibleCount: eligible.length,
    activePairs: Math.floor(Object.keys(repro.pairByGoblinId).length / 2),
    birthsThisDay: repro.birthsThisDay,
    safetyReason: safety.reason,
    forceWhenStalled: Boolean(repro.forceWhenStalled)
  };
}

function buildIdleTask(unit, wm, tick, goblinId) {
  return {
    kind: "idle",
    targetMicroX: clamp(unit.homeMicroX + Math.round((rand01("idle-x", tick, goblinId) - 0.5) * 8), 0, wm.width * TILES_PER_CHUNK - 1),
    targetMicroY: clamp(unit.homeMicroY + Math.round((rand01("idle-y", tick, goblinId) - 0.5) * 8), 0, wm.height * TILES_PER_CHUNK - 1)
  };
}

function setRoleTask(unit, role, task, tick, blockedReason = null) {
  unit.roleState.role = role;
  if (!task) {
    unit.roleState.roleTask = undefined;
    return;
  }
  unit.roleState.roleTask = {
    kind: task.kind,
    targetMicroX: task.targetMicroX,
    targetMicroY: task.targetMicroY,
    claimedAtTick: tick,
    blockedReason: blockedReason || undefined,
    recoveryOutpostId: task.recoveryOutpostId || undefined,
    reasonCode: task.reasonCode || undefined
  };
}

function maybeEmitTaskClaimed(events, goblin, unit, role, task) {
  if (!task || task.kind === "idle") return;
  const prev = unit.roleState?.roleTask;
  if (
    prev &&
    prev.kind === task.kind &&
    prev.targetMicroX === task.targetMicroX &&
    prev.targetMicroY === task.targetMicroY
  ) {
    return;
  }
  events.push({
    type: "ROLE_TASK_CLAIMED",
    goblinId: goblin.id,
    role,
    microX: task.targetMicroX,
    microY: task.targetMicroY,
    recoveryOutpostId: task.recoveryOutpostId || undefined,
    reasonCode: task.reasonCode || undefined,
    text: task.recoveryOutpostId
      ? `${goblin.identity.name} (${role}) claimed ${task.kind} for outpost ${task.recoveryOutpostId}.`
      : `${goblin.identity.name} (${role}) claimed ${task.kind}.`
  });
}

function maybeEmitTaskBlocked(events, goblin, unit, role, tick, blockedReason, text) {
  if (!blockedReason) return;
  if (unit.roleState.lastBlockedReason === blockedReason && tick - unit.roleState.lastBlockedTick < ROLE_TASK_BLOCKED_COOLDOWN) return;
  unit.roleState.lastBlockedReason = blockedReason;
  unit.roleState.lastBlockedTick = tick;
  events.push({
    type: "ROLE_TASK_BLOCKED",
    goblinId: goblin.id,
    role,
    microX: unit.microX,
    microY: unit.microY,
    reasonCode: blockedReason,
    text
  });
}

function storageCapacityFor(state, resourceKey) {
  const cap = state.tribe?.policies?.storageCaps?.[resourceKey];
  if (!Number.isFinite(cap) || cap < 0) return Infinity;
  return cap;
}

function ensureMigrationState(wm) {
  wm.structures = wm.structures || {};
  if (!wm.structures.migration) {
    wm.structures.migration = {
      jobsById: {},
      queueIds: [],
      nextJobSeq: 1,
      lastPlanTick: -1000,
      maxJobTicks: 240,
      maxNoProgressTicks: 48,
      metrics: {
        jobsCreated: 0,
        jobsCompleted: 0,
        jobsFailed: 0
      }
    };
  }
  return wm.structures.migration;
}

function findOutpostHomeSpot(state, outpostId, moverGoblinId = null) {
  const wm = state.worldMap;
  const outpost = wm.structures?.outpostsById?.[outpostId];
  if (!outpost) return null;

  const blocked = new Set();
  for (const unit of Object.values(wm.units?.byGoblinId || {})) {
    if (moverGoblinId && unit.goblinId === moverGoblinId) continue;
    blocked.add(`${unit.homeTileX},${unit.homeTileY}`);
  }
  for (const home of Object.values(wm.structures?.villageHomesByTileKey || {})) blocked.add(`${home.tileX},${home.tileY}`);
  for (const cp of Object.values(wm.structures?.colonyOutpostsByTileKey || {})) blocked.add(`${cp.tileX},${cp.tileY}`);

  for (const off of HOME_RING) {
    const tileX = clamp(outpost.tileX + off.x, 0, wm.width - 1);
    const tileY = clamp(outpost.tileY + off.y, 0, wm.height - 1);
    if (blocked.has(`${tileX},${tileY}`)) continue;
    const microX = regionToMicroCenter(tileX);
    const microY = regionToMicroCenter(tileY);
    if (wm.structures?.wallsByTileKey?.[tileKey(microX, microY)]) continue;
    if (isWaterMicroTile(wm, microX, microY)) continue;
    return { tileX, tileY, microX, microY };
  }
  return null;
}

function scoreMigrationCandidate(state, unit, goblin, fromOutpost, toOutpost) {
  const needs = goblin?.needs || {};
  const role = unit?.roleState?.role || "forager";
  const outDef = toOutpost?.runtime?.deficitByRole || {};
  const roleBonus = (outDef[role] || 0) > 0 ? 2.25 : 0;
  const pressurePenalty = (
    Math.max(0, (needs.hunger || 0) - 70) * 0.04 +
    Math.max(0, (needs.thirst || 0) - 70) * 0.045 +
    Math.max(0, (needs.rest || 0) - 75) * 0.035 +
    Math.max(0, 30 - (goblin?.psyche?.morale || 50)) * 0.05
  );
  const d = dist({ x: unit.microX, y: unit.microY }, { x: toOutpost.microX, y: toOutpost.microY });
  const sourcePop = fromOutpost?.runtime?.population || 0;
  const surplusBonus = Math.max(0, sourcePop - (fromOutpost?.runtime?.targetPopulation || 1)) * 0.25;
  return roleBonus + surplusBonus - pressurePenalty - d * 0.045;
}

function rerouteMigrationJob(state, job, tick) {
  const wm = state.worldMap;
  const unit = wm.units?.byGoblinId?.[job.goblinId];
  const homeSpot = findOutpostHomeSpot(state, job.toOutpostId, job.goblinId);
  if (!homeSpot) return null;
  if (
    job.targetTileX === homeSpot.tileX
    && job.targetTileY === homeSpot.tileY
    && job.targetMicroX === homeSpot.microX
    && job.targetMicroY === homeSpot.microY
  ) {
    return null;
  }
  const prev = {
    targetTileX: job.targetTileX,
    targetTileY: job.targetTileY,
    targetMicroX: job.targetMicroX,
    targetMicroY: job.targetMicroY
  };
  job.targetTileX = homeSpot.tileX;
  job.targetTileY = homeSpot.tileY;
  job.targetMicroX = homeSpot.microX;
  job.targetMicroY = homeSpot.microY;
  job.lastProgressTick = tick;
  job.bestDistance = unit
    ? dist({ x: unit.microX, y: unit.microY }, { x: homeSpot.microX, y: homeSpot.microY })
    : Number.POSITIVE_INFINITY;
  job.rerouteCount = (job.rerouteCount || 0) + 1;
  return { prev, next: homeSpot };
}

function retargetMigrationJobDestination(state, job, tick) {
  const wm = state.worldMap;
  const unit = wm.units?.byGoblinId?.[job.goblinId];
  const currentUnit = unit || { goblinId: job.goblinId, microX: job.targetMicroX, microY: job.targetMicroY };
  const pick = pickEvacuationDestination(state, currentUnit, job.fromOutpostId);
  if (pick) {
    const prevOutpostId = job.toOutpostId;
    job.toOutpostId = pick.outpost.id;
    job.targetTileX = pick.homeSpot.tileX;
    job.targetTileY = pick.homeSpot.tileY;
    job.targetMicroX = pick.homeSpot.microX;
    job.targetMicroY = pick.homeSpot.microY;
    job.lastProgressTick = tick;
    job.bestDistance = unit
      ? dist({ x: unit.microX, y: unit.microY }, { x: pick.homeSpot.microX, y: pick.homeSpot.microY })
      : Number.POSITIVE_INFINITY;
    job.retargetCount = (job.retargetCount || 0) + 1;
    return { fromOutpostId: prevOutpostId, toOutpostId: pick.outpost.id, homeSpot: pick.homeSpot };
  }
  return null;
}

function pickEvacuationDestination(state, unit, fromOutpostId) {
  const wm = state.worldMap;
  const outposts = Object.values(wm.structures?.outpostsById || {});
  const start = wm.structures?.outpostsById?.["outpost-start"] || null;
  const candidates = outposts
    .filter((o) => o?.id && o.id !== fromOutpostId)
    .filter((o) => {
      const s = o.runtime?.status || "seeded";
      return s !== "evacuating" && s !== "abandoned";
    })
    .map((o) => {
      const status = o.runtime?.status || "seeded";
      const statusRank = status === "stable" ? 3 : status === "viable" ? 2 : status === "seeded" ? 1 : 0;
      const deficit = o.runtime?.populationDeficit || 0;
      const d = dist({ x: unit.microX, y: unit.microY }, { x: o.microX, y: o.microY });
      return { outpost: o, score: statusRank * 5 + deficit * 2 - d * 0.05 };
    })
    .sort((a, b) => b.score - a.score);

  for (const entry of candidates) {
    const spot = findOutpostHomeSpot(state, entry.outpost.id, unit.goblinId);
    if (!spot) continue;
    return { outpost: entry.outpost, homeSpot: spot };
  }
  if (start) {
    const spot = findOutpostHomeSpot(state, start.id, unit.goblinId) || {
      tileX: start.tileX,
      tileY: start.tileY,
      microX: start.microX,
      microY: start.microY
    };
    return { outpost: start, homeSpot: spot };
  }
  return null;
}

function outpostPriorityRank(priority) {
  if (priority === "critical") return 3;
  if (priority === "frontier") return 2;
  return 1;
}

function classifyOutpostStatus(outpost) {
  const runtime = outpost?.runtime || {};
  const pop = runtime.population || 0;
  const target = Math.max(1, runtime.targetPopulation || 1);
  const deficit = Math.max(0, runtime.populationDeficit || 0);
  const roleDeficits = runtime.deficitByRole || {};
  const missingForager = (roleDeficits.forager || 0) > 0;
  const missingWater = (roleDeficits["water-runner"] || 0) > 0;
  const missingBuilder = (roleDeficits.builder || 0) > 0;
  const allRolesStaffed = Object.values(roleDeficits).every((v) => (v || 0) <= 0);

  if (pop <= 0) return "failing";
  if (pop >= target && allRolesStaffed) return "stable";

  const minViablePop = Math.max(2, Math.floor(target * 0.5));
  const majorDeficit = deficit >= Math.max(2, Math.ceil(target * 0.6));
  if (majorDeficit || missingForager || missingWater) return "seeded";
  if (pop >= minViablePop && !missingBuilder) return "viable";
  return "seeded";
}

function updateOutpostLifecycle(state, tick, events) {
  const wm = state.worldMap;
  const startOutpostId = "outpost-start";
  const outpostsById = wm.structures?.outpostsById || {};
  const migration = ensureMigrationState(wm);
  const governance = state.tribe?.governance || {};
  const leaderPostureByOutpostId = governance.recommendations?.outpostPostureById || {};

  const residentsForOutpost = (outpostId) => Object.values(wm.units?.byGoblinId || {})
    .filter((u) => u?.home?.outpostId === outpostId);

  const forceRehomeToStart = (outpost) => {
    const startOutpost = outpostsById[startOutpostId];
    if (!startOutpost) return 0;
    const residents = residentsForOutpost(outpost.id);
    if (!residents.length) return 0;

    const jobs = migration.queueIds
      .map((id) => migration.jobsById[id])
      .filter((j) => j && (j.status === "queued" || j.status === "active"))
      .filter((j) => residents.some((u) => u.goblinId === j.goblinId));
    for (const job of jobs) {
      job.status = "failed";
      job.failedReason = "OUTPOST_CLOSED";
      job.failedTick = tick;
      migration.metrics.jobsFailed += 1;
      migration.queueIds = migration.queueIds.filter((id) => id !== job.id);
    }

    for (const unit of residents) {
      const goblin = state.goblins.byId?.[unit.goblinId];
      const homeSpot = findOutpostHomeSpot(state, startOutpostId, unit.goblinId) || {
        tileX: startOutpost.tileX,
        tileY: startOutpost.tileY,
        microX: startOutpost.microX,
        microY: startOutpost.microY
      };
      unit.home = unit.home || {};
      unit.home.outpostId = startOutpostId;
      unit.home.microX = homeSpot.microX;
      unit.home.microY = homeSpot.microY;
      unit.home.claimedAtTick = tick;
      unit.home.status = "resident";
      unit.homeMicroX = homeSpot.microX;
      unit.homeMicroY = homeSpot.microY;
      unit.homeTileX = homeSpot.tileX;
      unit.homeTileY = homeSpot.tileY;
      unit.homeSiteId = wm.player?.startingSiteId || unit.homeSiteId;
      if (goblin) {
        goblin.modData = goblin.modData || {};
        goblin.modData.home = goblin.modData.home || {};
        goblin.modData.home.outpostId = startOutpostId;
        goblin.modData.home.tileX = homeSpot.tileX;
        goblin.modData.home.tileY = homeSpot.tileY;
        goblin.modData.home.siteId = unit.homeSiteId;
      }
    }
    return residents.length;
  };

  const outposts = Object.values(wm.structures?.outpostsById || {});
  for (const outpost of outposts) {
    outpost.runtime = outpost.runtime || {};
    const runtime = outpost.runtime;
    const previousStatus = runtime.status || "seeded";
    const isStart = outpost.id === startOutpostId || outpost.kind === "starting";
    const leaderPosture = String(leaderPostureByOutpostId[outpost.id] || "hold");
    const prevLeaderPosture = String(runtime.leaderPosture || "hold");
    runtime.leaderPosture = leaderPosture;
    if (prevLeaderPosture !== leaderPosture) {
      events.push({
        type: "OUTPOST_LEADER_POSTURE_CHANGED",
        outpostId: outpost.id,
        fromPosture: prevLeaderPosture,
        toPosture: leaderPosture,
        tileX: outpost.tileX,
        tileY: outpost.tileY,
        text: `Leader posture for ${outpost.id}: ${prevLeaderPosture} -> ${leaderPosture}.`
      });
    }

    if (previousStatus === "abandoned" && !isStart) {
      runtime.status = "abandoned";
      continue;
    }

    const computedStatus = classifyOutpostStatus(outpost);
    const unstable = computedStatus !== "stable" && previousStatus !== "evacuating";

    if (unstable && !Number.isFinite(runtime.unstableSinceTick)) runtime.unstableSinceTick = tick;
    if (!unstable) runtime.unstableSinceTick = null;

    const unstableFor = Number.isFinite(runtime.unstableSinceTick) ? (tick - runtime.unstableSinceTick) : 0;
    let nextStatus = unstable && unstableFor >= OUTPOST_FAILING_TICKS ? "failing" : computedStatus;
    if (previousStatus === "evacuating") nextStatus = "evacuating";
    if (nextStatus === "failing" && !Number.isFinite(runtime.failingSinceTick)) runtime.failingSinceTick = tick;
    if (nextStatus !== "failing" && nextStatus !== "evacuating") runtime.failingSinceTick = null;

    if (!isStart && leaderPosture === "evacuate" && previousStatus !== "abandoned") {
      nextStatus = "evacuating";
      if (!Number.isFinite(runtime.evacuationStartedTick)) {
        runtime.evacuationStartedTick = tick;
        runtime.evacuationDeadlineTick = tick + EVACUATION_MAX_TICKS;
        runtime.evacuationReasonCode = "LEADER_POLICY";
        events.push({
          type: "OUTPOST_EVACUATION_STARTED",
          outpostId: outpost.id,
          reasonCode: "LEADER_POLICY",
          tileX: outpost.tileX,
          tileY: outpost.tileY,
          deadlineTick: runtime.evacuationDeadlineTick,
          text: `Outpost ${outpost.id} entered evacuation by leader policy.`
        });
      }
    }

    if (!isStart && nextStatus === "failing") {
      const failingFor = Number.isFinite(runtime.failingSinceTick) ? (tick - runtime.failingSinceTick) : 0;
      if (failingFor >= AUTO_CLOSE_FAILING_TICKS && leaderPosture !== "recover" && leaderPosture !== "fortify") {
        nextStatus = "evacuating";
        if (!Number.isFinite(runtime.evacuationStartedTick)) {
          runtime.evacuationStartedTick = tick;
          runtime.evacuationDeadlineTick = tick + EVACUATION_MAX_TICKS;
          runtime.evacuationReasonCode = "PROLONGED_FAILING";
          events.push({
            type: "OUTPOST_EVACUATION_STARTED",
            outpostId: outpost.id,
            tileX: outpost.tileX,
            tileY: outpost.tileY,
            deadlineTick: runtime.evacuationDeadlineTick,
            text: `Outpost ${outpost.id} entered evacuation due to prolonged failing status.`
          });
        }
      }
    }

    if (nextStatus === "evacuating") {
      const residents = residentsForOutpost(outpost.id).length;
      runtime.population = residents;
      runtime.populationDeficit = Math.max(0, (runtime.targetPopulation || 0) - residents);
      if (residents <= 0) {
        nextStatus = "abandoned";
        runtime.abandonedTick = tick;
        if (wm.structures?.colonyOutpostsByTileKey?.[outpost.key]) {
          wm.structures.colonyOutpostsByTileKey[outpost.key].abandoned = true;
        }
        events.push({
          type: "OUTPOST_ABANDONED",
          outpostId: outpost.id,
          tileX: outpost.tileX,
          tileY: outpost.tileY,
          text: `Outpost ${outpost.id} has been abandoned after evacuation.`
        });
      } else if (Number.isFinite(runtime.evacuationDeadlineTick) && tick >= runtime.evacuationDeadlineTick) {
        const moved = forceRehomeToStart(outpost);
        nextStatus = "abandoned";
        runtime.abandonedTick = tick;
        if (wm.structures?.colonyOutpostsByTileKey?.[outpost.key]) {
          wm.structures.colonyOutpostsByTileKey[outpost.key].abandoned = true;
        }
        events.push({
          type: "OUTPOST_AUTO_CLOSURE_FORCED",
          outpostId: outpost.id,
          movedCount: moved,
          tileX: outpost.tileX,
          tileY: outpost.tileY,
          text: `Outpost ${outpost.id} auto-closure forced ${moved} residents back to the start outpost.`
        });
      } else {
        const lastProgress = runtime.lastEvacuationProgressEventTick || -1000;
        if (tick - lastProgress >= EVACUATION_PROGRESS_EVENT_COOLDOWN) {
          runtime.lastEvacuationProgressEventTick = tick;
          const remaining = Math.max(0, (runtime.evacuationDeadlineTick || tick) - tick);
          events.push({
            type: "OUTPOST_EVACUATION_PROGRESS",
            outpostId: outpost.id,
            remainingResidents: residents,
            remainingTicks: remaining,
            tileX: outpost.tileX,
            tileY: outpost.tileY,
            text: `Outpost ${outpost.id} evacuation in progress: ${residents} residents, ${remaining} ticks remaining.`
          });
        }
      }
    }

    runtime.status = nextStatus;
    if (previousStatus !== nextStatus) {
      runtime.statusChangedTick = tick;
      events.push({
        type: "OUTPOST_STATUS_CHANGED",
        outpostId: outpost.id,
        tileX: outpost.tileX,
        tileY: outpost.tileY,
        fromStatus: previousStatus,
        toStatus: nextStatus,
        text: `Outpost ${outpost.id} status changed: ${previousStatus} -> ${nextStatus}.`
      });
    }

    if (nextStatus === "failing") {
      if (outpost.priority !== "critical") outpost.priority = "critical";
      const lastRequestTick = runtime.lastReinforcementRequestTick || -1000;
      if (tick - lastRequestTick >= 24) {
        runtime.lastReinforcementRequestTick = tick;
        events.push({
          type: "OUTPOST_REINFORCEMENTS_REQUESTED",
          outpostId: outpost.id,
          tileX: outpost.tileX,
          tileY: outpost.tileY,
          text: `Outpost ${outpost.id} is failing and requested reinforcements.`
        });
      }
    } else if (nextStatus === "stable" && outpost.priority === "critical" && leaderPosture !== "fortify" && leaderPosture !== "recover") {
      outpost.priority = outpost.kind === "starting" ? "normal" : "frontier";
    }

    if (leaderPosture === "fortify" || leaderPosture === "recover") {
      if (outpost.priority !== "critical") outpost.priority = "critical";
    }
  }
}

function runMigrationPlanner(state, tick, events) {
  const wm = state.worldMap;
  const migration = ensureMigrationState(wm);
  ensureOutpostState(state);
  if (tick - (migration.lastPlanTick || -1000) < 8) return;
  migration.lastPlanTick = tick;

  const failJob = (job, reasonCode, text) => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    job.status = "failed";
    job.failedReason = reasonCode;
    job.failedTick = tick;
    migration.metrics.jobsFailed += 1;
    migration.queueIds = migration.queueIds.filter((id) => id !== job.id);
    events.push({
      type: "MIGRATION_JOB_FAILED",
      goblinId: job.goblinId,
      fromOutpostId: job.fromOutpostId,
      toOutpostId: job.toOutpostId,
      reasonCode,
      tileX: job.targetTileX,
      tileY: job.targetTileY,
      text
    });
  };

  for (const jobId of [...migration.queueIds]) {
    const job = migration.jobsById[jobId];
    if (!job) continue;
    if (!Number.isFinite(job.rerouteCount)) job.rerouteCount = 0;
    if (!Number.isFinite(job.retargetCount)) job.retargetCount = 0;
    const goblin = state.goblins.byId[job.goblinId];
    const unit = wm.units?.byGoblinId?.[job.goblinId];
    if (!goblin || !unit || !goblin.flags?.alive || goblin.flags?.missing) {
      failJob(job, "GOBLIN_UNAVAILABLE", "Migration failed because the assigned goblin is unavailable.");
      continue;
    }
    if ((tick - (job.createdTick || tick)) > (migration.maxJobTicks || 240)) {
      failJob(job, "TIMEOUT", `${goblin.identity.name} failed to migrate in time.`);
      unit.home = unit.home || {};
      unit.home.status = "resident";
      continue;
    }
    const d = dist({ x: unit.microX, y: unit.microY }, { x: job.targetMicroX, y: job.targetMicroY });
    if (!Number.isFinite(job.bestDistance) || d < (job.bestDistance - 0.45)) {
      job.bestDistance = d;
      job.lastProgressTick = tick;
    } else if ((tick - (job.lastProgressTick || job.createdTick || tick)) > (migration.maxNoProgressTicks || 48)) {
      const reroute = rerouteMigrationJob(state, job, tick);
      if (reroute && (job.rerouteCount || 0) <= 3) {
        events.push({
          type: "MIGRATION_JOB_REROUTED",
          goblinId: job.goblinId,
          fromOutpostId: job.fromOutpostId,
          toOutpostId: job.toOutpostId,
          rerouteCount: job.rerouteCount || 0,
          prevTileX: reroute.prev.targetTileX,
          prevTileY: reroute.prev.targetTileY,
          tileX: reroute.next.tileX,
          tileY: reroute.next.tileY,
          text: `${goblin.identity.name} migration rerouted to a new home slot at ${reroute.next.tileX},${reroute.next.tileY}.`
        });
        continue;
      }
      failJob(job, "NO_PROGRESS", `${goblin.identity.name} migration failed due to no path progress.`);
      unit.home = unit.home || {};
      unit.home.status = "resident";
      continue;
    }
    const destOutpost = wm.structures?.outpostsById?.[job.toOutpostId];
    const destStatus = destOutpost?.runtime?.status || "seeded";
    if (!destOutpost || destStatus === "evacuating" || destStatus === "abandoned") {
      const retarget = retargetMigrationJobDestination(state, job, tick);
      if (retarget && (job.retargetCount || 0) <= 2) {
        events.push({
          type: "MIGRATION_JOB_RETARGETED",
          goblinId: job.goblinId,
          fromOutpostId: retarget.fromOutpostId,
          toOutpostId: retarget.toOutpostId,
          retargetCount: job.retargetCount || 0,
          tileX: retarget.homeSpot.tileX,
          tileY: retarget.homeSpot.tileY,
          text: `${goblin.identity.name} migration retargeted to ${retarget.toOutpostId}.`
        });
        continue;
      }
      failJob(job, "DESTINATION_MISSING", "Migration failed because destination outpost no longer exists.");
      unit.home = unit.home || {};
      unit.home.status = "resident";
      continue;
    }
  }

  const outposts = Object.values(wm.structures?.outpostsById || {});
  const evacuatingOutposts = outposts.filter((o) => (o.runtime?.status || "seeded") === "evacuating");
  const destinations = outposts
    .filter((o) => {
      const s = o.runtime?.status || "seeded";
      return s !== "evacuating" && s !== "abandoned";
    })
    .filter((o) => (o.runtime?.populationDeficit || 0) > 0)
    .sort((a, b) =>
      (outpostPriorityRank(b.priority) - outpostPriorityRank(a.priority))
      || (b.runtime.populationDeficit - a.runtime.populationDeficit)
      || ((a.foundedAtTick || 0) - (b.foundedAtTick || 0))
    );
  if (!destinations.length) return;
  const emergencyDestinations = destinations.filter((o) =>
    (o.priority || "normal") === "critical" || (o.runtime?.status || "seeded") === "failing"
  );
  const creationCap = emergencyDestinations.length > 0 ? 4 : 2;

  const queuedByDestination = {};
  for (const id of migration.queueIds) {
    const job = migration.jobsById[id];
    if (!job || (job.status !== "queued" && job.status !== "active")) continue;
    queuedByDestination[job.toOutpostId] = (queuedByDestination[job.toOutpostId] || 0) + 1;
  }
  const assignedGoblinIds = new Set(
    migration.queueIds
      .map((id) => migration.jobsById[id])
      .filter((j) => j && (j.status === "queued" || j.status === "active"))
      .map((j) => j.goblinId)
  );

  let created = 0;
  const evacuationCap = 8;
  for (const evac of evacuatingOutposts) {
    if (created >= evacuationCap) break;
    const residents = Object.values(wm.units?.byGoblinId || {})
      .filter((u) => u?.home?.outpostId === evac.id)
      .sort((a, b) => String(a.goblinId).localeCompare(String(b.goblinId)));
    for (const unit of residents) {
      if (created >= evacuationCap) break;
      const goblinId = unit.goblinId;
      const goblin = state.goblins.byId[goblinId];
      if (!goblin || !goblin.flags?.alive || goblin.flags?.missing) continue;
      if (assignedGoblinIds.has(goblinId)) continue;
      if (unit.roleState?.carried?.amount > 0) continue;
      const pick = pickEvacuationDestination(state, unit, evac.id);
      if (!pick) continue;
      const jobId = `migrate-${tick}-${migration.nextJobSeq++}`;
      migration.jobsById[jobId] = {
        id: jobId,
        status: "queued",
        createdTick: tick,
        lastProgressTick: tick,
        rerouteCount: 0,
        retargetCount: 0,
        priority: 2,
        reasonCode: "OUTPOST_EVACUATION",
        goblinId,
        fromOutpostId: evac.id,
        toOutpostId: pick.outpost.id,
        targetTileX: pick.homeSpot.tileX,
        targetTileY: pick.homeSpot.tileY,
        targetMicroX: pick.homeSpot.microX,
        targetMicroY: pick.homeSpot.microY,
        bestDistance: dist(
          { x: unit.microX, y: unit.microY },
          { x: pick.homeSpot.microX, y: pick.homeSpot.microY }
        )
      };
      migration.queueIds.unshift(jobId);
      migration.metrics.jobsCreated += 1;
      assignedGoblinIds.add(goblinId);
      created += 1;
      queuedByDestination[pick.outpost.id] = (queuedByDestination[pick.outpost.id] || 0) + 1;
      events.push({
        type: "MIGRATION_JOB_CREATED",
        goblinId,
        fromOutpostId: evac.id,
        toOutpostId: pick.outpost.id,
        reasonCode: "OUTPOST_EVACUATION",
        tileX: pick.homeSpot.tileX,
        tileY: pick.homeSpot.tileY,
        text: `${goblin.identity.name} assigned evacuation migration ${evac.id} -> ${pick.outpost.id}.`
      });
    }
  }

  for (const dest of destinations) {
    if (created >= creationCap) break;
    const emergencyNeedBoost = ((dest.priority || "normal") === "critical" || (dest.runtime?.status || "seeded") === "failing") ? 1 : 0;
    const need = Math.max(0, (dest.runtime?.populationDeficit || 0) + emergencyNeedBoost - (queuedByDestination[dest.id] || 0));
    if (need <= 0) continue;

    const sources = outposts
      .filter((o) => o.id !== dest.id)
      .filter((o) => {
        const s = o.runtime?.status || "seeded";
        return s !== "evacuating" && s !== "abandoned";
      })
      .filter((o) => o.priority !== "critical")
      .filter((o) => (o.runtime?.population || 0) > Math.max(1, o.runtime?.targetPopulation || 1))
      .sort((a, b) => (b.runtime.population - (b.runtime.targetPopulation || 0)) - (a.runtime.population - (a.runtime.targetPopulation || 0)));
    if (!sources.length) continue;

    let best = null;
    let bestScore = -Infinity;
    for (const source of sources) {
      for (const goblinId of state.goblins.allIds) {
        const goblin = state.goblins.byId[goblinId];
        const unit = wm.units?.byGoblinId?.[goblinId];
        if (!goblin || !unit || !goblin.flags?.alive || goblin.flags?.missing) continue;
        if (assignedGoblinIds.has(goblinId)) continue;
        if (unit.home?.outpostId !== source.id) continue;
        if (unit.roleState?.carried?.amount > 0) continue;
        if (isCriticalNeedForReproduction(goblin)) continue;
        const score = scoreMigrationCandidate(state, unit, goblin, source, dest);
        if (score > bestScore) {
          bestScore = score;
          best = { goblinId, source, dest };
        }
      }
      if (best) break;
    }
    if (!best) continue;

    const homeSpot = findOutpostHomeSpot(state, dest.id, best.goblinId);
    if (!homeSpot) continue;

    const jobId = `migrate-${tick}-${migration.nextJobSeq++}`;
    migration.jobsById[jobId] = {
      id: jobId,
      status: "queued",
      createdTick: tick,
      lastProgressTick: tick,
      rerouteCount: 0,
      retargetCount: 0,
      goblinId: best.goblinId,
      fromOutpostId: best.source.id,
      toOutpostId: best.dest.id,
      targetTileX: homeSpot.tileX,
      targetTileY: homeSpot.tileY,
      targetMicroX: homeSpot.microX,
      targetMicroY: homeSpot.microY,
      bestDistance: dist(
        { x: wm.units?.byGoblinId?.[best.goblinId]?.microX || homeSpot.microX, y: wm.units?.byGoblinId?.[best.goblinId]?.microY || homeSpot.microY },
        { x: homeSpot.microX, y: homeSpot.microY }
      )
    };
    migration.queueIds.push(jobId);
    migration.metrics.jobsCreated += 1;
    assignedGoblinIds.add(best.goblinId);
    created += 1;
    queuedByDestination[dest.id] = (queuedByDestination[dest.id] || 0) + 1;
    events.push({
      type: "MIGRATION_JOB_CREATED",
      goblinId: best.goblinId,
      fromOutpostId: best.source.id,
      toOutpostId: best.dest.id,
      tileX: homeSpot.tileX,
      tileY: homeSpot.tileY,
      text: `${state.goblins.byId[best.goblinId]?.identity?.name || "Goblin"} assigned to migrate ${best.source.id} -> ${best.dest.id}.`
    });
  }
}

function resourceGainMultiplier(state) {
  const mul = Number(state.meta?.tuning?.balance?.resourceGainMul ?? 5);
  if (!Number.isFinite(mul)) return 5;
  return clamp(mul, 0.1, 20);
}

function ensureProcessingState(wm) {
  wm.structures = wm.structures || {};
  if (!wm.structures.processing) {
    wm.structures.processing = {
      tasksById: {},
      queueIds: [],
      nextTaskSeq: 1,
      prioritySnapshot: {}
    };
  }
  const p = wm.structures.processing;
  p.tasksById = p.tasksById || {};
  p.queueIds = p.queueIds || [];
  if (!Number.isFinite(p.nextTaskSeq)) p.nextTaskSeq = 1;
  p.prioritySnapshot = p.prioritySnapshot || {};
  return p;
}

function hasRecipeInputs(state, recipe) {
  const res = state.tribe?.resources || {};
  for (const [key, amount] of Object.entries(recipe.inputs || {})) {
    if ((res[key] || 0) < amount) return false;
  }
  return true;
}

function applyRecipeDelta(resources, delta, sign = 1) {
  for (const [key, amount] of Object.entries(delta || {})) {
    const next = (resources[key] || 0) + amount * sign;
    resources[key] = Math.max(0, next);
  }
}

function activeRecipeCounts(processing) {
  const counts = {};
  for (const id of processing.queueIds || []) {
    const t = processing.tasksById?.[id];
    if (!t) continue;
    counts[t.recipeKey] = (counts[t.recipeKey] || 0) + 1;
  }
  return counts;
}

function recipePrimaryOutput(recipe) {
  return Object.keys(recipe?.outputs || {})[0] || null;
}

function leaderReserveFloorForOutput(state, outputKey) {
  const floors = state.tribe?.governance?.recommendations?.reserveFloors || {};
  if (!outputKey) return 0;
  const v = Number(floors[outputKey] || 0);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.round(v);
}

function recipeStockGap(state, recipeKey) {
  const recipe = PROCESS_RECIPE_DEFS[recipeKey];
  const rule = PROCESS_PRIORITY_RULES[recipeKey];
  if (!recipe || !rule) return 0;
  const outputKey = recipePrimaryOutput(recipe);
  const current = Number(state.tribe?.resources?.[outputKey] || 0);
  const reserveFloor = leaderReserveFloorForOutput(state, outputKey);
  const effectiveTarget = Math.max(rule.targetStock, reserveFloor);
  return Math.max(0, effectiveTarget - current);
}

function computeProcessingPriority(state, recipeKey) {
  const recipe = PROCESS_RECIPE_DEFS[recipeKey];
  const rule = PROCESS_PRIORITY_RULES[recipeKey];
  if (!recipe || !rule) return 0;
  const gap = recipeStockGap(state, recipeKey);
  const normGap = rule.targetStock > 0 ? gap / rule.targetStock : 0;
  const threat = clamp((state.tribe?.threat?.alertLevel || 0) / 100, 0, 1.8);
  const queueLoad = clamp((state.worldMap?.structures?.logistics?.queueIds?.length || 0) / 20, 0, 1.4);
  const resources = state.tribe?.resources || {};

  if (recipeKey === "craft_ammo_bolts") return rule.basePriority + normGap * 3.2 + threat * 1.45;
  if (recipeKey === "craft_springs") return rule.basePriority + normGap * 2.3 + threat * 0.5;
  if (recipeKey === "smelt_metal_parts") return rule.basePriority + normGap * 2.25 + Math.max(0, recipeStockGap(state, "craft_ammo_bolts") / 10) * 0.9;
  if (recipeKey === "burn_charcoal") {
    const oreLow = Math.max(0, (resources.metal_ore || 0) - (resources.charcoal || 0)) / 18;
    return rule.basePriority + normGap * 2.0 + oreLow * 0.8 + queueLoad * 0.2;
  }
  if (recipeKey === "craft_planks") return rule.basePriority + normGap * 1.9 + queueLoad * 0.35 + threat * 0.3;
  if (recipeKey === "craft_rope") return rule.basePriority + normGap * 1.75 + queueLoad * 0.25;
  return rule.basePriority + normGap;
}

function maybeQueueProcessingTask(state, tick, recipeKey, maxQueued = 2) {
  const wm = state.worldMap;
  const processing = ensureProcessingState(wm);
  const recipe = PROCESS_RECIPE_DEFS[recipeKey];
  const rule = PROCESS_PRIORITY_RULES[recipeKey];
  if (!recipe) return;
  if (!rule) return;
  if (recipeStockGap(state, recipeKey) <= 0) return;
  if (!hasRecipeInputs(state, recipe)) return;
  const counts = activeRecipeCounts(processing);
  if ((counts[recipeKey] || 0) >= maxQueued) return;
  const taskId = `proc-${tick}-${processing.nextTaskSeq++}`;
  processing.tasksById[taskId] = {
    id: taskId,
    recipeKey,
    station: recipe.station,
    status: "queued",
    durationTicks: recipe.durationTicks,
    remainingTicks: recipe.durationTicks,
    createdTick: tick,
    claimedByGoblinId: null,
    claimedUntilTick: 0
  };
  processing.queueIds.push(taskId);
  return true;
}

function rebuildProcessingQueue(state, tick) {
  const processing = ensureProcessingState(state.worldMap);
  const preemption = ensureCriticalNeedPreemptionState(state);
  processing.queueIds = (processing.queueIds || []).filter((id) => {
    const task = processing.tasksById?.[id];
    if (!task) return false;
    if (task.status === "done") {
      delete processing.tasksById[id];
      return false;
    }
    if (task.status === "blocked") {
      const recipe = PROCESS_RECIPE_DEFS[task.recipeKey];
      if (!recipe || !hasRecipeInputs(state, recipe)) return false;
      task.status = "queued";
      task.remainingTicks = recipe.durationTicks;
      task.claimedByGoblinId = null;
      task.claimedUntilTick = 0;
    }
    return true;
  });

  const goblinCount = state.goblins?.allIds?.length || 0;
  if (preemption.active) {
    processing.prioritySnapshot = { paused: 1 };
    return;
  }
  const budget = clamp(3 + Math.floor(goblinCount / 8), 3, 10);
  const spareSlots = Math.max(0, budget - processing.queueIds.length);
  if (spareSlots <= 0) return;

  const ranked = Object.keys(PROCESS_RECIPE_DEFS)
    .map((recipeKey) => ({
      recipeKey,
      priority: computeProcessingPriority(state, recipeKey),
      maxQueued: PROCESS_PRIORITY_RULES[recipeKey]?.maxQueued || 2
    }))
    .sort((a, b) => b.priority - a.priority);
  processing.prioritySnapshot = Object.fromEntries(ranked.map((r) => [r.recipeKey, Number(r.priority.toFixed(3))]));

  let queued = 0;
  for (const item of ranked) {
    if (item.priority <= 0.05) continue;
    if (queued >= spareSlots) break;
    if (maybeQueueProcessingTask(state, tick, item.recipeKey, item.maxQueued)) queued += 1;
  }
}

function claimProcessingTask(state, goblinId, tick) {
  const processing = ensureProcessingState(state.worldMap);
  for (const id of processing.queueIds || []) {
    const task = processing.tasksById?.[id];
    if (!task || (task.status !== "queued" && task.status !== "active")) continue;
    if (task.claimedByGoblinId && task.claimedByGoblinId !== goblinId && (task.claimedUntilTick || 0) >= tick) continue;
    task.claimedByGoblinId = goblinId;
    task.claimedUntilTick = tick + 18;
    if (task.status === "queued") task.status = "active";
    return task;
  }
  return null;
}

function roleSupportsRecipe(role, recipeKey) {
  if (!recipeKey) return false;
  if (role === "quartermaster") return true;
  if (role === "smelter") return recipeKey === "smelt_metal_parts";
  if (role === "rope-maker") return recipeKey === "craft_rope";
  if (role === "carpenter") return recipeKey === "craft_planks";
  if (role === "charcoal-burner") return recipeKey === "burn_charcoal";
  if (role === "fletcher") return recipeKey === "craft_ammo_bolts";
  if (role === "mechanist") return recipeKey === "craft_springs";
  return false;
}

function claimProcessingTaskForRole(state, goblinId, role, tick) {
  const processing = ensureProcessingState(state.worldMap);
  for (const id of processing.queueIds || []) {
    const task = processing.tasksById?.[id];
    if (!task || (task.status !== "queued" && task.status !== "active")) continue;
    if (!roleSupportsRecipe(role, task.recipeKey)) continue;
    if (task.claimedByGoblinId && task.claimedByGoblinId !== goblinId && (task.claimedUntilTick || 0) >= tick) continue;
    task.claimedByGoblinId = goblinId;
    task.claimedUntilTick = tick + 18;
    if (task.status === "queued") task.status = "active";
    return task;
  }
  return null;
}

function dropHasAnyHaulableResource(drop) {
  for (const key of HAULABLE_DROP_RESOURCES) {
    if ((drop?.[key] || 0) > 0) return true;
  }
  return false;
}

function updateAdvancedResourceNodes(state) {
  const resources = state.worldMap?.resources;
  if (!resources) return;
  const perTickScale = 1 / ADVANCED_NODE_REGEN_DAY_TICKS;
  for (const storeKey of ["oreNodesByTileKey", "fiberNodesByTileKey", "herbNodesByTileKey", "salvageNodesByTileKey"]) {
    for (const node of Object.values(resources[storeKey] || {})) {
      node.remaining = Math.max(0, Number(node.remaining || 0));
      node.capacity = Math.max(node.remaining, Number(node.capacity || node.remaining || 0));
      if (node.remaining >= node.capacity) continue;
      const regenPerDay = Math.max(0, Number(node.regenPerDay || 0));
      if (regenPerDay <= 0) continue;
      node.__regenProgress = Number(node.__regenProgress || 0) + regenPerDay * perTickScale;
      if (node.__regenProgress >= 1) {
        const gain = Math.floor(node.__regenProgress);
        node.remaining = Math.min(node.capacity, node.remaining + gain);
        node.__regenProgress -= gain;
      }
    }
  }
}

function ensureLogisticsState(wm) {
  wm.structures = wm.structures || {};
  wm.structures.resourceDropsByTileKey = wm.structures.resourceDropsByTileKey || {};
  if (!wm.structures.logistics) {
    wm.structures.logistics = {
      tasksById: {},
      queueIds: [],
      cursor: 0,
      claimsByTaskId: {},
      lastBottleneckTickByReason: {}
    };
  }
  const log = wm.structures.logistics;
  log.tasksById = log.tasksById || {};
  log.queueIds = log.queueIds || [];
  if (typeof log.cursor !== "number") log.cursor = 0;
  log.claimsByTaskId = log.claimsByTaskId || {};
  log.lastBottleneckTickByReason = log.lastBottleneckTickByReason || {};
  return log;
}

function accumulateResourceDrop(wm, resource, amount, microX, microY, tick) {
  if (!amount || amount <= 0) return;
  const key = tileKey(microX, microY);
  const drops = wm.structures.resourceDropsByTileKey;
  const existing = drops[key];
  if (existing) {
    existing[resource] = (existing[resource] || 0) + amount;
    existing.lastUpdatedTick = tick;
    return;
  }
  drops[key] = {
    key,
    tileX: tileToChunkCoord(microX),
    tileY: tileToChunkCoord(microY),
    microX,
    microY,
    [resource]: amount,
    lastUpdatedTick: tick
  };
}

function homeDepotForUnit(state, unit) {
  const siteId = unit.homeSiteId || state.worldMap?.player?.startingSiteId;
  const site = siteId ? state.worldMap?.sitesById?.[siteId] : null;
  if (site) {
    return {
      microX: regionToMicroCenter(site.x),
      microY: regionToMicroCenter(site.y),
      tileX: site.x,
      tileY: site.y
    };
  }
  return {
    microX: unit.homeMicroX,
    microY: unit.homeMicroY,
    tileX: unit.homeTileX,
    tileY: unit.homeTileY
  };
}

function rebuildHaulTasks(state, tick) {
  const wm = state.worldMap;
  const log = ensureLogisticsState(wm);
  const drops = wm.structures.resourceDropsByTileKey || {};
  const nextTaskById = {};
  const nextQueue = [];

  for (const drop of Object.values(drops)) {
    for (const resource of HAULABLE_DROP_RESOURCES) {
      const amount = Math.floor(drop?.[resource] || 0);
      if (amount <= 0) continue;
      const taskId = `haul-${drop.key}-${resource}`;
      const old = log.tasksById[taskId];
      const task = {
        id: taskId,
        kind: "haul",
        resource,
        amountRemaining: amount,
        sourceMicroX: drop.microX,
        sourceMicroY: drop.microY,
        sourceTileX: drop.tileX,
        sourceTileY: drop.tileY,
        sinkKind: "home-depot",
        status: "queued",
        claimedByGoblinId: old?.claimedByGoblinId || null,
        claimedUntilTick: old?.claimedUntilTick || 0,
        createdTick: old?.createdTick || tick,
        updatedTick: tick
      };
      nextTaskById[taskId] = task;
      nextQueue.push(taskId);
    }
  }

  for (const taskId of Object.keys(log.tasksById)) {
    if (nextTaskById[taskId]) continue;
    delete log.claimsByTaskId[taskId];
  }

  log.tasksById = nextTaskById;
  log.queueIds = nextQueue;
}

function claimHaulTask(state, goblinId, fromUnit, tick) {
  const log = ensureLogisticsState(state.worldMap);
  const preemption = ensureCriticalNeedPreemptionState(state);
  const survivalPriority = { water: 4, food: 3, mushrooms: 2, wood: 1 };
  let best = null;
  let bestScore = -Infinity;
  for (const taskId of log.queueIds) {
    const task = log.tasksById[taskId];
    if (!task || task.status !== "queued" || task.amountRemaining <= 0) continue;
    if (task.claimedByGoblinId && (task.claimedUntilTick || 0) >= tick && task.claimedByGoblinId !== goblinId) continue;
    const d = dist({ x: fromUnit.microX, y: fromUnit.microY }, { x: task.sourceMicroX, y: task.sourceMicroY });
    const pri = preemption.active ? (survivalPriority[task.resource] || 0) : 0;
    const score = preemption.active ? pri * 100 - d : -d;
    if (score > bestScore) {
      bestScore = score;
      best = task;
    }
  }
  if (!best) return null;
  best.claimedByGoblinId = goblinId;
  best.claimedUntilTick = tick + 16;
  best.status = "claimed";
  log.claimsByTaskId[best.id] = { goblinId, untilTick: best.claimedUntilTick };
  return best;
}

function emitLogisticsBottlenecks(state, tick, events) {
  const wm = state.worldMap;
  const log = ensureLogisticsState(wm);
  const queue = log.queueIds.filter((id) => {
    const t = log.tasksById[id];
    return t && t.amountRemaining > 0;
  }).length;
  const haulers = Object.values(wm.units?.byGoblinId || {}).filter((u) => u?.roleState?.role === "hauler").length;
  if (queue <= Math.max(2, haulers * 3)) return;
  const last = log.lastBottleneckTickByReason.QUEUE_SATURATION || -1000;
  if (tick - last < 12) return;
  log.lastBottleneckTickByReason.QUEUE_SATURATION = tick;
  events.push({
    type: "LOGISTICS_BOTTLENECK",
    reasonCode: "QUEUE_SATURATION",
    queue,
    haulers,
    text: `Logistics backlog growing: ${queue} haul tasks with ${haulers} haulers.`
  });
}

function hostileWildlifeList(state) {
  const wildlife = state.worldMap?.wildlife;
  if (!wildlife?.allIds?.length) return [];
  const hostiles = [];
  for (const id of wildlife.allIds) {
    const creature = wildlife.byId?.[id];
    if (!creature || !creature.alive || !isHostileWildlifeKind(creature.kind)) continue;
    hostiles.push(creature);
  }
  return hostiles;
}

function ensureAutomatedDefenseState(wm) {
  wm.structures = wm.structures || {};
  wm.structures.automatedDefensesByTileKey = wm.structures.automatedDefensesByTileKey || {};
  for (const defense of Object.values(wm.structures.automatedDefensesByTileKey)) {
    if (!defense) continue;
    defense.status = defense.status || "active";
    defense.ammo = Number.isFinite(defense.ammo) ? defense.ammo : 0;
    defense.maxAmmo = Number.isFinite(defense.maxAmmo) ? defense.maxAmmo : (defense.kind === "spring_turret" ? 10 : 0);
    defense.durability = Number.isFinite(defense.durability) ? defense.durability : 100;
    defense.maxDurability = Number.isFinite(defense.maxDurability) ? defense.maxDurability : 100;
    defense.range = Number.isFinite(defense.range) ? defense.range : (defense.kind === "spring_turret" ? 7 : 1.4);
    defense.cooldownTicks = Number.isFinite(defense.cooldownTicks) ? defense.cooldownTicks : (defense.kind === "spring_turret" ? 4 : 7);
    defense.lastActionTick = Number.isFinite(defense.lastActionTick) ? defense.lastActionTick : -1000;
    defense.maintenanceClaimedByGoblinId = defense.maintenanceClaimedByGoblinId || null;
    defense.maintenanceClaimUntilTick = Number.isFinite(defense.maintenanceClaimUntilTick) ? defense.maintenanceClaimUntilTick : -1;
    defense.maintenanceNeeded = Boolean(defense.maintenanceNeeded);
    defense.lastStatus = defense.lastStatus || defense.status;
  }
  return wm.structures.automatedDefensesByTileKey;
}

function setAutomatedDefenseStatus(defense, status, events, tick) {
  const prev = defense.status || "active";
  defense.status = status;
  if (defense.lastStatus === status) return;
  defense.lastStatus = status;
  events.push({
    type: "AUTOMATED_DEFENSE_STATUS",
    defenseId: defense.id,
    defenseKind: defense.kind,
    status,
    previousStatus: prev,
    tileX: defense.tileX,
    tileY: defense.tileY,
    tick,
    text: `${defense.kind} changed status to ${status}.`
  });
}

function releaseExpiredDefenseClaims(wm, tick) {
  const defenses = ensureAutomatedDefenseState(wm);
  for (const defense of Object.values(defenses)) {
    if (!defense) continue;
    if ((defense.maintenanceClaimUntilTick || -1) < tick) {
      defense.maintenanceClaimedByGoblinId = null;
      defense.maintenanceClaimUntilTick = -1;
    }
  }
}

function nearestHostileToDefense(defense, hostiles) {
  let best = null;
  let bestDist = Infinity;
  for (const hostile of hostiles) {
    const d = dist({ x: defense.microX, y: defense.microY }, { x: hostile.microX, y: hostile.microY });
    if (d < bestDist) {
      bestDist = d;
      best = hostile;
    }
  }
  return best ? { hostile: best, distance: bestDist } : null;
}

function updateAutomatedDefenses(state, tick, events) {
  const wm = state.worldMap;
  const defenses = ensureAutomatedDefenseState(wm);
  releaseExpiredDefenseClaims(wm, tick);
  const hostiles = hostileWildlifeList(state);

  for (const defense of Object.values(defenses)) {
    if (!defense) continue;
    const isTurret = defense.kind === "spring_turret";
    const isTrap = defense.kind === "spike_trap";
    const broken = Number(defense.durability || 0) <= 0;
    if (broken) {
      defense.maintenanceNeeded = true;
      setAutomatedDefenseStatus(defense, "inactive_no_parts", events, tick);
      continue;
    }

    if (isTurret) {
      if (Number(defense.ammo || 0) <= 0) {
        defense.maintenanceNeeded = true;
        setAutomatedDefenseStatus(defense, "inactive_no_ammo", events, tick);
        continue;
      }

      if (tick - (defense.lastActionTick || -1000) < defense.cooldownTicks) {
        defense.maintenanceNeeded = defense.ammo <= Math.max(1, Math.floor(defense.maxAmmo * 0.25));
        if (defense.status !== "active") setAutomatedDefenseStatus(defense, "active", events, tick);
        continue;
      }

      const nearest = nearestHostileToDefense(defense, hostiles);
      if (!nearest || nearest.distance > defense.range) {
        defense.maintenanceNeeded = defense.ammo <= Math.max(1, Math.floor(defense.maxAmmo * 0.25));
        if (defense.status !== "active") setAutomatedDefenseStatus(defense, "active", events, tick);
        continue;
      }

      defense.lastActionTick = tick;
      defense.ammo = Math.max(0, defense.ammo - 1);
      defense.durability = Math.max(0, defense.durability - 1);
      const damage = 18 + Math.floor(rand01("turret-hit", tick, defense.id, nearest.hostile.id) * 10);
      nearest.hostile.health = clamp((nearest.hostile.health ?? 100) - damage, 0, 100);
      events.push({
        type: "AUTOMATED_DEFENSE_FIRED",
        defenseId: defense.id,
        defenseKind: defense.kind,
        wildlifeId: nearest.hostile.id,
        wildlifeKind: nearest.hostile.kind,
        damage,
        tileX: defense.tileX,
        tileY: defense.tileY,
        text: `${defense.kind} fired at ${nearest.hostile.kind} ${nearest.hostile.id}.`
      });
      if (nearest.hostile.health <= 0) {
        removeWildlifeFromState(state, nearest.hostile.id);
        events.push({
          type: "AUTOMATED_DEFENSE_KILL",
          defenseId: defense.id,
          defenseKind: defense.kind,
          wildlifeId: nearest.hostile.id,
          wildlifeKind: nearest.hostile.kind,
          tileX: defense.tileX,
          tileY: defense.tileY,
          text: `${defense.kind} neutralized ${nearest.hostile.kind} ${nearest.hostile.id}.`
        });
      }

      if (defense.durability <= 0) {
        defense.maintenanceNeeded = true;
        setAutomatedDefenseStatus(defense, "inactive_no_parts", events, tick);
      } else if (defense.ammo <= 0) {
        defense.maintenanceNeeded = true;
        setAutomatedDefenseStatus(defense, "inactive_no_ammo", events, tick);
      } else {
        defense.maintenanceNeeded = defense.ammo <= Math.max(1, Math.floor(defense.maxAmmo * 0.25));
        if (defense.status !== "active") setAutomatedDefenseStatus(defense, "active", events, tick);
      }
      continue;
    }

    if (isTrap) {
      if (defense.status === "inactive_triggered") {
        defense.maintenanceNeeded = true;
        continue;
      }
      if (tick - (defense.lastActionTick || -1000) < defense.cooldownTicks) continue;
      const nearest = nearestHostileToDefense(defense, hostiles);
      if (!nearest || nearest.distance > defense.range) {
        defense.maintenanceNeeded = false;
        if (defense.status !== "active") setAutomatedDefenseStatus(defense, "active", events, tick);
        continue;
      }
      defense.lastActionTick = tick;
      defense.durability = Math.max(0, defense.durability - 8);
      const damage = 42 + Math.floor(rand01("trap-hit", tick, defense.id, nearest.hostile.id) * 16);
      nearest.hostile.health = clamp((nearest.hostile.health ?? 100) - damage, 0, 100);
      defense.maintenanceNeeded = true;
      setAutomatedDefenseStatus(defense, "inactive_triggered", events, tick);
      events.push({
        type: "AUTOMATED_DEFENSE_TRIGGERED",
        defenseId: defense.id,
        defenseKind: defense.kind,
        wildlifeId: nearest.hostile.id,
        wildlifeKind: nearest.hostile.kind,
        damage,
        tileX: defense.tileX,
        tileY: defense.tileY,
        text: `${defense.kind} triggered on ${nearest.hostile.kind} ${nearest.hostile.id}.`
      });
      if (nearest.hostile.health <= 0) {
        removeWildlifeFromState(state, nearest.hostile.id);
        events.push({
          type: "AUTOMATED_DEFENSE_KILL",
          defenseId: defense.id,
          defenseKind: defense.kind,
          wildlifeId: nearest.hostile.id,
          wildlifeKind: nearest.hostile.kind,
          tileX: defense.tileX,
          tileY: defense.tileY,
          text: `${defense.kind} neutralized ${nearest.hostile.kind} ${nearest.hostile.id}.`
        });
      }
      if (defense.durability <= 0) setAutomatedDefenseStatus(defense, "inactive_no_parts", events, tick);
      continue;
    }
  }
}

function claimAutomatedDefenseTask(state, goblinId, role, fromUnit, tick) {
  const wm = state.worldMap;
  const defenses = ensureAutomatedDefenseState(wm);
  releaseExpiredDefenseClaims(wm, tick);
  const canResupply = role === "fletcher" || role === "quartermaster" || role === "hauler";
  const canRepair = role === "mechanist" || role === "builder";
  const canReset = role === "builder" || role === "rope-maker";

  let best = null;
  let bestScore = -Infinity;
  for (const defense of Object.values(defenses)) {
    if (!defense) continue;
    const claimedByOther = defense.maintenanceClaimedByGoblinId
      && defense.maintenanceClaimedByGoblinId !== goblinId
      && (defense.maintenanceClaimUntilTick || -1) >= tick;
    if (claimedByOther) continue;

    let taskKind = null;
    let urgency = 0;
    if (canRepair && (defense.status === "inactive_no_parts" || defense.durability <= Math.floor(defense.maxDurability * 0.4))) {
      taskKind = "repair-defense";
      urgency = defense.status === "inactive_no_parts" ? 4 : 2.5;
    } else if (canReset && defense.kind === "spike_trap" && defense.status === "inactive_triggered") {
      taskKind = "reset-trap";
      urgency = 3.2;
    } else if (canResupply && defense.kind === "spring_turret") {
      const lowAmmo = defense.ammo <= Math.max(1, Math.floor(defense.maxAmmo * 0.25));
      if (defense.status === "inactive_no_ammo" || lowAmmo) {
        taskKind = "resupply-defense";
        urgency = defense.status === "inactive_no_ammo" ? 3.8 : 1.8;
      }
    }
    if (!taskKind) continue;
    const d = dist({ x: fromUnit.microX, y: fromUnit.microY }, { x: defense.microX, y: defense.microY });
    const score = urgency * 20 - d;
    if (score > bestScore) {
      bestScore = score;
      best = { defense, taskKind };
    }
  }
  if (!best) return null;
  best.defense.maintenanceClaimedByGoblinId = goblinId;
  best.defense.maintenanceClaimUntilTick = tick + DEFENSE_MAINTENANCE_CLAIM_TICKS;
  return {
    kind: best.taskKind,
    defenseId: best.defense.id,
    targetMicroX: best.defense.microX,
    targetMicroY: best.defense.microY,
    targetTileX: best.defense.tileX,
    targetTileY: best.defense.tileY
  };
}

function automatedDefenseById(wm, defenseId) {
  if (!defenseId) return null;
  const defenses = ensureAutomatedDefenseState(wm);
  for (const defense of Object.values(defenses)) {
    if (defense?.id === defenseId) return defense;
  }
  return null;
}

function nearestHostileToUnit(unit, hostiles) {
  let best = null;
  let bestDist = Infinity;
  for (const hostile of hostiles) {
    const d = dist({ x: unit.microX, y: unit.microY }, { x: hostile.microX, y: hostile.microY });
    if (d < bestDist) {
      bestDist = d;
      best = hostile;
    }
  }
  return best ? { hostile: best, distance: bestDist } : null;
}

function countHostilesNearPoint(hostiles, x, y, radius) {
  let count = 0;
  for (const hostile of hostiles) {
    if (dist({ x, y }, { x: hostile.microX, y: hostile.microY }) <= radius) count += 1;
  }
  return count;
}

function canGoblinDefend(goblin, localHostileCount, nearestHostileKind = null) {
  const vitality = goblin.body?.health?.vitality ?? 100;
  const morale = goblin.psyche?.morale ?? 50;
  const stress = goblin.psyche?.stress ?? 0;
  if (nearestHostileKind === "barbarian" || nearestHostileKind === "ogre") {
    if (vitality < 45) return false;
    if (morale < 30) return false;
    if (stress > 85) return false;
    return localHostileCount <= 3;
  }
  if (vitality < DEFENDER_MIN_VITALITY) return false;
  if (morale < DEFENDER_MIN_MORALE) return false;
  if (stress > DEFENDER_MAX_STRESS) return false;
  return localHostileCount <= 2;
}

function nearestDefendedTileForUnit(state, unit) {
  const walls = Object.values(state.worldMap?.structures?.wallsByTileKey || {});
  let best = null;
  let bestDist = Infinity;
  for (const wall of walls) {
    const d = dist({ x: wall.microX, y: wall.microY }, { x: unit.homeMicroX, y: unit.homeMicroY });
    if (d > 6) continue;
    if (d < bestDist) {
      bestDist = d;
      best = wall;
    }
  }
  if (!best) return { x: unit.homeMicroX, y: unit.homeMicroY };
  return { x: best.microX, y: best.microY };
}

function defensePointForMap(state) {
  const siteId = state.worldMap?.player?.startingSiteId;
  const site = siteId ? state.worldMap?.sitesById?.[siteId] : null;
  if (site) {
    return {
      x: regionToMicroCenter(site.x),
      y: regionToMicroCenter(site.y)
    };
  }

  const units = Object.values(state.worldMap?.units?.byGoblinId || {});
  if (!units.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const unit of units) {
    sx += unit.homeMicroX;
    sy += unit.homeMicroY;
  }
  return { x: Math.round(sx / units.length), y: Math.round(sy / units.length) };
}

function threatScoreForDistance(distance, localHostiles, localRadius) {
  const distanceFactor = Math.max(0, localRadius - distance) / localRadius;
  const clusterFactor = Math.max(0, localHostiles - 1) * 0.18;
  return clamp((distanceFactor + clusterFactor) * 100, 0, 100);
}

function updateGoblinThreatResponses(state, tick, events) {
  const byGoblinId = {};
  const hostiles = hostileWildlifeList(state);
  const defensePoint = defensePointForMap(state);
  const tuning = threatTuning(state);
  let maxThreatScore = 0;

  for (const goblinId of state.goblins.allIds) {
    const goblin = state.goblins.byId[goblinId];
    const unit = state.worldMap?.units?.byGoblinId?.[goblinId];
    if (!goblin || !unit || !goblin.flags.alive || goblin.flags.missing) continue;

    goblin.modData = goblin.modData || {};
    const threatResponse = goblin.modData.threatResponse || {
      mode: "none",
      activeThreatId: null,
      lastThreatTick: null
    };
    goblin.modData.threatResponse = threatResponse;
    if (typeof threatResponse.noPathThreatTicks !== "number") threatResponse.noPathThreatTicks = 0;
    if (typeof threatResponse.suppressedUntilTick !== "number") threatResponse.suppressedUntilTick = -1;

    const nearest = nearestHostileToUnit(unit, hostiles);
    const localHostiles = nearest
      ? countHostilesNearPoint(hostiles, unit.microX, unit.microY, tuning.localRadius)
      : 0;
    const prevMode = threatResponse.mode || "none";
    let mode = "none";
    let activeThreatId = null;
    let targetMicroX = defensePoint.x;
    let targetMicroY = defensePoint.y;
    let threatScore = 0;

    const suppressed = tick < threatResponse.suppressedUntilTick;
    if (!suppressed && nearest && nearest.distance <= tuning.localRadius) {
      activeThreatId = nearest.hostile.id;
      threatScore = threatScoreForDistance(nearest.distance, localHostiles, tuning.localRadius);
      threatResponse.lastThreatTick = tick;
      if (nearest.distance <= tuning.directRadius) {
        mode = canGoblinDefend(goblin, localHostiles, nearest.hostile.kind) ? "defend" : "flee";
      } else {
        mode = "regroup";
      }
      if (mode === "defend") {
        targetMicroX = nearest.hostile.microX;
        targetMicroY = nearest.hostile.microY;
      } else if (mode === "flee") {
        const defended = nearestDefendedTileForUnit(state, unit);
        targetMicroX = defended.x;
        targetMicroY = defended.y;
      }
    } else if (
      !suppressed &&
      typeof threatResponse.lastThreatTick === "number"
      && tick - threatResponse.lastThreatTick <= THREAT_RESPONSE_MEMORY_TICKS
    ) {
      mode = "regroup";
      threatScore = 20;
    }

    if (mode === "none") {
      activeThreatId = null;
      targetMicroX = unit.homeMicroX;
      targetMicroY = unit.homeMicroY;
    }

    threatResponse.mode = mode;
    threatResponse.activeThreatId = activeThreatId;
    threatResponse.targetMicroX = targetMicroX;
    threatResponse.targetMicroY = targetMicroY;
    threatResponse.threatScore = threatScore;
    threatResponse.lastEvaluatedTick = tick;

    byGoblinId[goblinId] = {
      mode,
      threatScore,
      activeThreatId,
      localHostiles,
      targetMicroX,
      targetMicroY,
      threatMicroX: nearest ? nearest.hostile.microX : undefined,
      threatMicroY: nearest ? nearest.hostile.microY : undefined
    };

    if (threatScore > maxThreatScore) maxThreatScore = threatScore;

    const lastModeEventTick = threatResponse.lastModeEventTick || -1000;
    if (prevMode !== mode && tick - lastModeEventTick >= THREAT_MODE_EVENT_COOLDOWN) {
      threatResponse.lastModeEventTick = tick;
      events.push({
        type: "GOBLIN_THREAT_MODE_CHANGED",
        goblinId,
        mode,
        prevMode,
        threatId: activeThreatId || undefined,
        text: `${goblin.identity.name} switched threat mode ${prevMode} -> ${mode}.`
      });
    }
  }

  state.tribe = state.tribe || {};
  state.tribe.threat = state.tribe.threat || { alertLevel: 0 };
  state.tribe.threat.alertLevel = Math.round(maxThreatScore);
  return byGoblinId;
}

function threatGoalForGoblin(state, goblin, unit, role, tick, events, threatState) {
  if (!threatState || threatState.mode === "none") return null;

  if (threatState.mode === "flee") {
    const task = {
      kind: "flee-threat",
      targetMicroX: threatState.targetMicroX,
      targetMicroY: threatState.targetMicroY,
      fromThreatX: threatState.threatMicroX,
      fromThreatY: threatState.threatMicroY
    };
    maybeEmitTaskClaimed(events, goblin, unit, role, task);
    setRoleTask(unit, role, task, tick);
    return task;
  }

  if (threatState.mode === "defend") {
    const task = {
      kind: "defend-threat",
      targetMicroX: threatState.targetMicroX,
      targetMicroY: threatState.targetMicroY,
      targetThreatId: threatState.activeThreatId || undefined
    };
    maybeEmitTaskClaimed(events, goblin, unit, role, task);
    setRoleTask(unit, role, task, tick);
    return task;
  }

  const task = {
    kind: "regroup-defense",
    targetMicroX: threatState.targetMicroX,
    targetMicroY: threatState.targetMicroY
  };
  maybeEmitTaskClaimed(events, goblin, unit, role, task);
  setRoleTask(unit, role, task, tick);
  return task;
}

function isThreatGoalKind(kind) {
  return kind === "defend-threat" || kind === "flee-threat" || kind === "regroup-defense";
}

function ensureRolePolicy(state) {
  const wm = state.worldMap;
  wm.structures = wm.structures || {};
  if (!wm.structures.rolePolicy) {
    wm.structures.rolePolicy = {
      mode: "assist",
      minRoleHoldTicks: 40,
      reassignmentCooldownTicks: 26,
      hysteresis: 1,
      updateEveryTicks: 6,
      targets: {}
    };
  }
  const p = wm.structures.rolePolicy;
  if (p.mode !== "manual" && p.mode !== "assist" && p.mode !== "auto-balance") p.mode = "assist";
  if (!Number.isFinite(p.minRoleHoldTicks)) p.minRoleHoldTicks = 40;
  if (!Number.isFinite(p.reassignmentCooldownTicks)) p.reassignmentCooldownTicks = 26;
  if (!Number.isFinite(p.hysteresis)) p.hysteresis = 1;
  if (!Number.isFinite(p.updateEveryTicks)) p.updateEveryTicks = 6;
  p.targets = p.targets || {};
  p.override = p.override || null;
  return p;
}

function computeCriticalNeedSnapshot(state) {
  const out = {
    totalCritical: 0,
    hungerCritical: 0,
    thirstCritical: 0,
    restCritical: 0,
    warmthCritical: 0,
    moraleCritical: 0,
    vitalityCritical: 0,
    tier: "none"
  };

  for (const goblinId of state.goblins.allIds) {
    const g = state.goblins.byId[goblinId];
    if (!g || !g.flags?.alive || g.flags?.missing) continue;
    let isCritical = false;
    if ((g.needs?.hunger || 0) >= 85) {
      out.hungerCritical += 1;
      isCritical = true;
    }
    if ((g.needs?.thirst || 0) >= 85) {
      out.thirstCritical += 1;
      isCritical = true;
    }
    if ((g.needs?.rest || 0) >= 88) {
      out.restCritical += 1;
      isCritical = true;
    }
    if ((g.needs?.warmth || 0) >= 88) {
      out.warmthCritical += 1;
      isCritical = true;
    }
    if ((g.psyche?.morale || 100) <= 20) {
      out.moraleCritical += 1;
      isCritical = true;
    }
    if ((g.body?.health?.vitality || 100) <= 52) {
      out.vitalityCritical += 1;
      isCritical = true;
    }
    if (isCritical) out.totalCritical += 1;
  }

  const n = Math.max(1, state.goblins.allIds.length);
  if (out.totalCritical >= Math.max(CRITICAL_NEEDS_TRIGGER_COUNT + 4, Math.ceil(n * 0.6))) {
    out.tier = "collapse";
  } else if (out.totalCritical >= CRITICAL_NEEDS_TRIGGER_COUNT) {
    out.tier = "critical";
  } else if (out.totalCritical >= CRITICAL_NEEDS_RELEASE_COUNT) {
    out.tier = "elevated";
  } else {
    out.tier = "none";
  }
  return out;
}

function ensureCriticalNeedPreemptionState(state) {
  const wm = state.worldMap;
  wm.structures = wm.structures || {};
  if (!wm.structures.criticalNeedPreemption) {
    wm.structures.criticalNeedPreemption = {
      active: false,
      tier: "none",
      sinceTick: null,
      holdUntilTick: null,
      lastChangedTick: null,
      suppressedRoles: [],
      snapshot: null
    };
  }
  return wm.structures.criticalNeedPreemption;
}

function updateCriticalNeedPreemption(state, tick, events) {
  const preemption = ensureCriticalNeedPreemptionState(state);
  const snapshot = computeCriticalNeedSnapshot(state);
  preemption.snapshot = snapshot;

  const shouldActivate = snapshot.tier === "critical" || snapshot.tier === "collapse";
  const holdUntil = Number.isFinite(preemption.holdUntilTick) ? preemption.holdUntilTick : -1;
  const canRelease = tick >= holdUntil;
  const shouldRelease = snapshot.tier === "none" || snapshot.totalCritical <= CRITICAL_NEEDS_RELEASE_COUNT;

  if (!preemption.active && shouldActivate) {
    preemption.active = true;
    preemption.tier = snapshot.tier;
    preemption.sinceTick = tick;
    preemption.lastChangedTick = tick;
    preemption.holdUntilTick = tick + CRITICAL_NEEDS_PREEMPTION_MIN_HOLD_TICKS;
    events.push({
      type: "CRITICAL_NEEDS_PREEMPTION_STARTED",
      totalCritical: snapshot.totalCritical,
      tier: snapshot.tier,
      holdUntilTick: preemption.holdUntilTick,
      suppressedRoles: preemption.suppressedRoles,
      text: `Critical-needs preemption activated (${snapshot.totalCritical} critical goblins, tier ${snapshot.tier}).`
    });
  } else if (preemption.active && canRelease && shouldRelease) {
    preemption.active = false;
    preemption.tier = snapshot.tier;
    preemption.lastChangedTick = tick;
    preemption.holdUntilTick = null;
    events.push({
      type: "CRITICAL_NEEDS_PREEMPTION_ENDED",
      totalCritical: snapshot.totalCritical,
      tier: snapshot.tier,
      text: "Critical-needs preemption ended; normal role priorities resumed."
    });
  } else if (preemption.active) {
    preemption.tier = snapshot.tier === "none" ? "critical" : snapshot.tier;
  }

  preemption.suppressedRoles = preemption.active
    ? ["scout", "colony-establisher", "homebuilder", "miner", "fiber-harvester", "herbalist", "smelter", "rope-maker", "carpenter", "charcoal-burner", "fletcher", "mechanist"]
    : [];
}

function evaluateQuartermasterDirective(state, tick, events) {
  const wm = state.worldMap;
  const policy = ensureRolePolicy(state);
  const quartermasters = state.goblins.allIds.filter((id) => {
    const u = wm.units?.byGoblinId?.[id];
    const g = state.goblins.byId?.[id];
    if (!u || !g || !g.flags?.alive || g.flags?.missing) return false;
    return normalizeRole(u.roleState?.role || g.social?.role) === "quartermaster";
  });

  const threat = state.tribe?.threat?.alertLevel || 0;
  const criticalNeeds = state.goblins.allIds.reduce((n, id) => {
    const g = state.goblins.byId[id];
    if (!g) return n;
    if (g.needs.thirst >= 85 || g.needs.hunger >= 85 || g.psyche.morale <= 22) return n + 1;
    return n;
  }, 0);
  const emergency = threat >= 55 || criticalNeeds >= 3;

  if (!quartermasters.length || !emergency) {
    if (policy.override && tick > (policy.override.untilTick || -1)) {
      policy.override = null;
    }
    return;
  }

  const overrideTargets = {
    builderCount: Math.max(1, Math.round(state.goblins.allIds.length * 0.24)),
    lookoutCount: Math.max(1, Math.round(state.goblins.allIds.length * 0.18)),
    waterRunnerCount: Math.max(1, Math.round(state.goblins.allIds.length * 0.18))
  };
  const prevUntil = policy.override?.untilTick || -1000;
  policy.override = {
    reason: threat >= 55 ? "THREAT_SPIKE" : "CRITICAL_NEEDS",
    activatedByGoblinId: quartermasters[0],
    startedTick: tick,
    untilTick: tick + 18,
    targets: overrideTargets
  };

  if (tick > prevUntil) {
    const qm = state.goblins.byId[quartermasters[0]];
    events.push({
      type: "ROLE_POLICY_OVERRIDE",
      goblinId: quartermasters[0],
      reasonCode: policy.override.reason,
      overrideUntilTick: policy.override.untilTick,
      targets: overrideTargets,
      text: `${qm?.identity?.name || "Quartermaster"} issued emergency role override (${policy.override.reason}).`
    });
  }
}

function computeRoleCounts(state) {
  const counts = Object.fromEntries(ROLE_KEYS.map((r) => [r, 0]));
  for (const goblinId of state.goblins.allIds) {
    const unit = state.worldMap?.units?.byGoblinId?.[goblinId];
    const role = normalizeRole(unit?.roleState?.role || state.goblins.byId[goblinId]?.social?.role);
    counts[role] = (counts[role] || 0) + 1;
  }
  return counts;
}

function computeRoleDemand(state) {
  const goblinCount = state.goblins.allIds.length || 1;
  const avgNeed = state.goblins.allIds.reduce(
    (acc, id) => {
      const g = state.goblins.byId[id];
      if (!g) return acc;
      acc.hunger += g.needs.hunger || 0;
      acc.thirst += g.needs.thirst || 0;
      return acc;
    },
    { hunger: 0, thirst: 0 }
  );
  avgNeed.hunger /= goblinCount;
  avgNeed.thirst /= goblinCount;
  const foodStock = state.tribe?.resources?.food || 0;
  const waterStock = state.tribe?.resources?.water || 0;
  const woodStock = state.tribe?.resources?.wood || 0;
  const oreStock = state.tribe?.resources?.metal_ore || 0;
  const partsStock = state.tribe?.resources?.metal_parts || 0;
  const fiberStock = state.tribe?.resources?.fiber || 0;
  const herbsStock = state.tribe?.resources?.herbs || 0;
  const ropeStock = state.tribe?.resources?.rope || 0;
  const plankStock = state.tribe?.resources?.wood_planks || 0;
  const charcoalStock = state.tribe?.resources?.charcoal || 0;
  const ammoStock = state.tribe?.resources?.ammo_bolts || 0;
  const springStock = state.tribe?.resources?.springs || 0;
  const foodPressure = clamp((avgNeed.hunger - 35) / 55 + Math.max(0, 24 - foodStock) / 24, 0, 1.8);
  const waterPressure = clamp((avgNeed.thirst - 35) / 55 + Math.max(0, 24 - waterStock) / 24, 0, 1.8);
  const plannedWalls = countPlannedWallsAcrossPlans(state.worldMap);
  const wallPressure = clamp(plannedWalls / 25, 0, 1.5);
  const threatPressure = clamp((state.tribe?.threat?.alertLevel || 0) / 100 + (state.worldMap?.structures?.threatMemory?.allIds?.length || 0) / 8, 0, 2);
  const lowIntelRegions = Object.values(state.worldMap?.intel?.knownRegions || {}).filter((r) => (r?.confidence || 0) < 0.65).length;
  const totalRegions = Object.keys(state.worldMap?.regionsById || {}).length || 1;
  const intelPressure = clamp(lowIntelRegions / totalRegions, 0, 1);
  const woodPressure = clamp(Math.max(0, 16 - woodStock) / 16 + wallPressure * 0.5, 0, 1.6);
  const haulQueue = state.worldMap?.structures?.logistics?.queueIds?.length || 0;
  const processingQueue = state.worldMap?.structures?.processing?.queueIds?.length || 0;
  const processingPressure = clamp(processingQueue / 12, 0, 1.8);
  const haulerPressure = clamp(haulQueue / 14, 0, 1.8);
  const careNeedCount = state.goblins.allIds.reduce((n, id) => {
    const g = state.goblins.byId[id];
    if (!g || !g.flags?.alive || g.flags?.missing) return n;
    const critical =
      g.needs.thirst >= 82 ||
      g.needs.hunger >= 82 ||
      g.needs.rest >= 84 ||
      g.needs.warmth >= 84 ||
      (g.psyche?.morale || 0) <= 26 ||
      (g.body?.health?.vitality || 100) <= 58;
    return n + (critical ? 1 : 0);
  }, 0);
  const caretakerPressure = clamp(careNeedCount / Math.max(1, state.goblins.allIds.length * 0.35), 0, 1.9);
  const colonyPressure = clamp(lowIntelRegions / Math.max(1, totalRegions * 0.3), 0, 1.7);
  const repro = ensureReproductionState(state);
  const reproSafety = reproductionSafety(state, repro);
  const birthCapacity = clamp((repro.maxBirthsPerDay - repro.birthsThisDay) / Math.max(1, repro.maxBirthsPerDay), 0, 1);
  const reproCooldownReady = (state.meta.tick - (repro.lastBirthTick || -1000)) >= repro.cooldownTicks ? 1 : 0;
  const reproductionPressure = repro.enabled && reproSafety.safe
    ? clamp((0.55 + reproCooldownReady * 0.45) * birthCapacity, 0, 1.2)
    : 0;
  const orePressure = clamp(Math.max(0, 20 - oreStock) / 20 + processingPressure * 0.3, 0, 1.8);
  const partsPressure = clamp(Math.max(0, 16 - partsStock) / 16 + processingPressure * 0.5, 0, 1.9);
  const fiberPressure = clamp(Math.max(0, 18 - fiberStock) / 18 + processingPressure * 0.35, 0, 1.8);
  const herbPressure = clamp(Math.max(0, 12 - herbsStock) / 12 + threatPressure * 0.2, 0, 1.4);
  const ropePressure = clamp(Math.max(0, 12 - ropeStock) / 12 + processingPressure * 0.25, 0, 1.6);
  const plankPressure = clamp(Math.max(0, 20 - plankStock) / 20 + processingPressure * 0.35, 0, 1.7);
  const charcoalPressure = clamp(Math.max(0, 14 - charcoalStock) / 14 + processingPressure * 0.35, 0, 1.7);
  const ammoPressure = clamp(Math.max(0, 14 - ammoStock) / 14 + threatPressure * 0.55 + processingPressure * 0.25, 0, 2.2);
  const springPressure = clamp(Math.max(0, 10 - springStock) / 10 + processingPressure * 0.3, 0, 1.8);

  return {
    foodPressure,
    waterPressure,
    woodPressure,
    wallPressure,
    threatPressure,
    intelPressure,
    processingPressure,
    haulerPressure,
    caretakerPressure,
    colonyPressure,
    reproductionPressure,
    orePressure,
    partsPressure,
    fiberPressure,
    herbPressure,
    ropePressure,
    plankPressure,
    charcoalPressure,
    ammoPressure,
    springPressure
  };
}

function computeOutpostEmergencyDemand(state) {
  const outposts = Object.values(state.worldMap?.structures?.outpostsById || {});
  const failingOutposts = outposts.filter((o) => (o.runtime?.status || "seeded") === "failing");
  const criticalOutposts = outposts.filter((o) => (o.priority || "normal") === "critical");
  const emergencyOutposts = outposts.filter((o) => (o.priority || "normal") === "critical" || (o.runtime?.status || "seeded") === "failing");

  const deficitByRole = { forager: 0, builder: 0, "water-runner": 0 };
  for (const outpost of emergencyOutposts) {
    const def = outpost.runtime?.deficitByRole || {};
    deficitByRole.forager += Math.max(0, def.forager || 0);
    deficitByRole.builder += Math.max(0, def.builder || 0);
    deficitByRole["water-runner"] += Math.max(0, def["water-runner"] || 0);
  }

  return {
    failingCount: failingOutposts.length,
    criticalCount: criticalOutposts.length,
    emergencyCount: emergencyOutposts.length,
    deficitByRole
  };
}

function computeLeaderStaffingTargets(state, n) {
  const rec = state.tribe?.governance?.recommendations?.staffingTargetByOutpostId || null;
  if (!rec) return null;
  const totals = Object.fromEntries(ROLE_KEYS.map((r) => [r, 0]));
  let any = false;
  for (const targets of Object.values(rec)) {
    if (!targets || typeof targets !== "object") continue;
    for (const [role, raw] of Object.entries(targets)) {
      if (!Object.prototype.hasOwnProperty.call(totals, role)) continue;
      const v = Math.max(0, Math.round(Number(raw) || 0));
      if (v > 0) any = true;
      totals[role] += v;
    }
  }
  if (!any) return null;
  const totalAssigned = Object.values(totals).reduce((a, b) => a + b, 0);
  if (totalAssigned > Math.max(1, n)) {
    const scale = n / totalAssigned;
    for (const role of Object.keys(totals)) {
      totals[role] = Math.max(0, Math.round(totals[role] * scale));
    }
  }
  return totals;
}

function applyLeaderLearningToRoleScores(state, scores) {
  const learning = state.tribe?.governance?.learning;
  const w = learning?.domainWeights;
  if (!w) return scores;
  const confidence = clamp(Number(learning.confidence ?? 0.5), 0, 1);
  const influence = clamp(0.16 + confidence * 0.12, 0.14, 0.28);
  const baseline = { food: 20, water: 20, defense: 20, industry: 14, logistics: 14, expansion: 8, diplomacy: 4 };
  const domainFactor = {};
  for (const key of Object.keys(baseline)) {
    const b = baseline[key];
    const raw = Number(w[key] || b);
    const ratio = (raw - b) / Math.max(1, b);
    domainFactor[key] = clamp(1 + ratio * influence, 0.82, 1.24);
  }
  const byRole = {
    forager: 0.6 * domainFactor.food + 0.4 * domainFactor.water,
    fisherman: 0.55 * domainFactor.food + 0.45 * domainFactor.water,
    hunter: 0.7 * domainFactor.food + 0.3 * domainFactor.defense,
    "water-runner": 0.7 * domainFactor.water + 0.3 * domainFactor.logistics,
    woodcutter: 0.5 * domainFactor.industry + 0.5 * domainFactor.logistics,
    builder: 0.6 * domainFactor.defense + 0.4 * domainFactor.industry,
    homebuilder: 0.7 * domainFactor.expansion + 0.3 * domainFactor.industry,
    sentinel: domainFactor.defense,
    lookout: 0.7 * domainFactor.defense + 0.3 * domainFactor.expansion,
    hauler: domainFactor.logistics,
    caretaker: 0.55 * domainFactor.logistics + 0.45 * domainFactor.food,
    quartermaster: 0.55 * domainFactor.logistics + 0.45 * domainFactor.diplomacy,
    scout: 0.7 * domainFactor.expansion + 0.3 * domainFactor.diplomacy,
    "colony-establisher": domainFactor.expansion,
    reproducer: 0.7 * domainFactor.expansion + 0.3 * domainFactor.food,
    miner: domainFactor.industry,
    "fiber-harvester": 0.8 * domainFactor.industry + 0.2 * domainFactor.logistics,
    herbalist: 0.6 * domainFactor.industry + 0.4 * domainFactor.food,
    smelter: domainFactor.industry,
    "rope-maker": 0.75 * domainFactor.industry + 0.25 * domainFactor.logistics,
    carpenter: 0.8 * domainFactor.industry + 0.2 * domainFactor.logistics,
    "charcoal-burner": domainFactor.industry,
    fletcher: 0.7 * domainFactor.defense + 0.3 * domainFactor.industry,
    mechanist: 0.65 * domainFactor.defense + 0.35 * domainFactor.industry
  };
  for (const role of ROLE_KEYS) {
    const mul = clamp(Number(byRole[role] || 1), 0.82, 1.24);
    scores[role] = Number((Math.max(0.05, Number(scores[role] || 0.05)) * mul).toFixed(4));
  }
  return scores;
}

function computeDesiredRoleCounts(state, policy) {
  const n = state.goblins.allIds.length;
  const desired = Object.fromEntries(ROLE_KEYS.map((r) => [r, 0]));
  if (n <= 0) return desired;
  const d = computeRoleDemand(state);
  const deerCount = (state.worldMap?.wildlife?.allIds || []).reduce((count, id) => {
    const creature = state.worldMap?.wildlife?.byId?.[id];
    if (!creature || !creature.alive) return count;
    return count + (creature.kind === "deer" ? 1 : 0);
  }, 0);
  const scores = {
    forager: 1.2 + d.foodPressure * 1.25 + d.waterPressure * 0.55,
    woodcutter: 0.95 + d.woodPressure * 1.2,
    fisherman: 0.85 + d.foodPressure * 1.15 + d.waterPressure * 0.35,
    hunter: 0.85 + d.foodPressure * 1.35 + d.threatPressure * 0.35 + (deerCount > 0 ? 0.35 : -0.4),
    builder: 0.75 + d.wallPressure * 1.0 + d.threatPressure * 0.9,
    homebuilder: 0.35 + d.colonyPressure * 0.8 + d.woodPressure * 0.25,
    sentinel: 0.55 + d.threatPressure * 1.15 + d.wallPressure * 0.35,
    lookout: 0.75 + d.threatPressure * 1.35,
    hauler: 0.65 + d.haulerPressure * 1.45 + d.wallPressure * 0.25,
    "water-runner": 0.7 + d.waterPressure * 1.6 + d.threatPressure * 0.2,
    caretaker: 0.55 + d.caretakerPressure * 1.6 + d.threatPressure * 0.2,
    quartermaster: 0.2 + d.threatPressure * 0.45 + d.waterPressure * 0.2,
    scout: 0.65 + d.intelPressure * 1.3 - d.threatPressure * 0.4,
    "colony-establisher": 0.15 + d.colonyPressure * 1.1 + d.intelPressure * 0.35 - d.threatPressure * 0.35,
    reproducer: 0.05 + d.reproductionPressure * 0.95 - d.threatPressure * 0.25,
    miner: 0.45 + d.orePressure * 1.2 + d.partsPressure * 0.45,
    "fiber-harvester": 0.35 + d.fiberPressure * 1.05 + d.ropePressure * 0.45,
    herbalist: 0.28 + d.herbPressure * 1.1 + d.caretakerPressure * 0.25,
    smelter: 0.35 + d.partsPressure * 1.15 + d.orePressure * 0.45 + d.charcoalPressure * 0.2,
    "rope-maker": 0.28 + d.ropePressure * 1.1 + d.fiberPressure * 0.45,
    carpenter: 0.32 + d.plankPressure * 1.15 + d.woodPressure * 0.35,
    "charcoal-burner": 0.25 + d.charcoalPressure * 1.2 + d.partsPressure * 0.35,
    fletcher: 0.2 + d.ammoPressure * 1.25 + d.threatPressure * 0.35,
    mechanist: 0.22 + d.springPressure * 1.2 + d.partsPressure * 0.35
  };
  applyLeaderLearningToRoleScores(state, scores);
  let totalScore = 0;
  for (const role of ROLE_KEYS) totalScore += Math.max(0.05, scores[role]);
  for (const role of ROLE_KEYS) {
    desired[role] = Math.floor((Math.max(0.05, scores[role]) / totalScore) * n);
  }
  desired.forager = Math.max(1, desired.forager);
  desired.woodcutter = Math.max(1, desired.woodcutter);
  desired.fisherman = Math.max(1, desired.fisherman);
  desired.hunter = Math.max(1, desired.hunter);
  desired.sentinel = Math.max(1, desired.sentinel);
  desired["water-runner"] = Math.max(1, desired["water-runner"]);
  desired.caretaker = Math.max(1, desired.caretaker);
  desired.quartermaster = Math.max(1, desired.quartermaster);
  if (n >= 10) desired.miner = Math.max(1, desired.miner);
  if (n >= 12) desired.smelter = Math.max(1, desired.smelter);
  if (n >= 8) desired.homebuilder = Math.max(1, desired.homebuilder);
  const plannedWalls = countPlannedWallsAcrossPlans(state.worldMap);
  const wallIncomplete = plannedWalls > 0;
  if (wallIncomplete) {
    const builderTarget = clamp(Math.ceil(plannedWalls / 8), 2, Math.max(2, Math.floor(n * 0.55)));
    desired.builder = Math.max(desired.builder, builderTarget);
  }
  const repro = ensureReproductionState(state);
  const reproSafety = reproductionSafety(state, repro);
  if (repro.enabled && reproSafety.safe && repro.birthsThisDay < repro.maxBirthsPerDay) {
    const reproducerTarget = clamp(Math.ceil(n * 0.16), 2, Math.max(2, Math.floor(n * 0.35)));
    desired.reproducer = Math.max(desired.reproducer, reproducerTarget);
  }
  while (Object.values(desired).reduce((a, b) => a + b, 0) < n) {
    const role = ROLE_KEYS
      .slice()
      .sort((a, b) => (scores[b] - desired[b] * 0.15) - (scores[a] - desired[a] * 0.15))[0];
    desired[role] += 1;
  }
  while (Object.values(desired).reduce((a, b) => a + b, 0) > n) {
    const role = ROLE_KEYS
      .slice()
      .filter((r) => desired[r] > (r === "forager" || r === "woodcutter" ? 1 : 0))
      .sort((a, b) => (desired[b] - scores[b] * 0.2) - (desired[a] - scores[a] * 0.2))[0];
    if (!role) break;
    desired[role] -= 1;
  }

  const leaderTargets = computeLeaderStaffingTargets(state, n);
  if (leaderTargets) {
    const leaderStability = clamp(Number(state.tribe?.governance?.runtime?.leaderStability || 0.5), 0, 1);
    const threat = clamp((state.tribe?.threat?.alertLevel || 0) / 100, 0, 1);
    const blend = clamp(0.42 + leaderStability * 0.24 + threat * 0.2, 0.35, 0.86);
    for (const role of ROLE_KEYS) {
      const target = Math.max(0, Math.round(leaderTargets[role] || 0));
      if (target <= 0) continue;
      desired[role] = Math.max(0, Math.round(desired[role] * (1 - blend) + target * blend));
    }
  }

  for (const role of ROLE_KEYS) {
    const key = `${role}Count`;
    const manual = policy.targets?.[key];
    if (!Number.isFinite(manual)) continue;
    desired[role] = Math.max(0, Math.round(manual));
  }
  const override = policy.override;
  if (override && tickWithinOverride(state.meta.tick, override)) {
    if (Number.isFinite(override.targets?.builderCount)) desired.builder = Math.max(desired.builder, Math.round(override.targets.builderCount));
    if (Number.isFinite(override.targets?.lookoutCount)) desired.lookout = Math.max(desired.lookout, Math.round(override.targets.lookoutCount));
    if (Number.isFinite(override.targets?.waterRunnerCount)) {
      desired["water-runner"] = Math.max(desired["water-runner"], Math.round(override.targets.waterRunnerCount));
    }
  }

  const floorByRole = {};
  function enforceFloor(role, minCount) {
    floorByRole[role] = Math.max(floorByRole[role] || 0, minCount);
    desired[role] = Math.max(desired[role] || 0, minCount);
  }

  // Guardrails: leader guidance cannot reduce baseline survival/defense coverage.
  enforceFloor("forager", Math.max(1, Math.ceil(n * 0.12)));
  enforceFloor("water-runner", Math.max(1, Math.ceil(n * 0.1)));
  enforceFloor("builder", Math.max(1, Math.ceil(n * 0.1)));
  enforceFloor("sentinel", Math.max(1, Math.ceil(n * 0.08)));
  if (n >= 10) enforceFloor("lookout", 1);
  const foodSafetyMin = Math.max(2, Math.ceil(n * 0.22));
  const currentFoodCrew = (desired.forager || 0) + (desired.fisherman || 0) + (desired.hunter || 0);
  if (currentFoodCrew < foodSafetyMin) {
    enforceFloor("forager", (desired.forager || 0) + (foodSafetyMin - currentFoodCrew));
  }

  const resources = state.tribe?.resources || {};
  const foodStock = resources.food || 0;
  const waterStock = resources.water || 0;
  const woodStock = resources.wood || 0;
  const mushroomStock = resources.mushrooms || 0;
  const oreStock = resources.metal_ore || 0;
  const partsStock = resources.metal_parts || 0;
  const fiberStock = resources.fiber || 0;
  const herbStock = resources.herbs || 0;
  const ropeStock = resources.rope || 0;
  const charcoalStock = resources.charcoal || 0;
  const plankStock = resources.wood_planks || 0;
  const ammoStock = resources.ammo_bolts || 0;
  const springStock = resources.springs || 0;

  const foodShortage = foodStock <= 16;
  const waterShortage = waterStock <= 18;
  const severeWaterShortage = waterStock <= 12;
  const woodShortage = woodStock <= 10;
  const mushroomShortage = mushroomStock <= 4;
  const oreShortage = oreStock <= 8;
  const partsShortage = partsStock <= 6;
  const fiberShortage = fiberStock <= 8;
  const herbShortage = herbStock <= 5;
  const ropeShortage = ropeStock <= 5;
  const charcoalShortage = charcoalStock <= 6;
  const plankShortage = plankStock <= 8;
  const ammoShortage = ammoStock <= 6;
  const springShortage = springStock <= 4;

  if (foodShortage) {
    enforceFloor("forager", clamp(Math.ceil(n * 0.34), 2, Math.max(2, n - 1)));
    enforceFloor("fisherman", 1);
    if (deerCount > 0) {
      enforceFloor("hunter", clamp(Math.ceil(n * 0.16), 2, Math.max(2, n - 1)));
    } else {
      enforceFloor("hunter", 1);
    }
    enforceFloor("hauler", 1);
  }
  if (waterShortage) {
    enforceFloor("water-runner", clamp(Math.ceil(n * 0.3), 2, Math.max(2, n - 1)));
    enforceFloor("fisherman", 1);
    enforceFloor("hauler", 1);
  }
  if (severeWaterShortage) {
    enforceFloor("water-runner", clamp(Math.ceil(n * 0.36), 2, Math.max(2, n - 1)));
    enforceFloor("fisherman", Math.max(floorByRole.fisherman || 0, 2));
  }
  if (woodShortage) {
    enforceFloor("woodcutter", clamp(Math.ceil(n * 0.32), 2, Math.max(2, n - 1)));
    enforceFloor("hauler", 1);
  }
  if (mushroomShortage) {
    enforceFloor("forager", Math.max(floorByRole.forager || 0, 2));
  }
  if (oreShortage) {
    enforceFloor("miner", 1);
  }
  if (partsShortage) {
    enforceFloor("smelter", 1);
  }
  if (fiberShortage) {
    enforceFloor("fiber-harvester", 1);
  }
  if (herbShortage) {
    enforceFloor("herbalist", 1);
  }
  if (ropeShortage) {
    enforceFloor("rope-maker", 1);
  }
  if (charcoalShortage) {
    enforceFloor("charcoal-burner", 1);
  }
  if (plankShortage) {
    enforceFloor("carpenter", 1);
  }
  if (ammoShortage && (state.tribe?.threat?.alertLevel || 0) >= 40) {
    enforceFloor("fletcher", 1);
  }
  if (springShortage) {
    enforceFloor("mechanist", 1);
  }

  const preemption = ensureCriticalNeedPreemptionState(state);
  if (preemption.active) {
    const tier = preemption.tier || "critical";
    const foragerFloor = tier === "collapse" ? clamp(Math.ceil(n * 0.34), 3, Math.max(3, n - 1)) : clamp(Math.ceil(n * 0.24), 2, Math.max(2, n - 1));
    const waterFloor = tier === "collapse" ? clamp(Math.ceil(n * 0.32), 3, Math.max(3, n - 1)) : clamp(Math.ceil(n * 0.22), 2, Math.max(2, n - 1));
    const caretakerFloor = tier === "collapse" ? clamp(Math.ceil(n * 0.14), 2, Math.max(2, n - 1)) : 1;
    enforceFloor("forager", Math.max(floorByRole.forager || 0, foragerFloor));
    enforceFloor("water-runner", Math.max(floorByRole["water-runner"] || 0, waterFloor));
    enforceFloor("hauler", Math.max(floorByRole.hauler || 0, 2));
    enforceFloor("caretaker", Math.max(floorByRole.caretaker || 0, caretakerFloor));
    if (tier === "collapse") enforceFloor("builder", Math.max(floorByRole.builder || 0, 2));

    const ceilings = {
      scout: 0,
      "colony-establisher": 0,
      homebuilder: 0,
      quartermaster: tier === "collapse" ? 1 : 2,
      lookout: tier === "collapse" ? 1 : 2,
      miner: 0,
      "fiber-harvester": 0,
      herbalist: 0,
      smelter: 0,
      "rope-maker": 0,
      carpenter: 0,
      "charcoal-burner": 0,
      fletcher: 0,
      mechanist: 0
    };
    for (const [role, cap] of Object.entries(ceilings)) {
      if (!Object.prototype.hasOwnProperty.call(desired, role)) continue;
      desired[role] = Math.min(desired[role], cap);
    }
  }

  const outpostEmergency = computeOutpostEmergencyDemand(state);
  if (outpostEmergency.emergencyCount > 0) {
    const pressure = Math.max(
      outpostEmergency.failingCount * 1.35 + outpostEmergency.criticalCount * 0.65,
      outpostEmergency.deficitByRole.forager * 0.6 + outpostEmergency.deficitByRole.builder * 0.8 + outpostEmergency.deficitByRole["water-runner"] * 0.65
    );
    const scale = clamp(pressure / Math.max(1, n * 0.35), 0.2, 1.8);
    const builderFloor = clamp(Math.ceil(n * (0.14 + scale * 0.12)), 2, Math.max(2, n - 1));
    const foragerFloor = clamp(Math.ceil(n * (0.16 + scale * 0.12)), 2, Math.max(2, n - 1));
    const waterFloor = clamp(Math.ceil(n * (0.14 + scale * 0.11)), 2, Math.max(2, n - 1));

    enforceFloor("builder", Math.max(builderFloor, (floorByRole.builder || 0)));
    enforceFloor("forager", Math.max(foragerFloor, (floorByRole.forager || 0)));
    enforceFloor("water-runner", Math.max(waterFloor, (floorByRole["water-runner"] || 0)));
    enforceFloor("hauler", Math.max(1, floorByRole.hauler || 0));
  }

  // Safety default: always preserve a minimum water crew, and raise it when water trends low.
  const baselineWaterCrewMin = Math.max(1, Math.ceil(n * 0.14));
  const lowWaterCrewMin = waterStock <= 24 ? Math.max(baselineWaterCrewMin, Math.ceil(n * 0.2)) : baselineWaterCrewMin;
  const waterCrewMin = severeWaterShortage ? Math.max(lowWaterCrewMin, Math.ceil(n * 0.28)) : lowWaterCrewMin;
  let waterCrew = (desired["water-runner"] || 0) + (desired.fisherman || 0);
  if (waterCrew < waterCrewMin) {
    const needed = waterCrewMin - waterCrew;
    const addRunner = Math.ceil(needed * 0.7);
    enforceFloor("water-runner", Math.max(desired["water-runner"] || 0, (desired["water-runner"] || 0) + addRunner));
    enforceFloor("fisherman", Math.max(desired.fisherman || 0, (desired.fisherman || 0) + Math.max(0, needed - addRunner)));
    waterCrew = (desired["water-runner"] || 0) + (desired.fisherman || 0);
  }

  rebalanceDesiredTotal(desired, n, floorByRole);
  return desired;
}

function tickWithinOverride(tick, override) {
  if (!override) return false;
  if (!Number.isFinite(override.untilTick)) return false;
  return tick <= override.untilTick;
}

function rebalanceDesiredTotal(desired, n, floorByRole = null) {
  const baseMinByRole = {
    forager: 1,
    woodcutter: 1,
    fisherman: 1,
    hunter: 1,
    sentinel: 1,
    "water-runner": 1,
    caretaker: 1,
    quartermaster: 1
  };
  const minByRole = { ...baseMinByRole, ...(floorByRole || {}) };
  while (Object.values(desired).reduce((a, b) => a + b, 0) > n) {
    const role = ROLE_KEYS
      .slice()
      .filter((r) => desired[r] > (minByRole[r] || 0))
      .sort((a, b) => desired[b] - desired[a])[0];
    if (!role) break;
    desired[role] -= 1;
  }
  while (Object.values(desired).reduce((a, b) => a + b, 0) < n) {
    const role = ROLE_KEYS.slice().sort((a, b) => desired[a] - desired[b])[0];
    desired[role] += 1;
  }
}

function roleSuitabilityScore(role, goblin) {
  const apt = goblin.aptitudes || {};
  const stats = goblin.coreStats || {};
  if (role === "forager") return (apt.scavenging || 0) * 1.1 + (apt.scouting || 0) * 0.45 + (stats.perception || 0) * 0.55 + (stats.agility || 0) * 0.35;
  if (role === "woodcutter") return (stats.brawn || 0) * 0.9 + (stats.grit || 0) * 0.6 + (apt.mining || 0) * 0.4 + (apt.siegecraft || 0) * 0.2;
  if (role === "fisherman") return (apt.animalHandling || 0) * 0.85 + (apt.scavenging || 0) * 0.55 + (stats.perception || 0) * 0.55 + (stats.agility || 0) * 0.35;
  if (role === "hunter") return (apt.animalHandling || 0) * 1.05 + (stats.agility || 0) * 0.75 + (stats.brawn || 0) * 0.55 + (stats.perception || 0) * 0.55;
  if (role === "builder") return (stats.craft || 0) * 0.9 + (apt.siegecraft || 0) * 0.8 + (stats.grit || 0) * 0.4 + (stats.will || 0) * 0.35;
  if (role === "homebuilder") return (stats.craft || 0) * 0.95 + (apt.siegecraft || 0) * 0.55 + (stats.grit || 0) * 0.5 + (apt.scavenging || 0) * 0.25;
  if (role === "sentinel") return (stats.grit || 0) * 0.8 + (stats.brawn || 0) * 0.7 + (stats.will || 0) * 0.45 + (apt.intimidation || 0) * 0.25;
  if (role === "lookout") return (apt.scouting || 0) * 1.0 + (stats.perception || 0) * 0.9 + (apt.stealth || 0) * 0.45 + (stats.agility || 0) * 0.3;
  if (role === "hauler") return (stats.brawn || 0) * 0.65 + (stats.grit || 0) * 0.55 + (stats.agility || 0) * 0.45 + (apt.scavenging || 0) * 0.4;
  if (role === "water-runner") return (stats.grit || 0) * 0.7 + (stats.agility || 0) * 0.6 + (stats.will || 0) * 0.4 + (apt.scouting || 0) * 0.3;
  if (role === "caretaker") return (apt.medicine || 0) * 1.1 + (stats.social || 0) * 0.75 + (stats.will || 0) * 0.55 + (apt.cooking || 0) * 0.25;
  if (role === "quartermaster") return (stats.cunning || 0) * 0.85 + (stats.social || 0) * 0.85 + (apt.bargaining || 0) * 0.5 + (apt.lorekeeping || 0) * 0.3;
  if (role === "scout") return (apt.scouting || 0) * 1.15 + (apt.stealth || 0) * 0.7 + (stats.perception || 0) * 0.8 + (stats.will || 0) * 0.2;
  if (role === "colony-establisher") return (apt.scouting || 0) * 0.95 + (stats.will || 0) * 0.75 + (stats.cunning || 0) * 0.55 + (stats.grit || 0) * 0.45;
  if (role === "reproducer") return (stats.social || 0) * 0.8 + (stats.will || 0) * 0.7 + (stats.grit || 0) * 0.35 + (apt.medicine || 0) * 0.25;
  if (role === "miner") return (apt.mining || 0) * 1.1 + (stats.brawn || 0) * 0.85 + (stats.grit || 0) * 0.5;
  if (role === "fiber-harvester") return (apt.scavenging || 0) * 0.95 + (stats.agility || 0) * 0.6 + (stats.perception || 0) * 0.45;
  if (role === "herbalist") return (apt.medicine || 0) * 1.0 + (stats.perception || 0) * 0.65 + (apt.scouting || 0) * 0.4;
  if (role === "smelter") return (stats.craft || 0) * 0.9 + (apt.mining || 0) * 0.75 + (stats.grit || 0) * 0.5;
  if (role === "rope-maker") return (stats.craft || 0) * 0.95 + (apt.scavenging || 0) * 0.45 + (stats.agility || 0) * 0.35;
  if (role === "carpenter") return (stats.craft || 0) * 1.05 + (stats.grit || 0) * 0.45 + (apt.siegecraft || 0) * 0.4;
  if (role === "charcoal-burner") return (stats.grit || 0) * 0.85 + (stats.craft || 0) * 0.55 + (stats.will || 0) * 0.3;
  if (role === "fletcher") return (stats.craft || 0) * 0.95 + (stats.agility || 0) * 0.45 + (stats.perception || 0) * 0.35;
  if (role === "mechanist") return (stats.cunning || 0) * 0.7 + (stats.craft || 0) * 0.9 + (apt.siegecraft || 0) * 0.45;
  return 0;
}

function isRoleAssignmentLocked(policy, unit, tick) {
  if (!unit?.roleState) return false;
  if (tick < (unit.roleState.roleCooldownUntilTick || 0)) return true;
  if (tick - (unit.roleState.roleAssignedTick || 0) < policy.minRoleHoldTicks) return true;
  if (policy.mode !== "auto-balance" && unit.roleState.manualLock) return true;
  return false;
}

function reassignRole(state, goblinId, fromRole, toRole, tick, policy, events, reason, meta = null) {
  const goblin = state.goblins.byId[goblinId];
  const unit = state.worldMap?.units?.byGoblinId?.[goblinId];
  if (!goblin || !unit) return false;
  goblin.social = goblin.social || {};
  goblin.social.role = toRole;
  unit.roleState.role = toRole;
  unit.roleState.roleTask = undefined;
  unit.roleState.roleAssignedTick = tick;
  unit.roleState.roleCooldownUntilTick = tick + policy.reassignmentCooldownTicks;
  unit.roleState.recoveryOutpostId = meta?.outpostId || null;
  unit.roleState.recoveryAssignedTick = meta?.outpostId ? tick : null;
  events.push({
    type: "ROLE_REASSIGNED",
    goblinId,
    role: toRole,
    previousRole: fromRole,
    reasonCode: reason,
    recoveryOutpostId: meta?.outpostId || undefined,
    mode: policy.mode,
    text: meta?.outpostId
      ? `${goblin.identity.name} reassigned ${fromRole} -> ${toRole} for outpost recovery (${meta.outpostId}).`
      : `${goblin.identity.name} reassigned ${fromRole} -> ${toRole} (${reason}).`
  });
  return true;
}

function applyRoleBalancer(state, tick, events) {
  const policy = ensureRolePolicy(state);
  if (policy.mode === "manual") return;
  const every = Math.max(1, Math.round(policy.updateEveryTicks || 6));
  if (tick % every !== 0) return;

  const current = computeRoleCounts(state);
  const desired = computeDesiredRoleCounts(state, policy);
  const preemption = ensureCriticalNeedPreemptionState(state);
  const hysteresis = Math.max(0, Math.round(policy.hysteresis || 1));
  const recoveryTargetsByRole = {};
  for (const role of ["builder", "forager", "water-runner"]) {
    const outpost = selectRecoveryOutpostForRole(state, { microX: 0, microY: 0 }, role);
    if (outpost) recoveryTargetsByRole[role] = outpost.id;
  }
  const deficits = ROLE_KEYS
    .filter((role) => (desired[role] - current[role]) > hysteresis)
    .sort((a, b) => (recoveryTargetsByRole[b] ? 1 : 0) - (recoveryTargetsByRole[a] ? 1 : 0));
  if (!deficits.length) return;

  const goblinIds = state.goblins.allIds.slice().sort();
  const surplusRoles = () => ROLE_KEYS.filter((r) => current[r] - desired[r] > hysteresis);

  for (const targetRole of deficits) {
    let need = desired[targetRole] - current[targetRole];
    while (need > 0) {
      const activeSurplus = surplusRoles();
      const candidates = [];
      for (const goblinId of goblinIds) {
        const goblin = state.goblins.byId[goblinId];
        const unit = state.worldMap?.units?.byGoblinId?.[goblinId];
        if (!goblin || !unit || !goblin.flags.alive || goblin.flags.missing) continue;
        const fromRole = normalizeRole(unit.roleState?.role || goblin.social?.role);
        if (fromRole === targetRole) continue;
        if (unit.roleState?.carried?.amount > 0) continue;
        if (policy.mode !== "auto-balance" && !activeSurplus.includes(fromRole)) continue;
        if (policy.mode === "auto-balance" && activeSurplus.length && !activeSurplus.includes(fromRole)) continue;
        if (isRoleAssignmentLocked(policy, unit, tick)) continue;
        let score = roleSuitabilityScore(targetRole, goblin) - roleSuitabilityScore(fromRole, goblin) * 0.25;
        score += (unit.roleState?.rolePriority || 1) * 0.15;
        if (fromRole === "forager" && targetRole !== "forager") score -= 3.2;
        candidates.push({ goblinId, fromRole, score });
      }
      if (!candidates.length) break;
      candidates.sort((a, b) => b.score - a.score);
      const pick = candidates[0];
      const recoveryOutpostId = recoveryTargetsByRole[targetRole] || null;
      const reasonCode = preemption.active
        ? "CRITICAL_NEEDS_PREEMPTION"
        : (recoveryOutpostId ? "OUTPOST_RECOVERY" : "ROLE_DEFICIT");
      if (reassignRole(
        state,
        pick.goblinId,
        pick.fromRole,
        targetRole,
        tick,
        policy,
        events,
        reasonCode,
        recoveryOutpostId ? { outpostId: recoveryOutpostId } : null
      )) {
        current[pick.fromRole] = Math.max(0, (current[pick.fromRole] || 0) - 1);
        current[targetRole] = (current[targetRole] || 0) + 1;
        need -= 1;
      } else {
        break;
      }
    }
  }
}

function buildUnitDensityMap(units) {
  const density = new Map();
  for (const u of units) {
    const key = tileKey(u.microX, u.microY);
    density.set(key, (density.get(key) || 0) + 1);
  }
  return density;
}

function localDensity(unitsByGoblinId, densityMap, x, y, excludeGoblinId) {
  let count = 0;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const key = tileKey(x + dx, y + dy);
      count += densityMap.get(key) || 0;
    }
  }
  const excluded = unitsByGoblinId[excludeGoblinId];
  if (excluded && Math.abs(excluded.microX - x) <= 2 && Math.abs(excluded.microY - y) <= 2) count -= 1;
  return count;
}

function shouldBuildWall(state) {
  if ((state.tribe.resources.wood || 0) <= 0) return false;
  for (const plan of allWallPlans(state.worldMap)) {
    if (!plan || plan.completedAtTick !== null) continue;
    if (countPlannedWallsInPlan(plan) > 0) return true;
  }
  return false;
}

function canAffordHomeBuild(state) {
  const r = state.tribe?.resources || {};
  return (r.wood || 0) >= HOME_BUILD_COST_WOOD && (r.food || 0) >= HOME_BUILD_COST_FOOD && (r.water || 0) >= HOME_BUILD_COST_WATER;
}

function countUniqueHomeTiles(wm) {
  const keys = new Set();
  for (const unit of Object.values(wm.units?.byGoblinId || {})) keys.add(`${unit.homeTileX},${unit.homeTileY}`);
  for (const home of Object.values(wm.structures?.villageHomesByTileKey || {})) keys.add(`${home.tileX},${home.tileY}`);
  for (const outpost of Object.values(wm.structures?.colonyOutpostsByTileKey || {})) keys.add(`${outpost.tileX},${outpost.tileY}`);
  return keys.size;
}

function shouldBuildVillageHome(state) {
  if (!canAffordHomeBuild(state)) return false;
  const goblinCount = state.goblins?.allIds?.length || 0;
  if (!goblinCount) return false;
  const existingHomes = countUniqueHomeTiles(state.worldMap);
  const targetHomes = Math.ceil(goblinCount * 1.25);
  return existingHomes < targetHomes;
}

function chooseVillageHomeTile(state, unit, tick, goblinId) {
  const wm = state.worldMap;
  const homeSite = wm.player?.startingSiteId ? wm.sitesById?.[wm.player.startingSiteId] : null;
  const centerTileX = homeSite?.x ?? unit.homeTileX;
  const centerTileY = homeSite?.y ?? unit.homeTileY;

  const blockedHomes = new Set();
  for (const u of Object.values(wm.units?.byGoblinId || {})) blockedHomes.add(`${u.homeTileX},${u.homeTileY}`);
  for (const home of Object.values(wm.structures?.villageHomesByTileKey || {})) blockedHomes.add(`${home.tileX},${home.tileY}`);
  for (const outpost of Object.values(wm.structures?.colonyOutpostsByTileKey || {})) blockedHomes.add(`${outpost.tileX},${outpost.tileY}`);

  let best = null;
  let bestScore = -Infinity;
  for (let radius = 2; radius <= 12; radius += 1) {
    for (let i = 0; i < 40; i += 1) {
      const angle = ((i / 40) * Math.PI * 2) + rand01("homebuild-angle", tick, goblinId, radius, i) * 0.2;
      const tileX = clamp(centerTileX + Math.round(Math.cos(angle) * radius), 0, wm.width - 1);
      const tileY = clamp(centerTileY + Math.round(Math.sin(angle) * radius), 0, wm.height - 1);
      if (!isValidVillageHomeTile(state, tileX, tileY, blockedHomes)) continue;
      const distFromUnit = dist({ x: unit.tileX, y: unit.tileY }, { x: tileX, y: tileY });
      const jitter = rand01("homebuild-score", tick, goblinId, tileX, tileY) * 0.2;
      const score = radius * 0.35 - distFromUnit * 0.06 + jitter;
      if (score > bestScore) {
        bestScore = score;
        best = { tileX, tileY };
      }
    }
    if (best) break;
  }
  if (!best) return null;
  return {
    tileX: best.tileX,
    tileY: best.tileY,
    microX: regionToMicroCenter(best.tileX),
    microY: regionToMicroCenter(best.tileY)
  };
}

function isValidVillageHomeTile(state, tileX, tileY, blockedHomes) {
  const wm = state.worldMap;
  if (blockedHomes.has(`${tileX},${tileY}`)) return false;
  if (wm.waterTiles?.byTileKey?.[`${tileX},${tileY}`]) return false;
  if (nearSiteByTile(wm, tileX, tileY)) return false;
  const microX = regionToMicroCenter(tileX);
  const microY = regionToMicroCenter(tileY);
  if (wm.structures?.wallsByTileKey?.[tileKey(microX, microY)]) return false;

  for (const node of Object.values(wm.resourceNodes?.byTileKey || {})) {
    if (tileToChunkCoord(node.microX) === tileX && tileToChunkCoord(node.microY) === tileY) return false;
  }
  for (const u of Object.values(wm.units?.byGoblinId || {})) {
    const dx = Math.abs(u.homeTileX - tileX);
    const dy = Math.abs(u.homeTileY - tileY);
    if (dx <= 1 && dy <= 1) return false;
  }
  for (const home of Object.values(wm.structures?.villageHomesByTileKey || {})) {
    const dx = Math.abs(home.tileX - tileX);
    const dy = Math.abs(home.tileY - tileY);
    if (dx <= 1 && dy <= 1) return false;
  }
  return true;
}

function chooseWallTile(state, goblinId, tick, preferredTarget = null, preferredSiteId = null) {
  const wm = state.worldMap;
  const plans = allWallPlans(wm).filter((plan) => plan.completedAtTick === null);
  if (!plans.length) return null;
  const mem = ensureThreatMemory(state.worldMap);

  for (const plan of plans) {
    for (const key of plan.orderedTileKeys) {
      if (plan.assignedGoblinByKey[key] !== goblinId) continue;
      if (plan.assignedUntilTickByKey[key] < tick) {
        plan.assignedGoblinByKey[key] = null;
        plan.assignedUntilTickByKey[key] = 0;
        continue;
      }
      if (plan.tileStatusByKey[key] !== "planned") continue;
      const { microX, microY } = parseMicroKey(key);
      return { microX, microY, key, siteId: plan.siteId || plan.homeSiteId };
    }
  }

  const breachSet = new Set((mem.recentBreaches || []).map((b) => b.key));
  let bestPlan = null;
  let bestCandidates = null;
  let bestScore = -Infinity;

  for (const plan of plans) {
    let candidates = plan.orderedTileKeys.filter((key) => {
      if (plan.tileStatusByKey[key] !== "planned") return false;
      const assignee = plan.assignedGoblinByKey[key];
      const untilTick = plan.assignedUntilTickByKey[key] || 0;
      if (assignee && untilTick >= tick && assignee !== goblinId) return false;
      return true;
    });
    if (!candidates.length) continue;

    const breachCandidates = candidates.filter((key) => breachSet.has(key));
    const hasBreaches = breachCandidates.length > 0;
    if (hasBreaches) candidates = breachCandidates;

    let score = 0;
    if (preferredSiteId && (plan.siteId || plan.homeSiteId) === preferredSiteId) score += 1000;
    if (hasBreaches) score += 250;
    if ((plan.siteId || plan.homeSiteId) === primaryWallPlanSiteId(wm)) score += 15;
    if (preferredTarget) {
      const centerX = regionToMicroCenter(plan.centerTileX);
      const centerY = regionToMicroCenter(plan.centerTileY);
      score -= dist({ x: centerX, y: centerY }, preferredTarget) * 0.45;
    }
    score += Math.min(30, candidates.length * 0.08);

    if (score > bestScore) {
      bestScore = score;
      bestPlan = plan;
      bestCandidates = candidates;
    }
  }

  if (!bestPlan || !bestCandidates?.length) return null;
  if (preferredTarget) {
    bestCandidates = [...bestCandidates].sort((aKey, bKey) => {
      const a = parseMicroKey(aKey);
      const b = parseMicroKey(bKey);
      const da = dist({ x: a.microX, y: a.microY }, preferredTarget);
      const db = dist({ x: b.microX, y: b.microY }, preferredTarget);
      return da - db;
    });
  }

  for (const key of bestCandidates) {
    bestPlan.assignedGoblinByKey[key] = goblinId;
    bestPlan.assignedUntilTickByKey[key] = tick + WALL_RESERVATION_TICKS;
    const { microX, microY } = parseMicroKey(key);
    return { microX, microY, key, siteId: bestPlan.siteId || bestPlan.homeSiteId };
  }

  return null;
}

function nearestThreatForUnit(state, unit) {
  const mem = ensureThreatMemory(state.worldMap);
  let best = null;
  let bestScore = -Infinity;
  for (const id of mem.allIds) {
    const t = mem.itemsById[id];
    if (!t) continue;
    const d = dist({ x: unit.microX, y: unit.microY }, { x: t.microX, y: t.microY });
    const score = (t.confidence || 0.3) * 20 - d;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function lookoutPatrolPoint(unit, tick, goblinId, wm) {
  const ring = [
    { x: 6, y: 0 }, { x: -6, y: 0 }, { x: 0, y: 6 }, { x: 0, y: -6 },
    { x: 4, y: 4 }, { x: -4, y: -4 }, { x: 4, y: -4 }, { x: -4, y: 4 }
  ];
  const idx = Math.floor(rand01("lookout-ring", tick, goblinId) * ring.length) % ring.length;
  const off = ring[idx];
  return {
    kind: "lookout-patrol",
    targetMicroX: clamp(unit.homeMicroX + off.x, 0, wm.width * TILES_PER_CHUNK - 1),
    targetMicroY: clamp(unit.homeMicroY + off.y, 0, wm.height * TILES_PER_CHUNK - 1),
    targetTileX: clamp(tileToChunkCoord(unit.homeMicroX + off.x), 0, wm.width - 1),
    targetTileY: clamp(tileToChunkCoord(unit.homeMicroY + off.y), 0, wm.height - 1)
  };
}

function sentinelHoldPoint(state, unit) {
  const defended = nearestDefendedTileForUnit(state, unit);
  return {
    kind: "sentinel-hold",
    targetMicroX: defended.x,
    targetMicroY: defended.y,
    targetTileX: tileToChunkCoord(defended.x),
    targetTileY: tileToChunkCoord(defended.y)
  };
}

function ensureScoutPolicy(state) {
  state.worldMap.structures = state.worldMap.structures || {};
  if (!state.worldMap.structures.scoutPolicy) {
    state.worldMap.structures.scoutPolicy = {
      maxHazardPressure: 0.62,
      frontierConfidenceThreshold: 0.72
    };
  }
  return state.worldMap.structures.scoutPolicy;
}

function regionCenterMicro(region) {
  return {
    x: regionToMicroCenter(region.x),
    y: regionToMicroCenter(region.y)
  };
}

function selectScoutFrontier(state, unit) {
  const wm = state.worldMap;
  const policy = ensureScoutPolicy(state);
  const intelRegions = wm.intel?.knownRegions || {};
  let best = null;
  let bestScore = -Infinity;

  for (const region of Object.values(wm.regionsById || {})) {
    const intel = intelRegions[region.id];
    const confidence = intel?.confidence ?? 0;
    if (confidence >= policy.frontierConfidenceThreshold) continue;
    if (region.hazardPressure > policy.maxHazardPressure) continue;
    const center = regionCenterMicro(region);
    const d = dist({ x: unit.microX, y: unit.microY }, center);
    const potential = (
      (region.resourcePotential?.food || 0) +
      (region.resourcePotential?.ore || 0) +
      (region.resourcePotential?.salvage || 0)
    ) / 3;
    const score = (1 - confidence) * 1.8 + potential * 0.45 - d * 0.055;
    if (score > bestScore) {
      bestScore = score;
      best = { regionId: region.id, center };
    }
  }
  return best;
}

function selectColonyFrontier(state, unit) {
  const wm = state.worldMap;
  const policy = ensureScoutPolicy(state);
  const intelRegions = wm.intel?.knownRegions || {};
  let best = null;
  let bestScore = -Infinity;

  for (const region of Object.values(wm.regionsById || {})) {
    const intel = intelRegions[region.id];
    const confidence = intel?.confidence ?? 0;
    if (confidence >= Math.min(0.85, policy.frontierConfidenceThreshold + 0.08)) continue;
    if (region.hazardPressure > Math.min(0.55, policy.maxHazardPressure)) continue;
    const center = regionCenterMicro(region);
    const dFromUnit = dist({ x: unit.microX, y: unit.microY }, center);
    const dFromHome = dist({ x: unit.homeMicroX, y: unit.homeMicroY }, center);
    const potential = (
      (region.resourcePotential?.food || 0) * 0.45 +
      (region.resourcePotential?.ore || 0) * 0.15 +
      (region.resourcePotential?.salvage || 0) * 0.25 +
      (region.resourcePotential?.water || 0) * 0.35
    );
    const score = (1 - confidence) * 1.5 + potential * 0.5 + dFromHome * 0.04 - dFromUnit * 0.045;
    if (score > bestScore) {
      bestScore = score;
      best = { regionId: region.id, center };
    }
  }
  return best;
}

function findColonyHomeSpot(state, unit, aroundMicroX, aroundMicroY) {
  const wm = state.worldMap;
  const occupied = new Set(Object.values(wm.units?.byGoblinId || {}).map((u) => tileKey(u.homeMicroX, u.homeMicroY)));
  for (const off of HOME_RING) {
    const mx = clamp(aroundMicroX + off.x, 0, wm.width * TILES_PER_CHUNK - 1);
    const my = clamp(aroundMicroY + off.y, 0, wm.height * TILES_PER_CHUNK - 1);
    const key = tileKey(mx, my);
    if (mx === unit.homeMicroX && my === unit.homeMicroY) continue;
    if (occupied.has(key)) continue;
    if (isWaterMicroTile(wm, mx, my)) continue;
    if (wm.structures?.wallsByTileKey?.[key]) continue;
    return { microX: mx, microY: my };
  }
  return null;
}

function countReadyNodesNear(wm, microX, microY, tick, radius = 6) {
  let count = 0;
  for (const node of getResourceNodeList(wm)) {
    if (node.readyAtTick > tick) continue;
    if (Math.abs(node.microX - microX) > radius || Math.abs(node.microY - microY) > radius) continue;
    count += 1;
  }
  return count;
}

function maybeScoutReports(state, goblin, unit, tick, events, regionId, siteId) {
  const role = unit.roleState?.role;
  if (role !== "scout" && role !== "colony-establisher") return;
  const wm = state.worldMap;
  const regionIntel = wm.intel?.knownRegions?.[regionId];
  if (regionIntel) {
    const before = regionIntel.confidence || 0;
    const after = clamp(before + 0.18, 0, 1);
    regionIntel.confidence = after;
    regionIntel.lastUpdatedTick = tick;
    if (after - before >= 0.12 && tick - unit.roleState.lastScoutIntelTick >= SCOUT_REPORT_COOLDOWN) {
      unit.roleState.lastScoutIntelTick = tick;
      events.push({
        type: "SCOUT_INTEL_UPDATED",
        goblinId: goblin.id,
        role,
        regionId,
        before: Number(before.toFixed(2)),
        after: Number(after.toFixed(2)),
        tileX: unit.tileX,
        tileY: unit.tileY,
        text: `${goblin.identity.name} improved intel in ${wm.regionsById[regionId]?.biome || "region"} (${Math.round(before * 100)}% -> ${Math.round(after * 100)}%).`
      });
    }
  }
  if (siteId && wm.intel?.knownSites?.[siteId]) {
    const rec = wm.intel.knownSites[siteId];
    rec.confidence = clamp((rec.confidence || 0) + 0.24, 0, 1);
    rec.lastUpdatedTick = tick;
  }

  let spotted = null;
  let bestThreatDist = Infinity;
  for (const wid of wm.wildlife?.allIds || []) {
    const creature = wm.wildlife.byId[wid];
    if (!creature || !creature.alive || !isHostileWildlifeKind(creature.kind)) continue;
    const d = dist({ x: unit.microX, y: unit.microY }, { x: creature.microX, y: creature.microY });
    if (d < SCOUT_THREAT_DETECTION_RADIUS && d < bestThreatDist) {
      bestThreatDist = d;
      spotted = creature;
    }
  }
  if (spotted && tick - unit.roleState.lastScoutThreatTick >= SCOUT_REPORT_COOLDOWN) {
    unit.roleState.lastScoutThreatTick = tick;
    const confidence = clamp(1 - bestThreatDist / SCOUT_THREAT_DETECTION_RADIUS, 0.2, 0.95);
    upsertThreatMemory(state, tick, {
      id: `threat-${spotted.id}`,
      sourceId: spotted.id,
      kind: spotted.kind,
      microX: spotted.microX,
      microY: spotted.microY,
      confidence
    });
    events.push({
      type: "SCOUT_SPOTTED_THREAT",
      goblinId: goblin.id,
      role,
      sourceId: spotted.id,
      wildlifeKind: spotted.kind,
      microX: spotted.microX,
      microY: spotted.microY,
      tileX: tileToChunkCoord(spotted.microX),
      tileY: tileToChunkCoord(spotted.microY),
      confidence: Number(confidence.toFixed(2)),
      text: `${goblin.identity.name} reported ${spotted.kind} activity while scouting.`
    });
    if (tick - unit.roleState.lastCoordinationTick >= SCOUT_REPORT_COOLDOWN) {
      unit.roleState.lastCoordinationTick = tick;
      events.push({
        type: "ROLE_COORDINATION_SIGNAL",
        goblinId: goblin.id,
        role,
        reasonCode: "THREAT_SCOUTED",
        text: `${goblin.identity.name} signaled builders/lookouts about a threat sighting.`
      });
    }
  }

  const nearbyReadyNodes = countReadyNodesNear(wm, unit.microX, unit.microY, tick, 6);
  if (nearbyReadyNodes >= 4 && tick - unit.roleState.lastScoutResourceTick >= SCOUT_REPORT_COOLDOWN) {
    unit.roleState.lastScoutResourceTick = tick;
    events.push({
      type: "SCOUT_FOUND_RESOURCE_CLUSTER",
      goblinId: goblin.id,
      role,
      regionId,
      tileX: unit.tileX,
      tileY: unit.tileY,
      readyNodeCount: nearbyReadyNodes,
      text: `${goblin.identity.name} found a resource cluster (${nearbyReadyNodes} ready nodes).`
    });
    if (tick - unit.roleState.lastCoordinationTick >= SCOUT_REPORT_COOLDOWN) {
      unit.roleState.lastCoordinationTick = tick;
      events.push({
        type: "ROLE_COORDINATION_SIGNAL",
        goblinId: goblin.id,
        role,
        reasonCode: "RESOURCE_SCOUTED",
        text: `${goblin.identity.name} marked a resource cluster for gatherers and haulers.`
      });
    }
  }
}

function isGoblinDistressed(goblin) {
  if (!goblin) return false;
  return (
    (goblin.needs?.thirst || 0) >= 80 ||
    (goblin.needs?.hunger || 0) >= 80 ||
    (goblin.needs?.rest || 0) >= 82 ||
    (goblin.needs?.warmth || 0) >= 82 ||
    (goblin.psyche?.morale || 0) <= 28 ||
    (goblin.body?.health?.vitality || 100) <= 60
  );
}

function findCaretakerTarget(state, caretakerGoblinId) {
  const wm = state.worldMap;
  const sourceUnit = wm.units?.byGoblinId?.[caretakerGoblinId];
  if (!sourceUnit) return null;
  let best = null;
  let bestScore = -Infinity;

  for (const goblinId of state.goblins.allIds) {
    if (goblinId === caretakerGoblinId) continue;
    const goblin = state.goblins.byId[goblinId];
    const unit = wm.units?.byGoblinId?.[goblinId];
    if (!goblin || !unit || !goblin.flags?.alive || goblin.flags?.missing) continue;
    if (!isGoblinDistressed(goblin)) continue;
    const d = dist({ x: sourceUnit.microX, y: sourceUnit.microY }, { x: unit.microX, y: unit.microY });
    const needScore = (
      Math.max(0, (goblin.needs?.thirst || 0) - 70) * 0.35 +
      Math.max(0, (goblin.needs?.hunger || 0) - 70) * 0.25 +
      Math.max(0, (goblin.needs?.rest || 0) - 70) * 0.2 +
      Math.max(0, 35 - (goblin.psyche?.morale || 50)) * 0.35 +
      Math.max(0, 65 - (goblin.body?.health?.vitality || 100)) * 0.4
    );
    const score = needScore - d * 0.55;
    if (score > bestScore) {
      bestScore = score;
      best = { goblinId, unit, goblin, score };
    }
  }
  return best;
}

function roleSuppressedByCriticalNeeds(state, role) {
  const preemption = ensureCriticalNeedPreemptionState(state);
  if (!preemption.active) return false;
  return preemption.suppressedRoles?.includes(role);
}

function emergencyPreemptionTask(state, goblin, unit, role, tick, events, origin) {
  const wm = state.worldMap;
  const resources = state.tribe?.resources || {};
  const waterPressure = (resources.water || 0) <= 20;
  const foodPressure = (resources.food || 0) <= 18;

  if (waterPressure) {
    const source = findClosestWaterSource(wm, origin);
    if (source) {
      const task = {
        kind: "collect-water",
        targetMicroX: source.microX,
        targetMicroY: source.microY,
        targetTileX: source.tileX,
        targetTileY: source.tileY,
        reasonCode: "CRITICAL_NEEDS_PREEMPTION"
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
  }

  if (foodPressure) {
    const foodNode = findClosestReadyNode(wm, origin, "mushroom", tick);
    if (foodNode) {
      const task = {
        kind: "gather-food",
        targetMicroX: foodNode.microX,
        targetMicroY: foodNode.microY,
        targetTileX: foodNode.tileX,
        targetTileY: foodNode.tileY,
        reasonCode: "CRITICAL_NEEDS_PREEMPTION"
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const fishSource = findClosestWaterSource(wm, origin);
    if (fishSource) {
      const task = {
        kind: "fish-water",
        targetMicroX: fishSource.microX,
        targetMicroY: fishSource.microY,
        targetTileX: fishSource.tileX,
        targetTileY: fishSource.tileY,
        reasonCode: "CRITICAL_NEEDS_PREEMPTION"
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
  }

  const haulTask = claimHaulTask(state, goblin.id, unit, tick);
  if (haulTask) {
    const task = {
      kind: "haul-pickup",
      taskId: haulTask.id,
      targetMicroX: haulTask.sourceMicroX,
      targetMicroY: haulTask.sourceMicroY,
      targetTileX: haulTask.sourceTileX,
      targetTileY: haulTask.sourceTileY,
      reasonCode: "CRITICAL_NEEDS_PREEMPTION"
    };
    maybeEmitTaskClaimed(events, goblin, unit, role, task);
    setRoleTask(unit, role, task, tick);
    return task;
  }

  const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
  maybeEmitTaskBlocked(events, goblin, unit, role, tick, "CRITICAL_NEEDS_PREEMPTION", `${goblin.identity.name} (${role}) is held from non-essential work during critical-needs preemption.`);
  setRoleTask(unit, role, idleTask, tick, "CRITICAL_NEEDS_PREEMPTION");
  return idleTask;
}

function chooseGoal(state, goblin, unit, tick, events, indexHint, threatByGoblinId) {
  const wm = state.worldMap;
  const origin = { x: unit.microX, y: unit.microY };
  const role = ensureRoleState(goblin, unit, indexHint);
  const carried = unit.roleState.carried;
  const hydration = hydrationProfileForGoblin(state, goblin, indexHint);
  const hydrationPriority = hydrationPriorityFor(goblin.needs.thirst, hydration);
  unit.roleState.hydrationPriority = hydrationPriority;
  const threatGoal = threatGoalForGoblin(state, goblin, unit, role, tick, events, threatByGoblinId?.[goblin.id]);
  if (threatGoal) return threatGoal;
  const recoveryOutpost = selectRecoveryOutpostForRole(state, unit, role);
  if (recoveryOutpost) {
    unit.roleState.recoveryOutpostId = recoveryOutpost.id;
  } else if (unit.roleState.recoveryOutpostId) {
    unit.roleState.recoveryOutpostId = null;
  }
  if (roleSuppressedByCriticalNeeds(state, role)) {
    return emergencyPreemptionTask(state, goblin, unit, role, tick, events, origin);
  }

  const currentTask = unit.roleState?.roleTask;
  const carryingLoad = Number(carried?.amount || 0) > 0;
  const shouldContinueDrink = (currentTask?.kind === "drink" || currentTask?.kind === "drink-stored-water")
    && goblin.needs.thirst > hydration.satedThreshold;
  const shouldSeekDrinkNow = hydrationPriority === "critical"
    || (!carryingLoad && hydrationPriority === "high")
    || (hydrationPriority === "moderate" && role !== "water-runner" && !carryingLoad);

  if (shouldContinueDrink || shouldSeekDrinkNow) {
    const hasRecentHydrationTask = tick - (unit.roleState.lastHydrationTaskTick || -1000) < HYDRATION_REEVALUATE_TICKS;
    const source = (shouldContinueDrink && currentTask && hasRecentHydrationTask && currentTask.kind === "drink")
      ? {
          microX: currentTask.targetMicroX,
          microY: currentTask.targetMicroY,
          tileX: tileToChunkCoord(currentTask.targetMicroX),
          tileY: tileToChunkCoord(currentTask.targetMicroY)
        }
      : findClosestWaterSource(wm, origin);
    const distToHome = dist(origin, { x: unit.homeMicroX, y: unit.homeMicroY });
    const distToSource = source ? dist(origin, { x: source.microX, y: source.microY }) : Infinity;
    const canUseStoredWater = (state.tribe.resources.water || 0) > 0 && distToHome <= distToSource + 2;
    if (canUseStoredWater) {
      const task = buildDrinkFromStorageTask(unit);
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      unit.roleState.lastHydrationTaskTick = tick;
      return task;
    }
    if (source) {
      const task = buildDrinkTask(source);
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      unit.roleState.lastHydrationTaskTick = tick;
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} could not find water to drink.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (carryingLoad) {
    const deliverTask = {
      kind: "deliver-home",
      targetMicroX: unit.homeMicroX,
      targetMicroY: unit.homeMicroY,
      targetTileX: unit.homeTileX,
      targetTileY: unit.homeTileY
    };
    maybeEmitTaskClaimed(events, goblin, unit, role, deliverTask);
    setRoleTask(unit, role, deliverTask, tick);
    return deliverTask;
  }

  const shouldContinueRest = currentTask?.kind === "rest" && (goblin.needs.rest || 0) > 46;
  const shouldRestNow = ((goblin.needs.rest || 0) >= 94)
    || (!carryingLoad && (
      (goblin.needs.rest || 0) >= 86
      || ((goblin.needs.rest || 0) >= 78 && (goblin.psyche?.stress || 0) >= 60)
    ));
  if (shouldContinueRest || shouldRestNow) {
    const restTask = buildRestTask(unit);
    maybeEmitTaskClaimed(events, goblin, unit, role, restTask);
    setRoleTask(unit, role, restTask, tick);
    return restTask;
  }

  const migration = ensureMigrationState(wm);
  const migrationJobId = migration.queueIds.find((id) => {
    const job = migration.jobsById[id];
    return job && (job.status === "queued" || job.status === "active") && job.goblinId === goblin.id;
  });
  if (migrationJobId) {
    const job = migration.jobsById[migrationJobId];
    if (job) {
      job.status = "active";
      unit.home = unit.home || {};
      unit.home.status = "migrating";
      const task = {
        kind: "migrate-outpost",
        jobId: job.id,
        fromOutpostId: job.fromOutpostId,
        toOutpostId: job.toOutpostId,
        targetMicroX: job.targetMicroX,
        targetMicroY: job.targetMicroY,
        targetTileX: job.targetTileX,
        targetTileY: job.targetTileY
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
  }

  if (role === "hauler") {
    const haulTask = claimHaulTask(state, goblin.id, unit, tick);
    if (haulTask) {
      const task = {
        kind: "haul-pickup",
        taskId: haulTask.id,
        targetMicroX: haulTask.sourceMicroX,
        targetMicroY: haulTask.sourceMicroY,
        targetTileX: haulTask.sourceTileX,
        targetTileY: haulTask.sourceTileY
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no haul work.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "water-runner") {
    const preferredOrigin = recoveryOutpost ? { x: recoveryOutpost.microX, y: recoveryOutpost.microY } : origin;
    const source = findClosestWaterSource(wm, preferredOrigin) || findClosestWaterSource(wm, origin);
    if (source) {
      const task = {
        kind: "collect-water",
        targetMicroX: source.microX,
        targetMicroY: source.microY,
        targetTileX: source.tileX,
        targetTileY: source.tileY,
        recoveryOutpostId: recoveryOutpost?.id || undefined,
        reasonCode: recoveryOutpost ? "OUTPOST_RECOVERY" : undefined
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no water source.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "fisherman") {
    const source = findClosestWaterSource(wm, origin);
    if (source) {
      const task = {
        kind: "fish-water",
        targetMicroX: source.microX,
        targetMicroY: source.microY,
        targetTileX: source.tileX,
        targetTileY: source.tileY
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no fishable water.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "hunter") {
    const target = nearestHuntTarget(state, unit);
    if (target) {
      const task = {
        kind: "hunt-wildlife",
        targetWildlifeId: target.id,
        targetMicroX: target.microX,
        targetMicroY: target.microY,
        targetTileX: target.tileX,
        targetTileY: target.tileY
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no hunt target.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "quartermaster") {
    const defenseTask = claimAutomatedDefenseTask(state, goblin.id, role, unit, tick);
    if (defenseTask) {
      maybeEmitTaskClaimed(events, goblin, unit, role, defenseTask);
      setRoleTask(unit, role, defenseTask, tick);
      return defenseTask;
    }

    const policy = ensureRolePolicy(state);
    const override = policy.override;
    if (override && tickWithinOverride(tick, override)) {
      const target = homeDepotForUnit(state, unit);
      const task = {
        kind: "quartermaster-coordinate",
        targetMicroX: target.microX,
        targetMicroY: target.microY,
        targetTileX: target.tileX,
        targetTileY: target.tileY
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }

    const processTask = claimProcessingTaskForRole(state, goblin.id, role, tick);
    if (processTask) {
      const target = homeDepotForUnit(state, unit);
      const task = {
        kind: "process-resources",
        processTaskId: processTask.id,
        recipeKey: processTask.recipeKey,
        targetMicroX: target.microX,
        targetMicroY: target.microY,
        targetTileX: target.tileX,
        targetTileY: target.tileY
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }

    const patrolTask = lookoutPatrolPoint(unit, tick, goblin.id, wm);
    patrolTask.kind = "quartermaster-patrol";
    maybeEmitTaskClaimed(events, goblin, unit, role, patrolTask);
    setRoleTask(unit, role, patrolTask, tick);
    return patrolTask;
  }

  if (role === "smelter" || role === "rope-maker" || role === "carpenter" || role === "charcoal-burner" || role === "fletcher" || role === "mechanist") {
    const defenseTask = claimAutomatedDefenseTask(state, goblin.id, role, unit, tick);
    if (defenseTask) {
      maybeEmitTaskClaimed(events, goblin, unit, role, defenseTask);
      setRoleTask(unit, role, defenseTask, tick);
      return defenseTask;
    }

    const processTask = claimProcessingTaskForRole(state, goblin.id, role, tick);
    if (processTask) {
      const target = homeDepotForUnit(state, unit);
      const task = {
        kind: "process-resources",
        processTaskId: processTask.id,
        recipeKey: processTask.recipeKey,
        targetMicroX: target.microX,
        targetMicroY: target.microY,
        targetTileX: target.tileX,
        targetTileY: target.tileY
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_RECIPE_READY", `${goblin.identity.name} (${role}) found no matching recipe work.`);
    setRoleTask(unit, role, idleTask, tick, "NO_RECIPE_READY");
    return idleTask;
  }

  if (role === "caretaker") {
    const target = findCaretakerTarget(state, goblin.id);
    if (target) {
      const task = {
        kind: "assist-goblin",
        targetGoblinId: target.goblinId,
        targetMicroX: target.unit.microX,
        targetMicroY: target.unit.microY,
        targetTileX: target.unit.tileX,
        targetTileY: target.unit.tileY
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no distressed goblins.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "reproducer") {
    const repro = ensureReproductionState(state);
    const safety = reproductionSafety(state, repro);
    const fallback = {
      kind: "reproduce-self",
      targetMicroX: unit.homeMicroX,
      targetMicroY: unit.homeMicroY,
      targetTileX: unit.homeTileX,
      targetTileY: unit.homeTileY
    };
    if (!safety.safe) {
      maybeEmitTaskBlocked(events, goblin, unit, role, tick, "THREAT_ACTIVE", `${goblin.identity.name} (${role}) is standing down due to danger.`);
    } else {
      maybeEmitTaskClaimed(events, goblin, unit, role, fallback);
    }
    setRoleTask(unit, role, fallback, tick, safety.safe ? null : "THREAT_ACTIVE");
    return fallback;
  }

  if (role === "sentinel") {
    const nearestThreat = nearestThreatForUnit(state, unit);
    if (nearestThreat && nearestThreat.confidence >= 0.3) {
      const task = {
        kind: "defend-threat",
        targetThreatId: nearestThreat.sourceId || undefined,
        targetMicroX: nearestThreat.microX,
        targetMicroY: nearestThreat.microY,
        targetTileX: tileToChunkCoord(nearestThreat.microX),
        targetTileY: tileToChunkCoord(nearestThreat.microY)
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const holdTask = sentinelHoldPoint(state, unit);
    maybeEmitTaskClaimed(events, goblin, unit, role, holdTask);
    setRoleTask(unit, role, holdTask, tick);
    return holdTask;
  }

  if (role === "builder") {
    if (!shouldBuildWall(state)) {
      const defenseTask = claimAutomatedDefenseTask(state, goblin.id, role, unit, tick);
      if (defenseTask) {
        maybeEmitTaskClaimed(events, goblin, unit, role, defenseTask);
        setRoleTask(unit, role, defenseTask, tick);
        return defenseTask;
      }
      const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
      maybeEmitTaskBlocked(events, goblin, unit, role, tick, "STORAGE_UNAVAILABLE", `${goblin.identity.name} (${role}) has no wood available for wall work.`);
      setRoleTask(unit, role, idleTask, tick, "STORAGE_UNAVAILABLE");
      return idleTask;
    }
    const threat = nearestThreatForUnit(state, unit);
    const preferredTarget = recoveryOutpost
      ? { x: recoveryOutpost.microX, y: recoveryOutpost.microY }
      : (threat ? { x: threat.microX, y: threat.microY } : { x: unit.homeMicroX, y: unit.homeMicroY });
    const preferredSiteId = recoveryOutpost?.id ? `outpost:${recoveryOutpost.id}` : null;
    const wallTarget = chooseWallTile(state, goblin.id, tick, preferredTarget, preferredSiteId);
    if (wallTarget) {
      const task = {
        kind: "build-wall",
        targetMicroX: wallTarget.microX,
        targetMicroY: wallTarget.microY,
        targetTileX: tileToChunkCoord(wallTarget.microX),
        targetTileY: tileToChunkCoord(wallTarget.microY),
        wallKey: wallTarget.key,
        wallPlanSiteId: wallTarget.siteId,
        recoveryOutpostId: recoveryOutpost?.id || undefined,
        reasonCode: recoveryOutpost ? "OUTPOST_RECOVERY" : undefined
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const defenseTask = claimAutomatedDefenseTask(state, goblin.id, role, unit, tick);
    if (defenseTask) {
      maybeEmitTaskClaimed(events, goblin, unit, role, defenseTask);
      setRoleTask(unit, role, defenseTask, tick);
      return defenseTask;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no valid wall segment to build.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "homebuilder") {
    if (!shouldBuildVillageHome(state)) {
      const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
      maybeEmitTaskBlocked(
        events,
        goblin,
        unit,
        role,
        tick,
        "STORAGE_UNAVAILABLE",
        `${goblin.identity.name} (${role}) is waiting for resources or housing demand.`
      );
      setRoleTask(unit, role, idleTask, tick, "STORAGE_UNAVAILABLE");
      return idleTask;
    }
    const spot = chooseVillageHomeTile(state, unit, tick, goblin.id);
    if (spot) {
      const task = {
        kind: "build-home",
        targetMicroX: spot.microX,
        targetMicroY: spot.microY,
        targetTileX: spot.tileX,
        targetTileY: spot.tileY
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no viable home plot.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "lookout") {
    const nearestThreat = nearestThreatForUnit(state, unit);
    if (nearestThreat && nearestThreat.confidence >= 0.25) {
      const task = {
        kind: "investigate-threat",
        targetMicroX: nearestThreat.microX,
        targetMicroY: nearestThreat.microY,
        targetTileX: tileToChunkCoord(nearestThreat.microX),
        targetTileY: tileToChunkCoord(nearestThreat.microY)
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const patrolTask = lookoutPatrolPoint(unit, tick, goblin.id, wm);
    maybeEmitTaskClaimed(events, goblin, unit, role, patrolTask);
    setRoleTask(unit, role, patrolTask, tick);
    return patrolTask;
  }

  if (role === "scout") {
    const frontier = selectScoutFrontier(state, unit);
    if (frontier) {
      const task = {
        kind: "scout-frontier",
        targetMicroX: frontier.center.x,
        targetMicroY: frontier.center.y,
        targetTileX: tileToChunkCoord(frontier.center.x),
        targetTileY: tileToChunkCoord(frontier.center.y),
        targetRegionId: frontier.regionId
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no low-confidence frontier.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "colony-establisher") {
    const frontier = selectColonyFrontier(state, unit);
    if (frontier) {
      const task = {
        kind: "establish-colony",
        targetMicroX: frontier.center.x,
        targetMicroY: frontier.center.y,
        targetTileX: tileToChunkCoord(frontier.center.x),
        targetTileY: tileToChunkCoord(frontier.center.y),
        targetRegionId: frontier.regionId
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no viable frontier to establish.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "forager") {
    const preferredOrigin = recoveryOutpost ? { x: recoveryOutpost.microX, y: recoveryOutpost.microY } : origin;
    const herbNode = findClosestReadyAdvancedNode(wm, preferredOrigin, "herbNodesByTileKey", tick)
      || findClosestReadyAdvancedNode(wm, origin, "herbNodesByTileKey", tick);
    if (herbNode && (state.tribe.resources.herbs || 0) < 16) {
      const task = {
        kind: "gather-herbs",
        targetTileX: herbNode.tileX,
        targetTileY: herbNode.tileY,
        targetMicroX: regionToMicroCenter(herbNode.tileX),
        targetMicroY: regionToMicroCenter(herbNode.tileY),
        recoveryOutpostId: recoveryOutpost?.id || undefined,
        reasonCode: recoveryOutpost ? "OUTPOST_RECOVERY" : undefined
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }

    const fiberNode = findClosestReadyAdvancedNode(wm, preferredOrigin, "fiberNodesByTileKey", tick)
      || findClosestReadyAdvancedNode(wm, origin, "fiberNodesByTileKey", tick);
    if (fiberNode && (state.tribe.resources.fiber || 0) < 18) {
      const task = {
        kind: "gather-fiber",
        targetTileX: fiberNode.tileX,
        targetTileY: fiberNode.tileY,
        targetMicroX: regionToMicroCenter(fiberNode.tileX),
        targetMicroY: regionToMicroCenter(fiberNode.tileY),
        recoveryOutpostId: recoveryOutpost?.id || undefined,
        reasonCode: recoveryOutpost ? "OUTPOST_RECOVERY" : undefined
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }

    const foodNode = findClosestReadyNode(wm, preferredOrigin, "mushroom", tick)
      || findClosestReadyNode(wm, origin, "mushroom", tick);
    if (foodNode) {
      const task = {
        kind: "gather-food",
        targetMicroX: foodNode.microX,
        targetMicroY: foodNode.microY,
        targetTileX: foodNode.tileX,
        targetTileY: foodNode.tileY,
        recoveryOutpostId: recoveryOutpost?.id || undefined,
        reasonCode: recoveryOutpost ? "OUTPOST_RECOVERY" : undefined
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no ready mushrooms.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "miner") {
    const oreNode = findClosestReadyAdvancedNode(wm, origin, "oreNodesByTileKey", tick);
    if (oreNode) {
      const task = {
        kind: "mine-ore",
        targetTileX: oreNode.tileX,
        targetTileY: oreNode.tileY,
        targetMicroX: regionToMicroCenter(oreNode.tileX),
        targetMicroY: regionToMicroCenter(oreNode.tileY)
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const salvageNode = findClosestReadyAdvancedNode(wm, origin, "salvageNodesByTileKey", tick);
    if (salvageNode) {
      const task = {
        kind: "salvage-ruins",
        targetTileX: salvageNode.tileX,
        targetTileY: salvageNode.tileY,
        targetMicroX: regionToMicroCenter(salvageNode.tileX),
        targetMicroY: regionToMicroCenter(salvageNode.tileY)
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no ready ore/salvage node.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "fiber-harvester") {
    const fiberNode = findClosestReadyAdvancedNode(wm, origin, "fiberNodesByTileKey", tick);
    if (fiberNode) {
      const task = {
        kind: "gather-fiber",
        targetTileX: fiberNode.tileX,
        targetTileY: fiberNode.tileY,
        targetMicroX: regionToMicroCenter(fiberNode.tileX),
        targetMicroY: regionToMicroCenter(fiberNode.tileY)
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no ready fiber node.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "herbalist") {
    const herbNode = findClosestReadyAdvancedNode(wm, origin, "herbNodesByTileKey", tick);
    if (herbNode) {
      const task = {
        kind: "gather-herbs",
        targetTileX: herbNode.tileX,
        targetTileY: herbNode.tileY,
        targetMicroX: regionToMicroCenter(herbNode.tileX),
        targetMicroY: regionToMicroCenter(herbNode.tileY)
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no ready herb node.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (role === "woodcutter") {
    const woodStock = state.tribe.resources.wood || 0;
    const metalOreStock = state.tribe.resources.metal_ore || 0;
    const metalPartsStock = state.tribe.resources.metal_parts || 0;
    const preferredOrigin = recoveryOutpost ? { x: recoveryOutpost.microX, y: recoveryOutpost.microY } : origin;
    const wallDemandActive = shouldBuildWall(state);
    const woodDemandActive = wallDemandActive || woodStock < 24;

    const treeNode = findClosestReadyNode(wm, preferredOrigin, "tree", tick)
      || findClosestReadyNode(wm, origin, "tree", tick);
    if (treeNode && woodDemandActive) {
      const task = {
        kind: "cut-tree",
        targetMicroX: treeNode.microX,
        targetMicroY: treeNode.microY,
        targetTileX: treeNode.tileX,
        targetTileY: treeNode.tileY,
        recoveryOutpostId: recoveryOutpost?.id || undefined,
        reasonCode: recoveryOutpost ? "OUTPOST_RECOVERY" : undefined
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }

    const oreNode = findClosestReadyAdvancedNode(wm, preferredOrigin, "oreNodesByTileKey", tick)
      || findClosestReadyAdvancedNode(wm, origin, "oreNodesByTileKey", tick);
    if (oreNode && !woodDemandActive && metalOreStock < 20) {
      const task = {
        kind: "mine-ore",
        targetTileX: oreNode.tileX,
        targetTileY: oreNode.tileY,
        targetMicroX: regionToMicroCenter(oreNode.tileX),
        targetMicroY: regionToMicroCenter(oreNode.tileY)
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }

    const salvageNode = findClosestReadyAdvancedNode(wm, preferredOrigin, "salvageNodesByTileKey", tick)
      || findClosestReadyAdvancedNode(wm, origin, "salvageNodesByTileKey", tick);
    if (salvageNode && !woodDemandActive && metalPartsStock < 10) {
      const task = {
        kind: "salvage-ruins",
        targetTileX: salvageNode.tileX,
        targetTileY: salvageNode.tileY,
        targetMicroX: regionToMicroCenter(salvageNode.tileX),
        targetMicroY: regionToMicroCenter(salvageNode.tileY)
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }

    if (treeNode) {
      const task = {
        kind: "cut-tree",
        targetMicroX: treeNode.microX,
        targetMicroY: treeNode.microY,
        targetTileX: treeNode.tileX,
        targetTileY: treeNode.tileY,
        recoveryOutpostId: recoveryOutpost?.id || undefined,
        reasonCode: recoveryOutpost ? "OUTPOST_RECOVERY" : undefined
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no ready trees.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
  setRoleTask(unit, role, idleTask, tick);
  return idleTask;
}

function chooseNextTile(state, unit, unitsByGoblinId, densityMap, occupiedNow, occupiedNext, goal) {
  const wm = state.worldMap;
  const target = { x: goal.targetMicroX, y: goal.targetMicroY };

  let best = { x: unit.microX, y: unit.microY, score: -Infinity };

  for (const offset of NEIGHBOR_OFFSETS) {
    const nx = clamp(unit.microX + offset.x, 0, wm.width * TILES_PER_CHUNK - 1);
    const ny = clamp(unit.microY + offset.y, 0, wm.height * TILES_PER_CHUNK - 1);
    const key = tileKey(nx, ny);

    const occupiedBy = occupiedNow.get(key);
    if (occupiedBy && occupiedBy !== unit.goblinId) continue;
    if (occupiedNext.has(key) && occupiedNext.get(key) !== unit.goblinId) continue;
    const isWater = isWaterMicroTile(wm, nx, ny);
    if (isWater) continue;

    const tileNX = clamp(Math.floor(nx / TILES_PER_CHUNK), 0, wm.width - 1);
    const tileNY = clamp(Math.floor(ny / TILES_PER_CHUNK), 0, wm.height - 1);
    const region = wm.regionsById[wm.regionGrid[tileNY][tileNX]];
    let hazardPenalty = region.hazardPressure * 0.55;
    if (unit.roleState?.role === "scout") {
      const policy = ensureScoutPolicy(state);
      if (region.hazardPressure > policy.maxHazardPressure) {
        hazardPenalty += (region.hazardPressure - policy.maxHazardPressure) * 2.8;
      }
    }

    const dBefore = dist({ x: unit.microX, y: unit.microY }, target);
    const dAfter = dist({ x: nx, y: ny }, target);
    const goalProgress = (dBefore - dAfter) * 0.9;

    const grouping = localDensity(unitsByGoblinId, densityMap, nx, ny, unit.goblinId) * 0.24;
    const homePull = -dist({ x: nx, y: ny }, { x: unit.homeMicroX, y: unit.homeMicroY }) * 0.02;
    const jitter = rand01("step", state.meta.tick, unit.goblinId, nx, ny) * 0.2;

    let score = goalProgress + grouping + homePull + jitter - hazardPenalty;
    if (goal.kind === "idle") score += grouping * 0.4;
    if (goal.kind === "regroup-defense") score += grouping * 0.55;
    if (goal.kind === "defend-threat") score += grouping * 0.25;
    if (goal.kind === "flee-threat") {
      if (goal.fromThreatX !== undefined && goal.fromThreatY !== undefined) {
        score += dist({ x: nx, y: ny }, { x: goal.fromThreatX, y: goal.fromThreatY }) * 0.35;
      }
      score -= hazardPenalty * 0.4;
    }

    if (score > best.score) best = { x: nx, y: ny, score };
  }

  if (best.x === unit.microX && best.y === unit.microY && goal.kind !== "idle") {
    const detour = findDetourStepForGoblin(state, unit, occupiedNow, occupiedNext, goal);
    if (detour) return detour;
  }

  return { x: best.x, y: best.y };
}

function findDetourStepForGoblin(state, unit, occupiedNow, occupiedNext, goal) {
  const wm = state.worldMap;
  const target = { x: goal.targetMicroX, y: goal.targetMicroY };
  const maxDepth = 18;
  const maxVisited = 420;
  const neighborOffsets = NEIGHBOR_OFFSETS.filter((o) => !(o.x === 0 && o.y === 0));

  const queue = [{
    x: unit.microX,
    y: unit.microY,
    depth: 0,
    firstStep: null
  }];
  const visited = new Set([tileKey(unit.microX, unit.microY)]);

  for (let q = 0; q < queue.length; q += 1) {
    const node = queue[q];
    if (node.depth > 0 && dist({ x: node.x, y: node.y }, target) <= 1.1) {
      return node.firstStep || null;
    }
    if (node.depth >= maxDepth) continue;

    for (const off of neighborOffsets) {
      const nx = clamp(node.x + off.x, 0, wm.width * TILES_PER_CHUNK - 1);
      const ny = clamp(node.y + off.y, 0, wm.height * TILES_PER_CHUNK - 1);
      const key = tileKey(nx, ny);
      if (visited.has(key)) continue;

      const occupiedBy = occupiedNow.get(key);
      if (occupiedBy && occupiedBy !== unit.goblinId) continue;
      if (occupiedNext.has(key) && occupiedNext.get(key) !== unit.goblinId) continue;
      if (isWaterMicroTile(wm, nx, ny)) continue;

      visited.add(key);
      queue.push({
        x: nx,
        y: ny,
        depth: node.depth + 1,
        firstStep: node.firstStep || { x: nx, y: ny }
      });
      if (visited.size >= maxVisited) break;
    }
    if (visited.size >= maxVisited) break;
  }
  return null;
}

function maybeEmitInteraction(state, unit, tick) {
  if (tick - unit.lastInteractionTick < 16) return null;

  const wm = state.worldMap;
  const neighbors = [];
  for (const other of Object.values(wm.units.byGoblinId)) {
    if (other.goblinId === unit.goblinId) continue;
    if (Math.abs(other.microX - unit.microX) <= 2 && Math.abs(other.microY - unit.microY) <= 2) neighbors.push(other);
  }
  if (!neighbors.length) return null;

  const roll = rand01("social", tick, unit.goblinId, neighbors.length);
  if (roll > 0.11) return null;

  const friend = neighbors[Math.floor(rand01("pick", tick, unit.goblinId) * neighbors.length)];
  unit.lastInteractionTick = tick;
  return {
    type: "GOBLIN_SOCIAL_MOMENT",
    goblinId: unit.goblinId,
    otherGoblinId: friend.goblinId,
    text: `${state.goblins.byId[unit.goblinId].identity.name} and ${state.goblins.byId[friend.goblinId].identity.name} gathered near their homes.`
  };
}

function defendersNearTarget(state, microX, microY, radius = 2.5) {
  let count = 0;
  for (const [goblinId, unit] of Object.entries(state.worldMap?.units?.byGoblinId || {})) {
    const goblin = state.goblins.byId[goblinId];
    if (!goblin || !goblin.flags.alive || goblin.flags.missing) continue;
    const mode = goblin.modData?.threatResponse?.mode || "none";
    if (mode !== "defend") continue;
    if (dist({ x: unit.microX, y: unit.microY }, { x: microX, y: microY }) <= radius) count += 1;
  }
  return count;
}

function defendAttackRangeForKind(kind) {
  if (kind === "barbarian" || kind === "ogre") return DEFEND_ATTACK_RANGE + 0.6;
  return DEFEND_ATTACK_RANGE;
}

function hasWallBetweenMicroPoints(state, fromX, fromY, toX, toY) {
  const path = tilePathBetween({ x: fromX, y: fromY }, { x: toX, y: toY });
  if (path.length <= 2) return false;
  for (let i = 1; i < path.length - 1; i += 1) {
    const p = path[i];
    if (state.worldMap?.structures?.wallsByTileKey?.[tileKey(p.x, p.y)]) return true;
  }
  return false;
}

function nearestRangedDefendTarget(state, unit, preferredThreatId = null) {
  const wildlife = state.worldMap?.wildlife;
  if (!wildlife?.allIds?.length) return null;
  const preferred = preferredThreatId ? wildlife.byId?.[preferredThreatId] : null;
  if (preferred && preferred.alive && (preferred.kind === "barbarian" || preferred.kind === "ogre")) {
    const d = dist({ x: unit.microX, y: unit.microY }, { x: preferred.microX, y: preferred.microY });
    if (
      d > defendAttackRangeForKind(preferred.kind)
      && d <= DEFEND_RANGED_ATTACK_RANGE
      && hasWallBetweenMicroPoints(state, unit.microX, unit.microY, preferred.microX, preferred.microY)
    ) {
      return preferred;
    }
  }

  let best = null;
  let bestScore = -Infinity;
  for (const wid of wildlife.allIds) {
    const creature = wildlife.byId[wid];
    if (!creature || !creature.alive || (creature.kind !== "barbarian" && creature.kind !== "ogre")) continue;
    const d = dist({ x: unit.microX, y: unit.microY }, { x: creature.microX, y: creature.microY });
    if (d <= defendAttackRangeForKind(creature.kind) || d > DEFEND_RANGED_ATTACK_RANGE) continue;
    if (!hasWallBetweenMicroPoints(state, unit.microX, unit.microY, creature.microX, creature.microY)) continue;
    const score = 2 - d * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = creature;
    }
  }
  return best;
}

function nearestDefendTarget(state, unit, preferredThreatId = null) {
  const wildlife = state.worldMap?.wildlife;
  if (!wildlife?.allIds?.length) return null;
  const preferred = preferredThreatId ? wildlife.byId?.[preferredThreatId] : null;
  if (preferred && preferred.alive && isHostileWildlifeKind(preferred.kind)) {
    const d = dist({ x: unit.microX, y: unit.microY }, { x: preferred.microX, y: preferred.microY });
    if (d <= defendAttackRangeForKind(preferred.kind)) return preferred;
  }

  let best = null;
  let bestScore = -Infinity;
  for (const wid of wildlife.allIds) {
    const creature = wildlife.byId[wid];
    if (!creature || !creature.alive || !isHostileWildlifeKind(creature.kind)) continue;
    const d = dist({ x: unit.microX, y: unit.microY }, { x: creature.microX, y: creature.microY });
    const range = defendAttackRangeForKind(creature.kind);
    if (d > range) continue;
    const kindBias = creature.kind === "barbarian" ? 2.5 : creature.kind === "ogre" ? 2.2 : 0;
    const score = kindBias - d;
    if (score > bestScore) {
      bestScore = score;
      best = creature;
    }
  }
  return best;
}

function nearestHuntTarget(state, unit) {
  const wildlife = state.worldMap?.wildlife;
  if (!wildlife?.allIds?.length) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const wid of wildlife.allIds) {
    const c = wildlife.byId[wid];
    if (!c || !c.alive) continue;
    if (c.kind !== "deer") continue;
    const d = dist({ x: unit.microX, y: unit.microY }, { x: c.microX, y: c.microY });
    const homeDistance = dist({ x: unit.homeMicroX, y: unit.homeMicroY }, { x: c.microX, y: c.microY });
    const score = 16 - d * 0.4 - homeDistance * 0.18;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function removeWildlifeFromState(state, creatureId) {
  const wildlife = state.worldMap?.wildlife;
  if (!wildlife?.byId?.[creatureId]) return;
  const creature = wildlife.byId[creatureId];
  delete wildlife.byId[creatureId];
  wildlife.allIds = (wildlife.allIds || []).filter((id) => id !== creatureId);

  const occ = wildlife.occupancyByMicroKey || {};
  const key = tileKey(creature.microX, creature.microY);
  if (occ[key]) {
    occ[key] = occ[key].filter((id) => id !== creatureId);
    if (!occ[key].length) delete occ[key];
  }

  for (const [packId, pack] of Object.entries(wildlife.packsById || {})) {
    pack.memberIds = (pack.memberIds || []).filter((id) => id !== creatureId);
    if (!pack.memberIds.length) {
      delete wildlife.packsById[packId];
      continue;
    }
    if (pack.leaderId === creatureId) pack.leaderId = pack.memberIds[0] || null;
    if (pack.targetWildlifeId === creatureId) pack.targetWildlifeId = undefined;
  }
}

function foodYieldForWildlife(creature, tick) {
  const roll = rand01("wildlife-food-yield", creature.id, tick);
  if (creature.kind === "deer") return 10 + Math.floor(roll * 7);
  if (creature.kind === "wolf") return 5 + Math.floor(roll * 4);
  if (creature.kind === "barbarian") return 3 + Math.floor(roll * 4);
  return 2 + Math.floor(roll * 3);
}

function maybeDefendAttack(state, goblin, unit, goal, tick) {
  if (goal.kind !== "defend-threat") return null;
  unit.roleState = unit.roleState || {};
  const meleeTarget = nearestDefendTarget(state, unit, goal.targetThreatId);
  const rangedTarget = meleeTarget ? null : nearestRangedDefendTarget(state, unit, goal.targetThreatId);
  const target = meleeTarget || rangedTarget;
  if (!target) return null;
  const isRanged = Boolean(rangedTarget);

  const lastAttackTick = isRanged
    ? (unit.roleState.lastDefendRangedAttackTick ?? -1000)
    : (unit.roleState.lastDefendAttackTick ?? -1000);
  const cooldown = isRanged ? DEFEND_RANGED_ATTACK_COOLDOWN_TICKS : DEFEND_ATTACK_COOLDOWN_TICKS;
  if (tick - lastAttackTick < cooldown) return null;
  if (isRanged) unit.roleState.lastDefendRangedAttackTick = tick;
  else unit.roleState.lastDefendAttackTick = tick;

  const groupCount = defendersNearTarget(state, target.microX, target.microY, 2.5);
  const base = isRanged
    ? 3 + Math.floor(rand01("defend-ranged-base", tick, goblin.id, target.id) * 4)
    : 4 + Math.floor(rand01("defend-base", tick, goblin.id, target.id) * 5);
  const groupBonusBase = target.kind === "barbarian" || target.kind === "ogre" ? 4 : 3;
  const groupBonus = Math.max(0, groupCount - 1) * (isRanged ? Math.max(1, groupBonusBase - 1) : groupBonusBase);
  const damage = base + groupBonus;
  target.health = clamp((target.health ?? 100) - damage, 0, 100);
  target.stamina = clamp((target.stamina ?? 100) - Math.round(2 + damage * 0.35), 0, 100);

  const events = [{
    type: isRanged ? "GOBLIN_RANGED_STRUCK_WILDLIFE" : "GOBLIN_STRUCK_WILDLIFE",
    goblinId: goblin.id,
    wildlifeId: target.id,
    wildlifeKind: target.kind,
    groupCount,
    damage,
    attackStyle: isRanged ? "ranged" : "melee",
    tileX: target.tileX,
    tileY: target.tileY,
    text: isRanged
      ? `${goblin.identity.name} fired on ${target.kind} ${target.id} for ${damage} through the wall (${groupCount} defenders nearby).`
      : `${goblin.identity.name} struck ${target.kind} ${target.id} for ${damage} (${groupCount} defenders nearby).`
  }];

  if (target.health > 0) {
    if (target.health <= 30 || groupCount >= 3) {
      target.huntState = target.huntState || {};
      target.huntState.mode = "breakoff";
      target.huntState.targetGoblinId = undefined;
      target.huntState.targetCommitUntilTick = undefined;
      target.huntState.retargetAfterTick = tick + 8;
      target.huntState.breakoffUntilTick = tick + 8;
      events.push({
        type: "WILDLIFE_REPELLED_BY_GOBLINS",
        goblinId: goblin.id,
        wildlifeId: target.id,
        wildlifeKind: target.kind,
        tileX: target.tileX,
        tileY: target.tileY,
        text: `${target.kind} ${target.id} was repelled by defending goblins.`
      });
    }
    return events;
  }

  const food = foodYieldForWildlife(target, tick);
  const scaledFood = Math.max(1, Math.round(food * resourceGainMultiplier(state)));
  state.tribe.resources.food = (state.tribe.resources.food || 0) + scaledFood;
  removeWildlifeFromState(state, target.id);
  events.push({
    type: "WILDLIFE_KILLED_BY_GOBLINS",
    goblinId: goblin.id,
    wildlifeId: target.id,
    wildlifeKind: target.kind,
    foodGained: scaledFood,
    tileX: target.tileX,
    tileY: target.tileY,
    text: `${goblin.identity.name} and defenders killed ${target.kind} ${target.id} (+${scaledFood} food).`
  });
  return events;
}

function maybeExecuteGoal(state, goblin, unit, goal, tick) {
  const defendEvents = maybeDefendAttack(state, goblin, unit, goal, tick);
  if (Array.isArray(defendEvents) && defendEvents.length) return defendEvents;

  const key = tileKey(unit.microX, unit.microY);

  if (goal.kind === "drink") {
    if (hasNearbyWaterSource(state.worldMap, unit.microX, unit.microY, 1.5)) {
      const before = goblin.needs.thirst;
      goblin.needs.thirst = 0;
      return {
        type: "GOBLIN_DRANK_WATER",
        goblinId: goblin.id,
        thirstBefore: Number(before.toFixed(1)),
        thirstAfter: Number(goblin.needs.thirst.toFixed(1)),
        text: `${goblin.identity.name} drank and fully rehydrated.`
      };
    }
    return null;
  }

  if (goal.kind === "drink-stored-water") {
    if (dist({ x: unit.microX, y: unit.microY }, { x: unit.homeMicroX, y: unit.homeMicroY }) > HOME_ACTION_RADIUS) return null;
    const stock = Math.floor(state.tribe.resources.water || 0);
    if (stock <= 0) return null;
    const before = goblin.needs.thirst;
    goblin.needs.thirst = 0;
    state.tribe.resources.water = stock - 1;
    return {
      type: "GOBLIN_DRANK_STORED_WATER",
      goblinId: goblin.id,
      thirstBefore: Number(before.toFixed(1)),
      thirstAfter: Number(goblin.needs.thirst.toFixed(1)),
      waterSpent: 1,
      text: `${goblin.identity.name} drank from stored water at home (-1 water).`
    };
  }

  if (goal.kind === "idle") {
    const homeDist = dist({ x: unit.microX, y: unit.microY }, { x: unit.homeMicroX, y: unit.homeMicroY });
    if (homeDist <= 2.2) {
      goblin.needs.rest = Math.max(0, goblin.needs.rest - 1.6);
      goblin.needs.warmth = Math.max(0, goblin.needs.warmth - 0.35);
      goblin.psyche.stress = Math.max(0, goblin.psyche.stress - 0.12);
    } else {
      goblin.needs.rest = Math.max(0, goblin.needs.rest - 0.35);
    }
    return null;
  }

  if (goal.kind === "rest") {
    const homeDist = dist({ x: unit.microX, y: unit.microY }, { x: unit.homeMicroX, y: unit.homeMicroY });
    if (homeDist <= HOME_REST_RADIUS) {
      goblin.needs.rest = Math.max(0, goblin.needs.rest - 2.4);
      goblin.needs.warmth = Math.max(0, goblin.needs.warmth - 0.5);
      goblin.psyche.stress = Math.max(0, goblin.psyche.stress - 0.2);
    }
    return null;
  }

  if (goal.kind === "gather-food") {
    const node = state.worldMap.resourceNodes.byTileKey[key];
    if (!node || node.type !== "mushroom" || node.readyAtTick > tick) return null;
    const gain = 1 + Math.floor(rand01("mushYield", tick, goblin.id) * 3);
    accumulateResourceDrop(state.worldMap, "mushrooms", gain, node.microX, node.microY, tick);
    goblin.needs.hunger = Math.max(0, goblin.needs.hunger - 10);
    node.readyAtTick = tick + node.regrowTicks;
    return {
      type: "GOBLIN_GATHERED_MUSHROOMS",
      goblinId: goblin.id,
      regionId: node.regionId,
      mushroomsGained: gain,
      text: `${goblin.identity.name} foraged mushrooms (+${gain}) and staged them for hauling.`
    };
  }

  if (goal.kind === "cut-tree") {
    const node = state.worldMap.resourceNodes.byTileKey[key];
    if (!node || node.type !== "tree" || node.readyAtTick > tick) return null;
    const gain = 1 + Math.floor(rand01("treeYield", tick, goblin.id) * 2);
    accumulateResourceDrop(state.worldMap, "wood", gain, node.microX, node.microY, tick);
    node.readyAtTick = tick + node.regrowTicks;
    return {
      type: "GOBLIN_CUT_TREE",
      goblinId: goblin.id,
      regionId: node.regionId,
      woodGained: gain,
      text: `${goblin.identity.name} chopped timber (+${gain} wood) and staged it for hauling.`
    };
  }

  if (goal.kind === "mine-ore") {
    const node = findAdvancedNodeAtTile(state.worldMap, "oreNodesByTileKey", unit.tileX, unit.tileY);
    if (!node || Number(node.remaining || 0) <= 0) return null;
    const nextReadyTick = Number(node.nextReadyTick || 0);
    if (tick < nextReadyTick) return null;
    const gain = 1 + Math.floor(rand01("oreYield", tick, goblin.id, node.id) * 2);
    const mined = Math.min(gain, node.remaining);
    node.remaining = Math.max(0, node.remaining - mined);
    node.lastHarvestTick = tick;
    node.nextReadyTick = tick + ADVANCED_GATHER_COOLDOWN_TICKS;
    const mx = regionToMicroCenter(node.tileX);
    const my = regionToMicroCenter(node.tileY);
    accumulateResourceDrop(state.worldMap, "metal_ore", mined, mx, my, tick);
    return {
      type: "GOBLIN_MINED_ORE",
      goblinId: goblin.id,
      regionId: node.regionId,
      amount: mined,
      text: `${goblin.identity.name} mined ore (+${mined} metal_ore) and staged it for hauling.`
    };
  }

  if (goal.kind === "gather-fiber") {
    const node = findAdvancedNodeAtTile(state.worldMap, "fiberNodesByTileKey", unit.tileX, unit.tileY);
    if (!node || Number(node.remaining || 0) <= 0) return null;
    const nextReadyTick = Number(node.nextReadyTick || 0);
    if (tick < nextReadyTick) return null;
    const gain = 1 + Math.floor(rand01("fiberYield", tick, goblin.id, node.id) * 3);
    const gathered = Math.min(gain, node.remaining);
    node.remaining = Math.max(0, node.remaining - gathered);
    node.lastHarvestTick = tick;
    node.nextReadyTick = tick + ADVANCED_GATHER_COOLDOWN_TICKS;
    const mx = regionToMicroCenter(node.tileX);
    const my = regionToMicroCenter(node.tileY);
    accumulateResourceDrop(state.worldMap, "fiber", gathered, mx, my, tick);
    return {
      type: "GOBLIN_GATHERED_FIBER",
      goblinId: goblin.id,
      regionId: node.regionId,
      amount: gathered,
      text: `${goblin.identity.name} gathered fiber (+${gathered}) and staged it for hauling.`
    };
  }

  if (goal.kind === "gather-herbs") {
    const node = findAdvancedNodeAtTile(state.worldMap, "herbNodesByTileKey", unit.tileX, unit.tileY);
    if (!node || Number(node.remaining || 0) <= 0) return null;
    const nextReadyTick = Number(node.nextReadyTick || 0);
    if (tick < nextReadyTick) return null;
    const gain = 1 + Math.floor(rand01("herbYield", tick, goblin.id, node.id) * 2);
    const gathered = Math.min(gain, node.remaining);
    node.remaining = Math.max(0, node.remaining - gathered);
    node.lastHarvestTick = tick;
    node.nextReadyTick = tick + ADVANCED_GATHER_COOLDOWN_TICKS;
    const mx = regionToMicroCenter(node.tileX);
    const my = regionToMicroCenter(node.tileY);
    accumulateResourceDrop(state.worldMap, "herbs", gathered, mx, my, tick);
    return {
      type: "GOBLIN_GATHERED_HERBS",
      goblinId: goblin.id,
      regionId: node.regionId,
      amount: gathered,
      text: `${goblin.identity.name} gathered herbs (+${gathered}) and staged them for hauling.`
    };
  }

  if (goal.kind === "salvage-ruins") {
    const node = findAdvancedNodeAtTile(state.worldMap, "salvageNodesByTileKey", unit.tileX, unit.tileY);
    if (!node || Number(node.remaining || 0) <= 0) return null;
    const nextReadyTick = Number(node.nextReadyTick || 0);
    if (tick < nextReadyTick) return null;
    const gainOre = 1 + Math.floor(rand01("salvageOre", tick, goblin.id, node.id) * 2);
    const bonusParts = rand01("salvageParts", tick, goblin.id, node.id) < 0.28 ? 1 : 0;
    const taken = Math.min(gainOre + bonusParts, node.remaining);
    const outOre = Math.max(0, taken - bonusParts);
    const outParts = Math.min(bonusParts, taken);
    node.remaining = Math.max(0, node.remaining - taken);
    node.lastHarvestTick = tick;
    node.nextReadyTick = tick + ADVANCED_GATHER_COOLDOWN_TICKS + 2;
    const mx = regionToMicroCenter(node.tileX);
    const my = regionToMicroCenter(node.tileY);
    if (outOre > 0) accumulateResourceDrop(state.worldMap, "metal_ore", outOre, mx, my, tick);
    if (outParts > 0) accumulateResourceDrop(state.worldMap, "metal_parts", outParts, mx, my, tick);
    return {
      type: "GOBLIN_SALVAGED_RUINS",
      goblinId: goblin.id,
      regionId: node.regionId,
      metalOre: outOre,
      metalParts: outParts,
      text: `${goblin.identity.name} salvaged ruins (+${outOre} metal_ore${outParts ? `, +${outParts} metal_parts` : ""}).`
    };
  }

  if (goal.kind === "haul-pickup") {
    const log = ensureLogisticsState(state.worldMap);
    const task = goal.taskId ? log.tasksById[goal.taskId] : null;
    const drop = state.worldMap.structures?.resourceDropsByTileKey?.[key] || null;
    if (!task || !drop || task.amountRemaining <= 0) return null;
    const resource = task.resource;
    const available = Math.floor(drop[resource] || 0);
    if (available <= 0) return null;
    if (task.claimedByGoblinId && task.claimedByGoblinId !== goblin.id && (task.claimedUntilTick || 0) >= tick) return null;

    const taken = Math.min(2, task.amountRemaining, available);
    unit.roleState.carried = { resource, amount: taken };
    task.amountRemaining -= taken;
    task.claimedByGoblinId = goblin.id;
    task.claimedUntilTick = tick + 16;
    task.status = task.amountRemaining > 0 ? "queued" : "done";
    drop[resource] = available - taken;
    drop.lastUpdatedTick = tick;
    if (!dropHasAnyHaulableResource(drop)) {
      delete state.worldMap.structures.resourceDropsByTileKey[key];
    }
    return {
      type: "HAUL_TASK_PICKED_UP",
      goblinId: goblin.id,
      role: unit.roleState?.role || "hauler",
      taskId: task.id,
      resource,
      amount: taken,
      tileX: tileToChunkCoord(unit.microX),
      tileY: tileToChunkCoord(unit.microY),
      text: `${goblin.identity.name} picked up ${taken} ${resource} for hauling.`
    };
  }

  if (goal.kind === "deliver-home") {
    const carried = unit.roleState?.carried;
    if (!carried || carried.amount <= 0) return null;
    if (dist({ x: unit.microX, y: unit.microY }, { x: unit.homeMicroX, y: unit.homeMicroY }) > HOME_ACTION_RADIUS) return null;
    const resourceKey = carried.resource;
    const cap = storageCapacityFor(state, resourceKey);
    const current = state.tribe.resources[resourceKey] || 0;
    const room = cap - current;
    if (room <= 0) {
      return {
        type: "ROLE_TASK_BLOCKED",
        goblinId: goblin.id,
        role: unit.roleState?.role || "forager",
        reasonCode: "STORAGE_UNAVAILABLE",
        text: `${goblin.identity.name} cannot deliver ${resourceKey}; storage is full.`
      };
    }
    const gainMul = resourceGainMultiplier(state);
    const baseDeliver = Math.min(carried.amount, room);
    const boostedDeliver = Math.max(1, Math.round(baseDeliver * gainMul));
    const delivered = Math.min(room, boostedDeliver);
    state.tribe.resources[resourceKey] = current + delivered;
    carried.amount -= baseDeliver;
    if (carried.amount <= 0) unit.roleState.carried = null;
    return {
      type: "RESOURCE_DELIVERED",
      goblinId: goblin.id,
      role: unit.roleState?.role || "forager",
      resource: resourceKey,
      amount: delivered,
      text: `${goblin.identity.name} delivered ${delivered} ${resourceKey} to home storage.`
    };
  }

  if (goal.kind === "process-resources") {
    if (dist({ x: unit.microX, y: unit.microY }, { x: unit.homeMicroX, y: unit.homeMicroY }) > HOME_ACTION_RADIUS) return null;
    const processing = ensureProcessingState(state.worldMap);
    const task = goal.processTaskId ? processing.tasksById?.[goal.processTaskId] : null;
    if (!task || task.status === "done") return null;
    if (task.claimedByGoblinId && task.claimedByGoblinId !== goblin.id && (task.claimedUntilTick || 0) >= tick) return null;
    const recipe = PROCESS_RECIPE_DEFS[task.recipeKey];
    if (!recipe) {
      task.status = "done";
      return null;
    }

    task.claimedByGoblinId = goblin.id;
    task.claimedUntilTick = tick + 18;
    task.status = "active";
    task.remainingTicks = Math.max(0, Number(task.remainingTicks ?? recipe.durationTicks) - 1);
    if (task.remainingTicks > 0) return null;

    if (!hasRecipeInputs(state, recipe)) {
      task.status = "blocked";
      return {
        type: "RECIPE_BLOCKED",
        goblinId: goblin.id,
        recipeKey: recipe.key,
        station: recipe.station,
        text: `${goblin.identity.name} could not complete ${recipe.key}; missing inputs.`
      };
    }

    applyRecipeDelta(state.tribe.resources, recipe.inputs, -1);
    applyRecipeDelta(state.tribe.resources, recipe.outputs, 1);
    task.status = "done";
    task.completedTick = tick;
    processing.queueIds = processing.queueIds.filter((id) => id !== task.id);
    delete processing.tasksById[task.id];
    return {
      type: "RECIPE_COMPLETED",
      goblinId: goblin.id,
      recipeKey: recipe.key,
      station: recipe.station,
      text: `${goblin.identity.name} completed ${recipe.key}.`
    };
  }

  if (goal.kind === "resupply-defense") {
    const defense = automatedDefenseById(state.worldMap, goal.defenseId);
    if (!defense) return null;
    if (dist({ x: unit.microX, y: unit.microY }, { x: defense.microX, y: defense.microY }) > 1.3) return null;
    const stock = Math.floor(state.tribe.resources.ammo_bolts || 0);
    const needed = Math.max(0, Number(defense.maxAmmo || 0) - Number(defense.ammo || 0));
    if (needed <= 0) {
      defense.maintenanceNeeded = false;
      defense.maintenanceClaimedByGoblinId = null;
      defense.maintenanceClaimUntilTick = -1;
      if (defense.durability > 0 && defense.status === "inactive_no_ammo") defense.status = "active";
      return null;
    }
    if (stock <= 0) {
      return {
        type: "ROLE_TASK_BLOCKED",
        goblinId: goblin.id,
        role: unit.roleState?.role || "fletcher",
        reasonCode: "NO_AMMO_STOCK",
        text: `${goblin.identity.name} could not resupply ${defense.kind}; no ammo_bolts in storage.`
      };
    }
    const amount = Math.min(4, needed, stock);
    state.tribe.resources.ammo_bolts = stock - amount;
    defense.ammo = (defense.ammo || 0) + amount;
    defense.maintenanceNeeded = defense.ammo <= Math.max(1, Math.floor(defense.maxAmmo * 0.25));
    defense.maintenanceClaimedByGoblinId = null;
    defense.maintenanceClaimUntilTick = -1;
    if (defense.durability > 0 && defense.ammo > 0) defense.status = "active";
    return {
      type: "AUTOMATED_DEFENSE_RESUPPLIED",
      goblinId: goblin.id,
      defenseId: defense.id,
      defenseKind: defense.kind,
      amount,
      text: `${goblin.identity.name} resupplied ${defense.kind} (+${amount} ammo_bolts).`
    };
  }

  if (goal.kind === "repair-defense") {
    const defense = automatedDefenseById(state.worldMap, goal.defenseId);
    if (!defense) return null;
    if (dist({ x: unit.microX, y: unit.microY }, { x: defense.microX, y: defense.microY }) > 1.3) return null;
    const stock = Math.floor(state.tribe.resources.metal_parts || 0);
    const needed = Math.max(0, Number(defense.maxDurability || 100) - Number(defense.durability || 0));
    if (needed <= 0) {
      defense.maintenanceNeeded = false;
      defense.maintenanceClaimedByGoblinId = null;
      defense.maintenanceClaimUntilTick = -1;
      if (defense.status === "inactive_no_parts" && (defense.kind !== "spring_turret" || defense.ammo > 0)) defense.status = "active";
      return null;
    }
    if (stock <= 0) {
      return {
        type: "ROLE_TASK_BLOCKED",
        goblinId: goblin.id,
        role: unit.roleState?.role || "mechanist",
        reasonCode: "NO_PARTS_STOCK",
        text: `${goblin.identity.name} could not repair ${defense.kind}; no metal_parts in storage.`
      };
    }
    state.tribe.resources.metal_parts = stock - 1;
    defense.durability = Math.min(defense.maxDurability || 100, (defense.durability || 0) + 35);
    defense.maintenanceNeeded = defense.durability <= Math.floor((defense.maxDurability || 100) * 0.4);
    defense.maintenanceClaimedByGoblinId = null;
    defense.maintenanceClaimUntilTick = -1;
    if (defense.durability > 0) {
      if (defense.kind === "spring_turret") defense.status = defense.ammo > 0 ? "active" : "inactive_no_ammo";
      else if (defense.kind === "spike_trap" && defense.status !== "inactive_triggered") defense.status = "active";
    }
    return {
      type: "AUTOMATED_DEFENSE_REPAIRED",
      goblinId: goblin.id,
      defenseId: defense.id,
      defenseKind: defense.kind,
      text: `${goblin.identity.name} repaired ${defense.kind} using metal parts.`
    };
  }

  if (goal.kind === "reset-trap") {
    const defense = automatedDefenseById(state.worldMap, goal.defenseId);
    if (!defense || defense.kind !== "spike_trap") return null;
    if (dist({ x: unit.microX, y: unit.microY }, { x: defense.microX, y: defense.microY }) > 1.3) return null;
    if (defense.durability <= 0) {
      defense.status = "inactive_no_parts";
      return null;
    }
    defense.lastActionTick = tick;
    defense.status = "active";
    defense.maintenanceNeeded = false;
    defense.maintenanceClaimedByGoblinId = null;
    defense.maintenanceClaimUntilTick = -1;
    return {
      type: "AUTOMATED_DEFENSE_RESET",
      goblinId: goblin.id,
      defenseId: defense.id,
      defenseKind: defense.kind,
      text: `${goblin.identity.name} reset ${defense.kind}.`
    };
  }

  if (goal.kind === "collect-water") {
    if (!hasNearbyWaterSource(state.worldMap, unit.microX, unit.microY, 1.5)) return null;
    const amount = 2 + Math.floor(rand01("water-runner-yield", tick, goblin.id) * 2); // 2..3
    unit.roleState.carried = { resource: "water", amount };
    return {
      type: "WATER_COLLECTED",
      goblinId: goblin.id,
      role: unit.roleState?.role || "water-runner",
      amount,
      text: `${goblin.identity.name} collected ${amount} water for settlement stores.`
    };
  }

  if (goal.kind === "hunt-wildlife") {
    const wildlife = state.worldMap?.wildlife;
    const target = goal.targetWildlifeId ? wildlife?.byId?.[goal.targetWildlifeId] : null;
    if (!target || !target.alive) return null;
    if (target.kind !== "deer" && target.kind !== "wolf") return null;
    const d = dist({ x: unit.microX, y: unit.microY }, { x: target.microX, y: target.microY });
    if (d > DEFEND_ATTACK_RANGE) return null;

    const strike = 12 + Math.floor(rand01("hunter-strike", tick, goblin.id, target.id) * 10);
    target.health = clamp((target.health ?? 100) - strike, 0, 100);
    if (target.health > 0) {
      return {
        type: "GOBLIN_HUNTED_WILDLIFE",
        goblinId: goblin.id,
        role: unit.roleState?.role || "hunter",
        wildlifeId: target.id,
        wildlifeKind: target.kind,
        damage: strike,
        tileX: target.tileX,
        tileY: target.tileY,
        text: `${goblin.identity.name} wounded ${target.kind} ${target.id} while hunting.`
      };
    }

    const food = foodYieldForWildlife(target, tick);
    removeWildlifeFromState(state, target.id);
    unit.roleState.carried = { resource: "food", amount: food };
    return {
      type: "GOBLIN_HUNTED_WILDLIFE",
      goblinId: goblin.id,
      role: unit.roleState?.role || "hunter",
      wildlifeId: target.id,
      wildlifeKind: target.kind,
      foodGained: food,
      tileX: tileToChunkCoord(unit.microX),
      tileY: tileToChunkCoord(unit.microY),
      text: `${goblin.identity.name} hunted ${target.kind} ${target.id} (+${food} food) and is carrying it home.`
    };
  }

  if (goal.kind === "fish-water") {
    if (!hasNearbyWaterSource(state.worldMap, unit.microX, unit.microY, 1.5)) return null;
    const catchAmt = 1 + Math.floor(rand01("fish-catch", tick, goblin.id) * 3);
    unit.roleState.carried = { resource: "food", amount: catchAmt };
    return {
      type: "GOBLIN_CAUGHT_FISH",
      goblinId: goblin.id,
      role: unit.roleState?.role || "fisherman",
      foodGained: catchAmt,
      tileX: tileToChunkCoord(unit.microX),
      tileY: tileToChunkCoord(unit.microY),
      text: `${goblin.identity.name} caught fish (+${catchAmt} food) and is carrying it home.`
    };
  }

  if (goal.kind === "migrate-outpost") {
    const migration = ensureMigrationState(state.worldMap);
    const job = goal.jobId ? migration.jobsById[goal.jobId] : null;
    if (!job || (job.status !== "queued" && job.status !== "active")) return null;
    if (job.goblinId !== goblin.id) return null;
    const atTarget = dist({ x: unit.microX, y: unit.microY }, { x: job.targetMicroX, y: job.targetMicroY }) <= 1.1;
    if (!atTarget) return null;

    const fromOutpostId = unit.home?.outpostId || job.fromOutpostId || "outpost-start";
    unit.home = unit.home || {};
    unit.home.outpostId = job.toOutpostId;
    unit.home.microX = job.targetMicroX;
    unit.home.microY = job.targetMicroY;
    unit.home.claimedAtTick = tick;
    unit.home.status = "resident";
    unit.homeMicroX = job.targetMicroX;
    unit.homeMicroY = job.targetMicroY;
    unit.homeTileX = job.targetTileX;
    unit.homeTileY = job.targetTileY;
    const homeSite = nearSiteByTile(state.worldMap, unit.homeTileX, unit.homeTileY);
    unit.homeSiteId = homeSite?.id || state.worldMap.player?.startingSiteId;
    goblin.modData = goblin.modData || {};
    goblin.modData.home = {
      outpostId: unit.home.outpostId,
      tileX: unit.homeTileX,
      tileY: unit.homeTileY,
      siteId: unit.homeSiteId
    };

    job.status = "completed";
    job.completedTick = tick;
    migration.queueIds = migration.queueIds.filter((id) => id !== job.id);
    if (migration.metrics) migration.metrics.jobsCompleted = (migration.metrics.jobsCompleted || 0) + 1;
    ensureOutpostState(state);
    return {
      type: "GOBLIN_MIGRATED_OUTPOST",
      goblinId: goblin.id,
      fromOutpostId,
      toOutpostId: job.toOutpostId,
      tileX: unit.homeTileX,
      tileY: unit.homeTileY,
      text: `${goblin.identity.name} migrated from ${fromOutpostId} to ${job.toOutpostId}.`
    };
  }

  if (goal.kind === "establish-colony") {
    const atFrontier = dist({ x: unit.microX, y: unit.microY }, { x: goal.targetMicroX, y: goal.targetMicroY }) <= 1.25;
    if (!atFrontier) return null;
    const last = unit.roleState?.lastColonyEstablishTick ?? -1000;
    if (tick - last < COLONY_ESTABLISH_COOLDOWN_TICKS) return null;

    const spot = findColonyHomeSpot(state, unit, unit.microX, unit.microY);
    if (!spot) {
      return {
        type: "ROLE_TASK_BLOCKED",
        goblinId: goblin.id,
        role: unit.roleState?.role || "colony-establisher",
        reasonCode: "SITE_UNAVAILABLE",
        text: `${goblin.identity.name} reached frontier but found no valid colony tile.`
      };
    }

    const oldHomeKey = tileKey(unit.homeMicroX, unit.homeMicroY);
    unit.homeMicroX = spot.microX;
    unit.homeMicroY = spot.microY;
    unit.homeTileX = tileToChunkCoord(spot.microX);
    unit.homeTileY = tileToChunkCoord(spot.microY);
    const homeSite = nearSiteByTile(state.worldMap, unit.homeTileX, unit.homeTileY);
    unit.homeSiteId = homeSite?.id || state.worldMap.player?.startingSiteId;
    unit.roleState.lastColonyEstablishTick = tick;
    goblin.modData = goblin.modData || {};
    goblin.modData.home = { tileX: unit.homeTileX, tileY: unit.homeTileY, siteId: unit.homeSiteId };
    state.worldMap.structures = state.worldMap.structures || {};
    state.worldMap.structures.colonyOutpostsByTileKey = state.worldMap.structures.colonyOutpostsByTileKey || {};
    const outpostKey = tileKey(unit.homeMicroX, unit.homeMicroY);
    const outpostId = `outpost-frontier-${outpostKey}`;
    const existingOutpost = state.worldMap.structures.colonyOutpostsByTileKey[outpostKey];
    state.worldMap.structures.colonyOutpostsByTileKey[outpostKey] = {
      key: outpostKey,
      outpostId,
      microX: unit.homeMicroX,
      microY: unit.homeMicroY,
      tileX: unit.homeTileX,
      tileY: unit.homeTileY,
      foundedAtTick: existingOutpost?.foundedAtTick ?? tick,
      lastUpdatedTick: tick,
      founderGoblinId: existingOutpost?.founderGoblinId || goblin.id,
      settlers: Math.max(1, (existingOutpost?.settlers || 0) + 1)
    };
    unit.home = unit.home || {};
    unit.home.outpostId = outpostId;
    unit.home.microX = unit.homeMicroX;
    unit.home.microY = unit.homeMicroY;
    unit.home.claimedAtTick = tick;
    unit.home.status = "resident";
    goblin.modData.home.outpostId = outpostId;

    const regionId = state.worldMap.regionGrid[unit.homeTileY]?.[unit.homeTileX];
    if (regionId && state.worldMap.intel?.knownRegions?.[regionId]) {
      const intel = state.worldMap.intel.knownRegions[regionId];
      intel.confidence = clamp(Math.max(intel.confidence || 0, 0.7), 0, 1);
      intel.lastUpdatedTick = tick;
    }

    return {
      type: "COLONY_HOME_ESTABLISHED",
      goblinId: goblin.id,
      role: unit.roleState?.role || "colony-establisher",
      fromHomeKey: oldHomeKey,
      toHomeKey: tileKey(unit.homeMicroX, unit.homeMicroY),
      tileX: unit.homeTileX,
      tileY: unit.homeTileY,
      regionId: goal.targetRegionId,
      text: `${goblin.identity.name} established a frontier home at (${unit.homeTileX}, ${unit.homeTileY}).`
    };
  }

  if (goal.kind === "quartermaster-coordinate") {
    const policy = ensureRolePolicy(state);
    if (policy.override && tickWithinOverride(tick, policy.override)) {
      const remaining = Math.max(0, policy.override.untilTick - tick);
      if (remaining % 6 === 0) {
        return {
          type: "ROLE_COORDINATION_SIGNAL",
          goblinId: goblin.id,
          role: "quartermaster",
          reasonCode: policy.override.reason,
          overrideUntilTick: policy.override.untilTick,
          text: `${goblin.identity.name} is coordinating emergency priorities (${policy.override.reason}).`
        };
      }
    }
    return null;
  }

  if (goal.kind === "assist-goblin") {
    const targetId = goal.targetGoblinId;
    const targetGoblin = targetId ? state.goblins.byId[targetId] : null;
    const targetUnit = targetId ? state.worldMap?.units?.byGoblinId?.[targetId] : null;
    if (!targetGoblin || !targetUnit || !targetGoblin.flags?.alive || targetGoblin.flags?.missing) return null;
    const near = Math.abs(targetUnit.microX - unit.microX) <= 1 && Math.abs(targetUnit.microY - unit.microY) <= 1;
    if (!near) return null;

    const before = {
      thirst: targetGoblin.needs.thirst || 0,
      hunger: targetGoblin.needs.hunger || 0,
      rest: targetGoblin.needs.rest || 0,
      morale: targetGoblin.psyche?.morale || 0,
      vitality: targetGoblin.body?.health?.vitality || 0
    };
    targetGoblin.needs.thirst = clamp(targetGoblin.needs.thirst - 8, 0, 100);
    targetGoblin.needs.hunger = clamp(targetGoblin.needs.hunger - 6, 0, 100);
    targetGoblin.needs.rest = clamp(targetGoblin.needs.rest - 5, 0, 100);
    targetGoblin.psyche.morale = clamp(targetGoblin.psyche.morale + 8, 0, 100);
    targetGoblin.body.health.vitality = clamp(targetGoblin.body.health.vitality + 3, 0, 100);

    return {
      type: "CARETAKER_ASSISTED",
      goblinId: goblin.id,
      targetGoblinId: targetId,
      role: "caretaker",
      before,
      after: {
        thirst: targetGoblin.needs.thirst,
        hunger: targetGoblin.needs.hunger,
        rest: targetGoblin.needs.rest,
        morale: targetGoblin.psyche.morale,
        vitality: targetGoblin.body.health.vitality
      },
      tileX: targetUnit.tileX,
      tileY: targetUnit.tileY,
      text: `${goblin.identity.name} stabilized ${targetGoblin.identity.name}.`
    };
  }

  if (goal.kind === "build-wall") {
    if ((state.tribe.resources.wood || 0) <= 0) return null;
    const wallKey = tileKey(unit.microX, unit.microY);
    if (state.worldMap.structures.wallsByTileKey[wallKey]) return null;
    let plan = goal.wallPlanSiteId ? getWallPlanForSite(state.worldMap, goal.wallPlanSiteId) : null;
    if (!plan || !Object.prototype.hasOwnProperty.call(plan.tileStatusByKey || {}, wallKey)) {
      plan = findWallPlanContainingKey(state.worldMap, wallKey);
    }
    if (!plan) return null;
    if (plan.tileStatusByKey[wallKey] !== "planned") return null;
    if (plan.assignedGoblinByKey[wallKey] !== goblin.id) return null;
    if ((plan.assignedUntilTickByKey[wallKey] || 0) < tick) return null;

    state.tribe.resources.wood -= 1;
    const breachedAt = plan.breachedByKey?.[wallKey];
    state.worldMap.structures.wallsByTileKey[wallKey] = {
      key: wallKey,
      microX: unit.microX,
      microY: unit.microY,
      tileX: tileToChunkCoord(unit.microX),
      tileY: tileToChunkCoord(unit.microY),
      builtByGoblinId: goblin.id,
      builtAtTick: tick
    };
    plan.tileStatusByKey[wallKey] = "built";
    plan.assignedGoblinByKey[wallKey] = null;
    plan.assignedUntilTickByKey[wallKey] = 0;
    if (plan.breachedByKey) delete plan.breachedByKey[wallKey];

    if (breachedAt) {
      return {
        type: "WALL_REPAIRED",
        goblinId: goblin.id,
        siteId: plan.siteId || plan.homeSiteId,
        wallKey,
        tileX: tileToChunkCoord(unit.microX),
        tileY: tileToChunkCoord(unit.microY),
        text: `${goblin.identity.name} repaired a breached wall segment (-1 wood).`
      };
    }

    return {
      type: "GOBLIN_BUILT_WALL",
      goblinId: goblin.id,
      siteId: plan.siteId || plan.homeSiteId,
      wallKey,
      text: `${goblin.identity.name} built a wall segment (-1 wood).`
    };
  }

  if (goal.kind === "build-home") {
    if (!canAffordHomeBuild(state)) return null;
    const tileX = tileToChunkCoord(unit.microX);
    const tileY = tileToChunkCoord(unit.microY);
    if (tileX !== goal.targetTileX || tileY !== goal.targetTileY) return null;
    const blockedHomes = new Set();
    for (const u of Object.values(state.worldMap.units?.byGoblinId || {})) blockedHomes.add(`${u.homeTileX},${u.homeTileY}`);
    for (const home of Object.values(state.worldMap.structures?.villageHomesByTileKey || {})) blockedHomes.add(`${home.tileX},${home.tileY}`);
    for (const outpost of Object.values(state.worldMap.structures?.colonyOutpostsByTileKey || {})) blockedHomes.add(`${outpost.tileX},${outpost.tileY}`);
    if (!isValidVillageHomeTile(state, goal.targetTileX, goal.targetTileY, blockedHomes)) return null;

    state.tribe.resources.wood -= HOME_BUILD_COST_WOOD;
    state.tribe.resources.food -= HOME_BUILD_COST_FOOD;
    state.tribe.resources.water -= HOME_BUILD_COST_WATER;

    state.worldMap.structures.villageHomesByTileKey = state.worldMap.structures.villageHomesByTileKey || {};
    const homeMicroX = regionToMicroCenter(goal.targetTileX);
    const homeMicroY = regionToMicroCenter(goal.targetTileY);
    const homeKey = tileKey(homeMicroX, homeMicroY);
    state.worldMap.structures.villageHomesByTileKey[homeKey] = {
      key: homeKey,
      microX: homeMicroX,
      microY: homeMicroY,
      tileX: goal.targetTileX,
      tileY: goal.targetTileY,
      builtByGoblinId: goblin.id,
      builtAtTick: tick
    };

    const nextPlan = setPrimaryWallPlan(state.worldMap, createWallPlan(state.worldMap, tick));
    const homeEvent = {
      type: "HOME_BUILT",
      goblinId: goblin.id,
      role: unit.roleState?.role || "homebuilder",
      tileX: goal.targetTileX,
      tileY: goal.targetTileY,
      cost: { wood: HOME_BUILD_COST_WOOD, food: HOME_BUILD_COST_FOOD, water: HOME_BUILD_COST_WATER },
      text: `${goblin.identity.name} built a new village home (-${HOME_BUILD_COST_WOOD} wood, -${HOME_BUILD_COST_FOOD} food, -${HOME_BUILD_COST_WATER} water).`
    };
    if (!nextPlan) return homeEvent;
    return [
      homeEvent,
      {
        type: "WALL_PLAN_REPLANNED",
        siteId: state.worldMap.player.startingSiteId,
        planId: nextPlan.planId,
        text: `Wall plan adjusted to include new housing (radius ${nextPlan.desiredRadius}).`
      }
    ];
  }

  if (goal.kind === "investigate-threat" || goal.kind === "lookout-patrol") {
    const wildlife = state.worldMap?.wildlife;
    if (!wildlife?.allIds?.length) return null;
    let spotted = null;
    let bestDist = Infinity;
    for (const wid of wildlife.allIds) {
      const creature = wildlife.byId[wid];
      if (!creature || !creature.alive || !isHostileWildlifeKind(creature.kind)) continue;
      const d = dist({ x: creature.microX, y: creature.microY }, { x: unit.microX, y: unit.microY });
      if (d < LOOKOUT_DETECTION_RADIUS && d < bestDist) {
        bestDist = d;
        spotted = creature;
      }
    }
    if (!spotted) return null;
    const confidence = clamp(1 - bestDist / LOOKOUT_DETECTION_RADIUS, 0.25, 0.99);
    upsertThreatMemory(state, tick, {
      id: `threat-${spotted.id}`,
      sourceId: spotted.id,
      kind: spotted.kind,
      microX: spotted.microX,
      microY: spotted.microY,
      confidence
    });
    const mem = ensureThreatMemory(state.worldMap);
    const source = spotted.id;
    const lastTick = mem.lastThreatEventTickBySource[source] || -1000;
    if (tick - lastTick < 10) return null;
    mem.lastThreatEventTickBySource[source] = tick;
    unit.roleState.lastCoordinationTick = tick;
    return {
      type: "THREAT_SPOTTED",
      goblinId: goblin.id,
      role: unit.roleState?.role || "lookout",
      sourceId: spotted.id,
      wildlifeKind: spotted.kind,
      microX: spotted.microX,
      microY: spotted.microY,
      tileX: tileToChunkCoord(spotted.microX),
      tileY: tileToChunkCoord(spotted.microY),
      confidence: Number(confidence.toFixed(2)),
      text: `${goblin.identity.name} spotted ${spotted.kind} threat near the settlement.`
    };
  }

  return null;
}

function weatherRoutePenaltyByType(routeType, weather) {
  const type = String(routeType || "trail");
  const w = String(weather || "clear");
  if (w === "storm") {
    if (type === "pass") return 1.4;
    if (type === "river") return 1.32;
    if (type === "trail") return 1.24;
    if (type === "road") return 1.12;
    return 1.06;
  }
  if (w === "cold-snap") {
    if (type === "pass") return 1.35;
    if (type === "river") return 1.18;
    if (type === "trail") return 1.14;
    if (type === "road") return 1.08;
    return 1.03;
  }
  if (w === "rain") {
    if (type === "river") return 1.15;
    if (type === "pass") return 1.12;
    if (type === "trail") return 1.1;
    if (type === "road") return 1.04;
    return 1.01;
  }
  if (w === "fog") {
    if (type === "trail") return 1.08;
    if (type === "pass") return 1.1;
    if (type === "road") return 1.05;
    return 1.02;
  }
  if (w === "heat-wave") {
    if (type === "pass") return 1.1;
    if (type === "trail") return 1.07;
    if (type === "road") return 1.05;
    return 1.02;
  }
  return 1;
}

function climateRoutePressureSystem(state, tick, events) {
  const wm = state.worldMap;
  const season = String(state.world?.season?.key || "spring");
  const weather = String(state.world?.weather?.current || state.world?.weather?.type || "clear");
  const intensity = clamp(Number(state.world?.weather?.intensity || 0), 0, 1);
  const globalTravelMul = clamp(Number(state.world?.climateModifiers?.global?.travelMul || 1), 0.65, 1.5);
  const signature = `${season}|${weather}|${intensity.toFixed(3)}|${globalTravelMul.toFixed(3)}`;

  wm.routePressureByRouteId = wm.routePressureByRouteId || {};
  wm.__routePressureRuntime = wm.__routePressureRuntime || { signature: "", lastWarningTickByRouteId: {} };
  if (wm.__routePressureRuntime.signature === signature) return;
  wm.__routePressureRuntime.signature = signature;

  for (const route of Object.values(wm.routesById || {})) {
    const seasonMul = Number(route?.seasonalModifiers?.[season] || 1);
    const weatherPenalty = weatherRoutePenaltyByType(route?.type, weather);
    const weatherMul = 1 + (weatherPenalty - 1) * intensity;
    const travelPressure = 1 / globalTravelMul;
    const climateRisk = clamp(Number(route?.risk || 0.2) * seasonMul * weatherMul * travelPressure, 0.02, 2.2);
    const reliability = clamp(1 - climateRisk * 0.45, 0.05, 0.98);
    const travelMul = clamp((1 / Math.max(0.01, seasonMul * weatherMul)) * globalTravelMul, 0.5, 1.35);
    wm.routePressureByRouteId[route.id] = {
      routeId: route.id,
      climateRisk,
      reliability,
      travelMul,
      season,
      weather,
      intensity,
      updatedAtTick: tick
    };

    const severity = climateRisk >= 0.85 ? "high" : climateRisk >= 0.62 ? "moderate" : "low";
    if (severity === "low") continue;
    const lastWarn = wm.__routePressureRuntime.lastWarningTickByRouteId[route.id] || -1000;
    if (tick - lastWarn < 36) continue;
    wm.__routePressureRuntime.lastWarningTickByRouteId[route.id] = tick;

    const from = wm.sitesById?.[route.fromSiteId];
    const to = wm.sitesById?.[route.toSiteId];
    const tileX = from && to ? Math.round((from.x + to.x) / 2) : from?.x ?? to?.x ?? 0;
    const tileY = from && to ? Math.round((from.y + to.y) / 2) : from?.y ?? to?.y ?? 0;
    events.push({
      type: "ROUTE_DISRUPTION_RISK",
      routeId: route.id,
      weather,
      severity,
      fromSiteId: route.fromSiteId,
      toSiteId: route.toSiteId,
      tileX,
      tileY,
      text: `Route ${route.id} disruption risk is ${severity} (${weather}, ${Math.round(intensity * 100)}%).`
    });
  }
}

export function worldMapSimulationSystem(state) {
  const events = [];
  if (!state.worldMap) return events;
  initUnitState(state);
  syncGoblinOccupancyByMicroKey(state.worldMap, buildOccupancyMap(state.worldMap));

  const wm = state.worldMap;
  const tick = state.meta.tick;
  ensureWallPlanStorage(wm);
  climateRoutePressureSystem(state, tick, events);
  decayIntel(wm, tick);
  refreshWallPlan(state, tick, events);
  ensureThreatMemory(wm);
  updateThreatMemoryFromWildlife(state, tick);
  syncWallPlanBreaches(state, tick, events);
  decayThreatMemory(state, tick);
  ensureLogisticsState(wm);
  ensureProcessingState(wm);
  ensureAutomatedDefenseState(wm);
  updateAutomatedDefenses(state, tick, events);
  updateAdvancedResourceNodes(state);
  updateCriticalNeedPreemption(state, tick, events);
  rebuildHaulTasks(state, tick);
  rebuildProcessingQueue(state, tick);
  emitLogisticsBottlenecks(state, tick, events);
  ensureOutpostState(state);
  updateOutpostLifecycle(state, tick, events);
  runMigrationPlanner(state, tick, events);
  evaluateQuartermasterDirective(state, tick, events);
  applyRoleBalancer(state, tick, events);

  const occupiedNow = buildOccupancyMap(wm);
  const occupiedNext = new Map();
  const ids = [...state.goblins.allIds].sort();
  const unitsByGoblinId = wm.units.byGoblinId;
  const densityMap = buildUnitDensityMap(Object.values(unitsByGoblinId));
  const threatByGoblinId = updateGoblinThreatResponses(state, tick, events);

  for (let idx = 0; idx < ids.length; idx += 1) {
    const goblinId = ids[idx];
    const goblin = state.goblins.byId[goblinId];
    const unit = wm.units.byGoblinId[goblinId];
    if (!goblin || !unit || !goblin.flags.alive || goblin.flags.missing) continue;

    const prevX = unit.microX;
    const prevY = unit.microY;

    const goal = chooseGoal(state, goblin, unit, tick, events, idx, threatByGoblinId);
    unit.lastGoal = goal.kind;

    const next = chooseNextTile(state, unit, unitsByGoblinId, densityMap, occupiedNow, occupiedNext, goal);
    unit.microX = next.x;
    unit.microY = next.y;
    occupiedNext.set(tileKey(unit.microX, unit.microY), goblinId);
    densityMap.set(tileKey(prevX, prevY), Math.max(0, (densityMap.get(tileKey(prevX, prevY)) || 0) - 1));
    densityMap.set(tileKey(unit.microX, unit.microY), (densityMap.get(tileKey(unit.microX, unit.microY)) || 0) + 1);

    unit.tileX = clamp(tileToChunkCoord(unit.microX), 0, wm.width - 1);
    unit.tileY = clamp(tileToChunkCoord(unit.microY), 0, wm.height - 1);

    const jitterX = (rand01("jitterX", tick, goblinId) - 0.5) * 0.3;
    const jitterY = (rand01("jitterY", tick, goblinId) - 0.5) * 0.3;
    const targetPosX = (unit.microX + 0.5) / TILES_PER_CHUNK + jitterX;
    const targetPosY = (unit.microY + 0.5) / TILES_PER_CHUNK + jitterY;
    unit.posX = unit.posX + (targetPosX - unit.posX) * 0.45;
    unit.posY = unit.posY + (targetPosY - unit.posY) * 0.45;

    if (
      next.x === prevX &&
      next.y === prevY &&
      goal.kind !== "idle" &&
      dist({ x: unit.microX, y: unit.microY }, { x: goal.targetMicroX, y: goal.targetMicroY }) > 1.1
    ) {
      maybeEmitTaskBlocked(
        events,
        goblin,
        unit,
        unit.roleState?.role || "forager",
        tick,
        "NO_PATH",
        `${goblin.identity.name} is blocked from reaching ${goal.kind}.`
      );
    }
    const threatResponse = goblin.modData?.threatResponse || null;
    const blockedByPath = next.x === prevX
      && next.y === prevY
      && dist({ x: unit.microX, y: unit.microY }, { x: goal.targetMicroX, y: goal.targetMicroY }) > 1.1;
    if (threatResponse) {
      if (isThreatGoalKind(goal.kind) && blockedByPath) {
        threatResponse.noPathThreatTicks = (threatResponse.noPathThreatTicks || 0) + 1;
        if (threatResponse.noPathThreatTicks >= THREAT_DEADLOCK_NO_PATH_TICKS) {
          threatResponse.noPathThreatTicks = 0;
          threatResponse.mode = "none";
          threatResponse.activeThreatId = null;
          threatResponse.targetMicroX = unit.homeMicroX;
          threatResponse.targetMicroY = unit.homeMicroY;
          threatResponse.threatScore = 0;
          threatResponse.suppressedUntilTick = tick + THREAT_DEADLOCK_SUPPRESS_TICKS;
          threatResponse.lastDeadlockBreakTick = tick;
          events.push({
            type: "THREAT_RESPONSE_STANDDOWN",
            goblinId,
            untilTick: threatResponse.suppressedUntilTick,
            tileX: unit.tileX,
            tileY: unit.tileY,
            text: `${goblin.identity.name} disengaged from an unreachable threat.`
          });
        }
      } else if (!isThreatGoalKind(goal.kind)) {
        threatResponse.noPathThreatTicks = 0;
      }
    }

    const site = nearSiteByTile(wm, unit.tileX, unit.tileY);
    const regionId = wm.regionGrid[unit.tileY][unit.tileX];
    goblin.assignment.locationId = site ? site.id : regionId;
    if (unit.roleState?.role === "scout" || unit.roleState?.role === "colony-establisher") {
      maybeScoutReports(state, goblin, unit, tick, events, regionId, site?.id);
    } else {
      const intel = wm.intel?.knownRegions?.[regionId];
      if (intel) {
        intel.confidence = clamp(Math.max(intel.confidence || 0, 0.3), 0, 1);
        intel.lastUpdatedTick = tick;
      }
    }

    if (prevX !== unit.microX || prevY !== unit.microY) {
      if (tick % 10 === 0) {
        events.push({
          type: "GOBLIN_WANDERED",
          goblinId,
          regionId,
          text: `${goblin.identity.name} moved (${goal.kind}) through ${wm.regionsById[regionId].biome}.`
        });
      }
    }

    const goalEvent = maybeExecuteGoal(state, goblin, unit, goal, tick);
    if (Array.isArray(goalEvent)) events.push(...goalEvent);
    else if (goalEvent) events.push(goalEvent);

    const social = maybeEmitInteraction(state, unit, tick);
    if (social) events.push(social);
  }

  syncGoblinOccupancyByMicroKey(wm, occupiedNext);

  maybeCompleteWallPlan(state, tick, events);
  runReproductionSystem(state, tick, events);
  initUnitState(state);

  return events;
}
