import { getBlueprint } from '@/model/blueprints';
import { getInfraBlueprint, infraBlueprintIdForKind } from '@/model/infraBlueprints';
import { getModification, modificationCost } from '@/model/modifications';
import type { BuildBaseline, ResourceCost, Resources, Room, Structure, Tower } from '@/model/types';
import {
  addResources,
  asResources,
  canAffordResources,
  emptyResources,
  subResources,
} from './resources';

export function infraBuildCost(tower: Tower): Resources {
  let cost = emptyResources();
  for (const cell of Object.values(tower.infra ?? {})) {
    const bp = getInfraBlueprint(infraBlueprintIdForKind(cell.kind));
    if (bp) cost = addResources(cost, bp.cost);
  }
  return cost;
}

export function structureBuildCost(structure: Structure): Resources {
  const blueprint = getBlueprint(structure.blueprintId);
  return asResources(blueprint?.cost ?? {});
}

export function roomBuildCost(room: Room): Resources {
  const blueprint = getBlueprint(room.blueprintId);
  let cost = asResources(blueprint?.cost ?? {});
  for (const mod of room.modifications) {
    const def = getModification(mod.id);
    if (!def) continue;
    for (let level = 1; level <= mod.level; level++) {
      cost = addResources(cost, modificationCost(def, level));
    }
  }
  return cost;
}

export function towerBuildCost(tower: Tower): Resources {
  let total = emptyResources();
  for (const s of tower.structures ?? []) {
    total = addResources(total, structureBuildCost(s));
  }
  for (const room of tower.rooms) {
    total = addResources(total, roomBuildCost(room));
  }
  return addResources(total, infraBuildCost(tower));
}

export function netBuildCost(baseline: BuildBaseline, draft: Tower): Resources {
  return subResources(towerBuildCost(draft), towerBuildCost(baseline.tower));
}

/** Construction remaining (ignores gold payroll — that is `recruitSpend`). */
export function remainingBuildResources(
  baseline: BuildBaseline,
  draft: Tower,
  recruitSpendGold = 0,
): Resources {
  const afterBuild = subResources(baseline.resources, netBuildCost(baseline, draft));
  return subResources(afterBuild, { gold: recruitSpendGold });
}

export function canAffordBuild(
  baseline: BuildBaseline,
  draft: Tower,
  extraCost: ResourceCost = {},
  recruitSpendGold = 0,
): boolean {
  const need = addResources(netBuildCost(baseline, draft), extraCost);
  const withRecruit = addResources(need, { gold: recruitSpendGold });
  return canAffordResources(baseline.resources, withRecruit);
}

/** @deprecated Use remainingBuildResources */
export const remainingBuildGold = remainingBuildResources;
