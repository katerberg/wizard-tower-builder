# Locked one-shot plan template

Fill every section. Delete a section only if it cannot apply. Do **not** add an “Open questions” section.

```markdown
# <Feature name>

## Fantasy
One or two sentences. Player-facing intent.

## Locked decisions
| Topic | Lock |
|-------|------|
| … | … |

State defaults you chose for skipped answers in this table (mark **default**).

## Architecture
Short data flow. Mermaid if it clarifies. Name the graphs / phases involved.

## Data model
Types/fields to add or migrate. Dual-source warnings (e.g. HP living in two places).

## Runtime
Tick/input/store order. What to reuse vs not mix.

## Casting / combat / other domain
Only the domains this feature touches.

## Docs (same delivery)
Exact files to create or update. Or **Docs: none** + one-line reason.

## Implementation order
Numbered steps a weaker model can follow (types → behavior → UX → docs → lint/test).

## Acceptance tests
Bullet list of observable cases that must pass (including the user’s smoke if any).

## Out of scope
Explicit. If it was tempting, say it is out.
```

## Quality bar for the implementer

- Cite concrete paths (`src/model/tick.ts`, `src/view/input.ts`).
- Name functions to add or retarget.
- Speeds/IDs/constants go in `src/config/` when this repo is the target.
- Tests: file location + the assertions that matter.
- No “optional polish if time.”
