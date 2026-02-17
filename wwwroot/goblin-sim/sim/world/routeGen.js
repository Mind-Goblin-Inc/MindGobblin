import { initRng, randChoice, randFloat } from "../rng.js";

const ROUTE_TYPES = ["road", "trail", "river", "tunnel", "pass"];

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function routeTypeFor(a, b, rng) {
  const waterBias = (a.biome === "swamp" || b.biome === "swamp") ? 0.35 : 0;
  const caveBias = (a.biome === "caves" || b.biome === "caves") ? 0.35 : 0;
  const roll = randFloat(rng);
  if (roll < waterBias) return "river";
  if (roll < waterBias + caveBias) return "tunnel";
  return randChoice(rng, ROUTE_TYPES);
}

function routeAttrs(type, length, riskBase, rng) {
  const factors = {
    road: { time: 0.75, risk: 0.8 },
    trail: { time: 1, risk: 1 },
    river: { time: 0.9, risk: 1.1 },
    tunnel: { time: 1.15, risk: 1.2 },
    pass: { time: 1.25, risk: 1.15 }
  };
  const f = factors[type] || factors.trail;
  return {
    travelTime: Math.max(1, Math.round(length * 2.2 * f.time)),
    risk: Math.min(1, Math.max(0.05, riskBase * f.risk + randFloat(rng) * 0.08)),
    seasonalModifiers: {
      spring: 1,
      summer: 0.95,
      autumn: 1.05,
      winter: type === "pass" ? 1.35 : 1.1
    }
  };
}

export function generateRoutes({ seed, sitesById, siteIds, regionsById }) {
  const rng = initRng(`${seed}|routes`);
  const routesById = {};
  const adjacency = {};

  for (const id of siteIds) adjacency[id] = [];

  if (siteIds.length < 2) return { routesById, adjacency };

  const remaining = new Set(siteIds.slice(1));
  const connected = [siteIds[0]];
  let idx = 1;

  // Deterministic sparse MST backbone.
  while (remaining.size > 0) {
    const target = siteIds[idx % siteIds.length];
    idx += 1;
    if (!remaining.has(target)) continue;

    let bestFrom = connected[0];
    let bestDistance = Infinity;
    for (const from of connected) {
      const d = dist(sitesById[from], sitesById[target]);
      if (d < bestDistance) {
        bestDistance = d;
        bestFrom = from;
      }
    }

    addRoute(bestFrom, target);
    remaining.delete(target);
    connected.push(target);
  }

  // Add extra local edges for traversal options.
  for (const from of siteIds) {
    const options = siteIds
      .filter((to) => to !== from)
      .map((to) => ({ to, d: dist(sitesById[from], sitesById[to]) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);

    for (const option of options) {
      if (hasEdge(from, option.to)) continue;
      if (randFloat(rng) > 0.35) continue;
      addRoute(from, option.to);
    }
  }

  function hasEdge(a, b) {
    return adjacency[a].some((entry) => entry.toSiteId === b);
  }

  function addRoute(a, b) {
    const sa = sitesById[a];
    const sb = sitesById[b];
    const ra = regionsById[sa.regionId];
    const rb = regionsById[sb.regionId];
    const length = dist(sa, sb);
    const type = routeTypeFor(ra, rb, rng);
    const attrs = routeAttrs(type, length, (ra.hazardPressure + rb.hazardPressure) / 2, rng);

    const id = `route-${Object.keys(routesById).length + 1}`;
    routesById[id] = {
      id,
      fromSiteId: a,
      toSiteId: b,
      type,
      travelTime: attrs.travelTime,
      risk: Math.round(attrs.risk * 100) / 100,
      seasonalModifiers: attrs.seasonalModifiers,
      factionControl: sa.ownerFactionId === sb.ownerFactionId ? sa.ownerFactionId : null,
      length: Math.round(length * 100) / 100
    };

    adjacency[a].push({ routeId: id, toSiteId: b });
    adjacency[b].push({ routeId: id, toSiteId: a });
  }

  return { routesById, adjacency };
}
