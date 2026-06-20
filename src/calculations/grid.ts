import { GRID_COLS, GRID_ROWS } from '@/config/constants';
import type { Cell } from '../model/types';

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function parseKey(key: string): Cell {
  const [col, row] = key.split(',').map((n) => parseInt(n, 10));
  return { col, row };
}

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}

// Cells occupied by a room whose bottom-left cell is `origin`. Rows increase upward.
export function roomCells(origin: Cell, size: { w: number; h: number }): Cell[] {
  const cells: Cell[] = [];
  for (let dx = 0; dx < size.w; dx++) {
    for (let dy = 0; dy < size.h; dy++) {
      cells.push({ col: origin.col + dx, row: origin.row + dy });
    }
  }
  return cells;
}
