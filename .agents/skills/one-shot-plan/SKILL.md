---
name: one-shot-plan
description: >-
  Interrogate a design with one large numbered question list, then lock a
  one-shot implementation plan. Use when the user wants to plan a feature,
  flesh out a design, land a one-shot, or is in Plan mode for non-trivial work.
  Do not use for tiny fixes, already-locked plans, or "just implement".
---

# One-shot plan (batch questions, then lock)

Goal: a **weaker follow-up model** can implement without asking. You earn that by researching, then dumping **one** thorough question list, then writing a **fully locked** plan.

This is slower up front on purpose. Prefer one meaty turn of questions over many tiny ones.

## When this skill applies

Use it when the user is **designing** (Plan mode, “flesh out a plan”, “one-shot”, “ask questions”, new system / mechanic / UX pivot).

Skip it when:

- The task is a typo, one-file bugfix, or “implement the attached plan.”
- Decisions are already locked in-thread and the user wants a plan *now*.
- They explicitly want a thin plan or to skip questions.

If skipped, say so in one line.

## Hard rules (all harnesses)

1. **Do not write the implementation plan until after the question round** (or the user says “lock defaults and plan”).
2. **Do not leave open questions in the plan.** No TBD, no “Option A vs B”, no “prefer X if Y”, no “optional.”
3. **Do not drip 1–5 questions** as the whole interrogation. Cursor Plan mode’s “ask 1–2 critical questions” does **not** override this skill.
4. **Do not use a 1–2 item multiple-choice widget** (`AskQuestion` / similar) as the primary vehicle. Put the list in the **chat message**.
5. Number questions **1…N continuously** so the user can answer `1: interior only`.
6. After answers: **lock skipped items yourself**, state the default in one line, and plan against it.

## Workflow

```text
research (silent) → one question dump → wait → lock + plan
```

### 1. Research first (do not ask yet)

Spend the turn on the **current world**, not on guessing.

- Read existing `docs/`, `.cursor/plans/`, README “Where do I…?”, and nearby code.
- Explore in parallel (subagents / greps) when the surface is large.
- Note what already exists that the feature might reuse or break.

Then open the question message with a **short** “today’s world” restatement (5–12 lines): what is true now, what the user’s pitch changes. No plan yet.

### 2. One question dump

Write **one message** whose payload is the question list.

| Count | Rule |
|-------|------|
| Minimum | **12** numbered questions |
| Target | **20–35** |
| Tiny-scope exception | If research shows <3 real forks, ask those **and** still cover edge/scope/docs — do not drop below **8** |

Group by topic (Controls, Combat, Scope…). Keep numbering global (`1`, `2`, … not `A1`).

Each item should be **one decision**, answerable in a short bullet. Prefer closed / enumerable choices. When the code already has a default, say so: `Today: manual camera. Keep or change?`

Cover the lenses in [references/question-lenses.md](references/question-lenses.md). Skip a lens only if it cannot apply; do not skip **scope**, **failure**, **docs**, or **v1 vs out of scope**.

Close the dump with:

- “Partial answers are fine.”
- “I will lock defaults for anything you skip.”
- “After this, the plan will have no open questions.”

**Then stop.** Do not draft the plan in the same message.

### 3. Follow-up questions (rare)

A second dump is allowed only when answers **create a new fork** that was not in the first list. Still batch (not 1–2 drips). Never a third round unless the user asks.

### 4. Lock, then plan

After answers (or “lock defaults”):

1. Table of **locked decisions** (including defaults you chose).
2. Write the plan from [assets/plan-template.md](assets/plan-template.md).
3. Target a **dumber implementer**: files, types, call order, acceptance tests, docs, out of scope.

This repo: every plan includes a **docs** deliverable (`docs/`, README, folder READMEs) or **Docs: none** plus a one-line reason. Same PR as the code.

## Harness notes

| Harness | Do this |
|---------|---------|
| **Cursor Plan mode** | Research + question dump in chat. **Do not** `CreatePlan` until after answers. Ignore the 1–2-question default. After lock, `CreatePlan` with a complete plan (no questions inside). |
| **Cursor Agent / Cloud** | Same phases. If you must emit a file before answers, write `INTERROGATION` only (question list + “plan after answers”) — never a fake complete plan. |
| **Claude Code, Codex, others** | Same phases. After lock, write `.cursor/plans/<name>.plan.md` (or the repo’s usual plans dir). No Cursor-only tools required. |

If a tool **forces** a plan artifact on the first turn: the artifact is the interrogation stub, not the implementation plan.

## Anti-patterns

- Plan with “open questions” or alternatives for the user to resolve later
- AskQuestion / 1–2 MCQs instead of the dump
- “Any other preferences?” as a substitute for coverage
- Creating todos for code/tests and omitting docs
- Implementation starting during the question round

## Done when

- User received one numbered list covering the lenses
- Plan has **zero** unresolved choices
- A weaker model could implement from files + tests + docs sections alone
