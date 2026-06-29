import { describe, expect, it } from 'vitest';
import { netBuildCost } from '@/calculations/buildCost';
import { STARTING_CURRENCY } from '@/config/constants';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import { beginWave, captureBuildBaseline } from '@/model/phases';
import { createRoom, placeRoom, removeRoom } from '@/model/tower';
import { Store } from '@/store/store';

describe('build-phase planning commit', () => {
  it('does not change currency until the wave starts', () => {
    const store = new Store('plan');
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 0 } });
    expect(store.getSnapshot().game.player.currency).toBe(STARTING_CURRENCY);

    store.dispatch({ type: 'removeRoomAt', cell: { col: 8, row: 0 } });
    expect(store.getSnapshot().game.player.currency).toBe(STARTING_CURRENCY);
  });

  it('commits net build cost when starting the wave', () => {
    const store = new Store('commit');

    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 0 } });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 1 } });

    const { game } = store.getSnapshot();
    const net = netBuildCost(game.buildBaseline!, game.tower);
    expect(net).toBe(6);

    store.dispatch({ type: 'startWave' });
    expect(store.getSnapshot().game.player.currency).toBe(STARTING_CURRENCY - net);
    expect(store.getSnapshot().game.phase).toBe('attack');
  });

  it('returns gold on commit when rooms are removed during planning', () => {
    const state = createInitialState('interwave');
    const stem = getBlueprint('stem')!;
    state.tower = placeRoom(state.tower, createRoom('a', stem, { col: 8, row: 0 }));
    beginWave(state);

    state.phase = 'build';
    state.player.currency = 30;
    captureBuildBaseline(state);

    const room = state.tower.rooms[0];
    state.tower = removeRoom(state.tower, room.id);

    const net = netBuildCost(state.buildBaseline!, state.tower);
    expect(net).toBe(-3);
    state.player.currency = state.buildBaseline!.currency - net;
    expect(state.player.currency).toBe(33);
  });
});
