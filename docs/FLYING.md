# Flying enemies

Design + implementation notes for air-lane attackers that bypass wall-hugging defenses, pressure tall towers, and force coverage away from the shell.

**Status:** Implemented (striker / kamikaze / carrier + open-air Wall of Flame). Numbers (height bands, speeds, budgets) remain flexible for playtest.

**Working names** (striker, kamikaze, carrier, carrierKamikaze) are placeholders.

---

## Goals

Fliers should simultaneously:

1. **Bypass** shell defenses (spikes; wall-hugging fire unless the lane is flamed).
2. Stay **defeatable** by existing ranged tools (turrets, slots, wand) if the tower is wide enough that air lanes pass through range.
3. Fly **a few macro cells off** the tower so they read as air threats, not “crawlers one cell out.”
4. Escalate with the run via **higher spawn bands** in later waves (tease early, punish late).

**Success (v1 family):** players feel air pressure from the sides, learn to cover altitude with turrets/slots/spells, and late waves introduce carrier → kamikaze micro-management.

---

## Design principle (world danger)

> As the tower grows taller, the world gets more dangerous.

Higher waves use higher absolute spawn bands for fliers. Exact height-danger curves (more templates, weather, etc.) are a **separate plan**; this doc only requires escalating flier spawn altitudes and a short README note.

---

## Size tiers rename

Rename `EnemySizeTier` for clarity (no mental mapping):

| Old | New |
|-----|-----|
| `swarm` | `small` |
| `elite` | `medium` |
| `boss` | `large` |

Apply everywhere (templates, renderer radii, tests).

**Speed rule (all enemies):** larger tiers move slower. Retune existing crawler speeds to match (small fastest → large slowest). First melee flier is **small** at about **1.3×** a typical small crawler baseline (placeholder; pick concrete constants in implementation).

---

## Shared movement rules

### Grid

- Same **sub-cell grid** as crawlers.
- **Crawlers:** surface shell only (unchanged).
- **Fliers (`canFly: true`):** open-air cells only — empty cells that are **not** solid rooms and **not** orthogonally adjacent to a solid room face they would “touch.”
- **Never path through** non-destroyed rooms.
- **Destroyed rooms** become flyable air (holes through the mass).
- Fliers and crawlers share normal enemy stacking / live-enemy rules (`MAX_LIVE_ENEMIES`); no separate air occupancy layer.

### Standoff

- Prefer lanes **1–3 macro cells** off the tower silhouette.
- When routing around geometry they may go closer, but **must never enter a cell that touches a room wall** (no shell contact).
- Visuals/glyphs must read clearly as flying (not a parallel climb).

### Pathfinding

- **A\*** through open air toward the wizard’s current effective position.
- Solids block; path **around** the footprint.
- **Always repath** when the wizard moves (e.g. Flight). “Committed” means they do **not** retreat or circle — they keep pressing the goal.
- If **no path** exists (air fully boxed): move to / stay at the nearest approach and **attack the closest blocking room** with normal melee attack rules (same strength/cooldown as wizard contact). This is the first intentional **enemy → room HP** damage path; laborers already repair room HP.

### Spawn

- From **open air at the sides of the screen** (left/right alternate, same as ground spawns).
- Aim for a spawn that supports a **direct angled line** toward the wizard; if needed, clamp to **1–3 macro cells** off the tower at the band height.
- **Fixed absolute macro-row bands** per wave (not % of tower height). Bands rise as waves progress.

Example placeholders (tune later):

| Wave (0-based) | Spawn row band (macro) |
|----------------|------------------------|
| Early tease | e.g. 8–15 |
| Mid | e.g. 15–30 |
| Late | e.g. 80–90 |

- If the tower/wizard is **below** the band (short tower), **still spawn in the high band** and fly down — do not clamp to wizard height.
- Prefer not diving from above the screen unless the tower is exceptionally short; side entry at band height is the default.

### Combat (melee fliers)

- Enter the wizard’s space (same macro-cell contact as crawlers) and melee.
- Damage **wizard only** on normal contact (room damage only in the blocked-path case above).
- **Ranged fliers** are future; not in this plan’s templates.

### Lifecycle

- Mix into the same wave as crawlers.
- **Separate flier budget** in wave generation (does not steal crawler fodder counts).
- Wave clears when **both** crawler and flier queues are empty and no live enemies remain.
- No separate live-flier cap.

---

## Enemy family (all in this plan)

### 1. Melee flier (first / early tease)

| Field | Intent |
|-------|--------|
| Size | `small` |
| Role | Fast bypass fighter |
| Speed | ~1.3× small crawler baseline |
| HP | Lower than comparable crawlers |
| Gold | Higher than comparable crawlers |
| Movement | `fly` / `canFly: true` |
| Attack | Melee on wizard contact |

Early waves: rare tease (placeholder count 1–2). Later: small packs from the flier budget.

### 2. Kamikaze flier

| Field | Intent |
|-------|--------|
| Size | `small` |
| Role | Burst contact threat |
| Attack | On wizard (or valid target) **contact**: deal damage, then **remove** self |
| Pathing | Same air A\* rules |

Standalone kamikazes use full air pathing with **no** 3-cell lifetime cap.

### 3. Carrier flier (late / high level)

Starcraft-carrier fantasy: a tougher flier that **hovers in a range band** off the tower and launches weaker micro-fliers.

| Field | Intent |
|-------|--------|
| Size | `medium` or `large` (placeholder) |
| Role | Force manual focus (carrier and/or launches) |
| Movement | Flier; holds in a band a few cells off the tower |
| Launch | Spawns **carrier-kamikazes** toward the wizard |
| Carrier-kamikaze | Smaller/weaker than standalone kamikaze; air A\*; **die after 3 macro cells moved** regardless of reaching the wizard |

Killing either the carrier or the swarms should feel viable; player must respond somehow (not ignore).

---

## Defense interactions

| System | Flier behavior |
|--------|----------------|
| **Spikes** | Miss (no shell step) |
| **Immolate** | Only if the flier’s cell is on fire / wall-burn rules already treat `canFly`; no forced landing |
| **Wall of Flame** | Damages fliers **only if they occupy a flamed cell**. **Must be placeable in open air** (see below) so players can cut lanes |
| **Steam turret** | Side-face cones; fliers often miss them when off-path. No smart evasion — if the path clips the cone, they take it |
| **Magic turret / slots** | Hit normally if in range |
| **Wand Strike** | Hits if in perch range |
| **Gust** | Push **away from the gust center-point** (may be toward or away from the tower). May leave the viewport; **stay in play**, clamp/extend air grid as needed, then repath back |
| **Air knock-off / forced landing** | No forced landing for intentional fliers; they remain air units but **are** affected by pushes |
| **Future AA rooms** | Out of scope; existing ranged + spells are enough for this plan |

### Wall of Flame — open air (required in this plan)

Today WoF requires same exterior **face** endpoints (`sameFaceEndpoints` in cast validation). Change:

- Allow segments in **open-air macro cells** (not only on a tower face).
- Keep length / mana / damage rules unless playtest demands retune.
- Face metadata may become optional or `'air'` for air segments.
- Fliers burn only when their position intersects segment cells (no extra air thickness).

---

## Presentation

- Distinct **glyph + color** for each flier template (and carrier launches).
- Motion/readability should not look like shell climbing.
- Optional path debug/overlay: **attack phase only** (not build).
- No v1 audio/VFX requirements.

---

## Wave integration (placeholders)

- Add a `flier` (or per-template) budget beside existing crawler budgets in `waves.ts`.
- Tease: early wave index TBD — start with a tiny count on an early mid wave.
- Ramp count and raise spawn bands through levels 0–9.
- Carrier (+ launches) only in late levels.
- Exact numbers left to implementation/playtest.

---

## Implementation slices

### Slice A — Foundation

- Rename size tiers `small` / `medium` / `large`
- Apply size→speed retune across existing templates
- Air walkability: open air, never touching rooms; destroyed rooms flyable
- Air A\*, repath-to-wizard, side spawn at height bands
- Workers/enemies layer rendering distinction for fliers
- README world-danger note

### Slice B — Melee flier

- First `fly` template + separate budget + early tease
- Wizard contact melee
- Blocked-path → attack closest blocking room (room HP)
- Logistics/debug: attack-phase path viz OK
- Defense gates: spikes miss; turrets/slots/wand work

### Slice C — Wall of Flame air lanes

- Allow open-air WoF placement
- Verify flier intersection damage
- Tests for air segment cast + flier tick

### Slice D — Kamikaze + carrier

- Standalone kamikaze (contact → damage → remove)
- Carrier hover band + launch cadence
- Carrier-kamikaze: weaker, **3 macro-cell lifetime**
- Late-wave budget hooks
- Gust push-from-center works on all flier kinds (incl. off-viewport return)

---

## Mapping onto existing code

| Area | Current | Plan |
|------|---------|------|
| `MovementProfile` | `fly` / `canFly` stubbed | Assign to flier templates; drive air graph |
| `exteriorGraph.isWalkable` | Rejects open air | Branch: air legal iff `canFly` and not room-adjacent |
| `findPath` | Surface shell A\* | Air A\* for fliers (shared API, profile-gated neighbors) |
| `spawnEnemy` | Ground edge row 0 | Flier spawn: side + band row |
| `waves.ts` | Crawler budgets only | + separate flier budget |
| `EnemySizeTier` | swarm/elite/boss | small/medium/large |
| Speeds | Ad hoc per template | Size ladder + flier 1.3× small baseline |
| Room HP | Laborer repair only | Fliers can damage rooms when air-blocked |
| `wallOfFlame` / cast | Face-locked segments | Open-air segments allowed |
| `gust` push | Away from tower center | Away from **gust center-point** for fliers (crawlers may keep current rules or unify — prefer gust-center for fliers at minimum) |
| Spikes / Immolate | Shell / `canFly` hooks | Spikes skip fliers; fire only on cell overlap |

---

## Out of scope

- Full “world danger” system beyond README note + rising spawn bands
- Ranged hovering fliers (noted as future)
- Smart steam/cone evasion
- Dedicated AA rooms
- Attack-overhang / face-transfer crawler modes
- Diving from top of screen as the default spawn
- Pathing through intact rooms

---

## Open tuning knobs

1. Exact spawn band table per `levelIndex`
2. Tease wave index and counts
3. Melee flier HP / gold / strength
4. Carrier size tier, HP, launch interval, launches-in-flight cap
5. Carrier-kamikaze damage vs 3-cell leash feel
6. How strictly “never touch wall” is encoded (orthogonally adjacent to any room cell = illegal)
7. Whether crawler Gust push also switches to gust-center (fliers must; crawlers optional consistency pass)

