import { GRID_COLS, GRID_ROWS } from '@/config/constants';
import { cellKey } from './grid';
import type { ExteriorFace, ExteriorNode, MovementProfile, Tower } from '../model/types';

// A node is walkable if it is an in-bounds empty cell. Enemies navigate the open
// air hugging the tower; rooms are obstacles. This is what lets `under_overhang`
// enemies always find a route around protrusions (unlike a pure surface climb).
export function isWalkable(tower: Tower, col: number, row: number): boolean {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS + 1) {
    return false;
  }
  return !Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row));
}

const DIRS = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
  { dc: 1, dr: 1 },
  { dc: 1, dr: -1 },
  { dc: -1, dr: 1 },
  { dc: -1, dr: -1 },
];

export function neighbors(tower: Tower, col: number, row: number, _profile: MovementProfile): ExteriorNode[] {
  const result: ExteriorNode[] = [];
  for (const { dc, dr } of DIRS) {
    const nc = col + dc;
    const nr = row + dr;
    if (!isWalkable(tower, nc, nr)) continue;
    // Disallow squeezing diagonally between two occupied cells (corner cut).
    if (dc !== 0 && dr !== 0) {
      if (!isWalkable(tower, col + dc, row) && !isWalkable(tower, col, row + dr)) {
        continue;
      }
    }
    result.push({ col: nc, row: nr, face: faceOf(tower, nc, nr) });
  }
  return result;
}

export function faceOf(tower: Tower, col: number, row: number): ExteriorFace {
  const occ = (c: number, r: number) => Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(c, r));
  if (occ(col + 1, row)) return 'left';
  if (occ(col - 1, row)) return 'right';
  return 'top';
}

// Ground-level spawn just outside the tower footprint on the given side.
export function spawnNode(tower: Tower, side: 'left' | 'right'): ExteriorNode {
  if (side === 'left') {
    for (let col = 0; col < GRID_COLS; col++) {
      if (isWalkable(tower, col, 0)) return { col, row: 0, face: faceOf(tower, col, 0) };
    }
  } else {
    for (let col = GRID_COLS - 1; col >= 0; col--) {
      if (isWalkable(tower, col, 0)) return { col, row: 0, face: faceOf(tower, col, 0) };
    }
  }
  return { col: side === 'left' ? 0 : GRID_COLS - 1, row: 0, face: 'top' };
}
