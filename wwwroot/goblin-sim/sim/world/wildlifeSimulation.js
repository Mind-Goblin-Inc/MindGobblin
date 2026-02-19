import { TILES_PER_CHUNK, tileKey, tileToChunkCoord } from "./scale.js";
import { defaultRaceRuntimeConfigByKind } from "./raceRuntimeConfig.js";

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

const DEFAULT_SPECIES_KNOBS = {
  fish: { schoolTightness: 1, driftAmp: 1 },
  deer: { fleeBias: 1, grazeCadence: 1 },
  wolf: { huntPersistence: 1, regroupBias: 1 },
  barbarian: { raidBoldness: 1, retreatBias: 1 },
  human_raider: { harassBias: 1, disengageBias: 1 },
  ogre: { siegeBias: 1, brutality: 1 },
  shaman: { ritualBias: 1, curseBias: 1 },
  elf_ranger: { kitingBias: 1, volleyBias: 1 },
  bear: { territoriality: 1, roamBias: 1 },
  snake: { ambushBias: 1, slitherBias: 1 },
  boar: { chargeBias: 1, rootBias: 1 },
  crow: { scoutBias: 1, flockBias: 1 }
};
const WILDLIFE_ATTACK_COOLDOWN_TICKS = 3;
const DEFAULT_RACE_RUNTIME_CONFIG_BY_KIND = defaultRaceRuntimeConfigByKind();

function raceRuntimeConfig(state, kind) {
  const map = state.worldMap?.wildlife?.raceRuntimeConfigByKind || {};
  return map[kind] || DEFAULT_RACE_RUNTIME_CONFIG_BY_KIND[kind] || null;
}

function wildlifeAttackCooldownTicksForKind(state, kind) {
  const cfg = raceRuntimeConfig(state, kind);
  const n = Number(cfg?.combat?.attackCooldownTicks);
  if (Number.isFinite(n) && n > 0) return Math.round(n);
  return WILDLIFE_ATTACK_COOLDOWN_TICKS;
}

function wildlifeTuning(state, kind = null) {
  const cfg = kind ? raceRuntimeConfig(state, kind) : null;
  const t = state.meta?.tuning?.wildlife || {};
  return {
    detectionRadiusScale: Number.isFinite(t.detectionRadiusScale) ? t.detectionRadiusScale : 1,
    targetCommitTicks: Number.isFinite(t.targetCommitTicks) ? t.targetCommitTicks : Number(cfg?.aggro?.commitTicks || 20),
    retargetCooldownTicks: Number.isFinite(t.retargetCooldownTicks) ? t.retargetCooldownTicks : Number(cfg?.aggro?.retargetCooldownTicks || 6),
    breakoffTicks: Number.isFinite(t.breakoffTicks) ? t.breakoffTicks : Number(cfg?.retreat?.breakoffTicks || 10),
    engageRange: Number.isFinite(t.engageRange) ? t.engageRange : Number(cfg?.aggro?.engageRange || 1.5),
    wallPenaltyScale: Number.isFinite(t.wallPenaltyScale) ? t.wallPenaltyScale : 1
  };
}

function isHostileKind(kind) {
  return kind === "wolf"
    || kind === "barbarian"
    || kind === "human_raider"
    || kind === "ogre"
    || kind === "shaman"
    || kind === "elf_ranger"
    || kind === "bear"
    || kind === "snake"
    || kind === "boar";
}

function blocksWalls(kind) {
  return kind === "wolf"
    || kind === "barbarian"
    || kind === "human_raider"
    || kind === "ogre"
    || kind === "shaman"
    || kind === "elf_ranger"
    || kind === "bear"
    || kind === "snake"
    || kind === "boar";
}

function blocksWater(kind, goalKind) {
  if (kind === "fish") return false;
  if (kind === "crow") return false;
  if (kind === "deer") return goalKind !== "drink";
  if (kind === "wolf" || kind === "barbarian" || kind === "human_raider" || kind === "ogre" || kind === "shaman" || kind === "elf_ranger") return goalKind !== "drink";
  if (kind === "bear" || kind === "snake" || kind === "boar") return goalKind !== "drink";
  return false;
}

function hasWallAtMicro(wm, microX, microY) {
  return Boolean(wm.structures?.wallsByTileKey?.[tileKey(microX, microY)]);
}

function blocksDiagonalWallCorner(wm, fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) !== 1 || Math.abs(dy) !== 1) return false;
  // Prevent diagonal "squeeze" across wall corners.
  return hasWallAtMicro(wm, toX, fromY) || hasWallAtMicro(wm, fromX, toY);
}

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

function speciesKnobs(state, kind) {
  return state.meta?.randomizationProfile?.speciesKnobs?.[kind] || DEFAULT_SPECIES_KNOBS[kind];
}

function findNearestSourceByPredicate(state, from, predicate) {
  let best = null;
  let bestDist = Infinity;
  for (const source of Object.values(state.worldMap.waterSources?.byTileKey || {})) {
    if (!predicate(source)) continue;
    const d = dist(from, { x: source.microX, y: source.microY });
    if (d < bestDist) {
      bestDist = d;
      best = source;
    }
  }
  return best;
}

function localCentroid(wildlife, selfId, kind, x, y, radius) {
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  for (const id of wildlife.allIds) {
    if (id === selfId) continue;
    const c = wildlife.byId[id];
    if (!c || !c.alive || c.kind !== kind) continue;
    if (Math.abs(c.microX - x) > radius || Math.abs(c.microY - y) > radius) continue;
    count += 1;
    sumX += c.microX;
    sumY += c.microY;
  }
  if (!count) return null;
  return { x: sumX / count, y: sumY / count, count };
}

function nearestPredatorForDeer(wildlife, x, y, radius) {
  let best = null;
  let bestDist = Infinity;
  for (const id of wildlife.allIds) {
    const c = wildlife.byId[id];
    if (!c || !c.alive) continue;
    if (c.kind !== "wolf" && c.kind !== "barbarian" && c.kind !== "bear") continue;
    const d = dist({ x, y }, { x: c.microX, y: c.microY });
    if (d > radius) continue;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function nearestCreatureByKind(wildlife, kind, from, onlyAlive = true) {
  let best = null;
  let bestDist = Infinity;
  for (const id of wildlife.allIds) {
    const c = wildlife.byId[id];
    if (!c) continue;
    if (c.kind !== kind) continue;
    if (onlyAlive && !c.alive) continue;
    const d = dist(from, { x: c.microX, y: c.microY });
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function assignWolfPackTargets(state, events) {
  const wildlife = state.worldMap.wildlife;
  const wolfKnobs = speciesKnobs(state, "wolf");
  const wolfCfg = raceRuntimeConfig(state, "wolf");
  for (const pack of Object.values(wildlife.packsById || {})) {
    if (pack.kind !== "wolf-pack") continue;
    const aliveMembers = pack.memberIds
      .map((id) => wildlife.byId[id])
      .filter((c) => c && c.alive);
    if (!aliveMembers.length) {
      pack.leaderId = null;
      pack.targetWildlifeId = undefined;
      continue;
    }

    if (!pack.leaderId || !wildlife.byId[pack.leaderId] || !wildlife.byId[pack.leaderId].alive) {
      pack.leaderId = aliveMembers[0].id;
    }
    const leader = wildlife.byId[pack.leaderId];
    const prey = nearestCreatureByKind(wildlife, "deer", { x: leader.microX, y: leader.microY }, true);
    const maxHuntRange = Number(wolfCfg?.patrol?.packHuntBaseRange ?? 24) * wolfKnobs.huntPersistence;
    const preyInRange = prey && dist({ x: leader.microX, y: leader.microY }, { x: prey.microX, y: prey.microY }) <= maxHuntRange
      ? prey
      : null;
    if (!preyInRange) {
      pack.targetWildlifeId = undefined;
      pack.targetMicroX = leader.homeMicroX;
      pack.targetMicroY = leader.homeMicroY;
      continue;
    }

    const changed = pack.targetWildlifeId !== preyInRange.id;
    pack.targetWildlifeId = preyInRange.id;
    pack.targetMicroX = preyInRange.microX;
    pack.targetMicroY = preyInRange.microY;
    if (changed) {
      events.push({
        type: "WOLF_HUNT_STARTED",
        packId: pack.id,
        targetId: preyInRange.id,
        text: `Wolf pack ${pack.id} started hunting deer ${preyInRange.id}.`
      });
    }
  }
}

function nearestGoblinHomeDistance(state, x, y) {
  let best = Infinity;
  for (const unit of Object.values(state.worldMap.units?.byGoblinId || {})) {
    const d = dist({ x, y }, { x: unit.homeMicroX, y: unit.homeMicroY });
    if (d < best) best = d;
  }
  return best;
}

function maybeEmitWolfThreat(state, events) {
  const wm = state.worldMap;
  const wildlife = wm.wildlife;
  const wolfKnobs = speciesKnobs(state, "wolf");
  const wolfCfg = raceRuntimeConfig(state, "wolf");
  if (!wildlife?.allIds?.length) return;
  if (state.meta.tick % 18 !== 0) return;
  const last = wildlife.lastWolfThreatTick || -1000;
  if (state.meta.tick - last < 18) return;

  let nearest = Infinity;
  for (const id of wildlife.allIds) {
    const c = wildlife.byId[id];
    if (!c || !c.alive || c.kind !== "wolf") continue;
    const d = nearestGoblinHomeDistance(state, c.microX, c.microY);
    if (d < nearest) nearest = d;
  }

  if (nearest <= Number(wolfCfg?.threat?.homeWarnDistance ?? 6) * wolfKnobs.regroupBias) {
    wildlife.lastWolfThreatTick = state.meta.tick;
    events.push({
      type: "WOLF_THREAT_NEAR_HOME",
      distance: Number(nearest.toFixed(2)),
      text: `Wolf activity detected near goblin homes (distance ${nearest.toFixed(1)}).`
    });
  }
}

function nearestSiteFrom(state, from) {
  let best = null;
  let bestDist = Infinity;
  for (const site of Object.values(state.worldMap.sitesById || {})) {
    const d = dist(from, { x: site.x * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2), y: site.y * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2) });
    if (d < bestDist) {
      bestDist = d;
      best = site;
    }
  }
  return best;
}

function countAliveWildlifeByKind(wildlife, kind) {
  let count = 0;
  for (const id of wildlife.allIds || []) {
    const creature = wildlife.byId[id];
    if (!creature || !creature.alive || creature.kind !== kind) continue;
    count += 1;
  }
  return count;
}

function aliveGoblinCount(state) {
  let count = 0;
  for (const id of state.goblins?.allIds || []) {
    const g = state.goblins?.byId?.[id];
    if (!g || !g.flags?.alive || g.flags?.missing) continue;
    count += 1;
  }
  return count;
}

function aliveHostileCount(wildlife) {
  let count = 0;
  for (const id of wildlife?.allIds || []) {
    const c = wildlife?.byId?.[id];
    if (!c || !c.alive || !isHostileKind(c.kind)) continue;
    count += 1;
  }
  return count;
}

function lowPopulationPressureScale(state) {
  const alive = aliveGoblinCount(state);
  if (alive <= 2) return 0.12;
  if (alive <= 4) return 0.2;
  if (alive <= 6) return 0.35;
  if (alive <= 8) return 0.5;
  if (alive <= 10) return 0.7;
  return 1;
}

function globalHostileCap(state) {
  const alive = aliveGoblinCount(state);
  const day = Math.floor((state.meta?.tick || 0) / 144);
  const base = Math.max(5, Math.round(alive * 1.35));
  const growth = Math.min(12, Math.floor(day * 0.45));
  return base + growth;
}

function ensureBarbarianBand(wildlife) {
  const packs = wildlife.packsById = wildlife.packsById || {};
  const existing = packs["barbarian-band-1"];
  if (existing) return existing;
  packs["barbarian-band-1"] = {
    id: "barbarian-band-1",
    kind: "barbarian-band",
    memberIds: [],
    leaderId: null,
    targetSiteId: undefined,
    targetMicroX: undefined,
    targetMicroY: undefined,
    cohesion: 0.8
  };
  return packs["barbarian-band-1"];
}

function ensureHostilePack(wildlife, packId, packKind, cohesion = 0.76) {
  const packs = wildlife.packsById = wildlife.packsById || {};
  const existing = packs[packId];
  if (existing) return existing;
  packs[packId] = {
    id: packId,
    kind: packKind,
    memberIds: [],
    leaderId: null,
    targetSiteId: undefined,
    targetMicroX: undefined,
    targetMicroY: undefined,
    cohesion
  };
  return packs[packId];
}

function outpostDescriptorForPack(state, packKind) {
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
  const cfg = raceRuntimeConfig(state, raceKind)?.outpostPolicy;
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

function syncEnemyOutpostsFromPacks(state, events) {
  const wm = state.worldMap;
  const wildlife = wm?.wildlife;
  if (!wm || !wildlife) return;

  wm.structures = wm.structures || {};
  const store = wm.structures.enemyOutpostsByTileKey = wm.structures.enemyOutpostsByTileKey || {};
  const maxTileX = Math.max(0, wm.width - 1);
  const maxTileY = Math.max(0, wm.height - 1);
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

  for (const pack of Object.values(wildlife.packsById || {})) {
    const desc = outpostDescriptorForPack(state, pack?.kind);
    if (!desc) continue;
    const members = (pack.memberIds || [])
      .map((id) => wildlife.byId?.[id])
      .filter(Boolean);
    const aliveMembers = members.filter((m) => m.alive);
    const leader = (pack.leaderId && wildlife.byId?.[pack.leaderId]) || aliveMembers[0] || members[0];
    if (!leader) continue;

    if (!pack.outpostKey) {
      const homeMicroX = Number.isFinite(leader.homeMicroX) ? leader.homeMicroX : leader.microX;
      const homeMicroY = Number.isFinite(leader.homeMicroY) ? leader.homeMicroY : leader.microY;
      const baseTileX = clamp(Math.floor(homeMicroX / TILES_PER_CHUNK), 0, maxTileX);
      const baseTileY = clamp(Math.floor(homeMicroY / TILES_PER_CHUNK), 0, maxTileY);
      let resolvedTileX = baseTileX;
      let resolvedTileY = baseTileY;
      for (const [dx, dy] of tileOffsets) {
        const tx = clamp(baseTileX + dx, 0, maxTileX);
        const ty = clamp(baseTileY + dy, 0, maxTileY);
        const probeKey = tileKey(
          tx * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2),
          ty * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2)
        );
        const occupied = store[probeKey];
        if (occupied && occupied.originPackId && occupied.originPackId !== pack.id) continue;
        resolvedTileX = tx;
        resolvedTileY = ty;
        break;
      }
      const microX = resolvedTileX * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
      const microY = resolvedTileY * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
      pack.outpostKey = tileKey(microX, microY);
      pack.outpostTileX = resolvedTileX;
      pack.outpostTileY = resolvedTileY;
    }

    const key = pack.outpostKey;
    const tileX = clamp(Number(pack.outpostTileX ?? Math.floor((leader.homeMicroX ?? leader.microX) / TILES_PER_CHUNK)), 0, maxTileX);
    const tileY = clamp(Number(pack.outpostTileY ?? Math.floor((leader.homeMicroY ?? leader.microY) / TILES_PER_CHUNK)), 0, maxTileY);
    const microX = tileX * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
    const microY = tileY * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
    const existing = store[key];
    const status = aliveMembers.length ? "active" : "dormant";
    const strength = Math.max(0, aliveMembers.length);

    store[key] = {
      key,
      id: existing?.id || `enemy-outpost-${pack.id}`,
      kind: existing?.kind || desc.kind,
      status,
      name: existing?.name || desc.name,
      ownerFactionId: existing?.ownerFactionId || desc.ownerFactionId,
      originPackId: pack.id,
      tileX,
      tileY,
      microX,
      microY,
      strength,
      threatTier: existing?.threatTier || desc.threatTier,
      radiusTiles: existing?.radiusTiles || desc.radiusTiles,
      createdTick: Number.isFinite(existing?.createdTick) ? existing.createdTick : state.meta.tick,
      updatedTick: state.meta.tick,
      metadata: {
        ...(existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
        packKind: pack.kind,
        raidPhase: pack.raidPhase || null,
        memberCount: members.length,
        aliveMemberCount: aliveMembers.length
      }
    };

    if (!existing) {
      events.push({
        type: "ENEMY_OUTPOST_ESTABLISHED",
        outpostId: store[key].id,
        outpostKind: store[key].kind,
        packId: pack.id,
        tileX,
        tileY,
        text: `Enemy outpost established (${store[key].kind}) at ${tileX},${tileY}.`
      });
    }
  }
}

function nextReinforcementWildlifeId(wildlife, tick, kind = "barbarian") {
  wildlife.__spawnSeqByKind = wildlife.__spawnSeqByKind || {};
  wildlife.__spawnSeqByKind[kind] = (wildlife.__spawnSeqByKind[kind] || 0) + 1;
  let id = `wildlife-${kind}-r${tick}-${wildlife.__spawnSeqByKind[kind]}`;
  while (wildlife.byId?.[id]) {
    wildlife.__spawnSeqByKind[kind] += 1;
    id = `wildlife-${kind}-r${tick}-${wildlife.__spawnSeqByKind[kind]}`;
  }
  return id;
}

function chooseBarbarianEdgeSpawn(state, wildlife, tick, spawnOrdinal) {
  const wm = state.worldMap;
  const maxMicroX = wm.width * TILES_PER_CHUNK - 1;
  const maxMicroY = wm.height * TILES_PER_CHUNK - 1;
  const occupied = wildlife.occupancyByMicroKey || {};
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const side = Math.floor(rand01("barb-reinforce-side", state.meta.seed, tick, spawnOrdinal, attempt) * 4);
    const microX = side === 1
      ? maxMicroX
      : side === 3
        ? 0
        : Math.floor(rand01("barb-reinforce-x", state.meta.seed, tick, spawnOrdinal, attempt) * (maxMicroX + 1));
    const microY = side === 0
      ? 0
      : side === 2
        ? maxMicroY
        : Math.floor(rand01("barb-reinforce-y", state.meta.seed, tick, spawnOrdinal, attempt) * (maxMicroY + 1));
    const key = tileKey(microX, microY);
    if ((occupied[key] || []).length > 0) continue;
    if (isWaterMicroTile(wm, microX, microY)) continue;
    if (wm.structures?.wallsByTileKey?.[key]) continue;
    return { microX, microY };
  }
  return null;
}

function maybeSpawnBarbarianReinforcements(state, events) {
  const wildlife = state.worldMap?.wildlife;
  if (!wildlife?.allIds?.length) return;
  const tick = state.meta.tick;
  const pressureScale = lowPopulationPressureScale(state);
  const hostileCap = globalHostileCap(state);
  const aliveHostiles = aliveHostileCount(wildlife);
  if (aliveHostiles >= hostileCap) return;

  const cfg = raceRuntimeConfig(state, "barbarian")?.spawnBudget || {};
  const startTick = Number.isFinite(cfg.startTick) ? Math.max(0, Math.round(cfg.startTick)) : 48;
  if (tick < startTick) return;

  const day = Math.floor(tick / 144);
  const edgePressure = Math.max(1, Number(wildlife.spawners?.barbarianEdgePressure || 1));
  const baseCap = clamp(
    Math.round(edgePressure * Number(cfg.edgePressureWeight ?? 0.9)),
    Number.isFinite(cfg.baseCapMin) ? Math.round(cfg.baseCapMin) : 2,
    Number.isFinite(cfg.baseCapMax) ? Math.round(cfg.baseCapMax) : 10
  );
  const growthCap = Math.min(
    Number.isFinite(cfg.growthCapMax) ? Math.round(cfg.growthCapMax) : 18,
    Math.floor(day * Number(cfg.growthPerDay ?? 0.65))
  );
  const targetCapRaw = baseCap + growthCap;
  const targetCap = Math.max(0, Math.round(targetCapRaw * pressureScale));

  const aliveBarbarians = countAliveWildlifeByKind(wildlife, "barbarian");
  const cadence = clamp(
    Math.round(Number(cfg.cadenceStart ?? 150) - day * Number(cfg.cadenceDecayPerDay ?? 3.5)),
    Number.isFinite(cfg.cadenceMin) ? Math.round(cfg.cadenceMin) : 36,
    Number.isFinite(cfg.cadenceMax) ? Math.round(cfg.cadenceMax) : 150
  );
  const dampenedCadence = Math.round(cadence * (pressureScale < 1 ? (1 + (1 - pressureScale) * 1.4) : 1));
  wildlife.__nextBarbarianReinforceTick = Number.isFinite(wildlife.__nextBarbarianReinforceTick)
    ? wildlife.__nextBarbarianReinforceTick
    : Math.max(64, tick + Math.round(dampenedCadence * 0.8));
  if (tick < wildlife.__nextBarbarianReinforceTick) return;

  if (aliveBarbarians >= targetCap) {
    wildlife.__nextBarbarianReinforceTick = tick + Math.max(24, Math.round(dampenedCadence * 0.65));
    return;
  }

  const globalBudget = Math.max(0, hostileCap - aliveHostiles);
  const deficit = Math.max(0, targetCap - aliveBarbarians);
  const batch = Math.min(
    globalBudget,
    deficit,
    clamp(
      Number(cfg.batchBase ?? 1) + Math.floor(day / Math.max(1, Number(cfg.batchPerDays ?? 7))),
      1,
      Number.isFinite(cfg.batchMax) ? Math.round(cfg.batchMax) : 4
    )
  );
  const pack = ensureBarbarianBand(wildlife);
  let spawned = 0;
  for (let i = 0; i < batch; i += 1) {
    const spawnAt = chooseBarbarianEdgeSpawn(state, wildlife, tick, i + 1);
    if (!spawnAt) continue;
    const id = nextReinforcementWildlifeId(wildlife, tick, "barbarian");
    const hunger = Math.floor(rand01("barb-reinforce-h", state.meta.seed, tick, id) * 35);
    const thirst = Math.floor(rand01("barb-reinforce-t", state.meta.seed, tick, id) * 35);
    const fear = Math.floor(rand01("barb-reinforce-f", state.meta.seed, tick, id) * 25);
    const aggression = Math.floor(rand01("barb-reinforce-a", state.meta.seed, tick, id) * 25);
    const tileX = clamp(tileToChunkCoord(spawnAt.microX), 0, state.worldMap.width - 1);
    const tileY = clamp(tileToChunkCoord(spawnAt.microY), 0, state.worldMap.height - 1);

    wildlife.byId[id] = {
      id,
      kind: "barbarian",
      disposition: "hostile",
      microX: spawnAt.microX,
      microY: spawnAt.microY,
      tileX,
      tileY,
      homeMicroX: spawnAt.microX,
      homeMicroY: spawnAt.microY,
      homeRadius: 14,
      alive: true,
      health: 100,
      stamina: 100,
      hunger,
      thirst,
      fear,
      aggression,
      packId: pack.id,
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
      aiState: "raiding",
      lastDecisionTick: tick,
      lastActionTick: tick,
      spawnTick: tick
    };
    wildlife.allIds.push(id);
    pack.memberIds = pack.memberIds || [];
    pack.memberIds.push(id);
    spawned += 1;
  }

  if (!pack.leaderId || !wildlife.byId[pack.leaderId] || !wildlife.byId[pack.leaderId].alive) {
    const leader = (pack.memberIds || []).map((id) => wildlife.byId[id]).find((c) => c && c.alive);
    pack.leaderId = leader?.id || null;
  }

  if (spawned > 0) {
    events.push({
      type: "BARBARIAN_REINFORCEMENTS_ARRIVED",
      amount: spawned,
      aliveBarbarians: aliveBarbarians + spawned,
      targetCap,
      text: `Barbarian reinforcements arrived (+${spawned}).`
    });
  }

  wildlife.__nextBarbarianReinforceTick = tick + dampenedCadence;
}

function maybeSpawnAdvancedHostiles(state, events) {
  const wildlife = state.worldMap?.wildlife;
  if (!wildlife?.allIds?.length) return;
  const tick = state.meta.tick;
  const pressureScale = lowPopulationPressureScale(state);
  const hostileCap = globalHostileCap(state);
  let aliveHostiles = aliveHostileCount(wildlife);
  if (aliveHostiles >= hostileCap) return;

  const spawnDefs = [
    { kind: "elf_ranger", packId: "watch-band-1", packKind: "watch-band", aiState: "ranging", homeRadius: 12, cohesion: 0.78 },
    { kind: "shaman", packId: "ritual-coven-1", packKind: "ritual-coven", aiState: "channeling", homeRadius: 11, cohesion: 0.74 },
    { kind: "ogre", packId: "ogre-warband-1", packKind: "ogre-warband", aiState: "sieging", homeRadius: 13, cohesion: 0.72 }
  ];
  for (const def of spawnDefs) {
    const cfg = raceRuntimeConfig(state, def.kind)?.spawnBudget || {};
    const startTick = Number.isFinite(cfg.startTick) ? Math.max(0, Math.round(cfg.startTick)) : 432;
    if (tick < startTick) continue;
    const day = Math.floor(tick / 144);
    const baseCap = clamp(
      Number.isFinite(cfg.baseCapMax) ? Math.round(cfg.baseCapMax) : 2,
      Number.isFinite(cfg.baseCapMin) ? Math.round(cfg.baseCapMin) : 0,
      Number.isFinite(cfg.baseCapMax) ? Math.round(cfg.baseCapMax) : 2
    );
    const growthCap = Math.min(
      Number.isFinite(cfg.growthCapMax) ? Math.round(cfg.growthCapMax) : 3,
      Math.floor(day * Number(cfg.growthPerDay ?? 0.15))
    );
    const targetCapRaw = baseCap + growthCap;
    const targetCap = Math.max(0, Math.round(targetCapRaw * pressureScale));
    const alive = countAliveWildlifeByKind(wildlife, def.kind);
    if (alive >= targetCap) continue;

    const cadence = clamp(
      Math.round(Number(cfg.cadenceStart ?? 160) - day * Number(cfg.cadenceDecayPerDay ?? 2)),
      Number.isFinite(cfg.cadenceMin) ? Math.round(cfg.cadenceMin) : 56,
      Number.isFinite(cfg.cadenceMax) ? Math.round(cfg.cadenceMax) : 160
    );
    const dampenedCadence = Math.round(cadence * (pressureScale < 1 ? (1 + (1 - pressureScale) * 1.5) : 1));
    wildlife.__nextAdvancedReinforceTickByKind = wildlife.__nextAdvancedReinforceTickByKind || {};
    const nextKey = def.kind;
    wildlife.__nextAdvancedReinforceTickByKind[nextKey] = Number.isFinite(wildlife.__nextAdvancedReinforceTickByKind[nextKey])
      ? wildlife.__nextAdvancedReinforceTickByKind[nextKey]
      : tick + Math.round(dampenedCadence * 0.9);
    if (tick < wildlife.__nextAdvancedReinforceTickByKind[nextKey]) continue;

    const deficit = Math.max(0, targetCap - alive);
    const globalBudget = Math.max(0, hostileCap - aliveHostiles);
    const batch = Math.min(
      globalBudget,
      deficit,
      clamp(
        Number(cfg.batchBase ?? 1) + Math.floor(day / Math.max(1, Number(cfg.batchPerDays ?? 8))),
        1,
        Number.isFinite(cfg.batchMax) ? Math.round(cfg.batchMax) : 2
      )
    );
    const pack = ensureHostilePack(wildlife, def.packId, def.packKind, def.cohesion);
    let spawned = 0;
    for (let i = 0; i < batch; i += 1) {
      const spawnAt = chooseBarbarianEdgeSpawn(state, wildlife, tick, `${def.kind}-${i + 1}`);
      if (!spawnAt) continue;
      const id = nextReinforcementWildlifeId(wildlife, tick, def.kind);
      const tileX = clamp(tileToChunkCoord(spawnAt.microX), 0, state.worldMap.width - 1);
      const tileY = clamp(tileToChunkCoord(spawnAt.microY), 0, state.worldMap.height - 1);
      wildlife.byId[id] = {
        id,
        kind: def.kind,
        disposition: "hostile",
        microX: spawnAt.microX,
        microY: spawnAt.microY,
        tileX,
        tileY,
        homeMicroX: spawnAt.microX,
        homeMicroY: spawnAt.microY,
        homeRadius: def.homeRadius,
        alive: true,
        health: 100,
        stamina: 100,
        hunger: Math.floor(rand01(`${def.kind}-reinforce-h`, state.meta.seed, tick, id) * 35),
        thirst: Math.floor(rand01(`${def.kind}-reinforce-t`, state.meta.seed, tick, id) * 35),
        fear: Math.floor(rand01(`${def.kind}-reinforce-f`, state.meta.seed, tick, id) * 25),
        aggression: Math.floor(rand01(`${def.kind}-reinforce-a`, state.meta.seed, tick, id) * 25),
        packId: pack.id,
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
        aiState: def.aiState,
        lastDecisionTick: tick,
        lastActionTick: tick,
        spawnTick: tick
      };
      wildlife.allIds.push(id);
      pack.memberIds = pack.memberIds || [];
      pack.memberIds.push(id);
      spawned += 1;
      aliveHostiles += 1;
    }

    if (!pack.leaderId || !wildlife.byId[pack.leaderId] || !wildlife.byId[pack.leaderId].alive) {
      const leader = (pack.memberIds || []).map((id) => wildlife.byId[id]).find((c) => c && c.alive);
      pack.leaderId = leader?.id || null;
    }
    if (spawned > 0) {
      events.push({
        type: "ADVANCED_HOSTILE_REINFORCEMENTS_ARRIVED",
        wildlifeKind: def.kind,
        amount: spawned,
        aliveHostiles: alive + spawned,
        targetCap,
        text: `${def.kind} reinforcements arrived (+${spawned}).`
      });
    }
    wildlife.__nextAdvancedReinforceTickByKind[nextKey] = tick + dampenedCadence;
    if (aliveHostiles >= hostileCap) break;
  }
}

function nearestGoblinHomeTarget(state, from) {
  let best = null;
  let bestDist = Infinity;
  for (const unit of Object.values(state.worldMap.units?.byGoblinId || {})) {
    const d = dist(from, { x: unit.homeMicroX, y: unit.homeMicroY });
    if (d < bestDist) {
      bestDist = d;
      best = unit;
    }
  }
  return best;
}

function findGoblinUnit(state, goblinId) {
  return state.worldMap?.units?.byGoblinId?.[goblinId] || null;
}

function nearestGoblinUnit(state, from, radius = Infinity) {
  let best = null;
  let bestDist = Infinity;
  for (const [goblinId, unit] of Object.entries(state.worldMap?.units?.byGoblinId || {})) {
    const goblin = state.goblins.byId[goblinId];
    if (!goblin || !goblin.flags?.alive || goblin.flags?.missing || !unit) continue;
    const d = dist(from, { x: unit.microX, y: unit.microY });
    if (d > radius || d >= bestDist) continue;
    bestDist = d;
    best = { goblinId, unit, distance: d };
  }
  return best;
}

function isValidGoblinTarget(state, goblinId) {
  const goblin = state.goblins.byId[goblinId];
  if (!goblin || !goblin.flags.alive || goblin.flags.missing) return false;
  return Boolean(findGoblinUnit(state, goblinId));
}

function removeGoblinUnitOnDeath(state, goblinId) {
  if (!state.worldMap?.units?.byGoblinId?.[goblinId]) return;
  delete state.worldMap.units.byGoblinId[goblinId];

  const wallPlan = state.worldMap?.structures?.wallPlan;
  if (!wallPlan) return;
  for (const key of wallPlan.orderedTileKeys || []) {
    if (wallPlan.assignedGoblinByKey?.[key] === goblinId) {
      wallPlan.assignedGoblinByKey[key] = null;
      wallPlan.assignedUntilTickByKey[key] = 0;
    }
  }
}

function computeWildlifeDamage(creature, state, tick, goblinId) {
  const roll = rand01("wildlife-attack-damage", state.meta.seed, tick, creature.id, goblinId);
  if (creature.kind === "barbarian") return 9 + Math.floor(roll * 10);
  if (creature.kind === "human_raider") return 5 + Math.floor(roll * 5);
  if (creature.kind === "ogre") return 11 + Math.floor(roll * 8);
  if (creature.kind === "elf_ranger") return 4 + Math.floor(roll * 5);
  if (creature.kind === "shaman") return 3 + Math.floor(roll * 4);
  if (creature.kind === "bear") return 10 + Math.floor(roll * 8);
  if (creature.kind === "boar") return 7 + Math.floor(roll * 6);
  if (creature.kind === "snake") return 4 + Math.floor(roll * 5);
  return 4 + Math.floor(roll * 5);
}

function applyWildlifeAttackToGoblin(state, creature, goblinId, tick, atKey) {
  const events = [];
  const goblin = state.goblins.byId[goblinId];
  const targetUnit = findGoblinUnit(state, goblinId);
  if (!goblin || !targetUnit || !goblin.flags.alive || goblin.flags.missing) return events;

  const lastAttackTick = creature.lastGoblinAttackTickByGoblinId?.[goblinId] ?? -1000;
  if (tick - lastAttackTick < wildlifeAttackCooldownTicksForKind(state, creature.kind)) return events;
  if (!creature.lastGoblinAttackTickByGoblinId) creature.lastGoblinAttackTickByGoblinId = {};
  creature.lastGoblinAttackTickByGoblinId[goblinId] = tick;

  const damage = computeWildlifeDamage(creature, state, tick, goblinId);
  const health = goblin.body.health;
  const beforeVitality = health.vitality;
  health.vitality = clamp(health.vitality - damage, 0, 100);
  health.pain = clamp(health.pain + Math.max(2, Math.round(damage * 0.55)), 0, 100);
  const bleedScale = creature.kind === "barbarian"
    ? 0.34
    : creature.kind === "ogre"
      ? 0.28
      : creature.kind === "elf_ranger"
        ? 0.26
    : creature.kind === "snake"
      ? 0.38
      : creature.kind === "boar"
        ? 0.3
        : 0.22;
  const bleedInc = Math.max(0, Math.round(damage * bleedScale));
  health.bleeding = clamp(health.bleeding + bleedInc, 0, 100);

  const injuryId = `${tick}-${creature.id}-${goblinId}-${Math.floor(rand01("injury-id", state.meta.seed, tick, creature.id, goblinId) * 1e6)}`;
  goblin.body.injuries.push({
    id: injuryId,
    kind: creature.kind === "barbarian"
      ? "slash"
      : creature.kind === "ogre"
        ? "crush"
        : creature.kind === "elf_ranger"
          ? "pierce"
          : creature.kind === "shaman"
            ? "hex"
      : creature.kind === "snake"
        ? "venom"
        : creature.kind === "boar"
          ? "gore"
          : "bite",
    sourceType: "wildlife",
    sourceId: creature.id,
    severity: damage,
    tick
  });

  goblin.modData = goblin.modData || {};
  goblin.modData.threatResponse = goblin.modData.threatResponse || { mode: "none", activeThreatId: null, lastThreatTick: null };
  goblin.modData.threatResponse.lastThreatTick = tick;
  goblin.modData.threatResponse.activeThreatId = creature.id;

  events.push({
    type: "WILDLIFE_ATTACKED_GOBLIN",
    wildlifeId: creature.id,
    wildlifeKind: creature.kind,
    goblinId,
    damage,
    tileX: targetUnit.tileX,
    tileY: targetUnit.tileY,
    at: atKey,
    text: `${creature.kind} ${creature.id} hit goblin ${goblinId} for ${damage} damage at ${atKey}.`
  });

  const lethal = health.vitality <= 0;
  if (!lethal) {
    events.push({
      type: "GOBLIN_INJURED_BY_WILDLIFE",
      goblinId,
      wildlifeId: creature.id,
      wildlifeKind: creature.kind,
      injuryId,
      damage,
      vitalityBefore: beforeVitality,
      vitalityAfter: health.vitality,
      tileX: targetUnit.tileX,
      tileY: targetUnit.tileY,
      at: atKey,
      text: `${goblin.identity.name} was injured by ${creature.kind} ${creature.id} (${health.vitality} vitality left).`
    });
    return events;
  }

  goblin.flags.alive = false;
  goblin.assignment.currentJobId = undefined;
  goblin.modData.threatResponse.mode = "none";
  goblin.modData.threatResponse.activeThreatId = null;
  removeGoblinUnitOnDeath(state, goblinId);

  events.push({
    type: "GOBLIN_KILLED_BY_WILDLIFE",
    goblinId,
    wildlifeId: creature.id,
    wildlifeKind: creature.kind,
    tileX: targetUnit.tileX,
    tileY: targetUnit.tileY,
    at: atKey,
    text: `${goblin.identity.name} was killed by ${creature.kind} ${creature.id} at ${atKey}.`
  });
  return events;
}

function nearbyGoblinCount(state, tileX, tileY, radius = 2) {
  let count = 0;
  for (const id of state.goblins.allIds) {
    const u = findGoblinUnit(state, id);
    if (!u) continue;
    if (Math.abs(u.microX - tileX) <= radius && Math.abs(u.microY - tileY) <= radius) count += 1;
  }
  return count;
}

function localWallDensity(state, tileX, tileY, radius = 2) {
  let count = 0;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const key = tileKey(tileX + dx, tileY + dy);
      if (state.worldMap?.structures?.wallsByTileKey?.[key]) count += 1;
    }
  }
  return count;
}

function scoreGoblinTarget(state, creature, goblinId) {
  const goblin = state.goblins.byId[goblinId];
  const unit = findGoblinUnit(state, goblinId);
  if (!goblin || !unit || !goblin.flags.alive || goblin.flags.missing) return -Infinity;
  const tune = wildlifeTuning(state, creature.kind);
  const cfg = raceRuntimeConfig(state, creature.kind);

  const from = { x: creature.microX, y: creature.microY };
  const to = { x: unit.microX, y: unit.microY };
  const d = dist(from, to);
  const defaultDetectionRadius = creature.kind === "wolf"
    ? 5.5
    : creature.kind === "elf_ranger"
      ? 8
      : creature.kind === "shaman"
        ? 6.5
        : creature.kind === "ogre"
          ? 6
    : creature.kind === "snake"
      ? 3.25
      : creature.kind === "boar"
        ? 4.5
        : creature.kind === "bear"
          ? 6.5
          : 7;
  const detectionRadius = Number(cfg?.aggro?.detectionRadius || defaultDetectionRadius) * tune.detectionRadiusScale;
  if (d > detectionRadius) return -Infinity;

  const vitality = Math.max(0, Math.min(100, goblin.body?.health?.vitality ?? 100));
  const stress = Math.max(0, Math.min(100, goblin.psyche?.stress ?? 0));
  const vulnerability = (100 - vitality) * 0.012 + stress * 0.006;
  const defenders = nearbyGoblinCount(state, unit.microX, unit.microY, 2);
  const defensePenalty = Math.min(2.2, Math.max(0, defenders - 1) * 0.34);
  const wallPenalty = Math.min(2.4, localWallDensity(state, unit.microX, unit.microY, 2) * 0.16 * tune.wallPenaltyScale);
  const exposure = wallPenalty < 0.2 ? 0.9 : 0.15;

  return (1 / (1 + d)) * 10 + vulnerability + exposure - defensePenalty - wallPenalty;
}

function ensureHuntState(creature) {
  if (!creature.huntState) {
    creature.huntState = {
      mode: "patrol",
      targetGoblinId: undefined,
      targetScore: undefined,
      targetConfidence: undefined,
      lastKnownTargetTile: undefined,
      targetAcquiredTick: undefined,
      targetCommitUntilTick: undefined,
      breakoffUntilTick: undefined,
      retargetAfterTick: 0
    };
    return creature.huntState;
  }
  if (!Object.prototype.hasOwnProperty.call(creature.huntState, "targetScore")) creature.huntState.targetScore = undefined;
  if (!Object.prototype.hasOwnProperty.call(creature.huntState, "targetConfidence")) creature.huntState.targetConfidence = undefined;
  return creature.huntState;
}

function chooseHostileGoblinTarget(state, creature, candidateGoblinIds) {
  let bestId = null;
  let bestScore = -Infinity;
  const ids = Array.isArray(candidateGoblinIds) ? candidateGoblinIds : state.goblins.allIds;
  for (const goblinId of ids) {
    const score = scoreGoblinTarget(state, creature, goblinId);
    if (score > bestScore) {
      bestScore = score;
      bestId = goblinId;
      continue;
    }
    if (score === bestScore && bestId !== null) {
      const tieA = rand01("hostile-target-tie", state.meta.tick, creature.id, goblinId);
      const tieB = rand01("hostile-target-tie", state.meta.tick, creature.id, bestId);
      if (tieA > tieB) bestId = goblinId;
    }
  }
  if (!bestId || !Number.isFinite(bestScore)) {
    const allowFallback = creature.kind === "barbarian";
    if (!allowFallback) return null;
    // Fallback: keep long-range pressure by pursuing nearest valid goblin if no target is in
    // immediate detection radius. Confidence is intentionally low so normal nearby targets win.
    let nearestId = null;
    let nearestDist = Infinity;
    for (const goblinId of ids) {
      const unit = findGoblinUnit(state, goblinId);
      const goblin = state.goblins.byId[goblinId];
      if (!goblin || !unit || !goblin.flags.alive || goblin.flags.missing) continue;
      const d = dist({ x: creature.microX, y: creature.microY }, { x: unit.microX, y: unit.microY });
      if (d < nearestDist) {
        nearestDist = d;
        nearestId = goblinId;
      }
    }
    if (!nearestId) return null;
    return { goblinId: nearestId, score: 0.5, confidence: 0.15 };
  }
  const confidence = clamp(bestScore / 10, 0, 1);
  return { goblinId: bestId, score: bestScore, confidence };
}

function assignHostileGoblinTargets(state, events) {
  const wildlife = state.worldMap?.wildlife;
  if (!wildlife?.allIds?.length) return;
  const tick = state.meta.tick;
  const candidateGoblinIds = [];
  for (const goblinId of state.goblins.allIds) {
    const goblin = state.goblins.byId[goblinId];
    if (!goblin || !goblin.flags?.alive || goblin.flags?.missing) continue;
    if (!findGoblinUnit(state, goblinId)) continue;
    candidateGoblinIds.push(goblinId);
  }
  if (!candidateGoblinIds.length) return;

  const ids = [...wildlife.allIds].sort();
  for (const id of ids) {
    const creature = wildlife.byId[id];
    if (!creature || !creature.alive || !isHostileKind(creature.kind)) continue;

    const hunt = ensureHuntState(creature);
    const committed = hunt.targetGoblinId && isValidGoblinTarget(state, hunt.targetGoblinId) && (hunt.targetCommitUntilTick || 0) >= tick;
    if (committed) {
      const targetUnit = findGoblinUnit(state, hunt.targetGoblinId);
      if (targetUnit) {
        hunt.lastKnownTargetTile = { tileX: targetUnit.microX, tileY: targetUnit.microY };
        hunt.mode = "chase";
      }
      continue;
    }
    if ((hunt.retargetAfterTick || 0) > tick) continue;

    const tuning = wildlifeTuning(state, creature.kind);
    const nextTarget = chooseHostileGoblinTarget(state, creature, candidateGoblinIds);
    if (!nextTarget) {
      hunt.targetGoblinId = undefined;
      hunt.targetScore = undefined;
      hunt.targetConfidence = undefined;
      hunt.mode = "patrol";
      continue;
    }

    const sameTarget = hunt.targetGoblinId === nextTarget.goblinId;
    const unit = findGoblinUnit(state, nextTarget.goblinId);
    hunt.targetGoblinId = nextTarget.goblinId;
    hunt.targetScore = nextTarget.score;
    hunt.targetConfidence = nextTarget.confidence;
    hunt.targetAcquiredTick = tick;
    hunt.targetCommitUntilTick = tick + tuning.targetCommitTicks;
    hunt.breakoffUntilTick = undefined;
    hunt.retargetAfterTick = tick + tuning.retargetCooldownTicks;
    hunt.lastKnownTargetTile = unit ? { tileX: unit.microX, tileY: unit.microY } : undefined;
    hunt.mode = "chase";
    creature.targetType = "goblin";
    creature.targetId = nextTarget.goblinId;

    if (!sameTarget) {
      events.push({
        type: "WILDLIFE_TARGET_ACQUIRED",
        wildlifeId: creature.id,
        wildlifeKind: creature.kind,
        goblinId: nextTarget.goblinId,
        targetConfidence: Number(nextTarget.confidence.toFixed(2)),
        text: `${creature.kind} ${creature.id} acquired goblin target ${nextTarget.goblinId}.`
      });
      events.push({
        type: "WILDLIFE_CHASE_STARTED",
        wildlifeId: creature.id,
        wildlifeKind: creature.kind,
        goblinId: nextTarget.goblinId,
        targetConfidence: Number(nextTarget.confidence.toFixed(2)),
        text: `${creature.kind} ${creature.id} started chasing goblin ${nextTarget.goblinId}.`
      });
    }
  }
}

function nearestWallToPoint(state, x, y, maxDist = 8) {
  let best = null;
  let bestDist = Infinity;
  for (const wall of Object.values(state.worldMap.structures?.wallsByTileKey || {})) {
    const d = dist({ x, y }, { x: wall.microX, y: wall.microY });
    if (d > maxDist) continue;
    if (d < bestDist) {
      bestDist = d;
      best = wall;
    }
  }
  return best;
}

function computePackCentroid(wildlife, pack) {
  const members = (pack.memberIds || [])
    .map((id) => wildlife.byId[id])
    .filter((c) => c && c.alive);
  if (!members.length) return null;
  let sx = 0;
  let sy = 0;
  for (const m of members) {
    sx += m.microX;
    sy += m.microY;
  }
  return { x: sx / members.length, y: sy / members.length, count: members.length };
}

function ensureBarbarianRetreatPoint(state, pack) {
  if (pack.retreatMicroX !== undefined && pack.retreatMicroY !== undefined) return;
  const maxMicroX = state.worldMap.width * TILES_PER_CHUNK - 1;
  const maxMicroY = state.worldMap.height * TILES_PER_CHUNK - 1;
  const side = Math.floor(rand01("barb-retreat-side", state.meta.seed, pack.id) * 4);
  pack.retreatMicroX = side === 1 ? maxMicroX : side === 3 ? 0 : Math.floor(rand01("barb-retreat-x", state.meta.seed, pack.id) * (maxMicroX + 1));
  pack.retreatMicroY = side === 0 ? 0 : side === 2 ? maxMicroY : Math.floor(rand01("barb-retreat-y", state.meta.seed, pack.id) * (maxMicroY + 1));
}

function assignBarbarianRaidPlans(state, events) {
  const wildlife = state.worldMap.wildlife;
  const barbarianKnobs = speciesKnobs(state, "barbarian");
  for (const pack of Object.values(wildlife.packsById || {})) {
    if (pack.kind !== "barbarian-band") continue;

    const centroid = computePackCentroid(wildlife, pack);
    if (!centroid) {
      pack.leaderId = null;
      continue;
    }

    if (!pack.leaderId || !wildlife.byId[pack.leaderId] || !wildlife.byId[pack.leaderId].alive) {
      const firstAlive = pack.memberIds.map((id) => wildlife.byId[id]).find((c) => c && c.alive);
      pack.leaderId = firstAlive?.id || null;
    }

    if (!pack.raidPhase) pack.raidPhase = "staging";
    if (!pack.lootStolen) pack.lootStolen = 0;
    if (!pack.phaseStartedTick) pack.phaseStartedTick = state.meta.tick;
    ensureBarbarianRetreatPoint(state, pack);

    if (pack.nextRaidTick && state.meta.tick < pack.nextRaidTick && pack.raidPhase === "staging") {
      continue;
    }

    if (!pack.targetSiteId) {
      const from = wildlife.byId[pack.leaderId];
      const preferred = state.worldMap.player.startingSiteId ? state.worldMap.sitesById[state.worldMap.player.startingSiteId] : null;
      const chosen = preferred || nearestSiteFrom(state, { x: from.microX, y: from.microY });
      if (chosen) {
        pack.targetSiteId = chosen.id;
        pack.targetMicroX = chosen.x * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
        pack.targetMicroY = chosen.y * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2);
        pack.raidPhase = "approach";
        pack.phaseStartedTick = state.meta.tick;
        events.push({
          type: "BARBARIAN_RAID_TARGETED",
          packId: pack.id,
          siteId: chosen.id,
          text: `Barbarian band ${pack.id} targeted ${chosen.name}.`
        });
      }
    }

    if (!pack.targetMicroX && !pack.targetMicroY) continue;

    if (pack.raidPhase === "approach") {
      if (dist(centroid, { x: pack.targetMicroX, y: pack.targetMicroY }) <= 7 + barbarianKnobs.raidBoldness * 2) {
        pack.raidPhase = "breach";
        pack.phaseStartedTick = state.meta.tick;
      }
    } else if (pack.raidPhase === "breach") {
      const wall = nearestWallToPoint(state, pack.targetMicroX, pack.targetMicroY, 8);
      if (!wall || state.meta.tick - pack.phaseStartedTick > Math.round(40 * barbarianKnobs.retreatBias)) {
        pack.raidPhase = "loot";
        pack.phaseStartedTick = state.meta.tick;
      }
    } else if (pack.raidPhase === "loot") {
      const lootCap = Math.max(2, Math.round(4 * barbarianKnobs.raidBoldness));
      if (pack.lootStolen >= lootCap || state.meta.tick - pack.phaseStartedTick > Math.round(60 * barbarianKnobs.retreatBias)) {
        pack.raidPhase = "retreat";
        pack.phaseStartedTick = state.meta.tick;
      }
    } else if (pack.raidPhase === "retreat") {
      if (dist(centroid, { x: pack.retreatMicroX, y: pack.retreatMicroY }) <= 4) {
        pack.raidPhase = "staging";
        pack.targetSiteId = undefined;
        pack.targetMicroX = undefined;
        pack.targetMicroY = undefined;
        pack.lootStolen = 0;
        pack.nextRaidTick = state.meta.tick + Math.round(80 * barbarianKnobs.retreatBias);
      }
    }
  }
}

function preferredRaiderTargetUnit(state, from) {
  let best = null;
  let bestScore = -Infinity;
  for (const [goblinId, unit] of Object.entries(state.worldMap.units?.byGoblinId || {})) {
    const goblin = state.goblins.byId[goblinId];
    if (!goblin || !goblin.flags?.alive || goblin.flags?.missing || !unit) continue;
    const role = unit?.roleState?.role || goblin.social?.role || "forager";
    const distScore = -dist(from, { x: unit.microX, y: unit.microY }) * 0.18;
    const roleBonus =
      role === "forager" || role === "hauler" || role === "water-runner" || role === "scout" || role === "fisherman" || role === "woodcutter"
        ? 3.1
        : 0.4;
    const wallPenalty = localWallDensity(state, unit.microX, unit.microY, 2) * 0.9;
    const outskirtsBonus = wallPenalty < 0.2 ? 1.6 : 0;
    const score = roleBonus + distScore + outskirtsBonus - wallPenalty;
    if (score > bestScore) {
      bestScore = score;
      best = { goblinId, unit };
    }
  }
  return best;
}

function assignHumanRaiderHarassPlans(state, events) {
  const wildlife = state.worldMap.wildlife;
  for (const pack of Object.values(wildlife.packsById || {})) {
    if (pack.kind !== "raider-band") continue;
    const aliveMembers = (pack.memberIds || [])
      .map((id) => wildlife.byId[id])
      .filter((c) => c && c.alive);
    if (!aliveMembers.length) {
      pack.leaderId = null;
      pack.targetGoblinId = undefined;
      continue;
    }
    if (!pack.leaderId || !wildlife.byId[pack.leaderId] || !wildlife.byId[pack.leaderId].alive) {
      pack.leaderId = aliveMembers[0].id;
    }
    const leader = wildlife.byId[pack.leaderId];
    const pref = preferredRaiderTargetUnit(state, { x: leader.microX, y: leader.microY });
    if (!pref) {
      pack.targetGoblinId = undefined;
      pack.targetMicroX = leader.homeMicroX;
      pack.targetMicroY = leader.homeMicroY;
      continue;
    }
    const changed = pack.targetGoblinId !== pref.goblinId;
    pack.targetGoblinId = pref.goblinId;
    pack.targetMicroX = pref.unit.microX;
    pack.targetMicroY = pref.unit.microY;
    if (changed) {
      events.push({
        type: "HUMAN_RAIDER_HARASS_PLAN_SET",
        packId: pack.id,
        goblinId: pref.goblinId,
        tileX: pref.unit.tileX,
        tileY: pref.unit.tileY,
        text: `Human raider band ${pack.id} shifted harassment target to goblin ${pref.goblinId}.`
      });
    }
  }
}

function maybeEmitBarbarianThreat(state, events) {
  const wildlife = state.worldMap.wildlife;
  const barbarianKnobs = speciesKnobs(state, "barbarian");
  const barbCfg = raceRuntimeConfig(state, "barbarian");
  if (!wildlife?.allIds?.length) return;
  if (state.meta.tick % 20 !== 0) return;
  const last = wildlife.lastBarbarianThreatTick || -1000;
  if (state.meta.tick - last < 20) return;

  let nearest = Infinity;
  for (const id of wildlife.allIds) {
    const c = wildlife.byId[id];
    if (!c || !c.alive || c.kind !== "barbarian") continue;
    const d = nearestGoblinHomeDistance(state, c.microX, c.microY);
    if (d < nearest) nearest = d;
  }
  if (nearest <= Number(barbCfg?.threat?.homeWarnDistance ?? 7) * barbarianKnobs.raidBoldness) {
    wildlife.lastBarbarianThreatTick = state.meta.tick;
    events.push({
      type: "BARBARIAN_RAID_NEAR_HOME",
      distance: Number(nearest.toFixed(2)),
      text: `Barbarian raiders are close to goblin homes (distance ${nearest.toFixed(1)}).`
    });
  }
}

function maybeEmitAdvancedThreat(state, events, kind) {
  const wildlife = state.worldMap.wildlife;
  const cfg = raceRuntimeConfig(state, kind);
  if (!wildlife?.allIds?.length) return;
  if (state.meta.tick % 24 !== 0) return;
  const markerKey = `lastThreatTick_${kind}`;
  const last = wildlife[markerKey] || -1000;
  if (state.meta.tick - last < 24) return;
  let nearest = Infinity;
  for (const id of wildlife.allIds) {
    const c = wildlife.byId[id];
    if (!c || !c.alive || c.kind !== kind) continue;
    const d = nearestGoblinHomeDistance(state, c.microX, c.microY);
    if (d < nearest) nearest = d;
  }
  if (!Number.isFinite(nearest)) return;
  if (nearest <= Number(cfg?.threat?.homeWarnDistance ?? 8)) {
    wildlife[markerKey] = state.meta.tick;
    events.push({
      type: "ADVANCED_THREAT_NEAR_HOME",
      wildlifeKind: kind,
      distance: Number(nearest.toFixed(2)),
      text: `${kind} pressure detected near goblin homes (distance ${nearest.toFixed(1)}).`
    });
  }
}

function updateNeeds(state, creature) {
  if (creature.kind === "fish") {
    const k = speciesKnobs(state, "fish");
    creature.hunger = clamp(creature.hunger + 0.25 * k.driftAmp, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.02, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.1, 0, 100);
    return;
  }
  if (creature.kind === "deer") {
    const k = speciesKnobs(state, "deer");
    creature.hunger = clamp(creature.hunger + 0.38 * k.grazeCadence, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.34, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.12, 0, 100);
    return;
  }
  if (creature.kind === "wolf") {
    const k = speciesKnobs(state, "wolf");
    creature.hunger = clamp(creature.hunger + 0.42 * k.huntPersistence, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.28, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.1, 0, 100);
    return;
  }
  if (creature.kind === "barbarian") {
    const k = speciesKnobs(state, "barbarian");
    creature.hunger = clamp(creature.hunger + 0.35 * k.raidBoldness, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.25, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.08, 0, 100);
    return;
  }
  if (creature.kind === "human_raider") {
    const k = speciesKnobs(state, "human_raider");
    creature.hunger = clamp(creature.hunger + 0.29 * k.harassBias, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.24, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.08 * k.disengageBias, 0, 100);
    return;
  }
  if (creature.kind === "ogre") {
    const k = speciesKnobs(state, "ogre");
    creature.hunger = clamp(creature.hunger + 0.31 * k.brutality, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.21, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.07 * k.siegeBias, 0, 100);
    return;
  }
  if (creature.kind === "shaman") {
    const k = speciesKnobs(state, "shaman");
    creature.hunger = clamp(creature.hunger + 0.24 * k.ritualBias, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.23, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.06 * k.curseBias, 0, 100);
    return;
  }
  if (creature.kind === "elf_ranger") {
    const k = speciesKnobs(state, "elf_ranger");
    creature.hunger = clamp(creature.hunger + 0.27 * k.volleyBias, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.22, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.08 * k.kitingBias, 0, 100);
    return;
  }
  if (creature.kind === "bear") {
    creature.hunger = clamp(creature.hunger + 0.32, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.24, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.07, 0, 100);
    return;
  }
  if (creature.kind === "snake") {
    creature.hunger = clamp(creature.hunger + 0.22, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.18, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.06, 0, 100);
    return;
  }
  if (creature.kind === "boar") {
    creature.hunger = clamp(creature.hunger + 0.31, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.21, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.08, 0, 100);
    return;
  }
  if (creature.kind === "crow") {
    creature.hunger = clamp(creature.hunger + 0.25, 0, 100);
    creature.thirst = clamp(creature.thirst + 0.22, 0, 100);
    creature.stamina = clamp(creature.stamina + 0.09, 0, 100);
  }
}

function chooseGoal(state, creature, tick) {
  const wildlife = state.worldMap.wildlife;
  const from = { x: creature.microX, y: creature.microY };
  const hunt = ensureHuntState(creature);
  const tuning = wildlifeTuning(state, creature.kind);

  if (creature.kind === "fish") {
    const fishKnobs = speciesKnobs(state, "fish");
    const currentKey = tileKey(creature.microX, creature.microY);
    if (!state.worldMap.waterSources?.byTileKey?.[currentKey]) {
      const source = findNearestSourceByPredicate(state, from, () => true);
      if (source) return { kind: "seek-water", targetX: source.microX, targetY: source.microY };
    }
    const schoolRadius = clamp(Math.round(5 / fishKnobs.schoolTightness), 2, 7);
    const school = localCentroid(wildlife, creature.id, "fish", creature.microX, creature.microY, schoolRadius);
    if (school) return { kind: "school", targetX: school.x, targetY: school.y };
    const drift = Math.max(3, Math.round(6 * fishKnobs.driftAmp));
    return {
      kind: "wander-water",
      targetX: clamp(creature.homeMicroX + Math.round((rand01("fish-x", tick, creature.id) - 0.5) * drift), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
      targetY: clamp(creature.homeMicroY + Math.round((rand01("fish-y", tick, creature.id) - 0.5) * drift), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
    };
  }

  if (creature.kind === "deer") {
    const deerKnobs = speciesKnobs(state, "deer");
    const predator = nearestPredatorForDeer(wildlife, creature.microX, creature.microY, 5 * deerKnobs.fleeBias);
    if (predator) return { kind: "flee", fromX: predator.microX, fromY: predator.microY, predatorId: predator.id };

    if (creature.thirst >= 65) {
      const source = findNearestSourceByPredicate(state, from, () => true);
      if (source) return { kind: "drink", targetX: source.microX, targetY: source.microY };
    }

    if (creature.hunger >= 55) {
      return {
        kind: "graze",
        targetX: clamp(creature.homeMicroX + Math.round((rand01("deer-graze-x", tick, creature.id) - 0.5) * 8), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
        targetY: clamp(creature.homeMicroY + Math.round((rand01("deer-graze-y", tick, creature.id) - 0.5) * 8), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
      };
    }

    const herd = localCentroid(wildlife, creature.id, "deer", creature.microX, creature.microY, 6);
    if (herd) return { kind: "group", targetX: herd.x, targetY: herd.y };

    return {
      kind: "wander",
      targetX: clamp(creature.homeMicroX + Math.round((rand01("deer-x", tick, creature.id) - 0.5) * 8), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
      targetY: clamp(creature.homeMicroY + Math.round((rand01("deer-y", tick, creature.id) - 0.5) * 8), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
    };
  }

  if (creature.kind === "wolf") {
    const wolfCfg = raceRuntimeConfig(state, "wolf");
    if (hunt.mode === "breakoff" && (hunt.breakoffUntilTick || 0) > tick) {
      return { kind: "breakoff", targetX: creature.homeMicroX, targetY: creature.homeMicroY };
    }
    if (hunt.targetGoblinId && isValidGoblinTarget(state, hunt.targetGoblinId)) {
      const targetUnit = findGoblinUnit(state, hunt.targetGoblinId);
      if (targetUnit) {
        hunt.lastKnownTargetTile = { tileX: targetUnit.microX, tileY: targetUnit.microY };
        const d = dist(from, { x: targetUnit.microX, y: targetUnit.microY });
        hunt.mode = d <= tuning.engageRange ? "engage" : "chase";
        return {
          kind: d <= tuning.engageRange ? "engage-goblin" : "hunt-goblin",
          targetId: hunt.targetGoblinId,
          targetX: targetUnit.microX,
          targetY: targetUnit.microY
        };
      }
    }
    if (hunt.lastKnownTargetTile && (hunt.targetCommitUntilTick || 0) >= tick) {
      hunt.targetGoblinId = undefined;
      hunt.mode = "stalk";
      return {
        kind: "stalk-goblin-last-known",
        targetX: hunt.lastKnownTargetTile.tileX,
        targetY: hunt.lastKnownTargetTile.tileY
      };
    }

    const wolfKnobs = speciesKnobs(state, "wolf");
    if (creature.thirst >= 72 * wolfKnobs.regroupBias) {
      const source = findNearestSourceByPredicate(state, from, () => true);
      if (source) return { kind: "drink", targetX: source.microX, targetY: source.microY };
    }

    const pack = state.worldMap.wildlife.packsById?.[creature.packId];
    const prey = pack?.targetWildlifeId ? state.worldMap.wildlife.byId?.[pack.targetWildlifeId] : null;
    if (prey && prey.alive) {
      return {
        kind: "hunt-deer",
        targetId: prey.id,
        targetX: prey.microX,
        targetY: prey.microY
      };
    }

    const localDeer = nearestCreatureByKind(state.worldMap.wildlife, "deer", from, true);
    if (localDeer && dist(from, { x: localDeer.microX, y: localDeer.microY }) <= 8 * wolfKnobs.huntPersistence) {
      return {
        kind: "hunt-deer",
        targetId: localDeer.id,
        targetX: localDeer.microX,
        targetY: localDeer.microY
      };
    }

    // Limited wolf pressure on goblin outskirts only under high hunger.
    if (creature.hunger >= 78) {
      const home = nearestGoblinHomeTarget(state, from);
      if (home) {
        return {
          kind: "pressure-goblin-outskirts",
          targetX: home.homeMicroX,
          targetY: home.homeMicroY
        };
      }
    }

    if (pack?.targetMicroX !== undefined && pack?.targetMicroY !== undefined) {
      return {
        kind: "regroup",
        targetX: pack.targetMicroX,
        targetY: pack.targetMicroY
      };
    }

    return {
      kind: "patrol",
      targetX: clamp(
        creature.homeMicroX + Math.round((rand01("wolf-x", tick, creature.id) - 0.5) * Math.round(Number(wolfCfg?.patrol?.wanderRadiusBase ?? 10) * wolfKnobs.regroupBias)),
        0,
        state.worldMap.width * TILES_PER_CHUNK - 1
      ),
      targetY: clamp(
        creature.homeMicroY + Math.round((rand01("wolf-y", tick, creature.id) - 0.5) * Math.round(Number(wolfCfg?.patrol?.wanderRadiusBase ?? 10) * wolfKnobs.regroupBias)),
        0,
        state.worldMap.height * TILES_PER_CHUNK - 1
      )
    };
  }

  if (creature.kind === "bear") {
    const bearKnobs = speciesKnobs(state, "bear");
    const memory = creature.aiMemory = creature.aiMemory || {};
    const territorialRadius = Math.max(4, Math.round(7 * bearKnobs.territoriality));
    const localGoblin = nearestGoblinUnit(state, from, territorialRadius);
    if (localGoblin) {
      memory.territoryTriggeredUntilTick = tick + 16;
      return {
        kind: "engage-goblin",
        targetId: localGoblin.goblinId,
        targetX: localGoblin.unit.microX,
        targetY: localGoblin.unit.microY
      };
    }
    if ((memory.territoryTriggeredUntilTick || 0) > tick) {
      const probe = nearestGoblinUnit(state, from, territorialRadius + 2);
      if (probe) {
        return {
          kind: "hunt-goblin",
          targetId: probe.goblinId,
          targetX: probe.unit.microX,
          targetY: probe.unit.microY
        };
      }
    }
    if (creature.thirst >= 74) {
      const source = findNearestSourceByPredicate(state, from, () => true);
      if (source) return { kind: "drink", targetX: source.microX, targetY: source.microY };
    }
    if (creature.hunger >= 66) {
      return {
        kind: "forage",
        targetX: clamp(creature.homeMicroX + Math.round((rand01("bear-forage-x", tick, creature.id) - 0.5) * 9), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
        targetY: clamp(creature.homeMicroY + Math.round((rand01("bear-forage-y", tick, creature.id) - 0.5) * 9), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
      };
    }
    return {
      kind: "bear-patrol",
      targetX: clamp(creature.homeMicroX + Math.round((rand01("bear-x", tick, creature.id) - 0.5) * 7 * bearKnobs.roamBias), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
      targetY: clamp(creature.homeMicroY + Math.round((rand01("bear-y", tick, creature.id) - 0.5) * 7 * bearKnobs.roamBias), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
    };
  }

  if (creature.kind === "snake") {
    const snakeKnobs = speciesKnobs(state, "snake");
    const strike = nearestGoblinUnit(state, from, Math.max(1.8, 2.4 * snakeKnobs.ambushBias));
    if (strike) {
      return {
        kind: "ambush-goblin",
        targetId: strike.goblinId,
        targetX: strike.unit.microX,
        targetY: strike.unit.microY
      };
    }
    if (creature.thirst >= 78) {
      const source = findNearestSourceByPredicate(state, from, () => true);
      if (source) return { kind: "drink", targetX: source.microX, targetY: source.microY };
    }
    if (creature.hunger >= 70) {
      return {
        kind: "snake-prowl",
        targetX: clamp(creature.homeMicroX + Math.round((rand01("snake-prowl-x", tick, creature.id) - 0.5) * 5 * snakeKnobs.slitherBias), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
        targetY: clamp(creature.homeMicroY + Math.round((rand01("snake-prowl-y", tick, creature.id) - 0.5) * 5 * snakeKnobs.slitherBias), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
      };
    }
    return {
      kind: "snake-coil",
      targetX: creature.homeMicroX,
      targetY: creature.homeMicroY
    };
  }

  if (creature.kind === "boar") {
    const boarKnobs = speciesKnobs(state, "boar");
    const memory = creature.aiMemory = creature.aiMemory || {};
    const localGoblin = nearestGoblinUnit(state, from, Math.max(2.4, 4.25 * boarKnobs.chargeBias));
    if (localGoblin) {
      if (memory.chargeTargetGoblinId === localGoblin.goblinId && (memory.chargeWindupUntilTick || 0) <= tick) {
        return {
          kind: "boar-charge",
          targetId: localGoblin.goblinId,
          targetX: localGoblin.unit.microX,
          targetY: localGoblin.unit.microY
        };
      }
      memory.chargeTargetGoblinId = localGoblin.goblinId;
      memory.chargeWindupUntilTick = tick + 2;
      return {
        kind: "boar-charge-windup",
        targetId: localGoblin.goblinId,
        targetX: localGoblin.unit.microX,
        targetY: localGoblin.unit.microY
      };
    }
    memory.chargeTargetGoblinId = undefined;
    memory.chargeWindupUntilTick = undefined;
    if (creature.thirst >= 74) {
      const source = findNearestSourceByPredicate(state, from, () => true);
      if (source) return { kind: "drink", targetX: source.microX, targetY: source.microY };
    }
    if (creature.hunger >= 62) {
      return {
        kind: "boar-root",
        targetX: clamp(creature.homeMicroX + Math.round((rand01("boar-root-x", tick, creature.id) - 0.5) * 7 * boarKnobs.rootBias), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
        targetY: clamp(creature.homeMicroY + Math.round((rand01("boar-root-y", tick, creature.id) - 0.5) * 7 * boarKnobs.rootBias), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
      };
    }
    return {
      kind: "boar-roam",
      targetX: clamp(creature.homeMicroX + Math.round((rand01("boar-x", tick, creature.id) - 0.5) * 6), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
      targetY: clamp(creature.homeMicroY + Math.round((rand01("boar-y", tick, creature.id) - 0.5) * 6), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
    };
  }

  if (creature.kind === "crow") {
    const crowKnobs = speciesKnobs(state, "crow");
    const home = nearestGoblinHomeTarget(state, from);
    if (home && dist(from, { x: home.homeMicroX, y: home.homeMicroY }) <= 12 * crowKnobs.scoutBias) {
      return {
        kind: "crow-scout",
        targetX: home.homeMicroX,
        targetY: home.homeMicroY
      };
    }
    const flock = localCentroid(wildlife, creature.id, "crow", creature.microX, creature.microY, 8);
    if (flock) return { kind: "crow-flock", targetX: flock.x, targetY: flock.y };
    return {
      kind: "crow-perch",
      targetX: clamp(creature.homeMicroX + Math.round((rand01("crow-x", tick, creature.id) - 0.5) * 10 * crowKnobs.flockBias), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
      targetY: clamp(creature.homeMicroY + Math.round((rand01("crow-y", tick, creature.id) - 0.5) * 10 * crowKnobs.flockBias), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
    };
  }

  if (creature.kind === "human_raider") {
    const raiderCfg = raceRuntimeConfig(state, "human_raider");
    if (hunt.mode === "breakoff" && (hunt.breakoffUntilTick || 0) > tick) {
      return { kind: "raider-disengage", targetX: creature.homeMicroX, targetY: creature.homeMicroY };
    }
    if (hunt.targetGoblinId && isValidGoblinTarget(state, hunt.targetGoblinId)) {
      const targetUnit = findGoblinUnit(state, hunt.targetGoblinId);
      if (targetUnit) {
        const defenders = nearbyGoblinCount(state, targetUnit.microX, targetUnit.microY, 2);
        const wallDensity = localWallDensity(state, targetUnit.microX, targetUnit.microY, 2);
        if (defenders >= 3 || wallDensity >= 2) {
          hunt.mode = "breakoff";
          hunt.breakoffUntilTick = tick + tuning.breakoffTicks;
          hunt.targetGoblinId = undefined;
          return { kind: "raider-disengage", targetX: creature.homeMicroX, targetY: creature.homeMicroY };
        }
        hunt.lastKnownTargetTile = { tileX: targetUnit.microX, tileY: targetUnit.microY };
        const d = dist(from, { x: targetUnit.microX, y: targetUnit.microY });
        hunt.mode = d <= tuning.engageRange ? "engage" : "chase";
        return {
          kind: d <= tuning.engageRange ? "engage-goblin" : "harass-goblin",
          targetId: hunt.targetGoblinId,
          targetX: targetUnit.microX,
          targetY: targetUnit.microY
        };
      }
    }

    const pack = state.worldMap.wildlife.packsById?.[creature.packId];
    if (pack?.targetGoblinId && isValidGoblinTarget(state, pack.targetGoblinId)) {
      const unit = findGoblinUnit(state, pack.targetGoblinId);
      if (unit) {
        return {
          kind: "harass-goblin",
          targetId: pack.targetGoblinId,
          targetX: unit.microX,
          targetY: unit.microY
        };
      }
    }
    if (pack?.targetMicroX !== undefined && pack?.targetMicroY !== undefined) {
      return {
        kind: "raider-patrol",
        targetX: pack.targetMicroX,
        targetY: pack.targetMicroY
      };
    }

    return {
      kind: "raider-patrol",
      targetX: clamp(
        creature.homeMicroX + Math.round((rand01("raider-x", tick, creature.id) - 0.5) * Math.round(Number(raiderCfg?.patrol?.wanderRadiusBase ?? 8))),
        0,
        state.worldMap.width * TILES_PER_CHUNK - 1
      ),
      targetY: clamp(
        creature.homeMicroY + Math.round((rand01("raider-y", tick, creature.id) - 0.5) * Math.round(Number(raiderCfg?.patrol?.wanderRadiusBase ?? 8))),
        0,
        state.worldMap.height * TILES_PER_CHUNK - 1
      )
    };
  }

  if (creature.kind === "elf_ranger") {
    const rangerCfg = raceRuntimeConfig(state, "elf_ranger");
    if (hunt.mode === "breakoff" && (hunt.breakoffUntilTick || 0) > tick) {
      return { kind: "ranger-disengage", targetX: creature.homeMicroX, targetY: creature.homeMicroY };
    }
    if (hunt.targetGoblinId && isValidGoblinTarget(state, hunt.targetGoblinId)) {
      const targetUnit = findGoblinUnit(state, hunt.targetGoblinId);
      if (targetUnit) {
        const defenders = nearbyGoblinCount(state, targetUnit.microX, targetUnit.microY, 2);
        if (defenders >= 4) {
          hunt.mode = "breakoff";
          hunt.breakoffUntilTick = tick + tuning.breakoffTicks;
          hunt.targetGoblinId = undefined;
          return { kind: "ranger-disengage", targetX: creature.homeMicroX, targetY: creature.homeMicroY };
        }
        hunt.lastKnownTargetTile = { tileX: targetUnit.microX, tileY: targetUnit.microY };
        return {
          kind: "harass-goblin",
          targetId: hunt.targetGoblinId,
          targetX: targetUnit.microX,
          targetY: targetUnit.microY
        };
      }
    }
    return {
      kind: "ranger-patrol",
      targetX: clamp(
        creature.homeMicroX + Math.round((rand01("ranger-x", tick, creature.id) - 0.5) * Math.round(Number(rangerCfg?.patrol?.wanderRadiusBase ?? 9))),
        0,
        state.worldMap.width * TILES_PER_CHUNK - 1
      ),
      targetY: clamp(
        creature.homeMicroY + Math.round((rand01("ranger-y", tick, creature.id) - 0.5) * Math.round(Number(rangerCfg?.patrol?.wanderRadiusBase ?? 9))),
        0,
        state.worldMap.height * TILES_PER_CHUNK - 1
      )
    };
  }

  if (creature.kind === "shaman") {
    const shamanCfg = raceRuntimeConfig(state, "shaman");
    const allyCenter = localCentroid(state.worldMap.wildlife, creature.id, "barbarian", creature.microX, creature.microY, 12)
      || localCentroid(state.worldMap.wildlife, creature.id, "ogre", creature.microX, creature.microY, 12);
    if (hunt.targetGoblinId && isValidGoblinTarget(state, hunt.targetGoblinId)) {
      const targetUnit = findGoblinUnit(state, hunt.targetGoblinId);
      if (targetUnit) {
        return {
          kind: "hex-goblin",
          targetId: hunt.targetGoblinId,
          targetX: targetUnit.microX,
          targetY: targetUnit.microY
        };
      }
    }
    if (allyCenter) {
      return {
        kind: "ritual-support",
        targetX: allyCenter.x,
        targetY: allyCenter.y
      };
    }
    return {
      kind: "shaman-patrol",
      targetX: clamp(
        creature.homeMicroX + Math.round((rand01("shaman-x", tick, creature.id) - 0.5) * Math.round(Number(shamanCfg?.patrol?.wanderRadiusBase ?? 7))),
        0,
        state.worldMap.width * TILES_PER_CHUNK - 1
      ),
      targetY: clamp(
        creature.homeMicroY + Math.round((rand01("shaman-y", tick, creature.id) - 0.5) * Math.round(Number(shamanCfg?.patrol?.wanderRadiusBase ?? 7))),
        0,
        state.worldMap.height * TILES_PER_CHUNK - 1
      )
    };
  }

  if (creature.kind === "ogre") {
    const ogreCfg = raceRuntimeConfig(state, "ogre");
    const wall = nearestWallToPoint(state, creature.microX, creature.microY, 7);
    if (wall) {
      return { kind: "ogre-breach", targetX: wall.microX, targetY: wall.microY, wallKey: wall.key };
    }
    if (hunt.targetGoblinId && isValidGoblinTarget(state, hunt.targetGoblinId)) {
      const targetUnit = findGoblinUnit(state, hunt.targetGoblinId);
      if (targetUnit) {
        return {
          kind: "hunt-goblin",
          targetId: hunt.targetGoblinId,
          targetX: targetUnit.microX,
          targetY: targetUnit.microY
        };
      }
    }
    const home = nearestGoblinHomeTarget(state, from);
    if (home) return { kind: "siege-march", targetX: home.homeMicroX, targetY: home.homeMicroY };
    return {
      kind: "ogre-patrol",
      targetX: clamp(
        creature.homeMicroX + Math.round((rand01("ogre-x", tick, creature.id) - 0.5) * Math.round(Number(ogreCfg?.patrol?.wanderRadiusBase ?? 6))),
        0,
        state.worldMap.width * TILES_PER_CHUNK - 1
      ),
      targetY: clamp(
        creature.homeMicroY + Math.round((rand01("ogre-y", tick, creature.id) - 0.5) * Math.round(Number(ogreCfg?.patrol?.wanderRadiusBase ?? 6))),
        0,
        state.worldMap.height * TILES_PER_CHUNK - 1
      )
    };
  }

  if (creature.kind === "barbarian") {
    const barbCfg = raceRuntimeConfig(state, "barbarian");
    if (hunt.mode === "breakoff" && (hunt.breakoffUntilTick || 0) > tick) {
      return { kind: "breakoff", targetX: creature.homeMicroX, targetY: creature.homeMicroY };
    }
    if (hunt.targetGoblinId && isValidGoblinTarget(state, hunt.targetGoblinId)) {
      const targetUnit = findGoblinUnit(state, hunt.targetGoblinId);
      if (targetUnit) {
        hunt.lastKnownTargetTile = { tileX: targetUnit.microX, tileY: targetUnit.microY };
        const d = dist(from, { x: targetUnit.microX, y: targetUnit.microY });
        hunt.mode = d <= tuning.engageRange ? "engage" : "chase";
        return {
          kind: d <= tuning.engageRange ? "engage-goblin" : "hunt-goblin",
          targetId: hunt.targetGoblinId,
          targetX: targetUnit.microX,
          targetY: targetUnit.microY
        };
      }
    }
    if (hunt.lastKnownTargetTile && (hunt.targetCommitUntilTick || 0) >= tick) {
      hunt.targetGoblinId = undefined;
      hunt.mode = "stalk";
      return {
        kind: "stalk-goblin-last-known",
        targetX: hunt.lastKnownTargetTile.tileX,
        targetY: hunt.lastKnownTargetTile.tileY
      };
    }

    const barbarianKnobs = speciesKnobs(state, "barbarian");
    const pack = state.worldMap.wildlife.packsById?.[creature.packId];
    if (!pack) {
      return {
        kind: "wander",
        targetX: clamp(
          creature.homeMicroX + Math.round((rand01("barb-x", tick, creature.id) - 0.5) * Math.round(Number(barbCfg?.patrol?.wanderRadiusBase ?? 8) * barbarianKnobs.raidBoldness)),
          0,
          state.worldMap.width * TILES_PER_CHUNK - 1
        ),
        targetY: clamp(
          creature.homeMicroY + Math.round((rand01("barb-y", tick, creature.id) - 0.5) * Math.round(Number(barbCfg?.patrol?.wanderRadiusBase ?? 8) * barbarianKnobs.raidBoldness)),
          0,
          state.worldMap.height * TILES_PER_CHUNK - 1
        )
      };
    }

    if (pack.raidPhase === "approach") {
      return { kind: "raid-approach", targetX: pack.targetMicroX, targetY: pack.targetMicroY };
    }

    if (pack.raidPhase === "breach") {
      const wall = nearestWallToPoint(state, creature.microX, creature.microY, 6)
        || nearestWallToPoint(state, pack.targetMicroX || creature.microX, pack.targetMicroY || creature.microY, 8);
      if (wall) {
        return { kind: "raid-breach", targetX: wall.microX, targetY: wall.microY, wallKey: wall.key };
      }
      return { kind: "raid-loot", targetX: pack.targetMicroX, targetY: pack.targetMicroY };
    }

    if (pack.raidPhase === "loot") {
      const home = nearestGoblinHomeTarget(state, { x: creature.microX, y: creature.microY });
      if (home) {
        return { kind: "raid-loot", targetX: home.homeMicroX, targetY: home.homeMicroY };
      }
      return { kind: "raid-loot", targetX: pack.targetMicroX, targetY: pack.targetMicroY };
    }

    if (pack.raidPhase === "retreat") {
      return { kind: "raid-retreat", targetX: pack.retreatMicroX, targetY: pack.retreatMicroY };
    }

    return {
      kind: "staging",
      targetX: creature.homeMicroX,
      targetY: creature.homeMicroY
    };
  }

  return null;
}

function chooseNextStep(state, creature, goal, occupiedNext) {
  const wm = state.worldMap;
  const target = goal?.targetX !== undefined ? { x: goal.targetX, y: goal.targetY } : null;
  const seasonKey = String(state.world?.season?.key || "spring");
  const weatherKey = String(state.world?.weather?.current || state.world?.weather?.type || "clear");
  const hostileWinterPressure = (seasonKey === "winter" || weatherKey === "storm" || weatherKey === "cold-snap") && isHostileKind(creature.kind);
  const pressureHome = hostileWinterPressure ? nearestGoblinHomeTarget(state, { x: creature.microX, y: creature.microY }) : null;

  let best = { x: creature.microX, y: creature.microY, score: -Infinity };
  for (const off of NEIGHBOR_OFFSETS) {
    const nx = clamp(creature.microX + off.x, 0, wm.width * TILES_PER_CHUNK - 1);
    const ny = clamp(creature.microY + off.y, 0, wm.height * TILES_PER_CHUNK - 1);
    const k = tileKey(nx, ny);
    if (occupiedNext.has(k) && occupiedNext.get(k) !== creature.id) continue;

    const tileX = clamp(tileToChunkCoord(nx), 0, wm.width - 1);
    const tileY = clamp(tileToChunkCoord(ny), 0, wm.height - 1);
    const region = wm.regionsById[wm.regionGrid[tileY][tileX]];
    const isWater = isWaterMicroTile(wm, nx, ny);
    const blockedByWall = Boolean(wm.structures?.wallsByTileKey?.[k]);

    if (creature.kind === "fish" && !isWater) continue;
    if (blocksWater(creature.kind, goal?.kind) && isWater) continue;
    if (blockedByWall && blocksWalls(creature.kind)) continue;
    if (blocksWalls(creature.kind) && blocksDiagonalWallCorner(wm, creature.microX, creature.microY, nx, ny)) continue;

    let score = 0;
    if (target) {
      const before = dist({ x: creature.microX, y: creature.microY }, target);
      const after = dist({ x: nx, y: ny }, target);
      score += (before - after) * 0.9;
    }

    if (goal?.kind === "flee") {
      const d = dist({ x: nx, y: ny }, { x: goal.fromX, y: goal.fromY });
      score += d * 0.8;
      score -= region.hazardPressure * 0.2;
    } else if (creature.kind === "deer") {
      score += (region.resourcePotential?.food || 0) * 0.3;
      score -= region.hazardPressure * 0.25;
    } else if (creature.kind === "wolf") {
      if (goal?.kind === "hunt-deer") score += 0.35;
      score -= region.hazardPressure * 0.12;
    } else if (creature.kind === "barbarian") {
      if (goal?.kind === "raid-breach") score += 0.42;
      if (goal?.kind === "raid-loot") score += 0.28;
      if (goal?.kind === "raid-retreat") score += 0.25;
      score -= region.hazardPressure * 0.08;
    } else if (creature.kind === "human_raider") {
      if (goal?.kind === "harass-goblin") score += 0.33;
      if (goal?.kind === "raider-disengage") score += 0.24;
      score -= region.hazardPressure * 0.1;
    } else if (creature.kind === "elf_ranger") {
      if (goal?.kind === "harass-goblin") score += 0.32;
      if (goal?.kind === "ranger-disengage") score += 0.24;
      score -= region.hazardPressure * 0.08;
    } else if (creature.kind === "shaman") {
      if (goal?.kind === "hex-goblin") score += 0.22;
      if (goal?.kind === "ritual-support") score += 0.28;
      score -= region.hazardPressure * 0.05;
    } else if (creature.kind === "ogre") {
      if (goal?.kind === "ogre-breach") score += 0.48;
      if (goal?.kind === "siege-march") score += 0.31;
      score -= region.hazardPressure * 0.02;
    } else if (creature.kind === "bear") {
      if (goal?.kind === "engage-goblin") score += 0.36;
      if (goal?.kind === "hunt-goblin") score += 0.28;
      score -= region.hazardPressure * 0.08;
    } else if (creature.kind === "snake") {
      if (goal?.kind === "ambush-goblin") score += 0.4;
      score += (region.hazardPressure || 0) * 0.04;
    } else if (creature.kind === "boar") {
      if (goal?.kind === "boar-charge") score += 0.44;
      if (goal?.kind === "boar-charge-windup") score += 0.2;
      score -= region.hazardPressure * 0.05;
    } else if (creature.kind === "crow") {
      if (goal?.kind === "crow-scout") score += 0.25;
      score -= region.hazardPressure * 0.04;
    } else {
      score -= region.hazardPressure * 0.1;
    }

    // Climate migration bias (bounded): winter/severe weather nudges hostiles inward.
    if (pressureHome) {
      const before = dist({ x: creature.microX, y: creature.microY }, { x: pressureHome.homeMicroX, y: pressureHome.homeMicroY });
      const after = dist({ x: nx, y: ny }, { x: pressureHome.homeMicroX, y: pressureHome.homeMicroY });
      score += (before - after) * 0.18;
    }
    if (creature.kind === "deer" && seasonKey === "winter") {
      if (region.biome === "forest" || region.biome === "hills") score += 0.12;
      else score -= 0.08;
    }

    score -= dist({ x: nx, y: ny }, { x: creature.homeMicroX, y: creature.homeMicroY }) * 0.03;
    score += rand01("wild-step", state.meta.tick, creature.id, nx, ny) * 0.18;

    if (score > best.score) best = { x: nx, y: ny, score };
  }

  if (best.x === creature.microX && best.y === creature.microY && goal?.kind && goal.kind !== "staging") {
    const detour = findDetourStepForWildlife(state, creature, goal, occupiedNext);
    if (detour) return detour;
  }

  return { x: best.x, y: best.y };
}

function findDetourStepForWildlife(state, creature, goal, occupiedNext) {
  const wm = state.worldMap;
  const target = goal?.targetX !== undefined ? { x: goal.targetX, y: goal.targetY } : null;
  if (!target) return null;

  const maxDepth = 18;
  const maxVisited = 420;
  const neighborOffsets = NEIGHBOR_OFFSETS.filter((o) => !(o.x === 0 && o.y === 0));
  const queue = [{
    x: creature.microX,
    y: creature.microY,
    depth: 0,
    firstStep: null
  }];
  const visited = new Set([tileKey(creature.microX, creature.microY)]);

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
      if (occupiedNext.has(key) && occupiedNext.get(key) !== creature.id) continue;

      const isWater = isWaterMicroTile(wm, nx, ny);
      const blockedByWall = Boolean(wm.structures?.wallsByTileKey?.[key]);
      if (creature.kind === "fish" && !isWater) continue;
      if (blocksWater(creature.kind, goal?.kind) && isWater) continue;
      if (blockedByWall && blocksWalls(creature.kind)) continue;
      if (blocksWalls(creature.kind) && blocksDiagonalWallCorner(wm, node.x, node.y, nx, ny)) continue;

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

function rebuildOccupancy(wildlife) {
  const occ = {};
  for (const id of wildlife.allIds) {
    const creature = wildlife.byId[id];
    if (!creature || !creature.alive) continue;
    const key = tileKey(creature.microX, creature.microY);
    if (!occ[key]) occ[key] = [];
    occ[key].push(id);
  }
  wildlife.occupancyByMicroKey = occ;
}

function maybeDoAction(state, creature, goal, tick) {
  if (!goal) return null;
  const key = tileKey(creature.microX, creature.microY);
  const isWater = Boolean(state.worldMap.waterSources?.byTileKey?.[key]);
  const tuning = wildlifeTuning(state, creature.kind);

  if (creature.kind === "deer" && goal.kind === "drink" && isWater) {
    const before = creature.thirst;
    creature.thirst = clamp(creature.thirst - 22, 0, 100);
    if (before - creature.thirst >= 8) {
      return {
        type: "DEER_DRANK",
        creatureId: creature.id,
        at: key,
        text: `A deer drank water at ${key}.`
      };
    }
  }

  if (creature.kind === "deer" && goal.kind === "graze") {
    const deerKnobs = speciesKnobs(state, "deer");
    const cadence = Math.max(4, Math.round(9 * deerKnobs.grazeCadence));
    if (tick % cadence !== 0) return null;
    const before = creature.hunger;
    creature.hunger = clamp(creature.hunger - 16, 0, 100);
    if (before - creature.hunger >= 6) {
      return {
        type: "DEER_GRAZED",
        creatureId: creature.id,
        at: key,
        text: `A deer grazed in the ${state.worldMap.regionsById[state.worldMap.regionGrid[creature.tileY][creature.tileX]].biome}.`
      };
    }
  }

  if (creature.kind === "wolf" && goal.kind === "drink" && isWater) {
    creature.thirst = clamp(creature.thirst - 18, 0, 100);
    return null;
  }

  if ((creature.kind === "bear" || creature.kind === "boar" || creature.kind === "snake") && goal.kind === "drink" && isWater) {
    creature.thirst = clamp(creature.thirst - (creature.kind === "snake" ? 12 : 18), 0, 100);
    return null;
  }

  if (creature.kind === "wolf" && goal.kind === "hunt-deer" && goal.targetId) {
    const wolfKnobs = speciesKnobs(state, "wolf");
    const deer = state.worldMap.wildlife.byId?.[goal.targetId];
    if (deer && deer.alive) {
      const d = dist({ x: creature.microX, y: creature.microY }, { x: deer.microX, y: deer.microY });
      if (d <= 1.5) {
        deer.alive = false;
        deer.despawnTick = tick;
        creature.hunger = clamp(creature.hunger - 30 * wolfKnobs.huntPersistence, 0, 100);
        return {
          type: "WOLF_KILLED_DEER",
          wolfId: creature.id,
          deerId: deer.id,
          at: key,
          text: `Wolf ${creature.id} killed deer ${deer.id} at ${key}.`
        };
      }
    }
  }

  if (
    (creature.kind === "wolf"
      || creature.kind === "barbarian"
      || creature.kind === "human_raider"
      || creature.kind === "ogre"
      || creature.kind === "shaman"
      || creature.kind === "elf_ranger"
      || creature.kind === "bear"
      || creature.kind === "snake"
      || creature.kind === "boar")
    && (goal.kind === "engage-goblin" || goal.kind === "harass-goblin" || goal.kind === "ambush-goblin" || goal.kind === "boar-charge" || goal.kind === "hex-goblin")
    && goal.targetId
  ) {
    const targetUnit = findGoblinUnit(state, goal.targetId);
    if (!targetUnit) return null;
    const d = dist({ x: creature.microX, y: creature.microY }, { x: targetUnit.microX, y: targetUnit.microY });
    const allowedRange = creature.kind === "elf_ranger" ? Math.max(3.8, tuning.engageRange + 2.1) : tuning.engageRange;
    if (d > allowedRange) return null;
    const attackEvents = applyWildlifeAttackToGoblin(state, creature, goal.targetId, tick, key);
    if (creature.kind === "shaman" && attackEvents.length) {
      attackEvents.unshift({
        type: "SHAMAN_HEXED_GOBLIN",
        wildlifeId: creature.id,
        wildlifeKind: creature.kind,
        goblinId: goal.targetId,
        tileX: targetUnit.tileX,
        tileY: targetUnit.tileY,
        text: `Shaman ${creature.id} hexed goblin ${goal.targetId}.`
      });
    }
    if (creature.kind === "human_raider") {
      const role = targetUnit?.roleState?.role || state.goblins.byId?.[goal.targetId]?.social?.role || "forager";
      if (role === "forager" || role === "hauler" || role === "water-runner" || role === "scout" || role === "woodcutter" || role === "fisherman") {
        attackEvents.unshift({
          type: "HUMAN_RAIDER_HARASSED_FORAGER",
          wildlifeId: creature.id,
          wildlifeKind: creature.kind,
          goblinId: goal.targetId,
          role,
          tileX: targetUnit.tileX,
          tileY: targetUnit.tileY,
          text: `Human raider ${creature.id} harassed ${goal.targetId} (${role}).`
        });
      }
    }
    return attackEvents;
  }

  if (creature.kind === "ogre" && goal.kind === "ogre-breach") {
    const wall = state.worldMap.structures?.wallsByTileKey?.[goal.wallKey] || null;
    if (!wall) return null;
    const d = dist({ x: creature.microX, y: creature.microY }, { x: wall.microX, y: wall.microY });
    if (d <= 1.8) {
      delete state.worldMap.structures.wallsByTileKey[goal.wallKey];
      return {
        type: "OGRE_SMASHED_WALL",
        wildlifeId: creature.id,
        packId: creature.packId,
        wallKey: goal.wallKey,
        text: `Ogre ${creature.id} smashed wall ${goal.wallKey}.`
      };
    }
  }

  if (creature.kind === "crow" && (goal.kind === "crow-scout" || goal.kind === "crow-perch" || goal.kind === "crow-flock")) {
    const canSignal = (creature.lastScoutSignalTick || 0) + 20 <= tick;
    if (!canSignal) return null;
    const home = nearestGoblinHomeTarget(state, { x: creature.microX, y: creature.microY });
    if (!home) return null;
    const d = dist({ x: creature.microX, y: creature.microY }, { x: home.homeMicroX, y: home.homeMicroY });
    if (d > 4.5) return null;
    creature.lastScoutSignalTick = tick;
    return {
      type: "CROW_SPOTTED_COLONY",
      wildlifeId: creature.id,
      wildlifeKind: creature.kind,
      at: key,
      text: `Crow ${creature.id} spotted activity near goblin homes at ${key}.`
    };
  }

  if (creature.kind === "barbarian" && goal.kind === "raid-breach") {
    const wall = state.worldMap.structures?.wallsByTileKey?.[goal.wallKey] || null;
    if (!wall) return null;
    const d = dist({ x: creature.microX, y: creature.microY }, { x: wall.microX, y: wall.microY });
    if (d <= 1.5) {
      delete state.worldMap.structures.wallsByTileKey[goal.wallKey];
      return {
        type: "BARBARIAN_DAMAGED_WALL",
        barbarianId: creature.id,
        packId: creature.packId,
        wallKey: goal.wallKey,
        text: `Barbarian ${creature.id} broke wall ${goal.wallKey}.`
      };
    }
  }

  if (creature.kind === "barbarian" && goal.kind === "raid-loot") {
    const barbarianKnobs = speciesKnobs(state, "barbarian");
    const home = nearestGoblinHomeTarget(state, { x: creature.microX, y: creature.microY });
    if (!home) return null;
    const d = dist({ x: creature.microX, y: creature.microY }, { x: home.homeMicroX, y: home.homeMicroY });
    if (d > 2.0) return null;

    const tribeRes = state.tribe.resources;
    const stealOrder = ["food", "water", "wood", "mushrooms"];
    let stolenKey = null;
    for (const key of stealOrder) {
      if ((tribeRes[key] || 0) > 0) {
        stolenKey = key;
        break;
      }
    }
    if (!stolenKey) return null;
    const stealAmount = Math.max(1, Math.round(barbarianKnobs.raidBoldness));
    tribeRes[stolenKey] = Math.max(0, (tribeRes[stolenKey] || 0) - stealAmount);
    const pack = creature.packId ? state.worldMap.wildlife.packsById?.[creature.packId] : null;
    if (pack) pack.lootStolen = (pack.lootStolen || 0) + stealAmount;
    return {
      type: "BARBARIAN_STOLE_RESOURCE",
      barbarianId: creature.id,
      packId: creature.packId,
      resource: stolenKey,
      amount: stealAmount,
      text: `Barbarian ${creature.id} stole ${stealAmount} ${stolenKey} from goblin homes.`
    };
  }

  return null;
}

export function wildlifeSimulationSystem(state) {
  const events = [];
  const wm = state.worldMap;
  const wildlife = wm?.wildlife;
  if (!wildlife?.allIds?.length) return events;

  maybeSpawnBarbarianReinforcements(state, events);
  maybeSpawnAdvancedHostiles(state, events);
  syncEnemyOutpostsFromPacks(state, events);
  assignHostileGoblinTargets(state, events);
  assignHumanRaiderHarassPlans(state, events);
  assignWolfPackTargets(state, events);
  assignBarbarianRaidPlans(state, events);

  const occupiedNext = new Map();
  const ids = [...wildlife.allIds].sort();

  for (const id of ids) {
    const creature = wildlife.byId[id];
    if (!creature || !creature.alive) continue;
    if (
      creature.kind !== "fish"
      && creature.kind !== "deer"
      && creature.kind !== "wolf"
      && creature.kind !== "barbarian"
      && creature.kind !== "human_raider"
      && creature.kind !== "ogre"
      && creature.kind !== "shaman"
      && creature.kind !== "elf_ranger"
      && creature.kind !== "bear"
      && creature.kind !== "snake"
      && creature.kind !== "boar"
      && creature.kind !== "crow"
    ) {
      occupiedNext.set(tileKey(creature.microX, creature.microY), creature.id);
      continue;
    }

    updateNeeds(state, creature);
    const goal = chooseGoal(state, creature, state.meta.tick);
    if (goal) creature.aiState = goal.kind;
    const hunt = ensureHuntState(creature);
    const wasHunting = hunt.mode === "chase" || hunt.mode === "stalk" || hunt.mode === "engage";

    if (isHostileKind(creature.kind)) {
      const tuning = wildlifeTuning(state, creature.kind);
      const hasValidTarget = hunt.targetGoblinId && isValidGoblinTarget(state, hunt.targetGoblinId);
      const commitExpired = (hunt.targetCommitUntilTick || 0) < state.meta.tick;
      if (!hasValidTarget && !hunt.lastKnownTargetTile && wasHunting) {
        hunt.mode = "breakoff";
        hunt.breakoffUntilTick = state.meta.tick + tuning.breakoffTicks;
        hunt.targetGoblinId = undefined;
        hunt.targetCommitUntilTick = undefined;
        hunt.retargetAfterTick = state.meta.tick + tuning.breakoffTicks;
        events.push({
          type: "WILDLIFE_BROKE_OFF",
          wildlifeId: creature.id,
          wildlifeKind: creature.kind,
          text: `${creature.kind} ${creature.id} broke off pursuit.`
        });
      } else if (commitExpired && !hasValidTarget && hunt.mode !== "breakoff") {
        hunt.mode = "breakoff";
        hunt.breakoffUntilTick = state.meta.tick + tuning.breakoffTicks;
        hunt.targetGoblinId = undefined;
        hunt.targetCommitUntilTick = undefined;
        hunt.retargetAfterTick = state.meta.tick + tuning.breakoffTicks;
        events.push({
          type: "WILDLIFE_BROKE_OFF",
          wildlifeId: creature.id,
          wildlifeKind: creature.kind,
          text: `${creature.kind} ${creature.id} broke off pursuit.`
        });
      } else if (hunt.mode === "breakoff" && (hunt.breakoffUntilTick || 0) <= state.meta.tick) {
        hunt.mode = "patrol";
        hunt.breakoffUntilTick = undefined;
        hunt.lastKnownTargetTile = undefined;
      }
    }

    const prev = { x: creature.microX, y: creature.microY };
    const next = chooseNextStep(state, creature, goal, occupiedNext);
    creature.microX = next.x;
    creature.microY = next.y;
    creature.tileX = clamp(tileToChunkCoord(creature.microX), 0, wm.width - 1);
    creature.tileY = clamp(tileToChunkCoord(creature.microY), 0, wm.height - 1);
    occupiedNext.set(tileKey(creature.microX, creature.microY), creature.id);

    if (creature.kind === "deer" && goal?.kind === "flee" && (prev.x !== next.x || prev.y !== next.y)) {
      events.push({
        type: "DEER_FLED",
        creatureId: creature.id,
        predatorId: goal.predatorId,
        from: tileKey(prev.x, prev.y),
        to: tileKey(next.x, next.y),
        text: `A deer fled from danger near ${tileKey(next.x, next.y)}.`
      });
    }

    const actionEvent = maybeDoAction(state, creature, goal, state.meta.tick);
    if (Array.isArray(actionEvent)) events.push(...actionEvent);
    else if (actionEvent) events.push(actionEvent);
  }

  rebuildOccupancy(wildlife);
  maybeEmitWolfThreat(state, events);
  maybeEmitBarbarianThreat(state, events);
  maybeEmitAdvancedThreat(state, events, "elf_ranger");
  maybeEmitAdvancedThreat(state, events, "shaman");
  maybeEmitAdvancedThreat(state, events, "ogre");
  return events;
}
