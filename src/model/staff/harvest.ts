import {
  GROUND_WATER_MAX_ROW,
  HAND_PUMP_LABORER_RESERVE,
  HAND_PUMP_MAX_WATER_ROW,
  HARVEST_METAL_SHARE,
  HARVEST_STONE_SHARE,
  HARVEST_UNITS_PER_SEC,
  PUMP_WATER_ROW_EXTENSION,
} from '@/config/constants';
import { reward } from '@/calculations/economy';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import type { Cell, GameState, Tower } from '@/model/types';

const HARVEST_TARGET = 'harvest:underground';
const PUMP_TARGET = 'pump:hand';

export function isHarvestTarget(id: string | null | undefined): boolean {
  return id === HARVEST_TARGET;
}

export function isPumpTarget(id: string | null | undefined): boolean {
  return id === PUMP_TARGET;
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

function groundHarvestAnchor(state: GameState): Cell {
  let best: Cell | null = null;
  for (const room of state.tower.rooms) {
    if (room.blueprintId !== 'quartersRoom') continue;
    const cell = { col: room.origin.col, row: room.origin.row };
    if (!best || cell.row < best.row) best = cell;
  }
  if (best) return best;
  return { col: 8, row: 0 };
}

/** Assign idle laborers to pump (reserve) then harvest. Call after repair assignment. */
export function assignSurplusLaborers(state: GameState): void {
  const idle = state.staff.filter((s) => s.kind === 'laborer' && s.status === 'idle');
  if (idle.length === 0) return;

  const reserve = handPumpReserveNeeded(state);
  const currentPumpers = state.staff.filter(
    (s) => s.kind === 'laborer' && isPumpTarget(s.targetWorkplaceId),
  ).length;
  let needPump = Math.max(0, reserve - currentPumpers);
  const anchor = groundHarvestAnchor(state);

  for (const unit of idle) {
    const targetId = needPump > 0 ? PUMP_TARGET : HARVEST_TARGET;
    if (needPump > 0) needPump -= 1;
    const path = findInteriorPath(state.tower, unit.pos, anchor);
    unit.targetWorkplaceId = targetId;
    unit.path = path.length > 0 ? path : [unit.pos];
    unit.pathIndex = 0;
    const atAnchor =
      unit.pos.col === anchor.col && unit.pos.row === anchor.row && path.length <= 1;
    unit.status = atAnchor ? 'working' : 'moving';
  }
}

/** Tick harvest for laborers on harvest jobs. Hand-pump is presence-only. */
export function tickLaborerHarvestAndPump(state: GameState, dt: number): void {
  let harvestLaborers = 0;
  for (const unit of state.staff) {
    if (unit.kind !== 'laborer' || unit.status !== 'working') continue;
    if (isHarvestTarget(unit.targetWorkplaceId)) harvestLaborers += 1;
  }

  if (harvestLaborers <= 0) return;
  const total = harvestLaborers * HARVEST_UNITS_PER_SEC * dt;
  reward(state, {
    metal: total * HARVEST_METAL_SHARE,
    stone: total * HARVEST_STONE_SHARE,
  });
}
