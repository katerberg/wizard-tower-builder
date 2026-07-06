import type { Enemy, GameState } from '../../types';
import { KINDLED_DURATION } from './constants';

export function isKindled(enemy: Enemy, state: GameState): boolean {
  return (enemy.kindledUntil ?? 0) > state.waveTimer;
}

export function applyKindled(state: GameState, enemy: Enemy): void {
  enemy.kindledUntil = state.waveTimer + KINDLED_DURATION;
}

export function clearKindled(enemy: Enemy): void {
  delete enemy.kindledUntil;
}

export function tickKindledTimers(state: GameState): void {
  for (const enemy of state.enemies) {
    if (enemy.kindledUntil !== undefined && enemy.kindledUntil <= state.waveTimer) {
      clearKindled(enemy);
    }
  }
}
