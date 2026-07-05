import { describe, expect, it } from 'vitest';
import { netBuildCost } from '@/calculations/buildCost';
import { STARTING_CURRENCY, FIXED_DT } from '@/config/constants';
import { getBlueprint } from '@/model/blueprints';
import { createInitialState } from '@/model/game';
import { beginWave, captureBuildBaseline } from '@/model/phases';
import { createRoom, placeRoom, removeRoom, towersEqual } from '@/model/tower';
import type { Cell } from '@/model/types';
import { selectBuildUndoState, selectGhostPlacement } from '@/store/selectors';
import { Store } from '@/store/store';

function placeStem(store: Store, cell: Cell): void {
  store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
  store.dispatch({ type: 'placeSelectedAt', cell });
}

/** Ground column orthogonally adjacent to the starter tower (col 8). */
const EXT_COL = 9;

describe('build-phase planning commit', () => {
  it('does not change currency until the wave starts', () => {
    const store = new Store('plan');
    placeStem(store, { col: EXT_COL, row: 0 });
    expect(store.getSnapshot().game.player.currency).toBe(STARTING_CURRENCY);

    store.dispatch({ type: 'removeRoomAt', cell: { col: EXT_COL, row: 0 } });
    expect(store.getSnapshot().game.player.currency).toBe(STARTING_CURRENCY);
  });

  it('commits net build cost when starting the wave', () => {
    const store = new Store('commit');

    placeStem(store, { col: EXT_COL, row: 0 });
    placeStem(store, { col: EXT_COL, row: 1 });

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
    state.tower = placeRoom(state.tower, createRoom('extra', stem, { col: EXT_COL, row: 0 }));
    beginWave(state);

    state.phase = 'build';
    state.player.currency = 30;
    captureBuildBaseline(state);

    const added = state.tower.rooms.find((r) => r.id === 'extra')!;
    state.tower = removeRoom(state.tower, added.id);

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
    const baselineRooms = store.getSnapshot().game.tower.rooms.length;
    placeStem(store, { col: EXT_COL, row: 0 });
    placeStem(store, { col: EXT_COL, row: 1 });
    expect(store.getSnapshot().game.tower.rooms).toHaveLength(baselineRooms + 2);

    store.dispatch({ type: 'undoBuild' });
    expect(store.getSnapshot().game.tower.rooms).toHaveLength(baselineRooms + 1);
    expect(store.getSnapshot().game.tower.rooms[baselineRooms].origin).toEqual({ col: EXT_COL, row: 0 });
    expect(selectBuildUndoState(store.getSnapshot()).canUndo).toBe(true);
  });

  it('reverts to the phase baseline and clears undo history', () => {
    const store = new Store('revert');
    const baseline = store.getSnapshot().game.buildBaseline!.tower;

    placeStem(store, { col: EXT_COL, row: 0 });
    placeStem(store, { col: EXT_COL, row: 1 });
    store.dispatch({ type: 'revertBuild' });

    expect(towersEqual(store.getSnapshot().game.tower, baseline)).toBe(true);
    expect(store.getSnapshot().buildUndoDepth).toBe(0);
    expect(selectBuildUndoState(store.getSnapshot()).canRevert).toBe(false);
    expect(selectBuildUndoState(store.getSnapshot()).canUndo).toBe(false);
  });

  it('does not change currency on undo or revert', () => {
    const store = new Store('undo-gold');
    placeStem(store, { col: EXT_COL, row: 0 });
    store.dispatch({ type: 'undoBuild' });
    expect(store.getSnapshot().game.player.currency).toBe(STARTING_CURRENCY);

    placeStem(store, { col: EXT_COL, row: 0 });
    store.dispatch({ type: 'revertBuild' });
    expect(store.getSnapshot().game.player.currency).toBe(STARTING_CURRENCY);
  });

  it('replaces a spire with a buttress in one step and undoes atomically', () => {
    const store = new Store('replace');
    const baselineRooms = store.getSnapshot().game.tower.rooms.length;
    placeStem(store, { col: EXT_COL, row: 0 });
    placeStem(store, { col: EXT_COL, row: 1 });
    expect(store.getSnapshot().game.tower.rooms).toHaveLength(baselineRooms + 2);

    store.dispatch({ type: 'selectBlueprint', blueprintId: 'buttress2' });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: EXT_COL, row: 1 } });

    const afterReplace = store.getSnapshot().game.tower;
    expect(afterReplace.rooms).toHaveLength(baselineRooms + 2);
    expect(afterReplace.rooms.some((r) => r.blueprintId === 'buttress2' && r.origin.col === EXT_COL && r.origin.row === 1)).toBe(true);
    expect(afterReplace.rooms.some((r) => r.origin.row === 1 && r.origin.col === EXT_COL && r.blueprintId === 'stem')).toBe(false);

    store.dispatch({ type: 'undoBuild' });
    const undone = store.getSnapshot().game.tower;
    expect(undone.rooms).toHaveLength(baselineRooms + 2);
    expect(undone.rooms.some((r) => r.origin.row === 1 && r.origin.col === EXT_COL && r.blueprintId === 'stem')).toBe(true);
    expect(undone.rooms.some((r) => r.origin.col === EXT_COL && r.origin.row === 1 && r.blueprintId === 'buttress2')).toBe(false);
  });
});

describe('build mode vs select mode', () => {
  it('starts in select mode with no blueprint selected', () => {
    const store = new Store('select0');
    expect(store.getSnapshot().view.selectedBlueprintId).toBeNull();
  });

  it('does not place without a selected blueprint', () => {
    const store = new Store('select1');
    const initialRooms = store.getSnapshot().game.tower.rooms.length;
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 0 } });
    expect(store.getSnapshot().game.tower.rooms).toHaveLength(initialRooms);
  });

  it('inspect opens modal and clears blueprint selection', () => {
    const store = new Store('select2');
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
    store.dispatch({ type: 'inspectRoomAt', cell: { col: 6, row: 1 } });

    const roomId = store.getSnapshot().game.tower.rooms.find((r) => r.origin.col === 6 && r.origin.row === 1)!.id;
    const { view } = store.getSnapshot();
    expect(view.modal).toEqual({ kind: 'room', roomId });
    expect(view.selectedBlueprintId).toBeNull();
  });

  it('closes the room modal after a successful placement', () => {
    const store = new Store('select3');
    store.dispatch({ type: 'inspectRoomAt', cell: { col: 6, row: 1 } });
    const roomId = store.getSnapshot().game.tower.rooms.find((r) => r.origin.col === 6 && r.origin.row === 1)!.id;
    expect(store.getSnapshot().view.modal).toEqual({ kind: 'room', roomId });

    store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: EXT_COL, row: 0 } });
    expect(store.getSnapshot().view.modal).toBeNull();
  });

  it('shows replace ghost preview over occupied cells in build mode', () => {
    const store = new Store('ghost');
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
    store.dispatch({ type: 'hoverCell', cell: { col: 6, row: 1 } });

    const ghost = selectGhostPlacement(store.getSnapshot());
    expect(ghost).not.toBeNull();
    expect(ghost!.valid).toBe(true);
    expect(ghost!.cells).toContainEqual({ col: 6, row: 1 });
  });

  it('deselects blueprint with selectBlueprint null', () => {
    const store = new Store('select4');
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
    store.dispatch({ type: 'selectBlueprint', blueprintId: null });
    expect(store.getSnapshot().view.selectedBlueprintId).toBeNull();
  });

  it('startWave clears build selection and room modal', () => {
    const store = new Store('attack0');
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
    store.dispatch({ type: 'inspectRoomAt', cell: { col: 6, row: 1 } });
    expect(store.getSnapshot().view.modal).not.toBeNull();

    store.dispatch({ type: 'startWave' });
    const { view, game } = store.getSnapshot();
    expect(game.phase).toBe('attack');
    expect(view.selectedBlueprintId).toBeNull();
    expect(view.modal).toBeNull();
  });

  it('does not open room modal during attack', () => {
    const store = new Store('attack1');
    store.dispatch({ type: 'startWave' });
    store.dispatch({ type: 'inspectRoomAt', cell: { col: 6, row: 1 } });
    expect(store.getSnapshot().view.modal).toBeNull();
  });

  it('does not select blueprints during attack', () => {
    const store = new Store('attack2');
    store.dispatch({ type: 'startWave' });
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
    expect(store.getSnapshot().view.selectedBlueprintId).toBeNull();
  });

  it('returns to select mode when a wave ends', () => {
    const store = new Store('attack3');
    store.dispatch({ type: 'startWave' });
    store.dispatch({ type: 'selectSpell', spellId: 'fireball' });

    const game = store.getSnapshot().game;
    game.enemies = [];
    game.spawnQueue = [];
    store.advance(FIXED_DT);
    store.flush();

    const { view } = store.getSnapshot();
    expect(store.getSnapshot().game.phase).toBe('build');
    expect(view.selectedBlueprintId).toBeNull();
    expect(view.selectedSpellId).toBeNull();
    expect(view.modal).toBeNull();
  });
});
