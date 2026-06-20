import { CELL_SIZE, GRID_COLS, GRID_ROWS } from '@/config/constants';
import type { Cell } from '@/model/types';

// One extra row above the grid so the wizard (topRow + 1) is always visible.
export const VIEW_ROWS = GRID_ROWS + 1;

export const BOARD_WIDTH = GRID_COLS * CELL_SIZE;
export const BOARD_HEIGHT = VIEW_ROWS * CELL_SIZE;

// row 0 is the ground (bottom of the screen); rows increase upward.
export function cellTopLeft(col: number, row: number): { x: number; y: number } {
  return { x: col * CELL_SIZE, y: (GRID_ROWS - row) * CELL_SIZE };
}

export function cellCenter(col: number, row: number): { x: number; y: number } {
  const { x, y } = cellTopLeft(col, row);
  return { x: x + CELL_SIZE / 2, y: y + CELL_SIZE / 2 };
}

export function screenToCell(px: number, py: number): Cell {
  const col = Math.floor(px / CELL_SIZE);
  const rowFromTop = Math.floor(py / CELL_SIZE);
  return { col, row: GRID_ROWS - rowFromTop };
}
