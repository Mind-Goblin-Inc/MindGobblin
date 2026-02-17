import { PERSONALITY_FACETS } from "./constants.js";
import { randChoice, randInt } from "./rng.js";

const FIRST = ["Snik", "Brakka", "Mug", "Riz", "Tukka", "Grem", "Nob", "Skiv", "Yarp", "Dreg"];
const LAST = ["Fungus", "Ashbelly", "Shivfinger", "Bogstep", "Rattletooth", "Coalnose", "Mosscloak"];
const QUIRKS = ["coin-clicker", "fungus-sniffer", "moon-hummer", "toe-counter", "embersleeper"];
const VIRTUES = ["loyal", "patient", "clever", "stubborn", "forgiving"];
const FLAWS = ["jealous", "reckless", "gullible", "spiteful", "cowardly"];
const FEARS = ["fire", "spiders", "deep water", "thunder", "open sky"];
const IDEALS = ["wealth", "glory", "clan honor", "freedom", "mastery"];

const APTITUDE_KEYS = [
  "scavenging", "mining", "smithing", "tinkering", "alchemy",
  "stealth", "scouting", "medicine", "cooking", "animalHandling",
  "ritualism", "bargaining", "intimidation", "lorekeeping", "siegecraft"
];

const CORE_STAT_KEYS = [
  "brawn", "agility", "cunning", "craft", "grit", "will", "luck", "social", "perception"
];

function rollNeeds(rng) {
  return {
    hunger: randInt(rng, 20, 45),
    thirst: randInt(rng, 20, 45),
    rest: randInt(rng, 15, 35),
    warmth: randInt(rng, 10, 30),
    safety: randInt(rng, 25, 45),
    belonging: randInt(rng, 25, 50),
    autonomy: randInt(rng, 25, 50),
    esteem: randInt(rng, 20, 45),
    greed: randInt(rng, 20, 55),
    novelty: randInt(rng, 20, 55)
  };
}

function rollCoreStats(rng) {
  const stats = {};
  for (const key of CORE_STAT_KEYS) stats[key] = randInt(rng, 25, 75);
  return stats;
}

function rollAptitudes(rng) {
  const aptitudes = {};
  for (const key of APTITUDE_KEYS) aptitudes[key] = randInt(rng, 5, 45);
  for (let i = 0; i < randInt(rng, 2, 4); i += 1) {
    const standout = randChoice(rng, APTITUDE_KEYS);
    aptitudes[standout] = Math.min(100, aptitudes[standout] + randInt(rng, 20, 40));
  }
  return aptitudes;
}

function starterMemory(id, tick, type, intensity, valence, description) {
  return {
    id,
    type,
    subjectId: null,
    intensity,
    valence,
    description,
    timestampTick: tick,
    decayHalfLife: valence === "negative" ? 300 : 200
  };
}

/** @returns {import('./types.js').Goblin} */
export function createGoblin({ id, rng, tick, originSiteId }) {
  const name = `${randChoice(rng, FIRST)} ${randChoice(rng, LAST)}`;
  const personality = {};
  for (const facet of PERSONALITY_FACETS) personality[facet] = randInt(rng, 5, 95);

  const memories = [
    starterMemory(`${id}-mem0`, tick, "migration", randInt(rng, 25, 55), "neutral", "Arrived near the cave frontier"),
    starterMemory(`${id}-mem1`, tick, "scarcity", randInt(rng, 20, 60), "negative", "Remembered a lean winter"),
    starterMemory(`${id}-mem2`, tick, "trade", randInt(rng, 20, 50), "positive", "Struck a lucky mushroom barter")
  ];

  return {
    id,
    identity: {
      name,
      nickname: undefined,
      pronouns: "they/them",
      ageStage: randChoice(rng, ["whelp", "adult", "elder"]),
      originSiteId: originSiteId || null,
      lineage: { clan: randChoice(rng, ["Ashcap", "Tunnelmaw", "Mudfang"]) },
      tags: [randChoice(rng, ["caveborn", "left-handed", "superstitious", "night-eyes"])]
    },
    coreStats: rollCoreStats(rng),
    aptitudes: rollAptitudes(rng),
    skills: {},
    traits: {
      personality,
      quirks: [randChoice(rng, QUIRKS)],
      virtues: [randChoice(rng, VIRTUES), randChoice(rng, VIRTUES)],
      flaws: [randChoice(rng, FLAWS)],
      fears: [randChoice(rng, FEARS)],
      ideals: [randChoice(rng, IDEALS)]
    },
    body: {
      sizeClass: randChoice(rng, ["small", "medium"]),
      health: {
        vitality: randInt(rng, 65, 95),
        pain: randInt(rng, 0, 12),
        bleeding: 0,
        infection: 0,
        disease: []
      },
      injuries: [],
      conditions: []
    },
    needs: rollNeeds(rng),
    psyche: {
      stress: randInt(rng, 10, 35),
      morale: randInt(rng, 50, 80),
      volatility: randInt(rng, 20, 70),
      resilience: randInt(rng, 25, 70),
      traumaLoad: randInt(rng, 0, 20),
      moodState: "stable"
    },
    social: {
      role: undefined,
      statusScore: randInt(rng, 15, 55),
      loyalty: randInt(rng, 45, 80),
      factionReputation: {},
      bonds: [],
      grudges: [],
      family: []
    },
    equipment: {
      toolSlots: { mainHand: null, offHand: null },
      armorSlots: { body: null, head: null },
      trinkets: []
    },
    assignment: {
      currentJobId: undefined,
      preferredJobs: [],
      bannedJobs: [],
      shift: randChoice(rng, ["day", "night", "any"]),
      locationId: originSiteId || null
    },
    progression: {
      level: 1,
      xp: 0,
      perks: [],
      milestones: []
    },
    memory: {
      recent: memories,
      notable: memories.filter((m) => m.intensity > 45),
      triggers: { "saw-corpse": 0.15, "heard-song": 0.2 }
    },
    flags: {
      alive: true,
      missing: false,
      imprisoned: false,
      exiled: false
    },
    modData: {
      threatResponse: {
        mode: "none",
        activeThreatId: null,
        lastThreatTick: null
      }
    }
  };
}
