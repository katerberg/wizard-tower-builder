# Day / night cycle & laborer construction

**Status:** Shipped (v1).

The run alternates **60s day** / **90s night** phases with automatic transitions. During the day you **paint construction plans**; laborers haul stone and metal from **storage rooms** and build on-site. At dusk the wave spawns at **completed framing height** (scaffold and ghosts do not count). During the night you fight and **harvest into storage**, not the wallet.

---

## Phases

| Phase     | Duration        | Player                                                                 | Simulation                                                                     |
| --------- | --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Day**   | 60s (real time) | Paint/cancel construction, recruit, allocate, infra, forts, mods, sell | Laborers haul, build, teardown, repair; side jobs tick; prospect work advances |
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

- **Starter Supply Room** (col 5, ground): locked, non-removable; seeds **24 stone + 32 metal** (capacity 56).
- **Starter Quarters** (col 9, ground): locked housing for laborers.
- Player-built **`storageRoom`**: flat **40** stone+metal unit cap per room.

Painting a blueprint **reserves** stone/metal from nearest storage with stock; souls/gold deduct from the wallet at paint time.

---

## Construction pipeline

1. **Paint** — creates a `ConstructionOrder` (ghost overlay on canvas).
2. **Haul** — laborers path storage → site in trips of up to **5** mixed units (`LABORER_CARRY_CAPACITY`).
3. **Scaffold** — appears at full HP when all materials are on-site.
4. **Build** — progress at `BUILD_PROGRESS_PER_SEC` × laborer efficiency (falloff 0.5 per extra worker, same as mining).
5. **Complete** — real blueprint placed; room behaviors activate.

**Partial at dusk:** incomplete sites freeze as **scaffold only** (enemies treat like spire blocks). Orders persist across days until done or cancelled.

**Teardown (day only):** laborers remove rooms; **50%** physical refund to nearest storage.

**Cosmoteer-style updates:** change or cancel painted blueprints anytime; laborers retarget; undo returns materials via haul-backs.

Implementation: [`src/model/construction/`](../src/model/construction/), [`src/store/handlers/build.ts`](../src/store/handlers/build.ts).

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
- **Instant placement** — all structure/room paints go through the construction queue (infra/fort v1 may still spend storage instantly; full labor queue deferred).

---

## Related docs

- [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) — layers, logistics, connectivity
- [`HOUSING.md`](HOUSING.md) — staff roles and allocations
- [`MINES.md`](MINES.md) — harvest timing and anti-hoard (carry time)
- [`HEIGHT_PROGRESSION.md`](HEIGHT_PROGRESSION.md) — wave height from completed framing
