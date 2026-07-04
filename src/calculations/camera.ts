import { CELL_SIZE, MIN_VIEWPORT_ROWS, VIEWPORT_AIR_ROWS } from '@/config/constants';
import { towerExtents } from '@/model/tower';
import type { Tower } from '@/model/types';

export const MIN_VIEWPORT_HEIGHT = MIN_VIEWPORT_ROWS * CELL_SIZE;

/** Snap available stage height down to whole cell rows. */
export function snapViewportHeight(availablePx: number): number {
  const rows = Math.max(MIN_VIEWPORT_ROWS, Math.floor(availablePx / CELL_SIZE));
  return rows * CELL_SIZE;
}

/** Keep scroll between ground (0) and enough headroom to see air above the tower top. */
export function clampScrollY(scrollY: number, tower: Tower, viewportHeight: number): number {
  const { maxOccupiedRow } = towerExtents(tower);
  const topRow = maxOccupiedRow + VIEWPORT_AIR_ROWS + 1;
  const maxScroll = Math.max(0, topRow * CELL_SIZE - viewportHeight);
  return Math.max(0, Math.min(scrollY, maxScroll));
}
