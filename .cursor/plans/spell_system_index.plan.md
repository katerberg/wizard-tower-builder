---
name: Spell System — Index (read for context, not implementation)
overview: Maps spell plans, shared vs per-school scope, and the Cursor workflow for one-school-at-a-time implementation. Do NOT implement from this file alone.
todos: []
isProject: false
---

# Spell System — Plan Index

Use this file to **orient**, not to **implement**. Each elemental school has its **own plan** with strict scope guardrails.

---

## Which file to use when

| Goal | Read this | Do NOT read |
| ---- | --------- | ----------- |
| **Implement fire** | [`spell_school_fire.plan.md`](./spell_school_fire.plan.md) only | Other schools’ plans while coding |
| **Implement air** | [`spell_school_air.plan.md`](./spell_school_air.plan.md) only | Other schools |
| **Plan / implement earth** | [`spell_school_earth.plan.md`](./spell_school_earth.plan.md) | Fire/air design internals |
| **Plan water** | `spell_school_water.plan.md` *(future)* | Other schools |
| **Understand mana/hotbar baseline** | [`spell_system_phase1_fireball.plan.md`](./spell_system_phase1_fireball.plan.md) | — |

---

## Recommendation: separate plans per school

**Yes — one plan per school** is the right split for Cursor (desktop or cloud):

| Approach | Pros | Cons |
| -------- | ---- | ---- |
| **One mega plan** | Single source | Agent scope creep; hard to one-shot; mobile unreadable |
| **Plan per school** ✓ | Focused agent runs; clear PR; guardrails | Must document shared hooks once (below) |
| **Context of all plans while building fire** | Theoretical cross-school balance | **Avoid** — implement fire in isolation; balance later |

**Workflow:**

1. **Design** — back-and-forth in chat → lock **one** school plan (fire done).
2. **Implement** — new branch → agent prompt cites **one plan file** only.
3. **Merge** — one school PR.
4. **Next school** — new plan doc, new PR (air → water → earth).

---

## What is shared vs per-school

### Shared infrastructure (already on `main` or extended only when a plan says so)

| Piece | Location | Notes |
| ----- | -------- | ----- |
| Mana, cooldowns | `Player`, `GameState.spellCooldowns` | Phase 1 |
| Spell registry pattern | `src/model/spells/` | Add school subfolder when useful |
| Cast pipeline | `cast.ts`, handlers, selectors, spellBar | Extend targeting modes **when a plan requires** |
| Wand Strike | `wandStrike.ts`, `runAutoSpells` | Not on hotbar; not elemental |

### Per-school (implement only inside that school’s plan)

| Piece | Example (fire) |
| ----- | -------------- |
| School-specific statuses | **Kindled** (fire only — not a generic debuff framework) |
| Spell definitions | Fireball, Immolate, Wall of Flame, Kindling |
| School damage hook | `applyFireDamage` + Kindled proc |
| Hotbar loadout for playtest | Four fire spells on bar |
| School tests | `fire/*.test.ts` |

**Rule:** If it isn’t in the active school plan’s **IN SCOPE** section, don’t build it.

---

## PR / branch naming (suggested)

| School | Plan file | Branch example |
| ------ | --------- | -------------- |
| Fire | `spell_school_fire.plan.md` | `cursor/implement-fire-school-cb99` |
| Air | `spell_school_air.plan.md` | `cursor/implement-air-school-cb99` |
| Water | `spell_school_water.plan.md` | `cursor/implement-water-school-cb99` |
| Earth | `spell_school_earth.plan.md` | `cursor/implement-earth-school-cb99` |

Planning PRs can land docs on `main` first; implementation PRs follow.

---

## Agent prompt templates

### Implement fire (copy-paste)

```
Implement ONLY the fire school from .cursor/plans/spell_school_fire.plan.md.

Rules:
- Read spell_school_fire.plan.md and spell_system_index.plan.md (scope section only).
- Do NOT implement air, water, earth, spell shop, Mana Well, or spells not listed in the fire plan.
- Do NOT refactor unrelated systems.
- Extend shared spell infra only as listed under "IN SCOPE" in the fire plan.
- Run npm test && npm run lint before done.
```

### Plan air (copy-paste, after fire merges)

```
Help me plan the air school using .cursor/plans/spell_school_air.plan.md as the template.

Same process as fire: distinct mechanics per spell, no copying Kindled, lock behavior questions before implementation. Do not implement code yet.
```

---

## School roadmap

| Order | Status | Plan |
| ----- | ------ | ---- |
| Phase 1 | ✅ on `main` | phase1 — mana, Fireball, hotbar |
| **Fire** | ✅ implemented | `spell_school_fire.plan.md` |
| **Air** | ✅ implemented | `spell_school_air.plan.md` |
| **Earth** | 🔒 LOCKED, ready to implement | `spell_school_earth.plan.md` |
| Water | ⏳ future | TBD |

---

## Deprecated / do not use for implementation

- Old bulk **`spell_system_phase2_elementals.plan.md`** (if present on a branch) — superseded by per-school plans. Historical reference only.
