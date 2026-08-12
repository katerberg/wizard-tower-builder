---
name: Mine harvest — Engine (slice 1)
overview: 'Underground mine grid + entrance attach + shallow stone workplaces; replace abstract harvest:underground. No prospect, iron/gems, storage, or clear tally.'
todos:
  - id: mine-state
    content: MineState on GameState; deterministic shallow generate at run start
  - id: pathing
    content: Extend interior graph/pathfinding for mine tunnels (free vertical underground)
  - id: staff
    content: stepStaff + repair loop honor mine/pump jobs; assign surplus to stone patches
  - id: yield
    content: Stone-only harvest depleting patches; remove abstract 25/75 split from tick
  - id: render-docs-tests
    content: Cull underground staff draw; tests; MINES.md engine status; README harvest copy
isProject: false
---

# Mine harvest — Engine (slice 1)

**Design:** [`docs/MINES.md`](../../docs/MINES.md)  
**Index:** [`mine_harvest_index.plan.md`](./mine_harvest_index.plan.md)

## IN SCOPE

1. `GameState.mine` — tunnels + stone patches; generate once in `createInitialState`
2. Interior pathing into negative-row tunnels; entrance under ground framing
3. Surplus laborers (after repair / hand-pump) path to stone patch cells and harvest **stone only**
4. Remove abstract `harvest:underground` yield path (25/75 metal/stone)
5. Do not clear mine/pump workers in the repair retarget loop (stay put)
6. Hide staff with `row < 0` on canvas
7. Tests + docs status for engine slice

## OUT OF SCOPE

- Prospect allocation / next depth tier
- Iron / gem yields / rare falloff
- Storage rooms
- Wave-clear haul tally UX
- Leylines / mana-spring removal
- Mine elevators / visible mine UI / mapping

## Docs

- Update [`docs/MINES.md`](../../docs/MINES.md) status: engine slice shipped (shallow stone); later slices still open
- Refresh harvest wording in README / HOUSING where it still says abstract underground metal/stone split
