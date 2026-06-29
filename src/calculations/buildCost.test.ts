import { describe, expect, it } from 'vitest';
import { getBlueprint } from '@/model/blueprints';
import { createRoom, createTower, placeRoom } from '@/model/tower';
import {
  canAffordBuild,
  netBuildCost,
  remainingBuildGold,
  roomBuildCost,
  towerBuildCost,
} from './buildCost';
import type { BuildBaseline } from '@/model/types';

function baseline(tower = createTower(), currency = 48): BuildBaseline {
  return { tower: structuredClone(tower), currency };
}

describe('towerBuildCost', () => {
  it('is zero for an empty tower', () => {
    expect(towerBuildCost(createTower())).toBe(0);
  });

  it('sums room blueprint costs', () => {
    const stem = getBlueprint('stem')!;
    const tower = placeRoom(createTower(), createRoom('a', stem, { col: 4, row: 0 }));
    expect(towerBuildCost(tower)).toBe(3);
  });

  it('includes modification costs', () => {
    const stem = getBlueprint('stem')!;
    const room = createRoom('a', stem, { col: 4, row: 0 });
    room.modifications.push({ id: 'spikes', level: 1 });
    const tower = placeRoom(createTower(), room);
    expect(roomBuildCost(tower.rooms[0])).toBeGreaterThan(stem.cost);
  });
});

describe('netBuildCost', () => {
  it('is zero when the draft matches the baseline', () => {
    const tower = createTower();
    expect(netBuildCost(baseline(tower), tower)).toBe(0);
  });

  it('increases when rooms are added', () => {
    const stem = getBlueprint('stem')!;
    const base = createTower();
    const draft = placeRoom(base, createRoom('a', stem, { col: 4, row: 0 }));
    expect(netBuildCost(baseline(base), draft)).toBe(3);
  });

  it('decreases when rooms are removed from the baseline layout', () => {
    const stem = getBlueprint('stem')!;
    const base = placeRoom(createTower(), createRoom('a', stem, { col: 4, row: 0 }));
    expect(netBuildCost(baseline(base), createTower())).toBe(-3);
  });

  it('is unchanged when swapping same-cost rooms', () => {
    const stem = getBlueprint('stem')!;
    const base = placeRoom(createTower(), createRoom('a', stem, { col: 4, row: 0 }));
    const draft = placeRoom(createTower(), createRoom('b', stem, { col: 8, row: 0 }));
    expect(netBuildCost(baseline(base), draft)).toBe(0);
  });
});

describe('remainingBuildGold', () => {
  it('equals the baseline budget when nothing changed', () => {
    const tower = createTower();
    expect(remainingBuildGold(baseline(tower, 48), tower)).toBe(48);
  });

  it('never goes negative when edits are rejected by canAffordBuild', () => {
    const stem = getBlueprint('stem')!;
    let draft = createTower();
    const base = baseline(draft, 48);
    for (let i = 0; i < 20; i++) {
      const next = placeRoom(draft, createRoom(`r${i}`, stem, { col: 8, row: i }));
      if (!canAffordBuild(base, next)) break;
      draft = next;
    }
    expect(remainingBuildGold(base, draft)).toBeGreaterThanOrEqual(0);
  });
});
