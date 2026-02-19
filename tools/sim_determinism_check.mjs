import crypto from "node:crypto";
import { createInitialState } from "../wwwroot/goblin-sim/sim/state.js";
import { tick } from "../wwwroot/goblin-sim/sim/tick.js";

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function hashParts(parts) {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}

function parseArgs(argv) {
  const args = {
    profile: "quick",
    ticks: null,
    runsPerSeed: null,
    seeds: null,
    goblins: null,
    checkpointEvery: null,
    progressEvery: null
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = String(argv[i] || "");
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (key === "profile" && next) {
      args.profile = String(next);
      i += 1;
      continue;
    }
    if (key === "ticks" && next) {
      args.ticks = Number(next);
      i += 1;
      continue;
    }
    if (key === "runs" && next) {
      args.runsPerSeed = Number(next);
      i += 1;
      continue;
    }
    if (key === "seeds" && next) {
      args.seeds = String(next).split(",").map((s) => s.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (key === "goblins" && next) {
      args.goblins = Number(next);
      i += 1;
      continue;
    }
    if (key === "checkpoint" && next) {
      args.checkpointEvery = Number(next);
      i += 1;
      continue;
    }
    if (key === "progress" && next) {
      args.progressEvery = Number(next);
      i += 1;
    }
  }
  return args;
}

function resolveConfig(args) {
  const profiles = {
    quick: {
      ticks: 120,
      runsPerSeed: 2,
      seeds: ["determinism-seed-alpha", "determinism-seed-beta", "determinism-seed-gamma"],
      goblins: 14,
      checkpointEvery: 30,
      progressEvery: 20
    },
    full: {
      ticks: 360,
      runsPerSeed: 3,
      seeds: ["determinism-seed-alpha", "determinism-seed-beta", "determinism-seed-gamma"],
      goblins: 14,
      checkpointEvery: 60,
      progressEvery: 30
    }
  };

  const base = profiles[args.profile] || profiles.quick;
  const cfg = {
    profile: args.profile,
    ticks: Number.isFinite(args.ticks) && args.ticks > 0 ? Math.floor(args.ticks) : base.ticks,
    runsPerSeed: Number.isFinite(args.runsPerSeed) && args.runsPerSeed > 0 ? Math.floor(args.runsPerSeed) : base.runsPerSeed,
    seeds: Array.isArray(args.seeds) && args.seeds.length >= 2 ? args.seeds : base.seeds,
    goblins: Number.isFinite(args.goblins) && args.goblins > 0 ? Math.floor(args.goblins) : base.goblins,
    checkpointEvery: Number.isFinite(args.checkpointEvery) && args.checkpointEvery > 0 ? Math.floor(args.checkpointEvery) : base.checkpointEvery,
    progressEvery: Number.isFinite(args.progressEvery) && args.progressEvery > 0 ? Math.floor(args.progressEvery) : base.progressEvery
  };
  if (cfg.checkpointEvery > cfg.ticks) cfg.checkpointEvery = cfg.ticks;
  if (cfg.progressEvery > cfg.ticks) cfg.progressEvery = cfg.ticks;
  return cfg;
}

function summarizeState(state) {
  const resources = state.tribe?.resources || {};
  const unitsById = state.worldMap?.units?.byGoblinId || {};
  const goblinSummary = state.goblins.allIds
    .map((id) => {
      const g = state.goblins.byId[id];
      const u = unitsById[id];
      return {
        id,
        alive: Boolean(g?.flags?.alive),
        missing: Boolean(g?.flags?.missing),
        role: u?.roleState?.role || g?.social?.role || "forager",
        outpostId: u?.home?.outpostId || null,
        x: u?.microX ?? null,
        y: u?.microY ?? null,
        hunger: Math.round(g?.needs?.hunger ?? 0),
        thirst: Math.round(g?.needs?.thirst ?? 0),
        morale: Math.round(g?.psyche?.morale ?? 0)
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const outposts = Object.values(state.worldMap?.structures?.outpostsById || {})
    .map((o) => ({
      id: o.id,
      priority: o.priority || "normal",
      status: o.runtime?.status || "seeded",
      pop: o.runtime?.population || 0,
      target: o.runtime?.targetPopulation || 0,
      deficit: o.runtime?.populationDeficit || 0
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    tick: state.meta.tick,
    resources: {
      food: resources.food || 0,
      water: resources.water || 0,
      wood: resources.wood || 0,
      mushrooms: resources.mushrooms || 0,
      metal_ore: resources.metal_ore || 0,
      metal_parts: resources.metal_parts || 0
    },
    goblins: goblinSummary,
    outposts,
    migration: {
      queue: state.worldMap?.structures?.migration?.queueIds?.length || 0,
      created: state.worldMap?.structures?.migration?.metrics?.jobsCreated || 0,
      completed: state.worldMap?.structures?.migration?.metrics?.jobsCompleted || 0,
      failed: state.worldMap?.structures?.migration?.metrics?.jobsFailed || 0
    }
  };
}

function summarizeEvents(events) {
  return events.map((e) => ({
    type: e.type,
    goblinId: e.goblinId || null,
    outpostId: e.outpostId || null,
    fromOutpostId: e.fromOutpostId || null,
    toOutpostId: e.toOutpostId || null,
    tileX: Number.isFinite(e.tileX) ? e.tileX : null,
    tileY: Number.isFinite(e.tileY) ? e.tileY : null,
    reasonCode: e.reasonCode || null
  }));
}

function runSimulation(seed, runIndex, cfg) {
  const state = createInitialState(seed, cfg.goblins);
  const timelineParts = [];
  const checkpointHashes = [];
  for (let i = 0; i < cfg.ticks; i += 1) {
    const events = tick(state);
    if ((i + 1) % cfg.progressEvery === 0) {
      process.stdout.write(`seed=${seed} run=${runIndex + 1}/${cfg.runsPerSeed} tick=${i + 1}/${cfg.ticks}\n`);
    }
    const eventSlice = summarizeEvents(events);
    const stateSlice = summarizeState(state);
    timelineParts.push(stableStringify({ tick: state.meta.tick, events: eventSlice }));
    timelineParts.push(stableStringify(stateSlice));
    if ((i + 1) % cfg.checkpointEvery === 0 || (i + 1) === cfg.ticks) {
      checkpointHashes.push(hashParts([
        stableStringify({ tick: state.meta.tick, events: eventSlice }),
        stableStringify(stateSlice)
      ]));
    }
  }
  return {
    finalHash: hashParts([stableStringify(summarizeState(state))]),
    timelineHash: hashParts(timelineParts),
    checkpointHash: hashParts(checkpointHashes)
  };
}

function evaluateRuns(cfg, runsBySeed) {
  let deterministicOk = true;
  let diversityOk = true;
  const failures = [];
  const referenceTimelineBySeed = {};
  const uniqueSeedTimelines = new Set();

  for (const [seed, runs] of Object.entries(runsBySeed)) {
    if (!runs.length) continue;
    const ref = runs[0];
    referenceTimelineBySeed[seed] = ref.timelineHash;
    uniqueSeedTimelines.add(ref.timelineHash);
    for (let i = 1; i < runs.length; i += 1) {
      const r = runs[i];
      if (r.finalHash !== ref.finalHash || r.timelineHash !== ref.timelineHash || r.checkpointHash !== ref.checkpointHash) {
        deterministicOk = false;
        failures.push(`seed=${seed} run#${i + 1} mismatched baseline run#1`);
      }
    }
  }

  if (uniqueSeedTimelines.size < 2) {
    diversityOk = false;
    failures.push("cross-seed diversity failed: timeline hashes are not distinct");
  }

  return { deterministicOk, diversityOk, failures, referenceTimelineBySeed };
}

function main() {
  const cfg = resolveConfig(parseArgs(process.argv));
  console.log(`profile=${cfg.profile}`);
  console.log(`ticks=${cfg.ticks} runsPerSeed=${cfg.runsPerSeed} goblins=${cfg.goblins} checkpointEvery=${cfg.checkpointEvery}`);
  console.log(`seeds=${cfg.seeds.join(",")}`);

  const runsBySeed = {};
  for (const seed of cfg.seeds) {
    runsBySeed[seed] = [];
    for (let runIndex = 0; runIndex < cfg.runsPerSeed; runIndex += 1) {
      runsBySeed[seed].push(runSimulation(seed, runIndex, cfg));
    }
  }

  const result = evaluateRuns(cfg, runsBySeed);
  console.log(`same-seed deterministic: ${result.deterministicOk}`);
  console.log(`cross-seed diversity: ${result.diversityOk}`);
  for (const [seed, hash] of Object.entries(result.referenceTimelineBySeed)) {
    console.log(`seed timeline hash ${seed}: ${hash}`);
  }
  if (result.failures.length) {
    for (const f of result.failures) console.log(`FAIL: ${f}`);
    process.exitCode = 1;
  }
}

main();
