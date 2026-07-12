import { describe, expect, it } from 'vitest';
import { getBlueprint } from './blueprints';
import { placeInfra } from './infra';
import {
  lockPipeFluids,
  pipeFluidAt,
  previewPipeFluidAt,
  selectPipeFluids,
  wouldMixFluids,
} from './pipes';
import { createRoom, createTower, placeRoom } from './tower';

function withStem(col: number, row: number) {
  let tower = createTower();
  tower = placeRoom(tower, createRoom(`r-${col}-${row}`, getBlueprint('stem')!, { col, row }));
  return tower;
}

describe('selectPipeFluids', () => {
  it('marks a ground pipe as water', () => {
    let tower = withStem(5, 0);
    tower = placeInfra(tower, { col: 5, row: 0 }, 'pipe');
    expect(pipeFluidAt(tower, 5, 0)).toBe('water');
  });

  it('keeps elevated pipes unassigned until they reach ground', () => {
    let tower = withStem(5, 0);
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 1 }));
    tower = placeInfra(tower, { col: 5, row: 1 }, 'pipe');
    expect(pipeFluidAt(tower, 5, 1)).toBe('unassigned');
  });

  it('propagates water through connected pipes to ground', () => {
    let tower = withStem(5, 0);
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 1 }));
    tower = placeRoom(tower, createRoom('r2', getBlueprint('stem')!, { col: 5, row: 2 }));
    tower = placeInfra(tower, { col: 5, row: 0 }, 'pipe');
    tower = placeInfra(tower, { col: 5, row: 1 }, 'pipe');
    tower = placeInfra(tower, { col: 5, row: 2 }, 'pipe');

    const fluids = selectPipeFluids(tower);
    expect(fluids['5,0']).toBe('water');
    expect(fluids['5,1']).toBe('water');
    expect(fluids['5,2']).toBe('water');
  });

  it('does not leak water across a gap', () => {
    let tower = withStem(5, 0);
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 1 }));
    tower = placeRoom(tower, createRoom('r2', getBlueprint('stem')!, { col: 5, row: 2 }));
    tower = placeInfra(tower, { col: 5, row: 0 }, 'pipe');
    tower = placeInfra(tower, { col: 5, row: 2 }, 'pipe');
    expect(pipeFluidAt(tower, 5, 0)).toBe('water');
    expect(pipeFluidAt(tower, 5, 2)).toBe('unassigned');
  });

  it('seeds steam from pipes adjacent to a boiler', () => {
    let tower = createTower();
    tower = placeRoom(tower, createRoom('b0', getBlueprint('boilerRoom')!, { col: 5, row: 0 }));
    tower = placeRoom(tower, createRoom('s0', getBlueprint('stem')!, { col: 4, row: 0 }));
    tower = placeRoom(tower, createRoom('s1', getBlueprint('stem')!, { col: 4, row: 1 }));
    tower = placeInfra(tower, { col: 4, row: 1 }, 'pipe');
    expect(pipeFluidAt(tower, 4, 1)).toBe('steam');
  });

  it('rejects mixing water and steam neighborhoods', () => {
    // Water (2,1), empty gap (3,1), steam (4,1) beside 1×2 boiler at (5,0).
    let tower = createTower();
    tower = placeRoom(tower, createRoom('a0', getBlueprint('stem')!, { col: 2, row: 0 }));
    tower = placeRoom(tower, createRoom('a1', getBlueprint('stem')!, { col: 2, row: 1 }));
    tower = placeRoom(tower, createRoom('a2', getBlueprint('stem')!, { col: 3, row: 1 }));
    tower = placeRoom(tower, createRoom('a3', getBlueprint('stem')!, { col: 4, row: 1 }));
    tower = placeRoom(tower, createRoom('b0', getBlueprint('boilerRoom')!, { col: 5, row: 0 }));
    tower = placeInfra(tower, { col: 2, row: 0 }, 'pipe');
    tower = placeInfra(tower, { col: 2, row: 1 }, 'pipe');
    tower = placeInfra(tower, { col: 4, row: 1 }, 'pipe');
    expect(pipeFluidAt(tower, 2, 1)).toBe('water');
    expect(pipeFluidAt(tower, 4, 1)).toBe('steam');
    expect(wouldMixFluids(tower, { col: 3, row: 1 })).toBe(true);
  });

  it('locks fluids onto infra cells', () => {
    let tower = withStem(5, 0);
    tower = placeInfra(tower, { col: 5, row: 0 }, 'pipe');
    tower = lockPipeFluids(tower);
    expect(tower.infra['5,0']?.fluid).toBe('water');
  });
});

describe('previewPipeFluidAt', () => {
  it('previews water when placing next to a watered pipe', () => {
    let tower = withStem(5, 0);
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 1 }));
    tower = placeInfra(tower, { col: 5, row: 0 }, 'pipe');
    expect(previewPipeFluidAt(tower, { col: 5, row: 1 })).toBe('water');
  });

  it('previews unassigned when placing an isolated elevated pipe', () => {
    let tower = withStem(5, 0);
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 1 }));
    expect(previewPipeFluidAt(tower, { col: 5, row: 1 })).toBe('unassigned');
  });
});
