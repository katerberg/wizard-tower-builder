import { LABORER_REPAIR_HP_PER_SEC } from '@/config/constants';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { roomAnchorCell } from '@/calculations/interiorGraph';
import { roomCells } from '@/calculations/grid';
import { computeRoomStats, computeStructureStats } from '@/calculations/combat';
import { getBlueprint } from '@/model/blueprints';
import { isMinePatchTarget, isProspectTarget } from '@/model/mines';
import { roomAt } from '@/model/tower';
import { assignSurplusLaborers, isPumpTarget } from './harvest';
import type { Cell, GameState, Room, StaffKind, StaffUnit, Structure } from '@/model/types';

function workplaceAnchor(state: GameState, room: Room): Cell | null {
  return roomAnchorCell(state.tower, room.origin, room.size);
}

export function isInFootprint(
  origin: Cell,
  size: { w: number; h: number },
  cell: Cell,
): boolean {
  return roomCells(origin, size).some((c) => c.col === cell.col && c.row === cell.row);
}

export function isInRoomFootprint(room: Room, cell: Cell): boolean {
  return isInFootprint(room.origin, room.size, cell);
}

type RepairTarget =
  | { kind: 'room'; room: Room; anchor: Cell; hpPct: number; assigned: number }
  | { kind: 'structure'; structure: Structure; anchor: Cell; hpPct: number; assigned: number };

function repairTargetId(target: RepairTarget): string {
  return target.kind === 'room' ? target.room.id : target.structure.id;
}

function isInRepairFootprint(target: RepairTarget, cell: Cell): boolean {
  if (target.kind === 'room') return isInRoomFootprint(target.room, cell);
  return isInFootprint(target.structure.origin, target.structure.size, cell);
}

function findRepairTarget(state: GameState, id: string): RepairTarget | null {
  const room = state.tower.rooms.find((r) => r.id === id);
  if (room) {
    const anchor = workplaceAnchor(state, room);
    if (!anchor) return null;
    const maxHp = roomMaxHp(room);
    return {
      kind: 'room',
      room,
      anchor,
      hpPct: maxHp > 0 ? room.hp / maxHp : 1,
      assigned: 0,
    };
  }
  const structure = (state.tower.structures ?? []).find((s) => s.id === id);
  if (structure) {
    const anchor = roomAnchorCell(state.tower, structure.origin, structure.size);
    if (!anchor) return null;
    const maxHp = structureMaxHp(structure);
    return {
      kind: 'structure',
      structure,
      anchor,
      hpPct: maxHp > 0 ? structure.hp / maxHp : 1,
      assigned: 0,
    };
  }
  return null;
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

export function stationedMagiInRoom(state: GameState, roomId: string): StaffUnit[] {
  return stationedStaffInRoom(state, roomId, 'mage');
}

function roomMaxHp(room: Room): number {
  const bp = getBlueprint(room.blueprintId);
  return bp ? computeRoomStats(room, bp).maxHp : room.hp;
}

function structureMaxHp(structure: Structure): number {
  const bp = getBlueprint(structure.blueprintId);
  return bp ? computeStructureStats(structure, bp).maxHp : structure.hp;
}

function isDamagedRoom(room: Room): boolean {
  return room.hp < roomMaxHp(room);
}

function isDamagedStructure(structure: Structure): boolean {
  return structure.hp < structureMaxHp(structure);
}

function laborerRepairMultiplier(index: number): number {
  return Math.pow(0.5, index);
}

/** Repair damaged rooms/structures with stationed laborers; retarget when jobs end. */
export function tickLaborerRepairs(state: GameState, dt: number): void {
  const byTarget = new Map<string, StaffUnit[]>();
  for (const unit of state.staff) {
    if (unit.kind !== 'laborer' || unit.status !== 'working' || !unit.targetWorkplaceId) continue;
    const target = findRepairTarget(state, unit.targetWorkplaceId);
    if (!target || !isInRepairFootprint(target, unit.pos)) continue;
    const list = byTarget.get(repairTargetId(target)) ?? [];
    list.push(unit);
    byTarget.set(repairTargetId(target), list);
  }

  for (const [targetId, laborers] of byTarget) {
    const target = findRepairTarget(state, targetId);
    if (!target) continue;

    let rate = 0;
    for (let i = 0; i < laborers.length; i++) {
      rate += LABORER_REPAIR_HP_PER_SEC * laborerRepairMultiplier(i);
    }

    if (target.kind === 'room') {
      const maxHp = roomMaxHp(target.room);
      if (target.room.hp >= maxHp) continue;
      target.room.hp = Math.min(maxHp, target.room.hp + rate * dt);
    } else {
      const maxHp = structureMaxHp(target.structure);
      if (target.structure.hp >= maxHp) continue;
      target.structure.hp = Math.min(maxHp, target.structure.hp + rate * dt);
    }
  }

  for (const unit of state.staff) {
    if (unit.kind !== 'laborer') continue;
    if (
      unit.status === 'moving' ||
      unit.status === 'waiting_elevator' ||
      unit.status === 'riding_elevator'
    ) {
      continue;
    }
    // Pump / mine / prospect jobs stay put (do not peel for repair).
    if (isPumpTarget(unit.targetWorkplaceId) || isMinePatchTarget(unit.targetWorkplaceId) || isProspectTarget(unit.targetWorkplaceId)) {
      continue;
    }
    const target = unit.targetWorkplaceId ? findRepairTarget(state, unit.targetWorkplaceId) : null;
    const stillDamaged =
      target &&
      (target.kind === 'room' ? isDamagedRoom(target.room) : isDamagedStructure(target.structure));
    if (!stillDamaged) {
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

export function repathIdleLaborers(state: GameState): void {
  const idle = state.staff.filter((s) => s.kind === 'laborer' && s.status === 'idle');
  if (idle.length === 0) return;

  const jobs: RepairTarget[] = [];

  for (const room of state.tower.rooms) {
    if (!isDamagedRoom(room)) continue;
    const anchor = workplaceAnchor(state, room);
    if (!anchor) continue;
    const maxHp = roomMaxHp(room);
    const assigned = state.staff.filter(
      (s) => s.kind === 'laborer' && s.targetWorkplaceId === room.id,
    ).length;
    jobs.push({
      kind: 'room',
      room,
      anchor,
      hpPct: maxHp > 0 ? room.hp / maxHp : 1,
      assigned,
    });
  }

  for (const structure of state.tower.structures ?? []) {
    if (!isDamagedStructure(structure)) continue;
    // Prefer repairing the room overlay when both are damaged on the same footprint.
    const coveredByDamagedRoom = roomCells(structure.origin, structure.size).some((c) => {
      const room = roomAt(state.tower, c.col, c.row);
      return room ? isDamagedRoom(room) : false;
    });
    if (coveredByDamagedRoom) continue;
    const anchor = roomAnchorCell(state.tower, structure.origin, structure.size);
    if (!anchor) continue;
    const maxHp = structureMaxHp(structure);
    const assigned = state.staff.filter(
      (s) => s.kind === 'laborer' && s.targetWorkplaceId === structure.id,
    ).length;
    jobs.push({
      kind: 'structure',
      structure,
      anchor,
      hpPct: maxHp > 0 ? structure.hp / maxHp : 1,
      assigned,
    });
  }

  if (jobs.length === 0) {
    assignSurplusLaborers(state);
    return;
  }

  for (const unit of idle) {
    const unstaffed = jobs.filter((d) => d.assigned === 0);
    const candidates = unstaffed.length > 0 ? unstaffed : jobs;
    candidates.sort((a, b) => {
      const da =
        Math.abs(a.anchor.col - unit.pos.col) + Math.abs(a.anchor.row - unit.pos.row);
      const db =
        Math.abs(b.anchor.col - unit.pos.col) + Math.abs(b.anchor.row - unit.pos.row);
      if (da !== db) return da - db;
      return a.hpPct - b.hpPct;
    });
    const target = candidates[0];
    if (!target) break;
    const path = findInteriorPath(state.tower, unit.pos, target.anchor, state.mine);
    unit.targetWorkplaceId = repairTargetId(target);
    unit.path = path.length > 0 ? path : [unit.pos];
    unit.pathIndex = 0;
    unit.status =
      path.length <= 1 && isInRepairFootprint(target, unit.pos) ? 'working' : 'moving';
    target.assigned += 1;
  }
}
