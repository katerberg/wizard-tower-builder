import { describe, expect, it } from 'vitest';
import { getBlueprint } from '@/model/blueprints';
import { createRoom, placeRoom } from '@/model/tower';
import { Store } from '@/store/store';
import {
  selectLibraryBlueprints,
  selectRoomBuildAlerts,
  selectRoomInspector,
  selectSpellBar,
  selectUiTooltip,
} from './selectors';

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

describe('selectRoomBuildAlerts', () => {
  it('flags allocated slots that lack a stair path', () => {
    const store = new Store('alert-slot');
    const { game } = store.getSnapshot();
    const barracksBp = getBlueprint('barracksRoom')!;
    const slotBp = getBlueprint('slotRoom')!;
    game.tower = placeRoom(game.tower, createRoom('b1', barracksBp, { col: 4, row: 0 }));
    game.tower = placeRoom(game.tower, createRoom('s1', slotBp, { col: 10, row: 0 }));
    game.barracksRecruited.b1 = 1;
    game.slotAllocations.s1 = 1;

    const alerts = selectRoomBuildAlerts(store.getSnapshot());
    expect(alerts.some((a) => a.roomId === 's1' && a.message.includes('stairs'))).toBe(true);
  });

  it('flags barracks with no recruited soldiers', () => {
    const store = new Store('alert-barracks');
    const { game } = store.getSnapshot();
    game.tower = placeRoom(game.tower, createRoom('b1', getBlueprint('barracksRoom')!, { col: 4, row: 0 }));
    game.barracksRecruited.b1 = 0;

    const alerts = selectRoomBuildAlerts(store.getSnapshot());
    expect(alerts.some((a) => a.roomId === 'b1' && a.message.toLowerCase().includes('desert'))).toBe(true);
  });

  it('seeds defaults when placing barracks and slots', () => {
    const store = new Store('seed-place');
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'barracksRoom' });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 5, row: 0 } });
    store.dispatch({ type: 'selectBlueprint', blueprintId: 'slotRoom' });
    store.dispatch({ type: 'placeSelectedAt', cell: { col: 9, row: 0 } });

    const { game } = store.getSnapshot();
    const barracks = game.tower.rooms.find((r) => r.blueprintId === 'barracksRoom')!;
    const slot = game.tower.rooms.find((r) => r.blueprintId === 'slotRoom')!;
    expect(game.barracksRecruited[barracks.id]).toBe(1);
    expect(game.slotAllocations[slot.id]).toBe(1);
  });

  it('does not flag a healthy slot', () => {
    const store = new Store('alert-ok');
    expect(selectRoomBuildAlerts(store.getSnapshot())).toEqual([]);
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
    expect(spikes?.mechanics).toContain('2 damage');
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

describe('selectSpellBar', () => {
  it('shows four fire spells on hotkeys 1–4 during attack', () => {
    const store = new Store('spell0');
    placeStem(store, { col: 8, row: 0 });
    store.dispatch({ type: 'startWave' });
    const bar = selectSpellBar(store.getSnapshot());
    expect(bar).toHaveLength(6);
    expect(bar[0].id).toBe('fireball');
    expect(bar[1].id).toBe('immolate');
    expect(bar[2].id).toBe('wallOfFlame');
    expect(bar[3].id).toBe('kindling');
    expect(bar[0].enabled).toBe(true);
    expect(bar[4].empty).toBe(true);
  });

  it('disables fireball when out of mana', () => {
    const store = new Store('spell1');
    placeStem(store, { col: 8, row: 0 });
    store.dispatch({ type: 'startWave' });
    store.getSnapshot().game.player.mana = 3;
    const bar = selectSpellBar(store.getSnapshot());
    expect(bar[0].enabled).toBe(false);
    expect(bar[0].disabledReason).toBe('no mana');
  });

  it('shows equipped spells during build without enabling them', () => {
    const store = new Store('spell2');
    placeStem(store, { col: 8, row: 0 });
    const bar = selectSpellBar(store.getSnapshot());
    expect(bar).toHaveLength(6);
    expect(bar[0].id).toBe('fireball');
    expect(bar[0].enabled).toBe(false);
    expect(bar[0].selected).toBe(false);
  });
});

describe('selectUiTooltip', () => {
  it('describes fireball stats and range', () => {
    const store = new Store('tip0');
    placeStem(store, { col: 8, row: 0 });
    store.dispatch({ type: 'startWave' });
    const tip = selectUiTooltip(store.getSnapshot(), { kind: 'spell', id: 'fireball' });
    expect(tip?.title).toBe('Fireball');
    expect(tip?.stats.some((s) => s.label === 'Range' && s.value === '8 cells')).toBe(true);
    expect(tip?.stats.some((s) => s.label === 'Mana' && s.value === '4')).toBe(true);
    expect(tip?.description).toContain('3×3');
  });

  it('describes blueprint purpose and cost', () => {
    const store = new Store('tip1');
    const tip = selectUiTooltip(store.getSnapshot(), { kind: 'blueprint', id: 'turretRoom' });
    expect(tip?.title).toBe('Turret Room');
    expect(tip?.stats.some((s) => s.label === 'Cost')).toBe(true);
    expect(tip?.stats.some((s) => s.label === 'Effect' && s.value.includes('5 damage'))).toBe(true);
  });

  it('describes the select tool', () => {
    const store = new Store('tip2');
    const tip = selectUiTooltip(store.getSnapshot(), { kind: 'tool', id: 'select' });
    expect(tip?.title).toBe('Select');
    expect(tip?.description.toLowerCase()).toContain('inspect');
  });
});
