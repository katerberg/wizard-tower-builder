# AGENTS.md

## Cursor Cloud specific instructions

Wizard Tower Builder is a single **frontend** app (TypeScript + Vite + HTML5 Canvas). There is **no backend, database, or environment variables/secrets** — everything runs client-side in the Vite dev server.

Standard commands are documented in `README.md` (Getting started) and `package.json` scripts; use those rather than duplicating here:

- **Always run `nvm use` first** (repo root has `.nvmrc` → Node 20 LTS). Vite 8, Vitest 4, and ESLint 10 require Node 20+; the default shell Node (e.g. 18) will fail tests with `styleText` / `node:util` errors. If `nvm use` reports the version is missing, run `nvm install` once from the repo root.
- `npm run dev` — Vite dev server (defaults to http://localhost:5173/).
- `npm test` — Vitest engine tests.
- `npm run lint` — ESLint **and** `tsc --noEmit` typecheck (the lint script runs both; it also enforces the engine/shell import-layer boundaries described in the README).
- `npm run build` — typecheck + production build to `dist/`.

Non-obvious notes for running/testing:

- Before `npm run lint`, `npm test`, `npm run build`, or `npm run dev`, run `nvm use` from the repo root so the shell matches `.nvmrc`.
- Per `.cursor/rules/verify-before-done.mdc`, no code change is complete until `nvm use && npm run lint && npm test` all exit 0 (this mirrors CI in `.github/workflows/ci.yml`).
- **Before push / PR update:** rebase onto latest `origin/main`, then re-run verification on the rebased branch:
  1. `git fetch origin main && git rebase origin/main` (resolve conflicts on the feature branch).
  2. `nvm use && npm run lint && npm test` — all must exit 0.
  3. `npm run test:balance` — required for PRs (CI `playability` job).
  4. If the branch was already pushed, update the remote with `git push --force-with-lease`.
- Per `.cursor/rules/plans-include-docs.mdc`, every plan must include an explicit docs deliverable (`docs/`, README, or folder READMEs)—or state **Docs: none** with a reason for purely internal work.
- Non-trivial planning: follow `.agents/skills/one-shot-plan/SKILL.md` (one question dump, then a locked plan). Do not drip 1–5 questions or leave TBDs in the plan.
- Task entry points: README **“Where do I…?”** table and short READMEs under `src/model/spells/`, `src/model/rooms/`, `src/config/`, `src/store/`, `src/view/`.
- The app boots **directly into a run's build phase** with a pre-seeded tower — there is no main menu / "New game" screen to click through.
- Core-loop smoke test: pick a blueprint (e.g. `Spire Block`) from the BUILD library, **paint** it on a legal cell (gold/souls from wallet; stone/metal reserved from Storage Room), wait for laborers to build or let dusk freeze it as scaffold, then survive the **night** wave (wizard snaps to crown perch; click empty cells to path, or hotbar+click to cast). Win by clearing a wave while **completed** framing height is still ≥ 100 (`docs/HEIGHT_PROGRESSION.md`). See `docs/DAY_NIGHT.md` and `docs/PLAYER_MOVEMENT.md`.
- Placement onto empty/disconnected cells is rejected ("Cannot build: disconnected"); painting the same blueprint already at that origin is rejected ("Cannot build: already in place"). **Framing** must obey gravity and connect to the single tower mass. Rooms and infra auto-add Spire Blocks when placed on empty legal cells.
