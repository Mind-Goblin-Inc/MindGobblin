import { createInitialState } from "./sim/state.js";
import { tick } from "./sim/tick.js";
import { nextId } from "./sim/ids.js";
import { bindUI } from "./ui/bindings.js";
import { renderApp } from "./ui/render.js";
import { loadGraphicsAssets } from "./graphics/indexedBitmap.js";

const state = createInitialState(resolveRunSeed(), 14);

const els = {
  tick: document.getElementById("tick"),
  goblins: document.getElementById("goblins"),
  avgMorale: document.getElementById("avgMorale"),
  activeGoblins: document.getElementById("activeGoblins"),
  criticalNeeds: document.getElementById("criticalNeeds"),
  foodStock: document.getElementById("foodStock"),
  waterStock: document.getElementById("waterStock"),
  woodStock: document.getElementById("woodStock"),
  mushroomStock: document.getElementById("mushroomStock"),
  roster: document.getElementById("roster"),
  mapCanvas: document.getElementById("mapCanvas"),
  minimapCanvas: document.getElementById("minimapCanvas"),
  uiOverlay: document.getElementById("uiOverlay"),
  toggleUiBtn: document.getElementById("toggleUiBtn"),
  closeUiBtn: document.getElementById("closeUiBtn"),
  mapInspector: document.getElementById("mapInspector"),
  randomizationSummary: document.getElementById("randomizationSummary"),
  mapHoverSummary: document.getElementById("mapHoverSummary"),
  overlayLegend: document.getElementById("overlayLegend"),
  overlayMode: document.getElementById("overlayMode"),
  toggleFollowMode: document.getElementById("toggleFollowMode"),
  snapTrackedGoblin: document.getElementById("snapTrackedGoblin"),
  snapTrackedGoblinPanel: document.getElementById("snapTrackedGoblinPanel"),
  toggleWildlifeLayer: document.getElementById("toggleWildlifeLayer"),
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
  autoPauseEnabled: document.getElementById("autoPauseEnabled"),
  autoPauseUrgent: document.getElementById("autoPauseUrgent"),
  autoPauseCriticalNeeds: document.getElementById("autoPauseCriticalNeeds"),
  autoPauseResourceShortage: document.getElementById("autoPauseResourceShortage"),
  criticalNeedsThreshold: document.getElementById("criticalNeedsThreshold"),
  layerWater: document.getElementById("layerWater"),
  layerResources: document.getElementById("layerResources"),
  layerHomes: document.getElementById("layerHomes"),
  layerWalls: document.getElementById("layerWalls"),
  layerSites: document.getElementById("layerSites"),
  layerGoblins: document.getElementById("layerGoblins"),
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
  if (els.chronicleSeverity) els.chronicleSeverity.value = state.debug.chronicleSeverity || "all";
  if (els.inspectionDepth) els.inspectionDepth.value = String(state.debug.inspectionDepth || 2);

  if (els.autoPauseEnabled) els.autoPauseEnabled.checked = Boolean(state.meta.autoPause?.enabled);
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
  if (els.layerSites) els.layerSites.checked = layers.sites !== false;
  if (els.layerGoblins) els.layerGoblins.checked = layers.goblins !== false;

  for (const [id, btn] of [[1, els.simSpeed1], [2, els.simSpeed2], [4, els.simSpeed4], [8, els.simSpeed8]]) {
    if (!btn) continue;
    btn.style.outline = state.meta.simulationSpeed === id ? "2px solid rgba(58,214,143,.75)" : "none";
  }
}

function render() {
  syncControls();
  renderApp(state, els);
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
  const criticalNeeds = countCriticalNeeds(state);
  const hitCriticalNeeds = cfg.onCriticalNeeds && criticalNeeds >= (cfg.criticalNeedsThreshold || 3);

  if (!urgentEvent && !hitCriticalNeeds) return;

  state.meta.paused = true;
  state.meta.lastAutoPauseTick = state.meta.tick;
  const reason = urgentEvent
    ? `Urgent event: ${urgentEvent.type}`
    : `Critical needs threshold reached (${criticalNeeds})`;
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

function countCriticalNeeds(s) {
  return s.goblins.allIds.reduce((count, id) => {
    const g = s.goblins.byId[id];
    if (!g) return count;
    const isCritical =
      g.needs.hunger >= 75 ||
      g.needs.thirst >= 75 ||
      g.needs.rest >= 80 ||
      g.needs.warmth >= 80 ||
      g.psyche.morale <= 25;
    return count + (isCritical ? 1 : 0);
  }, 0);
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
    state.meta.simulationSpeed = Number.isFinite(state.meta.speed) ? state.meta.speed : 1;
  }
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
    sites: true,
    goblins: true
  };
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
let lastFrameTime = performance.now();
let simAccumulatorMs = 0;

function simulationTickStepMs() {
  const simSpeed = Number.isFinite(state.meta.simulationSpeed) ? Math.max(1, state.meta.simulationSpeed) : 1;
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
