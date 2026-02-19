const DEFAULT_RACE_RUNTIME_CONFIG_BY_KIND = {
  wolf: {
    spawnBudget: {
      edgePressureWeight: 0.7,
      baseCapMin: 2,
      baseCapMax: 8
    },
    aggro: {
      detectionRadius: 5.5,
      engageRange: 1.5,
      commitTicks: 20,
      retargetCooldownTicks: 6
    },
    retreat: {
      breakoffTicks: 10,
      homePull: 1
    },
    patrol: {
      wanderRadiusBase: 10,
      packHuntBaseRange: 24
    },
    outpostPolicy: {
      enabled: true,
      outpostKind: "wolf-pack",
      ownerFactionId: "faction-wildpack",
      outpostName: "Wolf Lair",
      radiusTiles: 4,
      threatTier: 2
    },
    combat: {
      attackCooldownTicks: 5
    },
    threat: {
      homeWarnDistance: 6
    }
  },
  barbarian: {
    spawnBudget: {
      startTick: 48,
      edgePressureWeight: 0.9,
      baseCapMin: 2,
      baseCapMax: 10,
      growthPerDay: 0.65,
      growthCapMax: 18,
      cadenceStart: 150,
      cadenceDecayPerDay: 3.5,
      cadenceMin: 36,
      cadenceMax: 150,
      batchBase: 1,
      batchPerDays: 7,
      batchMax: 4
    },
    aggro: {
      detectionRadius: 7,
      engageRange: 1.5,
      commitTicks: 20,
      retargetCooldownTicks: 6
    },
    retreat: {
      breakoffTicks: 10,
      homePull: 1
    },
    patrol: {
      wanderRadiusBase: 8
    },
    outpostPolicy: {
      enabled: true,
      outpostKind: "warcamp",
      ownerFactionId: "faction-barbarian-clans",
      outpostName: "Barbarian Warcamp",
      radiusTiles: 5,
      threatTier: 3
    },
    combat: {
      attackCooldownTicks: 3
    },
    threat: {
      homeWarnDistance: 7
    }
  },
  human_raider: {
    spawnBudget: {},
    aggro: { detectionRadius: 7, engageRange: 1.5, commitTicks: 20, retargetCooldownTicks: 6 },
    retreat: { breakoffTicks: 10, homePull: 1 },
    patrol: { wanderRadiusBase: 8 },
    outpostPolicy: {
      enabled: true,
      outpostKind: "raider-camp",
      ownerFactionId: "faction-human-raiders",
      outpostName: "Raider Camp",
      radiusTiles: 4,
      threatTier: 2
    },
    combat: { attackCooldownTicks: 3 },
    threat: { homeWarnDistance: 7 }
  },
  ogre: {
    spawnBudget: {
      startTick: 720,
      baseCapMin: 0,
      baseCapMax: 2,
      growthPerDay: 0.12,
      growthCapMax: 3,
      cadenceStart: 180,
      cadenceDecayPerDay: 1.8,
      cadenceMin: 72,
      cadenceMax: 180,
      batchBase: 1,
      batchPerDays: 9,
      batchMax: 2
    },
    aggro: { detectionRadius: 7, engageRange: 1.5, commitTicks: 20, retargetCooldownTicks: 6 },
    retreat: { breakoffTicks: 10, homePull: 1 },
    patrol: { wanderRadiusBase: 6 },
    outpostPolicy: {
      enabled: true,
      outpostKind: "siege-den",
      ownerFactionId: "faction-ogre-clans",
      outpostName: "Siege Den",
      radiusTiles: 5,
      threatTier: 4
    },
    combat: { attackCooldownTicks: 4 },
    threat: { homeWarnDistance: 8 }
  },
  shaman: {
    spawnBudget: {
      startTick: 576,
      baseCapMin: 0,
      baseCapMax: 2,
      growthPerDay: 0.16,
      growthCapMax: 4,
      cadenceStart: 160,
      cadenceDecayPerDay: 2.1,
      cadenceMin: 60,
      cadenceMax: 160,
      batchBase: 1,
      batchPerDays: 8,
      batchMax: 2
    },
    aggro: { detectionRadius: 7, engageRange: 1.5, commitTicks: 20, retargetCooldownTicks: 6 },
    retreat: { breakoffTicks: 10, homePull: 1 },
    patrol: { wanderRadiusBase: 7 },
    outpostPolicy: {
      enabled: true,
      outpostKind: "ritual-circle",
      ownerFactionId: "faction-shaman-tribes",
      outpostName: "Ritual Circle",
      radiusTiles: 4,
      threatTier: 3
    },
    combat: { attackCooldownTicks: 4 },
    threat: { homeWarnDistance: 7 }
  },
  elf_ranger: {
    spawnBudget: {
      startTick: 432,
      baseCapMin: 0,
      baseCapMax: 3,
      growthPerDay: 0.2,
      growthCapMax: 5,
      cadenceStart: 150,
      cadenceDecayPerDay: 2.4,
      cadenceMin: 54,
      cadenceMax: 150,
      batchBase: 1,
      batchPerDays: 7,
      batchMax: 2
    },
    aggro: { detectionRadius: 8, engageRange: 2.2, commitTicks: 20, retargetCooldownTicks: 6 },
    retreat: { breakoffTicks: 10, homePull: 1 },
    patrol: { wanderRadiusBase: 9 },
    outpostPolicy: {
      enabled: true,
      outpostKind: "watch-lodge",
      ownerFactionId: "faction-elf-rangers",
      outpostName: "Watch Lodge",
      radiusTiles: 4,
      threatTier: 3
    },
    combat: { attackCooldownTicks: 3 },
    threat: { homeWarnDistance: 8 }
  },
  bear: {
    spawnBudget: {},
    aggro: { detectionRadius: 5, engageRange: 1.5, commitTicks: 20, retargetCooldownTicks: 6 },
    retreat: { breakoffTicks: 10, homePull: 1 },
    patrol: { wanderRadiusBase: 7 },
    outpostPolicy: { enabled: false },
    combat: { attackCooldownTicks: 4 },
    threat: { homeWarnDistance: 6 }
  },
  snake: {
    spawnBudget: {},
    aggro: { detectionRadius: 4, engageRange: 1.5, commitTicks: 20, retargetCooldownTicks: 6 },
    retreat: { breakoffTicks: 10, homePull: 1 },
    patrol: { wanderRadiusBase: 6 },
    outpostPolicy: { enabled: false },
    combat: { attackCooldownTicks: 4 },
    threat: { homeWarnDistance: 5 }
  },
  boar: {
    spawnBudget: {},
    aggro: { detectionRadius: 5, engageRange: 1.5, commitTicks: 20, retargetCooldownTicks: 6 },
    retreat: { breakoffTicks: 10, homePull: 1 },
    patrol: { wanderRadiusBase: 7 },
    outpostPolicy: { enabled: false },
    combat: { attackCooldownTicks: 4 },
    threat: { homeWarnDistance: 6 }
  },
  crow: {
    spawnBudget: {},
    aggro: { detectionRadius: 6, engageRange: 1.5, commitTicks: 20, retargetCooldownTicks: 6 },
    retreat: { breakoffTicks: 10, homePull: 1 },
    patrol: { wanderRadiusBase: 10 },
    outpostPolicy: { enabled: false },
    combat: { attackCooldownTicks: 3 },
    threat: { homeWarnDistance: 7 }
  }
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function defaultRaceRuntimeConfigByKind() {
  return deepClone(DEFAULT_RACE_RUNTIME_CONFIG_BY_KIND);
}

export function normalizeRaceRuntimeConfigByKind(raw) {
  const base = defaultRaceRuntimeConfigByKind();
  if (!raw || typeof raw !== "object") return base;
  const out = {};
  for (const [kind, defaults] of Object.entries(base)) {
    const incoming = raw[kind];
    if (!incoming || typeof incoming !== "object") {
      out[kind] = defaults;
      continue;
    }
    out[kind] = {
      ...defaults,
      ...incoming,
      spawnBudget: { ...defaults.spawnBudget, ...(incoming.spawnBudget || {}) },
      aggro: { ...defaults.aggro, ...(incoming.aggro || {}) },
      retreat: { ...defaults.retreat, ...(incoming.retreat || {}) },
      patrol: { ...defaults.patrol, ...(incoming.patrol || {}) },
      outpostPolicy: { ...defaults.outpostPolicy, ...(incoming.outpostPolicy || {}) },
      combat: { ...defaults.combat, ...(incoming.combat || {}) },
      threat: { ...defaults.threat, ...(incoming.threat || {}) }
    };
  }
  return out;
}
