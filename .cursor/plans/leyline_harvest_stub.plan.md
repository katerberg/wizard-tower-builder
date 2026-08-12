---
name: Leyline harvest — Stub (next plan)
overview: 'Placeholder for magi height-band leyline harvest and substance (name TBD). Do not implement until mine harvest slices 1–3 are underway or done. Expand into a full index + docs/LEYLINES.md at kickoff.'
todos: []
isProject: false
---

# Leyline harvest — Stub

**Status:** Stub only. **Not started.** Kick off immediately after the mines track has a working engine (or in parallel only once mine staffing rules are stable).

**Depends on / parallels:** [`docs/MINES.md`](../../docs/MINES.md), [`mine_harvest_index.plan.md`](./mine_harvest_index.plan.md)

---

## Locked intent (from design discussion)

| Topic | Decision |
|-------|----------|
| Who | **Magi** (not laborers) |
| Where | **Fixed height bands** of floating leylines (not prospected veins) |
| Yield | Significant only **in-band**; off-band = useless trickle |
| Prospect | **No** magi prospecting; bands differ by **harvest rate** |
| Resource | **Substance** (name TBD) — magical component for later complex spells, many room upgrades, mana-using construction (e.g. turrets) |
| Mana springs | **Removed** when this ships; magi work leylines instead of staffing springs |
| vs mines | Same attack-time walk-to-site fantasy; different discovery model (fixed bands vs prospect depth) |

---

## At kickoff, create

1. `docs/LEYLINES.md` — full design (bands, workplaces, substance sinks, spring removal migration)
2. `leyline_harvest_index.plan.md` — replace this stub
3. Cost matrix pass: move turret/chamber-style spends toward substance where intended; update [`docs/ECONOMY_COST_MATRIX.md`](../../docs/ECONOMY_COST_MATRIX.md)
4. Engine slice plan: leyline sites as workplaces, magi auto-assign leftover after player allocations (mirrors mine priority rules unless redesign says otherwise)

---

## Explicit non-goals until expanded

- Implementing substance wallet
- Deleting mana springs
- Band geometry / rates
- Spell gating on substance

---

## Handoff checklist

- [ ] Mines: laborers path to real sites; abstract harvest gone
- [ ] Mines: allocation priority rules documented in code comments / HOUSING
- [ ] Expand this stub → real leyline design doc + index
- [ ] Migration plan for existing mana-spring saves / tutorials / README loop copy
