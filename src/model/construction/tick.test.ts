import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '@/config/constants';
import { STARTER_QUARTERS_ROOM_ID } from '@/config/storage';
import { createInitialState } from '@/model/game';
import { step } from '@/model/tick';
import { createBuildOrder, resetConstructionCounter } from './orders';
import { resetConstructionTickCounter } from './tick';

/** Legal extension column east of starter quarters (col 9). */
const EXT_COL = 10;

function advanceDay(state: ReturnType<typeof createInitialState>, seconds: number): void {
  state.phasePaused = true;
  const steps = Math.ceil(seconds / FIXED_DT);
  for (let i = 0; i < steps; i += 1) step(state, FIXED_DT);
}

describe('day construction labor loop', () => {
  it('hauls materials to an unwalkable footprint cell via adjacent drop point', () => {
    resetConstructionCounter();
    resetConstructionTickCounter();
    const state = createInitialState('haul-test');
    const order = createBuildOrder(state, 'stem', { col: EXT_COL, row: 0 }, () => 'built-stem');
    expect(order).not.toBeNull();
    expect(state.storageReservations.length).toBe(1);

    advanceDay(state, 30);

    expect(order!.onSiteMaterials.stone).toBeGreaterThan(0);
  });

  it('hauls for quarters then stem without hanging', () => {
    resetConstructionCounter();
    resetConstructionTickCounter();
    const state = createInitialState('quarters-stem');
    const q = createBuildOrder(state, 'quartersRoom', { col: EXT_COL, row: 0 }, () => 'built-q');
    expect(q).not.toBeNull();

    expect(() => advanceDay(state, 30)).not.toThrow();
    expect(q!.onSiteMaterials.stone).toBeGreaterThan(0);
  });

  it('does not hang with multiple orders and one laborer', () => {
    resetConstructionCounter();
    resetConstructionTickCounter();
    const state = createInitialState('multi-order');
    createBuildOrder(state, 'stem', { col: EXT_COL, row: 0 }, () => 'built-a');
    createBuildOrder(state, 'stem', { col: EXT_COL, row: 1 }, () => 'built-b');

    expect(() => advanceDay(state, 2)).not.toThrow();
    expect(state.staff.length).toBeGreaterThan(0);
  });

  it('spawns laborers when housingRecruited increases during day', () => {
    resetConstructionCounter();
    resetConstructionTickCounter();
    const state = createInitialState('recruit-sync');
    step(state, FIXED_DT);
    expect(state.staff.filter((s) => s.kind === 'laborer')).toHaveLength(1);

    state.housingRecruited[STARTER_QUARTERS_ROOM_ID] = 3;
    step(state, FIXED_DT);
    expect(state.staff.filter((s) => s.kind === 'laborer')).toHaveLength(3);
  });

  it('staggers path assigns when multiple day laborers leave together', () => {
    resetConstructionCounter();
    resetConstructionTickCounter();
    const state = createInitialState('depart-stagger');
    state.housingRecruited[STARTER_QUARTERS_ROOM_ID] = 3;
    step(state, FIXED_DT);

    // Two disconnected wings of the starter base (east of quarters, west of supply).
    const a = createBuildOrder(state, 'stem', { col: EXT_COL, row: 0 }, () => 'built-a');
    const b = createBuildOrder(state, 'stem', { col: 4, row: 0 }, () => 'built-b');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // One tick: assign + haul pathing + one stepStaff — staggered units should not all move.
    step(state, FIXED_DT);

    const assigned = state.staff.filter(
      (s) => s.kind === 'laborer' && s.targetWorkplaceId?.startsWith('construction:'),
    );
    expect(assigned.length).toBeGreaterThanOrEqual(2);
    const keys = assigned.map((s) => `${s.pos.col},${s.pos.row},${s.pathIndex}`);
    // Stream, not a blob: at least two laborers still differ in cell or path progress.
    expect(new Set(keys).size).toBeGreaterThanOrEqual(2);
  });
});
