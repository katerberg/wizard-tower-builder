import { describe, expect, it } from 'vitest';
import { getBlueprint } from '@/model/blueprints';
import {
  createRoom,
  createStructure,
  createTower,
  placeRoom,
  placeStructure,
} from '@/model/tower';
import {
  canAffordBuild,
  netBuildCost,
  remainingBuildResources,
  roomBuildCost,
  towerBuildCost,
} from './buildCost';
import { asResources, emptyResources, resourcesEqual } from './resources';
import type { BuildBaseline, Resources } from '@/model/types';

function baseline(tower = createTower(), resources: Partial<Resources> = { stone: 48 }): BuildBaseline {
  return {
    tower: structuredClone(tower),
    resources: asResources(resources),
    housingRecruited: {},
    slotAllocations: {},
    manaSpringAllocations: {},
  };
}

describe('towerBuildCost', () => {
  it('is zero for an empty tower', () => {
    expect(resourcesEqual(towerBuildCost(createTower()), emptyResources())).toBe(true);
  });

  it('sums structure blueprint costs', () => {
    const stem = getBlueprint('stem')!;
    const tower = placeStructure(createTower(), createStructure('a', stem, { col: 4, row: 0 }));
    expect(towerBuildCost(tower).stone).toBe(3);
  });

  it('includes modification costs', () => {
    const stem = getBlueprint('stem')!;
    const turret = getBlueprint('turretRoom')!;
    let tower = placeStructure(createTower(), createStructure('s', stem, { col: 4, row: 0 }));
    const room = createRoom('a', turret, { col: 4, row: 0 });
    room.modifications.push({ id: 'spikes', level: 1 });
    tower = placeRoom(tower, room);
    const cost = roomBuildCost(tower.rooms[0]);
    expect(cost.souls).toBe(turret.cost.souls ?? 0);
    expect(cost.stone).toBeGreaterThan(0);
  });
});

describe('netBuildCost', () => {
  it('is zero when the draft matches the baseline', () => {
    const tower = createTower();
    expect(resourcesEqual(netBuildCost(baseline(tower), tower), emptyResources())).toBe(true);
  });

  it('increases when structures are added', () => {
    const stem = getBlueprint('stem')!;
    const base = createTower();
    const draft = placeStructure(base, createStructure('a', stem, { col: 4, row: 0 }));
    expect(netBuildCost(baseline(base), draft).stone).toBe(3);
  });

  it('decreases when structures are removed from the baseline layout', () => {
    const stem = getBlueprint('stem')!;
    const base = placeStructure(createTower(), createStructure('a', stem, { col: 4, row: 0 }));
    expect(netBuildCost(baseline(base), createTower()).stone).toBe(-3);
  });

  it('is unchanged when swapping same-cost structures', () => {
    const stem = getBlueprint('stem')!;
    const base = placeStructure(createTower(), createStructure('a', stem, { col: 4, row: 0 }));
    const draft = placeStructure(createTower(), createStructure('b', stem, { col: 8, row: 0 }));
    expect(resourcesEqual(netBuildCost(baseline(base), draft), emptyResources())).toBe(true);
  });
});

describe('remainingBuildResources', () => {
  it('equals the baseline budget when nothing changed', () => {
    const tower = createTower();
    expect(remainingBuildResources(baseline(tower, { stone: 48 }), tower).stone).toBe(48);
  });

  it('never goes negative when edits are rejected by canAffordBuild', () => {
    const stem = getBlueprint('stem')!;
    let draft = createTower();
    const base = baseline(draft, { stone: 48 });
    for (let i = 0; i < 20; i++) {
      const next = placeStructure(draft, createStructure(`r${i}`, stem, { col: 8, row: i }));
      if (!canAffordBuild(base, next)) break;
      draft = next;
    }
    expect(remainingBuildResources(base, draft).stone).toBeGreaterThanOrEqual(0);
  });
});
