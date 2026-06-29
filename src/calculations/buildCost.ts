import { getBlueprint } from '@/model/blueprints';
import { getModification, modificationCost } from '@/model/modifications';
import type { BuildBaseline, Room, Tower } from '@/model/types';

export function roomBuildCost(room: Room): number {
  const blueprint = getBlueprint(room.blueprintId);
  let cost = blueprint?.cost ?? 0;
  for (const mod of room.modifications) {
    const def = getModification(mod.id);
    if (!def) continue;
    for (let level = 1; level <= mod.level; level++) {
      cost += modificationCost(def, level);
    }
  }
  return cost;
}

export function towerBuildCost(tower: Tower): number {
  return tower.rooms.reduce((sum, room) => sum + roomBuildCost(room), 0);
}

export function netBuildCost(baseline: BuildBaseline, draft: Tower): number {
  return towerBuildCost(draft) - towerBuildCost(baseline.tower);
}

export function remainingBuildGold(baseline: BuildBaseline, draft: Tower): number {
  return baseline.currency - netBuildCost(baseline, draft);
}

export function canAffordBuild(baseline: BuildBaseline, draft: Tower, extraCost = 0): boolean {
  return netBuildCost(baseline, draft) + extraCost <= baseline.currency;
}
