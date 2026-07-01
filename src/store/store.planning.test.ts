import { describe, expect, it } from 'vitest';
import { netBuildCost } from '@/calculations/buildCost';
import { STARTING_CURRENCY } from '@/config/constants';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import { beginWave, captureBuildBaseline } from '@/model/phases';
import { createRoom, placeRoom, removeRoom, towersEqual } from '@/model/tower';
import { selectBuildUndoState } from '@/store/selectors';
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

describe('build-phase undo and revert', () => {
  it('starts with undo and revert disabled', () => {
    const store = new Store('undo0');
    const undo = selectBuildUndoState(store.getSnapshot());
    expect(undo.canUndo).toBe(false);
    expect(undo.canRevert).toBe(false);
    expect(store.getSnapshot().buildUndoDepth).toBe(0);
  });

  it('undoes the last successful placement', () => {
    const store = new Store('undo1');
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 0 } });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 1 } });
    expect(store.getSnapshot().game.tower.rooms).toHaveLength(2);

    store.dispatch({ type: 'undoBuild' });
    expect(store.getSnapshot().game.tower.rooms).toHaveLength(1);
    expect(store.getSnapshot().game.tower.rooms[0].origin).toEqual({ col: 8, row: 0 });
    expect(selectBuildUndoState(store.getSnapshot()).canUndo).toBe(true);
  });

  it('reverts to the phase baseline and clears undo history', () => {
    const store = new Store('revert');
    const baseline = store.getSnapshot().game.buildBaseline!.tower;

    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 0 } });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 1 } });
    store.dispatch({ type: 'revertBuild' });

    expect(towersEqual(store.getSnapshot().game.tower, baseline)).toBe(true);
    expect(store.getSnapshot().buildUndoDepth).toBe(0);
    expect(selectBuildUndoState(store.getSnapshot()).canRevert).toBe(false);
    expect(selectBuildUndoState(store.getSnapshot()).canUndo).toBe(false);
  });

  it('does not change currency on undo or revert', () => {
    const store = new Store('undo-gold');
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 0 } });
    store.dispatch({ type: 'undoBuild' });
    expect(store.getSnapshot().game.player.currency).toBe(STARTING_CURRENCY);

    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 0 } });
    store.dispatch({ type: 'revertBuild' });
    expect(store.getSnapshot().game.player.currency).toBe(STARTING_CURRENCY);
  });

  it('replaces a spire with a buttress in one step and undoes atomically', () => {
    const store = new Store('replace');
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 0 } });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 1 } });
    expect(store.getSnapshot().game.tower.rooms).toHaveLength(2);

    store.dispatch({ type: 'selectBlueprint', blueprintId: 'buttress2' });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 1 } });

    const afterReplace = store.getSnapshot().game.tower;
    expect(afterReplace.rooms).toHaveLength(2);
    expect(afterReplace.rooms.some((r) => r.blueprintId === 'buttress2' && r.origin.row === 1)).toBe(true);
    expect(afterReplace.rooms.some((r) => r.origin.row === 1 && r.blueprintId === 'stem')).toBe(false);

    store.dispatch({ type: 'undoBuild' });
    const undone = store.getSnapshot().game.tower;
    expect(undone.rooms).toHaveLength(2);
    expect(undone.rooms.some((r) => r.origin.row === 1 && r.blueprintId === 'stem')).toBe(true);
    expect(undone.rooms.some((r) => r.blueprintId === 'buttress2')).toBe(false);
  });
});
