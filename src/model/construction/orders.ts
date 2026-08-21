import { BUILD_WORK_PER_CELL, SCAFFOLD_BLUEPRINT_ID, SOUL_REFUND_RATE, TEARDOWN_REFUND_RATE } from '@/config/construction';
import { SUPPLY_ROOM_BLUEPRINT_ID } from '@/config/storage';
import { getBlueprint, isStructureBlueprint } from '../blueprints';
import { isInfraBlueprint } from '../infraBlueprints';
import { isFortificationBlueprint } from '../fortificationBlueprints';
import { roomCells } from '../../calculations/grid';
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
  canPlace,
  createRoom,
  createStructure,
  planRoomPlacement,
  placeRoomReplacing,
  placeStructureReplacing,
} from '../tower';
import { validateLeylineRoomPlacement } from '../spells/progression';
import {
  activeHotbarSpellIds,
  refreshLeylineSpellState,
} from '../spells/progression';
import { seedSpecialtyRoomDefaults } from '../staff';
import { registerStorageSite } from '../storage';
import { STORAGE_ROOM_CAPACITY } from '@/config/storage';
import type { Cell, ConstructionOrder, GameState, ResourceCost } from '../types';

let orderCounter = 0;

export function resetConstructionCounter(): void {
  orderCounter = 0;
}

export function nextOrderId(): string {
  orderCounter += 1;
  return `order-${orderCounter}`;
}

export function orderFootprintCells(order: ConstructionOrder): Cell[] {
  const bp = getBlueprint(order.blueprintId);
  if (!bp) return [order.origin];
  return roomCells(order.origin, bp.size);
}

export function computeBuildWorkRequired(blueprintId: string, extraStemCells = 0): number {
  const bp = getBlueprint(blueprintId);
  if (!bp) return BUILD_WORK_PER_CELL;
  const cells = bp.size.w * bp.size.h + extraStemCells;
  return cells * BUILD_WORK_PER_CELL;
}

export function totalOrderCost(blueprintId: string, tower: GameState['tower'], origin: Cell): ResourceCost {
  const bp = getBlueprint(blueprintId);
  if (!bp) return {};
  let cost = { ...bp.cost };
  if (!isStructureBlueprint(bp) && !isInfraBlueprint(blueprintId) && !isFortificationBlueprint(blueprintId)) {
    const plan = planRoomPlacement(tower, bp, origin);
    if (plan.ok) {
      const stemCost = { stone: plan.stemCells.length * 3 };
      cost = {
        stone: (cost.stone ?? 0) + (stemCost.stone ?? 0),
        metal: cost.metal,
        souls: cost.souls,
        gold: cost.gold,
      };
    }
  }
  return cost;
}

export function createBuildOrder(
  state: GameState,
  blueprintId: string,
  origin: Cell,
  nextRoomId: () => string,
): ConstructionOrder | null {
  const bp = getBlueprint(blueprintId);
  if (!bp) return null;
  if (bp.id === SUPPLY_ROOM_BLUEPRINT_ID && Object.keys(state.storageSites).length > 0) {
    // Only one supply via starter; player builds storageRoom for more.
  }

  const placement = canPlace(state.tower, bp, origin);
  if (!placement.ok) {
    addMessage(state, `Cannot build here: ${placement.reason.replace(/_/g, ' ')}.`, 'info');
    return null;
  }

  const leyline = validateLeylineRoomPlacement(state, bp.id, origin, bp.size);
  if (leyline && !leyline.ok) {
    addMessage(state, `Cannot build here: ${leyline.reason.replace(/_/g, ' ')}.`, 'info');
    return null;
  }

  const cost = totalOrderCost(blueprintId, state.tower, origin);
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

  const id = nextOrderId();
  if (storageId && (physical.stone > 0 || physical.metal > 0)) {
    reserveStorage(state, id, storageId, physical);
  }
  if (soulsNeed > 0) spend(state, { souls: soulsNeed });
  if (goldNeed > 0) spend(state, { gold: goldNeed });

  const plan = !isStructureBlueprint(bp)
    ? planRoomPlacement(state.tower, bp, origin)
    : { ok: true, stemCells: [] as Cell[] };

  const order: ConstructionOrder = {
    id,
    kind: 'build',
    blueprintId,
    origin,
    status: 'planned',
    deliverRemaining: { ...physical },
    onSiteMaterials: emptyStockpile(),
    buildProgress: 0,
    buildWorkRequired: computeBuildWorkRequired(
      blueprintId,
      plan.ok ? plan.stemCells.length : 0,
    ),
    soulsReserved: soulsNeed,
  };

  // Pre-assign room id for storage rooms
  if (blueprintId === 'storageRoom') {
    order.targetId = nextRoomId();
  }

  state.constructionOrders.push(order);
  addMessage(state, `Queued ${bp.name} for construction.`, 'info');
  return order;
}

export function cancelConstructionOrder(state: GameState, orderId: string): void {
  const idx = state.constructionOrders.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
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
  addMessage(state, 'Construction order cancelled.', 'info');
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
  if (state.storageSites[targetRoomId]?.locked) {
    addMessage(state, 'This room cannot be removed.', 'info');
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

function removeScaffoldForOrder(state: GameState, order: ConstructionOrder): void {
  const prefix = `scaffold-${order.id}-`;
  state.tower.structures = (state.tower.structures ?? []).filter((s) => !s.id.startsWith(prefix));
  const occ = { ...state.tower.structureOccupancy };
  for (const key of Object.keys(occ)) {
    if (occ[key].startsWith('scaffold-')) {
      const id = occ[key];
      if (id.startsWith(prefix)) delete occ[key];
    }
  }
  state.tower.structureOccupancy = occ;
}

export function completeConstructionOrder(state: GameState, order: ConstructionOrder, nextRoomId: () => string): void {
  const bp = getBlueprint(order.blueprintId);
  if (!bp) return;

  removeScaffoldForOrder(state, order);
  consumeReservation(state, order.id);

  if (isStructureBlueprint(bp)) {
    const structure = createStructure(nextRoomId(), bp, order.origin);
    const placed = placeStructureReplacing(state.tower, structure, bp);
    if (placed.ok && placed.tower) state.tower = placed.tower;
  } else if (bp.category === 'room') {
    const roomId = order.targetId ?? nextRoomId();
    const room = createRoom(roomId, bp, order.origin);
    const placed = placeRoomReplacing(state.tower, room, bp);
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
}

export function completeTeardownOrder(state: GameState, order: ConstructionOrder): void {
  const room = state.tower.rooms.find((r) => r.id === order.targetId);
  if (!room) {
    state.constructionOrders = state.constructionOrders.filter((o) => o.id !== order.id);
    return;
  }
  const bp = getBlueprint(room.blueprintId);
  const cost = stockpileFromCost(bp?.cost ?? {});
  const refund = {
    stone: Math.floor(cost.stone * TEARDOWN_REFUND_RATE),
    metal: Math.floor(cost.metal * TEARDOWN_REFUND_RATE),
  };
  refundToNearestStorage(state, refund, order.origin);

  const prevSpells = activeHotbarSpellIds(state);
  state.tower.rooms = state.tower.rooms.filter((r) => r.id !== order.targetId);
  const occ = { ...state.tower.occupancy };
  for (const key of Object.keys(occ)) {
    if (occ[key] === order.targetId) delete occ[key];
  }
  state.tower.occupancy = occ;
  delete state.storageSites[order.targetId!];
  delete state.leylineResearchAllocations[order.targetId!];
  refreshLeylineSpellState(state, prevSpells);

  addMessage(state, `Removed ${bp?.name ?? 'room'}.`, 'info');
  state.constructionOrders = state.constructionOrders.filter((o) => o.id !== order.id);
}

export function freezeIncompleteOrdersAtDusk(state: GameState): void {
  for (const order of state.constructionOrders) {
    if (order.kind === 'build' && order.status !== 'planned') {
      if (order.onSiteMaterials.stone > 0 || order.onSiteMaterials.metal > 0) {
        placeScaffoldForOrder(state, order);
      }
      if (order.status === 'delivering') order.status = 'scaffold';
    }
  }
}

export function isScaffoldStructure(blueprintId: string): boolean {
  return blueprintId === SCAFFOLD_BLUEPRINT_ID;
}

export function isLockedRoom(state: GameState, roomId: string): boolean {
  return state.storageSites[roomId]?.locked === true || roomId === 'starter-quarters';
}
