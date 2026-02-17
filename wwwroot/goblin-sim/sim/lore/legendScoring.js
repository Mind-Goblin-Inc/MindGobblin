import { maybePromoteEpithet } from "./artifactIdentity.js";

function tier(score) {
  if (score >= 80) return 3;
  if (score >= 45) return 2;
  if (score >= 20) return 1;
  return 0;
}

export function updateLegendScore(artifact, event) {
  let delta = 0;
  if (event.type === "ARTIFACT_TRANSFERRED") delta += 3;
  if (event.type === "JOB_TOP_MATCH") delta += 1;
  if (event.type === "MOOD_CHANGED") delta += 0.5;
  if (event.type === "RELATIONSHIP_SHIFT") delta += 0.5;

  const beforeTier = tier(artifact.legendScore);
  artifact.legendScore += delta;
  const afterTier = tier(artifact.legendScore);

  maybePromoteEpithet(artifact, afterTier);

  return {
    delta,
    promoted: afterTier > beforeTier,
    tier: afterTier
  };
}
