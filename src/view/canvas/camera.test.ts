import { describe, expect, it } from 'vitest';
import { CELL_SIZE, VIEWPORT_AIR_ROWS } from '@/config/constants';
import { getBlueprint } from '@/model/blueprints';
import { createRoom, createTower, placeRoom, towerExtents } from '@/model/tower';
import {
  cellCenter,
  cellTopLeft,
  clampScrollY,
  screenToCell,
  snapViewportHeight,
  visibleRowRange,
} from './camera';

const TEST_VIEWPORT_HEIGHT = 12 * CELL_SIZE;

describe('snapViewportHeight', () => {
  it('snaps down to whole cell rows with a minimum', () => {
    expect(snapViewportHeight(600)).toBe(576);
    expect(snapViewportHeight(100)).toBe(144);
    expect(snapViewportHeight(10)).toBe(144);
  });
});

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

describe('clampScrollY', () => {
  it('never scrolls below ground', () => {
    expect(clampScrollY(-100, createTower(), TEST_VIEWPORT_HEIGHT)).toBe(0);
  });

  it('allows scrolling up when the tower exceeds the viewport', () => {
    let tower = createTower();
    const stem = getBlueprint('stem')!;
    for (let row = 0; row < 20; row++) {
      tower = placeRoom(tower, createRoom(`r${row}`, stem, { col: 8, row }));
    }
    const max = clampScrollY(99999, tower, TEST_VIEWPORT_HEIGHT);
    expect(max).toBeGreaterThan(0);
    expect(clampScrollY(max + 100, tower, TEST_VIEWPORT_HEIGHT)).toBe(max);
    expect(towerExtents(tower).wizardRow).toBe(20);
  });

  it('allows eight rows of air above the top block at max scroll', () => {
    let tower = createTower();
    const stem = getBlueprint('stem')!;
    for (let row = 0; row < 5; row++) {
      tower = placeRoom(tower, createRoom(`r${row}`, stem, { col: 8, row }));
    }
    const maxScroll = clampScrollY(99999, tower, TEST_VIEWPORT_HEIGHT);
    const { maxOccupiedRow } = towerExtents(tower);
    expect(maxOccupiedRow).toBe(4);

    const topAirRow = maxOccupiedRow + VIEWPORT_AIR_ROWS;
    const { y: blockTopY } = cellTopLeft(8, maxOccupiedRow, maxScroll, TEST_VIEWPORT_HEIGHT);
    const { y: airTopY } = cellTopLeft(8, topAirRow, maxScroll, TEST_VIEWPORT_HEIGHT);

    expect(airTopY).toBeGreaterThanOrEqual(0);
    expect(airTopY).toBeLessThan(CELL_SIZE);
    expect(blockTopY).toBe(VIEWPORT_AIR_ROWS * CELL_SIZE);
  });

  it('reduces max scroll when the viewport grows', () => {
    let tower = createTower();
    const stem = getBlueprint('stem')!;
    for (let row = 0; row < 20; row++) {
      tower = placeRoom(tower, createRoom(`r${row}`, stem, { col: 8, row }));
    }
    const shortMax = clampScrollY(99999, tower, TEST_VIEWPORT_HEIGHT);
    const tallMax = clampScrollY(99999, tower, TEST_VIEWPORT_HEIGHT * 2);
    expect(tallMax).toBeLessThan(shortMax);
  });
});
