import { applyMemoryTriggers, decayMemories } from "./memoryModel.js";
import { updateMood } from "./moraleModel.js";
import { applyNeedDecay, clamp01to100 } from "./needsModel.js";
import { relationshipDriftSystem } from "./relationships.js";
import { CLIMATE_SCARCITY_TUNING } from "./constants.js";

function randomStimuliForTick(state) {
  const stimuli = [];
  if (state.meta.tick % 9 === 0) {
    stimuli.push({ type: "heard-song", valence: "positive", description: "Heard a warm fire-song." });
  }
  if (state.meta.tick % 13 === 0) {
    stimuli.push({ type: "saw-corpse", valence: "negative", description: "Saw signs of raider violence." });
  }
  return stimuli;
}

function hydrationProfile(goblin) {
  return goblin?.modData?.hydrationProfile || {};
}

function clampNum(v, min, max) {
  if (!Number.isFinite(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function needsTuning(state) {
  const t = state.meta?.tuning?.balance || {};
  return {
    globalDecayMul: clampNum(Number(t.globalDecayMul ?? 1), 0.05, 5),
    hungerDecayMul: clampNum(Number(t.hungerDecayMul ?? 1), 0.05, 5),
    thirstDecayMul: clampNum(Number(t.thirstDecayMul ?? 0.7), 0.05, 5),
    restDecayMul: clampNum(Number(t.restDecayMul ?? 0.2), 0.05, 5),
    warmthDecayMul: clampNum(Number(t.warmthDecayMul ?? 1), 0.05, 5)
  };
}

function resourceTuning(state) {
  const t = state.meta?.tuning?.balance || {};
  return {
    foodConsumptionMul: clampNum(Number(t.foodConsumptionMul ?? 1), 0.05, 5),
    waterConsumptionMul: clampNum(Number(t.waterConsumptionMul ?? 0.55), 0.05, 5),
    resourceGainMul: clampNum(Number(t.resourceGainMul ?? 5), 0.1, 20),
    hungerShortageMul: clampNum(Number(t.hungerShortageMul ?? 1), 0.05, 5),
    thirstShortageMul: clampNum(Number(t.thirstShortageMul ?? 0.6), 0.05, 5),
    hungerReliefMul: clampNum(Number(t.hungerReliefMul ?? 1), 0.05, 5),
    thirstReliefMul: clampNum(Number(t.thirstReliefMul ?? 1.4), 0.05, 5),
    warmthGainMul: clampNum(Number(t.warmthGainMul ?? 1), 0.05, 5),
    warmthLossMul: clampNum(Number(t.warmthLossMul ?? 1), 0.05, 5)
  };
}

function climateScarcityProfile(state) {
  const override = state.meta?.tuning?.climateScarcity || {};
  const tuning = {
    ...CLIMATE_SCARCITY_TUNING,
    spoilage: {
      ...(CLIMATE_SCARCITY_TUNING.spoilage || {}),
      bySeason: { ...(CLIMATE_SCARCITY_TUNING.spoilage?.bySeason || {}) },
      weatherAdd: { ...(CLIMATE_SCARCITY_TUNING.spoilage?.weatherAdd || {}) },
      weatherIntensityFactor: { ...(CLIMATE_SCARCITY_TUNING.spoilage?.weatherIntensityFactor || {}) },
      maxRate: Number.isFinite(override.spoilageMaxRate) ? override.spoilageMaxRate : CLIMATE_SCARCITY_TUNING.spoilage.maxRate,
      globalMul: Number.isFinite(override.spoilageGlobalMul) ? override.spoilageGlobalMul : 1
    },
    rationing: {
      ...(CLIMATE_SCARCITY_TUNING.rationing || {}),
      consumptionMul: Number.isFinite(override.rationingConsumptionMul) ? override.rationingConsumptionMul : CLIMATE_SCARCITY_TUNING.rationing.consumptionMul,
      lowStockDays: Number.isFinite(override.rationingLowStockDays) ? override.rationingLowStockDays : CLIMATE_SCARCITY_TUNING.rationing.lowStockDays,
      forecastWindowDays: Number.isFinite(override.rationingForecastWindowDays) ? override.rationingForecastWindowDays : CLIMATE_SCARCITY_TUNING.rationing.forecastWindowDays,
      triggerOnModerateRisk: override.rationingModerateRisk === undefined
        ? CLIMATE_SCARCITY_TUNING.rationing.triggerOnModerateRisk
        : Boolean(override.rationingModerateRisk)
    }
  };
  const season = String(state.world?.season?.key || "spring");
  const weather = String(state.world?.weather?.current || state.world?.weather?.type || "clear");
  const intensity = clampNum(Number(state.world?.weather?.intensity ?? 0), 0, 1);
  const ticksPerDay = Math.max(24, Math.round(Number(state.world?.climateConfig?.ticksPerDay || 144)));
  const baseSpoilage = Number(tuning.spoilage.bySeason?.[season] ?? tuning.spoilage.bySeason.spring ?? 0.009);
  const weatherAdd = Number(tuning.spoilage.weatherAdd?.[weather] ?? 0);
  const weatherIntensityFactor = Number(tuning.spoilage.weatherIntensityFactor?.[weather] ?? 0);
  const spoilageRate = clampNum(
    (baseSpoilage + weatherAdd + intensity * weatherIntensityFactor) * clampNum(Number(tuning.spoilage.globalMul ?? 1), 0.2, 2.5),
    0,
    Number(tuning.spoilage.maxRate ?? 0.06)
  );
  return { ticksPerDay, spoilageRate, season, weather, intensity, tuning };
}

function pullFromDrops(state, resourceKey, amountWanted) {
  const drops = state.worldMap?.structures?.resourceDropsByTileKey || {};
  let remaining = Math.max(0, amountWanted);
  let pulled = 0;
  for (const [key, drop] of Object.entries(drops)) {
    if (remaining <= 0) break;
    const available = Math.floor(drop?.[resourceKey] || 0);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    drop[resourceKey] = available - take;
    drop.lastUpdatedTick = state.meta.tick;
    pulled += take;
    remaining -= take;
    if ((drop.wood || 0) <= 0 && (drop.mushrooms || 0) <= 0) delete drops[key];
  }
  return pulled;
}

export function goblinNeedDecaySystem(state) {
  const events = [];
  const tuning = needsTuning(state);
  for (const id of state.goblins.allIds) {
    const g = state.goblins.byId[id];
    if (!g.flags.alive || g.flags.missing) continue;
    const profile = hydrationProfile(g);
    const thirstMul = Number.isFinite(profile.thirstDecayMul) ? profile.thirstDecayMul : 1;
    events.push(...applyNeedDecay(g, {
      hunger: tuning.globalDecayMul * tuning.hungerDecayMul,
      thirst: tuning.globalDecayMul * tuning.thirstDecayMul * thirstMul,
      rest: tuning.globalDecayMul * tuning.restDecayMul,
      warmth: tuning.globalDecayMul * tuning.warmthDecayMul
    }));
  }
  return events;
}

export function goblinMoodTransitionSystem(state) {
  const events = [];
  for (const id of state.goblins.allIds) {
    const g = state.goblins.byId[id];
    if (!g.flags.alive || g.flags.missing) continue;

    const pressure = (g.needs.hunger + g.needs.thirst + g.needs.rest) / 3;
    g.psyche.stress = clamp01to100(g.psyche.stress + (pressure - 50) * 0.012);
    g.psyche.morale = clamp01to100(g.psyche.morale - (pressure - 40) * 0.01);

    const threatMode = g.modData?.threatResponse?.mode || "none";
    if (threatMode !== "none") {
      g.needs.safety = clamp01to100(g.needs.safety + 1.2);
      g.psyche.stress = clamp01to100(g.psyche.stress + 1.4);
      g.psyche.morale = clamp01to100(g.psyche.morale - 0.9);
    } else if (g.needs.safety > 0) {
      g.needs.safety = clamp01to100(g.needs.safety - 0.35);
    }

    const ev = updateMood(g);
    if (ev) events.push(ev);
  }
  return events;
}

export function goblinMemorySystem(state) {
  const tick = state.meta.tick;
  const events = [];
  const stimuli = randomStimuliForTick(state);

  for (const id of state.goblins.allIds) {
    const g = state.goblins.byId[id];
    if (!g.flags.alive || g.flags.missing) continue;
    events.push(...applyMemoryTriggers(g, stimuli, tick));
    events.push(...decayMemories(g, tick));
  }
  return events;
}

export function runRelationshipDrift(state) {
  return relationshipDriftSystem(state);
}

export function resourcePurposeSystem(state) {
  const events = [];
  const goblinCount = state.goblins.allIds.length;
  if (!goblinCount) return events;
  const tuning = resourceTuning(state);
  const climate = state.world?.climateModifiers?.global || {};
  const scarcity = climateScarcityProfile(state);
  const climateFoodYield = clampNum(Number(climate.foodYieldMul ?? 1), 0.6, 1.4);
  const climateWoodYield = clampNum(Number(climate.woodYieldMul ?? 1), 0.6, 1.4);
  const climateThirstPressure = clampNum(Number(climate.thirstPressureMul ?? 1), 0.7, 1.5);
  const climateWarmthPressure = clampNum(Number(climate.warmthPressureMul ?? 1), 0.7, 1.6);

  const resources = state.tribe.resources;
  state.world.climateRuntime = state.world.climateRuntime || {
    lastRationingEventTick: -1000,
    lastSpoilageEventTick: -1000
  };

  const dailyBaseConsumption = Math.max(1, Math.ceil(goblinCount / 4));
  const rationCfg = scarcity.tuning?.rationing || {};
  const forecastWindowDays = Math.max(1, Math.round(Number(rationCfg.forecastWindowDays ?? 2)));
  const lowStockDays = Math.max(1, Math.round(Number(rationCfg.lowStockDays ?? 3)));
  const includeModerate = Boolean(rationCfg.triggerOnModerateRisk);
  const upcomingRisk = (state.world?.forecast?.next7Days || []).slice(0, forecastWindowDays).some(
    (d) => d?.risk === "high" || (includeModerate && d?.risk === "moderate")
  );
  const lowStock = (resources.food || 0) < dailyBaseConsumption * lowStockDays;
  const rationingActive = upcomingRisk && lowStock;
  const rationingMul = rationingActive ? clampNum(Number(rationCfg.consumptionMul ?? 0.93), 0.75, 1) : 1;
  if (rationingActive && state.meta.tick - (state.world.climateRuntime.lastRationingEventTick || -1000) >= scarcity.ticksPerDay) {
    state.world.climateRuntime.lastRationingEventTick = state.meta.tick;
    events.push({
      type: "STOCKPILE_RATIONING_ENABLED",
      season: scarcity.season,
      weather: scarcity.weather,
      text: `Stockpile rationing enabled due to ${scarcity.season}/${scarcity.weather} risk outlook.`
    });
  }
  const scaledFoodGain = (amount) => Math.max(1, Math.round(amount * tuning.resourceGainMul * climateFoodYield));
  const scaledWoodGain = (amount) => Math.max(1, Math.round(amount * tuning.resourceGainMul * climateWoodYield));

  // Emergency food conversion: mushrooms become food stock if pantry is low.
  if ((resources.food || 0) < goblinCount * 2 && (resources.mushrooms || 0) > 0 && state.meta.tick % 4 === 0) {
    const use = Math.min(resources.mushrooms, Math.max(1, Math.ceil(goblinCount / 5)));
    resources.mushrooms -= use;
    const gainedFood = scaledFoodGain(use * 2);
    resources.food = (resources.food || 0) + gainedFood;
    events.push({
      type: "MUSHROOM_STEW_COOKED",
      amount: use,
      text: `Camp cooks converted ${use} mushrooms into stew (+${gainedFood} food).`
    });
  }
  if ((resources.food || 0) < goblinCount * 2 && state.meta.tick % 4 === 0) {
    const target = Math.max(1, Math.ceil(goblinCount / 6));
    const pulled = pullFromDrops(state, "mushrooms", target);
    if (pulled > 0) {
      const gainedFood = scaledFoodGain(pulled * 2);
      resources.food = (resources.food || 0) + gainedFood;
      events.push({
        type: "FIELD_MUSHROOMS_RECOVERED",
        amount: pulled,
        text: `Camp cooks recovered ${pulled} mushrooms from field drops (+${gainedFood} food).`
      });
    }
  }

  if (state.meta.tick % 5 === 0) {
    const baseConsumption = Math.max(1, Math.ceil(goblinCount / 4));
    const foodConsumption = Math.max(1, Math.round(baseConsumption * tuning.foodConsumptionMul * rationingMul));
    const waterConsumption = Math.max(1, Math.round(baseConsumption * tuning.waterConsumptionMul * climateThirstPressure));

    const foodBefore = resources.food || 0;
    resources.food = Math.max(0, foodBefore - foodConsumption);
    const waterBefore = resources.water || 0;
    resources.water = Math.max(0, waterBefore - waterConsumption);

    const foodShort = foodBefore < foodConsumption;
    const waterShort = waterBefore < waterConsumption;

    for (const goblinId of state.goblins.allIds) {
      const goblin = state.goblins.byId[goblinId];
      if (!goblin || !goblin.flags.alive || goblin.flags.missing) continue;
      const profile = hydrationProfile(goblin);
      const waterNeedMul = Number.isFinite(profile.waterNeedMul) ? profile.waterNeedMul : 1;
      const shortThirstDelta = Math.max(1, Math.round(8 * waterNeedMul * tuning.thirstShortageMul * climateThirstPressure));
      const reliefThirstDelta = Math.max(1, Math.round(5 * waterNeedMul * tuning.thirstReliefMul / Math.max(0.75, climateThirstPressure)));
      const hungerShortDelta = Math.max(1, Math.round(6 * tuning.hungerShortageMul));
      const hungerReliefDelta = Math.max(1, Math.round(3 * tuning.hungerReliefMul));
      if (foodShort) goblin.needs.hunger = Math.min(100, goblin.needs.hunger + hungerShortDelta);
      else goblin.needs.hunger = Math.max(0, goblin.needs.hunger - hungerReliefDelta);
      if (waterShort) goblin.needs.thirst = Math.min(100, goblin.needs.thirst + shortThirstDelta);
      else goblin.needs.thirst = Math.max(0, goblin.needs.thirst - reliefThirstDelta);
    }

    if (foodShort) {
      events.push({
        type: "RESOURCE_SHORTAGE",
        resource: "food",
        text: "Food shortage: goblins are getting hungrier."
      });
    }
    if (waterShort) {
      events.push({
        type: "RESOURCE_SHORTAGE",
        resource: "water",
        text: "Water shortage: thirst pressure is rising."
      });
    }
  }

  if (state.meta.tick > 0 && state.meta.tick % scarcity.ticksPerDay === 0) {
    const spoilFood = Math.max(0, Math.floor((resources.food || 0) * scarcity.spoilageRate));
    const mushroomMul = clampNum(Number(scarcity.tuning?.spoilage?.mushroomMul ?? 1.08), 0.7, 1.6);
    const herbsMul = clampNum(Number(scarcity.tuning?.spoilage?.herbsMul ?? 0.85), 0.5, 1.4);
    const spoilMushrooms = Math.max(0, Math.floor((resources.mushrooms || 0) * scarcity.spoilageRate * mushroomMul));
    const spoilHerbs = Math.max(0, Math.floor((resources.herbs || 0) * scarcity.spoilageRate * herbsMul));
    const totalSpoilage = spoilFood + spoilMushrooms + spoilHerbs;
    if (spoilFood > 0) resources.food = Math.max(0, (resources.food || 0) - spoilFood);
    if (spoilMushrooms > 0) resources.mushrooms = Math.max(0, (resources.mushrooms || 0) - spoilMushrooms);
    if (spoilHerbs > 0) resources.herbs = Math.max(0, (resources.herbs || 0) - spoilHerbs);
    if (totalSpoilage > 0 && state.meta.tick - (state.world.climateRuntime.lastSpoilageEventTick || -1000) >= scarcity.ticksPerDay) {
      state.world.climateRuntime.lastSpoilageEventTick = state.meta.tick;
      events.push({
        type: "FOOD_SPOILAGE",
        season: scarcity.season,
        weather: scarcity.weather,
        spoilageRate: Number(scarcity.spoilageRate.toFixed(3)),
        foodLost: spoilFood,
        mushroomsLost: spoilMushrooms,
        herbsLost: spoilHerbs,
        text: `Spoilage consumed ${totalSpoilage} supplies (${scarcity.weather}, rate ${(scarcity.spoilageRate * 100).toFixed(1)}%).`
      });
    }
  }

  if (state.meta.tick % 8 === 0) {
    if ((resources.wood || 0) <= 0) {
      const pulledWood = pullFromDrops(state, "wood", 2);
      if (pulledWood > 0) {
        const gainedWood = scaledWoodGain(pulledWood);
        resources.wood = (resources.wood || 0) + gainedWood;
        events.push({
          type: "WOOD_RECOVERED_FROM_DROPS",
          amount: pulledWood,
          text: `Workers recovered ${pulledWood} wood from nearby drop piles (+${gainedWood} stock).`
        });
      }
    }
    if ((resources.wood || 0) > 0) {
      resources.wood -= 1;
      for (const goblinId of state.goblins.allIds) {
        const goblin = state.goblins.byId[goblinId];
        if (!goblin || !goblin.flags.alive || goblin.flags.missing) continue;
        goblin.needs.warmth = Math.max(0, goblin.needs.warmth - Math.max(1, Math.round(5 * tuning.warmthGainMul / Math.max(0.75, climateWarmthPressure))));
        goblin.psyche.stress = Math.max(0, goblin.psyche.stress - 1);
      }
      events.push({
        type: "CAMPFIRE_BURNED_WOOD",
        text: "The campfire burned 1 wood, improving warmth and calm."
      });
    } else {
      for (const goblinId of state.goblins.allIds) {
        const goblin = state.goblins.byId[goblinId];
        if (!goblin || !goblin.flags.alive || goblin.flags.missing) continue;
        goblin.needs.warmth = Math.min(100, goblin.needs.warmth + Math.max(1, Math.round(4 * tuning.warmthLossMul * climateWarmthPressure)));
      }
      events.push({
        type: "NO_FIREWOOD",
        text: "No firewood: camp warmth is dropping."
      });
    }
  }

  return events;
}

function ensureResourceTelemetryState(state) {
  const wm = state.worldMap || {};
  wm.structures = wm.structures || {};
  const telemetry = wm.structures.resourceTelemetry || {};
  if (!Number.isFinite(telemetry.tickWindow) || telemetry.tickWindow < 12) {
    telemetry.tickWindow = 120;
  }
  if (!Number.isFinite(telemetry.sampleEveryTicks) || telemetry.sampleEveryTicks < 1) {
    telemetry.sampleEveryTicks = 4;
  }
  telemetry.historyByResource = telemetry.historyByResource || {};
  telemetry.netDeltaByResource = telemetry.netDeltaByResource || {};
  telemetry.etaToZeroByResource = telemetry.etaToZeroByResource || {};
  if (!Number.isFinite(telemetry.lastSampleTick)) telemetry.lastSampleTick = -1;
  wm.structures.resourceTelemetry = telemetry;
  state.worldMap = wm;
  return telemetry;
}

export function resourceTelemetrySystem(state) {
  const events = [];
  const telemetry = ensureResourceTelemetryState(state);
  const sampleEveryTicks = Math.max(1, Math.round(Number(telemetry.sampleEveryTicks || 4)));
  const tickWindow = Math.max(12, Math.round(Number(telemetry.tickWindow || 120)));
  const tick = Number(state.meta?.tick || 0);
  if (tick <= 0) return events;
  if (tick % sampleEveryTicks !== 0) return events;

  const resources = state.tribe?.resources || {};
  const resourcePurposes = state.tribe?.resourcePurposes || {};
  const keys = new Set([
    ...Object.keys(resourcePurposes),
    ...Object.keys(resources),
    ...Object.keys(telemetry.historyByResource || {})
  ]);

  for (const key of keys) {
    const value = Number(resources[key] || 0);
    const history = telemetry.historyByResource[key] || [];
    history.push({ tick, value });
    while (history.length > 1 && tick - Number(history[0]?.tick || 0) > tickWindow) history.shift();
    telemetry.historyByResource[key] = history;

    const first = history[0] || { tick, value };
    const last = history[history.length - 1] || { tick, value };
    const elapsedTicks = Math.max(1, Number(last.tick || tick) - Number(first.tick || tick));
    const netDelta = Number(last.value || 0) - Number(first.value || 0);
    telemetry.netDeltaByResource[key] = Number.isFinite(netDelta) ? netDelta : 0;

    if (netDelta < -0.001) {
      const drawPerTick = Math.abs(netDelta) / elapsedTicks;
      telemetry.etaToZeroByResource[key] = drawPerTick > 0
        ? Math.max(0, Math.ceil(value / drawPerTick))
        : null;
    } else {
      telemetry.etaToZeroByResource[key] = null;
    }
  }
  telemetry.lastSampleTick = tick;
  return events;
}

function ensureResourceFlowState(state) {
  const wm = state.worldMap || {};
  wm.structures = wm.structures || {};
  const flow = wm.structures.resourceFlow || {};
  flow.sourcesByResource = flow.sourcesByResource || {};
  flow.sinksByResource = flow.sinksByResource || {};
  flow.lastEventsByResource = flow.lastEventsByResource || {};
  flow.previousResourceSnapshotByKey = flow.previousResourceSnapshotByKey || {};
  if (!Number.isFinite(flow.lastProcessedTick)) flow.lastProcessedTick = -1;
  wm.structures.resourceFlow = flow;
  state.worldMap = wm;
  return flow;
}

function inferResourcesFromEntry(entry, knownKeys) {
  const found = new Set();
  const details = entry?.details || {};
  const text = String(entry?.text || "").toLowerCase();
  const direct = details?.resource;
  if (typeof direct === "string" && direct) found.add(direct);
  const outputs = details?.outputs && typeof details.outputs === "object" ? details.outputs : null;
  const inputs = details?.inputs && typeof details.inputs === "object" ? details.inputs : null;
  for (const key of knownKeys) {
    if (outputs && Object.prototype.hasOwnProperty.call(outputs, key)) found.add(key);
    if (inputs && Object.prototype.hasOwnProperty.call(inputs, key)) found.add(key);
    if (text.includes(key.toLowerCase()) || text.includes(key.toLowerCase().replaceAll("_", " "))) found.add(key);
  }
  return [...found];
}

function inferEntryDirection(entry, resourceKey, netDiff) {
  const type = String(entry?.type || "").toUpperCase();
  const text = String(entry?.text || "").toLowerCase();
  if (
    type.includes("SHORTAGE")
    || type.includes("SPENT")
    || type.includes("CONSUM")
    || type.includes("LOST")
    || type.includes("BURNED")
    || type.includes("DAMAGED")
    || text.includes("shortage")
    || text.includes("stole")
    || text.includes("dropping")
    || text.includes("spoilage")
  ) return "sink";
  if (
    type.includes("RECOVERED")
    || type.includes("DELIVERED")
    || type.includes("COOKED")
    || type.includes("CRAFT")
    || type.includes("COLLECT")
    || type.includes("HARVEST")
    || type.includes("SMELT")
    || text.includes("recovered")
    || text.includes("converted")
    || text.includes("gained")
  ) return "source";
  if (Number(netDiff[resourceKey] || 0) < 0) return "sink";
  return "source";
}

function inferEntryAmount(entry, resourceKey) {
  const details = entry?.details || {};
  if (Number.isFinite(details?.amount)) return Math.max(1, Math.abs(Number(details.amount)));
  const outputs = details?.outputs?.[resourceKey];
  if (Number.isFinite(outputs)) return Math.max(1, Math.abs(Number(outputs)));
  const inputs = details?.inputs?.[resourceKey];
  if (Number.isFinite(inputs)) return Math.max(1, Math.abs(Number(inputs)));
  return 1;
}

function pushResourceEvent(flow, key, text) {
  const rows = flow.lastEventsByResource[key] || [];
  rows.push(text);
  while (rows.length > 6) rows.shift();
  flow.lastEventsByResource[key] = rows;
}

export function resourceFlowSystem(state) {
  const events = [];
  const tick = Number(state.meta?.tick || 0);
  if (tick <= 0) return events;
  const flow = ensureResourceFlowState(state);
  if (flow.lastProcessedTick === tick) return events;

  const resources = state.tribe?.resources || {};
  const resourcePurposes = state.tribe?.resourcePurposes || {};
  const knownKeys = [...new Set([
    ...Object.keys(resourcePurposes),
    ...Object.keys(resources),
    ...Object.keys(flow.previousResourceSnapshotByKey || {})
  ])];

  const netDiff = {};
  for (const key of knownKeys) {
    const prev = Number(flow.previousResourceSnapshotByKey[key] || 0);
    const curr = Number(resources[key] || 0);
    netDiff[key] = curr - prev;
  }

  const tickEntries = (state.chronicle || []).filter((entry) => Number(entry?.tick || -1) === tick);
  for (const entry of tickEntries) {
    const touchedResources = inferResourcesFromEntry(entry, knownKeys);
    for (const key of touchedResources) {
      const direction = inferEntryDirection(entry, key, netDiff);
      const amount = inferEntryAmount(entry, key);
      const bucket = direction === "sink" ? flow.sinksByResource : flow.sourcesByResource;
      bucket[key] = bucket[key] || {};
      const reason = String(entry?.type || "EVENT");
      bucket[key][reason] = Number(bucket[key][reason] || 0) + amount;
      pushResourceEvent(flow, key, `${entry.type}: ${entry.text || entry.type}`);
    }
  }

  for (const [key, delta] of Object.entries(netDiff)) {
    if (Math.abs(delta) < 0.001) continue;
    const bucket = delta > 0 ? flow.sourcesByResource : flow.sinksByResource;
    bucket[key] = bucket[key] || {};
    bucket[key].net_change = Number(bucket[key].net_change || 0) + Math.abs(delta);
  }

  for (const key of knownKeys) {
    flow.previousResourceSnapshotByKey[key] = Number(resources[key] || 0);
    flow.sourcesByResource[key] = flow.sourcesByResource[key] || {};
    flow.sinksByResource[key] = flow.sinksByResource[key] || {};
    flow.lastEventsByResource[key] = flow.lastEventsByResource[key] || [];
  }
  flow.lastProcessedTick = tick;
  return events;
}
