---
name: Air School — Planning (NOT LOCKED)
overview: Template for the next elemental school. Plan air through the same back-and-forth process as fire. Do NOT implement until status is LOCKED and fire is merged.
todos:
  - id: air-identity
    content: Write one-paragraph air school identity (distinct from fire combo / water control / earth terrain)
    status: pending
  - id: air-thread
    content: Define air's shared mechanic thread (NOT Kindled — e.g. mark, charge, gust stack — TBD in chat)
    status: pending
  - id: air-spells-draft
    content: Draft 3–5 spells with distinct mechanics each; distinctness table
    status: pending
  - id: air-open-questions
    content: List open behavior questions; resolve in chat like fire F1/WF1
    status: pending
  - id: air-lock
    content: Mark plan LOCKED; add IN SCOPE / OUT OF SCOPE; ready for implement PR
    status: pending
isProject: false
---

# Air School — Planning Template

**Status:** ⏳ **NOT LOCKED** — do not implement from this doc yet.

**Prerequisite:** Fire school **implemented and playtested** (`spell_school_fire.plan.md` merged).

**Process:** Same as fire — small chat sections → lock behavior → implement in a **separate PR** with **only** this plan as scope.

---

## Air school identity

*(To be written in planning chat.)*

**Draft prompts to answer:**

- What is air **best at** that fire is bad at?
- What is air **bad at**?
- One sentence identity: e.g. fire = combo/setup; air = ???

---

## Shared mechanic thread (air-only)

*(Fire uses **Kindled**. Air must use something else.)*

| Rule | Detail |
| ---- | ------ |
| **Name** | TBD |
| **Applied by** | TBD |
| **Payoff** | TBD |
| **Must NOT** | Copy Kindled or be generic “mark + detonate” identical to fire |

---

## Spells (draft slots)

Fill during planning. Target **3–5 spells**, each mechanically unique.

| Spell | One-line job | Targeting | Thread role |
| ----- | ------------ | --------- | ----------- |
| **TBD 1** | | | |
| **TBD 2** | | | |
| **TBD 3** | | | |
| **TBD 4** | | | |

### Distinctness table

*(Copy from fire plan when spells are drafted.)*

---

## Open questions

*(Add during planning; move to Resolved when answered.)*

### Shared (air thread)

- Q-A1: …

### Per spell

- Q-S1: …

---

## IN SCOPE (implementation — fill when LOCKED)

*(Mirror fire plan — example structure only)*

- [ ] Air-specific status/thread system
- [ ] N air spell definition files
- [ ] Hotbar: air playtest loadout only
- [ ] Tests colocated with air spells
- [ ] Targeting modes **required by air spells only**

---

## OUT OF SCOPE (implementation — always)

- Fire / water / earth spells or statuses (Kindled, etc.)
- Spell gold shop / unlock progression
- Mana Well, room mana
- Rebalancing fire spells
- Bulk “all elementals” pass

---

## Resolved decisions log

*(Empty until planning complete.)*

---

## After air is LOCKED

1. Update this doc status to **LOCKED**.
2. Branch `cursor/implement-air-school-cb99`.
3. Agent prompt: implement **only** `spell_school_air.plan.md`.
4. Next planning doc: `spell_school_water.plan.md`.
