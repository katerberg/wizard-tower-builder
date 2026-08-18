# Spells

One school folder per element. SpellDef + mechanics live in the same school file when possible.

```
spells/
  registry.ts     ← SPELLS list + hotbar ids (register here)
  cast.ts         ← cast pipeline (do not add spell-id branches)
  wandStrike.ts   ← auto-cast, no school
  fire/ air/ earth/ water/
  <school>.test.ts
```

## Add a spell

1. Create or edit `<school>/<name>.ts` — export a `SpellDef`.
2. Add one import + one entry in `registry.ts` (`SPELLS` and the school’s `*_HOTBAR_SPELL_IDS`).
3. Put balance knobs in `<school>/constants.ts` (or on the SpellDef).
4. Add a case in `<school>.test.ts`.
5. If it needs lasting FX: tick in `<school>/tick.ts`, reset in that tick module, draw in `view/canvas/`.

## SpellDef hooks (prefer these over editing cast.ts)

| Field | Use |
|-------|-----|
| `validatePlacement` | Extra cell checks (`trapAdjacent`, `puddle`, …) |
| `previewCells` | Aim highlight cells |
| `requiresCharge` | Needs earth Charge |
| `allowedWhileConcentrating` | Castable during Fortify |
| `breaksConcentration` | Clears Fortify on cast |

## Do not put here

- Room blueprints → `model/blueprints.ts` + `model/rooms/`
- Shared mana/wizard numbers → `config/`

## Range and friendly fire

Spell ranges and Wand Strike measure from the wizard **avatar** position. Friendly fire that hits the crown perch damages the **solar collector** (see `docs/PLAYER_MOVEMENT.md`).

