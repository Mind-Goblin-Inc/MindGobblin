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
const WALL_PLAN_MAX_RADIUS = 12;
const WALL_RESERVATION_TICKS = 18;
const ROLE_TASK_BLOCKED_COOLDOWN = 12;
const DEFAULT_ROLES = ["forager", "woodcutter", "fisherman", "hunter", "builder", "sentinel", "lookout", "hauler", "water-runner", "caretaker", "quartermaster", "scout", "colony-establisher"];
const THREAT_MEMORY_DECAY_TICKS = 160;
const LOOKOUT_DETECTION_RADIUS = 11;
const SCOUT_THREAT_DETECTION_RADIUS = 9;
const SCOUT_REPORT_COOLDOWN = 14;
const THREAT_DIRECT_RADIUS = 4.5;
const THREAT_LOCAL_RADIUS = 9;
const THREAT_RESPONSE_MEMORY_TICKS = 14;
const THREAT_MODE_EVENT_COOLDOWN = 6;
const DEFENDER_MIN_VITALITY = 58;
const DEFENDER_MIN_MORALE = 42;
const DEFENDER_MAX_STRESS = 72;
const DEFEND_ATTACK_RANGE = 1.6;
const DEFEND_ATTACK_COOLDOWN_TICKS = 2;

function threatTuning(state) {
  const t = state.meta?.tuning?.threat || {};
  return {
    localRadius: Number.isFinite(t.localRadius) ? t.localRadius : THREAT_LOCAL_RADIUS,
    directRadius: Number.isFinite(t.directRadius) ? t.directRadius : THREAT_DIRECT_RADIUS
  };
}
const HYDRATION_REEVALUATE_TICKS = 3;
const ROLE_KEYS = ["forager", "woodcutter", "fisherman", "hunter", "builder", "sentinel", "lookout", "hauler", "water-runner", "caretaker", "quartermaster", "scout", "colony-establisher"];
const REPRO_IDLE_ROLES = new Set(["builder", "forager", "woodcutter", "fisherman", "hunter", "sentinel", "lookout", "scout", "hauler", "water-runner", "quartermaster", "caretaker", "colony-establisher"]);
const COLONY_ESTABLISH_COOLDOWN_TICKS = 28;
const REPRO_DAY_TICKS = 144;

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

function isWaterMicroTile(wm, microX, microY) {
  const tileX = clamp(tileToChunkCoord(microX), 0, wm.width - 1);
  const tileY = clamp(tileToChunkCoord(microY), 0, wm.height - 1);
  return Boolean(wm.waterTiles?.byTileKey?.[`${tileX},${tileY}`]);
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

function hasNearbyWaterSource(wm, microX, microY, maxDist = 1.5) {
  for (const source of getWaterSourceList(wm)) {
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
  if (role === "fisherman") return "fisherman";
  if (role === "hunter") return "hunter";
  if (role === "builder") return "builder";
  if (role === "sentinel") return "sentinel";
  if (role === "lookout") return "lookout";
  if (role === "hauler") return "hauler";
  if (role === "water-runner") return "water-runner";
  if (role === "caretaker") return "caretaker";
  if (role === "quartermaster") return "quartermaster";
  if (role === "scout") return "scout";
  if (role === "colony-establisher") return "colony-establisher";
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
    const seekThreshold = Math.round(68 + rand01("hyd-seek", ...keyParts) * 12); // 68..80
    const highThreshold = Math.round(80 + rand01("hyd-high", ...keyParts) * 9); // 80..89
    const criticalThreshold = Math.round(90 + rand01("hyd-critical", ...keyParts) * 7); // 90..97
    const satedThreshold = Math.round(2 + rand01("hyd-sated", ...keyParts) * 14); // 2..16
    const drinkPerTick = Math.round(28 + rand01("hyd-drink", ...keyParts) * 14); // 28..42
    const thirstDecayMul = Number((0.16 + rand01("hyd-decay", ...keyParts) * 0.12).toFixed(3)); // 0.16..0.28
    const waterNeedMul = Number((0.18 + rand01("hyd-water-need", ...keyParts) * 0.16).toFixed(3)); // 0.18..0.34
    const thirstStartOffset = Math.round((rand01("hyd-start", ...keyParts) - 0.5) * 18); // -9..+9

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

function ensureReproductionState(state) {
  const structures = state.worldMap.structures = state.worldMap.structures || {};
  if (!structures.reproduction) {
    structures.reproduction = {
      enabled: true,
      cooldownTicks: 120,
      pairDurationTicks: 10,
      minIdleTicks: 12,
      maxBirthsPerDay: 2,
      maxPairDistance: 6,
      safePredatorRadius: 10,
      minWallProtectionScore: 0.45,
      minWallsForSafety: 10,
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

function reproductionIdleForUnit(unit) {
  const taskKind = unit.roleState?.roleTask?.kind || "idle";
  return taskKind === "idle" || unit.lastGoal === "idle";
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
    const isIdle = reproductionIdleForUnit(unit) && REPRO_IDLE_ROLES.has(role);
    if (isIdle) {
      if (!Number.isFinite(rep.idleSinceTick)) rep.idleSinceTick = tick;
    } else {
      rep.idleSinceTick = tick;
    }

    if (!safety.safe) continue;
    if (!isIdle) continue;
    if (unit.roleState?.carried?.amount > 0) continue;
    if (isCriticalNeedForReproduction(goblin)) continue;
    if ((tick - (rep.idleSinceTick || tick)) < repro.minIdleTicks) continue;
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

    const childId = nextId(state, "goblin");
    const siteId = state.worldMap?.player?.startingSiteId || goblinA.identity?.originSiteId || goblinB.identity?.originSiteId || null;
    const rng = initRng(`${state.meta.seed}|birth|${tick}|${aId}|${bId}|${childId}`);
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
    cancelReproductionPair(repro, aId, bId);

    events.push({
      type: "GOBLIN_BORN",
      newGoblinId: childId,
      parentAId: aId,
      parentBId: bId,
      siteId,
      text: `${goblinA.identity.name} and ${goblinB.identity.name} welcomed ${child.identity.name}.`
    });
  }
}

function runReproductionSystem(state, tick, events) {
  const repro = ensureReproductionState(state);
  refreshReproductionDayCounters(repro, tick);
  if (!repro.enabled) return;
  const safety = reproductionSafety(state, repro);
  const eligible = reproductionEligibility(state, tick, safety);
  if (safety.safe && (tick - (repro.lastBirthTick || -1000)) >= repro.cooldownTicks && repro.birthsThisDay < repro.maxBirthsPerDay) {
    selectReproductionPairs(state, tick, eligible, safety, events);
  }
  resolveReproductionPairs(state, tick, safety, events);
  repro.lastSnapshot = {
    eligibleCount: eligible.length,
    activePairs: Math.floor(Object.keys(repro.pairByGoblinId).length / 2),
    birthsThisDay: repro.birthsThisDay,
    safetyReason: safety.reason
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
    for (const resource of ["wood", "mushrooms"]) {
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
  let best = null;
  let bestDist = Infinity;
  for (const taskId of log.queueIds) {
    const task = log.tasksById[taskId];
    if (!task || task.status !== "queued" || task.amountRemaining <= 0) continue;
    if (task.claimedByGoblinId && (task.claimedUntilTick || 0) >= tick && task.claimedByGoblinId !== goblinId) continue;
    const d = dist({ x: fromUnit.microX, y: fromUnit.microY }, { x: task.sourceMicroX, y: task.sourceMicroY });
    if (d < bestDist) {
      bestDist = d;
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
  if (nearestHostileKind === "barbarian") {
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

    if (nearest && nearest.distance <= tuning.localRadius) {
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
  const foodPressure = clamp((avgNeed.hunger - 35) / 55 + Math.max(0, 24 - foodStock) / 24, 0, 1.8);
  const waterPressure = clamp((avgNeed.thirst - 35) / 55 + Math.max(0, 24 - waterStock) / 24, 0, 1.8);
  const wallPlan = state.worldMap?.structures?.wallPlan;
  const plannedWalls = wallPlan?.orderedTileKeys?.reduce((n, key) => n + (wallPlan.tileStatusByKey[key] === "planned" ? 1 : 0), 0) || 0;
  const wallPressure = clamp(plannedWalls / 25, 0, 1.5);
  const threatPressure = clamp((state.tribe?.threat?.alertLevel || 0) / 100 + (state.worldMap?.structures?.threatMemory?.allIds?.length || 0) / 8, 0, 2);
  const lowIntelRegions = Object.values(state.worldMap?.intel?.knownRegions || {}).filter((r) => (r?.confidence || 0) < 0.65).length;
  const totalRegions = Object.keys(state.worldMap?.regionsById || {}).length || 1;
  const intelPressure = clamp(lowIntelRegions / totalRegions, 0, 1);
  const woodPressure = clamp(Math.max(0, 16 - woodStock) / 16 + wallPressure * 0.5, 0, 1.6);
  const haulQueue = state.worldMap?.structures?.logistics?.queueIds?.length || 0;
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

  return {
    foodPressure,
    waterPressure,
    woodPressure,
    wallPressure,
    threatPressure,
    intelPressure,
    haulerPressure,
    caretakerPressure,
    colonyPressure
  };
}

function computeDesiredRoleCounts(state, policy) {
  const n = state.goblins.allIds.length;
  const desired = Object.fromEntries(ROLE_KEYS.map((r) => [r, 0]));
  if (n <= 0) return desired;
  const d = computeRoleDemand(state);
  const scores = {
    forager: 1.2 + d.foodPressure * 1.25 + d.waterPressure * 0.55,
    woodcutter: 0.95 + d.woodPressure * 1.2,
    fisherman: 0.85 + d.foodPressure * 1.15 + d.waterPressure * 0.35,
    hunter: 0.55 + d.foodPressure * 0.75 + d.threatPressure * 0.8,
    builder: 0.75 + d.wallPressure * 1.0 + d.threatPressure * 0.9,
    sentinel: 0.55 + d.threatPressure * 1.15 + d.wallPressure * 0.35,
    lookout: 0.75 + d.threatPressure * 1.35,
    hauler: 0.65 + d.haulerPressure * 1.45 + d.wallPressure * 0.25,
    "water-runner": 0.7 + d.waterPressure * 1.6 + d.threatPressure * 0.2,
    caretaker: 0.55 + d.caretakerPressure * 1.6 + d.threatPressure * 0.2,
    quartermaster: 0.2 + d.threatPressure * 0.45 + d.waterPressure * 0.2,
    scout: 0.65 + d.intelPressure * 1.3 - d.threatPressure * 0.4,
    "colony-establisher": 0.15 + d.colonyPressure * 1.1 + d.intelPressure * 0.35 - d.threatPressure * 0.35
  };
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
  const wallPlan = state.worldMap?.structures?.wallPlan;
  const plannedWalls = wallPlan?.orderedTileKeys?.reduce((sum, key) => sum + (wallPlan.tileStatusByKey[key] === "planned" ? 1 : 0), 0) || 0;
  const wallIncomplete = Boolean(wallPlan && wallPlan.completedAtTick === null && plannedWalls > 0);
  if (wallIncomplete) {
    const builderTarget = clamp(Math.ceil(plannedWalls / 8), 2, Math.max(2, Math.floor(n * 0.55)));
    desired.builder = Math.max(desired.builder, builderTarget);
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

  const resources = state.tribe?.resources || {};
  const foodStock = resources.food || 0;
  const waterStock = resources.water || 0;
  const woodStock = resources.wood || 0;
  const mushroomStock = resources.mushrooms || 0;

  const foodShortage = foodStock <= 16;
  const waterShortage = waterStock <= 18;
  const woodShortage = woodStock <= 10;
  const mushroomShortage = mushroomStock <= 4;

  if (foodShortage) {
    enforceFloor("forager", clamp(Math.ceil(n * 0.34), 2, Math.max(2, n - 1)));
    enforceFloor("fisherman", 1);
    enforceFloor("hunter", 1);
    enforceFloor("hauler", 1);
  }
  if (waterShortage) {
    enforceFloor("water-runner", clamp(Math.ceil(n * 0.3), 2, Math.max(2, n - 1)));
    enforceFloor("fisherman", 1);
    enforceFloor("hauler", 1);
  }
  if (woodShortage) {
    enforceFloor("woodcutter", clamp(Math.ceil(n * 0.32), 2, Math.max(2, n - 1)));
    enforceFloor("hauler", 1);
  }
  if (mushroomShortage) {
    enforceFloor("forager", Math.max(floorByRole.forager || 0, 2));
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
  if (role === "sentinel") return (stats.grit || 0) * 0.8 + (stats.brawn || 0) * 0.7 + (stats.will || 0) * 0.45 + (apt.intimidation || 0) * 0.25;
  if (role === "lookout") return (apt.scouting || 0) * 1.0 + (stats.perception || 0) * 0.9 + (apt.stealth || 0) * 0.45 + (stats.agility || 0) * 0.3;
  if (role === "hauler") return (stats.brawn || 0) * 0.65 + (stats.grit || 0) * 0.55 + (stats.agility || 0) * 0.45 + (apt.scavenging || 0) * 0.4;
  if (role === "water-runner") return (stats.grit || 0) * 0.7 + (stats.agility || 0) * 0.6 + (stats.will || 0) * 0.4 + (apt.scouting || 0) * 0.3;
  if (role === "caretaker") return (apt.medicine || 0) * 1.1 + (stats.social || 0) * 0.75 + (stats.will || 0) * 0.55 + (apt.cooking || 0) * 0.25;
  if (role === "quartermaster") return (stats.cunning || 0) * 0.85 + (stats.social || 0) * 0.85 + (apt.bargaining || 0) * 0.5 + (apt.lorekeeping || 0) * 0.3;
  if (role === "scout") return (apt.scouting || 0) * 1.15 + (apt.stealth || 0) * 0.7 + (stats.perception || 0) * 0.8 + (stats.will || 0) * 0.2;
  if (role === "colony-establisher") return (apt.scouting || 0) * 0.95 + (stats.will || 0) * 0.75 + (stats.cunning || 0) * 0.55 + (stats.grit || 0) * 0.45;
  return 0;
}

function isRoleAssignmentLocked(policy, unit, tick) {
  if (!unit?.roleState) return false;
  if (tick < (unit.roleState.roleCooldownUntilTick || 0)) return true;
  if (tick - (unit.roleState.roleAssignedTick || 0) < policy.minRoleHoldTicks) return true;
  if (policy.mode !== "auto-balance" && unit.roleState.manualLock) return true;
  return false;
}

function reassignRole(state, goblinId, fromRole, toRole, tick, policy, events, reason) {
  const goblin = state.goblins.byId[goblinId];
  const unit = state.worldMap?.units?.byGoblinId?.[goblinId];
  if (!goblin || !unit) return false;
  goblin.social = goblin.social || {};
  goblin.social.role = toRole;
  unit.roleState.role = toRole;
  unit.roleState.roleTask = undefined;
  unit.roleState.roleAssignedTick = tick;
  unit.roleState.roleCooldownUntilTick = tick + policy.reassignmentCooldownTicks;
  events.push({
    type: "ROLE_REASSIGNED",
    goblinId,
    role: toRole,
    previousRole: fromRole,
    reasonCode: reason,
    mode: policy.mode,
    text: `${goblin.identity.name} reassigned ${fromRole} -> ${toRole} (${reason}).`
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
  const hysteresis = Math.max(0, Math.round(policy.hysteresis || 1));
  const deficits = ROLE_KEYS.filter((role) => (desired[role] - current[role]) > hysteresis);
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
      if (reassignRole(state, pick.goblinId, pick.fromRole, targetRole, tick, policy, events, "ROLE_DEFICIT")) {
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

  const currentTask = unit.roleState?.roleTask;
  const shouldContinueDrink = currentTask?.kind === "drink" && goblin.needs.thirst > hydration.satedThreshold;
  const shouldSeekDrinkNow = hydrationPriority === "critical"
    || hydrationPriority === "high"
    || (hydrationPriority === "moderate" && !carried?.amount);

  if (shouldContinueDrink || shouldSeekDrinkNow) {
    const hasRecentHydrationTask = tick - (unit.roleState.lastHydrationTaskTick || -1000) < HYDRATION_REEVALUATE_TICKS;
    const source = (shouldContinueDrink && currentTask && hasRecentHydrationTask)
      ? {
          microX: currentTask.targetMicroX,
          microY: currentTask.targetMicroY,
          tileX: tileToChunkCoord(currentTask.targetMicroX),
          tileY: tileToChunkCoord(currentTask.targetMicroY)
        }
      : findClosestWaterSource(wm, origin);
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
    const source = findClosestWaterSource(wm, origin);
    if (source) {
      const task = {
        kind: "collect-water",
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
    const patrolTask = lookoutPatrolPoint(unit, tick, goblin.id, wm);
    patrolTask.kind = "quartermaster-patrol";
    maybeEmitTaskClaimed(events, goblin, unit, role, patrolTask);
    setRoleTask(unit, role, patrolTask, tick);
    return patrolTask;
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
  if (kind === "barbarian") return DEFEND_ATTACK_RANGE + 0.6;
  return DEFEND_ATTACK_RANGE;
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
    const kindBias = creature.kind === "barbarian" ? 2.5 : 0;
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
    if (c.kind !== "deer" && c.kind !== "wolf") continue;
    const d = dist({ x: unit.microX, y: unit.microY }, { x: c.microX, y: c.microY });
    const kindBias = c.kind === "deer" ? 5 : 1;
    const threatBias = c.kind === "wolf" ? 2 : 0;
    const score = kindBias + threatBias - d * 0.35;
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
  if (creature.kind === "wolf") return 6 + Math.floor(roll * 6);
  if (creature.kind === "barbarian") return 3 + Math.floor(roll * 4);
  return 2 + Math.floor(roll * 3);
}

function maybeDefendAttack(state, goblin, unit, goal, tick) {
  if (goal.kind !== "defend-threat") return null;
  unit.roleState = unit.roleState || {};
  const lastAttackTick = unit.roleState.lastDefendAttackTick ?? -1000;
  if (tick - lastAttackTick < DEFEND_ATTACK_COOLDOWN_TICKS) return null;

  const target = nearestDefendTarget(state, unit, goal.targetThreatId);
  if (!target) return null;
  unit.roleState.lastDefendAttackTick = tick;

  const groupCount = defendersNearTarget(state, target.microX, target.microY, 2.5);
  const base = 4 + Math.floor(rand01("defend-base", tick, goblin.id, target.id) * 5);
  const groupBonusBase = target.kind === "barbarian" ? 4 : 3;
  const groupBonus = Math.max(0, groupCount - 1) * groupBonusBase;
  const damage = base + groupBonus;
  target.health = clamp((target.health ?? 100) - damage, 0, 100);
  target.stamina = clamp((target.stamina ?? 100) - Math.round(2 + damage * 0.35), 0, 100);

  const events = [{
    type: "GOBLIN_STRUCK_WILDLIFE",
    goblinId: goblin.id,
    wildlifeId: target.id,
    wildlifeKind: target.kind,
    groupCount,
    damage,
    tileX: target.tileX,
    tileY: target.tileY,
    text: `${goblin.identity.name} struck ${target.kind} ${target.id} for ${damage} (${groupCount} defenders nearby).`
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
  state.tribe.resources.food = (state.tribe.resources.food || 0) + food;
  removeWildlifeFromState(state, target.id);
  events.push({
    type: "WILDLIFE_KILLED_BY_GOBLINS",
    goblinId: goblin.id,
    wildlifeId: target.id,
    wildlifeKind: target.kind,
    foodGained: food,
    tileX: target.tileX,
    tileY: target.tileY,
    text: `${goblin.identity.name} and defenders killed ${target.kind} ${target.id} (+${food} food).`
  });
  return events;
}

function maybeExecuteGoal(state, goblin, unit, goal, tick) {
  const defendEvents = maybeDefendAttack(state, goblin, unit, goal, tick);
  if (Array.isArray(defendEvents) && defendEvents.length) return defendEvents;

  const key = tileKey(unit.microX, unit.microY);

  if (goal.kind === "drink") {
    if (hasNearbyWaterSource(state.worldMap, unit.microX, unit.microY, 1.5)) {
      const hydration = hydrationProfileForGoblin(state, goblin, 0);
      const jitter = Math.round((rand01("drink-jitter", tick, goblin.id) - 0.5) * 4);
      const sip = Math.max(8, hydration.drinkPerTick + jitter);
      const before = goblin.needs.thirst;
      goblin.needs.thirst = Math.max(0, goblin.needs.thirst - sip);
      const after = goblin.needs.thirst;
      const filled = after <= hydration.satedThreshold;
      if (!filled && tick % 2 !== 0) return null;
      return {
        type: "GOBLIN_DRANK_WATER",
        goblinId: goblin.id,
        thirstBefore: Number(before.toFixed(1)),
        thirstAfter: Number(after.toFixed(1)),
        text: filled
          ? `${goblin.identity.name} drank until satisfied.`
          : `${goblin.identity.name} kept drinking fresh water.`
      };
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
    if ((drop.wood || 0) <= 0 && (drop.mushrooms || 0) <= 0) {
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

  if (goal.kind === "collect-water") {
    if (!hasNearbyWaterSource(state.worldMap, unit.microX, unit.microY, 1.5)) return null;
    unit.roleState.carried = { resource: "water", amount: 2 };
    return {
      type: "WATER_COLLECTED",
      goblinId: goblin.id,
      role: unit.roleState?.role || "water-runner",
      amount: 2,
      text: `${goblin.identity.name} collected water for the settlement.`
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
    const existingOutpost = state.worldMap.structures.colonyOutpostsByTileKey[outpostKey];
    state.worldMap.structures.colonyOutpostsByTileKey[outpostKey] = {
      key: outpostKey,
      microX: unit.homeMicroX,
      microY: unit.homeMicroY,
      tileX: unit.homeTileX,
      tileY: unit.homeTileY,
      foundedAtTick: existingOutpost?.foundedAtTick ?? tick,
      lastUpdatedTick: tick,
      founderGoblinId: existingOutpost?.founderGoblinId || goblin.id,
      settlers: Math.max(1, (existingOutpost?.settlers || 0) + 1)
    };

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
  ensureLogisticsState(wm);
  rebuildHaulTasks(state, tick);
  emitLogisticsBottlenecks(state, tick, events);
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

  maybeCompleteWallPlan(state, tick, events);
  runReproductionSystem(state, tick, events);
  initUnitState(state);

  return events;
}
