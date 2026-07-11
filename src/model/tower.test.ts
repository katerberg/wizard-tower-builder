import { describe, expect, it } from 'vitest';
import { SUB_CELLS_PER_MACRO } from '@/config/constants';
import { getBlueprint } from './blueprints';
import type { Cell, Tower } from './types';
import {
  canPlace,
  createRoom,
  createTower,
  getUnstableRoomIds,
  getWizardPosition,
  isTowerConnected,
  isTowerStable,
  placeRoom,
  removeRoom,
  towerExtents,
  towersEqual,
} from './tower';

const stem = getBlueprint('stem')!;
const b2 = getBlueprint('buttress2')!;
const b3 = getBlueprint('buttress3')!;

let roomCounter = 0;
function place(tower: Tower, blueprintId: string, origin: Cell): Tower {
  const blueprint = getBlueprint(blueprintId)!;
  const result = canPlace(tower, blueprint, origin);
  expect(result.ok, `expected placement ok at ${origin.col},${origin.row} but got ${result.reason}`).toBe(true);
  return placeRoom(tower, createRoom(`r${roomCounter++}`, blueprint, origin));
}

describe('canPlace - basic support', () => {
  it('allows spires on the ground', () => {
    expect(canPlace(createTower(), stem, { col: 5, row: 0 })).toEqual({ ok: true, reason: 'ok' });
  });

  it('rejects out-of-bounds placement', () => {
    expect(canPlace(createTower(), stem, { col: -1, row: 0 }).reason).toBe('out_of_bounds');
  });

  it('allows replacing a room when the footprint fully covers it', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    expect(canPlace(tower, stem, { col: 5, row: 0 })).toEqual({ ok: true, reason: 'ok' });
  });

  it('allows replacing a spire fully under a buttress footprint', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    expect(canPlace(tower, b2, { col: 5, row: 1 })).toEqual({ ok: true, reason: 'ok' });
  });

  it('rejects partial overlap with a wider room', () => {
    let tower = createTower();
    tower = place(tower, 'buttress3', { col: 4, row: 0 });
    expect(canPlace(tower, b2, { col: 5, row: 0 }).reason).toBe('overlap');
  });

  it('allows spires stacked directly on each other', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    expect(canPlace(tower, stem, { col: 5, row: 2 })).toEqual({ ok: true, reason: 'ok' });
  });

  it('rejects a floating room with nothing below', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    expect(canPlace(tower, stem, { col: 9, row: 3 }).reason).toBe('disconnected');
  });
});

describe('canPlace - spire on buttress', () => {
  it('allows spire directly above a buttress (x / bb / x)', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'buttress2', { col: 5, row: 1 });
    expect(canPlace(tower, stem, { col: 5, row: 2 })).toEqual({ ok: true, reason: 'ok' });
  });

  it('allows multiple spires on a wide buttress (x x / bbb / x)', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 1, row: 0 });
    tower = place(tower, 'buttress3', { col: 0, row: 1 });
    expect(canPlace(tower, stem, { col: 0, row: 2 })).toEqual({ ok: true, reason: 'ok' });
    expect(canPlace(tower, stem, { col: 2, row: 2 })).toEqual({ ok: true, reason: 'ok' });
  });

  it('rejects sideways spire spread (xx / x)', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 5, row: 2 });
    expect(canPlace(tower, stem, { col: 6, row: 3 }).reason).toBe('disconnected');
  });
});

describe('canPlace - buttress', () => {
  it('allows a 2-wide buttress on a ground spire', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    expect(canPlace(tower, b2, { col: 5, row: 1 })).toEqual({ ok: true, reason: 'ok' });
  });

  it('allows a 3-wide buttress cantilevering off a stem', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    expect(canPlace(tower, b3, { col: 4, row: 1 })).toEqual({ ok: true, reason: 'ok' });
  });

  it('rejects a buttress cantilever more than one step beyond support', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 6, row: 0 });
    // b3 at col 6 spans 6,7,8 — col 8 is two steps past support ending at col 6.
    expect(canPlace(tower, b3, { col: 6, row: 1 }).reason).toBe('overhang_too_far');
  });

  it('allows buttress stacked on buttress', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'buttress2', { col: 5, row: 1 });
    expect(canPlace(tower, b2, { col: 5, row: 2 })).toEqual({ ok: true, reason: 'ok' });
  });
});

describe('canPlace - stepped tower shapes', () => {
  it('builds a vertical spire stack', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 5, row: 2 });
    expect(tower.rooms.length).toBe(3);
    expect(isTowerStable(tower)).toBe(true);
  });

  it('builds x / bb / x', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'buttress2', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 5, row: 2 });
    expect(tower.rooms.length).toBe(3);
    expect(isTowerStable(tower)).toBe(true);
  });

  it('builds x x / bbb / x', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 1, row: 0 });
    tower = place(tower, 'buttress3', { col: 0, row: 1 });
    tower = place(tower, 'stem', { col: 0, row: 2 });
    tower = place(tower, 'stem', { col: 2, row: 2 });
    expect(tower.rooms.length).toBe(4);
    expect(isTowerStable(tower)).toBe(true);
  });
  it('builds a connected pyramid (x / xx / xxx)', () => {
    let tower = createTower();
    tower = place(tower, 'buttress3', { col: 0, row: 0 });
    tower = place(tower, 'buttress2', { col: 1, row: 1 });
    tower = place(tower, 'stem', { col: 2, row: 2 });
    expect(tower.rooms.length).toBe(3);
    expect(isTowerConnected(tower)).toBe(true);
    expect(isTowerStable(tower)).toBe(true);
  });
});

describe('canPlace - connectivity', () => {
  it('rejects a second tower that does not touch the first', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    expect(canPlace(tower, stem, { col: 10, row: 0 }).reason).toBe('disconnected');
  });

  it('rejects a disconnected double-base layout', () => {
    let tower = createTower();
    tower = place(tower, 'buttress2', { col: 2, row: 0 });
    expect(canPlace(tower, b2, { col: 6, row: 0 }).reason).toBe('disconnected');
  });

  it('flags the detached mass after a removal splits the tower', () => {
    let tower = createTower();
    tower = place(tower, 'buttress2', { col: 5, row: 0 });
    tower = place(tower, 'buttress2', { col: 7, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 8, row: 1 });
    expect(isTowerConnected(tower)).toBe(true);

    const leftGround = tower.rooms.find((r) => r.origin.col === 5 && r.origin.row === 0)!;
    tower = removeRoom(tower, leftGround.id);
    expect(isTowerConnected(tower)).toBe(false);
    expect(isTowerStable(tower)).toBe(false);
  });

  it('allows bridging a multi-row gap in a broken stack one cell at a time', () => {
    const col = 5;
    let tower = createTower();
    tower = place(tower, 'stem', { col, row: 0 });
    tower = place(tower, 'stem', { col, row: 1 });
    const top = tower.rooms.find((r) => r.origin.row === 1)!;
    tower = removeRoom(tower, top.id);
    tower = placeRoom(tower, createRoom('floating', stem, { col, row: 3 }));
    expect(isTowerStable(tower)).toBe(false);

    expect(canPlace(tower, stem, { col, row: 1 })).toEqual({ ok: true, reason: 'ok' });
    tower = place(tower, 'stem', { col, row: 1 });
    expect(isTowerStable(tower)).toBe(false);

    expect(canPlace(tower, stem, { col, row: 2 })).toEqual({ ok: true, reason: 'ok' });
    tower = place(tower, 'stem', { col, row: 2 });
    expect(isTowerStable(tower)).toBe(true);
  });
});

describe('getWizardPosition', () => {
  it('sits at center-top of an empty tower at the ground', () => {
    const pos = getWizardPosition(createTower());
    expect(pos).toEqual({ col: 8 * SUB_CELLS_PER_MACRO + 1, row: 0, face: 'top' });
  });

  it('sits just above the highest occupied row', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'buttress2', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 5, row: 2 });
    const pos = getWizardPosition(tower);
    expect(pos).toEqual({ col: 5 * SUB_CELLS_PER_MACRO + 1, row: 3 * SUB_CELLS_PER_MACRO, face: 'top' });
  });

  it('stands on the left-most peak when the top row has two spires on one buttress', () => {
    let tower = createTower();
    tower = place(tower, 'buttress3', { col: 0, row: 0 });
    tower = place(tower, 'buttress3', { col: 0, row: 1 });
    tower = place(tower, 'stem', { col: 0, row: 2 });
    tower = place(tower, 'stem', { col: 2, row: 2 });
    const pos = getWizardPosition(tower);
    expect(pos).toEqual({ col: 1, row: 3 * SUB_CELLS_PER_MACRO, face: 'top' });
  });

  it('centers on a wide buttress when the top row is one contiguous span', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'buttress3', { col: 4, row: 1 });
    const pos = getWizardPosition(tower);
    expect(pos).toEqual({ col: 5 * SUB_CELLS_PER_MACRO + 1, row: 2 * SUB_CELLS_PER_MACRO, face: 'top' });
  });
});

describe('removeRoom', () => {
  it('clears occupancy for the removed room', () => {
    let tower = createTower();
    tower = place(tower, 'buttress3', { col: 4, row: 0 });
    const id = tower.rooms[0].id;
    tower = removeRoom(tower, id);
    expect(tower.rooms.length).toBe(0);
    expect(Object.keys(tower.occupancy).length).toBe(0);
  });
});

describe('tower stability', () => {
  it('treats a vertical spire stack as stable', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 5, row: 2 });
    expect(isTowerStable(tower)).toBe(true);
    expect(getUnstableRoomIds(tower).size).toBe(0);
  });

  it('treats a spire-buttress-spire stack as stable', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'buttress2', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 5, row: 2 });
    expect(isTowerStable(tower)).toBe(true);
    expect(getUnstableRoomIds(tower).size).toBe(0);
  });

  it('treats an empty tower as stable', () => {
    expect(isTowerStable(createTower())).toBe(true);
  });

  it('flags spires left floating after a middle spire is removed', () => {
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

  it('flags spires left floating after the buttress below is removed', () => {
    let tower = createTower();
    const bottom = createRoom('bottom', stem, { col: 5, row: 0 });
    const middle = createRoom('middle', b2, { col: 5, row: 1 });
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

  it('flags a spire on spire after the buttress between them is removed', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'buttress2', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 5, row: 2 });
    tower = place(tower, 'buttress2', { col: 5, row: 3 });
    tower = place(tower, 'stem', { col: 5, row: 4 });

    const lowerButtress = tower.rooms.find((r) => r.origin.row === 1)!;
    tower = removeRoom(tower, lowerButtress.id);
    expect(isTowerStable(tower)).toBe(false);
  });
});

describe('towersEqual', () => {
  it('treats empty towers as equal', () => {
    expect(towersEqual(createTower(), createTower())).toBe(true);
  });

  it('detects identical layouts', () => {
    let a = createTower();
    let b = createTower();
    a = placeRoom(a, createRoom('a', stem, { col: 4, row: 0 }));
    b = placeRoom(b, createRoom('a', stem, { col: 4, row: 0 }));
    expect(towersEqual(a, b)).toBe(true);
  });

  it('detects moved rooms', () => {
    const base = placeRoom(createTower(), createRoom('a', stem, { col: 4, row: 0 }));
    const moved = placeRoom(createTower(), createRoom('b', stem, { col: 8, row: 0 }));
    expect(towersEqual(base, moved)).toBe(false);
  });

  it('detects modification changes', () => {
    const room = createRoom('a', stem, { col: 4, row: 0 });
    const plain = placeRoom(createTower(), room);
    const modded = structuredClone(plain);
    modded.rooms[0].modifications.push({ id: 'spikes', level: 1 });
    expect(towersEqual(plain, modded)).toBe(false);
  });
});

describe('unbounded height', () => {
  it('allows placement well above the old fixed grid cap', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 8, row: 0 });
    for (let row = 1; row <= 15; row++) {
      tower = place(tower, 'stem', { col: 8, row });
    }
    expect(tower.rooms).toHaveLength(16);
    expect(getWizardPosition(tower).row).toBe(16 * SUB_CELLS_PER_MACRO);
  });

  it('reports towerExtents for a tall stack', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 4, row: 0 });
    for (let row = 1; row <= 25; row++) {
      tower = place(tower, 'stem', { col: 4, row });
    }
    expect(towerExtents(tower).maxOccupiedRow).toBe(25);
    expect(towerExtents(tower).wizardRow).toBe(26);
  });
});
