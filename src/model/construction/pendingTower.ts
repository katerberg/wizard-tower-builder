import { isStructureBlueprint } from '../blueprints';
import { isFortificationId } from '../fortificationBlueprints';
import { applyFortificationPlacement, planFortificationPlacement } from '../fortificationPlacement';
import { applyInfraPlacement, planInfraPlacement } from '../infraPlacement';
import { reconcileAutoStairs } from '../autoStairs';
import { isOverhangUnlocked } from '../research/state';
import {
  canPlaceStructure,
  createRoom,
  createStructure,
  planRoomPlacement,
  placeRoomReplacing,
  placeStructureReplacing,
  type StructurePlacementOptions,
} from '../tower';
import { resolveOrderBlueprint } from './footprint';
import type {
  Blueprint,
  Cell,
  ConstructionOrder,
  GameState,
  PlacementReason,
  Tower,
} from '../types';

/** Ids handed to probe pieces on virtual towers — never stored on game state. */
const PENDING_ID_PREFIX = '__pending';

export interface PlanPlacement {
  ok: boolean;
  reason: PlacementReason;
  /** Cells that gain an auto Spire Block when this piece is built. */
  stemCells: Cell[];
  /** Same-kind infra/fortification already on this tower (a click removes it). */
  isToggleOff: boolean;
}

/** Research-gated placement rules; plans use the same unlocks as live builds. */
export function placementOptionsFor(state: GameState): StructurePlacementOptions {
  return { overhangUnlocked: isOverhangUnlocked(state) };
}

/** Legality of one blueprint on any tower (live or virtual), across all four layers. */
export function planPlacementOnTower(
  tower: Tower,
  blueprint: Blueprint,
  origin: Cell,
  options: StructurePlacementOptions = {},
): PlanPlacement {
  if (blueprint.category === 'infra') {
    const plan = planInfraPlacement(tower, blueprint, origin, options);
    return {
      ok: plan.ok,
      reason: plan.reason,
      stemCells: plan.needsStem ? [origin] : [],
      isToggleOff: plan.isToggleOff,
    };
  }

  if (blueprint.category === 'fortification') {
    if (!isFortificationId(blueprint.id)) {
      return { ok: false, reason: 'overlap', stemCells: [], isToggleOff: false };
    }
    const plan = planFortificationPlacement(tower, blueprint.id, origin);
    return {
      ok: plan.ok,
      reason: plan.reason,
      stemCells: plan.needsStem ? [origin] : [],
      isToggleOff: plan.isToggleOff,
    };
  }

  if (isStructureBlueprint(blueprint)) {
    const result = canPlaceStructure(tower, blueprint, origin, options);
    return { ok: result.ok, reason: result.reason, stemCells: [], isToggleOff: false };
  }

  const plan = planRoomPlacement(tower, blueprint, origin, options);
  return { ok: plan.ok, reason: plan.reason, stemCells: plan.stemCells, isToggleOff: false };
}

function reconcileStairs(tower: Tower): Tower | null {
  if ((tower.rooms?.length ?? 0) === 0) return tower;
  const stairs = reconcileAutoStairs(tower);
  return stairs.ok ? stairs.tower : null;
}

/**
 * Apply one build order to `tower` as a finished piece (never as scaffold).
 * Returns null when the order does not place legally on that tower.
 */
export function applyOrderAsCompleted(
  tower: Tower,
  order: ConstructionOrder,
  options: StructurePlacementOptions,
  nextId: () => string,
): Tower | null {
  const bp = resolveOrderBlueprint(order.blueprintId);
  if (!bp) return null;

  if (bp.category === 'infra') {
    const plan = planInfraPlacement(tower, bp, order.origin, options);
    if (!plan.ok) return null;
    if (plan.isToggleOff) return tower;
    return reconcileStairs(applyInfraPlacement(tower, bp, order.origin, nextId(), plan));
  }

  if (bp.category === 'fortification') {
    if (!isFortificationId(bp.id)) return null;
    const plan = planFortificationPlacement(tower, bp.id, order.origin);
    if (!plan.ok) return null;
    if (plan.isToggleOff) return tower;
    return reconcileStairs(applyFortificationPlacement(tower, bp.id, order.origin, nextId(), plan));
  }

  if (isStructureBlueprint(bp)) {
    const structure = createStructure(nextId(), bp, order.origin);
    const placed = placeStructureReplacing(tower, structure, bp, options);
    return placed.ok && placed.tower ? placed.tower : null;
  }

  const room = createRoom(nextId(), bp, order.origin);
  const placed = placeRoomReplacing(tower, room, bp, nextId, options);
  return placed.ok && placed.tower ? placed.tower : null;
}

/** Pending build orders bottom-up by row, stable on queue order. */
function pendingBuildOrders(
  orders: readonly ConstructionOrder[],
  includeInvalid: boolean,
): ConstructionOrder[] {
  return orders
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => order.kind === 'build' && (includeInvalid || !order.invalid))
    .sort((a, b) => a.order.origin.row - b.order.origin.row || a.index - b.index)
    .map(({ order }) => order);
}

/**
 * Live tower plus every pending build order applied as a finished piece, bottom-up.
 * Used for paint/edit legality only — laborers still build against the live tower.
 * Placement helpers are immutable, so the live tower is never touched.
 */
export function towerWithPendingOrders(
  tower: Tower,
  orders: readonly ConstructionOrder[],
  options: StructurePlacementOptions = {},
): Tower {
  let counter = 0;
  const nextId = () => `${PENDING_ID_PREFIX}-${counter++}`;
  let next = tower;
  for (const order of pendingBuildOrders(orders, false)) {
    const applied = applyOrderAsCompleted(next, order, options, nextId);
    if (applied) next = applied;
  }
  return next;
}

/**
 * Placement legality is a pure function of (tower, blueprint, origin, unlocks), and
 * towers are immutable, so results can be cached per tower object. The day tick asks
 * this question for every order on every frame; the uncached check walks the whole
 * structure layer and re-runs auto-stair pathfinding.
 */
const legalityByTower = new WeakMap<Tower, Map<string, boolean>>();

function isPlaceableOnTower(
  tower: Tower,
  blueprint: Blueprint,
  origin: Cell,
  options: StructurePlacementOptions,
): boolean {
  const key = `${blueprint.id}@${origin.col},${origin.row}@${options.overhangUnlocked ? 1 : 0}`;
  let cached = legalityByTower.get(tower);
  if (!cached) {
    cached = new Map();
    legalityByTower.set(tower, cached);
  }
  const hit = cached.get(key);
  if (hit !== undefined) return hit;
  const ok = planPlacementOnTower(tower, blueprint, origin, options).ok;
  cached.set(key, ok);
  return ok;
}

/** Could laborers finish this order on the live tower right now? */
export function isOrderLiveLegal(
  state: GameState,
  order: ConstructionOrder,
  options: StructurePlacementOptions = placementOptionsFor(state),
): boolean {
  if (order.kind !== 'build') return true;
  const bp = resolveOrderBlueprint(order.blueprintId);
  if (!bp) return false;
  return isPlaceableOnTower(state.tower, bp, order.origin, options);
}

/** Pending build orders that could be worked this tick (bottom rows unblock the rest). */
export function liveLegalBuildOrderIds(state: GameState): Set<string> {
  const options = placementOptionsFor(state);
  const ids = new Set<string>();
  for (const order of state.constructionOrders) {
    if (order.kind !== 'build' || order.invalid) continue;
    if (isOrderLiveLegal(state, order, options)) ids.add(order.id);
  }
  return ids;
}

/**
 * Re-check the whole plan bottom-up after a cancel, teardown, or completion.
 * Orders that no longer fit become orphans: labor skips them and they keep their
 * reservations until the player cancels them.
 */
export function refreshInvalidOrders(
  state: GameState,
  options: StructurePlacementOptions = placementOptionsFor(state),
): void {
  let counter = 0;
  const nextId = () => `${PENDING_ID_PREFIX}-refresh-${counter++}`;
  let probe = state.tower;
  for (const order of pendingBuildOrders(state.constructionOrders, true)) {
    const applied = applyOrderAsCompleted(probe, order, options, nextId);
    if (applied) {
      probe = applied;
      order.invalid = false;
    } else {
      order.invalid = true;
    }
  }
}
