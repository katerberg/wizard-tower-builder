# View (shell)

Canvas + DOM. Reads `Snapshot` / selectors; dispatches intents. No game rules here.

```
view/
  loop.ts           ← fixed-timestep attack loop
  input.ts          ← pointer → intents
  theme.ts          ← colors / glyphs (presentation only)
  canvas/
    renderer.ts     ← orchestrates layers
    layers/         ← tower, enemies, staff, spellFx, overlays
  dom/              ← HUD, library, modal, tooltip, spell bar
  styles.css
```

## Add UI chrome

1. Prefer a selector in `store/selectors/` for enable/disable / derived text.
2. Dispatch a typed `Intent` — never mutate `snapshot.game`.
3. Canvas FX for a new spell → `canvas/layers/spellFx.ts`.

## Do not put here

- Balance numbers → `config/` or content defs
- Placement / cast rules → `model/` (+ selectors for affordances)
