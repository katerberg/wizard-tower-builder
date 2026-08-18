# Shell fortifications

Design for exterior **shell fortifications** — framing-cell attachments that reshape crawler routing (and, later, contact hazards). Players place them intentionally to funnel or tax enemy climbs without consuming the room layer. **Fortifications never hard-block crawler walkability.**

**Status:** Implemented (lean 6 routing fortifications). Spikes remain a room modification until the migration plan. Numbers remain flexible for playtest.

The old deferred README line “Movement-controlling structures (e.g. moats, parapets, cornices)” maps here. **Murderholes / crenels** (populated shell rooms) stay on a separate track.

---

## Goals

1. **Clear niches** — each fortification owns one routing job (soft path cost, time tax, or forced chokepoint).
2. **Stack with rooms** — fortifications attach to framing cells; a Slot (or any room) may still occupy the same cell.
3. **Shell-only** — fortifications are **not** flier solids. Fliers keep bypassing shell defenses (same intent as today’s spikes).
4. **No interior ghosts** — attachments are valid only on **exterior** framing cells; enclosure auto-strips them.
5. **Funnel, don’t seal** — soft A\* costs and move slows only; **never** remove walkability. Combined fort slow is capped at **80%** (`FORT_SLOW_CAP_MULT = 5`).

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
| Separate HP | **None** — removed when framing is destroyed, the cell loses exterior exposure, or face rules fail |
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
- Empty cells **auto-place a Spire Block** when that stem would be legal and the fortification would then pass face rules (same pattern as rooms / infra). Cost includes the stem via the planning wallet.
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

### Strip-on-invalid

After any build edit that changes `structureOccupancy` (place/remove/replace framing, cascades):

1. Clear shell keys on cells that no longer have framing.
2. For each remaining `tower.shell` entry, re-run place-time `canPlaceFortification` (framing + exterior + face family). If it would fail, **remove** it.
3. **Refund** the full spend for stripped fortifications into the planning wallet (same friendliness as sell/undo). Documented default until playtest says otherwise.

Examples: stacking framing above a parapet strips the parapet (`wrong_face`); filling under a cornice strips the cornice; sealing both wall faces strips a barbican; fully enclosing a cell strips any shell there (`not_exterior`).

This prevents stale shell on non-exterior cells and face-invalid leftovers after the tower grows.

---

## Pathfinding foundation

Enemy exterior A\* uses weighted step cost (`src/calculations/pathfinding.ts`). Fortifications use two soft hooks only — **no `isWalkable` denies**:

| Mechanism | Hook | Used by |
|-----------|------|---------|
| Soft funnel | `stepCost(tower, node, profile) ≥ 1` folded into A\* `tentative` | Moat, Glacis, Parapet, Cornice, Stakes, Barbican |
| Time tax | `fortificationSlowMultiplier` → move cooldown (same family as soak / blizzard) | Moat, Parapet, Cornice, Stakes |

Rules:

- Default `stepCost` is `1` when no fortification applies; overlapping auras use the **max** cost.
- Fort slow uses the **max** applicable cooldown multiplier on the cell, then clamps to `FORT_SLOW_CAP_MULT` (**5** → 80% max fort slow). Spell slows (soak / blizzard) multiply outside that cap.
- **Fliers ignore** crawler shell costs and fort slows unless a future plan says otherwise.
- Staff interior graph is untouched.
- When framing/rooms seal the exterior so climbers have **no path** to the wizard, they smash closest room then framing (same combat as demolishers). Fortifications themselves have no smash HP.

Suggested constants (flexible until playtest; in `src/config/fortifications.ts`):

| Constant | Suggested | Owner |
|----------|-----------|-------|
| `FORT_SLOW_CAP_MULT` | `5` (80% cap) | All forts |
| `MOAT_STEP_COST` / `MOAT_SLOW_MULT` | `8` / `3` | Ground pair |
| `GLACIS_STEP_COST` | `4` | Ground pair |
| `PARAPET_STEP_COST` / `PARAPET_SLOW_MULT` | `6` / `3` | Shell pair |
| `CORNICE_STEP_COST` / `CORNICE_SLOW_MULT` | `6` / `3` | Shell pair |
| `STAKES_STEP_COST` / `STAKES_SLOW_MULT` | `2` / `1.5` | Funnel pair |
| `BARBICAN_BAND_STEP_COST` | `8` | Funnel pair |
| Barbican face cost | `1` (default) | Funnel pair |

---

## Differentiation matrix

| Id | Niche | Placement | Crawler effect | Explicitly not |
|----|-------|-----------|----------------|----------------|
| **Moat** | Strong ground tax | Ground-row exterior framing; aura → adjacent empty ground | Aura ground: high `stepCost` + strong slow | Hard seal; Glacis-only cost |
| **Glacis** | Soft ground funnel | Same family as Moat | Aura ground: high `stepCost` only | Slow; hard seal |
| **Parapet** | Top-face tax | Exterior cell with exposed top/crown face | `onTop` against host: cost + slow | Hard seal; underhang (Cornice) |
| **Cornice** | Underhang tax | Exterior cell that can provide `underCeiling` | `underCeiling` against host: cost + slow | Hard seal; top-face (Parapet) |
| **Stakes** | Time + mild routing tax | Ground-edge exterior framing; approach aura | Mild step cost **and** move slow on aura ground | Hard seal; cost-only (Glacis) |
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
| Effect | Aura ground stays walkable; `stepCost` = `MOAT_STEP_COST` and slow = `MOAT_SLOW_MULT` (under fort slow cap) |
| Demolishers / climbers | No smash target; taxed like other crawlers |
| Notes | Steers climbers onto walls via cost/slow, never seals the approach. Optional light soak on aura contact is **out of v1** (Hydrant owns soak). |

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

**Mutual exclusion:** Moat and Glacis are different kinds; one cell still hosts only one kind. Adjacent ground cells may receive auras from multiple hosts — use the **max** soft cost and the **max** fort slow (then cap) among overlapping auras.

### Parapet

| Field | Spec |
|-------|------|
| Id | `parapet` |
| Glyph / color | `=` / battlement gray (placeholder) |
| Place on | Exterior framing with an exposed **top** face (`!hasStructure(col, row + 1)`), including crowns and mid-tower ledges |
| Effect | Empty cells with `onTop` against this host: `PARAPET_STEP_COST` + `PARAPET_SLOW_MULT` (still walkable) |
| Demolishers / climbers | Taxed on the crown path; parapet itself has no HP |
| Notes | Taxes roof-running across that cell’s top; does not affect wall-face climbs on the sides of the same cell. |

### Cornice

| Field | Spec |
|-------|------|
| Id | `cornice` |
| Glyph / color | `¬` / projecting ledge tone (placeholder) |
| Place on | Exterior framing that can provide `underCeiling` to the cell below (`!hasStructure` is not required below — the empty cell under an overhang is the walk candidate) |
| Effect | Empty cells with `underCeiling` against this host: `CORNICE_STEP_COST` + `CORNICE_SLOW_MULT` (still walkable for `under_overhang`) |
| Demolishers | Prefer-path may still go under; real `attack_overhang` profile cannot enter underCeiling — they **smash framing** (existing overhang smash) as before |
| Notes | Taxes underhang shortcuts. Does not affect `onTop` (Parapet’s job). |

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

## Climber smash & destruction summary

Fortifications never seal topology. When **rooms/framing** leave climbers with no exterior path to the solar collector, **all ground climbers** (not only demolishers) approach the closest smashable cell and melee **room then framing** (same damage/cascade path as demolisher overhang smash). Demolishers still smash overhang ceilings on their preferred path when the next underCeiling step is unwalkable for their real profile.

| Fortification | Smash target? | Devastation note |
|---------------|---------------|------------------|
| Moat / Glacis / Stakes / Parapet / Barbican / Cornice | No separate HP | Cleared if host framing is destroyed, cell loses exterior exposure, or face rules fail |
| Spikes (after migration) | No separate HP | Retaliation hooks fire from smash combat; details in spikes plan |

---

## UI / library (implementation notes)

- New build-library section **Fortifications**.
- Place via BUILD tool on eligible exterior framing cells (not via room-inspector Add Mod). Empty legal cells auto-stem like rooms/infra; ghost preview shows the framing.
- Library hover matches rooms: flavor `description`, plus **Place** (face/row rules), **Effect** (routing), and **Cost**.
- Inspector on a fortified framing cell shows kind + remove/sell.
- Canvas: distinct glyph on the shell face (not room-mod bottom badges).
- Invalid targets (interior framing, wrong face family, disconnected auto-stem) reject with a clear reason string (same pattern as “Cannot build: disconnected”).

---

## Explicit non-goals

- Murderholes / crenels / populated shell rooms
- Shell upgrade / leveling mods
- Off-tower moat cells (placeable empty ground without framing host)
- Making fortifications flier-solid
- Hard-blocking crawler walkability via shell (costs/slows only; ≤80% fort slow)
- Changing staff interior pathing or `passable` semantics
- Portcullis, hoarding, or other roster entries beyond the lean 6 (+ later spikes)
- Mid-wave placement of fortifications (build phase only, like other construction)

---

## Implementation roadmap

| Order | Plan (create when that shot starts) | Scope |
|-------|-------------------------------------|-------|
| 1 | Design doc (this file) + index | Docs only — **done when this ships** |
| 2 | `fortifications_engine.plan.md` | `tower.shell` map, exterior predicate, strip-on-invalid + refund, weighted A\* `stepCost`, tests — **no blueprints** |
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
