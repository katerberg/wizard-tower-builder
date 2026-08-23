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
import { repathIdleLaborers } from '../staff/combat';
import { getStorageSite, withdrawFromStorage } from '../storage';
import {
  completeConstructionOrder,
  completeTeardownOrder,
  orderFootprintCells,
  placeScaffoldForOrder,
} from './orders';
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

function assignConstructionLaborers(state: GameState): void {
  const laborers = state.staff.filter((s) => s.kind === 'laborer');
  const orders = [
    ...state.constructionOrders.filter((o) => o.kind === 'teardown'),
    ...state.constructionOrders.filter((o) => o.kind === 'build' && o.status !== 'building'),
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

function assignPathTo(lab: StaffUnit, state: GameState, dest: Cell): void {
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
  lab.moveCooldown = 0;
}

function assignPathToIfNeeded(lab: StaffUnit, state: GameState, dest: Cell): void {
  const end = pathDestination(lab.path);
  if (
    lab.status === 'moving' &&
    end?.col === dest.col &&
    end?.row === dest.row &&
    !staffPathComplete(lab)
  ) {
    return;
  }
  assignPathTo(lab, state, dest);
}

function tickConstructionLabor(state: GameState, dt: number, nextRoomId: () => string): void {
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
    const pct = Math.round(order.buildProgress * 100);
    addMessageOnceInRow(state, `${order.blueprintId} build progress: ${pct}%`, 'info');
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
          lab.status = 'working';
        } else {
          lab.status = 'idle';
        }
      } else {
        assignPathToIfNeeded(lab, state, dropCell);
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
    let cap = LABORER_CARRY_CAPACITY;
    const carry: Stockpile = { stone: 0, metal: 0 };
    const stoneTake = Math.min(order.deliverRemaining.stone, site.stockpile.stone, cap);
    carry.stone = stoneTake;
    cap -= stoneTake;
    carry.metal = Math.min(order.deliverRemaining.metal, site.stockpile.metal, cap);
    if (carry.stone === 0 && carry.metal === 0) return;
    withdrawFromStorage(site, carry);
    addMessageOnceInRow(state, `Laborer carrying ${carry.stone} stone, ${carry.metal} metal to site`, 'info');
    lab.carry = carry;
    lab.carryFromStorageId = storageId;
    lab.carryOrderId = order.id;
    order.status = 'delivering';
    assignPathToIfNeeded(lab, state, dropCell);
  } else if (!atStorage) {
    assignPathToIfNeeded(lab, state, anchor);
  }
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
  assignConstructionLaborers(state);
  tickHauling(state);
  stepStaff(state, dt);
  tickConstructionLabor(state, dt, nextRoomIdLocal);
  tickDayRepair(state, dt);
  repathIdleLaborers(state);
}

export { STAFF_HORIZONTAL_SPEED, STAFF_STAIR_SPEED };
