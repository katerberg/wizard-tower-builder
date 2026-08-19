import { getBlueprint } from './blueprints';
import {
  createRoom,
  createStructure,
  createTower,
  placeRoomReplacing,
  placeStructure,
} from './tower';
import type { Cell, Tower } from './types';

export interface StarterStructurePlacement {
  blueprintId: string;
  origin: Cell;
}

export interface StarterRoomPlacement {
  blueprintId: string;
  origin: Cell;
}

/**
 * Pre-built starter framing: two side-by-side spire columns on a shared base.
 *
 * ```text
 * row 4:  I . I     twin crowns
 * row 3:  I . I
 * row 2:  * . I     turret on the left column
 * row 1:  I . I
 * row 0:  I I I     shared base (cols 6–8)
 * ```
 */
export const STARTER_STRUCTURE_PLACEMENTS: StarterStructurePlacement[] = [
  { blueprintId: 'stem', origin: { col: 6, row: 0 } },
  { blueprintId: 'stem', origin: { col: 7, row: 0 } },
  { blueprintId: 'stem', origin: { col: 8, row: 0 } },
  { blueprintId: 'stem', origin: { col: 6, row: 1 } },
  { blueprintId: 'stem', origin: { col: 8, row: 1 } },
  { blueprintId: 'stem', origin: { col: 6, row: 3 } },
  { blueprintId: 'stem', origin: { col: 8, row: 2 } },
  { blueprintId: 'stem', origin: { col: 8, row: 3 } },
  { blueprintId: 'stem', origin: { col: 6, row: 4 } },
  { blueprintId: 'stem', origin: { col: 8, row: 4 } },
];

export const STARTER_ROOM_PLACEMENTS: StarterRoomPlacement[] = [
  { blueprintId: 'turretRoom', origin: { col: 6, row: 2 } },
];

/** @deprecated Prefer STARTER_STRUCTURE_PLACEMENTS. */
export const STARTER_TOWER_PLACEMENTS = STARTER_STRUCTURE_PLACEMENTS;

/** Structures after createStarterTower (includes auto-stems under starter rooms). */
export const STARTER_STRUCTURE_COUNT = STARTER_STRUCTURE_PLACEMENTS.length + STARTER_ROOM_PLACEMENTS.length;

export function createStarterTower(): Tower {
  let tower = createTower();
  STARTER_STRUCTURE_PLACEMENTS.forEach((placement, index) => {
    const blueprint = getBlueprint(placement.blueprintId);
    if (!blueprint) {
      throw new Error(`Unknown starter blueprint: ${placement.blueprintId}`);
    }
    tower = placeStructure(tower, createStructure(`starter-${index}`, blueprint, placement.origin));
  });
  STARTER_ROOM_PLACEMENTS.forEach((placement, index) => {
    const blueprint = getBlueprint(placement.blueprintId);
    if (!blueprint) {
      throw new Error(`Unknown starter room blueprint: ${placement.blueprintId}`);
    }
    const room = createRoom(`starter-room-${index}`, blueprint, placement.origin);
    const placed = placeRoomReplacing(tower, room, blueprint, () => `starter-stem-${index}`);
    if (!placed.ok || !placed.tower) {
      throw new Error(`Failed to place starter room ${placement.blueprintId}`);
    }
    tower = placed.tower;
  });
  return tower;
}
