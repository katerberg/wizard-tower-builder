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

  it('detects diagonal corner contact for turning onto a roof', () => {
    const tower = tShape();
    expect(surfaceContacts(tower, 3, 3).has('corner')).toBe(true); // room (4,2) is diagonal
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
});

describe('neighbors', () => {
  it('returns only orthogonal walkable cells', () => {
    const tower = tShape();
    const result = neighbors(tower, 4, 0, underOverhang);
    const keys = result.map((n) => `${n.col},${n.row}`).sort();
    // From ground (4,0): left to (3,0), up to (4,1). (5,0) is a room; diagonals excluded.
    expect(keys).toEqual(['3,0', '4,1']);
    for (const n of result) {
      const orthogonal = Math.abs(n.col - 4) + Math.abs(n.row - 0) === 1;
      expect(orthogonal).toBe(true);
    }
  });
});

describe('spawnNode', () => {
  it('spawns on the ground at the outer edge of each side', () => {
    const tower = tShape();
    expect(spawnNode(tower, 'left')).toMatchObject({ col: 0, row: 0 });
    expect(spawnNode(tower, 'right')).toMatchObject({ col: 15, row: 0 });
  });
});
