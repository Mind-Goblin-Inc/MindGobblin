import { TILES_PER_CHUNK, tileKey, tileToChunkCoord } from "./scale.js";

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
  barbarian: { raidBoldness: 1, retreatBias: 1 }
};
const HOSTILE_TARGET_COMMIT_TICKS = 20;
const HOSTILE_RETARGET_COOLDOWN_TICKS = 6;
const HOSTILE_BREAKOFF_TICKS = 10;
const HOSTILE_ENGAGE_RANGE = 1.5;
const WILDLIFE_ATTACK_COOLDOWN_TICKS = 3;

function wildlifeAttackCooldownTicksForKind(kind) {
  if (kind === "wolf") return 5;
  return WILDLIFE_ATTACK_COOLDOWN_TICKS;
}

function wildlifeTuning(state) {
  const t = state.meta?.tuning?.wildlife || {};
  return {
    detectionRadiusScale: Number.isFinite(t.detectionRadiusScale) ? t.detectionRadiusScale : 1,
    targetCommitTicks: Number.isFinite(t.targetCommitTicks) ? t.targetCommitTicks : HOSTILE_TARGET_COMMIT_TICKS,
    retargetCooldownTicks: Number.isFinite(t.retargetCooldownTicks) ? t.retargetCooldownTicks : HOSTILE_RETARGET_COOLDOWN_TICKS,
    breakoffTicks: Number.isFinite(t.breakoffTicks) ? t.breakoffTicks : HOSTILE_BREAKOFF_TICKS,
    engageRange: Number.isFinite(t.engageRange) ? t.engageRange : HOSTILE_ENGAGE_RANGE,
    wallPenaltyScale: Number.isFinite(t.wallPenaltyScale) ? t.wallPenaltyScale : 1
  };
}

function isHostileKind(kind) {
  return kind === "wolf" || kind === "barbarian";
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
    if (c.kind !== "wolf" && c.kind !== "barbarian") continue;
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
    const maxHuntRange = 24 * wolfKnobs.huntPersistence;
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

  if (nearest <= 6 * wolfKnobs.regroupBias) {
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
  return 4 + Math.floor(roll * 5);
}

function applyWildlifeAttackToGoblin(state, creature, goblinId, tick, atKey) {
  const events = [];
  const goblin = state.goblins.byId[goblinId];
  const targetUnit = findGoblinUnit(state, goblinId);
  if (!goblin || !targetUnit || !goblin.flags.alive || goblin.flags.missing) return events;

  const lastAttackTick = creature.lastGoblinAttackTickByGoblinId?.[goblinId] ?? -1000;
  if (tick - lastAttackTick < wildlifeAttackCooldownTicksForKind(creature.kind)) return events;
  if (!creature.lastGoblinAttackTickByGoblinId) creature.lastGoblinAttackTickByGoblinId = {};
  creature.lastGoblinAttackTickByGoblinId[goblinId] = tick;

  const damage = computeWildlifeDamage(creature, state, tick, goblinId);
  const health = goblin.body.health;
  const beforeVitality = health.vitality;
  health.vitality = clamp(health.vitality - damage, 0, 100);
  health.pain = clamp(health.pain + Math.max(2, Math.round(damage * 0.55)), 0, 100);
  const bleedInc = Math.max(0, Math.round(damage * (creature.kind === "barbarian" ? 0.34 : 0.22)));
  health.bleeding = clamp(health.bleeding + bleedInc, 0, 100);

  const injuryId = `${tick}-${creature.id}-${goblinId}-${Math.floor(rand01("injury-id", state.meta.seed, tick, creature.id, goblinId) * 1e6)}`;
  goblin.body.injuries.push({
    id: injuryId,
    kind: creature.kind === "barbarian" ? "slash" : "bite",
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
  const tune = wildlifeTuning(state);

  const from = { x: creature.microX, y: creature.microY };
  const to = { x: unit.microX, y: unit.microY };
  const d = dist(from, to);
  const detectionRadius = (creature.kind === "wolf" ? 5.5 : 7) * tune.detectionRadiusScale;
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

function chooseHostileGoblinTarget(state, creature) {
  let bestId = null;
  let bestScore = -Infinity;
  for (const goblinId of state.goblins.allIds) {
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
    for (const goblinId of state.goblins.allIds) {
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

    const tuning = wildlifeTuning(state);
    const nextTarget = chooseHostileGoblinTarget(state, creature);
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

function maybeEmitBarbarianThreat(state, events) {
  const wildlife = state.worldMap.wildlife;
  const barbarianKnobs = speciesKnobs(state, "barbarian");
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
  if (nearest <= 7 * barbarianKnobs.raidBoldness) {
    wildlife.lastBarbarianThreatTick = state.meta.tick;
    events.push({
      type: "BARBARIAN_RAID_NEAR_HOME",
      distance: Number(nearest.toFixed(2)),
      text: `Barbarian raiders are close to goblin homes (distance ${nearest.toFixed(1)}).`
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
  }
}

function chooseGoal(state, creature, tick) {
  const wildlife = state.worldMap.wildlife;
  const from = { x: creature.microX, y: creature.microY };
  const hunt = ensureHuntState(creature);
  const tuning = wildlifeTuning(state);

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
      targetX: clamp(creature.homeMicroX + Math.round((rand01("wolf-x", tick, creature.id) - 0.5) * Math.round(10 * wolfKnobs.regroupBias)), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
      targetY: clamp(creature.homeMicroY + Math.round((rand01("wolf-y", tick, creature.id) - 0.5) * Math.round(10 * wolfKnobs.regroupBias)), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
    };
  }

  if (creature.kind === "barbarian") {
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
        targetX: clamp(creature.homeMicroX + Math.round((rand01("barb-x", tick, creature.id) - 0.5) * Math.round(8 * barbarianKnobs.raidBoldness)), 0, state.worldMap.width * TILES_PER_CHUNK - 1),
        targetY: clamp(creature.homeMicroY + Math.round((rand01("barb-y", tick, creature.id) - 0.5) * Math.round(8 * barbarianKnobs.raidBoldness)), 0, state.worldMap.height * TILES_PER_CHUNK - 1)
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
    if (creature.kind === "deer" && goal?.kind !== "drink" && isWater) continue;
    if ((creature.kind === "wolf" || creature.kind === "barbarian") && goal?.kind !== "drink" && isWater) continue;
    if (blockedByWall && (creature.kind === "wolf" || creature.kind === "barbarian")) continue;

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
    } else {
      score -= region.hazardPressure * 0.1;
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
      if (creature.kind === "deer" && goal?.kind !== "drink" && isWater) continue;
      if ((creature.kind === "wolf" || creature.kind === "barbarian") && goal?.kind !== "drink" && isWater) continue;
      if (blockedByWall && (creature.kind === "wolf" || creature.kind === "barbarian")) continue;

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
  const tuning = wildlifeTuning(state);

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

  if ((creature.kind === "wolf" || creature.kind === "barbarian") && goal.kind === "engage-goblin" && goal.targetId) {
    const targetUnit = findGoblinUnit(state, goal.targetId);
    if (!targetUnit) return null;
    const d = dist({ x: creature.microX, y: creature.microY }, { x: targetUnit.microX, y: targetUnit.microY });
    if (d > tuning.engageRange) return null;
    return applyWildlifeAttackToGoblin(state, creature, goal.targetId, tick, key);
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

  assignHostileGoblinTargets(state, events);
  assignWolfPackTargets(state, events);
  assignBarbarianRaidPlans(state, events);

  const occupiedNext = new Map();
  const ids = [...wildlife.allIds].sort();

  for (const id of ids) {
    const creature = wildlife.byId[id];
    if (!creature || !creature.alive) continue;
    if (creature.kind !== "fish" && creature.kind !== "deer" && creature.kind !== "wolf" && creature.kind !== "barbarian") {
      occupiedNext.set(tileKey(creature.microX, creature.microY), creature.id);
      continue;
    }

    updateNeeds(state, creature);
    const goal = chooseGoal(state, creature, state.meta.tick);
    if (goal) creature.aiState = goal.kind;
    const hunt = ensureHuntState(creature);
    const wasHunting = hunt.mode === "chase" || hunt.mode === "stalk" || hunt.mode === "engage";

    if (isHostileKind(creature.kind)) {
      const tuning = wildlifeTuning(state);
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
  return events;
}
