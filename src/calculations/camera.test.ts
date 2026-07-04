import { describe, expect, it } from 'vitest';
import { CELL_SIZE, VIEWPORT_AIR_ROWS } from '@/config/constants';
import { getBlueprint } from '@/model/blueprints';
import { createRoom, createTower, placeRoom, towerExtents } from '@/model/tower';
import { clampScrollY, snapViewportHeight } from './camera';

function cellTopY(row: number, scrollY: number, viewportHeight: number): number {
  return viewportHeight - (row + 1) * CELL_SIZE + scrollY;
}

const TEST_VIEWPORT_HEIGHT = 12 * CELL_SIZE;

describe('snapViewportHeight', () => {
  it('snaps down to whole cell rows with a minimum', () => {
    expect(snapViewportHeight(600)).toBe(576);
    expect(snapViewportHeight(100)).toBe(144);
    expect(snapViewportHeight(10)).toBe(144);
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
    const blockTopY = cellTopY(maxOccupiedRow, maxScroll, TEST_VIEWPORT_HEIGHT);
    const airTopY = cellTopY(topAirRow, maxScroll, TEST_VIEWPORT_HEIGHT);

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
