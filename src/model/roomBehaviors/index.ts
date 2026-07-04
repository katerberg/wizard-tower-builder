import { goldMineRoomBehavior } from './goldMineRoom';
import { turretRoomBehavior } from './turretRoom';
import type { RoomBehaviorDef } from './types';

export type { RoomBehaviorDef, RoomEffectContext } from './types';

const ROOM_BEHAVIORS: RoomBehaviorDef[] = [turretRoomBehavior, goldMineRoomBehavior];

export function getRoomBehavior(blueprintId: string): RoomBehaviorDef | undefined {
  return ROOM_BEHAVIORS.find((b) => b.blueprintId === blueprintId);
}

export function listRoomBehaviors(): RoomBehaviorDef[] {
  return ROOM_BEHAVIORS;
}
