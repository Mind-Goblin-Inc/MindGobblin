import { MEMORY_HALF_LIFE } from "./constants.js";
import { clamp01to100 } from "./needsModel.js";

function decayFactor(ticksElapsed, halfLife) {
  return Math.pow(0.5, ticksElapsed / Math.max(1, halfLife));
}

export function decayMemories(goblin, tick) {
  const events = [];
  const kept = [];
  for (const memory of goblin.memory.recent) {
    const elapsed = tick - memory.timestampTick;
    const halfLife = memory.decayHalfLife || MEMORY_HALF_LIFE[memory.valence] || 200;
    const intensity = memory.intensity * decayFactor(elapsed, halfLife);
    if (intensity >= 8) {
      kept.push({ ...memory, intensity });
    } else {
      events.push({ type: "MEMORY_FADED", goblinId: goblin.id, memoryType: memory.type });
    }
  }
  goblin.memory.recent = kept.slice(-16);
  goblin.memory.notable = kept.filter((m) => m.intensity >= 55).slice(-8);
  return events;
}

export function applyMemoryTriggers(goblin, stimuli, tick) {
  const events = [];
  for (const stimulus of stimuli) {
    const weight = goblin.memory.triggers[stimulus.type] || 0;
    if (weight <= 0) continue;

    const effect = stimulus.valence === "negative" ? weight * 14 : -weight * 10;
    const prev = goblin.psyche.stress;
    goblin.psyche.stress = clamp01to100(prev + effect);

    const entry = {
      id: `${goblin.id}-evt-${tick}-${stimulus.type}`,
      type: stimulus.type,
      subjectId: stimulus.subjectId || null,
      intensity: Math.abs(effect) * 2,
      valence: stimulus.valence,
      description: stimulus.description,
      timestampTick: tick,
      decayHalfLife: MEMORY_HALF_LIFE[stimulus.valence] || 220
    };
    goblin.memory.recent.push(entry);

    events.push({
      type: "MEMORY_TRIGGERED",
      goblinId: goblin.id,
      stimulus: stimulus.type,
      stressBefore: prev,
      stressAfter: goblin.psyche.stress
    });
  }
  return events;
}
