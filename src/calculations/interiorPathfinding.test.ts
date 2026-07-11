import { describe, expect, it } from 'vitest';
import { canSoldierTraverse, isSoldierWalkable } from './interiorGraph';
import { findInteriorPath } from './interiorPathfinding';
import { getBlueprint } from '@/model/blueprints';
import { placeInfra } from '@/model/infra';
import { canPlaceInfra } from '@/model/infra';
import { getInfraBlueprint } from '@/model/infraBlueprints';
import { createRoom, placeRoom } from '@/model/tower';
import { createTower } from '@/model/tower';

function towerWithRooms() {
  let tower = createTower();
  const barracks = getBlueprint('barracksRoom')!;
  const slot = getBlueprint('slotRoom')!;
  tower = placeRoom(tower, createRoom('b1', barracks, { col: 4, row: 0 }));
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

  it('allows vertical movement on stair cells', () => {
    let tower = towerWithRooms();
    tower = placeInfra(tower, { col: 4, row: 0 }, 'stair');
    tower = placeInfra(tower, { col: 4, row: 1 }, 'stair');
    tower = placeInfra(tower, { col: 4, row: 2 }, 'stair');
    expect(canSoldierTraverse(tower, { col: 4, row: 0 }, { col: 4, row: 1 })).toBe(true);
    expect(canSoldierTraverse(tower, { col: 4, row: 1 }, { col: 4, row: 2 })).toBe(true);
  });
});

describe('findInteriorPath', () => {
  it('finds a path via stairs between barracks and slot', () => {
    let tower = towerWithRooms();
    tower = placeInfra(tower, { col: 4, row: 0 }, 'stair');
    tower = placeInfra(tower, { col: 4, row: 1 }, 'stair');
    tower = placeInfra(tower, { col: 4, row: 2 }, 'stair');
    const path = findInteriorPath(tower, { col: 4, row: 0 }, { col: 4, row: 2 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ col: 4, row: 0 });
    expect(path[path.length - 1]).toEqual({ col: 4, row: 2 });
  });
});

describe('infra placement', () => {
  it('allows one infra kind per cell', () => {
    const tower = createTower();
    const stair = getInfraBlueprint('staircase')!;
    const pipe = getInfraBlueprint('pipe')!;
    expect(canPlaceInfra(tower, stair, { col: 1, row: 0 })).toBe(true);
    const withStair = placeInfra(tower, { col: 1, row: 0 }, 'stair');
    expect(canPlaceInfra(withStair, pipe, { col: 1, row: 0 })).toBe(false);
  });
});
