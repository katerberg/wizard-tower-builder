import {
  LABORER_UPKEEP_COST, MAGE_UPKEEP_COST, MANA_SPRING_STAFF_CAPACITY,
  RESEARCH_ROOM_STAFF_CAPACITY,
  SOLDIER_UPKEEP_COST, STAFF_HORIZONTAL_SPEED, STAFF_STAIR_SPEED,
} from '@/config/constants';
import { LEYLINE_RESEARCH_STAFF_CAP } from '@/config/spellProgression';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { canSoldierTraverse, roomAnchorCell } from '@/calculations/interiorGraph';
import { planElevatorRide, isElevatorVerticalStep } from '@/model/elevators';
import { findMinePatchByTarget, isMinePatchTarget, isProspectTarget, PROSPECT_TARGET } from '@/model/mines';
import { addMessage } from '@/model/messages';
import { isManaSpringRoom } from '@/model/pipes';
import { isResearchRoom } from '@/model/research';
import { isLeylineResearchRoom } from '@/model/spells/progression';
import { prospectFrontierCell } from '@/model/staff/harvest';
import {
  housingCapacity,
  housingKindOf,
  isQuarters,
  isSlotRoom,
  slotCapacity,
  staffKindForHousing,
} from './capacity';
import { isInFootprint, isInRoomFootprint, repathIdleLaborers } from './combat';
import { departCooldownForIndex } from './depart';
import { groundPumpAnchor, isPumpTarget } from './harvest';
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
  const path = findInteriorPath(state.tower, from, to, state.mine);
  const unit: StaffUnit = {
    id: `staff-${staffCounter++}`,
    kind,
    homeHousingId,
    targetWorkplaceId: workplace.id,
    pos: { ...from },
    path: path.length > 0 ? path : [from],
    pathIndex: 0,
    moveCooldown: departCooldownForIndex(staggerIndex),
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
  const workplaces = state.tower.rooms.filter(
    (r) => isManaSpringRoom(r) || isResearchRoom(r) || isLeylineResearchRoom(r),
  );
  let spawned = 0;

  for (const workplace of workplaces) {
    let cap: number;
    let allocated: number;
    if (isLeylineResearchRoom(workplace)) {
      cap = LEYLINE_RESEARCH_STAFF_CAP;
      allocated = state.leylineResearchAllocations[workplace.id] ?? 0;
    } else if (isResearchRoom(workplace)) {
      cap = RESEARCH_ROOM_STAFF_CAPACITY;
      allocated = state.researchRoomAllocations[workplace.id] ?? 0;
    } else {
      cap = MANA_SPRING_STAFF_CAPACITY;
      allocated = state.manaSpringAllocations[workplace.id] ?? 0;
    }
    const count = Math.min(allocated, cap);
    if (count <= 0) continue;
    const anchor = workplaceAnchor(state, workplace);
    if (!anchor) continue;

    for (let i = 0; i < count; i++) {
      const pool = pickClosestPool(pools, anchor);
      if (!pool) break;
      pool.available -= 1;
      spawnStaff(state, 'mage', pool.roomId, workplace, pool.anchor, anchor, staggerBase + spawned);
      spawned += 1;
    }
  }
  return spawned;
}

/** Spawn all rostered laborers at their housing (idle until assigned). */
function spawnIdleLaborers(state: GameState, staggerBase: number): number {
  let spawned = 0;
  const prospectCount = state.prospectAllocation;
  let prospectRemaining = prospectCount;
  const frontier = prospectFrontierCell(state);

  for (const room of state.tower.rooms) {
    if (!isQuarters(room)) continue;
    const anchor = housingAnchor(state, room);
    if (!anchor) continue;
    const count = state.housingRecruited[room.id] ?? 0;
    for (let i = 0; i < count; i++) {
      const isProspector = prospectRemaining > 0;
      if (isProspector) {
        // Deploy as prospector — path to frontier.
        prospectRemaining -= 1;
        const path = findInteriorPath(state.tower, anchor, frontier, state.mine);
        const unit: StaffUnit = {
          id: `staff-${staffCounter++}`,
          kind: 'laborer',
          homeHousingId: room.id,
          targetWorkplaceId: PROSPECT_TARGET,
          pos: { ...anchor },
          path: path.length > 0 ? path : [anchor],
          pathIndex: 0,
          moveCooldown: departCooldownForIndex(staggerBase + spawned),
          status: path.length <= 1 ? 'working' : 'moving',
        };
        state.staff.push(unit);
        spawned += 1;
      } else {
        // Spawn idle — will be assigned to pump/mine/repair later.
        const unit: StaffUnit = {
          id: `staff-${staffCounter++}`,
          kind: 'laborer',
          homeHousingId: room.id,
          targetWorkplaceId: null,
          pos: { ...anchor },
          path: [anchor],
          pathIndex: 0,
          moveCooldown: departCooldownForIndex(staggerBase + spawned),
          status: 'idle',
        };
        state.staff.push(unit);
        spawned += 1;
      }
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
  // Supply limits: drop recruited counts for units that finished the wave homeless
  // (homeHousingId cleared mid-wave) and clamp to living housing capacity.
  for (const room of state.tower.rooms) {
    const housing = housingKindOf(room);
    if (!housing) continue;
    const cap = housingCapacity(room);
    const recruited = state.housingRecruited[room.id] ?? 0;
    if (recruited > cap) state.housingRecruited[room.id] = cap;
  }
}

/** @deprecated Use clearStaffAfterWave. */
export const clearSoldiersAfterWave = clearStaffAfterWave;

function isVerticalStep(from: Cell, to: Cell): boolean {
  return from.col === to.col && from.row !== to.row;
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
      unit.status === 'waiting_elevator' ||
      unit.status === 'riding_elevator'
    ) {
      continue;
    }

    const targetId = unit.targetWorkplaceId;
    const workplaceRoom = targetId
      ? state.tower.rooms.find((r) => r.id === targetId)
      : undefined;
    const workplaceStructure =
      !workplaceRoom && targetId
        ? (state.tower.structures ?? []).find((s) => s.id === targetId)
        : undefined;
    const pumpJob = isPumpTarget(targetId);
    const prospectJob = isProspectTarget(targetId);
    const minePatch = targetId && isMinePatchTarget(targetId)
      ? findMinePatchByTarget(state.mine, targetId)
      : undefined;
    const isConstructionTarget = targetId?.startsWith('construction:');


    if (!workplaceRoom && !workplaceStructure && !pumpJob && !prospectJob && !minePatch && !isConstructionTarget) {
      unit.status = 'idle';
      unit.targetWorkplaceId = null;
      continue;
    }

    if (unit.status === 'idle' && (!workplaceRoom && !workplaceStructure && !pumpJob && !prospectJob && !minePatch && !isConstructionTarget)) {
      continue;
    }

    const constructionOrder = isConstructionTarget
      ? state.constructionOrders.find((o) => o.id === targetId?.slice('construction:'.length))
      : null;

    if (isConstructionTarget && !constructionOrder) {
      unit.targetWorkplaceId = null;
      unit.status = 'idle';
      continue;
    }

    const goal: Cell = workplaceRoom
      ? (roomAnchorCell(state.tower, workplaceRoom.origin, workplaceRoom.size, state.mine) ??
        workplaceRoom.origin)
      : workplaceStructure
        ? (roomAnchorCell(
          state.tower,
          workplaceStructure.origin,
          workplaceStructure.size,
          state.mine,
        ) ?? workplaceStructure.origin)
        : constructionOrder
          ? constructionOrder.origin
          : pumpJob
            ? groundPumpAnchor(state)
            : prospectJob
              ? prospectFrontierCell(state)
              : minePatch!.cell;

    const inFootprint = workplaceRoom
      ? isInRoomFootprint(workplaceRoom, unit.pos)
      : workplaceStructure
        ? isInFootprint(workplaceStructure.origin, workplaceStructure.size, unit.pos)
        : unit.pos.col === goal.col && unit.pos.row === goal.row;

    if (inFootprint) {
      unit.status = arriveStatus(unit.kind);
      continue;
    }

    unit.moveCooldown -= dt;
    if (unit.moveCooldown > 0) continue;
    if (unit.pathIndex >= unit.path.length - 1) {
      // Haul paths (e.g. storage) end before the construction goal used above.
      if (unit.status === 'moving') unit.status = 'idle';
      continue;
    }

    const next = unit.path[unit.pathIndex + 1];
    const vertical = isVerticalStep(unit.pos, next);

    // Vertical elevator progress requires riding the car — never free-step.
    if (vertical && isElevatorVerticalStep(state.tower, unit.pos, next)) {
      beginElevatorWait(state, unit);
      continue;
    }

    // Staff may overlap in corridors; pacing comes from depart stagger, not cell locks.
    if (!canSoldierTraverse(state.tower, unit.pos, next, state.mine)) {
      continue;
    }

    unit.pathIndex += 1;
    unit.pos = next;

    const speed = vertical ? STAFF_STAIR_SPEED : STAFF_HORIZONTAL_SPEED;
    unit.moveCooldown = 1 / speed;

    const arrived = workplaceRoom
      ? isInRoomFootprint(workplaceRoom, unit.pos)
      : workplaceStructure
        ? isInFootprint(workplaceStructure.origin, workplaceStructure.size, unit.pos)
        : unit.pos.col === goal.col && unit.pos.row === goal.row;
    if (arrived) {
      unit.status = arriveStatus(unit.kind);
    }
  }
}

/** @deprecated Use stepStaff. */
export const stepSoldiers = stepStaff;

