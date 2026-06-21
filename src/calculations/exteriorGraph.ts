import { GRID_COLS, GRID_ROWS } from '@/config/constants';
import { cellKey } from './grid';
import type { ExteriorFace, ExteriorNode, MovementProfile, Tower } from '../model/types';

function isRoom(tower: Tower, col: number, row: number): boolean {
  return Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row));
}

// Enemies move through empty cells, but only those that hug a surface. One extra
// row above the grid lets them stand on top of (and reach the wizard above) the
// highest room.
export function inAirBounds(col: number, row: number): boolean {
  return col >= 0 && col < GRID_COLS && row >= 0 && row <= GRID_ROWS;
}

export type SurfaceContact =
  | 'ground' // resting on the earth (row 0)
  | 'leftWall' // a room sits to the left of this cell
  | 'rightWall' // a room sits to the right
  | 'underCeiling' // a room sits directly above (overhang tunnel)
  | 'onTop'; // a room sits directly below (standing on a roof/ledge)

/**
 * The flat tower surfaces an empty cell touches. Only orthogonal (flat) contact
 * counts: an enemy must be grabbing a wall, floor, or ceiling. A cell that only
 * touches a room diagonally is clinging to a bare corner and is NOT a valid
 * surface — enemies move from flat to flat, they never perch on a corner.
 */
export function surfaceContacts(tower: Tower, col: number, row: number): Set<SurfaceContact> {
  const contacts = new Set<SurfaceContact>();
  if (row === 0) contacts.add('ground');
  if (isRoom(tower, col - 1, row)) contacts.add('leftWall');
  if (isRoom(tower, col + 1, row)) contacts.add('rightWall');
  if (isRoom(tower, col, row + 1)) contacts.add('underCeiling');
  if (isRoom(tower, col, row - 1)) contacts.add('onTop');
  return contacts;
}

/**
 * A cell is walkable when it is an in-bounds empty cell touching a surface. The
 * movement profile gates which surfaces are usable: `under_overhang` movers may
 * pass beneath protruding rooms; others (e.g. a future `surface_climb`) cannot.
 */
export function isWalkable(tower: Tower, col: number, row: number, profile: MovementProfile): boolean {
  if (!inAirBounds(col, row)) return false;
  if (isRoom(tower, col, row)) return false;

  const contacts = surfaceContacts(tower, col, row);
  if (contacts.size === 0) return false;

  if (!profile.canPassUnderOverhang && contacts.has('underCeiling')) {
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

/**
 * A diagonal step is only allowed to wrap the outer corner of a single solid
 * block: exactly one of the two cells flanking the diagonal must be a room (the
 * corner being hugged) and the other must be open. This lets a crawler travel
 * flat-to-flat around a convex corner (e.g. wall onto roof) without ever
 * standing on the corner, while forbidding both free-air leaps (no room between)
 * and squeezing through a diagonal gap (a room on both sides).
 */
function isCornerWrap(tower: Tower, col: number, row: number, dc: number, dr: number): boolean {
  const sideRoom = isRoom(tower, col + dc, row);
  const aboveBelowRoom = isRoom(tower, col, row + dr);
  return sideRoom !== aboveBelowRoom;
}

/**
 * Walkable cells reachable in one move. Straight orthogonal steps climb flat
 * surfaces; diagonal steps are permitted only as constrained corner-wraps (see
 * {@link isCornerWrap}). Enemies never fly through open air.
 */
export function neighbors(tower: Tower, col: number, row: number, profile: MovementProfile): ExteriorNode[] {
  const result: ExteriorNode[] = [];
  for (const { dc, dr } of ORTHOGONAL) {
    const nc = col + dc;
    const nr = row + dr;
    if (!isWalkable(tower, nc, nr, profile)) continue;
    result.push({ col: nc, row: nr, face: faceOf(tower, nc, nr) });
  }
  for (const { dc, dr } of DIAGONAL) {
    const nc = col + dc;
    const nr = row + dr;
    if (!isWalkable(tower, nc, nr, profile)) continue;
    if (!isCornerWrap(tower, col, row, dc, dr)) continue;
    result.push({ col: nc, row: nr, face: faceOf(tower, nc, nr) });
  }
  return result;
}

/** Which side the enemy clings to, used only for rendering offset. */
export function faceOf(tower: Tower, col: number, row: number): ExteriorFace {
  if (isRoom(tower, col - 1, row)) return 'left';
  if (isRoom(tower, col + 1, row)) return 'right';
  return 'top';
}

// Ground-level spawn at the outer edge on the given side. Enemies walk the floor
// in toward the tower base before climbing.
export function spawnNode(tower: Tower, side: 'left' | 'right'): ExteriorNode {
  const start = side === 'left' ? 0 : GRID_COLS - 1;
  const step = side === 'left' ? 1 : -1;
  for (let col = start; col >= 0 && col < GRID_COLS; col += step) {
    if (!isRoom(tower, col, 0)) {
      return { col, row: 0, face: faceOf(tower, col, 0) };
    }
  }
  return { col: start, row: 0, face: 'top' };
}
