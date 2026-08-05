---
name: Shell Fortifications — Index (read for context, not implementation)
overview: Maps fortification one-shot plans, shared engine vs per-roster scope, and the Cursor workflow. Do NOT implement from this file alone.
todos: []
isProject: false
---

# Shell Fortifications — Plan Index

Use this file to **orient**, not to **implement**. Each shot has (or will have) its **own plan** with strict scope guardrails.

**Design source of truth:** [`docs/FORTIFICATIONS.md`](../../docs/FORTIFICATIONS.md)

---

## Which file to use when

| Goal | Read this | Do NOT read while coding |
| ---- | --------- | ------------------------ |
| **Understand the full design** | [`docs/FORTIFICATIONS.md`](../../docs/FORTIFICATIONS.md) | Implementation plans |
| **Implement engine seams** | `fortifications_engine.plan.md` (create at shot start) | Ground/shell/funnel/spikes plans |
| **Implement Moat + Glacis** | `fortifications_ground.plan.md` | Other roster plans |
| **Implement Parapet + Cornice** | `fortifications_shell.plan.md` | Other roster plans |
| **Implement Stakes + Barbican** | `fortifications_funnel.plan.md` | Other roster plans |
| **Migrate spikes** | `fortifications_spikes.plan.md` | Routing roster plans |
| **Murderholes / crenels** | Separate populated-structure track — **not this series** | — |

Shot plan files are created when that shot starts (same pattern as per-school spell plans). Until then, follow [`docs/FORTIFICATIONS.md`](../../docs/FORTIFICATIONS.md) for locked behavior.

---

## Recommendation: separate one-shots

| Approach | Pros | Cons |
| -------- | ---- | ---- |
| **One mega PR** | Single merge | Agent scope creep; hard to review |
| **Plan per shot** ✓ | Focused agent runs; clear PR; guardrails | Shared engine must land first |
| **Coding later shots while building engine** | Tempting | **Avoid** — prove strip + `stepCost` before blueprints |

**Workflow:**

1. **Design** — land `docs/FORTIFICATIONS.md` + this index (Plan 1).
2. **Engine** — new branch → cite **only** the engine plan.
3. **Roster pairs** — ground → shell → funnel, one PR each.
4. **Spikes migration** — after shell attachments are proven.
5. **Murderholes** — separate series (populated).

---

## What is shared vs per-shot

### Shared infrastructure (Plan 2 — engine)

| Piece | Intended location | Notes |
| ----- | ----------------- | ----- |
| `tower.shell` cell map | `Tower` + place/remove helpers | One kind per framing cell |
| Exterior predicate | `isExteriorFramingCell` | Orthogonal neighbor lacks framing |
| Strip-on-enclose + full refund | Build handlers after structure edits | No interior ghosts |
| Weighted A\* | `stepCost` in `pathfinding.ts` | Default cost `1` |
| Walkability hooks | `exteriorGraph.ts` | Hard denies for later roster |
| Tests | exterior / pathfinding / strip | **No blueprints** in engine shot |

### Per-shot (implement only inside that shot’s plan)

| Shot | Blueprints / behavior |
| ---- | --------------------- |
| Ground | Moat (hard aura deny), Glacis (aura cost 4) |
| Shell | Parapet (`onTop` deny), Cornice (underhang deny) |
| Funnel | Stakes (cost + slow), Barbican (band cost / gate face) |
| Spikes | Migrate room mod → shell; drop Lv2/3; keep flier miss |

**Rule:** If it isn’t in the active shot plan’s **IN SCOPE** section, don’t build it.

---

## PR / branch naming (suggested)

| Shot | Plan file | Branch example |
| ---- | --------- | -------------- |
| Design doc | this index + `docs/FORTIFICATIONS.md` | `cursor/shell-fortifications-design-…` |
| Engine | `fortifications_engine.plan.md` | `cursor/fortifications-engine-…` |
| Ground | `fortifications_ground.plan.md` | `cursor/fortifications-ground-…` |
| Shell | `fortifications_shell.plan.md` | `cursor/fortifications-shell-…` |
| Funnel | `fortifications_funnel.plan.md` | `cursor/fortifications-funnel-…` |
| Spikes | `fortifications_spikes.plan.md` | `cursor/fortifications-spikes-…` |

Planning/docs PRs can land on `main` first; implementation PRs follow.

---

## Agent prompt templates

### Implement engine (copy-paste, after design merges)

```
Implement ONLY the fortifications engine from .cursor/plans/fortifications_engine.plan.md
(create that plan from docs/FORTIFICATIONS.md engine sections if missing).

Rules:
- Read fortifications_engine.plan.md and fortifications_index.plan.md (scope section only).
- Do NOT add Moat/Glacis/Parapet/Cornice/Stakes/Barbican/Spikes blueprints or library entries.
- Implement tower.shell, exterior predicate, strip-on-enclose + refund, stepCost in A*, tests.
- Run npm run lint && npm test before done.
```

### Implement ground pair (copy-paste, after engine merges)

```
Implement ONLY Moat + Glacis from .cursor/plans/fortifications_ground.plan.md.

Rules:
- Read fortifications_ground.plan.md and docs/FORTIFICATIONS.md (Moat/Glacis specs).
- Do NOT implement Parapet, Cornice, Stakes, Barbican, or spikes migration.
- Extend shell hooks only as listed under IN SCOPE in the ground plan.
- Run npm run lint && npm test before done.
```

---

## Roadmap

| Order | Status | Deliverable |
| ----- | ------ | ----------- |
| **1 Design** | ✅ | `docs/FORTIFICATIONS.md` + this index |
| **2–5 Engine + roster** | ✅ lean 6 shipped | shell map, exterior, strip, `stepCost`, Moat/Glacis/Parapet/Cornice/Stakes/Barbican |
| **6 Spikes** | ⏳ | Migrate spikes → shell; drop upgrades |

---

## Out of series

- Murderholes / crenels (populated)
- Shell upgrade paths
- Off-tower moat placement
- Flier-solid fortifications
- Staff pathing changes
