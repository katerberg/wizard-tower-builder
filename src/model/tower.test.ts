import { describe, expect, it } from 'vitest';
import { SUB_CELLS_PER_MACRO } from '@/config/constants';
import { getBlueprint } from './blueprints';
import type { Cell, Tower } from './types';
import type { StructurePlacementOptions } from './tower/placement';
import {
  canPlace,
  createRoom,
  createStructure,
  createTower,
  getUnstableStructureIds,
  getWizardPosition,
  isTowerConnected,
  isTowerStable,
  placeRoom,
  placeStructure,
  removeStructure,
  towerExtents,
  towersEqual,
} from './tower';

const stem = getBlueprint('stem')!;
const overhang: StructurePlacementOptions = { overhangUnlocked: true };
const noOverhang: StructurePlacementOptions = { overhangUnlocked: false };

let roomCounter = 0;
function place(
  tower: Tower,
  blueprintId: string,
  origin: Cell,
  options: StructurePlacementOptions = overhang,
): Tower {
  const blueprint = getBlueprint(blueprintId)!;
  const result = canPlace(tower, blueprint, origin, options);
  expect(result.ok, `expected placement ok at ${origin.col},${origin.row} but got ${result.reason}`).toBe(true);
  return placeStructure(tower, createStructure(`r${roomCounter++}`, blueprint, origin));
}

describe('canPlace - basic support', () => {
  it('allows spires on the ground', () => {
    expect(canPlace(createTower(), stem, { col: 5, row: 0 })).toEqual({ ok: true, reason: 'ok' });
  });

  it('rejects out-of-bounds placement', () => {
    expect(canPlace(createTower(), stem, { col: -1, row: 0 }).reason).toBe('out_of_bounds');
  });

  it('rejects placing the same spire blueprint on itself', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    expect(canPlace(tower, stem, { col: 5, row: 0 }).reason).toBe('already_in_place');
  });

  it('rejects placing the same room blueprint on itself', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    const turret = getBlueprint('turretRoom')!;
    tower = placeRoom(tower, createRoom('t1', turret, { col: 5, row: 0 }));
    expect(canPlace(tower, turret, { col: 5, row: 0 }).reason).toBe('already_in_place');
  });

  it('allows replacing a room with a different room blueprint', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    const turret = getBlueprint('turretRoom')!;
    const forge = getBlueprint('forgeRoom')!;
    tower = placeRoom(tower, createRoom('t1', turret, { col: 5, row: 0 }));
    expect(canPlace(tower, forge, { col: 5, row: 0 })).toEqual({ ok: true, reason: 'ok' });
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
    expect(canPlace(tower, stem, { col: 9, row: 3 }).reason).toBe('no_support');
  });
});

describe('canPlace - overhang (researched)', () => {
  it('rejects sideways spire spread without overhang research', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 }, noOverhang);
    tower = place(tower, 'stem', { col: 5, row: 1 }, noOverhang);
    tower = place(tower, 'stem', { col: 5, row: 2 }, noOverhang);
    expect(canPlace(tower, stem, { col: 6, row: 3 }, noOverhang).reason).toMatch(/no_support|disconnected/);
  });

  it('allows a one-step cantilever when overhang is unlocked', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    expect(canPlace(tower, stem, { col: 6, row: 2 }, overhang)).toEqual({ ok: true, reason: 'ok' });
  });

  it('rejects a cantilever more than one step beyond support', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 }, overhang);
    tower = place(tower, 'stem', { col: 6, row: 0 }, overhang);
    expect(canPlace(tower, stem, { col: 8, row: 1 }, overhang).reason).toBe('overhang_too_far');
  });

  it('allows stacked cantilevers on supported spines', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 }, overhang);
    tower = place(tower, 'stem', { col: 6, row: 1 }, overhang);
    expect(canPlace(tower, stem, { col: 6, row: 2 }, overhang)).toEqual({ ok: true, reason: 'ok' });
  });
});

describe('canPlace - stepped tower shapes', () => {
  it('builds a vertical spire stack', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 5, row: 2 });
    expect(tower.structures.length).toBe(3);
    expect(isTowerStable(tower)).toBe(true);
  });

  it('builds x / x / x with a cantilever cap', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 6, row: 2 });
    expect(tower.structures.length).toBe(3);
    expect(isTowerStable(tower, true)).toBe(true);
  });

  it('builds a T cap with two cantilever spires', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 4, row: 2 });
    tower = place(tower, 'stem', { col: 6, row: 2 });
    expect(tower.structures.length).toBe(4);
    expect(isTowerStable(tower, true)).toBe(true);
  });
  it('builds a connected stepped stack with cantilevers', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 1, row: 0 });
    tower = place(tower, 'stem', { col: 2, row: 1 });
    tower = place(tower, 'stem', { col: 3, row: 2 });
    expect(tower.structures.length).toBe(3);
    expect(isTowerConnected(tower, true)).toBe(true);
    expect(isTowerStable(tower, true)).toBe(true);
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
    tower = place(tower, 'stem', { col: 2, row: 0 }, noOverhang);
    expect(canPlace(tower, stem, { col: 6, row: 0 }, noOverhang).reason).toBe('disconnected');
  });

  it('rejects a disconnected second tower on the ground', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 }, noOverhang);
    expect(canPlace(tower, stem, { col: 10, row: 0 }, noOverhang).reason).toBe('disconnected');
  });

  it('allows bridging a multi-row gap in a broken stack one cell at a time', () => {
    const col = 5;
    let tower = createTower();
    tower = place(tower, 'stem', { col, row: 0 }, noOverhang);
    tower = place(tower, 'stem', { col, row: 1 }, noOverhang);
    const top = tower.structures.find((r) => r.origin.row === 1)!;
    tower = removeStructure(tower, top.id);
    tower = placeStructure(tower, createStructure('floating', stem, { col, row: 3 }));
    expect(isTowerStable(tower)).toBe(false);

    expect(canPlace(tower, stem, { col, row: 1 }, noOverhang)).toEqual({ ok: true, reason: 'ok' });
    tower = place(tower, 'stem', { col, row: 1 }, noOverhang);
    expect(isTowerStable(tower)).toBe(false);

    expect(canPlace(tower, stem, { col, row: 2 }, noOverhang)).toEqual({ ok: true, reason: 'ok' });
    tower = place(tower, 'stem', { col, row: 2 }, noOverhang);
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
    tower = place(tower, 'stem', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 5, row: 2 });
    const pos = getWizardPosition(tower);
    expect(pos).toEqual({ col: 5 * SUB_CELLS_PER_MACRO + 1, row: 3 * SUB_CELLS_PER_MACRO, face: 'top' });
  });

  it('stands on the left-most peak when the top row has two spires', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 0, row: 0 });
    tower = place(tower, 'stem', { col: 0, row: 1 });
    tower = place(tower, 'stem', { col: 1, row: 1 });
    tower = place(tower, 'stem', { col: 0, row: 2 });
    tower = place(tower, 'stem', { col: 2, row: 2 });
    const pos = getWizardPosition(tower);
    expect(pos).toEqual({ col: 1, row: 3 * SUB_CELLS_PER_MACRO, face: 'top' });
  });

  it('centers on a single top spire', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    const pos = getWizardPosition(tower);
    expect(pos).toEqual({ col: 5 * SUB_CELLS_PER_MACRO + 1, row: 2 * SUB_CELLS_PER_MACRO, face: 'top' });
  });
});

describe('removeStructure', () => {
  it('clears structure occupancy for the removed piece', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 4, row: 0 }, noOverhang);
    const id = tower.structures[0].id;
    tower = removeStructure(tower, id);
    expect(tower.structures.length).toBe(0);
    expect(Object.keys(tower.structureOccupancy).length).toBe(0);
  });
});

describe('tower stability', () => {
  it('treats a vertical spire stack as stable', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 5, row: 1 });
    tower = place(tower, 'stem', { col: 5, row: 2 });
    expect(isTowerStable(tower)).toBe(true);
    expect(getUnstableStructureIds(tower).size).toBe(0);
  });

  it('treats a cantilever stack as stable when overhang is unlocked', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 6, row: 1 });
    tower = place(tower, 'stem', { col: 6, row: 2 });
    expect(isTowerStable(tower, true)).toBe(true);
    expect(getUnstableStructureIds(tower, true).size).toBe(0);
  });

  it('treats an empty tower as stable', () => {
    expect(isTowerStable(createTower())).toBe(true);
  });

  it('flags spires left floating after a middle spire is removed', () => {
    let tower = createTower();
    const bottom = createStructure('bottom', stem, { col: 5, row: 0 });
    const middle = createStructure('middle', stem, { col: 5, row: 1 });
    const top = createStructure('top', stem, { col: 5, row: 2 });
    tower = placeStructure(tower, bottom);
    tower = placeStructure(tower, middle);
    tower = placeStructure(tower, top);
    expect(isTowerStable(tower)).toBe(true);

    tower = removeStructure(tower, 'middle');
    expect(isTowerStable(tower)).toBe(false);
    const unstable = getUnstableStructureIds(tower);
    expect(unstable.has('top')).toBe(true);
    expect(unstable.has('bottom')).toBe(false);
  });

  it('flags cantilever spires as unstable without overhang research', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 6, row: 1 });
    expect(isTowerStable(tower, false)).toBe(false);
    expect(getUnstableStructureIds(tower, false).has(tower.structures[1].id)).toBe(true);
  });

  it('flags a cantilever spire after the support below is removed', () => {
    let tower = createTower();
    const bottom = createStructure('bottom', stem, { col: 5, row: 0 });
    const middle = createStructure('middle', stem, { col: 6, row: 1 });
    const top = createStructure('top', stem, { col: 6, row: 2 });
    tower = placeStructure(tower, bottom);
    tower = placeStructure(tower, middle);
    tower = placeStructure(tower, top);
    expect(isTowerStable(tower, true)).toBe(true);

    tower = removeStructure(tower, 'middle');
    expect(isTowerStable(tower, true)).toBe(false);
    const unstable = getUnstableStructureIds(tower, true);
    expect(unstable.has('top')).toBe(true);
    expect(unstable.has('bottom')).toBe(false);
  });

  it('flags a cantilever after the stem between stacks is removed', () => {
    let tower = createTower();
    tower = place(tower, 'stem', { col: 5, row: 0 });
    tower = place(tower, 'stem', { col: 6, row: 1 });
    tower = place(tower, 'stem', { col: 6, row: 2 });
    tower = place(tower, 'stem', { col: 5, row: 3 });
    tower = place(tower, 'stem', { col: 6, row: 4 });

    const lowerStem = tower.structures.find((r) => r.origin.row === 1)!;
    tower = removeStructure(tower, lowerStem.id);
    expect(isTowerStable(tower, true)).toBe(false);
  });
});

describe('towersEqual', () => {
  it('treats empty towers as equal', () => {
    expect(towersEqual(createTower(), createTower())).toBe(true);
  });

  it('detects identical layouts', () => {
    let a = createTower();
    let b = createTower();
    a = placeStructure(a, createStructure('a', stem, { col: 4, row: 0 }));
    b = placeStructure(b, createStructure('a', stem, { col: 4, row: 0 }));
    expect(towersEqual(a, b)).toBe(true);
  });

  it('detects moved rooms', () => {
    const base = placeStructure(createTower(), createStructure('a', stem, { col: 4, row: 0 }));
    const moved = placeStructure(createTower(), createStructure('b', stem, { col: 8, row: 0 }));
    expect(towersEqual(base, moved)).toBe(false);
  });

  it('detects modification changes', () => {
    const turret = getBlueprint('turretRoom')!;
    let plain = placeStructure(createTower(), createStructure('s', stem, { col: 4, row: 0 }));
    plain = placeRoom(plain, createRoom('a', turret, { col: 4, row: 0 }));
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
    expect(tower.structures).toHaveLength(16);
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
