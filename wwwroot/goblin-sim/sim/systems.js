import { applyMemoryTriggers, decayMemories } from "./memoryModel.js";
import { updateMood } from "./moraleModel.js";
import { applyNeedDecay, clamp01to100 } from "./needsModel.js";
import { relationshipDriftSystem } from "./relationships.js";

function randomStimuliForTick(state) {
  const stimuli = [];
  if (state.meta.tick % 9 === 0) {
    stimuli.push({ type: "heard-song", valence: "positive", description: "Heard a warm fire-song." });
  }
  if (state.meta.tick % 13 === 0) {
    stimuli.push({ type: "saw-corpse", valence: "negative", description: "Saw signs of raider violence." });
  }
  return stimuli;
}

export function goblinNeedDecaySystem(state) {
  const events = [];
  for (const id of state.goblins.allIds) {
    const g = state.goblins.byId[id];
    if (!g.flags.alive || g.flags.missing) continue;
    events.push(...applyNeedDecay(g, {}));
  }
  return events;
}

export function goblinMoodTransitionSystem(state) {
  const events = [];
  for (const id of state.goblins.allIds) {
    const g = state.goblins.byId[id];
    if (!g.flags.alive || g.flags.missing) continue;

    const pressure = (g.needs.hunger + g.needs.thirst + g.needs.rest) / 3;
    g.psyche.stress = clamp01to100(g.psyche.stress + (pressure - 50) * 0.012);
    g.psyche.morale = clamp01to100(g.psyche.morale - (pressure - 40) * 0.01);

    const threatMode = g.modData?.threatResponse?.mode || "none";
    if (threatMode !== "none") {
      g.needs.safety = clamp01to100(g.needs.safety + 1.2);
      g.psyche.stress = clamp01to100(g.psyche.stress + 1.4);
      g.psyche.morale = clamp01to100(g.psyche.morale - 0.9);
    } else if (g.needs.safety > 0) {
      g.needs.safety = clamp01to100(g.needs.safety - 0.35);
    }

    const ev = updateMood(g);
    if (ev) events.push(ev);
  }
  return events;
}

export function goblinMemorySystem(state) {
  const tick = state.meta.tick;
  const events = [];
  const stimuli = randomStimuliForTick(state);

  for (const id of state.goblins.allIds) {
    const g = state.goblins.byId[id];
    if (!g.flags.alive || g.flags.missing) continue;
    events.push(...applyMemoryTriggers(g, stimuli, tick));
    events.push(...decayMemories(g, tick));
  }
  return events;
}

export function runRelationshipDrift(state) {
  return relationshipDriftSystem(state);
}

export function resourcePurposeSystem(state) {
  const events = [];
  const goblinCount = state.goblins.allIds.length;
  if (!goblinCount) return events;

  const resources = state.tribe.resources;

  // Emergency food conversion: mushrooms become food stock if pantry is low.
  if ((resources.food || 0) < goblinCount * 2 && (resources.mushrooms || 0) > 0 && state.meta.tick % 4 === 0) {
    const use = Math.min(resources.mushrooms, Math.max(1, Math.ceil(goblinCount / 5)));
    resources.mushrooms -= use;
    resources.food = (resources.food || 0) + use * 2;
    events.push({
      type: "MUSHROOM_STEW_COOKED",
      amount: use,
      text: `Camp cooks converted ${use} mushrooms into stew (+${use * 2} food).`
    });
  }

  if (state.meta.tick % 5 === 0) {
    const consumption = Math.max(1, Math.ceil(goblinCount / 4));

    const foodBefore = resources.food || 0;
    resources.food = Math.max(0, foodBefore - consumption);
    const waterBefore = resources.water || 0;
    resources.water = Math.max(0, waterBefore - consumption);

    const foodShort = foodBefore < consumption;
    const waterShort = waterBefore < consumption;

    for (const goblinId of state.goblins.allIds) {
      const goblin = state.goblins.byId[goblinId];
      if (!goblin || !goblin.flags.alive || goblin.flags.missing) continue;
      if (foodShort) goblin.needs.hunger = Math.min(100, goblin.needs.hunger + 6);
      else goblin.needs.hunger = Math.max(0, goblin.needs.hunger - 3);
      if (waterShort) goblin.needs.thirst = Math.min(100, goblin.needs.thirst + 8);
      else goblin.needs.thirst = Math.max(0, goblin.needs.thirst - 4);
    }

    if (foodShort) {
      events.push({
        type: "RESOURCE_SHORTAGE",
        resource: "food",
        text: "Food shortage: goblins are getting hungrier."
      });
    }
    if (waterShort) {
      events.push({
        type: "RESOURCE_SHORTAGE",
        resource: "water",
        text: "Water shortage: thirst pressure is rising."
      });
    }
  }

  if (state.meta.tick % 8 === 0) {
    if ((resources.wood || 0) > 0) {
      resources.wood -= 1;
      for (const goblinId of state.goblins.allIds) {
        const goblin = state.goblins.byId[goblinId];
        if (!goblin || !goblin.flags.alive || goblin.flags.missing) continue;
        goblin.needs.warmth = Math.max(0, goblin.needs.warmth - 5);
        goblin.psyche.stress = Math.max(0, goblin.psyche.stress - 1);
      }
      events.push({
        type: "CAMPFIRE_BURNED_WOOD",
        text: "The campfire burned 1 wood, improving warmth and calm."
      });
    } else {
      for (const goblinId of state.goblins.allIds) {
        const goblin = state.goblins.byId[goblinId];
        if (!goblin || !goblin.flags.alive || goblin.flags.missing) continue;
        goblin.needs.warmth = Math.min(100, goblin.needs.warmth + 4);
      }
      events.push({
        type: "NO_FIREWOOD",
        text: "No firewood: camp warmth is dropping."
      });
    }
  }

  return events;
}
