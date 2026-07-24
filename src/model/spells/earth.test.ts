import { describe, expect, it } from 'vitest';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import { beginWave } from '@/model/phases';
import {
  addCharge,
  canCastSpell,
  castSpell,
  getCharge,
  isFortified,
  mitigateWizardDamage,
  roomIdAtCell,
  setActiveSpellSchool,
  supportSpineToGround,
  listHotbarSpells,
} from '@/model/spells';
import { addFaultPatch, runFaultPatchStepEffects } from '@/model/spells/earth/fault';
import { clearFortify, startFortify } from '@/model/spells/earth/fortify';
import { tickBoulders, queueBoulder } from '@/model/spells/earth/boulder';
import { buildSpellContext } from '@/model/spells/cast';
import { createStructure, createTower, placeStructure } from '@/model/tower';
import type { GameState } from '@/model/types';
import { makeTestEnemy } from '@/test/subCells';

function towerWithStem(state: GameState): GameState {
  const stem = getBlueprint('stem')!;
  state.tower = placeStructure(createTower(), createStructure('r0', stem, { col: 8, row: 0 }));
  return state;
}

function towerStack(state: GameState): GameState {
  const stem = getBlueprint('stem')!;
  let tower = createTower();
  tower = placeStructure(tower, createStructure('r0', stem, { col: 8, row: 0 }));
  tower = placeStructure(tower, createStructure('r1', stem, { col: 8, row: 1 }));
  tower = placeStructure(tower, createStructure('r2', stem, { col: 8, row: 2 }));
  state.tower = tower;
  return state;
}

function enemyAt(macroCol: number, macroRow: number, hp = 28) {
  return makeTestEnemy(macroCol, macroRow, { templateId: 'elite', hp });
}

describe('Charge meter', () => {
  it('adds and spends Charge', () => {
    const state = towerWithStem(createInitialState('c0'));
    beginWave(state);
    setActiveSpellSchool(state, 'earth');
    addCharge(state, 3);
    expect(getCharge(state)).toBe(3);
  });
});

describe('Fault', () => {
  it('feeds Charge on enemy pass', () => {
    const state = towerWithStem(createInitialState('f0'));
    beginWave(state);
    addFaultPatch(state, { col: 7, row: 0 });
    const enemy = enemyAt(7, 0);
    state.enemies.push(enemy);
    runFaultPatchStepEffects(state, enemy);
    expect(getCharge(state)).toBe(1);
  });

  it('casts fault on valid adjacent cell', () => {
    const state = towerWithStem(createInitialState('f1'));
    beginWave(state);
    setActiveSpellSchool(state, 'earth');
    const result = castSpell(state, 'fault', { kind: 'cell', cell: { col: 7, row: 0 } });
    expect(result.ok).toBe(true);
    expect(state.faultPatches.length).toBe(1);
  });
});

describe('Fortify', () => {
  it('mitigates damage to 25%', () => {
    const state = towerWithStem(createInitialState('fo0'));
    beginWave(state);
    startFortify(state);
    expect(isFortified(state)).toBe(true);
    expect(mitigateWizardDamage(state, 8)).toBe(2);
    clearFortify(state);
    expect(mitigateWizardDamage(state, 8)).toBe(8);
  });

  it('blocks Fault while concentrating', () => {
    const state = towerWithStem(createInitialState('fo1'));
    beginWave(state);
    castSpell(state, 'fortify', { kind: 'self' });
    const check = canCastSpell(state, 'fault', { kind: 'cell', cell: { col: 7, row: 0 } });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('concentrating');
  });

  it('auto-breaks into Boulder then casts', () => {
    const state = towerWithStem(createInitialState('fo2'));
    beginWave(state);
    castSpell(state, 'fortify', { kind: 'self' });
    addCharge(state, 2);
    expect(isFortified(state)).toBe(true);
    const result = castSpell(state, 'boulder', { kind: 'cell', cell: { col: 8, row: 1 } });
    expect(result.ok).toBe(true);
    expect(isFortified(state)).toBe(false);
    expect(state.pendingBoulders).toHaveLength(1);
  });
});

describe('Boulder', () => {
  it('requires Charge to cast', () => {
    const state = towerWithStem(createInitialState('b0'));
    beginWave(state);
    const check = canCastSpell(state, 'boulder', { kind: 'cell', cell: { col: 8, row: 1 } });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('no_charge');
  });

  it('queues a delayed impact and hits enemy', () => {
    const state = towerWithStem(createInitialState('b1'));
    beginWave(state);
    addCharge(state, 2);
    const enemy = enemyAt(8, 1, 40);
    state.enemies.push(enemy);
    queueBoulder(state, { col: 8, row: 1 });
    expect(getCharge(state)).toBe(0);
    expect(state.pendingBoulders).toHaveLength(1);
    state.waveTimer = state.pendingBoulders[0].impactAt;
    tickBoulders(state, 0, buildSpellContext(state, 'Boulder'));
    expect(enemy.currentHp).toBeLessThan(40);
  });

  it('continues falling at an angle on miss until crash', () => {
    const state = towerWithStem(createInitialState('b2'));
    beginWave(state);
    addCharge(state, 2);
    // Aim above/beside the stem into empty air so impact misses
    queueBoulder(state, { col: 10, row: 3 });
    state.waveTimer = state.pendingBoulders[0].impactAt;
    tickBoulders(state, 0, buildSpellContext(state, 'Boulder'));
    expect(state.pendingBoulders).toHaveLength(1);
    expect(state.pendingBoulders[0].phase).toBe('falling');

    // Step until crash (ground or room)
    for (let i = 0; i < 40 && state.pendingBoulders.length > 0; i++) {
      state.waveTimer += 0.2;
      tickBoulders(state, 0.2, buildSpellContext(state, 'Boulder'));
    }
    expect(state.pendingBoulders).toHaveLength(0);
  });
});

describe('Earthquake', () => {
  it('builds support spine tip to ground', () => {
    const state = towerStack(createInitialState('eq0'));
    const tipId = roomIdAtCell(state.tower, { col: 8, row: 2 });
    expect(tipId).toBeTruthy();
    const spine = supportSpineToGround(state.tower, tipId!);
    expect(spine.length).toBeGreaterThanOrEqual(2);
    expect(spine[0].id).toBe(tipId);
  });

  it('damages rooms along the spine', () => {
    const state = towerStack(createInitialState('eq1'));
    beginWave(state);
    addCharge(state, 3);
    const tipHpBefore = state.tower.structures.find((r) => r.id === 'r2')!.hp;
    const result = castSpell(state, 'earthquake', { kind: 'cell', cell: { col: 8, row: 2 } });
    expect(result.ok).toBe(true);
    const tip = state.tower.structures.find((r) => r.id === 'r2');
    expect(tip).toBeTruthy();
    expect(tip!.hp).toBeLessThan(tipHpBefore);
  });
});

describe('Earth hotbar', () => {
  it('lists earth kit when school is earth', () => {
    const state = createInitialState('hb0');
    setActiveSpellSchool(state, 'earth');
    const ids = listHotbarSpells(state).map((s) => s.id);
    expect(ids).toEqual(['fault', 'fortify', 'boulder', 'earthquake']);
  });
});
