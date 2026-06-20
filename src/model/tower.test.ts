import { describe, expect, it } from 'vitest';
import type { Blueprint, Cell, Tower } from './types';
import {
  canPlace,
  createRoom,
  createTower,
  getUnstableRoomIds,
  getWizardPosition,
  isTowerStable,
  placeRoom,
  removeRoom,
  towerHasStabilizer,
} from './tower';

const stem: Blueprint = { id: 'stem', name: 'Stem', glyph: 'I', color: '#fff', size: { w: 1, h: 1 }, cost: 1, baseHp: 10 };
const wide3: Blueprint = { id: 'wide3', name: 'Hall', glyph: 'H', color: '#fff', size: { w: 3, h: 1 }, cost: 3, baseHp: 20 };
const wide2: Blueprint = { id: 'wide2', name: 'Pair', glyph: 'P', color: '#fff', size: { w: 2, h: 1 }, cost: 2, baseHp: 15 };

let roomCounter = 0;
function place(tower: Tower, blueprint: Blueprint, origin: Cell): Tower {
  const result = canPlace(tower, blueprint, origin);
  expect(result.ok, `expected placement ok at ${origin.col},${origin.row} but got ${result.reason}`).toBe(true);
  return placeRoom(tower, createRoom(`r${roomCounter++}`, blueprint, origin));
}

describe('canPlace - basic support', () => {
  it('allows a room on the ground (row 0)', () => {
    const tower = createTower();
    expect(canPlace(tower, stem, { col: 5, row: 0 })).toEqual({ ok: true, reason: 'ok' });
  });

  it('rejects out-of-bounds placement', () => {
    const tower = createTower();
    expect(canPlace(tower, stem, { col: -1, row: 0 }).reason).toBe('out_of_bounds');
  });

  it('rejects overlap', () => {
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    expect(canPlace(tower, stem, { col: 5, row: 0 }).reason).toBe('overlap');
  });

  it('allows direct vertical stacking without a stabilizer', () => {
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    expect(canPlace(tower, stem, { col: 5, row: 1 }).reason).toBe('ok');
  });

  it('rejects a floating room with nothing below', () => {
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    expect(canPlace(tower, stem, { col: 9, row: 3 }).reason).toBe('no_support');
  });
});

describe('canPlace - stabilizer gate', () => {
  it('rejects a 1-wide cantilever before any stabilizer exists', () => {
    let tower = createTower();
    // Two separate 1-wide stems side by side (neither is a stabilizer room).
    tower = place(tower, stem, { col: 5, row: 0 });
    tower = place(tower, stem, { col: 5, row: 1 });
    tower = place(tower, stem, { col: 6, row: 0 });
    tower = place(tower, stem, { col: 6, row: 1 });
    expect(towerHasStabilizer(tower)).toBe(false);
    // (7,1) leans on (6,1) but the tower has no width>=2 stabilizer room yet.
    expect(canPlace(tower, stem, { col: 7, row: 1 }).reason).toBe('needs_stabilizer');
  });

  it('allows a wide room to self-stabilize (its own cantilevered cells)', () => {
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    tower = place(tower, stem, { col: 5, row: 1 });
    // 3-wide hall centered on the stem: outer cells cantilever, but w>=2 permits it.
    expect(canPlace(tower, wide3, { col: 4, row: 2 }).reason).toBe('ok');
  });

  it('allows a 1-wide cantilever once a stabilizer exists', () => {
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    tower = place(tower, stem, { col: 5, row: 1 });
    tower = place(tower, wide3, { col: 4, row: 2 });
    expect(towerHasStabilizer(tower)).toBe(true);
    // One step right of the supported range [4,6].
    tower = place(tower, stem, { col: 6, row: 3 });
    expect(canPlace(tower, stem, { col: 7, row: 3 }).reason).toBe('ok');
  });

  it('allows a 2-wide room to begin cantilevering off a stem', () => {
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    expect(canPlace(tower, wide2, { col: 5, row: 1 }).reason).toBe('ok');
  });
});

describe('canPlace - overhang distance', () => {
  it('rejects a cantilever more than one step beyond support', () => {
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    tower = place(tower, stem, { col: 5, row: 1 });
    tower = place(tower, wide3, { col: 4, row: 2 }); // stabilizer, range [4,6]
    // (8,3) is two steps beyond max support col 6.
    expect(canPlace(tower, stem, { col: 8, row: 3 }).reason).toBe('overhang_too_far');
  });
});

describe('canPlace - full stepped tower from the plan', () => {
  it('builds a stepped/cantilevered tower in order', () => {
    let tower = createTower();
    // stem on ground, stem up
    tower = place(tower, stem, { col: 5, row: 0 });
    tower = place(tower, stem, { col: 5, row: 1 });
    // 3-wide stabilizer unlocks cantilever
    tower = place(tower, wide3, { col: 4, row: 2 });
    // stepped tiers above
    tower = place(tower, stem, { col: 6, row: 3 });
    tower = place(tower, stem, { col: 7, row: 3 }); // 1-step cantilever right
    tower = place(tower, stem, { col: 7, row: 4 }); // direct stack on (7,3)
    expect(tower.rooms.length).toBe(6);
  });
});

describe('getWizardPosition', () => {
  it('sits at center-top of an empty tower at the ground', () => {
    const pos = getWizardPosition(createTower());
    expect(pos.row).toBe(0);
    expect(pos.face).toBe('top');
  });

  it('sits just above the highest occupied row', () => {
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    tower = place(tower, stem, { col: 5, row: 1 });
    const pos = getWizardPosition(tower);
    expect(pos).toEqual({ col: 5, row: 2, face: 'top' });
  });
});

describe('removeRoom', () => {
  it('clears occupancy for the removed room', () => {
    let tower = createTower();
    tower = place(tower, wide3, { col: 4, row: 0 });
    const id = tower.rooms[0].id;
    tower = removeRoom(tower, id);
    expect(tower.rooms.length).toBe(0);
    expect(Object.keys(tower.occupancy).length).toBe(0);
  });
});

describe('tower stability', () => {
  it('treats a fully stacked tower as stable', () => {
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    tower = place(tower, stem, { col: 5, row: 1 });
    tower = place(tower, stem, { col: 5, row: 2 });
    expect(isTowerStable(tower)).toBe(true);
    expect(getUnstableRoomIds(tower).size).toBe(0);
  });

  it('treats an empty tower as stable', () => {
    expect(isTowerStable(createTower())).toBe(true);
  });

  it('flags rooms left floating after a middle block is removed', () => {
    let tower = createTower();
    const bottom = createRoom('bottom', stem, { col: 5, row: 0 });
    const middle = createRoom('middle', stem, { col: 5, row: 1 });
    const top = createRoom('top', stem, { col: 5, row: 2 });
    tower = placeRoom(tower, bottom);
    tower = placeRoom(tower, middle);
    tower = placeRoom(tower, top);
    expect(isTowerStable(tower)).toBe(true);

    tower = removeRoom(tower, 'middle');
    expect(isTowerStable(tower)).toBe(false);
    const unstable = getUnstableRoomIds(tower);
    expect(unstable.has('top')).toBe(true);
    expect(unstable.has('bottom')).toBe(false);
  });

  it('flags a cantilever that placement would have rejected once its temporary support is removed', () => {
    // The drift case: a 1-wide cantilever is illegal to place directly (no
    // stabilizer), but a player could build a temporary support, place the
    // overhang on top of it, then remove the support. Validity must catch it.
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    tower = place(tower, stem, { col: 5, row: 1 });
    tower = place(tower, stem, { col: 6, row: 0 });
    tower = place(tower, stem, { col: 6, row: 1 });
    // Direct placement of the overhang is rejected by the stabilizer gate...
    expect(canPlace(tower, stem, { col: 7, row: 1 }).reason).toBe('needs_stabilizer');

    // ...but build a temporary support at (7,0), stack on it, then remove it.
    const support = createRoom('support', stem, { col: 7, row: 0 });
    tower = placeRoom(tower, support);
    tower = place(tower, stem, { col: 7, row: 1 });
    tower = removeRoom(tower, 'support');

    // The leftover (7,1) is now an unsupported-by-stabilizer cantilever.
    expect(isTowerStable(tower)).toBe(false);
    expect(getUnstableRoomIds(tower).size).toBeGreaterThan(0);
  });

  it('keeps a supported cantilevered tower stable but flags it if its support is removed', () => {
    let tower = createTower();
    tower = place(tower, stem, { col: 5, row: 0 });
    tower = place(tower, stem, { col: 5, row: 1 });
    tower = place(tower, wide3, { col: 4, row: 2 }); // stabilizer
    tower = place(tower, stem, { col: 6, row: 3 }); // direct on the hall
    tower = place(tower, stem, { col: 7, row: 3 }); // 1-step cantilever
    expect(isTowerStable(tower)).toBe(true);

    // Remove the hall: everything above loses its support.
    const hall = tower.rooms.find((r) => r.blueprintId === 'wide3')!;
    tower = removeRoom(tower, hall.id);
    expect(isTowerStable(tower)).toBe(false);
  });
});
