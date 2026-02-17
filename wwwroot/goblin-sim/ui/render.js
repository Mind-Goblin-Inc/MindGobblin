import { renderChronicleBrowser } from "./chronicleBrowser.js";
import { renderArtifactInspector, renderArtifactList } from "./artifactInspector.js";
import { causalityTraceForEntry } from "../sim/lore/causalityGraph.js";
import { buildHoverSummary, buildMapInspector, buildOverlayLegend, renderWorldMap } from "./world/mapRenderer.js";

function pct(n) {
  return `${Math.round(n)}%`;
}

export function renderApp(state, els) {
  els.tick.textContent = String(state.meta.tick);
  els.goblins.textContent = String(state.goblins.allIds.length);

  const avgMorale = avg(state.goblins.allIds.map((id) => state.goblins.byId[id].psyche.morale));
  els.avgMorale.textContent = pct(avgMorale);
  els.foodStock.textContent = String(state.tribe.resources.food || 0);
  els.waterStock.textContent = String(state.tribe.resources.water || 0);
  els.woodStock.textContent = String(state.tribe.resources.wood || 0);
  els.mushroomStock.textContent = String(state.tribe.resources.mushrooms || 0);

  const unitList = Object.values(state.worldMap?.units?.byGoblinId || {});
  const activeGoblins = unitList.filter((u) => (u.lastGoal || "idle") !== "idle").length;
  els.activeGoblins.textContent = String(activeGoblins);

  const criticalNeeds = state.goblins.allIds.reduce((count, id) => {
    const g = state.goblins.byId[id];
    if (!g) return count;
    const isCritical =
      g.needs.hunger >= 75 ||
      g.needs.thirst >= 75 ||
      g.needs.rest >= 80 ||
      g.needs.warmth >= 80 ||
      g.psyche.morale <= 25;
    return count + (isCritical ? 1 : 0);
  }, 0);
  els.criticalNeeds.textContent = String(criticalNeeds);

  renderWorld(state, els);
  const panelKey = [
    state.meta.tick,
    state.meta.paused ? 1 : 0,
    state.meta.simulationSpeed,
    state.debug.selectedGoblinId || "",
    state.debug.selectedArtifactId || "",
    state.debug.selectedChronicleEntryId || "",
    state.debug.chronicleSearch || "",
    state.debug.chronicleType || "all",
    state.debug.chronicleSeverity || "all",
    state.debug.chronicleCausalityDepth || 1,
    state.debug.inspectionDepth || 2,
    state.worldMap.player.selectedRegionId || "",
    state.worldMap.player.selectedSiteId || ""
  ].join("|");
  if (state.debug.__panelRenderKey === panelKey) return;
  state.debug.__panelRenderKey = panelKey;

  renderRoster(state, els.roster);
  renderChronicle(state, els.chronicle);
  renderProblemFeed(state, els.problemFeed);
  renderPauseSummary(state, els.pauseSummary);
  renderArtifactList(state, els.artifactList);
  renderArtifactInspector(state, els.artifactInspector);
  renderDebug(state, els.debug);
}

function renderWorld(state, els) {
  renderWorldMap(state, els.mapCanvas, els.minimapCanvas);
  const info = buildMapInspector(state);
  const inspectionDepth = state.debug.inspectionDepth || 2;
  els.mapInspector.textContent = JSON.stringify(buildInspectorView(info, inspectionDepth), null, 2);

  if (els.randomizationSummary) {
    const knobs = state.meta?.randomizationProfile?.speciesKnobs || null;
    if (!knobs) {
      els.randomizationSummary.textContent = "Variant knobs unavailable.";
    } else {
      const variantKey = [
        state.meta.randomizationProfile.variantId,
        knobs.fish.schoolTightness,
        knobs.fish.driftAmp,
        knobs.deer.fleeBias,
        knobs.deer.grazeCadence,
        knobs.wolf.huntPersistence,
        knobs.wolf.regroupBias,
        knobs.barbarian.raidBoldness,
        knobs.barbarian.retreatBias
      ].join("|");
      if (els.randomizationSummary.dataset.variantKey !== variantKey) {
        els.randomizationSummary.dataset.variantKey = variantKey;
        els.randomizationSummary.innerHTML = [
          `<strong>Variant:</strong> ${state.meta.randomizationProfile.variantId}`,
          `<strong>Fish</strong> school ${knobs.fish.schoolTightness} / drift ${knobs.fish.driftAmp}`,
          `<strong>Deer</strong> flee ${knobs.deer.fleeBias} / graze ${knobs.deer.grazeCadence}`,
          `<strong>Wolf</strong> hunt ${knobs.wolf.huntPersistence} / regroup ${knobs.wolf.regroupBias}`,
          `<strong>Barbarian</strong> bold ${knobs.barbarian.raidBoldness} / retreat ${knobs.barbarian.retreatBias}`
        ].join("<br/>");
      }
    }
  }

  els.mapHoverSummary.textContent = buildHoverSummary(state);
  const mode = state.worldMap.render.overlayMode;
  if (els.overlayLegend.dataset.mode !== mode) {
    els.overlayLegend.dataset.mode = mode;
    const legend = buildOverlayLegend(mode);
    els.overlayLegend.innerHTML = legend
      .map(
        (entry) =>
          `<div class=\"legend-row\"><span class=\"legend-swatch\" style=\"background:${entry.color}\"></span><span><strong>${entry.label}</strong> ${entry.note}</span></div>`
      )
      .join("");
  }
}

function renderRoster(state, mount) {
  mount.innerHTML = "";
  for (const id of state.goblins.allIds) {
    const g = state.goblins.byId[id];
    const unit = state.worldMap?.units?.byGoblinId?.[id];
    const role = unit?.roleState?.role || g.social?.role || "unassigned";
    const task = unit?.roleState?.roleTask?.kind || unit?.lastGoal || "idle";
    const row = document.createElement("div");
    row.className = "gob-row";
    if (state.debug.selectedGoblinId === id) row.classList.add("active");
    row.innerHTML = `
      <button type="button" class="chron-row" data-id="${id}">${g.identity.name}</button>
      <span class="tag">${g.psyche.moodState}</span>
      <span class="tag">h:${Math.round(g.needs.hunger)} t:${Math.round(g.needs.thirst)}</span>
      <span class="tag">${task} @ ${unit ? `${unit.tileX},${unit.tileY}` : "?"}</span>
      <span class="tag">role:${role}</span>
      <label class="tag">set role
        <select data-role-id="${id}">
          ${buildRoleOptions(role)}
        </select>
      </label>
    `;
    mount.appendChild(row);
  }
}

function buildRoleOptions(currentRole) {
  const roles = ["forager", "woodcutter", "builder", "lookout"];
  const normalized = roles.includes(currentRole) ? currentRole : "forager";
  return roles
    .map((role) => `<option value="${role}"${role === normalized ? " selected" : ""}>${role}</option>`)
    .join("");
}

function renderChronicle(state, mount) {
  renderChronicleBrowser(state, mount);
}

function renderPauseSummary(state, mount) {
  if (!mount) return;
  const p = state.debug.pauseSummary;
  if (!p || !p.toTick) {
    mount.textContent = "No pause summary yet.";
    return;
  }
  mount.textContent = JSON.stringify(
    {
      fromTick: p.fromTick,
      toTick: p.toTick,
      reason: p.reason,
      highlights: p.items
    },
    null,
    2
  );
}

function renderProblemFeed(state, mount) {
  if (!mount) return;
  const rows = state.chronicle.slice(-60).reverse();
  const buckets = { urgent: [], warning: [], info: [] };
  for (const entry of rows) {
    const sev = classifySeverity(entry);
    if (buckets[sev].length < 6) buckets[sev].push(entry);
  }

  mount.innerHTML = "";
  for (const key of ["urgent", "warning", "info"]) {
    const block = document.createElement("div");
    block.style.marginBottom = "0.5rem";
    const title = key[0].toUpperCase() + key.slice(1);
    const list = buckets[key];
    const items = list.length
      ? list
          .map((entry) => {
            const focus = resolveFocusTarget(state, entry);
            const focusAttrs = focus ? ` data-focus-x="${focus.x}" data-focus-y="${focus.y}"` : "";
            return `<div style="display:grid;grid-template-columns:1fr auto;gap:.35rem;margin:.2rem 0;">
              <button class="chron-row" type="button" data-entry-id="${entry.id}">[T${entry.tick}] ${entry.text}</button>
              <button class="chron-row" type="button" data-entry-id="${entry.id}"${focusAttrs}>Focus</button>
            </div>`;
          })
          .join("")
      : `<div class="muted" style="font-size:.8rem">No ${key} items.</div>`;
    block.innerHTML = `<div class="muted" style="font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">${title}</div>${items}`;
    mount.appendChild(block);
  }
}

function renderDebug(state, mount) {
  const inspectionDepth = state.debug.inspectionDepth || 2;
  const selected = state.goblins.byId[state.debug.selectedGoblinId] || null;
  const selectedChronicle = state.chronicle.find((c) => c.id === state.debug.selectedChronicleEntryId) || null;
  const trace = selectedChronicle
    ? causalityTraceForEntry(state, selectedChronicle.id, state.debug.chronicleCausalityDepth)
    : [];
  mount.textContent = JSON.stringify(buildDebugView(state, inspectionDepth, selected, selectedChronicle, trace), null, 2);
}

function avg(list) {
  if (!list.length) return 0;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function classifySeverity(entry) {
  const t = entry?.type || "";
  const resource = entry?.details?.resource;
  if (
    t === "BARBARIAN_RAID_TARGETED" ||
    t === "BARBARIAN_RAID_NEAR_HOME" ||
    t === "BARBARIAN_DAMAGED_WALL" ||
    t === "THREAT_SPOTTED" ||
    t === "WOLF_THREAT_NEAR_HOME" ||
    t === "NO_FIREWOOD" ||
    (t === "RESOURCE_SHORTAGE" && (resource === "water" || resource === "food"))
  ) {
    return "urgent";
  }
  if (
    t === "NEED_SPIKE" ||
    t === "WOLF_HUNT_STARTED" ||
    t === "BARBARIAN_STOLE_RESOURCE" ||
    t === "WALL_PLAN_REPLANNED"
  ) {
    return "warning";
  }
  return "info";
}

function resolveFocusTarget(state, entry) {
  const wm = state.worldMap;
  if (!wm || !entry) return null;
  const details = entry.details || {};
  if (Number.isFinite(details.tileX) && Number.isFinite(details.tileY)) return { x: details.tileX, y: details.tileY };
  if (entry.siteId && wm.sitesById[entry.siteId]) return { x: wm.sitesById[entry.siteId].x, y: wm.sitesById[entry.siteId].y };
  if (entry.goblinId && wm.units?.byGoblinId?.[entry.goblinId]) {
    const unit = wm.units.byGoblinId[entry.goblinId];
    return { x: unit.tileX, y: unit.tileY };
  }
  return null;
}

function buildInspectorView(info, depth) {
  if (depth >= 3) return info;
  if (depth === 1) {
    return {
      worldHash: info.worldHash,
      overlayMode: info.overlayMode,
      selectedRegion: info.selectedRegion
        ? {
            id: info.selectedRegion.id,
            biome: info.selectedRegion.biome,
            hazardPressure: info.selectedRegion.hazardPressure
          }
        : null,
      selectedSite: info.selectedSite
        ? {
            id: info.selectedSite.id,
            name: info.selectedSite.name,
            type: info.selectedSite.type
          }
        : null
    };
  }
  return {
    worldHash: info.worldHash,
    randomization: info.randomization,
    overlayMode: info.overlayMode,
    resources: info.resources,
    homes: info.homes,
    wildlife: info.wildlife,
    camera: info.camera,
    selectedRegion: info.selectedRegion,
    selectedSite: info.selectedSite,
    startCandidates: info.startCandidates
  };
}

function buildDebugView(state, depth, selected, selectedChronicle, trace) {
  if (depth === 1) {
    return {
      tick: state.meta.tick,
      paused: state.meta.paused,
      simulationSpeed: state.meta.simulationSpeed,
      warnings: state.debug.warnings.length,
      selectedGoblinId: state.debug.selectedGoblinId,
      selectedChronicleEntryId: state.debug.selectedChronicleEntryId
    };
  }
  if (depth === 2) {
    return {
      tick: state.meta.tick,
      runSeed: state.meta.seed,
      warnings: state.debug.warnings,
      lastSystemOrder: state.debug.lastSystemOrder,
      selectedGoblinSummary: selected
        ? {
            id: selected.id,
            name: selected.identity?.name,
            mood: selected.psyche?.moodState
          }
        : null,
      selectedArtifactId: state.debug.selectedArtifactId,
      selectedChronicle,
      selectedChronicleTraceDepth: trace.length,
      worldMap: {
        selectedRegionId: state.worldMap.player.selectedRegionId,
        selectedSiteId: state.worldMap.player.selectedSiteId,
        startingSiteId: state.worldMap.player.startingSiteId,
        overlayMode: state.worldMap.render.overlayMode
      }
    };
  }
  return {
    tick: state.meta.tick,
    runSeed: state.meta.seed,
    randomizationProfile: state.meta.randomizationProfile || null,
    warnings: state.debug.warnings,
    lastSystemOrder: state.debug.lastSystemOrder,
    selectedGoblin: selected,
    selectedArtifactId: state.debug.selectedArtifactId,
    selectedChronicle,
    selectedChronicleTrace: trace,
    lore: {
      artifacts: state.lore.artifacts.allIds.length,
      causalityEdges: Object.keys(state.lore.causality.edgesById).length,
      callbackTick: state.lore.callbacks.lastResolvedAtTick
    },
    worldMap: {
      hash: state.worldMap.worldHash,
      selectedRegionId: state.worldMap.player.selectedRegionId,
      selectedSiteId: state.worldMap.player.selectedSiteId,
      startingSiteId: state.worldMap.player.startingSiteId,
      overlayMode: state.worldMap.render.overlayMode
    },
    tracking: {
      trackedGoblinId: state.debug.trackedGoblinId
    }
  };
}
