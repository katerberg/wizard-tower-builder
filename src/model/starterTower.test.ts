import { SUB_CELLS_PER_MACRO, STARTING_RESOURCES } from '@/config/constants';
import { STARTER_SUPPLY_METAL, STARTER_SUPPLY_STONE } from '@/config/storage';
import { describe, expect, it } from 'vitest';
import { createInitialState } from './game';
import { createStarterTower, STARTER_TOWER_PLACEMENTS } from './starterTower';
import { getWizardPosition, isOccupied, isTowerConnected, isTowerStable } from './tower';

describe('createStarterTower', () => {
  it('builds a stable connected tower with starter facilities', () => {
    const tower = createStarterTower();
    expect(tower.structures.length).toBeGreaterThan(STARTER_TOWER_PLACEMENTS.length);
    expect(tower.rooms.length).toBe(2);
    expect(isTowerStable(tower)).toBe(true);
    expect(isTowerConnected(tower)).toBe(true);
  });

  it('leaves the interior hollow above the base', () => {
    const tower = createStarterTower();
    expect(isOccupied(tower, 7, 0)).toBe(true);
    for (const row of [1, 2, 3, 4]) {
      expect(isOccupied(tower, 7, row)).toBe(false);
    }
    expect(isOccupied(tower, 6, 1)).toBe(true);
    expect(isOccupied(tower, 8, 1)).toBe(true);
  });

  it('overhangs the crown on both sides of the shaft', () => {
    const tower = createStarterTower();
    expect(isOccupied(tower, 5, 5)).toBe(true);
    expect(isOccupied(tower, 9, 5)).toBe(true);
    expect(isOccupied(tower, 7, 5)).toBe(false);
  });

  it('places the wizard perch above the crown', () => {
    const tower = createStarterTower();
    const wizard = getWizardPosition(tower);
    expect(wizard).toEqual({ col: 6 * SUB_CELLS_PER_MACRO + 1, row: 6 * SUB_CELLS_PER_MACRO, face: 'top' });
  });
});

describe('createInitialState starter economy', () => {
  it('includes starter tower, supply stockpile, and wallet resources', () => {
    const state = createInitialState('starter-econ');
    expect(state.tower.structures.length).toBeGreaterThan(0);
    expect(state.tower.rooms.length).toBe(2);
    expect(state.phase).toBe('day');
    expect(state.player.resources.gold).toBe(STARTING_RESOURCES.gold);
    expect(state.player.resources.stone).toBe(0);
    const supply = state.storageSites['starter-supply'];
    expect(supply?.stockpile.stone).toBe(STARTER_SUPPLY_STONE);
    expect(supply?.stockpile.metal).toBe(STARTER_SUPPLY_METAL);
  });
});
