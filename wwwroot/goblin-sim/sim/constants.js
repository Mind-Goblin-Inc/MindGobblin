export const SCHEMA_VERSION = 2;
export const NEED_KEYS = [
  "hunger",
  "thirst",
  "rest",
  "warmth",
  "safety",
  "belonging",
  "autonomy",
  "esteem",
  "greed",
  "novelty"
];

export const MOOD_STATES = ["stable", "frayed", "agitated", "volatile", "breaking"];

export const NEED_DECAY_RATES = {
  hunger: 0.55,
  thirst: 0.65,
  rest: 0.5,
  warmth: 0.2,
  safety: 0.18,
  belonging: 0.12,
  autonomy: 0.08,
  esteem: 0.08,
  greed: 0.07,
  novelty: 0.12
};

export const MEMORY_HALF_LIFE = {
  positive: 180,
  neutral: 240,
  negative: 300
};

export const JOB_DEFS = [
  {
    key: "forage",
    domain: "survival",
    requiredAptitudes: ["scavenging", "scouting"],
    riskProfile: { injury: 0.05, stress: 0.06, conflict: 0.03 },
    baseDurationTicks: 20,
    suitabilityWeights: { scavenging: 1.4, scouting: 1.1, agility: 0.6, perception: 0.8 }
  },
  {
    key: "mine",
    domain: "industry",
    requiredAptitudes: ["mining"],
    riskProfile: { injury: 0.18, stress: 0.1, conflict: 0.04 },
    baseDurationTicks: 24,
    suitabilityWeights: { mining: 1.5, brawn: 0.9, grit: 1.0 }
  },
  {
    key: "patrol",
    domain: "security",
    requiredAptitudes: ["scouting", "stealth"],
    riskProfile: { injury: 0.12, stress: 0.09, conflict: 0.11 },
    baseDurationTicks: 18,
    suitabilityWeights: { scouting: 1.2, stealth: 0.8, will: 0.8, perception: 0.9 }
  },
  {
    key: "mediate-dispute",
    domain: "social",
    requiredAptitudes: ["bargaining"],
    riskProfile: { injury: 0.01, stress: 0.08, conflict: 0.1 },
    baseDurationTicks: 16,
    suitabilityWeights: { bargaining: 1.3, social: 1.0, will: 0.8 }
  },
  {
    key: "omen-reading",
    domain: "arcane",
    requiredAptitudes: ["ritualism", "lorekeeping"],
    riskProfile: { injury: 0.03, stress: 0.12, conflict: 0.02 },
    baseDurationTicks: 14,
    suitabilityWeights: { ritualism: 1.4, lorekeeping: 1.0, cunning: 0.8 }
  },
  {
    key: "ruin-scouting",
    domain: "exploration",
    requiredAptitudes: ["scouting", "stealth"],
    riskProfile: { injury: 0.2, stress: 0.14, conflict: 0.07 },
    baseDurationTicks: 30,
    suitabilityWeights: { scouting: 1.6, stealth: 1.0, agility: 0.8, perception: 1.0 }
  }
];

export const PERSONALITY_FACETS = [
  "aggression",
  "curiosity",
  "discipline",
  "sociability",
  "greediness",
  "bravery"
];

export const RESOURCE_PURPOSES = {
  food: "Consumed regularly to reduce hunger and keep the tribe functional.",
  water: "Consumed regularly to reduce thirst and avoid stress spikes.",
  wood: "Burned for camp warmth and safety stability over time.",
  mushrooms: "Gathered from wild nodes; can be cooked into emergency food.",
  metal_ore: "Raw ore extracted from hills/caves and ruins salvage.",
  metal_parts: "Processed mechanical parts used by advanced structures.",
  fiber: "Raw plant fibers gathered from reeds and wild growth.",
  rope: "Cordage used for traps, mechanisms, and construction.",
  wood_planks: "Processed timber for structured builds and defenses.",
  charcoal: "Fuel feedstock for smelting and industrial crafting.",
  ammo_bolts: "Ammunition stock for spring turrets.",
  springs: "Mechanical trigger components for automated devices.",
  herbs: "Medicinal plants for recovery and support systems.",
  fuel: "General fuel reserve for beacons and preservation systems.",
  ore: "Strategic stock for future crafting and fortification systems.",
  lore: "Knowledge reserve used for advanced rituals/research later."
};

export const CLIMATE_SEASON_KEYS = ["spring", "summer", "autumn", "winter"];
export const CLIMATE_WEATHER_KEYS = ["clear", "rain", "storm", "cold-snap", "heat-wave", "fog"];
export const CLIMATE_TICKS_PER_DAY = 144;

export const CLIMATE_DEFAULT_CONFIG = {
  daysPerSeason: 18,
  ticksPerDay: CLIMATE_TICKS_PER_DAY,
  weatherWeightsBySeason: {
    spring: { clear: 0.3, rain: 0.35, storm: 0.08, "cold-snap": 0.12, "heat-wave": 0.03, fog: 0.12 },
    summer: { clear: 0.36, rain: 0.18, storm: 0.08, "cold-snap": 0.01, "heat-wave": 0.25, fog: 0.12 },
    autumn: { clear: 0.26, rain: 0.28, storm: 0.2, "cold-snap": 0.07, "heat-wave": 0.02, fog: 0.17 },
    winter: { clear: 0.2, rain: 0.08, storm: 0.14, "cold-snap": 0.4, "heat-wave": 0.0, fog: 0.18 }
  },
  seasonEffects: {
    spring: { foodYieldMul: 1.08, woodYieldMul: 1.02, hazardMul: 0.95, travelMul: 1.02, thirstPressureMul: 0.95, warmthPressureMul: 0.95 },
    summer: { foodYieldMul: 1.12, woodYieldMul: 1.0, hazardMul: 1.02, travelMul: 1.0, thirstPressureMul: 1.12, warmthPressureMul: 0.9 },
    autumn: { foodYieldMul: 1.05, woodYieldMul: 1.06, hazardMul: 1.05, travelMul: 0.97, thirstPressureMul: 1.0, warmthPressureMul: 1.04 },
    winter: { foodYieldMul: 0.78, woodYieldMul: 0.9, hazardMul: 1.24, travelMul: 0.82, thirstPressureMul: 1.04, warmthPressureMul: 1.34 }
  },
  weatherEffects: {
    clear: { foodYieldMul: 1.0, woodYieldMul: 1.0, hazardMul: 1.0, travelMul: 1.0, thirstPressureMul: 1.0, warmthPressureMul: 1.0 },
    rain: { foodYieldMul: 1.02, woodYieldMul: 1.0, hazardMul: 1.03, travelMul: 0.95, thirstPressureMul: 0.96, warmthPressureMul: 1.02 },
    storm: { foodYieldMul: 0.94, woodYieldMul: 0.96, hazardMul: 1.2, travelMul: 0.82, thirstPressureMul: 1.02, warmthPressureMul: 1.08 },
    "cold-snap": { foodYieldMul: 0.88, woodYieldMul: 0.92, hazardMul: 1.22, travelMul: 0.86, thirstPressureMul: 0.98, warmthPressureMul: 1.28 },
    "heat-wave": { foodYieldMul: 0.92, woodYieldMul: 0.98, hazardMul: 1.08, travelMul: 0.9, thirstPressureMul: 1.3, warmthPressureMul: 0.82 },
    fog: { foodYieldMul: 0.98, woodYieldMul: 1.0, hazardMul: 1.08, travelMul: 0.9, thirstPressureMul: 1.0, warmthPressureMul: 1.02 }
  }
};

export const CLIMATE_SCARCITY_TUNING = {
  spoilage: {
    bySeason: {
      spring: 0.009,
      summer: 0.014,
      autumn: 0.011,
      winter: 0.006
    },
    weatherAdd: {
      "heat-wave": 0.014,
      rain: 0.005,
      storm: 0.008,
      "cold-snap": -0.004,
      fog: 0.002,
      clear: 0
    },
    weatherIntensityFactor: {
      "heat-wave": 0.014,
      rain: 0.008,
      storm: 0.01,
      "cold-snap": 0,
      fog: 0.004,
      clear: 0
    },
    maxRate: 0.06,
    mushroomMul: 1.08,
    herbsMul: 0.85
  },
  rationing: {
    consumptionMul: 0.93,
    lowStockDays: 3,
    forecastWindowDays: 2,
    triggerOnModerateRisk: false
  }
};
