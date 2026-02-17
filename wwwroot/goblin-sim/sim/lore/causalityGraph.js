import { nextId } from "../ids.js";

function addEdge(state, causeEntryId, effectEntryId, linkType, explanation, weight = 1) {
  if (!causeEntryId || !effectEntryId || causeEntryId === effectEntryId) return;

  const edgeId = nextId(state, "edge");
  const edge = { id: edgeId, causeEntryId, effectEntryId, linkType, weight, explanation };
  state.lore.causality.edgesById[edgeId] = edge;

  if (!state.lore.causality.byCauseEntryId[causeEntryId]) state.lore.causality.byCauseEntryId[causeEntryId] = [];
  if (!state.lore.causality.byEffectEntryId[effectEntryId]) state.lore.causality.byEffectEntryId[effectEntryId] = [];
  state.lore.causality.byCauseEntryId[causeEntryId].push(edgeId);
  state.lore.causality.byEffectEntryId[effectEntryId].push(edgeId);
}

export function inferCausalityForNewEntries(state, startIndex) {
  const recentByGoblin = new Map();
  const chron = state.chronicle;

  for (let i = 0; i < chron.length; i += 1) {
    const entry = chron[i];
    if (entry.goblinId) {
      if (!recentByGoblin.has(entry.goblinId)) recentByGoblin.set(entry.goblinId, []);
      recentByGoblin.get(entry.goblinId).push(entry);
    }
  }

  for (let i = startIndex; i < chron.length; i += 1) {
    const entry = chron[i];
    if (!entry.goblinId) continue;
    const list = recentByGoblin.get(entry.goblinId) || [];
    const prior = list.filter((x) => x.tick <= entry.tick && x.id !== entry.id).slice(-5);

    if (entry.type === "MOOD_CHANGED") {
      const cause = findLastMatch(prior, (x) => x.type === "NEED_SPIKE" || x.type === "MEMORY_TRIGGERED");
      if (cause) addEdge(state, cause.id, entry.id, "relationship-chain", "Need or memory pressure changed mood", 0.8);
    }

    if (entry.type === "JOB_TOP_MATCH") {
      const cause = findLastMatch(prior, (x) => x.type === "MOOD_CHANGED");
      if (cause) addEdge(state, cause.id, entry.id, "policy-side-effect", "Mood state influenced suitability score context", 0.5);
    }
  }
}

export function causalityTraceForEntry(state, entryId, depth = 1) {
  const visited = new Set();
  const out = [];

  function walk(currentId, remaining) {
    if (remaining < 0 || visited.has(currentId)) return;
    visited.add(currentId);
    const edgeIds = state.lore.causality.byEffectEntryId[currentId] || [];
    for (const edgeId of edgeIds) {
      const edge = state.lore.causality.edgesById[edgeId];
      if (!edge) continue;
      out.push(edge);
      walk(edge.causeEntryId, remaining - 1);
    }
  }

  walk(entryId, depth);
  return out;
}

function findLastMatch(list, predicate) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (predicate(list[i])) return list[i];
  }
  return null;
}
