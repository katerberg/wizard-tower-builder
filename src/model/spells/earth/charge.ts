import { addMessage } from '@/model/messages';
import { MAX_CHARGE } from './constants';
import type { GameState } from '@/model/types';

export function ensureEarthState(state: GameState): void {
  state.earthCharge ??= 0;
  state.faultPatches ??= [];
  state.fortified ??= false;
  state.fortifyChargeAccum ??= 0;
  state.pendingBoulders ??= [];
}

export function getCharge(state: GameState): number {
  ensureEarthState(state);
  return state.earthCharge;
}

export function addCharge(state: GameState, amount: number, reason?: string): void {
  ensureEarthState(state);
  const before = state.earthCharge;
  state.earthCharge = Math.min(MAX_CHARGE, state.earthCharge + amount);
  if (state.earthCharge > before && reason) {
    addMessage(state, `Charge ${before} → ${state.earthCharge} (${reason}).`, 'combat');
  }
}

/** Spend all Charge; returns amount spent. */
export function spendAllCharge(state: GameState): number {
  ensureEarthState(state);
  const spent = state.earthCharge;
  state.earthCharge = 0;
  return spent;
}

export function resetEarthState(state: GameState): void {
  state.earthCharge = 0;
  state.faultPatches = [];
  state.fortified = false;
  state.fortifyChargeAccum = 0;
  state.pendingBoulders = [];
}
