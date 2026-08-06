---
name: Water School — Soak, Hydrant, Four Spells (LOCKED)
overview: LOCKED water school — Soak (stacked slow, no inherent damage), Hydrant room (piped water), Splash / Waterfall / Deadweight / Geyser. Distinct from fire combo, air displacement, earth Charge. Ready to implement.
todos:
  - id: soak-system
    content: Soak 0–100 on enemy; half-life decay; speed curve with floor (no hard root)
    status: in_progress
  - id: wet-cells
    content: Exterior wet cells — flow down walls, short wall life, puddles on flats
    status: pending
  - id: hydrant
    content: Hydrant room — piped ground-water only; spray sides; no steam/mana/staff
    status: pending
  - id: splash
    content: Splash — soak applicator spell
    status: pending
  - id: waterfall
    content: Waterfall — push down wall ≤10 cells; no knock-off; puddle residue
    status: pending
  - id: deadweight
    content: Deadweight — scale-with Soak damage + brief slow worsen
    status: pending
  - id: geyser
    content: Geyser — cast from puddle; blast up 3; damage damp+; soak all hit
    status: pending
  - id: school-picker
    content: Extend SpellSchool + hotbar + dev picker fire | air | earth | water
    status: pending
  - id: tests-water
    content: Colocated tests — Soak, wet flow, Hydrant, four spells
    status: pending
  - id: verify
    content: npm test && npm run lint
    status: pending
isProject: false
---

# Water School — Soak, Hydrant, Four Spells (LOCKED)

**Status:** Behavior **LOCKED** from planning chat. Mana, CD, soak rates, damage formulas → **playtest tuning**.

**Prerequisite:** Fire, air, and earth on `main`.

**Workflow:** See [`spell_system_index.plan.md`](./spell_system_index.plan.md). When LOCKED, implement from **this file only**.

---

## Identity

| | **Fire** | **Air** | **Earth** | **Water** |
| --- | --- | --- | --- | --- |
| **Mindset** | Combo burst | Movement control | Invest → commit | **Attrition through wetness** |
| **Thread** | Kindled (enemy) | Discombobulated | Charge (wizard) | **Soak (enemy, 0–100)** |
| **Payoff** | Mark → fire detonate | Fall / collision | Spend Charge | **Slow + scale/threshold spells** (no spend) |
| **Rhythm** | Arm → hit | Knock off → deny | Build → dump | **Wet the climb → hold → exploit** |
| **Soft spot** | Needs sequence | Soft without displace | Empty Charge / fliers | **Dry enemies; short towers; no puddle for Geyser** |

Water is the **wetness school**: Soak meters enemies (slow only), Hydrants and Waterfall paint the climb, Splash tops up stacks, Deadweight punishes the waterlogged, Geyser erupts only from puddles. Fire detonates marks; air rips bodies off; earth powers you. Water **buys time on the wall** and hits harder the wetter they are — **never** by spending Soak, **never** by knocking them off into fall damage.

---

## IN SCOPE (water implementation PR)

| Area | Deliver |
| ---- | ------- |
| **Soak** | 0–100 on enemy; half-life decay; slow via move-cooldown multiplier; speed floor (no hard root); no inherent damage |
| **Wet cells** | Exterior water presence; flows **down**; walls dissipate quickly; **puddles** on flat tops last longer; contact applies Soak |
| **Hydrant** | New room blueprint; needs adjacent **piped ground-water**; no steam, mana, or staff; sprays **sides** → sheet → puddle on flats below; dry + build alert without water |
| **Splash** | Spell — apply / bump Soak |
| **Waterfall** | Spell — water runs down face ≤10 cells; push enemies **down while attached**; no knock-off; no fall damage; leaves dissipating puddle |
| **Deadweight** | Spell — damage scales with real Soak; brief **fake +Soak for speed only** (no real stack change, no spend) |
| **Geyser** | Spell — cast **only from puddle**; blast **up 3 cells**; damage **damp+** (Soak ≥ 10); **increase Soak on all** units hit |
| **School picker** | Dev toggle fire \| air \| earth \| **water** |
| **Hotbar** | 4 water spells when water selected |
| **Tests** | Water-only colocated tests |

---

## OUT OF SCOPE

| Excluded | Why |
| -------- | --- |
| Rebalancing fire / air / earth | Unrelated |
| Spell shop / grimoire / unlocks | Later |
| Temp rain / free water-sheet spell | Cut — Hydrant + Waterfall residue only |
| Soak spend / consume-for-burst | Rejected — half-life already taxes Soak |
| Hard root / full immobility as a real state | Rejected |
| Knock-off / fall damage as water verbs | Air owns that |
| Moats / parapets / cornices as general structures | Separate deferred list (Hydrant is the water-plan structure) |
| Pipe fluid redesign | Reuse ground-water ports only |
| Exact DPS / half-life seconds / soak rates | Playtest tuning |
| 5th water spell | Kit is four |

---

## Agent prompt (when LOCKED)

```
Implement ONLY .cursor/plans/spell_school_water.plan.md

- IN SCOPE / OUT OF SCOPE are binding.
- Read spell_system_index.plan.md for workflow only.
- Do not redesign fire/air/earth.
- Run npm test && npm run lint before done.
```

---

## Implementation order

1. Soak meter on enemy + half-life tick + speed multiplier (floor) + HUD/debug as needed  
2. Wet cells (flow down, wall dissipate, puddle on flats, contact → Soak)  
3. Hydrant room (water port gate, side spray into wet-cell system)  
4. Splash  
5. Waterfall (push-down + puddle residue)  
6. Deadweight  
7. Geyser (puddle targeting + up-3 column)  
8. School picker + hotbar water kit  
9. Tests + lint  

---

## Soak (enemy thread)

| Rule | Intent (lock behavior; tune numbers later) |
| ---- | ------------------------------------------ |
| Location | Enemy field, **0–100** |
| Damage | **None** from Soak itself |
| Effect | Scales enemy move speed via `moveCooldown` multiplier (same family as Blizzard’s hook, but sticky + stacked) |
| Curve | Anchors: ~25 → half speed; ~50 → ~⅓ speed; **never 0** — floor so even 100 still crawls (e.g. `max(0.15, 1 - sqrt(soak/100))`) |
| Decay | **Half-life:** every T seconds → `soak = floor(soak / 2)`. T **leisurely** — heavy band drops under 25 in a couple ticks; **damp tail** lingers |
| Damp | Soak **&gt; 0 and &lt; 10** — threshold tier for “any moisture” |
| Exploit style | **Scale-with** default; **thresholds** OK; **no spend/consume** |
| Cleared by | Decay to 0; death. (Knock-off/fly clear — open, see edges) |
| Who applies | Water **spells** + **wet world cells** (Hydrant sheets/puddles, Waterfall puddle) |

**vs Kindled:** not a timed binary mark; not consumed by school damage.  
**vs Blizzard:** not a flat zone 2× while inside — persistent enemy-owned scalar.  
**vs Charge:** lives on the **enemy**, not the wizard.

---

## Wet cells (environmental water)

Separate from pipe logistics `Fluid = 'water' | 'steam' | 'fire'` — this is **combat wetness on the climb**.

| Rule | Intent |
| ---- | ------ |
| Presence | Exterior / climb-relevant cells can be wet |
| Flow | Water **flows down** each tick |
| Walls | Sheets on vertical faces **dissipate quickly** |
| Puddles | On **flat** tops (roof / ledge), water **pools** and lasts longer |
| Contact | Enemies climbing through / standing in wet cells gain Soak |
| Sources in this plan | **Hydrant** spray; **Waterfall** terminus puddle |
| Non-sources | No free “rain” / temp sheet spell |

---

## Hydrant (room)

| Rule | Intent |
| ---- | ------ |
| Blueprint | New room (size/shape playtest — start simple, e.g. 1×1 or 2×1) |
| Needs | Adjacent cell on **ground-water** pipe network (same port family as mana spring / boiler water-in) |
| Does not need | Steam, mana pool, staff/magi |
| Effect (attack) | While water-connected: spray **left/right sides** → wet sheets flow down → puddles form on flats below |
| Fail | No water → inactive; build/inspect alert (e.g. *"Needs water from ground pipes"*) |
| Fantasy | Placement + piping puzzle; basin under a hydrant is the soak maintenance engine |

---

## Spells

### 1. Splash

| Rule | Detail |
| ---- | ------ |
| Job | Always-useful **Soak applicator** |
| Target | `gridPoint` — **small AoE** around the click |
| Effect | Apply / bump Soak to enemies in the splash (no damage, or trivial chip only if needed for juice) |
| Identity | Top-up when Hydrant coverage isn’t enough; enable Deadweight / Geyser thresholds |

### 2. Waterfall

| Rule | Detail |
| ---- | ------ |
| Job | Vertical **summon / push** — tall-tower incentive |
| Summon | Water mass runs **down** the chosen face / column |
| Travel | At most **~10 cells**, then ceases |
| Push | Enemies caught shoved **down along the wall** |
| Attachment | **Stay on tower** — hang on; **no knock-off**; **no fall damage** |
| vs Gust | Air wants overhangs + detach; Waterfall wants **height** as runway |
| Residue | Leaves a **puddle** at the bottom / stop cell; puddle soaks then dissipates in a few turns |
| Soft spot | Short towers; targets already near ground |

### 3. Deadweight

| Rule | Detail |
| ---- | ------ |
| Job | Primary **scale-with** combat payoff |
| Fantasy | Waterlogged — the wetter they are, the harder they hit the ground / the heavier the strike |
| Damage | Scales with **real** current Soak |
| Extra slow | For a few seconds, speed math treats them as having **+X Soak** (playtest X/duration). **Real Soak unchanged** — does not add stacks, does not spend stacks, does not affect Deadweight/Geyser damage gates |
| Dry | Weak / poor value — kit wants wet targets |
| Identity | The tooth; Splash + Hydrant exist so this hurts |

### 4. Geyser

| Rule | Detail |
| ---- | ------ |
| Job | **Threshold / setup toy** — rewards puddles |
| Cast rule | **Only from a puddle** cell (Hydrant basin or Waterfall residue) |
| Shape | Blast **up 3 cells** in that column |
| Damage | Only units that are **damp+** (Soak ≥ 10) |
| Soak | **Increases Soak on all units hit** (including dry — dry get wetness, not damage) |
| Identity | Pipe + Hydrant (or Waterfall puddle) as cast surface; vertical anti-climb punish |

---

## Typical combos

```
Hydrant above ledge → puddle basin → climbers stay damp/soaked
Splash to top up a priority climber → Deadweight while heavy
Waterfall on a tall face → shove pack down → puddle at stop → Geyser up through them
Geyser hits dry scout → now damp → follow-up Deadweight / second Geyser
```

Fire: _mark → burn → burst._  
Air: _slow → detach → fall._  
Earth: _invest → commit._  
Water: _wet → hold → deadweight / geyser from puddles; waterfall resets height._

---

## Dev mode: school picker

| School | Hotbar spells |
| ------ | ------------- |
| Fire | fireball, immolate, wallOfFlame, kindling |
| Air | gust, tornado, flight, blizzard |
| Earth | fault, fortify, boulder, earthquake |
| **Water** | splash, waterfall, deadweight, geyser |

---

## Locked edges (W4–W7)

| ID | Decision |
| -- | -------- |
| W4 | **Clear Soak on full detach** (air knock-off / fly-off) |
| W5 | Hydrant sprays **ortho left/right** exterior cells of the room footprint |
| W6 | Waterfall: click start cell; water runs **down** that column |
| W7 | Geyser **can** friendly-fire the wizard if in the column |

Tuning (half-life T, soak rates, damage formulas, spray rate, lifetimes, push step, Deadweight +X/duration, Splash amount) → **playtest**.

---

## Resolved decisions

| Decision | Choice |
| -------- | ------ |
| Thread | **Soak** stacks on enemy |
| Soak damage | **None** inherent |
| Soak exploit | Scale-with + thresholds; **no spend** |
| Decay | Half-life (half drops per tick); leisurely T |
| Full root at 100 | **No** — speed floor; 100 not a realistic lock |
| Damp band | &lt; 10 Soak as threshold tier |
| Env water | Yes — flow down, fast wall dissipate, puddles on flats |
| Temp water spell zones | **Cut** |
| Hydrant | In plan; **piped water**, no steam/mana/staff |
| Spell 1 | **Splash** — small **AoE** Soak apply |
| Spell 2 | **Waterfall** (push down, ≤10, puddle, no knock-off) |
| Spell 3 | **Deadweight** — damage scales with real Soak; extra slow = **fake +Soak for speed only** |
| Spell 4 | **Geyser** — puddle-only, up 3; damage **damp+ only**; soak all hit |
| Plan split | **One plan** (systems + spells) |

---

## Hook notes (implementation hints, not extra scope)

- Prefer `src/model/spells/water/` + Hydrant blueprint/behavior beside other rooms.
- Optional `applyWaterDamage` only if Deadweight/Geyser need a school damage path (for clarity vs fire/wind) — not required for Soak itself.
- Reuse pipe **water-port** adjacency checks from springs/boilers; do not invent a new fluid type.
- Do not require cross-school interactions in v1; exclusive hotbar via `activeSpellSchool` remains.
