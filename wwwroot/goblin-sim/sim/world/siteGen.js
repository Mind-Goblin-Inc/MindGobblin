import { initRng, randChoice, randFloat, randInt } from "../rng.js";
import { randomSiteType } from "./regionGen.js";

const SITE_NAMES = ["Ashfen", "Cragmere", "Dusk Hollow", "Shivford", "Mossgate", "Rattle Basin", "Thornrest", "Cinderreach"];

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function ownerForType(type) {
  if (type === "goblin-camp" || type === "den") return "faction-ashcap";
  if (type === "fortress" || type === "trade-outpost") return "faction-ivory";
  return "faction-redtooth";
}

export function generateSites({ seed, regionGrid, regionsById, size }) {
  const rng = initRng(`${seed}|sites|${size}`);
  const width = regionGrid[0]?.length || 0;
  const height = regionGrid.length;

  const targetCount = size === "small" ? 14 : size === "large" ? 28 : 20;
  const minDistance = size === "small" ? 4 : size === "large" ? 5 : 4;

  const sitesById = {};
  const siteIds = [];
  let attempts = 0;

  while (siteIds.length < targetCount && attempts < targetCount * 50) {
    attempts += 1;
    const x = randInt(rng, 1, Math.max(1, width - 2));
    const y = randInt(rng, 1, Math.max(1, height - 2));
    const regionId = regionGrid[y][x];
    const region = regionsById[regionId];
    if (!region) continue;

    let tooClose = false;
    for (const id of siteIds) {
      const s = sitesById[id];
      if (distance({ x, y }, s) < minDistance) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const type = randomSiteType(rng, region.biome);
    const id = `site-${siteIds.length + 1}`;
    const name = `${randChoice(rng, SITE_NAMES)} ${siteIds.length + 1}`;
    const ownerFactionId = ownerForType(type);

    sitesById[id] = {
      id,
      name,
      type,
      regionId,
      x,
      y,
      ownerFactionId,
      controlStrength: Math.round((0.35 + randFloat(rng) * 0.6) * 100) / 100,
      hostilityBaseline: Math.round((0.2 + randFloat(rng) * 0.7) * 100) / 100,
      strategic: {
        resourceNearby: Math.round((region.resourcePotential.food + region.resourcePotential.ore + region.resourcePotential.salvage) * 33),
        hazardNearby: Math.round(region.hazardPressure * 100),
        centralityHint: 0
      }
    };
    siteIds.push(id);
  }

  return { sitesById, siteIds };
}
