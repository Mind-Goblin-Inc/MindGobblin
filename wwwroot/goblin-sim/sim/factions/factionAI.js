import { ensureFactionState, updateFactionPostures } from "./factionState.js";

function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function intentFromNeeds(faction) {
  const n = faction.needs || {};
  const vengeance = Number(n.vengeancePressure || 0);
  const wealth = Number(n.wealthPressure || 0);
  const safety = Number(n.safetyPressure || 0);
  const prestige = Number(n.prestigePressure || 0);
  if (vengeance >= 65) return "retaliate";
  if (wealth >= 58) return "enrich";
  if (prestige >= 60) return "expand";
  if (safety >= 55) return "stabilize";
  return "survive";
}

export function factionIntentSystem(state) {
  const events = [];
  const tick = state.meta?.tick || 0;
  const byId = ensureFactionState(state);
  updateFactionPostures(state);

  for (const faction of Object.values(byId)) {
    faction.runtime = faction.runtime || {};
    const lastTick = Number(faction.runtime.lastIntentTick || -1000);
    if (tick - lastTick < 24) continue;
    faction.runtime.lastIntentTick = tick;

    const previous = String(faction.intent?.strategicGoal || "stabilize");
    const next = intentFromNeeds(faction);
    faction.intent = faction.intent || {};
    faction.intent.strategicGoal = next;
    faction.intent.priorityScore = Number(clamp((faction.intent.priorityScore || 0.4) * 0.9 + 0.1, 0.1, 1).toFixed(3));
    faction.intent.planExpiresTick = tick + 24;

    if (previous !== next) {
      events.push({
        type: "FACTION_INTENT_UPDATED",
        factionId: faction.id,
        before: previous,
        after: next,
        text: `${faction.identity?.name || faction.id} shifted intent ${previous} -> ${next}.`
      });
    }
  }

  return events;
}
