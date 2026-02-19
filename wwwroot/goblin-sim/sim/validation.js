import { CLIMATE_SEASON_KEYS, CLIMATE_WEATHER_KEYS, MOOD_STATES, NEED_KEYS } from "./constants.js";
import { canonicalEdgeKey } from "./ids.js";
import { TILES_PER_CHUNK, tileKey } from "./world/scale.js";

export function validateState(state) {
  const warnings = [];

  for (const id of state.goblins.allIds) {
    const g = state.goblins.byId[id];
    if (!g) {
      warnings.push(`Missing goblin object for id ${id}`);
      continue;
    }

    if (!MOOD_STATES.includes(g.psyche.moodState)) {
      warnings.push(`Invalid moodState on ${id}: ${g.psyche.moodState}`);
    }

    for (const need of NEED_KEYS) {
      const value = g.needs[need];
      if (value < 0 || value > 100) warnings.push(`Need out of range: ${id}.${need}=${value}`);
    }

    if ((g.flags.missing || !g.flags.alive) && g.assignment.currentJobId) {
      warnings.push(`Unavailable goblin assigned work: ${id}`);
    }

    if (g.assignment.currentJobId) {
      const jobId = g.assignment.currentJobId;
      const exists = state.jobs.byId[jobId] && (state.jobs.active.includes(jobId) || state.jobs.queue.includes(jobId));
      if (!exists) warnings.push(`Invalid currentJobId on ${id}: ${jobId}`);
    }
  }

  for (const [key, edge] of Object.entries(state.goblins.relationships)) {
    const canonical = canonicalEdgeKey(edge.a, edge.b);
    if (key !== canonical) warnings.push(`Relationship key not canonical: ${key}`);
  }

  for (const id of Object.values(state.lore.chronicleIndex.byType).flat()) {
    const exists = state.chronicle.some((c) => c.id === id);
    if (!exists) warnings.push(`Chronicle index references missing entry: ${id}`);
  }

  for (const artifactId of state.lore.artifacts.allIds) {
    const artifact = state.lore.artifacts.byId[artifactId];
    if (!artifact) {
      warnings.push(`Missing artifact object for id ${artifactId}`);
      continue;
    }
    let lastTick = -1;
    for (const p of artifact.provenance) {
      if (!p.to?.ownerId) warnings.push(`Artifact provenance missing owner on ${artifactId}`);
      if (p.tick < lastTick) warnings.push(`Artifact provenance tick regression on ${artifactId}`);
      lastTick = p.tick;
    }
  }

  for (const edge of Object.values(state.lore.causality.edgesById)) {
    if (edge.causeEntryId === edge.effectEntryId) warnings.push(`Causality self-loop: ${edge.id}`);
  }

  const governance = state.tribe?.governance || null;
  if (governance) {
    const leaderId = governance.leaderGoblinId || null;
    if (leaderId && !state.goblins.byId?.[leaderId]) {
      warnings.push(`Governance leader missing goblin: ${leaderId}`);
    }
    if (leaderId) {
      const leader = state.goblins.byId?.[leaderId];
      if (!leader?.flags?.alive || leader?.flags?.missing) {
        warnings.push(`Governance leader unavailable: ${leaderId}`);
      }
    }
    const rec = governance.recommendations || {};
    const reserveFloors = rec.reserveFloors || {};
    for (const key of ["ammo_bolts", "metal_parts", "springs", "wood_planks"]) {
      if (!Number.isFinite(reserveFloors[key]) || reserveFloors[key] < 0) {
        warnings.push(`Governance reserve floor invalid: ${key}=${reserveFloors[key]}`);
      }
    }
  }

  const wm = state.worldMap;
  const world = state.world;
  if (world) {
    const season = world.season || {};
    const weather = world.weather || {};
    if (!CLIMATE_SEASON_KEYS.includes(String(season.key || ""))) {
      warnings.push(`Invalid climate season key: ${String(season.key)}`);
    }
    if (!Number.isFinite(season.year) || season.year < 1) {
      warnings.push(`Invalid climate season year: ${season.year}`);
    }
    if (!Number.isFinite(season.daysPerSeason) || season.daysPerSeason < 1) {
      warnings.push(`Invalid climate daysPerSeason: ${season.daysPerSeason}`);
    }
    if (!Number.isFinite(season.dayOfSeason) || season.dayOfSeason < 1 || season.dayOfSeason > season.daysPerSeason) {
      warnings.push(`Invalid climate dayOfSeason: ${season.dayOfSeason}/${season.daysPerSeason}`);
    }
    const currentWeather = String(weather.current || weather.type || "");
    if (!CLIMATE_WEATHER_KEYS.includes(currentWeather)) {
      warnings.push(`Invalid climate weather key: ${currentWeather}`);
    }
    if (!Number.isFinite(weather.intensity) || Number(weather.intensity) < 0 || Number(weather.intensity) > 1) {
      warnings.push(`Invalid climate weather intensity: ${weather.intensity}`);
    }
    const forecast = world.forecast?.next7Days;
    if (!Array.isArray(forecast)) warnings.push("Climate forecast missing next7Days.");
    else {
      for (const row of forecast) {
        if (!CLIMATE_SEASON_KEYS.includes(String(row?.season || ""))) warnings.push(`Climate forecast invalid season: ${row?.season}`);
        if (!CLIMATE_WEATHER_KEYS.includes(String(row?.likelyWeather || ""))) warnings.push(`Climate forecast invalid weather: ${row?.likelyWeather}`);
        if (!Number.isFinite(row?.confidence) || row.confidence < 0 || row.confidence > 1) warnings.push(`Climate forecast invalid confidence: ${row?.confidence}`);
      }
    }
    const global = world.climateModifiers?.global;
    if (!global || typeof global !== "object") warnings.push("Climate modifiers global missing.");
    else {
      const keys = ["foodYieldMul", "woodYieldMul", "hazardMul", "travelMul", "thirstPressureMul", "warmthPressureMul"];
      for (const k of keys) {
        const v = Number(global[k]);
        if (!Number.isFinite(v) || v <= 0 || v > 3) warnings.push(`Climate modifier invalid: ${k}=${global[k]}`);
      }
    }
  }
  if (wm) {
    for (const [siteId, site] of Object.entries(wm.sitesById)) {
      if (!wm.regionsById[site.regionId]) warnings.push(`Site references invalid region: ${siteId} -> ${site.regionId}`);
    }

    for (const [routeId, route] of Object.entries(wm.routesById)) {
      if (!wm.sitesById[route.fromSiteId]) warnings.push(`Route invalid fromSiteId: ${routeId}`);
      if (!wm.sitesById[route.toSiteId]) warnings.push(`Route invalid toSiteId: ${routeId}`);
    }
    for (const [routeId, rp] of Object.entries(wm.routePressureByRouteId || {})) {
      if (!wm.routesById?.[routeId]) warnings.push(`Route pressure references missing route: ${routeId}`);
      if (!Number.isFinite(rp?.climateRisk) || rp.climateRisk < 0) warnings.push(`Route pressure invalid climateRisk: ${routeId}`);
      if (!Number.isFinite(rp?.reliability) || rp.reliability < 0 || rp.reliability > 1) warnings.push(`Route pressure invalid reliability: ${routeId}`);
      if (!Number.isFinite(rp?.travelMul) || rp.travelMul <= 0) warnings.push(`Route pressure invalid travelMul: ${routeId}`);
    }

    for (let y = 0; y < wm.regionGrid.length; y += 1) {
      for (let x = 0; x < wm.regionGrid[y].length; x += 1) {
        const id = wm.regionGrid[y][x];
        if (!wm.regionsById[id]) warnings.push(`Region grid references missing region: ${id}`);
      }
    }

    for (const id of Object.keys(wm.overlays.hazardByRegion)) {
      if (!wm.regionsById[id]) warnings.push(`Overlay hazard key missing region: ${id}`);
    }
    for (const id of Object.keys(wm.overlays.resourceByRegion)) {
      if (!wm.regionsById[id]) warnings.push(`Overlay resource key missing region: ${id}`);
    }

    if (wm.player.startingSiteId && !wm.sitesById[wm.player.startingSiteId]) {
      warnings.push(`startingSiteId invalid: ${wm.player.startingSiteId}`);
    }

    for (const [key, node] of Object.entries(wm.resourceNodes?.byTileKey || {})) {
      const microX = node.microX ?? (node.tileX * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2));
      const microY = node.microY ?? (node.tileY * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2));
      const expectedKey = tileKey(microX, microY);
      if (key !== expectedKey) warnings.push(`Resource node key mismatch: ${key} != ${expectedKey}`);
      if (microX < 0 || microY < 0 || microX >= wm.width * TILES_PER_CHUNK || microY >= wm.height * TILES_PER_CHUNK) {
        warnings.push(`Resource node out of bounds: ${key}`);
      }
      if (node.type !== "tree" && node.type !== "mushroom") {
        warnings.push(`Resource node invalid type: ${key}:${node.type}`);
      }
    }

    for (const [key, source] of Object.entries(wm.waterSources?.byTileKey || {})) {
      const microX = source.microX ?? (source.tileX * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2));
      const microY = source.microY ?? (source.tileY * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2));
      const expectedKey = tileKey(microX, microY);
      if (key !== expectedKey) warnings.push(`Water source key mismatch: ${key} != ${expectedKey}`);
      if (microX < 0 || microY < 0 || microX >= wm.width * TILES_PER_CHUNK || microY >= wm.height * TILES_PER_CHUNK) {
        warnings.push(`Water source out of bounds: ${key}`);
      }
    }

    for (const unit of Object.values(wm.units?.byGoblinId || {})) {
      if (unit.homeTileX === undefined || unit.homeTileY === undefined) {
        warnings.push(`Unit missing home tile: ${unit.goblinId}`);
      }
      if (unit.homeMicroX === undefined || unit.homeMicroY === undefined) {
        warnings.push(`Unit missing home micro tile: ${unit.goblinId}`);
      }
      if (unit.microX === undefined || unit.microY === undefined) {
        warnings.push(`Unit missing micro tile: ${unit.goblinId}`);
      }
      if (unit.tileX < 0 || unit.tileY < 0 || unit.tileX >= wm.width || unit.tileY >= wm.height) {
        warnings.push(`Unit out of bounds: ${unit.goblinId}`);
      }
      if (unit.microX < 0 || unit.microY < 0 || unit.microX >= wm.width * TILES_PER_CHUNK || unit.microY >= wm.height * TILES_PER_CHUNK) {
        warnings.push(`Unit micro out of bounds: ${unit.goblinId}`);
      }
    }

    for (const [key, wall] of Object.entries(wm.structures?.wallsByTileKey || {})) {
      const microX = wall.microX ?? (wall.tileX * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2));
      const microY = wall.microY ?? (wall.tileY * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2));
      const expectedKey = tileKey(microX, microY);
      if (key !== expectedKey) warnings.push(`Wall key mismatch: ${key} != ${expectedKey}`);
      if (microX < 0 || microY < 0 || microX >= wm.width * TILES_PER_CHUNK || microY >= wm.height * TILES_PER_CHUNK) {
        warnings.push(`Wall out of bounds: ${key}`);
      }
    }

    for (const [key, outpost] of Object.entries(wm.structures?.enemyOutpostsByTileKey || {})) {
      const microX = Number.isFinite(outpost.microX)
        ? outpost.microX
        : Number.isFinite(outpost.tileX)
          ? outpost.tileX * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2)
          : null;
      const microY = Number.isFinite(outpost.microY)
        ? outpost.microY
        : Number.isFinite(outpost.tileY)
          ? outpost.tileY * TILES_PER_CHUNK + Math.floor(TILES_PER_CHUNK / 2)
          : null;
      if (microX === null || microY === null) {
        warnings.push(`Enemy outpost missing coordinates: ${key}`);
        continue;
      }
      const expectedKey = tileKey(microX, microY);
      if (key !== expectedKey) warnings.push(`Enemy outpost key mismatch: ${key} != ${expectedKey}`);
      if (microX < 0 || microY < 0 || microX >= wm.width * TILES_PER_CHUNK || microY >= wm.height * TILES_PER_CHUNK) {
        warnings.push(`Enemy outpost out of bounds: ${key}`);
      }
      const status = String(outpost.status || "active");
      if (status !== "active" && status !== "dormant" && status !== "destroyed" && status !== "hidden") {
        warnings.push(`Enemy outpost invalid status: ${key}:${status}`);
      }
      const kind = String(outpost.kind || outpost.type || "warcamp");
      if (
        kind !== "warcamp" &&
        kind !== "raider-camp" &&
        kind !== "ritual-circle" &&
        kind !== "watch-lodge" &&
        kind !== "siege-den" &&
        kind !== "barbarian-band" &&
        kind !== "wolf-pack"
      ) {
        warnings.push(`Enemy outpost unknown kind: ${key}:${kind}`);
      }
      if (!Number.isFinite(outpost.strength) || Number(outpost.strength) < 0) {
        warnings.push(`Enemy outpost invalid strength: ${key}:${outpost.strength}`);
      }
      if (outpost.originPackId && !wm.wildlife?.packsById?.[outpost.originPackId]) {
        warnings.push(`Enemy outpost missing origin pack: ${key}:${outpost.originPackId}`);
      }
    }

    const wallPlansBySiteId = wm.structures?.wallPlansBySiteId || {};
    const plans = Object.values(wallPlansBySiteId);
    if (!plans.length && wm.structures?.wallPlan) plans.push(wm.structures.wallPlan);
    for (const wallPlan of plans) {
      if (!wallPlan) continue;
      if (wallPlan.homeSiteId && !wm.sitesById[wallPlan.homeSiteId]) {
        warnings.push(`Wall plan invalid homeSiteId: ${wallPlan.homeSiteId}`);
      }
      for (const key of wallPlan.orderedTileKeys || []) {
        const status = wallPlan.tileStatusByKey?.[key];
        if (!status) warnings.push(`Wall plan missing status for key: ${key}`);
        if (status === "built" && !wm.structures?.wallsByTileKey?.[key]) {
          warnings.push(`Wall plan built key has no wall structure: ${key}`);
        }
      }
      for (const key of wallPlan.gateTileKeys || []) {
        if (wallPlan.tileStatusByKey?.[key] === "built") warnings.push(`Wall plan gate marked built: ${key}`);
      }
    }

    if (wm.wildlife) {
      const raceCfg = wm.wildlife.raceRuntimeConfigByKind;
      if (!raceCfg || typeof raceCfg !== "object") {
        warnings.push("Wildlife race runtime config missing.");
      } else {
        if (!raceCfg.wolf) warnings.push("Wildlife race config missing wolf.");
        if (!raceCfg.barbarian) warnings.push("Wildlife race config missing barbarian.");
        if (!raceCfg.ogre) warnings.push("Wildlife race config missing ogre.");
        if (!raceCfg.shaman) warnings.push("Wildlife race config missing shaman.");
        if (!raceCfg.elf_ranger) warnings.push("Wildlife race config missing elf_ranger.");
      }

      for (const id of wm.wildlife.allIds || []) {
        if (!wm.wildlife.byId?.[id]) warnings.push(`Wildlife allIds references missing object: ${id}`);
      }

      for (const [id, creature] of Object.entries(wm.wildlife.byId || {})) {
        if (!creature) {
          warnings.push(`Wildlife byId entry is empty: ${id}`);
          continue;
        }
        if (
          (creature.kind === "wolf"
            || creature.kind === "barbarian"
            || creature.kind === "human_raider"
            || creature.kind === "ogre"
            || creature.kind === "shaman"
            || creature.kind === "elf_ranger")
          && creature.huntState?.targetGoblinId
        ) {
          const targetId = creature.huntState.targetGoblinId;
          const targetGoblin = state.goblins.byId?.[targetId];
          if (!targetGoblin || !targetGoblin.flags?.alive || targetGoblin.flags?.missing) {
            warnings.push(`Hostile huntState target invalid: ${id} -> ${targetId}`);
          }
        }
        if (creature.microX < 0 || creature.microY < 0 || creature.microX >= wm.width * TILES_PER_CHUNK || creature.microY >= wm.height * TILES_PER_CHUNK) {
          warnings.push(`Wildlife out of bounds: ${id}`);
        }
        const expectedTileX = Math.floor(creature.microX / TILES_PER_CHUNK);
        const expectedTileY = Math.floor(creature.microY / TILES_PER_CHUNK);
        if (creature.tileX !== expectedTileX || creature.tileY !== expectedTileY) {
          warnings.push(`Wildlife tile mismatch: ${id}`);
        }
        const key = tileKey(creature.microX, creature.microY);
        const occ = wm.wildlife.occupancyByMicroKey?.[key] || [];
        if (!occ.includes(id)) warnings.push(`Wildlife occupancy missing id at key: ${id}@${key}`);
        if (creature.kind === "fish" && !wm.waterSources?.byTileKey?.[key]) {
          warnings.push(`Fish spawned off-water: ${id}@${key}`);
        }
        if (creature.packId && !wm.wildlife.packsById?.[creature.packId]) {
          warnings.push(`Wildlife packId missing pack: ${id} -> ${creature.packId}`);
        }
      }

      for (const [key, ids] of Object.entries(wm.wildlife.occupancyByMicroKey || {})) {
        for (const id of ids) {
          const creature = wm.wildlife.byId?.[id];
          if (!creature) {
            warnings.push(`Wildlife occupancy references missing creature: ${key} -> ${id}`);
            continue;
          }
          const expected = tileKey(creature.microX, creature.microY);
          if (expected !== key) warnings.push(`Wildlife occupancy key mismatch: ${id} expected ${expected} got ${key}`);
        }
      }

      for (const [packId, pack] of Object.entries(wm.wildlife.packsById || {})) {
        if (!Array.isArray(pack.memberIds) || pack.memberIds.length === 0) {
          warnings.push(`Wildlife pack has no members: ${packId}`);
          continue;
        }
        if (pack.leaderId && !pack.memberIds.includes(pack.leaderId)) {
          warnings.push(`Wildlife pack leader not in memberIds: ${packId}`);
        }
        for (const memberId of pack.memberIds) {
          const creature = wm.wildlife.byId?.[memberId];
          if (!creature) {
            warnings.push(`Wildlife pack member missing creature: ${packId} -> ${memberId}`);
            continue;
          }
          if (creature.packId !== packId) warnings.push(`Wildlife pack mismatch: ${memberId} != ${packId}`);
        }
      }
    }
  }

  const deathTickByGoblinId = {};
  for (const c of state.chronicle || []) {
    if (c.type === "GOBLIN_KILLED_BY_WILDLIFE" && c.goblinId) {
      if (deathTickByGoblinId[c.goblinId] === undefined) deathTickByGoblinId[c.goblinId] = c.tick;
      else warnings.push(`Duplicate goblin death transition: ${c.goblinId}`);
    }
    if (c.type === "GOBLIN_INJURED_BY_WILDLIFE") {
      const goblinId = c.goblinId || c.details?.goblinId;
      const wildlifeId = c.details?.wildlifeId || c.wildlifeId;
      if (!goblinId || !state.goblins.byId[goblinId]) {
        warnings.push(`Injury event missing/invalid goblin reference: ${c.id}`);
      }
      if (wildlifeId && !state.worldMap?.wildlife?.byId?.[wildlifeId]) {
        warnings.push(`Injury event missing/invalid wildlife reference: ${c.id}`);
      }
    }
  }

  for (const c of state.chronicle || []) {
    if (c.type !== "WILDLIFE_ATTACKED_GOBLIN") continue;
    const goblinId = c.goblinId || c.details?.goblinId;
    if (!goblinId) continue;
    const deathTick = deathTickByGoblinId[goblinId];
    if (deathTick !== undefined && c.tick > deathTick) {
      warnings.push(`Post-death wildlife attack event: ${goblinId}@${c.tick}`);
    }
  }

  state.debug.warnings = warnings.slice(-20);
  return warnings;
}
