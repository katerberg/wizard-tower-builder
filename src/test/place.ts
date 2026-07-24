import { getBlueprint, isStructureBlueprint } from '@/model/blueprints';
import {
  canPlace,
  createRoom,
  createStructure,
  placeRoomReplacing,
  placeStructure,
} from '@/model/tower';
import type { Cell, Tower } from '@/model/types';

let counter = 0;

export function resetPlaceCounter(): void {
  counter = 0;
}

/** Place a structure or room blueprint; rooms auto-stem. Asserts legality. */
export function placeBlueprint(tower: Tower, blueprintId: string, origin: Cell): Tower {
  const blueprint = getBlueprint(blueprintId);
  if (!blueprint) throw new Error(`Unknown blueprint ${blueprintId}`);
  const result = canPlace(tower, blueprint, origin);
  if (!result.ok) {
    throw new Error(`expected placement ok at ${origin.col},${origin.row} but got ${result.reason}`);
  }
  if (isStructureBlueprint(blueprint)) {
    return placeStructure(tower, createStructure(`t${counter++}`, blueprint, origin));
  }
  const room = createRoom(`t${counter++}`, blueprint, origin);
  const placed = placeRoomReplacing(tower, room, blueprint, () => `t${counter++}`);
  if (!placed.ok || !placed.tower) {
    throw new Error(`placeRoomReplacing failed: ${placed.reason}`);
  }
  return placed.tower;
}
