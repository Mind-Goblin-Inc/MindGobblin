import { clamp01to100 } from "./needsModel.js";

const ENTRY = {
  stable: { up: 0, down: 45 },
  frayed: { up: 60, down: 35 },
  agitated: { up: 72, down: 25 },
  volatile: { up: 84, down: 12 },
  breaking: { up: 999, down: 6 }
};

function targetMood(load) {
  if (load >= 84) return "breaking";
  if (load >= 72) return "volatile";
  if (load >= 60) return "agitated";
  if (load >= 45) return "frayed";
  return "stable";
}

export function updateMood(goblin) {
  const highNeeds = (goblin.needs.hunger + goblin.needs.thirst + goblin.needs.rest) / 3;
  const load = clamp01to100(
    0.6 * goblin.psyche.stress +
      0.28 * highNeeds +
      0.18 * goblin.psyche.traumaLoad -
      0.22 * goblin.psyche.resilience -
      0.15 * goblin.psyche.morale
  );

  const before = goblin.psyche.moodState;
  const desired = targetMood(load);

  const gate = ENTRY[before];
  const crossesDown = load <= gate.down;
  const crossesUp = load >= gate.up;

  if ((crossesUp || crossesDown) && desired !== before) {
    goblin.psyche.moodState = desired;
    return {
      type: "MOOD_CHANGED",
      goblinId: goblin.id,
      before,
      after: desired,
      load
    };
  }

  return null;
}
