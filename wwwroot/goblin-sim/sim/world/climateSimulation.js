import {
  CLIMATE_DEFAULT_CONFIG,
  CLIMATE_SEASON_KEYS,
  CLIMATE_TICKS_PER_DAY,
  CLIMATE_WEATHER_KEYS
} from "../constants.js";

function clamp(v, min, max) {
  if (!Number.isFinite(v)) return min;
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

function seasonIndex(key) {
  const idx = CLIMATE_SEASON_KEYS.indexOf(String(key));
  return idx >= 0 ? idx : 0;
}

function seasonKeyByIndex(idx) {
  return CLIMATE_SEASON_KEYS[((idx % CLIMATE_SEASON_KEYS.length) + CLIMATE_SEASON_KEYS.length) % CLIMATE_SEASON_KEYS.length];
}

function pickWeighted(seedParts, table) {
  const entries = Object.entries(table || {}).filter(([, w]) => Number(w) > 0);
  if (!entries.length) return "clear";
  let total = 0;
  for (const [, w] of entries) total += Number(w);
  let roll = rand01(...seedParts) * total;
  for (const [k, w] of entries) {
    roll -= Number(w);
    if (roll <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

function normalizeWorldClimateState(world) {
  world.climateConfig = world.climateConfig || CLIMATE_DEFAULT_CONFIG;
  const daysPerSeason = Math.max(6, Math.round(Number(world.climateConfig.daysPerSeason || CLIMATE_DEFAULT_CONFIG.daysPerSeason)));
  const ticksPerDay = Math.max(24, Math.round(Number(world.climateConfig.ticksPerDay || CLIMATE_TICKS_PER_DAY)));
  world.season = world.season || {
    key: "spring",
    year: 1,
    dayOfSeason: 1,
    daysPerSeason
  };
  world.season.key = CLIMATE_SEASON_KEYS.includes(world.season.key) ? world.season.key : "spring";
  world.season.year = Math.max(1, Math.round(Number(world.season.year || 1)));
  world.season.dayOfSeason = clamp(Math.round(Number(world.season.dayOfSeason || 1)), 1, daysPerSeason);
  world.season.daysPerSeason = daysPerSeason;

  world.weather = world.weather || {
    current: "clear",
    intensity: 0.2,
    startedAtTick: 0,
    expectedDurationDays: 1
  };
  world.weather.current = CLIMATE_WEATHER_KEYS.includes(world.weather.current) ? world.weather.current : "clear";
  world.weather.intensity = clamp(Number(world.weather.intensity || 0.2), 0, 1);
  world.weather.startedAtTick = Math.max(0, Math.round(Number(world.weather.startedAtTick || 0)));
  world.weather.expectedDurationDays = clamp(Math.round(Number(world.weather.expectedDurationDays || 1)), 1, 5);

  world.forecast = world.forecast || { next7Days: [] };
  world.climateModifiers = world.climateModifiers || { byBiome: {}, global: {}, updatedAtTick: 0, signature: "" };
  world.date = world.date || { day: 1, season: world.season.key, year: world.season.year };
  world.date.season = world.season.key;
  world.date.year = world.season.year;
  return { daysPerSeason, ticksPerDay };
}

function resolveWeatherForDay(world, seed, year, dayOfSeason, season) {
  const table = world.climateConfig?.weatherWeightsBySeason?.[season] || CLIMATE_DEFAULT_CONFIG.weatherWeightsBySeason[season];
  return pickWeighted(["weather", seed, year, season, dayOfSeason], table);
}

function resolveIntensityForDay(seed, year, season, dayOfSeason, weather) {
  const base = rand01("weather-intensity", seed, year, season, dayOfSeason, weather);
  const floor = weather === "storm" ? 0.62 : weather === "cold-snap" || weather === "heat-wave" ? 0.58 : 0.22;
  return clamp(floor + base * (1 - floor), 0, 1);
}

function riskForWeather(weather, intensity) {
  if (weather === "storm" || weather === "cold-snap" || weather === "heat-wave") return intensity >= 0.7 ? "high" : "moderate";
  if (weather === "rain" || weather === "fog") return intensity >= 0.72 ? "moderate" : "low";
  return "low";
}

function confidenceForOffset(offset, intensity) {
  const base = 0.9 - offset * 0.08;
  const wobble = (0.5 - intensity) * 0.1;
  return clamp(base + wobble, 0.35, 0.95);
}

function computeForecast(world, seed) {
  const out = [];
  const daysPerSeason = world.season.daysPerSeason;
  const seasonIdx = seasonIndex(world.season.key);
  for (let offset = 1; offset <= 7; offset += 1) {
    let day = world.season.dayOfSeason + offset;
    let year = world.season.year;
    let seasonOffset = seasonIdx;
    while (day > daysPerSeason) {
      day -= daysPerSeason;
      seasonOffset += 1;
      if (seasonOffset >= CLIMATE_SEASON_KEYS.length) {
        seasonOffset = 0;
        year += 1;
      }
    }
    const season = seasonKeyByIndex(seasonOffset);
    const likelyWeather = resolveWeatherForDay(world, seed, year, day, season);
    const intensity = resolveIntensityForDay(seed, year, season, day, likelyWeather);
    out.push({
      dayOffset: offset,
      season,
      likelyWeather,
      confidence: Number(confidenceForOffset(offset, intensity).toFixed(2)),
      risk: riskForWeather(likelyWeather, intensity)
    });
  }
  return out;
}

function computeGlobalClimateModifiers(world) {
  const seasonFx = world.climateConfig?.seasonEffects?.[world.season.key] || CLIMATE_DEFAULT_CONFIG.seasonEffects[world.season.key] || {};
  const weatherFx = world.climateConfig?.weatherEffects?.[world.weather.current] || CLIMATE_DEFAULT_CONFIG.weatherEffects[world.weather.current] || {};
  return {
    foodYieldMul: clamp(Number(seasonFx.foodYieldMul || 1) * Number(weatherFx.foodYieldMul || 1), 0.5, 1.4),
    woodYieldMul: clamp(Number(seasonFx.woodYieldMul || 1) * Number(weatherFx.woodYieldMul || 1), 0.5, 1.4),
    hazardMul: clamp(Number(seasonFx.hazardMul || 1) * Number(weatherFx.hazardMul || 1), 0.75, 1.6),
    travelMul: clamp(Number(seasonFx.travelMul || 1) * Number(weatherFx.travelMul || 1), 0.65, 1.25),
    thirstPressureMul: clamp(Number(seasonFx.thirstPressureMul || 1) * Number(weatherFx.thirstPressureMul || 1), 0.7, 1.5),
    warmthPressureMul: clamp(Number(seasonFx.warmthPressureMul || 1) * Number(weatherFx.warmthPressureMul || 1), 0.7, 1.6)
  };
}

function computeBiomeModifiers(globalMods, biome) {
  const b = String(biome || "unknown");
  let food = globalMods.foodYieldMul;
  let wood = globalMods.woodYieldMul;
  let hazard = globalMods.hazardMul;
  let travel = globalMods.travelMul;
  if (b === "forest") {
    food *= 1.06;
    wood *= 1.12;
    travel *= 0.97;
  } else if (b === "hills") {
    travel *= 0.94;
    hazard *= 1.05;
  } else if (b === "swamp") {
    travel *= 0.86;
    hazard *= 1.15;
  } else if (b === "badlands") {
    food *= 0.84;
    hazard *= 1.1;
  } else if (b === "caves" || b === "ruins") {
    food *= 0.9;
    wood *= 0.72;
    hazard *= 1.08;
  }
  return {
    foodYieldMul: clamp(food, 0.4, 1.8),
    woodYieldMul: clamp(wood, 0.4, 1.8),
    hazardMul: clamp(hazard, 0.6, 1.9),
    travelMul: clamp(travel, 0.5, 1.4)
  };
}

function applyClimateModifiers(state, events) {
  const world = state.world;
  const globalMods = computeGlobalClimateModifiers(world);
  const signature = [
    world.season.key,
    world.season.year,
    world.season.dayOfSeason,
    world.weather.current,
    world.weather.intensity.toFixed(3)
  ].join("|");
  if (world.climateModifiers.signature === signature) return;

  const prev = world.climateModifiers.global || {};
  const byBiome = {};
  const seenBiomes = new Set();
  for (const region of Object.values(state.worldMap?.regionsById || {})) {
    const biome = String(region?.biome || "unknown");
    if (seenBiomes.has(biome)) continue;
    seenBiomes.add(biome);
    byBiome[biome] = computeBiomeModifiers(globalMods, biome);
  }

  world.climateModifiers = {
    byBiome,
    global: globalMods,
    updatedAtTick: state.meta.tick,
    signature
  };

  const foodDelta = Number((globalMods.foodYieldMul - Number(prev.foodYieldMul || 1)).toFixed(3));
  const woodDelta = Number((globalMods.woodYieldMul - Number(prev.woodYieldMul || 1)).toFixed(3));
  if (Math.abs(foodDelta) >= 0.08) {
    events.push({
      type: "SEASONAL_RESOURCE_SHIFT",
      resource: "food",
      deltaMul: foodDelta,
      biome: "global",
      text: `Climate shifted food yield (${globalMods.foodYieldMul.toFixed(2)}x).`
    });
  }
  if (Math.abs(woodDelta) >= 0.08) {
    events.push({
      type: "SEASONAL_RESOURCE_SHIFT",
      resource: "wood",
      deltaMul: woodDelta,
      biome: "global",
      text: `Climate shifted wood yield (${globalMods.woodYieldMul.toFixed(2)}x).`
    });
  }
}

export function climateSimulationSystem(state) {
  const events = [];
  if (!state?.world || !state?.meta || !state?.worldMap) return events;
  const { ticksPerDay } = normalizeWorldClimateState(state.world);

  const isDayBoundary = state.meta.tick > 0 && state.meta.tick % ticksPerDay === 0;
  if (isDayBoundary) {
    state.world.season.dayOfSeason += 1;
    if (state.world.season.dayOfSeason > state.world.season.daysPerSeason) {
      state.world.season.dayOfSeason = 1;
      const nextSeasonIdx = (seasonIndex(state.world.season.key) + 1) % CLIMATE_SEASON_KEYS.length;
      state.world.season.key = seasonKeyByIndex(nextSeasonIdx);
      if (nextSeasonIdx === 0) state.world.season.year += 1;
      events.push({
        type: "SEASON_STARTED",
        season: state.world.season.key,
        year: state.world.season.year,
        text: `Season shifted to ${state.world.season.key}, year ${state.world.season.year}.`
      });
    }
    events.push({
      type: "SEASON_DAY_CHANGED",
      season: state.world.season.key,
      year: state.world.season.year,
      dayOfSeason: state.world.season.dayOfSeason,
      text: `Day ${state.world.season.dayOfSeason}/${state.world.season.daysPerSeason} of ${state.world.season.key}.`
    });

    const nextWeather = resolveWeatherForDay(
      state.world,
      state.meta.seed,
      state.world.season.year,
      state.world.season.dayOfSeason,
      state.world.season.key
    );
    const nextIntensity = resolveIntensityForDay(
      state.meta.seed,
      state.world.season.year,
      state.world.season.key,
      state.world.season.dayOfSeason,
      nextWeather
    );
    if (nextWeather !== state.world.weather.current || Math.abs(nextIntensity - state.world.weather.intensity) > 0.08) {
      state.world.weather.current = nextWeather;
      state.world.weather.intensity = nextIntensity;
      state.world.weather.startedAtTick = state.meta.tick;
      state.world.weather.expectedDurationDays = clamp(
        1 + Math.floor(rand01("weather-duration", state.meta.seed, state.world.season.year, state.world.season.dayOfSeason, nextWeather) * 3),
        1,
        4
      );
      events.push({
        type: "WEATHER_CHANGED",
        weather: nextWeather,
        intensity: Number(nextIntensity.toFixed(2)),
        text: `Weather changed to ${nextWeather} (${Math.round(nextIntensity * 100)}% intensity).`
      });
    }

    state.world.forecast.next7Days = computeForecast(state.world, state.meta.seed);
    const warning = state.world.forecast.next7Days.find((f) => f.risk !== "low");
    if (warning) {
      events.push({
        type: "WEATHER_WARNING",
        weather: warning.likelyWeather,
        etaDays: warning.dayOffset,
        risk: warning.risk,
        text: `${warning.risk.toUpperCase()} weather risk: ${warning.likelyWeather} in ${warning.dayOffset} day(s).`
      });
    }
  } else if (!Array.isArray(state.world.forecast?.next7Days) || !state.world.forecast.next7Days.length) {
    state.world.forecast = state.world.forecast || {};
    state.world.forecast.next7Days = computeForecast(state.world, state.meta.seed);
  }

  state.world.date.season = state.world.season.key;
  state.world.date.year = state.world.season.year;
  state.world.date.day = ((state.world.season.year - 1) * state.world.season.daysPerSeason * CLIMATE_SEASON_KEYS.length)
    + (seasonIndex(state.world.season.key) * state.world.season.daysPerSeason)
    + state.world.season.dayOfSeason;
  state.world.weather.type = state.world.weather.current;

  applyClimateModifiers(state, events);
  return events;
}
