import { describe, expect, it } from 'vitest';
import { getBlueprint } from '../blueprints';
import { computeRoomStats } from '../../calculations/combat';
import { createRoom, createTower } from '../tower';
import {
  aggregateModifierStats,
  canApplyModification,
  canUpgradeModification,
  getModification,
  modificationCost,
  modificationRefund,
} from './index';
import type { Room } from '../types';

function makeRoom(): Room {
  return createRoom('r0', getBlueprint('buttress2')!, { col: 5, row: 0 });
}

describe('modification economy', () => {
  it('reports the cost to reach each level', () => {
    const turret = getModification('turret')!;
    expect(modificationCost(turret, 1)).toBe(10);
    expect(modificationCost(turret, 2)).toBe(16);
    expect(modificationCost(turret, 3)).toBe(24);
  });

  it('refunds half of everything spent on a modification', () => {
    const room = makeRoom();
    room.modifications.push({ id: 'spikes', level: 2 }); // spent 5 + 8 = 13
    expect(modificationRefund(room)).toBe(6); // floor(13 * 0.5)

    room.modifications.push({ id: 'turret', level: 1 }); // + spent 10
    expect(modificationRefund(room)).toBe(6 + 5); // + floor(10 * 0.5)
  });
});

describe('modification rules', () => {
  it('allows one instance per type and gates upgrades by level', () => {
    const tower = createTower();
    const room = makeRoom();

    expect(canApplyModification(room, tower, 'spikes')).toBe(true);
    expect(canUpgradeModification(room, 'spikes')).toBe(false);

    room.modifications.push({ id: 'spikes', level: 1 });
    expect(canApplyModification(room, tower, 'spikes')).toBe(false); // already installed
    expect(canUpgradeModification(room, 'spikes')).toBe(true);

    room.modifications[0].level = getModification('spikes')!.maxLevel;
    expect(canUpgradeModification(room, 'spikes')).toBe(false); // at max
  });

  it('rejects unknown modification ids', () => {
    const room = makeRoom();
    expect(canApplyModification(room, createTower(), 'nope')).toBe(false);
    expect(getModification('nope')).toBeUndefined();
  });
});

describe('passive stat aggregation', () => {
  it('leaves room stats at the blueprint baseline when no modifications add stats', () => {
    const blueprint = getBlueprint('buttress2')!;
    const room = makeRoom();
    room.modifications.push({ id: 'spikes', level: 3 });

    expect(aggregateModifierStats(room.modifications)).toEqual({});
    expect(computeRoomStats(room, blueprint).maxHp).toBe(blueprint.baseHp);
  });
});
