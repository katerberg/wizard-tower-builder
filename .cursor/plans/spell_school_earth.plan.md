---
name: Earth School — Four Spells (LOCKED)
overview: LOCKED earth school — Charge on wizard, Fault (pass feeds), Fortify (concentration), Boulder (delayed + miss falls), Earthquake (structural cascade). Distinct from fire combo and air displacement. Ready to implement.
todos:
  - id: scope-check
    content: Confirm IN SCOPE only — no water/fire/air redesign; extend school picker only
    status: pending
  - id: charge-meter
    content: Wizard Charge meter on GameState; HUD; wave reset to 0
    status: pending
  - id: fault
    content: Fault patch — ortho-adjacent; Charge per enemy pass; multi-patch + CD; no slow
    status: pending
  - id: fortify
    content: Fortify concentration — 25% damage taken, Charge tick, no casts, pause Wand Strike; auto-break into next cast
    status: pending
  - id: boulder
    content: Boulder — short delay; spend all Charge; miss continues falling at angle and hits next obstacle
    status: pending
  - id: earthquake
    content: Earthquake — pick tip room; support-spine cascade to ground; enemy + room damage; ~3 Quakes to collapse a room
    status: pending
  - id: school-picker
    content: Extend dev school picker fire | air | earth
    status: pending
  - id: tests-earth
    content: Colocated tests — Charge, Fault pass, Fortify, Boulder miss fall, Quake cascade
    status: pending
  - id: verify
    content: npm test && npm run lint
    status: pending
isProject: false
---

# Earth School — Four Spells (LOCKED)

**Status:** Behavior **LOCKED** from planning chat. Mana, CD, Charge rates, boulder delay, exact HP numbers → **playtest tuning** (E13 deferred).

**Prerequisite:** Fire and air on `main`.

**Workflow:** See [`spell_system_index.plan.md`](./spell_system_index.plan.md). **Implement from this file only.**

---

## Identity

| | **Fire** | **Air** | **Earth** |
| --- | --- | --- | --- |
| **Mindset** | Combo burst | Movement control | Big moves + powering up |
| **Thread** | Kindled (enemy) | Discombobulated | **Charge on the wizard** |
| **Payoff** | Mark → fire detonate | Fall / collision | **Spend Charge** on committed moves |
| **Rhythm** | Arm → hit | Knock off → deny | **Invest (Fault/Fortify) → commit (Boulder/Quake)** |
| **Soft spot** | Needs sequence | Soft without displace | **Fliers** (Boulder weak only); slow if empty Charge |

Earth is the **investment school**: Charge lives on **you**. Crack the climb, concentrate into stone, then dump weight into a delayed boulder or a **structural cascade**. Fire detonates marks; air moves bodies. Earth **builds pressure, then cracks the tower it chooses**.

---

## IN SCOPE (earth implementation PR)

| Area | Deliver |
| ---- | ------- |
| **Charge** | Wizard meter; builds from Fault + Fortify; spends on Boulder / Earthquake; reset each wave |
| **Fault** | Trap patch; Charge **per enemy pass**; several patches + CD; no slow |
| **Fortify** | Concentration: take **25% damage**; Charge tick; no cast; pause Wand Strike; next cast auto-breaks then casts |
| **Boulder** | Short delay; spend **all** Charge; on miss, rock keeps falling at an angle and crashes into whatever it hits |
| **Earthquake** | Click tip room; support-spine cascade to ground; enemies along path take damage (tip heavier); rooms take substantial HP (~3 Quakes to collapse); dump all Charge |
| **School picker** | Dev toggle fire \| air \| **earth** |
| **Hotbar** | 4 earth spells when earth selected |
| **Tests** | Earth-only colocated tests |

---

## OUT OF SCOPE

| Excluded | Why |
| -------- | --- |
| Water school | Separate plan |
| Rebalancing fire/air | Unrelated |
| Spell shop / unlocks | Later |
| Exact Charge max / DPS numbers | Playtest (E13) |
| 5th earth spell | Kit is four |

---

## Agent prompt

```
Implement ONLY .cursor/plans/spell_school_earth.plan.md

- IN SCOPE / OUT OF SCOPE are binding.
- Read spell_system_index.plan.md for workflow only.
- Do not redesign fire/air.
- Run npm test && npm run lint before done.
```

---

## Implementation order

1. Charge meter + wave reset + HUD when earth school active  
2. Fault (pass detection + multi-patch CD)  
3. Fortify (25% damage taken, pause Wand Strike, auto-break into cast)  
4. Boulder (delay + spend-all + miss fall continuation)  
5. Earthquake (support cascade + room/enemy damage + collapse)  
6. School picker + hotbar earth kit  
7. Tests + lint  

---

## Charge (wizard meter)

| Rule | Locked |
| ---- | ------ |
| Location | Wizard / run — HUD meter |
| Build | **Fault** (per pass) + **Fortify** (while concentrating) |
| Spend | **Boulder** dumps **all**; **Earthquake** dumps **all** |
| Wave start | Charge → **0** (E14) |
| Cap | Tunable later (E13 deferred — pick a placeholder e.g. 5 in code) |

---

## 1. Fault

| Rule | Locked |
| ---- | ------ |
| Placement | Empty cell **ortho-adjacent to a room** (E2:A) |
| Slow | **None** — pure Charge feeder (E1:A) |
| Feed | Enemy finishes a step **onto / across** Fault → **+Charge** (once per pass) |
| Re-pass | Same enemy stepping on again after leaving → Charge again |
| Patches | **Several** allowed; spell has CD (E3:A) |
| Damage | None |
| Fliers | Don't walk shell → don't feed Fault |

---

## 2. Fortify

| Rule | Locked |
| ---- | ------ |
| Enter | Cast Fortify → Fortified |
| While held | Take **25% incoming damage** (not immune); **cannot cast**; Charge ticks; **Wand Strike paused** (E5:A) |
| Exit / go | Next spend cast **auto-breaks Fortify then casts** (E4:A). Esc can cancel Fortify without casting |
| Ends also | Wave end |

---

## 3. Boulder

| Rule | Locked |
| ---- | ------ |
| Target | Click grid cell (aimed impact) |
| Timing | **Short delay** (~0.4–0.6s) then impact (E7:A) |
| Charge | Spend **all** Charge; damage scales with amount spent (E6:B) |
| Hit | Small AoE / cell impact; soft vs fliers if still in volume |
| **Miss** | If nothing at the aimed cell at impact time, the boulder **continues falling at an angle from above** and **crashes into the next thing it hits** (room / enemy / ground). Charge already spent |
| Identity | Mid commit; only weak anti-flier tooth |

**Miss physics (sketch):** spawn projectile above / arcing toward target; on empty impact, keep velocity downward-diagonal until collision with room footprint, enemy, or ground row — then deal crash damage there.

---

## 4. Earthquake

| Rule | Locked |
| ---- | ------ |
| Target | Click a **tip room** |
| Path | **Support spine**: rooms connecting tip **down to ground** along supported adjacency; branches off-path **untouched** (E8:A) |
| Enemies | **Any enemy along that path** takes damage; **tip segment heavier** (E9:A) |
| Rooms | Substantial HP damage on cascade rooms — **about 3 Earthquakes to collapse a full-HP room** (E10 / E9) |
| Destroy | Rooms **can** hit 0 HP and collapse / be removed (E11:A) — handle tower validity after |
| Charge | Always dump **all** Charge (E12:A); require Charge > 0 to cast |
| Fliers | Miss (off shell) |

### Collapse note

After room destruction, reuse existing tower validity / path refresh rules so climbers repath. Quake is a real tower-risk weapon.

---

## Typical sequences

```
Fault on choke → passes feed Charge
Fortify → Charge races (mitigated hits at 25%)
Break into Boulder (dump Charge) → delayed hit / miss-fall crash
OR
Fault + Fortify → Earthquake on choke spine → path climbers die; rooms chip (~⅓ HP each)
Spare wing of tower still stands
```

---

## Resolved decisions log

| ID | Decision |
| -- | -------- |
| E1 | Fault = pure Charge feeder, no slow |
| E2 | Ortho-adjacent empty cell |
| E3 | Multiple Fault patches + spell CD |
| E4 | Auto-break Fortify into next cast |
| E5 | Fortify pauses Wand Strike |
| E5b | Fortify is **not** immune — incoming damage × **0.25** |
| E6 | Boulder spends **all** Charge |
| E7 | Short delay; **miss → continues falling at angle until crash** |
| E8 | Support-spine cascade tip → ground |
| E9 | Enemies anywhere on path damaged; tip heavier; rooms less than units but substantial |
| E10 | ~3 Quakes to collapse a room |
| E11 | Rooms can be destroyed (HP → 0) |
| E12 | Quake dumps all Charge |
| E13 | Exact Charge max deferred — placeholder OK |
| E14 | Charge → 0 each wave |

---

## Dev / hotbar

School picker: fire | air | **earth**. Four earth spells when earth selected.

---

## File

`.cursor/plans/spell_school_earth.plan.md` — branch `cursor/earth-school-spell-plan-cb99`

**Design: LOCKED.** Next: implement on `cursor/implement-earth-school-cb99`.
