import { describe, expect, it } from 'vitest';
import { CELL_SIZE } from '@/config/constants';
import { cellCenter, cellTopLeft, screenToCell, visibleRowRange } from './camera';

const TEST_VIEWPORT_HEIGHT = 12 * CELL_SIZE;

describe('cellTopLeft / screenToCell', () => {
  it('maps row 0 to the bottom of the viewport when scroll is 0', () => {
    const { y } = cellTopLeft(0, 0, 0, TEST_VIEWPORT_HEIGHT);
    expect(y).toBe(TEST_VIEWPORT_HEIGHT - CELL_SIZE);
  });

  it('round-trips cell center through screenToCell at various scroll offsets', () => {
    for (const scrollY of [0, 120, 480, 2400]) {
      for (const row of [0, 3, 10, 50]) {
        const { x, y } = cellCenter(5, row, scrollY, TEST_VIEWPORT_HEIGHT);
        const cell = screenToCell(x, y, scrollY, TEST_VIEWPORT_HEIGHT);
        expect(cell).toEqual({ col: 5, row });
      }
    }
  });

  it('scrolls content upward when scrollY increases', () => {
    const atRest = cellTopLeft(3, 5, 0, TEST_VIEWPORT_HEIGHT).y;
    const scrolled = cellTopLeft(3, 5, 200, TEST_VIEWPORT_HEIGHT).y;
    expect(scrolled).toBeGreaterThan(atRest);
  });
});

describe('visibleRowRange', () => {
  it('includes row 0 at scroll 0', () => {
    const { minRow, maxRow } = visibleRowRange(0, TEST_VIEWPORT_HEIGHT);
    expect(minRow).toBe(0);
    expect(maxRow).toBeGreaterThanOrEqual(12);
  });

  it('shifts upward when scrolled', () => {
    const { minRow } = visibleRowRange(480, TEST_VIEWPORT_HEIGHT);
    expect(minRow).toBeGreaterThanOrEqual(9);
  });

  it('covers more rows in a taller viewport', () => {
    const short = visibleRowRange(0, TEST_VIEWPORT_HEIGHT);
    const tall = visibleRowRange(0, TEST_VIEWPORT_HEIGHT * 2);
    expect(tall.maxRow - tall.minRow).toBeGreaterThan(short.maxRow - short.minRow);
  });
});
