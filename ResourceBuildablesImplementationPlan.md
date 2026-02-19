# Resource + Buildables Implementation Plan (Technical)

Status legend:
- `[x]` Done
- `[-]` In Progress
- `[ ]` Not Started
- `[!]` Blocked

Conventions:
- “Data contract” means exact shape in state + persistence expectations.
- “System” means simulation tick logic in `sim/*`.
- “UI” means render/bindings interactions in `ui/*` and `index.js`.

---

## 0) Program Control

### 0.A Baseline Audit
- `[x]` Inventory current resources and build actions.
- `[x]` Inventory current structures and seeded-vs-buildable distinction.
- `[x]` Capture active balance knobs and where they are applied.

Technical outputs:
- Source map:
  - Resource definitions: `wwwroot/goblin-sim/sim/constants.js`
  - Runtime stocks: `wwwroot/goblin-sim/sim/state.js`
  - Build/role execution: `wwwroot/goblin-sim/sim/world/mapSimulation.js`
  - Need/resource tick economics: `wwwroot/goblin-sim/sim/systems.js`
- Gap list:
  - Resources exist without full UI coverage.
  - Structures exist without unified build queue/menu.

### 0.B Tracking Governance
- `[x]` This file is the canonical tracker.
- `[ ]` Add update metadata to each phase section.
- `[ ]` Add completed-slice changelog.

Implementation detail:
- Add this header block on every update:
  - `UpdatedBy`
  - `UpdatedAtTick`
  - `UpdatedAtDate`
  - `Scope`

---

## 1) Resource UI Program

### 1.A Full Resource HUD
- `[ ]` Show all resources from `RESOURCE_PURPOSES` and `state.tribe.resources`.
- `[ ]` Group by category with deterministic order.
- `[ ]` Add compact/expanded mode.

Data contract:
- `ui.resourceView = { mode: "compact" | "expanded", selectedResourceKey: string | null }`
- `ui.resourceCategories = { survival:[], industry:[], defense:[], strategic:[] }` (derived, not persisted)

Module work:
- `wwwroot/goblin-sim/ui/render.js`
  - Add `renderResourcePanel(state, els)` using full resource key set.
- `wwwroot/goblin-sim/index.js`
  - Bind compact/expanded toggle state.

Exit criteria:
- Every key in `RESOURCE_PURPOSES` appears in expanded UI.
- Missing stock keys safely render as `0`.

### 1.B Flow + Trend Layer
- `[ ]` Add per-resource delta over window.
- `[ ]` Add trend arrows and shortage ETA.

Data contract:
- `worldMap.structures.resourceTelemetry = {`
  - `tickWindow: number,`
  - `historyByResource: Record<string, Array<{ tick:number, value:number }>>,`
  - `netDeltaByResource: Record<string, number>,`
  - `etaToZeroByResource: Record<string, number | null>`
- `}` (runtime-only acceptable)

System work:
- In `worldMapSimulationSystem` or dedicated system:
  - sample stocks every N ticks
  - compute net delta + ETA.

UI work:
- render trend icon:
  - `up` if delta > threshold
  - `down` if delta < -threshold
  - `flat` otherwise

Exit criteria:
- Trend values update deterministically for same seed + actions.
- ETA unavailable state shown cleanly when net positive.

### 1.C Resource Drilldown
- `[ ]` Resource detail panel with sources/sinks/events.
- `[ ]` Role contribution estimates.

Data contract:
- `worldMap.structures.resourceFlow = {`
  - `sourcesByResource: Record<string, Record<string, number>>,`
  - `sinksByResource: Record<string, Record<string, number>>,`
  - `lastEventsByResource: Record<string, Array<string>>`
- `}`

System work:
- Attribute known events to source/sink buckets (e.g., `WATER_COLLECTED`, `RESOURCE_DELIVERED`, build cost spends).

UI work:
- Click resource row -> open detail pane.
- Show top 3 sources/sinks with percent contribution.

---

## 2) Unified Buildables Platform

### 2.A Buildable Registry
- `[ ]` Introduce central buildable spec registry.
- `[ ]` Migrate hardcoded costs/rules into registry.

Data contract:
- New module: `wwwroot/goblin-sim/sim/buildables/buildableDefs.js`
- Shape:
```js
{
  key,
  category, // defense | settlement | industry | utility
  costs: Record<string, number>,
  buildTicks,
  requiresTech?: string[],
  placement: {
    onWater: false,
    minDistanceFromHome?: number,
    maxSlope?: number, // optional future
    blockedBy: ["home","wall","resourceNode","site"]
  },
  effects: {...}
}
```

Exit criteria:
- No new buildable added outside registry.
- Existing `HOME_BUILD_COST_*` and defense costs referenced through registry or compatibility adapter.

### 2.B Build Queue Core
- `[ ]` Unified queue for place/build/repair/cancel.
- `[ ]` Priority and claim semantics.

Data contract:
- `worldMap.structures.buildQueue = {`
  - `jobsById: Record<string, BuildJob>,`
  - `queueIds: string[],`
  - `cursor: number`
- `}`
- `BuildJob = {`
  - `id, buildableKey, status, priority,`
  - `tileX,tileY,microX,microY,`
  - `createdTick, startedTick?, completedTick?,`
  - `claimedByGoblinId?, claimUntilTick?,`
  - `blockedReason?`
- `}`

System work:
- `rebuildBuildQueueSystem` (optional for derived jobs),
- `claimBuildJobForBuilder`,
- `executeBuildJob`.

Exit criteria:
- Builder never directly builds from ad-hoc task if queue exists for that buildable.
- Job lifecycle fully observable in debug/chronicle.

### 2.C Placement Validation Service
- `[ ]` Central validator shared by UI and sim.

Module:
- `wwwroot/goblin-sim/sim/buildables/placementValidation.js`

API:
```js
validatePlacement(state, buildableKey, tileX, tileY) => {
  ok: boolean,
  reasonCode?: string,
  reasonText?: string
}
```

Exit criteria:
- UI ghost preview and simulation placement use same validator function.
- No duplicated placement rule logic in scattered files.

### 2.D Buildables UI
- `[ ]` Menu + queue + controls.

UI components:
- Buildables menu panel.
- Placement mode overlay.
- Queue inspector with reprioritize/cancel.

Bindings:
- `ui.world.interactions.js`: placement clicks.
- `index.js`: action dispatch.

---

## 3) Buildables Content Phases

### 3.A Defense (Player-Buildable)
- `[x]` Runtime defenses exist and function.
- `[ ]` Build jobs for `spring_turret`.
- `[ ]` Build jobs for `spike_trap`.

Technical notes:
- Reuse existing `automatedDefensesByTileKey` runtime.
- Add construction path that materializes same structure schema.

### 3.B Settlement Utility
- `[x]` Homes/walls/outposts active.
- `[ ]` Storage depot structure.
- `[ ]` Well/cistern structure.

Data contract additions:
- `structures.depotsByTileKey`
- `structures.wellsByTileKey`

Effects:
- Depot increases effective capacity by category.
- Well/cistern reduces path distance to drink targets and/or increases water stock reliability.

### 3.C Industry Stations
- `[x]` Recipe runtime exists.
- `[ ]` Buildable stations for recipe enablement and throughput.

Data model:
- `structures.industryStationsByTileKey = { key, stationType, durability, throughputMul }`

Rules:
- Recipe executable only if station count/availability meets requirement.

### 3.D Strategic/Intel
- `[ ]` Scout tower / beacon optional set.

Purpose:
- Expand intel confidence recovery and route visibility.

---

## 4) Economy + AI Coupling

### 4.A Balance Controls
- `[x]` Global multipliers UI exists.
- `[ ]` Per-resource consumption controls in UI.
- `[ ]` Buildable upkeep controls.

Implementation detail:
- Extend `state.meta.tuning.balance` with per-resource keys:
  - `consumptionMulByResource`
  - `upkeepMulByBuildable`

### 4.B Role Arbitration
- `[x]` Need preemption + hydration/rest fixes.
- `[x]` Builder/woodcutter priority fixes.
- `[ ]` Queue-aware role floor boosts.

Algorithm requirement:
- Builder floor derived from active build queue complexity and SLA target ticks.
- Woodcutter floor reacts to wood burn + queued wood costs.

### 4.C Deadlock Recovery
- `[x]` Threat deadlock standdown.
- `[x]` Reachable water source targeting.
- `[ ]` Build queue deadlock detector.

Build deadlock detector contract:
- `buildJob.noProgressTicks`
- if threshold reached:
  - release claim
  - attempt reroute
  - revalidate placement
  - emit `BUILD_JOB_STALLED` event

---

## 5) Testing + Telemetry

### 5.A Unit/Logic Tests
- `[ ]` Buildable registry schema tests.
- `[ ]` Placement validator matrix tests.
- `[ ]` Queue claim/timeout/retry tests.

### 5.B Simulation Regression
- `[ ]` Resource conservation tests (no phantom creation except configured multipliers).
- `[ ]` Build cost spend exactness tests.
- `[ ]` Deadlock recovery tests for threat and build queue.

### 5.C Runtime Telemetry
- `[ ]` Per-role blocked reason counters.
- `[ ]` Build throughput and mean completion time.
- `[ ]` Resource inflow/outflow by source/sink.

### 5.D Exit Gates
- `[ ]` `sim:verify` and determinism checks pass.
- `[ ]` Long-run soak with no stuck escalation loops.
- `[ ]` UI remains responsive with high population and large queues.

---

## 6) Sequence (Execution Order)

### 6.A Immediate Next (Recommended)
1. `[ ]` Phase 1.A + 1.B (full resource HUD + trend math).
2. `[ ]` Phase 2.A (buildable registry skeleton).
3. `[ ]` Phase 2.B minimal queue for one new buildable.

### 6.B Expansion
1. `[ ]` Phase 2.C + 2.D (validator + build UI).
2. `[ ]` Phase 3.A (player-built turret/trap).
3. `[ ]` Phase 3.B (depot/well).

### 6.C Hardening
1. `[ ]` Phase 4.B queue-aware role floors.
2. `[ ]` Phase 4.C build deadlock detection.
3. `[ ]` Phase 5 telemetry/tests/release gates.

---

## 7) Current Snapshot

### 7.A Completed Foundations
- `[x]` Multi-site wall planning lifecycle.
- `[x]` Outpost-aware builder targeting.
- `[x]` Hydration/rest preemption and instant drink.
- `[x]` Reachable water targeting.
- `[x]` Threat no-path deadlock standdown.
- `[x]` Woodcutter wall-demand prioritization.

### 7.B Still Missing for “All Resources + Buildables”
- `[ ]` Full resource UI coverage (all keys + drilldown).
- `[ ]` Unified buildable registry.
- `[ ]` Unified player build queue/menu.
- `[ ]` Player-build path for existing defense and industry structures.

