import type { GameState } from '@/model/types';
import { expireKindled } from './kindled';
import { expireKindlingPatches } from './kindling';
import { tickImmolate } from './immolate';
import { tickWallOfFlame } from './wallOfFlame';

export function createEmptyFireState(): Pick<
  GameState,
  'kindlingPatches' | 'kindledUntil' | 'immolateByEnemyId' | 'wallOfFlameSegments'
> {
  return {
    kindlingPatches: [],
    kindledUntil: {},
    immolateByEnemyId: {},
    wallOfFlameSegments: [],
  };
}

export function resetFireWaveState(state: GameState): void {
  state.kindlingPatches = [];
  state.kindledUntil = {};
  state.immolateByEnemyId = {};
  state.wallOfFlameSegments = [];
}

export function tickFireEffects(state: GameState, dt: number): void {
  expireKindled(state);
  expireKindlingPatches(state);
  tickImmolate(state, dt);
  tickWallOfFlame(state, dt);
}

export * from './constants';
export * from './kindled';
export * from './kindling';
export * from './immolate';
export * from './wallOfFlame';
