import { describe, expect, it } from 'vitest';
import { getBlueprint } from '../model/blueprints';
import { createRoom, createTower, placeRoom } from '../model/tower';
import type { MovementProfile, Tower } from '../model/types';
import { isWalkable, neighbors, spawnNode, surfaceContacts } from './exteriorGraph';

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
  tower = placeRoom(tower, createRoom('a', getBlueprint('stem')!, { col: 5, row: 0 }));
  tower = placeRoom(tower, createRoom('b', getBlueprint('stem')!, { col: 5, row: 1 }));
  tower = placeRoom(tower, createRoom('c', getBlueprint('buttress3')!, { col: 4, row: 2 }));
  return tower;
}

describe('surfaceContacts', () => {
  it('marks any row-0 cell as ground', () => {
    expect(surfaceContacts(createTower(), 3, 0).has('ground')).toBe(true);
  });

  it('detects walls on either side', () => {
    const tower = tShape();
    expect(surfaceContacts(tower, 4, 1).has('rightWall')).toBe(true); // room (5,1) to the right
    expect(surfaceContacts(tower, 6, 1).has('leftWall')).toBe(true); // room (5,1) to the left
  });

  it('detects a ceiling above and a floor below', () => {
    const tower = tShape();
    expect(surfaceContacts(tower, 4, 1).has('underCeiling')).toBe(true); // room (4,2) above
    expect(surfaceContacts(tower, 5, 3).has('onTop')).toBe(true); // room (5,2) below
  });

  it('does not treat diagonal-only contact as a surface', () => {
    const tower = tShape();
    // (3,3) only touches room (4,2) at a corner — no flat wall/floor/ceiling.
    expect(surfaceContacts(tower, 3, 3).size).toBe(0);
  });
});

describe('isWalkable', () => {
  it('rejects open air far from the tower', () => {
    const tower = tShape();
    expect(isWalkable(tower, 0, 6, underOverhang)).toBe(false);
  });

  it('rejects cells occupied by rooms', () => {
    const tower = tShape();
    expect(isWalkable(tower, 5, 1, underOverhang)).toBe(false);
  });

  it('lets under_overhang pass beneath an overhang but blocks surface_climb', () => {
    const tower = tShape();
    // (4,1) sits under the cap cell (4,2).
    expect(isWalkable(tower, 4, 1, underOverhang)).toBe(true);
    expect(isWalkable(tower, 4, 1, surfaceClimb)).toBe(false);
  });

  it('rejects a cell that only touches a room at a corner', () => {
    const tower = tShape();
    expect(isWalkable(tower, 3, 3, underOverhang)).toBe(false);
  });
});

// A simple vertical wall: rooms stacked at column 5, rows 0..2.
function verticalWall(): Tower {
  let tower = createTower();
  tower = placeRoom(tower, createRoom('a', getBlueprint('stem')!, { col: 5, row: 0 }));
  tower = placeRoom(tower, createRoom('b', getBlueprint('stem')!, { col: 5, row: 1 }));
  tower = placeRoom(tower, createRoom('c', getBlueprint('stem')!, { col: 5, row: 2 }));
  return tower;
}

describe('neighbors', () => {
  it('climbs a flat wall with orthogonal moves only (no diagonal leaps)', () => {
    const tower = verticalWall();
    // (4,1) hugs the wall (room at (5,1)). Up/down the wall is orthogonal; a
    // diagonal down to the ground at (3,0) would be a leap and must be excluded.
    const keys = neighbors(tower, 4, 1, underOverhang)
      .map((n) => `${n.col},${n.row}`)
      .sort();
    expect(keys).toEqual(['4,0', '4,2']);
  });

  it('wraps a convex corner from a wall onto the roof', () => {
    const tower = verticalWall();
    // (4,2) hugs the top room's left wall; the wizard perch (5,3) is its roof.
    const goesToRoof = neighbors(tower, 4, 2, underOverhang).some((n) => n.col === 5 && n.row === 3);
    expect(goesToRoof).toBe(true);
  });

  it('does not squeeze through a diagonal gap between two rooms', () => {
    // Rooms at (5,1) and (4,2) with (5,2) empty: the step (4,1) -> (5,2) is
    // flanked by a room on BOTH sides, so it must be rejected as a squeeze.
    let tower = createTower();
    tower = placeRoom(tower, createRoom('a', getBlueprint('stem')!, { col: 5, row: 0 }));
    tower = placeRoom(tower, createRoom('b', getBlueprint('stem')!, { col: 5, row: 1 }));
    tower = placeRoom(tower, createRoom('c', getBlueprint('stem')!, { col: 4, row: 2 }));
    expect(isWalkable(tower, 5, 2, underOverhang)).toBe(true); // empty, hugs (4,2)'s wall
    const squeezes = neighbors(tower, 4, 1, underOverhang).some((n) => n.col === 5 && n.row === 2);
    expect(squeezes).toBe(false);
  });
});

describe('spawnNode', () => {
  it('spawns on the ground at the outer edge of each side', () => {
    const tower = tShape();
    expect(spawnNode(tower, 'left')).toMatchObject({ col: 0, row: 0 });
    expect(spawnNode(tower, 'right')).toMatchObject({ col: 15, row: 0 });
  });
});
