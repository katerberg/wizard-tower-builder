import { CELL_SIZE, GRID_COLS, SUB_CELL_SIZE } from '@/config/constants';
import type { Cell, EnemySizeTier, ExteriorFace } from '@/model/types';

export { clampScrollY, MIN_VIEWPORT_HEIGHT, snapViewportHeight } from '@/calculations/camera';

export const BOARD_WIDTH = GRID_COLS * CELL_SIZE;

/** Top-left pixel of a macro cell in viewport space (row 0 sits on the ground). */
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

/** Top-left pixel of a sub-cell (movement grid). */
export function subCellTopLeft(
  subCol: number,
  subRow: number,
  scrollY: number,
  viewportHeight: number,
): { x: number; y: number } {
  return {
    x: subCol * SUB_CELL_SIZE,
    y: viewportHeight - (subRow + 1) * SUB_CELL_SIZE + scrollY,
  };
}

export function subCellCenter(
  subCol: number,
  subRow: number,
  scrollY: number,
  viewportHeight: number,
): { x: number; y: number } {
  const { x, y } = subCellTopLeft(subCol, subRow, scrollY, viewportHeight);
  return { x: x + SUB_CELL_SIZE / 2, y: y + SUB_CELL_SIZE / 2 };
}

/** Pixel inset matching room fill stroke so climbers sit on the wall surface. */
const SURFACE_INSET = 2;

/** Height of the ground bar drawn along the floor of macro row 0. */
export const GROUND_LINE_INSET = 4;

/** Draw radius for one sub-cell (1×1 fine grid) enemy glyph. */
export function enemyDrawRadius(tier: EnemySizeTier = 'small'): number {
  switch (tier) {
    case 'large':
      return SUB_CELL_SIZE * 0.46;
    case 'medium':
      return SUB_CELL_SIZE * 0.4;
    default:
      return SUB_CELL_SIZE * 0.36;
  }
}

/**
 * Draw position for an exterior node — one sub-cell per enemy, flush to the shared edge.
 * Vertical placement uses the bottom of the sub-cell (feet on the surface below).
 */
export function exteriorNodeDrawCenter(
  pos: { col: number; row: number; face: ExteriorFace },
  scrollY: number,
  viewportHeight: number,
  radius = 0,
): { x: number; y: number } {
  const { x: subX, y: subY } = subCellTopLeft(pos.col, pos.row, scrollY, viewportHeight);
  // Row 0 is the bottom sub-band; feet sit on its top edge (not the canvas bottom).
  const surfaceY =
    pos.row === 0
      ? subY - radius - SURFACE_INSET
      : subY + SUB_CELL_SIZE - radius - SURFACE_INSET;

  if (pos.face === 'air') {
    // Center in the sub-cell so fliers read as airborne, not shell-climbing.
    return { x: subX + SUB_CELL_SIZE / 2, y: subY + SUB_CELL_SIZE / 2 };
  }
  if (pos.face === 'right') {
    return { x: (pos.col + 1) * SUB_CELL_SIZE - radius - SURFACE_INSET, y: surfaceY };
  }
  if (pos.face === 'left') {
    return { x: pos.col * SUB_CELL_SIZE + radius + SURFACE_INSET, y: surfaceY };
  }
  return { x: subX + SUB_CELL_SIZE / 2, y: surfaceY };
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
