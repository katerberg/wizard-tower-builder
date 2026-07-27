import type { Enemy, GameState } from '@/model/types';
import {
  DAMP_THRESHOLD,
  DEADWEIGHT_DURATION,
  DEADWEIGHT_FAKE_SOAK,
  MAX_SOAK,
  SOAK_HALF_LIFE,
  SOAK_SPEED_FLOOR,
} from './constants';

export function getSoak(enemy: Enemy): number {
  return Math.max(0, Math.min(MAX_SOAK, enemy.soak ?? 0));
}

export function isDamp(enemy: Enemy): boolean {
  const s = getSoak(enemy);
  return s > 0 && s < DAMP_THRESHOLD;
}

export function isDampOrWetter(enemy: Enemy): boolean {
  return getSoak(enemy) >= DAMP_THRESHOLD;
}

export function addSoak(enemy: Enemy, amount: number): void {
  if (amount <= 0) return;
  enemy.soak = Math.min(MAX_SOAK, getSoak(enemy) + amount);
  enemy.soakHalfLifeTimer ??= SOAK_HALF_LIFE;
}

export function clearSoak(enemy: Enemy): void {
  delete enemy.soak;
  delete enemy.soakHalfLifeTimer;
  delete enemy.deadweightSoakBonus;
  delete enemy.deadweightUntil;
}

/** Effective Soak used only for speed math (real + temporary Deadweight bonus). */
export function effectiveSoakForSpeed(state: GameState, enemy: Enemy): number {
  let soak = getSoak(enemy);
  if ((enemy.deadweightUntil ?? 0) > state.waveTimer) {
    soak += enemy.deadweightSoakBonus ?? 0;
  }
  return Math.min(MAX_SOAK, soak);
}

/**
 * Speed multiplier from Soak.
 * Anchors: ~25 → 0.5, ~50 → ~0.29, floor at full Soak.
 */
export function soakSpeedMultiplier(state: GameState, enemy: Enemy): number {
  const soak = effectiveSoakForSpeed(state, enemy);
  if (soak <= 0) return 1;
  return Math.max(SOAK_SPEED_FLOOR, 1 - Math.sqrt(soak / MAX_SOAK));
}

/** Inverse of speed mult → moveCooldown scale (same role as blizzardSlowMultiplier). */
export function soakSlowMultiplier(state: GameState, enemy: Enemy): number {
  const speed = soakSpeedMultiplier(state, enemy);
  return speed > 0 ? 1 / speed : 1 / SOAK_SPEED_FLOOR;
}

export function applyDeadweightSlow(state: GameState, enemy: Enemy): void {
  enemy.deadweightSoakBonus = DEADWEIGHT_FAKE_SOAK;
  enemy.deadweightUntil = state.waveTimer + DEADWEIGHT_DURATION;
}

export function tickSoakDecay(state: GameState, dt: number): void {
  for (const enemy of state.enemies) {
    if ((enemy.deadweightUntil ?? 0) > 0 && enemy.deadweightUntil! <= state.waveTimer) {
      delete enemy.deadweightSoakBonus;
      delete enemy.deadweightUntil;
    }

    const soak = getSoak(enemy);
    if (soak <= 0) {
      clearSoak(enemy);
      continue;
    }
    enemy.soakHalfLifeTimer = (enemy.soakHalfLifeTimer ?? SOAK_HALF_LIFE) - dt;
    if (enemy.soakHalfLifeTimer > 0) continue;
    enemy.soak = Math.floor(soak / 2);
    enemy.soakHalfLifeTimer = SOAK_HALF_LIFE;
    if ((enemy.soak ?? 0) <= 0) {
      clearSoak(enemy);
    }
  }
}
