export function scoreJobSuitability(goblin, jobDef) {
  const components = {};

  let aptitudeFit = 0;
  for (const apt of jobDef.requiredAptitudes) aptitudeFit += goblin.aptitudes[apt] || 0;
  aptitudeFit = aptitudeFit / Math.max(1, jobDef.requiredAptitudes.length);
  components.aptitudeFit = round(aptitudeFit * 0.35);

  let weighted = 0;
  for (const [key, weight] of Object.entries(jobDef.suitabilityWeights || {})) {
    const base = goblin.aptitudes[key] ?? goblin.coreStats[key] ?? 0;
    weighted += base * weight;
  }
  components.personalityFit = round(weighted / 100);

  const currentNeedPenalty = round(-0.2 * (goblin.needs.hunger + goblin.needs.thirst + goblin.needs.rest) / 3);
  const injuryPenalty = round(-(goblin.body.health.pain + goblin.body.health.bleeding * 3));
  const relationshipContext = round((goblin.social.statusScore - 50) * 0.12);
  const travelCost = round(-2);

  components.currentNeedPenalty = currentNeedPenalty;
  components.injuryPenalty = injuryPenalty;
  components.relationshipContext = relationshipContext;
  components.travelCost = travelCost;

  const total = Object.values(components).reduce((a, b) => a + b, 0);
  return { total, components };
}

function round(v) {
  return Math.round(v * 10) / 10;
}
