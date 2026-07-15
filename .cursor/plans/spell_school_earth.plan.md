---
name: Earth School — Planning (NOT LOCKED)
overview: Earth = investment school. Charge on wizard. Fault (pass charges), Fortify (concentration shield that charges), Boulder (weak vs fliers), Earthquake (structural cascade up to pick). Distinct from fire combo and air displacement. NOT LOCKED.
todos:
  - id: earth-identity
    content: Lock identity + contrast vs fire/air
    status: pending
  - id: earth-thread
    content: Lock Charge meter rules (wizard, wave reset, Fault + Fortify build)
    status: pending
  - id: earth-spells-draft
    content: Lock Fault / Fortify / Boulder / Earthquake feel rules
    status: pending
  - id: earth-open-questions
    content: Resolve remaining open questions (EQ cascade, Fortify exit, Boulder spend)
    status: pending
  - id: earth-lock
    content: Mark LOCKED + IN/OUT SCOPE; ready for implement PR
    status: pending
isProject: false
---

# Earth School — Planning Draft (v2)

**Status:** ⏳ **NOT LOCKED** — design only. Directionally agreed; remaining questions below.

**Prerequisite:** Fire and air on `main`.

**Workflow:** See [`spell_system_index.plan.md`](./spell_system_index.plan.md). Implement later from **this file only**.

---

## Identity (locked direction)

| | **Fire** | **Air** | **Earth** |
| --- | --- | --- | --- |
| **Mindset** | Combo burst | Movement control | Big moves + powering up |
| **Thread** | Kindled (enemy mark) | Discombobulated (attachment tax) | **Charge on the wizard** |
| **Payoff** | Mark → fire detonate | Fall / collision | **Spend Charge** on committed hits |
| **Rhythm** | Arm → hit | Knock off → deny | **Invest (Fault/Fortify) → commit (Boulder/Quake)** |
| **Soft spot** | Needs sequence | Soft without displacement | **Fliers** (except weak Boulder); slow if you never Charge |

Earth is the **investment school**: Charge lives on **you**. You crack the climb, concentrate into stone, then dump weight into a **structural slam** or a delayed boulder. Fire detonates marks; air moves bodies. Earth **builds pressure, then reshapes the fight** — including scarring its own tower on Earthquake.

**Must not:** Kindled-style detonate; Gust-style shove as identity; free chip without Charge narrative.

---

## Charge (wizard meter) — locked direction

| Rule | Detail |
| ---- | ------ |
| **Where** | Wizard / run — HUD meter `0…max` |
| **Build** | **Fault** (per enemy **pass** over patch) + **Fortify** (while concentrating) |
| **Spend** | **Boulder** (partial) and **Earthquake** (all / scaled dump) |
| **Wave start** | Charge → **0** |
| **Not** | Enemy debuff; not fire/air status |

---

## Four spells (refined)

| Spell | Job | Targeting | Charge |
| ----- | --- | --------- | ------ |
| **Fault** | Scar a choke — each **pass** feeds the meter | Trap cell adjacent to wall | **Generates** |
| **Fortify** | Concentration — invuln + Charge, **no casting** | Instant self | **Generates** while held |
| **Boulder** | Delayed smash (weak vs fliers) | Grid cell | **Spends** |
| **Earthquake** | Cascade shake **up to chosen structure point** | Click room / structural pick | **Spends** (big dump) |

### Distinctness

| | Fault | Fortify | Boulder | Earthquake |
| --- | --- | --- | --- | --- |
| **Skill** | Route place | When to freeze | Aim + delay read | Which backbone to risk |
| **Shape** | Trap | Self stance | Delayed impact | Structural cascade |
| **Interactive** | Enemies charge you | You hold still | Telegraphed hit | Tower HP + unit smash |
| **Alone** | Weak (feed only) | No offense | Soft if empty Charge | Needs Charge + smart pick |
| **Risk** | Bad choke | Stuck while concentrating | Miss / flier shrugs | **Room damage** on path |

---

## 1. Fault — *charge per pass*

**Fantasy:** Crack the shell. Every climber that **walks over** the scar pushes energy into you.

| Rule | Detail |
| ---- | ------ |
| **Placement** | Empty cell **orthogonally adjacent to a room** (same language as Kindling — different payoff) |
| **Lifetime** | Timed patch (~15s tunable; later upgrade = whole wave) |
| **On pass** | Enemy finishes a step **onto / across** the Fault cell → **+Charge** (once per pass, not per tick standing) |
| **Re-pass** | Same enemy leaving and stepping on again → **another** Charge (encourages recirculation / slow packs) |
| **Damage** | **None** (or optional tiny slow only if we want — default **no slow** so it's cleanly a feeder, not air-light Blizzard) |
| **vs Kindling** | Kindling arms **fire** combo; Fault only feeds **earth Charge** |
| **Fliers** | Don't walk the shell → don't charge Fault (school weakness) |

**Open:** Slow on Fault or pure Charge feeder? (Recommendation: **pure Charge** — keeps identity sharp.)

---

## 2. Fortify — *concentration*

**Fantasy:** Become stone. Nothing touches you. Power builds. When you **go**, the mountain moves.

| Rule | Detail |
| ---- | ------ |
| **Enter** | Cast Fortify (instant) → wizard is **Fortified** |
| **While Fortified** | (1) **Damage immune** (enemy attacks / hazardous rooms don't chip wizard HP) (2) **Cannot cast spells** (including other earth) (3) **Charge builds** over time (steady tick) |
| **Frozen** | Wizard perch — no relocation; Wand Strike **paused** while Fortified (you're concentrating, not auto-zapping) |
| **Exit / “go”** | Breaking concentration ends Fortify. Recommended UX: **next cast attempt** ends Fortify then resolves that spell (one gesture). Alternate: toggle Fortify off, then cast separately. |
| **Also ends** | Wave end; wizard would have died unprotected — fortify ends cleanly |
| **Not** | Timed free empower aura; not air Flight (mobility). This is **hold-to-invest** |

**Risk:** You don't act while charging — enemies climb. Release at the wrong beat and Charge isn't spent.

---

## 3. Boulder — *committed smash / only anti-air tooth*

**Fantasy:** Lob a rock. Slow. Heavy on what it hits. Fliers can dodge the window; it's earth's **only** answer to air.

| Rule | Detail |
| ---- | ------ |
| **Target** | Click grid cell (impact landing) |
| **Timing** | Telegraphed delay → impact (not Fireball-instant) |
| **Damage** | Scales with Charge spent; **weak if Charge low** |
| **AoE** | Small (tighter than Fireball) |
| **Fliers** | Can be hit **if** still in the blast volume at impact — no bonus; intended **soft** anti-air (school's only tool) |
| **Spend** | Spends Charge (amount TBD — fixed 1 vs choose 1…N) |

---

## 4. Earthquake — *structural cascade* (redesigned)

**Fantasy:** Pick a **point on your tower**. The quake runs **up the backbone to that point** — rooms on the cascading chain are punished; climbers clinging to that segment get obliterated. Spare branches stay healthy. **Build shape matters.**

### Targeting

| Rule | Detail |
| ---- | ------ |
| **Pick** | Click a **room** (or a cell on a room footprint) — the **quake tip** |
| **Path** | Compute a cascade path **from the foundation (ground-supported mass) up to the tip** along connected rooms (support tree / BFS from ground → tip) |
| **In cascade** | Every room **on that path** takes room HP damage (tunable; **intentional** tower risk) |
| **Out of cascade** | Rooms **not** on the path are **untouched** — alternate spines / buttresses stay as recovery paths |

### Combat effect

| Rule | Detail |
| ---- | ------ |
| **Enemy damage** | **Heavy** to enemies whose exterior position is adjacent / on the faces of rooms **in the cascade** (especially near the tip — "lots of damage at that point in the structure") |
| **Charge** | Spends Charge — damage (enemies + rooms) **scales with Charge spent** (dump all recommended) |
| **Fliers** | Off the shell → miss (except if somehow overlapping — treat as miss). Boulder is their weak answer |
| **0 Charge** | Cannot cast (or negligible — recommend **cannot cast**) |

### Tower identity payoff

```
Thin spine to a high tip  →  Quake hits one path hard; tip rooms get hurt; climbers on spine suffer
Wide / branched tower     →  Quake one backbone; spare wings survive; pathfinding still has routes
Strong rooms at choke tip →  You can afford Quake there
Glass tip                 →  Quake risks collapsing your own perch approach
```

This is earth's **architectural** spell — fire/air don't ask "which column am I willing to crack?"

### Cascade algorithm (implementation sketch — lock behavior first)

1. Tip room R = room under click.  
2. Build set of rooms reachable walking **down** support / adjacency toward ground (or: shortest path in room-adjacency graph from any ground-supported room to R, preferring downward supports).  
3. Damage rooms in set; damage enemies near room footprints in set.  
4. Tip gets **heavier** enemy damage (optional weighting).  

Exact support-graph vs simple “all rooms with `origin.row ≤ tip.row` in the same connected component** is an open question — favor **true structural path** so branches aside work.

---

## Typical sequences

```
Fault on climb choke → packs stream past → Charge ticks per pass
Fortify → Charge races (invuln while you wait)
Break Fortify into Boulder → delete a cluster on a face
OR
Fault → Fortify → Earthquake on a fortified choke column → rooms along spine chip, climbers on that segment die
Spare wing of tower still stands for the next climb
```

---

## School vs fliers (locked direction)

| Tool | vs Fliers |
| ---- | --------- |
| Fault | No (don't pass shell) |
| Fortify | No combat |
| Boulder | **Weak yes** — only earth tool; telegraphed |
| Earthquake | **No** — structural / shell |

---

## Contrast check

| Temptation | Rejected |
| ---------- | -------- |
| Earth Kindling | Fault feeds Charge per **pass**, no detonate |
| Global Quake | Quake is **pick a tower point** + cascade, not whole-board |
| Fortify = free buff | Must concentrate — frozen, no casts |
| Earth Gust | Quake does not shove; it **cracks structure** |

---

## Decisions already locked from chat

| Topic | Locked |
| ----- | ------ |
| Charge location | Wizard meter |
| Fault feed | **Per pass** over patch |
| Fortify | Concentration: Charge while held; **no spells**; **damage immune**; ends when you go |
| Earthquake | Pick spot; cascade rooms **up to** that point; room damage + heavy unit damage on that segment |
| Fliers | Soft Boulder only |
| Roster | Fault / Fortify / Boulder / Earthquake |

---

## Remaining open questions

### Fault

**E1.** Fault slow?  
- [ ] **A.** Pure Charge feeder (no slow) — recommended  
- [ ] **B.** Mild slow + Charge on pass  

**E2.** Fault placement?  
- [ ] **A.** Ortho-adjacent empty cell (like Kindling) — recommended  
- [ ] **B.** Ground-row only  

**E3.** Multiple Fault patches?  
- [ ] **A.** Several with spell CD (like Kindling)  
- [ ] **B.** One global at a time  

### Fortify

**E4.** Exit UX?  
- [ ] **A.** Selecting/casting any spend spell **auto-breaks** Fortify then casts — recommended  
- [ ] **B.** Must toggle Fortify off first  
- [ ] **C.** Esc breaks Fortify only (safe cancel) + A for cast  

**E5.** Does Fortify pause Wand Strike?  
- [ ] **A.** Yes (full concentration) — recommended  
- [ ] **B.** Wand Strike still fires  

### Boulder

**E6.** Charge spend mode?  
- [ ] **A.** Fixed spend (e.g. 1)  
- [ ] **B.** Spend all Charge on Boulder  
- [ ] **C.** Choose 1…N at cast  

**E7.** Impact timing?  
- [ ] **A.** Short delay (~0.4–0.6s)  
- [ ] **B.** Longer delay so climbing reads matter (~1s+)  

### Earthquake

**E8.** Cascade path definition?  
- [ ] **A.** Support path: rooms connecting tip **down to ground** along supported adjacency (branches off-path safe) — recommended  
- [ ] **B.** All rooms with row ≤ tip row in same tower mass (simpler, less interesting)  
- [ ] **C.** Click cell marks a horizontal “fault line”; all rooms above it cascade separately  

**E9.** Tip enemy damage vs rooms on path?  
- [ ] **A.** Tip segment **heavier** unit damage; path rooms equal room chip  
- [ ] **B.** Uniform unit damage along whole cascade  
- [ ] **C.** Only tip footprint enemies take unit damage; path rooms take HP damage  

**E10.** Room damage severity?  
- [ ] **A.** Light chip (never collapses easily)  
- [ ] **B.** Meaningful — Quake risks cracking glass chokes  
- [ ] **C.** Scales with Charge so empty Quake chips little  

**E11.** Can Quake destroy a room (HP → 0)?  
- [ ] **A.** Yes — rooms can be sold-by-quake (huge drama)  
- [ ] **B.** Floor at 1 HP — damage but never remove (safer for prototype)  

**E12.** Charge spend on Quake?  
- [ ] **A.** Always dump **all** Charge  
- [ ] **B.** Require min Charge to cast; dump all  

### Meter

**E13.** Max Charge?  
- [ ] **A.** 3  
- [ ] **B.** 5  
- [ ] **C.** Other  

**E14.** Wave reset Charge → 0?  
- [x] **A.** Yes (assumed)  

---

## After LOCKED

1. Write IN SCOPE / OUT OF SCOPE + implement order.  
2. Branch `cursor/implement-earth-school-cb99`.  
3. Extend school picker: fire | air | **earth**.  
4. Room damage + cascade needs careful tests (tower graph).

---

## File

`.cursor/plans/spell_school_earth.plan.md` — branch `cursor/earth-school-spell-plan-cb99` · PR for review
