import {
  RESEARCH_MAGE_EFFICIENCY,
  RESEARCH_PROGRESS_PER_SEC,
} from '@/config/research';
import { stationedMagiInRoom } from '@/model/staff/combat';
import type { GameState, Room } from '@/model/types';
import type { RoomBehaviorDef } from '@/model/rooms/types';
import { addResearchProgress } from './state';

export function isResearchRoom(room: { blueprintId: string }): boolean {
  return room.blueprintId === 'researchRoom';
}

export function listResearchRooms(state: GameState): Room[] {
  return state.tower.rooms.filter(isResearchRoom);
}

/** Attack-phase: stationed magi in research rooms advance the active project. */
export function tickResearchProgress(state: GameState, dt: number): void {
  if (!state.player.research.active) return;
  let efficiency = 0;
  for (const room of listResearchRooms(state)) {
    const magi = stationedMagiInRoom(state, room.id);
    for (let i = 0; i < magi.length; i++) {
      efficiency += RESEARCH_MAGE_EFFICIENCY[i] ?? 0;
    }
  }
  if (efficiency <= 0) return;
  addResearchProgress(state, RESEARCH_PROGRESS_PER_SEC * efficiency * dt);
}

export const researchRoomBehavior: RoomBehaviorDef = {
  blueprintId: 'researchRoom',
  mechanics: 'Stationed magi advance the active research project during attack.',
  roles: ['research'],
  tick: tickResearchProgress,
};
