import { getBlueprint } from './blueprints';
import { canPlaceInfra, getInfraAt, placeInfra } from './infra';
import { isBoilerFootprintCell, wouldMixFluids } from './pipes';
import { canPlace, createRoom, isOccupied, placeRoom } from './tower';
import type { Blueprint, Cell, PlacementReason, Tower } from './types';

export interface InfraPlacementPlan {
  ok: boolean;
  reason: PlacementReason;
  /** True when placement will create a Spire Block under the infra. */
  needsStem: boolean;
  /** Same-kind click removes infra instead of placing. */
  isToggleOff: boolean;
}

/**
 * Infra may only sit on structure. Empty cells auto-place a Spire Block when
 * that spire would be legal; otherwise the failure matches stem placement.
 */
export function planInfraPlacement(
  tower: Tower,
  blueprint: Blueprint,
  cell: Cell,
): InfraPlacementPlan {
  if (blueprint.category !== 'infra' || !blueprint.infraKind) {
    return { ok: false, reason: 'overlap', needsStem: false, isToggleOff: false };
  }

  const existing = getInfraAt(tower, cell.col, cell.row);
  if (existing?.kind === blueprint.infraKind) {
    return { ok: true, reason: 'ok', needsStem: false, isToggleOff: true };
  }

  const base = canPlaceInfra(tower, blueprint, cell);
  if (!base.ok) {
    return { ok: false, reason: base.reason, needsStem: false, isToggleOff: false };
  }

  if (blueprint.infraKind === 'pipe' && isBoilerFootprintCell(tower, cell.col, cell.row)) {
    return { ok: false, reason: 'boiler_footprint', needsStem: false, isToggleOff: false };
  }

  if (blueprint.infraKind === 'pipe' && wouldMixFluids(tower, cell)) {
    return { ok: false, reason: 'fluid_mix', needsStem: false, isToggleOff: false };
  }

  if (isOccupied(tower, cell.col, cell.row)) {
    return { ok: true, reason: 'ok', needsStem: false, isToggleOff: false };
  }

  const stem = getBlueprint('stem');
  if (!stem) {
    return { ok: false, reason: 'no_support', needsStem: false, isToggleOff: false };
  }

  const stemResult = canPlace(tower, stem, cell);
  return {
    ok: stemResult.ok,
    reason: stemResult.reason,
    needsStem: stemResult.ok,
    isToggleOff: false,
  };
}

/** Apply a successful non-toggle infra placement (optionally creating a stem). */
export function applyInfraPlacement(
  tower: Tower,
  blueprint: Blueprint,
  cell: Cell,
  roomId: string,
  plan: InfraPlacementPlan,
): Tower {
  if (!plan.ok || plan.isToggleOff || !blueprint.infraKind) return tower;

  let next = tower;
  if (plan.needsStem) {
    const stem = getBlueprint('stem');
    if (!stem) return tower;
    next = placeRoom(next, createRoom(roomId, stem, cell));
  }
  return placeInfra(next, cell, blueprint.infraKind);
}
