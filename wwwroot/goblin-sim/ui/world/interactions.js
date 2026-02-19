import { applyWheelZoom, panCamera, resetCamera } from "./camera.js";
import { pickCellFromCanvas } from "./mapRenderer.js";
import { TILES_PER_CHUNK, regionToMicroCenter } from "../../sim/world/scale.js";

export function bindWorldInteractions(state, els, actions) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let renderQueued = false;
  let lastHoverRegionId = state.worldMap.player.hoverRegionId || null;
  let lastHoverSiteId = state.worldMap.player.hoverSiteId || null;

  const canvas = els.mapCanvas;
  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    window.requestAnimationFrame(() => {
      renderQueued = false;
      actions.render();
    });
  }

  function disableFollowMode() {
    state.worldMap.render.followTrackedGoblin = false;
    if (els.toggleFollowMode) els.toggleFollowMode.textContent = "Free Roam";
  }

  canvas.addEventListener("mousedown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    const pick = pickCellFromCanvas(state, canvas, e.clientX, e.clientY);
    const hoverRegionId = pick?.regionId || null;
    const hoverSiteId = pick?.siteId || null;
    state.worldMap.player.hoverRegionId = hoverRegionId;
    state.worldMap.player.hoverSiteId = hoverSiteId;

    if (!dragging) {
      if (hoverRegionId !== lastHoverRegionId || hoverSiteId !== lastHoverSiteId) {
        lastHoverRegionId = hoverRegionId;
        lastHoverSiteId = hoverSiteId;
        queueRender();
      }
      return;
    }

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    disableFollowMode();
    panCamera(state.worldMap.camera, dx, dy);
    queueRender();
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    disableFollowMode();
    const rect = canvas.getBoundingClientRect();
    applyWheelZoom(state.worldMap.camera, {
      deltaY: e.deltaY,
      deltaMode: e.deltaMode,
      anchorX: e.clientX - rect.left,
      anchorY: e.clientY - rect.top
    });
    queueRender();
  }, { passive: false });

  canvas.addEventListener("click", (e) => {
    const pick = pickCellFromCanvas(state, canvas, e.clientX, e.clientY);
    if (!pick) return;
    if (pick.goblinId) {
      state.debug.selectedGoblinId = pick.goblinId;
      state.debug.trackedGoblinId = pick.goblinId;
      state.debug.selectedWildlifeId = null;
      state.debug.trackedWildlifeId = null;
      if (els.goblinDetailPanel) els.goblinDetailPanel.classList.add("open");
      actions.render();
      return;
    }
    if (pick.wildlifeId) {
      state.debug.selectedWildlifeId = pick.wildlifeId;
      state.debug.trackedWildlifeId = pick.wildlifeId;
      state.debug.selectedGoblinId = null;
      state.debug.trackedGoblinId = null;
      if (els.wildlifeDetailPanel) els.wildlifeDetailPanel.classList.add("open");
      actions.render();
      return;
    }
    state.debug.selectedWildlifeId = null;
    state.worldMap.player.selectedRegionId = pick.regionId;
    if (pick.siteId) state.worldMap.player.selectedSiteId = pick.siteId;
    actions.render();
  });

  els.resetCamera.addEventListener("click", () => {
    disableFollowMode();
    resetCamera(state.worldMap.camera);
    actions.render();
  });

  els.setStartSite.addEventListener("click", () => {
    const selected = state.worldMap.player.selectedSiteId;
    if (!selected || !state.worldMap.sitesById[selected]) return;
    const siteName = state.worldMap.sitesById[selected].name;
    const ok = window.confirm(`Set ${siteName} as the new start site and relocate goblin homes?`);
    if (!ok) return;
    const site = state.worldMap.sitesById[selected];
    state.worldMap.player.startingSiteId = selected;
    const ring = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
      { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 2, y: 0 }, { x: -2, y: 0 }
    ];
    let idx = 0;
    for (const unit of Object.values(state.worldMap.units.byGoblinId)) {
      const offset = ring[idx % ring.length];
      idx += 1;
      unit.tileX = Math.max(0, Math.min(state.worldMap.width - 1, site.x + offset.x));
      unit.tileY = Math.max(0, Math.min(state.worldMap.height - 1, site.y + offset.y));
      unit.microX = regionToMicroCenter(unit.tileX);
      unit.microY = regionToMicroCenter(unit.tileY);
      unit.posX = (unit.microX + 0.5) / TILES_PER_CHUNK;
      unit.posY = (unit.microY + 0.5) / TILES_PER_CHUNK;
      unit.homeMicroX = unit.microX;
      unit.homeMicroY = unit.microY;
      unit.homeTileX = unit.tileX;
      unit.homeTileY = unit.tileY;
      unit.homeSiteId = selected;
      unit.home = unit.home || {};
      unit.home.outpostId = "outpost-start";
      unit.home.microX = unit.homeMicroX;
      unit.home.microY = unit.homeMicroY;
      unit.home.claimedAtTick = state.meta?.tick || 0;
      unit.home.status = "resident";
      const goblin = state.goblins.byId[unit.goblinId];
      if (goblin) {
        goblin.modData = goblin.modData || {};
        goblin.modData.home = { outpostId: "outpost-start", tileX: unit.homeTileX, tileY: unit.homeTileY, siteId: selected };
      }
    }
    for (const goblinId of state.goblins.allIds) {
      if (state.goblins.byId[goblinId]) state.goblins.byId[goblinId].assignment.locationId = selected;
    }
    actions.pushEvent({
      type: "START_SITE_SELECTED",
      siteId: selected,
      text: `Start site set to ${state.worldMap.sitesById[selected].name}.`
    });
    actions.render();
  });

  if (els.minimapCanvas) {
    els.minimapCanvas.addEventListener("click", (e) => {
      const mini = els.minimapCanvas;
      const rect = mini.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const tileX = Math.max(0, Math.min(state.worldMap.width - 1, Math.floor((px / rect.width) * state.worldMap.width)));
      const tileY = Math.max(0, Math.min(state.worldMap.height - 1, Math.floor((py / rect.height) * state.worldMap.height)));
      const tilePx = 24;
      const zoom = state.worldMap.camera.zoom;
      state.worldMap.camera.x = els.mapCanvas.clientWidth * 0.5 - (tileX + 0.5) * tilePx * zoom;
      state.worldMap.camera.y = els.mapCanvas.clientHeight * 0.5 - (tileY + 0.5) * tilePx * zoom;
      disableFollowMode();
      actions.render();
    });
  }
}
