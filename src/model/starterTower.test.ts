import { SUB_CELLS_PER_MACRO, STARTING_RESOURCES } from '@/config/constants';
import { describe, expect, it } from 'vitest';
import { netBuildCost, remainingBuildResources } from '@/calculations/buildCost';
import { emptyResources, resourcesEqual } from '@/calculations/resources';
import { createInitialState } from './game';
import {
  createStarterTower,
  STARTER_ROOM_PLACEMENTS,
  STARTER_STRUCTURE_COUNT,
  STARTER_STRUCTURE_PLACEMENTS,
} from './starterTower';
import { getWizardPosition, isOccupied, isTowerConnected, isTowerStable, roomAt } from './tower';

describe('createStarterTower', () => {
  it('builds a stable connected tower', () => {
    const tower = createStarterTower();
    expect(tower.structures).toHaveLength(STARTER_STRUCTURE_COUNT);
    expect(tower.rooms).toHaveLength(STARTER_ROOM_PLACEMENTS.length);
    expect(isTowerStable(tower)).toBe(true);
    expect(isTowerConnected(tower)).toBe(true);
  });

  it('forms two spire columns on a shared base', () => {
    const tower = createStarterTower();
    expect(isOccupied(tower, 7, 0)).toBe(true);
    for (const row of [1, 2, 3, 4]) {
      expect(isOccupied(tower, 7, row)).toBe(false);
    }
    expect(isOccupied(tower, 6, 1)).toBe(true);
    expect(isOccupied(tower, 8, 1)).toBe(true);
    expect(isOccupied(tower, 6, 4)).toBe(true);
    expect(isOccupied(tower, 8, 4)).toBe(true);
  });

  it('places a turret on the middle of the left column', () => {
    const tower = createStarterTower();
    const turret = roomAt(tower, 6, 2);
    expect(turret?.blueprintId).toBe('turretRoom');
    expect(isOccupied(tower, 6, 2)).toBe(true);
  });

  it('places the wizard perch above the left crown', () => {
    const tower = createStarterTower();
    const wizard = getWizardPosition(tower);
    expect(wizard).toEqual({ col: 6 * SUB_CELLS_PER_MACRO + 1, row: 5 * SUB_CELLS_PER_MACRO, face: 'top' });
  });

  it('keeps STARTER_STRUCTURE_PLACEMENTS as the authored framing list', () => {
    expect(STARTER_STRUCTURE_PLACEMENTS).toHaveLength(10);
  });
});

describe('createInitialState starter economy', () => {
  it('includes the starter tower with zero net build cost', () => {
    const state = createInitialState('starter-econ');
    expect(state.tower.structures.length).toBeGreaterThan(0);
    expect(state.tower.rooms.length).toBeGreaterThan(0);
    expect(state.buildBaseline).not.toBeNull();
    expect(resourcesEqual(netBuildCost(state.buildBaseline!, state.tower), emptyResources())).toBe(
      true,
    );
    expect(remainingBuildResources(state.buildBaseline!, state.tower)).toEqual({
      ...STARTING_RESOURCES,
    });
    expect(state.player.resources.gold).toBe(STARTING_RESOURCES.gold);
  });
});
