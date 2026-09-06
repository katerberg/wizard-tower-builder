import type { Enemy, EnemyTemplate, GameState } from '@/model/types';
import {
  attackSmashAtMacro,
  closestSmashTarget,
  enemyTouchesMacro,
  greedyStepTowardSmashTarget,
} from './demolisherCombat';
import {
  afterRoomRemovedCheckStorageLose,
  enemyTouchesRoom,
  nearestRoomCell,
  pickRaidGoal,
  stealFromStorageRoom,
} from './raid';
import { structureAt } from '@/model/tower/query';

/**
 * Drive one enemy tick toward its raid goal (room or framing smash).
 * Fliers may smash framing while their goal is framing.
 * Lives in a separate module so `raid.ts` does not import demolisher (avoids cycles).
 */
export function tickEnemyRaid(
  state: GameState,
  enemy: Enemy,
  template: EnemyTemplate,
  dt: number,
  isWalkable: (col: number, row: number) => boolean,
  trackMacroMovement: () => void,
  moveCooldownForStep: () => number,
): void {
  const goal = pickRaidGoal(state, enemy);
  enemy.raidGoal = goal;

  if (!goal) {
    const smash = closestSmashTarget(state, enemy);
    if (!smash) return;
    if (enemyTouchesMacro(enemy, smash.col, smash.row)) {
      attackSmashAtMacro(state, enemy, template, smash, dt, 'raid assault');
      return;
    }
    enemy.moveCooldown -= dt;
    if (enemy.moveCooldown <= 0) {
      const stepTo = greedyStepTowardSmashTarget(enemy, smash, isWalkable);
      if (stepTo) {
        enemy.pos = stepTo;
        trackMacroMovement();
      }
      enemy.moveCooldown = moveCooldownForStep();
    }
    return;
  }

  if (goal.kind === 'room') {
    const room = state.tower.rooms.find((r) => r.id === goal.roomId);
    if (!room) {
      enemy.raidGoal = null;
      return;
    }
    const target = nearestRoomCell(enemy, room);
    if (enemyTouchesRoom(enemy, room)) {
      const hpBefore = room.hp;
      attackSmashAtMacro(state, enemy, template, target, dt, 'raid assault');
      const live = state.tower.rooms.find((r) => r.id === room.id);
      if (live) {
        stealFromStorageRoom(state, live, Math.max(0, hpBefore - live.hp));
      } else {
        afterRoomRemovedCheckStorageLose(state, room.id, room.blueprintId);
      }
      return;
    }
    enemy.moveCooldown -= dt;
    if (enemy.moveCooldown <= 0) {
      const stepTo = greedyStepTowardSmashTarget(enemy, target, isWalkable);
      if (stepTo) {
        enemy.pos = stepTo;
        trackMacroMovement();
      }
      enemy.moveCooldown = moveCooldownForStep();
    }
    return;
  }

  const cell = goal.cell;
  if (!structureAt(state.tower, cell.col, cell.row)) {
    enemy.raidGoal = null;
    return;
  }
  if (enemyTouchesMacro(enemy, cell.col, cell.row)) {
    attackSmashAtMacro(state, enemy, template, cell, dt, 'raid assault');
    return;
  }
  enemy.moveCooldown -= dt;
  if (enemy.moveCooldown <= 0) {
    const stepTo = greedyStepTowardSmashTarget(enemy, cell, isWalkable);
    if (stepTo) {
      enemy.pos = stepTo;
      trackMacroMovement();
    }
    enemy.moveCooldown = moveCooldownForStep();
  }
}
