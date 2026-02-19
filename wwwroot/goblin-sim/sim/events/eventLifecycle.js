import { eventDefByKey } from "./eventDefs.js";

function ensureEventsState(state) {
  state.events = state.events || {};
  state.events.pending = state.events.pending || [];
  state.events.active = state.events.active || [];
  state.events.resolved = state.events.resolved || [];
  return state.events;
}

function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function ensureFactionRelationRuntime(faction) {
  faction.runtime = faction.runtime || {};
  faction.runtime.relationToPlayer = {
    trust: 0,
    fear: 0,
    respect: 0,
    resentment: 0,
    tradeAffinity: 0,
    ...(faction.runtime.relationToPlayer || {})
  };
  return faction.runtime.relationToPlayer;
}

function applyRelationDelta(rel, delta) {
  for (const [k, v] of Object.entries(delta || {})) {
    const prev = Number(rel[k] || 0);
    rel[k] = Number(clamp(prev + Number(v || 0), 0, 100).toFixed(2));
  }
}

function leaderDelegationContext(state) {
  const gov = state.tribe?.governance || {};
  const leaderId = gov.leaderGoblinId || null;
  const leader = leaderId ? state.goblins?.byId?.[leaderId] || null : null;
  const responseProfile = String(gov.policy?.responseProfile || "balanced");
  const priorityProfile = gov.runtime?.priorityProfile || {
    survival: 20,
    defense: 20,
    expansion: 20,
    logistics: 20,
    diplomacy: 20
  };
  return {
    leaderId,
    leaderName: leader?.identity?.name || null,
    responseProfile,
    priorityProfile,
    leader,
    learning: {
      confidence: clamp(Number(gov.learning?.confidence ?? 0.5), 0, 1),
      domainWeights: {
        food: Number(gov.learning?.domainWeights?.food ?? 20),
        water: Number(gov.learning?.domainWeights?.water ?? 20),
        defense: Number(gov.learning?.domainWeights?.defense ?? 20),
        industry: Number(gov.learning?.domainWeights?.industry ?? 14),
        logistics: Number(gov.learning?.domainWeights?.logistics ?? 14),
        expansion: Number(gov.learning?.domainWeights?.expansion ?? 8),
        diplomacy: Number(gov.learning?.domainWeights?.diplomacy ?? 4)
      }
    }
  };
}

function effectiveDelegationProfile(ctx, eventKey) {
  const policyProfile = String(ctx.responseProfile || "balanced");
  const w = ctx.learning?.domainWeights || {};
  const defense = Number(w.defense || 20);
  const diplomacy = Number(w.diplomacy || 4);
  const confidence = clamp(Number(ctx.learning?.confidence ?? 0.5), 0, 1);
  const baseBias = clamp((defense - diplomacy) / 24, -1.2, 1.2);
  const eventBias = eventKey === "faction_trade_probe"
    ? clamp(baseBias - 0.55, -1.4, 1.1)
    : eventKey === "faction_pressure_notice"
      ? clamp(baseBias + 0.35, -1.1, 1.5)
      : baseBias;
  const inertia = policyProfile === "hardline" ? 0.22 : policyProfile === "conciliatory" ? -0.22 : 0;
  const score = eventBias + inertia * (0.6 + confidence * 0.4);
  if (score >= 0.42) return "hardline";
  if (score <= -0.42) return "conciliatory";
  return "balanced";
}

function delegationEffectScore(ctx, eventKey, effectiveProfile) {
  const leader = ctx.leader;
  if (!leader) return 0.5;
  const social = Number(leader.coreStats?.social || 0);
  const will = Number(leader.coreStats?.will || 0);
  const cunning = Number(leader.coreStats?.cunning || 0);
  const bargaining = Number(leader.aptitudes?.bargaining || 0);
  const aggression = Number(leader.traits?.personality?.aggression || 0);
  const discipline = Number(leader.traits?.personality?.discipline || 0);
  const diplomacyP = Number(ctx.priorityProfile?.diplomacy || 20);
  const defenseP = Number(ctx.priorityProfile?.defense || 20);
  const logisticsP = Number(ctx.priorityProfile?.logistics || 20);
  const weighted = (
    social * 0.2 +
    will * 0.16 +
    cunning * 0.14 +
    bargaining * 0.18 +
    discipline * 0.12 +
    diplomacyP * 0.1 +
    logisticsP * 0.06 +
    defenseP * 0.04 -
    aggression * 0.05
  );
  let quality = clamp(weighted / 100, 0.15, 0.95);
  const w = ctx.learning?.domainWeights || {};
  const defense = Number(w.defense || 20);
  const diplomacy = Number(w.diplomacy || 4);
  const logistics = Number(w.logistics || 14);
  const confidence = clamp(Number(ctx.learning?.confidence ?? 0.5), 0, 1);
  if (eventKey === "faction_trade_probe") {
    quality += clamp((diplomacy - 4) / 100, -0.08, 0.14);
    quality += clamp((logistics - 14) / 120, -0.06, 0.08);
  } else if (eventKey === "faction_pressure_notice") {
    quality += clamp((defense - 20) / 100, -0.06, 0.12);
  }
  if (effectiveProfile === "hardline") quality += clamp((defense - diplomacy) / 180, -0.04, 0.08) * (0.8 + confidence * 0.2);
  if (effectiveProfile === "conciliatory") quality += clamp((diplomacy - defense) / 180, -0.04, 0.08) * (0.8 + confidence * 0.2);
  return clamp(quality, 0.15, 0.97);
}

function resolvePressureNotice(profile, quality) {
  if (profile === "hardline") {
    if (quality >= 0.52) {
      return {
        resolutionCode: "show-force",
        delta: { fear: 3, respect: 1, trust: -1, resentment: 2 },
        text: "Leader chose a hardline border response."
      };
    }
    return {
      resolutionCode: "failed-intimidation",
      delta: { fear: 1, respect: -1, trust: -2, resentment: 3 },
      text: "Leader attempted a hardline response, but it escalated resentment."
    };
  }
  if (profile === "conciliatory") {
    if (quality >= 0.45) {
      return {
        resolutionCode: "de-escalate",
        delta: { trust: 3, resentment: -2, fear: -1, tradeAffinity: 1 },
        text: "Leader chose de-escalation and dialogue."
      };
    }
    return {
      resolutionCode: "concession-read-weak",
      delta: { trust: 1, fear: 1, resentment: 1 },
      text: "Leader's conciliatory response was read as limited weakness."
    };
  }
  if (quality >= 0.5) {
    return {
      resolutionCode: "measured-deterrence",
      delta: { trust: 1, fear: 1, respect: 1 },
      text: "Leader applied a measured deterrence response."
    };
  }
  return {
    resolutionCode: "mixed-signal",
    delta: { trust: -1, resentment: 1 },
    text: "Leader response sent mixed signals."
  };
}

function resolveTradeProbe(profile, quality) {
  if (profile === "hardline") {
    if (quality >= 0.5) {
      return {
        resolutionCode: "strict-terms",
        delta: { tradeAffinity: 1, trust: -1, respect: 1 },
        text: "Leader accepted trade under strict terms."
      };
    }
    return {
      resolutionCode: "trade-rebuffed",
      delta: { tradeAffinity: -2, resentment: 1, trust: -1 },
      text: "Leader rebuffed the trade probe."
    };
  }
  if (profile === "conciliatory") {
    if (quality >= 0.42) {
      return {
        resolutionCode: "open-trade",
        delta: { tradeAffinity: 3, trust: 2, resentment: -1 },
        text: "Leader opened cooperative trade terms."
      };
    }
    return {
      resolutionCode: "soft-trade-mispriced",
      delta: { tradeAffinity: 1, trust: 0, resentment: 1 },
      text: "Leader accepted trade but terms were inefficient."
    };
  }
  if (quality >= 0.48) {
    return {
      resolutionCode: "balanced-trade",
      delta: { tradeAffinity: 2, trust: 1 },
      text: "Leader negotiated a balanced trade agreement."
    };
  }
  return {
    resolutionCode: "stalled-negotiation",
    delta: { tradeAffinity: -1, trust: -1 },
    text: "Trade negotiation stalled."
  };
}

function resolveEventByLeaderDelegation(state, active) {
  const faction = state.world?.factionsById?.[active.factionId];
  if (!faction) return null;
  const rel = ensureFactionRelationRuntime(faction);
  const ctx = leaderDelegationContext(state);
  const effectiveProfile = effectiveDelegationProfile(ctx, active.key);
  const quality = delegationEffectScore(ctx, active.key, effectiveProfile);
  let result = null;
  if (active.key === "faction_pressure_notice") result = resolvePressureNotice(effectiveProfile, quality);
  if (active.key === "faction_trade_probe") result = resolveTradeProbe(effectiveProfile, quality);
  if (!result) return null;
  applyRelationDelta(rel, result.delta);
  return {
    leaderGoblinId: ctx.leaderId || undefined,
    leaderName: ctx.leaderName || "No Leader",
    responseProfile: ctx.responseProfile,
    effectiveProfile,
    quality: Number(quality.toFixed(3)),
    resolutionCode: result.resolutionCode,
    relationDelta: result.delta,
    learningConfidence: Number(ctx.learning?.confidence ?? 0.5),
    learningWeights: ctx.learning?.domainWeights || undefined,
    text: result.text
  };
}

function trimResolved(events) {
  if (events.resolved.length <= 120) return;
  events.resolved = events.resolved.slice(events.resolved.length - 120);
}

export function eventLifecycleSystem(state) {
  const out = [];
  const tick = state.meta?.tick || 0;
  const events = ensureEventsState(state);

  if (events.pending.length) {
    const pending = events.pending.shift();
    if (pending) {
      pending.status = "active";
      pending.activeTick = tick;
      events.active.push(pending);
      out.push({
        type: "EVENT_ACTIVATED",
        eventId: pending.id,
        eventKey: pending.key,
        factionId: pending.factionId,
        text: pending.summary || `Event activated: ${pending.key}.`
      });
    }
  }

  const stillActive = [];
  for (const active of events.active) {
    if (!active) continue;
    const def = eventDefByKey(active.key);
    const duration = Number(def?.activeDurationTicks || 20);
    const timeoutBehavior = String(def?.timeoutBehavior || "expire");
    const age = tick - Number(active.activeTick || active.createdTick || tick);
    if (age < duration && tick <= Number(active.expiresTick || tick + duration)) {
      stillActive.push(active);
      continue;
    }
    const delegated = resolveEventByLeaderDelegation(state, active);
    active.status = "resolved";
    active.resolvedTick = tick;
    if (delegated) {
      active.resolution = "leader-delegated";
      active.delegation = delegated;
      active.resolutionCode = delegated.resolutionCode;
    } else {
      active.resolution = timeoutBehavior === "expire" ? "expired" : "auto-resolved";
    }
    events.resolved.push(active);
    out.push({
      type: "EVENT_RESOLVED",
      eventId: active.id,
      eventKey: active.key,
      factionId: active.factionId,
      resolution: active.resolution,
      leaderGoblinId: delegated?.leaderGoblinId,
      responseProfile: delegated?.responseProfile,
      effectiveProfile: delegated?.effectiveProfile,
      relationDelta: delegated?.relationDelta,
      resolutionCode: active.resolutionCode || undefined,
      text: delegated
        ? `${active.title || active.key} resolved by ${delegated.leaderName} (${delegated.effectiveProfile || delegated.responseProfile}): ${delegated.text}`
        : `${active.title || active.key} ${active.resolution}.`
    });
  }
  events.active = stillActive;
  trimResolved(events);
  return out;
}
