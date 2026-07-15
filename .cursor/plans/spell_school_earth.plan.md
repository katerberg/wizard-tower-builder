---
name: Earth School — Planning (NOT LOCKED)
overview: Draft identity for the earth school — big moves and powering up. Distinct from fire (combo burst) and air (displacement). Four spell sketches + shared Charge thread. Do NOT implement until status is LOCKED.
todos:
  - id: earth-identity
    content: Lock one-paragraph earth identity + contrast table vs fire/air
    status: pending
  - id: earth-thread
    content: Lock Charge (or renamed) shared mechanic — how it builds and spends
    status: pending
  - id: earth-spells-draft
    content: Lock 4 spells with distinctness table
    status: pending
  - id: earth-open-questions
    content: Resolve open behavior questions in chat (E1–E…)
    status: pending
  - id: earth-lock
    content: Mark plan LOCKED; add IN SCOPE / OUT OF SCOPE; ready for implement PR
    status: pending
isProject: false
---

# Earth School — Planning Draft

**Status:** ⏳ **NOT LOCKED** — design only. Do not implement from this doc yet.

**Prerequisite:** Fire and air schools on `main`.

**Process:** Same as fire/air — chat → lock behavior → implement in a **separate PR** with **only** this plan as scope.

**Workflow:** See [`spell_system_index.plan.md`](./spell_system_index.plan.md).

---

## School contrast (identity first)

| | **Fire** | **Air** | **Earth** (draft) |
| --- | --- | --- | --- |
| **Mindset** | Combo burst | Movement control | Big moves + powering up |
| **Thread** | Kindled (timed mark → consume) | Discombobulated (attachment tax) | **Charge** (build, then spend) |
| **Payoff** | Fire hit detonates mark | Fall / collision / clumsy re-stick | **Committed power dump** at high Charge |
| **Rhythm** | Place mark → hit soon | Knock off → deny / punish path | **Invest** → wait or stack → **commit** |
| **Weakness** | Needs sequencing; weak alone | Soft damage without displacement | Slow cadence; weak if you never dump |
| **Best at** | Packed climbers, setup lanes | Breaking wall contact, lane denial | Finishing packs / bosses after you powered up |

### Identity paragraph (draft)

Earth is the **investment school**: you do not dabble for chip damage. You **build Charge**, harden yourself or the ground, and then spend that weight on **committed, telegraphed big moves**. Fire wins by sequencing marks into explosions; air wins by moving bodies. Earth wins by **being ready when the board is heavy** — then slamming the hammer.

**Must not:** be fire with brown particles (no Kindled-style mark→burst) or air with rocks (no knock-off / repath as the school identity).

---

## Shared thread: Charge (earth-only)

Working name: **Charge** (alt: Seismic, Mass, Fault Pressure — rename later if you prefer).

| Rule | Draft |
| ---- | ----- |
| **Where it lives** | On the **wizard / run** — a visible meter (0…max), **not** a timed enemy debuff |
| **Builds when** | Casting lighter earth spells; holding **Fortify**; enemies struggling on **Fault**; (optional) idle while Fortified |
| **Spends when** | Big earth spells (**Boulder**, **Earthquake**) — power scales with Charge spent, or requires a minimum |
| **Wave start** | Charge → **0** (no banking between waves) |
| **Must NOT** | Copy Kindled (enemy mark → fire detonate) or Discombobulated (attachment tax) |

**Feel:** the hotbar’s earth spells are about **feeding the meter** or **emptying it for something huge**.

---

## The four spells (draft)

| Spell | One-line job | Targeting | Charge role |
| ----- | ------------ | --------- | ----------- |
| **Fault** | Scar the climb — pressure that **feeds** Charge | Click trap / ground cell beside tower | **Generates** while enemies tread it |
| **Fortify** | Power stance — get ready for a big move | Instant (self) | **Amplifier** (faster Charge; next spend stronger) |
| **Boulder** | Telegraphed committed smash | Click grid / enemy lane | **Spends** Charge → size/damage scales |
| **Earthquake** | The dump — once-wave-scale hammer | Confirm / instant global-ish | **Spends all** Charge → scales with stack |

### Why they feel different

| | Fault | Fortify | Boulder | Earthquake |
| --- | --- | --- | --- | --- |
| **Skill** | Route reading / trap placement | Timing when to enter stance | Aim + read climb delay | When to empty the meter |
| **Shape** | Passive on board | Self buff | Delayed heavy impact | Wave-scale pulse |
| **Timing** | Passive | Sustain / toggle | Delayed commit | Instant on confirm |
| **Best vs** | Slow packs on a choke | Mid-wave setup | Single brute / clustered face | Ground pack at peak Charge |
| **Alone?** | Weak (feeds only) | No damage | Strong if Charge ready | Weak/empty if Charge ≈ 0 |
| **Risk** | Wasted patch | Stance cost / CD | Miss if they leave the cell | Blow meter at wrong time |

---

## Spell sketches (feel only — no mana/DPS numbers)

### 1. Fault — *feed the meter*

**Fantasy:** Crack the shell. Climbers on the scar grind power into you.

| Sketch | |
| ------ | --- |
| Target | Single cell **orthogonally adjacent to tower wall** (trap/ground-adjacent — similar *placement language* to Kindling, **different payoff**) |
| Effect | Patch lasts ~N seconds: enemies stepping/standing on it are **slowed** and **generate Charge** for the wizard (per step or per tick) |
| Damage | **None or tiny** — not a Kindling → detonate loop |
| Kindled | No interaction |
| vs Kindling | Kindling arms fire combos; Fault **only powers Earth** |
| Identity | Earth’s setup lever — **invests**, does not explode |

### 2. Fortify — *powering up*

**Fantasy:** Become the mountain. Get ready. Then hit.

| Sketch | |
| ------ | --- |
| Target | Instant (self) |
| Effect | Enter **Fortified** for a window: Charge builds **faster**; next Charge-spend spell is **empowered** (bigger Boulder / denser Quake); optional defense bump |
| Cost | Spell CD + maybe mana; cannot spam |
| Ends | Duration ends, or on first spent Charge spell (consume stance) |
| Identity | Pure power-up — **no enemy target**, no AoE. Closest sibling is air’s Flight (self), but Flight is mobility; Fortify is **mass** |

### 3. Boulder — *committed smash*

**Fantasy:** You throw a mountain. It takes a beat. If they’re still there, it hurts.

| Sketch | |
| ------ | --- |
| Target | Grid cell (or enemy then cell) |
| Timing | **Telegraphed delay** then impact (big-move feel — not Fireball instant) |
| Effect | Heavy damage in small AoE on impact; **scales with Charge spent** (pick spend amount, or spend fixed N) |
| Miss | If climbers leave the landing cell, soft miss / partial |
| Identity | Mid-game hammer — not the once-per-wave nuke, not chip |

### 4. Earthquake — *the dump*

**Fantasy:** Empty the Charge. Shake the world under their feet.

| Sketch | |
| ------ | --- |
| Target | Confirm (or instant) — **whole ground / all grounded enemies** |
| Filter | **Grounded only** (row 0 / on surface facing ground) — intentional miss on high climbers / fliers (mirrors Immolate’s niche weak, but inverse) |
| Effect | Damage + short **stun/root**; power = **all Charge spent** (0 Charge = fizzle or negligible) |
| Limit | Feels rare — CD or practical once per Charge full |
| Identity | The school climax — **not** Fireball, **not** Gust, **not** Kindled burst |

---

## Typical sequences (feel)

```
Fault on choke → packs tread → Charge climbs
Fortify when Charge mid → Charge races
Boulder spends some Charge on a brute face
Earthquake empties remainder when ground is crowded
```

Or:

```
Fortify early → Boulder (empowered) → Fault refill → Earthquake dump
```

---

## Contrast check — not a reskin

| Temptation | Why we refuse |
| ---------- | -------------- |
| Earth Kindling | Fault generates **Charge**, never arms a fire-style detonate |
| Earth Fireball | Boulder is **delayed + Charge-scaled**, not instant blanket |
| Earth Wall of Flame | No timed damage lane; earth denies with **weight** (slow/stun) not zone burn |
| Earth Gust | Earthquake / Boulder do not shove; they **hit / stun** grounded |
| Earth Tornado | No eject/block eject; Charge meter is the structure |

---

## Dev / hotbar

Extend existing **dev school picker**: fire ↔ air ↔ **earth**.

Playtest: all **4 earth spells** on hotbar when earth selected.

---

## OUT OF SCOPE (when implementing later)

- Water school  
- Rebalancing fire/air  
- Spell shop / unlocks  
- Room mana / Mana Well  
- 5th earth spell  
- Room HP friendly-fire from Earthquake **unless** we explicitly lock it in (see open questions)

---

## Open questions — answer before LOCKED

### Thread

**E1. Charge build sources?**  
- [ ] **A.** Fault only (pure trap → meter)  
- [ ] **B.** Fault + Fortify (idle regen while Fortified)  
- [ ] **C.** Fault + Fortify + small amount on any earth cast  

**E2. Max Charge?**  
- [ ] **A.** Cap of 3 (simple dumps)  
- [ ] **B.** Cap of 5 (more granular Boulder spends)  
- [ ] **C.** Other: ___  

**E3. Wave reset?**  
- [ ] **A.** Charge → 0 each wave (recommended)  
- [ ] **B.** Carry up to 1 leftover  

### Fortify

**E4. Fortify form?**  
- [ ] **A.** Timed duration buff  
- [ ] **B.** Toggle (mana drain until off)  
- [ ] **C.** Timed, and **consumes when first Charge-spend lands**  

**E5. Fortify empowerment?**  
- [ ] **A.** Next Boulder or Earthquake only  
- [ ] **B.** Whole duration — all Charge spends empowered  

### Boulder

**E6. Boulder Charge spend?**  
- [ ] **A.** Fixed spend (e.g. 1) — always same unless Fortified  
- [ ] **B.** Player chooses spend 1…N at cast (charge UI)  
- [ ] **C.** Auto-spend all but leave 1 for Quake floor  

**E7. Boulder miss?**  
- [ ] **A.** Full miss if no enemy in impact  
- [ ] **B.** Still hits empty ground (waste) but Charge spent either way  
- [ ] **C.** Slight seeking to nearest enemy in 1 cell  

### Earthquake

**E8. Grounded definition?**  
- [ ] **A.** `pos.row === 0` only  
- [ ] **B.** Any exterior surface (including walls) but **not** airborne  
- [ ] **C.** Ground row + ground-adjacent Fault cells  

**E9. At 0 Charge?**  
- [ ] **A.** Cannot cast  
- [ ] **B.** Cast allowed but negligible effect  
- [ ] **C.** Cast allowed — small quake + builds 1 Charge (odd — default avoid)  

**E10. Room / tower shock?**  
- [ ] **A.** No room damage (consistent with fire)  
- [ ] **B.** Light room chip on all rooms (big-move risk)  
- [ ] **C.** Chip only if Charge ≥ threshold  

### Fault vs Kindling UX

**E11. Fault placement?**  
- [ ] **A.** Same rule as Kindling (ortho adjacent empty cell)  
- [ ] **B.** Ground-row only  
- [ ] **C.** Exterior node pick  

### Kit size / names

**E12. Spell names OK?** Fault / Fortify / Boulder / Earthquake — or rename any?

**E13. Four spells locked as this roster?**  
- [ ] **A.** Yes — refine only rules  
- [ ] **B.** Swap one out (suggest: ___)  

---

## After LOCKED

1. Fill IN SCOPE / implementation order (mirror air).  
2. Branch `cursor/implement-earth-school-cb99`.  
3. Agent: implement **only** this plan.  
4. Extend school picker fire | air | earth.  

---

## File location

`.cursor/plans/spell_school_earth.plan.md` — branch `cursor/earth-school-spell-plan-cb99`
