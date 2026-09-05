import { describe, expect, it } from 'vitest';
import {
  STARTER_QUARTERS_ROOM_ID,
  STARTER_SUPPLY_ROOM_ID,
} from '@/config/storage';
import { getBlueprint } from '@/model/blueprints';
import { createTeardownOrder, isLockedRoom } from '@/model/construction';
import { createInitialState } from '@/model/game';
import { canPlace, roomAt } from '@/model/tower';

describe('permanent starter rooms', () => {
  it('marks starter supply and quarters as locked', () => {
    const state = createInitialState('locked');
    expect(isLockedRoom(state, STARTER_SUPPLY_ROOM_ID)).toBe(true);
    expect(isLockedRoom(state, STARTER_QUARTERS_ROOM_ID)).toBe(true);
  });

  it('refuses teardown orders for starter facilities', () => {
    const state = createInitialState('teardown');
    expect(createTeardownOrder(state, STARTER_SUPPLY_ROOM_ID)).toBeNull();
    expect(createTeardownOrder(state, STARTER_QUARTERS_ROOM_ID)).toBeNull();
    expect(state.tower.rooms.some((r) => r.id === STARTER_SUPPLY_ROOM_ID)).toBe(true);
    expect(state.tower.rooms.some((r) => r.id === STARTER_QUARTERS_ROOM_ID)).toBe(true);
  });

  it('refuses placement that would replace starter facilities', () => {
    const state = createInitialState('replace');
    const stem = getBlueprint('stem');
    const turret = getBlueprint('turretRoom');
    expect(stem).toBeTruthy();
    expect(turret).toBeTruthy();
    expect(roomAt(state.tower, 9, 0)?.id).toBe(STARTER_QUARTERS_ROOM_ID);
    expect(roomAt(state.tower, 5, 0)?.id).toBe(STARTER_SUPPLY_ROOM_ID);

    // Same framing blueprint is a no-op; locked rooms stay protected.
    const stemPlacement = canPlace(state.tower, stem!, { col: 9, row: 0 });
    expect(stemPlacement.ok).toBe(false);
    expect(stemPlacement.reason).toBe('already_in_place');

    const roomPlacement = canPlace(state.tower, turret!, { col: 5, row: 0 });
    expect(roomPlacement.ok).toBe(false);
    expect(roomPlacement.reason).toBe('room_locked');
  });
});
