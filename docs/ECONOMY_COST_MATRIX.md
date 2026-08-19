# Economy cost matrix (snapshot)

**Status:** Reference for harvest / sink design. Amounts match code as of the mines design pass — treat as **provisional** until playtested. Sources: [`src/model/blueprints.ts`](../src/model/blueprints.ts), [`infraBlueprints.ts`](../src/model/infraBlueprints.ts), [`fortificationBlueprints.ts`](../src/model/fortificationBlueprints.ts), [`src/model/modifications/`](../src/model/modifications/), [`src/config/staff.ts`](../src/config/staff.ts), [`src/config/economy.ts`](../src/config/economy.ts), [`src/model/waves.ts`](../src/model/waves.ts) (`rewardFor`).

Wallet today: **gold · metal · stone · souls**. Planned: mine **iron → metal**, **gems → gold**; later **substance** (name TBD) for leyline track.

---

## Starting wallet

| gold | metal | stone | souls |
|------|-------|-------|-------|
| 48 | 40 | 60 | 30 |

---

## Framing / structures

| Blueprint | id | stone | metal | souls | gold | Wear v1 |
|-----------|-----|-------|-------|-------|------|---------|
| Spire Block | `stem` | 3 | — | — | — | Yes |
| Buttress (2) | `buttress2` | — | 6 | — | — | No |
| Buttress (3) | `buttress3` | — | 8 | — | — | No |

---

## Rooms

| Blueprint | id | stone | metal | souls | gold | Notes |
|-----------|-----|-------|-------|-------|------|-------|
| Turret Room | `turretRoom` | — | — | 10 | — | 5 mana reserved/wave |
| Flame Turret | `flameTurretRoom` | — | — | 12 | — | Needs forge fire |
| Forge | `forgeRoom` | — | 14 | — | — | |
| Guardroom | `guardroomRoom` | 9 | — | — | — | Housing; wear |
| Chamber | `chamberRoom` | — | — | 12 | — | Magi housing |
| Quarters | `quartersRoom` | 8 | — | — | — | Laborers; wear |
| Slot | `slotRoom` | 11 | — | — | — | Wear |
| Boiler | `boilerRoom` | — | 16 | — | — | 1×2 |
| Steam Turret | `steamTurretRoom` | — | 14 | — | — | |
| Mana Spring | `manaSpringRoom` | — | — | 28 | — | 2×2; **removed when leylines ship** |
| Hydrant | `hydrantRoom` | — | 12 | — | — | |
| Water Pump | `pumpRoom` | — | 10 | — | — | |

---

## Infrastructure

| Blueprint | id | stone | metal | souls | gold |
|-----------|-----|-------|-------|-------|------|
| Staircase | `staircase` | 2 | — | — | — |
| Pipe | `pipe` | — | 1 | — | — |
| Elevator | `elevator` | — | 6 | 2 | — |

Empty cells may auto-add Spire Block (stone) when placing rooms/infra.

---

## Fortifications (shell)

| Blueprint | id | stone | metal | souls | gold |
|-----------|-----|-------|-------|-------|------|
| Moat | `moat` | 6 | — | — | — |
| Glacis | `glacis` | 4 | — | — | — |
| Parapet | `parapet` | 5 | — | — | — |
| Cornice | `cornice` | 5 | — | — | — |
| Stakes | `stakes` | 4 | 2 | — | — |
| Barbican | `barbican` | 8 | 2 | — | — |

---

## Modifications

| Mod | id | Level costs |
|-----|-----|-------------|
| Spikes | `spikes` | L1–3: **5 / 8 / 12 stone** |
| Guardroom Expansion | `guardroomExpansion` | L1: **12 stone** |
| Quarters Expansion | `quartersExpansion` | L1: **14 stone** |
| Slot Expansion | `slotExpansion` | L1: **10 stone** |
| Chamber Expansion | `chamberExpansion` | L1: **10 souls** |
| Boiler Expansion | `boilerExpansion` | L1–2: **14 / 18 metal** |

---

## Staff (gold only)

| Kind | Recruit | Wave upkeep |
|------|---------|-------------|
| Soldier | 4 | 2 |
| Mage | 5 | 2 |
| Laborer | 3 | 1 |

Housing place cost is stone/souls (above); first occupant free; unrecruit floor 1.

---

## Income (today vs mines design)

| Source | Today | After mines track |
|--------|-------|-------------------|
| Wave clear | Gold = `8 + floor(plateau.budget / 12)` | Unchanged primary payroll gold |
| Kills | Souls per enemy template | Unchanged |
| Surplus laborers | Abstract 1 unit/sec → 25% metal / 75% stone | **Engine:** mine stone/metal/gold patches (`MINE_STONE_HARVEST_PER_SEC`); rare falloff (`RARE_PATCH_FALLOFF` ×0.5); passive iron drip (3%) |
| Prospect | — | **Shipped:** next depth tier (quality-rolled veins: poor/mixed/rich); equip cost: 5 stone + 1 metal at wave start |
| Leylines | — | Later: substance (stub) |

Repair remains **laborer time only** (no materials fee).

---

## Spend pressure by resource (reading the matrix)

| Resource | Main sinks today | Harvest design note |
|----------|------------------|---------------------|
| **Stone** | Spire, stairs, housing, slots, forts, spikes, expansions | High volume; shallow mine bands should feed this; wear steals labor from mining |
| **Metal** | Buttresses, pipes, elevators, forge/boiler/steam/hydrant/pump, stakes/barbican, boiler mod | Iron veins = metal; rarer / falloff |
| **Souls** | Turrets, chamber, mana spring, elevators (partial), chamber mod | Still kill-gated; spring goes away with leylines → substance may take some of this load later |
| **Gold** | Recruit + upkeep only | Gem nuggets add a second income; avoid making mid-height gem farm dominate payroll |

**Deferred (mines Q16):** new iron-specific sinks and substance costs — revisit this matrix after leylines / storage / turret retune rather than inventing sinks in the first mine engine slice.

---

## Related

- [`MINES.md`](MINES.md) — mine harvest design
- [`.cursor/plans/mine_harvest_index.plan.md`](../.cursor/plans/mine_harvest_index.plan.md) — slice order
- [`.cursor/plans/resource_economy_index.plan.md`](../.cursor/plans/resource_economy_index.plan.md) — wallet locks (amended by mines)
