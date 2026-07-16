import { addMessage } from '@/model/messages';
import type { GameState } from '@/model/types';
import { FORTIFY_CHARGE_PER_SEC, FORTIFY_DAMAGE_MULT } from './constants';
import { addCharge, ensureEarthState } from './charge';

export function isFortified(state: GameState): boolean {
  ensureEarthState(state);
  return state.fortified === true;
}

export function startFortify(state: GameState): void {
  ensureEarthState(state);
  state.fortified = true;
  state.fortifyChargeAccum = 0;
  addMessage(state, 'The wizard fortifies — concentrating.', 'combat');
}

export function clearFortify(state: GameState, reason?: string): void {
  ensureEarthState(state);
  if (!state.fortified) return;
  state.fortified = false;
  state.fortifyChargeAccum = 0;
  addMessage(state, reason ?? 'Fortify ends.', 'combat');
}

export function tickFortify(state: GameState, dt: number): void {
  ensureEarthState(state);
  if (!state.fortified) return;
  state.fortifyChargeAccum += dt * FORTIFY_CHARGE_PER_SEC;
  while (state.fortifyChargeAccum >= 1) {
    state.fortifyChargeAccum -= 1;
    addCharge(state, 1);
  }
}

/** Incoming damage after Fortify mitigation. */
export function mitigateWizardDamage(state: GameState, damage: number): number {
  if (!isFortified(state)) return damage;
  return Math.max(1, Math.floor(damage * FORTIFY_DAMAGE_MULT));
}
