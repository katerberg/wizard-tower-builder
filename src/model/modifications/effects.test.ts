import { describe, expect, it } from 'vitest';
import { getBlueprint } from '../blueprints';
import { createInitialState } from '../game';
import { createRoom, placeRoom } from '../tower';
import { runEnemyStepEffects, runRoomEffects, runWaveClearedEffects } from './effects';
import type { GameState } from '../types';
import { makeTestEnemy, subAt } from '@/test/subCells';

function makeEnemy(templateId: string, macroCol: number, macroRow: number, hp: number) {
  return makeTestEnemy(macroCol, macroRow, { templateId, hp });
}

function stateWithRoom(
  seed: string,
  blueprintId: string,
  mod?: { id: string; level: number },
): GameState {
  const state = createInitialState(seed);
  const room = createRoom('r0', getBlueprint(blueprintId)!, { col: 8, row: 0 });
  if (mod) room.modifications.push(mod);
  state.tower = placeRoom(state.tower, room);
  return state;
}

describe('turret room effect', () => {
  it('damages the nearest enemy within range', () => {
    const state = stateWithRoom('turret', 'turretRoom');
    const elite = makeEnemy('elite', 8, 2, 28);
    state.enemies = [elite];

    for (let i = 0; i < 5; i++) runRoomEffects(state, 1.0);

    expect(elite.currentHp).toBeLessThan(28);
  });

  it('ignores enemies beyond range', () => {
    const state = stateWithRoom('turret-range', 'turretRoom');
    const far = makeEnemy('elite', 8, 9, 28);
    state.enemies = [far];

    for (let i = 0; i < 5; i++) runRoomEffects(state, 1.0);

    expect(far.currentHp).toBe(28);
  });
});

describe('spikes effect', () => {
  it('damages an enemy when they step onto a spiked surface', () => {
    const state = stateWithRoom('spikes-multi', 'stem', { id: 'spikes', level: 1 });
    const enemy = makeEnemy('elite', 8, 5, 28);
    state.enemies = [enemy];

    runEnemyStepEffects(state, enemy);
    expect(enemy.currentHp).toBe(28);

    enemy.pos = { ...subAt(7, 0), face: 'left' };
    runEnemyStepEffects(state, enemy);
    expect(enemy.currentHp).toBeLessThan(28);
  });

  it('damages again on each step along a spiked wall', () => {
    const state = createInitialState('spikes-multi');
    const bottom = createRoom('r0', getBlueprint('stem')!, { col: 8, row: 0 });
    bottom.modifications.push({ id: 'spikes', level: 1 });
    const top = createRoom('r1', getBlueprint('stem')!, { col: 8, row: 1 });
    top.modifications.push({ id: 'spikes', level: 1 });
    state.tower = placeRoom(placeRoom(state.tower, bottom), top);

    const enemy = makeEnemy('elite', 7, 0, 28);
    state.enemies = [enemy];

    runEnemyStepEffects(state, enemy);
    const afterFirst = enemy.currentHp;

    enemy.pos = { ...subAt(7, 1), face: 'left' };
    runEnemyStepEffects(state, enemy);
    expect(enemy.currentHp).toBeLessThan(afterFirst);
  });

  it('does not damage enemies who never step near the room', () => {
    const state = stateWithRoom('spikes-far', 'stem', { id: 'spikes', level: 1 });
    const distant = makeEnemy('elite', 8, 5, 28);
    state.enemies = [distant];

    runEnemyStepEffects(state, distant);
    expect(distant.currentHp).toBe(28);
  });
});

describe('gold mine room effect', () => {
  it('grants income when a wave is cleared', () => {
    const state = stateWithRoom('gold', 'goldMineRoom');
    const before = state.player.currency;

    runWaveClearedEffects(state);

    expect(state.player.currency).toBe(before + 4);
  });

  it('does nothing for rooms without a wave-clear hook', () => {
    const state = stateWithRoom('gold-none', 'stem', { id: 'spikes', level: 1 });
    const before = state.player.currency;

    runWaveClearedEffects(state);

    expect(state.player.currency).toBe(before);
  });
});
