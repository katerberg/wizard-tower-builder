import { describe, expect, it } from 'vitest';
import { cellKey } from '@/calculations/grid';
import { exteriorSubAt, macroCenterSubCell } from '@/calculations/subGrid';
import { findPath } from '@/calculations/pathfinding';
import { isWalkable, spawnNode } from '@/calculations/exteriorGraph';
import { GLACIS_STEP_COST, STAKES_SLOW_MULT } from '@/config/fortifications';
import { getBlueprint } from '@/model/blueprints';
import { ENEMY_TEMPLATES } from '@/model/enemies';
import {
  canPlaceFortification,
  isExteriorFramingCell,
  placeShell,
  reconcileShellAfterStructureEdit,
  stripEnclosedFortifications,
} from '@/model/fortifications';
import {
  groundAuraStepCost,
  isMoatBlockedGround,
  isOnStakesAura,
  stepCost,
  stakesSlowMultiplier,
} from '@/model/fortifications/effects';
import {
  createStructure,
  createTower,
  getWizardPosition,
  placeStructure,
  removeStructure,
} from '@/model/tower';
import type { MovementProfile, Tower } from '@/model/types';

const underOverhang: MovementProfile = ENEMY_TEMPLATES.swarm.movement;
const fly: MovementProfile = ENEMY_TEMPLATES.striker.movement;

function pillar(): Tower {
  let tower = createTower();
  tower = placeStructure(tower, createStructure('a', getBlueprint('stem')!, { col: 5, row: 0 }));
  tower = placeStructure(tower, createStructure('b', getBlueprint('stem')!, { col: 5, row: 1 }));
  return tower;
}

function tShape(): Tower {
  let tower = pillar();
  tower = placeStructure(tower, createStructure('c', getBlueprint('buttress3')!, { col: 4, row: 2 }));
  return tower;
}

describe('isExteriorFramingCell', () => {
  it('marks shell edges exterior and enclosed cores interior', () => {
    let tower = createTower();
    // 3x3 solid block on ground
    let id = 0;
    for (let col = 4; col <= 6; col++) {
      for (let row = 0; row <= 2; row++) {
        tower = placeStructure(
          tower,
          createStructure(`s${id++}`, getBlueprint('stem')!, { col, row }),
        );
      }
    }
    expect(isExteriorFramingCell(tower, 4, 0)).toBe(true);
    expect(isExteriorFramingCell(tower, 5, 1)).toBe(false);
    expect(isExteriorFramingCell(tower, 6, 2)).toBe(true);
  });
});

describe('stripEnclosedFortifications', () => {
  it('removes shell when a cell loses exterior exposure', () => {
    let tower = pillar();
    tower = placeShell(tower, { col: 5, row: 0 }, 'moat');
    expect(tower.shell[cellKey(5, 0)]?.kind).toBe('moat');

    // Wrap the base cell so (5,0) is enclosed: neighbors left, right, above + ground below OOB
    // For row 0: left, right, above — if all have framing, still exterior via below OOB!
    // Enclose mid cell instead.
    tower = placeShell(tower, { col: 5, row: 1 }, 'parapet');
    tower = placeStructure(tower, createStructure('L', getBlueprint('stem')!, { col: 4, row: 1 }));
    tower = placeStructure(tower, createStructure('R', getBlueprint('stem')!, { col: 6, row: 1 }));
    tower = placeStructure(tower, createStructure('U', getBlueprint('stem')!, { col: 5, row: 2 }));
    // (5,1) still has below (5,0) as framing — if left/right/above filled and below filled, enclosed
    tower = reconcileShellAfterStructureEdit(tower);
    expect(isExteriorFramingCell(tower, 5, 1)).toBe(false);
    expect(tower.shell[cellKey(5, 1)]).toBeUndefined();
    expect(tower.shell[cellKey(5, 0)]?.kind).toBe('moat');
  });

  it('clears shell when framing is removed', () => {
    let tower = pillar();
    tower = placeShell(tower, { col: 5, row: 0 }, 'glacis');
    tower = removeStructure(tower, 'a');
    expect(tower.shell[cellKey(5, 0)]).toBeUndefined();
  });
});

describe('placement rules', () => {
  it('rejects fortifications without framing or on interior cells', () => {
    const tower = pillar();
    expect(canPlaceFortification(tower, 'moat', { col: 3, row: 0 }).reason).toBe('no_framing');
    expect(canPlaceFortification(createTower(), 'moat', { col: 5, row: 0 }).reason).toBe(
      'no_framing',
    );
  });

  it('requires ground row for moat/glacis/stakes and top face for parapet', () => {
    const tower = pillar();
    expect(canPlaceFortification(tower, 'moat', { col: 5, row: 1 }).reason).toBe('wrong_face');
    expect(canPlaceFortification(tower, 'parapet', { col: 5, row: 1 }).reason).toBe('ok');
    expect(canPlaceFortification(tower, 'parapet', { col: 5, row: 0 }).reason).toBe('wrong_face');
  });

  it('requires underhang potential for cornice and wall face for barbican', () => {
    const tower = tShape();
    // Cap overhang at (4,2) has empty below
    expect(canPlaceFortification(tower, 'cornice', { col: 4, row: 2 }).reason).toBe('ok');
    expect(canPlaceFortification(tower, 'cornice', { col: 5, row: 0 }).reason).toBe('wrong_face');
    expect(canPlaceFortification(tower, 'barbican', { col: 5, row: 1 }).reason).toBe('ok');
  });
});

describe('moat / glacis / stakes ground auras', () => {
  it('moat hard-blocks adjacent empty ground; glacis raises step cost', () => {
    let tower = pillar();
    tower = placeShell(tower, { col: 5, row: 0 }, 'moat');
    const leftGround = exteriorSubAt(4, 0, 'left');
    // Ground subcells in empty macro (4,0)
    const groundSub = macroCenterSubCell(4, 0);
    groundSub.row = 0;
    expect(isMoatBlockedGround(tower, groundSub.col, 0)).toBe(true);
    expect(isWalkable(tower, groundSub.col, 0, underOverhang)).toBe(false);

    tower = placeShell(tower, { col: 5, row: 0 }, 'glacis');
    expect(isMoatBlockedGround(tower, groundSub.col, 0)).toBe(false);
    expect(groundAuraStepCost(tower, groundSub.col, 0)).toBe(GLACIS_STEP_COST);
    expect(stepCost(tower, { ...groundSub, face: 'air' }, underOverhang)).toBe(GLACIS_STEP_COST);
    expect(stepCost(tower, { ...groundSub, face: 'air' }, fly)).toBe(1);
    void leftGround;
  });

  it('stakes apply slow on aura ground', () => {
    let tower = pillar();
    tower = placeShell(tower, { col: 5, row: 0 }, 'stakes');
    const groundSub = macroCenterSubCell(4, 0);
    expect(isOnStakesAura(tower, groundSub.col, 0)).toBe(true);
    expect(
      stakesSlowMultiplier(tower, { col: groundSub.col, row: 0, face: 'air' }, false),
    ).toBe(STAKES_SLOW_MULT);
    expect(
      stakesSlowMultiplier(tower, { col: groundSub.col, row: 0, face: 'air' }, true),
    ).toBe(1);
  });
});

describe('parapet and cornice denies', () => {
  it('parapet blocks onTop crawl above the host', () => {
    let tower = pillar();
    tower = placeShell(tower, { col: 5, row: 1 }, 'parapet');
    const top = getWizardPosition(tower);
    // Wizard perch is onTop of crown — parapet on crown should block that onTop cell
    expect(isWalkable(tower, top.col, top.row, underOverhang)).toBe(false);
  });

  it('cornice blocks under_overhang crawl under the host', () => {
    let tower = tShape();
    tower = placeShell(tower, { col: 4, row: 2 }, 'cornice');
    const under = exteriorSubAt(4, 1, 'top');
    // Prefer a cell under the overhang with underCeiling
    const underSub = { col: 4 * 3 + 1, row: 2 * 3 - 1 };
    expect(isWalkable(tower, underSub.col, underSub.row, underOverhang)).toBe(false);
    void under;
  });
});

describe('weighted A*', () => {
  it('defaults stepCost to 1 without fortifications', () => {
    const tower = pillar();
    const start = spawnNode(tower, 'left');
    expect(stepCost(tower, start, underOverhang)).toBe(1);
    const path = findPath(tower, start, getWizardPosition(tower), underOverhang);
    expect(path.length).toBeGreaterThan(0);
  });
});

describe('stripEnclosedFortifications noop', () => {
  it('returns same tower when shell empty', () => {
    const tower = pillar();
    expect(stripEnclosedFortifications(tower)).toBe(tower);
  });
});
