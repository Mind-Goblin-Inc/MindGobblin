import { CLIMATE_DEFAULT_CONFIG, CLIMATE_TICKS_PER_DAY, RESOURCE_PURPOSES, SCHEMA_VERSION } from "./constants.js";
import { createGoblin } from "./goblinFactory.js";
import { nextId } from "./ids.js";
import { initRng, randFloat } from "./rng.js";
import { buildArtifactIdentity } from "./lore/artifactIdentity.js";
import { generateWorldMapState } from "./world/worldGen.js";
import { ensureWorldContracts } from "./world/contracts.js";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createInitialState(seed = "phase1-seed", goblinCount = 12) {
  const randomizationProfile = buildRandomizationProfile(seed);
  const rng = initRng(seed);
  const worldMap = generateWorldMapState({
    seed,
    size: "large",
    climatePreset: "temperate",
    genVersion: 1
  });

  const state = {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      runId: `run-${seed}`,
      tick: 0,
      simTimeMs: 0,
      simulationSpeed: 16,
      paused: false,
      autoPause: {
        enabled: false,
        onUrgent: true,
        onCriticalNeeds: true,
        criticalNeedsThreshold: 3,
        onResourceShortage: true,
        minTicksBetweenPauses: 30
      },
      lastAutoPauseTick: null,
      seed,
      randomizationProfile,
      tuning: {
        wildlife: {
          detectionRadiusScale: 1,
          targetCommitTicks: 20,
          retargetCooldownTicks: 6,
          breakoffTicks: 10,
          engageRange: 1.5,
          wallPenaltyScale: 1
        },
        threat: {
          localRadius: 9,
          directRadius: 4.5
        }
      },
      rngState: rng.state,
      nextId: 1
    },
    world: {
      date: { day: 1, season: "spring", year: 1 },
      season: {
        key: "spring",
        year: 1,
        dayOfSeason: 1,
        daysPerSeason: CLIMATE_DEFAULT_CONFIG.daysPerSeason
      },
      weather: {
        current: "clear",
        type: "clear",
        intensity: 0.2,
        startedAtTick: 0,
        expectedDurationDays: 1
      },
      forecast: {
        next7Days: []
      },
      climateConfig: {
        ...deepClone(CLIMATE_DEFAULT_CONFIG),
        ticksPerDay: CLIMATE_TICKS_PER_DAY
      },
      climateModifiers: {
        byBiome: {},
        global: {
          foodYieldMul: 1,
          woodYieldMul: 1,
          hazardMul: 1,
          travelMul: 1,
          thirstPressureMul: 1,
          warmthPressureMul: 1
        },
        updatedAtTick: 0,
        signature: ""
      },
      regionsById: worldMap.regionsById,
      sitesById: worldMap.sitesById,
      factionsById: {},
      activeRegionId: worldMap.player.startingSiteId
        ? worldMap.sitesById[worldMap.player.startingSiteId]?.regionId || null
        : null
    },
    tribe: {
      name: "Ashcap",
      resources: {
        food: 80,
        water: 90,
        wood: 18,
        mushrooms: 6,
        metal_ore: 0,
        metal_parts: 0,
        fiber: 0,
        rope: 0,
        wood_planks: 0,
        charcoal: 0,
        ammo_bolts: 0,
        springs: 0,
        herbs: 0,
        fuel: 0,
        ore: 10,
        lore: 5
      },
      resourcePurposes: RESOURCE_PURPOSES,
      structuresById: {},
      policies: {},
      threat: { alertLevel: 0 },
      governance: {
        leaderGoblinId: null,
        leadershipScoreByGoblinId: {},
        policy: {
          riskPosture: "balanced",
          responseProfile: "balanced",
          expansionEnabled: true,
          reserveFloors: {
            ammo_bolts: 14,
            metal_parts: 12,
            springs: 8,
            wood_planks: 16
          }
        },
        recommendations: {
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
        },
        runtime: {
          lastPolicyTick: -1000,
          lastStrategicTick: -1000,
          lastElectionTick: -1000,
          reelectAfterTick: 0,
          emergencyOverrideUntilTick: -1,
          leaderStability: 0.5
        }
      }
    },
    goblins: {
      byId: {},
      allIds: [],
      relationships: {}
    },
    jobs: {
      byId: {},
      queue: [],
      active: [],
      completed: [],
      failed: []
    },
    events: { pending: [], active: [], resolved: [] },
    combat: { encountersById: {}, activeIds: [], resolvedIds: [] },
    items: { byId: {}, ownership: {} },
    worldMap,
    lore: {
      artifacts: { byId: {}, allIds: [] },
      chronicleIndex: {
        byType: {},
        byGoblinId: {},
        byFactionId: {},
        byArtifactId: {},
        byTickBucket: {},
        cursor: 0
      },
      causality: {
        edgesById: {},
        byCauseEntryId: {},
        byEffectEntryId: {},
        cursor: 0
      },
      callbacks: {
        cooldownByKey: {},
        lastResolvedAtTick: 0
      }
    },
    chronicle: [],
    debug: {
      warnings: [],
      lastSystemOrder: [],
      selectedGoblinId: null,
      trackedGoblinId: null,
      selectedWildlifeId: null,
      trackedWildlifeId: null,
      selectedArtifactId: null,
      selectedChronicleEntryId: null,
      chronicleSearch: "",
      chronicleType: "all",
      chronicleSeverity: "all",
      chronicleCausalityDepth: 1,
      inspectionDepth: 2,
      pauseSummary: {
        fromTick: 0,
        toTick: 0,
        reason: "",
        items: []
      }
    }
  };

  for (let i = 0; i < goblinCount; i += 1) {
    const id = nextId(state, "goblin");
    const goblin = createGoblin({
      id,
      rng,
      tick: 0,
      originSiteId: worldMap.player.startingSiteId
    });
    state.goblins.byId[id] = goblin;
    state.goblins.allIds.push(id);
    state.chronicle.push({
      id: nextId(state, "chron"),
      tick: 0,
      type: "GOBLIN_CREATED",
      goblinId: id,
      text: `${goblin.identity.name} joined the tribe.`
    });
  }

  for (let i = 0; i < 3; i += 1) {
    const id = nextId(state, "artifact");
    const identity = buildArtifactIdentity({
      artifactId: id,
      runSeed: state.meta.seed,
      creationTick: state.meta.tick
    });
    const creatorGoblinId = state.goblins.allIds[i % state.goblins.allIds.length];
    const artifact = {
      id,
      displayName: identity.displayName,
      epithet: identity.epithet,
      category: i % 2 === 0 ? "tool" : "trinket",
      rarityTier: i === 0 ? 2 : 1,
      origin: {
        createdTick: 0,
        createdSiteId: worldMap.player.startingSiteId,
        creatorGoblinId,
        recipeKey: "starter-cache",
        seedSignature: identity.seedSignature
      },
      provenance: [
        {
          tick: 0,
          from: undefined,
          to: { ownerType: "goblin", ownerId: creatorGoblinId },
          reason: "crafted",
          eventId: undefined,
          chronicleEntryId: undefined
        }
      ],
      notableMoments: [],
      legendScore: 0
    };
    state.lore.artifacts.byId[id] = artifact;
    state.lore.artifacts.allIds.push(id);
    state.chronicle.push({
      id: nextId(state, "chron"),
      tick: 0,
      type: "ARTIFACT_CREATED",
      artifactId: id,
      goblinId: creatorGoblinId,
      text: `${artifact.displayName} entered the camp cache.`
    });
  }

  state.meta.rngState = rng.state;
  state.debug.selectedGoblinId = state.goblins.allIds[0] || null;
  state.debug.trackedGoblinId = state.debug.selectedGoblinId;
  state.debug.selectedArtifactId = state.lore.artifacts.allIds[0] || null;
  ensureWorldContracts(state);
  return state;
}

function hashText(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function sampleRange(rng, min, max) {
  return min + (max - min) * randFloat(rng);
}

function toFixedNum(n, digits = 3) {
  return Number(n.toFixed(digits));
}

function buildRandomizationProfile(runSeed) {
  const rng = initRng(`${runSeed}|randomization-profile`);
  const worldSeed = `${runSeed}|world`;
  const wildlifeSeed = `${runSeed}|wildlife`;
  const flavorSeed = `${runSeed}|flavor`;
  const variantId = hashText(`${runSeed}|variant`).slice(0, 8);

  return {
    runSeed,
    worldSeed,
    wildlifeSeed,
    flavorSeed,
    variantId,
    speciesKnobs: {
      fish: {
        schoolTightness: toFixedNum(sampleRange(rng, 0.75, 1.25)),
        driftAmp: toFixedNum(sampleRange(rng, 0.7, 1.3))
      },
      deer: {
        fleeBias: toFixedNum(sampleRange(rng, 0.8, 1.35)),
        grazeCadence: toFixedNum(sampleRange(rng, 0.85, 1.25))
      },
      wolf: {
        huntPersistence: toFixedNum(sampleRange(rng, 0.8, 1.4)),
        regroupBias: toFixedNum(sampleRange(rng, 0.7, 1.3))
      },
      barbarian: {
        raidBoldness: toFixedNum(sampleRange(rng, 0.75, 1.4)),
        retreatBias: toFixedNum(sampleRange(rng, 0.75, 1.35))
      }
    }
  };
}
