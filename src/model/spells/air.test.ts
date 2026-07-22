import { describe, expect, it } from 'vitest';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import {
  applyDiscombobulated,
  blizzardSlowMultiplier,
  castSpell,
  gustAffectedCells,
  isDiscombobulated,
  isMacroCellBlockedByTornado,
  listHotbarSpells,
  setActiveSpellSchool,
  shouldStubDiscombobulatedStep,
  tornadoGridLine,
} from '@/model/spells';
import { addTornadoSegment } from '@/model/spells/air/tick';
import { computePushDelta } from '@/model/spells/air/push';
import { isDisplacementBlocked, resolveSubCellDisplacement } from '@/model/spells/air/displacement';
import { tickAirborneEnemies } from '@/model/spells/air/fallCollision';
import { createStructure, createTower, getWizardPosition, placeStructure } from '@/model/tower';
import type { GameState } from '@/model/types';
import { makeTestEnemy, subAt, wallSubAt } from '@/test/subCells';
import { FLIGHT_ASCENT_SUB_ROWS } from '@/model/spells/air/constants';

function towerWithStem(state: GameState): GameState {
  const stem = getBlueprint('stem')!;
  state.tower = placeStructure(createTower(), createStructure('r0', stem, { col: 8, row: 0 }));
  return state;
}

function towerWithStemStack(state: GameState): GameState {
  const stem = getBlueprint('stem')!;
  let tower = createTower();
  tower = placeStructure(tower, createStructure('r0', stem, { col: 8, row: 0 }));
  tower = placeStructure(tower, createStructure('r1', stem, { col: 8, row: 1 }));
  state.tower = tower;
  return state;
}

function towerWithStemTall(state: GameState): GameState {
  const stem = getBlueprint('stem')!;
  let tower = createTower();
  tower = placeStructure(tower, createStructure('r0', stem, { col: 8, row: 0 }));
  tower = placeStructure(tower, createStructure('r1', stem, { col: 8, row: 1 }));
  tower = placeStructure(tower, createStructure('r2', stem, { col: 8, row: 2 }));
  state.tower = tower;
  return state;
}

function makeEnemy(macroCol: number, macroRow: number, hp = 40) {
  return makeTestEnemy(macroCol, macroRow, { templateId: 'elite', hp });
}

describe('Discombobulated', () => {
  it('is permanent and binary', () => {
    const enemy = makeEnemy(8, 1);
    applyDiscombobulated(enemy);
    expect(isDiscombobulated(enemy)).toBe(true);
    applyDiscombobulated(enemy);
    expect(isDiscombobulated(enemy)).toBe(true);
  });

  it('stubs the first attachment transition then allows the second', () => {
    const state = towerWithStem(createInitialState('disc0'));
    const enemy = makeEnemy(8, 1);
    applyDiscombobulated(enemy);
    const next = { ...subAt(8, 2), face: 'left' as const };

    expect(shouldStubDiscombobulatedStep(state.tower, enemy, next)).toBe(true);
    expect(shouldStubDiscombobulatedStep(state.tower, enemy, next)).toBe(false);
  });
});

describe('Gust', () => {
  it('affects center and four orthogonal neighbors', () => {
    const cells = gustAffectedCells({ col: 8, row: 2 });
    expect(cells).toHaveLength(5);
    expect(cells).toContainEqual({ col: 8, row: 2 });
    expect(cells).toContainEqual({ col: 7, row: 2 });
    expect(cells).toContainEqual({ col: 9, row: 2 });
  });

  it('rips a wall climber off and applies Discombobulated', () => {
    const state = towerWithStemStack(createInitialState('gust0'));
    state.phase = 'attack';
    state.player.mana = 10;
    const enemy = makeTestEnemy(8, 1);
    enemy.pos = wallSubAt(8, 1, 'right');
    state.enemies = [enemy];

    const result = castSpell(state, 'gust', { kind: 'cell', cell: { col: 9, row: 1 } });
    expect(result.ok).toBe(true);
    expect(isDiscombobulated(enemy)).toBe(true);
    expect(enemy.airborne).toBe(true);
  });

  it('deals fall damage after gust knock-off', () => {
    const state = towerWithStemTall(createInitialState('gustfall'));
    state.phase = 'attack';
    state.player.mana = 10;
    const enemy = makeTestEnemy(8, 2);
    enemy.pos = wallSubAt(8, 2, 'right');
    state.enemies = [enemy];
    const hpBefore = enemy.currentHp;

    castSpell(state, 'gust', { kind: 'cell', cell: { col: 9, row: 2 } });
    expect(enemy.airborne).toBe(true);

    for (let i = 0; i < 40 && enemy.airborne; i++) {
      tickAirborneEnemies(state, 0.2);
    }

    expect(enemy.airborne).toBeFalsy();
    expect(enemy.currentHp).toBeLessThan(hpBefore);
  });

  it('pushes down (toward ground) when between walls', () => {
    const state = towerWithStemStack(createInitialState('gust1'));
    const delta = computePushDelta(state.tower, { col: 8, row: 2 });
    expect(delta).toEqual({ dc: 0, dr: -1 });
  });

  it('bounces off the tower instead of entering room tiles', () => {
    const state = towerWithStemStack(createInitialState('gustwall'));
    const start = wallSubAt(8, 1, 'left');
    const push = resolveSubCellDisplacement(state.tower, start, 1, 0, 3);

    expect(push.hitRoom).toBe(true);
    expect(isDisplacementBlocked(state.tower, push.pos.col, push.pos.row)).toBe(false);
    expect(push.pos.col).toBeLessThan(start.col);
  });

  it('never places gust victims inside room tiles', () => {
    const state = towerWithStemStack(createInitialState('gustsafe'));
    state.phase = 'attack';
    state.player.mana = 10;
    const enemy = makeTestEnemy(8, 1);
    enemy.pos = wallSubAt(8, 1, 'left');
    state.enemies = [enemy];

    castSpell(state, 'gust', { kind: 'cell', cell: { col: 8, row: 1 } });

    expect(isDisplacementBlocked(state.tower, enemy.pos.col, enemy.pos.row)).toBe(false);
  });
});

describe('Fall gravity', () => {
  it('moves airborne enemies toward lower row numbers', () => {
    const state = towerWithStem(createInitialState('fall0'));
    state.phase = 'attack';
    const enemy = makeEnemy(8, 2);
    enemy.airborne = true;
    enemy.pos = { ...enemy.pos, row: enemy.pos.row + 3 };
    const startRow = enemy.pos.row;
    state.enemies = [enemy];

    tickAirborneEnemies(state, 0.2);

    expect(enemy.pos.row).toBeLessThan(startRow);
  });
});

describe('Tornado', () => {
  it('builds a straight grid line up to 5 cells', () => {
    const line = tornadoGridLine({ col: 4, row: 3 }, { col: 8, row: 3 });
    expect(line).not.toBeNull();
    expect(line!.length).toBe(5);
  });

  it('blocks movement through its 2-high volume', () => {
    const state = towerWithStem(createInitialState('tor0'));
    state.phase = 'attack';
    addTornadoSegment(state, {
      macroCells: [{ col: 6, row: 2 }],
      expiresAt: state.waveTimer + 5,
    });
    expect(isMacroCellBlockedByTornado(state, 6, 2)).toBe(true);
    expect(isMacroCellBlockedByTornado(state, 6, 3)).toBe(true);
    expect(isMacroCellBlockedByTornado(state, 7, 2)).toBe(false);
  });
});

describe('Flight', () => {
  it('levitates the wizard and allows casting while active', () => {
    const state = towerWithStem(createInitialState('flight0'));
    state.phase = 'attack';
    state.player.mana = 20;
    state.activeSpellSchool = 'air';

    const flightResult = castSpell(state, 'flight', { kind: 'self' });
    expect(flightResult.ok).toBe(true);
    expect(state.wizardFlight).toBeDefined();
    const perch = getWizardPosition(state.tower);
    expect(state.wizardFlight!.pos.row).toBe(perch.row + FLIGHT_ASCENT_SUB_ROWS);

    const gustResult = castSpell(state, 'gust', { kind: 'cell', cell: { col: 8, row: 2 } });
    expect(gustResult.ok).toBe(true);
  });
});

describe('Blizzard', () => {
  it('doubles move cooldown while inside the zone', () => {
    const state = towerWithStem(createInitialState('bliz0'));
    state.phase = 'attack';
    state.player.mana = 10;
    castSpell(state, 'blizzard', { kind: 'cell', cell: { col: 8, row: 2 } });
    const enemy = makeEnemy(8, 2);
    state.enemies = [enemy];
    expect(blizzardSlowMultiplier(state, enemy)).toBe(2);
  });
});

describe('Air hotbar', () => {
  it('lists four air spells when air school is selected', () => {
    const state = towerWithStem(createInitialState('kit0'));
    setActiveSpellSchool(state, 'air');
    const ids = listHotbarSpells(state).map((s) => s.id);
    expect(ids).toEqual(['gust', 'tornado', 'flight', 'blizzard']);
  });
});
