import { TILES_PER_CHUNK, tileKey } from "./scale.js";
import { normalizeRaceRuntimeConfigByKind } from "./raceRuntimeConfig.js";

const KNOWN_ENEMY_OUTPOST_KINDS = new Set([
  "warcamp",
  "raider-camp",
  "ritual-circle",
  "watch-lodge",
  "siege-den",
  "barbarian-band",
  "wolf-pack"
]);

const KNOWN_ENEMY_OUTPOST_STATUSES = new Set([
  "active",
  "dormant",
  "destroyed",
  "hidden"
]);

function clampInt(n, min, max) {
  if (!Number.isFinite(n)) return min;
  const v = Math.round(n);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function normalizeEnemyOutpostKind(kind) {
  const normalized = String(kind || "warcamp").toLowerCase();
  return KNOWN_ENEMY_OUTPOST_KINDS.has(normalized) ? normalized : "warcamp";
}

function normalizeEnemyOutpostStatus(status) {
  const normalized = String(status || "active").toLowerCase();
  return KNOWN_ENEMY_OUTPOST_STATUSES.has(normalized) ? normalized : "active";
}

function toMicroFromTile(tileX, tileY) {
  return {
    microX: tileX * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2),
    microY: tileY * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2)
  };
}

export function normalizeEnemyOutpost(raw, key, worldMap, tick = 0) {
  if (!raw || !worldMap) return null;
  const maxTileX = Math.max(0, worldMap.width - 1);
  const maxTileY = Math.max(0, worldMap.height - 1);
  const maxMicroX = Math.max(0, worldMap.width * TILES_PER_CHUNK - 1);
  const maxMicroY = Math.max(0, worldMap.height * TILES_PER_CHUNK - 1);

  let tileX = Number.isFinite(raw.tileX) ? clampInt(raw.tileX, 0, maxTileX) : null;
  let tileY = Number.isFinite(raw.tileY) ? clampInt(raw.tileY, 0, maxTileY) : null;
  let microX = Number.isFinite(raw.microX) ? clampInt(raw.microX, 0, maxMicroX) : null;
  let microY = Number.isFinite(raw.microY) ? clampInt(raw.microY, 0, maxMicroY) : null;

  if (tileX === null || tileY === null) {
    if (microX === null || microY === null) return null;
    tileX = clampInt(Math.floor(microX / TILES_PER_CHUNK), 0, maxTileX);
    tileY = clampInt(Math.floor(microY / TILES_PER_CHUNK), 0, maxTileY);
  }
  if (microX === null || microY === null) {
    const center = toMicroFromTile(tileX, tileY);
    microX = center.microX;
    microY = center.microY;
  }

  const normalizedKey = tileKey(microX, microY);
  const nowTick = Math.max(0, Number.isFinite(tick) ? Math.round(tick) : 0);
  const createdTick = Math.max(
    0,
    Number.isFinite(raw.createdTick) ? Math.round(raw.createdTick) : nowTick
  );
  const updatedTick = Math.max(
    createdTick,
    Number.isFinite(raw.updatedTick) ? Math.round(raw.updatedTick) : nowTick
  );

  return {
    key: normalizedKey,
    id: String(raw.id || normalizedKey),
    kind: normalizeEnemyOutpostKind(raw.kind || raw.type),
    status: normalizeEnemyOutpostStatus(raw.status),
    name: String(raw.name || ""),
    ownerFactionId: raw.ownerFactionId ? String(raw.ownerFactionId) : null,
    originPackId: raw.originPackId ? String(raw.originPackId) : null,
    tileX,
    tileY,
    microX,
    microY,
    strength: Math.max(0, Number.isFinite(raw.strength) ? Number(raw.strength) : 1),
    threatTier: clampInt(raw.threatTier ?? 1, 1, 5),
    radiusTiles: clampInt(raw.radiusTiles ?? 4, 1, 20),
    createdTick,
    updatedTick,
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {}
  };
}

export function normalizeEnemyOutpostsByTileKey(worldMap, tick = 0) {
  if (!worldMap) return {};
  const rawMap = worldMap.structures?.enemyOutpostsByTileKey;
  const next = {};
  if (!rawMap || typeof rawMap !== "object") return next;
  for (const [key, outpost] of Object.entries(rawMap)) {
    const normalized = normalizeEnemyOutpost(outpost, key, worldMap, tick);
    if (!normalized) continue;
    next[normalized.key] = normalized;
  }
  return next;
}

export function ensureWorldContracts(state) {
  const wm = state?.worldMap;
  if (!wm) return;
  wm.render = wm.render || {};
  wm.render.showLayers = wm.render.showLayers || {};
  if (wm.render.showLayers.enemyOutposts === undefined) {
    wm.render.showLayers.enemyOutposts = true;
  }
  wm.structures = wm.structures || {};
  wm.structures.resourceTelemetry = wm.structures.resourceTelemetry || {};
  if (!Number.isFinite(wm.structures.resourceTelemetry.tickWindow)) wm.structures.resourceTelemetry.tickWindow = 120;
  if (!Number.isFinite(wm.structures.resourceTelemetry.sampleEveryTicks)) wm.structures.resourceTelemetry.sampleEveryTicks = 4;
  wm.structures.resourceTelemetry.historyByResource = wm.structures.resourceTelemetry.historyByResource || {};
  wm.structures.resourceTelemetry.netDeltaByResource = wm.structures.resourceTelemetry.netDeltaByResource || {};
  wm.structures.resourceTelemetry.etaToZeroByResource = wm.structures.resourceTelemetry.etaToZeroByResource || {};
  wm.structures.wallsByTileKey = wm.structures.wallsByTileKey || {};
  wm.structures.wallPlansBySiteId = wm.structures.wallPlansBySiteId || {};
  const primarySiteId = wm.player?.startingSiteId || "home";
  if (wm.structures.wallPlan && !wm.structures.wallPlansBySiteId[primarySiteId]) {
    wm.structures.wallPlansBySiteId[primarySiteId] = wm.structures.wallPlan;
  }
  if (!wm.structures.wallPlan && wm.structures.wallPlansBySiteId[primarySiteId]) {
    wm.structures.wallPlan = wm.structures.wallPlansBySiteId[primarySiteId];
  }
  wm.wildlife = wm.wildlife || {};
  wm.wildlife.raceRuntimeConfigByKind = normalizeRaceRuntimeConfigByKind(wm.wildlife.raceRuntimeConfigByKind);
  wm.structures.enemyOutpostsByTileKey = normalizeEnemyOutpostsByTileKey(wm, state?.meta?.tick || 0);
}
