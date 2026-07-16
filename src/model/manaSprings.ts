import { MANA_SPRING_MAGE_EFFICIENCY, MANA_SPRING_PER_SEC } from '@/config/constants';
import { isManaSpringRoom, roomHasFluidPort } from './pipes';
import { stationedMagiInSpring } from './staff';
import type { GameState } from './types';

/** Regenerate mana while water-connected and staffed by magi; stacks across springs. */
export function tickManaSprings(state: GameState, dt: number): void {
  for (const room of state.tower.rooms) {
    if (!isManaSpringRoom(room)) continue;
    if (!roomHasFluidPort(state.tower, room.origin, room.size, 'water')) continue;
    const magi = stationedMagiInSpring(state, room.id);
    if (magi.length === 0) continue;

    let efficiency = 0;
    for (let i = 0; i < magi.length; i++) {
      efficiency += MANA_SPRING_MAGE_EFFICIENCY[i] ?? 0;
    }
    if (efficiency <= 0) continue;

    state.player.mana = Math.min(
      state.player.maxMana,
      state.player.mana + MANA_SPRING_PER_SEC * efficiency * dt,
    );
  }
}
