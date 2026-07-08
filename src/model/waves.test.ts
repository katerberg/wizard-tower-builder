import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '@/config/constants';
import { createInitialState, step } from '@/model/game';
import { getBlueprint } from '@/model/blueprints';
import { createRoom, placeRoom } from '@/model/tower';
import { buildSpawnQueue, linearProgression } from '@/model/waves';

function tallTower(state: ReturnType<typeof createInitialState>) {
  const stem = getBlueprint('stem')!;
  for (let row = 0; row < 6; row++) {
    state.tower = placeRoom(state.tower, createRoom(`r${row}`, stem, { col: 8, row }));
  }
  return state;
}

describe('wave pacing', () => {
  it('wave 1 spawns a large swarm budget', () => {
    const wave = linearProgression.getWave(0);
    const queue = buildSpawnQueue(wave);
    expect(queue.length).toBeGreaterThanOrEqual(35);
    expect(queue.filter((id) => id === 'swarm').length).toBeGreaterThan(30);
  });

  it('wave 8+ includes elites and many fodder', () => {
    const wave = linearProgression.getWave(7);
    const queue = buildSpawnQueue(wave);
    expect(queue.length).toBeGreaterThan(150);
    expect(queue.some((id) => id === 'elite')).toBe(true);
    expect(queue.filter((id) => id === 'skirmisher').length).toBeGreaterThan(20);
  });

  it('wave 1 on a tall tower lasts at least 30 simulated seconds', () => {
    const state = tallTower(createInitialState('wave-duration-0'));
    state.phase = 'attack';
    state.spawnQueue = buildSpawnQueue(linearProgression.getWave(0));
    state.spawnTimer = 0;

    let steps = 0;
    const minSteps = Math.floor(30 / FIXED_DT);
    while (state.phase === 'attack' && steps < minSteps) {
      step(state, FIXED_DT);
      steps += 1;
    }
    expect(steps).toBeGreaterThanOrEqual(minSteps);
    expect(state.enemies.length + state.spawnQueue.length).toBeGreaterThan(0);
  });
});
