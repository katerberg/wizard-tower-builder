import { describe, expect, it } from 'vitest';
import { cellKey } from '@/calculations/grid';
import { exteriorSubAt, macroCenterSubCell } from '@/calculations/subGrid';
import { findPath } from '@/calculations/pathfinding';
import { isWalkable, spawnNode } from '@/calculations/exteriorGraph';
import {
  FORT_SLOW_CAP_MULT,
  GLACIS_STEP_COST,
  MOAT_SLOW_MULT,
  MOAT_STEP_COST,
  PARAPET_SLOW_MULT,
  PARAPET_STEP_COST,
  STAKES_SLOW_MULT,
} from '@/config/fortifications';
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
  fortificationSlowMultiplier,
  groundAuraStepCost,
  isOnMoatAura,
  isOnParapetTop,
  isOnCorniceUnder,
  isOnStakesAura,
  stepCost,
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

  it('strips parapet when framing covers its top face while host stays exterior', () => {
    let tower = pillar();
    tower = placeShell(tower, { col: 5, row: 1 }, 'parapet');
    tower = placeStructure(tower, createStructure('U', getBlueprint('stem')!, { col: 5, row: 2 }));
    tower = reconcileShellAfterStructureEdit(tower);
    expect(isExteriorFramingCell(tower, 5, 1)).toBe(true);
    expect(canPlaceFortification(tower, 'parapet', { col: 5, row: 1 }).reason).toBe('wrong_face');
    expect(tower.shell[cellKey(5, 1)]).toBeUndefined();
  });

  it('strips cornice when underhang is filled', () => {
    let tower = tShape();
    tower = placeShell(tower, { col: 4, row: 2 }, 'cornice');
    tower = placeStructure(tower, createStructure('fill', getBlueprint('stem')!, { col: 4, row: 1 }));
    tower = reconcileShellAfterStructureEdit(tower);
    expect(canPlaceFortification(tower, 'cornice', { col: 4, row: 2 }).reason).toBe('wrong_face');
    expect(tower.shell[cellKey(4, 2)]).toBeUndefined();
  });

  it('strips barbican when both wall faces are sealed', () => {
    let tower = pillar();
    tower = placeShell(tower, { col: 5, row: 1 }, 'barbican');
    tower = placeStructure(tower, createStructure('L', getBlueprint('stem')!, { col: 4, row: 1 }));
    tower = placeStructure(tower, createStructure('R', getBlueprint('stem')!, { col: 6, row: 1 }));
    tower = reconcileShellAfterStructureEdit(tower);
    expect(isExteriorFramingCell(tower, 5, 1)).toBe(true);
    expect(canPlaceFortification(tower, 'barbican', { col: 5, row: 1 }).reason).toBe('wrong_face');
    expect(tower.shell[cellKey(5, 1)]).toBeUndefined();
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
  it('moat taxes adjacent empty ground; glacis raises step cost; neither seals walkability', () => {
    let tower = pillar();
    tower = placeShell(tower, { col: 5, row: 0 }, 'moat');
    const leftGround = exteriorSubAt(4, 0, 'left');
    const groundSub = macroCenterSubCell(4, 0);
    groundSub.row = 0;
    expect(isOnMoatAura(tower, groundSub.col, 0)).toBe(true);
    expect(isWalkable(tower, groundSub.col, 0, underOverhang)).toBe(true);
    expect(groundAuraStepCost(tower, groundSub.col, 0)).toBe(MOAT_STEP_COST);
    expect(
      fortificationSlowMultiplier(tower, { ...groundSub, face: 'air' }, false),
    ).toBe(MOAT_SLOW_MULT);

    tower = placeShell(tower, { col: 5, row: 0 }, 'glacis');
    expect(isOnMoatAura(tower, groundSub.col, 0)).toBe(false);
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
      fortificationSlowMultiplier(tower, { col: groundSub.col, row: 0, face: 'air' }, false),
    ).toBe(STAKES_SLOW_MULT);
    expect(
      fortificationSlowMultiplier(tower, { col: groundSub.col, row: 0, face: 'air' }, true),
    ).toBe(1);
  });
});

describe('parapet and cornice soft taxes', () => {
  it('parapet taxes onTop crawl above the host without sealing it', () => {
    let tower = pillar();
    tower = placeShell(tower, { col: 5, row: 1 }, 'parapet');
    const top = getWizardPosition(tower);
    expect(isWalkable(tower, top.col, top.row, underOverhang)).toBe(true);
    expect(isOnParapetTop(tower, top.col, top.row)).toBe(true);
    expect(stepCost(tower, { ...top, face: 'air' }, underOverhang)).toBe(PARAPET_STEP_COST);
    expect(fortificationSlowMultiplier(tower, top, false)).toBe(PARAPET_SLOW_MULT);
  });

  it('cornice taxes under_overhang crawl under the host without sealing it', () => {
    let tower = tShape();
    tower = placeShell(tower, { col: 4, row: 2 }, 'cornice');
    const under = exteriorSubAt(4, 1, 'top');
    const underSub = { col: 4 * 3 + 1, row: 2 * 3 - 1 };
    expect(isWalkable(tower, underSub.col, underSub.row, underOverhang)).toBe(true);
    expect(isOnCorniceUnder(tower, underSub.col, underSub.row)).toBe(true);
    void under;
  });

  it('caps stacked fort slows at 80%', () => {
    let tower = pillar();
    tower = placeShell(tower, { col: 5, row: 0 }, 'moat');
    tower = placeShell(tower, { col: 5, row: 1 }, 'parapet');
    const groundSub = macroCenterSubCell(4, 0);
    groundSub.row = 0;
    const top = getWizardPosition(tower);
    // Moat alone is below the cap; max of applicable effects still respects the cap.
    expect(fortificationSlowMultiplier(tower, { ...groundSub, face: 'air' }, false)).toBeLessThanOrEqual(
      FORT_SLOW_CAP_MULT,
    );
    expect(fortificationSlowMultiplier(tower, top, false)).toBeLessThanOrEqual(FORT_SLOW_CAP_MULT);
    expect(FORT_SLOW_CAP_MULT).toBe(5);
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
