import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '@/config/constants';
import { isWalkable } from '@/calculations/exteriorGraph';
import { getBlueprint } from '@/model/blueprints';
import { ENEMY_TEMPLATES } from '@/model/enemies';
import {
  attackSmashAtMacro,
  closestSmashTarget,
  enemyTouchesMacro,
  handleStuckClimberSmash,
} from '@/model/enemies/demolisherCombat';
import { createInitialState } from '@/model/game';
import { createStructure, createTower, placeStructure } from '@/model/tower';
import type { Enemy, GameState } from '@/model/types';

function makeSwarm(pos: { col: number; row: number }): Enemy {
  return {
    id: 'swarm-1',
    templateId: 'swarm',
    name: 'Gob',
    pos: { col: pos.col, row: pos.row, face: 'left' },
    path: [],
    pathIndex: 0,
    currentHp: ENEMY_TEMPLATES.swarm.stats.maxHp,
    moveCooldown: 0,
    attackCooldown: 0,
  };
}

function stemState(): { state: GameState; enemy: Enemy } {
  let tower = createTower();
  tower = placeStructure(tower, createStructure('a', getBlueprint('stem')!, { col: 5, row: 0 }));
  const state = createInitialState('stuck-smash');
  state.phase = 'attack';
  state.tower = tower;
  const wallSub = { col: 5 * 3 - 1, row: 0 };
  const enemy = makeSwarm(wallSub);
  state.enemies = [enemy];
  return { state, enemy };
}

describe('stuck climber smash', () => {
  it('picks the closest framing cell', () => {
    const { state, enemy } = stemState();
    const target = closestSmashTarget(state, enemy);
    expect(target).toEqual({ col: 5, row: 0 });
    expect(enemyTouchesMacro(enemy, 5, 0)).toBe(true);
  });

  it('damages adjacent framing via shared smash', () => {
    const { state, enemy } = stemState();
    const stem = state.tower.structures?.find((s) => s.id === 'a');
    if (!stem) throw new Error('expected stem');
    const hpBefore = stem.hp;
    expect(
      attackSmashAtMacro(state, enemy, ENEMY_TEMPLATES.swarm, { col: 5, row: 0 }, FIXED_DT),
    ).toBe(true);
    expect(stem.hp).toBeLessThan(hpBefore);
  });

  it('handleStuckClimberSmash swings when adjacent with empty path', () => {
    const { state, enemy } = stemState();
    const stem = state.tower.structures?.find((s) => s.id === 'a');
    if (!stem) throw new Error('expected stem');
    const hpBefore = stem.hp;
    const moved = handleStuckClimberSmash(
      state,
      enemy,
      ENEMY_TEMPLATES.swarm,
      FIXED_DT,
      (col, row) => isWalkable(state.tower, col, row, ENEMY_TEMPLATES.swarm.movement),
      () => undefined,
      () => 1,
    );
    expect(moved).toBe(true);
    expect(stem.hp).toBeLessThan(hpBefore);
  });

  it('handleStuckClimberSmash steps toward a non-adjacent target', () => {
    let tower = createTower();
    tower = placeStructure(tower, createStructure('a', getBlueprint('stem')!, { col: 5, row: 0 }));
    tower = placeStructure(tower, createStructure('b', getBlueprint('stem')!, { col: 5, row: 1 }));
    const state = createInitialState('stuck-approach');
    state.phase = 'attack';
    state.tower = tower;
    // Stand on ground a few sub-cells left of the pillar, not yet touching macro (5,0)/(5,1).
    const enemy = makeSwarm({ col: 5 * 3 - 4, row: 0 });
    state.enemies = [enemy];
    expect(enemyTouchesMacro(enemy, 5, 0)).toBe(false);

    const colBefore = enemy.pos.col;
    handleStuckClimberSmash(
      state,
      enemy,
      ENEMY_TEMPLATES.swarm,
      FIXED_DT,
      (col, row) => isWalkable(state.tower, col, row, ENEMY_TEMPLATES.swarm.movement),
      () => undefined,
      () => 0.1,
    );
    expect(enemy.pos.col).not.toBe(colBefore);
  });
});
