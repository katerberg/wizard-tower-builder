---
name: Fire School — Four Spells (Design Sketch)
overview: LOCKED — implement ONLY fire school from this file. See spell_system_index.plan.md for workflow. Tuning numbers deferred to playtest.
todos:
  - id: scope-check
    content: "Confirm IN SCOPE only — no air/water/earth/shop/Mana Well"
    status: completed
  - id: kindled-system
    content: "Kindled status + applyFireDamage hook + patch step detection (fire-only)"
    status: completed
  - id: targeting-extensions
    content: "Enemy click, A→B segment cast UX, trap placement validation (as needed by fire spells)"
    status: completed
  - id: fireball
    content: "Fireball — wire applyFireDamage + Kindled proc"
    status: completed
  - id: immolate
    content: "Immolate — ramping wall burn; ends on knock-off/fly; face transfers OK"
    status: completed
  - id: wall-of-flame
    content: "Wall of Flame — A→B grid line, same-face, enter+tick, wizard FF"
    status: completed
  - id: kindling
    content: "Kindling — adjacent trap, patch 15s, spell cooldown, clear VFX"
    status: completed
  - id: hotbar-fire-kit
    content: "Hotbar lists 4 fire spells for wave-1 playtest (not other schools)"
    status: completed
  - id: tests-fire
    content: "Colocated tests — Kindled proc, Immolate wall rule, Wall segment, Kindling patch"
    status: completed
  - id: verify
    content: "npm test && npm run lint"
    status: completed
isProject: false
---

# Fire School — Four Spells (LOCKED)

**Status:** All feel/behavior questions resolved. Mana, CD, DPS, burst size, wall duration → **playtest tuning only**.

**Prerequisite:** Phase 1 on `main` (mana, Fireball, hotbar, Wand Strike auto in background).

**Workflow:** See [`spell_system_index.plan.md`](./spell_system_index.plan.md). **Implement from this file only.**

---

## IN SCOPE (fire implementation PR)

Build **only** what fire needs:

| Area | Deliver |
| ---- | ------- |
| **Kindled** | Status on enemy; proc on fire damage; refresh on re-step |
| **Fire damage hook** | `applyFireDamage` — normal hit, then flat burst, consume Kindled |
| **Kindling** | Patch entity, placement rules, 15s expiry, spell CD, visible VFX, step → Kindled |
| **Immolate** | Status, wall-only ticks, ramp ~5 cells, ends on knock-off/fly |
| **Wall of Flame** | A→B confirm UX, grid segment ≤5, same-face, timed zone, enter+tick, wizard FF |
| **Fireball** | Route damage through `applyFireDamage` |
| **Hotbar** | All **4 fire spells** equipped for playtest |
| **Targeting** | Extend input/handlers only for modes these spells need |
| **Tests** | Fire + Kindled behavior; no other schools |

---

## OUT OF SCOPE (do NOT build in fire PR)

| Excluded | Why |
| -------- | --- |
| Air / water / earth spells | Separate plans + PRs |
| Air/water/earth statuses | Not designed yet |
| Spell gold shop / unlocks | Phase after schools feel right |
| Mana Well, room mana, Barracks spell synergy | Later |
| Grimoire UI / mid-wave spell shopping | Not in fire plan |
| Backdraft or 5th fire spell | Cut (R2) |
| Wall of Flame LoS | Deferred (WF6) |
| Minion friendly fire | Wizard only until minions exist |
| Fliers as enemies | Stub `canFly` hook OK; no flier templates required |
| Rebalancing turrets / wizard / waves | Unrelated |
| README essay / unrelated refactors | Scope creep |

If shared infra is tempting (generic status framework, grimoire), **keep it minimal** — prefer fire-specific types in `src/model/spells/fire/` until a second school proves reuse.

---

## Agent prompt (copy for one-shot fire)

```
Implement ONLY .cursor/plans/spell_school_fire.plan.md

- IN SCOPE / OUT OF SCOPE sections are binding.
- Read spell_system_index.plan.md for workflow only.
- Do not read or implement spell_school_air.plan.md.
- Run npm test && npm run lint before done.
```

---

## Implementation order

1. Kindled + `applyFireDamage` + tests for proc/refresh/consume  
2. Kindling patch + placement + step application  
3. Fireball → use fire damage hook  
4. Immolate + wall/ramp/knock-off rules + tests  
5. Wall of Flame segment + A→B UX + enter/tick + wizard FF + tests  
6. Hotbar: four fire spells  
7. Lint + playtest pass  

---

**Roadmap after this doc:**

| Order | Plan / PR | School |
| ----- | --------- | ------ |
| **This PR** | Fire (implement + playtest) | Fire |
| **Next PR** | Air school plan + spells | Air |
| **Then** | Water school | Water |
| **Then** | Earth school | Earth |

One school per PR so each can be tuned for feel independently.

---

## Fire school identity

Fire is the **combo school**: mark routes and enemies, control space briefly, **pay off** when something actually burns. **Kindled** is the thread. Rewards **sequencing** (Kindling → Fireball) and **reading paths** (Immolate on wall crawlers; useless on fliers). Not “biggest AoE wins” — **set up, then detonate**.

Other schools will **not** copy Kindled (air / water / earth get their own mechanics).

---

## Shared: Kindled debuff

| Rule | Detail |
| ---- | ------ |
| **Applied by** | Stepping on an active **Kindling** patch |
| **Duration on enemy** | ~15s — **independent of patch** (patch can expire; Kindled stays full duration) |
| **Re-apply while Kindled** | **Refresh** the 15s timer |
| **Initial damage** | **None** |
| **Payoff** | Any **fire damage** → **normal hit first**, then **flat bonus burst**, then **Kindled consumed** |
| **Multi-target** | Each Kindled enemy procs **independently** (e.g. one Fireball, three bursts) |
| **Re-kindle** | Can become Kindled again after proc (new patch or same patch still active) |
| **Fire sources** | Fireball, Immolate ticks, Wall of Flame enter/tick, any future fire spell |

---

## The four spells

| Spell | Job | Targeting | Kindled |
| ----- | --- | --------- | ------- |
| **Fireball** | Hit area **now** | Click grid cell | Procs |
| **Immolate** | Cook one **wall** climber | Click enemy | Ticks proc |
| **Wall of Flame** | Timed **lane** in the air | Click A → preview → B | Enter + tick proc |
| **Kindling** | **Arm** the path | Trap tile adjacent to wall | Applies |

### Why they feel different

| | Fireball | Immolate | Wall of Flame | Kindling |
| --- | --- | --- | --- | --- |
| **Skill** | Aim AoE | Target + path read | Draw line + risk | Place trap |
| **Shape** | Burst | Single ramping DoT | Line zone over time | Zero alone |
| **Best vs** | Clumps | Slow wall crawlers | Fliers, lanes | Pre-arming |
| **Weak vs** | Spread out | Fliers / airborne | Mis-timed / short window | No follow-up fire |
| **Risk** | Miss | Wrong target | **Wizard friendly fire** | Wasted patch / CD |

---

## 1. Fireball

| Rule | Detail |
| ---- | ------ |
| Target | Grid cell in range |
| Effect | Instant small AoE (e.g. 3×3) |
| Kindled | Fire damage then flat burst per marked enemy |
| Room damage | **No** |
| Identity | Always useful **without** setup — other spells are situational because this exists |

*Exists on `main`; add Kindled hook.*

---

## 2. Immolate

| Rule | Detail |
| ---- | ------ |
| Target | Click one enemy |
| On cast | **No upfront damage** — starts burn only |
| Burn ticks | Only while enemy is **on a wall** (any exterior surface: left/right face, ledge, **ground row**) |
| **Face transfer** | Moving left wall → right wall → ledge: **burn continues** |
| **Ends completely** | Knocked **off** the tower surface into air, or **fly** profile — Immolate **removed**, must recast |
| Burn feel | **Ramps** for ~first 5 cells traveled on wall, then **caps** (short cap, tune later) |
| Recast same enemy | **Refresh** duration (and ramp state TBD on refresh — reset ramp or keep) |
| Kindled | Each burn tick = fire damage → proc Kindled |
| vs fliers | Useless — never on wall long enough / airborne |

---

## 3. Wall of Flame

| Rule | Detail |
| ---- | ------ |
| Cast UX | Click **A** → live preview → click **B** confirm (Esc cancel) |
| Segment | **Straight line** through **grid cells** from A to B, max **5** cells |
| Same-face rule | **Yes** — both endpoints on the **same** tower face (no wrapping a corner in one cast) |
| Line of sight | **Ignored for v1** (may add later) |
| Movement | **Damage zone only** — enemies **pass through**, not blocked |
| Damage | **On enter** + **tick while inside** segment |
| Fliers (future) | Hit when flight path **crosses** the segment volume in air |
| Friendly fire | **Wizard now**; **minions later** when they exist |
| Kindled | Enter and tick fire damage proc Kindled |
| Identity | Drawn, timed, anti-flier lane — not a burst |

---

## 4. Kindling

| Rule | Detail |
| ---- | ------ |
| Placement | **Grid cell OR exterior node** — whichever the player clicks, if valid adjacent to tower wall |
| Patch lifetime | **~15s** *(upgrade later: whole wave)* |
| Multiple patches | **Several** can exist (one per cast until they expire) |
| **Spell cooldown** | **Yes** — prevents trap spam (exact CD: playtest) |
| On step | Enemy gains Kindled ~15s (refresh if already Kindled) |
| Patch damage | **None** |
| Visibility | **Clear VFX** on the trap tile — readable for you and fair for learning routes *(not “hidden mine”)*) |
| Payoff | See Kindled rules |

---

## Typical combos

```
Kindling on choke → Kindled climbers → Fireball → triple proc

Kindling → Immolate on brute (long wall ramp) → tick procs Kindled

Wall of Flame on flier lane → tick on Kindled flier → burst

Fireball alone → still fine
```

---

## Implementation hooks (no tuning)

1. `applyFireDamage(enemy, amount, source)` → apply damage, then if Kindled → flat burst, clear Kindled.
2. `KindlingPatch` on cell or exterior node + `expiresAt`.
3. `Immolate` status + `isOnWall(enemy)` + `distanceBurnedOnWall` for ramp cap (~5 cells).
4. `isOnWall` false only when airborne / fly — **not** when changing face on shell.
5. `WallOfFlameSegment` — grid line, same-face validation, `until`, overlap enter/tick.
6. Kindling cast → spell cooldown.

---

## Resolved decisions log

### Kindled (shared)

| ID | Decision |
| -- | -------- |
| F1 | Refresh 15s if already Kindled and steps patch again |
| F2 | Normal fire damage **then** flat burst (two hits) |
| F3 | All Kindled enemies in one Fireball proc independently |
| F4 | Multiple patches allowed; **Kindling spell has cooldown** |

### Fireball

| ID | Decision |
| -- | -------- |
| FB1 | Always useful without setup |

### Immolate

| ID | Decision |
| -- | -------- |
| IM1 | No upfront damage |
| IM2 | Ends on knock-off/fly; **switching walls keeps it** |
| IM3 | All exterior surfaces including ground row |
| IM4 | Ramp ~5 wall cells traveled, then cap |
| IM5 | Recast refreshes duration |

### Wall of Flame

| ID | Decision |
| -- | -------- |
| WF1 | Wizard FF now; minions when they exist |
| WF2 | Damage only — no movement block |
| WF3 | Enter + tick while inside |
| WF4 | Straight **grid** line (can cut through air between wall points) |
| WF5 | Same-face endpoints required |
| WF6 | **No LoS** for v1 |
| WF7 | Fliers hit when path crosses segment volume |
| WF8 | A → preview → B confirm |

### Kindling

| ID | Decision |
| -- | -------- |
| K1 | Grid cell **or** exterior node (player click) |
| K2 | Kindled full 15s even if patch expired |
| K3 | **Clear visible VFX** (not hidden/subtle traps) |

### Kit / roadmap

| ID | Decision |
| -- | -------- |
| R1 | All 4 fire spells available wave 1 for playtest |
| R2 | **No Backdraft** — four spells is the fire kit |
| R3 | Next plan = **Air** PR → then **Water** PR → then **Earth** PR |

---

## File location

| File | Purpose |
| ---- | ------- |
| [`spell_school_fire.plan.md`](./spell_school_fire.plan.md) | **This file** — implement fire |
| [`spell_system_index.plan.md`](./spell_system_index.plan.md) | Workflow + which plan to read |
| [`spell_school_air.plan.md`](./spell_school_air.plan.md) | **Next** — plan air only (not implement yet) |

**Design:** closed. **Implementation:** use IN SCOPE + agent prompt above on branch `cursor/implement-fire-school-cb99` (suggested).
