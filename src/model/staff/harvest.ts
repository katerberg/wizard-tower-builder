import {
  GROUND_WATER_MAX_ROW,
  HAND_PUMP_LABORER_RESERVE,
  HAND_PUMP_MAX_WATER_ROW,
  MINE_STONE_HARVEST_PER_SEC,
  PUMP_WATER_ROW_EXTENSION,
} from '@/config/constants';
import { reward } from '@/calculations/economy';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { cellDistance } from '@/calculations/interiorGraph';
import {
  findMinePatchByTarget,
  isMinePatchTarget,
  minePatchTargetId,
} from '@/model/mines';
import type { Cell, GameState, MinePatch, Tower } from '@/model/types';

const PUMP_TARGET = 'pump:hand';

export function isPumpTarget(id: string | null | undefined): boolean {
  return id === PUMP_TARGET;
}

/** @deprecated Use isMinePatchTarget — abstract underground harvest removed. */
export function isHarvestTarget(id: string | null | undefined): boolean {
  return isMinePatchTarget(id);
}

export function countPumpRooms(tower: Tower): number {
  return tower.rooms.filter((r) => r.blueprintId === 'pumpRoom').length;
}

function towerNeedsElevatedWater(tower: Tower): boolean {
  const needsWater = tower.rooms.some((r) =>
    ['boilerRoom', 'manaSpringRoom', 'hydrantRoom', 'steamTurretRoom', 'pumpRoom'].includes(
      r.blueprintId,
    ),
  );
  if (needsWater) return true;
  for (const [key, cell] of Object.entries(tower.infra ?? {})) {
    if (cell.kind !== 'pipe') continue;
    const row = Number(key.split(',')[1]);
    if (row > 0) return true;
  }
  return false;
}

export function handPumpReserveNeeded(state: GameState): number {
  return towerNeedsElevatedWater(state.tower) ? HAND_PUMP_LABORER_RESERVE : 0;
}

function recruitedLaborers(state: GameState): number {
  let n = 0;
  for (const room of state.tower.rooms) {
    if (room.blueprintId !== 'quartersRoom') continue;
    n += state.housingRecruited[room.id] ?? 0;
  }
  return n;
}

/**
 * Max pipe row that can carry water.
 * Build phase assumes roster can cover the hand-pump reserve; attack uses live pumpers.
 */
export function maxWaterReachRow(state: GameState): number {
  const pumps = countPumpRooms(state.tower);
  const livePumpers = state.staff.filter(
    (s) => s.kind === 'laborer' && isPumpTarget(s.targetWorkplaceId),
  ).length;
  const reserve = handPumpReserveNeeded(state);

  if (state.phase === 'build') {
    const canHand = reserve > 0 && recruitedLaborers(state) >= reserve;
    if (!canHand && pumps <= 0) return GROUND_WATER_MAX_ROW;
    const base = canHand || pumps > 0 ? HAND_PUMP_MAX_WATER_ROW : GROUND_WATER_MAX_ROW;
    return base + pumps * PUMP_WATER_ROW_EXTENSION;
  }

  // Attack: mechanical pumps lift from ground; hand band needs a live pumper.
  if (livePumpers <= 0 && pumps <= 0) return GROUND_WATER_MAX_ROW;
  if (livePumpers <= 0) return GROUND_WATER_MAX_ROW + pumps * PUMP_WATER_ROW_EXTENSION;
  return HAND_PUMP_MAX_WATER_ROW + pumps * PUMP_WATER_ROW_EXTENSION;
}

/** Ground-row cell above the mine entrance (hand-pump station). */
export function groundPumpAnchor(state: GameState): Cell {
  const entrance = state.mine.entrance;
  return { col: entrance.col, row: 0 };
}

function availableStonePatches(state: GameState): MinePatch[] {
  return state.mine.patches.filter((p) => p.resource === 'stone' && p.remaining > 0);
}

/** Assign idle laborers to pump (reserve) then shallow mine stone patches. Call after repair. */
export function assignSurplusLaborers(state: GameState): void {
  const idle = state.staff.filter((s) => s.kind === 'laborer' && s.status === 'idle');
  if (idle.length === 0) return;

  const reserve = handPumpReserveNeeded(state);
  const currentPumpers = state.staff.filter(
    (s) => s.kind === 'laborer' && isPumpTarget(s.targetWorkplaceId),
  ).length;
  let needPump = Math.max(0, reserve - currentPumpers);
  const pumpAnchor = groundPumpAnchor(state);
  const patches = availableStonePatches(state);

  for (const unit of idle) {
    if (needPump > 0) {
      needPump -= 1;
      const path = findInteriorPath(state.tower, unit.pos, pumpAnchor, state.mine);
      unit.targetWorkplaceId = PUMP_TARGET;
      unit.path = path.length > 0 ? path : [unit.pos];
      unit.pathIndex = 0;
      const atAnchor =
        unit.pos.col === pumpAnchor.col && unit.pos.row === pumpAnchor.row && path.length <= 1;
      unit.status = atAnchor ? 'working' : 'moving';
      continue;
    }

    if (patches.length === 0) {
      unit.targetWorkplaceId = null;
      unit.status = 'idle';
      continue;
    }

    patches.sort((a, b) => {
      const da = cellDistance(unit.pos, a.cell);
      const db = cellDistance(unit.pos, b.cell);
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    });
    const patch = patches[0];
    const path = findInteriorPath(state.tower, unit.pos, patch.cell, state.mine);
    unit.targetWorkplaceId = minePatchTargetId(patch.id);
    unit.path = path.length > 0 ? path : [unit.pos];
    unit.pathIndex = 0;
    const atPatch =
      unit.pos.col === patch.cell.col && unit.pos.row === patch.cell.row && path.length <= 1;
    unit.status = atPatch ? 'working' : 'moving';
  }
}

/** Tick mine stone harvest for laborers on patch jobs. Hand-pump is presence-only. */
export function tickLaborerHarvestAndPump(state: GameState, dt: number): void {
  for (const unit of state.staff) {
    if (unit.kind !== 'laborer' || unit.status !== 'working') continue;
    if (!isMinePatchTarget(unit.targetWorkplaceId)) continue;

    const patch = findMinePatchByTarget(state.mine, unit.targetWorkplaceId!);
    if (!patch || patch.remaining <= 0) {
      unit.targetWorkplaceId = null;
      unit.status = 'idle';
      unit.path = [unit.pos];
      unit.pathIndex = 0;
      continue;
    }
    if (unit.pos.col !== patch.cell.col || unit.pos.row !== patch.cell.row) continue;

    const want = MINE_STONE_HARVEST_PER_SEC * dt;
    const gained = Math.min(want, patch.remaining);
    if (gained <= 0) continue;
    patch.remaining -= gained;
    reward(state, { stone: gained });

    if (patch.remaining <= 0) {
      unit.targetWorkplaceId = null;
      unit.status = 'idle';
      unit.path = [unit.pos];
      unit.pathIndex = 0;
    }
  }
}
