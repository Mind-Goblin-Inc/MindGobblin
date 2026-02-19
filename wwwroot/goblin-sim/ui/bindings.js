import { bindWorldInteractions } from "./world/interactions.js";

const SNAP_PREFIX = "goblin-sim-snapshot:";
const SNAP_INDEX_KEY = "goblin-sim-snapshot-index";
const MAX_SIMULATION_SPEED = 32;

export function bindUI(state, els, actions) {
  state.debug = state.debug || {};
  if (state.debug.resourceViewMode !== "compact" && state.debug.resourceViewMode !== "expanded") {
    state.debug.resourceViewMode = "expanded";
  }
  if (typeof state.debug.selectedResourceKey !== "string") {
    state.debug.selectedResourceKey = null;
  }
  state.meta.tuning = state.meta.tuning || {};
  state.meta.tuning.wildlife = state.meta.tuning.wildlife || {
    detectionRadiusScale: 1,
    targetCommitTicks: 20,
    retargetCooldownTicks: 6,
    breakoffTicks: 10,
    engageRange: 1.5,
    wallPenaltyScale: 1
  };
  state.meta.tuning.threat = state.meta.tuning.threat || { localRadius: 9, directRadius: 4.5 };
  state.meta.tuning.balance = state.meta.tuning.balance || {
    globalDecayMul: 1,
    hungerDecayMul: 1,
    thirstDecayMul: 1,
    restDecayMul: 0.2,
    warmthDecayMul: 1,
    foodConsumptionMul: 1,
    waterConsumptionMul: 1,
    resourceGainMul: 5,
    hungerShortageMul: 1,
    thirstShortageMul: 1,
    hungerReliefMul: 1,
    thirstReliefMul: 1,
    warmthGainMul: 1,
    warmthLossMul: 1
  };
  state.meta.tuning.climateScarcity = state.meta.tuning.climateScarcity || {
    spoilageGlobalMul: 1,
    spoilageMaxRate: 0.06,
    rationingConsumptionMul: 0.93,
    rationingLowStockDays: 3,
    rationingForecastWindowDays: 2,
    rationingModerateRisk: false
  };

  function ensureReproductionConfig() {
    state.worldMap.structures = state.worldMap.structures || {};
    if (!state.worldMap.structures.reproduction) {
      state.worldMap.structures.reproduction = {
        enabled: true,
        cooldownTicks: 120,
        pairDurationTicks: 10,
        minIdleTicks: 12,
        maxBirthsPerDay: 2,
        maxPairDistance: 6,
        safePredatorRadius: 10,
        minWallProtectionScore: 0.45,
        minWallsForSafety: 10
      };
    }
    return state.worldMap.structures.reproduction;
  }

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

  function cycleOutposts() {
    const wm = state.worldMap;
    wm.player = wm.player || {};
    const startId = wm.player.startingSiteId;
    const startSite = startId ? wm.sitesById?.[startId] : null;
    const outposts = [];
    if (startSite) {
      outposts.push({
        id: `start:${startSite.id}`,
        tileX: startSite.x,
        tileY: startSite.y,
        siteId: startSite.id,
        regionId: startSite.regionId
      });
    }

    const frontier = Object.values(wm.structures?.colonyOutpostsByTileKey || {})
      .sort((a, b) => {
        const at = Number(a?.foundedAtTick || 0);
        const bt = Number(b?.foundedAtTick || 0);
        if (at !== bt) return at - bt;
        return String(a?.key || "").localeCompare(String(b?.key || ""));
      });
    for (const o of frontier) {
      if (!Number.isFinite(o?.tileX) || !Number.isFinite(o?.tileY)) continue;
      if (startSite && o.tileX === startSite.x && o.tileY === startSite.y) continue;
      outposts.push({
        id: `outpost:${o.key}`,
        tileX: o.tileX,
        tileY: o.tileY,
        siteId: null,
        regionId: wm.regionGrid?.[o.tileY]?.[o.tileX] || null
      });
    }

    if (!outposts.length) return;
    const current = Number.isFinite(wm.player.outpostCycleIndex) ? wm.player.outpostCycleIndex : -1;
    const nextIndex = (current + 1) % outposts.length;
    wm.player.outpostCycleIndex = nextIndex;
    const target = outposts[nextIndex];
    centerCameraOnTile(target.tileX, target.tileY);
    wm.player.selectedSiteId = target.siteId || null;
    wm.player.selectedRegionId = target.regionId || wm.regionGrid?.[target.tileY]?.[target.tileX] || null;
    actions.pushEvent({
      type: "OUTPOST_FOCUSED",
      siteId: target.siteId || undefined,
      tileX: target.tileX,
      tileY: target.tileY,
      text: `Focused outpost ${nextIndex + 1}/${outposts.length} at (${target.tileX}, ${target.tileY}).`
    });
    actions.render();
  }

  function setOverlayMode(mode) {
    state.worldMap.render.overlayMode = mode;
    if (els.overlayMode) els.overlayMode.value = mode;
    actions.render();
  }

  function setSimulationSpeed(simulationSpeed) {
    state.meta.simulationSpeed = Math.max(1, Math.min(MAX_SIMULATION_SPEED, simulationSpeed));
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
  if (els.closeGoblinDetailBtn) {
    els.closeGoblinDetailBtn.addEventListener("click", () => {
      state.debug.selectedGoblinId = null;
      state.debug.trackedGoblinId = null;
      actions.render();
    });
  }
  if (els.closeWildlifeDetailBtn) {
    els.closeWildlifeDetailBtn.addEventListener("click", () => {
      state.debug.selectedWildlifeId = null;
      state.debug.trackedWildlifeId = null;
      actions.render();
    });
  }

  if (els.toggleLegend && els.legendWrap) {
    els.toggleLegend.addEventListener("click", () => {
      const open = els.legendWrap.classList.toggle("open");
      els.toggleLegend.textContent = open ? "Hide Legend" : "Show Legend";
    });
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
  if (els.simSpeed16) els.simSpeed16.addEventListener("click", () => setSimulationSpeed(16));
  if (els.simSpeed32) els.simSpeed32.addEventListener("click", () => setSimulationSpeed(32));

  if (els.resourceViewCompact) {
    els.resourceViewCompact.addEventListener("click", () => {
      state.debug.resourceViewMode = "compact";
      if (actions.syncControls) actions.syncControls();
      actions.render();
    });
  }
  if (els.resourceViewExpanded) {
    els.resourceViewExpanded.addEventListener("click", () => {
      state.debug.resourceViewMode = "expanded";
      if (actions.syncControls) actions.syncControls();
      actions.render();
    });
  }
  if (els.resourcePanel) {
    els.resourcePanel.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest("[data-resource-select]") : null;
      if (!target) return;
      const key = String(target.getAttribute("data-resource-select") || "").trim();
      if (!key) return;
      state.debug.selectedResourceKey = state.debug.selectedResourceKey === key ? null : key;
      actions.render();
    });
  }

  if (els.autoPauseEnabled) {
    els.autoPauseEnabled.addEventListener("change", () => {
      state.meta.autoPause.enabled = Boolean(els.autoPauseEnabled.checked);
    });
  }
  if (els.rolePolicyMode) {
    els.rolePolicyMode.addEventListener("change", () => {
      state.worldMap.structures = state.worldMap.structures || {};
      state.worldMap.structures.rolePolicy = state.worldMap.structures.rolePolicy || {};
      const mode = String(els.rolePolicyMode.value || "assist");
      state.worldMap.structures.rolePolicy.mode = (
        mode === "manual" || mode === "assist" || mode === "auto-balance"
      ) ? mode : "assist";
      actions.render();
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
  if (els.reproEnabled) {
    els.reproEnabled.addEventListener("change", () => {
      const cfg = ensureReproductionConfig();
      cfg.enabled = Boolean(els.reproEnabled.checked);
      actions.render();
    });
  }
  if (els.reproCooldownTicks) {
    els.reproCooldownTicks.addEventListener("change", () => {
      const cfg = ensureReproductionConfig();
      const n = Number.parseInt(els.reproCooldownTicks.value, 10);
      cfg.cooldownTicks = Number.isFinite(n) ? Math.max(10, Math.min(1000, n)) : 120;
      els.reproCooldownTicks.value = String(cfg.cooldownTicks);
      actions.render();
    });
  }
  if (els.reproPairDurationTicks) {
    els.reproPairDurationTicks.addEventListener("change", () => {
      const cfg = ensureReproductionConfig();
      const n = Number.parseInt(els.reproPairDurationTicks.value, 10);
      cfg.pairDurationTicks = Number.isFinite(n) ? Math.max(2, Math.min(120, n)) : 10;
      els.reproPairDurationTicks.value = String(cfg.pairDurationTicks);
      actions.render();
    });
  }
  if (els.reproMinIdleTicks) {
    els.reproMinIdleTicks.addEventListener("change", () => {
      const cfg = ensureReproductionConfig();
      const n = Number.parseInt(els.reproMinIdleTicks.value, 10);
      cfg.minIdleTicks = Number.isFinite(n) ? Math.max(1, Math.min(240, n)) : 12;
      els.reproMinIdleTicks.value = String(cfg.minIdleTicks);
      actions.render();
    });
  }
  if (els.reproMaxBirthsPerDay) {
    els.reproMaxBirthsPerDay.addEventListener("change", () => {
      const cfg = ensureReproductionConfig();
      const n = Number.parseInt(els.reproMaxBirthsPerDay.value, 10);
      cfg.maxBirthsPerDay = Number.isFinite(n) ? Math.max(1, Math.min(20, n)) : 2;
      els.reproMaxBirthsPerDay.value = String(cfg.maxBirthsPerDay);
      actions.render();
    });
  }
  if (els.reproSafePredatorRadius) {
    els.reproSafePredatorRadius.addEventListener("change", () => {
      const cfg = ensureReproductionConfig();
      const n = Number.parseInt(els.reproSafePredatorRadius.value, 10);
      cfg.safePredatorRadius = Number.isFinite(n) ? Math.max(2, Math.min(50, n)) : 10;
      els.reproSafePredatorRadius.value = String(cfg.safePredatorRadius);
      actions.render();
    });
  }
  if (els.reproMinWallsForSafety) {
    els.reproMinWallsForSafety.addEventListener("change", () => {
      const cfg = ensureReproductionConfig();
      const n = Number.parseInt(els.reproMinWallsForSafety.value, 10);
      cfg.minWallsForSafety = Number.isFinite(n) ? Math.max(0, Math.min(200, n)) : 10;
      els.reproMinWallsForSafety.value = String(cfg.minWallsForSafety);
      actions.render();
    });
  }
  if (els.reproMinWallProtectionScore) {
    els.reproMinWallProtectionScore.addEventListener("change", () => {
      const cfg = ensureReproductionConfig();
      const n = Number.parseFloat(els.reproMinWallProtectionScore.value);
      cfg.minWallProtectionScore = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.45;
      els.reproMinWallProtectionScore.value = String(Number(cfg.minWallProtectionScore.toFixed(2)));
      actions.render();
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
  if (els.layerEnemyOutposts) {
    els.layerEnemyOutposts.addEventListener("change", () => {
      state.worldMap.render.showLayers.enemyOutposts = Boolean(els.layerEnemyOutposts.checked);
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

  if (els.cycleOutpost) {
    els.cycleOutpost.addEventListener("click", cycleOutposts);
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
  if (els.toggleThreatOverlay) {
    els.toggleThreatOverlay.addEventListener("click", () => {
      state.worldMap.render.showThreatOverlay = state.worldMap.render.showThreatOverlay === false;
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
    const row = e.target.closest("[data-id]");
    if (!row) return;
    const id = row.dataset.id;
    state.debug.selectedGoblinId = id;
    state.debug.trackedGoblinId = id;
    state.debug.selectedWildlifeId = null;
    state.debug.trackedWildlifeId = null;
    if (els.goblinDetailPanel) els.goblinDetailPanel.classList.add("open");
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
    unit.roleState.manualLock = true;
    unit.roleState.roleAssignedTick = state.meta.tick;
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
  if (els.climateWarningList) els.climateWarningList.addEventListener("click", chronicleClick);
  if (els.enemyOutpostList) {
    els.enemyOutpostList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-enemy-focus-x][data-enemy-focus-y]");
      if (!btn) return;
      const tileX = Number(btn.dataset.enemyFocusX);
      const tileY = Number(btn.dataset.enemyFocusY);
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return;
      centerCameraOnTile(tileX, tileY);
      state.worldMap.player.selectedSiteId = null;
      state.worldMap.player.selectedRegionId = state.worldMap.regionGrid?.[tileY]?.[tileX] || null;
      actions.render();
    });
  }
  if (els.outpostOpsList) {
    const setOutpostPriority = (outpostId, nextPriority) => {
      const structures = state.worldMap?.structures;
      const outpost = structures?.outpostsById?.[outpostId];
      if (!outpost) return;
      const prevPriority = outpost.priority || "normal";
      if (prevPriority === nextPriority) return;
      outpost.priority = nextPriority;
      actions.pushEvent({
        type: "OUTPOST_PRIORITY_CHANGED",
        outpostId,
        tileX: outpost.tileX,
        tileY: outpost.tileY,
        previousPriority: prevPriority,
        priority: nextPriority,
        text: `Outpost ${outpostId} priority changed ${prevPriority} -> ${nextPriority}.`
      });
    };

    const countRoleAtOutpost = (outpostId, role) => {
      let count = 0;
      for (const unit of Object.values(state.worldMap?.units?.byGoblinId || {})) {
        if (unit?.home?.outpostId !== outpostId) continue;
        const unitRole = unit?.roleState?.role || state.goblins?.byId?.[unit.goblinId]?.social?.role || "forager";
        if (unitRole === role) count += 1;
      }
      return count;
    };

    const applyOutpostRoleBoost = (outpostId, role) => {
      state.worldMap.structures = state.worldMap.structures || {};
      state.worldMap.structures.rolePolicy = state.worldMap.structures.rolePolicy || { mode: "assist", targets: {} };
      const policy = state.worldMap.structures.rolePolicy;
      policy.targets = policy.targets || {};
      if (policy.mode === "manual") policy.mode = "assist";
      const key = `${role}Count`;
      const currentTarget = Number(policy.targets[key] || 0);
      const currentLive = countRoleAtOutpost(outpostId, role);
      const desired = Math.max(currentTarget, currentLive + 1);
      policy.targets[key] = desired;
      const outpost = state.worldMap?.structures?.outpostsById?.[outpostId];
      actions.pushEvent({
        type: "OUTPOST_RECOVERY_DIRECTIVE",
        outpostId,
        role,
        targetCount: desired,
        tileX: outpost?.tileX,
        tileY: outpost?.tileY,
        text: `Recovery directive: boost ${role} staffing for ${outpostId} (target ${desired}).`
      });
    };

    const clearOutpostBoosts = (outpostId) => {
      const policy = state.worldMap?.structures?.rolePolicy;
      if (!policy?.targets) return;
      delete policy.targets.builderCount;
      delete policy.targets.foragerCount;
      delete policy.targets["water-runnerCount"];
      const outpost = state.worldMap?.structures?.outpostsById?.[outpostId];
      actions.pushEvent({
        type: "OUTPOST_RECOVERY_DIRECTIVE_CLEARED",
        outpostId,
        tileX: outpost?.tileX,
        tileY: outpost?.tileY,
        text: `Cleared recovery role boosts for ${outpostId}.`
      });
    };

    const cancelOutpostEvacuation = (outpostId) => {
      const outpost = state.worldMap?.structures?.outpostsById?.[outpostId];
      if (!outpost || !outpost.runtime) return;
      if (outpost.runtime.status !== "evacuating") return;
      outpost.runtime.status = "failing";
      outpost.runtime.failingSinceTick = state.meta.tick;
      outpost.runtime.evacuationStartedTick = null;
      outpost.runtime.evacuationDeadlineTick = null;
      outpost.runtime.evacuationReasonCode = null;
      outpost.runtime.lastEvacuationProgressEventTick = null;
      actions.pushEvent({
        type: "OUTPOST_EVACUATION_CANCELED",
        outpostId,
        tileX: outpost.tileX,
        tileY: outpost.tileY,
        text: `Evacuation canceled for ${outpostId}; outpost returned to failing status.`
      });
    };

    els.outpostOpsList.addEventListener("click", (e) => {
      const focusBtn = e.target.closest("button[data-outpost-focus-x][data-outpost-focus-y]");
      if (focusBtn) {
        const tileX = Number(focusBtn.dataset.outpostFocusX);
        const tileY = Number(focusBtn.dataset.outpostFocusY);
        if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return;
        centerCameraOnTile(tileX, tileY);
        state.worldMap.player.selectedSiteId = null;
        state.worldMap.player.selectedRegionId = state.worldMap.regionGrid?.[tileY]?.[tileX] || null;
        actions.render();
        return;
      }

      const reinforceBtn = e.target.closest("button[data-outpost-critical-id]");
      if (reinforceBtn) {
        const outpostId = String(reinforceBtn.dataset.outpostCriticalId || "");
        if (!outpostId) return;
        setOutpostPriority(outpostId, "critical");
        actions.render();
        return;
      }

      const setPriorityBtn = e.target.closest("button[data-outpost-priority-set-id][data-outpost-priority-set]");
      if (setPriorityBtn) {
        const outpostId = String(setPriorityBtn.dataset.outpostPrioritySetId || "");
        const nextPriority = String(setPriorityBtn.dataset.outpostPrioritySet || "");
        if (!outpostId) return;
        if (nextPriority !== "normal" && nextPriority !== "frontier" && nextPriority !== "critical") return;
        setOutpostPriority(outpostId, nextPriority);
        actions.render();
        return;
      }

      const boostBtn = e.target.closest("button[data-outpost-boost-role-id][data-outpost-boost-role]");
      if (boostBtn) {
        const outpostId = String(boostBtn.dataset.outpostBoostRoleId || "");
        const role = String(boostBtn.dataset.outpostBoostRole || "");
        if (!outpostId || !role) return;
        applyOutpostRoleBoost(outpostId, role);
        actions.render();
        return;
      }

      const clearBtn = e.target.closest("button[data-outpost-clear-boosts-id]");
      if (clearBtn) {
        const outpostId = String(clearBtn.dataset.outpostClearBoostsId || "");
        if (!outpostId) return;
        clearOutpostBoosts(outpostId);
        actions.render();
        return;
      }

      const cancelEvacBtn = e.target.closest("button[data-outpost-cancel-evac-id]");
      if (cancelEvacBtn) {
        const outpostId = String(cancelEvacBtn.dataset.outpostCancelEvacId || "");
        if (!outpostId) return;
        cancelOutpostEvacuation(outpostId);
        actions.render();
      }
    });

    els.outpostOpsList.addEventListener("change", (e) => {
      const sel = e.target.closest("select[data-outpost-priority-id]");
      if (!sel) return;
      const outpostId = String(sel.dataset.outpostPriorityId || "");
      const nextPriority = String(sel.value || "normal");
      if (!outpostId) return;
      if (nextPriority !== "normal" && nextPriority !== "frontier" && nextPriority !== "critical") return;
      setOutpostPriority(outpostId, nextPriority);
      actions.render();
    });
  }

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

  const bindNumberTuning = (el, apply) => {
    if (!el) return;
    el.addEventListener("change", () => {
      const n = Number(el.value);
      if (!Number.isFinite(n)) return;
      apply(n);
      if (actions.syncControls) actions.syncControls();
      actions.render();
    });
  };
  bindNumberTuning(els.tuneDetectionScale, (n) => {
    state.meta.tuning.wildlife.detectionRadiusScale = clampNum(n, 0.5, 2.5);
  });
  bindNumberTuning(els.tuneCommitTicks, (n) => {
    state.meta.tuning.wildlife.targetCommitTicks = Math.round(clampNum(n, 4, 80));
  });
  bindNumberTuning(els.tuneBreakoffTicks, (n) => {
    state.meta.tuning.wildlife.breakoffTicks = Math.round(clampNum(n, 2, 60));
  });
  bindNumberTuning(els.tuneEngageRange, (n) => {
    state.meta.tuning.wildlife.engageRange = clampNum(n, 0.8, 4);
  });
  bindNumberTuning(els.tuneWallPenaltyScale, (n) => {
    state.meta.tuning.wildlife.wallPenaltyScale = clampNum(n, 0, 2);
  });
  bindNumberTuning(els.balGlobalDecayMul, (n) => {
    state.meta.tuning.balance.globalDecayMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balHungerDecayMul, (n) => {
    state.meta.tuning.balance.hungerDecayMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balThirstDecayMul, (n) => {
    state.meta.tuning.balance.thirstDecayMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balRestDecayMul, (n) => {
    state.meta.tuning.balance.restDecayMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balWarmthDecayMul, (n) => {
    state.meta.tuning.balance.warmthDecayMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balFoodConsumptionMul, (n) => {
    state.meta.tuning.balance.foodConsumptionMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balWaterConsumptionMul, (n) => {
    state.meta.tuning.balance.waterConsumptionMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balResourceGainMul, (n) => {
    state.meta.tuning.balance.resourceGainMul = clampNum(n, 0.1, 20);
  });
  bindNumberTuning(els.balHungerShortageMul, (n) => {
    state.meta.tuning.balance.hungerShortageMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balThirstShortageMul, (n) => {
    state.meta.tuning.balance.thirstShortageMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balHungerReliefMul, (n) => {
    state.meta.tuning.balance.hungerReliefMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balThirstReliefMul, (n) => {
    state.meta.tuning.balance.thirstReliefMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balWarmthGainMul, (n) => {
    state.meta.tuning.balance.warmthGainMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.balWarmthLossMul, (n) => {
    state.meta.tuning.balance.warmthLossMul = clampNum(n, 0.05, 5);
  });
  bindNumberTuning(els.csSpoilageGlobalMul, (n) => {
    state.meta.tuning.climateScarcity.spoilageGlobalMul = clampNum(n, 0.2, 2.5);
  });
  bindNumberTuning(els.csSpoilageMaxRate, (n) => {
    state.meta.tuning.climateScarcity.spoilageMaxRate = clampNum(n, 0.01, 0.25);
  });
  bindNumberTuning(els.csRationingConsumptionMul, (n) => {
    state.meta.tuning.climateScarcity.rationingConsumptionMul = clampNum(n, 0.7, 1);
  });
  bindNumberTuning(els.csRationingLowStockDays, (n) => {
    state.meta.tuning.climateScarcity.rationingLowStockDays = Math.round(clampNum(n, 1, 10));
  });
  bindNumberTuning(els.csRationingForecastWindowDays, (n) => {
    state.meta.tuning.climateScarcity.rationingForecastWindowDays = Math.round(clampNum(n, 1, 7));
  });
  if (els.csRationingModerateRisk) {
    els.csRationingModerateRisk.addEventListener("change", () => {
      state.meta.tuning.climateScarcity.rationingModerateRisk = Boolean(els.csRationingModerateRisk.checked);
      if (actions.syncControls) actions.syncControls();
      actions.render();
    });
  }

  const PRESETS = {
    aggressive: {
      wildlife: {
        detectionRadiusScale: 1.35,
        targetCommitTicks: 28,
        breakoffTicks: 16,
        engageRange: 1.9,
        wallPenaltyScale: 0.65
      },
      threat: { localRadius: 10, directRadius: 5 }
    },
    balanced: {
      wildlife: {
        detectionRadiusScale: 1,
        targetCommitTicks: 20,
        breakoffTicks: 10,
        engageRange: 1.5,
        wallPenaltyScale: 1
      },
      threat: { localRadius: 9, directRadius: 4.5 }
    },
    defensive: {
      wildlife: {
        detectionRadiusScale: 0.78,
        targetCommitTicks: 14,
        breakoffTicks: 7,
        engageRange: 1.2,
        wallPenaltyScale: 1.35
      },
      threat: { localRadius: 8, directRadius: 4 }
    }
  };
  const BALANCE_PRESETS = {
    relaxed: {
      globalDecayMul: 0.7,
      hungerDecayMul: 0.7,
      thirstDecayMul: 0.65,
      restDecayMul: 0.12,
      warmthDecayMul: 0.8,
      foodConsumptionMul: 0.8,
      waterConsumptionMul: 0.75,
      resourceGainMul: 5,
      hungerShortageMul: 0.7,
      thirstShortageMul: 0.65,
      hungerReliefMul: 1.2,
      thirstReliefMul: 1.2,
      warmthGainMul: 1.2,
      warmthLossMul: 0.8
    },
    standard: {
      globalDecayMul: 1,
      hungerDecayMul: 1,
      thirstDecayMul: 1,
      restDecayMul: 0.2,
      warmthDecayMul: 1,
      foodConsumptionMul: 1,
      waterConsumptionMul: 1,
      resourceGainMul: 5,
      hungerShortageMul: 1,
      thirstShortageMul: 1,
      hungerReliefMul: 1,
      thirstReliefMul: 1,
      warmthGainMul: 1,
      warmthLossMul: 1
    },
    harsh: {
      globalDecayMul: 1.25,
      hungerDecayMul: 1.25,
      thirstDecayMul: 1.3,
      restDecayMul: 0.35,
      warmthDecayMul: 1.2,
      foodConsumptionMul: 1.3,
      waterConsumptionMul: 1.35,
      resourceGainMul: 5,
      hungerShortageMul: 1.3,
      thirstShortageMul: 1.35,
      hungerReliefMul: 0.8,
      thirstReliefMul: 0.8,
      warmthGainMul: 0.8,
      warmthLossMul: 1.2
    }
  };

  function applyTuningPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    state.meta.tuning.wildlife.detectionRadiusScale = preset.wildlife.detectionRadiusScale;
    state.meta.tuning.wildlife.targetCommitTicks = preset.wildlife.targetCommitTicks;
    state.meta.tuning.wildlife.breakoffTicks = preset.wildlife.breakoffTicks;
    state.meta.tuning.wildlife.engageRange = preset.wildlife.engageRange;
    state.meta.tuning.wildlife.wallPenaltyScale = preset.wildlife.wallPenaltyScale;
    state.meta.tuning.threat.localRadius = preset.threat.localRadius;
    state.meta.tuning.threat.directRadius = preset.threat.directRadius;

    actions.pushEvent({
      type: "TUNING_PRESET_APPLIED",
      preset: presetKey,
      text: `Applied ${presetKey} wildlife threat tuning preset.`
    });
    if (actions.syncControls) actions.syncControls();
    actions.render();
  }

  if (els.tunePresetAggressive) els.tunePresetAggressive.addEventListener("click", () => applyTuningPreset("aggressive"));
  if (els.tunePresetBalanced) els.tunePresetBalanced.addEventListener("click", () => applyTuningPreset("balanced"));
  if (els.tunePresetDefensive) els.tunePresetDefensive.addEventListener("click", () => applyTuningPreset("defensive"));

  function applyBalancePreset(presetKey) {
    const preset = BALANCE_PRESETS[presetKey];
    if (!preset) return;
    Object.assign(state.meta.tuning.balance, preset);
    actions.pushEvent({
      type: "BALANCE_PRESET_APPLIED",
      preset: presetKey,
      text: `Applied ${presetKey} needs/resource balance preset.`
    });
    if (actions.syncControls) actions.syncControls();
    actions.render();
  }
  if (els.balancePresetRelaxed) els.balancePresetRelaxed.addEventListener("click", () => applyBalancePreset("relaxed"));
  if (els.balancePresetStandard) els.balancePresetStandard.addEventListener("click", () => applyBalancePreset("standard"));
  if (els.balancePresetHarsh) els.balancePresetHarsh.addEventListener("click", () => applyBalancePreset("harsh"));

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

function clampNum(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
