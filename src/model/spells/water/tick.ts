import type { GameState } from '@/model/types';
import { clearSoak, tickSoakDecay } from './soak';
import { resetHydrantTimers, tickHydrants } from './hydrant';
import { resetWetCells, tickWetCells } from './wetCells';
import { resetActiveWaterfalls, tickActiveWaterfalls } from './waterfall';

export function resetWaterState(state: GameState): void {
  resetActiveWaterfalls(state);
  resetWetCells(state);
  resetHydrantTimers(state);
  for (const enemy of state.enemies) {
    clearSoak(enemy);
  }
}

export function tickWaterEffects(state: GameState, dt: number): void {
  // W4: full detach clears Soak (air knock-off / airborne).
  for (const enemy of state.enemies) {
    if (enemy.airborne) clearSoak(enemy);
  }
  tickHydrants(state, dt);
  tickWetCells(state, dt);
  tickActiveWaterfalls(state, dt);
  tickSoakDecay(state, dt);
}

export * from './constants';
export * from './soak';
export * from './wetCells';
export * from './hydrant';
export * from './splash';
export * from './waterfall';
export * from './deadweight';
export * from './geyser';
