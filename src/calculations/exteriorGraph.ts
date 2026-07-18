import {
  FLY_BOUNDS_EXTRA_SUB_ROWS,
  FLY_STANDOFF_MAX,
  FLY_STANDOFF_MIN,
  GRID_COLS,
  SUB_CELLS_PER_MACRO,
} from '@/config/constants';
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
  return row <= towerExtents(tower).wizardRow + Math.floor(FLY_BOUNDS_EXTRA_SUB_ROWS / SUB_CELLS_PER_MACRO);
}

/** Sub-cell air bounds for enemy movement — up to the wizard perch row (+ flier headroom). */
export function inAirBounds(tower: Tower, subCol: number, subRow: number, canFly = false): boolean {
  if (subCol < 0 || subCol >= GRID_COLS * SUB_CELLS_PER_MACRO || subRow < 0) return false;
  const maxSubRow = towerExtents(tower).wizardRow * SUB_CELLS_PER_MACRO + (SUB_CELLS_PER_MACRO - 1);
  const extra = canFly ? FLY_BOUNDS_EXTRA_SUB_ROWS : 0;
  return subRow <= maxSubRow + extra;
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

/** True when a sub-cell orthogonally touches any room face (not ground-only). */
export function touchesRoomWall(tower: Tower, subCol: number, subRow: number): boolean {
  const contacts = surfaceContacts(tower, subCol, subRow);
  return (
    contacts.has('leftWall')
    || contacts.has('rightWall')
    || contacts.has('underCeiling')
    || contacts.has('onTop')
  );
}

function isFlyWalkable(tower: Tower, subCol: number, subRow: number): boolean {
  if (!inAirBounds(tower, subCol, subRow, true)) return false;
  if (isRoomSub(tower, subCol, subRow)) return false;
  // Never skim the shell — open air only (ground contact alone is fine).
  if (touchesRoomWall(tower, subCol, subRow)) return false;
  return true;
}

export function isWalkable(tower: Tower, subCol: number, subRow: number, profile: MovementProfile): boolean {
  if (profile.canFly) {
    return isFlyWalkable(tower, subCol, subRow);
  }

  if (!inAirBounds(tower, subCol, subRow, false)) return false;
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
  // Fliers use orthogonal air steps only — no shell corner-wrap diagonals.
  if (!profile.canFly) {
    for (const { dc, dr } of DIAGONAL) {
      const nc = subCol + dc;
      const nr = subRow + dr;
      if (!isWalkable(tower, nc, nr, profile)) continue;
      if (!isCornerWrap(tower, subCol, subRow, dc, dr)) continue;
      result.push({ col: nc, row: nr, face: faceOf(tower, nc, nr) });
    }
  }
  return result;
}

export function faceOf(tower: Tower, subCol: number, subRow: number): ExteriorFace {
  if (isRoomSub(tower, subCol - 1, subRow)) return 'left';
  if (isRoomSub(tower, subCol + 1, subRow)) return 'right';
  if (touchesRoomWall(tower, subCol, subRow)) return 'top';
  const contacts = surfaceContacts(tower, subCol, subRow);
  if (contacts.size === 0 || (contacts.size === 1 && contacts.has('ground'))) {
    return 'air';
  }
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

export interface FlySpawnBand {
  minRow: number;
  maxRow: number;
}

/**
 * Side-of-screen air spawn at a fixed macro-row band.
 * Prefers a cell 1–3 macros off the tower with a clear angled line toward the wizard.
 */
export function spawnAirNode(
  tower: Tower,
  side: 'left' | 'right',
  band: FlySpawnBand,
  wizardSub: ExteriorNode,
): ExteriorNode {
  const profile: MovementProfile = {
    kind: 'fly',
    canPassUnderOverhang: false,
    canAttackOverhang: false,
    canFly: true,
    canTransferFaces: false,
  };

  const minSubRow = Math.max(0, band.minRow * SUB_CELLS_PER_MACRO);
  const maxSubRow = Math.max(minSubRow, (band.maxRow + 1) * SUB_CELLS_PER_MACRO - 1);
  const targetSubRow = Math.min(
    maxSubRow,
    Math.max(minSubRow, Math.round((minSubRow + maxSubRow) / 2)),
  );

  // Outermost columns first, then walk inward looking for standoff air.
  const start = side === 'left' ? 0 : SUB_GRID_COLS - 1;
  const step = side === 'left' ? 1 : -1;
  let fallback: ExteriorNode | null = null;

  for (let subCol = start; subCol >= 0 && subCol < SUB_GRID_COLS; subCol += step) {
    for (let dr = 0; dr <= maxSubRow - minSubRow; dr++) {
      const subRow = targetSubRow + ((dr % 2 === 0 ? 1 : -1) * Math.ceil(dr / 2));
      if (subRow < minSubRow || subRow > maxSubRow) continue;
      if (!isWalkable(tower, subCol, subRow, profile)) continue;

      const node: ExteriorNode = { col: subCol, row: subRow, face: faceOf(tower, subCol, subRow) };
      fallback ??= node;

      const standoff = standoffMacroFromTower(tower, subCol, subRow);
      if (standoff >= FLY_STANDOFF_MIN && standoff <= FLY_STANDOFF_MAX) {
        return node;
      }
    }
  }

  if (fallback) return fallback;

  // Last resort: screen edge at band mid, even if slightly illegal — clamp search upward.
  const edgeCol = start;
  const edgeRow = Math.min(maxSubRow, Math.max(0, wizardSub.row));
  return { col: edgeCol, row: edgeRow, face: 'air' };
}

/** Approximate macro-cell gap from this sub-cell to the nearest room cell. */
export function standoffMacroFromTower(tower: Tower, subCol: number, subRow: number): number {
  const mc = macroCol(subCol);
  const mr = macroRow(subRow);
  let best = Infinity;
  for (const key of Object.keys(tower.occupancy)) {
    const [cs, rs] = key.split(',');
    const oc = Number(cs);
    const or = Number(rs);
    const d = Math.abs(mc - oc) + Math.abs(mr - or);
    if (d < best) best = d;
  }
  return best === Infinity ? FLY_STANDOFF_MAX : best;
}

/** Placeholder wave → absolute macro-row spawn band (rises with level). */
export function flySpawnBandForLevel(levelIndex: number): FlySpawnBand {
  if (levelIndex <= 1) return { minRow: 6, maxRow: 12 };
  if (levelIndex <= 3) return { minRow: 10, maxRow: 18 };
  if (levelIndex <= 5) return { minRow: 18, maxRow: 30 };
  if (levelIndex <= 7) return { minRow: 40, maxRow: 55 };
  return { minRow: 70, maxRow: 90 };
}
