import { describe, expect, it } from 'vitest';
import { CELL_SIZE, SUB_CELL_SIZE } from '@/config/constants';
import { cellCenter, cellTopLeft, enemyDrawRadius, exteriorNodeDrawCenter, screenToCell, visibleRowRange } from './camera';

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

describe('exteriorNodeDrawCenter', () => {
  const viewportHeight = TEST_VIEWPORT_HEIGHT;
  const radius = enemyDrawRadius('swarm');

  it('snaps climbers on the left exterior flush to the room edge per sub-cell', () => {
    const subCol = 5 * 3 + 1;
    const pos = { col: subCol, row: 4, face: 'right' as const };
    const { x } = exteriorNodeDrawCenter(pos, 0, viewportHeight, radius);
    const roomEdgeX = 6 * CELL_SIZE;
    expect(x + radius).toBeLessThanOrEqual(roomEdgeX);
    expect(x).toBe((subCol + 1) * SUB_CELL_SIZE - radius - 2);
  });

  it('snaps climbers on the right exterior flush to the room edge per sub-cell', () => {
    const subCol = 7 * 3;
    const pos = { col: subCol, row: 4, face: 'left' as const };
    const { x } = exteriorNodeDrawCenter(pos, 0, viewportHeight, radius);
    expect(x - radius).toBeGreaterThanOrEqual(7 * CELL_SIZE);
  });

  it('offsets horizontal position per sub-column on the same wall', () => {
    const lowCol = 5 * 3;
    const highCol = 5 * 3 + 2;
    const low = exteriorNodeDrawCenter({ col: lowCol, row: 4, face: 'right' }, 0, viewportHeight, radius);
    const high = exteriorNodeDrawCenter({ col: highCol, row: 4, face: 'right' }, 0, viewportHeight, radius);
    expect(high.x - low.x).toBe(2 * SUB_CELL_SIZE);
  });

  it('keeps vertical motion on sub-rows while wall-hugging horizontally', () => {
    const low = exteriorNodeDrawCenter({ col: 14, row: 2, face: 'right' }, 0, viewportHeight, radius);
    const high = exteriorNodeDrawCenter({ col: 14, row: 8, face: 'right' }, 0, viewportHeight, radius);
    expect(high.y).toBeLessThan(low.y);
    expect(high.x).toBe(low.x);
  });

  it('places top-face units on the surface below their sub-cell, not above it', () => {
    const subRow = 6;
    const { y } = exteriorNodeDrawCenter({ col: 16, row: subRow, face: 'top' }, 0, viewportHeight, radius);
    const subBottom = viewportHeight - subRow * SUB_CELL_SIZE;
    expect(y + radius + 2).toBeCloseTo(subBottom, 5);
  });

  it('rests ground-row units on the top edge of the ground sub-band', () => {
    const { y } = exteriorNodeDrawCenter({ col: 0, row: 0, face: 'top' }, 0, viewportHeight, radius);
    const groundSurface = viewportHeight - SUB_CELL_SIZE - 2;
    expect(y + radius).toBeCloseTo(groundSurface, 5);
    expect(y - radius).toBeGreaterThanOrEqual(0);
  });
});

describe('enemyDrawRadius', () => {
  it('fits swarm glyphs within one sub-cell', () => {
    expect(enemyDrawRadius('swarm') * 2).toBeLessThanOrEqual(SUB_CELL_SIZE - 2);
  });

  it('scales elites and bosses up slightly but stays sub-cell sized', () => {
    expect(enemyDrawRadius('elite')).toBeGreaterThan(enemyDrawRadius('swarm'));
    expect(enemyDrawRadius('boss')).toBeGreaterThan(enemyDrawRadius('elite'));
    expect(enemyDrawRadius('boss') * 2).toBeLessThanOrEqual(SUB_CELL_SIZE);
  });
});
