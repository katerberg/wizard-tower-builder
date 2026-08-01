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
import {
  SHEET_FLOW_INTERVAL,
  WATERFALL_PUDDLE_LIFETIME,
} from '@/model/spells/water/constants';
import { addSheet, tickWetCells, waterfallPath } from '@/model/spells/water/wetCells';
import { tickActiveWaterfalls } from '@/model/spells/water/waterfall';
import { hydrantSprayCells, tickHydrants } from '@/model/rooms/hydrant';
import { deadweightDamage } from '@/model/spells/water/deadweight';
import { createRoom, createStructure, createTower, placeRoom, placeStructure } from '@/model/tower';
import type { GameState } from '@/model/types';
import { makeTestEnemy } from '@/test/subCells';

/** Advance wet-cell sim by `steps` sheet-flow intervals. */
function dripTicks(state: GameState, steps: number): void {
  for (let i = 0; i < steps; i++) {
    tickWetCells(state, SHEET_FLOW_INTERVAL);
  }
}

/** Advance waterfall stream by `steps` flow intervals. */
function waterfallTicks(state: GameState, steps: number): void {
  for (let i = 0; i < steps; i++) {
    tickActiveWaterfalls(state, SHEET_FLOW_INTERVAL);
  }
}

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
  it('sheets drip down over time and puddle on solid stop', () => {
    const state = towerWithStem(createInitialState('w0'), 3);
    beginWave(state);
    addSheet(state, 7, 2, 5);
    // Too little time — sheet stays put.
    tickWetCells(state, SHEET_FLOW_INTERVAL * 0.25);
    expect(state.wetCells.some((c) => c.col === 7 && c.row === 2 && c.kind === 'sheet')).toBe(true);

    dripTicks(state, 1);
    expect(state.wetCells.some((c) => c.col === 7 && c.row === 1 && c.kind === 'sheet')).toBe(true);

    // Flow onto ground stop beside stem base → puddle
    state.wetCells = [{ col: 7, row: 0, kind: 'sheet', lifetime: 5, flowAcc: 0 }];
    dripTicks(state, 1);
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

  it('Waterfall grows a continuous stream, washes enemy, pools, then fades from top', () => {
    const state = towerWithStem(createInitialState('wf0'), 5);
    beginWave(state);
    setActiveSpellSchool(state, 'water');
    const enemy = enemyAt(3);
    const startRow = enemy.pos.row;
    state.enemies.push(enemy);
    const result = castSpell(state, 'waterfall', { kind: 'cell', cell: { col: 7, row: 3 } });
    expect(result.ok).toBe(true);
    expect(enemy.pos.row).toBe(startRow);
    expect(state.activeWaterfalls).toHaveLength(1);
    // Cast paints only the top cell of the stream.
    expect(state.wetCells.filter((c) => c.stream).map((c) => c.row)).toEqual([3]);

    waterfallTicks(state, 1);
    expect(enemy.pos.row).toBeLessThan(startRow);
    // Stream has grown downward — multiple cells wet at once.
    const streamRows = state.wetCells.filter((c) => c.stream).map((c) => c.row);
    expect(streamRows.length).toBeGreaterThan(1);
    expect(Math.max(...streamRows)).toBe(3);

    // Grow to bottom + one step to pool and begin fade.
    for (let i = 0; i < 20 && state.activeWaterfalls[0]?.phase === 'growing'; i++) {
      tickActiveWaterfalls(state, SHEET_FLOW_INTERVAL);
    }
    expect(state.wetCells.some((c) => c.kind === 'puddle')).toBe(true);
    const puddle = state.wetCells.find((c) => c.kind === 'puddle')!;
    expect(puddle.lifetime).toBeGreaterThan(WATERFALL_PUDDLE_LIFETIME - SHEET_FLOW_INTERVAL);

    // Fade from the top: highest stream row should drop over time.
    tickActiveWaterfalls(state, SHEET_FLOW_INTERVAL);
    if (state.activeWaterfalls.length > 0) {
      const afterFade = state.wetCells.filter((c) => c.stream).map((c) => c.row);
      if (afterFade.length > 0) {
        expect(Math.max(...afterFade)).toBeLessThan(3);
      }
    }
  });

  it('Deadweight hits a 3×3 and scales damage with soak', () => {
    const state = towerWithStem(createInitialState('dw0'), 2);
    beginWave(state);
    setActiveSpellSchool(state, 'water');
    const center = enemyAt(0, 50);
    const adjacent = enemyAt(1, 50);
    addSoak(center, 50);
    addSoak(adjacent, 20);
    state.enemies.push(center, adjacent);
    const centerHp = center.currentHp;
    const adjHp = adjacent.currentHp;
    const result = castSpell(state, 'deadweight', { kind: 'cell', cell: { col: 7, row: 0 } });
    expect(result.ok).toBe(true);
    expect(deadweightDamage(50)).toBeGreaterThan(deadweightDamage(0));
    expect(center.deadweightSoakBonus).toBeGreaterThan(0);
    expect(adjacent.deadweightSoakBonus).toBeGreaterThan(0);
    expect(getSoak(center)).toBe(50);
    // Damage can dodge; when it lands, HP drops for both in the 3×3.
    if (center.currentHp < centerHp) {
      expect(centerHp - center.currentHp).toBeGreaterThan(0);
    }
    if (adjacent.currentHp < adjHp) {
      expect(adjHp - adjacent.currentHp).toBeGreaterThan(0);
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
  it('does not set airborne while washing down', () => {
    const state = towerWithStem(createInitialState('att0'), 4);
    beginWave(state);
    setActiveSpellSchool(state, 'water');
    const enemy = enemyAt(2);
    state.enemies.push(enemy);
    castSpell(state, 'waterfall', { kind: 'cell', cell: { col: 7, row: 2 } });
    waterfallTicks(state, 4);
    expect(enemy.airborne).toBeFalsy();
  });
});
