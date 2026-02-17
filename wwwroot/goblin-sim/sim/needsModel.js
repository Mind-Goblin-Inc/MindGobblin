import { NEED_DECAY_RATES, NEED_KEYS } from "./constants.js";

export function clamp01to100(value) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function applyNeedDecay(goblin, modifiers) {
  const events = [];
  for (const key of NEED_KEYS) {
    const before = goblin.needs[key];
    const delta = NEED_DECAY_RATES[key] * (modifiers[key] ?? 1);
    const after = clamp01to100(before + delta);
    goblin.needs[key] = after;
    if (before < 75 && after >= 75) {
      events.push({
        type: "NEED_SPIKE",
        goblinId: goblin.id,
        key,
        before,
        after,
        severity: after >= 90 ? "high" : "medium"
      });
    }
  }
  return events;
}
