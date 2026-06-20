---
name: Tower Builder Prototype Scaffold
overview: Scaffold a small TypeScript + Vite + Canvas prototype for a gravity-constrained, room-stacking tower-defense roguelike, structured as strict MVVM (pure-logic Model, reactive ViewModel store, Canvas + DOM Views) with a build phase and an attack phase, so the game can be modeled and playtested for fun before any visual polish.
todos:
  - id: scaffold
    content: Create Vite + TS project at repo root (index.html, package.json, tsconfig, vite.config, constants), bootstrap in src/main.ts, render empty grid on canvas
    status: pending
  - id: model-grid
    content: "Implement pure model: types, seeded rng, grid occupancy, gravity/support canPlace(), placeRoom/removeRoom; add Vitest tests"
    status: pending
  - id: store
    content: Implement reactive store (getState/subscribe/dispatch), intents, and selectors as the ViewModel layer
    status: pending
  - id: build-view
    content: "Build-phase views: DOM blueprint library + currency HUD, canvas ghost preview (green/red), click-to-place wired through intents"
    status: pending
  - id: attack-view
    content: "Attack phase: fixed-timestep loop, single wave spawn, enemy approach + room damage, currency reward, return to build"
    status: pending
  - id: fsm-progression
    content: Scene/phase FSM, lose condition (integrity to 0), next-level progression
    status: pending
  - id: rooms-items
    content: Inspect modal + tooltips + a second room type and an item to validate the room-contents concept
    status: pending
  - id: model-7drl-patterns
    content: "Add 7drl-derived model patterns: EnemyTemplate, computeRoomStats/computeDamage, GameMessage log, static name pools, devMode debug intents"
    status: pending
isProject: false
---

# Tower Builder Prototype Scaffold

Stack: TypeScript + Vite (vanilla), Canvas 2D for the board, DOM for chrome, Vitest for testing the pure model. No game framework. The existing Godot folder at `wizard-tower-builder/wizard-tower-builder/` is left untouched; the web app lives at the repo root.

## Architecture (strict MVVM)

The hard rule that keeps logic testable and swappable: **`src/model/*` imports nothing from the DOM, canvas, or store.** Everything flows one direction.

```mermaid
flowchart LR
  pointer["Canvas / DOM input"] --> intents["Intents (commands)"]
  intents --> store["Store / ViewModel (single source of truth)"]
  store --> model["Model (pure logic + rules)"]
  model --> store
  store --> selectors["Selectors"]
  selectors --> canvasView["Canvas renderer (board)"]
  selectors --> domView["DOM views (HUD, library, modals, tooltips)"]
  loop["Fixed-timestep loop (dt, alpha)"] --> store
```

- Model: pure, deterministic game state + rules. Seeded RNG so runs are reproducible.
- ViewModel (store): wraps model state, exposes `getState()`, `subscribe()`, and `dispatch(intent)`. Holds transient presentation state (selected blueprint, hovered cell, open modal). Translates intents into model mutations and notifies subscribers.
- View: `CanvasView` draws the tower/enemies from a snapshot each frame; DOM views subscribe to selectors and only update on relevant change.

## Proposed file structure

- `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`
- `src/main.ts` — bootstrap: build model -> store -> views -> start loop
- `src/config/constants.ts` — `CELL_SIZE`, `FIXED_DT = 1/60`, grid bounds, starting currency, `symbols`, `colors`
- `src/static/names.ts` — flavor name pools for enemies/items (7drl pattern)
- `src/model/` (PURE, no DOM/canvas):
  - `types.ts`, `rng.ts` (seeded)
  - `grid.ts` — coordinates + occupancy + gravity/support checks
  - `tower.ts` — `canPlace()`, `placeRoom()`, `removeRoom()`
  - `blueprints.ts` — static room library (id, name, size w/h, cost, glyph, allowed contents, upgrades)
  - `enemies.ts`, `waves.ts` — enemy defs + per-level wave/reward defs
  - `combat.ts` — attack-phase resolution, `computeDamage()`, `computeRoomStats()`, advanced by `step(dt)` (pure)
  - `messages.ts` — append/query game log messages
  - `economy.ts` — costs, currency, upgrades/modifiers
  - `phases.ts` — scene/phase finite state machine
  - `game.ts` — `GameState` + top-level `step(dt)` / reducers
- `src/store/store.ts` — reactive store + selectors; `src/store/intents.ts` — intent/command types
- `src/view/loop.ts` — fixed-timestep accumulator loop
- `src/view/canvas/renderer.ts`, `src/view/canvas/camera.ts` (world<->screen + click-to-cell picking)
- `src/view/dom/hud.ts`, `library.ts`, `modal.ts`, `tooltip.ts`, `messageLog.ts`
- `src/view/input.ts` — pointer -> intents
- Colocated `*.test.ts` for `model/` (grid/gravity, placement, combat, economy)

## Comparison with [7drl](https://github.com/katerberg/7drl)

Your prior roguelike is a monolithic `Game` class (rot.js Display + Scheduler) where model and view are intertwined. The tower-builder plan intentionally splits that apart, but several **game-model concepts** from 7drl are worth carrying forward even though the genre differs.

### What 7drl had that maps well to this game

| 7drl concept | 7drl shape | Tower-builder equivalent | Plan status |
|---|---|---|---|
| Static enemy templates | `enemies.GOBLIN` with stats, xp, drop%, color | `EnemyTemplate` in `enemies.ts` | Was partial — now added |
| Named instances | enemy name from `goblins[]` pool | optional flavor name on spawned enemy | Was missing — now added |
| Item/loot (`Cache`) | type + name + `{ attack, defense, hp }` modifiers | `Item` in room contents | Was partial — concrete `Modifier` shape added |
| Gear slots | Weapon / Armor / Amulet typed slots | room `capacity` + `allowedItemKinds` / slot types | Was partial — now spelled out |
| Computed effective stats | `effectiveMaxHp`, `getDamage()` from base + gear | `computeRoomStats()` from blueprint + contents | Was missing — now added |
| Level-scaled loot | `Cache(level)` scales modifiers by depth | offers/items scale with `levelIndex` | Deferred — note for v2 |
| XP + threshold table | `xpLevels` map, `addXp()` → `levelUp()` | in-run progression beyond currency | Deferred — currency-only v1 |
| Combat resolution | dex dodge, armor absorption | `computeDamage(attacker, defender)` | Was missing — stub in v1 |
| Enemy pathfinding | A* via rot.js, topology per type | ground approach toward target room | Open question — plan unchanged |
| Enemy drops | `dropPercentage` → `Cache` on death | currency + optional item drop | Partial — template has drop fields |
| Consumable vs equipable | Potion (instant) vs gear (modal equip) | `ItemKind: module \| consumable` | Was missing — now added |
| Message log | `sendMessage()` combat feedback | `messages: GameMessage[]` in model | Was missing — now added |
| Persistence | `localStorage` full-state save each turn | save/resume run | Deferred — design state as JSON-serializable |
| Static content pools | `static/enemies.ts`, `static/animals.ts` | `static/names.ts` flavor pools | Was missing — now added |
| Symbol/color registry | `constants.symbols`, `constants.colors` | centralized glyph + color map | Was partial — now in constants |
| Dev mode | `?devmode` cheats (skip level, force level-up) | debug intents for fast iteration | Was missing — now added |

### What 7drl had that we intentionally drop

- **Turn scheduler** (`rot-js Scheduler`) — replaced by build-phase (event-driven) + attack-phase (real-time fixed timestep).
- **FOV / `seenSpaces`** — full board visibility; no fog of war needed.
- **Procedural dungeon map** (`Map.Digger`, `freeCells`) — replaced by player-placed tower on a fixed grid.
- **Player avatar on grid** — no `@` character; interaction is click-to-place / click-to-inspect.
- **rot.js coupling** — no library; pure TS model + canvas renderer.

## Data modeling

Concrete starting shapes (refined after 7drl review):

```ts
type Cell = { col: number; row: number }; // row 0 = ground (bottom)

type Modifier = { attack?: number; defense?: number; hp?: number };

type Blueprint = {
  id: string;
  name: string;
  glyph: string;
  color: string;
  size: { w: number; h: number };
  cost: number;
  baseHp: number;
  capacity: number;
  allowedItemKinds: ItemKind[];
  slotTypes?: string[]; // optional typed slots, e.g. ["turret", "utility"]
};

type ItemKind = "module" | "consumable";

type Item = {
  id: string;
  kind: ItemKind;
  name: string; // flavor, e.g. "Ballista of the Aardwolf"
  glyph: string;
  modifiers: Modifier;
  effects: Effect[]; // behavioral hooks (attack nearby, heal room, etc.)
};

type Room = {
  id: string;
  blueprintId: string;
  origin: Cell;
  size: { w: number; h: number };
  contents: Item[];
  modifiers: Modifier[];
  hp: number;
  level: number;
};

type RoomStats = { maxHp: number; attack: number; defense: number }; // computed, not stored

type Tower = { rooms: Room[]; occupancy: Record<string, string> }; // "col,row" -> roomId

type EnemyTemplate = {
  id: string;
  type: string;
  glyph: string;
  color: string;
  stats: { strength: number; dexterity: number; maxHp: number };
  speed: number;
  currencyReward: number;
  dropChance?: number;
  dropItemId?: string;
  pathTopology?: 4 | 8;
};

type Enemy = {
  id: string;
  templateId: string;
  name: string;
  pos: { x: number; y: number };
  currentHp: number;
  targetRoomId: string | null;
};

type GameMessage = { tick: number; text: string; kind: "info" | "combat" | "economy" };

type Player = {
  currency: number;
  integrity: number;
  unlockedBlueprints: string[];
  levelIndex: number;
};

type Phase = "build" | "attack";
type Scene = "menu" | "run" | "gameOver" | "victory";

type GameState = {
  scene: Scene;
  phase: Phase;
  levelIndex: number;
  waveIndex: number;
  waveTimer: number;
  tick: number;
  player: Player;
  tower: Tower;
  enemies: Enemy[];
  messages: GameMessage[];
  rngState: number;
  devMode: boolean;
};
```

- **Computed stats**: `computeRoomStats(room, blueprint, items)` and `computeDamage(attacker, defender)` live in pure model functions (testable), mirroring 7drl's `effectiveMaxHp` / `calculateDamage` but decoupled from rot.js.
- **Currency**: single in-run currency for v1; XP/level-up deferred unless currency alone isn't enough progression feedback.
- **Time**: build phase is untimed (event-driven); attack phase advances via `step(FIXED_DT)`; build phase does not call `step` (just renders).
- **Phases/scenes**: FSM in `phases.ts` — `menu -> run`, then `run` loops `build <-> attack`, exiting to `gameOver`/`victory`.
- **Persistence**: defer full localStorage save for v1, but design `GameState` as JSON-serializable from day one (7drl's `storeState` pattern).

## Gravity / placement rules (v1, intentionally simple)

`canPlace(tower, blueprint, origin)` returns `{ ok, reason }` and is the single authority. A placement is valid when:

1. In-bounds and no overlap with existing rooms.
2. Supported: every cell of the room's bottom edge rests on either ground (`row 0`) or an occupied cell directly below.
3. Connectivity: the resulting structure connects to the ground (no floating clusters).

Cantilever / center-of-mass / stability-from-width are deferred (see open questions). The build View shows a ghost preview: green when `canPlace` is ok, red otherwise.

## Visuals for the two phases (canvas + DOM)

- Board (canvas): grid lines; each room drawn as a `w x h` block outline with its glyph centered and content glyphs inside (so "Room with Item A" vs "Room with B + C" reads differently); ground line at `row 0`.
- Build phase: DOM library/palette panel of blueprints with costs, currency HUD, selected-blueprint highlight, ghost preview on hover, click-to-place / click-to-inspect (modal), "Start Wave" button.
- Attack phase: same tower render + enemies as moving glyphs/dots approaching the tower, thin HP rects on damaged rooms, wave/level + timer HUD. On wave clear: award currency, return to build.
- Interaction: canvas picking converts pointer -> cell -> intent (place/select); DOM handles modals, tooltips, menus. Both feed the same intent pipeline.

## Game loop (attack phase only)

Fixed-timestep accumulator per current best practice: cap frame time at `0.25s`, run `update(FIXED_DT)` to advance the model, render with interpolation `alpha`. During build phase the loop renders but skips `update`.

## Milestone order (vertical slice first, to test "is it fun")

1. Project scaffold + bootstrap + empty canvas + grid render.
2. Model: grid + gravity `canPlace` + place/remove, with tests.
3. Build View: blueprint library, ghost preview, click-to-place, currency spend.
4. Attack View: spawn one wave, enemies approach + damage rooms, fixed-timestep loop, award currency, return to build.
5. Phase/scene FSM + lose condition (`integrity` to 0) + next-level progression.
6. Inspect modal + tooltips + a second room type and an item to validate the room-contents concept.

## Open questions / things to consider for the first pass

- Enemy targeting: do enemies path along the ground and hit the base, climb/scale the tower, target a specific "core" room, or attack the nearest room? This strongly shapes the fun and the gravity design.
- Lose condition: a single core room that must survive, a global `integrity` value, or "tower collapses if a load-bearing room dies"? (Room destruction + gravity could trigger cascade collapse — powerful but more complex.)
- Gravity depth: pure stacking only for v1, or allow cantilever / width-based stability / center-of-mass now?
- Attack pacing: auto-running real-time (with pause) vs discrete ticks the player advances. Recommend auto real-time via the fixed loop.
- Room contents semantics: how do Item A vs Item B+C change a room's behavior (e.g., room = slot container, items = modules that add attacks/effects)?
- Currency: single currency vs split build-vs-meta currency for between-run roguelike progression.
- Level progression shape: linear escalating waves vs roguelike branching map with blueprint-draft rewards between levels.
- Build constraints: per-phase budget, max height/footprint, room count caps.
- Persistence/save and seeded-run sharing: deferred for v1?
- Godot folder: leave as-is (chosen "abandon for now"), or remove from the repo to reduce confusion?
