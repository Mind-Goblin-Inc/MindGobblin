export function resolveHistoricalCallback(state, context) {
  const key = `${context.topic}|${context.goblinId || "none"}`;
  const nextAllowed = state.lore.callbacks.cooldownByKey[key] || 0;
  if (state.meta.tick < nextAllowed) return null;

  const pool = state.chronicle
    .filter((c) => c.goblinId && c.goblinId === context.goblinId)
    .filter((c) => c.type === "MOOD_CHANGED" || c.type === "NEED_SPIKE" || c.type === "MEMORY_TRIGGERED")
    .slice(-20);

  const candidate = pool[pool.length - 1];
  if (!candidate) return null;

  state.lore.callbacks.cooldownByKey[key] = state.meta.tick + 12;
  state.lore.callbacks.lastResolvedAtTick = state.meta.tick;

  return {
    entryId: candidate.id,
    callbackText: `Echo: ${candidate.text}`,
    confidence: 0.7,
    linkedEntities: { goblinId: candidate.goblinId }
  };
}
