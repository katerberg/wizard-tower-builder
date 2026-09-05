import {
  BUILD_PROGRESS_PER_SEC,
  LABORER_CARRY_CAPACITY,
} from '@/config/construction';
import { RARE_PATCH_FALLOFF } from '@/config/mines';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import {
  cellDistance,
  isSoldierWalkable,
  roomAnchorCell,
} from '@/calculations/interiorGraph';
import { cellKey, inBounds } from '@/calculations/grid';
import {
  STAFF_HORIZONTAL_SPEED,
  STAFF_STAIR_SPEED,
  LABORER_REPAIR_HP_PER_SEC,
} from '@/config/constants';
import { stepStaff } from '../staff/deploy';
import { departCooldownForIndex } from '../staff/depart';
import { repathIdleLaborers } from '../staff/combat';
import { getStorageSite, withdrawFromStorage } from '../storage';
import {
  completeConstructionOrder,
  completeTeardownOrder,
  placeScaffoldForOrder,
} from './orders';
import { orderFootprintCells } from './footprint';
import { liveLegalBuildOrderIds } from './pendingTower';
import type { Cell, ConstructionOrder, GameState, StaffUnit, Stockpile } from '../types';
import { addMessageOnceInRow } from '../messages';

function laborerEfficiency(count: number): number {
  if (count <= 0) return 0;
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.pow(RARE_PATCH_FALLOFF, i);
  return total;
}

/** Walkable cell where laborers stand to drop materials (footprint or adjacent). */
function orderDeliveryCell(state: GameState, order: ConstructionOrder, near?: Cell): Cell {
  const { tower, mine } = state;
  const footprint = orderFootprintCells(order);
  const onFootprint = footprint.filter((c) => isSoldierWalkable(tower, c.col, c.row, mine));

  const candidates: Cell[] = [...onFootprint];
  if (candidates.length === 0) {
    const seen = new Set<string>();
    for (const cell of footprint) {
      const adjacent: Cell[] = [
        { col: cell.col + 1, row: cell.row },
        { col: cell.col - 1, row: cell.row },
        { col: cell.col, row: cell.row + 1 },
        { col: cell.col, row: cell.row - 1 },
      ];
      for (const n of adjacent) {
        if (!inBounds(n.col, n.row)) continue;
        const key = cellKey(n.col, n.row);
        if (seen.has(key)) continue;
        seen.add(key);
        if (isSoldierWalkable(tower, n.col, n.row, mine)) candidates.push(n);
      }
    }
  }

  if (candidates.length === 0) return footprint[0] ?? order.origin;
  if (!near) return candidates[0];
  return candidates.reduce((best, c) => (cellDistance(c, near) < cellDistance(best, near) ? c : best));
}

function storageAnchor(state: GameState, storageRoomId: string): Cell | null {
  const room = state.tower.rooms.find((r) => r.id === storageRoomId);
  if (!room) return null;
  return roomAnchorCell(state.tower, room.origin, room.size);
}

function isProspectorBusy(state: GameState, lab: StaffUnit): boolean {
  if (state.prospectAllocation <= 0) return false;
  const prospectors = state.staff
    .filter((s) => s.kind === 'laborer')
    .slice(0, state.prospectAllocation);
  return prospectors.some((p) => p.id === lab.id);
}

/** Buildable plans only, bottom rows first — upper pieces wait for their support. */
function assignConstructionLaborers(state: GameState, buildable: Set<string>): void {
  const laborers = state.staff.filter((s) => s.kind === 'laborer');
  const orders = [
    ...state.constructionOrders.filter((o) => o.kind === 'teardown'),
    ...state.constructionOrders
      .filter((o) => o.kind === 'build' && o.status !== 'building' && buildable.has(o.id))
      .sort((a, b) => a.origin.row - b.origin.row),
  ];

  let laborerIdx = 0;
  for (const order of orders) {
    while (laborerIdx < laborers.length) {
      const lab = laborers[laborerIdx];
      laborerIdx += 1;
      if (isProspectorBusy(state, lab)) continue;
      if (lab.targetWorkplaceId?.startsWith('construction:')) continue;
      lab.targetWorkplaceId = `construction:${order.id}`;
      addMessageOnceInRow(
        state,
        `Laborer assigned to ${order.blueprintId} (${order.status})`,
        'info',
      );
      break;
    }
    if (laborerIdx >= laborers.length) break;
  }
}

function staffPathComplete(lab: StaffUnit): boolean {
  return lab.path.length === 0 || lab.pathIndex >= lab.path.length - 1;
}

function pathDestination(path: Cell[]): Cell | null {
  if (path.length === 0) return null;
  return path[path.length - 1];
}

function assignPathTo(lab: StaffUnit, state: GameState, dest: Cell, staggerIndex = 0): void {
  const path = findInteriorPath(state.tower, lab.pos, dest, state.mine);
  if (path.length === 0) {
    lab.path = [{ ...lab.pos }];
    lab.pathIndex = 0;
    lab.status = 'idle';
    return;
  }
  lab.path = path;
  lab.pathIndex = 0;
  lab.status = 'moving';
  lab.moveCooldown = departCooldownForIndex(staggerIndex);
}

function assignPathToIfNeeded(
  lab: StaffUnit,
  state: GameState,
  dest: Cell,
  staggerIndex = 0,
): boolean {
  const end = pathDestination(lab.path);
  if (
    lab.status === 'moving' &&
    end?.col === dest.col &&
    end?.row === dest.row &&
    !staffPathComplete(lab)
  ) {
    return false;
  }
  assignPathTo(lab, state, dest, staggerIndex);
  return true;
}

function tickConstructionLabor(
  state: GameState,
  dt: number,
  nextRoomId: () => string,
  buildable: Set<string>,
): void {
  const buildingOrders = state.constructionOrders.filter(
    (o) =>
      o.kind === 'build' &&
      (o.status === 'building' || o.status === 'scaffold') &&
      buildable.has(o.id),
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

function clearStaleConstructionTargets(state: GameState): void {
  for (const lab of state.staff) {
    if (lab.kind !== 'laborer') continue;
    const target = lab.targetWorkplaceId;
    if (!target?.startsWith('construction:')) continue;
    const orderId = target.slice('construction:'.length);
    if (state.constructionOrders.some((o) => o.id === orderId)) continue;
    lab.targetWorkplaceId = null;
    lab.carry = undefined;
    lab.carryOrderId = undefined;
    lab.status = 'idle';
    lab.path = [{ ...lab.pos }];
    lab.pathIndex = 0;
  }
}

function setWorkingAtSite(
  lab: StaffUnit,
  state: GameState,
  order: ConstructionOrder,
  staggerIndex = 0,
): boolean {
  const dropCell = orderDeliveryCell(state, order, lab.pos);
  const atSite = lab.pos.col === dropCell.col && lab.pos.row === dropCell.row;
  if (atSite) {
    lab.status = 'working';
    return false;
  }
  return assignPathToIfNeeded(lab, state, dropCell, staggerIndex);
}

function tickHauling(state: GameState, buildable: Set<string>): void {
  let departIdx = 0;
  for (const lab of state.staff) {
    if (lab.kind !== 'laborer') continue;
    const target = lab.targetWorkplaceId;
    if (!target?.startsWith('construction:')) continue;

    const orderId = target.slice('construction:'.length);
    const order = state.constructionOrders.find((o) => o.id === orderId);
    if (order?.kind !== 'build') continue;
    if (!buildable.has(order.id)) continue;

    if (order.status === 'planned' || order.status === 'delivering') {
      departIdx += tickHaulLaborer(state, lab, order, departIdx);
    } else if (order.status === 'scaffold' && order.deliverRemaining.stone === 0 && order.deliverRemaining.metal === 0) {
      order.status = 'building';
      if (setWorkingAtSite(lab, state, order, departIdx)) departIdx += 1;
    } else if (order.status === 'scaffold' || order.status === 'building') {
      if (setWorkingAtSite(lab, state, order, departIdx)) departIdx += 1;
    }
  }
}

/** Returns how many new path assigns this laborer consumed (0 or 1). */
function tickHaulLaborer(
  state: GameState,
  lab: StaffUnit,
  order: ConstructionOrder,
  staggerIndex: number,
): number {
  const reservation = state.storageReservations.find((r) => r.orderId === order.id);
  const dropCell = orderDeliveryCell(state, order, lab.pos);

  const carry = lab.carry;
  if (carry && (carry.stone > 0 || carry.metal > 0)) {
    if (staffPathComplete(lab) && lab.status !== 'moving') {
      const atDrop = lab.pos.col === dropCell.col && lab.pos.row === dropCell.row;
      if (atDrop) {
        order.onSiteMaterials.stone += carry.stone;
        order.onSiteMaterials.metal += carry.metal;
        order.deliverRemaining.stone = Math.max(0, order.deliverRemaining.stone - carry.stone);
        order.deliverRemaining.metal = Math.max(0, order.deliverRemaining.metal - carry.metal);
        lab.carry = { stone: 0, metal: 0 };
        lab.carryOrderId = undefined;
        if (order.deliverRemaining.stone === 0 && order.deliverRemaining.metal === 0) {
          placeScaffoldForOrder(state, order);
          order.status = 'building';
          return setWorkingAtSite(lab, state, order, staggerIndex) ? 1 : 0;
        }
        lab.status = 'idle';
      } else if (assignPathToIfNeeded(lab, state, dropCell, staggerIndex)) {
        return 1;
      }
    }
    return 0;
  }

  if (order.deliverRemaining.stone <= 0 && order.deliverRemaining.metal <= 0) {
    placeScaffoldForOrder(state, order);
    order.status = 'building';
    return setWorkingAtSite(lab, state, order, staggerIndex) ? 1 : 0;
  }

  const storageId = reservation?.storageRoomId ?? lab.carryFromStorageId;
  if (!storageId) return 0;
  const anchor = storageAnchor(state, storageId);
  if (!anchor) return 0;

  const atStorage = lab.pos.col === anchor.col && lab.pos.row === anchor.row;
  if (atStorage && lab.status !== 'moving') {
    const site = getStorageSite(state, storageId);
    if (!site) return 0;
    let cap = LABORER_CARRY_CAPACITY;
    const carry: Stockpile = { stone: 0, metal: 0 };
    const stoneTake = Math.min(order.deliverRemaining.stone, site.stockpile.stone, cap);
    carry.stone = stoneTake;
    cap -= stoneTake;
    carry.metal = Math.min(order.deliverRemaining.metal, site.stockpile.metal, cap);
    if (carry.stone === 0 && carry.metal === 0) return 0;
    withdrawFromStorage(site, carry);
    addMessageOnceInRow(state, `Laborer carrying ${carry.stone} stone, ${carry.metal} metal to site`, 'info');
    lab.carry = carry;
    lab.carryFromStorageId = storageId;
    lab.carryOrderId = order.id;
    order.status = 'delivering';
    return assignPathToIfNeeded(lab, state, dropCell, staggerIndex) ? 1 : 0;
  }
  if (!atStorage) {
    return assignPathToIfNeeded(lab, state, anchor, staggerIndex) ? 1 : 0;
  }
  return 0;
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
  return room.hp;
}

let roomIdCounter = 0;
let dayLaborerCounter = 0;

export function resetConstructionTickCounter(): void {
  roomIdCounter = 0;
  dayLaborerCounter = 0;
}

function nextRoomIdLocal(): string {
  roomIdCounter += 1;
  return `built-${roomIdCounter}`;
}

/** Keep day roster aligned with housingRecruited (recruits during day appear immediately). */
function syncDayLaborers(state: GameState): void {
  for (const room of state.tower.rooms) {
    if (room.blueprintId !== 'quartersRoom') continue;
    const want = state.housingRecruited[room.id] ?? 0;
    const anchor = roomAnchorCell(state.tower, room.origin, room.size);
    if (!anchor) continue;

    let housed = state.staff.filter((s) => s.kind === 'laborer' && s.homeHousingId === room.id);

    while (housed.length < want) {
      const unit: StaffUnit = {
        id: `laborer-day-${dayLaborerCounter++}`,
        kind: 'laborer',
        homeHousingId: room.id,
        targetWorkplaceId: null,
        pos: { ...anchor },
        path: [],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'idle',
      };
      state.staff.push(unit);
      housed = state.staff.filter((s) => s.kind === 'laborer' && s.homeHousingId === room.id);
    }

    while (housed.length > want) {
      const removable = state.staff.find(
        (s) =>
          s.kind === 'laborer' &&
          s.homeHousingId === room.id &&
          s.status === 'idle' &&
          !s.carry &&
          !s.targetWorkplaceId?.startsWith('construction:'),
      );
      if (!removable) break;
      state.staff = state.staff.filter((s) => s.id !== removable.id);
      housed = state.staff.filter((s) => s.kind === 'laborer' && s.homeHousingId === room.id);
    }
  }
}

/** Day-phase labor: construction haul/build, teardown, repair. */
export function tickDayConstruction(state: GameState, dt: number): void {
  syncDayLaborers(state);
  clearStaleConstructionTargets(state);
  const buildable = liveLegalBuildOrderIds(state);
  assignConstructionLaborers(state, buildable);
  tickHauling(state, buildable);
  stepStaff(state, dt);
  tickConstructionLabor(state, dt, nextRoomIdLocal, buildable);
  tickDayRepair(state, dt);
  repathIdleLaborers(state);
}

export { STAFF_HORIZONTAL_SPEED, STAFF_STAIR_SPEED };
