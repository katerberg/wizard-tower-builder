import { cellKey } from '@/calculations/grid';
import { macroCellOfNode } from '@/calculations/subGrid';
import type { Cell, Enemy, GameState, Tower } from '../types';

function isOccupied(tower: Tower, col: number, row: number): boolean {
  return Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row));
}

/** Exterior blast cells for open left/right faces (depth × 3-wide). */
export function exteriorSideBlastCells(tower: Tower, origin: Cell, depth: number): Cell[] {
  const cells: Cell[] = [];
  const { col: c, row: r } = origin;
  const offsets = [-1, 0, 1] as const;
  if (!isOccupied(tower, c - 1, r)) {
    for (let d = 1; d <= depth; d++) {
      for (const o of offsets) cells.push({ col: c - d, row: r + o });
    }
  }
  if (!isOccupied(tower, c + 1, r)) {
    for (let d = 1; d <= depth; d++) {
      for (const o of offsets) cells.push({ col: c + d, row: r + o });
    }
  }
  return cells;
}

export function enemiesInBlastCells(state: GameState, blast: Cell[]): Enemy[] {
  const keys = new Set(blast.map((c) => cellKey(c.col, c.row)));
  return state.enemies.filter(
    (e) => e.currentHp > 0 && keys.has(cellKey(macroCellOfNode(e.pos).col, macroCellOfNode(e.pos).row)),
  );
}
