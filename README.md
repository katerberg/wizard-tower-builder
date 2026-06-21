# Wizard Tower Builder

A small prototype for a gravity-constrained, room-stacking tower-defense roguelike. The goal is to model the game quickly and playtest whether the core loop is fun before adding visual polish.

Stack: **TypeScript**, **Vite**, **HTML5 Canvas** (board), **DOM** (UI chrome). No game framework.

## Gameplay

The run alternates between two phases:

1. **Build** — Spend currency to place rooms on a grid. Rooms must obey gravity and support rules (see below). Click a blueprint in the library, then click the grid to place. Right-click (or remove intent) to tear down a room. When the tower is valid, start the wave.
2. **Attack** — Enemies spawn at the base and pathfind up the **exterior** of the tower toward the wizard at the top. The wizard auto-attacks nearby climbers (room turrets are deferred). Survive the wave to earn currency and return to build. Lose if the wizard’s HP reaches zero.

Progression is linear and escalating for now (designed so branching roguelike paths can be added later).

### Tower placement rules

Placement and post-removal validity share a single authority: `validateTower()`. Anything you can place must remain valid; anything that becomes invalid after a removal is flagged.

- **Ground** — Row 0 is the floor; rooms can be placed directly on it.
- **Spire blocks (1-wide)** — Must sit on the ground or directly on another room (spire or buttress). They cannot overhang empty space.
- **Buttress (2 or 3 wide)** — Wide platforms; outer cells may cantilever at most **one step** beyond support below. Only buttress may “float” over gaps.
- **Single tower** — All rooms must form **one connected mass** (4-way adjacency). New placements must touch the existing structure; you cannot start a second tower elsewhere on the grid.

Unstable towers (floating rooms or illegal cantilevers) are highlighted on the board and block starting a wave.

### Controls

| Action           | Input                             |
| ---------------- | --------------------------------- |
| Select blueprint | Click in the library              |
| Place room       | Click grid (build phase)          |
| Remove room      | Right-click grid (build phase)    |
| Inspect room     | Click occupied cell (opens modal) |
| Start wave       | HUD button (when tower is stable) |

Dev mode toggles are available via intents (`toggleDevMode`, `devAddCurrency`, `devSkipWave`) for local testing.

### Enemy movement

Enemies are surface crawlers, not fliers. Pathfinding (`src/calculations/`) builds a one-cell-thick "shell" of empty cells that hug the tower on a **flat** surface: the ground (row 0), the left and right walls of rooms, ledges on top of rooms, and the pockets beneath overhangs. A cell that only touches a room diagonally is clinging to a bare corner — it is *not* a surface, so enemies never perch there. Cells out in open air are never walkable, so enemies must follow the structure up to the wizard.

Most steps are orthogonal: enemies climb flat walls and ledges one cell at a time. The single exception is a constrained **corner-wrap** — a diagonal step that wraps the outer corner of one solid block (exactly one of the two cells flanking the diagonal is a room, the other open). This lets a crawler move flat-to-flat *around* a convex corner (e.g. from a wall onto the roof above it) without ever standing on the corner, while still forbidding free-air leaps (no room between the cells) and squeezing through a diagonal gap (a room on both sides). A* uses a Manhattan metric with a uniform step cost.

A `MovementProfile` gates which surfaces a given enemy may use. The only profile implemented today is `under_overhang`, which may pass through the pockets beneath protruding rooms. Other kinds (`surface_climb`, `attack_overhang`, `fly`, `face_transfer`) are defined in the types and partially gated (for example, `surface_climb` cannot enter cells beneath an overhang) but are not yet assigned to any enemy.

## Getting started

```bash
npm install
npm run dev      # dev server (Vite)
npm test         # Vitest (model + calculations)
npm run typecheck
npm run build    # production build to dist/
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Architecture

Strict **MVVM** separation:

```
Input → Intents → Store (ViewModel) → Model (pure logic)
                      ↓
              Selectors → Canvas + DOM views
```

- **Model** (`src/model/`) — Pure game state and rules. No imports from DOM, canvas, or store. Seeded RNG for reproducible runs. Unit-tested with Vitest.
- **Store** (`src/store/`) — Reactive ViewModel: `getSnapshot()`, `subscribe()`, `dispatch(intent)`. Holds transient UI state (selected blueprint, hover, modals).
- **View** (`src/view/`) — Canvas renderer for the board; DOM modules for HUD, library, modals, tooltips. Fixed-timestep loop during the attack phase (`src/view/loop.ts`).
- **Calculations** (`src/calculations/`) — Shared pure helpers: grid math, exterior graph, pathfinding, combat, economy.

The hard rule: **model code never depends on the view layer**, so rules can be tested and iterated without touching rendering.

## Project layout

```
src/
  main.ts                 # Bootstrap: store, views, loop
  config/constants.ts     # Grid size, tuning, colors
  model/                  # Game entities, phases, tower rules, waves
  calculations/           # Grid, pathfinding, combat, economy, rng
  store/                  # Store, intents, selectors
  view/
    canvas/               # Board renderer + camera
    dom/                  # HUD, library, modal, tooltip, overlay
    input.ts              # Pointer → intents
    loop.ts               # Fixed-timestep game loop
  static/                 # Static data (e.g. names)
docs/                     # Design notes and draft plans
```

Key model entry points:

- `tower.ts` — `canPlace()`, `placeRoom()`, `removeRoom()`, `validateTower()`, `isTowerStable()`
- `game.ts` — `GameState`, wave lifecycle, `step(dt)` during attack
- `phases.ts` — Scene/phase finite state machine

## Deferred / not in v1

- Room contents and turret behavior (items exist in types; placement contents TBD)
- Multiple currencies, build constraints, roguelike map branching
- Alternative enemy movement modes (fly, attack overhangs, etc.) — default is `under_overhang` exterior climb
- Visual polish beyond ASCII-style glyphs on canvas

## License

Copyright (C) 2026 Mark Katerberg

This project is licensed under the [GNU Affero General Public License v3.0 or later](LICENSE) (AGPL-3.0-or-later).

If you modify this software and run it as a network service, you must make the corresponding source available to users interacting with it over a network, as required by the Affero GPL.
