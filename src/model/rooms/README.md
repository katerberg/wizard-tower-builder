# Rooms (behavioral)

Passive rooms: only `model/blueprints.ts` + library section. Behavioral rooms: one file here + one line in `registry.ts`.

## Add a behavioral room

1. Add blueprint in `model/blueprints.ts` (+ library section in `store/librarySections.ts`).
2. Create `rooms/<name>.ts` exporting a `RoomBehaviorDef`.
3. Register it in `registry.ts`.
4. Use `attack` for cooldown volleys, `tick` for continuous effects, `onWaveCleared` for end-of-night rituals (e.g. Leyline Research), `roles` for identity checks.
5. Side-blast geometry shared by steam / flame turrets → `sideBlast.ts`.
6. Add `<name>.test.ts` (or cover from an existing school/pipes test file).

**Leyline Research** (`leylineResearch.ts`) uses `onWaveCleared` to complete spell tiers — see [`docs/SPELL_PROGRESSION.md`](../../docs/SPELL_PROGRESSION.md).

## Do not put here

- Pipe graph / fluid merge → `model/pipes/`
- Staff capacity → `model/staff/capacity.ts`
- Blueprint costs/HP → `model/blueprints.ts`

Hydrants are registered here, but tick from `spells/water/tick.ts` so fresh spray sheets are processed in the same water-effects frame. Steam and flame turrets use `tick` + charge runtime (not `attack` cooldowns).
