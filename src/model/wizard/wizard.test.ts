import { describe, expect, it } from 'vitest';
import { getBlueprint } from '@/model/blueprints';
import { beginWave } from '@/model/phases';
import { createInitialState } from '@/model/game';
import { step } from '@/model/tick';
import {
  createStructure,
  createTower,
  getWizardPosition,
  placeStructure,
} from '@/model/tower';
import { placeInfra } from '@/model/infra';
import { castSpell, mitigateCollectorDamage } from '@/model/spells';
import { startFortify } from '@/model/spells/earth/fortify';
import {
  beginWizardFall,
  setWizardDestination,
  snapWizardToPerch,
  stepWizard,
} from '@/model/wizard';
import { findWizardMacroPath } from '@/calculations/wizardPathfinding';
import { isWizardWalkable } from '@/calculations/wizardGraph';
import { macroCellOfNode } from '@/calculations/subGrid';
import { attackCollector } from '@/model/enemies/flierCombat';
import { getEnemyTemplate } from '@/model/enemies';
import type { Enemy, GameState } from '@/model/types';
import { SUB_CELLS_PER_MACRO } from '@/config/constants';

function tallTower(): GameState {
  const state = createInitialState('wiz-move');
  const stem = getBlueprint('stem')!;
  let tower = createTower();
  for (let row = 0; row < 3; row++) {
    tower = placeStructure(tower, createStructure(`r${row}`, stem, { col: 8, row }));
  }
  tower = placeStructure(tower, createStructure('side', stem, { col: 7, row: 0 }));
  tower = placeInfra(tower, { col: 8, row: 0 }, 'stair');
  tower = placeInfra(tower, { col: 8, row: 1 }, 'stair');
  state.tower = tower;
  snapWizardToPerch(state);
  return state;
}

describe('solar collector combat', () => {
  it('loses when collector HP reaches 0', () => {
    const state = createInitialState('lose');
    beginWave(state);
    state.solarCollector.hp = 0;
    step(state, 0.1);
    expect(state.scene).toBe('gameOver');
  });

  it('Fortify mitigates collector damage', () => {
    const state = createInitialState('fort');
    beginWave(state);
    startFortify(state);
    expect(mitigateCollectorDamage(state, 8)).toBe(2);
  });

  it('enemies damaging the collector reduce its HP', () => {
    const state = createInitialState('atk');
    beginWave(state);
    const template = getEnemyTemplate('swarm')!;
    const enemy: Enemy = {
      id: 'e1',
      templateId: 'swarm',
      name: 'Test',
      pos: getWizardPosition(state.tower),
      path: [],
      pathIndex: 0,
      currentHp: 10,
      moveCooldown: 0,
      attackCooldown: 0,
    };
    const before = state.solarCollector.hp;
    attackCollector(state, enemy, template, state.player.wizard, mitigateCollectorDamage, 1);
    expect(state.solarCollector.hp).toBeLessThan(before);
  });
});

describe('wizard movement', () => {
  it('starts at crown perch on wave begin', () => {
    const state = tallTower();
    beginWave(state);
    const perch = getWizardPosition(state.tower);
    expect(state.wizardAvatar.pos.col).toBe(perch.col);
    expect(state.wizardAvatar.pos.row).toBe(perch.row);
  });

  it('paths horizontally on framing and ground', () => {
    const state = tallTower();
    beginWave(state);
    const ok = setWizardDestination(state, { col: 7, row: 0 });
    expect(ok).toBe(true);
    expect(state.wizardAvatar.macroPath.length).toBeGreaterThan(1);
  });

  it('cannot path vertically without stairs', () => {
    const state = createInitialState('nostair');
    const stem = getBlueprint('stem')!;
    let tower = createTower();
    tower = placeStructure(tower, createStructure('r0', stem, { col: 8, row: 0 }));
    tower = placeStructure(tower, createStructure('r1', stem, { col: 8, row: 1 }));
    state.tower = tower;
    const path = findWizardMacroPath(tower, { col: 8, row: 0 }, { col: 8, row: 1 });
    expect(path.length).toBe(0);
  });

  it('ground row-0 cells are walkable without structure', () => {
    const state = createInitialState('ground');
    expect(isWizardWalkable(state.tower, 0, 0)).toBe(true);
  });

  it('falls after Flight ends without damaging collector', () => {
    const state = tallTower();
    beginWave(state);
    state.devMode = true;
    state.activeSpellSchool = 'air';
    state.player.mana = 20;
    const hp = state.solarCollector.hp;
    castSpell(state, 'flight', { kind: 'self' });
    expect(state.wizardFlight).toBeDefined();
    state.waveTimer = state.wizardFlight!.until + 0.01;
    stepWizard(state, 0.1);
    expect(state.wizardAvatar.status).toBe('falling');
    expect(state.solarCollector.hp).toBe(hp);
  });

  it('collapse under wizard starts a fall', () => {
    const state = tallTower();
    beginWave(state);
    const mid = Math.floor(SUB_CELLS_PER_MACRO / 2);
    state.wizardAvatar.pos = { col: 8 * SUB_CELLS_PER_MACRO + mid, row: 1 * SUB_CELLS_PER_MACRO + mid, face: 'top' };
    beginWizardFall(state);
    expect(state.wizardAvatar.status).toBe('falling');
    for (let i = 0; i < 40; i++) stepWizard(state, 0.2);
    expect(state.wizardAvatar.status).toBe('idle');
    expect(macroCellOfNode(state.wizardAvatar.pos).row).toBeLessThanOrEqual(1);
  });
});
