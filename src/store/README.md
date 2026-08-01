# Store

Owns `GameState` + `ViewState`. View dispatches intents; only handlers mutate game state.

```
store/
  store.ts          ← Store class, advance(), dispatch()
  intents.ts        ← Intent + ViewState types
  handlers/         ← one module per intent family
  selectors/        ← UI affordances by domain (build, inspect, spells, logistics, hud)
  librarySections.ts
  buildTools.ts
```

## Add an intent

1. Add a variant to `Intent` in `intents.ts`.
2. Handle it in `handlers/<area>.ts`.
3. Add a selector in `selectors/` if the UI needs derived state.
4. Dispatch from `view/` only — never mutate snapshot.game in the view.

## Do not put here

- Placement / combat rules → `model/`
- Canvas / DOM → `view/`
