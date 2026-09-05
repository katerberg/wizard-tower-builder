# Day / night cycle & laborer construction

**Status:** Shipped (v1).

The run alternates **60s day** / **90s night** phases with automatic transitions. During the day you **paint construction plans**; laborers haul stone and metal from **storage rooms** and build on-site. At dusk the wave spawns at **completed framing height** (scaffold and ghosts do not count). During the night you fight and **harvest into storage**, not the wallet.

---

## Phases

| Phase     | Duration        | Player                                                                 | Simulation                                                                     |
| --------- | --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Day**   | 60s (real time) | Paint/cancel construction (framing, rooms, infra, forts), recruit, allocate, mods, sell | Laborers haul, build, teardown, repair; side jobs tick; prospect work advances |
| **Night** | 90s             | Wizard path + spells only                                              | Combat, harvest → storage, night labor (repair → hand-pump → mine)             |

- **Pause / 1× / 2× / 5×** sim speed apply in **both** phases (sidebar).
- **Start Wave** removed — night begins automatically at timer zero. Dev mode retains **Skip to night**.
- **Win / lose** unchanged: collector HP → 0 loses; clear at framing height ≥ 100 wins.

Config: [`src/config/dayNight.ts`](../src/config/dayNight.ts).

---

## Wallet vs storage

| Resource     | Location                    |
| ------------ | --------------------------- |
| Gold, souls  | `player.resources` wallet   |
| Stone, metal | **Storage stockpiles** only |

- **Starter Storage Room** (col 5, ground): locked, non-removable; seeds **24 stone + 32 metal** (capacity 56).
- **Starter Quarters** (col 9, ground): locked housing for laborers.
- Player-built **`storageRoom`**: flat **40** stone+metal unit cap per room.

Painting a blueprint **reserves** stone/metal from nearest storage with stock; souls/gold deduct from the wallet at paint time.

---

## Construction pipeline

Every paint — framing, rooms, infra, **and** fortifications — creates a `ConstructionOrder`. Nothing is placed instantly.

1. **Paint** — creates a `ConstructionOrder` (ghost overlay on canvas).
2. **Haul** — laborers path storage → site in trips of up to **5** mixed units (`LABORER_CARRY_CAPACITY`).
3. **Scaffold** — appears at full HP when all materials are on-site.
4. **Build** — progress at `BUILD_PROGRESS_PER_SEC` × laborer efficiency (falloff 0.5 per extra worker, same as mining).
5. **Complete** — real blueprint placed; room behaviors activate.

**Partial at dusk:** incomplete sites freeze as **scaffold only** (enemies treat like spire blocks); plans whose support is not built yet stay plans. Orders persist across days until done or cancelled.

**Teardown (day only):** laborers remove rooms; **50%** physical refund to nearest storage.

**Cosmoteer-style updates:** change or cancel painted blueprints anytime; laborers retarget; undo returns materials via haul-backs. Painting over an existing plan **replaces** it.

Implementation: [`src/model/construction/`](../src/model/construction/), [`src/store/handlers/build.ts`](../src/store/handlers/build.ts).

---

## Speculative plans

Paint legality is judged on the **plan**, not the live tower: `towerWithPendingOrders` clones the live tower and applies every pending build order **bottom-up by row** as a finished piece ([`src/model/construction/pendingTower.ts`](../src/model/construction/pendingTower.ts)). Sketch a spire column and drop a Turret Room on its crown in the same day, before a single block exists.

| Rule                    | Behavior                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Paint validation**    | Legal on the plan (live + pending, bottom-up). A piece that floats on the plan too is still rejected            |
| **Ghost / tooltip**     | Live-illegal but plan-legal cells look **valid**; tooltip adds `OK (needs planned support)`                     |
| **Drag stroke**         | Plan-legal cells queue, truly illegal cells are skipped with a message, and the stroke continues                |
| **Labor**               | Laborers only haul/scaffold/build orders that are legal on the **live** tower, **bottom rows first**            |
| **Completion**          | An order never completes unless it is placeable on the live tower at that moment                                |
| **Orphans**             | Cancel or teardown that removes a plan's support marks dependents `invalid`: no labor, resources stay reserved until the player cancels them (repainting the support revives them) |
| **Research**            | Plans use the same unlocks as live builds — no speculative use of locked tech (e.g. Cantilever Framing)         |
| **Stairs**              | Still auto-only; the plan and every completion run `reconcileAutoStairs`                                        |
| **Leyline bands**       | Pending Leyline Research plans hold their band, so a second plan on the same band is rejected                    |
| **Economy**             | Unchanged: souls/gold at paint, stone/metal reserved at paint                                                   |
| **Height / win**        | Unchanged: **completed** framing only ([`HEIGHT_PROGRESSION.md`](HEIGHT_PROGRESSION.md))                        |

---

## Side jobs

Recruit/unrecruit, mod apply, and similar actions enqueue timed **side jobs** (default **4s** recruit, **6s** mod at 1×). Countdown bubbles appear in the **right rail** during day; brief success flash on completion.

---

## Prospecting (day/night split)

- **Day:** allocated prospectors advance `prospectWorkElapsed`; excluded from construction/repair pool.
- **Nightfall:** if timer complete, tier reveal resolves; prospectors excluded from harvest/repair at night.
- Equip cost charged when night begins (same as prior wave-start prospect rules).

See [`MINES.md`](MINES.md).

---

## Night harvest

Mine haul credits **storage rooms** (nearest with space). Overflow is **wasted** with a log warning. Hand-pump labor is **night-only**.

---

## Retired systems

- **`buildBaseline`** — removed; affordability uses storage reservations + wallet.
- **Instant placement** — gone from every layer: framing, rooms, infra, and fortifications all go through the construction queue. Clicking the same infra/fortification kind on a **finished** cell still removes it immediately (that is a remove, not a plan).

---

## Related docs

- [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) — layers, logistics, connectivity
- [`HOUSING.md`](HOUSING.md) — staff roles and allocations
- [`MINES.md`](MINES.md) — harvest timing and anti-hoard (carry time)
- [`HEIGHT_PROGRESSION.md`](HEIGHT_PROGRESSION.md) — wave height from completed framing
