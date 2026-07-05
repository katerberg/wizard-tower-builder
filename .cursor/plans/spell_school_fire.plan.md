---
name: Fire School — Four Spells (Design Sketch)
overview: Locked design for the four fire spells — distinct mechanics, shared Kindled combo thread, no exact tuning numbers. Ready to prototype and playtest feel before Phase 2 elementals continue.
todos:
  - id: fireball
    content: "Fireball — exists; ensure Kindled proc on blast"
    status: pending
  - id: immolate
    content: "Immolate — wall-cling burn; procs Kindled"
    status: pending
  - id: wall-of-flame
    content: "Wall of Flame — A→B timed segment, LoS, friendly fire, procs Kindled"
    status: pending
  - id: kindling
    content: "Kindling — adjacent trap patch 15s; Kindled debuff; flat burst on any fire hit"
    status: pending
isProject: false
---

# Fire School — Four Spells (Design Sketch)

**Purpose:** Four spells that feel **nothing alike**, but still read as one school. Numbers (mana, CD, DPS, burst size, durations) are **intentionally loose** — tune after playtest.

**Prerequisite:** Phase 1 spell pipeline on `main` (mana, Fireball, hotbar, Wand Strike auto in background).

**Wand Strike:** Stays off the hotbar; same `SpellDef` structure; auto-fires in background. Not part of the fire school.

---

## Fire school identity (one paragraph)

Fire is the **combo school**: you mark routes and enemies, control space for a few seconds, and **pay off** with bursts when something actually burns. Kindled is the thread — most fire spells apply or consume it. Fire rewards **sequencing** (Kindling → Fireball) and **reading paths** (Immolate on slow wall climbers, useless on fliers). It is not the “biggest AoE wins” school; it is “set up, then detonate.”

Other schools (later) should **not** copy Kindled — water might use wet/slow/shatter, earth ground-only terrain, air precision/mobility.

---

## Shared: Kindled debuff

| Rule | Detail |
| ---- | ------ |
| **Applied by** | Stepping on an active **Kindling patch** |
| **Duration on enemy** | ~15s (tunable) |
| **Initial damage** | **None** |
| **Payoff** | While Kindled, **any fire damage** from any fire spell triggers a **flat bonus burst**, then **Kindled is consumed** |
| **Re-kindle** | Enemy can become Kindled again (same patch if still up, or a new patch) |
| **Fire sources that proc** | Fireball, Immolate (including burn ticks), Wall of Flame, any future fire spell |

Kindled is the glue — not a spell by itself, but what makes four different spells feel like one school.

---

## The four spells at a glance

| Spell | One-line job | Targeting | Timing | Kindled role |
| ----- | ------------ | --------- | ------ | ------------ |
| **Fireball** | “Hit this area now” | Click grid cell | Instant | Procs Kindled on anyone in blast |
| **Immolate** | “Cook one climber on the wall” | Click enemy | Sustained while on wall | Burn ticks proc Kindled |
| **Wall of Flame** | “Hold this lane for a moment” | Click A, then B | Timed zone | Crossing/tick fire procs Kindled |
| **Kindling** | “Arm the path, no damage yet” | Click adjacent trap tile | Patch ~15s | **Applies** Kindled |

### Distinctness check (why these aren’t reskins)

| | Fireball | Immolate | Wall of Flame | Kindling |
| --- | --- | --- | --- | --- |
| **Player skill** | Aim AoE | Pick target + path | Draw segment + LoS | Place trap on route |
| **Damage shape** | Area burst | Single DoT | Line/zone over time | Zero alone |
| **Best vs** | Clumped climbers | Slow wall crawlers | Fliers, choke points | Pre-arming a wave |
| **Weak vs** | Spread out | Fliers (no wall) | Short fights if mis-timed | Alone (needs follow-up) |
| **Risk** | Miss placement | Wrong target | Friendly fire, LoS limits | Wasted patch if no fire follow-up |

---

## 1. Fireball

**Feel:** The reliable **now** button — instant gratification, no setup required.

| Sketch | |
| ------ | --- |
| Target | Click a grid cell in range |
| Effect | Instant damage in a small area (e.g. 3×3) |
| Kindled | Anyone Kindled in the blast gets **flat burst + Kindled consumed** on top of normal hit |
| Identity | Baseline; other spells are situational **because** Fireball exists |

Already on `main`. Phase 2 work: wire Kindled proc when that system exists.

---

## 2. Immolate

**Feel:** **Conditional pressure** — strong when they stay on the tower shell, dead weight vs fliers.

| Sketch | |
| ------ | --- |
| Target | Click one enemy |
| Effect | Applies burn that **only ticks while the enemy is on a wall** (exterior climb surface — left/right face, ledge, ground crawl) |
| Off wall | Burn **stops** (fliers / open air → spell is useless) |
| Kindled | **Each fire tick counts as fire damage** → can proc Kindled (burst + consume) |
| Identity | Single-target, path-reading; complements Fireball’s area |

**Not:** another click-to-damage nuke. The damage is **conditional on geometry**.

---

## 3. Wall of Flame

**Feel:** **Space control** — draw a short wall, it lives for a timer, shapes the fight (especially vs things fire otherwise struggles with).

| Sketch | |
| ------ | --- |
| Target | **Two clicks:** point A, then point B |
| Length | Up to **5 spaces** along valid exterior/surface path |
| Line of sight | Must be **visible from wizard perch** (same-face segment rule in implementation — no wrapping a corner in one cast) |
| Duration | **Timed** — zone fades after a few seconds (exact time TBD) |
| Effect | Enemies (including **fliers**) crossing or inside take fire damage |
| Friendly fire | **Yes** — if the segment passes through allies (wizard perch, future minions), they take fire too |
| Kindled | Fire damage from the wall procs Kindled |
| Identity | Only spell that’s **drawn** + **persistent** + **anti-flier** + **risky** |

**Not:** Fireball in a line. It’s a **temporary barrier**, not a burst.

---

## 4. Kindling

**Feel:** **Trap + arm** — zero damage until your other spells cash in.

| Sketch | |
| ------ | --- |
| Target | Click to place on a **single empty cell orthogonally adjacent to a tower wall** (not on the room itself — beside it on the climb surface / trap tile) |
| Patch lifetime | **~15 seconds**, then fades *(future spell upgrade: lasts whole wave)* |
| On enemy step | Enemy gains **Kindled** for ~15s |
| Patch damage | **None** |
| Payoff | See **Kindled** rules above — flat burst on any fire hit, then consumed |
| Re-kindle | Enemy can become Kindled again if they cross an active patch (or a new one) |
| Identity | Pure setup; weakest alone, strongest when sequenced |

**Not:** a mine that explodes on step. It **marks**, it doesn’t detonate by itself.

---

## Typical combos (feel, not DPS math)

```
Kindling on choke → climbers get Kindled → Fireball the pack → flat bursts on marked targets

Kindling → Immolate on brute on long wall → burn ticks proc Kindled when marked

Wall of Flame on flier lane → Kindled flier crosses → Wall tick → burst

Fireball alone → still fine; school shines when Kindled is in play
```

---

## Implementation notes (when building — still no tuning)

1. **Status:** `Kindled` on enemy with expiry; remove on proc.
2. **Patch:** `KindlingPatch` on `{ cell | exteriorNode }` with `expiresAt`.
3. **Fire damage hook:** central `applyFireDamage(enemy, amount, source)` → if Kindled, add flat burst, clear Kindled.
4. **Wall of Flame:** store segment + `until`; tick overlap; LoS validate at cast.
5. **Immolate:** separate status `Immolate` + `isOnWall(enemy)` gate for ticks.

---

## What’s next (after fire — not this doc)

- **Water / ice** — next planning section (slow, reposition, wet; no Kindled clone).
- **Earth / air** — same slow back-and-forth.
- **Phase 2 infra** — charges, multi-slot bar, etc. (see `spell_system_phase2_elementals.plan.md` on plan branch when merged).

---

## Locked decisions log

| Topic | Decision |
| ----- | -------- |
| Wand Strike | Background auto; not on hotbar |
| Kindled proc | Any fire damage; flat bonus; consumed on proc |
| Kindled re-apply | Can be re-kindled later |
| Kindling placement | Single tile orthogonally adjacent to tower wall |
| Kindling patch | ~15s (upgrade: whole wave later) |
| Immolate | Burn only while on wall; useless vs fliers |
| Immolate + Kindling | Burn ticks trigger Kindled |
| Wall of Flame | A→B, ≤5, LoS, timed, friendly fire, hits fliers |
| Tuning numbers | Defer to playtest |

---

## Mobile / desktop

Open this file in the repo:

`.cursor/plans/spell_school_fire.plan.md`

Branch: `cursor/fire-school-spell-plan-cb99`

After fire playtest sketches land, continue elemental planning one school at a time.
