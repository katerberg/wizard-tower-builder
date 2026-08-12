---
name: Research / Tech Tree — Index (read for context, not implementation)
overview: Maps research and spell-discovery one-shot plans. Do NOT implement from this file alone.
todos: []
isProject: false
---

# Research / Tech Tree — Plan Index

Use this file to **orient**, not to **implement**. Each shot has (or will have) its **own plan** with strict scope guardrails.

**Design source of truth:** [`docs/RESEARCH.md`](../../docs/RESEARCH.md)

---

## Which file to use when

| Goal | Read this | Do NOT read while coding |
| ---- | --------- | ------------------------ |
| **Understand the full design** | [`docs/RESEARCH.md`](../../docs/RESEARCH.md) | Implementation plans |
| **Unlock state + static tree data** | Shipped with static v1 (`src/model/research/`) | Spell discovery |
| **Research rooms + magi progress** | Shipped with static v1 | Spell discovery / content retunes |
| **Frontier UI** | Superseded by DAG modal | — |
| **DAG modal + queue** | Shipped (`view/dom/researchModal.ts`, queue in `player.research`) | Spell discovery |
| **School pick + height spell offers** | `spell_discovery.plan.md` (create at shot start) | Blueprint tree content |
| **Author edges + bonuses + tune** | Initial edges shipped; bonuses TBD | Procedural generator |
| **Procedural run-start trees** | Later series — **not v1** | — |

Shot plan files are created when that shot starts. Until then, follow [`docs/RESEARCH.md`](../../docs/RESEARCH.md) for locked behavior.

---

## Recommendation: separate one-shots

| Approach | Pros | Cons |
| -------- | ---- | ---- |
| **One mega PR** | Single merge | Agent scope creep; hard to review |
| **Plan per shot** ✓ | Focused agent runs; clear PR; guardrails | Shared engine must land first |
| **Spell discovery inside engine** | Tempting | **Avoid** — prove blueprint gating + research progress before offers |

**Workflow:**

1. **Design** — land `docs/RESEARCH.md` + this index (Plan 1).
2. **Engine** — unlock state, starter kit, tree data shape, start/progress/complete.
3. **Rooms** — research room + magi labor-cycles.
4. **UI** — frontier list + start flow.
5. **Spell discovery** — school pick + 1-of-3 height offers + hotbar filter.
6. **Content** — static edges for current roster + spell bonuses + pace tune.
7. **Procedural** — separate series after static is fun.

---

## What is shared vs per-shot

### Shared infrastructure (engine shot)

| Piece | Intended location | Notes |
| ----- | ----------------- | ----- |
| Starter `unlockedBlueprints` | `game.ts` / blueprints | Stop seeding all ids |
| Research node defs | `src/model/research/` (or similar) | Static DAG |
| Active project + progress | `player.research` | Pay to start; complete applies unlock |
| Library filter | existing `unlockedBlueprints` | Already in build selectors |
| Tests | starter kit, prereqs, complete | **No spell offers** in engine shot |

### Per-shot

| Shot | Scope |
| ---- | ----- |
| Rooms | Research room blueprint, magi assign, progress ticks |
| UI | Frontier list, costs, progress display |
| Spell discovery | `unlockedSpells`, school pick, offer modal, hotbar filter |
| Content | Full edge table, bonus nodes, numbers |

**Rule:** If it isn’t in the active shot plan’s **IN SCOPE** section, don’t build it.

---

## Two systems reminder

Do **not** put new spell ids on the tech tree. Blueprint / expansion / spell-**bonus** research is one track; height-clear spell discovery is another ([`docs/RESEARCH.md`](../../docs/RESEARCH.md)).

---

## Related

- [`docs/HOUSING.md`](../../docs/HOUSING.md) — magi / Chamber
- [`docs/HEIGHT_PROGRESSION.md`](../../docs/HEIGHT_PROGRESSION.md) — height clears; anti-grind for blueprints
- Spell school plans — discovery pools
