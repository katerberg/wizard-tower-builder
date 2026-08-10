# Height progression & win condition

Design notes for replacing wave-index campaign length with **tower height** as the primary progress / difficulty axis.

**Status:** v1 implemented (height budgets/slots, permanent unlocks, win at clear ≥ 100, crown-relative flier bands, HUD/help). Enemy templates and exact unlock heights remain placeholders for playtest.

**Related:** today’s linear 10-wave loop lives in [`src/model/waves.ts`](../src/model/waves.ts); flier altitude bands in [`docs/FLYING.md`](FLYING.md) (will retarget to crown-relative height).

---

## Goals

1. **Win** by clearing a wave while the tower is tall enough (height ≥ 100), not by surviving a fixed wave count.
2. **Incentivize functional towers** — climbing height raises threat, so tall-but-hollow builds are punished; collapse can ease pressure.
3. **Permanent unlocks, current-height pressure** — crossing a height band forever expands the enemy piece set; **how many / how heavy** still follows current height (chess-points: unlocked rook may appear, but fewer points overall when you’re down material).
4. **Epic late run** — mid heights should linger; the endgame stretch should feel ~**5 minutes** of tense play, not a short finale after a rush to 100.
5. **No grind gates** — progress should feel continuous; players must not feel forced to farm at a height before “breaking a seal.”

---

## Design principles

### Height is framing height

**Height** = highest occupied **framing** macro row (`towerExtents` / `maxOccupiedRow`). Ground is row 0. Rooms and infra do not define height unless they sit on framing that extends the structure.

### World danger tracks the crown

> As the tower grows taller, the world gets more dangerous.

Difficulty for a wave is sampled from height at **Start Wave**. Flier spawn altitude tracks the **current crown** (near the top of the tower), not a fixed wave-index band table.

### Unlocks vs weight (chess points)

| Concept | Rule |
|---------|------|
| **Unlock** | Permanent for the run once the height threshold is crossed (see [when unlocks fire](#when-unlocks-fire)). |
| **Weight** | Current height sets total difficulty budget / heavy **slots**. Below a type’s home band, that type may still appear but only in **small numbers** (“a few”) — tunable. |
| **Purity** | No hard “forbidden below home height” after unlock. Points/slots do the suppression. |

### Anti-grind (explicit)

**Grinding is an anti-fun pattern for this game.**

- Holding and refining a height (defenses, logistics, shape) is valid.
- Feeling forced to **sit at height N to farm gold before attempting N+1** is not.
- Height is the main climb metric, but **not the only sense of progress** (layout quality, coverage, staff, economy depth later).
- v1 economy may scale clear rewards with difficulty/height to reward climbing; a richer harvest economy comes later. That reward curve must not create a soft lock where the efficient play is endless mid-height farming.
- Difficulty uses **plateaus**, not tiny per-row seal breaks that beg for “one more grind wave.”

Document this in UI copy / help when the feature ships: the fantasy is **climb when ready**, not **farm then break the seal**.

### Collapse is a breather, not a run-ender

If the tower loses height between waves, the next wave should feel like the world is **giving you a breather**: unlocks remain, but overall weight drops toward the new height. Players should want to keep going after a bad hit.

**Enemy damage to framing** is implemented for **demolishers** (room then framing on overhang preferred paths) and for **any ground climber** when the exterior path to the wizard is empty (closest room then framing, same cascade). Mid-wave height drop still does not retune the spawn queue; dropping below 100 voids that wave’s win.

---

## Win / lose

| Rule | Decision |
|------|----------|
| Victory | Clear a wave while height ≥ **100** at wave end (must still be ≥ 100 after the fight). |
| Run after win | **Over** for now (victory scene). No endless continue in v1. |
| Minimum wave count | **None** — wave 1 at height 100 is a valid win if the tower holds. |
| Stability | Tower must be **stable** to Start Wave (unchanged). |
| Defeat | Unchanged: wizard HP ≤ 0. |
| Mid-wave height drop | Spawn difficulty stays **locked** from Start Wave. Dropping below 100 during the fight **voids that wave’s win** even if you clear it; you must clear a later wave while still ≥ 100. |

---

## When difficulty and unlocks sample height

| Event | Behavior |
|-------|----------|
| **Start Wave** | Snapshot height → difficulty budget, slots, flier crown band. Spawn queue locked for the wave. |
| **During attack** | No retune of remaining queue or live enemies when height changes. |
| **Win check** | At wave clear: height ≥ 100 **and** scene would otherwise advance — else treat as a normal clear (gold, next build) without victory. |
| **Unlocks** | Fire when Start Wave height first crosses a threshold (**start-of-wave** only, not merely building past a row in build phase). |

---

## Progression shape (v1)

Keep **Build → Start Wave → Attack → Build**.

- Replace “Level N / 10” HUD with **height** (and keep a wave counter only if useful for debug; player-facing focus is height).
- **Longer dwell at mid heights**; plateaus on the difficulty curve so 20→50→80→100 are chapters, not a linear panic.
- Target feel: late game (approaching / holding ~100) ~**5 minutes** of epic defense, not a single spike wave.
- Clear gold: scale with **difficulty (height-driven)** for payroll (recruit/upkeep); kill rewards are **souls**. Construction uses stone/metal/souls from laborer harvest.

### Hold & refine vs grind

| Encouraged | Discouraged |
|------------|-------------|
| Rebuild coverage, fix logistics, reshape buttresses at a plateau | Mandatory gold farm loops at a fixed height |
| Dip in difficulty after a collapse, then climb again | Soft gates that require N clears before the next row is “safe” |
| Multiple waves at mid height because fights are interesting | UI/systems that imply “seal at 21 — grind 20 first” |

---

## Difficulty model (slots + budget)

v1 approach (details tunable in implementation):

1. **Point budget** from current height, with **plateaus** (step or piecewise curve, not raw `height * k` every row).
2. **Slots** for heavies (elite / brute / carrier / etc.) also from current height — caps how many expensive pieces fit.
3. Fill remaining budget with fodder (swarm / skirmisher / light fliers as unlocked).
4. After unlock, below home band: allow **a few** of that heavy type when slots/budget permit — default intent, not final numbers.

Enemy **templates stay as-is for v1**; new types and retunes come in a later pass. Do not treat unlock height table as sacred.

### Placeholder unlock ladder

Rewrite freely when enemy roster changes:

| Height (framing row) | Unlocks (permanent for run) |
|----------------------|-----------------------------|
| 0 | swarm, elite (tiny presence) |
| 15 | striker |
| 30 | kamikaze |
| 40 | skirmisher |
| 55 | denser elite slots |
| 70 | carrier |
| 85 | brute |
| 100 | win-eligible + peak budget plateau |

---

## Flier spawn altitude

**Change from [`docs/FLYING.md`](FLYING.md):** stop using fixed absolute bands by `levelIndex`.

v1: spawn band is **relative to current tower crown** at Start Wave (e.g. a window around / below `maxOccupiedRow`), so short towers are not punished by row-70 air spawns and tall towers draw air threats near the wizard.

Update FLYING.md when implementing.

---

## v1 implementation slice (in scope)

Enough to playtest the fantasy:

- [x] Height snapshot at Start Wave drives wave composition (budget + slots + unlock checks).
- [x] Permanent per-run unlock set from thresholds crossed at wave start.
- [x] Win on wave clear iff height ≥ 100 (post-fight).
- [x] HUD / help / victory copy: height goal, not “10 waves.”
- [x] Flier bands follow crown height.
- [x] Clear rewards scale with difficulty/height.
- [x] Plateau-shaped curve; mid-height dwell; no grind-gate systems.
- [x] Tests for unlock permanence, budget vs height, win/no-win when height drops mid-wave below 100.

### Out of scope (this plan)

| Topic | Notes |
|-------|--------|
| Enemy framing damage / wing collapse from foes | Demolisher overhang smash + stuck-climber smash when path empty (see enemies / demolisherCombat) |
| New enemy types / full roster retune | Demolishers added; further roster changes later |
| Complex resource harvesting economy | Engine: shallow mine stone ([`MINES.md`](MINES.md)). Prospect / rare veins / storage / leylines still later. |
| Mid-wave difficulty retuning | Locked at Start Wave |
| Endless mode after victory | Not for now |
| Soft answer on “how few” heavies below home band | Default “a few”; tune in playtest |

---

## Open / soft

1. **Below-home heavy count** — “a few” is the intent; exact slot caps TBD in playtest.
2. **Exact plateau breakpoints and ~5 minute endgame pacing** — needs playtest instrumentation (wave duration, height histogram).
3. **Framing-break fantasy** — demolisher overhang smash + stuck-climber smash ship; tune cascade vs breather feel in playtest.

---

## Decision log (from design pass)

| # | Topic | Decision |
|---|--------|----------|
| 1 | After win | Run over |
| 2 | Min waves to win | None |
| 3 | Stability to start | Required |
| 4 | HUD | Show height (not Level N/10) |
| 5 | Difficulty sample | Start Wave only; win needs end-of-wave height ≥ 100 |
| 6 | Mid-wave retune | No — lock queue at start |
| 7 | Unlock sample | Start Wave only |
| 8 | Pacing | Longer mid heights; epic ~5 min late |
| 9 | Curve shape | Plateaus |
| 10 | Composition | Slots (+ budget fill) |
| 11 | Below-home heavies | A few (soft) |
| 12 | Unlock ladder | Placeholder OK; enemies will change |
| 13 | Hard gates after unlock | No — stay pure |
| 14 | Flier altitude | Track tower crown |
| 15 | Phase loop | Keep Build / Attack |
| 16 | Clear gold | Scale with difficulty for now |
| 17 | Hold vs grind | Refine OK; document anti-grind |
| 18 | Enemy framing damage | Demolishers (room→framing, cascade) |
| 19 | Collapse → easier next wave | Yes |
| 20 | Ruined tower feel | Breather |
| 21 | v1 scope | Height budget + unlocks + win + HUD; no mid-wave retune |
| 22 | Enemy roster | Demolisher size ladder added |
