import { getBlueprint } from './blueprints';
import {
  canPlaceFortification,
  placeShell,
  reconcileShellAfterStructureEdit,
  shellKindAt,
} from './fortifications/shell';
import { canPlaceStructure, createStructure, hasStructure, placeStructure } from './tower';
import type { Cell, FortificationId, PlacementReason, Tower } from './types';

export interface FortificationPlan {
  ok: boolean;
  reason: PlacementReason;
  /** True when placement will create a Spire Block under the fortification. */
  needsStem: boolean;
  /** Same-kind click removes the shell instead of placing. */
  isToggleOff: boolean;
}

/**
 * Fortifications require exterior framing. Empty cells auto-place a Spire Block when
 * that spire would be legal and the fortification would then pass face rules.
 */
export function planFortificationPlacement(
  tower: Tower,
  kind: FortificationId,
  cell: Cell,
): FortificationPlan {
  const existing = shellKindAt(tower, cell.col, cell.row);
  if (existing === kind) {
    return { ok: true, reason: 'ok', needsStem: false, isToggleOff: true };
  }

  if (hasStructure(tower, cell.col, cell.row)) {
    const place = canPlaceFortification(tower, kind, cell);
    return { ok: place.ok, reason: place.reason, needsStem: false, isToggleOff: false };
  }

  const stem = getBlueprint('stem');
  if (!stem) {
    return { ok: false, reason: 'no_support', needsStem: false, isToggleOff: false };
  }

  const stemResult = canPlaceStructure(tower, stem, cell);
  if (!stemResult.ok) {
    return { ok: false, reason: stemResult.reason, needsStem: false, isToggleOff: false };
  }

  const probe = placeStructure(tower, createStructure('__fort_stem_probe__', stem, cell));
  const place = canPlaceFortification(probe, kind, cell);
  return {
    ok: place.ok,
    reason: place.reason,
    needsStem: place.ok,
    isToggleOff: false,
  };
}

/** Apply a successful non-toggle fortification placement (optionally creating a stem). */
export function applyFortificationPlacement(
  tower: Tower,
  kind: FortificationId,
  cell: Cell,
  structureId: string,
  plan: FortificationPlan,
): Tower {
  if (!plan.ok || plan.isToggleOff) return tower;

  let next = tower;
  if (plan.needsStem) {
    const stem = getBlueprint('stem');
    if (!stem) return tower;
    next = placeStructure(next, createStructure(structureId, stem, cell));
    next = reconcileShellAfterStructureEdit(next);
  }
  return placeShell(next, cell, kind);
}
