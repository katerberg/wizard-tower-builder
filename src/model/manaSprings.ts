import { MANA_SPRING_PER_SEC } from '@/config/constants';
import { isManaSpringRoom, roomHasFluidPort } from './pipes';
import type { GameState } from './types';

/** Regenerate mana while water-connected; stacks across springs. */
export function tickManaSprings(state: GameState, dt: number): void {
  for (const room of state.tower.rooms) {
    if (!isManaSpringRoom(room)) continue;
    if (!roomHasFluidPort(state.tower, room.origin, room.size, 'water')) continue;
    state.player.mana = Math.min(
      state.player.maxMana,
      state.player.mana + MANA_SPRING_PER_SEC * dt,
    );
  }
}
