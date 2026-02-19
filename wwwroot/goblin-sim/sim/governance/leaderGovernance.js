function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function hashText(input) {
  const text = String(input || "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function livingLeaderCandidates(state) {
  const out = [];
  for (const id of state.goblins.allIds || []) {
    const g = state.goblins.byId?.[id];
    if (!g || !g.flags?.alive || g.flags?.missing) continue;
    if (g.flags?.exiled || g.flags?.imprisoned) continue;
    out.push(g);
  }
  return out;
}

function statScore(g, key, fallback = 0) {
  return Number(g?.coreStats?.[key] ?? g?.aptitudes?.[key] ?? fallback);
}

function personalityScore(g, key, fallback = 50) {
  return Number(g?.traits?.personality?.[key] ?? fallback);
}

export function computeLeadershipScore(goblin) {
  const social = statScore(goblin, "social");
  const will = statScore(goblin, "will");
  const cunning = statScore(goblin, "cunning");
  const perception = statScore(goblin, "perception");
  const bargaining = statScore(goblin, "bargaining");
  const scouting = statScore(goblin, "scouting");
  const siegecraft = statScore(goblin, "siegecraft");
  const lorekeeping = statScore(goblin, "lorekeeping");
  const statusScore = Number(goblin?.social?.statusScore || 0);
  const loyalty = Number(goblin?.social?.loyalty || 0);
  const discipline = personalityScore(goblin, "discipline");
  const bravery = personalityScore(goblin, "bravery");
  const aggression = personalityScore(goblin, "aggression");
  const curiosity = personalityScore(goblin, "curiosity");

  const raw =
    social * 0.16 +
    will * 0.13 +
    cunning * 0.12 +
    perception * 0.08 +
    bargaining * 0.11 +
    scouting * 0.08 +
    siegecraft * 0.07 +
    lorekeeping * 0.06 +
    statusScore * 0.1 +
    loyalty * 0.09 +
    discipline * 0.06 +
    bravery * 0.04 +
    aggression * 0.02 +
    curiosity * 0.02;
  return Number(clamp(raw, 0, 100).toFixed(3));
}

function leaderTieBreak(aId, bId) {
  return hashText(aId) - hashText(bId);
}

function baselinePolicy() {
  return {
    riskPosture: "balanced",
    responseProfile: "balanced",
    expansionEnabled: true,
    reserveFloors: {
      ammo_bolts: 14,
      metal_parts: 12,
      springs: 8,
      wood_planks: 16
    }
  };
}

function baselineLearning() {
  return {
    confidence: 0.5,
    confidenceTrend: "stable",
    experience: 0,
    domainWeights: {
      food: 20,
      water: 20,
      defense: 20,
      industry: 14,
      logistics: 14,
      expansion: 8,
      diplomacy: 4
    },
    domainMemory: {
      food: { pressure: 0.5, abundance: 0.5 },
      water: { pressure: 0.5, abundance: 0.5 },
      defense: { pressure: 0.5, abundance: 0.5 },
      industry: { pressure: 0.5, abundance: 0.5 },
      logistics: { pressure: 0.5, abundance: 0.5 },
      expansion: { pressure: 0.5, abundance: 0.5 },
      diplomacy: { pressure: 0.5, abundance: 0.5 }
    },
    adaptation: {
      minHoldTicks: 24,
      maxWeightDeltaPerCycle: 1.2,
      maxReserveDeltaPerCycle: 2,
      lastDirectionByDomain: {
        food: 0,
        water: 0,
        defense: 0,
        industry: 0,
        logistics: 0,
        expansion: 0,
        diplomacy: 0
      },
      lastDirectionTickByDomain: {
        food: -1000,
        water: -1000,
        defense: -1000,
        industry: -1000,
        logistics: -1000,
        expansion: -1000,
        diplomacy: -1000
      }
    },
    lastSnapshot: null,
    lastLearningTick: -1000,
    episodes: [],
    lastLesson: "No episodes yet."
  };
}

function baselineRecommendations() {
  return {
    generatedTick: -1,
    outpostPostureById: {},
    staffingTargetByOutpostId: {},
    reserveFloors: {
      ammo_bolts: 14,
      metal_parts: 12,
      springs: 8,
      wood_planks: 16
    },
    expansion: {
      allowed: true,
      reasonCode: "STABLE"
    }
  };
}

function normalizeLearningWeights(weights) {
  const keys = ["food", "water", "defense", "industry", "logistics", "expansion", "diplomacy"];
  const safe = {};
  let total = 0;
  for (const key of keys) {
    const v = clamp(Number(weights?.[key] || 0), 1, 1000);
    safe[key] = v;
    total += v;
  }
  const out = {};
  for (const key of keys) out[key] = Number(((safe[key] / total) * 100).toFixed(2));
  return out;
}

export function ensureGovernanceState(state) {
  state.tribe = state.tribe || {};
  state.tribe.governance = state.tribe.governance || {};
  const gov = state.tribe.governance;
  gov.leaderGoblinId = gov.leaderGoblinId || null;
  gov.leadershipScoreByGoblinId = gov.leadershipScoreByGoblinId || {};
  gov.policy = { ...baselinePolicy(), ...(gov.policy || {}) };
  gov.policy.reserveFloors = {
    ...baselinePolicy().reserveFloors,
    ...(gov.policy?.reserveFloors || {})
  };
  gov.recommendations = { ...baselineRecommendations(), ...(gov.recommendations || {}) };
  gov.recommendations.reserveFloors = {
    ...baselineRecommendations().reserveFloors,
    ...(gov.recommendations?.reserveFloors || {})
  };
  gov.recommendations.outpostPostureById = gov.recommendations.outpostPostureById || {};
  gov.recommendations.staffingTargetByOutpostId = gov.recommendations.staffingTargetByOutpostId || {};
  gov.runtime = gov.runtime || {};
  if (!Number.isFinite(gov.runtime.lastPolicyTick)) gov.runtime.lastPolicyTick = -1000;
  if (!Number.isFinite(gov.runtime.lastStrategicTick)) gov.runtime.lastStrategicTick = -1000;
  if (!Number.isFinite(gov.runtime.lastElectionTick)) gov.runtime.lastElectionTick = -1000;
  if (!Number.isFinite(gov.runtime.reelectAfterTick)) gov.runtime.reelectAfterTick = 0;
  if (!Number.isFinite(gov.runtime.emergencyOverrideUntilTick)) gov.runtime.emergencyOverrideUntilTick = -1;
  if (!Number.isFinite(gov.runtime.leaderStability)) gov.runtime.leaderStability = 0.5;
  gov.learning = { ...baselineLearning(), ...(gov.learning || {}) };
  gov.learning.domainWeights = normalizeLearningWeights({
    ...baselineLearning().domainWeights,
    ...(gov.learning?.domainWeights || {})
  });
  gov.learning.domainMemory = {
    ...baselineLearning().domainMemory,
    ...(gov.learning?.domainMemory || {})
  };
  gov.learning.adaptation = {
    ...baselineLearning().adaptation,
    ...(gov.learning?.adaptation || {})
  };
  gov.learning.adaptation.lastDirectionByDomain = {
    ...baselineLearning().adaptation.lastDirectionByDomain,
    ...(gov.learning?.adaptation?.lastDirectionByDomain || {})
  };
  gov.learning.adaptation.lastDirectionTickByDomain = {
    ...baselineLearning().adaptation.lastDirectionTickByDomain,
    ...(gov.learning?.adaptation?.lastDirectionTickByDomain || {})
  };
  if (!Number.isFinite(gov.learning.adaptation.minHoldTicks)) gov.learning.adaptation.minHoldTicks = 24;
  if (!Number.isFinite(gov.learning.adaptation.maxWeightDeltaPerCycle)) gov.learning.adaptation.maxWeightDeltaPerCycle = 1.2;
  if (!Number.isFinite(gov.learning.adaptation.maxReserveDeltaPerCycle)) gov.learning.adaptation.maxReserveDeltaPerCycle = 2;
  gov.learning.adaptation.minHoldTicks = clamp(Number(gov.learning.adaptation.minHoldTicks), 8, 96);
  gov.learning.adaptation.maxWeightDeltaPerCycle = clamp(Number(gov.learning.adaptation.maxWeightDeltaPerCycle), 0.25, 3.5);
  gov.learning.adaptation.maxReserveDeltaPerCycle = clamp(Number(gov.learning.adaptation.maxReserveDeltaPerCycle), 1, 6);
  if (!Number.isFinite(gov.learning.confidence)) gov.learning.confidence = 0.5;
  gov.learning.confidence = clamp(gov.learning.confidence, 0, 1);
  gov.learning.confidenceTrend = gov.learning.confidenceTrend || "stable";
  if (!Number.isFinite(gov.learning.experience)) gov.learning.experience = 0;
  if (!Number.isFinite(gov.learning.lastLearningTick)) gov.learning.lastLearningTick = -1000;
  gov.learning.episodes = Array.isArray(gov.learning.episodes) ? gov.learning.episodes.slice(-120) : [];
  gov.learning.lastLesson = gov.learning.lastLesson || "No episodes yet.";
  return gov;
}

function chooseLeader(state, candidates) {
  if (!candidates.length) return null;
  const scored = candidates.map((g) => ({ goblin: g, score: computeLeadershipScore(g) }));
  scored.sort((a, b) => (b.score - a.score) || leaderTieBreak(a.goblin.id, b.goblin.id));
  return scored[0] || null;
}

function updateLeadershipScores(gov, candidates) {
  const next = {};
  for (const goblin of candidates) next[goblin.id] = computeLeadershipScore(goblin);
  gov.leadershipScoreByGoblinId = next;
}

function canLead(g) {
  return Boolean(g && g.flags?.alive && !g.flags?.missing && !g.flags?.exiled && !g.flags?.imprisoned);
}

function leaderResponseProfile(leader) {
  if (!leader) return "balanced";
  const aggression = personalityScore(leader, "aggression");
  const social = statScore(leader, "social");
  if (aggression >= 70 && social < 45) return "hardline";
  if (social >= 62 && aggression < 48) return "conciliatory";
  return "balanced";
}

function normalizePriorityProfile(raw) {
  const keys = ["survival", "defense", "expansion", "logistics", "diplomacy"];
  const safe = {};
  let total = 0;
  for (const key of keys) {
    const v = clamp(Number(raw?.[key] || 0), 1, 1000);
    safe[key] = v;
    total += v;
  }
  if (total <= 0) return { survival: 20, defense: 20, expansion: 20, logistics: 20, diplomacy: 20 };
  const out = {};
  for (const key of keys) out[key] = Number(((safe[key] / total) * 100).toFixed(1));
  return out;
}

function balancedPriorityProfile() {
  return { survival: 20, defense: 20, expansion: 20, logistics: 20, diplomacy: 20 };
}

function computeLeaderPriorityProfile(leader) {
  if (!leader) return balancedPriorityProfile();
  const aggression = personalityScore(leader, "aggression");
  const curiosity = personalityScore(leader, "curiosity");
  const discipline = personalityScore(leader, "discipline");
  const social = statScore(leader, "social");
  const will = statScore(leader, "will");
  const cunning = statScore(leader, "cunning");
  const siegecraft = statScore(leader, "siegecraft");
  const scouting = statScore(leader, "scouting");
  const bargaining = statScore(leader, "bargaining");

  const raw = {
    survival: 35 + will * 0.32 + discipline * 0.31 - aggression * 0.14,
    defense: 30 + aggression * 0.34 + siegecraft * 0.35 + will * 0.16,
    expansion: 20 + curiosity * 0.4 + scouting * 0.24 + cunning * 0.14 - discipline * 0.1,
    logistics: 25 + cunning * 0.26 + bargaining * 0.2 + discipline * 0.22 + social * 0.12,
    diplomacy: 20 + social * 0.35 + bargaining * 0.35 - aggression * 0.2
  };
  return normalizePriorityProfile(raw);
}

function computeLearningPressureSnapshot(state, gov) {
  const resources = state.tribe?.resources || {};
  const goblinCount = Math.max(1, state.goblins?.allIds?.length || 1);
  const threat = clamp((state.tribe?.threat?.alertLevel || 0) / 100, 0, 1);
  const outposts = Object.values(state.worldMap?.structures?.outpostsById || {});
  const failingOutposts = outposts.filter((o) => (o.runtime?.status || "seeded") === "failing").length;
  const evacuatingOutposts = outposts.filter((o) => (o.runtime?.status || "seeded") === "evacuating").length;
  const outpostDeficit = outposts.reduce((n, o) => n + Math.max(0, o.runtime?.populationDeficit || 0), 0);
  const queue = state.worldMap?.structures?.processing?.queueIds?.length || 0;
  const haulQueue = state.worldMap?.structures?.logistics?.queueIds?.length || 0;

  const defenses = Object.values(state.worldMap?.structures?.automatedDefensesByTileKey || {});
  const inactiveDefenses = defenses.reduce((n, d) => n + ((d?.status || "active") === "active" ? 0 : 1), 0);
  const defenseInactiveRate = defenses.length ? inactiveDefenses / defenses.length : 0;
  const reserve = gov.recommendations?.reserveFloors || {};

  const foodTarget = Math.max(14, goblinCount * 2);
  const waterTarget = Math.max(14, goblinCount * 2);
  const foodPressure = clamp(Math.max(0, foodTarget - Number(resources.food || 0)) / foodTarget, 0, 1);
  const waterPressure = clamp(Math.max(0, waterTarget - Number(resources.water || 0)) / waterTarget, 0, 1);
  const defenseDeficit =
    Math.max(0, Number(reserve.ammo_bolts || 0) - Number(resources.ammo_bolts || 0)) +
    Math.max(0, Number(reserve.metal_parts || 0) - Number(resources.metal_parts || 0)) +
    Math.max(0, Number(reserve.springs || 0) - Number(resources.springs || 0)) +
    Math.max(0, Number(reserve.wood_planks || 0) - Number(resources.wood_planks || 0));
  const defenseTarget = Math.max(8, Number(reserve.ammo_bolts || 0) + Number(reserve.metal_parts || 0) + Number(reserve.springs || 0) + Number(reserve.wood_planks || 0));
  const defensePressure = clamp(defenseDeficit / defenseTarget + defenseInactiveRate * 0.8 + threat * 0.35, 0, 1);
  const industryPressure = clamp(queue / 12 + Math.max(0, 12 - Number(resources.metal_parts || 0)) / 12 * 0.35, 0, 1);
  const logisticsPressure = clamp(haulQueue / 16 + queue / 16 * 0.2, 0, 1);
  const expansionPressure = clamp((failingOutposts + evacuatingOutposts * 1.3) / 4 + outpostDeficit / Math.max(4, goblinCount * 0.5) + threat * 0.2, 0, 1);
  const diplomacyPressure = clamp((state.world?.factionIds?.length || 0) > 0 ? threat * 0.6 : 0.2, 0, 1);

  const pressure = {
    food: foodPressure,
    water: waterPressure,
    defense: defensePressure,
    industry: industryPressure,
    logistics: logisticsPressure,
    expansion: expansionPressure,
    diplomacy: diplomacyPressure
  };
  const abundance = Object.fromEntries(Object.entries(pressure).map(([k, v]) => [k, Number((1 - v).toFixed(3))]));
  return {
    pressure,
    abundance,
    threat: Number(threat.toFixed(3)),
    failingOutposts,
    evacuatingOutposts,
    outpostDeficit,
    inactiveDefenses,
    totalDefenses: defenses.length
  };
}

function updateLearningMemory(gov, snapshot) {
  const alpha = 0.12;
  const mem = gov.learning.domainMemory || {};
  for (const key of Object.keys(snapshot.pressure)) {
    const prev = mem[key] || { pressure: 0.5, abundance: 0.5 };
    const p = Number(snapshot.pressure[key] || 0);
    const a = Number(snapshot.abundance[key] || 0);
    mem[key] = {
      pressure: Number((prev.pressure * (1 - alpha) + p * alpha).toFixed(4)),
      abundance: Number((prev.abundance * (1 - alpha) + a * alpha).toFixed(4))
    };
  }
  gov.learning.domainMemory = mem;
}

function adaptLearningWeights(gov, tick) {
  const confidence = clamp(Number(gov.learning.confidence || 0.5), 0, 1);
  const learningRate = clamp(0.04 + (1 - confidence) * 0.08, 0.03, 0.14);
  const current = gov.learning.domainWeights || baselineLearning().domainWeights;
  const mem = gov.learning.domainMemory || {};
  const adaptation = gov.learning.adaptation || baselineLearning().adaptation;
  const maxDelta = clamp(Number(adaptation.maxWeightDeltaPerCycle || 1.2), 0.25, 3.5);
  const minHoldTicks = clamp(Number(adaptation.minHoldTicks || 24), 8, 96);
  const lastDirectionByDomain = adaptation.lastDirectionByDomain || {};
  const lastDirectionTickByDomain = adaptation.lastDirectionTickByDomain || {};
  const next = { ...current };
  for (const key of Object.keys(next)) {
    const pressure = clamp(Number(mem[key]?.pressure || 0.5), 0, 1);
    const target = clamp(20 + (pressure - 0.5) * 36, 6, 42);
    const prev = Number(next[key] || 0);
    const desired = prev + (target - prev) * learningRate;
    let rawDelta = desired - prev;
    rawDelta = clamp(rawDelta, -maxDelta, maxDelta);
    const direction = rawDelta > 0.0001 ? 1 : rawDelta < -0.0001 ? -1 : 0;
    const prevDir = Number(lastDirectionByDomain[key] || 0);
    const prevDirTick = Number(lastDirectionTickByDomain[key] || -1000);
    const reversing = direction !== 0 && prevDir !== 0 && direction !== prevDir;
    if (reversing && tick - prevDirTick < minHoldTicks) {
      rawDelta = 0;
    } else if (direction !== 0 && direction !== prevDir) {
      lastDirectionByDomain[key] = direction;
      lastDirectionTickByDomain[key] = tick;
    }
    next[key] = Number((prev + rawDelta).toFixed(4));
  }
  gov.learning.domainWeights = normalizeLearningWeights(next);
  gov.learning.adaptation.lastDirectionByDomain = lastDirectionByDomain;
  gov.learning.adaptation.lastDirectionTickByDomain = lastDirectionTickByDomain;
}

function updateLearningConfidence(gov, snapshot) {
  const prev = clamp(Number(gov.learning.confidence || 0.5), 0, 1);
  const avgAbundance = (
    Number(snapshot.abundance.food || 0) +
    Number(snapshot.abundance.water || 0) +
    Number(snapshot.abundance.defense || 0)
  ) / 3;
  const shortage = (
    Number(snapshot.pressure.food || 0) +
    Number(snapshot.pressure.water || 0) +
    Number(snapshot.pressure.defense || 0)
  ) / 3;
  const gain = 0.018 * avgAbundance;
  const loss = 0.02 * shortage + Math.min(0.03, snapshot.evacuatingOutposts * 0.012);
  const next = clamp(prev + gain - loss, 0, 1);
  gov.learning.confidence = Number(next.toFixed(4));
  gov.learning.confidenceTrend = next > prev + 0.003 ? "rising" : next < prev - 0.003 ? "falling" : "stable";
  gov.learning.experience = Number((Number(gov.learning.experience || 0) + (next - prev)).toFixed(4));
  return {
    before: Number(prev.toFixed(4)),
    after: Number(next.toFixed(4)),
    delta: Number((next - prev).toFixed(4)),
    trend: gov.learning.confidenceTrend
  };
}

function recordLearningEpisode(gov, tick, snapshot) {
  const weights = gov.learning.domainWeights || {};
  const top = Object.entries(weights).sort((a, b) => b[1] - a[1])[0];
  const episode = {
    tick,
    confidence: gov.learning.confidence,
    trend: gov.learning.confidenceTrend,
    topDomain: top?.[0] || "food",
    topWeight: Number(top?.[1] || 0),
    pressure: snapshot.pressure,
    abundance: snapshot.abundance
  };
  gov.learning.episodes.push(episode);
  if (gov.learning.episodes.length > 120) gov.learning.episodes.shift();
  gov.learning.lastLesson = `${episode.topDomain} weight ${episode.topWeight.toFixed(1)} after pressure update.`;
  return episode;
}

function recommendOutpostPosture(outpost) {
  const status = String(outpost?.runtime?.status || "seeded");
  if (status === "evacuating" || status === "abandoned") return status;
  if (status === "failing") return "recover";
  const deficit = Number(outpost?.runtime?.populationDeficit || 0);
  const priority = String(outpost?.priority || "normal");
  if (deficit >= 3) return "recover";
  if (priority === "critical") return "fortify";
  return "hold";
}

function recommendStaffingForOutpost(outpost, profile) {
  const deficits = outpost?.runtime?.deficitByRole || {};
  const pop = Number(outpost?.runtime?.population || 0);
  const target = Number(outpost?.runtime?.targetPopulation || 0);
  const p = profile || balancedPriorityProfile();
  const defenseBias = clamp((p.defense - 20) / 20, -0.7, 1.5);
  const survivalBias = clamp((p.survival - 20) / 20, -0.7, 1.5);
  const logisticsBias = clamp((p.logistics - 20) / 20, -0.7, 1.5);
  return {
    forager: Math.max(1, Math.min(5, Math.max(1, Math.round(pop * (0.18 + survivalBias * 0.05))) + Math.max(0, deficits.forager || 0))),
    "water-runner": Math.max(1, Math.min(4, Math.max(1, Math.round(pop * (0.12 + survivalBias * 0.045))) + Math.max(0, deficits["water-runner"] || 0))),
    builder: Math.max(1, Math.min(5, Math.max(1, Math.round(pop * (0.14 + defenseBias * 0.06))) + Math.max(0, deficits.builder || 0))),
    sentinel: Math.max(1, Math.min(4, Math.max(1, Math.round(pop * (0.12 + defenseBias * 0.05))) + (target > pop ? 1 : 0))),
    hauler: Math.max(1, Math.min(4, Math.max(1, Math.round(pop * (0.1 + logisticsBias * 0.05))))
    )
  };
}

function adaptReserveFloors(gov, proposed) {
  const prev = gov.recommendations?.reserveFloors || baselineRecommendations().reserveFloors;
  const maxDelta = clamp(Number(gov.learning?.adaptation?.maxReserveDeltaPerCycle || 2), 1, 6);
  const out = {};
  for (const key of ["ammo_bolts", "metal_parts", "springs", "wood_planks"]) {
    const before = Math.max(0, Number(prev[key] || 0));
    const target = Math.max(0, Number(proposed[key] || 0));
    const delta = clamp(target - before, -maxDelta, maxDelta);
    out[key] = Math.max(0, Math.round(before + delta));
  }
  return out;
}

function buildRecommendations(state, gov, leader, tick) {
  const threat = Number(state.tribe?.threat?.alertLevel || 0);
  const aggression = leader ? personalityScore(leader, "aggression") : 50;
  const discipline = leader ? personalityScore(leader, "discipline") : 50;
  const siegecraft = leader ? statScore(leader, "siegecraft") : 40;
  const basePriority = computeLeaderPriorityProfile(leader);
  const learned = gov.learning?.domainWeights || null;
  const priorityProfile = learned
    ? {
        survival: Number((basePriority.survival * 0.72 + (learned.food + learned.water) * 0.14).toFixed(2)),
        defense: Number((basePriority.defense * 0.74 + learned.defense * 0.26).toFixed(2)),
        expansion: Number((basePriority.expansion * 0.78 + learned.expansion * 0.22).toFixed(2)),
        logistics: Number((basePriority.logistics * 0.75 + learned.logistics * 0.25).toFixed(2)),
        diplomacy: Number((basePriority.diplomacy * 0.76 + learned.diplomacy * 0.24).toFixed(2))
      }
    : basePriority;
  const outposts = Object.values(state.worldMap?.structures?.outpostsById || {});
  const reservePressure = clamp(
    (threat / 100) * (0.48 + priorityProfile.defense / 100 * 0.28) +
    (aggression / 100) * 0.22 +
    (siegecraft / 100) * 0.15 +
    (priorityProfile.survival / 100) * 0.15,
    0,
    1
  );
  const stabilization = clamp((discipline - 50) / 80, -0.4, 0.5);
  const mul = clamp(1 + reservePressure * 0.7 + stabilization * 0.25, 0.7, 2.2);
  const learnedDefense = learned ? clamp((Number(learned.defense || 20) - 20) / 20, -0.4, 0.8) : 0;
  const learnedIndustry = learned ? clamp((Number(learned.industry || 14) - 14) / 14, -0.4, 0.8) : 0;
  const learnedLogistics = learned ? clamp((Number(learned.logistics || 14) - 14) / 14, -0.4, 0.8) : 0;
  const reserveMul = {
    ammo_bolts: clamp(mul * (1 + learnedDefense * 0.42 + learnedIndustry * 0.12), 0.7, 2.6),
    metal_parts: clamp(mul * (1 + learnedDefense * 0.26 + learnedIndustry * 0.35), 0.7, 2.6),
    springs: clamp(mul * (1 + learnedDefense * 0.24 + learnedIndustry * 0.3), 0.7, 2.5),
    wood_planks: clamp(mul * (1 + learnedDefense * 0.2 + learnedLogistics * 0.32), 0.7, 2.5)
  };

  const proposedReserveFloors = {
    ammo_bolts: Math.max(8, Math.round(14 * reserveMul.ammo_bolts)),
    metal_parts: Math.max(6, Math.round(12 * reserveMul.metal_parts)),
    springs: Math.max(4, Math.round(8 * reserveMul.springs)),
    wood_planks: Math.max(10, Math.round(16 * reserveMul.wood_planks))
  };
  const reserveFloors = adaptReserveFloors(gov, proposedReserveFloors);

  const outpostPostureById = {};
  const staffingTargetByOutpostId = {};
  let cumulativeDeficit = 0;
  for (const outpost of outposts) {
    if (!outpost?.id) continue;
    outpostPostureById[outpost.id] = recommendOutpostPosture(outpost);
    staffingTargetByOutpostId[outpost.id] = recommendStaffingForOutpost(outpost, priorityProfile);
    cumulativeDeficit += Number(outpost?.runtime?.populationDeficit || 0);
  }

  const food = Number(state.tribe?.resources?.food || 0);
  const water = Number(state.tribe?.resources?.water || 0);
  const expansionTolerance = clamp((priorityProfile.expansion - priorityProfile.survival) / 100, -0.5, 0.5);
  const threatCap = Math.round(62 + expansionTolerance * 10);
  const foodMin = Math.max(16, Math.round(24 - expansionTolerance * 6));
  const waterMin = Math.max(16, Math.round(24 - expansionTolerance * 6));
  const deficitCap = Math.max(2, Math.round(4 - expansionTolerance * 1.5));
  const expansionBlocked = threat >= threatCap || food < foodMin || water < waterMin || cumulativeDeficit >= deficitCap;
  const expansion = {
    allowed: !expansionBlocked,
    reasonCode: expansionBlocked ? "READINESS_LOW" : "STABLE",
    thresholds: {
      threatCap,
      foodMin,
      waterMin,
      deficitCap
    }
  };

  gov.recommendations.generatedTick = tick;
  gov.recommendations.reserveFloors = reserveFloors;
  gov.recommendations.outpostPostureById = outpostPostureById;
  gov.recommendations.staffingTargetByOutpostId = staffingTargetByOutpostId;
  gov.recommendations.expansion = expansion;
  gov.runtime.priorityProfile = priorityProfile;
}

export function leaderGovernanceSystem(state) {
  const events = [];
  const tick = Number(state.meta?.tick || 0);
  const gov = ensureGovernanceState(state);
  const candidates = livingLeaderCandidates(state);
  updateLeadershipScores(gov, candidates);

  const currentLeader = gov.leaderGoblinId ? state.goblins.byId?.[gov.leaderGoblinId] : null;
  const needElection = !canLead(currentLeader);
  if ((gov.leaderGoblinId === null || needElection) && tick >= gov.runtime.reelectAfterTick) {
    const selected = chooseLeader(state, candidates);
    const previousLeaderId = gov.leaderGoblinId || null;
    gov.leaderGoblinId = selected?.goblin?.id || null;
    gov.runtime.lastElectionTick = tick;
    gov.runtime.reelectAfterTick = tick + 8;
    gov.policy.responseProfile = leaderResponseProfile(selected?.goblin || null);
    if (selected?.goblin) {
      gov.runtime.leaderStability = Number(clamp(selected.score / 100, 0, 1).toFixed(3));
      const eventType = previousLeaderId ? "LEADER_SUCCESSION" : "LEADER_ELECTED";
      events.push({
        type: eventType,
        leaderGoblinId: selected.goblin.id,
        previousLeaderGoblinId: previousLeaderId || undefined,
        leadershipScore: selected.score,
        text: previousLeaderId
          ? `${selected.goblin.identity.name} assumed leadership after succession.`
          : `${selected.goblin.identity.name} was elected as tribal leader.`
      });
    } else {
      gov.runtime.leaderStability = 0;
    }
  }

  const leader = gov.leaderGoblinId ? state.goblins.byId?.[gov.leaderGoblinId] : null;
  if (tick - gov.runtime.lastPolicyTick >= 12) {
    const snapshot = computeLearningPressureSnapshot(state, gov);
    gov.learning.lastSnapshot = snapshot;
    updateLearningMemory(gov, snapshot);
    const confidence = updateLearningConfidence(gov, snapshot);
    adaptLearningWeights(gov, tick);
    const episode = recordLearningEpisode(gov, tick, snapshot);
    gov.learning.lastLearningTick = tick;
    buildRecommendations(state, gov, leader, tick);
    gov.runtime.lastPolicyTick = tick;
    if (Math.abs(confidence.delta) >= 0.001) {
      events.push({
        type: "LEADER_CONFIDENCE_CHANGED",
        leaderGoblinId: leader?.id || null,
        before: confidence.before,
        after: confidence.after,
        delta: confidence.delta,
        trend: confidence.trend,
        text: `${leader?.identity?.name || "Leader"} confidence ${confidence.before.toFixed(2)} -> ${confidence.after.toFixed(2)} (${confidence.trend}).`
      });
    }
    events.push({
      type: "LEADER_LEARNING_EPISODE_RECORDED",
      leaderGoblinId: leader?.id || null,
      topDomain: episode.topDomain,
      topWeight: episode.topWeight,
      confidence: episode.confidence,
      trend: episode.trend,
      text: `${leader?.identity?.name || "Leader"} learning update: ${episode.topDomain} ${episode.topWeight.toFixed(1)} (${episode.trend}).`
    });
  }
  if (tick - gov.runtime.lastStrategicTick >= 36) {
    gov.policy.responseProfile = leaderResponseProfile(leader);
    gov.runtime.lastStrategicTick = tick;
  }
  return events;
}
