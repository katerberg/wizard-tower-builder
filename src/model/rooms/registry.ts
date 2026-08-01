import type { GameState } from '../types';
import { boilerRoom } from './boiler';
import { hydrantRoom } from './hydrant';
import { manaSpringRoom } from './manaSpring';
import { slotRoom } from './slot';
import { steamTurretRoom } from './steamTurret';
import { turretRoom } from './turret';
import type { RoomBehaviorDef, RoomRole } from './types';

const ROOM_BEHAVIORS: RoomBehaviorDef[] = [
  turretRoom,
  slotRoom,
  boilerRoom,
  manaSpringRoom,
  steamTurretRoom,
  hydrantRoom,
];

export function getRoomBehavior(id: string): RoomBehaviorDef | undefined {
  return ROOM_BEHAVIORS.find((behavior) => behavior.blueprintId === id);
}

export function listRoomBehaviors(): RoomBehaviorDef[] {
  return ROOM_BEHAVIORS;
}

export function roomHasRole(room: { blueprintId: string }, role: RoomRole): boolean {
  return getRoomBehavior(room.blueprintId)?.roles?.includes(role) ?? false;
}

/** Continuous tick hooks. Hydrants tick in water/tick.ts to preserve sheet timing. */
export function tickRoomBehaviors(state: GameState, dt: number): void {
  for (const behavior of ROOM_BEHAVIORS) {
    behavior.tick?.(state, dt);
  }
}

export function resetRoomBehaviors(state: GameState): void {
  for (const behavior of ROOM_BEHAVIORS) {
    behavior.reset?.(state);
  }
}
