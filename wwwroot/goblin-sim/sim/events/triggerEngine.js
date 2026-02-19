import { nextId } from "../ids.js";
import { EVENT_DEFS } from "./eventDefs.js";
import { canTriggerEvent, markEventTriggered } from "./cooldowns.js";

function ensureEventsState(state) {
  state.events = state.events || {};
  state.events.pending = state.events.pending || [];
  state.events.active = state.events.active || [];
  state.events.resolved = state.events.resolved || [];
  return state.events;
}

function queuePendingEvent(state, pending) {
  const events = ensureEventsState(state);
  events.pending.push(pending);
}

function buildPressureNotice(state, tick, faction) {
  return {
    id: nextId(state, "evt"),
    key: "faction_pressure_notice",
    category: "diplomacy",
    createdTick: tick,
    expiresTick: tick + 20,
    status: "pending",
    factionId: faction.id,
    title: `${faction.identity?.name || faction.id} tests your borders`,
    summary: "Scouts report probing movement near defended edges.",
    data: { posture: faction.runtime?.postureToPlayer || "uneasy" }
  };
}

function buildTradeProbe(state, tick, faction) {
  return {
    id: nextId(state, "evt"),
    key: "faction_trade_probe",
    category: "trade",
    createdTick: tick,
    expiresTick: tick + 24,
    status: "pending",
    factionId: faction.id,
    title: `${faction.identity?.name || faction.id} sends a cautious envoy`,
    summary: "A small caravan approaches to test willingness to trade.",
    data: { posture: faction.runtime?.postureToPlayer || "uneasy" }
  };
}

export function eventTriggerSystem(state) {
  const out = [];
  const tick = state.meta?.tick || 0;
  if (tick % 6 !== 0) return out;
  const events = ensureEventsState(state);
  const factions = Object.values(state.world?.factionsById || {});
  if (!factions.length) return out;

  const threat = Number(state.tribe?.threat?.alertLevel || 0);
  const food = Number(state.tribe?.resources?.food || 0);
  const water = Number(state.tribe?.resources?.water || 0);

  for (const faction of factions) {
    if (!faction?.id) continue;
    const posture = String(faction.runtime?.postureToPlayer || "uneasy");
    const hasPressure = posture === "hostile" || posture === "blood-feud" || threat >= 52;
    const hasTradeWindow = posture === "neutral" || posture === "ally" || (food >= 30 && water >= 30);
    const hasPendingForFaction = events.pending.some((e) => e.factionId === faction.id) || events.active.some((e) => e.factionId === faction.id);
    if (hasPendingForFaction) continue;

    for (const def of EVENT_DEFS) {
      if (!canTriggerEvent(state, def.key, tick, def.cooldownTicks)) continue;
      if (def.key === "faction_pressure_notice" && hasPressure) {
        const pending = buildPressureNotice(state, tick, faction);
        queuePendingEvent(state, pending);
        markEventTriggered(state, def.key, tick);
        out.push({
          type: "EVENT_TRIGGERED",
          eventId: pending.id,
          eventKey: pending.key,
          factionId: faction.id,
          text: `Event triggered: ${pending.title}.`
        });
        break;
      }
      if (def.key === "faction_trade_probe" && hasTradeWindow) {
        const pending = buildTradeProbe(state, tick, faction);
        queuePendingEvent(state, pending);
        markEventTriggered(state, def.key, tick);
        out.push({
          type: "EVENT_TRIGGERED",
          eventId: pending.id,
          eventKey: pending.key,
          factionId: faction.id,
          text: `Event triggered: ${pending.title}.`
        });
        break;
      }
    }
  }

  return out;
}
