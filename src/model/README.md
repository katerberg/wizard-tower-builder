# Model (engine rules + content)

| Folder / file | What |
|---------------|------|
| `tick.ts` | Attack-phase step order (start here for the loop) |
| `phases.ts` | Build ↔ attack lifecycle |
| `tower/` | Placement, stability, sell, query |
| `blueprints.ts` / `infraBlueprints.ts` | Room & infra defs |
| `rooms/` | Behavioral rooms — see `rooms/README.md` |
| `spells/` | Spell schools — see `spells/README.md` |
| `staff/` | Deploy, assign, combat, harvest |
| `pipes/` | Fluid graph (not room ticks) |
| `modifications/` | One file + registry line per mod |
| `enemies.ts` / `waves.ts` | Enemy templates & difficulty curve |
| `names.ts` | Flavor name pools |

No imports from `store/` or `view/`.
