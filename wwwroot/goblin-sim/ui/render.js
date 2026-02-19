import { renderChronicleBrowser } from "./chronicleBrowser.js";
import { renderArtifactInspector, renderArtifactList } from "./artifactInspector.js";
import { causalityTraceForEntry } from "../sim/lore/causalityGraph.js";
import { buildHoverSummary, buildMapInspector, buildOverlayLegend, renderWorldMap } from "./world/mapRenderer.js";
import { TILES_PER_CHUNK } from "../sim/world/scale.js";

const RESOURCE_CATEGORY_ORDER = ["survival", "industry", "defense", "strategic"];
const RESOURCE_CATEGORY_LABELS = {
  survival: "Survival",
  industry: "Industry",
  defense: "Defense",
  strategic: "Strategic"
};
const RESOURCE_CATEGORY_BY_KEY = {
  food: "survival",
  water: "survival",
  mushrooms: "survival",
  wood: "survival",
  herbs: "survival",
  fiber: "industry",
  rope: "industry",
  wood_planks: "industry",
  charcoal: "industry",
  fuel: "industry",
  metal_ore: "industry",
  metal_parts: "industry",
  ammo_bolts: "defense",
  springs: "defense",
  ore: "strategic",
  lore: "strategic"
};

function pct(n) {
  return `${Math.round(n)}%`;
}

function capitalize(text) {
  const t = String(text || "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

export function renderApp(state, els) {
  els.tick.textContent = String(state.meta.tick);
  const season = state.world?.season || {};
  const weather = state.world?.weather || {};
  if (els.seasonNow) {
    const s = String(season.key || "spring");
    const dayOfSeason = Number(season.dayOfSeason || 1);
    const daysPerSeason = Number(season.daysPerSeason || 18);
    const year = Number(season.year || 1);
    els.seasonNow.textContent = `${capitalize(s)} Day ${dayOfSeason}/${daysPerSeason} · Year ${year}`;
  }
  if (els.weatherNow) {
    const w = String(weather.current || weather.type || "clear");
    const intensity = Math.round(Number(weather.intensity || 0) * 100);
    els.weatherNow.textContent = `${w} (${intensity}%)`;
  }
  if (els.forecastNow) {
    const next = (state.world?.forecast?.next7Days || []).slice(0, 3);
    if (!next.length) {
      els.forecastNow.textContent = "Forecast: pending...";
    } else {
      const text = next
        .map((d) => `D+${d.dayOffset} ${d.likelyWeather} ${d.risk}`)
        .join(" | ");
      els.forecastNow.textContent = `Forecast: ${text}`;
    }
  }

  const livingGoblinIds = state.goblins.allIds.filter((id) => {
    const g = state.goblins.byId[id];
    return g && g.flags?.alive && !g.flags?.missing;
  });
  els.goblins.textContent = String(livingGoblinIds.length);

  const avgMorale = avg(livingGoblinIds.map((id) => state.goblins.byId[id].psyche.morale));
  els.avgMorale.textContent = pct(avgMorale);
  els.foodStock.textContent = String(state.tribe.resources.food || 0);
  els.waterStock.textContent = String(state.tribe.resources.water || 0);
  els.woodStock.textContent = String(state.tribe.resources.wood || 0);
  els.mushroomStock.textContent = String(state.tribe.resources.mushrooms || 0);
  renderResourcePanel(state, els.resourcePanel);

  const unitList = Object.values(state.worldMap?.units?.byGoblinId || {});
  const activeGoblins = unitList.filter((u) => (u.lastGoal || "idle") !== "idle").length;
  els.activeGoblins.textContent = String(activeGoblins);
  const outpostCount = Object.keys(state.worldMap?.structures?.colonyOutpostsByTileKey || {}).length;
  if (els.outpostCount) els.outpostCount.textContent = String(outpostCount);
  renderRoleDistribution(state, els);
  renderProcessingOps(state, els);
  renderEnemyIntel(state, els);
  renderClimateWarnings(state, els);
  renderOutpostCommand(state, els);
  renderBuildables(state, els);

  const criticalBreakdown = summarizeCriticalNeeds(state, livingGoblinIds);
  const criticalNeeds = criticalBreakdown.criticalGoblinCount;
  els.criticalNeeds.textContent = String(criticalNeeds);
  const criticalDetailsEl = els.criticalNeedsDetails || document.getElementById("criticalNeedsDetails");
  if (criticalDetailsEl) criticalDetailsEl.textContent = criticalBreakdown.text;
  renderManagementIndicators(state, els.managementIndicators, livingGoblinIds);
  renderGoblinDetailPanel(state, els);
  renderWildlifeDetailPanel(state, els);

  renderWorld(state, els);
  const panelTickBucket = Math.floor(state.meta.tick / 4);
  const panelKey = [
    panelTickBucket,
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
    state.worldMap.player.selectedSiteId || "",
    processingPanelKey(state),
    outpostPanelKey(state),
    governancePanelKey(state)
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

function renderResourcePanel(state, mount) {
  if (!mount) return;
  const mode = state.debug?.resourceViewMode === "compact" ? "compact" : "expanded";
  const resourcePurposes = state.tribe?.resourcePurposes || {};
  const resources = state.tribe?.resources || {};
  const telemetry = state.worldMap?.structures?.resourceTelemetry || {};
  const netDeltaByResource = telemetry.netDeltaByResource || {};
  const etaToZeroByResource = telemetry.etaToZeroByResource || {};
  const allKeys = Object.keys(resourcePurposes).length
    ? Object.keys(resourcePurposes)
    : Object.keys(resources);

  const categories = {};
  for (const category of RESOURCE_CATEGORY_ORDER) categories[category] = [];
  for (const key of allKeys) {
    const category = RESOURCE_CATEGORY_BY_KEY[key] || "strategic";
    categories[category].push(key);
  }
  for (const category of RESOURCE_CATEGORY_ORDER) {
    categories[category].sort((a, b) => a.localeCompare(b));
  }

  const compactKeys = ["food", "water", "wood", "mushrooms", "metal_ore", "metal_parts", "ammo_bolts", "springs"];
  const categoryList = mode === "compact"
    ? [{ key: "survival", title: "Core", keys: compactKeys.filter((k) => allKeys.includes(k) || Object.prototype.hasOwnProperty.call(resources, k)) }]
    : RESOURCE_CATEGORY_ORDER.map((category) => ({
        key: category,
        title: RESOURCE_CATEGORY_LABELS[category] || category,
        keys: categories[category]
      }));

  mount.innerHTML = categoryList
    .filter((cat) => cat.keys.length > 0)
    .map((cat) => {
      const rows = cat.keys
        .map((key) => {
          const value = Number(resources[key] || 0);
          const purpose = resourcePurposes[key] || "";
          const delta = Number(netDeltaByResource[key] || 0);
          const eta = etaToZeroByResource[key];
          const trend = delta > 0.2 ? "up" : (delta < -0.2 ? "down" : "flat");
          const trendArrow = trend === "up" ? "↑" : (trend === "down" ? "↓" : "→");
          const trendColor = trend === "up" ? "hsl(142 60% 52%)" : (trend === "down" ? "hsl(6 72% 58%)" : "hsl(210 14% 74%)");
          const etaText = Number.isFinite(eta) ? `${Math.max(0, Math.round(Number(eta || 0)))}t` : "--";
          const deltaText = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`;
          return `
            <div class="role-row" style="grid-template-columns:96px 1fr 124px" title="${escapeHtml(purpose)}">
              <div class="role-label">${escapeHtml(key)}</div>
              <div class="role-bar-wrap"><div class="role-bar" style="width:${Math.max(4, Math.min(100, value))}%;background:hsl(160 55% 44%);"></div></div>
              <div class="role-value" style="display:flex;align-items:center;justify-content:flex-end;gap:.3rem">
                <span style="color:${trendColor};font-weight:700">${trendArrow}</span>
                <span>${Math.round(value)}</span>
                <span class="tiny" title="net:${deltaText} / eta:${etaText}" style="opacity:.85">${escapeHtml(etaText)}</span>
              </div>
            </div>
          `;
        })
        .join("");
      return `
        <div style="border:1px solid rgba(255,255,255,.09);border-radius:8px;padding:.4rem .45rem;background:rgba(10,16,22,.6)">
          <div class="muted" style="font-size:.72rem;letter-spacing:.05em;text-transform:uppercase;margin-bottom:.25rem">${escapeHtml(cat.title)}</div>
          ${rows}
        </div>
      `;
    })
    .join("");
}

function outpostPanelKey(state) {
  const outposts = Object.values(state.worldMap?.structures?.outpostsById || {})
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((o) => `${o.id}:${o.priority || "normal"}:${o.runtime?.status || "seeded"}:${o.runtime?.population || 0}:${o.runtime?.targetPopulation || 0}`);
  return outposts.join(";");
}

function governancePanelKey(state) {
  const gov = state.tribe?.governance || {};
  const rec = gov.recommendations || {};
  const leaderId = gov.leaderGoblinId || "";
  const generatedTick = Number(rec.generatedTick || -1);
  const expansion = rec.expansion?.allowed === false ? "0" : "1";
  const reason = rec.expansion?.reasonCode || "";
  const reserve = rec.reserveFloors || {};
  return [
    leaderId,
    generatedTick,
    expansion,
    reason,
    reserve.ammo_bolts || 0,
    reserve.metal_parts || 0,
    reserve.springs || 0,
    reserve.wood_planks || 0
  ].join(":");
}

function processingPanelKey(state) {
  const processing = state.worldMap?.structures?.processing;
  const queue = (processing?.queueIds || []).length;
  const active = (processing?.queueIds || []).reduce((n, id) => n + ((processing?.tasksById?.[id]?.status === "active") ? 1 : 0), 0);
  const blocked = (state.chronicle || []).reduce((n, e) => n + (e?.type === "ROLE_TASK_BLOCKED" || e?.type === "RECIPE_BLOCKED" ? 1 : 0), 0);
  return `${queue}:${active}:${blocked}`;
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

function renderEnemyIntel(state, els) {
  const mount = els.enemyIntelChart;
  const summary = els.enemyIntelSummary;
  const outpostSummary = els.enemyOutpostSummary;
  const outpostList = els.enemyOutpostList;
  if (!mount) return;

  const hostileKinds = ["wolf", "barbarian", "human_raider", "elf_ranger", "shaman", "ogre"];
  const labels = {
    wolf: "Wolves",
    barbarian: "Barbarians",
    human_raider: "Raiders",
    elf_ranger: "Rangers",
    shaman: "Shamans",
    ogre: "Ogres"
  };
  const hostile = Object.fromEntries(hostileKinds.map((k) => [k, 0]));
  let total = 0;
  for (const id of state.worldMap?.wildlife?.allIds || []) {
    const creature = state.worldMap?.wildlife?.byId?.[id];
    if (!creature || !creature.alive || !hostileKinds.includes(creature.kind)) continue;
    hostile[creature.kind] += 1;
    total += 1;
  }

  const rows = Object.entries(hostile)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    mount.innerHTML = `<div class="muted">No active hostile units detected.</div>`;
  } else {
    mount.innerHTML = rows
      .map(([kind, count], idx) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        const hue = (idx * 31 + 6) % 360;
        return `<div class="role-row">
          <div class="role-label">${escapeHtml(labels[kind] || kind)}</div>
          <div class="role-bar-wrap"><div class="role-bar" style="width:${pct.toFixed(1)}%;background:hsl(${hue} 64% 48%);"></div></div>
          <div class="role-value">${count}</div>
        </div>`;
      })
      .join("");
  }

  if (summary) {
    const top = rows[0];
    summary.textContent = top
      ? `${total} active hostiles. Primary threat: ${labels[top[0]] || top[0]} (${top[1]}).`
      : "No active hostile units detected.";
  }

  if (outpostSummary) {
    const structures = state.worldMap?.structures || {};
    const explicitOutposts = Object.values(structures.enemyOutpostsByTileKey || {});
    const byKind = {};
    const entries = [];
    for (const outpost of explicitOutposts) {
      const kind = String(outpost?.kind || outpost?.type || "warcamp");
      byKind[kind] = (byKind[kind] || 0) + 1;
      if (Number.isFinite(outpost?.tileX) && Number.isFinite(outpost?.tileY)) {
        entries.push({
          kind,
          tileX: outpost.tileX,
          tileY: outpost.tileY
        });
      } else if (Number.isFinite(outpost?.microX) && Number.isFinite(outpost?.microY)) {
        entries.push({
          kind,
          tileX: Math.floor(outpost.microX / TILES_PER_CHUNK),
          tileY: Math.floor(outpost.microY / TILES_PER_CHUNK)
        });
      }
    }
    if (!explicitOutposts.length) {
      const packs = Object.values(state.worldMap?.wildlife?.packsById || {}).filter(
        (pack) => pack?.kind === "barbarian-band" || pack?.kind === "wolf-pack"
      );
      if (!packs.length) {
        outpostSummary.textContent = "Outposts: none tracked.";
        if (outpostList) outpostList.innerHTML = `<div class="muted">No known enemy outposts.</div>`;
      } else {
        outpostSummary.textContent = `Outposts: ${packs.length} mobile lair markers (${packs.map((p) => p.kind).join(", ")}).`;
        if (outpostList) {
          const packEntries = packs
            .map((pack) => {
              const leader = pack?.leaderId ? state.worldMap?.wildlife?.byId?.[pack.leaderId] : null;
              if (!leader) return null;
              const tileX = Number.isFinite(leader.tileX) ? leader.tileX : Math.floor((leader.microX || 0) / TILES_PER_CHUNK);
              const tileY = Number.isFinite(leader.tileY) ? leader.tileY : Math.floor((leader.microY || 0) / TILES_PER_CHUNK);
              return { kind: pack.kind, tileX, tileY };
            })
            .filter(Boolean)
            .slice(0, 12);
          outpostList.innerHTML = packEntries.length
            ? packEntries
                .map(
                  (entry, idx) =>
                    `<button type="button" class="chron-row" data-enemy-focus-x="${entry.tileX}" data-enemy-focus-y="${entry.tileY}">
                      ${idx + 1}. ${escapeHtml(entry.kind)} @ ${entry.tileX},${entry.tileY}
                    </button>`
                )
                .join("")
            : `<div class="muted">No known enemy outposts.</div>`;
        }
      }
      return;
    }
    const list = Object.entries(byKind)
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => `${kind} ${count}`)
      .join(", ");
    outpostSummary.textContent = `Outposts: ${explicitOutposts.length} (${list}).`;
    if (outpostList) {
      outpostList.innerHTML = entries.length
        ? entries
            .slice(0, 16)
            .map(
              (entry, idx) =>
                `<button type="button" class="chron-row" data-enemy-focus-x="${entry.tileX}" data-enemy-focus-y="${entry.tileY}">
                  ${idx + 1}. ${escapeHtml(entry.kind)} @ ${entry.tileX},${entry.tileY}
                </button>`
            )
            .join("")
        : `<div class="muted">No focusable outposts yet.</div>`;
    }
  }
}

function renderClimateWarnings(state, els) {
  const summary = els.climateWarningSummary;
  const list = els.climateWarningList;
  if (!summary || !list) return;
  const rows = (state.chronicle || [])
    .slice(-120)
    .filter((entry) => entry?.type === "WEATHER_WARNING" || entry?.type === "ROUTE_DISRUPTION_RISK")
    .slice(-8)
    .reverse();
  if (!rows.length) {
    summary.textContent = "No active climate warnings.";
    list.innerHTML = `<div class="muted">No weather or route warnings.</div>`;
    return;
  }
  const highCount = rows.filter((r) => String(r?.details?.severity || r?.details?.risk || "low") === "high").length;
  summary.textContent = `${rows.length} recent climate warnings (${highCount} high).`;
  list.innerHTML = rows
    .map((entry) => {
      const focus = resolveFocusTarget(state, entry);
      const focusAttrs = focus ? ` data-focus-x="${focus.x}" data-focus-y="${focus.y}"` : "";
      const sev = classifySeverity(entry).toUpperCase();
      const label = entry.type === "ROUTE_DISRUPTION_RISK"
        ? `${entry.details?.routeId || "route"} ${entry.details?.severity || ""}`
        : `${entry.details?.weather || "weather"} in ${entry.details?.etaDays || "?"}d`;
      return `<button class="chron-row" type="button" data-entry-id="${entry.id}"${focusAttrs}>[${sev}] ${escapeHtml(label)} - ${escapeHtml(entry.text || entry.type)}</button>`;
    })
    .join("");
}

function renderOutpostCommand(state, els) {
  const summaryEl = els.outpostOpsSummary;
  const listEl = els.outpostOpsList;
  if (!summaryEl || !listEl) return;
  const gov = state.tribe?.governance || {};
  const leaderId = gov.leaderGoblinId || null;
  const leader = leaderId ? state.goblins.byId?.[leaderId] || null : null;
  const leaderScore = Number(gov.leadershipScoreByGoblinId?.[leaderId] || 0);
  const rec = gov.recommendations || {};
  const policy = gov.policy || {};

  const outposts = Object.values(state.worldMap?.structures?.outpostsById || {})
    .sort((a, b) => {
      const ar = priorityRank(a.priority);
      const br = priorityRank(b.priority);
      return (br - ar)
        || ((b.runtime?.populationDeficit || 0) - (a.runtime?.populationDeficit || 0))
        || String(a.id).localeCompare(String(b.id));
    });

  if (!outposts.length) {
    summaryEl.textContent = leader
      ? `Leader ${leader.identity?.name || leader.id} | profile ${policy.responseProfile || "balanced"} | no known outposts.`
      : "No known outposts.";
    listEl.innerHTML = `${buildLeaderGovernanceCard(state)}<div class="muted">Outpost registry unavailable.</div>`;
    return;
  }

  const failing = outposts.filter((o) => (o.runtime?.status || "seeded") === "failing").length;
  const evacuating = outposts.filter((o) => (o.runtime?.status || "seeded") === "evacuating").length;
  const critical = outposts.filter((o) => (o.priority || "normal") === "critical").length;
  const totalDeficit = outposts.reduce((sum, o) => sum + (o.runtime?.populationDeficit || 0), 0);
  summaryEl.textContent = leader
    ? `${leader.identity?.name || leader.id} (score ${Math.round(leaderScore)}) | ${outposts.length} outposts | failing ${failing} | evacuating ${evacuating} | critical ${critical} | total pop deficit ${totalDeficit}`
    : `${outposts.length} outposts | failing ${failing} | evacuating ${evacuating} | critical ${critical} | total pop deficit ${totalDeficit}`;

  listEl.innerHTML = `${buildLeaderGovernanceCard(state)}${outposts
    .map((o) => {
      const pop = o.runtime?.population || 0;
      const target = o.runtime?.targetPopulation || 0;
      const deficit = o.runtime?.populationDeficit || 0;
      const status = o.runtime?.status || "seeded";
      const priority = o.priority || "normal";
      const unstableTicks = Number.isFinite(o.runtime?.unstableSinceTick) ? Math.max(0, state.meta.tick - o.runtime.unstableSinceTick) : 0;
      const evacDeadline = Number.isFinite(o.runtime?.evacuationDeadlineTick)
        ? Math.max(0, o.runtime.evacuationDeadlineTick - state.meta.tick)
        : null;
      const deficits = o.runtime?.deficitByRole || {};
      const roleDefLine = [
        `builder:${Math.max(0, deficits.builder || 0)}`,
        `forager:${Math.max(0, deficits.forager || 0)}`,
        `water:${Math.max(0, deficits["water-runner"] || 0)}`,
        `sentinel:${Math.max(0, deficits.sentinel || 0)}`
      ].join(" ");
      const recs = recommendOutpostActions(o);
      const govPosture = rec?.outpostPostureById?.[o.id] || "hold";
      const recButtons = recs.length
        ? recs.map((rec) => {
            if (rec.kind === "set-priority") {
              return `<button type="button" class="chron-row" data-outpost-priority-set-id="${escapeHtml(o.id)}" data-outpost-priority-set="${escapeHtml(rec.value)}">${escapeHtml(rec.label)}</button>`;
            }
            if (rec.kind === "boost-role") {
              return `<button type="button" class="chron-row" data-outpost-boost-role-id="${escapeHtml(o.id)}" data-outpost-boost-role="${escapeHtml(rec.role)}">${escapeHtml(rec.label)}</button>`;
            }
            return `<span class="tag">${escapeHtml(rec.label)}</span>`;
          }).join("")
        : `<span class="tag">No urgent actions.</span>`;

      return `<div class="card" style="padding:.5rem;gap:.4rem">
        <div class="panel-grid-3">
          <button type="button" class="chron-row" data-outpost-focus-x="${o.tileX}" data-outpost-focus-y="${o.tileY}">
            ${escapeHtml(o.id)}
          </button>
          <span class="tag">kind:${escapeHtml(o.kind || "unknown")} status:${escapeHtml(status)}</span>
          <span class="tag">pop:${pop}/${target} (d${deficit})</span>
        </div>
        <div class="panel-grid-3">
          <span class="tag">priority:${escapeHtml(priority)}</span>
          <span class="tag">leader:${escapeHtml(govPosture)}</span>
          <span class="tag">unstable:${unstableTicks} ticks</span>
          <span class="tag">${escapeHtml(roleDefLine)}</span>
        </div>
        <div class="panel-grid-3">
          <span class="tag">evac:${status === "evacuating" ? "active" : (status === "abandoned" ? "abandoned" : "none")}</span>
          <span class="tag">deadline:${status === "evacuating" ? `${evacDeadline ?? 0} ticks` : "-"}</span>
          <span class="tag">residents:${pop}</span>
        </div>
        <div class="panel-grid-3">
          <label class="tag">priority
            <select data-outpost-priority-id="${escapeHtml(o.id)}">
              ${buildOutpostPriorityOptions(priority)}
            </select>
          </label>
          <button type="button" class="chron-row" data-outpost-critical-id="${escapeHtml(o.id)}">Reinforce</button>
          <button type="button" class="chron-row" data-outpost-clear-boosts-id="${escapeHtml(o.id)}">Clear Boosts</button>
          ${status === "evacuating" ? `<button type="button" class="chron-row" data-outpost-cancel-evac-id="${escapeHtml(o.id)}">Cancel Evac</button>` : ""}
        </div>
        <div class="role-chart">${recButtons}</div>
      </div>`;
    })
    .join("")}`;
}

function buildLeaderGovernanceCard(state) {
  const gov = state.tribe?.governance || {};
  const leaderId = gov.leaderGoblinId || null;
  const leader = leaderId ? state.goblins.byId?.[leaderId] || null : null;
  const score = Number(gov.leadershipScoreByGoblinId?.[leaderId] || 0);
  const rec = gov.recommendations || {};
  const policy = gov.policy || {};
  const reserve = rec.reserveFloors || {};
  const expansion = rec.expansion || {};
  const profile = gov.runtime?.priorityProfile || {};
  const learning = gov.learning || {};

  if (!leader) {
    return `<div class="card" style="padding:.5rem;gap:.35rem">
      <strong>Leader Governance</strong>
      <div class="muted">No active leader elected.</div>
    </div>`;
  }

  const social = Number(leader.coreStats?.social || 0);
  const will = Number(leader.coreStats?.will || 0);
  const cunning = Number(leader.coreStats?.cunning || 0);
  const bargaining = Number(leader.aptitudes?.bargaining || 0);
  const scouting = Number(leader.aptitudes?.scouting || 0);
  const aggression = Number(leader.traits?.personality?.aggression || 0);
  const discipline = Number(leader.traits?.personality?.discipline || 0);
  const confidence = Number(learning.confidence ?? 0.5);
  const trend = String(learning.confidenceTrend || "stable");
  const weights = learning.domainWeights || {};
  const topWeights = Object.entries(weights)
    .map(([k, v]) => ({ key: k, value: Number(v || 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const weight1 = topWeights[0] || { key: "food", value: 0 };
  const weight2 = topWeights[1] || { key: "water", value: 0 };
  const weight3 = topWeights[2] || { key: "defense", value: 0 };
  const lesson = String(learning.lastLesson || "No episodes yet.");
  const learningTick = Number(learning.lastLearningTick ?? -1);

  return `<div class="card" style="padding:.5rem;gap:.4rem">
    <div class="panel-grid-3">
      <strong>Leader</strong>
      <span class="tag">${escapeHtml(leader.identity?.name || leader.id)}</span>
      <span class="tag">score:${Math.round(score)}</span>
    </div>
    <div class="panel-grid-3">
      <span class="tag">social:${social}</span>
      <span class="tag">will:${will}</span>
      <span class="tag">cunning:${cunning}</span>
      <span class="tag">bargain:${bargaining}</span>
      <span class="tag">scout:${scouting}</span>
      <span class="tag">discipline:${discipline}</span>
      <span class="tag">aggression:${aggression}</span>
      <span class="tag">profile:${escapeHtml(policy.responseProfile || "balanced")}</span>
      <span class="tag">expansion:${expansion.allowed === false ? "hold" : "go"} (${escapeHtml(expansion.reasonCode || "STABLE")})</span>
    </div>
    <div class="panel-grid-3">
      <span class="tag">reserves ammo:${reserve.ammo_bolts ?? "-"}</span>
      <span class="tag">parts:${reserve.metal_parts ?? "-"}</span>
      <span class="tag">springs:${reserve.springs ?? "-"}</span>
      <span class="tag">planks:${reserve.wood_planks ?? "-"}</span>
      <span class="tag">rec tick:${Number(rec.generatedTick ?? -1)}</span>
    </div>
    <div class="panel-grid-3">
      <span class="tag">prio survival:${Number(profile.survival ?? 20).toFixed(1)}</span>
      <span class="tag">defense:${Number(profile.defense ?? 20).toFixed(1)}</span>
      <span class="tag">expansion:${Number(profile.expansion ?? 20).toFixed(1)}</span>
      <span class="tag">logistics:${Number(profile.logistics ?? 20).toFixed(1)}</span>
      <span class="tag">diplomacy:${Number(profile.diplomacy ?? 20).toFixed(1)}</span>
    </div>
    <div class="panel-grid-3">
      <span class="tag">confidence:${confidence.toFixed(2)}</span>
      <span class="tag">trend:${escapeHtml(trend)}</span>
      <span class="tag">learn tick:${learningTick}</span>
      <span class="tag">w1 ${escapeHtml(weight1.key)}:${weight1.value.toFixed(2)}</span>
      <span class="tag">w2 ${escapeHtml(weight2.key)}:${weight2.value.toFixed(2)}</span>
      <span class="tag">w3 ${escapeHtml(weight3.key)}:${weight3.value.toFixed(2)}</span>
    </div>
    <div class="muted" title="${escapeHtml(lesson)}">lesson: ${escapeHtml(lesson)}</div>
  </div>`;
}

function recommendOutpostActions(outpost) {
  const recs = [];
  const status = outpost?.runtime?.status || "seeded";
  const priority = outpost?.priority || "normal";
  const deficit = outpost?.runtime?.populationDeficit || 0;
  const roleDef = outpost?.runtime?.deficitByRole || {};

  if ((status === "failing" || deficit > 0) && priority !== "critical") {
    recs.push({ kind: "set-priority", value: "critical", label: "Set Critical Priority" });
  }
  if (status === "evacuating") recs.push({ kind: "action", label: "Evacuation active: prioritize migration and avoid new build commitments." });
  if (status === "abandoned") recs.push({ kind: "action", label: "Outpost abandoned. Re-establish later with colony-establisher role." });
  if ((roleDef.builder || 0) > 0) recs.push({ kind: "boost-role", role: "builder", label: "Boost Builders" });
  if ((roleDef.forager || 0) > 0) recs.push({ kind: "boost-role", role: "forager", label: "Boost Foragers" });
  if ((roleDef["water-runner"] || 0) > 0) recs.push({ kind: "boost-role", role: "water-runner", label: "Boost Water Runners" });
  if (status === "stable" && priority === "critical") recs.push({ kind: "set-priority", value: "frontier", label: "Normalize Priority" });

  return recs.slice(0, 4);
}

function buildOutpostPriorityOptions(selected) {
  const opts = ["normal", "frontier", "critical"];
  return opts
    .map((value) => `<option value="${value}"${value === selected ? " selected" : ""}>${value}</option>`)
    .join("");
}

function priorityRank(priority) {
  if (priority === "critical") return 3;
  if (priority === "frontier") return 2;
  return 1;
}

function renderBuildables(state, els) {
  const summaryEl = els.buildablesSummary;
  const listEl = els.buildablesList;
  if (!summaryEl || !listEl) return;

  const structures = state.worldMap?.structures || {};
  const wallsBuilt = Object.keys(structures.wallsByTileKey || {}).length;
  const villageHomes = Object.values(structures.villageHomesByTileKey || {}).length;
  const outposts = Object.values(structures.outpostsById || {});
  const activeOutposts = outposts.filter((o) => (o?.runtime?.status || "seeded") !== "abandoned").length;
  const abandonedOutposts = outposts.filter((o) => (o?.runtime?.status || "seeded") === "abandoned").length;
  const plansBySite = Object.values(structures.wallPlansBySiteId || {});
  const planPending = plansBySite.reduce((n, p) => n + (p?.orderedTileKeys?.filter((k) => p.tileStatusByKey?.[k] === "planned").length || 0), 0);
  const planBlocked = plansBySite.reduce((n, p) => n + (p?.orderedTileKeys?.filter((k) => p.tileStatusByKey?.[k] === "blocked").length || 0), 0);

  const defenses = Object.values(structures.automatedDefensesByTileKey || {});
  const defenseCountsByKind = {};
  const defenseStatusCounts = {};
  let defenseDurabilityTotal = 0;
  let defenseDurabilityMaxTotal = 0;
  let defenseNeedsMaintenance = 0;
  let springAmmo = 0;
  let springAmmoMax = 0;
  for (const defense of defenses) {
    const kind = String(defense?.kind || "unknown");
    const status = String(defense?.status || "unknown");
    defenseCountsByKind[kind] = (defenseCountsByKind[kind] || 0) + 1;
    defenseStatusCounts[status] = (defenseStatusCounts[status] || 0) + 1;
    const d = Number(defense?.durability || 0);
    const dm = Number(defense?.maxDurability || 0);
    if (Number.isFinite(d) && Number.isFinite(dm) && dm > 0) {
      defenseDurabilityTotal += d;
      defenseDurabilityMaxTotal += dm;
    }
    if (defense?.maintenanceNeeded) defenseNeedsMaintenance += 1;
    if (kind === "spring_turret") {
      springAmmo += Number(defense?.ammo || 0);
      springAmmoMax += Number(defense?.maxAmmo || 0);
    }
  }
  const defenseDurabilityPct = defenseDurabilityMaxTotal > 0 ? Math.round((defenseDurabilityTotal / defenseDurabilityMaxTotal) * 100) : null;
  const ammoPct = springAmmoMax > 0 ? Math.round((springAmmo / springAmmoMax) * 100) : null;

  summaryEl.textContent = [
    `walls ${wallsBuilt}`,
    `homes ${villageHomes}`,
    `outposts ${activeOutposts}${abandonedOutposts > 0 ? ` (+${abandonedOutposts} abandoned)` : ""}`,
    `defenses ${defenses.length}`
  ].join(" | ");

  const kindRows = Object.entries(defenseCountsByKind)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => `<span class="tag">${escapeHtml(kind)}:${count}</span>`)
    .join(" ");
  const statusRows = Object.entries(defenseStatusCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => `<span class="tag">${escapeHtml(status)}:${count}</span>`)
    .join(" ");

  listEl.innerHTML = `
    <div class="panel-grid-3">
      <span class="tag">wall plans:${plansBySite.length}</span>
      <span class="tag">pending walls:${planPending}</span>
      <span class="tag">blocked walls:${planBlocked}</span>
    </div>
    <div class="panel-grid-3">
      <span class="tag">defense durability:${defenseDurabilityPct === null ? "-" : `${defenseDurabilityPct}%`}</span>
      <span class="tag">maintenance:${defenseNeedsMaintenance}</span>
      <span class="tag">turret ammo:${ammoPct === null ? "-" : `${ammoPct}%`}</span>
    </div>
    <div class="role-chart">
      <div class="tiny">Defense kinds</div>
      <div>${kindRows || '<span class="tag">none</span>'}</div>
    </div>
    <div class="role-chart">
      <div class="tiny">Defense status</div>
      <div>${statusRows || '<span class="tag">none</span>'}</div>
    </div>
  `;
}

function renderRoleDistribution(state, els) {
  const mount = els.roleDistributionChart;
  const summary = els.roleDistributionSummary;
  if (!mount) return;
  const roles = [
    "forager", "woodcutter", "fisherman", "hunter", "builder", "homebuilder", "sentinel", "lookout",
    "hauler", "water-runner", "caretaker", "quartermaster", "scout", "colony-establisher", "reproducer",
    "miner", "fiber-harvester", "herbalist", "smelter", "rope-maker", "carpenter", "charcoal-burner", "fletcher", "mechanist"
  ];
  const counts = Object.fromEntries(roles.map((r) => [r, 0]));
  let total = 0;
  for (const goblinId of state.goblins.allIds) {
    const goblin = state.goblins.byId[goblinId];
    if (!goblin || !goblin.flags?.alive || goblin.flags?.missing) continue;
    const role = state.worldMap?.units?.byGoblinId?.[goblinId]?.roleState?.role || goblin.social?.role || "forager";
    counts[role] = (counts[role] || 0) + 1;
    total += 1;
  }

  if (!total) {
    if (summary) summary.textContent = "No active role data.";
    mount.innerHTML = `<div class="muted">No living goblins to chart.</div>`;
    return;
  }

  const rows = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const top = rows[0];
  if (summary) {
    const topPct = Math.round((top[1] / total) * 100);
    summary.textContent = `${total} active goblins. Top role: ${top[0]} (${top[1]}, ${topPct}%).`;
  }

  mount.innerHTML = rows
    .map(([role, count], index) => {
      const pct = (count / total) * 100;
      const hue = (index * 29) % 360;
      return `<div class="role-row">
        <div class="role-label">${escapeHtml(role)}</div>
        <div class="role-bar-wrap"><div class="role-bar" style="width:${pct.toFixed(1)}%;background:hsl(${hue} 62% 48%);"></div></div>
        <div class="role-value">${count} (${Math.round(pct)}%)</div>
      </div>`;
    })
    .join("");
}

function renderProcessingOps(state, els) {
  const summaryEl = els.processingOpsSummary;
  const queueEl = els.processingOpsQueue;
  const blockedSummaryEl = els.blockedReasonSummary;
  const blockedListEl = els.blockedReasonList;
  if (!summaryEl || !queueEl || !blockedSummaryEl || !blockedListEl) return;

  const processing = state.worldMap?.structures?.processing || { tasksById: {}, queueIds: [] };
  const queueIds = processing.queueIds || [];
  const tasks = queueIds.map((id) => processing.tasksById?.[id]).filter(Boolean);
  const activeCount = tasks.filter((t) => t.status === "active").length;
  const queuedCount = tasks.filter((t) => t.status === "queued").length;
  const blockedCount = tasks.filter((t) => t.status === "blocked").length;

  summaryEl.textContent = `${queueIds.length} recipes queued | active ${activeCount} | queued ${queuedCount} | blocked ${blockedCount}`;
  if (!tasks.length) {
    queueEl.innerHTML = `<div class="muted">No processing tasks queued.</div>`;
  } else {
    queueEl.innerHTML = tasks
      .slice(0, 12)
      .map((task) => {
        const recipe = escapeHtml(task.recipeKey || "unknown");
        const status = escapeHtml(task.status || "queued");
        const remaining = Number.isFinite(task.remainingTicks) ? task.remainingTicks : 0;
        const progress = Number.isFinite(task.durationTicks) && task.durationTicks > 0
          ? Math.max(0, Math.min(100, Math.round(((task.durationTicks - remaining) / task.durationTicks) * 100)))
          : 0;
        return `<div class="role-row">
          <div class="role-label">${recipe}</div>
          <div class="role-bar-wrap"><div class="role-bar" style="width:${progress}%;background:hsl(162 55% 45%);"></div></div>
          <div class="role-value">${status}</div>
        </div>`;
      })
      .join("");
  }

  const recent = (state.chronicle || []).slice(-180);
  const reasonCounts = {};
  for (const entry of recent) {
    if (entry?.type === "ROLE_TASK_BLOCKED") {
      const key = String(entry.reasonCode || "UNKNOWN");
      reasonCounts[key] = (reasonCounts[key] || 0) + 1;
    } else if (entry?.type === "RECIPE_BLOCKED") {
      const key = `RECIPE:${entry.recipeKey || "unknown"}`;
      reasonCounts[key] = (reasonCounts[key] || 0) + 1;
    }
  }
  const reasonRows = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
  blockedSummaryEl.textContent = reasonRows.length
    ? `Recent blockers (${recent.length} entries window). Top: ${reasonRows[0][0]} (${reasonRows[0][1]})`
    : "No recent blocked reasons.";
  blockedListEl.innerHTML = reasonRows.length
    ? reasonRows
        .slice(0, 10)
        .map(([reason, count]) => `<div class="role-row"><div class="role-label">${escapeHtml(reason)}</div><div class="role-bar-wrap"><div class="role-bar" style="width:${Math.min(100, count * 12)}%;background:hsl(18 68% 50%);"></div></div><div class="role-value">${count}</div></div>`)
        .join("")
    : `<div class="muted">No blocked reasons recorded recently.</div>`;
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
    row.dataset.id = id;
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
  const roles = [
    "forager", "woodcutter", "fisherman", "hunter", "builder", "homebuilder", "sentinel", "lookout",
    "hauler", "water-runner", "caretaker", "quartermaster", "scout", "colony-establisher", "reproducer",
    "miner", "fiber-harvester", "herbalist", "smelter", "rope-maker", "carpenter", "charcoal-burner", "fletcher", "mechanist"
  ];
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
    block.style.minHeight = "5.4rem";
    const title = key[0].toUpperCase() + key.slice(1);
    const list = buckets[key];
    const items = list.length
      ? list
          .map((entry) => {
            const focus = resolveFocusTarget(state, entry);
            const focusAttrs = focus ? ` data-focus-x="${focus.x}" data-focus-y="${focus.y}"` : "";
            const siteLabel = labelForEntrySite(state, entry);
            const siteTag = siteLabel ? `<span class="pill" style="font-size:.68rem;justify-self:start">${escapeHtml(siteLabel)}</span>` : "";
            return `<div style="display:grid;grid-template-columns:1fr auto;gap:.35rem;margin:.2rem 0;">
              <button class="chron-row" type="button" data-entry-id="${entry.id}">[T${entry.tick}] ${entry.text}${siteTag ? ` ${siteTag}` : ""}</button>
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

function renderGoblinDetailPanel(state, els) {
  ensureGoblinDetailDom(state, els);
  const panel = els.goblinDetailPanel;
  const mount = els.goblinDetailContent;
  if (!panel || !mount) return;
  const id = state.debug.selectedGoblinId;
  const goblin = id ? state.goblins.byId[id] : null;
  const unit = id ? state.worldMap?.units?.byGoblinId?.[id] : null;
  const role = unit?.roleState?.role || goblin?.social?.role || "unassigned";
  const task = unit?.roleState?.roleTask?.kind || unit?.lastGoal || "idle";

  if (!goblin) {
    panel.classList.remove("open");
    panel.style.display = "none";
    panel.style.transform = "translateX(-108%)";
    mount.innerHTML = `<div class="muted">Select a goblin from roster/map to inspect stats.</div>`;
    return;
  }

  panel.classList.add("open");
  panel.style.display = "flex";
  panel.style.transform = "translateX(0)";
  mount.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center;">
        <strong>${escapeHtml(goblin.identity?.name || goblin.id)}</strong>
        <span class="pill">${escapeHtml(goblin.psyche?.moodState || "stable")}</span>
      </div>
      <div class="muted" style="font-size:.78rem">id: ${escapeHtml(goblin.id)} | role: ${escapeHtml(role)} | task: ${escapeHtml(task)}</div>
    </div>
    <div class="goblin-grid">
      ${statCard("Health", num(goblin.body?.health?.vitality))}
      ${statCard("Morale", pct(goblin.psyche?.morale || 0))}
      ${statCard("Stress", pct(goblin.psyche?.stress || 0))}
      ${statCard("Location", unit ? `${unit.tileX},${unit.tileY}` : "unknown")}
    </div>
    <div>
      <div class="tiny">Needs</div>
      <div class="goblin-grid">
        ${statCard("Hunger", pct(goblin.needs?.hunger || 0))}
        ${statCard("Thirst", pct(goblin.needs?.thirst || 0))}
        ${statCard("Rest", pct(goblin.needs?.rest || 0))}
        ${statCard("Warmth", pct(goblin.needs?.warmth || 0))}
        ${statCard("Safety", pct(goblin.needs?.safety || 0))}
        ${statCard("Belonging", pct(goblin.needs?.belonging || 0))}
      </div>
    </div>
    <div>
      <div class="tiny">Core Stats</div>
      <div class="goblin-grid">
        ${statCard("Brawn", num(goblin.coreStats?.brawn))}
        ${statCard("Agility", num(goblin.coreStats?.agility))}
        ${statCard("Cunning", num(goblin.coreStats?.cunning))}
        ${statCard("Craft", num(goblin.coreStats?.craft))}
        ${statCard("Grit", num(goblin.coreStats?.grit))}
        ${statCard("Will", num(goblin.coreStats?.will))}
        ${statCard("Luck", num(goblin.coreStats?.luck))}
        ${statCard("Social", num(goblin.coreStats?.social))}
      </div>
    </div>
    <div>
      <div class="tiny">Traits</div>
      <div class="muted" style="font-size:.78rem">
        quirks: ${escapeHtml((goblin.traits?.quirks || []).join(", ") || "none")}<br/>
        virtues: ${escapeHtml((goblin.traits?.virtues || []).join(", ") || "none")}<br/>
        flaws: ${escapeHtml((goblin.traits?.flaws || []).join(", ") || "none")}<br/>
        fears: ${escapeHtml((goblin.traits?.fears || []).join(", ") || "none")}
      </div>
    </div>
  `;
}

function renderWildlifeDetailPanel(state, els) {
  ensureWildlifeDetailDom(state, els);
  const panel = els.wildlifeDetailPanel;
  const mount = els.wildlifeDetailContent;
  if (!panel || !mount) return;
  const id = state.debug.selectedWildlifeId;
  const wildlife = id ? state.worldMap?.wildlife?.byId?.[id] : null;

  if (!wildlife) {
    panel.classList.remove("open");
    panel.style.display = "none";
    panel.style.transform = "translateX(-108%)";
    mount.innerHTML = `<div class="muted">Select wildlife on map to inspect stats.</div>`;
    return;
  }

  const isEnemy = wildlife.kind === "wolf" || wildlife.kind === "barbarian" || wildlife.disposition === "hostile" || wildlife.disposition === "predator";
  const target = wildlife.targetId ? `${wildlife.targetType || "unknown"}:${wildlife.targetId}` : "none";
  const hunt = wildlife.huntState || {};
  const pack = wildlife.packId ? state.worldMap?.wildlife?.packsById?.[wildlife.packId] : null;
  const packLabel = pack ? `${pack.id} (${pack.kind || "pack"})` : (wildlife.packId || "none");

  panel.classList.add("open");
  panel.style.display = "flex";
  panel.style.transform = "translateX(0)";
  mount.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center;">
        <strong>${escapeHtml(wildlife.kind || "wildlife")} ${isEnemy ? "Threat" : "Unit"}</strong>
        <span class="pill">${escapeHtml(wildlife.disposition || "unknown")}</span>
      </div>
      <div class="muted" style="font-size:.78rem">id: ${escapeHtml(wildlife.id)} | ai: ${escapeHtml(wildlife.aiState || "idle")} | alive: ${wildlife.alive ? "yes" : "no"}</div>
    </div>
    <div class="goblin-grid">
      ${statCard("Health", num(wildlife.health))}
      ${statCard("Stamina", num(wildlife.stamina))}
      ${statCard("Hunger", pct(wildlife.hunger || 0))}
      ${statCard("Thirst", pct(wildlife.thirst || 0))}
      ${statCard("Fear", pct(wildlife.fear || 0))}
      ${statCard("Aggression", pct(wildlife.aggression || 0))}
    </div>
    <div>
      <div class="tiny">Position</div>
      <div class="goblin-grid">
        ${statCard("Tile", `${num(wildlife.tileX)},${num(wildlife.tileY)}`)}
        ${statCard("Micro", `${num(wildlife.microX)},${num(wildlife.microY)}`)}
        ${statCard("Home Micro", `${num(wildlife.homeMicroX)},${num(wildlife.homeMicroY)}`)}
        ${statCard("Home Radius", num(wildlife.homeRadius))}
      </div>
    </div>
    <div>
      <div class="tiny">Behavior</div>
      <div class="goblin-grid">
        ${statCard("Target", target)}
        ${statCard("Pack", packLabel)}
        ${statCard("Hunt Mode", hunt.mode || "none")}
        ${statCard("Target Goblin", hunt.targetGoblinId || "none")}
        ${statCard("Retarget After", num(hunt.retargetAfterTick))}
        ${statCard("Last Decision", num(wildlife.lastDecisionTick))}
      </div>
    </div>
  `;
}

function renderManagementIndicators(state, mount, livingGoblinIds) {
  if (!mount) return;
  const living = livingGoblinIds.length;
  if (!living) {
    mount.innerHTML = `<div class="mgmt-item warn"><div class="mgmt-label">Colony</div><div class="mgmt-state">No active goblins</div></div>`;
    return;
  }

  const food = Number(state.tribe.resources.food || 0);
  const water = Number(state.tribe.resources.water || 0);
  const wood = Number(state.tribe.resources.wood || 0);
  const mushrooms = Number(state.tribe.resources.mushrooms || 0);

  const avgHunger = avgNeed(state, livingGoblinIds, "hunger");
  const avgThirst = avgNeed(state, livingGoblinIds, "thirst");
  const avgRest = avgNeed(state, livingGoblinIds, "rest");
  const avgWarmth = avgNeed(state, livingGoblinIds, "warmth");
  const avgSafety = avgNeed(state, livingGoblinIds, "safety");
  const avgMorale = avg(livingGoblinIds.map((id) => state.goblins.byId[id]?.psyche?.morale || 0));

  const highHunger = ratioAbove(state, livingGoblinIds, "hunger", 75);
  const highThirst = ratioAbove(state, livingGoblinIds, "thirst", 75);
  const highRest = ratioAbove(state, livingGoblinIds, "rest", 80);
  const highWarmth = ratioAbove(state, livingGoblinIds, "warmth", 80);
  const highSafety = ratioAbove(state, livingGoblinIds, "safety", 70);

  const foodPerGoblin = (food + mushrooms * 0.6) / living;
  const waterPerGoblin = water / living;
  const woodPerGoblin = wood / living;

  const indicators = [
    assessFoodIndicator(foodPerGoblin, avgHunger, highHunger),
    assessWaterIndicator(waterPerGoblin, avgThirst, highThirst),
    assessRestIndicator(avgRest, highRest),
    assessWarmthIndicator(woodPerGoblin, avgWarmth, highWarmth),
    assessMoraleIndicator(avgMorale),
    assessSafetyIndicator(avgSafety, highSafety)
  ];

  mount.innerHTML = indicators
    .map(
      (item) =>
        `<div class="mgmt-item ${item.status}">
          <div class="mgmt-label">${escapeHtml(item.label)}</div>
          <div class="mgmt-state">${escapeHtml(item.value)}</div>
        </div>`
    )
    .join("");
}

function assessFoodIndicator(foodPerGoblin, avgHunger, highHunger) {
  if (foodPerGoblin < 0.8 || avgHunger >= 70 || highHunger >= 0.35) {
    return { label: "Food", status: "bad", value: `Low (${fixed(foodPerGoblin)}/g, hunger ${Math.round(avgHunger)}%)` };
  }
  if (foodPerGoblin >= 2.1 && avgHunger <= 45 && highHunger <= 0.15) {
    return { label: "Food", status: "good", value: `Abundant (${fixed(foodPerGoblin)}/g)` };
  }
  return { label: "Food", status: "warn", value: `Stable (${fixed(foodPerGoblin)}/g)` };
}

function assessWaterIndicator(waterPerGoblin, avgThirst, highThirst) {
  if (waterPerGoblin < 0.8 || avgThirst >= 70 || highThirst >= 0.35) {
    return { label: "Water", status: "bad", value: `Low (${fixed(waterPerGoblin)}/g, thirst ${Math.round(avgThirst)}%)` };
  }
  if (waterPerGoblin >= 2.2 && avgThirst <= 45 && highThirst <= 0.15) {
    return { label: "Water", status: "good", value: `Abundant (${fixed(waterPerGoblin)}/g)` };
  }
  return { label: "Water", status: "warn", value: `Stable (${fixed(waterPerGoblin)}/g)` };
}

function assessRestIndicator(avgRest, highRest) {
  if (avgRest >= 75 || highRest >= 0.35) {
    return { label: "Rest Load", status: "bad", value: `Overloaded (${Math.round(avgRest)}%)` };
  }
  if (avgRest <= 45 && highRest <= 0.15) {
    return { label: "Rest Load", status: "good", value: `Recovered (${Math.round(avgRest)}%)` };
  }
  return { label: "Rest Load", status: "warn", value: `Mixed (${Math.round(avgRest)}%)` };
}

function assessWarmthIndicator(woodPerGoblin, avgWarmth, highWarmth) {
  if (woodPerGoblin < 0.6 || avgWarmth >= 75 || highWarmth >= 0.3) {
    return { label: "Warmth", status: "bad", value: `Cold risk (${fixed(woodPerGoblin)} wood/g)` };
  }
  if (woodPerGoblin >= 1.6 && avgWarmth <= 50 && highWarmth <= 0.15) {
    return { label: "Warmth", status: "good", value: `Secured (${fixed(woodPerGoblin)} wood/g)` };
  }
  return { label: "Warmth", status: "warn", value: `Watch (${fixed(woodPerGoblin)} wood/g)` };
}

function assessMoraleIndicator(avgMorale) {
  if (avgMorale <= 35) return { label: "Morale", status: "bad", value: `Low (${Math.round(avgMorale)}%)` };
  if (avgMorale >= 65) return { label: "Morale", status: "good", value: `Strong (${Math.round(avgMorale)}%)` };
  return { label: "Morale", status: "warn", value: `Uneven (${Math.round(avgMorale)}%)` };
}

function assessSafetyIndicator(avgSafety, highSafety) {
  if (avgSafety >= 70 || highSafety >= 0.3) {
    return { label: "Safety", status: "bad", value: `Threatened (${Math.round(avgSafety)}%)` };
  }
  if (avgSafety <= 45 && highSafety <= 0.12) {
    return { label: "Safety", status: "good", value: `Controlled (${Math.round(avgSafety)}%)` };
  }
  return { label: "Safety", status: "warn", value: `Caution (${Math.round(avgSafety)}%)` };
}

function avgNeed(state, ids, needKey) {
  if (!ids.length) return 0;
  const total = ids.reduce((sum, id) => sum + Number(state.goblins.byId[id]?.needs?.[needKey] || 0), 0);
  return total / ids.length;
}

function ratioAbove(state, ids, needKey, threshold) {
  if (!ids.length) return 0;
  const count = ids.reduce((sum, id) => sum + (Number(state.goblins.byId[id]?.needs?.[needKey] || 0) >= threshold ? 1 : 0), 0);
  return count / ids.length;
}

function fixed(value) {
  return Number(value).toFixed(1);
}

function criticalFlagsForGoblin(goblin) {
  const hunger = Number(goblin?.needs?.hunger || 0) >= 75;
  const thirst = Number(goblin?.needs?.thirst || 0) >= 75;
  const rest = Number(goblin?.needs?.rest || 0) >= 80;
  const warmth = Number(goblin?.needs?.warmth || 0) >= 80;
  const morale = Number(goblin?.psyche?.morale || 0) <= 25;
  return {
    isCritical: hunger || thirst || rest || warmth || morale,
    hunger,
    thirst,
    rest,
    warmth,
    morale
  };
}

function summarizeCriticalNeeds(state, livingIds) {
  const byType = { hunger: 0, thirst: 0, rest: 0, warmth: 0, morale: 0 };
  const samples = [];
  let criticalGoblinCount = 0;
  let sumH = 0;
  let sumT = 0;
  let sumR = 0;
  let sumW = 0;
  let sumM = 0;
  let maxH = 0;
  let maxT = 0;
  let maxR = 0;
  let maxW = 0;
  let minM = 100;

  for (const id of livingIds) {
    const goblin = state.goblins.byId[id];
    if (!goblin) continue;
    const h = Number(goblin.needs?.hunger || 0);
    const t = Number(goblin.needs?.thirst || 0);
    const r = Number(goblin.needs?.rest || 0);
    const w = Number(goblin.needs?.warmth || 0);
    const m = Number(goblin.psyche?.morale || 0);
    sumH += h;
    sumT += t;
    sumR += r;
    sumW += w;
    sumM += m;
    if (h > maxH) maxH = h;
    if (t > maxT) maxT = t;
    if (r > maxR) maxR = r;
    if (w > maxW) maxW = w;
    if (m < minM) minM = m;

    const flags = criticalFlagsForGoblin(goblin);
    if (!flags.isCritical) continue;
    criticalGoblinCount += 1;

    if (flags.hunger) byType.hunger += 1;
    if (flags.thirst) byType.thirst += 1;
    if (flags.rest) byType.rest += 1;
    if (flags.warmth) byType.warmth += 1;
    if (flags.morale) byType.morale += 1;

    if (samples.length < 3) {
      const reasons = [];
      if (flags.hunger) reasons.push(`H${Math.round(goblin.needs.hunger)}`);
      if (flags.thirst) reasons.push(`T${Math.round(goblin.needs.thirst)}`);
      if (flags.rest) reasons.push(`R${Math.round(goblin.needs.rest)}`);
      if (flags.warmth) reasons.push(`W${Math.round(goblin.needs.warmth)}`);
      if (flags.morale) reasons.push(`M${Math.round(goblin.psyche.morale)}`);
      samples.push(`${goblin.identity?.name || goblin.id}(${reasons.join("/")})`);
    }
  }

  const totalHits = byType.hunger + byType.thirst + byType.rest + byType.warmth + byType.morale;
  const header = `G:${criticalGoblinCount} Hits:${totalHits}`;
  const typeText = `H:${byType.hunger} T:${byType.thirst} R:${byType.rest} W:${byType.warmth} M:${byType.morale}`;
  const denom = Math.max(1, livingIds.length);
  const avgText = `Avg h${Math.round(sumH / denom)} t${Math.round(sumT / denom)} r${Math.round(sumR / denom)} w${Math.round(sumW / denom)} m${Math.round(sumM / denom)}`;
  const peakText = `Max h${Math.round(maxH)} t${Math.round(maxT)} r${Math.round(maxR)} w${Math.round(maxW)} min-m${Math.round(minM)}`;
  if (!samples.length) {
    return {
      byType,
      criticalGoblinCount,
      totalHits,
      text: `${header} | ${typeText} | ${avgText} | ${peakText} | no urgent goblins`
    };
  }
  return {
    byType,
    criticalGoblinCount,
    totalHits,
    text: `${header} | ${typeText} | ${avgText} | ${peakText} | ${samples.join(", ")}`
  };
}

function ensureGoblinDetailDom(state, els) {
  if (els.goblinDetailPanel && els.goblinDetailContent) return;
  const panel = document.createElement("aside");
  panel.id = "goblinDetailPanel";
  panel.className = "goblin-detail";
  panel.style.position = "absolute";
  panel.style.top = ".75rem";
  panel.style.left = ".75rem";
  panel.style.width = "min(420px,44vw)";
  panel.style.maxHeight = "calc(100vh - 1.5rem)";
  panel.style.zIndex = "10";
  panel.style.zIndex = "1000";
  panel.style.border = "1px solid #355541";
  panel.style.borderRadius = "12px";
  panel.style.background = "linear-gradient(170deg, rgba(19,34,26,.96), rgba(11,19,14,.96))";
  panel.style.boxShadow = "0 10px 28px rgba(0,0,0,.45)";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.transform = "translateX(-108%)";
  panel.style.transition = "transform .18s ease";
  panel.innerHTML = `
    <div class="goblin-detail-head" style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.65rem .75rem;border-bottom:1px solid rgba(215,180,98,.2)">
      <strong>Goblin Detail</strong>
      <button type="button" id="closeGoblinDetailBtnDynamic">Close</button>
    </div>
    <div id="goblinDetailContentDynamic" class="goblin-detail-body" style="padding:.65rem .75rem;overflow:auto;display:grid;gap:.55rem">
      <div class="muted">Select a goblin from roster/map to inspect stats.</div>
    </div>
  `;
  document.body.appendChild(panel);
  const closeBtn = panel.querySelector("#closeGoblinDetailBtnDynamic");
  closeBtn?.addEventListener("click", () => {
    state.debug.selectedGoblinId = null;
    state.debug.trackedGoblinId = null;
    panel.style.transform = "translateX(-108%)";
  });
  els.goblinDetailPanel = panel;
  els.goblinDetailContent = panel.querySelector("#goblinDetailContentDynamic");
}

function ensureWildlifeDetailDom(state, els) {
  if (els.wildlifeDetailPanel && els.wildlifeDetailContent) return;
  const panel = document.createElement("aside");
  panel.id = "wildlifeDetailPanel";
  panel.className = "wildlife-detail";
  panel.style.position = "absolute";
  panel.style.top = ".75rem";
  panel.style.left = ".75rem";
  panel.style.width = "min(420px,44vw)";
  panel.style.maxHeight = "calc(100vh - 1.5rem)";
  panel.style.zIndex = "1000";
  panel.style.border = "1px solid #355541";
  panel.style.borderRadius = "12px";
  panel.style.background = "linear-gradient(170deg, rgba(19,34,26,.96), rgba(11,19,14,.96))";
  panel.style.boxShadow = "0 10px 28px rgba(0,0,0,.45)";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.transform = "translateX(-108%)";
  panel.style.transition = "transform .18s ease";
  panel.innerHTML = `
    <div class="goblin-detail-head" style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.65rem .75rem;border-bottom:1px solid rgba(215,180,98,.2)">
      <strong>Wildlife Detail</strong>
      <button type="button" id="closeWildlifeDetailBtnDynamic">Close</button>
    </div>
    <div id="wildlifeDetailContentDynamic" class="goblin-detail-body" style="padding:.65rem .75rem;overflow:auto;display:grid;gap:.55rem">
      <div class="muted">Select wildlife on map to inspect stats.</div>
    </div>
  `;
  document.body.appendChild(panel);
  const closeBtn = panel.querySelector("#closeWildlifeDetailBtnDynamic");
  closeBtn?.addEventListener("click", () => {
    state.debug.selectedWildlifeId = null;
    state.debug.trackedWildlifeId = null;
    panel.style.transform = "translateX(-108%)";
  });
  els.wildlifeDetailPanel = panel;
  els.wildlifeDetailContent = panel.querySelector("#wildlifeDetailContentDynamic");
}

function avg(list) {
  if (!list.length) return 0;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function statCard(label, value) {
  return `<div class="goblin-stat"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(value)}</div></div>`;
}

function num(v) {
  if (v === undefined || v === null || Number.isNaN(Number(v))) return "-";
  return String(Math.round(Number(v)));
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
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
    t === "GOBLIN_RANGED_STRUCK_WILDLIFE" ||
    t === "THREAT_SPOTTED" ||
    t === "OUTPOST_REINFORCEMENTS_REQUESTED" ||
    t === "OUTPOST_EVACUATION_STARTED" ||
    t === "OUTPOST_AUTO_CLOSURE_FORCED" ||
    t === "CRITICAL_NEEDS_PREEMPTION_STARTED" ||
    t === "ROUTE_DISRUPTION_RISK" ||
    t === "FOOD_SPOILAGE" ||
    t === "WOLF_THREAT_NEAR_HOME" ||
    t === "NO_FIREWOOD" ||
    (t === "RESOURCE_SHORTAGE" && (resource === "water" || resource === "food"))
  ) {
    return "urgent";
  }
  if (
    t === "NEED_SPIKE" ||
    t === "SCOUT_SPOTTED_THREAT" ||
    t === "GOBLIN_HUNTED_WILDLIFE" ||
    t === "COLONY_HOME_ESTABLISHED" ||
    t === "MIGRATION_JOB_FAILED" ||
    t === "MIGRATION_JOB_REROUTED" ||
    t === "MIGRATION_JOB_RETARGETED" ||
    t === "CARETAKER_ASSISTED" ||
    t === "LOGISTICS_BOTTLENECK" ||
    t === "ROLE_POLICY_OVERRIDE" ||
    t === "OUTPOST_STATUS_CHANGED" ||
    t === "OUTPOST_EVACUATION_PROGRESS" ||
    t === "OUTPOST_ABANDONED" ||
    t === "OUTPOST_EVACUATION_CANCELED" ||
    t === "CRITICAL_NEEDS_PREEMPTION_ENDED" ||
    t === "ROLE_COORDINATION_SIGNAL" ||
    t === "STOCKPILE_RATIONING_ENABLED" ||
    t === "WEATHER_WARNING" ||
    t === "WEATHER_CHANGED" ||
    t === "SEASON_STARTED" ||
    t === "WILDLIFE_KILLED_BY_GOBLINS" ||
    t === "WOLF_HUNT_STARTED" ||
    t === "BARBARIAN_STOLE_RESOURCE" ||
    t === "WALL_PLAN_REPLANNED" ||
    t === "OUTPOST_RECOVERY_DIRECTIVE"
  ) {
    return "warning";
  }
  if (
    t === "ROLE_REASSIGNED"
    && (entry?.details?.reasonCode === "OUTPOST_RECOVERY" || entry?.details?.reasonCode === "CRITICAL_NEEDS_PREEMPTION")
  ) return "warning";
  return "info";
}

function resolveFocusTarget(state, entry) {
  const wm = state.worldMap;
  if (!wm || !entry) return null;
  const details = entry.details || {};
  if (Number.isFinite(details.tileX) && Number.isFinite(details.tileY)) return { x: details.tileX, y: details.tileY };
  if (typeof details.at === "string" && details.at.includes(",")) {
    const [mx, my] = details.at.split(",").map((v) => Number(v));
    if (Number.isFinite(mx) && Number.isFinite(my)) return { x: Math.floor(mx / TILES_PER_CHUNK), y: Math.floor(my / TILES_PER_CHUNK) };
  }
  const sitePos = resolveSitePosition(wm, entry.siteId);
  if (sitePos) return sitePos;
  if (entry.goblinId && wm.units?.byGoblinId?.[entry.goblinId]) {
    const unit = wm.units.byGoblinId[entry.goblinId];
    return { x: unit.tileX, y: unit.tileY };
  }
  return null;
}

function resolveSitePosition(wm, siteId) {
  if (!wm || !siteId) return null;
  if (wm.sitesById?.[siteId]) {
    const site = wm.sitesById[siteId];
    return { x: site.x, y: site.y };
  }
  const outpostId = outpostIdFromSiteId(siteId);
  if (!outpostId) return null;
  const outpost = wm.structures?.outpostsById?.[outpostId];
  if (outpost && Number.isFinite(outpost.tileX) && Number.isFinite(outpost.tileY)) {
    return { x: outpost.tileX, y: outpost.tileY };
  }
  return null;
}

function outpostIdFromSiteId(siteId) {
  if (typeof siteId !== "string") return null;
  if (!siteId.startsWith("outpost:")) return null;
  return siteId.slice("outpost:".length) || null;
}

function labelForEntrySite(state, entry) {
  const siteId = entry?.siteId;
  const wm = state?.worldMap;
  if (!wm || !siteId) return "";
  const startingSiteId = wm.player?.startingSiteId || null;
  if (wm.sitesById?.[siteId]) {
    if (siteId === startingSiteId) return "Home";
    return wm.sitesById[siteId].name || siteId;
  }
  const outpostId = outpostIdFromSiteId(siteId);
  if (!outpostId) return "";
  if (outpostId === "outpost-start" || outpostId === startingSiteId) return "Home Outpost";
  return `Outpost ${outpostId}`;
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
        overlayMode: state.worldMap.render.overlayMode,
        wallPlanCount: Object.keys(state.worldMap.structures?.wallPlansBySiteId || {}).length,
        wallPlanFootprintHashBySiteId: state.worldMap.structures?.wallPlanFootprintHashBySiteId || {},
        reproduction: state.worldMap.structures?.reproduction?.lastSnapshot || null
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
      overlayMode: state.worldMap.render.overlayMode,
      wallPlansBySiteId: state.worldMap.structures?.wallPlansBySiteId || {},
      wallPlanFootprintHashBySiteId: state.worldMap.structures?.wallPlanFootprintHashBySiteId || {},
      reproduction: state.worldMap.structures?.reproduction || null
    },
    tracking: {
      trackedGoblinId: state.debug.trackedGoblinId
    }
  };
}
