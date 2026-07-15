# AGENTS.md

## Cursor Cloud specific instructions

Wizard Tower Builder is a single **frontend** app (TypeScript + Vite + HTML5 Canvas). There is **no backend, database, or environment variables/secrets** — everything runs client-side in the Vite dev server.

Standard commands are documented in `README.md` (Getting started) and `package.json` scripts; use those rather than duplicating here:

- `npm run dev` — Vite dev server (defaults to http://localhost:5173/).
- `npm test` — Vitest engine tests.
- `npm run lint` — ESLint **and** `tsc --noEmit` typecheck (the lint script runs both; it also enforces the engine/shell import-layer boundaries described in the README).
- `npm run build` — typecheck + production build to `dist/`.

Non-obvious notes for running/testing:

- Per `.cursor/rules/verify-before-done.mdc`, no code change is complete until `npm run lint && npm test` both exit 0 (this mirrors CI in `.github/workflows/ci.yml`).
- The app boots **directly into a run's build phase** with a pre-seeded tower — there is no main menu / "New game" screen to click through.
- Core-loop smoke test: pick a blueprint (e.g. `Spire Block`) from the BUILD library, place it on a cell resting on the existing structure (gold decreases), then click `Start Wave` to enter the attack phase where enemies climb and the wizard fires.
- Placement onto empty/disconnected cells is rejected ("Cannot build: disconnected"); rooms must obey gravity and connect to the single tower mass.
