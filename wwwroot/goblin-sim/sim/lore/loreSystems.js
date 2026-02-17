import { nextId } from "../ids.js";
import { currentOwner, appendProvenance } from "./provenance.js";
import { indexChronicleFromCursor } from "./chronicleIndex.js";
import { inferCausalityForNewEntries } from "./causalityGraph.js";
import { resolveHistoricalCallback } from "./callbackResolver.js";
import { updateLegendScore } from "./legendScoring.js";

export function runLoreSystems(state, tickEvents, writeChronicleEntry) {
  const systemEvents = [];

  systemEvents.push(...artifactLoreUpdateSystem(state, tickEvents));
  systemEvents.push(...provenanceRecordSystem(state, tickEvents));
  chronicleIndexSystem(state);
  causalityEdgeSystem(state);
  systemEvents.push(...historicalCallbackSystem(state));
  systemEvents.push(...legendPromotionSystem(state, tickEvents));

  for (const event of systemEvents) {
    writeChronicleEntry(state, event);
  }
  return systemEvents;
}

function artifactLoreUpdateSystem(state, tickEvents) {
  const out = [];
  const transferDrivers = tickEvents.filter((e) => e.type === "JOB_TOP_MATCH");
  if (!transferDrivers.length || !state.lore.artifacts.allIds.length) return out;

  for (const driver of transferDrivers.slice(0, 2)) {
    const artifactId = state.lore.artifacts.allIds[(state.meta.tick + driver.goblinId.length) % state.lore.artifacts.allIds.length];
    const artifact = state.lore.artifacts.byId[artifactId];
    const owner = currentOwner(artifact);
    if (owner && owner.ownerType === "goblin" && owner.ownerId === driver.goblinId) continue;

    out.push({
      type: "ARTIFACT_TRANSFERRED",
      artifactId,
      goblinId: driver.goblinId,
      reason: "assigned",
      text: `${artifact.displayName} was passed to ${state.goblins.byId[driver.goblinId]?.identity?.name || driver.goblinId}.`
    });
  }

  return out;
}

function provenanceRecordSystem(state, tickEvents) {
  const out = [];

  for (const event of tickEvents) {
    if (event.type !== "ARTIFACT_TRANSFERRED") continue;
    const artifact = state.lore.artifacts.byId[event.artifactId];
    if (!artifact) continue;

    const before = currentOwner(artifact);
    const transfer = {
      tick: state.meta.tick,
      from: before || undefined,
      to: { ownerType: "goblin", ownerId: event.goblinId },
      reason: "gifted",
      eventId: event.eventId || undefined,
      chronicleEntryId: null
    };

    appendProvenance(artifact, transfer);
    out.push({
      type: "PROVENANCE_RECORDED",
      artifactId: artifact.id,
      goblinId: event.goblinId,
      text: `${artifact.displayName} provenance updated (${before?.ownerId || "none"} -> ${event.goblinId}).`
    });
  }

  return out;
}

function chronicleIndexSystem(state) {
  indexChronicleFromCursor(state);
}

function causalityEdgeSystem(state) {
  const start = state.lore.causality.cursor;
  inferCausalityForNewEntries(state, start);
  state.lore.causality.cursor = state.chronicle.length;
}

function historicalCallbackSystem(state) {
  const selected = state.debug.selectedGoblinId;
  if (!selected) return [];
  if (state.meta.tick === 0 || state.meta.tick % 6 !== 0) return [];

  const callback = resolveHistoricalCallback(state, {
    topic: "wellbeing",
    goblinId: selected
  });

  if (!callback) return [];
  return [
    {
      type: "HISTORICAL_CALLBACK",
      goblinId: selected,
      callbackEntryId: callback.entryId,
      text: callback.callbackText
    }
  ];
}

function legendPromotionSystem(state, tickEvents) {
  const out = [];
  const artifacts = state.lore.artifacts.allIds.map((id) => state.lore.artifacts.byId[id]);

  for (const artifact of artifacts) {
    for (const event of tickEvents) {
      const result = updateLegendScore(artifact, event);
      if (result.promoted) {
        const tierLabel = result.tier === 3 ? "legendary" : result.tier === 2 ? "renowned" : "notable";
        out.push({
          type: "LORE_PROMOTION",
          artifactId: artifact.id,
          text: `${artifact.displayName} is now ${tierLabel}.`
        });
      }
    }
  }

  return out;
}
