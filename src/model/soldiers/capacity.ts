import {
  BARRACKS_BASE_CAPACITY,
  BARRACKS_EXPANDED_CAPACITY,
  SLOT_BASE_CAPACITY,
  SLOT_EXPANDED_CAPACITY,
} from '@/config/constants';
import type { Room } from '../types';

export function barracksCapacity(room: Room): number {
  const expansion = room.modifications.find((m) => m.id === 'barracksExpansion');
  return expansion && expansion.level > 0 ? BARRACKS_EXPANDED_CAPACITY : BARRACKS_BASE_CAPACITY;
}

export function slotCapacity(room: Room): number {
  const expansion = room.modifications.find((m) => m.id === 'slotExpansion');
  return expansion && expansion.level > 0 ? SLOT_EXPANDED_CAPACITY : SLOT_BASE_CAPACITY;
}

export function isBarracksRoom(room: Room): boolean {
  return room.blueprintId === 'barracksRoom';
}

export function isSlotRoom(room: Room): boolean {
  return room.blueprintId === 'slotRoom';
}

export function canRecruitInBarracks(room: Room, recruited: number): boolean {
  return recruited < barracksCapacity(room);
}
