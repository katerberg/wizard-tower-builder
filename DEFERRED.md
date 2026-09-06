# Deferred Items

There are many items that we have not yet implemented but that might happen. This is a scratch-pad, loosely organized by area with the high level concepts. Anything unimplemented but planned should be included here to keep other files only representing the current state of the project.

## To implement before considering the project complete

Still not done:

- Dynamic pipe/network breaks on room destruction
- Soldier death / targeting; pipe damage
- Advanced mage tech (combat casting) — housing basics shipped in [`docs/HOUSING.md`](docs/HOUSING.md); research/tech tree shipped ([`docs/RESEARCH.md`](docs/RESEARCH.md)); spell discovery still deferred
- Multiple currencies beyond gold; roguelike map branching
- Attack-overhang / face-transfer crawler modes (fliers shipped — [`docs/FLYING.md`](docs/FLYING.md))
- Visual polish beyond ASCII-style glyphs on canvas
- Training rooms (troops of certain types required to populate other rooms)
- Spell discovery (height-clear offers) + spell bonuses on the tree — see [`docs/RESEARCH.md`](docs/RESEARCH.md)
- Mana Well / spell shop
- Shell fortifications (moats, glacis, parapets, cornices, stakes, barbican) — shipped; see [`docs/FORTIFICATIONS.md`](docs/FORTIFICATIONS.md). Spikes migration to shell still deferred.
- Structures such as crenels / murderholes beyond existing turrets (populated shell — separate from fortifications)
- Further non-elemental spell kits / spell shop
- Additional turret / economy room types beyond Boiler, Mana Spring, Turret, Steam Turret, Forge, Flame Turret, and Water Pump
- Infra/mod repair and mid-wave building (laborers repair room HP only today). Infra and fortification **construction** now goes through the laborer queue like rooms and framing, and speculative plans (paint against live + pending orders) shipped — see [`docs/DAY_NIGHT.md`](docs/DAY_NIGHT.md); dependency-edge graphs and free rearrangement of **completed** geometry remain deferred.
- Exact harvest/wear balance curves; weather events on the weathering channel
- **Validate expected-build economy** — affordability envelopes (slack leftover, not exact gold snapshots) for named fixtures; depends on the balance harness ([`docs/BALANCE.md`](docs/BALANCE.md))
- **Possible-towers visualization** — catalog → spatial heatmap → layout search; harness emits an in-memory sim report only ([`docs/BALANCE.md`](docs/BALANCE.md))
- Mine grid harvest / prospecting / storage rooms — design in [`docs/MINES.md`](docs/MINES.md); **engine slice shipped** (shallow stone workplaces)
- Leyline / substance harvest + mana-spring removal — stub only ([`.cursor/plans/leyline_harvest_stub.plan.md`](.cursor/plans/leyline_harvest_stub.plan.md))

## High level concepts to implement

These are loose plans for items we might want to add

### Research: procedural tree layout

When the static tree is fun enough:

- At run start, generate a DAG that **preserves sacred hard gates** but varies depth/order of non-critical nodes (e.g. steam turret immediately after pipes in one run, or behind another mid-tier room in another).
- Claim loop stays research-room based; frontier UI still only shows what’s available.
- Optional later: draft-style research offers — **not** required for procedural value.

---

### Day/Night: To do

- **Light/dark visual theme** for day vs night.

---

## Mining

- Player-drawn mine interiors / fog-of-war mapping UI
- Mine elevators, staging camps, multi-mine sites
- Research tech trees (fracking, titanium, …)
- Exact balance numbers
- Renaming “substance”

---

## Flying tiers rename - Size

Rename `EnemySizeTier` for clarity (no mental mapping):

| Old     | New      |
| ------- | -------- |
| `swarm` | `small`  |
| `elite` | `medium` |
| `boss`  | `large`  |

Apply everywhere (templates, renderer radii, tests).

**Speed rule (all enemies):** larger tiers move slower. Retune existing crawler speeds to match (small fastest → large slowest). First melee flier is **small** at about **1.3×** a typical small crawler baseline (placeholder; pick concrete constants in implementation).

---

## Fortifications - Spikes

**Today (shipped):** room modification `spikes` on any room; Lv1–3; `onEnemyStep` + `onEnemyAttackRoom`; misses fliers.

**Target end state:**

| Field    | Spec                                                                                                                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Id       | `spikes`                                                                                                                                                                                                                                            |
| Kind     | Shell fortification on exterior framing                                                                                                                                                                                                             |
| Level    | Single level only (remove Lv2/3 costs and upgrade UI)                                                                                                                                                                                               |
| Effect   | Contact damage on crawler step touching the fortified cell’s shell (preserve current per-step adjacency intent as closely as possible); retaliate when a demolisher smashes a **room on that cell** or the framing as defined in the migration plan |
| Fliers   | Still miss                                                                                                                                                                                                                                          |
| Stacking | Coexists with rooms on the same cell                                                                                                                                                                                                                |

Until Plan 6 merges, room-mod spikes remain as-is. Do not half-migrate.

---

## Housing

- Magi **combat casting** / replacing the player wizard (research jobs: see [`RESEARCH.md`](RESEARCH.md))
- Steam-powered workplace analogue
- Repair of pipes/stairs/mods; building during attack
- Cross-housing synergies and roguelike mutually exclusive housing rewards
- Card-heavy or tutorialized housing UX
- Replacing or merging the player wizard with magi
- Soldier death / individual targeting

---

## Pipes

| Item                                   | Notes                                   |
| -------------------------------------- | --------------------------------------- |
| Crossover / bridge buildings           | Not planned                             |
| Pipe damage                            | Not planned                             |
| Separate `waterSpring` structure       | Ground row only                         |
| Orphan-pipe component warnings         | Gray unassigned is the signal           |
| Boiler mana-forecast warning           | Not implemented                         |
| Drag-paint abort on first illegal cell | Invalid cells skipped; stroke continues |
| Spell mana as a logistics deliverable  | Spells already spend the shared pool    |

---
