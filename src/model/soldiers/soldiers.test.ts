import { describe, expect, it } from 'vitest';
import { SOLDIER_RECRUIT_COST, SOLDIER_UPKEEP_COST } from '@/config/constants';
import { createInitialState } from '@/model/game';
import { getBlueprint } from '@/model/blueprints';
import { createRoom, placeRoom } from '@/model/tower';
import {
  deploySoldiersForWave,
  seedSpecialtyRoomDefaults,
  stepSoldiers,
  totalRecruitedSoldiers,
} from '@/model/soldiers';
import { placeInfra } from '@/model/infra';
import { barracksCapacity } from '@/model/soldiers/capacity';

function towerWithStairShaft() {
  const state = createInitialState('soldier-stairs');
  const barracksBp = getBlueprint('barracksRoom')!;
  const slotBp = getBlueprint('slotRoom')!;
  state.tower = placeRoom(state.tower, createRoom('b1', barracksBp, { col: 3, row: 0 }));
  state.tower = placeRoom(state.tower, createRoom('s1', slotBp, { col: 3, row: 2 }));
  state.tower = placeInfra(state.tower, { col: 3, row: 0 }, 'stair');
  state.tower = placeInfra(state.tower, { col: 3, row: 1 }, 'stair');
  state.tower = placeInfra(state.tower, { col: 3, row: 2 }, 'stair');
  return state;
}

describe('specialty room defaults', () => {
  it('seeds one recruit and one slot allocation', () => {
    const state = createInitialState('seed-defaults');
    const barracks = createRoom('b1', getBlueprint('barracksRoom')!, { col: 4, row: 0 });
    const slot = createRoom('s1', getBlueprint('slotRoom')!, { col: 10, row: 0 });
    seedSpecialtyRoomDefaults(state, barracks);
    seedSpecialtyRoomDefaults(state, slot);
    expect(state.barracksRecruited.b1).toBe(1);
    expect(state.slotAllocations.s1).toBe(1);
  });
});

describe('soldier deployment', () => {
  it('charges upkeep and spawns soldiers with paths', () => {
    const state = towerWithStairShaft();
    state.barracksRecruited.b1 = 2;
    state.slotAllocations.s1 = 1;
    state.buildRecruitSpend = SOLDIER_RECRUIT_COST * 2;
    const before = state.player.currency;

    deploySoldiersForWave(state);

    expect(state.soldiers.length).toBe(1);
    expect(state.player.currency).toBe(before - SOLDIER_UPKEEP_COST);
    expect(state.soldiers[0].path.length).toBeGreaterThan(0);
  });

  it('respects barracks capacity', () => {
    const room = createRoom('b1', getBlueprint('barracksRoom')!, { col: 0, row: 0 });
    expect(barracksCapacity(room)).toBe(5);
  });
});

describe('soldier stair queuing', () => {
  it('keeps a second climber waiting until the column lock clears', () => {
    const state = towerWithStairShaft();
    state.barracksRecruited.b1 = 2;
    state.slotAllocations.s1 = 2;
    state.buildRecruitSpend = SOLDIER_RECRUIT_COST * 2;

    deploySoldiersForWave(state);
    expect(state.soldiers).toHaveLength(2);

    const [first, second] = state.soldiers;
    expect(first.pos).toEqual({ col: 3, row: 0 });
    expect(second.pos).toEqual({ col: 3, row: 0 });

    // Clear stagger so the lead soldier can move immediately.
    first.moveCooldown = 0;
    second.moveCooldown = 0;

    stepSoldiers(state, 1);
    expect(first.pos).toEqual({ col: 3, row: 1 });
    expect(first.stairColumn).toBe(3);
    expect(state.stairColumnLocks[3]).toBe(first.id);
    // Second is blocked from entering the occupied stair cell / busy column.
    expect(second.pos).toEqual({ col: 3, row: 0 });

    // Keep the follower waiting while the lead finishes the climb.
    second.moveCooldown = 99;
    first.moveCooldown = 0;
    stepSoldiers(state, 1);
    expect(first.status).toBe('stationed');
    expect(first.pos).toEqual({ col: 3, row: 2 });
    expect(second.pos).toEqual({ col: 3, row: 0 });
    expect(state.stairColumnLocks[3]).toBeUndefined();

    second.moveCooldown = 0;
    stepSoldiers(state, 1);
    expect(second.pos).toEqual({ col: 3, row: 1 });
    expect(state.stairColumnLocks[3]).toBe(second.id);
  });

  it('allows multiple stationed soldiers to share the destination slot', () => {
    const state = towerWithStairShaft();
    state.barracksRecruited.b1 = 2;
    state.slotAllocations.s1 = 2;
    state.buildRecruitSpend = SOLDIER_RECRUIT_COST * 2;
    deploySoldiersForWave(state);

    for (let i = 0; i < 20; i++) {
      for (const s of state.soldiers) s.moveCooldown = 0;
      stepSoldiers(state, 1);
    }

    expect(state.soldiers.every((s) => s.status === 'stationed')).toBe(true);
    expect(state.soldiers.every((s) => s.pos.col === 3 && s.pos.row === 2)).toBe(true);
    expect(state.stairColumnLocks).toEqual({});
  });

  it('deserts unpaid soldiers from the barracks roster', () => {
    const state = towerWithStairShaft();
    state.barracksRecruited.b1 = 1;
    state.slotAllocations.s1 = 1;
    state.player.currency = 0;

    deploySoldiersForWave(state);

    expect(state.soldiers).toHaveLength(0);
    expect(state.barracksRecruited.b1).toBe(0);
  });
});

describe('recruitment totals', () => {
  it('sums recruited across barracks', () => {
    const state = createInitialState('sum');
    state.barracksRecruited = { b1: 2, b2: 3 };
    expect(totalRecruitedSoldiers(state)).toBe(5);
  });
});
