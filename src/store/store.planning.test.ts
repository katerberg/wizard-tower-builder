import { describe, expect, it } from 'vitest';
import { STARTING_RESOURCES, FIXED_DT } from '@/config/constants';
import { STARTER_SUPPLY_STONE } from '@/config/storage';
import { availableInStorage } from '@/model/storage';
import type { Cell } from '@/model/types';
import { selectBuildUndoState, selectGhostPlacement } from '@/store/selectors';
import { Store } from '@/store/store';

function placeStem(store: Store, cell: Cell): void {
  store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
  store.dispatch({ type: 'placeSelectedAt', cell });
}

const EXT_COL = 9;

describe('day-phase construction orders', () => {
  it('reserves storage when queuing placement', () => {
    const store = new Store('plan');
    const before = availableInStorage(store.getSnapshot().game);
    placeStem(store, { col: EXT_COL, row: 0 });
    const after = availableInStorage(store.getSnapshot().game);
    expect(after.stone).toBe(before.stone - 3);
    expect(store.getSnapshot().game.player.resources.stone).toBe(STARTING_RESOURCES.stone);
  });

  it('transitions to night via dev skip', () => {
    const store = new Store('commit');
    store.dispatch({ type: 'toggleDevMode' });
    placeStem(store, { col: EXT_COL, row: 0 });
    store.dispatch({ type: 'startWave' });
    expect(store.getSnapshot().game.phase).toBe('night');
  });
});

describe('construction undo', () => {
  it('starts with undo disabled', () => {
    const store = new Store('undo0');
    const undo = selectBuildUndoState(store.getSnapshot());
    expect(undo.canUndo).toBe(false);
    expect(undo.canRevert).toBe(false);
  });

  it('undoes the last queued order', () => {
    const store = new Store('undo1');
    placeStem(store, { col: EXT_COL, row: 0 });
    expect(store.getSnapshot().game.constructionOrders.length).toBe(1);
    store.dispatch({ type: 'undoBuild' });
    expect(store.getSnapshot().game.constructionOrders.length).toBe(0);
  });

  it('reverts all queued orders', () => {
    const store = new Store('revert');
    placeStem(store, { col: EXT_COL, row: 0 });
    placeStem(store, { col: EXT_COL, row: 1 });
    store.dispatch({ type: 'revertBuild' });
    expect(store.getSnapshot().game.constructionOrders.length).toBe(0);
    expect(selectBuildUndoState(store.getSnapshot()).canRevert).toBe(false);
    expect(selectBuildUndoState(store.getSnapshot()).canUndo).toBe(false);
  });

  it('does not change wallet resources on undo or revert', () => {
    const store = new Store('undo-gold');
    placeStem(store, { col: EXT_COL, row: 0 });
    store.dispatch({ type: 'undoBuild' });
    expect(store.getSnapshot().game.player.resources.stone).toBe(STARTING_RESOURCES.stone);

    placeStem(store, { col: EXT_COL, row: 0 });
    store.dispatch({ type: 'revertBuild' });
    expect(store.getSnapshot().game.player.resources.stone).toBe(STARTING_RESOURCES.stone);
  });

  it('shows ghost placement during day', () => {
    const store = new Store('ghost');
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
    store.dispatch({ type: 'hoverCell', cell: { col: EXT_COL, row: 0 } });
    const ghost = selectGhostPlacement(store.getSnapshot());
    expect(ghost).not.toBeNull();
    expect(ghost?.valid).toBe(true);
  });

  it('completes construction over simulated day time', () => {
    const store = new Store('build-time');
    placeStem(store, { col: EXT_COL, row: 0 });
    for (let i = 0; i < 60 * 60; i += 1) {
      store.advance(FIXED_DT);
      if (store.getSnapshot().game.constructionOrders.length === 0) break;
    }
    expect(store.getSnapshot().game.tower.structures.some((s) => s.origin.col === EXT_COL)).toBe(true);
  });
});

describe('build mode vs select mode', () => {
  it('starts in select mode with no blueprint selected', () => {
    const store = new Store('select0');
    expect(store.getSnapshot().view.selectedBlueprintId).toBeNull();
  });

  it('does not place without a selected blueprint', () => {
    const store = new Store('select1');
    const initialRooms = store.getSnapshot().game.tower.structures.length;
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 8, row: 0 } });
    expect(store.getSnapshot().game.tower.structures).toHaveLength(initialRooms);
  });

  it('inspect opens modal and clears blueprint selection', () => {
    const store = new Store('select2');
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
    store.dispatch({ type: 'inspectRoomAt', cell: { col: 6, row: 1 } });

    const structureId = store.getSnapshot().game.tower.structures.find(
      (r) => r.origin.col === 6 && r.origin.row === 1,
    )!.id;
    const { view } = store.getSnapshot();
    expect(view.modal).toEqual({ kind: 'structure', structureId });
    expect(view.selectedBlueprintId).toBeNull();
  });
});

describe('starter supply', () => {
  it('holds initial stone in storage not wallet', () => {
    const store = new Store('supply');
    const supply = store.getSnapshot().game.storageSites['starter-supply'];
    expect(supply?.stockpile.stone).toBe(STARTER_SUPPLY_STONE);
    expect(store.getSnapshot().game.player.resources.stone).toBe(0);
  });
});
