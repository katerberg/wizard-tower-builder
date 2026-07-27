import { roomCells } from '@/calculations/grid';
import { boilerHasWaterPort, isHydrantRoom } from '@/model/pipes/fluids';
import type { GameState } from '@/model/types';
import { HYDRANT_SPRAY_INTERVAL, SHEET_LIFETIME } from './constants';
import { addSheet } from './wetCells';

export function resetHydrantTimers(state: GameState): void {
  state.hydrantSprayTimers = {};
}

export function hydrantHasWater(
  state: GameState,
  room: { origin: { col: number; row: number }; size: { w: number; h: number } },
): boolean {
  return boilerHasWaterPort(state.tower, room.origin, room.size);
}

/** Left/right ortho cells beside the hydrant footprint (all rows). */
export function hydrantSprayCells(
  origin: { col: number; row: number },
  size: { w: number; h: number },
): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  const foot = roomCells(origin, size);
  const minCol = Math.min(...foot.map((c) => c.col));
  const maxCol = Math.max(...foot.map((c) => c.col));
  for (const c of foot) {
    cells.push({ col: minCol - 1, row: c.row });
    cells.push({ col: maxCol + 1, row: c.row });
  }
  const seen = new Set<string>();
  return cells.filter((c) => {
    const k = `${c.col},${c.row}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function tickHydrants(state: GameState, dt: number): void {
  if (!state.hydrantSprayTimers) state.hydrantSprayTimers = {};
  const timers = state.hydrantSprayTimers;
  const liveIds = new Set<string>();

  for (const room of state.tower.rooms) {
    if (!isHydrantRoom(room)) continue;
    liveIds.add(room.id);
    if (!hydrantHasWater(state, room)) continue;

    timers[room.id] = (timers[room.id] ?? 0) - dt;
    if (timers[room.id] > 0) continue;
    timers[room.id] = HYDRANT_SPRAY_INTERVAL;

    for (const cell of hydrantSprayCells(room.origin, room.size)) {
      addSheet(state, cell.col, cell.row, SHEET_LIFETIME);
    }
  }

  for (const id of Object.keys(timers)) {
    if (!liveIds.has(id)) delete timers[id];
  }
}
