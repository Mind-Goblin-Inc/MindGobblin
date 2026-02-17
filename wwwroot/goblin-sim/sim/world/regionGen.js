import { initRng, randChoice, randFloat } from "../rng.js";

const BIOME_RULES = [
  { key: "swamp", moistureMin: 0.68, tempMin: 0.35 },
  { key: "forest", moistureMin: 0.48, tempMin: 0.3 },
  { key: "badlands", moistureMax: 0.28, tempMin: 0.55 },
  { key: "hills", elevationMin: 0.56 },
  { key: "ruins", ruinChanceMin: 0.66 },
  { key: "caves", caveChanceMin: 0.62 }
];

function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function smoothNoise(x, y, sx, sy, phase) {
  return (
    Math.sin((x + phase) * sx) * 0.45 +
    Math.cos((y - phase) * sy) * 0.35 +
    Math.sin((x + y * 0.3 + phase) * sx * 0.7) * 0.2
  );
}

function pickBiome(fields) {
  for (const rule of BIOME_RULES) {
    if (rule.moistureMin !== undefined && fields.moisture < rule.moistureMin) continue;
    if (rule.moistureMax !== undefined && fields.moisture > rule.moistureMax) continue;
    if (rule.tempMin !== undefined && fields.temperature < rule.tempMin) continue;
    if (rule.elevationMin !== undefined && fields.elevation < rule.elevationMin) continue;
    if (rule.ruinChanceMin !== undefined && fields.ruinChance < rule.ruinChanceMin) continue;
    if (rule.caveChanceMin !== undefined && fields.caveChance < rule.caveChanceMin) continue;
    return rule.key;
  }
  return "forest";
}

export function generateRegions({ seed, width, height, size }) {
  const rng = initRng(`${seed}|regions|${size}`);
  const regionsById = {};
  const regionGrid = [];

  const phaseA = randFloat(rng) * 20;
  const phaseB = randFloat(rng) * 30;
  const phaseC = randFloat(rng) * 40;

  const sx = 0.11 + randFloat(rng) * 0.07;
  const sy = 0.12 + randFloat(rng) * 0.06;

  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const elevation = clamp01((smoothNoise(x, y, sx, sy, phaseA) + 1) / 2);
      const moisture = clamp01((smoothNoise(x, y, sx * 0.8, sy * 0.9, phaseB) + 1) / 2);
      const temperature = clamp01((smoothNoise(x, y, sx * 1.2, sy * 0.7, phaseC) + 1) / 2);
      const ruinChance = clamp01((smoothNoise(x, y, sx * 1.7, sy * 1.5, phaseB * 0.4) + 1) / 2);
      const caveChance = clamp01((smoothNoise(x, y, sx * 1.5, sy * 1.1, phaseA * 0.6) + 1) / 2);

      const biome = pickBiome({ elevation, moisture, temperature, ruinChance, caveChance });
      const id = `region-${x}-${y}`;

      const foodPotential = clamp01(moisture * 0.6 + (1 - elevation) * 0.3 + (biome === "forest" ? 0.15 : 0));
      const orePotential = clamp01(elevation * 0.55 + (biome === "hills" || biome === "caves" ? 0.2 : 0));
      const salvagePotential = clamp01(ruinChance * 0.7 + (biome === "ruins" ? 0.25 : 0));
      const relicChance = clamp01((ruinChance + caveChance) * 0.45);
      const hazardPressure = clamp01((1 - foodPotential) * 0.25 + caveChance * 0.35 + (biome === "badlands" ? 0.2 : 0));
      const travelDifficulty = clamp01(elevation * 0.35 + (biome === "swamp" ? 0.22 : 0) + (biome === "badlands" ? 0.18 : 0));

      const factionInfluence = {
        "faction-ashcap": clamp01(randFloat(rng) * 0.4 + (biome === "caves" ? 0.4 : 0.1)),
        "faction-ivory": clamp01(randFloat(rng) * 0.35 + (biome === "forest" ? 0.35 : 0.08)),
        "faction-redtooth": clamp01(randFloat(rng) * 0.35 + (biome === "badlands" ? 0.4 : 0.05))
      };

      regionsById[id] = {
        id,
        x,
        y,
        biome,
        elevation,
        moisture,
        temperature,
        resourcePotential: {
          food: foodPotential,
          ore: orePotential,
          salvage: salvagePotential,
          relic: relicChance
        },
        hazardPressure,
        travelDifficulty,
        factionInfluence
      };

      row.push(id);
    }
    regionGrid.push(row);
  }

  return { regionGrid, regionsById };
}

export function biomeColor(biome) {
  const table = {
    forest: "#2d5a34",
    swamp: "#35534a",
    hills: "#635d44",
    caves: "#3f4654",
    ruins: "#6a5747",
    badlands: "#78513d"
  };
  return table[biome] || "#444";
}

export function factionIds() {
  return ["faction-ashcap", "faction-ivory", "faction-redtooth"];
}

export function factionName(id) {
  const names = {
    "faction-ashcap": "Ashcap Clan",
    "faction-ivory": "Ivory March",
    "faction-redtooth": "Redtooth Host"
  };
  return names[id] || id;
}

export function randomSiteType(rng, biome) {
  const byBiome = {
    caves: ["goblin-camp", "den", "shrine"],
    ruins: ["ruin", "fortress", "trade-outpost"],
    forest: ["trade-outpost", "shrine", "den"],
    badlands: ["fortress", "den"],
    swamp: ["den", "shrine"],
    hills: ["fortress", "goblin-camp"]
  };
  return randChoice(rng, byBiome[biome] || ["goblin-camp"]);
}
