# Pipes, boilers, steam & fire

Developer spec for the **fluid logistics** slice: ground water, boilers, mana springs, steam turrets, forges, flame turrets, and typed pipe networks. Complements [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) (layers, workers, stairs) and [`HOUSING.md`](HOUSING.md) (magi staffing springs).

**Status:** Shipped (P0–P7 + fire network). Fluids lock at wave start and **re-lock mid-wave** when rooms/framing are destroyed (demolishers, fliers, Earthquake cascade).

---

## Overview

```mermaid
flowchart TB
  subgraph water [Water network]
    G[Row 0 pipe cells]
    WP[Water pipes - blue preview]
    BI[Boiler water-in adjacent cell]
    MS[Mana spring water-in]
    G --> WP --> BI
    WP --> MS
  end
  subgraph steam [Steam network]
    BO[Boiler steam-out adjacent cell]
    SP[Steam pipes - orange preview]
    ST[Steam turret]
    BO --> SP --> ST
  end
  subgraph fireNet [Fire network]
    FG[Forge]
    FP[Fire pipes - red preview]
    FT[Flame turret]
    FG --> FP --> FT
  end
  subgraph mana [Mana economy]
    Pool[Shared mana pool max 20]
    MS -->|water + stationed magi| Pool
    Boiler[Boiler 1x2] -->|mana/sec| Pool
    MT[Magic turret 5 mana reserved/wave]
    FT2[Flame turret 1 mana/blast]
    Pool --> FT2
  end
  BI --- Boiler
  Boiler --- BO
```

| Defense line | Resource | Upstream |
|--------------|----------|----------|
| **Soldier slots** | Gold + logistics | Guardrooms, stairs |
| **Steam turrets** | Steam charge | Boiler water + mana |
| **Flame turrets** | Fire pipe + mana/blast | Forge fire network + mana pool |
| **Magic turret** | 5 mana reserved/wave | Mana springs (water + magi) + pool |

Spells spend mana but are **not** part of this logistics slice.

---

## Design goals

1. **One fluid per pipe cell** — no mixing water, steam, or fire in the same cell.
2. **Generic pipe tool** — fluid type from **network seeds** + live **preview**; **locks at wave start**.
3. **Factorio-style merge reject** — cannot place a pipe that would connect two different assigned fluids.
4. **Parallel runs** — water / steam / fire in **adjacent columns** (no crossover building).
5. **Instant hydraulic transfer** — connectivity is binary; steam charge rate uses **throughput split**, not fluid simulation.
6. **Shared mana** — boilers, magic turrets, and flame turrets compete for the same pool.

---

## Pipe layer

### Placement

- Same infra layer as stairs (`Tower.infra`).
- **One** of stair or pipe per cell (unchanged).
- Orthogonal segments only; may run through room footprints (except boiler cells).
- **No edits** during attack phase; fluid labels frozen for the wave.

### Fluid typing

| Preview state | Color | When |
|---------------|-------|------|
| Unassigned | Gray | Not connected to a seed |
| Water | **Blue** | Component touches **row 0** pipe cell |
| Steam | **Orange** | Component touches a **steam turret** (adjacent pipe cell) |
| Fire | **Red** | Component touches a **Forge** (adjacent pipe cell) |

**Seeds (priority: water → steam → fire):**

- **Water:** any pipe cell on **row 0** (ground). Any number of ground connections; no separate `waterSpring` structure.
- **Steam:** flood from cells **4-adjacent to any steam turret** (consumer pulls steam type through the pipe graph).
- **Fire:** flood from cells **4-adjacent to any Forge** (producer pushes fire type through the pipe graph).

Row-0 pipes are always water, so fire and steam runs must be **elevated** (off the ground row).

Re-preview **immediately** on pipe/room edits during build.

**Wave start:** resolve all components → write `InfraCell.fluid` → **lock** for attack rendering. Attack-phase boilers / springs / turrets / forges re-read live topology; with static networks this matches the lock.

### Merge rule

If placing a pipe would connect two different assigned fluids (water / steam / fire):

- **Block placement**
- Message: *"Would mix pipe fluids."*
- **Drag-paint:** invalid cells are skipped (message shown); the stroke does **not** abort — the player can continue over later valid cells

**Allowed:** T-junctions and crosses **within one fluid** only.

### Boiler attachment

- Pipes **cannot** occupy boiler footprint cells.
- **Water in** and **steam out** use **distinct adjacent cells** (one fluid per cell).
- Port type is inferred from network colors only — **no** "W in / S out" labels on inspect.

### Pipe drawing

Pipes draw through the **cell center** to **edge midpoints** toward each orthogonal joint:

- Neighbor **pipe** cells
- Adjacent **fluid-port rooms** (boiler, mana spring, steam turret, hydrant, forge, flame turret)
- **Ground** stub on row-0 pipes (south into the ground line)

That yields continuous L / T / + shapes instead of a side riser.

---

## Structure rooms

### Boiler (`boilerRoom`)

| Property | Value |
|----------|--------|
| Size | **1×2** |
| Water | Adjacent cell connected to **ground-water** network |
| Steam | Adjacent cell connected to **steam-turret** network |
| Mana | **0.25/sec** while producing; **stops** at 0 mana |
| Output | `steamAvailable` when water + steam port + mana OK |
| Throughput | **3 / 4 / 5** units via `boilerExpansion` mod (levels 0 / 1 / 2) |
| Passable | **false** |
| Cost / HP | **16 / 22** |

**Throughput:** each connected steam turret = **1 unit**. Charge rate split:

```
chargeRate = boilerUnits / sum(connectedTurretUnits)
fullChargeTime = 3s / chargeRate   // 3s at 1.0×
```

Many boilers may share water and steam networks.

### Steam turret (`steamTurretRoom`)

| Property | Value |
|----------|--------|
| Size | **1×1** |
| Input | Adjacent **steam** pipe |
| Charge | **3s** at 1.0× throughput; **keeps partial charge** if steam/mana stops |
| Fire | **Full dump** when charged + enemy in blast zone (holds at full until a target appears) |
| Damage | **10** (~5× magic turret’s 2) |
| Blast | Open **left/right** faces (neighbor cell empty); **3** wide × depth **3** |
| Targeting | **All** enemies in blast cells |
| Both sides open | May fire **both** lanes in the same dump |
| Passable | **false** |
| Cost / HP | **14 / 20** |

### Forge (`forgeRoom`)

| Property | Value |
|----------|--------|
| Size | **1×1** |
| Role | **Fire seed** — adjacent unassigned pipes become **fire** and flood the fire network |
| Outlet | Needs at least one adjacent **fire** pipe (build warning otherwise) |
| Passable | **false** |
| Cost / HP | **14 metal / 22** |

Forges do **not** consume water. They only seed fire into pipes.

### Flame turret (`flameTurretRoom`)

| Property | Value |
|----------|--------|
| Size | **1×1** |
| Input | Adjacent **fire** pipe that shares a component with a Forge |
| Charge | **3s** at chargeRate **1** while forge-connected; **keeps partial / full charge** if forge drops |
| Fire | **Full dump** when charged + enemy in blast + mana available (holds at full if dry or no targets) |
| Damage | **2** chip + **Kindled** on each successful hit |
| Blast | Same shape as steam: open **left/right** faces; **3** wide × depth **3** (`exteriorSideBlastCells`) |
| Targeting | **All** enemies in blast cells |
| Mana | **1** per blast dump |
| Passable | **false** |
| Cost / HP | **12 souls / 18** |

### Mana spring (`manaSpringRoom`)

| Property | Value |
|----------|--------|
| Size | **2×2** |
| Cost / HP | **28 / 30** |
| Water | Same adjacent-pipe rules as boiler |
| Staffing | Needs stationed **magi** from chambers (see [`HOUSING.md`](HOUSING.md)); up to **5**, efficiency `[1, 0.8, 0.6, 0.4, 0.2]` |
| Output | **0.5 mana/sec** × mage efficiency sum (stacks across springs) |
| No water / no mage | **0** mana; room build alert / inspect |
| Placement | Any **stable** cell |
| Passable | **true** (magi station inside the footprint) |

### Magic turret (`turretRoom`)

Existing room; **2 damage every 2s**, **3** cell range. **5 mana reserved from pool cap** at wave start per turret. If the reservation exceeds the pool cap, the turret is depowered (does not fire). No per-shot mana cost. Wave 1: one turret loses even on the covering shaft; two turrets (one per side) clear (`docs/BALANCE.md`).

---

## Mana economy

| Rule | Value |
|------|--------|
| Pool | **Shared**; **max 20** (`MAX_MANA`) |
| Wave start | **Full** (20) |
| Base regen | **0** without water-connected, mage-staffed springs |
| Magic turret | **5 mana** reserved from pool cap per turret (depowers if insufficient) |
| Flame turret | **1 mana** per blast dump |
| Boiler | Drains mana while producing steam |
| UI | Mana label rounded to the **nearest tenth** |

Intent: mana springs + reserved turret cap compete with boiler fire — the player cannot run everything on mana alone.

---

## Attack-phase behavior

### Simulation order (`game.step`, after room effects / magic turret)

```
1. Tick mana springs (+mana/sec if water-connected and staffed by magi)
2. Tick boilers (−mana/sec if water + steam port + mana; mark steamAvailable)
3. Tick steam turret charge (throughput split) and fire when charged + targets
4. Tick flame turret charge (forge-connected → rate 1) and blast when charged + targets + mana
```

Continuous room ticks run via `tickRoomBehaviors` (`steamTurret` / `flameTurret` `tick` hooks).

### Network breaks

When rooms or framing are destroyed mid-wave, call `lockPipeFluids` again (with current `maxWaterReachRow`) so attack-phase `InfraCell.fluid` matches live topology. Boilers, springs, steam turrets, and flame turrets re-query connectivity and go dark when seeds/paths break.

---

## Connectivity validation

Build-phase only. Warnings are **per-room** (red outline + hover/inspect), same pattern as logistics/slot alerts — **not** a HUD dump.

| Check | Behavior |
|-------|----------|
| Unassigned / orphan pipes (no seed) | **Gray preview only** — no dedicated warning |
| Boiler without water | Warn: *"Needs water from ground pipes"* |
| Boiler without steam outlet | Warn: *"Needs a steam pipe outlet"* |
| Steam turret without steam pipe | Warn: *"Needs a steam pipe"* |
| Steam turret steam net with no boiler | Warn: *"No steam from a boiler"* |
| Forge without fire outlet | Warn: *"Needs a fire pipe outlet"* |
| Flame turret without fire-connected forge | Warn: *"Needs a fire-connected forge"* |
| Mana spring without water | Warn: *"Needs water from ground pipes"* |
| Would-merge (build) | **Reject** placement |

---

## Data model

```ts
type Fluid = 'water' | 'steam' | 'fire' | 'unassigned';

interface InfraCell {
  kind: 'stair' | 'pipe' | 'elevator';
  fluid?: Fluid; // written at wave start for pipes
}

interface Player {
  mana: number;
  maxMana: number;
}

// GameState attack-phase runtime
boilerRuntime: Record<roomId, { producing: boolean; steamAvailable: boolean }>;
steamTurretRuntime: Record<roomId, { charge: number; chargeRate: number }>;
flameTurretRuntime: Record<roomId, { charge: number; chargeRate: number }>;
```

**Pipe networks:** flood-fill orthogonal pipe cells; type from seeds; merge reject on build.

**No** `waterSpring` blueprint — ground row is the only water source.

---

## UI

| Surface | Behavior |
|---------|----------|
| Pipe preview | Gray → blue (water) / orange (steam) / red (fire) on touch seed |
| Pipe joints | Center hub + orthogonal stubs (pipes, port rooms, ground) |
| Illegal merge | Red ghost / blocked placement |
| Layers | Infra layer shows pipe colors when on |
| Warnings | Room outline + hover/inspect (`selectRoomBuildAlerts`) |
| Boiler ports | **Colors only** — no port labels |
| Mana | `N.N / max` to nearest tenth |

---

## Implementation phases (history)

| Phase | Deliverable |
|-------|-------------|
| **P0** | Doc + `Player.mana` + constants |
| **P1** | `InfraCell.fluid`, seed flood-fill, preview colors, merge reject |
| **P2** | Connectivity warnings (room alerts) |
| **P3** | Boiler 1×2 + `boilerExpansion` + mana drain + steam availability |
| **P4** | Steam turret + charge + side blast + exterior targeting |
| **P5** | Mana spring 2×2 + water gate + inspect warning |
| **P6** | Magic turret 5 mana/wave reservation |
| **P7** | Balance pass (costs, HP, passable flags) |
| **Post** | Magi staffing gate + spring passable (see [`HOUSING.md`](HOUSING.md)) |
| **Fire** | Forge fire seed + flame turret charge/blast + three-fluid merge |

---

## Code map

| Area | Location |
|------|----------|
| Pipe graph / fluids | `src/model/pipes/` |
| Boiler / spring / steam / flame / hydrant behavior | `src/model/rooms/` |
| Shared side-blast geometry | `src/model/rooms/sideBlast.ts` |
| Attack tick order | `src/model/tick.ts` |
| Knobs | `src/config/infra.ts`, `src/config/combat.ts` |

## Balance defaults (config + blueprints)

```ts
// src/config/infra.ts + combat.ts + rooms/turret.ts
BOILER_MANA_PER_SEC = 0.25;
MANA_SPRING_PER_SEC = 0.5;
MAX_MANA = 20;
TURRET_DAMAGE = 2;
TURRET_COOLDOWN = 2.0;
TURRET_MANA_RESERVATION = 5;
STEAM_TURRET_CHARGE_SEC = 3;
STEAM_TURRET_DAMAGE = 10;
STEAM_TURRET_BLAST_DEPTH = 3;
FLAME_TURRET_CHARGE_SEC = 3;
FLAME_TURRET_DAMAGE = 2;
FLAME_TURRET_BLAST_DEPTH = 3;
MAGIC_TURRET_MANA_COST = 1; // flame turret blast, not magic turret
BOILER_THROUGHPUT = [3, 4, 5];
```

| Room | Cost | HP | Passable |
|------|------|----|----------|
| Boiler | 16 | 22 | false |
| Steam turret | 14 | 20 | false |
| Forge | 14 metal | 22 | false |
| Flame turret | 12 souls | 18 | false |
| Mana spring | 28 | 30 | true (magi station inside) |
| Magic turret | 10 | 18 | (existing) |

---

## Related docs

- [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) — layers, workers, stairs
- [`HOUSING.md`](HOUSING.md) — chambers / magi staffing for springs
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — task recipes
