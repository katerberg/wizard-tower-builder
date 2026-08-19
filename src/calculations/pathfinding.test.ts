import { describe, expect, it } from 'vitest';
import { macroCenterSubCell } from './subGrid';
import { ENEMY_TEMPLATES } from '../model/enemies';
import { findPath } from './pathfinding';
import { isWalkable, spawnNode } from './exteriorGraph';
import { createStructure, createTower, getWizardPosition, placeStructure } from '../model/tower';
import { getBlueprint } from '../model/blueprints';
import type { ExteriorNode, Tower } from '../model/types';

const profile = ENEMY_TEMPLATES.swarm.movement;
const stem = getBlueprint('stem')!;

// stem (5,0) -> stem (5,1) -> stems (4,2) and (6,2): T cap with one-step overhangs.
function buildTShapedTower(): Tower {
  let tower = createTower();
  tower = placeStructure(tower, createStructure('a', stem, { col: 5, row: 0 }));
  tower = placeStructure(tower, createStructure('b', stem, { col: 5, row: 1 }));
  tower = placeStructure(tower, createStructure('c', stem, { col: 4, row: 2 }));
  tower = placeStructure(tower, createStructure('d', stem, { col: 6, row: 2 }));
  return tower;
}

// stem (5,0) -> stem (5,1) -> stem (6,2): a widening stepped tower.
function buildPyramid(): Tower {
  let tower = createTower();
  tower = placeStructure(tower, createStructure('a', stem, { col: 5, row: 0 }));
  tower = placeStructure(tower, createStructure('b', stem, { col: 5, row: 1 }));
  tower = placeStructure(tower, createStructure('c', stem, { col: 6, row: 2 }));
  return tower;
}

function assertSurfacePath(tower: Tower, path: ExteriorNode[]): void {
  expect(path.length).toBeGreaterThan(0);
  for (const node of path) {
    expect(isWalkable(tower, node.col, node.row, profile), `node ${node.col},${node.row} should hug a flat surface`).toBe(
      true,
    );
  }
  for (let i = 1; i < path.length; i++) {
    const dc = Math.abs(path[i].col - path[i - 1].col);
    const dr = Math.abs(path[i].row - path[i - 1].row);
    const orthogonal = dc + dr === 1;
    const cornerWrap = dc === 1 && dr === 1;
    expect(orthogonal || cornerWrap, 'each step is an orthogonal move or a single corner-wrap').toBe(true);
  }
}

describe('findPath on a T-shaped tower', () => {
  it('finds a surface route from the left ground to the wizard', () => {
    const tower = buildTShapedTower();
    const goal = getWizardPosition(tower);
    const start = spawnNode(tower, 'left');

    const path = findPath(tower, start, goal, profile);

    assertSurfacePath(tower, path);
    const last = path[path.length - 1];
    expect({ col: last.col, row: last.row }).toEqual({ col: goal.col, row: goal.row });
  });

  it('finds a surface route from the right side too', () => {
    const tower = buildTShapedTower();
    const goal = getWizardPosition(tower);
    const start = spawnNode(tower, 'right');

    const path = findPath(tower, start, goal, profile);

    assertSurfacePath(tower, path);
    const last = path[path.length - 1];
    expect({ col: last.col, row: last.row }).toEqual({ col: goal.col, row: goal.row });
  });

  it('never routes through open air', () => {
    const tower = buildTShapedTower();
    const goal = getWizardPosition(tower);
    const start = spawnNode(tower, 'left');

    const path = findPath(tower, start, goal, profile);

    // An air cell high above and away from the tower must not appear on the path.
    const air = macroCenterSubCell(0, 6);
    expect(path.some((n) => n.col === air.col && n.row === air.row)).toBe(false);
  });

  it('returns an empty path when the goal is inside a room', () => {
    const tower = buildTShapedTower();
    const start = spawnNode(tower, 'left');
    const blockedGoal: ExteriorNode = { ...macroCenterSubCell(5, 0), face: 'top' };
    expect(findPath(tower, start, blockedGoal, profile)).toEqual([]);
  });
});

describe('findPath on a stepped tower', () => {
  it('climbs the footprint to the wizard along surfaces', () => {
    const tower = buildPyramid();
    const goal = getWizardPosition(tower);
    const start = spawnNode(tower, 'left');

    const path = findPath(tower, start, goal, profile);

    assertSurfacePath(tower, path);
    const last = path[path.length - 1];
    expect({ col: last.col, row: last.row }).toEqual({ col: goal.col, row: goal.row });
  });
});
