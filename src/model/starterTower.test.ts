import { describe, expect, it } from 'vitest';
import { netBuildCost, remainingBuildGold } from '@/calculations/buildCost';
import { STARTING_CURRENCY } from '@/config/constants';
import { createInitialState } from './game';
import { createStarterTower, STARTER_TOWER_PLACEMENTS } from './starterTower';
import { getWizardPosition, isOccupied, isTowerConnected, isTowerStable } from './tower';

describe('createStarterTower', () => {
  it('builds a stable connected tower', () => {
    const tower = createStarterTower();
    expect(tower.rooms).toHaveLength(STARTER_TOWER_PLACEMENTS.length);
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
    expect(wizard.row).toBe(6);
  });
});

describe('createInitialState starter economy', () => {
  it('includes the starter tower with zero net build cost', () => {
    const state = createInitialState('starter-econ');
    expect(state.tower.rooms.length).toBeGreaterThan(0);
    expect(state.buildBaseline).not.toBeNull();
    expect(netBuildCost(state.buildBaseline!, state.tower)).toBe(0);
    expect(remainingBuildGold(state.buildBaseline!, state.tower)).toBe(STARTING_CURRENCY);
    expect(state.player.currency).toBe(STARTING_CURRENCY);
  });
});
