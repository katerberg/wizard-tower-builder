---
name: Air School — Four Spells (LOCKED)
overview: LOCKED — implement ONLY air school from this file. See spell_system_index.plan.md for workflow. Tuning numbers deferred to playtest. Dev mode school picker (fire vs air) in scope.
todos:
  - id: scope-check
    content: Confirm IN SCOPE only — no water/earth/shop/Mana Well; no fire spell changes
    status: completed
  - id: discombobulated-system
    content: Discombobulated status + attachment-double-move + apply on detach/collision sources
    status: completed
  - id: fall-collision-damage
    content: Fall damage + wall collision damage hooks (air payoff, separate from fire)
    status: completed
  - id: targeting-extensions
    content: Gust push grid, Tornado A→B 2-high air segment, Flight self-buff, Blizzard zone
    status: completed
  - id: gust
    content: Gust — center + orthogonal push away-from-tower or down
    status: completed
  - id: tornado
    content: Tornado — 2-high blocking lane, random eject (8-dir), collision + wizard FF
    status: completed
  - id: flight
    content: Flight — wizard levitate, cast while airborne, land on standable cell
    status: completed
  - id: blizzard
    content: Blizzard — large fixed zone, slow + light wind chip damage
    status: completed
  - id: dev-school-picker
    content: Dev mode toggle to equip fire kit vs air kit on hotbar
    status: completed
  - id: hotbar-air-kit
    content: Hotbar lists 4 air spells when air school selected (wave 1 playtest)
    status: completed
  - id: tests-air
    content: Colocated tests — Discombobulated double-move, Gust push, Tornado block/eject, Flight land
    status: completed
  - id: verify
    content: npm test && npm run lint
    status: completed
isProject: false
---

# Air School — Four Spells (LOCKED)

**Status:** Behavior locked from planning chat. Mana, CD, fall/collision numbers, zone duration/radius → **playtest tuning only**.

**Prerequisite:** Fire school implemented (`spell_school_fire.plan.md` merged).

**Workflow:** See [`spell_system_index.plan.md`](./spell_system_index.plan.md). **Implement from this file only.**

---

## IN SCOPE (air implementation PR)

Build **only** what air needs:

| Area                    | Deliver                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Discombobulated**     | Permanent per-enemy status; attachment transitions require **two successful moves**                                                   |
| **Air damage / payoff** | `applyWindDamage` (low chip) + **fall damage** + **collision damage** — separate from fire/Kindled                                    |
| **Gust**                | Instant center + orthogonal push; detach climbers; apply Discombobulated on rip-off                                                   |
| **Tornado**             | A→B segment in air; each cell **2-high** from anchor row; **blocks** passage; enter → random 8-dir eject; collision damage; wizard FF |
| **Flight**              | Self levitate; **can cast** other spells; on end, **float down** to nearest standable cell                                            |
| **Blizzard**            | Fixed large radius + fixed duration zone; **slow** + light wind tick damage                                                           |
| **Dev school picker**   | Dev mode UI to swap hotbar kit **fire** ↔ **air** (no shop/unlocks)                                                                   |
| **Hotbar**              | All **4 air spells** when air school selected (wave 1 playtest)                                                                       |
| **Targeting**           | Extend input/handlers only for modes these spells need                                                                                |
| **Tests**               | Air + Discombobulated behavior; no other schools                                                                                      |

---

## OUT OF SCOPE (do NOT build in air PR)

| Excluded                               | Why                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| Water / earth spells                   | Separate plans + PRs                                                                    |
| Fire spells / Kindled changes          | Fire is its own PR; air does not rebalance fire                                         |
| Spell gold shop / unlock progression   | After schools feel right                                                                |
| Mana Well, room mana, Barracks synergy | Later                                                                                   |
| Grimoire UI                            | Not in air plan                                                                         |
| Fifth air spell                        | Four spells is the kit                                                                  |
| Environmental Discombobulated sources  | **Hook only** — status API must allow non-spell apply; no new room types required in v1 |
| Rebalancing turrets / wizard / waves   | Unrelated                                                                               |
| README essay / unrelated refactors     | Scope creep                                                                             |

Keep infra minimal — prefer air-specific types in `src/model/spells/air/` until a third school proves reuse.

---

## Agent prompt (copy for one-shot air)

```
Implement ONLY .cursor/plans/spell_school_air.plan.md

- IN SCOPE / OUT OF SCOPE sections are binding.
- Read spell_system_index.plan.md for workflow only.
- Do not implement water/earth or fire changes.
- Run npm test && npm run lint before done.
```

---

## Implementation order

1. Discombobulated + attachment double-move interception + tests
2. Fall damage + collision damage hooks + tests
3. Gust (push + detach + apply status)
4. Tornado (2-high segment, block, eject, collision) + A→B UX
5. Blizzard (zone slow + wind chip)
6. Flight (wizard levitate + descend-to-standable)
7. Dev school picker + hotbar air kit
8. Lint + playtest pass

---

## Air school identity

Air is the **displacement school**: knock climbers off the shell, deny lanes, and punish **falls, collisions, and bad re-attachment** — not combo detonation. Fire marks and burns on the wall; air **breaks contact** with the tower and makes recovery clumsy.

|                    | Fire                                | Air                                                                  |
| ------------------ | ----------------------------------- | -------------------------------------------------------------------- |
| **Core verb**      | Burn / detonate                     | Knock off / block / collide                                          |
| **Thread**         | Kindled (timed, consumed on payoff) | Discombobulated (permanent, attachment tax)                          |
| **Damage profile** | Direct spell damage + burst         | **Low spell damage**; payoff = fall + collision + positional lockout |
| **Best vs**        | Wall crawlers on predictable paths  | Chokes, grouped climbers, critical cells                             |
| **Weak vs**        | Spread out, already airborne        | Enemies already at the perch, trivial waves                          |

---

## Shared: Discombobulated

Confusion from being tossed around. The thread that ties air spells together (like Kindled for fire), but **different rules** — not a timed mark that detonates.

| Rule               | Detail                                                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**           | **Discombobulated** (display copy can change)                                                                                                                                                                                             |
| **Duration**       | **Permanent for that enemy** until death — does not expire, is not consumed                                                                                                                                                               |
| **Applied by**     | Primary: **ripped off the wall** (Gust detach, Tornado eject, hard knock-off). **Also:** any future source via shared `applyDiscombobulated(enemy)` hook (environmental traps, rooms, other schools later)                                |
| **Effect**         | Changing attachment is **harder**: grabbing a wall, or moving **wall ↔ ceiling** (any exterior surface transition), requires that move to **succeed twice** before it counts — first attempt is wasted/stubbed, second completes normally |
| **Initial damage** | **None** from the status itself                                                                                                                                                                                                           |
| **Stacking**       | Binary on/off — re-apply while already Discombobulated is a no-op                                                                                                                                                                         |
| **Must NOT**       | Copy Kindled (timed, fire payoff, consumed on proc)                                                                                                                                                                                       |

### Implementation note (attachment double-move)

Intercept enemy **step resolution** when Discombobulated and the step would:

- attach to a new wall face from open air, or
- change surface class (e.g. left wall → right wall counts as move; **wall ↔ underCeiling / ledge** counts as attachment transition per plan intent)

First qualifying step in a chain: **no position change** (or step consumed with no progress). Second: normal movement.

Exact edge cases (corner wrap, ground row) → tune in playtest; default: **any step that changes `surfaceContacts` set** while Discombobulated consumes one “stub” first.

---

## The four spells

| Spell        | Job                              | Targeting                | Discombobulated                                                            |
| ------------ | -------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| **Gust**     | Instant shove + detach           | Click grid/exterior cell | On rip-off                                                                 |
| **Tornado**  | Violent 2-high **blocking** lane | Click A → preview → B    | On eject / knock-off                                                       |
| **Flight**   | Wizard levitate                  | Self (no target)         | —                                                                          |
| **Blizzard** | Large slow field + light chip    | Click center cell        | Optional future: apply on long exposure (v1: **no** — only detach sources) |

### Why they feel different

|                      | Gust                   | Tornado                              | Flight                | Blizzard                  |
| -------------------- | ---------------------- | ------------------------------------ | --------------------- | ------------------------- |
| **Skill**            | Aim + timing           | Draw lane in air                     | Panic / reposition    | Zone control              |
| **Shape**            | Center + 4 orthogonal  | Segment, **2 cells tall** per column | Self                  | Large circle              |
| **Duration**         | Instant                | Timed zone (~playtest)               | Timed buff on wizard  | Fixed duration zone       |
| **Blocks movement?** | No                     | **Yes** — hard block                 | N/A                   | No — **slow only**        |
| **Direct damage**    | Low / none             | Small tick + **collision**           | None                  | Low wind tick             |
| **Payoff**           | Fall + Discombobulated | Eject + collision + block            | Time to cast / escape | Slow into other air tools |
| **Wizard risk**      | Low                    | **Yes** — FF on enter/collision      | Land wrong cell       | Low                       |

---

## 1. Gust

| Rule            | Detail                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Target          | Click one cell in range                                                                                                                        |
| Affected cells  | **Clicked cell + four orthogonally adjacent cells**                                                                                            |
| Push direction  | **Away from tower center** (horizontal component dominant). If no valid “away” (e.g. **between two walls** / symmetric), push **down** instead |
| Climbers        | Lose wall attachment; become airborne / falling per movement rules                                                                             |
| Discombobulated | Apply on **rip-off**                                                                                                                           |
| Direct damage   | Minimal — payoff is fall + collision + permanent attachment tax                                                                                |
| Identity        | Surgical “get off that cell”                                                                                                                   |

---

## 2. Tornado

| Rule            | Detail                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Cast UX         | Click **A** → live preview → click **B** confirm (Esc cancel) — same flow as Wall of Flame                    |
| Segment         | Straight grid line A→B, max **5** cells (tune); **does not need to touch the tower** — valid in open air      |
| Height          | Each segment cell is **2 tall**: anchor row **and row above** (always starts at clicked spot + applies above) |
| Movement        | **Hard block** — enemies cannot pass through occupied tornado volume                                          |
| On enter        | **Random eject** in **8 directions** (4 cardinal + 4 diagonal)                                                |
| Collision       | If eject slams into wall/room → **collision damage**; if open air → fall                                      |
| Tick damage     | Small wind damage while inside (secondary to collision/fall)                                                  |
| Discombobulated | On eject / knock-off                                                                                          |
| Friendly fire   | **Wizard yes** — entering tornado affects wizard (eject and/or damage per playtest)                           |
| Identity        | Small violent lane — denial + chaos                                                                           |

---

## 3. Flight

| Rule          | Detail                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Target        | Self-cast                                                                                                      |
| Effect        | Wizard **levitates** off perch for fixed duration                                                              |
| Casting       | **May cast other spells** while Flight is active                                                               |
| Immunity      | **No** special immunity to own air zones                                                                       |
| End of Flight | Wizard **floats downward** until reaching a **standable** exterior cell (existing walkability / surface rules) |
| Identity      | Buy time to place Tornado/Blizzard or escape perch pressure                                                    |

---

## 4. Blizzard

| Rule           | Detail                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| Target         | Click center cell in range                                                            |
| Shape          | **Fixed large radius** (e.g. 2–3 cells from center — tune once)                       |
| Duration       | **Fixed** zone lifetime (no player tradeoff)                                          |
| Slow           | **2× move cooldown** while inside zone (enemy `moveCooldown` scaled on step attempts) |
| Damage         | Light **wind** tick — uses air damage path, **not** fire, **not** Kindled             |
| Movement block | **No** — permeable, miserable                                                         |
| Identity       | Approach debuff — sets up Gust/Tornado                                                |

---

## Typical combos

```
Blizzard on approach → slow cluster → Tornado on choke → eject + collision
Gust on fast climber at critical cell → rip off → fall damage → Discombobulated forever
Flight up → lay Tornado/Blizzard → descend when clear
Discombobulated enemy tries to re-climb → double-move tax → wastes time in Blizzard
```

Fire combo: _mark → burn → burst._  
Air combo: _slow / block → detach → fall/collision → permanent clumsy re-climb._

---

## Dev mode: school picker

Until grimoire exists, **dev mode** exposes which kit is on the hotbar:

| School   | Hotbar spells                             |
| -------- | ----------------------------------------- |
| **Fire** | fireball, immolate, wallOfFlame, kindling |
| **Air**  | gust, tornado, flight, blizzard           |

- Toggle in dev HUD (e.g. Fire / Air buttons)
- Wand Strike stays background auto-cast for both
- No gold cost, no unlocks — playtest only

---

## Implementation hooks (no tuning)

1. `applyDiscombobulated(enemy)` — permanent flag; callable from spells and future sources
2. `interceptDiscombobulatedStep(enemy, proposedStep)` — attachment double-move
3. `computePushAwayFromTower(cell)` — away vector; **down** fallback when symmetric
4. `detachFromWall(enemy)` — airborne + apply Discombobulated
5. `applyFallDamage` / `applyCollisionDamage` — separate from `applyFireDamage`
6. `applyWindDamage` — light chip for Blizzard/Tornado ticks
7. `TornadoSegment` — cells × 2 rows, `expiresAt`, block + eject on enter
8. `BlizzardZone` — center, radius, `expiresAt`, slow multiplier
9. `FlightState` on wizard — until, descend-to-standable on end
10. `activeSpellSchool` (dev) → `HOTBAR_SPELL_IDS` per school

---

## Resolved decisions log

### Discombobulated (shared)

| ID  | Decision                                                                                 |
| --- | ---------------------------------------------------------------------------------------- |
| D1  | Permanent until enemy death — not consumed                                               |
| D2  | Attachment transitions (grab wall, wall↔ceiling) require **two successful moves**        |
| D3  | Applied on rip-off; **hook** for other sources later (environmental OK, not required v1) |
| D4  | Not Kindled — no fire synergy                                                            |

### Gust

| ID  | Decision                                                            |
| --- | ------------------------------------------------------------------- |
| G4  | Center + **orthogonal** neighbors affected                          |
| G5  | Push **away from tower**; if no away (between walls), push **down** |

### Tornado

| ID  | Decision                                                                                    |
| --- | ------------------------------------------------------------------------------------------- |
| T6  | Random eject includes **diagonals** (8 directions)                                          |
| T7  | **Not** required on tower; segment in air; each point is **2-high** from clicked row upward |
| T8  | **Wizard friendly fire** yes                                                                |

### Flight

| ID  | Decision                               |
| --- | -------------------------------------- |
| F9  | No immunity to own air zones           |
| F10 | **Can cast** other spells while flying |
| F11 | Descend until **standable** cell found |

### Blizzard

| ID  | Decision                                      |
| --- | --------------------------------------------- |
| B12 | **Fixed** duration and **fixed** large radius |
| B13 | Slow = **2× move cooldown** while in zone     |
| B14 | Wind damage path — **separate from fire**     |

### Kit / economy

| ID  | Decision                                                                                            |
| --- | --------------------------------------------------------------------------------------------------- |
| K15 | All **4 air spells** on hotbar wave 1 when air school selected                                      |
| K16 | Air spells do **little direct damage**; punishment = **fall + collision + Discombobulated** control |

---

## File location

| File                                                         | Purpose                       |
| ------------------------------------------------------------ | ----------------------------- |
| [`spell_school_air.plan.md`](./spell_school_air.plan.md)     | **This file** — implement air |
| [`spell_system_index.plan.md`](./spell_system_index.plan.md) | Workflow + which plan to read |
| [`spell_school_fire.plan.md`](./spell_school_fire.plan.md)   | Fire (already implemented)    |

**Design:** locked. **Implementation:** branch `cursor/implement-air-school-cb99` (suggested).
