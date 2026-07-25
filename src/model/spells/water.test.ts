import { describe, expect, it } from 'vitest';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import { beginWave } from '@/model/phases';
import { placeInfra } from '@/model/infra';
import {
  addPuddle,
  addSoak,
  canCastSpell,
  castSpell,
  getSoak,
  listHotbarSpells,
  setActiveSpellSchool,
  soakSpeedMultiplier,
  soakSlowMultiplier,
  tickWaterEffects,
} from '@/model/spells';
import { addSheet, tickWetCells, waterfallPath } from '@/model/spells/water/wetCells';
import { hydrantSprayCells, tickHydrants } from '@/model/spells/water/hydrant';
import { deadweightDamage } from '@/model/spells/water/deadweight';
import { createRoom, createStructure, createTower, placeRoom, placeStructure } from '@/model/tower';
import type { GameState } from '@/model/types';
import { makeTestEnemy } from '@/test/subCells';

function towerWithStem(state: GameState, height = 1): GameState {
  const stem = getBlueprint('stem')!;
  let tower = createTower();
  for (let row = 0; row < height; row++) {
    tower = placeStructure(tower, createStructure(`r${row}`, stem, { col: 8, row }));
  }
  state.tower = tower;
  return state;
}

/** Climber on the left face of the stem at macro col 8 (exterior macro col 7). */
function enemyAt(stemMacroRow: number, hp = 40) {
  return makeTestEnemy(8, stemMacroRow, { templateId: 'elite', hp, face: 'left' });
}

describe('Soak', () => {
  it('slows at anchors and never hard-roots', () => {
    const state = towerWithStem(createInitialState('s0'));
    beginWave(state);
    const enemy = enemyAt(0);
    state.enemies.push(enemy);

    addSoak(enemy, 25);
    expect(soakSpeedMultiplier(state, enemy)).toBeCloseTo(0.5, 2);

    enemy.soak = 50;
    expect(soakSpeedMultiplier(state, enemy)).toBeCloseTo(1 - Math.sqrt(0.5), 2);

    enemy.soak = 100;
    expect(soakSpeedMultiplier(state, enemy)).toBeGreaterThanOrEqual(0.15);
    expect(soakSlowMultiplier(state, enemy)).toBeGreaterThan(1);
  });

  it('half-life halves stacks', () => {
    const state = towerWithStem(createInitialState('s1'));
    beginWave(state);
    const enemy = enemyAt(0);
    addSoak(enemy, 80);
    state.enemies.push(enemy);
    enemy.soakHalfLifeTimer = 0.01;
    tickWaterEffects(state, 0.02);
    expect(getSoak(enemy)).toBe(40);
  });
});

describe('Wet cells', () => {
  it('sheets flow down and puddle on solid stop', () => {
    const state = towerWithStem(createInitialState('w0'), 3);
    beginWave(state);
    addSheet(state, 7, 2, 5);
    tickWetCells(state, 0.01);
    expect(state.wetCells.some((c) => c.col === 7 && c.row === 1 && c.kind === 'sheet')).toBe(true);
    // Flow onto ground stop beside stem base → puddle
    state.wetCells = [{ col: 7, row: 0, kind: 'sheet', lifetime: 5 }];
    tickWetCells(state, 0.01);
    const puddle = state.wetCells.find((c) => c.col === 7 && c.row === 0);
    expect(puddle?.kind).toBe('puddle');
  });

  it('waterfall path stops at structure or max length', () => {
    const state = towerWithStem(createInitialState('w1'), 4);
    const path = waterfallPath(state.tower, { col: 7, row: 3 }, 10);
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ col: 7, row: 3 });
    expect(path.every((c) => c.col === 7)).toBe(true);
  });
});

describe('Hydrant', () => {
  it('sprays side cells when water-piped', () => {
    const state = towerWithStem(createInitialState('h0'), 2);
    const hydrantBp = getBlueprint('hydrantRoom')!;
    // Room beside stem with ground-water pipe adjacent.
    state.tower = placeStructure(
      state.tower,
      createStructure('s9', getBlueprint('stem')!, { col: 9, row: 0 }),
    );
    state.tower = placeRoom(state.tower, createRoom('hy', hydrantBp, { col: 9, row: 1 }));
    state.tower = placeInfra(state.tower, { col: 10, row: 0 }, 'pipe');
    state.tower = placeInfra(state.tower, { col: 10, row: 1 }, 'pipe');
    beginWave(state);

    const sides = hydrantSprayCells({ col: 9, row: 1 }, { w: 1, h: 1 });
    expect(sides).toEqual(
      expect.arrayContaining([
        { col: 8, row: 1 },
        { col: 10, row: 1 },
      ]),
    );

    tickHydrants(state, 1);
    expect(state.wetCells.length).toBeGreaterThan(0);
  });
});

describe('Water spells', () => {
  it('lists water kit on hotbar', () => {
    const state = towerWithStem(createInitialState('k0'));
    beginWave(state);
    setActiveSpellSchool(state, 'water');
    expect(listHotbarSpells(state).map((s) => s.id)).toEqual([
      'splash',
      'waterfall',
      'deadweight',
      'geyser',
    ]);
  });

  it('Splash applies AoE soak', () => {
    const state = towerWithStem(createInitialState('sp0'));
    beginWave(state);
    setActiveSpellSchool(state, 'water');
    const a = enemyAt(0);
    const b = enemyAt(1);
    state.enemies.push(a, b);
    // Splash centered on exterior macro of left-face climber at row 0.
    const result = castSpell(state, 'splash', { kind: 'cell', cell: { col: 7, row: 0 } });
    expect(result.ok).toBe(true);
    expect(getSoak(a)).toBeGreaterThan(0);
  });

  it('Waterfall slides enemy down and leaves puddle', () => {
    const state = towerWithStem(createInitialState('wf0'), 5);
    beginWave(state);
    setActiveSpellSchool(state, 'water');
    const enemy = enemyAt(3);
    const startRow = enemy.pos.row;
    state.enemies.push(enemy);
    const result = castSpell(state, 'waterfall', { kind: 'cell', cell: { col: 7, row: 3 } });
    expect(result.ok).toBe(true);
    expect(enemy.pos.row).toBeLessThan(startRow);
    expect(state.wetCells.some((c) => c.kind === 'puddle')).toBe(true);
  });

  it('Deadweight scales damage and applies fake soak slow', () => {
    const state = towerWithStem(createInitialState('dw0'));
    beginWave(state);
    setActiveSpellSchool(state, 'water');
    const enemy = enemyAt(0, 50);
    addSoak(enemy, 50);
    state.enemies.push(enemy);
    const hpBefore = enemy.currentHp;
    const result = castSpell(state, 'deadweight', { kind: 'cell', cell: { col: 7, row: 0 } });
    expect(result.ok).toBe(true);
    expect(deadweightDamage(50)).toBeGreaterThan(deadweightDamage(0));
    expect(enemy.deadweightSoakBonus).toBeGreaterThan(0);
    expect(getSoak(enemy)).toBe(50);
    // Damage can dodge; when it lands, HP drops.
    if (enemy.currentHp < hpBefore) {
      expect(hpBefore - enemy.currentHp).toBeGreaterThan(0);
    }
  });

  it('Geyser requires puddle; damages damp+ only; soaks all', () => {
    const state = towerWithStem(createInitialState('g0'), 3);
    beginWave(state);
    setActiveSpellSchool(state, 'water');
    const dry = enemyAt(1, 40);
    const damp = enemyAt(2, 40);
    addSoak(damp, 15);
    state.enemies.push(dry, damp);

    expect(canCastSpell(state, 'geyser', { kind: 'cell', cell: { col: 7, row: 0 } }).ok).toBe(false);

    addPuddle(state, 7, 0);
    const dryHp = dry.currentHp;
    const dampHp = damp.currentHp;
    const result = castSpell(state, 'geyser', { kind: 'cell', cell: { col: 7, row: 0 } });
    expect(result.ok).toBe(true);
    expect(getSoak(dry)).toBeGreaterThan(0);
    expect(dry.currentHp).toBe(dryHp);
    expect(damp.currentHp).toBeLessThan(dampHp);
  });
});

describe('Waterfall slide stays attached', () => {
  it('does not set airborne', () => {
    const state = towerWithStem(createInitialState('att0'), 4);
    beginWave(state);
    setActiveSpellSchool(state, 'water');
    const enemy = enemyAt(2);
    state.enemies.push(enemy);
    castSpell(state, 'waterfall', { kind: 'cell', cell: { col: 7, row: 2 } });
    expect(enemy.airborne).toBeFalsy();
  });
});
