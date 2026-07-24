import { describe, expect, it } from 'vitest';
import { GRID_COLS, SUB_CELLS_PER_MACRO } from '@/config/constants';
import { exteriorSubAt, macroCenterSubCell } from './subGrid';
import { getBlueprint } from '../model/blueprints';
import { createStructure, createTower, placeStructure } from '../model/tower';
import type { MovementProfile, Tower } from '../model/types';
import { isWalkable, neighbors, spawnNode, surfaceContacts, inAirBounds } from './exteriorGraph';
import { findPath } from './pathfinding';
import { getWizardPosition } from '../model/tower';

const underOverhang: MovementProfile = {
  kind: 'under_overhang',
  canPassUnderOverhang: true,
  canAttackOverhang: false,
  canFly: false,
  canTransferFaces: false,
};

const surfaceClimb: MovementProfile = {
  kind: 'surface_climb',
  canPassUnderOverhang: false,
  canAttackOverhang: false,
  canFly: false,
  canTransferFaces: false,
};

// stem (5,0) -> stem (5,1) -> buttress3 (4,2): a T whose cap overhangs to cols 4 and 6.
function tShape(): Tower {
  let tower = createTower();
  tower = placeStructure(tower, createStructure('a', getBlueprint('stem')!, { col: 5, row: 0 }));
  tower = placeStructure(tower, createStructure('b', getBlueprint('stem')!, { col: 5, row: 1 }));
  tower = placeStructure(tower, createStructure('c', getBlueprint('buttress3')!, { col: 4, row: 2 }));
  return tower;
}

describe('surfaceContacts', () => {
  it('marks sub-row 0 as ground', () => {
    expect(surfaceContacts(createTower(), 9, 0).has('ground')).toBe(true);
  });

  it('detects walls on either side', () => {
    const tower = tShape();
    const left = exteriorSubAt(5, 1, 'left');
    const right = exteriorSubAt(5, 1, 'right');
    expect(surfaceContacts(tower, left.col, left.row).has('rightWall')).toBe(true);
    expect(surfaceContacts(tower, right.col, right.row).has('leftWall')).toBe(true);
  });

  it('detects a ceiling above and a floor below', () => {
    const tower = tShape();
    const under = { col: 12, row: 5 };
    const onTop = getWizardPosition(tower);
    expect(surfaceContacts(tower, under.col, under.row).has('underCeiling')).toBe(true);
    expect(surfaceContacts(tower, onTop.col, onTop.row).has('onTop')).toBe(true);
  });

  it('does not treat diagonal-only contact as a surface', () => {
    const tower = tShape();
    const corner = macroCenterSubCell(3, 3);
    expect(surfaceContacts(tower, corner.col, corner.row).size).toBe(0);
  });
});

describe('isWalkable', () => {
  it('rejects open air far from the tower', () => {
    const tower = tShape();
    const air = macroCenterSubCell(0, 6);
    expect(isWalkable(tower, air.col, air.row, underOverhang)).toBe(false);
  });

  it('rejects cells occupied by rooms', () => {
    const tower = tShape();
    const room = macroCenterSubCell(5, 1);
    expect(isWalkable(tower, room.col, room.row, underOverhang)).toBe(false);
  });

  it('lets under_overhang pass beneath an overhang but blocks surface_climb', () => {
    const tower = tShape();
    const under = { col: 12, row: 5 };
    expect(isWalkable(tower, under.col, under.row, underOverhang)).toBe(true);
    expect(isWalkable(tower, under.col, under.row, surfaceClimb)).toBe(false);
  });

  it('rejects a cell that only touches a room at a corner', () => {
    const tower = tShape();
    const corner = macroCenterSubCell(3, 3);
    expect(isWalkable(tower, corner.col, corner.row, underOverhang)).toBe(false);
  });
});

function verticalWall(): Tower {
  let tower = createTower();
  tower = placeStructure(tower, createStructure('a', getBlueprint('stem')!, { col: 5, row: 0 }));
  tower = placeStructure(tower, createStructure('b', getBlueprint('stem')!, { col: 5, row: 1 }));
  tower = placeStructure(tower, createStructure('c', getBlueprint('stem')!, { col: 5, row: 2 }));
  return tower;
}

describe('neighbors', () => {
  it('exposes walkable sub-steps along a vertical wall', () => {
    const tower = verticalWall();
    const start = exteriorSubAt(5, 1, 'left');
    expect(isWalkable(tower, start.col, start.row, underOverhang)).toBe(true);
    const nbs = neighbors(tower, start.col, start.row, underOverhang);
    expect(nbs.length).toBeGreaterThan(0);
    for (const n of nbs) {
      expect(isWalkable(tower, n.col, n.row, underOverhang)).toBe(true);
    }
  });

  it('pathfinds over a convex corner at sub-cell resolution', () => {
    const tower = verticalWall();
    const goal = getWizardPosition(tower);
    const start = { ...exteriorSubAt(5, 2, 'left'), face: 'left' as const };
    const path = findPath(tower, start, goal, underOverhang);
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).toEqual(goal);
  });

  it('does not squeeze through a diagonal gap between two rooms', () => {
    let tower = createTower();
    tower = placeStructure(tower, createStructure('a', getBlueprint('stem')!, { col: 5, row: 0 }));
    tower = placeStructure(tower, createStructure('b', getBlueprint('stem')!, { col: 5, row: 1 }));
    tower = placeStructure(tower, createStructure('c', getBlueprint('stem')!, { col: 4, row: 2 }));
    const gap = macroCenterSubCell(5, 2);
    expect(isWalkable(tower, gap.col, gap.row, underOverhang)).toBe(false);
    const wall = exteriorSubAt(5, 1, 'left');
    const squeeze = macroCenterSubCell(5, 2);
    const squeezes = neighbors(tower, wall.col, wall.row, underOverhang).some(
      (n) => n.col === squeeze.col && n.row === squeeze.row,
    );
    expect(squeezes).toBe(false);
  });
});

describe('spawnNode', () => {
  it('spawns on the ground at the outer edge of each side', () => {
    const tower = tShape();
    expect(spawnNode(tower, 'left')).toMatchObject({ col: 0, row: 0 });
    expect(spawnNode(tower, 'right')).toMatchObject({
      col: GRID_COLS * SUB_CELLS_PER_MACRO - 1,
      row: 0,
    });
  });
});

describe('inAirBounds', () => {
  it('extends to the wizard row on a tall tower', () => {
    let tower = createTower();
    for (let row = 0; row <= 20; row++) {
      tower = placeStructure(tower, createStructure(`r${row}`, getBlueprint('stem')!, { col: 8, row }));
    }
    const inBounds = getWizardPosition(tower);
    const out = macroCenterSubCell(8, 22);
    expect(inAirBounds(tower, inBounds.col, inBounds.row)).toBe(true);
    expect(inAirBounds(tower, out.col, out.row)).toBe(false);
  });
});

function gapTower(): Tower {
  let tower = createTower();
  tower = placeStructure(tower, createStructure('left', getBlueprint('buttress2')!, { col: 5, row: 0 }));
  tower = placeStructure(tower, createStructure('right', getBlueprint('buttress2')!, { col: 8, row: 0 }));
  return tower;
}

describe('sub-cell gap crossing', () => {
  it('blocks unsupported air above a ground gap between buttresses', () => {
    const tower = gapTower();
    for (let subRow = 3; subRow <= 5; subRow++) {
      for (let subCol = 21; subCol <= 23; subCol++) {
        expect(isWalkable(tower, subCol, subRow, underOverhang)).toBe(false);
      }
    }
  });

  it('allows ground-level travel through the gap', () => {
    const tower = gapTower();
    expect(isWalkable(tower, 21, 0, underOverhang)).toBe(true);
    expect(isWalkable(tower, 22, 0, underOverhang)).toBe(true);
    expect(isWalkable(tower, 23, 0, underOverhang)).toBe(true);
  });

  it('requires descending to cross from one side of a gap to the other', () => {
    const tower = gapTower();
    const start = { col: 14, row: 2, face: 'right' as const };
    const goal = { col: 30, row: 2, face: 'left' as const };
    const path = findPath(tower, start, goal, underOverhang);
    expect(path.length).toBeGreaterThan(0);
    expect(Math.min(...path.map((n) => n.row))).toBeLessThanOrEqual(2);
  });
});
