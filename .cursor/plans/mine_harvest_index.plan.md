---
name: Mine harvest — Index
overview: 'Roadmap for attack-time mine grid harvest (stone/metal/gem→gold), prospect allocation, storage anti-hoard. Design locked in docs/MINES.md. Leylines are a separate stubbed follow-on. Do not implement from this file alone.'
todos: []
isProject: false
---

# Mine harvest — Plan Index

**Design source of truth:** [`docs/MINES.md`](../../docs/MINES.md)

**Cost baseline:** [`docs/ECONOMY_COST_MATRIX.md`](../../docs/ECONOMY_COST_MATRIX.md)

**Follow-on (not this track):** [`leyline_harvest_stub.plan.md`](./leyline_harvest_stub.plan.md)

---

## Which file to use when

| Goal | Read this | Do NOT implement from |
| ---- | --------- | --------------------- |
| Understand full mine fantasy | [`docs/MINES.md`](../../docs/MINES.md) | This index alone |
| See current wallet sinks | [`docs/ECONOMY_COST_MATRIX.md`](../../docs/ECONOMY_COST_MATRIX.md) | — |
| Implement mine grid + shallow stone | `mine_harvest_engine.plan.md` (create at slice start) | Prospect / storage / leyline |
| Implement finite veins + iron/gems | `mine_harvest_veins.plan.md` | Engine if not merged |
| Implement prospect allocation + clear tally | `mine_harvest_prospect.plan.md` | Leylines |
| Implement storage rooms | `mine_harvest_storage.plan.md` | Tech trees / elevators |
| Leyline / substance / remove springs | Leyline stub → its own index later | This mine track |

**Workflow:** land design (done) → one detailed slice plan → one branch/PR → merge → next.

---

## Locked (summary)

- Attack-time harvest on a **real, invisible, deterministic** underground grid attached to the tower
- **One** mine; depth tiers; finite SC-style patches
- Stone easy/shallow; iron=metal; gems→gold; rare falloff; stone uncapped labor
- Prospect = laborers **allocated out of** the wave pool → always find next tier (quality varies)
- Player allocations first; leftovers auto repair → pump → mines; mine workers **stay put**
- No mine elevators / staging / research tech in this track
- Replace abstract `harvest:underground`
- Wave-clear haul message

Full table: [`docs/MINES.md`](../../docs/MINES.md).

---

## Slice order

| # | Slice | Suggested plan file | Notes |
|---|-------|---------------------|-------|
| 0 | Design + cost matrix + this index + leyline stub | (this PR) | Concept locked |
| 1 | Mine grid engine + entrance + shallow stone; remove abstract harvest | `mine_harvest_engine.plan.md` | Needs pathing into underground cells |
| 2 | Finite veins + iron/gem yields + rare falloff | `mine_harvest_veins.plan.md` | Amends gold income |
| 3 | Prospect allocation + tier reveal + clear tally UX | `mine_harvest_prospect.plan.md` | Build-phase allocate out of pool |
| 4 | Storage rooms | `mine_harvest_storage.plan.md` | Anti-hoard mass |
| 5 | Balance / docs status → shipped | `mine_harvest_balance.plan.md` | Update MINES status line |

---

## Economy index interaction

Update [`resource_economy_index.plan.md`](./resource_economy_index.plan.md) when slices ship:

- Abstract 25/75 harvest → site yields
- Gold income += gem bonus
- Point readers at `docs/MINES.md`

---

## Docs delivered with design

| File | Role |
|------|------|
| [`docs/MINES.md`](../../docs/MINES.md) | Locked design |
| [`docs/ECONOMY_COST_MATRIX.md`](../../docs/ECONOMY_COST_MATRIX.md) | Sink matrix for later iron/substance spends |
| README “Where do I…?” | Link to mines design |
| This index + leyline stub | Slice roadmap / handoff |
