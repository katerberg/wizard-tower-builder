---
name: Room Modifications System
overview: Add a build-phase room modification system (spikes, turret, gold-mining) with leveled upgrades and refunds, built as an extensible registry in its own folder that hooks into the rest of the app through a few well-defined seams.
todos:
  - id: data-model
    content: Add RoomModification + Room.modifications + GameState.roomEffectTimers to types.ts; remove vestigial contents/level/Item/Effect/ItemKind; init in createRoom and createInitialState
    status: completed
  - id: registry
    content: Create src/model/modifications/ with types.ts, index.ts registry/helpers, and spikes.ts/turret.ts/goldMine.ts def files
    status: completed
  - id: effects
    content: Implement effects.ts dispatcher (runRoomEffects, runWaveClearedEffects, ModEffectContext + cooldown management)
    status: completed
  - id: integrate
    content: "Wire hooks: game.step -> runRoomEffects, phases.beginWave/endWave, computeRoomStats passive aggregation"
    status: completed
  - id: store
    content: Add addModification/upgradeModification/sellRoom intents + store handlers with economy and modification-aware refunds
    status: completed
  - id: ui
    content: Make room modal interactive (add/upgrade/sell) and draw modification indicators in the renderer
    status: completed
  - id: tests
    content: Add modifications economy/stat tests and effect-behavior tests; run typecheck + full suite
    status: completed
isProject: false
---

# Room Modifications System

## Goals

- Add/upgrade modifications on existing rooms during the build phase; sell rooms with partial modification refunds.
- Multiple modification types per room, each leveled (e.g. spikes Lv2).
- All modification logic lives in `src/model/modifications/`; new types = one new file + one registry line.
- Rooms act on enemies (turret/spikes), enemies still only target the wizard, but nothing blocks future enemy-targeting/aggro/taunt.

## Data model (`src/model/types.ts`)

- Add `RoomModification = { id: string; level: number }`.
- Add `modifications: RoomModification[]` to `Room`; remove the unused `contents`/`level` fields and the dead `Item`/`Effect`/`ItemKind` types (keep `Modifier`/`RoomStats`).
- Add transient `roomEffectTimers: Record<string, number>` to `GameState` for active-effect cooldowns.
- `createRoom()` in [src/model/tower.ts](src/model/tower.ts) initializes `modifications: []`.

## Modifications folder (`src/model/modifications/`)

- `types.ts`: `ModificationDef` and `ModEffectContext`.
  - `ModificationDef = { id, name, glyph, color, description, maxLevel, cost(level), sellRefundRate?, canApply?(room, tower), passiveStats?(level): Partial<RoomStats>, attack?: { cooldown(level), run(ctx) }, onWaveCleared?(ctx) }`.
  - `ModEffectContext = { state, room, cells, level, dt, enemiesNear(range), enemiesTouching(), attackEnemy(enemy, attack, dexterity?), reward(amount), log(text, kind?) }` — built by the dispatcher so def files never import combat/economy directly.
- `spikes.ts`, `turret.ts`, `goldMine.ts`: data + thin hooks.
  - spikes: `attack.run` damages `enemiesTouching()` (on/orthogonally adjacent to footprint) on a short cooldown.
  - turret: `attack.run` hits the nearest of `enemiesNear(range)` via `attackEnemy` (mirrors wizard logic).
  - goldMine: `onWaveCleared` grants income scaled by level.
- `index.ts` (registry): `MODIFICATIONS`, `getModification(id)`, `listModifications()`, plus pure helpers `modificationCost(def, level)`, `modificationRefund(room)`, `canApplyModification(room, tower, id)`, `aggregateModifierStats(modifications): Partial<RoomStats>`. Imports only def files (no combat) so it stays cycle-free.
- `effects.ts` (dispatcher): `runRoomEffects(state, dt)` and `runWaveClearedEffects(state)`. Builds `ModEffectContext` using `computeDamage` ([src/calculations/combat.ts](src/calculations/combat.ts)), `reward` ([src/calculations/economy.ts](src/calculations/economy.ts)), `addMessage`, and `roomCells`. Manages per-room+mod cooldowns in `state.roomEffectTimers` keyed `"${room.id}:${def.id}"`.

## Integration seams (minimal touches)

- [src/model/game.ts](src/model/game.ts) `step()`: call `runRoomEffects(state, dt)` once, after the wizard attack block and before reaping dead enemies (existing reaper handles kills + rewards).
- [src/model/phases.ts](src/model/phases.ts): `beginWave()` resets `state.roomEffectTimers = {}`; `endWave()` calls `runWaveClearedEffects(state)` (gold-mining income).
- [src/calculations/combat.ts](src/calculations/combat.ts) `computeRoomStats(room, blueprint)`: fold in `aggregateModifierStats(room.modifications)`.
- [src/model/game.ts](src/model/game.ts) `createInitialState()`: init `roomEffectTimers: {}`.

## Economy, intents, store

- New intents in [src/store/intents.ts](src/store/intents.ts): `addModification { roomId, modId }`, `upgradeModification { roomId, modId }`, `sellRoom { roomId }`.
- [src/store/store.ts](src/store/store.ts): build-phase-only handlers that validate (exists / not max level / applicable / one-per-type), `canAfford` + `spend`, then mutate `room.modifications` in place (consistent with existing `room.hp` mutation). Sell/remove computes refund = `floor(blueprintCost/2) + modificationRefund(room)`; route right-click `removeRoomAt` and modal `sellRoom` through one shared method.

## View

- [src/view/dom/modal.ts](src/view/dom/modal.ts): make the room modal interactive in build phase — list current modifications (name, level, refund) and all registry options with Add/Upgrade buttons (cost shown; disabled when maxed/unaffordable/not applicable), plus a Sell button. Click delegation is fine (no per-frame re-render in build phase).
- [src/view/canvas/renderer.ts](src/view/canvas/renderer.ts): draw small modification glyph indicators along the bottom edge of each room.

## Tests

- `src/model/modifications/modifications.test.ts`: cost/refund math, `aggregateModifierStats`, one-per-type/upgrade rules.
- `src/model/modifications/effects.test.ts`: turret damages nearest in range, spikes damage touching climbers, gold-mining income on wave clear (deterministic via seeded `rngState`).

## Initial tuning (in def files, easy to tweak)

- spikes: maxLevel 3, cost 5/8/12, damage 2\*level, cooldown 0.5s.
- turret: maxLevel 3, cost 10/16/24, attack 3+2\*level, range 2+level, cooldown 0.9s.
- goldMine: maxLevel 3, cost 8/14/20, income 4\*level per wave.
