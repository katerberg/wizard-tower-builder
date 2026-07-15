import type { GameState } from '@/model/types';
import type { SpellCastContext } from '../types';
import { resetEarthState } from './charge';
import { tickFaultPatches } from './fault';
import { tickFortify } from './fortify';
import { tickBoulders } from './boulder';

export function tickEarthEffects(
  state: GameState,
  dt: number,
  ctxFactory: (spellName: string) => SpellCastContext,
): void {
  tickFaultPatches(state);
  tickFortify(state, dt);
  tickBoulders(state, dt, ctxFactory('Boulder'));
}

export { resetEarthState };
export * from './constants';
export * from './charge';
export * from './fault';
export * from './fortify';
export * from './boulder';
export * from './earthquake';
