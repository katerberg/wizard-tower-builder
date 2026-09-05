import { BUILD_WORK_PER_CELL, SCAFFOLD_BLUEPRINT_ID, SOUL_REFUND_RATE, TEARDOWN_REFUND_RATE } from '@/config/construction';
import { getBlueprint, isStructureBlueprint } from '../blueprints';
import { isFortificationId } from '../fortificationBlueprints';
import { applyFortificationPlacement, planFortificationPlacement } from '../fortificationPlacement';
import { applyInfraPlacement, planInfraPlacement } from '../infraPlacement';
import { spend } from '../../calculations/economy';
import { addMessage } from '../messages';
import {
  canAffordPhysical,
  consumeReservation,
  emptyStockpile,
  findStorageForReservation,
  refundToNearestStorage,
  releaseReservation,
  reserveStorage,
  stockpileFromCost,
  subStockpiles,
} from '../storage';
import {
  createRoom,
  createStructure,
  placeRoomReplacing,
  placeStructureReplacing,
  removeRoom,
  type StructurePlacementOptions,
} from '../tower';
import {
  activeHotbarSpellIds,
  refreshLeylineSpellState,
  validateLeylineRoomPlacement,
} from '../spells/progression';
import { reconcileAutoStairs } from '../autoStairs';
import { seedSpecialtyRoomDefaults } from '../staff';
import { registerStorageSite } from '../storage';
import { isPermanentStarterRoom, STORAGE_ROOM_CAPACITY } from '@/config/storage';
import {
  blueprintFootprintCells,
  orderFootprintCells,
  ordersOverlapFootprint,
  resolveOrderBlueprint,
} from './footprint';
import {
  isOrderLiveLegal,
  placementOptionsFor,
  planPlacementOnTower,
  refreshInvalidOrders,
  towerWithPendingOrders,
} from './pendingTower';
import type { Cell, ConstructionOrder, GameState, PlacementReason, ResourceCost } from '../types';

let orderCounter = 0;

export function resetConstructionCounter(): void {
  orderCounter = 0;
}

export function nextOrderId(): string {
  orderCounter += 1;
  return `order-${orderCounter}`;
}

export function computeBuildWorkRequired(blueprintId: string, extraStemCells = 0): number {
  const bp = resolveOrderBlueprint(blueprintId);
  if (!bp) return BUILD_WORK_PER_CELL;
  const cells = bp.size.w * bp.size.h + extraStemCells;
  return cells * BUILD_WORK_PER_CELL;
}

function stemStoneCost(stemCells: number): number {
  return stemCells * (getBlueprint('stem')?.cost.stone ?? 0);
}

/**
 * Blueprint cost plus the auto Spire Blocks the placement adds.
 * `tower` may be the live tower or a plan (see {@link towerWithPendingOrders}).
 */
export function totalOrderCost(
  blueprintId: string,
  tower: GameState['tower'],
  origin: Cell,
  options: StructurePlacementOptions = {},
): ResourceCost {
  const bp = resolveOrderBlueprint(blueprintId);
  if (!bp) return {};
  const cost = { ...bp.cost };
  if (isStructureBlueprint(bp)) return cost;

  const plan = planPlacementOnTower(tower, bp, origin, options);
  if (!plan.ok || plan.stemCells.length === 0) return cost;
  return { ...cost, stone: (cost.stone ?? 0) + stemStoneCost(plan.stemCells.length) };
}

function placementRejectMessage(reason: PlacementReason): string {
  if (reason === 'fluid_mix') return 'Would mix pipe fluids.';
  if (reason === 'boiler_footprint') return 'Cannot place pipes on a boiler.';
  return `Cannot build here: ${reason.replace(/_/g, ' ')}.`;
}

/**
 * Queue a paint on any layer (framing, room, infra, fortification).
 * Legality is judged on the plan — the live tower plus every pending build order
 * applied bottom-up — so players may sketch pieces whose support is still planned.
 * Painting over existing plans replaces them (Cosmoteer-style).
 */
export function createBuildOrder(
  state: GameState,
  blueprintId: string,
  origin: Cell,
  nextRoomId: () => string,
  options: StructurePlacementOptions = placementOptionsFor(state),
): ConstructionOrder | null {
  const bp = resolveOrderBlueprint(blueprintId);
  if (!bp) return null;

  const cells = blueprintFootprintCells(blueprintId, origin);
  const replaced = state.constructionOrders.filter(
    (o) => o.kind === 'build' && ordersOverlapFootprint(o, cells),
  );
  if (
    replaced.some(
      (o) =>
        o.blueprintId === blueprintId &&
        o.origin.col === origin.col &&
        o.origin.row === origin.row,
    )
  ) {
    addMessage(state, placementRejectMessage('already_in_place'), 'info');
    return null;
  }

  const kept = state.constructionOrders.filter((o) => !replaced.includes(o));
  const planned = towerWithPendingOrders(state.tower, kept, options);

  const placement = planPlacementOnTower(planned, bp, origin, options);
  if (!placement.ok || placement.isToggleOff) {
    addMessage(
      state,
      placementRejectMessage(placement.isToggleOff ? 'already_in_place' : placement.reason),
      'info',
    );
    return null;
  }

  const leyline = validateLeylineRoomPlacement(state, bp.id, origin, bp.size, {
    ignoreOrderIds: replaced.map((o) => o.id),
  });
  if (leyline && !leyline.ok) {
    addMessage(state, `Cannot build here: ${leyline.reason.replace(/_/g, ' ')}.`, 'info');
    return null;
  }

  const cost = totalOrderCost(blueprintId, planned, origin, options);
  const physical = stockpileFromCost(cost);
  const soulsNeed = cost.souls ?? 0;
  const goldNeed = cost.gold ?? 0;

  if (!canAffordPhysical(state, cost)) {
    addMessage(state, 'Not enough stone or metal in storage.', 'economy');
    return null;
  }
  if (soulsNeed > 0 && state.player.resources.souls < soulsNeed) {
    addMessage(state, 'Not enough souls.', 'economy');
    return null;
  }
  if (goldNeed > 0 && state.player.resources.gold < goldNeed) {
    addMessage(state, 'Not enough gold.', 'economy');
    return null;
  }

  const storageId = findStorageForReservation(state, physical, origin);
  if (!storageId && (physical.stone > 0 || physical.metal > 0)) {
    addMessage(state, 'No storage with enough materials.', 'economy');
    return null;
  }

  for (const previous of replaced) {
    removeOrderWithRefund(state, previous.id);
  }

  const id = nextOrderId();
  if (storageId && (physical.stone > 0 || physical.metal > 0)) {
    reserveStorage(state, id, storageId, physical);
  }
  if (soulsNeed > 0) spend(state, { souls: soulsNeed });
  if (goldNeed > 0) spend(state, { gold: goldNeed });

  const order: ConstructionOrder = {
    id,
    kind: 'build',
    blueprintId,
    origin,
    status: 'planned',
    deliverRemaining: { ...physical },
    onSiteMaterials: emptyStockpile(),
    buildProgress: 0,
    buildWorkRequired: computeBuildWorkRequired(blueprintId, placement.stemCells.length),
    soulsReserved: soulsNeed,
    invalid: false,
  };

  // Pre-assign room id for storage rooms
  if (blueprintId === 'storageRoom') {
    order.targetId = nextRoomId();
  }

  state.constructionOrders.push(order);
  addMessage(state, `Queued ${bp.name} for construction.`, 'info');
  refreshInvalidOrders(state, options);
  return order;
}

/** Drop an order, releasing its reservation and refunding delivered materials. */
function removeOrderWithRefund(state: GameState, orderId: string): boolean {
  const idx = state.constructionOrders.findIndex((o) => o.id === orderId);
  if (idx < 0) return false;
  const order = state.constructionOrders[idx];

  releaseReservation(state, orderId);
  const refundPhysical = addPartialRefund(order.onSiteMaterials, TEARDOWN_REFUND_RATE);
  if (refundPhysical.stone > 0 || refundPhysical.metal > 0) {
    refundToNearestStorage(state, refundPhysical, order.origin);
  }
  const soulRefund = Math.floor(order.soulsReserved * SOUL_REFUND_RATE);
  if (soulRefund > 0) {
    state.player.resources.souls += soulRefund;
  }

  removeScaffoldForOrder(state, order);
  state.constructionOrders.splice(idx, 1);
  return true;
}

export function cancelConstructionOrder(state: GameState, orderId: string): void {
  if (!removeOrderWithRefund(state, orderId)) return;
  addMessage(state, 'Construction order cancelled.', 'info');
  refreshInvalidOrders(state);
}

function addPartialRefund(amount: { stone: number; metal: number }, rate: number) {
  return {
    stone: Math.floor(amount.stone * rate),
    metal: Math.floor(amount.metal * rate),
  };
}

export function updateConstructionOrder(
  state: GameState,
  orderId: string,
  blueprintId: string,
): void {
  const order = state.constructionOrders.find((o) => o.id === orderId);
  if (order?.kind !== 'build') return;
  if (order.blueprintId === blueprintId) return;

  // Cosmoteer-style: cancel reservation, re-reserve for new blueprint
  releaseReservation(state, orderId);
  const bp = getBlueprint(blueprintId);
  if (!bp) return;

  const cost = totalOrderCost(blueprintId, state.tower, order.origin);
  const physical = stockpileFromCost(cost);
  const storageId = findStorageForReservation(state, physical, order.origin);
  if (!storageId) {
    addMessage(state, 'Not enough storage for updated plan.', 'economy');
    cancelConstructionOrder(state, orderId);
    return;
  }

  reserveStorage(state, orderId, storageId, physical);
  order.blueprintId = blueprintId;
  order.deliverRemaining = subStockpiles(physical, order.onSiteMaterials);
  order.buildProgress = 0;
  order.status = order.onSiteMaterials.stone > 0 || order.onSiteMaterials.metal > 0 ? 'delivering' : 'planned';
  order.buildWorkRequired = computeBuildWorkRequired(blueprintId);
}

export function createTeardownOrder(
  state: GameState,
  targetRoomId: string,
): ConstructionOrder | null {
  const room = state.tower.rooms.find((r) => r.id === targetRoomId);
  if (!room) return null;
  if (isLockedRoom(state, targetRoomId)) {
    addMessage(state, 'This room cannot be removed.', 'info');
    return null;
  }

  const simulated = removeRoom(state.tower, targetRoomId);
  const stairs = reconcileAutoStairs(simulated);
  if (!stairs.ok) {
    addMessage(state, 'Cannot remove: would disconnect rooms from ground.', 'info');
    return null;
  }

  const order: ConstructionOrder = {
    id: nextOrderId(),
    kind: 'teardown',
    blueprintId: room.blueprintId,
    origin: room.origin,
    targetId: targetRoomId,
    status: 'teardown',
    deliverRemaining: emptyStockpile(),
    onSiteMaterials: emptyStockpile(),
    buildProgress: 0,
    buildWorkRequired: computeBuildWorkRequired(room.blueprintId),
    soulsReserved: 0,
  };
  state.constructionOrders.push(order);
  addMessage(state, `Queued teardown of ${getBlueprint(room.blueprintId)?.name ?? 'room'}.`, 'info');
  return order;
}

export function placeScaffoldForOrder(state: GameState, order: ConstructionOrder): void {
  if (order.status === 'scaffold' || order.status === 'building') return;
  const cells = orderFootprintCells(order);
  for (const cell of cells) {
    const existing = state.tower.structures?.find(
      (s) =>
        s.origin.col === cell.col &&
        s.origin.row === cell.row &&
        s.blueprintId === SCAFFOLD_BLUEPRINT_ID,
    );
    if (existing) continue;
    const scaffoldBp = getBlueprint(SCAFFOLD_BLUEPRINT_ID);
    if (!scaffoldBp) continue;
    const structure = createStructure(`scaffold-${order.id}-${cell.col}-${cell.row}`, scaffoldBp, cell);
    state.tower = placeStructureReplacing(state.tower, structure, scaffoldBp).tower ?? state.tower;
  }
  order.status = 'scaffold';
}

/** Towers stay immutable so placement results can be memoized per tower object. */
function removeScaffoldForOrder(state: GameState, order: ConstructionOrder): void {
  const prefix = `scaffold-${order.id}-`;
  const structures = (state.tower.structures ?? []).filter((s) => !s.id.startsWith(prefix));
  if (structures.length === (state.tower.structures ?? []).length) return;

  const structureOccupancy = { ...state.tower.structureOccupancy };
  for (const key of Object.keys(structureOccupancy)) {
    if (structureOccupancy[key].startsWith(prefix)) delete structureOccupancy[key];
  }
  state.tower = { ...state.tower, structures, structureOccupancy };
}

export function completeConstructionOrder(state: GameState, order: ConstructionOrder, nextRoomId: () => string): void {
  const bp = resolveOrderBlueprint(order.blueprintId);
  if (!bp) return;

  const options = placementOptionsFor(state);
  if (!isOrderLiveLegal(state, order, options)) {
    // Support vanished mid-build: park the plan instead of forcing an illegal piece.
    order.invalid = true;
    return;
  }

  removeScaffoldForOrder(state, order);
  consumeReservation(state, order.id, order.deliverRemaining);

  if (bp.category === 'infra') {
    const plan = planInfraPlacement(state.tower, bp, order.origin, options);
    if (plan.ok && !plan.isToggleOff) {
      applyToTower(state, applyInfraPlacement(state.tower, bp, order.origin, nextRoomId(), plan));
    }
  } else if (bp.category === 'fortification' && isFortificationId(bp.id)) {
    const plan = planFortificationPlacement(state.tower, bp.id, order.origin);
    if (plan.ok && !plan.isToggleOff) {
      applyToTower(
        state,
        applyFortificationPlacement(state.tower, bp.id, order.origin, nextRoomId(), plan),
      );
    }
  } else if (isStructureBlueprint(bp)) {
    const structure = createStructure(nextRoomId(), bp, order.origin);
    const placed = placeStructureReplacing(state.tower, structure, bp, options);
    if (placed.ok && placed.tower) state.tower = placed.tower;
  } else if (bp.category === 'room') {
    const roomId = order.targetId ?? nextRoomId();
    const room = createRoom(roomId, bp, order.origin);
    const placed = placeRoomReplacing(state.tower, room, bp, nextRoomId, options);
    if (placed.ok && placed.tower) {
      state.tower = placed.tower;
      const placedRoom = state.tower.rooms.find((r) => r.id === roomId);
      if (placedRoom) seedSpecialtyRoomDefaults(state, placedRoom);
      if (bp.id === 'storageRoom') {
        registerStorageSite(state, {
          roomId,
          stockpile: emptyStockpile(),
          capacity: STORAGE_ROOM_CAPACITY,
          locked: false,
        });
      }
    }
  }

  addMessage(state, `Completed ${bp.name}.`, 'info');
  state.constructionOrders = state.constructionOrders.filter((o) => o.id !== order.id);
  refreshInvalidOrders(state, options);
}

/** Commit an infra/fortification edit, keeping auto stairs valid. */
function applyToTower(state: GameState, next: GameState['tower']): void {
  if ((next.rooms?.length ?? 0) > 0) {
    const stairs = reconcileAutoStairs(next);
    if (!stairs.ok) return;
    state.tower = stairs.tower;
    return;
  }
  state.tower = next;
}

export function completeTeardownOrder(state: GameState, order: ConstructionOrder): void {
  const room = state.tower.rooms.find((r) => r.id === order.targetId);
  if (!room) {
    state.constructionOrders = state.constructionOrders.filter((o) => o.id !== order.id);
    return;
  }
  const bp = getBlueprint(room.blueprintId);
  const simulated = removeRoom(state.tower, order.targetId!);
  const stairs = reconcileAutoStairs(simulated);
  if (!stairs.ok) {
    addMessage(state, 'Cannot remove: would disconnect rooms from ground.', 'info');
    return;
  }

  const cost = stockpileFromCost(bp?.cost ?? {});
  const refund = {
    stone: Math.floor(cost.stone * TEARDOWN_REFUND_RATE),
    metal: Math.floor(cost.metal * TEARDOWN_REFUND_RATE),
  };
  refundToNearestStorage(state, refund, order.origin);

  const prevSpells = activeHotbarSpellIds(state);
  delete state.storageSites[order.targetId!];
  delete state.leylineResearchAllocations[order.targetId!];
  state.tower = stairs.tower;
  refreshLeylineSpellState(state, prevSpells);

  addMessage(state, `Removed ${bp?.name ?? 'room'}.`, 'info');
  state.constructionOrders = state.constructionOrders.filter((o) => o.id !== order.id);
  refreshInvalidOrders(state);
}

/**
 * Dusk scaffold freeze, bottom-up so a frozen scaffold can carry the piece above it.
 * Speculative plans whose support is still missing stay plans.
 */
export function freezeIncompleteOrdersAtDusk(state: GameState): void {
  const options = placementOptionsFor(state);
  const bottomUp = [...state.constructionOrders].sort((a, b) => a.origin.row - b.origin.row);
  for (const order of bottomUp) {
    if (order.kind !== 'build' || order.status === 'planned' || order.invalid) continue;
    const alreadyFrozen = order.status === 'scaffold' || order.status === 'building';
    if (!alreadyFrozen && !isOrderLiveLegal(state, order, options)) continue;
    if (order.onSiteMaterials.stone > 0 || order.onSiteMaterials.metal > 0) {
      placeScaffoldForOrder(state, order);
    }
    if (order.status === 'delivering') order.status = 'scaffold';
  }
}

export function isScaffoldStructure(blueprintId: string): boolean {
  return blueprintId === SCAFFOLD_BLUEPRINT_ID;
}

export function isLockedRoom(state: GameState, roomId: string): boolean {
  return isPermanentStarterRoom(roomId) || state.storageSites[roomId]?.locked === true;
}
