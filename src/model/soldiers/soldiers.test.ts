import { describe, expect, it } from 'vitest';
import { SOLDIER_RECRUIT_COST, SOLDIER_UPKEEP_COST } from '@/config/constants';
import { createInitialState } from '@/model/game';
import { getBlueprint } from '@/model/blueprints';
import { createRoom, placeRoom } from '@/model/tower';
import { deploySoldiersForWave, totalRecruitedSoldiers } from '@/model/soldiers';
import { placeInfra } from '@/model/infra';
import { barracksCapacity } from '@/model/soldiers/capacity';

describe('soldier deployment', () => {
  it('charges upkeep and spawns soldiers with paths', () => {
    const state = createInitialState('soldier-test');
    const barracksBp = getBlueprint('barracksRoom')!;
    const slotBp = getBlueprint('slotRoom')!;
    state.tower = placeRoom(state.tower, createRoom('b1', barracksBp, { col: 3, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('s1', slotBp, { col: 3, row: 2 }));
    state.tower = placeInfra(state.tower, { col: 3, row: 0 }, 'stair');
    state.tower = placeInfra(state.tower, { col: 3, row: 1 }, 'stair');
    state.tower = placeInfra(state.tower, { col: 3, row: 2 }, 'stair');

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

describe('recruitment totals', () => {
  it('sums recruited across barracks', () => {
    const state = createInitialState('sum');
    state.barracksRecruited = { b1: 2, b2: 3 };
    expect(totalRecruitedSoldiers(state)).toBe(5);
  });
});
