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
    title: 'Single turret on the covering shaft — must lose wave 1',
    expect: 'lose',
    height: 5,
    placements: [{ blueprintId: 'turretRoom', cell: { col: 8, row: 2 } }],
    seeds: BALANCE_SEEDS,
  },
  /**
   * Legal new-run kit (starter library, no Slot). Guardroom does not shoot
   * without Slot, so this is still one turret of idle DPS — must lose.
   * Two turrets (`double-turret`) are the modest wave-1 clear.
   */
  {
    id: 'starter-kit-legal',
    title: 'Legal starter kit (1 turret + guardroom, no Slot)',
    expect: 'lose',
    height: 5,
    placements: [
      { blueprintId: 'guardroomRoom', cell: { col: 6, row: 0 } },
      { blueprintId: 'turretRoom', cell: { col: 6, row: 2 } },
    ],
    seeds: BALANCE_SEEDS,
  },
  /**
   * INTENDED modest early clear (idle, starter library, no Slot).
   * One turret loses; two turrets hold. Knobs: TURRET_DAMAGE / TURRET_COOLDOWN.
   */
  {
    id: 'double-turret',
    title: 'Two turrets, no staff — modest wave-1 clear',
    expect: 'clear',
    height: 5,
    placements: [
      { blueprintId: 'turretRoom', cell: { col: 6, row: 2 } },
      { blueprintId: 'turretRoom', cell: { col: 8, row: 2 } },
    ],
    seeds: BALANCE_SEEDS,
  },
  /**
   * Height-15 scale snapshot. Same Slot-granted defense as wave 1, grown to
   * plateau 15 (strikers unlock). Proves `raiseToHeight` + Start Wave sample
   * the real composition (`spawnIncludes`). Idle combat loses after the
   * wave-1 turret DPS lock (2 dmg / 2s).
   */
  {
    id: 'scale-height-15',
    title: 'Slot-granted defense grown to height 15',
    expect: 'lose',
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
