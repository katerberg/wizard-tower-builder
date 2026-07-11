import { GRID_COLS, SUB_CELLS_PER_MACRO } from '@/config/constants';
import { macroCol, macroRow } from './subGrid';
import { towerExtents } from '../model/tower';
import { cellKey } from './grid';
import type { ExteriorFace, ExteriorNode, MovementProfile, Tower } from '../model/types';

function isRoom(tower: Tower, col: number, row: number): boolean {
  return Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row));
}

/** Room occupancy at sub-cell resolution (each macro room tile fills its 3×3 sub-cells). */
function isRoomSub(tower: Tower, subCol: number, subRow: number): boolean {
  if (subCol < 0 || subRow < 0) return false;
  return isRoom(tower, macroCol(subCol), macroRow(subRow));
}

/** Macro-cell air bounds for spell placement (Kindling, etc.). */
export function inMacroAirBounds(tower: Tower, col: number, row: number): boolean {
  if (col < 0 || col >= GRID_COLS || row < 0) return false;
  return row <= towerExtents(tower).wizardRow;
}

/** Sub-cell air bounds for enemy movement — up to the wizard perch row. */
export function inAirBounds(tower: Tower, subCol: number, subRow: number): boolean {
  if (subCol < 0 || subCol >= GRID_COLS * SUB_CELLS_PER_MACRO || subRow < 0) return false;
  const maxSubRow = towerExtents(tower).wizardRow * SUB_CELLS_PER_MACRO + (SUB_CELLS_PER_MACRO - 1);
  return subRow <= maxSubRow;
}

export type SurfaceContact =
  | 'ground'
  | 'leftWall'
  | 'rightWall'
  | 'underCeiling'
  | 'onTop';

/** Surface contacts at macro resolution (spell placement). */
export function surfaceContactsMacro(tower: Tower, col: number, row: number): Set<SurfaceContact> {
  const contacts = new Set<SurfaceContact>();
  if (row === 0) contacts.add('ground');
  if (isRoom(tower, col - 1, row)) contacts.add('leftWall');
  if (isRoom(tower, col + 1, row)) contacts.add('rightWall');
  if (isRoom(tower, col, row + 1)) contacts.add('underCeiling');
  if (isRoom(tower, col, row - 1)) contacts.add('onTop');
  return contacts;
}

/** Surface contacts from immediate sub-cell neighbors (first-class fine grid). */
export function surfaceContacts(tower: Tower, subCol: number, subRow: number): Set<SurfaceContact> {
  const contacts = new Set<SurfaceContact>();
  if (subRow === 0) contacts.add('ground');
  if (isRoomSub(tower, subCol - 1, subRow)) contacts.add('leftWall');
  if (isRoomSub(tower, subCol + 1, subRow)) contacts.add('rightWall');
  if (isRoomSub(tower, subCol, subRow + 1)) contacts.add('underCeiling');
  if (isRoomSub(tower, subCol, subRow - 1)) contacts.add('onTop');
  return contacts;
}

export function isWalkable(tower: Tower, subCol: number, subRow: number, profile: MovementProfile): boolean {
  if (!inAirBounds(tower, subCol, subRow)) return false;
  if (isRoomSub(tower, subCol, subRow)) return false;

  const contacts = surfaceContacts(tower, subCol, subRow);
  if (contacts.size === 0) return false;

  if (!profile.canPassUnderOverhang && contacts.has('underCeiling')) {
    return false;
  }

  // Crawlers cannot bridge a horizontal slot between two walls with no floor beneath.
  const supported = contacts.has('ground') || contacts.has('onTop');
  if (contacts.has('leftWall') && contacts.has('rightWall') && !supported) {
    return false;
  }

  return true;
}

const ORTHOGONAL = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

const DIAGONAL = [
  { dc: 1, dr: 1 },
  { dc: 1, dr: -1 },
  { dc: -1, dr: 1 },
  { dc: -1, dr: -1 },
];

function isCornerWrap(tower: Tower, subCol: number, subRow: number, dc: number, dr: number): boolean {
  const sideRoom = isRoomSub(tower, subCol + dc, subRow);
  const aboveBelowRoom = isRoomSub(tower, subCol, subRow + dr);
  return sideRoom !== aboveBelowRoom;
}

export function neighbors(tower: Tower, subCol: number, subRow: number, profile: MovementProfile): ExteriorNode[] {
  const result: ExteriorNode[] = [];
  for (const { dc, dr } of ORTHOGONAL) {
    const nc = subCol + dc;
    const nr = subRow + dr;
    if (!isWalkable(tower, nc, nr, profile)) continue;
    result.push({ col: nc, row: nr, face: faceOf(tower, nc, nr) });
  }
  for (const { dc, dr } of DIAGONAL) {
    const nc = subCol + dc;
    const nr = subRow + dr;
    if (!isWalkable(tower, nc, nr, profile)) continue;
    if (!isCornerWrap(tower, subCol, subRow, dc, dr)) continue;
    result.push({ col: nc, row: nr, face: faceOf(tower, nc, nr) });
  }
  return result;
}

export function faceOf(tower: Tower, subCol: number, subRow: number): ExteriorFace {
  if (isRoomSub(tower, subCol - 1, subRow)) return 'left';
  if (isRoomSub(tower, subCol + 1, subRow)) return 'right';
  return 'top';
}

const SUB_GRID_COLS = GRID_COLS * SUB_CELLS_PER_MACRO;

export function spawnNode(tower: Tower, side: 'left' | 'right'): ExteriorNode {
  const start = side === 'left' ? 0 : SUB_GRID_COLS - 1;
  const step = side === 'left' ? 1 : -1;
  for (let subCol = start; subCol >= 0 && subCol < SUB_GRID_COLS; subCol += step) {
    if (!isRoomSub(tower, subCol, 0)) {
      return { col: subCol, row: 0, face: faceOf(tower, subCol, 0) };
    }
  }
  return { col: start, row: 0, face: 'top' };
}
