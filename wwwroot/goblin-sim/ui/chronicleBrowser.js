import { queryChronicle } from "../sim/lore/chronicleIndex.js";
import { causalityTraceForEntry } from "../sim/lore/causalityGraph.js";
import { TILES_PER_CHUNK } from "../sim/world/scale.js";

export function renderChronicleBrowser(state, mount) {
  mount.innerHTML = "";
  const filterGoblinId = state.debug.trackedGoblinId || null;
  const severityFilter = state.debug.chronicleSeverity || "all";
  const rows = queryChronicle(state, {
    search: state.debug.chronicleSearch,
    type: state.debug.chronicleType,
    goblinId: filterGoblinId
  })
    .filter((entry) => severityFilter === "all" || classifySeverity(entry) === severityFilter)
    .slice(-20)
    .reverse();

  for (const entry of rows) {
    const li = document.createElement("li");
    const isSelected = state.debug.selectedChronicleEntryId === entry.id;
    const trace = isSelected ? causalityTraceForEntry(state, entry.id, state.debug.chronicleCausalityDepth) : [];
    const causeText = isSelected && trace.length ? ` causes:${trace.length}` : "";
    const focus = resolveFocusTarget(state, entry);
    const sev = classifySeverity(entry);
    const focusAttrs = focus ? ` data-focus-x="${focus.x}" data-focus-y="${focus.y}"` : "";
    li.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr auto;gap:.35rem;align-items:center;">
        <button class="chron-row" type="button" data-entry-id="${entry.id}">[${sev.toUpperCase()}|T${entry.tick}] ${entry.text}${causeText}</button>
        <button class="chron-row" type="button" data-entry-id="${entry.id}"${focusAttrs}>Focus</button>
      </div>
    `;
    mount.appendChild(li);
  }
}

function classifySeverity(entry) {
  const t = entry?.type || "";
  const resource = entry?.details?.resource;
  if (
    t === "BARBARIAN_RAID_TARGETED" ||
    t === "BARBARIAN_RAID_NEAR_HOME" ||
    t === "BARBARIAN_DAMAGED_WALL" ||
    t === "GOBLIN_KILLED_BY_WILDLIFE" ||
    t === "GOBLIN_INJURED_BY_WILDLIFE" ||
    t === "WILDLIFE_ATTACKED_GOBLIN" ||
    t === "WILDLIFE_REPELLED_BY_GOBLINS" ||
    t === "WOLF_THREAT_NEAR_HOME" ||
    t === "NO_FIREWOOD" ||
    (t === "RESOURCE_SHORTAGE" && (resource === "water" || resource === "food"))
  ) {
    return "urgent";
  }
  if (
    t === "NEED_SPIKE" ||
    t === "WILDLIFE_KILLED_BY_GOBLINS" ||
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

  if (Number.isFinite(details.tileX) && Number.isFinite(details.tileY)) {
    return { x: details.tileX, y: details.tileY };
  }
  if (typeof details.at === "string" && details.at.includes(",")) {
    const [mx, my] = details.at.split(",").map((v) => Number(v));
    if (Number.isFinite(mx) && Number.isFinite(my)) return { x: Math.floor(mx / TILES_PER_CHUNK), y: Math.floor(my / TILES_PER_CHUNK) };
  }
  if (entry.siteId && wm.sitesById[entry.siteId]) {
    const site = wm.sitesById[entry.siteId];
    return { x: site.x, y: site.y };
  }
  if (entry.goblinId && wm.units?.byGoblinId?.[entry.goblinId]) {
    const unit = wm.units.byGoblinId[entry.goblinId];
    return { x: unit.tileX, y: unit.tileY };
  }
  return null;
}
