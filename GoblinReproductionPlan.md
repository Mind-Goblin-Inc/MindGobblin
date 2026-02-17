# Goblin Reproduction Plan

## Goal
Add a deterministic reproduction loop where idle goblins can create a new goblin when local safety conditions are met.

## Design Constraints
- Reproduction is simulation-driven, not a direct player spawn action.
- Must be blocked during active danger.
- Must use existing entity creation path (`createGoblin`) for consistency.
- Must be explainable through chronicle events and debug state.

## Core Behavior
1. Detect eligible goblins:
   - alive, not missing/imprisoned/exiled
   - not in critical needs state
   - currently idle or low-priority idle-capable role (builder/lookout/forager/woodcutter/scout with no actionable task)
2. Pair eligible goblins:
   - two unique goblins, nearest-first within local radius
   - optional cooldown/history to prevent immediate re-pair spam
3. Safety gate must pass:
   - no active predator pressure near settlement OR
   - settlement wall protection above threshold
4. If pair + safety pass:
   - reserve pair for a short action window
   - emit chronicle event (attempt started)
   - after completion window, spawn one new goblin near home cluster

## Safety Definition (MVP)
- `safeByPredator`: no hostile wildlife in `THREAT_LOCAL_RADIUS` of home/settlement center.
- `safeByWalls`: wall plan exists and wall coverage/health score >= configured threshold.
- reproduction allowed when `safeByPredator || safeByWalls`.

## Data Model Additions
Add to `state.worldMap.structures` (or `state.tribe`) a reproduction state block:

```js
reproduction: {
  enabled: true,
  cooldownTicks: 120,
  pairDurationTicks: 10,
  minIdleTicks: 12,
  maxBirthsPerDay: 2,
  lastBirthTick: -1000,
  birthsThisDay: 0,
  pairByGoblinId: { [goblinId]: { partnerId, startedTick, completesAtTick } },
  recentPartnerByGoblinId: { [goblinId]: { partnerId, lastTick } }
}
```

Add lightweight per-goblin metadata in `goblin.modData`:

```js
reproduction: {
  idleSinceTick: number,
  lastBirthContributionTick: number
}
```

## Systems
Implement new system in `wwwroot/goblin-sim/sim/world/mapSimulation.js`:

1. `reproductionEligibilityUpdate(state, tick)`
   - track `idleSinceTick`
   - compute per-goblin eligibility

2. `reproductionPairingSystem(state, tick, events)`
   - pick pairs from eligible pool
   - respect cooldowns and partner-history anti-spam
   - create pair reservations
   - emit `GOBLIN_REPRO_ATTEMPT_STARTED`

3. `reproductionResolveSystem(state, tick, events)`
   - resolve pairs reaching `completesAtTick`
   - spawn new goblin via `createGoblin`
   - place near home/start site
   - emit `GOBLIN_BORN`

4. `reproductionCleanupSystem(state, tick)`
   - clear stale/invalid pair records
   - reset daily birth counters on day rollover

## Tick Order Integration
In world map simulation pipeline order:
1. threat/safety updates
2. role goal assignment
3. movement/action execution
4. reproduction eligibility/pairing/resolve

Reason:
- uses current threat and role state
- avoids conflicting with high-priority survival actions

## Event Schema
- `GOBLIN_REPRO_ATTEMPT_STARTED`
  - `goblinAId`, `goblinBId`, `completesAtTick`, `safetyReason`
- `GOBLIN_REPRO_ATTEMPT_CANCELED`
  - `reasonCode` (`THREAT_ACTIVE`, `NO_LONGER_IDLE`, `INVALID_PAIR`)
- `GOBLIN_BORN`
  - `newGoblinId`, `parentAId`, `parentBId`, `siteId`, `tileX`, `tileY`

## Balancing Knobs
- `minIdleTicks`
- `pairDurationTicks`
- `cooldownTicks`
- `maxBirthsPerDay`
- wall safety threshold
- predator radius

All knobs should live in one constants/config section.

## UI + Explainability
- Add a compact reproduction status block in debug inspector:
  - eligible count
  - active pairs
  - births this day
- Chronicle entries must explain why births started/canceled.

## Validation Rules
- pair map must be symmetric (A->B and B->A metadata consistent)
- goblin IDs in pairs must exist and be alive
- no goblin appears in more than one active pair
- births per day must not exceed configured cap

## Test Plan
Unit tests:
- deterministic pairing with fixed seed
- safety gate true/false behavior
- cooldown and max-birth caps

Simulation tests:
- no births under persistent nearby predator pressure
- births occur during long safe idle windows
- wall-protected settlement still allows births when predators are distant

Regression checks:
- no impact on existing role loops (forage/build/lookout/scout)
- no spawn when goblin pool < 2 eligible entities

## Rollout Steps
1. Add config + state scaffolding.
2. Add eligibility + pairing (no spawn yet), log-only events.
3. Add spawn resolution and full events.
4. Add debug inspector block and tuning pass.
5. Add tests and run `npm run sim:verify`.

## Open Questions
- Should reproduction require specific roles (only idle builders) or any idle adults?
- Should there be a minimum food/water stock requirement?
- Should newborn start as `whelp` with temporary reduced capabilities?
