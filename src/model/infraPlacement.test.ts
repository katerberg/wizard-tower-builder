import { describe, expect, it } from 'vitest';
import { getBlueprint } from './blueprints';
import { getInfraBlueprint } from './infraBlueprints';
import { placeInfra } from './infra';
import { applyInfraPlacement, planInfraPlacement } from './infraPlacement';
import { createRoom, createTower, placeRoom } from './tower';

describe('planInfraPlacement', () => {
  const pipe = getInfraBlueprint('pipe')!;
  const stair = getInfraBlueprint('staircase')!;

  it('places infra on an existing room without needing a stem', () => {
    let tower = createTower();
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 0 }));
    const plan = planInfraPlacement(tower, pipe, { col: 5, row: 0 });
    expect(plan).toEqual({ ok: true, reason: 'ok', needsStem: false, isToggleOff: false });
  });

  it('auto-places a stem when the empty cell can support a spire', () => {
    let tower = createTower();
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 0 }));
    const plan = planInfraPlacement(tower, pipe, { col: 5, row: 1 });
    expect(plan).toEqual({ ok: true, reason: 'ok', needsStem: true, isToggleOff: false });
  });

  it('rejects empty cells with the same reason as a failed spire placement', () => {
    let tower = createTower();
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 0 }));
    const plan = planInfraPlacement(tower, pipe, { col: 8, row: 2 });
    expect(plan.ok).toBe(false);
    expect(plan.needsStem).toBe(false);
    expect(plan.reason).toBe('disconnected');
  });

  it('rejects a floating empty cell for the same no_support reason as a spire', () => {
    let tower = createTower();
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 0 }));
    tower = placeRoom(tower, createRoom('r2', getBlueprint('stem')!, { col: 5, row: 1 }));
    const plan = planInfraPlacement(tower, stair, { col: 6, row: 1 });
    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe('no_support');
  });

  it('marks same-kind clicks as toggle-off', () => {
    let tower = createTower();
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 0 }));
    tower = placeInfra(tower, { col: 5, row: 0 }, 'pipe');
    const plan = planInfraPlacement(tower, pipe, { col: 5, row: 0 });
    expect(plan).toEqual({ ok: true, reason: 'ok', needsStem: false, isToggleOff: true });
  });

  it('replaces other infra on the same cell', () => {
    let tower = createTower();
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 0 }));
    tower = placeInfra(tower, { col: 5, row: 0 }, 'stair');
    const plan = planInfraPlacement(tower, pipe, { col: 5, row: 0 });
    expect(plan).toEqual({ ok: true, reason: 'ok', needsStem: false, isToggleOff: false });
    const next = applyInfraPlacement(tower, pipe, { col: 5, row: 0 }, 'unused', plan);
    expect(next.infra['5,0']?.kind).toBe('pipe');
  });
});

describe('applyInfraPlacement', () => {
  it('creates a stem and pipe together on an empty legal cell', () => {
    let tower = createTower();
    tower = placeRoom(tower, createRoom('r1', getBlueprint('stem')!, { col: 5, row: 0 }));
    const pipe = getInfraBlueprint('pipe')!;
    const plan = planInfraPlacement(tower, pipe, { col: 5, row: 1 });
    const next = applyInfraPlacement(tower, pipe, { col: 5, row: 1 }, 'auto-stem', plan);
    expect(next.occupancy['5,1']).toBe('auto-stem');
    expect(next.infra['5,1']?.kind).toBe('pipe');
    expect(next.rooms.some((r) => r.blueprintId === 'stem' && r.origin.row === 1)).toBe(true);
  });
});
