import { describe, expect, it } from 'vitest';
import { cellKey } from '@/calculations/grid';
import { getBlueprint } from '@/model/blueprints';
import {
  applyFortificationPlacement,
  planFortificationPlacement,
} from '@/model/fortificationPlacement';
import { createStructure, createTower, placeStructure } from '@/model/tower';
import type { Tower } from '@/model/types';

function pillar(): Tower {
  let tower = createTower();
  tower = placeStructure(tower, createStructure('a', getBlueprint('stem')!, { col: 5, row: 0 }));
  tower = placeStructure(tower, createStructure('b', getBlueprint('stem')!, { col: 5, row: 1 }));
  return tower;
}

describe('planFortificationPlacement', () => {
  it('places on existing framing without a stem', () => {
    const tower = pillar();
    const plan = planFortificationPlacement(tower, 'parapet', { col: 5, row: 1 });
    expect(plan).toEqual({ ok: true, reason: 'ok', needsStem: false, isToggleOff: false });
  });

  it('auto-stems empty cells when a spire would make the fort legal', () => {
    const tower = pillar();
    const plan = planFortificationPlacement(tower, 'parapet', { col: 5, row: 2 });
    expect(plan).toEqual({ ok: true, reason: 'ok', needsStem: true, isToggleOff: false });
  });

  it('auto-stems ground forts beside the tower base', () => {
    const tower = pillar();
    const plan = planFortificationPlacement(tower, 'moat', { col: 6, row: 0 });
    expect(plan).toEqual({ ok: true, reason: 'ok', needsStem: true, isToggleOff: false });
  });

  it('rejects empty cells where a spire cannot be placed', () => {
    const tower = pillar();
    const plan = planFortificationPlacement(tower, 'parapet', { col: 8, row: 2 });
    expect(plan.ok).toBe(false);
    expect(plan.needsStem).toBe(false);
  });

  it('rejects wrong face even when framing already exists', () => {
    const tower = pillar();
    const plan = planFortificationPlacement(tower, 'parapet', { col: 5, row: 0 });
    expect(plan).toEqual({
      ok: false,
      reason: 'wrong_face',
      needsStem: false,
      isToggleOff: false,
    });
  });

  it('toggles off the same kind without stemming', () => {
    let tower = pillar();
    tower = applyFortificationPlacement(
      tower,
      'moat',
      { col: 5, row: 0 },
      'unused',
      { ok: true, reason: 'ok', needsStem: false, isToggleOff: false },
    );
    const plan = planFortificationPlacement(tower, 'moat', { col: 5, row: 0 });
    expect(plan).toEqual({ ok: true, reason: 'ok', needsStem: false, isToggleOff: true });
  });
});

describe('applyFortificationPlacement', () => {
  it('places a spire and shell on an empty legal cell', () => {
    const tower = pillar();
    const plan = planFortificationPlacement(tower, 'parapet', { col: 5, row: 2 });
    const next = applyFortificationPlacement(tower, 'parapet', { col: 5, row: 2 }, 'auto-stem', plan);
    expect(next.structureOccupancy[cellKey(5, 2)]).toBe('auto-stem');
    expect(next.shell[cellKey(5, 2)]?.kind).toBe('parapet');
  });

  it('places shell only when framing already exists', () => {
    const tower = pillar();
    const plan = planFortificationPlacement(tower, 'barbican', { col: 5, row: 1 });
    const next = applyFortificationPlacement(tower, 'barbican', { col: 5, row: 1 }, 'unused', plan);
    expect(next.structureOccupancy[cellKey(5, 1)]).toBe('b');
    expect(next.shell[cellKey(5, 1)]?.kind).toBe('barbican');
  });
});
