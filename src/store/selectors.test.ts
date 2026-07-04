import { describe, expect, it } from 'vitest';
import { Store } from '@/store/store';
import { selectLibraryBlueprints, selectRoomInspector } from './selectors';

function placeStem(store: Store, cell: { col: number; row: number }): void {
  store.dispatch({ type: 'selectBlueprint', blueprintId: 'stem' });
  store.dispatch({ type: 'placeSelectedAt', cell });
}

describe('selectLibraryBlueprints', () => {
  it('marks affordable blueprints based on remaining gold', () => {
    const store = new Store('lib');
    const items = selectLibraryBlueprints(store.getSnapshot());
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((b) => typeof b.affordable === 'boolean')).toBe(true);
    expect(items.find((b) => b.id === 'stem')?.affordable).toBe(true);
  });

  it('reflects selected blueprint from view state', () => {
    const store = new Store('lib2');
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'buttress2' });
    const items = selectLibraryBlueprints(store.getSnapshot());
    expect(items.find((b) => b.id === 'buttress2')?.selected).toBe(true);
    expect(items.find((b) => b.id === 'stem')?.selected).toBe(false);
  });
});

describe('selectRoomInspector', () => {
  it('returns null for missing room', () => {
    const store = new Store('insp0');
    expect(selectRoomInspector(store.getSnapshot(), 'missing')).toBeNull();
  });

  it('exposes add affordance for unmodified spikes in build phase', () => {
    const store = new Store('insp1');
    placeStem(store, { col: 8, row: 0 });
    const roomId = store.getSnapshot().game.tower.rooms[0].id;
    const inspector = selectRoomInspector(store.getSnapshot(), roomId);
    expect(inspector).not.toBeNull();
    const spikes = inspector!.modifications.find((m) => m.id === 'spikes');
    expect(spikes?.action).toBe('add');
    expect(spikes?.enabled).toBe(true);
    expect(inspector!.canRemove).toBe(true);
  });

  it('disables modification actions outside build phase', () => {
    const store = new Store('insp2');
    placeStem(store, { col: 8, row: 0 });
    store.dispatch({ type: 'startWave' });
    const roomId = store.getSnapshot().game.tower.rooms[0].id;
    const inspector = selectRoomInspector(store.getSnapshot(), roomId);
    expect(inspector?.isBuildPhase).toBe(false);
    expect(inspector?.modifications.every((m) => m.action === 'none')).toBe(true);
    expect(inspector?.canRemove).toBe(false);
  });
});
