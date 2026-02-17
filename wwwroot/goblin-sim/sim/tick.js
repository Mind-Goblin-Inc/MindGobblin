import {
  goblinNeedDecaySystem,
  goblinMoodTransitionSystem,
  goblinMemorySystem,
  resourcePurposeSystem,
  runRelationshipDrift
} from "./systems.js";
import { runLoreSystems } from "./lore/loreSystems.js";
import { nextId } from "./ids.js";
import { worldMapSimulationSystem } from "./world/mapSimulation.js";
import { wildlifeSimulationSystem } from "./world/wildlifeSimulation.js";
import { validateState } from "./validation.js";

const PIPELINE = [
  ["wildlifeSimulationSystem", wildlifeSimulationSystem],
  ["worldMapSimulationSystem", worldMapSimulationSystem],
  ["resourcePurposeSystem", resourcePurposeSystem],
  ["goblinNeedDecaySystem", goblinNeedDecaySystem],
  ["goblinMoodTransitionSystem", goblinMoodTransitionSystem],
  ["goblinMemorySystem", goblinMemorySystem],
  ["relationshipDriftSystem", runRelationshipDrift]
];

export function tick(state) {
  state.meta.tick += 1;
  state.meta.simTimeMs += 1000;

  const allEvents = [];
  state.debug.lastSystemOrder = [];

  for (const [name, system] of PIPELINE) {
    state.debug.lastSystemOrder.push(name);
    const events = system(state) || [];
    for (const ev of events) {
      allEvents.push(ev);
      writeChronicle(state, ev);
    }
  }

  const loreEvents = runLoreSystems(state, allEvents, writeChronicle);
  for (const event of loreEvents) allEvents.push(event);

  validateState(state);
  return allEvents;
}

function writeChronicle(state, event) {
  const t = state.meta.tick;
  let text = `${event.type}`;

  if (event.type === "MOOD_CHANGED") {
    const goblin = state.goblins.byId[event.goblinId];
    text = `${goblin?.identity?.name || event.goblinId} mood shifted ${event.before} -> ${event.after}`;
  }
  if (event.type === "NEED_SPIKE") {
    const goblin = state.goblins.byId[event.goblinId];
    text = `${goblin?.identity?.name || event.goblinId} ${event.key} is rising (${Math.round(event.after)}).`;
  }
  if (event.type === "RELATIONSHIP_SHIFT") {
    text = `Relationship ${event.pair} drifted (${event.affinityBefore.toFixed(1)} -> ${event.affinityAfter.toFixed(1)}).`;
  }
  if (event.type === "GOBLIN_WANDERED") text = event.text || text;
  if (event.type === "GOBLIN_SOCIAL_MOMENT") text = event.text || text;
  if (event.type === "DEER_FLED") text = event.text || text;
  if (event.type === "DEER_GRAZED") text = event.text || text;
  if (event.type === "DEER_DRANK") text = event.text || text;
  if (event.type === "WOLF_HUNT_STARTED") text = event.text || text;
  if (event.type === "WOLF_KILLED_DEER") text = event.text || text;
  if (event.type === "WOLF_THREAT_NEAR_HOME") text = event.text || text;
  if (event.type === "BARBARIAN_RAID_TARGETED") text = event.text || text;
  if (event.type === "BARBARIAN_DAMAGED_WALL") text = event.text || text;
  if (event.type === "BARBARIAN_STOLE_RESOURCE") text = event.text || text;
  if (event.type === "BARBARIAN_RAID_NEAR_HOME") text = event.text || text;
  if (event.type === "WILDLIFE_ATTACKED_GOBLIN") text = event.text || text;
  if (event.type === "GOBLIN_INJURED_BY_WILDLIFE") text = event.text || text;
  if (event.type === "GOBLIN_KILLED_BY_WILDLIFE") text = event.text || text;

  state.chronicle.push({
    id: nextId(state, "chron"),
    tick: t,
    type: event.type,
    goblinId: event.goblinId || undefined,
    factionId: event.factionId || undefined,
    artifactId: event.artifactId || undefined,
    text: event.text || text,
    details: event
  });
  if (state.chronicle.length > 250) state.chronicle.shift();
}
