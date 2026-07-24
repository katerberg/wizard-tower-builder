import { describe, expect, it } from 'vitest';
import { canSoldierTraverse, isSoldierWalkable } from './interiorGraph';
import { findInteriorPath } from './interiorPathfinding';
import { getBlueprint } from '@/model/blueprints';
import { placeInfra } from '@/model/infra';
import { canPlaceInfra } from '@/model/infra';
import { getInfraBlueprint } from '@/model/infraBlueprints';
import { createRoom, createStructure, createTower, placeRoom, placeStructure } from '@/model/tower';


function towerWithRooms() {
  let tower = createTower();
  const stem = getBlueprint('stem')!;
  const guardroom = getBlueprint('guardroomRoom')!;
  const slot = getBlueprint('slotRoom')!;
  tower = placeStructure(tower, createStructure('s0', stem, { col: 4, row: 0 }));
  tower = placeStructure(tower, createStructure('s1', stem, { col: 4, row: 1 }));
  tower = placeStructure(tower, createStructure('s2', stem, { col: 4, row: 2 }));
  tower = placeRoom(tower, createRoom('b1', guardroom, { col: 4, row: 0 }));
  tower = placeRoom(tower, createRoom('s1', slot, { col: 4, row: 2 }));
  return tower;
}

describe('interiorGraph', () => {
  it('allows horizontal movement through passable rooms', () => {
    const tower = towerWithRooms();
    expect(isSoldierWalkable(tower, 4, 0)).toBe(true);
    expect(canSoldierTraverse(tower, { col: 4, row: 0 }, { col: 5, row: 0 })).toBe(false);
  });

  it('blocks vertical movement without stairs', () => {
    const tower = towerWithRooms();
    expect(canSoldierTraverse(tower, { col: 4, row: 0 }, { col: 4, row: 1 })).toBe(false);
  });

  it('lets a stair on the lower floor reach the room above (no stair required on landing)', () => {
    let tower = towerWithRooms();
    // Intermediate shaft cell + floor under the slot — not on the slot itself.
    tower = placeInfra(tower, { col: 4, row: 0 }, 'stair');
    tower = placeInfra(tower, { col: 4, row: 1 }, 'stair');
    expect(canSoldierTraverse(tower, { col: 4, row: 1 }, { col: 4, row: 2 })).toBe(true);
    expect(canSoldierTraverse(tower, { col: 4, row: 2 }, { col: 4, row: 1 })).toBe(true);
  });

  it('does not let a stair on a floor pull traffic up from below', () => {
    let tower = towerWithRooms();
    // Stair only on the destination floor — cannot climb into it from below.
    tower = placeInfra(tower, { col: 4, row: 2 }, 'stair');
    expect(canSoldierTraverse(tower, { col: 4, row: 1 }, { col: 4, row: 2 })).toBe(false);
  });
});

describe('findInteriorPath', () => {
  it('finds a path via stairs between guardroom and slot without a stair in the slot', () => {
    let tower = towerWithRooms();
    tower = placeInfra(tower, { col: 4, row: 0 }, 'stair');
    tower = placeInfra(tower, { col: 4, row: 1 }, 'stair');
    const path = findInteriorPath(tower, { col: 4, row: 0 }, { col: 4, row: 2 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ col: 4, row: 0 });
    expect(path[path.length - 1]).toEqual({ col: 4, row: 2 });
  });

  it('finds a path via elevator shaft cells', () => {
    let tower = towerWithRooms();
    tower = placeInfra(tower, { col: 4, row: 0 }, 'elevator');
    tower = placeInfra(tower, { col: 4, row: 1 }, 'elevator');
    tower = placeInfra(tower, { col: 4, row: 2 }, 'elevator');
    expect(canSoldierTraverse(tower, { col: 4, row: 0 }, { col: 4, row: 1 })).toBe(true);
    const path = findInteriorPath(tower, { col: 4, row: 0 }, { col: 4, row: 2 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ col: 4, row: 2 });
  });
});

describe('infra placement', () => {
  it('allows replacing one infra kind with another', () => {
    const tower = createTower();
    const stair = getInfraBlueprint('staircase')!;
    const pipe = getInfraBlueprint('pipe')!;
    const elevator = getInfraBlueprint('elevator')!;
    expect(canPlaceInfra(tower, stair, { col: 1, row: 0 }).ok).toBe(true);
    const withStair = placeInfra(tower, { col: 1, row: 0 }, 'stair');
    expect(canPlaceInfra(withStair, pipe, { col: 1, row: 0 }).ok).toBe(true);
    expect(placeInfra(withStair, { col: 1, row: 0 }, 'pipe').infra['1,0']?.kind).toBe('pipe');
    expect(canPlaceInfra(withStair, elevator, { col: 1, row: 0 }).ok).toBe(true);
    expect(placeInfra(withStair, { col: 1, row: 0 }, 'elevator').infra['1,0']?.kind).toBe(
      'elevator',
    );
  });
});
