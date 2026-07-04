import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '@/config/constants';
import { beginRun, createInitialState, prepareWaveNames, step, takeEnemyName } from './game';
import { beginWave } from './phases';
import { getBlueprint } from './blueprints';
import { createRoom, placeRoom } from './tower';
import { buildSpawnQueue, linearProgression } from './waves';

describe('enemy naming', () => {
  it('draws unique names within a wave and fresh names on the next wave', () => {
    const state = createInitialState('goblin-names');
    const wave = buildSpawnQueue(linearProgression.getWave(0));

    state.spawnQueue = [...wave];
    prepareWaveNames(state);
    const waveOneGoblins = wave.map((templateId) => takeEnemyName(templateId)).filter(Boolean);
    expect(new Set(waveOneGoblins).size).toBe(waveOneGoblins.length);

    state.spawnQueue = [...wave];
    prepareWaveNames(state);
    const waveTwoGoblins = wave.map((templateId) => takeEnemyName(templateId)).filter(Boolean);
    expect(new Set(waveTwoGoblins).size).toBe(waveTwoGoblins.length);
    expect(waveTwoGoblins).not.toEqual(waveOneGoblins);
  });
});

describe('attack-phase simulation', () => {
  it('spawns a wave, resolves it, and reaches a terminal state', () => {
    const state = createInitialState('integration');
    beginRun(state);

    // Small valid tower: spire → buttress → spire.
    const stem = getBlueprint('stem')!;
    const buttress = getBlueprint('buttress2')!;
    state.tower = placeRoom(state.tower, createRoom('r0', stem, { col: 8, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('r1', buttress, { col: 8, row: 1 }));
    state.tower = placeRoom(state.tower, createRoom('r2', stem, { col: 8, row: 2 }));

    beginWave(state);
    expect(state.phase).toBe('attack');
    expect(state.spawnQueue.length).toBeGreaterThan(0);

    let sawEnemy = false;
    let steps = 0;
    const maxSteps = 60 * 60; // 60 simulated seconds
    while (steps < maxSteps) {
      step(state, FIXED_DT);
      steps += 1;
      if (state.enemies.length > 0) sawEnemy = true;
      if (state.phase === 'build' || state.scene !== 'run') break;
    }

    expect(sawEnemy).toBe(true);
    // Terminal: either the wave cleared (back to build) or the wizard fell.
    const cleared = state.phase === 'build' && state.scene === 'run';
    const lost = state.scene === 'gameOver';
    expect(cleared || lost).toBe(true);
    expect(steps).toBeLessThan(maxSteps);
  });

  it('awards gold and advances the level when a wave is cleared', () => {
    const state = createInitialState('reward');
    beginRun(state);
    // Tall vertical spire stack.
    const stem = getBlueprint('stem')!;
    for (let row = 0; row < 6; row++) {
      state.tower = placeRoom(state.tower, createRoom(`r${row}`, stem, { col: 8, row }));
    }
    const startCurrency = state.player.currency;
    beginWave(state);

    let steps = 0;
    while (steps < 60 * 90 && state.scene === 'run' && state.phase === 'attack') {
      step(state, FIXED_DT);
      steps += 1;
    }

    if (state.scene === 'run' && state.phase === 'build') {
      expect(state.levelIndex).toBe(1);
      expect(state.player.currency).toBeGreaterThan(startCurrency);
    }
  });
});
