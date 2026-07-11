import { describe, expect, it } from 'vitest';
import { MAX_MANA } from '@/config/constants';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import { beginWave } from '@/model/phases';
import {
  canCastSpell,
  castSpell,
  refillMana,
  resetSpellCooldowns,
  spellCooldownRemaining,
} from '@/model/spells';
import { createRoom, createTower, placeRoom } from '@/model/tower';
import type { GameState } from '@/model/types';
import { makeTestEnemy } from '@/test/subCells';

function towerWithStem(state: GameState): GameState {
  const stem = getBlueprint('stem')!;
  state.tower = placeRoom(createTower(), createRoom('r0', stem, { col: 8, row: 0 }));
  return state;
}

function makeEnemy(macroCol: number, macroRow: number, hp = 28) {
  return makeTestEnemy(macroCol, macroRow, { hp });
}

describe('mana', () => {
  it('starts at max mana', () => {
    const state = createInitialState('mana0');
    expect(state.player.mana).toBe(MAX_MANA);
    expect(state.player.maxMana).toBe(MAX_MANA);
  });

  it('refills mana when a wave begins', () => {
    const state = towerWithStem(createInitialState('mana1'));
    state.player.mana = 2;
    beginWave(state);
    expect(state.player.mana).toBe(MAX_MANA);
    expect(state.spellCooldowns).toEqual({});
  });
});

describe('fireball casting', () => {
  it('spends mana and starts cooldown on a valid cast', () => {
    const state = towerWithStem(createInitialState('fb0'));
    state.phase = 'attack';
    const cell = { col: 8, row: 1 };

    const result = castSpell(state, 'fireball', { kind: 'cell', cell });
    expect(result.ok).toBe(true);
    expect(state.player.mana).toBe(MAX_MANA - 4);
    expect(spellCooldownRemaining(state, 'fireball')).toBe(2);
  });

  it('rejects cast when out of mana', () => {
    const state = towerWithStem(createInitialState('fb1'));
    state.phase = 'attack';
    state.player.mana = 3;

    const result = castSpell(state, 'fireball', { kind: 'cell', cell: { col: 8, row: 1 } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_mana');
  });

  it('rejects cast when on cooldown', () => {
    const state = towerWithStem(createInitialState('fb2'));
    state.phase = 'attack';
    state.spellCooldowns.fireball = 1.5;

    const result = canCastSpell(state, 'fireball', { kind: 'cell', cell: { col: 8, row: 1 } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('on_cooldown');
  });

  it('rejects cast when target is out of range', () => {
    const state = towerWithStem(createInitialState('fb3'));
    state.phase = 'attack';

    const result = canCastSpell(state, 'fireball', { kind: 'cell', cell: { col: 0, row: 0 } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('out_of_range');
  });

  it('damages enemies in the 3×3 blast', () => {
    const state = towerWithStem(createInitialState('fb4'));
    state.phase = 'attack';
    const enemy = makeEnemy(8, 1);
    state.enemies = [enemy];

    castSpell(state, 'fireball', { kind: 'cell', cell: { col: 8, row: 1 } });
    expect(enemy.currentHp).toBeLessThan(28);
  });

  it('does not damage enemies outside the blast', () => {
    const state = towerWithStem(createInitialState('fb5'));
    state.phase = 'attack';
    const far = makeEnemy(8, 5);
    state.enemies = [far];

    castSpell(state, 'fireball', { kind: 'cell', cell: { col: 8, row: 1 } });
    expect(far.currentHp).toBe(28);
  });

  it('damages the wizard when the blast includes their perch', () => {
    const state = towerWithStem(createInitialState('fb6'));
    state.phase = 'attack';
    const wizardHp = state.player.wizard.hp;

    castSpell(state, 'fireball', { kind: 'cell', cell: { col: 8, row: 1 } });
    expect(state.player.wizard.hp).toBe(wizardHp - 12);
  });
});

describe('spell cooldown helpers', () => {
  it('resetSpellCooldowns clears all entries', () => {
    const state = createInitialState('cd0');
    state.spellCooldowns = { fireball: 2, wandStrike: 0.5 };
    resetSpellCooldowns(state);
    expect(state.spellCooldowns).toEqual({});
  });

  it('refillMana restores current to max', () => {
    const state = createInitialState('cd1');
    state.player.mana = 1;
    refillMana(state);
    expect(state.player.mana).toBe(MAX_MANA);
  });
});
