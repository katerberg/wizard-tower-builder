---
name: Mine harvest — Prospecting (phase 2)
overview: 'Build-phase prospector allocation + attack-time next-tier reveal with iron/gem vein content, rare falloff, and extended wave-clear haul. Folds index slices 2+3. Docs update in the same PR. No storage / leylines / mine elevators.'
todos:
  - id: types-baseline
    content: Widen MinePatch resources; unlockedDepth; prospectAllocation; WaveClearSummary prospect fields; wire BuildBaseline/undo
  - id: veins-generate
    content: On prospect resolve, append next depth tunnels + quality-rolled veins; rare falloff harvest; optional passive iron drip
  - id: allocate-ui
    content: setProspectAllocation intent + HUD/quarters stepper; equip cost on startWave; reserve prospectors from auto pool
  - id: prospect-job
    content: Prospector workplace path/work timer; stay-put; always reveal next tier; clear modal/log summary
  - id: docs-tests
    content: Update MINES/HOUSING/ECONOMY_COST_MATRIX/README/index; mines + store tests
isProject: false
---

# Mine harvest — Prospecting (phase 2)

**Design:** [`docs/MINES.md`](../../docs/MINES.md)  
**Index:** [`mine_harvest_index.plan.md`](./mine_harvest_index.plan.md)  
**Depends on:** Engine slice **shipped** (shallow stone grid, ground access, stone haul modal)

## Decision (scope)

Index listed **veins (slice 2)** then **prospect (slice 3)** separately. Phase 2 **folds both** into one delivery: prospecting is the player-facing loop, and iron/gem veins + falloff are required for a meaningful quality roll and “vein found” clear beat. **Storage** and **leylines** stay later.

## Player-facing outcome

1. In **build**, set how many laborers prospect this wave (global allocation; removed from repair/pump/mine auto pool).
2. Optionally pay a small **equip** cost when the wave starts (if allocation > 0).
3. During **attack**, prospectors path to the mine frontier and complete a scout job.
4. They **always** unlock the next depth tier; a **quality roll** decides how useful the new patches are (poor → mostly stone; better → iron/metal and gem→gold).
5. Leftover laborers auto-mine stone (uncapped) and rare veins (**with falloff**).
6. Wave-clear modal/log includes haul **and** prospect result (e.g. “Discovered depth 2 — mixed iron veins”).

---

## IN SCOPE

### Data model

| Field | Role |
|-------|------|
| `MinePatch.resource` | `'stone' \| 'metal' \| 'gold'` (iron→metal, gems→gold) |
| `MineState.unlockedDepth` | Highest revealed depth (starts at shallow `MINE_SHALLOW_DEPTH`) |
| `prospectAllocation: number` | Build-phase global count; persists across waves like other allocations |
| `WaveClearSummary` | Add `prospectNote: string \| null` (and keep `haul`) |
| `BuildBaseline` / undo draft | Include `prospectAllocation` |

### Generation

- Keep run-start **shallow-only** generation (current `generateShallowMine`).
- On prospect **resolve**, append tunnels + patches for the **next** depth band only (deterministic layout from run seed + depth index; quality roll uses RNG stream).
- Quality bands (provisional labels): `poor` / `mixed` / `rich` — weights TBD in config; always at least some walkable stone so the tier is never empty.
- Do **not** pre-generate the entire deep map.

### Harvest

- Stone: unchanged rate; **no** laborer falloff.
- Metal / gold patches: harvest rate with **diminishing returns** per extra laborer on the same patch (config curve).
- Optional small **passive iron** while working stone (low % of stone tick → metal) — flavor only.
- All yields continue to accumulate in `waveHaul` (metal/gold too).

### Prospect job

- Target id e.g. `mine:prospect`.
- Deploy: spawn all laborers; mark N as prospectors first (player allocation); they do not enter repair/pump/mine auto-assign.
- Path to frontier cell (deepest unlocked shaft tip); work timer; on complete → `revealNextTier(state)`.
- Stay-put vs repair (same as mine/pump).
- If disconnected from ground: cannot prospect (same path rules); warn via logistics if allocation > 0 but no path.

### Build UI / economy

- Intent `setProspectAllocation` + clamp `0 … recruitedLaborers`.
- Control: **HUD build stepper** (“Prospectors”) — global pool, not per-room (mirrors “removed from regular pool”).
- Equip cost (provisional): pay on `startWave` when `prospectAllocation > 0` from committed resources (e.g. stone + metal); amounts in `src/config/mines.ts`. Undo/revert restores via baseline resources pattern already used for recruit spend — prefer charging at wave start only so undo stays simple.
- Wire dirty/undo if allocation changes mid-build (`recordBuildStep`).

### Clear UX

- Extend `formatWaveHaul` (already multi-resource) and `waveClearBody` with prospect line.
- `endWave` log: haul + prospect note when a tier was revealed this wave.

### Tests

- Allocation clamps; prospectors excluded from mine auto-fill.
- Reveal appends depth and patches; quality always creates something.
- Rare falloff: second laborer yields less than first on metal patch.
- Wave-clear modal shows prospect note.
- Undo/baseline includes prospect allocation.

---

## OUT OF SCOPE

- Storage rooms
- Leylines / substance / mana-spring removal
- Mine elevators / staging camps / visible dungeon map
- Research tech gating exotic veins (fracking, titanium)
- Per-vein manual labor assignment
- Dry holes / prospector death
- Exact long-term balance curves (provisional knobs OK)

---

## Docs (same PR — required)

| File | Update |
|------|--------|
| [`docs/MINES.md`](../../docs/MINES.md) | Status → prospecting **shipped**; expand Shipped table; mark Clear UX prospect line done; note provisional numbers |
| [`docs/HOUSING.md`](../../docs/HOUSING.md) | Laborers: prospect allocation removes bodies from auto pool; link MINES |
| [`docs/ECONOMY_COST_MATRIX.md`](../../docs/ECONOMY_COST_MATRIX.md) | Income: metal/gem→gold from veins; prospect equip sink |
| [`README.md`](../../README.md) | Attack-loop / Deferred: prospecting shipped vs storage still open |
| [`mine_harvest_index.plan.md`](./mine_harvest_index.plan.md) | Slices 2+3 → shipped via this plan |
| [`resource_economy_index.plan.md`](./resource_economy_index.plan.md) | Gold income amendment live when gems ship |

---

## Code anchors

| Concern | Where |
|---------|--------|
| Mine gen / patch ids | [`src/model/mines/`](../../src/model/mines/) |
| Assign / harvest tick | [`src/model/staff/harvest.ts`](../../src/model/staff/harvest.ts) |
| Stay-put | [`src/model/staff/combat.ts`](../../src/model/staff/combat.ts) |
| Deploy laborers | [`src/model/staff/deploy.ts`](../../src/model/staff/deploy.ts) |
| Wave clear | [`src/model/phases.ts`](../../src/model/phases.ts), [`src/view/dom/modal.ts`](../../src/view/dom/modal.ts) |
| Allocation UI pattern | [`src/store/handlers/staff.ts`](../../src/store/handlers/staff.ts), [`src/view/dom/hud.ts`](../../src/view/dom/hud.ts) |
| Baseline / undo | [`src/model/phases.ts`](../../src/model/phases.ts) `captureBuildBaseline`, [`src/store/handlers/build.ts`](../../src/store/handlers/build.ts) |
| Knobs | [`src/config/mines.ts`](../../src/config/mines.ts) |

---

## Provisional knobs (tune in playtest)

| Knob | Starter intent |
|------|----------------|
| Equip cost | Small stone + metal when prospecting |
| Party size | 1…min(6, recruited); at least 1 needed to reveal |
| Work time | Short enough to finish mid-wave if path is short; longer as depth grows |
| Quality weights | Skew poor early; richer later optional |
| Rare falloff | First laborer 100%; each next ×0.5 on metal/gold patches |
| Passive iron | ≤5% of stone harvest tick as metal |

---

## Implementation order (within this PR)

1. Types + baseline/undo wiring  
2. Vein append + harvest falloff (+ passive iron)  
3. Prospect allocation UI + deploy reserve  
4. Prospect job + reveal  
5. Clear modal/log  
6. Docs + tests  
7. `npm run lint && npm test` (+ playability if touching start-wave economy)

**Do not implement from the index alone — use this file.**
