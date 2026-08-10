import { isManaSpringRoom } from '@/model/pipes';
import { isResearchRoom } from '@/model/research';
import { HOUSING_MIN_RECRUITED, housingKindOf, isHousingRoom, isSlotRoom, staffKindForHousing } from './capacity';
import type { GameState, Room, StaffKind } from '@/model/types';

export function pruneOrphanStaffState(state: GameState): void {
  const ids = new Set(state.tower.rooms.map((r) => r.id));
  for (const id of Object.keys(state.housingRecruited)) {
    if (!ids.has(id)) delete state.housingRecruited[id];
  }
  for (const id of Object.keys(state.slotAllocations)) {
    if (!ids.has(id)) delete state.slotAllocations[id];
  }
  for (const id of Object.keys(state.manaSpringAllocations)) {
    if (!ids.has(id)) delete state.manaSpringAllocations[id];
  }
  for (const id of Object.keys(state.researchRoomAllocations)) {
    if (!ids.has(id)) delete state.researchRoomAllocations[id];
  }
}

/** @deprecated Use pruneOrphanStaffState. */
export const pruneOrphanSoldierState = pruneOrphanStaffState;

/** New housing starts with 1 recruit; slots/springs/research seed allocation 1. */
export function seedSpecialtyRoomDefaults(state: GameState, room: Room): void {
  if (isHousingRoom(room)) {
    if ((state.housingRecruited[room.id] ?? 0) < HOUSING_MIN_RECRUITED) {
      state.housingRecruited[room.id] = HOUSING_MIN_RECRUITED;
    }
  }
  if (isSlotRoom(room)) {
    if ((state.slotAllocations[room.id] ?? 0) < 1) {
      state.slotAllocations[room.id] = 1;
    }
  }
  if (isManaSpringRoom(room)) {
    if ((state.manaSpringAllocations[room.id] ?? 0) < 1) {
      state.manaSpringAllocations[room.id] = 1;
    }
  }
  if (isResearchRoom(room)) {
    if ((state.researchRoomAllocations[room.id] ?? 0) < 1) {
      state.researchRoomAllocations[room.id] = 1;
    }
  }
}

export function pruneHousingState(state: GameState, removedRoomId: string): void {
  delete state.housingRecruited[removedRoomId];
  delete state.slotAllocations[removedRoomId];
  delete state.manaSpringAllocations[removedRoomId];
  delete state.researchRoomAllocations[removedRoomId];
}

/** @deprecated Use pruneHousingState. */
export const pruneBarracksState = pruneHousingState;

export function totalRecruitedStaff(state: GameState, kind?: StaffKind): number {
  let total = 0;
  for (const room of state.tower.rooms) {
    const housing = housingKindOf(room);
    if (!housing) continue;
    if (kind && staffKindForHousing(housing) !== kind) continue;
    total += state.housingRecruited[room.id] ?? 0;
  }
  return total;
}

/** @deprecated Use totalRecruitedStaff. */
export function totalRecruitedSoldiers(state: GameState): number {
  return totalRecruitedStaff(state, 'soldier');
}

export function totalAllocatedSoldiers(state: GameState): number {
  return Object.values(state.slotAllocations).reduce((sum, n) => sum + n, 0);
}

export function totalAllocatedMagi(state: GameState): number {
  const springs = Object.values(state.manaSpringAllocations).reduce((sum, n) => sum + n, 0);
  const research = Object.values(state.researchRoomAllocations).reduce((sum, n) => sum + n, 0);
  return springs + research;
}

export {
  housingCapacity, housingKindOf, isChamber, isGuardroom, isHousingRoom, isQuarters,
  isSlotRoom, slotCapacity, canRecruitInHousing, HOUSING_MIN_RECRUITED,
  staffKindForHousing, isBarracksRoom, barracksCapacity, canRecruitInBarracks,
} from './capacity';
