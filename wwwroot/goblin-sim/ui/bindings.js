import { bindWorldInteractions } from "./world/interactions.js";

const SNAP_PREFIX = "goblin-sim-snapshot:";
const SNAP_INDEX_KEY = "goblin-sim-snapshot-index";

export function bindUI(state, els, actions) {
  function setOverlayOpen(open) {
    if (!els.uiOverlay || !els.toggleUiBtn) return;
    els.uiOverlay.classList.toggle("open", open);
    els.toggleUiBtn.textContent = open ? "Hide Panels" : "Open Panels";
  }

  function centerCameraOnTile(tileX, tileY) {
    if (!els.mapCanvas) return;
    const tilePx = 24;
    const zoom = state.worldMap.camera.zoom;
    state.worldMap.camera.x = els.mapCanvas.clientWidth * 0.5 - (tileX + 0.5) * tilePx * zoom;
    state.worldMap.camera.y = els.mapCanvas.clientHeight * 0.5 - (tileY + 0.5) * tilePx * zoom;
  }

  function setOverlayMode(mode) {
    state.worldMap.render.overlayMode = mode;
    if (els.overlayMode) els.overlayMode.value = mode;
    actions.render();
  }

  function setSimulationSpeed(simulationSpeed) {
    state.meta.simulationSpeed = simulationSpeed;
    if (actions.syncControls) actions.syncControls();
    actions.render();
  }

  function refreshSnapshotSelect() {
    if (!els.loadSnapshotSelect) return;
    const names = readSnapshotIndex();
    const current = els.loadSnapshotSelect.value;
    els.loadSnapshotSelect.innerHTML = names.length
      ? names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("")
      : '<option value="">No snapshots</option>';
    if (names.includes(current)) els.loadSnapshotSelect.value = current;
  }

  if (els.toggleUiBtn && els.uiOverlay) {
    els.toggleUiBtn.addEventListener("click", () => {
      const isOpen = els.uiOverlay.classList.contains("open");
      setOverlayOpen(!isOpen);
    });
  }

  if (els.closeUiBtn && els.uiOverlay) {
    els.closeUiBtn.addEventListener("click", () => setOverlayOpen(false));
  }

  window.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      if (e.key === "Escape" && els.uiOverlay) setOverlayOpen(false);
      return;
    }

    if (e.key === "Escape" && els.uiOverlay) {
      setOverlayOpen(false);
      return;
    }

    if (e.key === "1") setOverlayMode("biome");
    if (e.key === "2") setOverlayMode("resources");
    if (e.key === "3") setOverlayMode("hazard");
    if (e.key === "4") setOverlayMode("influence");
  });

  els.playPause.addEventListener("click", () => {
    state.meta.paused = !state.meta.paused;
    if (actions.syncControls) actions.syncControls();
  });

  if (els.simSpeed1) els.simSpeed1.addEventListener("click", () => setSimulationSpeed(1));
  if (els.simSpeed2) els.simSpeed2.addEventListener("click", () => setSimulationSpeed(2));
  if (els.simSpeed4) els.simSpeed4.addEventListener("click", () => setSimulationSpeed(4));
  if (els.simSpeed8) els.simSpeed8.addEventListener("click", () => setSimulationSpeed(8));

  if (els.autoPauseEnabled) {
    els.autoPauseEnabled.addEventListener("change", () => {
      state.meta.autoPause.enabled = Boolean(els.autoPauseEnabled.checked);
    });
  }
  if (els.autoPauseUrgent) {
    els.autoPauseUrgent.addEventListener("change", () => {
      state.meta.autoPause.onUrgent = Boolean(els.autoPauseUrgent.checked);
    });
  }
  if (els.autoPauseCriticalNeeds) {
    els.autoPauseCriticalNeeds.addEventListener("change", () => {
      state.meta.autoPause.onCriticalNeeds = Boolean(els.autoPauseCriticalNeeds.checked);
    });
  }
  if (els.autoPauseResourceShortage) {
    els.autoPauseResourceShortage.addEventListener("change", () => {
      state.meta.autoPause.onResourceShortage = Boolean(els.autoPauseResourceShortage.checked);
    });
  }
  if (els.criticalNeedsThreshold) {
    els.criticalNeedsThreshold.addEventListener("change", () => {
      const n = Number.parseInt(els.criticalNeedsThreshold.value, 10);
      state.meta.autoPause.criticalNeedsThreshold = Number.isFinite(n) ? Math.max(1, Math.min(20, n)) : 3;
      els.criticalNeedsThreshold.value = String(state.meta.autoPause.criticalNeedsThreshold);
    });
  }

  if (els.inspectionDepth) {
    els.inspectionDepth.addEventListener("change", () => {
      const n = Number.parseInt(els.inspectionDepth.value, 10);
      state.debug.inspectionDepth = Number.isFinite(n) ? Math.max(1, Math.min(3, n)) : 2;
      actions.render();
    });
  }

  if (els.layerWater) {
    els.layerWater.addEventListener("change", () => {
      state.worldMap.render.showLayers.water = Boolean(els.layerWater.checked);
      actions.render();
    });
  }
  if (els.layerResources) {
    els.layerResources.addEventListener("change", () => {
      state.worldMap.render.showLayers.resources = Boolean(els.layerResources.checked);
      actions.render();
    });
  }
  if (els.layerHomes) {
    els.layerHomes.addEventListener("change", () => {
      state.worldMap.render.showLayers.homes = Boolean(els.layerHomes.checked);
      actions.render();
    });
  }
  if (els.layerWalls) {
    els.layerWalls.addEventListener("change", () => {
      state.worldMap.render.showLayers.walls = Boolean(els.layerWalls.checked);
      actions.render();
    });
  }
  if (els.layerSites) {
    els.layerSites.addEventListener("change", () => {
      state.worldMap.render.showLayers.sites = Boolean(els.layerSites.checked);
      actions.render();
    });
  }
  if (els.layerGoblins) {
    els.layerGoblins.addEventListener("change", () => {
      state.worldMap.render.showLayers.goblins = Boolean(els.layerGoblins.checked);
      actions.render();
    });
  }

  if (els.jumpToStartSite) {
    els.jumpToStartSite.addEventListener("click", () => {
      const id = state.worldMap.player.startingSiteId;
      const site = id ? state.worldMap.sitesById[id] : null;
      if (!site) return;
      centerCameraOnTile(site.x, site.y);
      state.worldMap.player.selectedSiteId = site.id;
      state.worldMap.player.selectedRegionId = site.regionId;
      actions.render();
    });
  }

  if (els.toggleFollowMode) {
    els.toggleFollowMode.addEventListener("click", () => {
      state.worldMap.render.followTrackedGoblin = !state.worldMap.render.followTrackedGoblin;
      if (actions.syncControls) actions.syncControls();
      actions.render();
    });
  }

  if (els.toggleWildlifeLayer) {
    els.toggleWildlifeLayer.addEventListener("click", () => {
      state.worldMap.render.showDebugWildlife = !state.worldMap.render.showDebugWildlife;
      if (actions.syncControls) actions.syncControls();
      actions.render();
    });
  }

  if (els.snapTrackedGoblin) {
    els.snapTrackedGoblin.addEventListener("click", () => {
      const trackedGoblinId = state.debug?.trackedGoblinId;
      const trackedWildlifeId = state.debug?.trackedWildlifeId;
      const goblinUnit = trackedGoblinId ? state.worldMap?.units?.byGoblinId?.[trackedGoblinId] : null;
      const wildlifeUnit = trackedWildlifeId ? state.worldMap?.wildlife?.byId?.[trackedWildlifeId] : null;
      const unit = wildlifeUnit || goblinUnit;
      if (!unit || !els.mapCanvas) return;

      const tx = unit.posX ?? unit.tileX + 0.5;
      const ty = unit.posY ?? unit.tileY + 0.5;
      centerCameraOnTile(tx - 0.5, ty - 0.5);
      actions.render();
    });
  }

  els.step.addEventListener("click", actions.step);

  els.roster.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const id = btn.dataset.id;
    state.debug.selectedGoblinId = id;
    state.debug.trackedGoblinId = id;
    state.debug.selectedWildlifeId = null;
    state.debug.trackedWildlifeId = null;
    actions.render();
  });

  els.roster.addEventListener("change", (e) => {
    const sel = e.target.closest("select[data-role-id]");
    if (!sel) return;
    const id = sel.dataset.roleId;
    const nextRole = String(sel.value || "forager");
    const goblin = state.goblins.byId[id];
    const unit = state.worldMap?.units?.byGoblinId?.[id];
    if (!goblin || !unit) return;

    const prevRole = unit.roleState?.role || goblin.social?.role || undefined;
    goblin.social = goblin.social || {};
    goblin.social.role = nextRole;
    unit.roleState = unit.roleState || {};
    unit.roleState.role = nextRole;
    unit.roleState.roleTask = undefined;
    unit.roleState.roleCooldownUntilTick = state.meta.tick + 4;

    actions.pushEvent({
      type: prevRole ? "ROLE_REASSIGNED" : "ROLE_ASSIGNED",
      goblinId: id,
      role: nextRole,
      previousRole: prevRole,
      text: prevRole
        ? `${goblin.identity.name} role changed ${prevRole} -> ${nextRole}.`
        : `${goblin.identity.name} assigned role ${nextRole}.`
    });
    actions.render();
  });

  els.artifactList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-artifact-id]");
    if (!btn) return;
    state.debug.selectedArtifactId = btn.dataset.artifactId;
    actions.render();
  });

  els.chronicleSearch.addEventListener("input", () => {
    state.debug.chronicleSearch = els.chronicleSearch.value || "";
    actions.render();
  });

  els.chronicleType.addEventListener("change", () => {
    state.debug.chronicleType = els.chronicleType.value;
    actions.render();
  });

  if (els.chronicleSeverity) {
    els.chronicleSeverity.addEventListener("change", () => {
      state.debug.chronicleSeverity = els.chronicleSeverity.value;
      actions.render();
    });
  }

  els.causalityDepth.addEventListener("change", () => {
    const depth = Number.parseInt(els.causalityDepth.value, 10);
    state.debug.chronicleCausalityDepth = Number.isFinite(depth) ? Math.max(0, Math.min(3, depth)) : 1;
    actions.render();
  });

  const chronicleClick = (e) => {
    const btn = e.target.closest("button[data-entry-id]");
    if (!btn) return;
    state.debug.selectedChronicleEntryId = btn.dataset.entryId;
    if (btn.dataset.focusX && btn.dataset.focusY) {
      centerCameraOnTile(Number(btn.dataset.focusX), Number(btn.dataset.focusY));
    }
    actions.render();
  };

  els.chronicle.addEventListener("click", chronicleClick);
  if (els.problemFeed) els.problemFeed.addEventListener("click", chronicleClick);

  if (els.saveSnapshotBtn) {
    els.saveSnapshotBtn.addEventListener("click", () => {
      const name = `tick-${state.meta.tick}-${Date.now().toString(36)}`;
      saveSnapshot(name, state);
      refreshSnapshotSelect();
    });
  }

  if (els.loadSnapshotBtn) {
    els.loadSnapshotBtn.addEventListener("click", () => {
      const name = els.loadSnapshotSelect?.value;
      if (!name) return;
      const loaded = loadSnapshot(name);
      if (!loaded) return;
      actions.replaceState(loaded);
      if (actions.syncControls) actions.syncControls();
      actions.render();
    });
  }

  if (els.deleteSnapshotBtn) {
    els.deleteSnapshotBtn.addEventListener("click", () => {
      const name = els.loadSnapshotSelect?.value;
      if (!name) return;
      deleteSnapshot(name);
      refreshSnapshotSelect();
    });
  }

  if (els.overlayMode) {
    els.overlayMode.addEventListener("change", () => {
      state.worldMap.render.overlayMode = els.overlayMode.value;
      actions.render();
    });
  }

  bindWorldInteractions(state, els, actions);
  refreshSnapshotSelect();
  if (actions.syncControls) actions.syncControls();
}

function readSnapshotIndex() {
  try {
    const raw = localStorage.getItem(SNAP_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSnapshotIndex(names) {
  localStorage.setItem(SNAP_INDEX_KEY, JSON.stringify(names.slice(-25)));
}

function saveSnapshot(name, state) {
  const index = readSnapshotIndex();
  const next = [...new Set([...index.filter((n) => n !== name), name])];
  localStorage.setItem(`${SNAP_PREFIX}${name}`, JSON.stringify(state));
  writeSnapshotIndex(next);
}

function loadSnapshot(name) {
  try {
    const raw = localStorage.getItem(`${SNAP_PREFIX}${name}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function deleteSnapshot(name) {
  localStorage.removeItem(`${SNAP_PREFIX}${name}`);
  const next = readSnapshotIndex().filter((n) => n !== name);
  writeSnapshotIndex(next);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
