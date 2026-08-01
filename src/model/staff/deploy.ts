import {
  LABORER_UPKEEP_COST, MAGE_UPKEEP_COST, MANA_SPRING_STAFF_CAPACITY,
  SOLDIER_UPKEEP_COST, STAFF_HORIZONTAL_SPEED, STAFF_STAIR_SPEED,
} from '@/config/constants';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { roomAnchorCell } from '@/calculations/interiorGraph';
import { planElevatorRide, isElevatorVerticalStep } from '@/model/elevators';
import { hasInfraKind } from '@/model/infra';
import { addMessage } from '@/model/messages';
import { isManaSpringRoom } from '@/model/pipes';
import {
  housingKindOf,
  isQuarters,
  isSlotRoom,
  slotCapacity,
  staffKindForHousing,
} from './capacity';
import { isInFootprint, isInRoomFootprint, repathIdleLaborers } from './combat';
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


interface HousingPool {
  roomId: string;
  anchor: Cell;
  available: number;
  kind: StaffKind;
}

/** Charge upkeep for every rostered occupant; unpaid staff desert. */
function chargeHousingUpkeep(state: GameState): void {
  let gold = state.player.resources.gold;
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
  state.player.resources.gold = gold;
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

    const workplaceRoom = unit.targetWorkplaceId
      ? state.tower.rooms.find((r) => r.id === unit.targetWorkplaceId)
      : undefined;
    const workplaceStructure =
      !workplaceRoom && unit.targetWorkplaceId
        ? (state.tower.structures ?? []).find((s) => s.id === unit.targetWorkplaceId)
        : undefined;

    if (!workplaceRoom && !workplaceStructure) {
      unit.status = 'idle';
      unit.targetWorkplaceId = null;
      continue;
    }

    const inFootprint = workplaceRoom
      ? isInRoomFootprint(workplaceRoom, unit.pos)
      : isInFootprint(workplaceStructure!.origin, workplaceStructure!.size, unit.pos);
    if (inFootprint) {
      unit.status = arriveStatus(unit.kind);
      continue;
    }

    unit.moveCooldown -= dt;
    if (unit.moveCooldown > 0) continue;
    if (unit.pathIndex >= unit.path.length - 1) continue;

    const next = unit.path[unit.pathIndex + 1];
    const vertical = isVerticalStep(unit.pos, next);
    const enteringWorkplace = workplaceRoom
      ? isInRoomFootprint(workplaceRoom, next)
      : isInFootprint(workplaceStructure!.origin, workplaceStructure!.size, next);

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

    const arrived = workplaceRoom
      ? isInRoomFootprint(workplaceRoom, unit.pos)
      : isInFootprint(workplaceStructure!.origin, workplaceStructure!.size, unit.pos);
    if (arrived) {
      unit.status = arriveStatus(unit.kind);
    }
  }
}

/** @deprecated Use stepStaff. */
export const stepSoldiers = stepStaff;

