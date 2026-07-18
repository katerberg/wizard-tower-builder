import { describe, expect, it } from 'vitest';
import { SUB_CELLS_PER_MACRO } from '@/config/constants';
import { getBlueprint } from '@/model/blueprints';
import { ENEMY_TEMPLATES } from '@/model/enemies';
import { createRoom, createTower, getWizardPosition, placeRoom } from '@/model/tower';
import type { MovementProfile, Tower } from '@/model/types';
import {
  faceOf,
  flySpawnBandForLevel,
  isWalkable,
  spawnAirNode,
  touchesRoomWall,
} from './exteriorGraph';
import { findPath } from './pathfinding';
import { macroCenterSubCell } from './subGrid';

const fly: MovementProfile = ENEMY_TEMPLATES.striker.movement;
const crawl: MovementProfile = ENEMY_TEMPLATES.swarm.movement;

function stemTower(): Tower {
  let tower = createTower();
  tower = placeRoom(tower, createRoom('a', getBlueprint('stem')!, { col: 5, row: 0 }));
  tower = placeRoom(tower, createRoom('b', getBlueprint('stem')!, { col: 5, row: 1 }));
  tower = placeRoom(tower, createRoom('c', getBlueprint('stem')!, { col: 5, row: 2 }));
  return tower;
}

describe('flying walkability', () => {
  it('allows open air for fliers and rejects it for crawlers', () => {
    const tower = stemTower();
    const air = macroCenterSubCell(0, 4);
    expect(isWalkable(tower, air.col, air.row, fly)).toBe(true);
    expect(isWalkable(tower, air.col, air.row, crawl)).toBe(false);
  });

  it('rejects cells that touch room walls for fliers', () => {
    const tower = stemTower();
    const left = { col: 5 * SUB_CELLS_PER_MACRO - 1, row: 1 * SUB_CELLS_PER_MACRO + 1 };
    expect(touchesRoomWall(tower, left.col, left.row)).toBe(true);
    expect(isWalkable(tower, left.col, left.row, fly)).toBe(false);
  });

  it('marks open air faces as air', () => {
    const tower = stemTower();
    const air = macroCenterSubCell(0, 4);
    expect(faceOf(tower, air.col, air.row)).toBe('air');
  });
});

describe('flying pathfinding', () => {
  it('finds an air path from a side spawn toward the wizard', () => {
    const tower = stemTower();
    const wizard = getWizardPosition(tower);
    const start = spawnAirNode(tower, 'left', { minRow: 2, maxRow: 5 }, wizard);
    expect(isWalkable(tower, start.col, start.row, fly)).toBe(true);
    const path = findPath(tower, start, wizard, fly);
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1].col).toBe(wizard.col);
    expect(path[path.length - 1].row).toBe(wizard.row);
  });
});

describe('fly spawn bands', () => {
  it('raises absolute bands with level index', () => {
    const early = flySpawnBandForLevel(1);
    const late = flySpawnBandForLevel(9);
    expect(late.minRow).toBeGreaterThan(early.minRow);
  });
});
