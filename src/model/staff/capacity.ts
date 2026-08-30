import {
  CHAMBER_BASE_CAPACITY,
  CHAMBER_EXPANDED_CAPACITY,
  GUARDROOM_BASE_CAPACITY,
  GUARDROOM_EXPANDED_CAPACITY,
  MANA_SPRING_STAFF_CAPACITY,
  QUARTERS_BASE_CAPACITY,
  QUARTERS_EXPANDED_CAPACITY,
  RESEARCH_ROOM_STAFF_CAPACITY,
  SLOT_BASE_CAPACITY,
  SLOT_EXPANDED_CAPACITY,
} from '@/config/constants';
import { getBlueprint } from '@/model/blueprints';
import type { GameState, HousingKind, Room, StaffKind } from '@/model/types';

const HOUSING_TO_STAFF: Record<HousingKind, StaffKind> = {
  guardroom: 'soldier',
  chamber: 'mage',
  quarters: 'laborer',
};

const EXPANSION_MOD: Record<HousingKind, string> = {
  guardroom: 'guardroomExpansion',
  chamber: 'chamberExpansion',
  quarters: 'quartersExpansion',
};

export function housingKindOf(room: Room): HousingKind | null {
  return getBlueprint(room.blueprintId)?.housing ?? null;
}

export function staffKindForHousing(kind: HousingKind): StaffKind {
  return HOUSING_TO_STAFF[kind];
}

export function isHousingRoom(room: Room): boolean {
  return housingKindOf(room) !== null;
}

export function isGuardroom(room: Room): boolean {
  return housingKindOf(room) === 'guardroom';
}

export function isChamber(room: Room): boolean {
  return housingKindOf(room) === 'chamber';
}

export function isQuarters(room: Room): boolean {
  return housingKindOf(room) === 'quarters';
}

export function isSlotRoom(room: Room): boolean {
  return room.blueprintId === 'slotRoom';
}

export function housingCapacity(room: Room): number {
  const kind = housingKindOf(room);
  if (!kind) return 0;
  const modId = EXPANSION_MOD[kind];
  const expanded = room.modifications.some((m) => m.id === modId && m.level > 0);
  switch (kind) {
    case 'guardroom':
      return expanded ? GUARDROOM_EXPANDED_CAPACITY : GUARDROOM_BASE_CAPACITY;
    case 'chamber':
      return expanded ? CHAMBER_EXPANDED_CAPACITY : CHAMBER_BASE_CAPACITY;
    case 'quarters':
      return expanded ? QUARTERS_EXPANDED_CAPACITY : QUARTERS_BASE_CAPACITY;
  }
}

export function slotCapacity(room: Room): number {
  const expansion = room.modifications.find((m) => m.id === 'slotExpansion');
  return expansion && expansion.level > 0 ? SLOT_EXPANDED_CAPACITY : SLOT_BASE_CAPACITY;
}

export function manaSpringStaffCapacity(): number {
  return MANA_SPRING_STAFF_CAPACITY;
}

export function researchRoomStaffCapacity(): number {
  return RESEARCH_ROOM_STAFF_CAPACITY;
}

export function canRecruitInHousing(room: Room, recruited: number): boolean {
  return isHousingRoom(room) && recruited < housingCapacity(room);
}

/** Net recruit/unrecruit side jobs still running for one housing room. */
export function pendingRecruitDeltaForHousing(state: GameState, housingRoomId: string): number {
  let delta = 0;
  for (const job of state.sideJobs) {
    if (job.status !== 'running') continue;
    if (job.kind === 'recruit' && job.payload.housingRoomId === housingRoomId) delta += 1;
    if (job.kind === 'unrecruit' && job.payload.housingRoomId === housingRoomId) delta -= 1;
  }
  return delta;
}

/** Committed roster including in-flight recruit/unrecruit side jobs. */
export function effectiveHousingRecruited(state: GameState, housingRoomId: string): number {
  return (state.housingRecruited[housingRoomId] ?? 0) + pendingRecruitDeltaForHousing(state, housingRoomId);
}

/** Minimum roster size while the room exists (unrecruit floor). */
export const HOUSING_MIN_RECRUITED = 1;

/** @deprecated Use isGuardroom. */
export const isBarracksRoom = isGuardroom;
/** @deprecated Use housingCapacity. */
export const barracksCapacity = housingCapacity;
/** @deprecated Use canRecruitInHousing. */
export const canRecruitInBarracks = canRecruitInHousing;
