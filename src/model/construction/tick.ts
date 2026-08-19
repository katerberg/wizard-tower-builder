import {
  BUILD_PROGRESS_PER_SEC,
  LABORER_CARRY_CAPACITY,
} from '@/config/construction';
import { RARE_PATCH_FALLOFF } from '@/config/mines';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { roomAnchorCell } from '@/calculations/interiorGraph';
import {
  STAFF_HORIZONTAL_SPEED,
  STAFF_STAIR_SPEED,
  LABORER_REPAIR_HP_PER_SEC,
} from '@/config/constants';
import { stepStaff } from '../staff/deploy';
import { repathIdleLaborers } from '../staff/combat';
import { getStorageSite, withdrawFromStorage } from '../storage';
import {
  completeConstructionOrder,
  completeTeardownOrder,
  orderFootprintCells,
  placeScaffoldForOrder,
} from './orders';
import type { Cell, ConstructionOrder, GameState, StaffUnit, Stockpile } from '../types';

function laborerEfficiency(count: number): number {
  if (count <= 0) return 0;
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.pow(RARE_PATCH_FALLOFF, i);
  return total;
}

function orderSiteCell(order: ConstructionOrder): Cell {
  const cells = orderFootprintCells(order);
  return cells[0] ?? order.origin;
}

function storageAnchor(state: GameState, storageRoomId: string): Cell | null {
  const room = state.tower.rooms.find((r) => r.id === storageRoomId);
  if (!room) return null;
  return roomAnchorCell(state.tower, room.origin, room.size);
}

function assignConstructionLaborers(state: GameState): void {
  let laborerIdx = 0;
  const laborers = state.staff.filter((s) => s.kind === 'laborer');

  const teardownOrders = state.constructionOrders.filter((o) => o.kind === 'teardown');
  const buildOrders = state.constructionOrders.filter((o) => o.kind === 'build' && o.status !== 'building');

  for (const order of [...teardownOrders, ...buildOrders]) {
    if (laborerIdx >= laborers.length) break;
    const lab = laborers[laborerIdx];
    if (isProspectorBusy(state, lab)) continue;
    if (lab.targetWorkplaceId?.startsWith('construction:')) continue;
    lab.targetWorkplaceId = `construction:${order.id}`;
    laborerIdx += 1;
  }
}

function isProspectorBusy(state: GameState, lab: StaffUnit): boolean {
  if (state.prospectAllocation <= 0) return false;
  const prospectors = state.staff
    .filter((s) => s.kind === 'laborer')
    .slice(0, state.prospectAllocation);
  return prospectors.some((p) => p.id === lab.id);
}

function tickConstructionLabor(state: GameState, dt: number, nextRoomId: () => string): void {
  assignConstructionLaborers(state);

  const buildingOrders = state.constructionOrders.filter(
    (o) => o.kind === 'build' && (o.status === 'building' || o.status === 'scaffold'),
  );

  for (const order of buildingOrders) {
    const workers = state.staff.filter(
      (s) => s.kind === 'laborer' && s.targetWorkplaceId === `construction:${order.id}` && s.status === 'working',
    );
    if (workers.length === 0) continue;
    const rate = BUILD_PROGRESS_PER_SEC * laborerEfficiency(workers.length);
    order.buildProgress += (rate * dt) / order.buildWorkRequired;
    if (order.buildProgress >= 1) {
      completeConstructionOrder(state, order, nextRoomId);
    }
  }

  for (const order of state.constructionOrders.filter((o) => o.kind === 'teardown')) {
    const workers = state.staff.filter(
      (s) => s.kind === 'laborer' && s.targetWorkplaceId === `construction:${order.id}` && s.status === 'working',
    );
    if (workers.length === 0) continue;
    const rate = BUILD_PROGRESS_PER_SEC * laborerEfficiency(workers.length);
    order.buildProgress += (rate * dt) / order.buildWorkRequired;
    if (order.buildProgress >= 1) {
      completeTeardownOrder(state, order);
    }
  }
}

function tickHauling(state: GameState): void {
  for (const lab of state.staff) {
    if (lab.kind !== 'laborer') continue;
    const target = lab.targetWorkplaceId;
    if (!target?.startsWith('construction:')) continue;

    const orderId = target.slice('construction:'.length);
    const order = state.constructionOrders.find((o) => o.id === orderId);
    if (order?.kind !== 'build') continue;

    if (order.status === 'planned' || order.status === 'delivering') {
      tickHaulLaborer(state, lab, order);
    } else if (order.status === 'scaffold' && order.deliverRemaining.stone === 0 && order.deliverRemaining.metal === 0) {
      order.status = 'building';
      lab.status = 'working';
    } else if (order.status === 'scaffold' || order.status === 'building') {
      lab.status = 'working';
    }
  }
}

function tickHaulLaborer(state: GameState, lab: StaffUnit, order: ConstructionOrder): void {
  const reservation = state.storageReservations.find((r) => r.orderId === order.id);
  const siteCell = orderSiteCell(order);

  if (lab.carry && (lab.carry.stone > 0 || lab.carry.metal > 0)) {
    // Deliver to site
    if (lab.path.length === 0 && lab.status !== 'moving') {
      const atSite = lab.pos.col === siteCell.col && lab.pos.row === siteCell.row;
      if (atSite) {
        order.onSiteMaterials.stone += lab.carry.stone;
        order.onSiteMaterials.metal += lab.carry.metal;
        order.deliverRemaining.stone = Math.max(0, order.deliverRemaining.stone - lab.carry.stone);
        order.deliverRemaining.metal = Math.max(0, order.deliverRemaining.metal - lab.carry.metal);
        lab.carry = { stone: 0, metal: 0 };
        lab.carryOrderId = undefined;
        if (order.deliverRemaining.stone === 0 && order.deliverRemaining.metal === 0) {
          placeScaffoldForOrder(state, order);
          order.status = 'building';
          lab.status = 'working';
        } else {
          lab.targetWorkplaceId = `construction:${order.id}`;
          lab.status = 'idle';
        }
      } else {
        assignPathTo(lab, state, siteCell);
      }
    }
    return;
  }

  if (order.deliverRemaining.stone <= 0 && order.deliverRemaining.metal <= 0) {
    placeScaffoldForOrder(state, order);
    order.status = 'building';
    lab.status = 'working';
    return;
  }

  const storageId = reservation?.storageRoomId ?? lab.carryFromStorageId;
  if (!storageId) return;
  const anchor = storageAnchor(state, storageId);
  if (!anchor) return;

  const atStorage = lab.pos.col === anchor.col && lab.pos.row === anchor.row;
  if (atStorage && lab.status !== 'moving') {
    const site = getStorageSite(state, storageId);
    if (!site) return;
    const need: Stockpile = {
      stone: Math.min(order.deliverRemaining.stone, LABORER_CARRY_CAPACITY),
      metal: Math.min(order.deliverRemaining.metal, LABORER_CARRY_CAPACITY - Math.min(order.deliverRemaining.stone, LABORER_CARRY_CAPACITY)),
    };
    // Fill carry with mixed load up to capacity
    let cap = LABORER_CARRY_CAPACITY;
    const carry: Stockpile = { stone: 0, metal: 0 };
    const stoneTake = Math.min(need.stone, order.deliverRemaining.stone, site.stockpile.stone, cap);
    carry.stone = stoneTake;
    cap -= stoneTake;
    const metalTake = Math.min(order.deliverRemaining.metal, site.stockpile.metal, cap);
    carry.metal = metalTake;
    if (carry.stone === 0 && carry.metal === 0) return;
    withdrawFromStorage(site, carry);
    lab.carry = carry;
    lab.carryFromStorageId = storageId;
    lab.carryOrderId = order.id;
    order.status = 'delivering';
    assignPathTo(lab, state, siteCell);
  } else if (!atStorage) {
    assignPathTo(lab, state, anchor);
  }
}

function assignPathTo(lab: StaffUnit, state: GameState, dest: Cell): void {
  const path = findInteriorPath(state.tower, lab.pos, dest);
  if (path.length === 0) {
    lab.status = 'idle';
    return;
  }
  lab.path = path;
  lab.pathIndex = 0;
  lab.status = 'moving';
  lab.moveCooldown = 0;
}

function tickDayRepair(state: GameState, dt: number): void {
  for (const lab of state.staff) {
    if (lab.kind !== 'laborer') continue;
    if (isProspectorBusy(state, lab)) continue;
    if (lab.targetWorkplaceId?.startsWith('construction:')) continue;
    const targetId = lab.targetWorkplaceId;
    if (!targetId || targetId.startsWith('mine:') || targetId === 'pump:hand') continue;

    const room = state.tower.rooms.find((r) => r.id === targetId);
    if (!room || room.hp >= (getBlueprintHp(room) ?? room.hp)) continue;
    if (lab.status === 'working') {
      room.hp = Math.min(getBlueprintHp(room) ?? room.hp, room.hp + LABORER_REPAIR_HP_PER_SEC * dt);
    }
  }
}

function getBlueprintHp(room: { blueprintId: string; hp: number }): number | undefined {
  return room.hp; // simplified — repair until max hp stored on room
}

let roomIdCounter = 0;
export function resetConstructionTickCounter(): void {
  roomIdCounter = 0;
}

function nextRoomIdLocal(): string {
  roomIdCounter += 1;
  return `built-${roomIdCounter}`;
}

/** Day-phase labor: construction haul/build, teardown, repair. */
export function tickDayConstruction(state: GameState, dt: number): void {
  spawnDayLaborers(state);
  tickHauling(state);
  stepStaff(state, dt);
  tickConstructionLabor(state, dt, nextRoomIdLocal);
  tickDayRepair(state, dt);
  repathIdleLaborers(state);
}

function spawnDayLaborers(state: GameState): void {
  if (state.staff.length > 0) return;
  for (const room of state.tower.rooms) {
    if (room.blueprintId !== 'quartersRoom') continue;
    const count = state.housingRecruited[room.id] ?? 1;
    for (let i = 0; i < count; i++) {
      state.staff.push({
        id: `laborer-day-${room.id}-${i}`,
        kind: 'laborer',
        homeHousingId: room.id,
        targetWorkplaceId: null,
        pos: { ...room.origin },
        path: [],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'idle',
      });
    }
  }
}

export { STAFF_HORIZONTAL_SPEED, STAFF_STAIR_SPEED };
