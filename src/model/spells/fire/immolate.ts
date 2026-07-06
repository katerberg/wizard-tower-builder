import { surfaceContacts } from '../../../calculations/exteriorGraph';
import { getEnemyTemplate } from '../../enemies';
import type { Enemy, GameState, Tower } from '../../types';
import type { SpellCastContext } from '../types';
import {
  IMMOLATE_DAMAGE_MAX,
  IMMOLATE_DAMAGE_MIN,
  IMMOLATE_DURATION,
  IMMOLATE_RAMP_CELLS,
  IMMOLATE_TICK_INTERVAL,
} from './constants';
import { applyFireDamage } from './fireDamage';

export function isOnWall(tower: Tower, enemy: Enemy): boolean {
  const template = getEnemyTemplate(enemy.templateId);
  if (!template || template.movement.canFly) return false;
  return surfaceContacts(tower, enemy.pos.col, enemy.pos.row).size > 0;
}

export function immolateDamageForDistance(distanceBurned: number): number {
  const ramp = Math.min(distanceBurned, IMMOLATE_RAMP_CELLS) / IMMOLATE_RAMP_CELLS;
  return Math.round(IMMOLATE_DAMAGE_MIN + ramp * (IMMOLATE_DAMAGE_MAX - IMMOLATE_DAMAGE_MIN));
}

export function startImmolate(state: GameState, enemy: Enemy): void {
  enemy.immolateUntil = state.waveTimer + IMMOLATE_DURATION;
  enemy.immolateDistanceBurned = 0;
  enemy.immolateTickTimer = 0;
}

export function clearImmolate(enemy: Enemy): void {
  delete enemy.immolateUntil;
  delete enemy.immolateDistanceBurned;
  delete enemy.immolateTickTimer;
}

export function isImmolating(enemy: Enemy, state: GameState): boolean {
  return (enemy.immolateUntil ?? 0) > state.waveTimer;
}

export function onEnemyWallStep(state: GameState, enemy: Enemy): void {
  if (!isImmolating(enemy, state)) return;
  if (!isOnWall(state.tower, enemy)) {
    clearImmolate(enemy);
    return;
  }
  enemy.immolateDistanceBurned = (enemy.immolateDistanceBurned ?? 0) + 1;
}

export function tickImmolate(state: GameState, dt: number, buildCtx: (spellName: string) => SpellCastContext): void {
  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) continue;
    if (!isImmolating(enemy, state)) continue;

    if (!isOnWall(state.tower, enemy)) {
      clearImmolate(enemy);
      continue;
    }

    enemy.immolateTickTimer = (enemy.immolateTickTimer ?? 0) + dt;
    if (enemy.immolateTickTimer < IMMOLATE_TICK_INTERVAL) continue;
    enemy.immolateTickTimer -= IMMOLATE_TICK_INTERVAL;

    const damage = immolateDamageForDistance(enemy.immolateDistanceBurned ?? 0);
    const ctx = buildCtx('Immolate');
    applyFireDamage(ctx, enemy, damage);
  }
}
