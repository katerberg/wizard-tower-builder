import { DAY_DURATION, NIGHT_DURATION } from '@/config/dayNight';
import { createInitialState } from '@/model/game';
import { step } from '@/model/tick';
import { FIXED_DT } from '@/config/constants';
import { describe, expect, it } from 'vitest';
import { createBuildOrder } from '@/model/construction';
import { availableInStorage } from '@/model/storage';

describe('day/night cycle', () => {
  it('auto-transitions day to night to day', () => {
    const state = createInitialState('phase-timer');
    expect(state.phase).toBe('day');
    expect(state.dayIndex).toBe(1);

    const daySteps = Math.ceil(DAY_DURATION / FIXED_DT) + 1;
    for (let i = 0; i < daySteps; i += 1) step(state, FIXED_DT);
    expect(state.phase).toBe('night');

    state.enemies = [];
    state.spawnQueue = [];
    const nightSteps = Math.ceil(NIGHT_DURATION / FIXED_DT) + 1;
    for (let i = 0; i < nightSteps; i += 1) step(state, FIXED_DT);
    expect(state.phase).toBe('day');
    expect(state.dayIndex).toBe(2);
  });

  it('reserves storage when painting a build order', () => {
    const state = createInitialState('paint-reserve');
    const availBefore = availableInStorage(state);
    const order = createBuildOrder(state, 'stem', { col: 7, row: 1 }, () => 'test-room');
    expect(order).not.toBeNull();
    const availAfter = availableInStorage(state);
    expect(availAfter.stone).toBeLessThan(availBefore.stone);
  });
});
