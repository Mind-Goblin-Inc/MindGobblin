# Goblin Simulation Plan

## Goal
Build a DnD-flavored goblin world simulation where small individual goblins live inside a large, changing world.  
Design focus is **state + causality + emergent stories**, not scripted quests.

## Design Principles
- Simulate truth, not just outcomes.
- Every goblin is an individual (memory, temperament, relationships, injuries).
- Systems should collide naturally (logistics, hazards, social tension, scarcity).
- Failure should create stories, not instant game-over screens.
- The world should have history before and after the player’s actions.

---

## 1) World Simulation Layer

### 1.1 World Seed + Regions
- Generate regions with biome tags: marsh, cave, ruins, forest, badlands.
- Generate resources by region: fungi, ore, scrap, beasts, relic chance.
- Generate hazards by region: cave-ins, blight, raiders, cursed weather.

### 1.2 Settlements + Factions
- Build nearby sites: goblin camps, human villages, ruined towers, dungeons.
- Each site gets stance toward player tribe: friendly, wary, hostile, predatory.
- Factions have goals (trade, conquest, survival, artifact hunting).

### 1.3 Historical Simulation
- Simulate pre-game years:
  - faction rise/fall
  - relic creation/loss
  - wars, raids, betrayals
  - legendary creature sightings
- Store history log so current events have context and motives.

---

## 2) Goblin Individual Simulation

### 2.1 Identity
- Unique name, age band, origin, quirks, role affinity.
- Stats: `brawn`, `cunning`, `craft`, `nerve`, `luck`, `social`.

### 2.2 Needs + Mood
- Needs: hunger, rest, safety, belonging, greed.
- Mood model: calm -> irritable -> unstable -> volatile.
- Mood affects reliability, conflict chance, and work speed.

### 2.3 Memory + Trauma
- Goblins record notable memories with emotional weight.
- Repeated bad stimuli can reinforce stress patterns.
- Positive events can stabilize mood and loyalty.

### 2.4 Relationships
- Track affinity/grudges/family bonds.
- Events update relationship graph.
- Social state influences cooperation and fight risk.

---

## 3) Fortress/Camp Logistics Layer

### 3.1 Spatial Throughput
- All jobs happen at locations with travel cost.
- Time lost to hauling/pathing is part of gameplay.
- Bottlenecks become visible and fixable.

### 3.2 Resource Pipeline
- Input -> transform -> store -> consume/sell.
- Example chains:
  - forage -> food -> meals
  - ore -> smelt -> tools/weapons
  - scrap -> tinker -> contraptions

### 3.3 Work System
- Job board with priorities + eligibility.
- Assignment based on skill, mood, injuries, distance.
- Interruptions and cancellations are simulated and logged.

---

## 4) Dynamic World Pressure

### 4.1 Event Engine
- Event deck driven by world state, faction tension, scarcity, season.
- Event choices have tradeoffs and persistent consequences.
- Examples: trader dispute, cave breach, hostage bargain, relic rumor.

### 4.2 Threat Layer
- Raids, beasts, disease, fire, structural collapse.
- Threats target weak points (stored wealth, defenses, morale).

### 4.3 Cascading Failure Design
- Small issues can propagate:
  - injury -> labor shortage -> food delay -> mood crash -> conflict.
- This is intentional and should be explainable in logs.

---

## 5) Combat + Medical Aftermath

### 5.1 Combat Model (MVP)
- Hit zones instead of plain HP buckets.
- Effects: bleeding, stun, broken limb, fear, retreat.
- Gear quality and material influence results.

### 5.2 Medical System
- Recovery requires supplies and care jobs.
- Untreated wounds can worsen (infection/permanent debuffs).
- Aftermath influences tribe mood and future readiness.

---

## 6) Lore + Retrieval

### 6.1 Chronicle
- Keep a queryable timeline of important actions.
- Every major item/fight/event has provenance.

### 6.2 Artifacts + Named Objects
- Rare items get names and history entries.
- Ownership and theft history persist.

### 6.3 Explainability
- Player can inspect: “why did this happen?”
- Surface chain-of-cause in UI (not just random text).

---

## 7) Data Model (Web First)

## Core State
- `world`: regions, sites, factions, weather, history cursor.
- `tribe`: resources, structures, policies, defenses.
- `goblins[]`: identity, stats, needs, memories, relationships, status.
- `jobs[]`: queued/active/completed/failed with reason.
- `items[]`: inventory and world item instances.
- `events[]`: pending/active/resolved.
- `combat[]`: active and historical encounters.
- `chronicle[]`: append-only story records.

## Persistence
- Start with localStorage snapshots.
- Add versioned save schema + migration function.
- Later: optional server account sync.

---

## 8) UI Plan

### 8.1 User-First Principle
The player should never wonder:
1. What changed?
2. Why did it happen?
3. What can I do next?

If any screen cannot answer all 3 quickly, that screen is incomplete.

### 8.2 Home Screen Contract (Always-On)
- Top bar:
  - sim speed, pause state, date/season, alert count.
  - clear indicator when auto-pause is active and why.
- Left panel:
  - goblin roster with compact status chips (mood, health, assignment, location).
  - click opens deeper inspect drawer.
- Center:
  - primary world/camp map canvas.
  - designations/intent overlays visible directly on map.
- Right panel:
  - active problems, jobs/work orders, resources, structures.
  - each card has direct actions and zoom-to-context.
- Bottom panel:
  - chronicle/event feed with filters and severity.
  - every row supports “why?” trace and jump-to-source.

### 8.3 Intent Layer (Player Input Model)
Player actions should create *intentions*, not instant outcomes.

Core tools:
- designations:
  - dig/build/zone/harvest/patrol/forbid/priority paint.
- orders:
  - produce X, maintain stock of Y, move/forbid items, assign roles.
- policies:
  - safety posture, labor policy, stockpile rules, alert responses.

Interaction pattern for all tools:
1. Choose tool.
2. Paint/place/select target.
3. Confirm intent.
4. Sim executes asynchronously.
5. Feedback appears in map + feed + inspect.

### 8.4 Problem Feed (Curated, Actionable)
Use a triaged feed, not raw spam:
- `Urgent`: immediate failure risk (starvation, raid breach, medical collapse).
- `Warning`: degraded systems (input shortage, blocked routes, missing tools).
- `Info`: notable state transitions (construction complete, trade arrival, promotion).

Each problem card must include:
- plain-language cause.
- affected entities/locations.
- one-click focus button (camera jump).
- 1-3 suggested fixes.
- optional “auto-fix” where safe.

### 8.5 Explainability UX
Any failure or major event must expose a simple cause chain:
- `Event -> Immediate cause -> Upstream bottleneck -> Possible fix`.

Minimum explainability surfaces:
- job cancellation reason (explicit enum + human message).
- missing dependency highlight (item/path/worker/zone).
- “why did this happen?” trace from chronicle entry.

### 8.6 Inspection Depth (Progressive Disclosure)
- Level 1 (default card): essential facts only.
- Level 2 (expanded): contributing factors and nearby dependencies.
- Level 3 (deep debug): raw state and causality links.

Players should solve most problems at Level 1-2.
Level 3 exists for mastery and debugging, not routine play.

### 8.7 Alerts + Time Control Rhythm
- time controls:
  - pause, 1x, 2x, 4x, 8x.
- auto-pause triggers:
  - new urgent problem.
  - combat start near controlled site.
  - critical resource below threshold.
  - unresolved chain failures crossing configured severity.
- resume UX:
  - “What changed while paused?” summary.
  - clear recommended next action.

### 8.8 UX Acceptance Criteria (Must Pass)
1. In < 5 seconds, player can identify the top 3 current problems.
2. Every urgent card has at least one direct action.
3. Every failed job has a single primary reason plus dependency chain.
4. Clicking any feed item moves camera to relevant map context.
5. No critical event is only visible in raw debug JSON.
6. New players can issue first successful intention in < 60 seconds.
7. “What changed / why / what next” is visible without opening deep debug views.

---

## 9) Implementation Phases

## Phase 0 - Foundation (Deep Technical Blueprint)

### Phase 0 Outcome
- A deterministic simulation core that can run headless or with UI.
- Strictly separated layers: `state`, `simulation`, `effects`, `ui`.
- Versioned save format with migrations and integrity checks.
- Debug tools for replay, diffing, and causality inspection.

### 0.1 Suggested Project Structure
Even if we stay HTML+JS, organize like a small engine:

```txt
wwwroot/goblin-sim/
  index.js                  # bootstraps app
  ui/
    render.js               # DOM rendering only
    bindings.js             # button/input -> actions
  sim/
    store.js                # createStore, dispatch, subscribe
    reducer.js              # pure state transitions
    tick.js                 # deterministic tick pipeline
    rng.js                  # seeded RNG utilities
    ids.js                  # stable id generation
    selectors.js            # read-only derived data
    actions.js              # action creators
    constants.js            # tunables and enums
  sim/systems/
    worldSystem.js
    jobSystem.js
    needSystem.js
    eventSystem.js
    combatSystem.js
    chronicleSystem.js
  persistence/
    saveLoad.js
    migrations.js
    checksum.js
  debug/
    inspector.js            # in-browser debug panel
    replay.js               # record/replay actions + ticks
    snapshots.js            # state snapshots + diff helpers
```

### 0.2 Core Coding Rules
- Reducers and systems must be pure (no DOM, no random globals, no Date.now in reducer).
- All randomness comes from a seeded RNG object stored in state.
- One write path only: `dispatch(action)` -> `reducer` -> `postTick effects`.
- UI reads via selectors; UI never mutates state directly.
- Every state mutation that matters emits a chronicle entry with cause metadata.

### 0.3 State Schema (Engine-Oriented)
Use explicit normalized maps where possible for easy mutation and lookup:

```ts
type Id = string;

interface SimState {
  meta: {
    schemaVersion: number;
    runId: string;
    tick: number;
    simTimeMs: number;
    speed: 0 | 1 | 2 | 4 | 8;
    paused: boolean;
    seed: string;
    rngState: number;
  };
  world: {
    date: { day: number; season: "spring" | "summer" | "autumn" | "winter"; year: number };
    weather: { type: string; intensity: number };
    regionsById: Record<Id, Region>;
    sitesById: Record<Id, Site>;
    factionsById: Record<Id, Faction>;
    activeRegionId: Id;
  };
  tribe: {
    name: string;
    resources: Record<ResourceKey, number>;
    structuresById: Record<Id, Structure>;
    policies: PolicyState;
    threat: { alertLevel: number; lastRaidTick?: number };
  };
  goblins: {
    byId: Record<Id, Goblin>;
    allIds: Id[];
    relationships: Record<string, RelationshipEdge>; // key: "a|b"
  };
  jobs: {
    byId: Record<Id, Job>;
    queue: Id[];
    active: Id[];
    completed: Id[];
    failed: Id[];
  };
  events: {
    pending: SimEvent[];
    active: SimEvent[];
    resolved: SimEvent[];
  };
  combat: {
    encountersById: Record<Id, Encounter>;
    activeIds: Id[];
    resolvedIds: Id[];
  };
  items: {
    byId: Record<Id, ItemInstance>;
    ownership: Record<Id, { ownerType: "tribe" | "goblin" | "site"; ownerId: Id }>;
  };
  chronicle: ChronicleEntry[];
  debug: {
    lastAction?: string;
    lastTickDurationMs?: number;
    lastSystemOrder?: string[];
    warnings: string[];
  };
}
```

If TypeScript is not used, keep this shape in JSDoc typedefs and validate with runtime guards.

### 0.4 Action Model
Split actions into:
- `Command actions` (player intent): `ASSIGN_JOB`, `SET_SPEED`, `PAUSE_TOGGLE`.
- `Simulation actions` (engine progression): `TICK_START`, `TICK_END`, `SYSTEM_EVENT_EMIT`.
- `Persistence/debug actions`: `LOAD_SAVE`, `APPLY_MIGRATION`, `REPLAY_SEEK`.

All actions include:
- `type`
- `payload`
- `meta`: `{ cause, atTick, source, correlationId }`

This makes causality inspectable later.

### 0.5 Tick Pipeline Contract
Implement a fixed-order system pipeline:

```txt
0) preTick housekeeping
1) worldSystem
2) faction/world pressure system
3) jobSystem
4) needs+mood system
5) event trigger/resolution system
6) combat system
7) chronicle aggregation system
8) postTick validation + invariant checks
```

Rules:
- Same input state + seed + actions => same output state.
- Systems return `{ state, emittedEvents[] }`.
- Emitted events are buffered and applied in deterministic order.

### 0.6 Deterministic RNG Strategy
- Store RNG internal state in `state.meta.rngState`.
- Provide helpers:
  - `randFloat(state)`
  - `randInt(state, min, max)`
  - `randChoice(state, arr)`
  - `randWeighted(state, table)`
- Never call `Math.random()` inside simulation code.

### 0.7 Invariants + Validation Layer
Add `validateState(state)` after each tick in dev mode:
- No negative resources unless explicitly allowed.
- Job references must point to existing goblins/sites/items.
- Goblin ids in queues must exist and be unique per list.
- Event states must be mutually exclusive.
- Relationship keys must be canonicalized (`minId|maxId`).

If violations occur:
- push warning in `debug.warnings`
- optionally auto-pause simulation in dev mode.

### 0.8 Save/Load + Schema Migration
Save envelope format:

```json
{
  "schemaVersion": 1,
  "savedAtIso": "2026-02-17T00:00:00Z",
  "checksum": "sha256:...",
  "state": { "...": "..." }
}
```

Rules:
- Always load through migration pipeline:
  - `v1 -> v2 -> v3` incremental migrators.
- Keep migrators pure and idempotent.
- On load failure, preserve raw payload for debugging and fall back to fresh state.

### 0.9 Debug/Developer Tooling (Must-Have in Phase 0)
- Debug panel toggled by hotkey:
  - current tick/time/speed
  - active system name
  - selected goblin raw JSON
  - recent chronicle entries
- Snapshot + diff:
  - capture state every N ticks in ring buffer
  - compare snapshots by key path
- Replay:
  - record player actions + seed
  - re-run from tick 0
  - assert final state hash matches original

### 0.10 Performance Envelope Targets
- MVP target: 20 goblins, 100 jobs, 1000 items, 1 tick/sec.
- Soft budget: < 8ms simulation time per tick on desktop.
- Avoid deep cloning full state each tick; mutate via controlled copy-on-write sections.

### 0.11 Phase 0 Delivery Checklist
1. State schema finalized and documented.
2. `createStore`, reducer, and deterministic tick runner implemented.
3. At least 3 systems running in pipeline with no UI coupling.
4. Save/load with schema version + at least one migration test.
5. Debug inspector with tick stats + warnings + chronicle tail.
6. Replay test: same seed + action stream reproduces identical end-state hash.

## Phase 1 - World Map (Top-Down 2D) (Deep Technical Blueprint)

### Phase 1 Outcome
- A persistent world map exists before colony simulation starts.
- World topology, regions, sites, and routes are generated deterministically from seed.
- The player can inspect the world, evaluate regions, and choose a start site.
- The map is strictly 2D top-down and optimized for simulation clarity.

### 1.1 Design Constraints
- Keep this phase fully 2D (no voxel/3D terrain).
- Favor data-rich map overlays over visual decoration.
- Build this as a reusable substrate for all later phases.

### 1.2 World Representation
- Hybrid structure:
  - region grid (`regionId[][]`) for top-down map rendering.
  - site graph (settlements/ruins/lairs/dungeons).
  - route graph (roads, rivers, tunnels, passes).
- Each region carries:
  - biome, elevation band, moisture, temperature.
  - resource potential (food, ore, salvage, relic chance).
  - hazard pressure (beasts, weather, collapse risk).
  - faction influence vector.

### 1.3 Sub-Phases (Implementation Plan)
1. `P1-A` Deterministic worldgen kernel (seed, hash, version).
2. `P1-B` Region/biome generation + environmental overlays.
3. `P1-C` Site placement + faction ownership seeding.
4. `P1-D` Route network generation + travel cost model.
5. `P1-E` Top-down renderer + camera controls (pan/zoom/minimap).
6. `P1-F` Fog-of-knowledge + scouting intel confidence.
7. `P1-G` Start-site selection + save-state integration.

### 1.4 P1-A Deterministic Worldgen Kernel
- Inputs:
  - `worldSeed`, map size preset, climate preset.
- Outputs:
  - stable `worldMapState`.
  - `worldHash` for replay integrity checks.
- Hard rule:
  - same seed + params => identical world output.

### 1.5 P1-B Region/Biome Generation
- Generate 2D scalar fields (elevation/moisture/temperature).
- Classify regions into biome tags:
  - `forest`, `swamp`, `hills`, `caves`, `ruins`, `badlands`.
- Derive overlays:
  - fertility score
  - ore score
  - hazard score
  - travel difficulty

### 1.6 P1-C Sites + Faction Seeding
- Generate site types:
  - goblin camp, trade outpost, ruin, fortress, den, shrine.
- Site constraints:
  - biome compatibility
  - min distance to similar site
  - strategic viability
- Seed faction presence:
  - owner faction id
  - control strength
  - hostility baseline

### 1.7 P1-D Route/Travel Layer
- Connect sites into traversable graph with route types:
  - road, trail, river, tunnel, pass.
- Route attributes:
  - travel time
  - risk
  - seasonal modifiers
  - faction control
- Provide cached path queries:
  - fastest
  - safest
  - lowest control risk

### 1.8 P1-E Top-Down 2D Renderer
- Render layers:
  - base biome
  - faction influence heatmap
  - route network
  - site markers/icons
- Camera/UI:
  - pan, zoom, reset
  - minimap
  - hover tooltip
  - selected region/site details panel

### 1.9 P1-F Fog-of-Knowledge / Intel
- Track map knowledge confidence per region/site.
- Unknown areas show coarse estimates; known areas show precise stats.
- Confidence decays without scouting updates.

### 1.10 P1-G Start-Site Selection
- Offer multiple spawn candidates with score breakdown:
  - resources
  - safety
  - logistics centrality
  - political pressure
- Persist `startingSiteId` and initial known map state.

### 1.11 Phase 1 Module Additions
```txt
wwwroot/goblin-sim/sim/world/
  worldGen.js               # deterministic generation coordinator
  regionGen.js              # terrain/biome field generation
  siteGen.js                # site placement and metadata
  routeGen.js               # route graph construction
  overlays.js               # derived strategic overlays
  intel.js                  # map knowledge confidence model
wwwroot/goblin-sim/ui/world/
  mapRenderer.js            # 2D top-down map rendering
  camera.js                 # pan/zoom/minimap behavior
  interactions.js           # selection/hover/inspection
```

### 1.12 Phase 1 Data Model (World Map Core)
```ts
interface WorldMapState {
  seed: string;
  genVersion: number;
  size: "small" | "standard" | "large";
  regionGrid: Id[][];
  regionsById: Record<Id, Region>;
  sitesById: Record<Id, Site>;
  routesById: Record<Id, Route>;
  overlays: {
    fertilityByRegion: Record<Id, number>;
    hazardByRegion: Record<Id, number>;
    resourceByRegion: Record<Id, number>;
    influenceByFactionByRegion: Record<Id, Record<Id, number>>;
  };
  intel: {
    knownRegions: Record<Id, { confidence: number; lastUpdatedTick: number }>;
    knownSites: Record<Id, { confidence: number; lastUpdatedTick: number }>;
  };
  player: {
    selectedRegionId?: Id;
    selectedSiteId?: Id;
    startingSiteId?: Id;
  };
}
```

### 1.13 Validation Invariants for Phase 1
- Every site references a valid region.
- Every route endpoint references valid sites.
- Grid cells reference valid region ids.
- Overlay keys are subset of `regionsById`.
- `startingSiteId` (if set) references a valid site.

### 1.14 Phase 1 Delivery Checklist
1. World generation is deterministic and hash-verifiable.
2. Region/biome map renders in 2D top-down with interactive camera.
3. Sites and routes are generated and graph-connected.
4. Influence/resource/hazard overlays are inspectable.
5. Start-site selection is implemented and persisted.
6. Save/load restores identical world + intel state.

### 1.15 Phase 1 User Clarity Checklist
1. Hovering a region shows biome + risk + resource summary in plain language.
2. Selecting a site shows “why this site matters” score breakdown.
3. Overlay legend is always visible (player knows what colors mean).
4. Camera jump controls exist from alerts/feed to map context.
5. Unknown/intel-fog areas clearly distinguish estimate vs known data.
6. Start-site selection screen explains tradeoffs before confirmation.

## Phase 2 - Living Goblins (Deep Technical Blueprint)

### Phase 2 Outcome
- Goblins become full simulation agents (not worker counters).
- Each goblin has layered stats, traits, needs, memories, and social edges.
- Job assignment uses suitability + current state, not fixed class roles.
- Every goblin state change is chronicle-visible and explainable.

### 2.0 Phase 2 UX Contract
- Players do not micromanage each goblin step-by-step.
- Players set role/zone/order intent; goblins execute and report friction.
- Every goblin failure state is surfaced with cause + fix suggestion.
- Important goblin state changes become readable story beats in feed/chronicle.

### 2.1 Phase 2 Module Additions
```txt
wwwroot/goblin-sim/sim/
  goblinFactory.js          # procedural goblin creation
  goblinProgression.js      # xp, stat growth, trait evolution
  relationships.js          # affinity/grudge/family updates
  needsModel.js             # decay/recovery formulas
  moraleModel.js            # mood state transitions
  memoryModel.js            # memory creation + decay + triggers
  suitability.js            # job fit scoring
```

### 2.2 Goblin Data Model (Extensible)
Use a model that supports adding new systems without migrations every week.

```ts
interface Goblin {
  id: Id;
  identity: {
    name: string;
    nickname?: string;
    pronouns?: string;
    ageStage: "whelp" | "adult" | "elder";
    originSiteId?: Id;
    lineage: { clan?: string; parentIds?: Id[] };
    tags: string[]; // e.g. ["caveborn","left-handed","superstitious"]
  };

  coreStats: {
    brawn: number;          // carrying, melee force, construction
    agility: number;        // movement, dodge, finesse
    cunning: number;        // deception, tactics, traps
    craft: number;          // quality output for making jobs
    grit: number;           // pain/fatigue resistance
    will: number;           // morale stability under pressure
    luck: number;           // variance bias in risky outcomes
    social: number;         // mediation, leadership, cohesion
    perception: number;     // scouting, detection, awareness
  };

  aptitudes: {
    scavenging: number;
    mining: number;
    smithing: number;
    tinkering: number;
    alchemy: number;
    stealth: number;
    scouting: number;
    medicine: number;
    cooking: number;
    animalHandling: number;
    ritualism: number;
    bargaining: number;
    intimidation: number;
    lorekeeping: number;
    siegecraft: number;
  };

  skills: Record<string, { level: number; xp: number; rust: number }>;

  traits: {
    personality: Record<string, number>; // 0..100 facets
    quirks: string[];                    // e.g. "coin-clicker", "fungus-sniffer"
    virtues: string[];                   // e.g. "loyal", "patient"
    flaws: string[];                     // e.g. "jealous", "reckless"
    fears: string[];                     // e.g. "fire", "spiders", "deep water"
    ideals: string[];                    // e.g. "wealth", "glory", "clan honor"
  };

  body: {
    sizeClass: "small" | "medium";
    health: {
      vitality: number;    // global condition
      pain: number;
      bleeding: number;
      infection: number;
      disease?: string[];
    };
    injuries: InjuryRecord[];
    conditions: string[];  // e.g. "hungry", "sleep-deprived", "tipsy"
  };

  needs: {
    hunger: number;
    thirst: number;
    rest: number;
    warmth: number;
    safety: number;
    belonging: number;
    autonomy: number;
    esteem: number;
    greed: number;
    novelty: number;
  };

  psyche: {
    stress: number;
    morale: number;
    volatility: number;
    resilience: number;
    traumaLoad: number;
    moodState: "stable" | "frayed" | "agitated" | "volatile" | "breaking";
  };

  social: {
    role?: "chief" | "foreman" | "raider" | "crafter" | "shaman" | "runner";
    statusScore: number;
    loyalty: number;
    factionReputation: Record<Id, number>;
    bonds: Id[];           // friendly links
    grudges: Id[];         // hostile links
    family: Id[];
  };

  equipment: {
    toolSlots: Record<string, Id | null>;
    armorSlots: Record<string, Id | null>;
    trinkets: Id[];
  };

  assignment: {
    currentJobId?: Id;
    preferredJobs: string[];
    bannedJobs: string[];
    shift: "day" | "night" | "any";
    locationId?: Id;
  };

  progression: {
    level: number;
    xp: number;
    perks: string[];
    milestones: string[];
  };

  memory: {
    recent: MemoryEntry[];
    notable: MemoryEntry[];
    triggers: Record<string, number>; // e.g. "saw-corpse": 0.7
  };

  flags: {
    alive: boolean;
    missing: boolean;
    imprisoned: boolean;
    exiled: boolean;
  };
}
```

Notes:
- Keep optional extension buckets: `modData?: Record<string, unknown>`.
- Prefer additive schema evolution so old saves remain valid.

### 2.3 Goblin Generation Pipeline
Pipeline:
1. Roll base archetype weights by region/culture.
2. Generate identity + lineage tags.
3. Roll stat distributions with capped variance.
4. Roll aptitudes and 2-4 standout strengths.
5. Assign 2 virtues, 1-2 flaws, 1 fear, 1 ideal.
6. Seed initial needs/psyche from world conditions.
7. Attach 1-3 starter memories (migration, fight, scarcity, trade).
8. Emit chronicle entry: `GOBLIN_CREATED`.

Generation inputs:
- world biome/site
- tribe policy profile
- seed + run id

### 2.4 Needs, Mood, and Memory Mechanics
- Needs decay per tick using rate tables + modifiers.
- Mood update is a finite-state machine with hysteresis (prevents rapid flipping).
- Memory events carry:
  - `type`, `subjectId`, `intensity`, `valence`, `timestampTick`, `decayHalfLife`.
- Trigger model:
  - encountering matching stimuli amplifies stress or morale based on valence.
- Positive loops must exist (feasts, successful jobs, friendship events).

### 2.5 Relationship Graph Rules
- Canonical edge key: `min(g1,g2)|max(g1,g2)`.
- Edge attributes:
  - `affinity`, `trust`, `fear`, `resentment`, `debt`, `historyWeight`.
- Edge updates from shared jobs, conflict, aid, gossip events.
- Graph summaries produce tribe-level cohesion metrics.

### 2.6 Job Framework (Beyond Basic Jobs)
Represent jobs as data-driven definitions, not hard-coded branches.

```ts
interface JobDef {
  key: string;
  domain: "survival" | "industry" | "security" | "social" | "arcane" | "exploration";
  requiredAptitudes: string[];
  requiredTools?: string[];
  riskProfile: { injury: number; stress: number; conflict: number };
  baseDurationTicks: number;
  outputs: JobOutputRule[];
  failureModes: FailureRule[];
  suitabilityWeights: Record<string, number>;
}
```

Initial Phase 2 job families:
- Survival: forage, cook, brew, water-fetch, infirmary-aid.
- Industry: mine, smelt, tinker, stitch, salvage-sort, repair.
- Security: patrol, guard, trap-reset, scout-perimeter.
- Social: mediate-dispute, morale-storytelling, train-whelps.
- Arcane/Ritual: omen-reading, ward-inscribing, curse-cleansing.
- Exploration: ruin-scouting, tunnel-probing, relic-expedition (short form).

### 2.7 Suitability Scoring
Per goblin, per job:
- `score = aptitudeFit + personalityFit + currentNeedPenalty + injuryPenalty + relationshipContext + travelCost`.
- Keep score explainability object for UI:
  - `{ total, components: { craft:+12, hunger:-8, fear_fire:-15 } }`.

### 2.8 Phase 2 Systems in Tick Pipeline
Add/expand systems:
1. `goblinNeedDecaySystem`
2. `goblinMoodTransitionSystem`
3. `goblinMemorySystem`
4. `relationshipDriftSystem`
5. `jobSuitabilityCacheSystem`

Each system emits structured events consumed by `chronicleSystem`.

### 2.9 Persistence + Migration Notes for Phase 2
- Introduce `schemaVersion` bump for goblin model.
- Migration adds defaults for new nested keys (`aptitudes`, `traits`, `memory.triggers`, etc).
- Maintain backward-compatible parser for older minimal goblin saves.

### 2.10 Phase 2 Validation Invariants
- Every goblin has valid `moodState`.
- Needs and psyche fields are clamped to configured ranges.
- `currentJobId` must reference existing job in active/queue.
- Relationship edges must be symmetric by key.
- Dead/missing goblins cannot be assigned work.

### 2.11 Phase 2 Delivery Checklist
1. Goblin schema implemented + documented in code.
2. Deterministic goblin generator with seed tests.
3. Needs/mood/memory systems integrated into tick pipeline.
4. Relationship graph updates working from shared events.
5. Data-driven job definitions with suitability scoring.
6. Debug inspector can open a goblin card with full breakdown.
7. Chronicle includes goblin-centric entries (stress spikes, conflicts, breakthroughs).

## Phase 3 - Logistics + Economy (Deep Technical Blueprint)

### Phase 3 Outcome
- Camp operations behave like a living throughput network.
- Distance, hauling capacity, and storage policy materially affect outcomes.
- Production chains are data-driven and expandable.
- Shortages and bottlenecks are diagnosable and narratively legible.

### 3.1 Phase 3 Module Additions
```txt
wwwroot/goblin-sim/sim/
  logistics/
    mapGraph.js             # nodes/edges + travel cost computation
    pathing.js              # route finding + cache
    hauling.js              # pickup/dropoff task generation
    stockpiles.js           # storage rules, reservations, priorities
    throughput.js           # bottleneck metrics and flow rates
  economy/
    recipes.js              # transformation definitions
    production.js           # chain execution engine
    market.js               # prices, buy/sell pressure, scarcity multipliers
    decay.js                # spoilage, quality loss, breakage
```

### 3.2 Logistics Data Model
Add structured state for movement and material flow:

```ts
interface LogisticsState {
  map: {
    nodesById: Record<Id, MapNode>;
    edgesById: Record<Id, MapEdge>;
    zonesById: Record<Id, Zone>;
    blockedEdges: Id[];
  };
  stockpiles: {
    byId: Record<Id, Stockpile>;
    reservations: Record<Id, Reservation>; // item/resource locked for a job
  };
  hauling: {
    tasksById: Record<Id, HaulTask>;
    queue: Id[];
    active: Id[];
    failed: Id[];
  };
  throughput: {
    movingAverageByResource: Record<string, number>;
    bottlenecks: BottleneckReport[];
    lastAnalysisTick: number;
  };
}

interface Stockpile {
  id: Id;
  zoneId: Id;
  accepts: ResourceFilter[];
  rejects: ResourceFilter[];
  priority: number;
  capacity: { slots: number; weight: number; volume: number };
  current: { slots: number; weight: number; volume: number };
  qualityPolicy: "any" | "high-only" | "low-only";
  spoilagePolicy: "normal" | "cool" | "sealed";
}

interface Reservation {
  id: Id;
  resourceKey: string;
  quantity: number;
  holderType: "job" | "haul";
  holderId: Id;
  expiresAtTick: number;
}
```

### 3.3 Spatial + Pathing Model
- Represent camp as graph, not freeform pixel movement.
- Node types: workshop, stockpile, entrance, dorm, hospital, market, hazard.
- Edge properties:
  - `baseCost`
  - `capacity` (how many goblins can traverse concurrently)
  - `hazardPenalty` (injury/stress modifiers)
  - `blockedUntilTick` (dynamic closures)
- Path cache:
  - keyed by `(fromNodeId,toNodeId,policyHash)`
  - invalidated on topology change/hazard update.

### 3.4 Hauling System Contract
Hauling is first-class, not implicit:
- Jobs do not teleport resources.
- For each production job:
  1. reserve required inputs
  2. generate haul tasks (from stockpile/source to workstation)
  3. await completion or timeout
- Output haul tasks move results to best-fit destination.

Haul task fields:
- `item/resource`, `qty`, `fromNodeId`, `toNodeId`
- `priority`, `deadlineTick`, `assignedGoblinId?`
- `failureReason?` (`NO_PATH`, `RESOURCE_LOST`, `RESERVATION_EXPIRED`, etc)

### 3.5 Resource Chain/Recipe Model
Define all transformations as data:

```ts
interface RecipeDef {
  key: string;
  domain: "food" | "metal" | "tinker" | "arcane" | "construction";
  stationType: string;
  inputs: Array<{ key: string; qty: number; qualityMin?: number }>;
  outputs: Array<{ key: string; qty: number; qualityCurve?: string }>;
  byproducts?: Array<{ key: string; qty: number }>;
  baseDurationTicks: number;
  laborIntensity: number;
  heatRequired?: boolean;
  failureTable?: FailureOutcome[];
}
```

Rules:
- Recipes can be interrupted and resumed.
- Partial progress decays over time for sensitive processes.
- Quality of inputs affects output quality and value.

### 3.6 Economic Simulation Layer
- Tribe economy:
  - tracked inventory value, burn rate, runway estimate.
- External market:
  - price curves by scarcity and faction demand.
  - periodic market shocks (famine, war, caravan glut).
- Resource classes:
  - staple, strategic, luxury, ritual, unstable.

Core equations (configurable):
- `effectivePrice = basePrice * scarcityMult * relationMult * urgencyMult`
- `jobCost = laborCost + inputCost + transportCost + riskPremium`
- `profit = outputValue - jobCost - spoilageLoss`

### 3.7 Bottleneck Diagnostics
Build automatic diagnostics each N ticks:
- queue pressure by job domain
- average haul wait time
- path congestion heat map
- stockpile overflow/underflow
- reservation timeout counts

Emit `BottleneckReport`:
- `type`: `"hauling" | "storage" | "pathing" | "labor" | "recipe-input"`
- `severity`: 1-5
- `primaryNodeIds`
- `suspectedRootCause`
- `suggestedFixes[]`

### 3.8 Failure Cascade Model
Implement explicit propagation rules:
- Missed food throughput -> hunger spike -> mood drop -> lower labor speed.
- Smelter input shortage -> weapon delay -> defense gap during raid.
- Overfull stockpile -> haul deadlock -> recipe starvation.

Each propagation step should add chronicle links:
- `causeEntryId` -> `effectEntryId`.

### 3.9 Tick Pipeline Additions (Phase 3)
Add systems/order:
1. `reservationExpirySystem`
2. `haulingPlannerSystem`
3. `pathAssignmentSystem`
4. `productionSystem`
5. `stockpileBalancingSystem`
6. `economyValuationSystem`
7. `throughputAnalysisSystem`

All must remain deterministic and pure with explicit emitted events.

### 3.10 Job Failure Reason Taxonomy
Standardize failure enums for analytics and UI:
- `NO_INPUTS_RESERVED`
- `INPUTS_SPOILED`
- `NO_PATH_TO_SOURCE`
- `NO_PATH_TO_DESTINATION`
- `HAUL_CAPACITY_STARVED`
- `WORKSTATION_DAMAGED`
- `WORKER_INCAPACITATED`
- `HAZARD_LOCKDOWN`
- `TIMEOUT_WAITING_FOR_DEPENDENCY`

### 3.11 Persistence + Migration Notes for Phase 3
- Add `logistics` state block and recipe progress tracking.
- Migrate old saves by:
  - creating default stockpile definitions
  - mapping existing inventory to nearest valid storage nodes
  - initializing throughput counters to neutral values.

### 3.12 Validation Invariants for Phase 3
- Reserved quantity cannot exceed total available.
- No item can be simultaneously in two locations.
- Every active job with inputs has valid reservation ids.
- Path references must point to existing nodes/edges.
- Stockpile `current` metrics cannot exceed capacity unless flagged overflow.

### 3.13 Phase 3 Delivery Checklist
1. Graph-based travel + path cache implemented.
2. Hauling tasks generated and resolved deterministically.
3. Recipe engine supports inputs/outputs/byproducts/failure.
4. Stockpile rules and reservations prevent teleport exploits.
5. Economy valuation and market multipliers working.
6. Bottleneck analyzer produces actionable reports.
7. At least one multi-step failure cascade is reproducible via replay.

## Phase 4 - Events + Factions (Deep Technical Blueprint)

### Phase 4 Outcome
- The world starts acting back: factions pursue goals and pressure the player.
- Events are condition-driven, stateful, and consequence-rich (not random popups).
- Trade, diplomacy, coercion, and raids emerge from faction intent + world context.
- Event outcomes become persistent world facts with retrievable causal chains.

### 4.1 Phase 4 Module Additions
```txt
wwwroot/goblin-sim/sim/
  factions/
    factionState.js         # faction data + derived posture
    factionAI.js            # intent generation + plan updates
    diplomacy.js            # relations, treaties, threats, tribute
    tradeAI.js              # caravan offers + demand shaping
    raidPlanner.js          # target selection + raid composition
  events/
    eventDefs.js            # event templates
    triggerEngine.js        # condition matching + scoring
    eventLifecycle.js       # pending -> active -> resolved
    choiceResolver.js       # player/npc choice effect resolution
    cooldowns.js            # anti-spam + memory windows
```

### 4.2 Faction Data Model
Define factions as strategic agents with memory:

```ts
interface Faction {
  id: Id;
  identity: {
    name: string;
    kind: "goblin-clan" | "human-barony" | "cult" | "mercenary-band" | "beast-horde";
    doctrineTags: string[]; // e.g. "expansionist", "mercantile", "vengeful"
    leaderId?: Id;
  };
  territory: {
    homeSiteIds: Id[];
    influenceByRegion: Record<Id, number>;
    routeControlByEdge: Record<Id, number>;
  };
  power: {
    military: number;
    economy: number;
    logistics: number;
    stability: number;
    intel: number;
  };
  resources: Record<string, number>;
  needs: {
    foodPressure: number;
    wealthPressure: number;
    safetyPressure: number;
    prestigePressure: number;
    vengeancePressure: number;
  };
  diplomacy: {
    relationsByFaction: Record<Id, RelationState>;
    treaties: Treaty[];
    grievances: Grievance[];
    debts: DebtRecord[];
    trustByFaction: Record<Id, number>;
    fearByFaction: Record<Id, number>;
  };
  intent: {
    strategicGoal:
      | "expand"
      | "stabilize"
      | "enrich"
      | "retaliate"
      | "survive"
      | "hunt-artifacts";
    targetFactionId?: Id;
    targetSiteId?: Id;
    priorityScore: number;
    planExpiresTick: number;
  };
  memory: {
    notableEvents: Array<{ eventId: Id; valence: number; weight: number; tick: number }>;
    playerHistoryScore: number; // aggregate goodwill/hostility toward player tribe
  };
}
```

### 4.3 Reputation + Relationship Model
- Separate dimensions (not one scalar):
  - `trust`, `fear`, `respect`, `resentment`, `tradeAffinity`.
- Player actions modify dimensions differently:
  - paid debt -> +trust, +tradeAffinity
  - raid success -> +fear, -trust, +resentment
  - honoring pact -> +respect, +trust
- Derived posture bucket:
  - `ally`, `neutral`, `uneasy`, `hostile`, `blood-feud`.

### 4.4 Event Definition Schema
Events should be data-driven and support branching:

```ts
interface EventDef {
  key: string;
  category: "diplomacy" | "trade" | "raid" | "internal" | "omen" | "disaster";
  trigger: TriggerSpec;
  weight: number;
  cooldownTicks: number;
  maxConcurrent: number;
  participants: ParticipantRule[];
  contextBuilder: string; // resolver key
  choices: EventChoiceDef[];
  timeoutBehavior?: "auto-resolve" | "default-choice" | "expire";
  tags: string[];
}

interface EventChoiceDef {
  key: string;
  label: string;
  requirements?: RequirementSpec[];
  successRoll?: RollSpec;
  effectsOnSuccess: EffectSpec[];
  effectsOnFailure?: EffectSpec[];
  aiPreferenceModel?: string;
}
```

### 4.5 Trigger Engine Design
- Inputs:
  - current state snapshot
  - rolling windows (last N ticks of scarcity/combat/trade)
  - faction intent table
- Trigger stages:
  1. candidate filtering (cheap predicates)
  2. contextual scoring (weighted factors)
  3. cooldown + dedupe checks
  4. deterministic tie-break with seeded RNG
- Include anti-noise gates:
  - per-category max frequency
  - “recently seen” dampening
  - tension budget (avoid firing too many high-impact events together).

### 4.6 Event Lifecycle
State machine:
- `draft` -> `pending` -> `active` -> `resolving` -> `resolved` -> `archived`.

Lifecycle metadata:
- `createdTick`, `expiresTick`, `resolvedTick`
- `originCauseIds[]` (links to chronicle entries)
- `impactedEntities[]`
- `outcomeSeverity` 1..5

### 4.7 Faction AI Planning Loop
At defined intervals (e.g., every 20 ticks):
1. recompute faction pressures (`food`, `wealth`, `vengeance`, etc)
2. score strategic goals
3. choose intent + target
4. enqueue actions/events consistent with capacity and cooldown

Action families:
- diplomacy: envoy, demand, pact, threat, apology
- economy: caravan, embargo, market manipulation
- military: probe raid, full raid, blockade, border pressure
- intrigue: spy insertion, rumor spread, sabotage contracts

### 4.8 Trade Interaction System
- Trade offers generated from:
  - faction surplus/deficit
  - relationship dimensions
  - route safety + distance cost
- Offer object includes:
  - proposed items/resources
  - requested return
  - optional clauses (ceasefire, tribute discount, escort fee)
- Trade failures become relation events (not silent no-ops).

### 4.9 Raid Interaction System
- Raid planner uses:
  - target value estimate
  - defenses estimate
  - travel risk
  - revenge pressure
- Raid can be:
  - warning skirmish
  - theft strike
  - punitive assault
- Each raid emits pre-raid omen events if faction has intel leak risk.

### 4.10 Choice Resolution + Consequence Graph
- Every event choice writes a consequence package:
  - immediate effects (resources, injuries, relation deltas)
  - delayed effects (scheduled future events)
  - narrative effects (grievance added, treaty changed, vow formed)
- Use correlation ids to chain follow-up consequences in chronicle.

### 4.11 Tick Pipeline Additions (Phase 4)
Add systems/order:
1. `factionPressureUpdateSystem`
2. `factionIntentPlannerSystem`
3. `eventTriggerSystem`
4. `eventActivationSystem`
5. `eventChoiceAutoResolveSystem` (timeouts/NPC decisions)
6. `diplomacyStateUpdateSystem`
7. `tradeAndRaidQueueSystem`

### 4.12 Failure and Exploit Controls
- Prevent infinite event loops:
  - event recursion depth cap
  - same key cannot trigger itself within lockout window
- Prevent relation exploits:
  - diminishing returns on repeated gifts
  - trust floors when grievances unresolved
- Prevent deterministic deadlocks:
  - fallback random low-impact events when no candidate valid for too long.

### 4.13 Persistence + Migration Notes for Phase 4
- Add `factions.intent`, `events.lifecycle`, and relation dimension fields.
- Migrate legacy reputation scalar into dimension vector with defaults.
- Persist cooldown state and trigger windows to avoid load-scumming exploits.

### 4.14 Validation Invariants for Phase 4
- No event can be in multiple lifecycle buckets simultaneously.
- Active event participants must reference valid entities.
- Relation dimensions stay within configured bounds.
- Treaties reference existing factions and have valid dates/conditions.
- Faction intent target ids must exist or be null.

### 4.15 Phase 4 Delivery Checklist
1. Multi-dimensional faction relation model implemented.
2. Faction planning loop produces stable intents.
3. Trigger engine supports weighted conditional events with cooldowns.
4. Branching event choice resolution works with success/failure outcomes.
5. Trade and raid interactions flow from faction intent (not hardcoded scripts).
6. Chronicle can display cause -> event -> consequence chains.
7. Replay test verifies deterministic event ordering with same seed/action stream.

## Phase 5 - Combat + Recovery (Deep Technical Blueprint)

### Phase 5 Outcome
- Combat produces persistent consequences, not disposable HP bar exchanges.
- Injuries, treatment capacity, and recovery logistics affect future simulation performance.
- Battles influence morale, relationships, faction posture, and event pressure.
- Every combat outcome is explainable and replay-deterministic.

### 5.1 Phase 5 Module Additions
```txt
wwwroot/goblin-sim/sim/
  combat/
    encounterBuilder.js     # compose combatants, terrain tags, intent
    initiative.js           # turn ordering and action timing
    targeting.js            # target selection and threat scores
    hitResolution.js        # hit/miss, penetration, body zone results
    damageModel.js          # injury generation + condition updates
    moraleCombat.js         # panic, rout, rally checks
    retreatLogic.js         # disengage/chase outcomes
  medical/
    triage.js               # treatment priority scoring
    treatmentJobs.js        # assign healers and aid tasks
    recoveryModel.js        # healing over time, complications
    suppliesModel.js        # bandages, herbs, antiseptics, splints
    scarsDisability.js      # long-term effects and adaptations
```

### 5.2 Combat Data Model
Add robust encounter state:

```ts
interface CombatState {
  encountersById: Record<Id, Encounter>;
  activeIds: Id[];
  resolvedIds: Id[];
  medicalQueue: MedicalCase[];
}

interface Encounter {
  id: Id;
  createdTick: number;
  phase: "staging" | "engaged" | "retreat" | "resolved";
  locationNodeId: Id;
  terrainTags: string[]; // e.g. "narrow", "muddy", "elevated", "dark"
  sides: Array<{ sideId: string; entityIds: Id[]; factionId?: Id; morale: number }>;
  initiative: InitiativeEntry[];
  actionLog: CombatActionRecord[];
  casualties: CasualtyRecord[];
  outcome?: {
    winnerSideId?: string;
    resolvedTick: number;
    lootItemIds: Id[];
    prisoners: Id[];
    retreatingSideIds: string[];
  };
  correlationId: string;
}

interface InjuryRecord {
  id: Id;
  goblinId: Id;
  zone: "head" | "torso" | "armL" | "armR" | "legL" | "legR";
  type: "bruise" | "cut" | "puncture" | "fracture" | "burn" | "infection" | "trauma";
  severity: 1 | 2 | 3 | 4 | 5;
  bleedingRate: number;
  painImpact: number;
  mobilityImpact: number;
  treatmentNeeded: string[];
  createdTick: number;
  healedTick?: number;
  permanentEffect?: string;
}

interface MedicalCase {
  id: Id;
  goblinId: Id;
  injuryIds: Id[];
  triagePriority: number;
  status: "waiting" | "assigned" | "in-treatment" | "stabilized" | "failed";
  assignedHealerId?: Id;
  requiredSupplies: Record<string, number>;
  deadlineTick: number;
}
```

### 5.3 Zone-Based Hit Resolution
Hit resolution pipeline:
1. action intent selected (strike, shove, guard, flee, support).
2. hit chance computed from attacker skill + defender stance + terrain + conditions.
3. if hit, zone roll weighted by stance/armor exposure.
4. penetration roll by weapon profile vs armor/material.
5. injury record(s) generated with severity and side effects.
6. immediate condition updates (bleed, pain, stagger, disarm, panic).

Use data tables:
- `weaponProfiles`
- `armorProfiles`
- `zoneExposureByStance`
- `injuryOutcomeByDamageType`

### 5.4 Combatant Action Taxonomy
Minimum action set:
- Offensive: quick strike, heavy strike, aimed strike, grapple, throw.
- Defensive: brace, dodge, guard ally, fallback.
- Utility: rally ally, taunt, apply field aid, reposition.
- Exit: retreat attempt, cover retreat.

Action selection score should consider:
- personality (reckless vs cautious),
- morale state,
- injuries,
- tactical role,
- immediate threat.

### 5.5 Morale + Cohesion in Combat
- Per-combatant `combatMorale` separate from global mood.
- Morale triggers:
  - ally downed nearby
  - leader wounded/killed
  - outnumbered threshold crossed
  - successful rally action
- States: `steady`, `shaken`, `wavering`, `routing`.
- Routing can produce casualties during disengage.

### 5.6 Recovery + Medical Loop
Post-encounter:
1. generate medical cases for wounded.
2. triage system sorts by survivability x urgency.
3. treatment jobs consume supplies and healer time.
4. unresolved cases risk complications (infection, chronic pain, disability).

Treatment quality factors:
- healer medicine skill
- facility quality
- supply completeness
- elapsed time before first care

### 5.7 Long-Term Consequences
- Injuries can leave persistent modifiers:
  - movement penalty
  - reduced carrying capacity
  - fear trigger amplification
  - scar status effects (respect/fear/social reactions)
- Recovery milestones emit memories (positive or traumatic).
- Rehabilitation jobs can reduce long-term penalties.

### 5.8 Post-Battle Social + Faction Effects
- Internal:
  - grief and pride waves alter morale/social graph.
  - survivors form stronger bonds or resent leadership decisions.
- External:
  - faction reputation shifts (fear/respect/resentment/trust).
  - victory/defeat influences future raid probability and diplomacy posture.

### 5.9 Tick Pipeline Additions (Phase 5)
Add systems/order:
1. `encounterActivationSystem`
2. `initiativeSystem`
3. `combatActionResolutionSystem`
4. `combatMoraleSystem`
5. `retreatAndOutcomeSystem`
6. `medicalCaseGenerationSystem`
7. `triageAndTreatmentSystem`
8. `recoveryProgressSystem`

### 5.10 Combat Failure Reason Taxonomy
Standardize failure enums:
- `NO_VALID_TARGET`
- `OUT_OF_RANGE`
- `ACTION_INTERRUPTED`
- `WEAPON_BROKEN`
- `PANIC_ABORT`
- `RETREAT_BLOCKED`
- `BLEEDOUT`
- `TREATMENT_TIMEOUT`
- `SUPPLY_SHORTAGE`
- `HEALER_UNAVAILABLE`

### 5.11 Balance Controls + Guardrails
- Cap one-shot lethality for common units (except extreme events).
- Ensure treatment can realistically prevent total collapse if prepared.
- Add pacing controls:
  - encounter cooldown windows
  - raid fatigue on factions
  - threat scaling by tribe readiness, not just raw wealth.

### 5.12 Persistence + Migration Notes for Phase 5
- Persist active encounters and in-progress treatment jobs.
- Persist unresolved injury records and scheduled recovery ticks.
- Migration from pre-combat versions:
  - initialize empty `medicalQueue`
  - convert legacy “hp” style wounds into injury records.

### 5.13 Validation Invariants for Phase 5
- Combatant ids in encounters must exist and be alive at engagement start.
- No injury references missing goblin ids.
- Medical case injury ids must belong to the same goblin.
- Resolved encounters cannot remain in active queues.
- Retreating side cannot also be marked winner unless both retreat (draw case).

### 5.14 Phase 5 Delivery Checklist
1. Encounter builder and deterministic action resolution working.
2. Zone-based injury generation with persistent injury records.
3. Morale/rout behavior integrated into combat outcomes.
4. Medical triage + treatment jobs functioning with supply consumption.
5. Recovery progression supports complications and long-term effects.
6. Post-battle social/faction deltas emitted and logged.
7. Replay test verifies identical combat outcomes for same seed/action stream.

## Phase 6 - Lore Depth (Deep Technical Blueprint)

### Phase 6 Outcome
- The simulation becomes legible as a living history, not just current-state numbers.
- Named artifacts and major actors carry persistent provenance across ownership, events, and locations.
- Players can query “what happened, why, and who was involved” through a chronicle browser.
- Event/dialogue generation can reference prior facts deterministically (historical callbacks).

### 6.1 Phase 6 Module Additions
```txt
wwwroot/goblin-sim/
  sim/
    lore/
      artifactIdentity.js     # naming, epithet evolution, rarity weighting
      provenance.js           # ownership chain + transfer records
      chronicleIndex.js       # inverted indexes for timeline queries
      causalityGraph.js       # cause->effect edge tracking
      callbackResolver.js     # historical callback selection for events/dialogue
      legendScoring.js        # how actions become notable/legendary
  ui/
    chronicleBrowser.js       # searchable timeline mode
    artifactInspector.js      # provenance + highlights panel
```

### 6.2 Lore Data Model
Add explicit lore structures to keep history queryable and deterministic:

```ts
interface LoreState {
  artifacts: {
    byId: Record<Id, ArtifactLore>;
    allIds: Id[];
  };
  chronicleIndex: {
    byType: Record<string, Id[]>;
    byGoblinId: Record<Id, Id[]>;
    byFactionId: Record<Id, Id[]>;
    byArtifactId: Record<Id, Id[]>;
    byTickBucket: Record<string, Id[]>;
  };
  causality: {
    edgesById: Record<Id, CausalityEdge>;
    byCauseEntryId: Record<Id, Id[]>;
    byEffectEntryId: Record<Id, Id[]>;
  };
  callbacks: {
    cooldownByKey: Record<string, number>;
    lastResolvedAtTick: number;
  };
}

interface ArtifactLore {
  id: Id;
  displayName: string;
  epithet?: string;
  category: "weapon" | "tool" | "trinket" | "relic" | "document";
  rarityTier: 1 | 2 | 3 | 4 | 5;
  origin: {
    createdTick: number;
    createdSiteId?: Id;
    creatorGoblinId?: Id;
    recipeKey?: string;
    seedSignature: string;
  };
  provenance: Array<{
    tick: number;
    from?: { ownerType: "tribe" | "goblin" | "site" | "faction"; ownerId: Id };
    to: { ownerType: "tribe" | "goblin" | "site" | "faction"; ownerId: Id };
    reason:
      | "crafted"
      | "looted"
      | "traded"
      | "gifted"
      | "stolen"
      | "buried"
      | "recovered";
    eventId?: Id;
    chronicleEntryId?: Id;
  }>;
  notableMoments: Id[]; // chronicle entry ids
  legendScore: number;
}

interface CausalityEdge {
  id: Id;
  causeEntryId: Id;
  effectEntryId: Id;
  linkType:
    | "resource-shortage"
    | "injury-chain"
    | "relationship-chain"
    | "faction-retaliation"
    | "artifact-callback"
    | "policy-side-effect";
  weight: number;
  explanation: string;
}
```

### 6.3 Artifact Naming + Provenance Rules
- Naming:
  - deterministic seed: `artifactId + runSeed + creationContext`
  - compositional pattern:
    - base noun + material + epithet fragment
    - example pattern only: `\"Shiv of Siltglass\"`, `\"Mossbound Lantern\"`
- Epithet evolution:
  - append/update epithet at milestones:
    - first blooded encounter
    - high-value trade
    - famous recovery
    - betrayal/theft
- Provenance updates are append-only and immutable once written.
- Every ownership transfer must emit:
  - provenance record
  - chronicle entry
  - optional causality edge if downstream effects occur.

### 6.4 Chronicle Browser Contract
Chronicle must support fast, composable queries:
- Filters:
  - tick range
  - entity ids (goblin/faction/artifact/site)
  - event type tags
  - severity bands
  - causality depth (`0..N` hops)
- Sort:
  - timeline ascending/descending
  - “most causally central”
- Result shape:
  - entry summary
  - linked causes/effects
  - involved entities
  - optional jump target (artifact or goblin inspector)

### 6.5 Historical Callback Resolver
Callbacks are generated from indexed history, not hardcoded text snippets.

Resolver flow:
1. Build context key from current event/dialogue frame:
   - `topic + participants + region + current pressures`.
2. Query chronicle index for relevant candidates.
3. Score candidates by:
   - recency decay
   - thematic match
   - participant overlap
   - novelty (avoid repeating same callback)
4. Enforce cooldown by callback key.
5. Return structured callback:
   - `entryId`, `callbackTextKey`, `confidence`, `linkedEntities`.

### 6.6 Legend Scoring Model
Use a configurable score so important things naturally become “legendary.”

Suggested additive model:
- `legendScore += rarityWeight + impactWeight + witnessWeight + survivalWeight + callbackReuseWeight`
- Inputs:
  - artifact rarity
  - casualties/injuries caused/prevented
  - trade value shifted
  - number and importance of witnesses/factions affected
  - persistence over time
- Threshold bands:
  - `20`: notable
  - `45`: renowned
  - `80`: legendary

When crossing a band:
- emit `LORE_PROMOTION` chronicle entry
- update artifact/goblin/faction descriptor tags.

### 6.7 Tick Pipeline Additions (Phase 6)
Add systems/order near chronicle processing:
1. `artifactLoreUpdateSystem`
2. `provenanceRecordSystem`
3. `chronicleIndexSystem`
4. `causalityEdgeSystem`
5. `historicalCallbackSystem`
6. `legendPromotionSystem`

Each system consumes deterministic emitted events and writes append-only lore records.

### 6.8 UI Requirements (Phase 6)
- Chronicle Browser Mode:
  - full-height timeline panel
  - filter chips + text search
  - causality trace toggle
- Artifact Inspector:
  - identity + rarity + legend tier
  - complete ownership chain
  - notable moments list with jump-to-chronicle
- “Why did this happen?” action:
  - surface shortest cause chain from selected effect back to root causes.

### 6.9 Persistence + Migration Notes for Phase 6
- Add `lore` block with:
  - artifact lore map
  - chronicle indexes
  - causality edges
  - callback cooldown state
- Migration from pre-lore saves:
  - initialize empty indexes
  - backfill artifact lore from existing item ownership + chronicle
  - generate best-effort causality edges for known failure cascades.

### 6.10 Validation Invariants for Phase 6
- Every indexed chronicle id must exist in `chronicle[]`.
- Every provenance transfer must have valid `to.ownerId`.
- Artifact provenance timestamps must be non-decreasing.
- Causality edges cannot self-loop (`causeEntryId !== effectEntryId`).
- Callback resolver cannot emit entries outside visible chronology (`entry.tick <= currentTick`).

### 6.11 Phase 6 Delivery Checklist
1. Artifact identity + deterministic naming implemented.
2. Provenance chain persisted for all artifact transfers.
3. Chronicle indexes support filtered browser queries.
4. Causality edge graph emitted for major chains.
5. Historical callbacks appear in events/dialogue with cooldown control.
6. Legend score thresholds promote entities with chronicle entries.
7. “Why did this happen?” UI path returns an explainable cause chain.

---

## 10) MVP Cut (Realistic First Shipping Slice)
- 1 generated top-down 2D world map with multiple regions/sites/routes.
- 12-20 goblins with unique stats and mood.
- 4 resources, 4 jobs, 8-12 events.
- 2 hostile pressures (raiders + cave beasts).
- 1 full failure cascade path that is legible in log.
- Save/load + deterministic replay seed.

---

## 11) Non-Goals (Initial)
- No giant tactical battle map.
- No multiplayer.
- No full 3D movement sim.
- No hundreds of simultaneous goblins in v1.

---

## 12) Immediate Next Tasks
1. Implement deterministic world map generation kernel (seed -> world hash).
2. Build top-down map renderer with overlay legend + region/site inspect cards.
3. Add curated Problem Feed (urgent/warning/info) with zoom-to-context actions.
4. Implement “why did this happen?” trace for every failed job/event.
5. Add start-site selection flow with explicit score breakdown and tradeoff text.
6. Add validation invariants + tests for world/model correctness.
7. After user-facing map UX is clear, integrate Living Goblins as Phase 2 systems.

### 12.1 UI Execution Checklist (File-Mapped)
Use this as the implementation contract. Do not mark a row complete unless its acceptance checks pass.

1. Home map clarity
- Files:
  `wwwroot/goblin-sim/ui/world/mapRenderer.js`, `wwwroot/goblin-simulation.html`
- Build:
  Always-visible legend for overlay colors and what each mode means.
  Map hover tooltip with plain-language region summary.
  Strong visual distinction for selected region/site and start site.
- Acceptance:
  Player can identify biome/risk/resource meaning from the map alone in < 5 seconds.

2. Intent-first controls
- Files:
  `wwwroot/goblin-sim/ui/world/interactions.js`, `wwwroot/goblin-sim/ui/bindings.js`, `wwwroot/goblin-sim/index.js`
- Build:
  Standard intent flow: choose tool -> place/paint -> confirm.
  Convert direct actions into intent events (not instant world mutation where avoidable).
  Add cancel/undo for pending intent.
- Acceptance:
  First-time player can place one successful intent without reading docs.

3. Problem Feed (triaged + actionable)
- Files:
  `wwwroot/goblin-sim/ui/render.js`, `wwwroot/goblin-sim/sim/tick.js`, `wwwroot/goblin-sim/sim/validation.js`, `wwwroot/goblin-simulation.html`
- Build:
  Dedicated feed buckets: Urgent/Warning/Info.
  Each item includes cause, affected location/entity, one-click zoom, suggested fix.
  Suppress duplicate spam via aggregation window.
- Acceptance:
  Top 3 current problems are obvious and each urgent item has at least one direct action.

4. Explainability chain (why)
- Files:
  `wwwroot/goblin-sim/sim/lore/causalityGraph.js`, `wwwroot/goblin-sim/ui/chronicleBrowser.js`, `wwwroot/goblin-sim/ui/render.js`
- Build:
  “Why did this happen?” on each feed/chronicle item.
  Show cause chain: event -> immediate cause -> upstream bottleneck -> suggested fix.
  Highlight missing dependency on map when applicable.
- Acceptance:
  Any failed job/event can show a readable cause chain in <= 2 clicks.

5. Camera + context jumps
- Files:
  `wwwroot/goblin-sim/ui/world/camera.js`, `wwwroot/goblin-sim/ui/world/interactions.js`, `wwwroot/goblin-sim/ui/world/mapRenderer.js`
- Build:
  Stable pan/zoom/reset behavior.
  Jump-to-context from problem/feed cards.
  Keep minimap viewport and main camera synchronized.
- Acceptance:
  Clicking any alert/feed item moves camera to the right context every time.

6. Start-site decision UX
- Files:
  `wwwroot/goblin-sim/sim/world/worldGen.js`, `wwwroot/goblin-sim/ui/world/mapRenderer.js`, `wwwroot/goblin-sim/ui/world/interactions.js`
- Build:
  Candidate list with explicit score breakdown + tradeoff text.
  Confirmation state that clearly communicates new start-site consequences.
- Acceptance:
  Player can explain why one start site is better/worse than another from UI alone.

7. Time/alert rhythm (pause and urgency)
- Files:
  `wwwroot/goblin-sim/index.js`, `wwwroot/goblin-sim/ui/bindings.js`, `wwwroot/goblin-sim/sim/tick.js`
- Build:
  Auto-pause hooks for urgent events.
  “What changed while paused” summary panel.
  Resume with recommended next action.
- Acceptance:
  High-severity events never get missed at normal play speed.

8. Progressive inspection depth
- Files:
  `wwwroot/goblin-sim/ui/render.js`, `wwwroot/goblin-sim/ui/artifactInspector.js`, `wwwroot/goblin-sim/ui/world/mapRenderer.js`
- Build:
  Level 1 quick cards (minimal facts), Level 2 details, Level 3 raw debug.
  Keep deep JSON hidden behind explicit toggle.
- Acceptance:
  Most player decisions can be made without opening raw JSON panels.

9. Copy quality and plain-language messaging
- Files:
  `wwwroot/goblin-simulation.html`, `wwwroot/goblin-sim/ui/render.js`, `wwwroot/goblin-sim/sim/tick.js`
- Build:
  Rewrite technical/internal strings into player language.
  Standardize event phrasing: change + cause + consequence.
- Acceptance:
  Non-technical user can understand feed entries without glossary.

10. Regression and determinism checks
- Files:
  `wwwroot/goblin-sim/sim/world/worldGen.test.mjs`, `wwwroot/goblin-sim/sim/goblinFactory.test.mjs`, `package.json`
- Build:
  Keep deterministic tests for seed/hash behavior.
  Add UI-state smoke checks for critical selectors/controls.
- Acceptance:
  `npm run sim:verify` passes and UI contract checks remain green.

### 12.2 Implemented UI Option Inventory (Current Build)
This section documents what is currently implemented in `wwwroot/goblin-simulation.html` + `wwwroot/goblin-sim/ui/*`.

| UI option | Usage | Player value |
|---|---|---|
| `Open Panels` / `Hide Panels` (`toggleUiBtn`) | Toggle right-side panel drawer open/closed. | Frees map space and reduces clutter while navigating. |
| `Close` in panel header (`closeUiBtn`) | Closes the panel drawer. | Fast exit from deep inspection back to map-first play. |
| `Esc` key | Closes panel drawer. | Keyboard shortcut for faster navigation. |
| `Overlay` select: `Biome`, `Resources`, `Hazard`, `Influence` (`overlayMode`) | Switch map coloring mode. | Lets player evaluate land quality, risk, and faction pressure quickly. |
| `Pause` / `Resume` (`playPause`) | Toggle simulation tick loop on/off. | Core control for safe decision windows. |
| `Step Tick` (`stepTick`) | Advance exactly one tick while paused or running. | Deterministic debugging and event-by-event understanding. |
| `Free Roam` / `Follow Tracked` (`toggleFollowMode`) | Toggle camera follow mode for tracked goblin/wildlife. | Keeps important entity centered during observation. |
| `Snap To Tracked` (`snapTrackedGoblin`) | Instantly center camera on tracked goblin/wildlife. | Rapid context recovery after panning elsewhere. |
| `Hide Wildlife` / `Show Wildlife` (`toggleWildlifeLayer`) | Toggle wildlife rendering layer visibility. | Reduces visual noise or surfaces threat detail as needed. |
| `Reset Camera` (`resetCamera`) | Reset camera pan + zoom to default. | Recovery from disorientation and quick map reset. |
| `Set Start Site` (`setStartSite`) | Sets selected site as colony start; relocates homes/units and emits chronicle event. | Enables direct what-if testing of opening position quality. |
| Map drag (mouse down + move) | Pan camera while dragging canvas. | Standard navigation for large world coverage. |
| Mouse wheel zoom (anchored to cursor) | Zoom in/out around cursor anchor point. | Precise local inspection without losing focus point. |
| Map hover | Updates hover summary with plain-language biome/risk/resource/influence text. | Faster comprehension than raw numbers. |
| Map click on region/site | Select region and optionally site for inspector + start-site action. | Anchors inspection and decision workflows to concrete map context. |
| Map click on wildlife unit | Select + track wildlife entity. | Supports threat monitoring and encounter debugging. |
| Minimap viewport | Shows camera rectangle against full map. | Orientation and fast understanding of current coverage. |
| Roster row click | Select + track goblin from roster list. | Quick pivot from population overview to specific individual. |
| Chronicle search (`chronicleSearch`) | Text filter over indexed chronicle entries. | Faster lookup of specific incidents or terms. |
| Chronicle type filter (`chronicleType`) | Filter by event family (`all`, `NEED_SPIKE`, etc). | Reduces feed noise for focused diagnosis. |
| Chronicle cause depth (`causalityDepth`) | Set trace depth 0-3 for cause chain computation. | Controls explainability detail density. |
| Chronicle entry click | Select entry and surface causality trace in debug inspector. | Connects visible events to root-cause graph. |
| Artifact list click | Select artifact for inspector card. | Enables lore/provenance investigation and legend tracking. |
| URL seed override (`?seed=...`) | Boot simulation with explicit deterministic seed. | Reproducible bug reports and scenario replay. |

### 12.3 High-Value UI Options Missing (Recommended Additions)
These are strong additions relative to current goals and current gaps.

| Missing option | Why it is valuable |
|---|---|
| Sim speed controls (`1x/2x/4x/8x`) | Already planned in Section 8.7; current UI only offers pause + single-step. |
| Auto-pause on urgent conditions | Prevents high-severity events from being missed at normal play pace. |
| `What changed while paused` summary | Reduces cognitive load when resuming from pauses. |
| Triage feed buckets (`Urgent/Warning/Info`) | Current chronicle is searchable but not severity-curated for action-first play. |
| One-click jump-to-context from chronicle/feed entries | Current feed selection does not recenter camera to event source. |
| Suggested fix actions on problem cards | Moves UX from observation to intervention. |
| Intent tool belt (`zone/harvest/build/patrol/forbid/priority`) | Core planned interaction model is not yet surfaced in UI. |
| Confirm/cancel/undo for high-impact actions (for example start-site change) | Prevents accidental world mutation and supports safe experimentation. |
| Progressive inspection toggles (L1/L2/L3) instead of always-on raw JSON | Improves readability for non-debug play while preserving depth. |
| Chronicle severity and entity chips in list rows | Makes scanning and filtering faster than plain text rows. |
| Overlay keyboard shortcuts (`1-4`) | Improves speed for frequent map mode switching. |
| Layer toggles for routes/sites/resources/homes/walls independently | Better control of visual clutter in dense scenes. |
| Clickable minimap recenter | Faster long-distance navigation than repeated dragging. |
| Mobile gesture support (pinch zoom, two-finger pan) | Current map interaction is desktop-centric; mobile UX is constrained. |
| Save/load UI with named snapshots | Essential for comparing branches of simulation outcomes. |

---

## 13) Goblin AI + Resource Manipulation Plan (Detailed)

### 13.1 Goal
Implement believable individual goblin intelligence that:
- prioritizes survival needs (water, food),
- manipulates world resources (harvest trees/mushrooms, consume water/food),
- uses gathered wood to build walls,
- anchors behavior around a persistent home tile.

### 13.2 Core Behavior Contract
Each goblin runs this decision loop every tick:
1. Sense nearby world and personal state.
2. Score candidate goals.
3. Select highest-utility goal.
4. Move one tile-step toward target.
5. Execute action if on target tile and preconditions pass.
6. Emit explainable event(s) for chronicle/feed.

Hard rule:
- Same seed + same action stream => same goblin decisions/outcomes.

### 13.3 Data Structures
Add/lock these fields in state.

```ts
interface GoblinAIState {
  goblinId: Id;
  tileX: number;
  tileY: number;
  tileX: number;          // derived from tile coords
  tileY: number;          // derived from tile coords
  posX: number;           // smoothed render position
  posY: number;
  homeTileX: number;
  homeTileY: number;
  homeMicroX: number;
  homeMicroY: number;
  homeSiteId: Id;
  lastGoal: GoalKey;
  lastInteractionTick: number;
}

type GoalKey =
  | "drink"
  | "gather-food"
  | "cut-tree"
  | "build-wall"
  | "return-home"
  | "idle";

interface ResourceNode {
  key: string;            // `${tileX},${tileY}`
  tileX: number;
  tileY: number;
  regionId: Id;
  type: "tree" | "mushroom";
  readyAtTick: number;
  regrowTicks: number;
}

interface WaterSource {
  key: string;            // `${tileX},${tileY}`
  tileX: number;
  tileY: number;
  regionId: Id;
}

interface WallStructure {
  key: string;            // `${tileX},${tileY}`
  tileX: number;
  tileY: number;
  builtByGoblinId: Id;
  builtAtTick: number;
}
```

State placement:
- `worldMap.units.byGoblinId[goblinId] -> GoblinAIState`
- `worldMap.resourceNodes.byTileKey -> Record<string, ResourceNode>`
- `worldMap.waterSources.byTileKey -> Record<string, WaterSource>`
- `worldMap.structures.wallsByTileKey -> Record<string, WallStructure>`

### 13.4 Resource Purpose Mapping
Resources must have direct simulation effects.

- `water`:
  - used to reduce thirst when goblin reaches water source.
  - shortage increases stress and need pressure.
- `food`:
  - consumed periodically to reduce hunger.
  - shortage increases hunger and mood instability.
- `mushrooms`:
  - gathered in world.
  - converted to emergency food and/or direct hunger relief.
- `wood`:
  - gathered by cutting trees.
  - consumed to build walls.
- `walls`:
  - persistent world structure.
  - future defensive/pathing effects (Phase follow-up).

### 13.5 Goal Utility Model
Define explicit utility functions; choose max score.

```ts
utility(drink) = thirstWeight * normalized(thirst) - distanceToWater * distPenalty
utility(gather-food) = hungerWeight * normalized(hunger) - distanceToMushrooms * distPenalty
utility(cut-tree) = woodNeedWeight * woodDeficitFactor - distanceToTree * distPenalty
utility(build-wall) = satisfiedNeedsBonus + defenseNeedBonus + woodAvailableBonus - distanceToBuildTile * distPenalty
utility(return-home) = homeAffinity + fatigueBias - distanceToHome * distPenalty
utility(idle) = socialBonus + localSafetyBonus
```

Priority guardrails:
- If `thirst >= hardThreshold`, force `drink` unless unreachable.
- If `hunger >= hardThreshold`, force `gather-food` unless unreachable.
- Only allow `build-wall` when survival needs are below satisfied thresholds.

### 13.6 Action Definitions (Engine Actions)
Add explicit simulation action/event schema.

```ts
type SimAction =
  | { type: "GOBLIN_GOAL_SELECTED"; goblinId: Id; goal: GoalKey; target?: { tileX: number; tileY: number } }
  | { type: "GOBLIN_MOVED_MICRO"; goblinId: Id; from: { x: number; y: number }; to: { x: number; y: number } }
  | { type: "GOBLIN_DRANK_WATER"; goblinId: Id; sourceKey: string }
  | { type: "GOBLIN_GATHERED_MUSHROOMS"; goblinId: Id; nodeKey: string; amount: number }
  | { type: "GOBLIN_CUT_TREE"; goblinId: Id; nodeKey: string; amount: number }
  | { type: "GOBLIN_BUILT_WALL"; goblinId: Id; wallKey: string; woodSpent: number }
  | { type: "RESOURCE_NODE_COOLDOWN_STARTED"; nodeKey: string; readyAtTick: number }
  | { type: "GOBLIN_SOCIAL_MOMENT"; goblinId: Id; otherGoblinId: Id };
```

Chronicle text contract for each action:
- include actor, verb, resource delta, and location context.

### 13.7 Tick System Order (AI Slice)
Add/confirm deterministic ordering in tick pipeline:
1. `resourcePurposeSystem` (global consumption/shortages)
2. `goblinSenseSystem`
3. `goblinGoalSelectionSystem`
4. `goblinMicroMovementSystem`
5. `goblinActionExecutionSystem`
6. `resourceRegrowSystem`
7. `socialInteractionSystem`
8. `chronicleSystem`
9. `validationSystem`

No random calls outside seeded helpers.

### 13.8 Home System
Initialization:
- assign each goblin a home tile around selected start site using deterministic ring offsets.
- set both tile and tile coordinates.

Behavior:
- idle/social goals should bias toward home radius.
- when `Set Start Site` is used:
  - reassign home tiles deterministically,
  - move goblins to new homes,
  - emit `START_SITE_SELECTED` + home reassignment chronicle entry.

Rendering:
- every unique home tile shows a home bitmap marker.

### 13.9 Wall Building Rules
Preconditions:
- goblin in satisfied state (hunger/thirst below thresholds),
- wood available (`wood >= 1`),
- target tile not already occupied by wall.

Effects:
- consume 1 wood,
- create `WallStructure`,
- emit `GOBLIN_BUILT_WALL`.

Placement policy (v1):
- ring around home tile, nearest available slot first.

### 13.10 Organized Wall System (Plan Then Build)
Replace opportunistic wall placement with a shared settlement wall plan.

```ts
interface WallPlan {
  planId: Id;
  homeSiteId: Id;
  centerTileX: number;
  centerTileY: number;
  desiredRadius: number;
  gateTileKeys: string[];              // reserved pass-through points
  orderedTileKeys: string[];           // deterministic build order
  tileStatusByKey: Record<string, "planned" | "reserved" | "built" | "blocked">;
  assignedGoblinByKey: Record<string, Id | null>;
  lastPlannedTick: number;
}
```

Lifecycle:
1. `wallPlanInitSystem`
   - Trigger on world start and start-site reassignment.
   - Compute perimeter candidates around site center (not per goblin).
   - Keep 1-2 gate openings oriented toward nearest road/resource cluster.
2. `wallPlanValidateSystem`
   - Mark invalid tiles as `blocked` (water, rock, out-of-bounds, protected tile).
   - If blocked ratio exceeds threshold, recompute with slightly larger radius.
3. `wallPlanJobEmitSystem`
   - Convert `planned` tiles to `BUILD_WALL_SEGMENT` jobs in deterministic order.
   - Reserve jobs so two goblins cannot target the same segment.
4. `wallBuildExecutionSystem`
   - Goblins pull nearest unreserved segment from plan queue.
   - Build only segment tiles present in active plan.
5. `wallPlanProgressSystem`
   - Track completion percent.
   - When all non-blocked planned segments are built, emit `WALL_PLAN_COMPLETED`.

Deterministic ordering contract:
- Sort perimeter tiles by ring index, then clockwise angle from north, then tile key.
- Use the same order for job generation and assignment tie-breaks.
- Never pick random wall targets in execution logic.

Goblin assignment rules:
- Builders can execute wall jobs only when needs are satisfied.
- If no builder is available, plan remains queued; no fallback random placement.
- A goblin with reserved segment keeps reservation for N ticks, then reservation expires.

Replan triggers:
- Start site moved.
- New obstacle appears on planned tile.
- Gate tile becomes blocked.
- Player issues explicit `REPLAN_WALLS` action.

Safety checks:
- Segment must be adjacent to existing built segment or designated gate-adjacent seed segment.
- Prevent isolated single-tile walls disconnected from perimeter graph.
- Keep at least one valid path from home center to each gate after each placement.

### 13.11 Small-Step Implementation Plan
1. Lock/validate AI unit schema (`tileX`, `home*`, `lastGoal`).
2. Implement goal scoring with hard survival overrides.
3. Implement tile-step movement + occupancy conflict prevention.
4. Implement water drink + mushroom gather execution.
5. Implement tree cut + wood gain.
6. Implement `WallPlan` generation + validation around active home site.
7. Convert wall plan segments into deterministic build jobs.
8. Implement wall build execution from reserved plan segments + structure persistence.
9. Add regrow timers and cooldown visualization for resource nodes.
10. Add home + wall bitmap rendering.
11. Add chronicle/problem feed entries with zoom-to-context.
12. Add deterministic tests for goal selection and action outcomes.

### 13.12 Validation Invariants
- Every goblin AI unit has valid `tileX/tileY/homeMicroX/homeMicroY`.
- `tileX/tileY` match floor mapping from tile coordinates.
- No two goblins occupy same tile after movement resolution.
- Resource node cooldowns are non-negative and monotonic.
- Wall keys are canonical and within map bounds.
- Resource deltas never silently underflow (`wood`, `food`, `water`, `mushrooms` >= 0).
- Every built wall segment exists in active or completed wall plan.
- No segment is both `blocked` and `built`.
- Gate tile keys are never marked built.

### 13.13 Tests to Add
- Determinism:
  - same seed + ticks => identical goblin goal sequence.
- Survival override:
  - high thirst always prioritizes reachable water.
- Harvest:
  - standing on ready tree/mushroom mutates resources and starts cooldown.
- Build:
  - satisfied goblin with wood builds wall and spends exactly 1 wood.
  - same seed produces identical `orderedTileKeys` and wall completion order.
  - no wall segment is built outside planned perimeter.
- Home behavior:
  - idle goblins remain within expected home radius envelope.

---

## 14) Tile System Blueprint (Zoom-Stable + Micro-Scale AI)

### 14.1 Problem Statement
Current behavior can appear visually unstable because decorative elements may look like they “move” as zoom changes.
Root causes to avoid:
- rendering details generated differently per zoom level,
- props not anchored to persistent tile coordinates,
- mixed coordinate spaces (chunk vs render-only sub-cells),
- smoothing/render interpolation without stable simulation anchors.

### 14.2 Core Rule
World objects must be coordinate-anchored, not zoom-generated.

Never do:
- “spawn props during draw based on current zoom only.”

Always do:
- generate/store object coordinates once,
- render those same coordinates at any zoom,
- only change how much detail is *visible*, not where objects exist.

### 14.3 Three-Layer Tile Model
Define explicit tile layers with deterministic mapping.

```ts
// L0: Chunk (coarse worldgen cell)
interface ChunkCell {
  chunkX: number;
  chunkY: number;
  regionId: Id;
}

// L1: Tile (simulation grid used by goblin AI)
// Example scale: TILES_PER_CHUNK = 4
interface SimTile {
  tileX: number;          // 0..(worldWidth*TILES_PER_CHUNK-1)
  tileY: number;          // 0..(worldHeight*TILES_PER_CHUNK-1)
  chunkX: number;         // floor(tileX / TILES_PER_CHUNK)
  chunkY: number;         // floor(tileY / TILES_PER_CHUNK)
}

// L2: Cells (render-only visual subdivision)
// Used for terrain texture look only, never for entity logic.
interface RenderCell {
  cellX: number;          // local within chunk
  cellY: number;
}
```

Mapping helpers (must be centralized):
- `chunk -> tile`: `tile = chunk * TILES_PER_CHUNK + centerOffset`
- `tile -> chunk`: `chunk = floor(tile / TILES_PER_CHUNK)`
- `tile -> world pixel`: `px = (tile + 0.5) * (TILE / TILES_PER_CHUNK)`

### 14.4 Authoritative Position Data
All interactive objects use persistent tile keys:

```ts
interface TileAnchors {
  treesByTileKey: Record<`${number},${number}`, TreeNode>;
  mushroomsByTileKey: Record<`${number},${number}`, MushroomNode>;
  waterByTileKey: Record<`${number},${number}`, WaterSource>;
  homesByTileKey: Record<`${number},${number}`, HomeMarker>;
  wallsByTileKey: Record<`${number},${number}`, WallStructure>;
  goblinOccupancyByTileKey: Record<`${number},${number}`, Id>; // goblin id
}
```

Important:
- keys are always tile keys for simulation objects.
- chunk-level summaries are derived views, never source of truth for object coordinates.

### 14.5 Zoom-Stable Rendering Contract
Rendering must be “same world, different lens.”

At low zoom:
- draw region colors/overlays only.
- optionally draw aggregated icons (count-based), but anchored to deterministic representative tiles.

At medium zoom:
- draw true object sprites from tile keys (trees, mushrooms, homes, walls, goblins).

At high zoom:
- draw same objects, plus extra cosmetic detail layers.

Forbidden:
- re-rolling object positions when zoom threshold changes.
- changing sprite anchor points between zoom levels.

Required:
- object `worldX/worldY` derived from tile key every frame.
- only size/opacity/label detail changes by zoom.

### 14.6 Goblin AI Must Use Smallest Tile Scale
Goblin thinking/movement/action all run on tiles.

Decision space:
- neighbors = adjacent tiles (8-way or 4-way).
- target acquisition (food/water/tree/build site) resolves to tile target.
- movement = one tile-step per decision tick (or deterministic speed schedule).

Action execution:
- drink: when goblin tile key matches a water tile key.
- gather/chop: when goblin tile key matches node tile key.
- build wall: when goblin tile key equals selected build tile key.

No region-tile-only movement logic should remain in AI.

### 14.7 Data Structure Additions for Stability

```ts
interface GoblinAIState {
  goblinId: Id;
  tileX: number;
  tileY: number;
  homeMicroX: number;
  homeMicroY: number;
  // Derived/cache for UI:
  tileX: number; // floor(tileX / TILES_PER_CHUNK)
  tileY: number;
  lastGoal: GoalKey;
}

interface ResourceNode {
  key: `${number},${number}`; // tile key
  tileX: number;
  tileY: number;
  kind: "tree" | "mushroom";
  readyAtTick: number;
  regrowTicks: number;
}
```

### 14.8 Generation Pipeline (Deterministic)
1. Generate chunks.
2. Expand to tile grid (`TILES_PER_CHUNK` fixed per save).
3. Place resource/home/water anchors in tile coordinates using seeded RNG.
4. Persist anchors in state/save.
5. Derive render caches from anchors (optional).

Determinism check:
- same seed => identical anchor key sets.

### 14.9 Interaction and Picking Rules
Mouse picking must resolve through stable transforms:
1. screen -> world pixels
2. world pixels -> tile
3. tile -> object lookup by key

Selection precedence:
- goblin on tile
- structure on tile
- resource node on tile
- fallback to chunk summary

### 14.10 Invariants (Must Hold)
- every goblin has valid micro/home tile coordinates.
- no duplicate occupancy for same tile key after movement resolution.
- every resource/water/home/wall key equals `${tileX},${tileY}`.
- object tile coordinates always map to valid region indices.
- zoom changes do not mutate anchor coordinates.

### 14.11 Debug Tools for Tile Stability
Add debug overlays:
- tile grid lines (toggle),
- object anchor dots + ids,
- selected object key display (`tileX,tileY`),
- zoom stability test mode:
  - snapshot visible object keys at zoom A and zoom B,
  - assert same keys and positions (within pixel transform tolerance only).

### 14.12 Action API (Micro-Scale)
Use explicit action payloads with tile keys.

```ts
type TileAction =
  | { type: "GOBLIN_STEP"; goblinId: Id; from: MicroKey; to: MicroKey }
  | { type: "GOBLIN_DRINK"; goblinId: Id; source: MicroKey }
  | { type: "GOBLIN_GATHER"; goblinId: Id; node: MicroKey; kind: "mushroom" }
  | { type: "GOBLIN_CHOP"; goblinId: Id; node: MicroKey; kind: "tree" }
  | { type: "GOBLIN_BUILD_WALL"; goblinId: Id; at: MicroKey };
```

Chronicle entries should include both:
- human-readable location text,
- raw tile key in metadata for traceability.

### 14.13 Implementation Checklist (Tile Rework)
1. Lock `TILES_PER_CHUNK` in save schema.
2. Migrate all resource/water/home/wall coordinates to tile keys.
3. Update goblin AI to consume/emit only tile coordinates.
4. Update renderer to draw anchored objects from tile keys.
5. Remove any zoom-dependent placement logic.
6. Add micro-pick helper and replace direct region-only picking for actions.
7. Add invariants + tests for key stability across zoom levels.
8. Add debug overlay toggles for tile anchors and occupancy.

---

## 15) Wildlife + Barbarian Expansion Plan (Detailed)

### 15.1 Feature Goal
Add world life that makes the map feel active and dangerous without breaking current micro-tile determinism:
- Passive fauna: `deer`.
- Aquatic fauna: `fish`.
- Predator fauna: `wolves`.
- Hostile humanoid enemies: `barbarians`.

Design target:
- Everything acts on the same smallest tile scale used by goblins.
- Every actor has explainable behavior and visible world impact.
- The player can understand "what happened, why, and what to do next" through the feed and inspect tools.

### 15.2 Core Principles
- Single coordinate truth: all creature positions are `(tileX, tileY)`.
- Biome + need + threat driven behavior, not random teleporting.
- Deterministic outcomes for a given seed and input stream.
- Limited complexity per phase: start with local logic, then layer faction tactics.
- Every new system emits typed events for debugging and story feed.

### 15.3 New Entity Types

```ts
type CreatureKind = "fish" | "deer" | "wolf" | "barbarian";

type CreatureDisposition = "passive" | "skittish" | "predator" | "hostile";

type CreatureState = {
  id: Id;
  kind: CreatureKind;
  disposition: CreatureDisposition;

  tileX: number;
  tileY: number;
  tileX: number; // derived
  tileY: number; // derived

  homeMicroX: number;
  homeMicroY: number;
  homeRadius: number;

  alive: boolean;
  health: number;
  stamina: number;

  hunger: number;
  thirst: number;
  fear: number;
  aggression: number;

  packId?: Id;      // wolves, barbarians
  targetId?: Id;    // current target entity
  targetType?: "goblin" | "creature" | "resource" | "structure";

  aiState:
    | "idle"
    | "foraging"
    | "drinking"
    | "fleeing"
    | "hunting"
    | "raiding"
    | "returning-home"
    | "resting";

  lastDecisionTick: number;
  lastActionTick: number;
  spawnTick: number;
  despawnTick?: number;
};
```

### 15.4 World State Additions

```ts
interface WildlifeState {
  byId: Record<Id, CreatureState>;
  allIds: Id[];

  // quick lookup for spatial queries
  occupancyByTileKey: Record<`${number},${number}`, Id[]>;

  packsById: Record<Id, {
    id: Id;
    kind: "wolf-pack" | "barbarian-band";
    memberIds: Id[];
    leaderId: Id;
    targetSiteId?: Id;
    targetMicroX?: number;
    targetMicroY?: number;
    cohesion: number;
  }>;

  spawners: {
    fishByWaterRegion: Record<Id, number>;   // desired fish population weight
    deerByBiomeRegion: Record<Id, number>;   // forest/hills mostly
    wolfByBiomeRegion: Record<Id, number>;   // forest/hills/badlands
    barbarianEdgePressure: number;           // raid intensity scalar
  };
}
```

Add to `worldMap`:
- `wildlife: WildlifeState`
- `carcassesByTileKey` (optional for later scavenging loop)
- `dangerHeatByTileKey` (optional derived map for UI overlay)

### 15.5 Species Design Rules

#### Fish
- Spawn only on valid water tile keys.
- Movement constrained to connected water tile neighborhoods.
- Primary loop: school drift, feed, avoid predators.
- If very low water connectivity or heavy predation, local school collapses and respawns by season rules.

#### Deer
- Prefer forest/hills tiles near edge of cover.
- Eat "forage" abstract resource from biome potential.
- Flee from nearby wolves/goblins/barbarians when fear threshold triggered.
- Reproduction/regrowth handled as a simple population pulse per season in v1.

#### Wolves
- Pack behavior with leader-follow cohesion.
- Hunt deer first; opportunistically threaten isolated goblins.
- Avoid high wall density near goblin home clusters unless starving.
- If pack hunger high and deer scarce, they pressure goblin outskirts.

#### Barbarians
- Spawn in raiding bands from map edges or hostile sites.
- Goal hierarchy: scout -> raid weak target -> steal/break -> retreat.
- Target scoring includes stored resources, weak defenses, distance, recent success.
- Should feel intentional, not constant spam.

### 15.6 Resource & World Interaction Matrix

| Actor | Can Consume | Can Modify | Can Damage | Notes |
|---|---|---|---|---|
| fish | water ecosystem capacity | none in v1 | none | mostly ambient + food source later |
| deer | biome forage | deplete local forage pressure | crop/food nodes later | prey role |
| wolves | deer, carcasses (later) | none in v1 | goblins if isolated | predator pressure |
| barbarians | tribe food/water stores (raid abstraction) | steal stock, place temporary camp | walls/homes (limited) | strategic enemy |
| goblins | mushrooms, water | chop tree, build wall | hostile entities in combat phase | already present |

### 15.7 AI Decision Model (Shared)
Each creature tick follows:
1. Sense nearby entities/resources in radius R.
2. Update internal drives (hunger/thirst/fear/aggression/stamina).
3. Score candidate goals.
4. Select goal with deterministic tie-break.
5. Choose next micro step.
6. Execute action if at target and preconditions pass.
7. Emit event(s).

Goal scoring template:

```ts
score(goal) =
  needWeight
  + proximityWeight
  + safetyWeight
  + groupCohesionWeight
  + roleBias
  + deterministicJitter;
```

### 15.8 Species-Specific Goal Tables

#### Fish Goal Priority
1. `stay-in-water` (hard constraint)
2. `school-with-nearby-fish`
3. `avoid-threat`
4. `wander-water`

#### Deer Goal Priority
1. `flee-predator` when threat nearby
2. `drink-water` when thirst high
3. `graze` when hunger high
4. `group-with-deer`
5. `wander-home-range`

#### Wolf Goal Priority
1. `chase-deer` when hungry and prey visible
2. `regroup-pack` when cohesion low
3. `drink-water` if thirst high
4. `opportunistic-hunt-goblin` if vulnerable target and low risk
5. `patrol-territory`

#### Barbarian Goal Priority
1. `retreat` if morale broken or load full
2. `raid-target` if raid active
3. `attack-wall-or-home` if blocked
4. `loot-resource-node` / `steal-stockpile` if accessible
5. `scout` while selecting target

### 15.9 Spawn, Despawn, and Population Control
- Use deterministic spawn windows (tick modulo + seed hash).
- Maintain min/max populations per species per biome band.
- Spawn points:
  - fish: water network cells.
  - deer/wolves: biome-specific tile anchors.
  - barbarians: edge entries + hostile site emitters.
- Despawn when:
  - dead.
  - out-of-bounds recovery fails.
  - migrated off-map by rule.

Safety caps (starting values):
- fish: `0.3 * waterMicroCellCount` (sampled cap)
- deer: `1 per 18-26 chunks equivalent`
- wolves: `1 pack per 140-220 chunks`
- barbarians: max `2 active bands` in MVP

### 15.10 Combat/Conflict Interface (MVP)
Keep this lightweight before full combat phase:
- Contact resolution via simple opposed roll + modifiers.
- Outcomes:
  - damage,
  - flee,
  - steal resource,
  - wall damage,
  - death.
- Emit explicit events with causal metadata.

```ts
type WildlifeEvent =
  | { type: "FISH_SCHOOL_SHIFT"; fishIds: Id[]; at: MicroKey }
  | { type: "DEER_GRAZED"; deerId: Id; at: MicroKey }
  | { type: "DEER_FLED"; deerId: Id; from: MicroKey; to: MicroKey; threatId: Id }
  | { type: "WOLF_HUNT_STARTED"; packId: Id; targetId: Id }
  | { type: "WOLF_KILLED_DEER"; wolfId: Id; deerId: Id; at: MicroKey }
  | { type: "BARBARIAN_BAND_SPAWNED"; bandId: Id; entry: MicroKey }
  | { type: "BARBARIAN_RAID_TARGETED"; bandId: Id; siteId: Id }
  | { type: "BARBARIAN_STOLE_RESOURCE"; bandId: Id; resource: string; amount: number }
  | { type: "BARBARIAN_DAMAGED_WALL"; bandId: Id; wallKey: MicroKey; amount: number }
  | { type: "CREATURE_DIED"; id: Id; kind: CreatureKind; at: MicroKey };
```

### 15.10.A Hostile Wildlife Seeks Goblins (New)
Add explicit goblin-hunt behavior for hostile wildlife (`wolves`, `barbarians`) with deterministic targeting.

#### Target Acquisition Contract
Each hostile creature (or pack leader) runs:
1. Gather candidate goblins within `detectionRadiusTiles`.
2. Filter to valid targets:
   - goblin exists, alive, not missing,
   - reachable by current movement constraints,
   - not already dead/incapacitated this tick.
3. Score candidates:
   - `distanceScore` (closer preferred),
   - `vulnerabilityScore` (low health/high stress/isolated),
   - `exposureScore` (outside wall perimeter favored),
   - `riskPenalty` (grouped defenders, nearby armed goblins, strong walls).
4. Select max score with deterministic tie-break (`tick`, `creatureId`, `targetGoblinId` hash).
5. Commit target for `targetCommitTicks` before retargeting (unless target invalid).

```ts
scoreTarget(goblin) =
  proximityWeight * inverseDistance
  + vulnerabilityWeight * vulnerability
  + exposureWeight * exposure
  - defenseWeight * localDefense
  - wallWeight * wallBarrier;
```

#### Hunt States
```ts
type HostileHuntState =
  | "patrol"
  | "acquire-target"
  | "stalk"
  | "chase"
  | "engage"
  | "breakoff"
  | "retreat";
```

Per-hostile fields:
- `targetGoblinId?: Id`
- `lastKnownTargetTile?: { tileX: number; tileY: number }`
- `targetAcquiredTick?: number`
- `targetCommitUntilTick?: number`
- `breakoffUntilTick?: number`

#### Goblin Response Behavior
When hostiles target goblins, goblins should react without direct micromanagement:
- `panic/flee`: if isolated and outmatched, move toward nearest home cluster or defended tile.
- `regroup`: nearby goblins converge to shared defense point.
- `defend`: armed/healthy goblins can intercept if morale and health permit.
- `fortify-priority`: temporarily increase wall repair/build urgency near attack vector.
- `alert-state`: tribe threat level increases, affecting goal utility (survival > gathering).

Add temporary goal bias while threatened:
- `utility(return-home)` and `utility(defend-near-home)` increase.
- `utility(cut-tree/build-wall)` suppressed if direct threat within local radius.

#### Damage, Injury, and Death Outcomes
Hostile contact can injure or kill goblins.

```ts
interface WildlifeAttackResult {
  goblinId: Id;
  attackerId: Id;
  attackerKind: "wolf" | "barbarian";
  damage: number;
  injuryType?: "bite" | "laceration" | "blunt" | "maul";
  bleedingDelta: number;
  painDelta: number;
  killed: boolean;
}
```

Resolution rules:
- On `engage`, apply deterministic opposed roll + role modifiers.
- If `health <= 0` (or critical trauma threshold), set goblin dead.
- Dead goblins:
  - `flags.alive = false`,
  - cleared from active assignments,
  - excluded from future targeting as valid prey.
- Non-lethal hits update injury model (pain, bleeding, mobility penalties) and affect future utility/morale.

Required events:
- `WILDLIFE_TARGET_ACQUIRED`
- `WILDLIFE_CHASE_STARTED`
- `WILDLIFE_ATTACKED_GOBLIN`
- `GOBLIN_INJURED_BY_WILDLIFE`
- `GOBLIN_KILLED_BY_WILDLIFE`
- `WILDLIFE_BROKE_OFF`

Chronicle/feed requirements:
- include attacker, victim, location tile key, and net result (injured/killed/fled).
- urgent card if any goblin death occurs.

#### Validation Additions
- No hostile target references missing/dead goblins.
- Dead goblins cannot receive new wildlife attack events after death tick.
- Goblin death transitions are single-fire (no duplicate death state transitions).
- Injury references always point to existing goblin and valid attacker.

#### Test Cases (Must Add)
1. Hostile targeting determinism: same seed => same target sequence.
2. Wall influence: goblins behind contiguous walls are deprioritized unless breach path exists.
3. Goblin response: threatened goblins switch to flee/regroup behavior.
4. Injury flow: attack produces injury deltas and persists in goblin body state.
5. Death flow: lethal attack marks goblin dead and removes from assignment/target pools.
6. No re-hit-after-death invariant across subsequent ticks.

### 15.10.B Implementation Plan (Detailed, Phased)

#### Phase H1: Data Contracts + Event Schema
Scope:
- Add hunt state fields to hostile wildlife runtime state.
- Add goblin threat-response flags/state needed for flee/regroup/defend transitions.
- Add wildlife-vs-goblin combat result payloads and events.

Primary files:
- `wwwroot/goblin-sim/sim/world/worldGen.js`
- `wwwroot/goblin-sim/sim/world/wildlifeSimulation.js`
- `wwwroot/goblin-sim/sim/validation.js`
- `wwwroot/goblin-sim/sim/tick.js`

Deliverables:
- `HostileHuntState` data present for wolves/barbarians.
- New events emitted and chronicle-safe:
  - `WILDLIFE_TARGET_ACQUIRED`
  - `WILDLIFE_CHASE_STARTED`
  - `WILDLIFE_ATTACKED_GOBLIN`
  - `GOBLIN_INJURED_BY_WILDLIFE`
  - `GOBLIN_KILLED_BY_WILDLIFE`
  - `WILDLIFE_BROKE_OFF`

Acceptance:
- No runtime errors with old saves (default initialization path works).
- Validation catches invalid target IDs and duplicate death transitions.

#### Phase H2: Hostile Target Acquisition + Commitment
Scope:
- Implement candidate scanning and deterministic score-based target selection.
- Add commitment window (`targetCommitUntilTick`) and retarget cooldown.
- Add wall/exposure/defense penalties in target score.

Primary files:
- `wwwroot/goblin-sim/sim/world/wildlifeSimulation.js`

Deliverables:
- Wolves/barbarians pick goblin targets in deterministic order.
- Retargeting only happens on invalid target, timeout, or materially better candidate.

Acceptance:
- Same seed + same ticks => same target sequence.
- Hostiles do not thrash target every tick.

#### Phase H3: Chase/Engage/Breakoff State Machine
Scope:
- Implement `stalk`, `chase`, `engage`, `breakoff`, `retreat` transitions.
- Add last-known-position chase behavior when LOS/path breaks.
- Add breakoff timeout and cooldown before reacquire.

Primary files:
- `wwwroot/goblin-sim/sim/world/wildlifeSimulation.js`

Deliverables:
- Hostiles move through explicit hunt states.
- Breakoff behavior prevents infinite ping-pong chasing.

Acceptance:
- If path unavailable, hostiles break off cleanly after timeout.
- State transitions are deterministic and traceable in events.

#### Phase H4: Goblin Threat Response Layer
Scope:
- Add goblin-side reaction utility shifts under local threat:
  - flee to defended tiles/home ring,
  - regroup around defense points,
  - defend/intercept when viable.
- Suppress non-survival goals under active nearby threat.

Primary files:
- `wwwroot/goblin-sim/sim/world/mapSimulation.js`
- `wwwroot/goblin-sim/sim/systems.js`

Deliverables:
- Goblins near attacks visibly change behavior instead of continuing normal chores.
- Threat alert level feeds into goal scoring.

Acceptance:
- Threatened goblins bias `return-home`/`defend`.
- Non-threatened goblins continue normal role behavior.

#### Phase H5: Damage, Injury, Death Integration
Scope:
- Implement wildlife attack resolution against goblins.
- Apply injuries (pain, bleeding, mobility penalties) for non-lethal hits.
- Apply death transition on lethal outcomes and remove invalid assignments.

Primary files:
- `wwwroot/goblin-sim/sim/world/wildlifeSimulation.js`
- `wwwroot/goblin-sim/sim/validation.js`
- `wwwroot/goblin-sim/sim/tick.js`

Deliverables:
- Wildlife attacks mutate goblin body/flags state.
- Goblin deaths are single-fire and fully reflected in sim state.

Acceptance:
- Dead goblins are never re-targeted or assigned jobs.
- Chronicle contains attacker, victim, location, and result.

#### Phase H6: UI/Debug + Tuning Pass
Scope:
- Add target/chase markers and threat overlays.
- Add urgent feed cards for injuries/deaths.
- Add tuning knobs for detection/commit/chase timeout/defense penalties.

Primary files:
- `wwwroot/goblin-sim/ui/world/mapRenderer.js`
- `wwwroot/goblin-sim/ui/render.js`
- `wwwroot/goblin-sim/ui/chronicleBrowser.js`
- `wwwroot/goblin-sim/index.js`

Deliverables:
- Player can see who is chasing whom and where pressure is highest.
- Debug inspector surfaces hunt state and target confidence.

Acceptance:
- New urgent cards jump camera to incident context.
- Behavior can be tuned without changing core logic.

#### Phase Exit Criteria (All H1-H6)
1. Hostile wildlife consistently seeks goblins via deterministic targeting.
2. Goblins react to wildlife threat with flee/regroup/defend behavior.
3. Wildlife can injure and kill goblins with valid state transitions.
4. No duplicate death transitions or post-death attack/application bugs.
5. Feed + chronicle make the full cause chain legible to the player.

### 15.11 Pathing Rules by Species
- Fish: constrained flood-neighbor pathing on water micro graph.
- Deer: local greedy + flee vector; avoid water except drink targets.
- Wolves: local pursuit with pack cohesion term.
- Barbarians: macro target selection + micro stepping to objective.

Do not add expensive global A* for all agents in MVP.
Use bounded local planning with occasional route refresh.

### 15.12 UI/UX Integration Plan

#### Map Rendering
Add new sprite categories:
- `fish` (tiny, only visible at medium+ zoom)
- `deer`
- `wolf`
- `barbarian`

Visibility rules:
- low zoom: aggregate indicators (icon + count bubble per chunk cluster)
- medium zoom: draw individual sprites for nearby viewport cells
- high zoom: show behavior hints (flee lines, target markers, pack ring)

#### Problem Feed Additions
New urgent/warning cards:
- `Wolf pack hunting near homes`
- `Barbarian raid incoming`
- `Food animals collapsing in region X`
- `Wall breach at home perimeter`

Each card includes:
- cause summary,
- confidence,
- affected location,
- suggested action (e.g., build more walls, regroup goblins, reduce exposure).

#### Inspector Additions
- Creature inspector:
  - current AI state,
  - needs/fear/aggression,
  - last 5 events,
  - home range and current target.
- Pack inspector:
  - members,
  - cohesion,
  - target,
  - recent outcomes.

### 15.13 Data Contracts for Determinism
- Every creature id generated from seed + spawn context + counter.
- Decision jitter uses deterministic hash with:
  - `tick`,
  - `creatureId`,
  - `candidateMicroX/Y`.
- No random calls outside seeded utility.
- Event ordering stable by sorted entity ids.

### 15.14 Validation Rules
Add checks to `sim/validation.js`:
- Creature tile coords in bounds.
- Creature key consistency with occupancy map.
- Fish only on water tile keys.
- Pack membership integrity (member exists, kind matches).
- Dead entities cannot occupy map.
- Barbarian raid target site ids must exist.

### 15.15 Save Schema Extension
- Bump save `schemaVersion`.
- Add migration:
  - initialize empty `wildlife` block for old saves,
  - derive spawners from current world map if missing.
- Backward compatibility:
  - if old save loaded, wildlife starts disabled until first post-load tick migration completes.

### 15.16 Tick System Placement
Recommended order (post-goblin core):
1. `wildlifeSpawnSystem`
2. `wildlifeNeedUpdateSystem`
3. `wildlifeGoalSelectionSystem`
4. `wildlifeMovementSystem`
5. `wildlifeActionSystem`
6. `barbarianRaidPlannerSystem`
7. `barbarianRaidActionSystem`
8. `eventProjectionSystem` (problem feed)

### 15.17 Performance Budget
MVP target budgets:
- wildlife entities: 80-180 total at standard world size.
- barbarian units: 6-20 active.
- tick cost target: < 4 ms average for wildlife slice on laptop baseline.

Optimization strategy:
- viewport-adjacent high-frequency updates; distant entities at throttled cadence.
- spatial buckets by chunk.
- cap neighbor scans by radius and species-specific max candidates.

### 15.18 Testing Plan

#### Unit Tests
- deterministic spawn counts by seed.
- fish never leave water tile keys.
- deer flee when wolf enters threat radius.
- wolves pick deer over goblin when both available and hunger high.
- barbarians choose weaker site in controlled fixture.

#### Simulation Property Tests
- no duplicate occupancy for single-occupancy species.
- all entity positions remain in bounds over long runs.
- event stream stable for same seed and tick count.

#### UI Tests (manual + scripted)
- map renders creature icons at expected zoom bands.
- click inspect on creature returns correct id/state.
- urgent raid card zooms to target location.

### 15.19 Implementation Phases (Recommended)

#### Phase 15.A: Wildlife Substrate
- add wildlife state container,
- add spawn/despawn,
- add fish + deer idle movement,
- add rendering + inspector skeleton.

Deliverable:
- living map with non-hostile fauna on tiles.

#### Phase 15.B: Predator Layer
- add wolves,
- add pack model,
- add deer hunting loop,
- add threat events and warnings.

Deliverable:
- visible food-chain pressure around goblin settlements.

#### Phase 15.C: Barbarian MVP
- add barbarian bands,
- add raid planning + targeting,
- add steal/damage interactions,
- add urgent feed cards and map focus actions.

Deliverable:
- external enemy pressure with clear cause/effect feedback.

#### Phase 15.D: Response Tools
- add player-facing controls tied to threats:
  - alert stance,
  - home perimeter priority,
  - emergency regroup behavior.

Deliverable:
- player can react intentionally rather than watching failure.

#### Phase 15.E: Balancing + Story Layer
- tune spawn curves and aggression.
- improve chronicle text and explainability traces.
- add seasonal behavior variation.

Deliverable:
- systems feel alive, legible, and fair.

### 15.20 Content Authoring Hooks
Define JSON-driven behavior profiles per species to avoid hardcoding:

```ts
interface SpeciesProfile {
  kind: CreatureKind;
  senses: { vision: number; hearing: number; smell: number };
  speeds: { roam: number; chase: number; flee: number };
  needsDecay: { hunger: number; thirst: number; stamina: number };
  thresholds: { hungerHigh: number; thirstHigh: number; fearHigh: number };
  goalWeights: Record<string, number>;
  biomeAffinity: Record<string, number>;
  groupRules?: { desiredGroupSize: number; maxScatter: number };
}
```

This enables fast balancing without touching engine logic.

### 15.21 Risk Register
- Risk: AI explosion from too many entities.
  - Mitigation: strict caps + throttled distant updates.
- Risk: unreadable chaos on map.
  - Mitigation: zoom-band abstraction + curated problem feed.
- Risk: unfair barbarian raids early game.
  - Mitigation: grace period + threat telegraphing + soft raid scaling.
- Risk: non-deterministic bugs.
  - Mitigation: seeded RNG policy + regression seed snapshots.

### 15.22 Acceptance Criteria
1. Fish, deer, wolves, and barbarians all exist as individual micro-tile actors.
2. Goblins can observe or be affected by those actors through explicit events.
3. Barbarian raids produce actionable feed entries with map focus and suggested fixes.
4. Wildlife/enemy behavior is deterministic for same seed + action stream.
5. The user can inspect any creature and understand current state + immediate motive.
6. Performance remains within target at standard map size.

### 15.23 Role Decomposition (Implementation-Ready)
Break each species into roles so AI logic is modular and testable.

#### 15.23.1 Shared Role Interface

```ts
type RoleKey =
  | "fish-scout" | "fish-schooler"
  | "deer-grazer" | "deer-sentinel"
  | "wolf-alpha" | "wolf-hunter" | "wolf-flanker" | "wolf-scavenger"
  | "barbarian-chief" | "barbarian-scout" | "barbarian-raider" | "barbarian-breaker" | "barbarian-carrier";

interface RoleRuntime {
  role: RoleKey;
  priority: number;                 // tie-break weight
  activeFromTick: number;
  expiresAtTick?: number;
  objective?: {
    type: "move" | "hunt" | "flee" | "raid" | "break" | "loot" | "regroup";
    tileX: number;
    tileY: number;
    targetId?: Id;
  };
}
```

#### 15.23.2 Fish Roles

Role: `fish-scout`
- Purpose: discover nearby safe water pockets and avoid dead ends.
- Activation:
  - school density below threshold, or
  - local danger increased.
- Actions:
  - sample adjacent water tiles,
  - emit short-lived "safe path" hint for nearby fish.
- Exit:
  - school cohesion restored.

Role: `fish-schooler`
- Purpose: maintain visible schooling behavior.
- Activation:
  - default fish role.
- Actions:
  - align movement vector with nearby fish centroid,
  - maintain min/max spacing band.
- Exit:
  - predator threat detected -> handoff to scout behavior.

Implementation split:
1. `fishSenseWaterConnectivity`
2. `fishRoleAssignSystem`
3. `fishSchoolStepSystem`

#### 15.23.3 Deer Roles

Role: `deer-grazer`
- Purpose: consume forage and keep herd in low-risk zones.
- Activation:
  - hunger high and no immediate predator pressure.
- Actions:
  - move toward high-forage micro cells,
  - reduce local forage pressure value.
- Exit:
  - predator enters fear radius.

Role: `deer-sentinel`
- Purpose: early predator detection and herd warning.
- Activation:
  - at least N deer in local group.
- Actions:
  - keeps slight offset from herd center,
  - increases scan radius,
  - emits `HERD_ALERT` event when wolf/barbarian seen.
- Exit:
  - group size collapses or alert cooldown active.

Implementation split:
1. `deerThreatSenseSystem`
2. `deerRoleAssignSystem`
3. `deerFleeOrGrazeSystem`

#### 15.23.4 Wolf Roles

Role: `wolf-alpha`
- Purpose: choose pack objective and keep cohesion.
- Activation:
  - exactly one per pack.
- Actions:
  - selects target prey cluster,
  - sets pack rally tile target,
  - can abort chase if risk too high.
- Exit:
  - death or forced leader swap.

Role: `wolf-hunter`
- Purpose: primary damage/chase role.
- Activation:
  - prey selected and in chase range.
- Actions:
  - shortest local pursuit step,
  - prioritize target lock over cohesion (bounded).
- Exit:
  - stamina low or target lost.

Role: `wolf-flanker`
- Purpose: side-angle pressure to prevent prey escape.
- Activation:
  - pack size >= 3 and chase active.
- Actions:
  - move to lateral intercept point around prey vector.
- Exit:
  - no valid flank lane.

Role: `wolf-scavenger`
- Purpose: stabilize pack hunger without risky hunt.
- Activation:
  - carcass or low-risk food source nearby.
- Actions:
  - collect easy food,
  - reduce pack hunger pressure.
- Exit:
  - hunt objective reasserted by alpha.

Implementation split:
1. `wolfPackLeadershipSystem`
2. `wolfRoleAssignSystem`
3. `wolfHuntResolutionSystem`

#### 15.23.5 Barbarian Roles

Role: `barbarian-chief`
- Purpose: strategic control of raid lifecycle.
- Activation:
  - one per band at spawn.
- Actions:
  - selects raid target site,
  - sets band phase: `approach -> breach -> loot -> retreat`,
  - issues regroup on heavy losses.
- Exit:
  - death triggers panic/morale drop.

Role: `barbarian-scout`
- Purpose: discover weak approach and detect defenses.
- Activation:
  - approach phase.
- Actions:
  - moves ahead of band,
  - scores wall density, goblin density, escape lanes,
  - updates chief target confidence.
- Exit:
  - breach starts.

Role: `barbarian-raider`
- Purpose: engage goblins and hold contested tiles.
- Activation:
  - breach/loot phases with resistance.
- Actions:
  - pressure nearest defenders,
  - protect carrier path when retreating.
- Exit:
  - retreat order or low morale.

Role: `barbarian-breaker`
- Purpose: damage walls/homes to open access.
- Activation:
  - blocked route to loot target.
- Actions:
  - chooses weakest nearby structure,
  - applies structure damage per action window.
- Exit:
  - path opened or destroyed.

Role: `barbarian-carrier`
- Purpose: extract stolen resources.
- Activation:
  - loot phase and stock available.
- Actions:
  - transfers resources into carry payload,
  - prioritizes shortest safe retreat path.
- Exit:
  - payload full or threat too high.

Implementation split:
1. `barbarianBandPlannerSystem`
2. `barbarianRoleAssignSystem`
3. `barbarianRaidActionSystem`
4. `barbarianRetreatSystem`

#### 15.23.6 Goblin Response Roles (Against New Actors)
Add temporary reactive roles for existing goblins so wildlife/barbarians matter immediately.

Role: `goblin-forager`
- gathers mushrooms; avoids wolf danger heat.

Role: `goblin-woodcutter`
- cuts trees; returns to home when threat alerts spike.

Role: `goblin-builder`
- prioritizes wall repair/build when barbarian threat active.

Role: `goblin-lookout`
- patrols near home perimeter and emits warning events.

Role: `goblin-defender` (light MVP)
- moves toward raid breach point and delays raiders.

#### 15.23.7 Role Transition Rules
Use explicit transition table to avoid hidden behavior jumps.

```ts
interface RoleTransitionRule {
  from: RoleKey;
  to: RoleKey;
  when: string; // readable condition id, e.g. "threat_nearby", "hunger_high"
  cooldownTicks?: number;
}
```

Minimum transitions:
- deer-grazer -> deer-sentinel when herd forms.
- deer-grazer -> flee behavior when predator proximity hit.
- wolf-hunter -> wolf-scavenger when stamina/hunger logic prefers low risk.
- barbarian-scout -> barbarian-raider when breach starts.
- barbarian-raider -> barbarian-carrier when loot opportunity opens.
- goblin-forager/woodcutter -> goblin-defender when raid urgent.

#### 15.23.8 Role-Specific Telemetry
Track role metrics so balancing is evidence-based.

Per role metrics:
- time in role,
- successful actions,
- failed actions with reason,
- average distance from objective,
- contribution score (species-specific).

Use these for:
- feed summaries,
- balancing passes,
- regression checks.

#### 15.23.9 Role-Based UI Surfaces
- Creature card shows:
  - `currentRole`,
  - `nextLikelyRole`,
  - role objective and confidence.
- Pack/Band card shows role composition:
  - `1 alpha, 2 hunters, 1 flanker`
  - `1 chief, 2 raiders, 1 breaker, 1 carryer`
- Problem cards reference role failure cause:
  - \"Barbarian breakers breached east wall (no defender nearby).\"
  - \"Wolf hunters pressured foragers outside home radius.\"

#### 15.23.10 Role Implementation Checklist
1. Add `roleRuntime` to creature schema.
2. Add role assign system per species.
3. Add role transition rules and cooldowns.
4. Add role-driven action resolver hooks.
5. Add role telemetry collection.
6. Add inspector/feed rendering for role context.
7. Add deterministic tests for role transitions by seed fixtures.

### 15.24 Phased Implementation System (Fish, Deer, Wolves, Barbarians)
This phase stack is execution-first: each phase must ship in a playable, testable state before moving on.

#### 15.24.1 Phase W0 - Asset + Render Wiring
Goal:
- make all new sprites visible in-engine with debug spawn toggles.

Scope:
- wire sprite ids in renderer: `fish`, `deer`, `wolf`, `barbarian`.
- add temporary debug spawns (fixed tile keys near start site).
- add zoom-band visibility rules for fauna/enemies.

Files:
- `wwwroot/goblin-sim/ui/world/mapRenderer.js`
- `wwwroot/goblin-sim/index.js`
- `wwwroot/goblin-sim/ui/bindings.js` (if toggle controls added)

Exit criteria:
1. All 4 sprites render at expected size and anchor to tiles.
2. No zoom drift of sprite positions.
3. Debug toggle can show/hide actor layers.

#### 15.24.2 Phase W1 - Wildlife Data Substrate
Goal:
- introduce persistent wildlife state without behavior complexity.

Scope:
- add `worldMap.wildlife` schema.
- add deterministic spawn seeds and IDs.
- add occupancy map builder for wildlife entities.
- add validation rules for bounds and key consistency.

Files:
- `wwwroot/goblin-sim/sim/state.js`
- `wwwroot/goblin-sim/sim/world/worldGen.js`
- `wwwroot/goblin-sim/sim/validation.js`

Exit criteria:
1. Save/load includes wildlife block.
2. Same seed => same initial wildlife population and positions.
3. Validation passes with wildlife enabled.

#### 15.24.3 Phase W2 - Fish + Deer Baseline AI
Goal:
- make passive ecosystem movement believable.

Scope:
- fish constrained to water micro graph.
- deer grazing, grouping, and flee response.
- simple hunger/thirst decay loop for both.
- event emission for movement/flee/graze.

Files:
- `wwwroot/goblin-sim/sim/world/wildlifeSimulation.js` (new)
- `wwwroot/goblin-sim/sim/tick.js`
- `wwwroot/goblin-sim/ui/render.js` (event feed formatting)

Exit criteria:
1. Fish never step onto non-water tiles.
2. Deer flee when predator placeholder enters radius.
3. Event feed shows meaningful wildlife state changes.

#### 15.24.4 Phase W3 - Wolves + Pack Hunt Logic
Goal:
- introduce predator pressure and pack behavior.

Scope:
- pack model (`leader`, members, cohesion).
- wolf roles: alpha/hunter/flanker/scavenger.
- deer hunt resolution.
- optional opportunistic goblin threat if isolated.

Files:
- `wwwroot/goblin-sim/sim/world/wildlifeSimulation.js`
- `wwwroot/goblin-sim/sim/world/mapSimulation.js` (goblin interaction hooks)
- `wwwroot/goblin-sim/sim/validation.js`

Exit criteria:
1. Wolves form and maintain pack coherence.
2. Hunts complete with deterministic outcomes.
3. Goblin feed receives wolf threat warnings when applicable.

#### 15.24.5 Phase W4 - Barbarian Band MVP
Goal:
- add hostile enemy raids with clear intent and counterplay.

Scope:
- barbarian spawn at edge/hostile sites.
- band roles: chief/scout/raider/breaker/carrier.
- raid phases: approach -> breach -> loot -> retreat.
- wall/home damage + stock stealing in limited form.

Files:
- `wwwroot/goblin-sim/sim/world/barbarianSimulation.js` (new or in wildlife module)
- `wwwroot/goblin-sim/sim/world/mapSimulation.js`
- `wwwroot/goblin-sim/ui/render.js`

Exit criteria:
1. At least one complete raid loop occurs and resolves.
2. Urgent problem cards identify raid cause + location.
3. Resource loss/structure damage is explainable in chronicle/feed.

#### 15.24.6 Phase W5 - Goblin Response + Player Controls
Goal:
- ensure new threats are playable, not just decorative chaos.

Scope:
- reactive goblin roles (`lookout`, `defender`, `builder-priority`).
- alert stance toggle (normal/high alert/emergency regroup).
- emergency wall-priority behavior near active breaches.

Files:
- `wwwroot/goblin-sim/sim/world/mapSimulation.js`
- `wwwroot/goblin-sim/ui/bindings.js`
- `wwwroot/goblin-simulation.html`

Exit criteria:
1. Player can trigger meaningful response behavior in < 2 clicks.
2. Goblins visibly adjust behavior during raid events.
3. Alert state is reflected in both UI and simulation outcomes.

#### 15.24.7 Phase W6 - Balancing, Telemetry, and Hardening
Goal:
- stabilize behavior quality, readability, and performance.

Scope:
- tune spawn curves and aggression weights.
- add role metrics dashboards and debug overlays.
- long-run determinism regression seeds.
- performance profiling and caps.

Files:
- `wwwroot/goblin-sim/sim/world/*.js`
- `wwwroot/goblin-sim/ui/world/mapRenderer.js`
- `wwwroot/goblin-sim/sim/world/worldGen.test.mjs`
- `wwwroot/goblin-sim/sim/*test*.mjs`

Exit criteria:
1. Tick cost remains within target budget under normal populations.
2. Regression seeds produce stable behavior signatures.
3. No critical validation warnings over long-run sim tests.

#### 15.24.8 Phase Gates (Do Not Skip)
Before advancing phases, require:
1. Determinism check: same seed + tick count => same key outcomes.
2. Validation check: `npm run sim:check` passes.
3. Playability check: top 3 active problems remain understandable from UI.
4. Story check: major actions emit clear event feed entries.

#### 15.24.9 Recommended Execution Order
1. W0 (render wiring)
2. W1 (data substrate)
3. W2 (fish/deer baseline)
4. W3 (wolves)
5. W4 (barbarians)
6. W5 (goblin response tools)
7. W6 (balancing/hardening)

This order keeps risk low: visual confirmation first, then data safety, then behavior complexity, then hostile pressure.

### 15.25 Wildlife Randomization Plan
Add controlled randomness so each run feels fresh, while keeping strict replayability for debugging.

#### 15.25.1 Seed Policy
- Default runtime behavior:
  - generate a fresh run seed each session.
- Explicit deterministic behavior:
  - allow fixed seed override (URL/query/dev setting).
- Rule:
  - all wildlife randomization must come from seeded RNG paths, never ambient `Math.random` inside sim systems.

#### 15.25.2 Randomization Domains
Randomize per run:
1. species spawn distribution weights by region band.
2. initial pack composition and leader identity.
3. home-range radius variance per creature.
4. behavior personality offsets:
  - deer skittishness,
  - wolf aggression/cohesion bias,
  - barbarian raid boldness.
5. event flavor text variants (without changing event semantics).

Do not randomize:
1. schema shape.
2. invariant checks.
3. deterministic tie-break rule order (must still be seed-driven).

#### 15.25.3 Per-Species Random Knobs
Fish:
- school tightness factor.
- drift amplitude.

Deer:
- flee threshold offset.
- graze interval variance.

Wolves:
- hunt persistence timer.
- pack regroup threshold.

Barbarians:
- raid target preference weight (wealth vs distance).
- retreat threshold.

All knobs must be sampled once at spawn and stored on entity state.

#### 15.25.4 Randomization Data Structure

```ts
interface RandomizationProfile {
  runSeed: string;
  wildlifeSeed: string;
  variantId: string; // short hash for UI/debug
  speciesKnobs: {
    fish: { schoolTightness: number; driftAmp: number };
    deer: { fleeBias: number; grazeCadence: number };
    wolf: { huntPersistence: number; regroupBias: number };
    barbarian: { raidBoldness: number; retreatBias: number };
  };
}
```

Attach to:
- `state.meta.randomizationProfile`
- include summary in map inspector/debug view.

#### 15.25.5 Generation Order for Stability
1. resolve run seed.
2. derive sub-seeds:
  - world seed,
  - wildlife seed,
  - flavor seed.
3. generate world.
4. generate wildlife with wildlife seed.
5. lock randomization profile in state.

This keeps behavior stable when replaying same seed.

#### 15.25.6 UI Visibility
Expose in debug panel:
- active run seed,
- wildlife variant id,
- top sampled knobs.

Add optional button:
- `Reroll Wildlife` (keeps world, regenerates wildlife with new wildlife sub-seed).

#### 15.25.7 Testing for Randomization
Determinism tests:
1. same seed -> same wildlife placement + same first N events.
2. different seed -> materially different wildlife metrics (population spread / first targets).

Distribution sanity tests:
1. over M seeds, no species population collapses to zero unless intentionally configured.
2. barbarian raid interval stays within min/max budget.

#### 15.25.8 Acceptance Criteria
1. Fresh sessions produce visibly different wildlife behavior patterns.
2. Fixed seed replay reproduces same outcomes.
3. Randomization knobs are inspectable in debug UI.
4. No non-seeded randomness in simulation-critical systems.

## 16) Goblin Role System Plan (Detailed Phases)

### 16.1 Goal
Introduce explicit goblin roles so labor is understandable, specialized, and scalable:
- some goblins gather food/water,
- some build/repair defenses,
- some scout and reveal the map,
- and logistics/response roles keep systems coordinated.

All role behavior must run on the smallest micro-tile simulation scale.

### 16.2 Core Role Set
- `forager`
- `water-runner`
- `woodcutter`
- `builder`
- `scout`
- `hauler`
- `lookout`

Optional later:
- `quartermaster`
- `caretaker`

### 16.3 Shared Role Data Contract

```ts
type RoleKey =
  | "forager"
  | "water-runner"
  | "woodcutter"
  | "builder"
  | "scout"
  | "hauler"
  | "lookout"
  | "quartermaster"
  | "caretaker";

interface RoleTask {
  kind: string;
  targetMicroX: number;
  targetMicroY: number;
  targetId?: Id;
  claimedAtTick: number;
  blockedReason?: string;
}

interface GoblinRoleState {
  role: RoleKey;
  rolePriority: number;             // manual bias
  roleCooldownUntilTick: number;    // anti-thrash
  roleTask?: RoleTask;
  carried?: { resource: string; amount: number };
}
```

### 16.4 Global Role Policy Data

```ts
interface RolePolicy {
  mode: "manual" | "assist" | "auto-balance";
  targets: {
    foragerCount: number;
    waterRunnerCount: number;
    woodcutterCount: number;
    builderCount: number;
    scoutCount: number;
    haulerCount: number;
    lookoutCount: number;
  };
}
```

### 16.5 Event Contract
Add role-centric event types:
- `ROLE_ASSIGNED`
- `ROLE_REASSIGNED`
- `ROLE_TASK_CLAIMED`
- `ROLE_TASK_BLOCKED`
- `RESOURCE_DELIVERED`
- `WALL_REPAIRED`
- `SCOUT_INTEL_UPDATED`
- `THREAT_SPOTTED`

Each must include:
- `goblinId`
- location (`microX/microY` or key)
- plain-language text
- optional actionable reason code

---

### 16.6 Phase R1 - Role Foundation + Forager/Woodcutter
Goal:
- establish role schema and ship first useful labor loops.

Scope:
- Add role fields to goblin/unit state.
- Add manual role assignment in roster UI.
- Implement:
  - `forager`: find mushroom node -> gather -> return/deliver.
  - `woodcutter`: find tree node -> chop -> return/deliver.
- Add blocked reason codes:
  - `NO_NODE_READY`
  - `NO_PATH`
  - `CARRY_FULL`
  - `STORAGE_UNAVAILABLE`

Systems:
1. `roleTaskPlanningSystem` (forager/woodcutter only)
2. `roleMovementSystem` (reuse existing movement with role goals)
3. `roleActionExecutionSystem`

UI:
- role tag in roster row
- current task summary in roster/inspector

Acceptance criteria:
1. Manual role assignment works reliably.
2. Forager and woodcutter complete full action loops.
3. Chronicle/feed reflects role actions and failures.

---

### 16.7 Phase R2 - Builder + Lookout + Threat Loop
Goal:
- make defense proactive and interpretable.

Scope:
- Implement `builder`:
  - consumes wood,
  - builds planned wall slots,
  - repairs damaged/breached wall priority first.
- Implement `lookout`:
  - patrol ring near homes,
  - detect wolves/barbarians,
  - emit `THREAT_SPOTTED` with confidence and location.
- Add threat memory with decay:
  - recent sightings influence builder/lookout priorities.

Systems:
1. `builderPlanSystem`
2. `lookoutPatrolSystem`
3. `threatMemorySystem`

UI:
- urgent cards from lookout sightings
- highlighted breach candidates for builders

Acceptance criteria:
1. Builders repair walls under raid pressure.
2. Lookouts detect threats before home contact in most cases.
3. Threat alerts include zoom-to-location action.

---

### 16.8 Phase R3 - Scout + Intel Frontier
Goal:
- turn map unknowns into actionable intelligence.

Scope:
- Implement `scout`:
  - selects frontier targets in low-confidence regions,
  - reveals intel through movement and site inspection.
- Add risk policy:
  - scouts avoid extreme hazard unless configured.
- Emit scout results:
  - `SCOUT_INTEL_UPDATED`
  - `SCOUT_SPOTTED_THREAT`
  - `SCOUT_FOUND_RESOURCE_CLUSTER`

Systems:
1. `scoutTargetSelectionSystem`
2. `scoutIntelUpdateSystem`
3. `scoutRiskGateSystem`

UI:
- scout report cards
- intel confidence deltas in inspector

Acceptance criteria:
1. Unknown/low-confidence areas shrink over time.
2. Scout reports are visible and traceable.
3. Scout behavior respects hazard policy.

---

### 16.9 Phase R4 - Auto Role Balancer
Goal:
- keep labor allocation adaptive under changing pressure.

Scope:
- Implement role demand model from:
  - food/water pressure,
  - wall health/threat level,
  - intel frontier size,
  - logistics backlog.
- Implement reassignment scoring:
  - skill affinity,
  - distance cost,
  - needs safety,
  - reassignment penalty.
- Add anti-thrash rules:
  - minimum role hold duration,
  - cooldown on reassign,
  - hysteresis thresholds.

Modes:
- `manual`: no automatic reassignment.
- `assist`: suggest/reassign only deficit roles with mild rules.
- `auto-balance`: full dynamic role balancing.

Acceptance criteria:
1. Role deficits are corrected without rapid oscillation.
2. Manual role locks are respected in manual/assist mode.
3. Reassignment events explain cause.

---

### 16.10 Phase R5 - Hauler + Logistics Stabilization
Goal:
- make resource flow reliable and visible.

Scope:
- Implement `hauler` role:
  - source/sink routing,
  - carrying and delivery,
  - stock zone servicing.
- Add reservation/claiming:
  - prevent duplicate task claims,
  - release claims on timeout/failure.
- Add logistics bottleneck detection:
  - unmet sink,
  - blocked route,
  - queue saturation.

Systems:
1. `haulTaskGenerationSystem`
2. `haulReservationSystem`
3. `haulExecutionSystem`
4. `logisticsBottleneckSystem`

UI:
- bottleneck feed cards
- source/sink reason chain in inspector

Acceptance criteria:
1. Gather/build loops no longer stall due to missing transfers.
2. Claimed tasks are unique and recover from failure.
3. Bottlenecks are surfaced with clear fixes.

---

### 16.11 Phase R6 - Advanced Coordination Roles (Optional)
Goal:
- push role interplay and long-term stability.

Scope:
- `water-runner`: dedicated hydration logistics.
- `quartermaster`: role demand nudging + emergency reprioritization.
- `caretaker`: assists high-need goblins and improves recovery.
- Add role synergies:
  - lookout alerts raise builder urgency,
  - scout discoveries raise forager/woodcutter target scores,
  - hauler prioritizes builder-critical supplies during raids.

Acceptance criteria:
1. Role system feels coordinated rather than isolated.
2. Emergency response quality improves measurably.
3. Added complexity remains explainable in UI.

---

### 16.12 Tick Order (Role-Aware)
Recommended order once roles are active:
1. `roleDemandSystem`
2. `roleAssignmentSystem`
3. `roleTaskPlanningSystem`
4. `goblinMovementSystem`
5. `roleActionExecutionSystem`
6. `roleEventProjectionSystem`

### 16.13 Validation Rules
- every goblin has valid role key.
- role tasks reference valid targets.
- no duplicate exclusive claims.
- blocked tasks must include reason code.
- role cooldown timestamps are monotonic.

### 16.14 Testing Plan
Unit tests:
- role assignment scoring deterministic by seed.
- blocked reason correctness.
- reassignment cooldown/hysteresis behavior.

Simulation tests:
- food shortage triggers higher forager/water-runner demand.
- raid pressure triggers builder/lookout demand increase.
- scouting reduces unknown intel area over time.

UI tests:
- roster role edits reflect immediately in sim behavior.
- role deficit cards show cause and one-click focus.
- role action logs appear in chronicle.

### 16.15 Recommended Build Order
1. R1
2. R2
3. R4 (minimal)
4. R3
5. R5
6. R6

Rationale:
- survival/defense first,
- then adaptive assignment,
- then exploration/logistics depth.

---

## 17) World Feature Expansion Plan (New)
Goal:
- deepen the world so map decisions matter long-term, not just at start.
- improve replayability through systemic variation and world-driven pressure.
- keep additions explainable via map + feed + inspector.

### 17.1 Candidate Plans (Pick One First)

### Plan A - Seasons + Climate Pressure (High Value / Low-Medium Risk)
What it adds:
- dynamic seasons (`spring`, `summer`, `autumn`, `winter`) with weather events.
- biome productivity and hazard shifts over time.
- migration pressure (wildlife movement) and resource scarcity windows.

Simulation systems:
1. `seasonProgressionSystem`
2. `weatherEventSystem`
3. `biomeYieldModifierSystem`
4. `seasonalWildlifeMigrationSystem`

UI:
- season clock + weather forecast strip.
- map overlay for expected yield/risk next N days.
- warnings for upcoming shortages.

Acceptance:
1. same seed gives deterministic seasonal timeline.
2. player can predict and prepare for winter/resource dips.
3. weather events visibly impact at least 3 world systems.

### Plan B - Faction Frontiers + Diplomacy (High Value / Medium Risk)
What it adds:
- faction territory growth/decline by region.
- diplomacy states (`hostile`, `tense`, `neutral`, `trade`, `allied`).
- border incidents (raids, patrol clashes, toll pressure).

Simulation systems:
1. `factionFrontierDriftSystem`
2. `diplomacyStateSystem`
3. `factionActionSystem`
4. `factionConsequenceSystem`

UI:
- frontier overlay with trend arrows.
- diplomacy panel with causes and levers.
- incident cards with focus + suggested response.

Acceptance:
1. frontier shifts are explainable from prior events.
2. player actions can measurably improve/worsen relations.
3. faction pressure changes route/site viability.

### Plan C - Dynamic Sites + Ruin/Dungeon Lifecycle (Medium-High Value / Medium Risk)
What it adds:
- sites evolve: camps grow/decline, ruins collapse/reopen, dungeons repopulate.
- site state affects nearby hazards/resources/intel quality.
- rare world events unlock temporary site opportunities.

Simulation systems:
1. `siteLifecycleSystem`
2. `ruinStateSystem`
3. `dungeonRespawnSystem`
4. `worldOpportunitySystem`

UI:
- site status badges (stable/contested/decayed/active).
- time-to-change hints for key sites.
- opportunity tracker with expiration.

Acceptance:
1. sites no longer feel static after day 1.
2. player can identify high-opportunity windows from UI.
3. map travel priorities change over time in understandable ways.

### Plan D - Trade Network + Caravans + Route Economy (High Value / Medium-High Risk)
What it adds:
- caravan flows across routes with supply/demand pricing.
- route disruption (weather, raids, tolls) impacts economy.
- player can secure, tax, or prioritize key corridors.

Simulation systems:
1. `marketDemandSystem`
2. `caravanSpawnAndPathSystem`
3. `routeDisruptionSystem`
4. `tradeSettlementSystem`

UI:
- route heatmap (profit, risk, reliability).
- caravan cards with ETA and cargo.
- economic alerts for shortages/opportunities.

Acceptance:
1. trade materially influences survival and growth.
2. route control choices create strategic tradeoffs.
3. disrupted routes produce clear downstream effects.

### 17.2 Shared Engineering Guardrails
- deterministic simulation: no direct `Math.random()` in systems.
- bounded cost: target < 10ms sim tick at MVP world size.
- explainability: every major event has cause chain + map anchor.
- progressive rollout: behind feature flags per plan.

### 17.3 Suggested Rollout Sequence
1. Plan A (seasons/climate)
2. Plan C (site lifecycle)
3. Plan B (faction frontiers)
4. Plan D (trade network)

Reason:
- climate + sites create strong world texture first.
- politics/economy become richer once world dynamics are in place.

### 17.4 Plan A Deep Dive - Seasons + Climate Pressure
Goal:
- make time itself a strategic constraint.
- force proactive planning (stockpiles, route timing, labor shifts).
- keep outcomes readable and deterministic.

#### 17.4.1 Design Pillars
1. Forecastable, not arbitrary:
   Player can see likely next-season pressure and prepare.
2. Multi-system impact:
   Climate must affect resources, wildlife, hazards, and travel.
3. Recoverable failure:
   A bad season hurts, but does not create unavoidable dead-ends.

#### 17.4.2 Season Model (Core Rules)
- 4 seasons per year:
  - `spring`: regrowth + stable travel
  - `summer`: high yield, heat risks
  - `autumn`: harvest peak, storm ramps
  - `winter`: low yield, high warmth/thirst logistics pressure
- Day cadence:
  - `dayOfSeason`: 1..`daysPerSeason`
  - default `daysPerSeason = 18` (tunable)
- Deterministic calendar:
  - seed + year + day determines weather roll bands.

#### 17.4.3 Weather Taxonomy
Weather state:
- `clear`
- `rain`
- `storm`
- `cold-snap`
- `heat-wave`
- `fog`

Weather effects (examples):
- `rain`: +water node recharge, -travel speed minor.
- `storm`: +route disruption chance, +hazard pressure.
- `cold-snap`: +warmth decay, +wood demand.
- `heat-wave`: +thirst decay, -labor efficiency.
- `fog`: -intel confidence gain, +ambush risk.

#### 17.4.4 Data Model Additions
Add to `state.world`:
```ts
season: {
  key: "spring" | "summer" | "autumn" | "winter";
  year: number;
  dayOfSeason: number;
  daysPerSeason: number;
}
weather: {
  current: WeatherKey;
  intensity: number;          // 0..1
  startedAtTick: number;
  expectedDurationDays: number;
}
forecast: {
  next7Days: Array<{
    dayOffset: number;
    season: string;
    likelyWeather: WeatherKey;
    confidence: number;
    risk: "low" | "moderate" | "high";
  }>;
}
climateModifiers: {
  byBiome: Record<BiomeKey, {
    foodYieldMul: number;
    woodYieldMul: number;
    hazardMul: number;
    travelMul: number;
  }>;
}
```

#### 17.4.5 Systems (Plan A)
1. `seasonProgressionSystem`
- advances day/season/year.
- emits: `SEASON_STARTED`, `SEASON_DAY_CHANGED`.

2. `weatherEventSystem`
- resolves weather transitions using deterministic weighted tables.
- emits: `WEATHER_CHANGED`, `WEATHER_WARNING`.

3. `climateModifierSystem`
- computes per-biome modifiers from season + weather.
- writes `world.climateModifiers`.

4. `seasonalResourceSystem`
- applies yield/recharge effects:
  - mushroom/tree regrowth rates,
  - water source reliability,
  - food spoilage pressure (optional later).

5. `seasonalWildlifeMigrationSystem`
- shifts spawn density and behavior by season/weather.
- winter pushes pressure toward habitable/start regions.

6. `seasonalRoutePressureSystem`
- adjusts route reliability/cost from storms/flood/cold.
- emits route warnings with map anchors.

#### 17.4.6 Tick Order Integration
Insert early in world pipeline:
1. `seasonProgressionSystem`
2. `weatherEventSystem`
3. `climateModifierSystem`
4. existing world simulation systems
5. wildlife simulation
6. resource purpose / goblin systems

Reason:
- downstream systems must read climate state as input, not recompute.

#### 17.4.7 UI Contract (Plan A)
Add UI surfaces:
1. Season strip (always visible):
   - current season/day, weather, intensity icon.
2. Forecast card:
   - next 7 days with risk badges.
3. Climate overlay mode:
   - expected yield / hazard for selected season window.
4. Warnings:
   - “winter in 3 days”, “storm route disruption likely”.
5. Inspector additions:
   - selected region climate multipliers + confidence.

Acceptance UX checks:
1. Player can answer “what gets harder next week?” in < 5 seconds.
2. At least one pre-emptive action is obvious for each high-risk forecast.

#### 17.4.8 Event Schema Additions
```ts
type ClimateEvent =
  | { type: "SEASON_STARTED"; season: string; year: number }
  | { type: "WEATHER_CHANGED"; weather: string; intensity: number }
  | { type: "WEATHER_WARNING"; weather: string; etaDays: number; risk: string }
  | { type: "ROUTE_DISRUPTION_RISK"; routeId: Id; weather: string; severity: string }
  | { type: "SEASONAL_RESOURCE_SHIFT"; resource: string; deltaMul: number; biome: string };
```

#### 17.4.9 Balancing Knobs (Data-Driven)
- `daysPerSeason`
- weather transition weights per season
- yield multipliers per biome/season
- hazard and travel multipliers
- wildlife migration bias coefficients

Rule:
- all knobs in one config object; avoid hard-coded constants in systems.

#### 17.4.10 Delivery Phases
Phase A1 (MVP):
- season clock + deterministic progression
- weather changes + basic yield modifiers
- UI season strip + simple forecast

Phase A2:
- route pressure + wildlife migration hooks
- climate warning cards + map focus

Phase A3:
- deeper scarcity loops (spoilage/stockpiles)
- refined balancing and scenario variants

#### 17.4.11 Validation + Tests
Unit:
- same seed reproduces identical season/weather sequence.
- modifiers stay within configured bounds.

Simulation:
- winter causes measurable increase in critical warmth/food pressure.
- storms increase route disruption events versus clear baseline.
- spring increases regrowth versus winter baseline.

UI:
- forecast updates exactly once per day change.
- warning cards focus correct region/route.
- overlay legend matches active climate mode.

#### 17.4.12 Performance Budget
- climate systems combined target: < 1.5ms/tick at MVP scale.
- avoid per-entity weather recomputation:
  - compute global + per-biome modifiers once/tick.
  - entities read cached values.

#### 17.4.13 Risks + Mitigations
Risk 1:
- climate overwhelms player with noise.
Mitigation:
- aggregate alerts; cap repeated warning spam.

Risk 2:
- winter causes hard fail spiral too fast.
Mitigation:
- floor values for baseline yields + emergency event relief.

Risk 3:
- unpredictability feels unfair.
Mitigation:
- forecast confidence + deterministic seeds + visible cause chain.

### 17.5 Plan A Execution Checklist (File-Mapped)
Use this as the build contract for Plan A. Do not mark complete until acceptance checks pass.

1. Climate constants + config scaffold
- Files:
  `wwwroot/goblin-sim/sim/constants.js`
- Build:
  Add season keys, weather keys, default days-per-season, and climate tuning tables.
  Keep all tuning knobs centralized and data-driven.
- Acceptance:
  All climate systems consume config from one module; no duplicate hard-coded climate values.

2. Initial state schema extension
- Files:
  `wwwroot/goblin-sim/sim/state.js`
- Build:
  Add `world.season`, `world.weather`, `world.forecast`, and `world.climateModifiers`.
  Initialize deterministically from run seed.
- Acceptance:
  New run has valid season/weather/forecast state and no validation warnings.

3. Season and weather systems
- Files:
  `wwwroot/goblin-sim/sim/world/mapSimulation.js`, `wwwroot/goblin-sim/sim/tick.js`
- Build:
  Implement `seasonProgressionSystem` and `weatherEventSystem`.
  Emit `SEASON_STARTED`, `SEASON_DAY_CHANGED`, `WEATHER_CHANGED`, `WEATHER_WARNING`.
  Integrate tick order before world behavior systems that consume climate.
- Acceptance:
  Same seed reproduces identical season/weather sequence for first 200 ticks.

4. Climate modifier computation
- Files:
  `wwwroot/goblin-sim/sim/world/mapSimulation.js`
- Build:
  Implement `climateModifierSystem` writing per-biome cached multipliers.
  Avoid per-entity recomputation.
- Acceptance:
  Modifier values remain bounded and update only when season/weather changes.

5. Resource response hooks
- Files:
  `wwwroot/goblin-sim/sim/world/mapSimulation.js`, `wwwroot/goblin-sim/sim/systems.js`
- Build:
  Apply seasonal/weather multipliers to regrowth/yield and baseline resource pressure.
  Emit `SEASONAL_RESOURCE_SHIFT` when major transitions occur.
- Acceptance:
  Winter vs spring produces measurable, explainable resource delta in simulation logs.

6. Wildlife migration hooks
- Files:
  `wwwroot/goblin-sim/sim/world/wildlifeSimulation.js`
- Build:
  Add climate-sensitive migration bias (winter pressure toward habitable areas, weather avoidance).
  Keep deterministic movement and bounded per-tick cost.
- Acceptance:
  Wildlife distribution shifts by season and remains deterministic for a fixed seed.

7. Route pressure hooks
- Files:
  `wwwroot/goblin-sim/sim/world/mapSimulation.js`, `wwwroot/goblin-sim/sim/world/worldGen.js`
- Build:
  Add route reliability/risk modifiers based on active weather and season.
  Emit route-focused warning events with route/site anchors.
- Acceptance:
  Storm/cold periods increase disruption risk and warnings include map-focus context.

8. Validation rules for climate data
- Files:
  `wwwroot/goblin-sim/sim/validation.js`
- Build:
  Add invariants:
  valid season/weather enums, intensity bounds, day range, forecast integrity, modifier bounds.
- Acceptance:
  Invalid climate state is caught with explicit warning codes/messages.

9. UI season strip + forecast panel
- Files:
  `wwwroot/goblin-simulation.html`, `wwwroot/goblin-sim/ui/render.js`
- Build:
  Add always-visible season/weather strip and 7-day forecast card.
  Show risk badges and confidence.
- Acceptance:
  Player can identify current season/weather and next major risk in under 5 seconds.

10. Climate overlay mode + legend
- Files:
  `wwwroot/goblin-sim/ui/world/mapRenderer.js`, `wwwroot/goblin-simulation.html`, `wwwroot/goblin-sim/ui/bindings.js`
- Build:
  Add overlay mode(s) for climate yield/risk visualization.
  Extend legend and selector wiring.
- Acceptance:
  Overlay and legend remain in sync and clearly explain map color semantics.

11. Climate warnings in feed with focus
- Files:
  `wwwroot/goblin-sim/ui/chronicleBrowser.js`, `wwwroot/goblin-sim/ui/render.js`, `wwwroot/goblin-sim/ui/bindings.js`
- Build:
  Surface weather/route/season warnings in problem feed buckets.
  Ensure focus jump centers relevant region/site/route context.
- Acceptance:
  Every climate warning has at least one actionable map jump path.

12. Tests and regression checks
- Files:
  `wwwroot/goblin-sim/sim/world/worldGen.test.mjs`, `package.json`
- Build:
  Add deterministic climate progression tests and baseline seasonal pressure checks.
  Include lightweight UI-state checks for season strip/forecast/overlay selectors.
- Acceptance:
  `npm run sim:verify` (or equivalent check + test suite) passes consistently.
