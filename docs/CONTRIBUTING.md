# Contributing

Read the [README “Where do I…?” table](../README.md#where-do-i) first. Folder READMEs under `src/` are the short checklists.

## Engine vs shell

| Engine (UI-agnostic) | Shell (swappable) |
|----------------------|-------------------|
| `src/model/` | `src/view/` |
| `src/calculations/` | `src/main.ts` |
| `src/store/` | `index.html` |
| `src/config/` | |

A replacement UI only needs `Store`, `Intent`, `Snapshot`, and `src/store/selectors/`.

## Layer rules (ESLint)

1. **`model/`** — no `store/` or `view/`.
2. **`calculations/`** — no `store/` or `view/`.
3. **`config/`** — leaf knobs; no `model/` / `store/` / `view/`.
4. **`store/`** — no `view/`. Handlers are the only writers of game state.
5. **`view/`** — no rule predicates (`canPlace`, …); use selectors.

## Task recipes

### Plan a feature (one-shot)

Read [`.agents/skills/one-shot-plan/SKILL.md`](../.agents/skills/one-shot-plan/SKILL.md). Research, dump **one** numbered question list, wait, then lock a plan with no open questions. Invoke in Cursor with `/one-shot-plan` or Plan mode on a non-trivial feature.

### Add a spell

See [`src/model/spells/README.md`](../src/model/spells/README.md).

1. Create `<school>/<name>.ts` exporting a `SpellDef` (hooks: `validatePlacement`, `previewCells`, `requiresCharge`, …).
2. Register in [`src/model/spells/registry.ts`](../src/model/spells/registry.ts) (`SPELLS` + school hotbar ids).
3. Put knobs in `<school>/constants.ts` or on the SpellDef.
4. Test in `<school>.test.ts`. Lasting FX → school `tick.ts` + `view/canvas/layers/spellFx.ts`.
5. Do **not** add spell-id branches in `cast.ts`.

### Add a blueprint (passive room / framing / infra)

1. Entry in [`src/model/blueprints.ts`](../src/model/blueprints.ts) or [`infraBlueprints.ts`](../src/model/infraBlueprints.ts).
2. Library section in [`src/store/librarySections.ts`](../src/store/librarySections.ts).
3. Placement tests in [`src/model/tower.test.ts`](../src/model/tower.test.ts) only if rules differ.

### Add a behavioral room

See [`src/model/rooms/README.md`](../src/model/rooms/README.md).

1. Blueprint + library section (above).
2. One file in [`src/model/rooms/`](../src/model/rooms/) + one line in `registry.ts`.
3. Use `attack` (cooldown volley), `tick` (continuous), and/or `roles` (identity).
4. Pipe graph stays in `model/pipes/` — only room behavior lives in `rooms/`.

### Add a modification

1. `src/model/modifications/<name>.ts` exporting a `ModificationDef`.
2. Register in `modifications/index.ts`.
3. Test in `effects.test.ts` if combat hooks apply.

### Infrastructure / housing / pipes

- Design: [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md), [`HOUSING.md`](HOUSING.md), [`PIPES.md`](PIPES.md).
- Staff: `src/model/staff/` (`deploy`, `assign`, `combat`, `harvest`).
- Layer id is **`workers`**.

### Add an intent and UI control

See [`src/store/README.md`](../src/store/README.md).

1. `Intent` variant in `intents.ts`.
2. Handler in `handlers/`.
3. Selector in `selectors/` if needed.
4. Dispatch from `view/dom/` or `input.ts`.

### Change placement rules

- [`src/model/tower/`](../src/model/tower/) — `placement.ts`, `stability.ts`
- [`src/model/tower.test.ts`](../src/model/tower.test.ts)
- Paint-time (speculative) legality: [`src/model/construction/pendingTower.ts`](../src/model/construction/pendingTower.ts) — `planPlacementOnTower` dispatches all four layers, `towerWithPendingOrders` builds the plan the paint is judged against, and `isOrderLiveLegal` gates laborers. Add rules there rather than in handlers so paint, ghost, labor, and dusk freeze stay in sync ([`docs/DAY_NIGHT.md`](DAY_NIGHT.md)).

### Change combat / attack loop

- Damage formulas: [`src/calculations/combat.ts`](../src/calculations/combat.ts)
- Attack tick order: [`src/model/tick.ts`](../src/model/tick.ts)
- Phase FSM: [`src/model/phases.ts`](../src/model/phases.ts)
- Mod / room hooks: [`src/model/modifications/effects.ts`](../src/model/modifications/effects.ts)

### Change enemy movement

- [`src/calculations/pathfinding.ts`](../src/calculations/pathfinding.ts)
- [`src/model/enemies.ts`](../src/model/enemies.ts)
- Fliers: [`docs/FLYING.md`](FLYING.md)

### Tweak balance

Index: [`src/config/README.md`](../src/config/README.md). Expected builds: [`docs/BALANCE.md`](BALANCE.md) + [`src/test/balance/builds.ts`](../src/test/balance/builds.ts). Commands: `npm run test:balance` (full suite) and `npm run test:playability` (first-wave pair).

Cost snapshot by resource: [`docs/ECONOMY_COST_MATRIX.md`](ECONOMY_COST_MATRIX.md).

## Conventions

- Colocate tests as `*.test.ts` next to source.
- Prefer `@/` in `store/` and `view/`; relative imports inside `model/` are fine.
- DOM modules: `createX(root, store) => render`.
- Historical plans in `.cursor/plans/` are not contributor docs.

## Before opening a PR

```bash
npm run lint && npm test
```

CI uses Node.js LTS (`.nvmrc`).

### Change wizard movement / solar collector

Design: [`PLAYER_MOVEMENT.md`](PLAYER_MOVEMENT.md).

1. Walk graph: `src/calculations/wizardGraph.ts` + `wizardPathfinding.ts`.
2. Runtime: `src/model/wizard/` (`stepWizard`, `setWizardDestination`).
3. Enemy goal / lose: `src/model/tick.ts`, `flierCombat.ts` (`attackCollector`).
4. Intent: `moveWizard` in `src/store/intents.ts` + `handlers/wizard.ts`.
