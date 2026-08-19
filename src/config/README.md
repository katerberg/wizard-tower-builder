# Balance knobs

| Category | File |
|----------|------|
| Grid / viewport / sim timing | `grid.ts` |
| Starting wallet, wear, water band | `economy.ts` |
| Mine depth / stone patch stock / harvest rate | `mines.ts` |
| Spawn intervals, fliers, slot DPS, wizard, mana cap | `combat.ts` |
| Magic turret damage / cooldown / range | `src/model/rooms/turret.ts` |
| Housing capacity, recruit/upkeep, staff speeds | `staff.ts` |
| Research room capacity / progress rates | `research.ts` |
| Boilers, mana springs, steam turrets | `infra.ts` |
| Shell fortification path/slow costs | `fortifications.ts` |
| Colors / glyphs (presentation) | `view/theme.ts` |
| Blueprint costs / HP | `model/blueprints.ts`, `model/infraBlueprints.ts`, `model/fortificationBlueprints.ts` |
| Enemy HP / speed / rewards | `model/enemies.ts` |
| Wave budget / unlocks / win height | `model/waves.ts` |
| Spell mana / CD / damage | `model/spells/<school>/` (+ SpellDef fields) |
| Mod costs | `model/modifications/` |

`constants.ts` re-exports grid/economy/combat/staff/infra for convenience.

Expected-build locks (idle combat, height-aware fixtures): [`docs/BALANCE.md`](../../docs/BALANCE.md) and `npm run test:balance`.

