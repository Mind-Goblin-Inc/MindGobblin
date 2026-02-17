import { factionIds } from "./regionGen.js";

function round2(v) {
  return Math.round(v * 100) / 100;
}

export function buildOverlays(regionsById) {
  const fertilityByRegion = {};
  const hazardByRegion = {};
  const resourceByRegion = {};
  const influenceByFactionByRegion = {};

  for (const [id, region] of Object.entries(regionsById)) {
    fertilityByRegion[id] = round2(region.resourcePotential.food);
    hazardByRegion[id] = round2(region.hazardPressure);
    resourceByRegion[id] = round2((region.resourcePotential.ore + region.resourcePotential.salvage + region.resourcePotential.food) / 3);

    const influence = {};
    for (const factionId of factionIds()) {
      influence[factionId] = round2(region.factionInfluence[factionId] || 0);
    }
    influenceByFactionByRegion[id] = influence;
  }

  return {
    fertilityByRegion,
    hazardByRegion,
    resourceByRegion,
    influenceByFactionByRegion
  };
}
