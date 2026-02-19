const DEFAULT_RELATION = {
  trust: 0,
  fear: 0,
  respect: 0,
  resentment: 0,
  tradeAffinity: 0
};

function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function relationPosture(rel) {
  const trust = Number(rel?.trust || 0);
  const fear = Number(rel?.fear || 0);
  const resentment = Number(rel?.resentment || 0);
  if (trust >= 55 && resentment <= 25) return "ally";
  if (resentment >= 72 || (fear >= 64 && trust <= 24)) return "blood-feud";
  if (resentment >= 48 || fear >= 46) return "hostile";
  if (trust >= 35) return "neutral";
  return "uneasy";
}

function countOutpostsByKind(wm, kind) {
  const outposts = Object.values(wm?.structures?.enemyOutpostsByTileKey || {});
  let count = 0;
  for (const outpost of outposts) {
    if (!outpost) continue;
    if (kind === "barbarian" && outpost.kind === "barbarian-band") count += 1;
    if (kind === "wolf" && outpost.kind === "wolf-pack") count += 1;
  }
  return count;
}

function buildFactionBase(id, name, kind) {
  return {
    id,
    identity: {
      name,
      kind,
      doctrineTags: kind === "mercenary-band" ? ["raiding", "opportunistic"] : ["territorial", "predatory"]
    },
    territory: {
      homeSiteIds: [],
      influenceByRegion: {},
      routeControlByEdge: {}
    },
    power: {
      military: 20,
      economy: 18,
      logistics: 16,
      stability: 50,
      intel: 28
    },
    resources: {},
    needs: {
      foodPressure: 40,
      wealthPressure: 40,
      safetyPressure: 40,
      prestigePressure: 40,
      vengeancePressure: 40
    },
    diplomacy: {
      relationsByFaction: {},
      treaties: [],
      grievances: [],
      debts: [],
      trustByFaction: {},
      fearByFaction: {}
    },
    intent: {
      strategicGoal: "stabilize",
      targetFactionId: null,
      targetSiteId: null,
      priorityScore: 0.4,
      planExpiresTick: 0
    },
    memory: {
      notableEvents: [],
      playerHistoryScore: 0
    },
    runtime: {
      relationToPlayer: { ...DEFAULT_RELATION },
      postureToPlayer: "uneasy",
      lastIntentTick: -1000,
      lastPressureTick: -1000
    }
  };
}

function applyOutpostPressure(faction, count, tick) {
  const militaryBoost = count * 8;
  faction.power.military = clamp(12 + militaryBoost, 0, 100);
  faction.power.logistics = clamp(10 + count * 5, 0, 100);
  faction.needs.wealthPressure = clamp(35 + count * 3, 0, 100);
  faction.needs.prestigePressure = clamp(30 + count * 4, 0, 100);
  faction.intent.priorityScore = Number(clamp(0.35 + count * 0.08, 0.1, 1).toFixed(3));
  faction.intent.planExpiresTick = Math.max(faction.intent.planExpiresTick || 0, tick + 24);
}

export function ensureFactionState(state) {
  state.world = state.world || {};
  state.world.factionsById = state.world.factionsById || {};
  state.world.factionIds = state.world.factionIds || [];

  const byId = state.world.factionsById;
  const ids = state.world.factionIds;
  if (ids.length && Object.keys(byId).length) {
    for (const id of ids) {
      const f = byId[id];
      if (!f) continue;
      f.runtime = f.runtime || {};
      f.runtime.relationToPlayer = { ...DEFAULT_RELATION, ...(f.runtime.relationToPlayer || {}) };
      f.runtime.postureToPlayer = relationPosture(f.runtime.relationToPlayer);
    }
    return byId;
  }

  const tick = state.meta?.tick || 0;
  const wm = state.worldMap;
  const barbarianCount = countOutpostsByKind(wm, "barbarian");
  const wolfCount = countOutpostsByKind(wm, "wolf");

  const raiders = buildFactionBase("faction-barbarian-raiders", "Ironjaw Raiders", "mercenary-band");
  const wolves = buildFactionBase("faction-wolf-broods", "Ashfang Broods", "beast-horde");
  raiders.intent.strategicGoal = barbarianCount > 0 ? "retaliate" : "enrich";
  wolves.intent.strategicGoal = wolfCount > 0 ? "expand" : "stabilize";
  applyOutpostPressure(raiders, barbarianCount, tick);
  applyOutpostPressure(wolves, wolfCount, tick);

  byId[raiders.id] = raiders;
  byId[wolves.id] = wolves;
  ids.push(raiders.id, wolves.id);
  return byId;
}

export function updateFactionPostures(state) {
  const byId = ensureFactionState(state);
  for (const faction of Object.values(byId)) {
    faction.runtime = faction.runtime || {};
    faction.runtime.relationToPlayer = { ...DEFAULT_RELATION, ...(faction.runtime.relationToPlayer || {}) };
    faction.runtime.postureToPlayer = relationPosture(faction.runtime.relationToPlayer);
  }
}
