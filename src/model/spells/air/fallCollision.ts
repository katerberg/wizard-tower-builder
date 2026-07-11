import { isWalkable, surfaceContacts } from '../../../calculations/exteriorGraph';
import { macroCol, macroRow } from '../../../calculations/subGrid';
import { cellKey } from '../../../calculations/grid';
import { getEnemyTemplate } from '../../enemies';
import { addMessage } from '../../messages';
import type { Enemy, ExteriorNode, GameState, Tower } from '../../types';
import { applyDiscombobulated } from './discombobulated';
import { COLLISION_DAMAGE, FALL_DAMAGE_PER_SUB_ROW } from './constants';

function isRoomSub(tower: Tower, subCol: number, subRow: number): boolean {
  return Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(macroCol(subCol), macroRow(subRow)));
}

export function applyFallDamage(state: GameState, enemy: Enemy, subRows: number, source: string): void {
  if (subRows <= 0 || enemy.currentHp <= 0) return;
  const template = getEnemyTemplate(enemy.templateId);
  if (!template) return;
  const damage = subRows * FALL_DAMAGE_PER_SUB_ROW;
  enemy.currentHp -= damage;
  addMessage(state, `${enemy.name} the ${template.type} takes ${damage} fall damage from ${source}.`, 'combat');
}

export function applyCollisionDamage(state: GameState, enemy: Enemy, source: string): void {
  if (enemy.currentHp <= 0) return;
  const template = getEnemyTemplate(enemy.templateId);
  if (!template) return;
  enemy.currentHp -= COLLISION_DAMAGE;
  addMessage(state, `${enemy.name} the ${template.type} slams into the tower for ${COLLISION_DAMAGE} (${source}).`, 'combat');
}

export function wasOnWall(tower: Tower, pos: ExteriorNode): boolean {
  return surfaceContacts(tower, pos.col, pos.row).size > 0;
}

function fallDistanceFrom(enemy: Enemy, landRow: number): number {
  const fromRow = enemy.airborneFromRow ?? enemy.pos.row;
  return Math.max(0, fromRow - landRow);
}

function clearAirborne(enemy: Enemy): void {
  delete enemy.airborne;
  delete enemy.airborneFromRow;
  delete enemy.fallSubRows;
  delete enemy.airborneTimer;
}

export function detachEnemy(_state: GameState, enemy: Enemy): void {
  applyDiscombobulated(enemy);
  enemy.airborne = true;
  enemy.airborneFromRow = enemy.pos.row;
  enemy.fallSubRows = 0;
  enemy.path = [];
  enemy.pathIndex = 0;
}

export function tickAirborneEnemies(state: GameState, dt: number): void {
  const tower = state.tower;
  for (const enemy of state.enemies) {
    if (!enemy.airborne || enemy.currentHp <= 0) continue;

    enemy.airborneTimer = (enemy.airborneTimer ?? 0) + dt;
    const stepInterval = 0.15;
    if ((enemy.airborneTimer ?? 0) < stepInterval) continue;
    enemy.airborneTimer = 0;

    const below = { col: enemy.pos.col, row: enemy.pos.row - 1, face: enemy.pos.face };

    if (below.row < 0) {
      const distance = fallDistanceFrom(enemy, 0);
      if (distance > 0) applyFallDamage(state, enemy, distance, 'the drop');
      enemy.pos = { ...enemy.pos, row: 0 };
      clearAirborne(enemy);
      continue;
    }

    if (isRoomSub(tower, below.col, below.row)) {
      const distance = fallDistanceFrom(enemy, below.row);
      if (distance > 0) applyFallDamage(state, enemy, distance, 'the drop');
      applyCollisionDamage(state, enemy, 'the fall');
      clearAirborne(enemy);
      continue;
    }

    const template = getEnemyTemplate(enemy.templateId);
    if (template && isWalkable(tower, below.col, below.row, template.movement)) {
      const distance = fallDistanceFrom(enemy, below.row);
      if (distance > 0) applyFallDamage(state, enemy, distance, 'the drop');
      enemy.pos = below;
      clearAirborne(enemy);
      continue;
    }

    enemy.pos = below;
    enemy.fallSubRows = (enemy.fallSubRows ?? 0) + 1;
  }
}
