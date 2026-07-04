import { CELL_SIZE, GRID_COLS } from '@/config/constants';
import type { Cell } from '@/model/types';

export { clampScrollY, MIN_VIEWPORT_HEIGHT, snapViewportHeight } from '@/calculations/camera';

export const BOARD_WIDTH = GRID_COLS * CELL_SIZE;

/** Top-left pixel of a cell in viewport space (row 0 sits on the ground). */
export function cellTopLeft(
  col: number,
  row: number,
  scrollY: number,
  viewportHeight: number,
): { x: number; y: number } {
  return {
    x: col * CELL_SIZE,
    y: viewportHeight - (row + 1) * CELL_SIZE + scrollY,
  };
}

export function cellCenter(
  col: number,
  row: number,
  scrollY: number,
  viewportHeight: number,
): { x: number; y: number } {
  const { x, y } = cellTopLeft(col, row, scrollY, viewportHeight);
  return { x: x + CELL_SIZE / 2, y: y + CELL_SIZE / 2 };
}

/** Map canvas pixel coords to grid cell using the current camera scroll. */
export function screenToCell(px: number, py: number, scrollY: number, viewportHeight: number): Cell {
  const col = Math.floor(px / CELL_SIZE);
  const row = Math.ceil((viewportHeight - py + scrollY) / CELL_SIZE) - 1;
  return { col, row };
}

/** Rows that intersect the viewport, with one row of padding above and below. */
export function visibleRowRange(
  scrollY: number,
  viewportHeight: number,
): { minRow: number; maxRow: number } {
  const minRow = Math.max(0, Math.floor(scrollY / CELL_SIZE) - 1);
  const maxRow = Math.ceil((viewportHeight + scrollY) / CELL_SIZE) + 1;
  return { minRow, maxRow };
}
