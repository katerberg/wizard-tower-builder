import {
  LABORER_REPAIR_HP_PER_SEC,
  LABORER_UPKEEP_COST,
  MAGE_UPKEEP_COST,
  MANA_SPRING_STAFF_CAPACITY,
  SOLDIER_UPKEEP_COST,
  STAFF_HORIZONTAL_SPEED,
  STAFF_STAIR_SPEED,
} from '@/config/constants';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { roomAnchorCell } from '@/calculations/interiorGraph';
import { roomCells } from '@/calculations/grid';
import { computeRoomStats } from '@/calculations/combat';
import { getBlueprint } from '@/model/blueprints';
import { planElevatorRide, isElevatorVerticalStep } from '@/model/elevators';
import { hasInfraKind } from '@/model/infra';
import { addMessage } from '@/model/messages';
import { isManaSpringRoom } from '@/model/pipes';
import {
  HOUSING_MIN_RECRUITED,
  housingKindOf,
  isHousingRoom,
  isQuarters,
  isSlotRoom,
  slotCapacity,
  staffKindForHousing,
} from './capacity';
import type { Cell, GameState, Room, StaffKind, StaffUnit } from '@/model/types';

let staffCounter = 0;

export function resetStaffCounter(): void {
  staffCounter = 0;
}

/** @deprecated Use resetStaffCounter. */
export const resetSoldierCounter = resetStaffCounter;

function upkeepCost(kind: StaffKind): number {
  switch (kind) {
    case 'soldier':
      return SOLDIER_UPKEEP_COST;
    case 'mage':
      return MAGE_UPKEEP_COST;
    case 'laborer':
      return LABORER_UPKEEP_COST;
  }
}

function desertLabel(kind: StaffKind): string {
  switch (kind) {
    case 'soldier':
      return 'A soldier';
    case 'mage':
      return 'A mage';
    case 'laborer':
      return 'A laborer';
  }
}

function housingAnchor(state: GameState, room: Room): Cell | null {
  return roomAnchorCell(state.tower, room.origin, room.size);
}

function workplaceAnchor(state: GameState, room: Room): Cell | null {
  return roomAnchorCell(state.tower, room.origin, room.size);
}

function isInRoomFootprint(room: Room, cell: Cell): boolean {
  return roomCells(room.origin, room.size).some((c) => c.col === cell.col && c.row === cell.row);
}

export function stationedStaffInRoom(
  state: GameState,
  roomId: string,
  kind?: StaffKind,
): StaffUnit[] {
  const room = state.tower.rooms.find((r) => r.id === roomId);
  if (!room) return [];
  return state.staff.filter(
    (s) =>
      s.targetWorkplaceId === roomId &&
      (s.status === 'stationed' || s.status === 'working') &&
      isInRoomFootprint(room, s.pos) &&
      (kind === undefined || s.kind === kind),
  );
}

export function stationedSoldiersInSlot(state: GameState, slotId: string): StaffUnit[] {
  return stationedStaffInRoom(state, slotId, 'soldier');
}

export function stationedMagiInSpring(state: GameState, springId: string): StaffUnit[] {
  return stationedStaffInRoom(state, springId, 'mage');
}

interface HousingPool {
  roomId: string;
  anchor: Cell;
  available: number;
  kind: StaffKind;
}

/** Charge upkeep for every rostered occupant; unpaid staff desert. */
function chargeHousingUpkeep(state: GameState): void {
  let gold = state.player.currency;
  for (const room of state.tower.rooms) {
    const housing = housingKindOf(room);
    if (!housing) continue;
    const kind = staffKindForHousing(housing);
    const cost = upkeepCost(kind);
    const recruited = state.housingRecruited[room.id] ?? 0;
    let paid = 0;
    for (let i = 0; i < recruited; i++) {
      if (gold < cost) {
        const deserted = recruited - paid;
        state.housingRecruited[room.id] = paid;
        for (let d = 0; d < deserted; d++) {
          addMessage(state, `${desertLabel(kind)} deserted — could not pay upkeep.`, 'economy');
        }
        break;
      }
      gold -= cost;
      paid += 1;
    }
    if (paid === recruited) {
      state.housingRecruited[room.id] = paid;
    }
  }
  state.player.currency = gold;
}

function buildPools(state: GameState, kind: StaffKind): HousingPool[] {
  return state.tower.rooms
    .filter((room) => {
      const housing = housingKindOf(room);
      return housing !== null && staffKindForHousing(housing) === kind;
    })
    .map((room) => {
      const anchor = housingAnchor(state, room);
      const available = state.housingRecruited[room.id] ?? 0;
      return anchor && available > 0
        ? { roomId: room.id, anchor, available, kind }
        : null;
    })
    .filter((p): p is HousingPool => p !== null);
}

function pickClosestPool(pools: HousingPool[], target: Cell): HousingPool | null {
  let best: HousingPool | null = null;
  let bestDist = Infinity;
  for (const pool of pools) {
    if (pool.available <= 0) continue;
    const dist = Math.abs(pool.anchor.col - target.col) + Math.abs(pool.anchor.row - target.row);
    if (dist < bestDist) {
      bestDist = dist;
      best = pool;
    }
  }
  return best;
}

function spawnStaff(
  state: GameState,
  kind: StaffKind,
  homeHousingId: string,
  workplace: Room,
  from: Cell,
  to: Cell,
  staggerIndex: number,
  statusOnArrive: 'stationed' | 'working' = 'stationed',
): void {
  const path = findInteriorPath(state.tower, from, to);
  const unit: StaffUnit = {
    id: `staff-${staffCounter++}`,
    kind,
    homeHousingId,
    targetWorkplaceId: workplace.id,
    pos: { ...from },
    path: path.length > 0 ? path : [from],
    pathIndex: 0,
    moveCooldown: staggerIndex * 0.12,
    status: path.length <= 1 && isInRoomFootprint(workplace, from) ? statusOnArrive : 'moving',
  };
  state.staff.push(unit);
}

function deploySoldiers(state: GameState, staggerBase: number): number {
  const pools = buildPools(state, 'soldier');
  const slots = state.tower.rooms.filter((r) => isSlotRoom(r));
  let spawned = 0;

  for (const slot of slots) {
    const count = Math.min(state.slotAllocations[slot.id] ?? 0, slotCapacity(slot));
    if (count <= 0) continue;
    const anchor = workplaceAnchor(state, slot);
    if (!anchor) continue;

    for (let i = 0; i < count; i++) {
      const pool = pickClosestPool(pools, anchor);
      if (!pool) break;
      pool.available -= 1;
      spawnStaff(state, 'soldier', pool.roomId, slot, pool.anchor, anchor, staggerBase + spawned);
      spawned += 1;
    }
  }
  return spawned;
}

function deployMagi(state: GameState, staggerBase: number): number {
  const pools = buildPools(state, 'mage');
  const springs = state.tower.rooms.filter((r) => isManaSpringRoom(r));
  let spawned = 0;

  for (const spring of springs) {
    const count = Math.min(
      state.manaSpringAllocations[spring.id] ?? 0,
      MANA_SPRING_STAFF_CAPACITY,
    );
    if (count <= 0) continue;
    const anchor = workplaceAnchor(state, spring);
    if (!anchor) continue;

    for (let i = 0; i < count; i++) {
      const pool = pickClosestPool(pools, anchor);
      if (!pool) break;
      pool.available -= 1;
      spawnStaff(state, 'mage', pool.roomId, spring, pool.anchor, anchor, staggerBase + spawned);
      spawned += 1;
    }
  }
  return spawned;
}

function roomMaxHp(room: Room): number {
  const bp = getBlueprint(room.blueprintId);
  return bp ? computeRoomStats(room, bp).maxHp : room.hp;
}

function isDamaged(room: Room): boolean {
  return room.hp < roomMaxHp(room);
}

function laborerRepairMultiplier(index: number): number {
  return Math.pow(0.5, index);
}

/** Spawn all rostered laborers at their housing (idle until assigned). */
function spawnIdleLaborers(state: GameState, staggerBase: number): number {
  let spawned = 0;
  for (const room of state.tower.rooms) {
    if (!isQuarters(room)) continue;
    const anchor = housingAnchor(state, room);
    if (!anchor) continue;
    const count = state.housingRecruited[room.id] ?? 0;
    for (let i = 0; i < count; i++) {
      const unit: StaffUnit = {
        id: `staff-${staffCounter++}`,
        kind: 'laborer',
        homeHousingId: room.id,
        targetWorkplaceId: null,
        pos: { ...anchor },
        path: [anchor],
        pathIndex: 0,
        moveCooldown: (staggerBase + spawned) * 0.12,
        status: 'idle',
      };
      state.staff.push(unit);
      spawned += 1;
    }
  }
  return spawned;
}

/** Charge upkeep, then spawn soldiers/magi/laborers for the wave. */
export function deployStaffForWave(state: GameState): void {
  state.staff = [];
  chargeHousingUpkeep(state);

  let stagger = 0;
  stagger += deploySoldiers(state, stagger);
  stagger += deployMagi(state, stagger);
  spawnIdleLaborers(state, stagger);
  repathIdleLaborers(state);
}

/** @deprecated Use deployStaffForWave. */
export const deploySoldiersForWave = deployStaffForWave;

export function clearStaffAfterWave(state: GameState): void {
  state.staff = [];
}

/** @deprecated Use clearStaffAfterWave. */
export const clearSoldiersAfterWave = clearStaffAfterWave;

export function pruneOrphanStaffState(state: GameState): void {
  const ids = new Set(state.tower.rooms.map((r) => r.id));
  for (const id of Object.keys(state.housingRecruited)) {
    if (!ids.has(id)) delete state.housingRecruited[id];
  }
  for (const id of Object.keys(state.slotAllocations)) {
    if (!ids.has(id)) delete state.slotAllocations[id];
  }
  for (const id of Object.keys(state.manaSpringAllocations)) {
    if (!ids.has(id)) delete state.manaSpringAllocations[id];
  }
}

/** @deprecated Use pruneOrphanStaffState. */
export const pruneOrphanSoldierState = pruneOrphanStaffState;

/** New housing starts with 1 recruit; slots/springs seed allocation 1. */
export function seedSpecialtyRoomDefaults(state: GameState, room: Room): void {
  if (isHousingRoom(room)) {
    if ((state.housingRecruited[room.id] ?? 0) < HOUSING_MIN_RECRUITED) {
      state.housingRecruited[room.id] = HOUSING_MIN_RECRUITED;
    }
  }
  if (isSlotRoom(room)) {
    if ((state.slotAllocations[room.id] ?? 0) < 1) {
      state.slotAllocations[room.id] = 1;
    }
  }
  if (isManaSpringRoom(room)) {
    if ((state.manaSpringAllocations[room.id] ?? 0) < 1) {
      state.manaSpringAllocations[room.id] = 1;
    }
  }
}

export function pruneHousingState(state: GameState, removedRoomId: string): void {
  delete state.housingRecruited[removedRoomId];
  delete state.slotAllocations[removedRoomId];
  delete state.manaSpringAllocations[removedRoomId];
}

/** @deprecated Use pruneHousingState. */
export const pruneBarracksState = pruneHousingState;

export function totalRecruitedStaff(state: GameState, kind?: StaffKind): number {
  let total = 0;
  for (const room of state.tower.rooms) {
    const housing = housingKindOf(room);
    if (!housing) continue;
    if (kind && staffKindForHousing(housing) !== kind) continue;
    total += state.housingRecruited[room.id] ?? 0;
  }
  return total;
}

/** @deprecated Use totalRecruitedStaff. */
export function totalRecruitedSoldiers(state: GameState): number {
  return totalRecruitedStaff(state, 'soldier');
}

export function totalAllocatedSoldiers(state: GameState): number {
  return Object.values(state.slotAllocations).reduce((sum, n) => sum + n, 0);
}

export function totalAllocatedMagi(state: GameState): number {
  return Object.values(state.manaSpringAllocations).reduce((sum, n) => sum + n, 0);
}

function isVerticalStep(from: Cell, to: Cell): boolean {
  return from.col === to.col && from.row !== to.row;
}

function isCellOccupiedByOtherStaff(state: GameState, cell: Cell, exceptId: string): boolean {
  // Elevator landings allow stacking; waiters/riders never block cell locks.
  if (hasInfraKind(state.tower, cell.col, cell.row, 'elevator')) return false;
  return state.staff.some(
    (s) =>
      s.id !== exceptId &&
      s.pos.col === cell.col &&
      s.pos.row === cell.row &&
      s.status !== 'waiting_elevator' &&
      s.status !== 'riding_elevator',
  );
}

function arriveStatus(kind: StaffKind): 'stationed' | 'working' {
  return kind === 'laborer' ? 'working' : 'stationed';
}

function beginElevatorWait(state: GameState, unit: StaffUnit): boolean {
  const ride = planElevatorRide(state.tower, unit.path, unit.pathIndex);
  if (!ride) return false;
  unit.status = 'waiting_elevator';
  unit.elevatorShaftId = ride.shaftId;
  unit.elevatorExitRow = ride.exitRow;
  unit.elevatorExitPathIndex = ride.exitPathIndex;
  unit.elevatorWaitElapsed = 0;
  unit.moveCooldown = 0;
  return true;
}

/** Advance staff movement during the attack phase. */
export function stepStaff(state: GameState, dt: number): void {
  for (const unit of state.staff) {
    if (
      unit.status === 'stationed' ||
      unit.status === 'working' ||
      unit.status === 'idle' ||
      unit.status === 'waiting_elevator' ||
      unit.status === 'riding_elevator'
    ) {
      continue;
    }

    const workplace = unit.targetWorkplaceId
      ? state.tower.rooms.find((r) => r.id === unit.targetWorkplaceId)
      : undefined;
    if (!workplace) {
      unit.status = 'idle';
      unit.targetWorkplaceId = null;
      continue;
    }

    if (isInRoomFootprint(workplace, unit.pos)) {
      unit.status = arriveStatus(unit.kind);
      continue;
    }

    unit.moveCooldown -= dt;
    if (unit.moveCooldown > 0) continue;
    if (unit.pathIndex >= unit.path.length - 1) continue;

    const next = unit.path[unit.pathIndex + 1];
    const vertical = isVerticalStep(unit.pos, next);
    const enteringWorkplace = isInRoomFootprint(workplace, next);

    // Vertical elevator progress requires riding the car — never free-step.
    if (vertical && isElevatorVerticalStep(state.tower, unit.pos, next)) {
      beginElevatorWait(state, unit);
      continue;
    }

    // One staffer per cell en route; destination workplaces may hold several.
    if (!enteringWorkplace && isCellOccupiedByOtherStaff(state, next, unit.id)) {
      continue;
    }

    if (vertical) {
      const lowerRow = Math.min(unit.pos.row, next.row);
      if (!hasInfraKind(state.tower, next.col, lowerRow, 'stair')) continue;
    }

    unit.pathIndex += 1;
    unit.pos = next;

    const speed = vertical ? STAFF_STAIR_SPEED : STAFF_HORIZONTAL_SPEED;
    unit.moveCooldown = 1 / speed;

    if (isInRoomFootprint(workplace, unit.pos)) {
      unit.status = arriveStatus(unit.kind);
    }
  }
}

/** @deprecated Use stepStaff. */
export const stepSoldiers = stepStaff;

/** Repair damaged rooms with stationed laborers; retarget when jobs end. */
export function tickLaborerRepairs(state: GameState, dt: number): void {
  const byRoom = new Map<string, StaffUnit[]>();
  for (const unit of state.staff) {
    if (unit.kind !== 'laborer' || unit.status !== 'working' || !unit.targetWorkplaceId) continue;
    const room = state.tower.rooms.find((r) => r.id === unit.targetWorkplaceId);
    if (!room || !isInRoomFootprint(room, unit.pos)) continue;
    const list = byRoom.get(room.id) ?? [];
    list.push(unit);
    byRoom.set(room.id, list);
  }

  for (const [roomId, laborers] of byRoom) {
    const room = state.tower.rooms.find((r) => r.id === roomId);
    if (!room) continue;
    const maxHp = roomMaxHp(room);
    if (room.hp >= maxHp) continue;

    let rate = 0;
    for (let i = 0; i < laborers.length; i++) {
      rate += LABORER_REPAIR_HP_PER_SEC * laborerRepairMultiplier(i);
    }
    room.hp = Math.min(maxHp, room.hp + rate * dt);
  }

  // Retarget laborers whose job is done or room gone; assign idle ones.
  for (const unit of state.staff) {
    if (unit.kind !== 'laborer') continue;
    if (
      unit.status === 'moving' ||
      unit.status === 'waiting_elevator' ||
      unit.status === 'riding_elevator'
    ) {
      continue;
    }
    const room = unit.targetWorkplaceId
      ? state.tower.rooms.find((r) => r.id === unit.targetWorkplaceId)
      : undefined;
    if (!room || !isDamaged(room)) {
      unit.targetWorkplaceId = null;
      unit.status = 'idle';
      unit.path = [unit.pos];
      unit.pathIndex = 0;
    }
  }

  const idleCount = state.staff.filter((s) => s.kind === 'laborer' && s.status === 'idle').length;
  if (idleCount > 0) {
    repathIdleLaborers(state);
  }
}

function repathIdleLaborers(state: GameState): void {
  const idle = state.staff.filter((s) => s.kind === 'laborer' && s.status === 'idle');
  if (idle.length === 0) return;

  const damaged = state.tower.rooms
    .filter((r) => isDamaged(r) && workplaceAnchor(state, r))
    .map((room) => {
      const anchor = workplaceAnchor(state, room)!;
      const maxHp = roomMaxHp(room);
      const hpPct = maxHp > 0 ? room.hp / maxHp : 1;
      const assigned = state.staff.filter(
        (s) => s.kind === 'laborer' && s.targetWorkplaceId === room.id,
      ).length;
      return { room, anchor, hpPct, assigned };
    });

  if (damaged.length === 0) return;

  for (const unit of idle) {
    const unstaffed = damaged.filter((d) => d.assigned === 0);
    const candidates = unstaffed.length > 0 ? unstaffed : damaged;
    candidates.sort((a, b) => {
      if (a.hpPct !== b.hpPct) return a.hpPct - b.hpPct;
      const da =
        Math.abs(a.anchor.col - unit.pos.col) + Math.abs(a.anchor.row - unit.pos.row);
      const db =
        Math.abs(b.anchor.col - unit.pos.col) + Math.abs(b.anchor.row - unit.pos.row);
      return da - db;
    });
    const target = candidates[0];
    if (!target) break;
    const path = findInteriorPath(state.tower, unit.pos, target.anchor);
    unit.targetWorkplaceId = target.room.id;
    unit.path = path.length > 0 ? path : [unit.pos];
    unit.pathIndex = 0;
    unit.status =
      path.length <= 1 && isInRoomFootprint(target.room, unit.pos) ? 'working' : 'moving';
    target.assigned += 1;
  }
}

export {
  housingCapacity,
  housingKindOf,
  isChamber,
  isGuardroom,
  isHousingRoom,
  isQuarters,
  isSlotRoom,
  slotCapacity,
  canRecruitInHousing,
  HOUSING_MIN_RECRUITED,
  staffKindForHousing,
  isBarracksRoom,
  barracksCapacity,
  canRecruitInBarracks,
} from './capacity';
