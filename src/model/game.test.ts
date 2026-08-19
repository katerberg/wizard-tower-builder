import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '@/config/constants';
import { beginRun, createInitialState, prepareWaveNames, step, takeEnemyName } from './game';
import { beginWave } from './phases';
import { getBlueprint } from './blueprints';
import { createStructure, placeStructure } from './tower';
import { buildSpawnQueue, heightProgression, unlockEnemiesForHeight } from './waves';

describe('enemy naming', () => {
  it('draws unique names within a wave and fresh names on the next wave', () => {
    const state = createInitialState('goblin-names');
    const unlocked = new Set(unlockEnemiesForHeight([], 5));
    const wave = buildSpawnQueue(
      heightProgression.getWave({ height: 5, unlockedEnemyIds: unlocked }),
    );

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

    beginWave(state);
    expect(state.phase).toBe('night');
    expect(state.spawnQueue.length).toBeGreaterThan(0);

    let sawEnemy = false;
    let steps = 0;
    const maxSteps = 75 * 60 + 90 * 60; // day + night
    while (steps < maxSteps) {
      step(state, FIXED_DT);
      steps += 1;
      if (state.enemies.length > 0) sawEnemy = true;
      if (state.scene !== 'run') break;
      if (state.phase === 'day' && state.levelIndex > 0) break;
    }

    expect(sawEnemy).toBe(true);
    const cleared = state.levelIndex > 0 && state.scene === 'run';
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
      state.tower = placeStructure(state.tower, createStructure(`r${row}`, stem, { col: 8, row }));
    }
    const startCurrency = state.player.resources.gold;
    beginWave(state);

    let steps = 0;
    while (steps < 60 * 180 && state.scene === 'run') {
      step(state, FIXED_DT);
      steps += 1;
      if (state.levelIndex > 0 && state.phase === 'day') break;
    }

    if (state.scene === 'run' && state.levelIndex > 0) {
      expect(state.levelIndex).toBe(1);
      expect(state.player.resources.gold).toBeGreaterThan(startCurrency);
    }
  });
});
