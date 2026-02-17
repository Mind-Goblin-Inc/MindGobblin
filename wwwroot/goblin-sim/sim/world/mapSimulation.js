import { applyScoutUpdate, decayIntel } from "./intel.js";
import { TILES_PER_CHUNK, tileKey, tileToChunkCoord, regionToMicroCenter } from "./scale.js";

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
const WALL_PLAN_MAX_RADIUS = 12;
const WALL_RESERVATION_TICKS = 18;
const ROLE_TASK_BLOCKED_COOLDOWN = 12;
const DEFAULT_ROLES = ["forager", "woodcutter", "builder", "lookout"];
const THREAT_MEMORY_DECAY_TICKS = 160;
const LOOKOUT_DETECTION_RADIUS = 11;
const THREAT_DIRECT_RADIUS = 4.5;
const THREAT_LOCAL_RADIUS = 9;
const THREAT_RESPONSE_MEMORY_TICKS = 14;
const THREAT_MODE_EVENT_COOLDOWN = 6;
const DEFENDER_MIN_VITALITY = 58;
const DEFENDER_MIN_MORALE = 42;
const DEFENDER_MAX_STRESS = 72;

function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
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

function isHostileWildlifeKind(kind) {
  return kind === "wolf" || kind === "barbarian";
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

function buildTexturedPerimeterOffsets(wm, siteId, radius) {
  const sampleCount = Math.max(56, radius * 28);
  const noisyPoints = [];
  const jitter = 0.85;

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleCount;
    const angle = t * Math.PI * 2;
    const n = rand01("wall-texture", wm.seed, siteId || "none", radius, i);
    const noisyRadius = Math.max(1.5, radius + (n - 0.5) * jitter * 2);
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

function buildWallPlanForRadius(wm, tick, radius) {
  const startSite = wm.player.startingSiteId ? wm.sitesById[wm.player.startingSiteId] : null;
  if (!startSite) return null;

  const centerTileX = startSite.x;
  const centerTileY = startSite.y;
  const centerMicroX = regionToMicroCenter(centerTileX);
  const centerMicroY = regionToMicroCenter(centerTileY);
  const offsets = buildTexturedPerimeterOffsets(wm, wm.player.startingSiteId, radius);
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
    planId: `wallplan-${wm.player.startingSiteId}-${tick}-${radius}`,
    homeSiteId: wm.player.startingSiteId,
    centerTileX: startSite.x,
    centerTileY: startSite.y,
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
  const continuity = enforceWallContinuity(plan, wm, centerMicroX, centerMicroY);
  plan.continuityGaps = continuity.gaps;
  pruneWallCaps(plan);
  const blockedAfterPrune = plan.orderedTileKeys.reduce((count, key) => count + (plan.tileStatusByKey[key] === "blocked" ? 1 : 0), 0);
  plan.blockedRatio = plan.orderedTileKeys.length ? blockedAfterPrune / plan.orderedTileKeys.length : 1;
  return plan;
}

function createWallPlan(wm, tick) {
  let attemptRadius = WALL_PLAN_BASE_RADIUS;
  while (attemptRadius <= WALL_PLAN_MAX_RADIUS) {
    const plan = buildWallPlanForRadius(wm, tick, attemptRadius);
    if (!plan) return null;
    if (plan.continuityGaps === 0 && plan.blockedRatio <= 0.35) return plan;
    attemptRadius += 1;
  }
  return buildWallPlanForRadius(wm, tick, WALL_PLAN_MAX_RADIUS);
}

function assignWallPlanIfNeeded(state, tick, events) {
  const wm = state.worldMap;
  const structures = wm.structures;
  const existing = structures.wallPlan;
  const siteId = wm.player.startingSiteId;
  const shouldRebuild = !existing || existing.homeSiteId !== siteId;
  if (!shouldRebuild) return existing;

  const nextPlan = createWallPlan(wm, tick);
  structures.wallPlan = nextPlan;
  if (nextPlan) {
    events.push({
      type: "WALL_PLAN_CREATED",
      siteId,
      planId: nextPlan.planId,
      text: `Wall plan created around ${wm.sitesById[siteId]?.name || "home site"} (radius ${nextPlan.desiredRadius}).`
    });
  }
  return nextPlan;
}

function refreshWallPlan(state, tick, events) {
  const wm = state.worldMap;
  const structures = wm.structures;
  const plan = assignWallPlanIfNeeded(state, tick, events);
  if (!plan) return null;

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
    structures.wallPlan = createWallPlan(wm, tick);
    if (structures.wallPlan) {
      events.push({
        type: "WALL_PLAN_REPLANNED",
        siteId: wm.player.startingSiteId,
        planId: structures.wallPlan.planId,
        text: "Wall plan was replanned due to blocked gate access."
      });
    }
  }
  return structures.wallPlan;
}

function maybeCompleteWallPlan(state, tick, events) {
  const plan = state.worldMap?.structures?.wallPlan;
  if (!plan || plan.completedAtTick !== null) return;

  const remaining = plan.orderedTileKeys.some((key) => plan.tileStatusByKey[key] === "planned");
  if (remaining) return;
  plan.completedAtTick = tick;
  events.push({
    type: "WALL_PLAN_COMPLETED",
    siteId: plan.homeSiteId,
    planId: plan.planId,
    text: "Settlement wall plan completed."
  });
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
  const plan = wm.structures?.wallPlan;
  if (!plan) return;
  const mem = ensureThreatMemory(wm);
  for (const key of plan.orderedTileKeys) {
    const status = plan.tileStatusByKey[key];
    if (status !== "built") continue;
    if (wm.structures.wallsByTileKey[key]) continue;
    plan.tileStatusByKey[key] = "planned";
    plan.breachedByKey = plan.breachedByKey || {};
    plan.breachedByKey[key] = tick;
    const { microX, microY } = parseMicroKey(key);
    mem.recentBreaches.push({ key, microX, microY, tick });
    events.push({
      type: "WALL_BREACHED",
      microX,
      microY,
      tileX: tileToChunkCoord(microX),
      tileY: tileToChunkCoord(microY),
      text: "A wall segment was breached and marked for rebuild."
    });
  }
}

function assignHomeTile(worldMap, index) {
  const start = worldMap.player.startingSiteId ? worldMap.sitesById[worldMap.player.startingSiteId] : null;
  if (!start) return { x: 0, y: 0 };
  const offset = HOME_RING[index % HOME_RING.length];
  return {
    x: clamp(start.x + offset.x, 0, worldMap.width - 1),
    y: clamp(start.y + offset.y, 0, worldMap.height - 1)
  };
}

function initUnitState(state) {
  const wm = state.worldMap;
  if (!wm?.player?.startingSiteId) return;

  let idx = 0;
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
        lastInteractionTick: 0,
        lastGoal: "idle",
        roleState: {
          role,
          rolePriority: 1,
          roleCooldownUntilTick: 0,
          roleTask: undefined,
          carried: null,
          lastBlockedReason: null,
          lastBlockedTick: 0
        }
      };
    }

    const unit = wm.units.byGoblinId[goblinId];
    ensureRoleState(goblin, unit, idx);
    goblin.assignment.locationId = wm.regionGrid[unit.tileY][unit.tileX];
    goblin.modData = goblin.modData || {};
    goblin.modData.home = { tileX: unit.homeTileX, tileY: unit.homeTileY, siteId: unit.homeSiteId };
  }
}

function buildOccupancyMap(wm) {
  const map = new Map();
  for (const unit of Object.values(wm.units.byGoblinId)) {
    map.set(tileKey(unit.microX, unit.microY), unit.goblinId);
  }
  return map;
}

function getResourceNodeList(wm) {
  if (!wm.__resourceNodeList) wm.__resourceNodeList = Object.values(wm.resourceNodes.byTileKey || {});
  return wm.__resourceNodeList;
}

function getWaterSourceList(wm) {
  if (!wm.__waterSourceList) wm.__waterSourceList = Object.values(wm.waterSources.byTileKey || {});
  return wm.__waterSourceList;
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

function findClosestWaterSource(wm, from) {
  let best = null;
  let bestDist = Infinity;
  for (const source of getWaterSourceList(wm)) {
    const d = dist(from, { x: source.microX, y: source.microY });
    if (d < bestDist) {
      bestDist = d;
      best = source;
    }
  }
  return best;
}

function normalizeRole(role) {
  if (role === "woodcutter") return "woodcutter";
  if (role === "builder") return "builder";
  if (role === "lookout") return "lookout";
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
  if (!Object.prototype.hasOwnProperty.call(unit.roleState, "carried")) unit.roleState.carried = null;
  return role;
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
    blockedReason: blockedReason || undefined
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
    text: `${goblin.identity.name} (${role}) claimed ${task.kind}.`
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

function canGoblinDefend(goblin, localHostileCount) {
  const vitality = goblin.body?.health?.vitality ?? 100;
  const morale = goblin.psyche?.morale ?? 50;
  const stress = goblin.psyche?.stress ?? 0;
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

function threatScoreForDistance(distance, localHostiles) {
  const distanceFactor = Math.max(0, THREAT_LOCAL_RADIUS - distance) / THREAT_LOCAL_RADIUS;
  const clusterFactor = Math.max(0, localHostiles - 1) * 0.18;
  return clamp((distanceFactor + clusterFactor) * 100, 0, 100);
}

function updateGoblinThreatResponses(state, tick, events) {
  const byGoblinId = {};
  const hostiles = hostileWildlifeList(state);
  const defensePoint = defensePointForMap(state);
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

    const nearest = nearestHostileToUnit(unit, hostiles);
    const localHostiles = nearest
      ? countHostilesNearPoint(hostiles, unit.microX, unit.microY, THREAT_LOCAL_RADIUS)
      : 0;
    const prevMode = threatResponse.mode || "none";
    let mode = "none";
    let activeThreatId = null;
    let targetMicroX = defensePoint.x;
    let targetMicroY = defensePoint.y;
    let threatScore = 0;

    if (nearest && nearest.distance <= THREAT_LOCAL_RADIUS) {
      activeThreatId = nearest.hostile.id;
      threatScore = threatScoreForDistance(nearest.distance, localHostiles);
      threatResponse.lastThreatTick = tick;
      if (nearest.distance <= THREAT_DIRECT_RADIUS) {
        mode = canGoblinDefend(goblin, localHostiles) ? "defend" : "flee";
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
  const plan = state.worldMap?.structures?.wallPlan;
  if (!plan || plan.completedAtTick !== null) return false;
  return (state.tribe.resources.wood || 0) > 0;
}

function chooseWallTile(state, goblinId, tick, preferredTarget = null) {
  const plan = state.worldMap?.structures?.wallPlan;
  if (!plan) return null;
  const mem = ensureThreatMemory(state.worldMap);

  for (const key of plan.orderedTileKeys) {
    if (plan.assignedGoblinByKey[key] !== goblinId) continue;
    if (plan.assignedUntilTickByKey[key] < tick) {
      plan.assignedGoblinByKey[key] = null;
      plan.assignedUntilTickByKey[key] = 0;
      continue;
    }
    if (plan.tileStatusByKey[key] !== "planned") continue;
    const { microX, microY } = parseMicroKey(key);
    return { microX, microY, key };
  }

  let candidates = plan.orderedTileKeys.filter((key) => {
    if (plan.tileStatusByKey[key] !== "planned") return false;
    const assignee = plan.assignedGoblinByKey[key];
    const untilTick = plan.assignedUntilTickByKey[key] || 0;
    if (assignee && untilTick >= tick && assignee !== goblinId) return false;
    return true;
  });

  if (!candidates.length) return null;

  const breachSet = new Set((mem.recentBreaches || []).map((b) => b.key));
  const breachCandidates = candidates.filter((key) => breachSet.has(key));
  if (breachCandidates.length) candidates = breachCandidates;

  if (preferredTarget) {
    candidates = [...candidates].sort((aKey, bKey) => {
      const a = parseMicroKey(aKey);
      const b = parseMicroKey(bKey);
      const da = dist({ x: a.microX, y: a.microY }, preferredTarget);
      const db = dist({ x: b.microX, y: b.microY }, preferredTarget);
      return da - db;
    });
  }

  for (const key of candidates) {
    plan.assignedGoblinByKey[key] = goblinId;
    plan.assignedUntilTickByKey[key] = tick + WALL_RESERVATION_TICKS;
    const { microX, microY } = parseMicroKey(key);
    return { microX, microY, key };
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

function chooseGoal(state, goblin, unit, tick, events, indexHint, threatByGoblinId) {
  const wm = state.worldMap;
  const origin = { x: unit.microX, y: unit.microY };
  const role = ensureRoleState(goblin, unit, indexHint);
  const carried = unit.roleState.carried;
  const threatGoal = threatGoalForGoblin(state, goblin, unit, role, tick, events, threatByGoblinId?.[goblin.id]);
  if (threatGoal) return threatGoal;

  if (goblin.needs.thirst >= 85) {
    const source = findClosestWaterSource(wm, origin);
    if (source) {
      const task = {
        kind: "drink",
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
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} could not find water to drink.`);
    setRoleTask(unit, role, idleTask, tick, "NO_NODE_READY");
    return idleTask;
  }

  if (carried?.amount > 0) {
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

  if (role === "builder") {
    if (!shouldBuildWall(state)) {
      const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
      maybeEmitTaskBlocked(events, goblin, unit, role, tick, "STORAGE_UNAVAILABLE", `${goblin.identity.name} (${role}) has no wood available for wall work.`);
      setRoleTask(unit, role, idleTask, tick, "STORAGE_UNAVAILABLE");
      return idleTask;
    }
    const threat = nearestThreatForUnit(state, unit);
    const preferredTarget = threat ? { x: threat.microX, y: threat.microY } : { x: unit.homeMicroX, y: unit.homeMicroY };
    const wallTarget = chooseWallTile(state, goblin.id, tick, preferredTarget);
    if (wallTarget) {
      const task = {
        kind: "build-wall",
        targetMicroX: wallTarget.microX,
        targetMicroY: wallTarget.microY,
        targetTileX: tileToChunkCoord(wallTarget.microX),
        targetTileY: tileToChunkCoord(wallTarget.microY),
        wallKey: wallTarget.key
      };
      maybeEmitTaskClaimed(events, goblin, unit, role, task);
      setRoleTask(unit, role, task, tick);
      return task;
    }
    const idleTask = buildIdleTask(unit, wm, tick, goblin.id);
    maybeEmitTaskBlocked(events, goblin, unit, role, tick, "NO_NODE_READY", `${goblin.identity.name} (${role}) found no valid wall segment to build.`);
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

  if (role === "forager") {
    const foodNode = findClosestReadyNode(wm, origin, "mushroom", tick);
    if (foodNode) {
      const task = {
        kind: "gather-food",
        targetMicroX: foodNode.microX,
        targetMicroY: foodNode.microY,
        targetTileX: foodNode.tileX,
        targetTileY: foodNode.tileY
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

  if (role === "woodcutter") {
    const treeNode = findClosestReadyNode(wm, origin, "tree", tick);
    if (treeNode) {
      const task = {
        kind: "cut-tree",
        targetMicroX: treeNode.microX,
        targetMicroY: treeNode.microY,
        targetTileX: treeNode.tileX,
        targetTileY: treeNode.tileY
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

    const tileNX = clamp(Math.floor(nx / TILES_PER_CHUNK), 0, wm.width - 1);
    const tileNY = clamp(Math.floor(ny / TILES_PER_CHUNK), 0, wm.height - 1);
    const region = wm.regionsById[wm.regionGrid[tileNY][tileNX]];
    const hazardPenalty = region.hazardPressure * 0.55;

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

  return { x: best.x, y: best.y };
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

function maybeExecuteGoal(state, goblin, unit, goal, tick) {
  const key = tileKey(unit.microX, unit.microY);

  if (goal.kind === "drink") {
    if (state.worldMap.waterSources.byTileKey[key]) {
      goblin.needs.thirst = Math.max(0, goblin.needs.thirst - 22);
      return {
        type: "GOBLIN_DRANK_WATER",
        goblinId: goblin.id,
        text: `${goblin.identity.name} drank fresh water.`
      };
    }
    return null;
  }

  if (goal.kind === "gather-food") {
    if (unit.roleState?.carried?.amount > 0) {
      return {
        type: "ROLE_TASK_BLOCKED",
        goblinId: goblin.id,
        role: unit.roleState?.role || "forager",
        reasonCode: "CARRY_FULL",
        text: `${goblin.identity.name} cannot gather while already carrying supplies.`
      };
    }
    const node = state.worldMap.resourceNodes.byTileKey[key];
    if (!node || node.type !== "mushroom" || node.readyAtTick > tick) return null;
    const gain = 1 + Math.floor(rand01("mushYield", tick, goblin.id) * 3);
    unit.roleState.carried = { resource: "mushrooms", amount: gain };
    goblin.needs.hunger = Math.max(0, goblin.needs.hunger - 10);
    node.readyAtTick = tick + node.regrowTicks;
    return {
      type: "GOBLIN_GATHERED_MUSHROOMS",
      goblinId: goblin.id,
      regionId: node.regionId,
      mushroomsGained: gain,
      text: `${goblin.identity.name} foraged mushrooms (+${gain}) and is carrying them home.`
    };
  }

  if (goal.kind === "cut-tree") {
    if (unit.roleState?.carried?.amount > 0) {
      return {
        type: "ROLE_TASK_BLOCKED",
        goblinId: goblin.id,
        role: unit.roleState?.role || "woodcutter",
        reasonCode: "CARRY_FULL",
        text: `${goblin.identity.name} cannot cut trees while already carrying supplies.`
      };
    }
    const node = state.worldMap.resourceNodes.byTileKey[key];
    if (!node || node.type !== "tree" || node.readyAtTick > tick) return null;
    const gain = 1 + Math.floor(rand01("treeYield", tick, goblin.id) * 2);
    unit.roleState.carried = { resource: "wood", amount: gain };
    node.readyAtTick = tick + node.regrowTicks;
    return {
      type: "GOBLIN_CUT_TREE",
      goblinId: goblin.id,
      regionId: node.regionId,
      woodGained: gain,
      text: `${goblin.identity.name} chopped timber (+${gain} wood) and is carrying it home.`
    };
  }

  if (goal.kind === "deliver-home") {
    const carried = unit.roleState?.carried;
    if (!carried || carried.amount <= 0) return null;
    if (unit.microX !== unit.homeMicroX || unit.microY !== unit.homeMicroY) return null;
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
    const delivered = Math.min(room, carried.amount);
    state.tribe.resources[resourceKey] = current + delivered;
    carried.amount -= delivered;
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

  if (goal.kind === "build-wall") {
    if ((state.tribe.resources.wood || 0) <= 0) return null;
    const wallKey = tileKey(unit.microX, unit.microY);
    if (state.worldMap.structures.wallsByTileKey[wallKey]) return null;
    const plan = state.worldMap.structures.wallPlan;
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
        wallKey,
        tileX: tileToChunkCoord(unit.microX),
        tileY: tileToChunkCoord(unit.microY),
        text: `${goblin.identity.name} repaired a breached wall segment (-1 wood).`
      };
    }

    return {
      type: "GOBLIN_BUILT_WALL",
      goblinId: goblin.id,
      wallKey,
      text: `${goblin.identity.name} built a wall near home (-1 wood).`
    };
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

export function worldMapSimulationSystem(state) {
  const events = [];
  if (!state.worldMap) return events;
  initUnitState(state);

  const wm = state.worldMap;
  const tick = state.meta.tick;
  decayIntel(wm, tick);
  refreshWallPlan(state, tick, events);
  ensureThreatMemory(wm);
  updateThreatMemoryFromWildlife(state, tick);
  syncWallPlanBreaches(state, tick, events);
  decayThreatMemory(state, tick);

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

    const site = nearSiteByTile(wm, unit.tileX, unit.tileY);
    const regionId = wm.regionGrid[unit.tileY][unit.tileX];
    goblin.assignment.locationId = site ? site.id : regionId;

    applyScoutUpdate(wm, regionId, site?.id, tick);

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
    if (goalEvent) events.push(goalEvent);

    const social = maybeEmitInteraction(state, unit, tick);
    if (social) events.push(social);
  }

  maybeCompleteWallPlan(state, tick, events);

  return events;
}
