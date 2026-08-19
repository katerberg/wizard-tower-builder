import { describe, expect, it } from 'vitest';
import { FLAME_TURRET_CHARGE_SEC, TURRET_MANA_RESERVATION } from '@/config/constants';
import { restoreTurretMana } from '../rooms/turret';
import { getBlueprint } from '../blueprints';
import { createInitialState } from '../game';
import { placeInfra } from '../infra';
import {
  flameTurretBlastCells,
  resetFlameTurretRuntime,
  tickFlameTurrets,
} from '../rooms/flameTurret';
import { getRoomBehavior } from '../rooms';
import { isKindled } from '../spells/fire/kindled';
import { createRoom, createTower, placeRoom } from '../tower';
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
  state.tower = createTower();
  const room = createRoom('r0', getBlueprint(blueprintId)!, { col: 8, row: 0 });
  if (mod) room.modifications.push(mod);
  state.tower = placeRoom(state.tower, room);
  return state;
}

function stateWithFlameTurret(seed: string): GameState {
  const state = createInitialState(seed);
  // Elevated fire run (row 1): ground pipes are always water, so forge heat stays off row 0.
  // Turret at (8,1) has open right face for side blast; left is blocked by pipe stems.
  for (const col of [5, 6, 7, 8]) {
    state.tower = placeRoom(
      state.tower,
      createRoom(`g${col}`, getBlueprint('stem')!, { col, row: 0 }),
    );
  }
  state.tower = placeRoom(
    state.tower,
    createRoom('forge', getBlueprint('forgeRoom')!, { col: 5, row: 1 }),
  );
  state.tower = placeRoom(state.tower, createRoom('p6', getBlueprint('stem')!, { col: 6, row: 1 }));
  state.tower = placeRoom(state.tower, createRoom('p7', getBlueprint('stem')!, { col: 7, row: 1 }));
  state.tower = placeRoom(
    state.tower,
    createRoom('r0', getBlueprint('flameTurretRoom')!, { col: 8, row: 1 }),
  );
  state.tower = placeInfra(state.tower, { col: 6, row: 1 }, 'pipe');
  state.tower = placeInfra(state.tower, { col: 7, row: 1 }, 'pipe');
  state.phase = 'attack';
  resetFlameTurretRuntime(state);
  return state;
}

function chargeAndDump(state: GameState): void {
  tickFlameTurrets(state, FLAME_TURRET_CHARGE_SEC + 0.01);
}

describe('turret room effect', () => {
  it('damages the nearest enemy within range', () => {
    const state = stateWithRoom('turret', 'turretRoom');
    state.phase = 'attack';
    const { reset } = getRoomBehavior('turretRoom')!;
    reset?.(state);
    const elite = makeEnemy('elite', 8, 2, 28);
    state.enemies = [elite];

    for (let i = 0; i < 5; i++) runRoomEffects(state, 1.0);

    expect(elite.currentHp).toBeLessThan(28);
  });

  it('does not spend mana per shot (reserved at wave start)', () => {
    const state = stateWithRoom('turret-mana', 'turretRoom');
    state.phase = 'attack';
    const beforeMax = state.player.maxMana;
    const { reset } = getRoomBehavior('turretRoom')!;
    reset?.(state);
    expect(state.player.maxMana).toBe(beforeMax - TURRET_MANA_RESERVATION);
    const elite = makeEnemy('elite', 8, 2, 28);
    state.enemies = [elite];
    const before = state.player.mana;
    runRoomEffects(state, 1.0);
    expect(state.player.mana).toBe(before);
  });

  it('is depowered when maxMana is insufficient', () => {
    const state = stateWithRoom('turret-depower', 'turretRoom');
    state.phase = 'attack';
    state.player.maxMana = 3; // Less than TURRET_MANA_RESERVATION (5)
    const { reset } = getRoomBehavior('turretRoom')!;
    reset?.(state);
    const elite = makeEnemy('elite', 8, 2, 28);
    state.enemies = [elite];
    runRoomEffects(state, 1.0);
    expect(elite.currentHp).toBe(28);
  });

  it('restores reserved maxMana at wave end', () => {
    const state = stateWithRoom('turret-restore', 'turretRoom');
    const baseline = state.player.maxMana;
    const { reset } = getRoomBehavior('turretRoom')!;
    reset?.(state);
    expect(state.player.maxMana).toBe(baseline - TURRET_MANA_RESERVATION);
    restoreTurretMana(state);
    expect(state.player.maxMana).toBe(baseline);
  });

  it('ignores enemies beyond range', () => {
    const state = stateWithRoom('turret-range', 'turretRoom');
    state.phase = 'attack';
    const { reset } = getRoomBehavior('turretRoom')!;
    reset?.(state);
    const far = makeEnemy('elite', 8, 9, 28);
    state.enemies = [far];

    for (let i = 0; i < 5; i++) runRoomEffects(state, 1.0);

    expect(far.currentHp).toBe(28);
  });
});

describe('flame turret room effect', () => {
  it('charges then blasts an open side, Kindling every hit', () => {
    const state = stateWithFlameTurret('flame-turret');
    const a = makeEnemy('brute', 9, 1, 55);
    const b = makeEnemy('elite', 9, 2, 28);
    state.enemies = [a, b];

    tickFlameTurrets(state, FLAME_TURRET_CHARGE_SEC * 0.5);
    expect(state.flameTurretRuntime.r0.charge).toBeGreaterThan(0);
    expect(state.flameTurretRuntime.r0.charge).toBeLessThan(1);
    expect(a.currentHp).toBe(55);

    chargeAndDump(state);

    expect(a.currentHp).toBeLessThan(55);
    expect(b.currentHp).toBeLessThan(28);
    expect(isKindled(a, state)).toBe(true);
    expect(isKindled(b, state)).toBe(true);
    expect(state.flameTurretRuntime.r0.charge).toBe(0);
  });

  it('blasts the open right lane like a steam turret', () => {
    const state = stateWithFlameTurret('flame-blast');
    const blast = flameTurretBlastCells(state.tower, { col: 8, row: 1 });
    expect(blast.some((c) => c.col === 9 && c.row === 1)).toBe(true);
    expect(blast.some((c) => c.col === 7 && c.row === 1)).toBe(false);
  });

  it('refreshes the Kindled timer on another successful blast', () => {
    const state = stateWithFlameTurret('flame-turret-refresh');
    const brute = makeEnemy('brute', 9, 1, 55);
    state.enemies = [brute];

    chargeAndDump(state);
    const firstExpiry = brute.kindledUntil;
    state.waveTimer = 5;
    chargeAndDump(state);

    expect(brute.kindledUntil).toBeGreaterThan(firstExpiry!);
  });

  it('does not dump or Kindle when mana is empty', () => {
    const state = stateWithFlameTurret('flame-turret-dry');
    const elite = makeEnemy('elite', 9, 1, 28);
    state.enemies = [elite];
    state.player.mana = 0;

    chargeAndDump(state);

    expect(elite.currentHp).toBe(28);
    expect(isKindled(elite, state)).toBe(false);
    expect(state.flameTurretRuntime.r0.charge).toBe(1);
  });

  it('does not charge without a fire-connected Forge', () => {
    const state = stateWithRoom('flame-turret-forge', 'flameTurretRoom');
    state.phase = 'attack';
    resetFlameTurretRuntime(state);
    const brute = makeEnemy('brute', 9, 0, 55);
    state.enemies = [brute];
    const manaBefore = state.player.mana;

    chargeAndDump(state);

    expect(brute.currentHp).toBe(55);
    expect(isKindled(brute, state)).toBe(false);
    expect(state.player.mana).toBe(manaBefore);
    expect(state.flameTurretRuntime.r0.chargeRate).toBe(0);
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

describe('wave-clear room effects', () => {
  it('does nothing for rooms without a wave-clear hook', () => {
    const state = stateWithRoom('none', 'stem', { id: 'spikes', level: 1 });
    const before = { ...state.player.resources };

    runWaveClearedEffects(state);

    expect(state.player.resources).toEqual(before);
  });
});
