---
name: Spell System Phase 2 — Elementals + Casting Infrastructure
overview: Expand the spell pipeline from Phase 1 into a full elemental roster (~18 spells), multi-slot hotbar, per-wave charges, all targeting modes, status effects, delayed impacts, and the first charge-up / sustain / gold-cost spells.
todos:
  - id: phase1-prereq
    content: Phase 1 complete (mana, Fireball, 1-slot toolbar, cast pipeline) — merge or verify before Phase 2
    status: pending
  - id: spell-framework-v2
    content: Extend SpellDef with tags, elements, charges, chargeUp, material, sustain; spellCharges + spellPotency + activeSustains on GameState
    status: pending
  - id: targeting-modes
    content: Implement gridPoint, enemy, exteriorPoint, instant, none_confirm + screenToExteriorNode + enemy pick hit test
    status: pending
  - id: status-effects
    content: Enemy status system (burn, slow, wet, stun) ticked in step(); helpers on SpellCastContext
    status: pending
  - id: pending-effects
    content: pendingSpellEffects queue + delayed impacts + canvas impact flashes
    status: pending
  - id: hotbar-v2
    content: 6-slot spell hotbar, grimoire (all known spells), drag or click to equip; hotkeys 1–6
    status: pending
  - id: cast-validation
    content: Unified canCastSpell checking mana, CD, charges, gold, sustain exclusivity, target validity
    status: pending
  - id: sustain-tick
    content: tickSustains in step(); escalating drain + potency decay; auto-off on bankrupt
    status: pending
  - id: element-fire
    content: Register 5 fire spells (see roster)
    status: pending
  - id: element-water
    content: Register 4 water/ice spells
    status: pending
  - id: element-earth
    content: Register 5 earth spells
    status: pending
  - id: element-air
    content: Register 4 air/lightning spells
    status: pending
  - id: spell-ui-polish
    content: Cooldown overlays, charge pips, potency glow, sustain indicator, confirm modal for nukes
    status: pending
  - id: tests-phase2
    content: Per targeting mode, charges reset, one sustain, earthquake ground filter, status DoT
    status: pending
isProject: false
---

# Spell System Phase 2 — Elementals + Deferred Infrastructure

**Prerequisite:** [Phase 1 plan](./spell_system_phase1_fireball.plan.md) — mana, Fireball, single-slot toolbar, `castSpellAt` on grid cells.

Phase 2 does two things at once:

1. **Infrastructure** everything Phase 1 deferred (and more) so many spells can share one framework.
2. **Content** a full **elemental roster** (~18 spells) — the interactive core of attack phase.

Still **out of scope for Phase 2** (Phase 3+):

- **Spell purchasing / gold unlock shop** — next after elementals, explicitly not this batch
- Room mana consumption, Mana Well room
- Run progression / branching spell unlocks
- Non-elemental schools (arcane, necromancy, summon)

### Decisions carried from Phase 1 (locked)

| Decision | Choice |
| -------- | ------ |
| Wizard combat | **Wand Strike** — 0-mana auto-fire on cooldown when enemy in range; not manual wizard zap |
| Friendly fire | **Enemies only** — terrain spells do not chip rooms (Inferno/Earthquake need redesign or exception — see Q1) |
| Fireball timing | **Instant** on click (pending queue still useful for other spells) |
| Mana tuning | **max 10**, Fireball **4** |

---

## Phase 2 goals

| Goal | Why |
|------|-----|
| **~18 elemental spells** | Prove the registry scales; elementals first because they map cleanly to AoE / DoT / terrain / control |
| **6-slot hotbar + grimoire** | Player equips loadout; all elementals known in dev/v2 for playtest |
| **Per-wave charges** | Earthquake-style limits without mana math alone |
| **All targeting modes** | Each element uses different aim patterns |
| **Status effects** | Burn/slow/wet/stun combos between spells |
| **Delayed impacts** | Fireball drop, meteor, fissure wind-up |
| **First charge-up, sustain, gold-cost spells** | One or two per pattern — not every spell |

---

## What moves from Phase 1 defer list → Phase 2

| Deferred in Phase 1 | Phase 2 treatment |
|---------------------|-------------------|
| Multiple hotbar slots | **6 slots**, keys 1–6 |
| Per-wave charges | **`spellCharges`** on `GameState` |
| Charge-up potency | **3 signature spells** (see below) |
| Gold material costs | **2 alchemy spells** (fire + water) |
| Sustain / toggle | **4 sustains** (one per element) |
| `enemy` / `exteriorPoint` / `instant` / `none_confirm` targeting | **All implemented** |
| Delayed impact queue | **`pendingSpellEffects`** |
| Zap | **Air roster** (`zap` spell) |
| Earthquake + charges | **Earth roster** |
| Cooldown UI polish | **Full toolbar UX** |
| Room mana | **Still Phase 3** — note only |
| Spell unlocks / branching | **Still Phase 3** — all spells known in v2 |

---

## Extended casting model (implement once)

### GameState additions (beyond Phase 1)

```typescript
spellCharges: Record<string, { current: number; max: number }>;
spellPotency: Record<string, number>;       // charge-up multiplier
activeSustains: Record<string, { since: number; potency: number }>;
pendingSpellEffects: PendingSpellEffect[];
enemyStatuses: Record<string, EnemyStatus[]>;  // keyed by enemy.id
```

Reset in `beginWave()`: charges → max, potency → min, clear sustains + pending + enemy statuses, mana → max, cooldowns → 0.

### SpellDef v2

```typescript
interface SpellDef {
  id: string;
  name: string;
  glyph: string;
  color: string;
  description: string;
  element: 'fire' | 'water' | 'earth' | 'air';
  tags: Array<'direct' | 'terrain' | 'control' | 'support' | 'sustain' | 'nuke'>;

  manaCost: number | ((ctx: SpellCastContext) => number);
  cooldown?: number;
  charges?: number;                    // max per wave; omit = unlimited
  chargeUp?: ChargeUpConfig;
  material?: { gold?: number };
  sustain?: SustainConfig;

  targeting: SpellTargeting;
  range?: number;                      // wizard-relative or aim range
  exclusive?: string;                  // e.g. 'aura' — one active

  canCast?: (ctx, target?) => CastRejectReason | 'ok';
  cast: (ctx, target) => void;
  preview?: (ctx, target?) => CastPreview;   // AoE cells, tint
}
```

### Validation pipeline (`canCastSpell`)

Check in order: phase attack → equipped/known → not exclusive conflict → charges → cooldown → mana → gold → target valid.

Spend on cast: mana, gold, 1 charge (if capped), start cooldown, reset charge-up potency, enqueue pending or apply instant.

### Sustain tick (`tickSustains` in `step()`)

For each active sustain: pay mana/s (and gold intervals), update potency curve, apply effect, auto-off if broke.

---

## Targeting modes (all required in Phase 2)

| Mode | Input | Used by |
|------|-------|---------|
| `gridPoint` | Click cell | Fireball, Blizzard, Rock Throw, Fissure aim |
| `enemy` | Click enemy sprite | Zap, Frost Bolt, Immolate, Chain Lightning start |
| `exteriorPoint` | Click tower shell → snap node | Gust, Tidal Surge, Static Field anchor |
| `instant` | Hotbar click (no aim) | Stone Skin, Ember Ward, Thunderclap |
| `none_confirm` | Click → confirm modal | Earthquake, Inferno (optional confirm if friendly fire) |

**New calc:** `screenToExteriorNode(pointer, tower, scroll)` in `src/calculations/` — nearest exterior graph node within snap radius.

**Enemy pick:** project enemy positions to screen in renderer; input hit-tests by distance to sprite center (selector: `selectEnemyAtScreen`).

---

## Status effects (enemy)

Lightweight stack for elemental combos:

```typescript
type StatusKind = 'burn' | 'slow' | 'wet' | 'stun';

interface EnemyStatus {
  kind: StatusKind;
  until: number;        // waveTimer deadline
  potency: number;      // burn DPS, slow %, etc.
}
```

Tick in `step()` before movement:

| Status | Effect |
|--------|--------|
| **burn** | DoT damage each 0.5s; `potency` = DPS |
| **slow** | multiply `moveCooldown` factor; stacks cap |
| **wet** | no direct effect; **+50% burn damage** while wet |
| **stun** | skip movement + attacks |

Helpers on context: `applyStatus(enemy, kind, duration, potency)`, `isGrounded(enemy)`, `enemiesInRadius(...)`.

---

## Elemental roster (18 spells)

Tuning is initial — all numbers live in spell def files.

### Fire (5) — `element: 'fire'`

| id | Name | Target | Mana | CD | Charges | Notes |
|----|------|--------|------|-----|---------|-------|
| `fireball` | Fireball | grid 3×3 | 4 | 2s | 3/wave | Instant AoE; applies **burn**; no room damage |
| `immolate` | Immolate | enemy | 3 | 1.5s | ∞ | Strong **burn**; bonus if target already burning |
| `flameJet` | Flame Jet | grid line 5 | 2 | 1s | ∞ | Thin line from wizard toward click; low dmg + short burn |
| `inferno` | Inferno | none_confirm | 9 | — | **1/wave** | Large tower-centered pulse; **burn** on all enemies in range; no room damage (see Q1) |
| `emberWard` | Ember Ward | instant | 3 | 8s | ∞ | Wizard +2 atk for 10s; **charge-up**: up to 2× duration if unused 6s |

**Sustain (fire):** defer to Phase 2b OR fold into `inferno` as nuke only. Optional 6th: **`blazeAura`** toggle — burn enemies near wizard, 1 mana/s escalating (sustain demo).

### Water / Ice (4)

| id | Name | Target | Mana | CD | Charges | Notes |
|----|------|--------|------|-----|---------|-------|
| `frostBolt` | Frost Bolt | enemy | 2 | 1s | ∞ | Damage + **slow** 3s |
| `iceShard` | Ice Shard | enemy | 1 | 0.5s | ∞ | Cheap single hit; **charge-up** to 3× dmg over 5s |
| `blizzard` | Blizzard | grid 4×4 | 5 | 4s | 2/wave | Delayed 0.6s; **slow** all in AoE; **wet** on hit |
| `tidalSurge` | Tidal Surge | exterior line | 4 | 3s | ∞ | Push enemies 2 nodes down-wall (repathe); **wet** |

**Sustain (water): **`mistVeil`** — toggle, 1 mana/s, enemies in radius −20% dex (dodge); potency decays over 20s.

**Material:** **`alchemistFrost`** — Frost Bolt variant, +2 **gold**, applies slow 2× duration (same slot as frostBolt in grimoire, different id).

### Earth (5)

| id | Name | Target | Mana | CD | Charges | Notes |
|----|------|--------|------|-----|---------|-------|
| `earthquake` | Earthquake | none_confirm | 8 | — | **1/wave** | **Ground enemies only**; **stun** 1s ground; no room damage (see Q1) |
| `rockThrow` | Rock Throw | grid point | 3 | 2s | ∞ | Single cell heavy hit; high dmg one tile |
| `fissure` | Fissure | grid line | 5 | 5s | 2/wave | Delayed crack line (5 cells); ground-layer enemies only |
| `stoneSkin` | Stone Skin | instant | 4 | 10s | ∞ | Wizard +4 def 8s |
| `quicksand` | Quicksand | grid 3×3 at row 0 | 4 | 6s | 2/wave | Only valid on ground row; **slow** + small DoT |

**Charge-up (earth): **`earthquake`** — potency scales with `waveTimer` if held (optional v2 polish).

### Air / Lightning (4)

| id | Name | Target | Mana | CD | Charges | Notes |
|----|------|--------|------|-----|---------|-------|
| `zap` | Zap | enemy | 1 | 0.8s | ∞ | Filler bolt; low dmg |
| `chainLightning` | Chain Lightning | enemy | 4 | 3s | ∞ | Hit target + jump to 2 nearest within 3 cells, −30% each jump |
| `gust` | Gust | exterior point | 3 | 2s | ∞ | Knock enemy 3 nodes away from tower (downward preference) |
| `thunderclap` | Thunderclap | instant | 5 | 8s | 1/wave | All enemies within 4 of wizard **stun** 0.8s |

**Sustain (air): **`staticField`** — toggle anchored on wizard, 1.5 mana/s (+0.5/s every 5s), damages nearest enemy every 0.5s; auto-off when OOM.

---

## Default loadout (6 hotbar slots)

For playtest, pre-equip:

1. Zap  
2. Fireball  
3. Frost Bolt  
4. Rock Throw  
5. Gust  
6. Earthquake  

Grimoire panel lists all 18; click to swap into selected slot. **All spells known from wave 1** for balance playtest. Spell purchasing comes in Phase 3.

---

## UI / UX (Phase 2 polish)

| Feature | Detail |
|---------|--------|
| **Mana bar** | unchanged from Phase 1 |
| **6-slot bar** | glyph, element color border, mana cost, CD sweep, charge pips (●●○) |
| **Charge-up glow** | fill overlay on icon (Ice Shard, Ember Ward, optional EQ) |
| **Sustain indicator** | pulsing border while active; click again to toggle off |
| **Targeting preview** | grid AoE, line tiles, exterior snap highlight |
| **Confirm modal** | Earthquake, Inferno — show friendly-fire warning |
| **Grimoire** | attack-phase slide-out or build-phase tab; filter by element |
| **Tooltips** | `4 mana · 2s CD · 3/wave · fire` |

Attack input:

- Spell selected + click → cast by targeting mode  
- `Esc` → cancel aim  
- `1`–`6` → select slot  
- Right-click or second click on sustain → toggle off  

---

## Shared effect helpers (`src/model/spells/effects/`)

Split composable helpers so 18 spells stay thin:

| Helper | Purpose |
|--------|---------|
| `aoeGridDamage(center, radius, dmg, opts)` | Fireball, Blizzard, Inferno |
| `lineGridDamage(from, to, dmg)` | Flame Jet, Fissure |
| `damageEnemySpell(enemy, dmg, dex?)` | Uses wizard as attacker |
| `damageGroundEnemies(dmg, opts)` | Earthquake filter `pos.row === 0` |
| `chipRoomsInCells(cells, dmg)` | Terrain spells |
| `knockEnemy(enemy, direction, steps)` | Gust, Tidal Surge — repath after |
| `chainFrom(enemy, jumps, falloff)` | Chain Lightning |

Ground check:

```typescript
function isGrounded(enemy: Enemy): boolean {
  return enemy.pos.row === 0; // extend when fly profile exists
}
```

---

## File / folder layout

```
src/model/spells/
  types.ts
  index.ts              # registry + listByElement
  cast.ts               # canCast, cast, spend, cooldown tick
  sustains.ts           # tickSustains
  pending.ts            # queue process
  statuses.ts           # apply/tick statuses
  context.ts            # build SpellCastContext
  effects/              # shared helpers
  fire/
    fireball.ts
    immolate.ts
    ...
  water/
  earth/
  air/
```

Store:

- `handlers/spells.ts` — extend for toggle, confirm, equip
- Intents: `castSpellAt`, `castSpellOnEnemy`, `castSpellInstant`, `castSpellConfirm`, `toggleSustain`, `equipSpell { slot, spellId }`

View:

- `view/dom/spellBar.ts` — 6 slots
- `view/dom/grimoire.ts` — optional panel
- `view/dom/confirmCast.ts` — nuke modal
- `view/canvas/renderer.ts` — previews, status icons on enemies

---

## Implementation order (recommended)

### Step A — Framework (block all spells)

1. Extend types + `beginWave` resets  
2. Targeting modes + exterior snap + enemy pick  
3. `pendingSpellEffects` + status tick  
4. Charges + sustain tick + charge-up ramp in `step()`  
5. 6-slot hotbar + equip intents  
6. Unified `canCastSpell` + gold spend  

### Step B — One spell per mode (smoke test)

| Mode | Spell |
|------|-------|
| gridPoint | Fireball (upgrade from Phase 1) |
| enemy | Zap |
| exteriorPoint | Gust |
| instant | Stone Skin |
| none_confirm | Earthquake |
| sustain | Static Field |
| charge-up | Ice Shard |
| material | Alchemist Frost |
| charges | Earthquake 1/wave |

### Step C — Fill elemental rosters

Add remaining spells file-by-file; each = registry line + 1–2 tests.

### Step D — UI polish + balance pass

---

## Tests (minimum)

| Area | Test |
|------|------|
| Charges | Earthquake 2nd cast same wave fails |
| Ground filter | Climber at row 5 immune to EQ |
| Status | Wet + burn bonus damage |
| Sustain | OOM auto-off Static Field |
| Chain | 3 hops with falloff |
| Pending | Fireball damages after delay |
| Gold | Alchemist Frost fails at 0 gold |
| Equip | Swapping hotbar slot persists in attack |

---

## Phase 3 preview (not Phase 2)

- **Spell purchasing system** — gold shop in build phase; next batch after elementals land
- Mana Well / Barracks spell synergy (rooms spend or regen mana)
- Non-elemental schools  
- Flyers (`canFly`) — earthquake intentionally whiffs; add anti-air  
- Hotbar presets saved in build phase  

---

## Open questions — answer before or during implementation

### Q1. Friendly fire on terrain / nuke spells?

Phase 1 locked **no room damage**. Earthquake/Inferno originally chipped rooms.

- [x] **A.** No room damage on any spell (consistent with Phase 1)
- [ ] **B.** Re-enable room chip only on `nuke`-tagged (Earthquake, Inferno)
- [ ] **C.** All terrain-tagged spells chip rooms

**Your answer: A — no room damage**

### Q2. Grimoire access during attack?

- [x] **A.** Full grimoire in attack (swap spells mid-wave)
- [ ] **B.** Equip only in build phase
- [ ] **C.** Attack: swap slots but not spell list

**Your answer: A**

### Q3. All 18 spells known from wave 1?

- [x] **A.** Yes — playtest balance first; spell purchasing is Phase 3
- [ ] **B.** Unlock 3 per element over waves 1–4
- [ ] **C.** Pick 6 at run start

**Your answer: A**

### Q4. Wand Strike (replaces wizard auto-attack)?

Phase 1 implemented Wand Strike as auto-fire on cooldown. Phase 2:

- [ ] **A.** Keep Wand Strike separate from hotbar; spells are manual
- [ ] **B.** Wand Strike becomes equippable slot 0 (always auto)
- [ ] **C.** Remove Wand Strike; Zap is manual filler

**Your answer:**

### Q5. Phase 2 delivery strategy?

- [x] **A.** Ship Step A+B first (~9 spells + framework), rest as 2.1
- [ ] **B.** All 18 in one PR
- [ ] **C.** Element-by-element PRs (fire → water → earth → air)

**Your answer: A recommended — confirm or override**

---

## Relation to Phase 1 plan

| Phase 1 | Phase 2 |
|---------|---------|
| 1 spell, 1 slot | 18 spells, 6 slots + grimoire |
| gridPoint only | all targeting modes |
| mana + CD | + charges, charge-up, gold, sustain |
| instant Fireball AoE | + delayed queue, statuses, combos |

Implement Phase 1 first, then branch Phase 2 from that work (or merge Phase 1 PR, then `spell-system-phase2` branch).
