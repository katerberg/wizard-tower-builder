import { getBlueprint } from '@/model/blueprints';
import { getInfraBlueprint } from '@/model/infraBlueprints';
import { getModification, modificationCost } from '@/model/modifications';
import type { BuildBaseline, Room, Tower } from '@/model/types';

export function infraBuildCost(tower: Tower): number {
  let cost = 0;
  for (const cell of Object.values(tower.infra ?? {})) {
    const bp = getInfraBlueprint(cell.kind === 'stair' ? 'staircase' : 'pipe');
    cost += bp?.cost ?? 0;
  }
  return cost;
}

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
  return tower.rooms.reduce((sum, room) => sum + roomBuildCost(room), 0) + infraBuildCost(tower);
}

export function netBuildCost(baseline: BuildBaseline, draft: Tower): number {
  return towerBuildCost(draft) - towerBuildCost(baseline.tower);
}

export function remainingBuildGold(baseline: BuildBaseline, draft: Tower, recruitSpend = 0): number {
  return baseline.currency - netBuildCost(baseline, draft) - recruitSpend;
}

export function canAffordBuild(baseline: BuildBaseline, draft: Tower, extraCost = 0, recruitSpend = 0): boolean {
  return netBuildCost(baseline, draft) + extraCost + recruitSpend <= baseline.currency;
}
