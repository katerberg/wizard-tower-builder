import { getEnemyTemplate } from '@/model/enemies';
import { addMessage } from '@/model/messages';
import { applyFireDamage } from './kindled';
import {
  IMMOLATE_BASE_TICK_DAMAGE,
  IMMOLATE_DURATION,
  IMMOLATE_RAMP_CELLS,
  IMMOLATE_RAMP_PER_CELL,
  IMMOLATE_TICK_INTERVAL,
} from './constants';
import type { Enemy, GameState } from '@/model/types';

function posKey(enemy: Enemy): string {
  return `${enemy.pos.col},${enemy.pos.row},${enemy.pos.face}`;
}

/** On exterior climb surface; ends for fly profile (future fliers). */
export function isOnWall(_state: GameState, enemy: Enemy): boolean {
  const template = getEnemyTemplate(enemy.templateId);
  if (!template) return false;
  if (template.movement.canFly) return false;
  return true;
}

export function startImmolate(state: GameState, enemy: Enemy): void {
  state.immolateByEnemyId[enemy.id] = {
    until: state.waveTimer + IMMOLATE_DURATION,
    wallDistance: 0,
    tickAccumulator: 0,
    lastPosKey: posKey(enemy),
  };
}

export function clearImmolate(state: GameState, enemyId: string): void {
  delete state.immolateByEnemyId[enemyId];
}

function immolateTickDamage(wallDistance: number): number {
  const ramp = Math.min(wallDistance, IMMOLATE_RAMP_CELLS);
  return IMMOLATE_BASE_TICK_DAMAGE + ramp * IMMOLATE_RAMP_PER_CELL;
}

export function tickImmolate(state: GameState, dt: number): void {
  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const immo = state.immolateByEnemyId[enemy.id];
    if (!immo) continue;

    if (state.waveTimer >= immo.until) {
      clearImmolate(state, enemy.id);
      continue;
    }

    if (!isOnWall(state, enemy)) {
      clearImmolate(state, enemy.id);
      const template = getEnemyTemplate(enemy.templateId);
      if (template) {
        addMessage(state, `Immolate on ${enemy.name} the ${template.type} fades — off the wall.`, 'combat');
      }
      continue;
    }

    const key = posKey(enemy);
    if (key !== immo.lastPosKey) {
      immo.wallDistance += 1;
      immo.lastPosKey = key;
    }

    immo.tickAccumulator += dt;
    if (immo.tickAccumulator < IMMOLATE_TICK_INTERVAL) continue;
    immo.tickAccumulator -= IMMOLATE_TICK_INTERVAL;

    const damage = immolateTickDamage(immo.wallDistance);
    applyFireDamage(state, enemy, damage, 'Immolate');
  }
}
