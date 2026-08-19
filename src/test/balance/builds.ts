import { BALANCE_SEEDS, type BalanceBuild } from '@/test/balance/types';
import FIXTURES from './fixtures';

const SLOT_GRANTED_DEFENSE_PLACEMENTS = [
  { blueprintId: 'guardroomRoom', cell: { col: 6, row: 0 } },
  { blueprintId: 'slotRoom', cell: { col: 8, row: 0 } },
  { blueprintId: 'turretRoom', cell: { col: 6, row: 2 } },
  { blueprintId: 'turretRoom', cell: { col: 8, row: 2 } },
] as const;

const SLOT_GRANTED_RECRUITS = [{ cell: { col: 6, row: 0 }, extra: 2 }] as const;
const SLOT_GRANTED_ALLOCS = [{ cell: { col: 8, row: 0 }, count: 2 }] as const;

export const BALANCE_BUILDS: readonly BalanceBuild[] = [
  {
    id: 'bare-starter',
    title: 'Unchanged starter tower (no rooms)',
    expect: 'lose',
    height: 5,
    seeds: BALANCE_SEEDS,
  },
  {
    id: 'slot-granted-defense',
    title: 'Guardroom + Slot + two turrets (Slot research granted, not a legal new-run kit)',
    expect: 'clear',
    height: 5,
    research: ['bp-slot'],
    placements: SLOT_GRANTED_DEFENSE_PLACEMENTS,
    recruits: SLOT_GRANTED_RECRUITS,
    slotAllocations: SLOT_GRANTED_ALLOCS,
    seeds: BALANCE_SEEDS,
  },
  {
    id: 'one-turret',
    title: 'Single turret, no staff — must lose so a global DPS buff cannot flatten wave 1',
    expect: 'lose',
    height: 5,
    placements: [{ blueprintId: 'turretRoom', cell: { col: 6, row: 2 } }],
    seeds: BALANCE_SEEDS,
  },
  /**
   * INTENDED modest early clear (idle, starter kit, no Slot unlock).
   *
   * One Turret Room plus a Guardroom on the starter shaft. Soldiers do not
   * shoot without Slot. Two turrets already razor-clear wave 1 (~2 wizard HP);
   * this weaker legal kit currently DIES to 40 swarm + 1 elite at height 5.
   * That is the wave-1 imbalance, not a harness bug.
   *
   * Combat is asserted with `knownFailing` / Vitest `it.fails` so CI stays
   * green while the intended outcome (`clear`) is still false. After a
   * balance pass actually clears this layout:
   *   1. Remove `knownFailing: true` below.
   *   2. Keep `bare-starter` and `one-turret` losing.
   *
   * Where to tweak (do not scatter numbers in tests):
   *   - src/model/waves.ts          plateau 0 budget / elite slots
   *   - src/model/enemies.ts        swarm / elite HP
   *   - src/config/combat.ts        wand / turret / mana
   *   - src/model/blueprints.ts     STARTING_BLUEPRINT_IDS if Slot becomes starter
   *   - docs/BALANCE.md             how to lock the new numbers
   */
  {
    id: 'starter-kit-legal',
    title: 'Legal starter kit (1 turret + guardroom, no Slot)',
    expect: 'clear',
    knownFailing: true,
    height: 5,
    placements: [
      { blueprintId: 'guardroomRoom', cell: { col: 6, row: 0 } },
      { blueprintId: 'turretRoom', cell: { col: 6, row: 2 } },
    ],
    seeds: BALANCE_SEEDS,
  },
  /**
   * Height-15 scale snapshot. Same Slot-granted defense as wave 1, grown to
   * plateau 15 (strikers unlock). Proves `raiseToHeight` + Start Wave sample
   * the real composition. Combat currently still clears; composition
   * (`waveStartHeight` / strikers in queue) is asserted separately.
   *
   * Knob files if this later fails: same list as `starter-kit-legal`, plus
   * plateau 15 in src/model/waves.ts.
   */
  {
    id: 'scale-height-15',
    title: 'Slot-granted defense grown to height 15',
    expect: 'clear',
    height: 15,
    research: ['bp-slot'],
    placements: SLOT_GRANTED_DEFENSE_PLACEMENTS,
    recruits: SLOT_GRANTED_RECRUITS,
    slotAllocations: SLOT_GRANTED_ALLOCS,
    seeds: BALANCE_SEEDS,
    spawnIncludes: ['striker'],
  },
  ...FIXTURES,
];

export function balanceBuildById(id: string): BalanceBuild {
  const build = BALANCE_BUILDS.find((candidate) => candidate.id === id);
  if (!build) throw new Error(`Unknown balance build: ${id}`);
  return build;
}

