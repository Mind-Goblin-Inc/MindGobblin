import { canonicalEdgeKey } from "./ids.js";

function clamp(v) {
  if (v < -100) return -100;
  if (v > 100) return 100;
  return v;
}

export function getOrCreateEdge(state, a, b) {
  const key = canonicalEdgeKey(a, b);
  if (!state.goblins.relationships[key]) {
    state.goblins.relationships[key] = {
      key,
      a: key.split("|")[0],
      b: key.split("|")[1],
      affinity: 0,
      trust: 0,
      fear: 0,
      resentment: 0,
      debt: 0,
      historyWeight: 0
    };
  }
  return state.goblins.relationships[key];
}

export function relationshipDriftSystem(state) {
  const ids = state.goblins.allIds;
  const events = [];

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = state.goblins.byId[ids[i]];
      const b = state.goblins.byId[ids[j]];
      if (!a || !b || !a.flags.alive || !b.flags.alive) continue;

      const edge = getOrCreateEdge(state, a.id, b.id);
      const moodPenalty = a.psyche.moodState === "breaking" || b.psyche.moodState === "breaking" ? 0.45 : 0.1;
      const moraleDelta = ((a.psyche.morale + b.psyche.morale) / 2 - 50) * 0.01;

      const beforeAffinity = edge.affinity;
      edge.affinity = clamp(edge.affinity + moraleDelta - moodPenalty);
      edge.trust = clamp(edge.trust + moraleDelta * 0.7);
      edge.resentment = clamp(edge.resentment + moodPenalty * 0.2);
      edge.historyWeight = clamp(edge.historyWeight + 0.1);

      if (Math.abs(edge.affinity - beforeAffinity) >= 0.9) {
        events.push({
          type: "RELATIONSHIP_SHIFT",
          pair: edge.key,
          affinityBefore: beforeAffinity,
          affinityAfter: edge.affinity
        });
      }
    }
  }
  return events;
}
