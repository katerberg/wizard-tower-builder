# Shell fortifications

Design for exterior **shell fortifications** — framing-cell attachments that reshape crawler routing (and, later, contact hazards). Players place them intentionally to funnel, deny, or tax enemy climbs without consuming the room layer.

**Status:** Implemented (lean 6 routing fortifications). Spikes remain a room modification until the migration plan. Numbers remain flexible for playtest.

The old deferred README line “Movement-controlling structures (e.g. moats, parapets, cornices)” maps here. **Murderholes / crenels** (populated shell rooms) stay on a separate track.

---

## Goals

1. **Clear niches** — each fortification owns one routing job (hard deny, soft cost, time tax, or forced chokepoint).
2. **Stack with rooms** — fortifications attach to framing cells; a Slot (or any room) may still occupy the same cell.
3. **Shell-only** — fortifications are **not** flier solids. Fliers keep bypassing shell defenses (same intent as today’s spikes).
4. **No interior ghosts** — attachments are valid only on **exterior** framing cells; enclosure auto-strips them.
5. **Funnel, don’t only block** — soft A\* costs exist alongside hard denies so players can prefer routes into kill zones.

---

## Locked decisions

| Decision | Choice |
|----------|--------|
| v1 roster | Moat, Glacis, Parapet, Cornice, Stakes, Barbican |
| Ground placement | **Edge aura** from ground-row shell framing into adjacent empty ground (no off-tower builds) |
| Air solidity | Shell-only — never add room-solidity for fliers |
| Attachment | Per **framing cell** (structure-facing), not room mods |
| Stacking kinds | **One** fortification kind per cell |
| Leveling | **Single level** for now (no upgrade path) |
| Separate HP | **None** — removed when framing is destroyed or the cell loses exterior exposure |
| Spikes | Migrate later onto this system; drop Lv2/3; keep step + smash retaliation + flier miss |
| Staff pathing | Unchanged — shell attachments do not set `passable: false` |

---

## Layer relationship

Existing layers stay as documented in [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md). Shell fortifications are an additional **per-cell map on framing**, not a fourth edit layer that replaces rooms/infra:

```
structure occupancy  → required host cell
shell[col,row]       → FortificationKind | absent   // at most ONE kind
room occupancy       → optional; may coexist
infra                → unchanged
```

Library UI section label: **Fortifications** (exact `LibrarySectionId` lands with the first blueprint PR).

---

## Data model (design-level)

Exact TypeScript lands in the engine plan. Shape for implementers:

```ts
type FortificationId =
  | 'moat'
  | 'glacis'
  | 'parapet'
  | 'cornice'
  | 'stakes'
  | 'barbican';
  // | 'spikes'  // Plan 6 migration

/** Per framing cell — not per multi-cell Structure entity. */
// tower.shell: Record<cellKey, { kind: FortificationId }>
```

Rules:

- Placement requires `hasStructure(col, row)` and **exterior exposure** (below).
- A 2×1 / 3×1 buttress may host **different** fortifications on different cells of its footprint.
- Selling / removing framing clears shell entries on those cells with the structure.
- Build-phase undo / revert must cover shell place/remove and enclosure strips (same planning-wallet rules as other build edits).

### Exterior exposure predicate

A framing cell `(col, row)` is **exterior** if at least one orthogonal neighbor lacks framing:

```
hasStructure(col, row)
AND (
  !hasStructure(col - 1, row) OR
  !hasStructure(col + 1, row) OR
  !hasStructure(col, row - 1) OR   // below (toward ground); row 0 has no below
  !hasStructure(col, row + 1)      // above
)
```

Out-of-bounds / missing cells count as “lacks framing.” Ground row (`row === 0`) is exterior when any side or above neighbor is empty of framing (typical tower base edge).

This matches “exposes a crawler surface face”: an empty orthogonal neighbor is where `surfaceContacts` against this solid can include `leftWall` / `rightWall` / `onTop` / `underCeiling`.

**Engine plan must** implement `isExteriorFramingCell(tower, col, row)` and unit-test enclosed cores vs shell edges (including buttress undersides).

### Strip-on-enclose

After any build edit that changes `structureOccupancy` (place/remove/replace framing, cascades):

1. Recompute the exterior set.
2. For each `tower.shell` entry whose cell is no longer exterior (or no longer has structure), **remove** it.
3. **Refund** the full spend for stripped fortifications into the planning wallet (same friendliness as sell/undo). Documented default until playtest says otherwise.

This prevents “crenels on a non-shell cell” once towers thicken or wrap former edges.

---

## Pathfinding foundation

Enemy exterior A\* today uses uniform step cost `+1` (`src/calculations/pathfinding.ts`). Fortifications require three hooks:

| Mechanism | Hook | Used by |
|-----------|------|---------|
| Hard deny | `isWalkable` / neighbor filter in `exteriorGraph.ts` | Moat, Parapet, Cornice |
| Soft funnel | `stepCost(tower, node, profile) ≥ 1` folded into A\* `tentative` | Glacis, Stakes, Barbican |
| Time tax | Move cooldown multiplier (same family as soak / blizzard) | Stakes |

Rules:

- Default `stepCost` is `1` when no soft fortification applies.
- Hard deny wins over cost (unwalkable cells are not neighbors).
- **Fliers ignore** crawler shell denies, costs, and stakes slow unless a future plan says otherwise.
- Staff interior graph is untouched.

Suggested constants (flexible until playtest; land in `src/config/` with the owning PR):

| Constant | Suggested | Owner |
|----------|-----------|-------|
| `GLACIS_STEP_COST` | `4` | Ground pair |
| `STAKES_STEP_COST` | `2` | Funnel pair |
| `STAKES_SLOW_MULT` | `1.5` | Funnel pair |
| `BARBICAN_BAND_STEP_COST` | `8` | Funnel pair |
| Barbican face cost | `1` (default) | Funnel pair |

---

## Differentiation matrix

| Id | Niche | Placement | Crawler effect | Explicitly not |
|----|-------|-----------|----------------|----------------|
| **Moat** | Hard ground denial | Ground-row exterior framing; aura → adjacent empty ground | Aura ground cells **unwalkable** | Soft prefer (Glacis); slow (Stakes) |
| **Glacis** | Soft ground funnel | Same family as Moat | Aura ground walkable but **high step cost** | Hard block; slow |
| **Parapet** | Top-face barrier | Exterior cell with exposed top/crown face | Walk cells that depend on `onTop` against this framing: **blocked** | Underhang control (Cornice) |
| **Cornice** | Anti-underhang | Exterior cell that can provide `underCeiling` | `underCeiling` against this cell **unwalkable even if** `canPassUnderOverhang` | Top-face block; not a smash target itself |
| **Stakes** | Time + mild routing tax | Ground-edge exterior framing; approach aura | Mild step cost **and** move slow on aura ground | Hard block (Moat); cost-only (Glacis) |
| **Barbican** | Forced chokepoint | Exterior wall-face framing | Neighboring shell steps in a local band get **very high cost**; barbican cell’s exposed face stays cost **1** | Damage (slots/spikes/turrets kill) |

---

## Per-structure specs

Costs and glyphs below are **placeholders** for implementation PRs. Prefer **stone** for masonry shell pieces; stakes may use stone or metal. No separate fortification HP.

### Moat

| Field | Spec |
|-------|------|
| Id | `moat` |
| Glyph / color | `~` / deep blue-gray (placeholder) |
| Place on | Exterior framing with `row === 0` |
| Aura | Orthogonally adjacent macro cells that have **no framing**, treated at ground approach (sub-row 0 / ground-contact walk cells derived from those macros) |
| Effect | Those aura ground walk cells are **not walkable** for non-flying profiles |
| Demolishers | No new smash target; they path around like other crawlers |
| Notes | Forces side climbs onto the tower mass. Optional light soak on aura contact is **out of v1** (Hydrant owns soak). |

### Glacis

| Field | Spec |
|-------|------|
| Id | `glacis` |
| Glyph / color | `/` / pale stone slope (placeholder) |
| Place on | Same as Moat (ground-row exterior framing) |
| Aura | Same adjacency family as Moat |
| Effect | Aura ground walk cells remain walkable; `stepCost` = `GLACIS_STEP_COST` (suggested **4**) |
| Demolishers | Soft prefer alternate climbs when a cheaper shell path exists |
| Notes | Soft counterpart to Moat — funnel without sealing the approach. |

**Mutual exclusion:** Moat and Glacis are different kinds; one cell still hosts only one kind. Adjacent ground cells may receive auras from multiple hosts — **hard deny wins** if any Moat aura applies; otherwise use the **max** soft cost among overlapping Glacis/Stakes auras.

### Parapet

| Field | Spec |
|-------|------|
| Id | `parapet` |
| Glyph / color | `=` / battlement gray (placeholder) |
| Place on | Exterior framing with an exposed **top** face (`!hasStructure(col, row + 1)`), including crowns and mid-tower ledges |
| Effect | Empty cells whose crawler walkability depends on `onTop` contact against this framing cell are **unwalkable** |
| Demolishers | Detour sideways or smash other blockers per existing rules; parapet itself has no HP |
| Notes | Stops roof-running across that cell’s top; does not deny wall-face climbs on the sides of the same cell. |

### Cornice

| Field | Spec |
|-------|------|
| Id | `cornice` |
| Glyph / color | `¬` / projecting ledge tone (placeholder) |
| Place on | Exterior framing that can provide `underCeiling` to the cell below (`!hasStructure` is not required below — the empty cell under an overhang is the walk candidate) |
| Effect | For empty cells with `underCeiling` contact against this framing, treat as **unwalkable** even when `profile.canPassUnderOverhang === true` |
| Demolishers | Prefer-path underhang is denied; they must **go around** or **smash framing** (existing overhang smash) to open a route |
| Notes | Anti-shortcut for `under_overhang` crawlers. Does not block `onTop` (Parapet’s job). |

### Stakes

| Field | Spec |
|-------|------|
| Id | `stakes` |
| Glyph / color | `^` reserved after spikes migration — until then use `*` or `x` (placeholder; avoid colliding with live spike badges) |
| Place on | Ground-row exterior framing (approach family with Moat/Glacis) |
| Aura | Same empty-ground adjacency as Moat/Glacis |
| Effect | Aura ground: `stepCost` = `STAKES_STEP_COST` (suggested **2**) **and** move slow multiplier `STAKES_SLOW_MULT` (suggested **1.5**) while stepping/occupying those cells |
| Demolishers | Slowed/taxed like other crawlers; no smash target |
| Notes | Time tax niche — enemies may still take the path if it is the only/cheapest geometric route. |

### Barbican

| Field | Spec |
|-------|------|
| Id | `barbican` |
| Glyph / color | `H` conflicts with Boiler — use `#` or `G` (gate) placeholder |
| Place on | Exterior framing with at least one exposed **horizontal** wall face (left or right neighbor empty) |
| Band | Same macro column ±0, and the exterior walk nodes on the exposed face(s) of the barbican cell, plus orthogonally adjacent shell walk nodes within **1 macro cell** vertically along that face (exact band helper in funnel plan) |
| Effect | Walk steps in the band that are **not** on the barbican cell’s own exposed face use `BARBICAN_BAND_STEP_COST` (suggested **8**). Steps along the barbican’s exposed face keep cost **1**. |
| Demolishers | Soft-funneled into the gate face; no new smash entity |
| Notes | Creates a preferred climb lane for Slot/spike/turret coverage. **Does not deal damage.** |

---

## Spikes (transitional → Plan 6)

**Today (shipped):** room modification `spikes` on any room; Lv1–3; `onEnemyStep` + `onEnemyAttackRoom`; misses fliers.

**Target end state:**

| Field | Spec |
|-------|------|
| Id | `spikes` |
| Kind | Shell fortification on exterior framing |
| Level | Single level only (remove Lv2/3 costs and upgrade UI) |
| Effect | Contact damage on crawler step touching the fortified cell’s shell (preserve current per-step adjacency intent as closely as possible); retaliate when a demolisher smashes a **room on that cell** or the framing as defined in the migration plan |
| Fliers | Still miss |
| Stacking | Coexists with rooms on the same cell |

Until Plan 6 merges, room-mod spikes remain as-is. Do not half-migrate.

---

## Demolisher & destruction summary

| Fortification | Smash target? | Devastation note |
|---------------|---------------|------------------|
| Moat / Glacis / Stakes / Parapet / Barbican | No separate HP | Cleared if host framing is destroyed or cell loses exterior exposure |
| Cornice | No separate HP | Denies underhang planning; smash **framing** (existing) to reopen under-routes |
| Spikes (after migration) | No separate HP | Retaliation hooks fire from smash combat; details in spikes plan |

---

## UI / library (implementation notes)

- New build-library section **Fortifications**.
- Place via BUILD tool on eligible exterior framing cells (not via room-inspector Add Mod).
- Inspector on a fortified framing cell shows kind + remove/sell.
- Canvas: distinct glyph on the shell face (not room-mod bottom badges).
- Invalid targets (interior framing, wrong face family) reject with a clear reason string (same pattern as “Cannot build: disconnected”).

---

## Explicit non-goals

- Murderholes / crenels / populated shell rooms
- Shell upgrade / leveling mods
- Off-tower moat cells (placeable empty ground without framing host)
- Making fortifications flier-solid
- Changing staff interior pathing or `passable` semantics
- Portcullis, hoarding, or other roster entries beyond the lean 6 (+ later spikes)
- Mid-wave placement of fortifications (build phase only, like other construction)

---

## Implementation roadmap

| Order | Plan (create when that shot starts) | Scope |
|-------|-------------------------------------|-------|
| 1 | Design doc (this file) + index | Docs only — **done when this ships** |
| 2 | `fortifications_engine.plan.md` | `tower.shell` map, exterior predicate, strip-on-enclose + refund, weighted A\* `stepCost`, tests — **no blueprints** |
| 3 | `fortifications_ground.plan.md` | Moat + Glacis |
| 4 | `fortifications_shell.plan.md` | Parapet + Cornice |
| 5 | `fortifications_funnel.plan.md` | Stakes + Barbican |
| 6 | `fortifications_spikes.plan.md` | Migrate spikes → shell; remove room-mod upgrades |

Orient-only index: [`.cursor/plans/fortifications_index.plan.md`](../.cursor/plans/fortifications_index.plan.md).

**Rule for agents:** implement from **one** shot plan at a time; do not pull later roster items into an earlier PR.

---

## Related docs

- [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) — layers, dual pathfinding (staff interior vs enemy exterior)
- [`FLYING.md`](FLYING.md) — fliers bypass shell defenses
- [`HOUSING.md`](HOUSING.md) — room-layer stacking context
- Enemy exterior graph: `src/calculations/exteriorGraph.ts`, `src/calculations/pathfinding.ts`
- Current spikes (transitional): `src/model/modifications/spikes.ts`
