import { describe, expect, it } from 'vitest';
import { MAX_MANA } from '@/config/constants';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import { beginWave } from '@/model/phases';
import { applyFireDamage, applyKindled, isKindled } from '@/model/spells/fire/kindled';
import { placeKindlingPatch, onEnemyStepKindling } from '@/model/spells/fire/kindling';
import { startImmolate, tickImmolate } from '@/model/spells/fire/immolate';
import { castSpell, canCastSpell } from '@/model/spells/cast';
import { createRoom, createTower, placeRoom } from '@/model/tower';
import type { Enemy, GameState } from '@/model/types';

function towerWithStem(state: GameState): GameState {
  const stem = getBlueprint('stem')!;
  state.tower = placeRoom(createTower(), createRoom('r0', stem, { col: 8, row: 0 }));
  return state;
}

function makeEnemy(id: string, col: number, row: number, hp = 20): Enemy {
  return {
    id,
    templateId: 'goblin',
    name: 'Test',
    pos: { col, row, face: 'left' },
    path: [],
    pathIndex: 0,
    currentHp: hp,
    moveCooldown: 0,
    attackCooldown: 0,
  };
}

describe('Kindled', () => {
  it('procs flat burst after fire damage then consumes', () => {
    const state = towerWithStem(createInitialState('k0'));
    beginWave(state);
    const enemy = makeEnemy('e1', 8, 1);
    state.enemies.push(enemy);
    applyKindled(state, enemy);
    expect(isKindled(state, 'e1')).toBe(true);
    applyFireDamage(state, enemy, 5, 'Fireball');
    expect(isKindled(state, 'e1')).toBe(false);
    expect(enemy.currentHp).toBeLessThan(20 - 5);
  });
});

describe('Kindling patch', () => {
  it('marks enemy stepping on trap cell', () => {
    const state = towerWithStem(createInitialState('kp0'));
    beginWave(state);
    const trapCell = { col: 7, row: 0 };
    expect(placeKindlingPatch(state, trapCell)).toBe(true);
    const enemy = makeEnemy('e1', 7, 0);
    state.enemies.push(enemy);
    onEnemyStepKindling(state, 7, 0, 'e1');
    expect(isKindled(state, 'e1')).toBe(true);
  });
});

describe('Immolate', () => {
  it('ticks fire damage while active', () => {
    const state = towerWithStem(createInitialState('im0'));
    beginWave(state);
    const enemy = makeEnemy('e1', 8, 1);
    state.enemies.push(enemy);
    startImmolate(state, enemy);
    tickImmolate(state, 0.6);
    expect(enemy.currentHp).toBeLessThan(20);
  });
});

describe('Fire spells cast', () => {
  it('casts kindling on valid trap tile', () => {
    const state = towerWithStem(createInitialState('fc0'));
    beginWave(state);
    const result = castSpell(state, 'kindling', { kind: 'cell', cell: { col: 7, row: 0 } });
    expect(result.ok).toBe(true);
    expect(state.kindlingPatches).toHaveLength(1);
    expect(state.player.mana).toBe(MAX_MANA - 2);
  });

  it('rejects kindling off invalid cell', () => {
    const state = towerWithStem(createInitialState('fc1'));
    beginWave(state);
    const check = canCastSpell(state, 'kindling', { kind: 'cell', cell: { col: 0, row: 5 } });
    expect(check.ok).toBe(false);
  });
});
