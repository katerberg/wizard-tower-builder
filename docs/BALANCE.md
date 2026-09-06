# Balance test bed

**Status:** v1 harness shipped (combat vs unlock layers, height-aware builder, named fixtures). Economy envelopes and possible-towers visualization are deferred.

Idle combat only: Wand Strike + rooms / staff / turrets. Fixtures do not script spell casts.

Difficulty is **framing height at Start Wave**, not wave index. See [`HEIGHT_PROGRESSION.md`](HEIGHT_PROGRESSION.md).

---

## How to add or lock an expected build

1. Add a `BalanceBuild` row in [`src/test/balance/builds.ts`](../src/test/balance/builds.ts).
2. Set `height` (the driver grows stems to that crown). Place rooms at any row.
3. List `research` node ids only when the kit is **granted** (e.g. `bp-slot`). Empty = starter library.
4. `expect: 'clear' | 'lose' | 'raid'`. If the **intended** outcome is not true yet, set `knownFailing: true` (Vitest `it.fails`). CI stays green; when a later pass actually matches `expect`, the suite **fails** until you remove the flag.
5. Run `npm run test:balance`.

Do not snapshot exact gold/stone/souls in these tests. Combat outcome is the lock.

### Fixture fields

| Field | Role |
|-------|------|
| `id` / `title` | Stable name for reports and failures |
| `expect` | Intended combat result |
| `knownFailing` | Intended result is not true yet |
| `height` | `raiseToHeight` then Start Wave |
| `placements` / `recruits` / `slotAllocations` | Layout + staff plan |
| `research` | Granted tech-tree nodes (unlock layer) |
| `wallet` | Extra resources on the starting wallet (overlay) |
| `spawnIncludes` | Queue must contain these template ids (asserted **outside** `it.fails`) |

The same `applyBuild` path works at height 5, 15, or 80. A later plateau is another table row.

## Layers

| Layer | This PR | Follow-up |
|-------|---------|-----------|
| **Combat** | Idle sim until clear / lose | — |
| **Unlock** | Refuse locked blueprints unless the fixture grants research | — |
| **Economy** | Not asserted | Affordability envelopes (slack leftover, not exact costs) |

## In-memory sim report

`runBalanceBuild` returns a `SimReport`: `id`, height, seed, `clear`/`lose`/`raid`, wizard HP / collectorBroke, sim time, net cost, leftover wallet, rooms used, spawn queue. Tests assert on that object. Nothing is written to disk. A later catalog / heatmap can dump the same type.

## Wave-1 turret lock

Idle magic-turret DPS is tuned so **one turret loses** wave 1 even on the covering shaft (`one-turret` at col 8) and **two turrets** (one per starter shaft) **clear** (`double-turret`). Knobs: `TURRET_DAMAGE` **4** / `TURRET_COOLDOWN` **2s** in `src/model/rooms/turret.ts`. Keep `bare-starter` losing.

**Where to tweak** (do not put magic numbers in tests):

- [`src/model/waves.ts`](../src/model/waves.ts) — plateau 0 budget / elite slots
- [`src/model/enemies.ts`](../src/model/enemies.ts) — swarm / elite HP
- [`src/config/combat.ts`](../src/config/combat.ts) — wand / mana
- [`src/model/rooms/turret.ts`](../src/model/rooms/turret.ts) — magic turret damage / cooldown
- [`src/model/blueprints.ts`](../src/model/blueprints.ts) — `STARTING_BLUEPRINT_IDS` if Slot becomes starter

Knob index: [`src/config/README.md`](../src/config/README.md).

## Deferred

### Validate expected-build economy

For each named build, assert it is still **affordable** from the wallet declared at that height (starting wallet or plateau overlay), with slack leftover — not `gold === 8` snapshots. Depends on this harness. Combat vs economy failures must stay separate so a cost bump does not hide a DPS regression.

### Possible-towers visualization

Not in this pass. Planned order: **catalog** of authored fixtures (pass/fail by plateau) → **spatial heatmap** (damage / occupancy on the grid) → **search** over affordable layouts. Needs the sim-report type above; per-cell tracing is not collected yet.

---

## Save from dev mode

The fastest way to capture a tower you've built in the dev server:

1. Enable **dev mode** (toggle `Dev: off` → `Dev: on` in the HUD).
2. Build your tower in the build phase (or inspect after a `gameOver` scene).
3. Click **Save tower** in the dev row → fill in a name and expected outcome (`clear` / `lose`) → click **Generate** → **Copy to clipboard**.
4. Paste the JSON snippet into [`src/test/balance/fixtures.json`](../src/test/balance/fixtures.json).
5. Run `npm test` — the harness picks up the new fixture automatically (via `builds.ts`).

**Load tower** reverses the process: click **Load tower** in the dev row → pick a fixture from `fixtures.json` → confirm. This replaces the current tower entirely. Both buttons are disabled during the attack phase.

## Commands

```bash
npm run test:balance      # this suite
npm run test:playability  # original first-wave pair (uses the same fixtures)
npm test                  # all Vitest files, including both
```


### Raid outcome

`expect: 'raid'` means the wave was cleared (or otherwise survived) **and** the solar collector broke during that wave. Instant collector loss is gone; bare-starter fixtures that used to `lose` on collector death should use `raid` when the collector falls but storage holds.
