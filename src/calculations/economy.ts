import type { GameState } from '../model/types';

export function canAfford(state: GameState, cost: number): boolean {
  return state.player.currency >= cost;
}

export function spend(state: GameState, cost: number): boolean {
  if (!canAfford(state, cost)) return false;
  state.player.currency -= cost;
  return true;
}

export function reward(state: GameState, amount: number): void {
  state.player.currency += amount;
}
