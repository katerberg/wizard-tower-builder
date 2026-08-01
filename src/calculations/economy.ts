import type { GameState, ResourceCost, Resources } from '../model/types';
import {
  addResources,
  asResources,
  canAffordResources,
  cloneResources,
  subResources,
} from './resources';

export {
  RESOURCE_IDS,
  RESOURCE_LABELS,
  addResources,
  asResources,
  canAffordResources,
  cloneResources,
  emptyResources,
  formatResourceAmount,
  formatResourceCost,
  isZeroCost,
  resourcesEqual,
  scaleResources,
  subResources,
  totalResourceUnits,
} from './resources';

export function canAfford(state: GameState, cost: ResourceCost): boolean {
  return canAffordResources(state.player.resources, cost);
}

export function spend(state: GameState, cost: ResourceCost): boolean {
  if (!canAfford(state, cost)) return false;
  state.player.resources = subResources(state.player.resources, cost);
  return true;
}

export function reward(state: GameState, amount: ResourceCost): void {
  state.player.resources = addResources(state.player.resources, amount);
}

export function rewardGold(state: GameState, amount: number): void {
  reward(state, { gold: amount });
}

export function rewardSouls(state: GameState, amount: number): void {
  reward(state, { souls: amount });
}

export function setResources(state: GameState, next: Resources): void {
  state.player.resources = cloneResources(next);
}

export function goldOnlyCost(gold: number): ResourceCost {
  return asResources({ gold });
}
