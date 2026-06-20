import { describe, expect, it } from 'vitest';
import { ENEMY_TEMPLATES } from '../model/enemies';
import { findPath } from './pathfinding';
import { spawnNode } from './exteriorGraph';
import { createRoom, createTower, getWizardPosition, placeRoom } from '../model/tower';
import { getBlueprint } from '../model/blueprints';
import type { Tower } from '../model/types';

const profile = ENEMY_TEMPLATES.goblin.movement;

function buildTShapedTower(): Tower {
  let tower = createTower();
  const stem = getBlueprint('stem')!;
  const wide = getBlueprint('buttress3')!;
  tower = placeRoom(tower, createRoom('a', stem, { col: 5, row: 0 }));
  // 3-wide buttress overhangs the stem on both sides.
  tower = placeRoom(tower, createRoom('c', wide, { col: 4, row: 1 }));
  return tower;
}

describe('findPath on a T-shaped tower', () => {
  it('finds a route from the ground to the wizard despite overhangs', () => {
    const tower = buildTShapedTower();
    const goal = getWizardPosition(tower);
    const start = spawnNode(tower, 'left');

    const path = findPath(tower, start, goal, profile);

    expect(path.length).toBeGreaterThan(0);
    const last = path[path.length - 1];
    expect({ col: last.col, row: last.row }).toEqual({ col: goal.col, row: goal.row });
  });

  it('finds a route from the right side too', () => {
    const tower = buildTShapedTower();
    const goal = getWizardPosition(tower);
    const start = spawnNode(tower, 'right');
    const path = findPath(tower, start, goal, profile);
    expect(path.length).toBeGreaterThan(0);
  });

  it('returns an empty path when the goal is inside a room', () => {
    const tower = buildTShapedTower();
    const start = spawnNode(tower, 'left');
    const blockedGoal = { col: 5, row: 0, face: 'top' as const };
    expect(findPath(tower, start, blockedGoal, profile)).toEqual([]);
  });
});
