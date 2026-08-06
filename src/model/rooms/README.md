# Rooms (behavioral)

Passive rooms: only `model/blueprints.ts` + library section. Behavioral rooms: one file here + one line in `registry.ts`.

## Add a behavioral room

1. Add blueprint in `model/blueprints.ts` (+ library section in `store/librarySections.ts`).
2. Create `rooms/<name>.ts` exporting a `RoomBehaviorDef`.
3. Register it in `registry.ts`.
4. Use `attack` for cooldown volleys, `tick` for continuous effects, `roles` for identity checks.
5. Side-blast geometry shared by steam / flame turrets → `sideBlast.ts`.
6. Add `<name>.test.ts` (or cover from an existing school/pipes test file).

## Do not put here

- Pipe graph / fluid merge → `model/pipes/`
- Staff capacity → `model/staff/capacity.ts`
- Blueprint costs/HP → `model/blueprints.ts`

Hydrants are registered here, but tick from `spells/water/tick.ts` so fresh spray sheets are processed in the same water-effects frame. Steam and flame turrets use `tick` + charge runtime (not `attack` cooldowns).
