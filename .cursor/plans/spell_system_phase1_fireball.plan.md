---
name: Spell System Phase 1 — Fireball Toolbar
overview: Introduce mana, a one-spell attack-phase hotbar (Fireball only), and click-to-cast targeting. Validates the spell pipeline before adding more spells and cost components.
todos:
  - id: mana-model
    content: Add mana/maxMana to Player; refill in beginWave(); expose in HUD selectors
    status: completed
  - id: spell-registry
    content: Create src/model/spells/ with SpellDef, registry, fireball.ts, and cast context helpers
    status: completed
  - id: spell-state
    content: Add spellCooldowns to GameState; reset in beginWave()
    status: completed
  - id: store-intents
    content: Add selectSpell, castSpellAt, cancelCast intents + handlers/spells.ts with validation
    status: completed
  - id: selectors
    content: selectSpellBar, selectCastPreview, selectCanCastSpell for UI affordances
    status: completed
  - id: attack-input
    content: Attack-phase click targeting when spell selected; Esc cancels; screenToCell for aim
    status: completed
  - id: spell-ui
    content: DOM spell hotbar (1 slot — Fireball) + mana bar in HUD
    status: completed
  - id: fireball-effect
    content: Delayed 3×3 grid blast; damage enemies in AoE; optional friendly room chip damage
    status: completed
  - id: canvas-preview
    content: AoE ghost + valid/invalid tint while aiming (minimal v1)
    status: completed
  - id: tests
    content: Mana spend/refill, cooldown, invalid target rejection, fireball damage in AoE
    status: completed
isProject: false
---

# Spell System — Design + Phase 1 (Fireball Toolbar)

This plan captures the full spell design discussed in the cloud agent session, scoped **Phase 1** to a single spell (Fireball) so the toolbar and cast pipeline can be playtested before expanding.

## Goals (Phase 1)

- **Mana** as a combat resource separate from gold; refills each wave.
- **Spell hotbar** with one equipped spell: **Fireball**.
- **Attack-phase targeting**: select Fireball → click grid cell → spend mana → effect resolves.
- Follow existing architecture: **Input → Intent → Store handler → Model**; no view mutations.

Out of scope for Phase 1: charge-up, per-wave charges, gold material costs, sustain/toggle spells, multiple hotbar slots, room mana consumption, spell unlocks.

---

## Full spell design (reference)

### Mana

| Event       | Behavior                                  |
| ----------- | ----------------------------------------- |
| Wave start  | `mana = maxMana`                          |
| Cast        | `mana -= spell.manaCost`                  |
| Wave end    | Unused mana discarded (v1)                |
| Build phase | No casting; HUD may show "next wave: X/Y" |

**Starting tuning:** `maxMana = 10`, Fireball cost = `4`.

**Future:** Mana Well rooms regen mid-wave; Barracks increases max or grants charges. **Rooms may spend mana someday** — same `player.mana` pool and shared `canSpendMana` / `spendMana` helpers; only the _source_ of the spend differs (wizard cast vs room behavior).

### Casting components (full model — implement incrementally)

| Component           | Role                                        | Phase 1           |
| ------------------- | ------------------------------------------- | ----------------- |
| **Mana**            | Primary attack ammo                         | Yes               |
| **Cooldown**        | Per-spell refractory (seconds)              | Yes (Fireball 2s) |
| **Charges**         | Max casts per wave                          | No (defer)        |
| **Charge-up**       | Potency grows while unused                  | No                |
| **Material (gold)** | Spend gold at cast                          | No                |
| **Sustain**         | Toggle/channeled; decay or escalating drain | No                |

#### Cooldown

- Ticks down during attack sim in `spellCooldowns[spellId]`.
- Starts on successful cast.
- Independent per spell (no global GCD in v1).

#### Charges (spell slots per round)

- `spellCharges[spellId] = { current, max }`; reset to max in `beginWave()`.
- Example later: Fireball 3/wave, Earthquake 1/wave.
- Build synergy: rooms add +1 charge to tagged spells.

#### Charge-up (potency)

- `spellPotency[spellId]` ramps from 1.0 → `maxPotency` while spell is off cooldown and not sustained.
- On cast: `effect × potency`, then reset to min.
- Example: Charged Bolt — wait 8s for 2.5× damage.

#### Material components

- Gold (or future items) spent at cast confirm.
- Fails if `player.currency < cost`.
- Bridges build economy into attack (Ritual Repair, Alchemist Fireball).

#### Sustain / toggle

- `activeSustains[spellId]` processed each tick in `step()`.
- Pay `manaPerSecond` (and optionally gold); potency may **decay** (weaker effect) or **drain may escalate** (more expensive over time).
- Auto-off when bankrupt; optional cooldown on toggle-off.

### Targeting modes

| Mode            | Input               | Example       |
| --------------- | ------------------- | ------------- |
| `instant`       | Button              | Haste, Repair |
| `gridPoint`     | Click cell          | **Fireball**  |
| `exteriorPoint` | Click tower surface | Lightning     |
| `enemy`         | Click enemy         | Zap           |
| `none_confirm`  | Confirm dialog      | Earthquake    |

Phase 1 uses `**gridPoint**` only.

### Example spells (later phases)

**Fireball** — 4 mana, 2s CD, `gridPoint`, 0.4s delay, 3×3 AoE, damages enemies in blast; optional room chip damage.

**Earthquake** — 8 mana, 1 charge/wave, global confirm, damages **ground-only** enemies + all rooms; misses climbers/fliers.

**Zap** — 1 mana, `enemy` target, cheap filler.

---

## Phase 1 implementation spec

### 1. Data model (`src/model/types.ts`)

```typescript
// Player
mana: number;
maxMana: number;

// GameState
spellCooldowns: Record<string, number>;
selectedSpellId: string | null; // ViewState alternative — prefer ViewState if selection is UI-only
```

Init in `createInitialState()`: `mana = maxMana = 10`, `spellCooldowns = {}`.

`beginWave()` in `phases.ts`: `player.mana = player.maxMana`, `spellCooldowns = {}`.

### 2. Spell registry (`src/model/spells/`)

Mirror `src/model/modifications/` layout:

- `types.ts` — `SpellDef`, `SpellCastContext`, `SpellTarget`
- `fireball.ts` — single spell definition
- `index.ts` — `SPELLS`, `getSpell(id)`, `listSpells()`
- `cast.ts` — `canCastSpell(state, spellId, target?)`, `castSpell(state, spellId, target)`, `tickSpellCooldowns(state, dt)`

**Fireball def (v1 tuning):**

```typescript
{
  id: 'fireball',
  name: 'Fireball',
  glyph: '🔥',  // or '*' to match ASCII style
  manaCost: 4,
  cooldown: 2,
  targeting: 'gridPoint',
  range: 8,  // cells from wizard perch
  // cast(ctx, { kind: 'cell', cell }) → enqueue pending impact or instant AoE
}
```

**SpellCastContext** helpers (like `ModEffectContext`):

- `damageEnemy(enemy, damage, dexterity?)`
- `enemiesInCellRadius(center, radius)`
- `damageRoom(room, amount)` (optional v1)
- `log(text, kind?)`

### 3. Pending effects (recommended for fireball fall)

Add lightweight queue on `GameState`:

```typescript
pendingSpellEffects: Array<{
  spellId: string;
  at: number;
  target: SpellTarget;
}>;
```

`step()` processes entries when `waveTimer >= at`: apply 3×3 AoE. Lets fireball "drop" while sim continues.

Alternative v1 shortcut: instant AoE on cast (skip delay) — faster to ship; upgrade to delayed later.

### 4. Store (`src/store/`)

**Intents** (`intents.ts`):

- `selectSpell { spellId: string | null }`
- `castSpellAt { spellId: string; cell: Cell }`
- `cancelCast`

**Handler** (`handlers/spells.ts`):

- Validate: `phase === 'attack'`, known spell, mana, cooldown, target in range.
- Spend mana, set cooldown, run `castSpell` or enqueue pending effect.
- `selectSpell` / `cancelCast` → `ViewState` (build/attack safe).

**Selectors** (`selectors.ts`):

- `selectSpellBar(snapshot)` — equipped spells, costs, cooldown remaining, disabled reason
- `selectCastPreview(snapshot)` — when Fireball selected, hovered cell, AoE cells, valid/invalid
- `selectMana(snapshot)` — `{ current, max }`

### 5. View

**HUD** (`view/dom/hud.ts` or new `view/dom/spellBar.ts`):

- Mana bar: `8 / 10`
- One hotbar slot: Fireball icon, mana cost, cooldown overlay
- Click slot → `selectSpell`; selected state highlighted

**Input** (`view/input.ts`):

- Attack phase + spell selected + left click → `castSpellAt` (use existing `screenToCell`)
- Esc → `cancelCast`
- When spell selected, pointer move still updates hover (reuse build hover or add `castHoverCell` to ViewState)

**Renderer** (`view/canvas/renderer.ts`):

- If casting Fireball: draw 3×3 preview at hover cell (green/red by selector)

### 6. Wizard auto-attack

**Open question** (see below): keep auto-zap, weaken it, or pause while aiming?

Phase 1 recommendation: **keep auto-zap** so zero-mana moments aren't helpless; revisit after playtest.

### 7. Tests

- `src/model/spells/fireball.test.ts` or `cast.test.ts`:
  - Mana refills on `beginWave`
  - Cast spends mana + starts cooldown
  - Reject cast when OOM, on CD, out of range, wrong phase
  - Enemies in 3×3 take damage
- `src/store/selectors.test.ts`: spell bar disabled states

---

## File checklist

| File                           | Change                                    |
| ------------------------------ | ----------------------------------------- |
| `src/model/types.ts`           | mana, spellCooldowns, pendingSpellEffects |
| `src/model/phases.ts`          | refill mana, reset cooldowns              |
| `src/model/spells/*`           | new folder                                |
| `src/model/game.ts`            | tick cooldowns, process pending effects   |
| `src/store/intents.ts`         | spell intents                             |
| `src/store/handlers/spells.ts` | new                                       |
| `src/store/handlers/index.ts`  | register                                  |
| `src/store/selectors.ts`       | spell selectors                           |
| `src/view/dom/spellBar.ts`     | new (or extend hud)                       |
| `src/view/input.ts`            | attack cast clicks                        |
| `src/view/canvas/renderer.ts`  | AoE preview                               |
| `src/main.ts`                  | mount spell bar                           |
| `index.html`                   | slot for spell bar if needed              |

---

## Implementation phases (after Phase 1)

| Phase | Deliverable                                                       |
| ----- | ----------------------------------------------------------------- |
| **1** | Mana + Fireball + 1-slot toolbar + grid targeting                 |
| **2** | Zap, cooldown UI polish, delayed impact VFX, Earthquake + charges |
| **3** | Charge-up, material costs, sustain toggles                        |
| **4** | Mana Well room, spell unlocks, hotbar expansion (4–6 slots)       |

---

## Open questions — please answer in desktop Cursor

Copy your answers below this section (or reply in chat) before / while implementing.

### Q1. Wizard auto-attack during spell aim?

- [ ] **A.** Keep current auto-zap unchanged
- [ ] **B.** Weaken auto-zap (lower damage/range)
- [ ] **C.** Pause auto-zap while a spell is selected
- [ ] **D.** Remove auto-zap; add 0-mana "Wand Strike" spell later

**Your answer: Remove current attack; instead create wand strike now that is on an "auto" attack cadence where it has a fixed cooldown, but represents itself as a skill that is set to auto-fire on range rather than on manual trigger **

### Q2. Fireball friendly fire on rooms?

- [ ] **A.** Yes — chip room HP in blast (tension)
- [x] **B.** No — enemies only in v1
- [ ] **C.** Yes, but only if room HP > 50%

**Your answer:**

### Q3. Fireball impact timing?

- [x] **A.** Instant on click (simplest)
- [ ] **B.** 0.4s delayed drop (pending effect queue)

**Your answer:**

### Q4. Mana tuning for first playtest?

- [x] **A.** max 10, Fireball 4 (~2 casts + headroom)
- [ ] **B.** max 12, Fireball 4 (~3 casts)
- [ ] **C.** Custom:

**Your answer:**

### Q5. Phase 2 first addition after toolbar works?

- [ ] **A.** Zap (enemy click target)
- [ ] **B.** Second hotbar slot + Earthquake
- [ ] **C.** Charges system (Fireball 3/wave)
- [x] **D.** Other:

**Your answer: Next will be the spell purchasing system, but we don't want to do this as part of this first batch**

---

## How to use this plan on desktop

1. **Pull the branch** (see PR or `git fetch && git checkout cursor/spell-system-plan-cb99`).
2. Open the repo in **Cursor Desktop**.
3. Read this file: `.cursor/plans/spell_system_phase1_fireball.plan.md`
4. Fill in **Open questions** (edit the markdown or tell the agent in chat).
5. In Desktop Cursor, ask the agent: _"Implement Phase 1 from `.cursor/plans/spell_system_phase1_fireball.plan.md` using my answers in the Open questions section."_

Plans in `.cursor/plans/` with YAML frontmatter may appear in Cursor's plan UI on desktop depending on your version.

---

## Mobile cloud agent ↔ desktop workflow (first-time notes)

| Option                          | What it is                                                           | Best for                                              |
| ------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| **Git branch + PR**             | Cloud agent commits plan/code to a branch; you `git pull` on desktop | Reviewing markdown, continuing implementation locally |
| **Merge PR on GitHub**          | Plan lands on `main`; desktop pulls `main`                           | Keeping one canonical branch                          |
| **Cursor Desktop on same repo** | Open local clone; agent reads `.cursor/plans/`                       | Implementation with full IDE                          |
| **Copy from chat**              | Paste plan into a local file                                         | Quick but no version history                          |
| **Cloud agent implements**      | Stay on mobile; agent codes + pushes                                 | Quick prototypes you review via PR diff               |

**Recommended first-time flow:** use this PR to review the plan markdown locally → answer open questions → implement Phase 1 on **Desktop Cursor** (faster iteration, playtest in browser) → push from desktop or ask cloud agent to continue on the same branch.
