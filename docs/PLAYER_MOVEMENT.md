# Player movement + solar collector

**Status:** Implemented.

The wizard is a mobile **firefighter** (Factorio-style repair bot): they click-to-path through the tower interior to cast at close range and clean up breaches. Enemies no longer hunt the wizard — they attack the **solar collector** on the crown perch.

---

## Fantasy

- Wizard: rush stairs/elevators, reposition for spell range, help control local fights.
- Collector: crown aggro magnet (old wizard HP pool). When it breaks, enemies RAID; lose only if every Storage Room falls.
- Flight: temporary open-air mobility; fall back to standable interior/ground with no fall damage.

---

## Wizard avatar

| Rule      | Detail                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| Identity  | Distinct hero (`WizardAvatar`), **not** a `StaffUnit`                                                          |
| Phase     | Attack only; snap to crown perch on Start Wave                                                                 |
| Controls  | Click-to-path (no spell selected). Spell selected → cast. New click replaces path. Cast while pathing allowed. |
| Grid      | Pathfind on **macro** interior graph; step on **sub-cells**                                                    |
| Speed     | 2× staff: horizontal `4`, stairs `0.8`; elevators use shared car speed                                         |
| Walkable  | Passable rooms, bare framing, **ground row 0** (even empty), crown **collector perch**, stairs/elevators       |
| Vertical  | Stairs or elevators (or Flight). Free step only between top framing ↔ perch deck.                              |
| Mines     | Out of scope                                                                                                   |
| Stairs    | Squeeze past staff (no one-per-cell lock)                                                                      |
| Elevators | Counts as **1** passenger toward capacity 6                                                                    |
| Collapse  | Support cleared → fall until standable; no HP damage                                                           |
| Camera    | Manual wheel only (no follow in v1)                                                                            |
| Glyph     | Same `@` wizard glyph at avatar pos                                                                            |

---

## Solar collector

| Rule          | Detail                                                                    |
| ------------- | ------------------------------------------------------------------------- |
| Position      | `getWizardPosition(tower)` crown perch                                    |
| HP            | Seeded from former wizard max HP (30); **persists across waves** in a run |
| Enemy goal    | Crawlers and fliers A\* to collector; repath when perch macro key changes |
| Contact       | Melee damages collector (Fortify mitigates)                               |
| Friendly fire | Spells that hit the perch damage the **collector**, not the wizard        |
| Break         | `solarCollector.hp <= 0` despawns collector and starts **RAID** (no instant lose) |
| Dawn restore  | Collector returns to max HP; next night harvest deposits at 50% (repair tax) |
| Lose          | Every `storageRoom` destroyed                                             |

---

## RAID mode

When the collector breaks mid-night:

1. Combat log announces RAID; HUD shows a pulsing **RAID** banner instead of Collector HP.
2. Enemies immediately clear paths and retarget:
   - Last room that damaged them within 4 macro rows, else
   - Nearest economy room (`storageRoom`, `manaSpringRoom`, `boilerRoom`, `forgeRoom`, `pumpRoom`) within 4 rows, else
   - Random exterior framing cell (fliers may smash framing in this phase).
3. Storage melee also steals stone then metal from that site.
4. Fortify is disabled until the collector is restored at dawn.

## Flight

| Rule         | Detail                                            |
| ------------ | ------------------------------------------------- |
| Spell        | Existing Flight (mana/CD/duration unchanged)      |
| While active | Click-to-path on flier air graph                  |
| End          | Fall to standable interior/ground; no fall damage |

---

## Casting

All spell ranges and Wand Strike measure from the wizard’s **current avatar position** (including while flying).

---

## Out of scope

Exterior crawl for the wizard; permanent flight unlock; camera follow; build-phase movement; elevator priority; mine navigation; WASD.

---

## Code entry points

| Concern               | Path                                                      |
| --------------------- | --------------------------------------------------------- |
| Types                 | `src/model/types.ts` (`WizardAvatar`, `SolarCollector`)   |
| Movement              | `src/model/wizard/`                                       |
| Walk graph            | `src/calculations/wizardGraph.ts`, `wizardPathfinding.ts` |
| Speeds / passenger id | `src/config/wizard.ts`                                    |
| Enemy combat          | `src/model/enemies/flierCombat.ts` (`attackCollector`)    |
| Tick                  | `src/model/tick.ts`                                       |
| Input                 | `moveWizard` intent + `src/view/input.ts`                 |
