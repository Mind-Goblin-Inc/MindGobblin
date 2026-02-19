import { createInitialState } from "./sim/state.js";
import { tick } from "./sim/tick.js";
import { nextId } from "./sim/ids.js";
import { bindUI } from "./ui/bindings.js";
import { renderApp } from "./ui/render.js";
import { loadGraphicsAssets } from "./graphics/indexedBitmap.js";
import { ensureWorldContracts } from "./sim/world/contracts.js";

const state = createInitialState(resolveRunSeed(), 14);
state.meta.simulationSpeed = 16;

const els = {
  tick: document.getElementById("tick"),
  goblins: document.getElementById("goblins"),
  avgMorale: document.getElementById("avgMorale"),
  activeGoblins: document.getElementById("activeGoblins"),
  outpostCount: document.getElementById("outpostCount"),
  criticalNeeds: document.getElementById("criticalNeeds"),
  criticalNeedsDetails: document.getElementById("criticalNeedsDetails"),
  seasonStrip: document.getElementById("seasonStrip"),
  seasonNow: document.getElementById("seasonNow"),
  weatherNow: document.getElementById("weatherNow"),
  forecastNow: document.getElementById("forecastNow"),
  foodStock: document.getElementById("foodStock"),
  waterStock: document.getElementById("waterStock"),
  woodStock: document.getElementById("woodStock"),
  mushroomStock: document.getElementById("mushroomStock"),
  resourcePanel: document.getElementById("resourcePanel"),
  resourceDrilldownSummary: document.getElementById("resourceDrilldownSummary"),
  resourceDrilldownList: document.getElementById("resourceDrilldownList"),
  resourceViewCompact: document.getElementById("resourceViewCompact"),
  resourceViewExpanded: document.getElementById("resourceViewExpanded"),
  managementIndicators: document.getElementById("managementIndicators"),
  roster: document.getElementById("roster"),
  mapCanvas: document.getElementById("mapCanvas"),
  minimapCanvas: document.getElementById("minimapCanvas"),
  goblinDetailPanel: document.getElementById("goblinDetailPanel"),
  closeGoblinDetailBtn: document.getElementById("closeGoblinDetailBtn"),
  goblinDetailContent: document.getElementById("goblinDetailContent"),
  wildlifeDetailPanel: document.getElementById("wildlifeDetailPanel"),
  closeWildlifeDetailBtn: document.getElementById("closeWildlifeDetailBtn"),
  wildlifeDetailContent: document.getElementById("wildlifeDetailContent"),
  uiOverlay: document.getElementById("uiOverlay"),
  toggleUiBtn: document.getElementById("toggleUiBtn"),
  closeUiBtn: document.getElementById("closeUiBtn"),
  mapInspector: document.getElementById("mapInspector"),
  roleDistributionSummary: document.getElementById("roleDistributionSummary"),
  roleDistributionChart: document.getElementById("roleDistributionChart"),
  processingOpsSummary: document.getElementById("processingOpsSummary"),
  processingOpsQueue: document.getElementById("processingOpsQueue"),
  blockedReasonSummary: document.getElementById("blockedReasonSummary"),
  blockedReasonList: document.getElementById("blockedReasonList"),
  enemyIntelSummary: document.getElementById("enemyIntelSummary"),
  enemyIntelChart: document.getElementById("enemyIntelChart"),
  enemyOutpostSummary: document.getElementById("enemyOutpostSummary"),
  enemyOutpostList: document.getElementById("enemyOutpostList"),
  climateWarningSummary: document.getElementById("climateWarningSummary"),
  climateWarningList: document.getElementById("climateWarningList"),
  outpostOpsSummary: document.getElementById("outpostOpsSummary"),
  outpostOpsList: document.getElementById("outpostOpsList"),
  buildablesSummary: document.getElementById("buildablesSummary"),
  buildablesList: document.getElementById("buildablesList"),
  randomizationSummary: document.getElementById("randomizationSummary"),
  mapHoverSummary: document.getElementById("mapHoverSummary"),
  legendWrap: document.getElementById("legendWrap"),
  toggleLegend: document.getElementById("toggleLegend"),
  overlayLegend: document.getElementById("overlayLegend"),
  overlayMode: document.getElementById("overlayMode"),
  toggleFollowMode: document.getElementById("toggleFollowMode"),
  snapTrackedGoblin: document.getElementById("snapTrackedGoblin"),
  snapTrackedGoblinPanel: document.getElementById("snapTrackedGoblinPanel"),
  toggleWildlifeLayer: document.getElementById("toggleWildlifeLayer"),
  toggleThreatOverlay: document.getElementById("toggleThreatOverlay"),
  cycleOutpost: document.getElementById("cycleOutpost"),
  resetCamera: document.getElementById("resetCamera"),
  resetCameraPanel: document.getElementById("resetCameraPanel"),
  setStartSite: document.getElementById("setStartSite"),
  jumpToStartSite: document.getElementById("jumpToStartSite"),
  chronicle: document.getElementById("chronicle"),
  problemFeed: document.getElementById("problemFeed"),
  pauseSummary: document.getElementById("pauseSummary"),
  artifactList: document.getElementById("artifactList"),
  artifactInspector: document.getElementById("artifactInspector"),
  chronicleSearch: document.getElementById("chronicleSearch"),
  chronicleType: document.getElementById("chronicleType"),
  chronicleSeverity: document.getElementById("chronicleSeverity"),
  causalityDepth: document.getElementById("causalityDepth"),
  inspectionDepth: document.getElementById("inspectionDepth"),
  debug: document.getElementById("debugJson"),
  playPause: document.getElementById("playPause"),
  step: document.getElementById("stepTick"),
  simSpeed1: document.getElementById("simSpeed1"),
  simSpeed2: document.getElementById("simSpeed2"),
  simSpeed4: document.getElementById("simSpeed4"),
  simSpeed8: document.getElementById("simSpeed8"),
  simSpeed16: document.getElementById("simSpeed16"),
  simSpeed32: document.getElementById("simSpeed32"),
  autoPauseEnabled: document.getElementById("autoPauseEnabled"),
  rolePolicyMode: document.getElementById("rolePolicyMode"),
  autoPauseUrgent: document.getElementById("autoPauseUrgent"),
  autoPauseCriticalNeeds: document.getElementById("autoPauseCriticalNeeds"),
  autoPauseResourceShortage: document.getElementById("autoPauseResourceShortage"),
  criticalNeedsThreshold: document.getElementById("criticalNeedsThreshold"),
  layerWater: document.getElementById("layerWater"),
  layerResources: document.getElementById("layerResources"),
  layerHomes: document.getElementById("layerHomes"),
  layerWalls: document.getElementById("layerWalls"),
  layerEnemyOutposts: document.getElementById("layerEnemyOutposts"),
  layerSites: document.getElementById("layerSites"),
  layerGoblins: document.getElementById("layerGoblins"),
  tuneDetectionScale: document.getElementById("tuneDetectionScale"),
  tuneCommitTicks: document.getElementById("tuneCommitTicks"),
  tuneBreakoffTicks: document.getElementById("tuneBreakoffTicks"),
  tuneEngageRange: document.getElementById("tuneEngageRange"),
  tuneWallPenaltyScale: document.getElementById("tuneWallPenaltyScale"),
  balGlobalDecayMul: document.getElementById("balGlobalDecayMul"),
  balHungerDecayMul: document.getElementById("balHungerDecayMul"),
  balThirstDecayMul: document.getElementById("balThirstDecayMul"),
  balRestDecayMul: document.getElementById("balRestDecayMul"),
  balWarmthDecayMul: document.getElementById("balWarmthDecayMul"),
  balFoodConsumptionMul: document.getElementById("balFoodConsumptionMul"),
  balWaterConsumptionMul: document.getElementById("balWaterConsumptionMul"),
  balResourceGainMul: document.getElementById("balResourceGainMul"),
  balHungerShortageMul: document.getElementById("balHungerShortageMul"),
  balThirstShortageMul: document.getElementById("balThirstShortageMul"),
  balHungerReliefMul: document.getElementById("balHungerReliefMul"),
  balThirstReliefMul: document.getElementById("balThirstReliefMul"),
  balWarmthGainMul: document.getElementById("balWarmthGainMul"),
  balWarmthLossMul: document.getElementById("balWarmthLossMul"),
  csSpoilageGlobalMul: document.getElementById("csSpoilageGlobalMul"),
  csSpoilageMaxRate: document.getElementById("csSpoilageMaxRate"),
  csRationingConsumptionMul: document.getElementById("csRationingConsumptionMul"),
  csRationingLowStockDays: document.getElementById("csRationingLowStockDays"),
  csRationingForecastWindowDays: document.getElementById("csRationingForecastWindowDays"),
  csRationingModerateRisk: document.getElementById("csRationingModerateRisk"),
  balancePresetRelaxed: document.getElementById("balancePresetRelaxed"),
  balancePresetStandard: document.getElementById("balancePresetStandard"),
  balancePresetHarsh: document.getElementById("balancePresetHarsh"),
  reproEnabled: document.getElementById("reproEnabled"),
  reproCooldownTicks: document.getElementById("reproCooldownTicks"),
  reproPairDurationTicks: document.getElementById("reproPairDurationTicks"),
  reproMinIdleTicks: document.getElementById("reproMinIdleTicks"),
  reproMaxBirthsPerDay: document.getElementById("reproMaxBirthsPerDay"),
  reproSafePredatorRadius: document.getElementById("reproSafePredatorRadius"),
  reproMinWallsForSafety: document.getElementById("reproMinWallsForSafety"),
  reproMinWallProtectionScore: document.getElementById("reproMinWallProtectionScore"),
  tunePresetAggressive: document.getElementById("tunePresetAggressive"),
  tunePresetBalanced: document.getElementById("tunePresetBalanced"),
  tunePresetDefensive: document.getElementById("tunePresetDefensive"),
  saveSnapshotBtn: document.getElementById("saveSnapshotBtn"),
  loadSnapshotSelect: document.getElementById("loadSnapshotSelect"),
  loadSnapshotBtn: document.getElementById("loadSnapshotBtn"),
  deleteSnapshotBtn: document.getElementById("deleteSnapshotBtn")
};

state.ui = {
  mapCanvas: els.mapCanvas,
  minimapCanvas: els.minimapCanvas
};

function syncControls() {
  if (els.overlayMode) els.overlayMode.value = state.worldMap.render.overlayMode;
  if (els.playPause) els.playPause.textContent = state.meta.paused ? "Resume" : "Pause";
  if (els.toggleFollowMode) {
    els.toggleFollowMode.textContent = state.worldMap.render.followTrackedGoblin ? "Follow Tracked" : "Free Roam";
  }
  if (els.toggleWildlifeLayer) {
    els.toggleWildlifeLayer.textContent = state.worldMap.render.showDebugWildlife ? "Hide Wildlife" : "Show Wildlife";
  }
  if (els.toggleThreatOverlay) {
    els.toggleThreatOverlay.textContent = state.worldMap.render.showThreatOverlay === false ? "Show Threat Overlay" : "Hide Threat Overlay";
  }
  if (els.toggleLegend && els.legendWrap) {
    els.toggleLegend.textContent = els.legendWrap.classList.contains("open") ? "Hide Legend" : "Show Legend";
  }
  if (els.chronicleSeverity) els.chronicleSeverity.value = state.debug.chronicleSeverity || "all";
  if (els.inspectionDepth) els.inspectionDepth.value = String(state.debug.inspectionDepth || 2);
  if (els.resourceViewCompact && els.resourceViewExpanded) {
    const viewMode = state.debug?.resourceViewMode === "compact" ? "compact" : "expanded";
    els.resourceViewCompact.style.outline = viewMode === "compact" ? "2px solid rgba(58,214,143,.75)" : "none";
    els.resourceViewExpanded.style.outline = viewMode === "expanded" ? "2px solid rgba(58,214,143,.75)" : "none";
  }

  if (els.autoPauseEnabled) els.autoPauseEnabled.checked = Boolean(state.meta.autoPause?.enabled);
  if (els.rolePolicyMode) els.rolePolicyMode.value = state.worldMap?.structures?.rolePolicy?.mode || "assist";
  if (els.autoPauseUrgent) els.autoPauseUrgent.checked = Boolean(state.meta.autoPause?.onUrgent);
  if (els.autoPauseCriticalNeeds) els.autoPauseCriticalNeeds.checked = Boolean(state.meta.autoPause?.onCriticalNeeds);
  if (els.autoPauseResourceShortage) els.autoPauseResourceShortage.checked = Boolean(state.meta.autoPause?.onResourceShortage);
  if (els.criticalNeedsThreshold) {
    els.criticalNeedsThreshold.value = String(state.meta.autoPause?.criticalNeedsThreshold || 3);
  }

  const layers = state.worldMap.render.showLayers || {};
  if (els.layerWater) els.layerWater.checked = layers.water !== false;
  if (els.layerResources) els.layerResources.checked = layers.resources !== false;
  if (els.layerHomes) els.layerHomes.checked = layers.homes !== false;
  if (els.layerWalls) els.layerWalls.checked = layers.walls !== false;
  if (els.layerEnemyOutposts) els.layerEnemyOutposts.checked = layers.enemyOutposts !== false;
  if (els.layerSites) els.layerSites.checked = layers.sites !== false;
  if (els.layerGoblins) els.layerGoblins.checked = layers.goblins !== false;
  const tuning = state.meta.tuning || {};
  const wildlifeTuning = tuning.wildlife || {};
  const balanceTuning = tuning.balance || {};
  const scarcityTuning = tuning.climateScarcity || {};
  if (els.tuneDetectionScale) els.tuneDetectionScale.value = String(wildlifeTuning.detectionRadiusScale ?? 1);
  if (els.tuneCommitTicks) els.tuneCommitTicks.value = String(wildlifeTuning.targetCommitTicks ?? 20);
  if (els.tuneBreakoffTicks) els.tuneBreakoffTicks.value = String(wildlifeTuning.breakoffTicks ?? 10);
  if (els.tuneEngageRange) els.tuneEngageRange.value = String(wildlifeTuning.engageRange ?? 1.5);
  if (els.tuneWallPenaltyScale) els.tuneWallPenaltyScale.value = String(wildlifeTuning.wallPenaltyScale ?? 1);
  if (els.balGlobalDecayMul) els.balGlobalDecayMul.value = String(balanceTuning.globalDecayMul ?? 1);
  if (els.balHungerDecayMul) els.balHungerDecayMul.value = String(balanceTuning.hungerDecayMul ?? 1);
  if (els.balThirstDecayMul) els.balThirstDecayMul.value = String(balanceTuning.thirstDecayMul ?? 1);
  if (els.balRestDecayMul) els.balRestDecayMul.value = String(balanceTuning.restDecayMul ?? 0.2);
  if (els.balWarmthDecayMul) els.balWarmthDecayMul.value = String(balanceTuning.warmthDecayMul ?? 1);
  if (els.balFoodConsumptionMul) els.balFoodConsumptionMul.value = String(balanceTuning.foodConsumptionMul ?? 1);
  if (els.balWaterConsumptionMul) els.balWaterConsumptionMul.value = String(balanceTuning.waterConsumptionMul ?? 1);
  if (els.balResourceGainMul) els.balResourceGainMul.value = String(balanceTuning.resourceGainMul ?? 5);
  if (els.balHungerShortageMul) els.balHungerShortageMul.value = String(balanceTuning.hungerShortageMul ?? 1);
  if (els.balThirstShortageMul) els.balThirstShortageMul.value = String(balanceTuning.thirstShortageMul ?? 1);
  if (els.balHungerReliefMul) els.balHungerReliefMul.value = String(balanceTuning.hungerReliefMul ?? 1);
  if (els.balThirstReliefMul) els.balThirstReliefMul.value = String(balanceTuning.thirstReliefMul ?? 1);
  if (els.balWarmthGainMul) els.balWarmthGainMul.value = String(balanceTuning.warmthGainMul ?? 1);
  if (els.balWarmthLossMul) els.balWarmthLossMul.value = String(balanceTuning.warmthLossMul ?? 1);
  if (els.csSpoilageGlobalMul) els.csSpoilageGlobalMul.value = String(scarcityTuning.spoilageGlobalMul ?? 1);
  if (els.csSpoilageMaxRate) els.csSpoilageMaxRate.value = String(scarcityTuning.spoilageMaxRate ?? 0.06);
  if (els.csRationingConsumptionMul) els.csRationingConsumptionMul.value = String(scarcityTuning.rationingConsumptionMul ?? 0.93);
  if (els.csRationingLowStockDays) els.csRationingLowStockDays.value = String(scarcityTuning.rationingLowStockDays ?? 3);
  if (els.csRationingForecastWindowDays) els.csRationingForecastWindowDays.value = String(scarcityTuning.rationingForecastWindowDays ?? 2);
  if (els.csRationingModerateRisk) els.csRationingModerateRisk.checked = Boolean(scarcityTuning.rationingModerateRisk ?? false);
  syncBalanceIndicators(balanceTuning, els);
  const repro = state.worldMap?.structures?.reproduction || {};
  if (els.reproEnabled) els.reproEnabled.checked = repro.enabled !== false;
  if (els.reproCooldownTicks) els.reproCooldownTicks.value = String(repro.cooldownTicks ?? 120);
  if (els.reproPairDurationTicks) els.reproPairDurationTicks.value = String(repro.pairDurationTicks ?? 10);
  if (els.reproMinIdleTicks) els.reproMinIdleTicks.value = String(repro.minIdleTicks ?? 12);
  if (els.reproMaxBirthsPerDay) els.reproMaxBirthsPerDay.value = String(repro.maxBirthsPerDay ?? 2);
  if (els.reproSafePredatorRadius) els.reproSafePredatorRadius.value = String(repro.safePredatorRadius ?? 10);
  if (els.reproMinWallsForSafety) els.reproMinWallsForSafety.value = String(repro.minWallsForSafety ?? 10);
  if (els.reproMinWallProtectionScore) els.reproMinWallProtectionScore.value = String(repro.minWallProtectionScore ?? 0.45);

  for (const [id, btn] of [[1, els.simSpeed1], [2, els.simSpeed2], [4, els.simSpeed4], [8, els.simSpeed8], [16, els.simSpeed16], [32, els.simSpeed32]]) {
    if (!btn) continue;
    btn.style.outline = state.meta.simulationSpeed === id ? "2px solid rgba(58,214,143,.75)" : "none";
  }
}

function syncBalanceIndicators(balanceTuning, refs) {
  applyBalanceIndicator(refs.balGlobalDecayMul, Number(balanceTuning.globalDecayMul ?? 1), 1, "higher-is-bad");
  applyBalanceIndicator(refs.balHungerDecayMul, Number(balanceTuning.hungerDecayMul ?? 1), 1, "higher-is-bad");
  applyBalanceIndicator(refs.balThirstDecayMul, Number(balanceTuning.thirstDecayMul ?? 1), 1, "higher-is-bad");
  applyBalanceIndicator(refs.balRestDecayMul, Number(balanceTuning.restDecayMul ?? 0.2), 0.2, "higher-is-bad");
  applyBalanceIndicator(refs.balWarmthDecayMul, Number(balanceTuning.warmthDecayMul ?? 1), 1, "higher-is-bad");
  applyBalanceIndicator(refs.balFoodConsumptionMul, Number(balanceTuning.foodConsumptionMul ?? 1), 1, "higher-is-bad");
  applyBalanceIndicator(refs.balWaterConsumptionMul, Number(balanceTuning.waterConsumptionMul ?? 1), 1, "higher-is-bad");
  applyBalanceIndicator(refs.balResourceGainMul, Number(balanceTuning.resourceGainMul ?? 5), 5, "higher-is-good");
  applyBalanceIndicator(refs.balHungerShortageMul, Number(balanceTuning.hungerShortageMul ?? 1), 1, "higher-is-bad");
  applyBalanceIndicator(refs.balThirstShortageMul, Number(balanceTuning.thirstShortageMul ?? 1), 1, "higher-is-bad");
  applyBalanceIndicator(refs.balHungerReliefMul, Number(balanceTuning.hungerReliefMul ?? 1), 1, "higher-is-good");
  applyBalanceIndicator(refs.balThirstReliefMul, Number(balanceTuning.thirstReliefMul ?? 1), 1, "higher-is-good");
  applyBalanceIndicator(refs.balWarmthGainMul, Number(balanceTuning.warmthGainMul ?? 1), 1, "higher-is-good");
  applyBalanceIndicator(refs.balWarmthLossMul, Number(balanceTuning.warmthLossMul ?? 1), 1, "higher-is-bad");
}

function applyBalanceIndicator(input, value, baseline, direction) {
  if (!input) return;
  const epsilon = 0.0001;
  let stateClass = "neutral";
  if (value > baseline + epsilon) {
    stateClass = direction === "higher-is-good" ? "good" : "bad";
  } else if (value < baseline - epsilon) {
    stateClass = direction === "higher-is-good" ? "bad" : "good";
  }
  input.classList.remove("balance-good", "balance-bad", "balance-neutral");
  input.classList.add(`balance-${stateClass}`);
  const label = input.closest("label");
  const labelText = label?.querySelector("span");
  if (labelText) {
    labelText.classList.add("balance-indicator");
    labelText.classList.remove("good", "bad", "neutral");
    labelText.classList.add(stateClass);
  }
}

function render() {
  syncControls();
  renderApp(state, els);
  syncCriticalTelemetryHud();
}

function syncCriticalTelemetryHud() {
  const telemetry = summarizeCriticalNeeds(state);
  if (els.criticalNeeds) els.criticalNeeds.textContent = String(telemetry.count);
  const details = els.criticalNeedsDetails || document.getElementById("criticalNeedsDetails");
  if (!details) return;
  details.textContent = `T${state.meta.tick} | G:${telemetry.count} | H:${telemetry.byType.hunger} T:${telemetry.byType.thirst} R:${telemetry.byType.rest} W:${telemetry.byType.warmth} M:${telemetry.byType.morale}`;
}

function centerCameraOnStartingSite() {
  const siteId = state.worldMap?.player?.startingSiteId;
  const site = siteId ? state.worldMap?.sitesById?.[siteId] : null;
  if (!site || !els.mapCanvas) return;
  const tilePx = 24;
  const zoom = state.worldMap.camera.zoom;
  state.worldMap.camera.x = els.mapCanvas.clientWidth * 0.5 - (site.x + 0.5) * tilePx * zoom;
  state.worldMap.camera.y = els.mapCanvas.clientHeight * 0.5 - (site.y + 0.5) * tilePx * zoom;
}

function runTick() {
  const events = tick(state);
  maybeAutoPause(events);
  return events;
}

function step() {
  runTick();
  render();
}

function maybeAutoPause(events) {
  const cfg = state.meta.autoPause || {};
  if (!cfg.enabled || state.meta.paused) return;
  const last = Number.isFinite(state.meta.lastAutoPauseTick) ? state.meta.lastAutoPauseTick : null;
  const minTicksBetweenPauses = Number.isFinite(cfg.minTicksBetweenPauses) ? Math.max(0, cfg.minTicksBetweenPauses) : 30;
  if (last !== null && (state.meta.tick - last) < minTicksBetweenPauses) return;

  const urgentEvent = events.find((e) => isUrgentEvent(e, cfg));
  const critical = summarizeCriticalNeeds(state);
  const criticalNeeds = critical.count;
  const hitCriticalNeeds = cfg.onCriticalNeeds && criticalNeeds >= (cfg.criticalNeedsThreshold || 3);

  if (!urgentEvent && !hitCriticalNeeds) return;

  state.meta.paused = true;
  state.meta.lastAutoPauseTick = state.meta.tick;
  const reason = urgentEvent
    ? `Urgent event: ${urgentEvent.type}`
    : `Critical needs threshold reached (${criticalNeeds}) [${critical.summaryText}]`;
  state.debug.pauseSummary = {
    fromTick: Math.max(0, state.meta.tick - 6),
    toTick: state.meta.tick,
    reason,
    items: state.chronicle
      .slice(-8)
      .map((c) => `[T${c.tick}] ${c.text}`)
  };
}

function isUrgentEvent(event, cfg) {
  if (!event || !event.type) return false;
  if (cfg.onUrgent && (
    event.type === "BARBARIAN_RAID_TARGETED" ||
    event.type === "BARBARIAN_RAID_NEAR_HOME" ||
    event.type === "BARBARIAN_DAMAGED_WALL" ||
    event.type === "WOLF_THREAT_NEAR_HOME"
  )) return true;

  if (cfg.onResourceShortage && event.type === "RESOURCE_SHORTAGE") return true;
  if (cfg.onResourceShortage && event.type === "NO_FIREWOOD") return true;
  return false;
}

function summarizeCriticalNeeds(s) {
  const byType = { hunger: 0, thirst: 0, rest: 0, warmth: 0, morale: 0 };
  let count = 0;

  for (const id of s.goblins.allIds) {
    const g = s.goblins.byId[id];
    if (!g || !g.flags?.alive || g.flags?.missing) continue;
    const hunger = Number(g.needs?.hunger || 0) >= 75;
    const thirst = Number(g.needs?.thirst || 0) >= 75;
    const rest = Number(g.needs?.rest || 0) >= 80;
    const warmth = Number(g.needs?.warmth || 0) >= 80;
    const morale = Number(g.psyche?.morale || 0) <= 25;
    if (!(hunger || thirst || rest || warmth || morale)) continue;

    count += 1;
    if (hunger) byType.hunger += 1;
    if (thirst) byType.thirst += 1;
    if (rest) byType.rest += 1;
    if (warmth) byType.warmth += 1;
    if (morale) byType.morale += 1;
  }

  const summaryText = `H${byType.hunger} T${byType.thirst} R${byType.rest} W${byType.warmth} M${byType.morale}`;
  return { count, byType, summaryText };
}

function pushEvent(event) {
  state.chronicle.push({
    id: nextId(state, "chron"),
    tick: state.meta.tick,
    type: event.type,
    goblinId: event.goblinId || undefined,
    siteId: event.siteId || undefined,
    artifactId: event.artifactId || undefined,
    text: event.text || event.type,
    details: event
  });
}

function replaceState(nextState) {
  const graphics = state.graphics;
  const uiRefs = state.ui;
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, nextState);
  state.ui = uiRefs;
  if (!state.graphics && graphics) state.graphics = graphics;
  state.meta = state.meta || {};
  if (!Number.isFinite(state.meta.simulationSpeed)) {
    state.meta.simulationSpeed = Number.isFinite(state.meta.speed) ? state.meta.speed : 16;
  }
  state.meta.simulationSpeed = Math.max(1, Math.min(MAX_SIMULATION_SPEED, state.meta.simulationSpeed));
  delete state.meta.speed;
  delete state.meta.renderFpsCap;
  state.meta.autoPause = state.meta.autoPause || {
    enabled: false,
    onUrgent: true,
    onCriticalNeeds: true,
    criticalNeedsThreshold: 3,
    onResourceShortage: true,
    minTicksBetweenPauses: 30
  };
  state.meta.tuning = state.meta.tuning || {};
  state.meta.tuning.wildlife = {
    detectionRadiusScale: Number(state.meta.tuning.wildlife?.detectionRadiusScale ?? 1),
    targetCommitTicks: Number(state.meta.tuning.wildlife?.targetCommitTicks ?? 20),
    retargetCooldownTicks: Number(state.meta.tuning.wildlife?.retargetCooldownTicks ?? 6),
    breakoffTicks: Number(state.meta.tuning.wildlife?.breakoffTicks ?? 10),
    engageRange: Number(state.meta.tuning.wildlife?.engageRange ?? 1.5),
    wallPenaltyScale: Number(state.meta.tuning.wildlife?.wallPenaltyScale ?? 1)
  };
  state.meta.tuning.threat = {
    localRadius: Number(state.meta.tuning.threat?.localRadius ?? 9),
    directRadius: Number(state.meta.tuning.threat?.directRadius ?? 4.5)
  };
  state.meta.tuning.balance = {
    globalDecayMul: Number(state.meta.tuning.balance?.globalDecayMul ?? 1),
    hungerDecayMul: Number(state.meta.tuning.balance?.hungerDecayMul ?? 1),
    thirstDecayMul: Number(state.meta.tuning.balance?.thirstDecayMul ?? 1),
    restDecayMul: Number(state.meta.tuning.balance?.restDecayMul ?? 0.2),
    warmthDecayMul: Number(state.meta.tuning.balance?.warmthDecayMul ?? 1),
    foodConsumptionMul: Number(state.meta.tuning.balance?.foodConsumptionMul ?? 1),
    waterConsumptionMul: Number(state.meta.tuning.balance?.waterConsumptionMul ?? 1),
    resourceGainMul: Number(state.meta.tuning.balance?.resourceGainMul ?? 5),
    hungerShortageMul: Number(state.meta.tuning.balance?.hungerShortageMul ?? 1),
    thirstShortageMul: Number(state.meta.tuning.balance?.thirstShortageMul ?? 1),
    hungerReliefMul: Number(state.meta.tuning.balance?.hungerReliefMul ?? 1),
    thirstReliefMul: Number(state.meta.tuning.balance?.thirstReliefMul ?? 1),
    warmthGainMul: Number(state.meta.tuning.balance?.warmthGainMul ?? 1),
    warmthLossMul: Number(state.meta.tuning.balance?.warmthLossMul ?? 1)
  };
  state.debug = state.debug || {};
  if (!state.debug.pauseSummary) {
    state.debug.pauseSummary = { fromTick: 0, toTick: 0, reason: "", items: [] };
  }
  if (!state.debug.chronicleSeverity) state.debug.chronicleSeverity = "all";
  if (!state.debug.inspectionDepth) state.debug.inspectionDepth = 2;
  state.debug.__panelRenderKey = "";
  state.worldMap.render.showLayers = state.worldMap.render.showLayers || {
    routes: true,
    water: true,
    resources: true,
    homes: true,
    walls: true,
    enemyOutposts: true,
    sites: true,
    goblins: true
  };
  if (state.worldMap.render.showLayers.enemyOutposts === undefined) {
    state.worldMap.render.showLayers.enemyOutposts = true;
  }
  state.worldMap.structures = state.worldMap.structures || {};
  state.worldMap.structures.wallPlansBySiteId = state.worldMap.structures.wallPlansBySiteId || {};
  const primarySiteId = state.worldMap.player?.startingSiteId || "home";
  if (state.worldMap.structures.wallPlan && !state.worldMap.structures.wallPlansBySiteId[primarySiteId]) {
    state.worldMap.structures.wallPlansBySiteId[primarySiteId] = state.worldMap.structures.wallPlan;
  }
  if (!state.worldMap.structures.wallPlan && state.worldMap.structures.wallPlansBySiteId[primarySiteId]) {
    state.worldMap.structures.wallPlan = state.worldMap.structures.wallPlansBySiteId[primarySiteId];
  }
  if (state.worldMap.render.showThreatOverlay === undefined) state.worldMap.render.showThreatOverlay = true;
  ensureWorldContracts(state);
}

bindUI(state, els, { step, render, pushEvent, syncControls, replaceState });
centerCameraOnStartingSite();
render();
window.requestAnimationFrame(() => {
  centerCameraOnStartingSite();
  render();
});

if (els.resetCameraPanel && els.resetCamera) {
  els.resetCameraPanel.addEventListener("click", () => els.resetCamera.click());
}
if (els.snapTrackedGoblinPanel && els.snapTrackedGoblin) {
  els.snapTrackedGoblinPanel.addEventListener("click", () => els.snapTrackedGoblin.click());
}

loadGraphicsAssets()
  .then((assets) => {
    state.graphics = assets;
    render();
  })
  .catch((err) => {
    state.debug.warnings.push(`graphics-load-failed: ${String(err)}`);
    render();
  });

const BASE_TICK_MS = 1000;
const MAX_TICKS_PER_FRAME = 24;
const MAX_SIMULATION_SPEED = 32;
let lastFrameTime = performance.now();
let simAccumulatorMs = 0;

function simulationTickStepMs() {
  const simSpeed = Number.isFinite(state.meta.simulationSpeed)
    ? Math.max(1, Math.min(MAX_SIMULATION_SPEED, state.meta.simulationSpeed))
    : 16;
  return BASE_TICK_MS / simSpeed;
}

function frameLoop(now) {
  const elapsedMs = Math.min(250, Math.max(0, now - lastFrameTime));
  lastFrameTime = now;

  if (!state.meta.paused) {
    simAccumulatorMs += elapsedMs;
    let tickBudget = 0;
    let stepMs = simulationTickStepMs();
    while (simAccumulatorMs >= stepMs && tickBudget < MAX_TICKS_PER_FRAME) {
      runTick();
      simAccumulatorMs -= stepMs;
      tickBudget += 1;
      if (state.meta.paused) break;
      stepMs = simulationTickStepMs();
    }
    if (tickBudget === MAX_TICKS_PER_FRAME) {
      simAccumulatorMs = Math.min(simAccumulatorMs, stepMs);
    }
  }

  render();
  window.requestAnimationFrame(frameLoop);
}

window.requestAnimationFrame(frameLoop);

function resolveRunSeed() {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get("seed");
  if (explicit && explicit.trim()) return explicit.trim();
  const rnd = Math.random().toString(36).slice(2, 10);
  return `run-${Date.now().toString(36)}-${rnd}`;
}
