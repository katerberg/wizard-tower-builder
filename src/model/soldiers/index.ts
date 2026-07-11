import {
  SOLDIER_HORIZONTAL_SPEED,
  SOLDIER_STAIR_SPEED,
  SOLDIER_UPKEEP_COST,
} from '@/config/constants';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { roomAnchorCell } from '@/calculations/interiorGraph';
import { hasInfraKind } from '@/model/infra';
import { addMessage } from '@/model/messages';
import { roomCells } from '@/calculations/grid';
import { isBarracksRoom, isSlotRoom, slotCapacity } from './capacity';
import type { Cell, GameState, Room, Soldier } from '@/model/types';

let soldierCounter = 0;

export function resetSoldierCounter(): void {
  soldierCounter = 0;
}

function barracksAnchor(state: GameState, room: Room): Cell | null {
  return roomAnchorCell(state.tower, room.origin, room.size);
}

function slotAnchor(state: GameState, room: Room): Cell | null {
  return roomAnchorCell(state.tower, room.origin, room.size);
}

function isInRoomFootprint(room: Room, cell: Cell): boolean {
  return roomCells(room.origin, room.size).some((c) => c.col === cell.col && c.row === cell.row);
}

function stationedInSlot(state: GameState, slot: Room): Soldier[] {
  return state.soldiers.filter(
    (s) => s.targetSlotId === slot.id && s.status === 'stationed' && isInRoomFootprint(slot, s.pos),
  );
}

export function stationedSoldiersInSlot(state: GameState, slotId: string): Soldier[] {
  const slot = state.tower.rooms.find((r) => r.id === slotId && isSlotRoom(r));
  if (!slot) return [];
  return stationedInSlot(state, slot);
}

interface BarracksPool {
  roomId: string;
  anchor: Cell;
  available: number;
}

/** Charge upkeep and spawn soldiers with paths at wave start. */
export function deploySoldiersForWave(state: GameState): void {
  state.soldiers = [];
  state.stairColumnLocks = {};

  const slots = state.tower.rooms.filter((r) => isSlotRoom(r));
  const barracks = state.tower.rooms.filter((r) => isBarracksRoom(r));

  const pools: BarracksPool[] = barracks
    .map((room) => {
      const anchor = barracksAnchor(state, room);
      const available = state.barracksRecruited[room.id] ?? 0;
      return anchor && available > 0 ? { roomId: room.id, anchor, available } : null;
    })
    .filter((p): p is BarracksPool => p !== null);

  const assignments: { slot: Room; anchor: Cell; count: number }[] = [];
  for (const slot of slots) {
    const count = Math.min(state.slotAllocations[slot.id] ?? 0, slotCapacity(slot));
    if (count <= 0) continue;
    const anchor = slotAnchor(state, slot);
    if (!anchor) continue;
    assignments.push({ slot, anchor, count });
  }

  let gold = state.player.currency;
  const toField: { slot: Room; anchor: Cell; barracksId: string; from: Cell }[] = [];

  for (const assignment of assignments) {
    for (let i = 0; i < assignment.count; i++) {
      if (gold < SOLDIER_UPKEEP_COST) {
        addMessage(state, 'Not enough gold for soldier upkeep; some troops stay in barracks.', 'economy');
        break;
      }

      let bestPool: BarracksPool | null = null;
      let bestDist = Infinity;
      for (const pool of pools) {
        if (pool.available <= 0) continue;
        const dist =
          Math.abs(pool.anchor.col - assignment.anchor.col) +
          Math.abs(pool.anchor.row - assignment.anchor.row);
        if (dist < bestDist) {
          bestDist = dist;
          bestPool = pool;
        }
      }
      if (!bestPool) break;

      gold -= SOLDIER_UPKEEP_COST;
      bestPool.available -= 1;
      toField.push({
        slot: assignment.slot,
        anchor: assignment.anchor,
        barracksId: bestPool.roomId,
        from: bestPool.anchor,
      });
    }
  }

  state.player.currency = gold;

  for (const entry of toField) {
    const path = findInteriorPath(state.tower, entry.from, entry.anchor);
    const soldier: Soldier = {
      id: `soldier-${soldierCounter++}`,
      homeBarracksId: entry.barracksId,
      targetSlotId: entry.slot.id,
      pos: { ...entry.from },
      path: path.length > 0 ? path : [entry.from],
      pathIndex: 0,
      moveCooldown: 0,
      status: 'moving',
      stairColumn: null,
    };
    state.soldiers.push(soldier);
  }
}

export function clearSoldiersAfterWave(state: GameState): void {
  state.soldiers = [];
  state.stairColumnLocks = {};
  state.slotAllocations = {};
}

function releaseStairColumn(state: GameState, soldier: Soldier): void {
  if (soldier.stairColumn === null) return;
  if (state.stairColumnLocks[soldier.stairColumn] === soldier.id) {
    delete state.stairColumnLocks[soldier.stairColumn];
  }
  soldier.stairColumn = null;
}

function isVerticalStep(from: Cell, to: Cell): boolean {
  return from.col === to.col && from.row !== to.row;
}

function stairColumnBusy(state: GameState, col: number, exceptId: string): boolean {
  const holder = state.stairColumnLocks[col];
  return holder !== undefined && holder !== exceptId;
}

/** Advance soldier movement during the attack phase. */
export function stepSoldiers(state: GameState, dt: number): void {
  for (const soldier of state.soldiers) {
    if (soldier.status === 'stationed') continue;

    const slot = state.tower.rooms.find((r) => r.id === soldier.targetSlotId);
    if (!slot) continue;

    if (isInRoomFootprint(slot, soldier.pos)) {
      soldier.status = 'stationed';
      releaseStairColumn(state, soldier);
      continue;
    }

    soldier.moveCooldown -= dt;
    if (soldier.moveCooldown > 0) continue;
    if (soldier.pathIndex >= soldier.path.length - 1) continue;

    const next = soldier.path[soldier.pathIndex + 1];
    const vertical = isVerticalStep(soldier.pos, next);

    if (vertical) {
      if (stairColumnBusy(state, soldier.pos.col, soldier.id)) continue;
      if (!hasInfraKind(state.tower, soldier.pos.col, soldier.pos.row, 'stair')) continue;
      state.stairColumnLocks[soldier.pos.col] = soldier.id;
      soldier.stairColumn = soldier.pos.col;
    } else {
      releaseStairColumn(state, soldier);
    }

    soldier.pathIndex += 1;
    soldier.pos = next;

    if (vertical) {
      releaseStairColumn(state, soldier);
    }

    const speed = vertical ? SOLDIER_STAIR_SPEED : SOLDIER_HORIZONTAL_SPEED;
    soldier.moveCooldown = 1 / speed;

    if (isInRoomFootprint(slot, soldier.pos)) {
      soldier.status = 'stationed';
      releaseStairColumn(state, soldier);
    }
  }
}

export function pruneBarracksState(state: GameState, removedRoomId: string): void {
  delete state.barracksRecruited[removedRoomId];
  delete state.slotAllocations[removedRoomId];
}

export function totalRecruitedSoldiers(state: GameState): number {
  return Object.values(state.barracksRecruited).reduce((sum, n) => sum + n, 0);
}

export function totalAllocatedSoldiers(state: GameState): number {
  return Object.values(state.slotAllocations).reduce((sum, n) => sum + n, 0);
}
