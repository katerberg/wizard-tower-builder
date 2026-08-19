import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/model/game';
import { Store } from '@/store/store';
import { applyFixtureToState, extractFixtureFromState } from './handlers/fixture';
import type { BalanceBuild } from '@/test/balance/types';

describe('extractFixtureFromState', () => {
  it('produces empty placements for a fresh starter tower', () => {
    const game = createInitialState('first-wave-b');
    const fixture = extractFixtureFromState(game, 'first-wave-b');

    expect(fixture.placements).toHaveLength(0);
    expect(fixture.recruits).toBeUndefined();
    expect(fixture.slotAllocations).toBeUndefined();
    expect(fixture.research).toBeUndefined();
    expect(fixture.height).toBe(5);
    expect(fixture.seeds).toEqual(['first-wave-b']);
  });

  it('captures rooms placed beyond the starter tower', () => {
    const store = new Store('first-wave-b');
    store.dispatch({ type: 'devUnlockAll' });
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'guardroomRoom' });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 6, row: 0 } });
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'turretRoom' });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 6, row: 2 } });

    const game = store.getSnapshot().game;
    const fixture = extractFixtureFromState(game, 'first-wave-b');

    expect(fixture.placements).toHaveLength(2);
    expect(fixture.placements).toContainEqual({ blueprintId: 'guardroomRoom', cell: { col: 6, row: 0 } });
    expect(fixture.placements).toContainEqual({ blueprintId: 'turretRoom', cell: { col: 6, row: 2 } });
  });

  it('captures recruits beyond baseline', () => {
    const store = new Store('first-wave-b');
    store.dispatch({ type: 'devUnlockAll' });
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'guardroomRoom' });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 6, row: 0 } });
    // Recruit one extra soldier into the guardroom
    const roomId = store.getSnapshot().game.tower.rooms.find((r) => r.origin.col === 6 && r.origin.row === 0)?.id;
    if (roomId) store.dispatch({ type: 'recruitStaff', housingRoomId: roomId });

    const game = store.getSnapshot().game;
    const fixture = extractFixtureFromState(game, 'first-wave-b');

    expect(fixture.recruits).toBeDefined();
    expect(fixture.recruits?.length).toBeGreaterThanOrEqual(1);
    const recruit = fixture.recruits?.[0];
    expect(recruit?.cell).toEqual({ col: 6, row: 0 });
    expect(recruit?.extra).toBeGreaterThanOrEqual(1);
  });
});

describe('applyFixtureToState', () => {
  it('applies a fixture with placements and recruits', () => {
    const fixture: BalanceBuild = {
      id: 'test-fixture',
      title: 'Test fixture',
      expect: 'clear',
      height: 5,
      placements: [
        { blueprintId: 'guardroomRoom', cell: { col: 6, row: 0 } },
        { blueprintId: 'turretRoom', cell: { col: 6, row: 2 } },
      ],
      recruits: [{ cell: { col: 6, row: 0 }, extra: 1 }],
      seeds: ['first-wave-b'],
    };

    const game = applyFixtureToState(fixture);

    expect(game.tower.rooms).toHaveLength(2);
    const guardroom = game.tower.rooms.find((r) => r.blueprintId === 'guardroomRoom');
    expect(guardroom?.origin).toEqual({ col: 6, row: 0 });
    const turret = game.tower.rooms.find((r) => r.blueprintId === 'turretRoom');
    expect(turret?.origin).toEqual({ col: 6, row: 2 });
  });

  it('applies slot allocations', () => {
    const fixture: BalanceBuild = {
      id: 'test-slots',
      title: 'Test slot allocations',
      expect: 'clear',
      height: 5,
      research: ['bp-slot'],
      placements: [
        { blueprintId: 'guardroomRoom', cell: { col: 6, row: 0 } },
        { blueprintId: 'slotRoom', cell: { col: 8, row: 0 } },
      ],
      recruits: [{ cell: { col: 6, row: 0 }, extra: 2 }],
      slotAllocations: [{ cell: { col: 8, row: 0 }, count: 2 }],
      seeds: ['first-wave-b'],
    };

    const game = applyFixtureToState(fixture);

    const slotRoom = game.tower.rooms.find((r) => r.blueprintId === 'slotRoom');
    expect(slotRoom).toBeDefined();
    if (slotRoom) {
      expect(game.slotAllocations[slotRoom.id]).toBe(2);
    }
  });
});

describe('round-trip', () => {
  it('extract then apply produces equivalent tower layout', () => {
    // Build a state with a guardroom and turret
    const store = new Store('first-wave-b');
    store.dispatch({ type: 'devUnlockAll' });
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'guardroomRoom' });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 6, row: 0 } });
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'turretRoom' });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 6, row: 2 } });

    const originalGame = store.getSnapshot().game;
    const fixture = extractFixtureFromState(originalGame, 'first-wave-b');

    const rebuilt: BalanceBuild = {
      id: 'round-trip',
      title: 'Round trip test',
      expect: 'clear',
      ...fixture,
      seeds: ['first-wave-b'],
    };

    const rebuiltGame = applyFixtureToState(rebuilt);

    // Compare room origins
    const originalRoomOrigins = originalGame.tower.rooms.map((r) => ({
      blueprintId: r.blueprintId,
      col: r.origin.col,
      row: r.origin.row,
    }));
    const rebuiltRoomOrigins = rebuiltGame.tower.rooms.map((r) => ({
      blueprintId: r.blueprintId,
      col: r.origin.col,
      row: r.origin.row,
    }));

    expect(rebuiltRoomOrigins).toEqual(originalRoomOrigins);
  });
});
