import {
  goblinNeedDecaySystem,
  goblinMoodTransitionSystem,
  goblinMemorySystem,
  resourceTelemetrySystem,
  resourcePurposeSystem,
  runRelationshipDrift
} from "./systems.js";
import { runLoreSystems } from "./lore/loreSystems.js";
import { nextId } from "./ids.js";
import { worldMapSimulationSystem } from "./world/mapSimulation.js";
import { wildlifeSimulationSystem } from "./world/wildlifeSimulation.js";
import { climateSimulationSystem } from "./world/climateSimulation.js";
import { ensureWorldContracts } from "./world/contracts.js";
import { validateState } from "./validation.js";
import { leaderGovernanceSystem } from "./governance/leaderGovernance.js";
import { factionIntentSystem } from "./factions/factionAI.js";
import { eventTriggerSystem } from "./events/triggerEngine.js";
import { eventLifecycleSystem } from "./events/eventLifecycle.js";

const PIPELINE = [
  ["climateSimulationSystem", climateSimulationSystem],
  ["wildlifeSimulationSystem", wildlifeSimulationSystem],
  ["worldMapSimulationSystem", worldMapSimulationSystem],
  ["resourcePurposeSystem", resourcePurposeSystem],
  ["resourceTelemetrySystem", resourceTelemetrySystem],
  ["goblinNeedDecaySystem", goblinNeedDecaySystem],
  ["goblinMoodTransitionSystem", goblinMoodTransitionSystem],
  ["goblinMemorySystem", goblinMemorySystem],
  ["relationshipDriftSystem", runRelationshipDrift],
  ["leaderGovernanceSystem", leaderGovernanceSystem],
  ["factionIntentSystem", factionIntentSystem],
  ["eventTriggerSystem", eventTriggerSystem],
  ["eventLifecycleSystem", eventLifecycleSystem]
];

export function tick(state) {
  state.meta.tick += 1;
  state.meta.simTimeMs += 1000;
  ensureWorldContracts(state);

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
  if (event.type === "LEADER_CONFIDENCE_CHANGED") {
    const leader = event.leaderGoblinId ? state.goblins.byId?.[event.leaderGoblinId] : null;
    const name = leader?.identity?.name || event.leaderGoblinId || "Leader";
    text = `${name} confidence ${Number(event.before || 0).toFixed(2)} -> ${Number(event.after || 0).toFixed(2)} (${event.trend || "stable"}).`;
  }
  if (event.type === "LEADER_LEARNING_EPISODE_RECORDED") {
    const leader = event.leaderGoblinId ? state.goblins.byId?.[event.leaderGoblinId] : null;
    const name = leader?.identity?.name || event.leaderGoblinId || "Leader";
    text = `${name} prioritized ${event.topDomain || "food"} (${Number(event.topWeight || 0).toFixed(1)}).`;
  }

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
