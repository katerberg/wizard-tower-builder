# Question lenses

Use these as a **coverage checklist** for the question dump. Not every lens needs many items; each relevant lens needs **at least one** numbered question.

Skip a lens only if it cannot apply (e.g. no camera in a pure engine change). Never skip **scope**, **failure**, **docs**, or **v1 vs out of scope**.

## 1. Scope / topology

Where does the thing live? Which graphs, layers, rooms, phases? What is explicitly **not** walkable / usable / in v1?

## 2. Controls and feel

Input (click, keys, both), speed vs existing units, cancel/repath, interrupt (cast while moving?), build vs attack availability.

## 3. Interaction with existing systems

Staff, enemies, infra (stairs/elevators), spells, Flight, Fortify, inventory, research. Share capacity or bypass? Reuse which APIs?

## 4. Combat, targeting, win/lose

Who is the aggro target? Where is range measured from? Friendly fire? HP ownership? Lose/win conditions that shift?

## 5. Failure and collapse

Destroyed support, disconnected path, full elevator, invalid click, mid-path geometry change. Fall, teleport, die, stuck, message?

## 6. Camera / UX / presentation

Follow vs manual, HUD labels, glyphs, z-order, messages, help modal.

## 7. Identity and data model

New entity vs reuse? Where does state live (`GameState`, `Player`, room)? Persist across waves?

## 8. Lifecycle

Spawn/reset on wave start, build-phase behavior, run restart, undo.

## 9. v1 vs out of scope

Name the MVP slice. List what this PR will **not** do. Confirm.

## 10. Docs and discovery

Which `docs/*.md`, README “Where do I…?”, folder READMEs, modal/help, AGENTS.md smoke test?

## 11. Fantasy / reference (optional but high leverage)

One sentence of player fantasy. One reference game. This prevents a technically correct but tonally wrong one-shot.

## 12. Testing evidence

What proves it works (unit cases, playability, manual smoke)? Any `/no-test` or special harness notes?

---

## Question shape (good vs bad)

**Good**

> 13. Does the wizard **share elevator cars** with staff (capacity 6), get **priority**, or get a **separate / instant ride**?

**Bad**

> How should elevators work?

**Good**

> 20. Camera: keep **manual wheel**, **soft follow**, **hard lock**, or follow-while-moving?

**Bad**

> Thoughts on camera? (and then leave “TBD” in the plan)
