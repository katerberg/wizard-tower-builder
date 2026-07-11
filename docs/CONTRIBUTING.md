# Contributing

This guide is for human contributors and cloud agents working on Wizard Tower Builder. Read the [README architecture section](../README.md#architecture) first for the mental model.

## Engine vs shell

The game engine is **UI-agnostic**:

| Engine (do not couple to DOM/canvas) | Shell (swappable) |
|--------------------------------------|-------------------|
| `src/model/` | `src/view/` |
| `src/calculations/` | `src/main.ts` |
| `src/store/` | `index.html` |

A replacement UI only needs `Store`, `Intent`, `Snapshot`, and functions from `src/store/selectors.ts`.

## Layer rules (enforced by ESLint)

1. **`model/`** — pure game state and rules. No imports from `store/` or `view/`.
2. **`calculations/`** — shared pure helpers (grid, combat, pathfinding, camera scroll math). No imports from `store/` or `view/`.
3. **`store/`** — orchestrates intents, owns `GameState` + `ViewState`. No imports from `view/`. Handlers live in `src/store/handlers/`.
4. **`view/`** — reads snapshots and selectors; dispatches intents. Must not call rule predicates (`canPlace`, `canApplyModification`, etc.) — use selectors.

## Agent guardrails

1. Never import `view/` from `store/`, `model/`, or `calculations/`.
2. Never mutate `snapshot.game` outside `store/handlers/`.
3. Never call `canPlace` / `canApplyModification` / similar from `view/` — add or use a selector in `selectors.ts`.
4. New user actions = new `Intent` type + handler module + tests; view only dispatches.
5. Run `npm run lint` before finishing — import boundary violations fail CI.

## Swapping the UI

1. Keep `src/model/`, `src/calculations/`, `src/store/` unchanged.
2. Replace `src/view/` and `main.ts` with your shell.
3. Wire: `new Store()` → `store.subscribe(render)` → read `getSnapshot()` + selectors.
4. Map gestures → `store.dispatch({ type: ... })`.
5. Run `npm test` — all engine tests pass without any view code.

## Task recipes

### Add a blueprint

1. Add entry to [`src/model/blueprints.ts`](../src/model/blueprints.ts).
2. Add placement/stability tests in [`src/model/tower.test.ts`](../src/model/tower.test.ts) if rules differ.
3. Library auto-lists via `selectLibraryBlueprints` — no view change unless custom UI.

### Add a modification (spikes-style add-on)

1. Create [`src/model/modifications/<name>.ts`](../src/model/modifications/) exporting a `ModificationDef`.
2. Register in [`src/model/modifications/index.ts`](../src/model/modifications/index.ts).
3. Test in `modifications.test.ts` / `effects.test.ts` if combat hooks apply.

### Add a specialty room (turret, gold mine, etc.)

1. Add blueprint in [`src/model/blueprints.ts`](../src/model/blueprints.ts).
2. Add behavior in [`src/model/roomBehaviors/`](../src/model/roomBehaviors/) and register in `index.ts`.
3. Test in `effects.test.ts`. Library lists the blueprint automatically via selectors.

### Infrastructure feature (barracks, slots, stairs, …)

Read [`docs/INFRASTRUCTURE.md`](../docs/INFRASTRUCTURE.md) first. Follow the phased roadmap there. Key rules:

- Infra shares the macro grid; **one** infra kind per cell.
- Soldiers are `GameState` entities; movement runs in **attack phase** only.
- Interior pathfinding is separate from enemy exterior pathfinding.
- Slot staffing uses per-slot headcount + auto-assign at wave start.
- Reuse the **modifications** system for barracks/slot capacity upgrades.

### Pipe / boiler / steam feature

Read [`docs/PIPES.md`](../docs/PIPES.md) first. Key rules:

- Generic pipe with **preview typing** (water = row 0, steam = steam turret); **locks at wave start**.
- **Reject** placement that merges water and steam networks.
- Boiler **2×1**; no pipes through boiler cells — water/steam on **adjacent** cells only.
- Shared **mana** pool; mana springs (2×2) and boilers consume/produce per spec.

### Add an intent and UI control

1. Add variant to `Intent` in [`src/store/intents.ts`](../src/store/intents.ts).
2. Handle in appropriate [`src/store/handlers/`](../src/store/handlers/) module.
3. Add selector if the UI needs derived enable/disable state.
4. Dispatch from [`src/view/dom/`](../src/view/dom/) or [`src/view/input.ts`](../src/view/input.ts).
5. Wire mount in [`src/main.ts`](../src/main.ts) / [`index.html`](../index.html) if new panel.
6. Add store or selector tests.

### Change placement rules

- [`src/model/tower.ts`](../src/model/tower.ts) — `canPlace`, `validateTower`, `placeRoomReplacing`
- [`src/model/tower.test.ts`](../src/model/tower.test.ts)

### Change combat

- [`src/calculations/combat.ts`](../src/calculations/combat.ts) — damage formulas
- [`src/model/game.ts`](../src/model/game.ts) — attack-phase `step()`
- [`src/model/modifications/effects.ts`](../src/model/modifications/effects.ts) — mod hooks

### Change enemy movement

- [`src/calculations/pathfinding.ts`](../src/calculations/pathfinding.ts)
- [`src/model/enemies.ts`](../src/model/enemies.ts)

## Conventions

- Colocate tests as `*.test.ts` next to source.
- Use `@/` alias in `store/` and `view/`; relative imports inside `model/` are fine.
- DOM modules: `createX(root, store) => render` factory pattern.
- Barrel files (`src/model/index.ts`, etc.) are discovery entry points — do not bulk-rewrite internal imports to use them.

## Before opening a PR

```bash
npm test
npm run typecheck
npm run lint
```

CI runs on Node.js LTS (see `.nvmrc`).

## Internal design notes

Historical plans live in `.cursor/plans/` — not contributor documentation.
