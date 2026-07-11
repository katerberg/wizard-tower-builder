import type { Cell, GameState } from '../../types';
import { BLIZZARD_RADIUS } from './constants';
import { ensureAirState } from './tornado';

export function isInBlizzardZone(state: GameState, macroCol: number, macroRow: number): boolean {
  for (const zone of state.blizzardZones) {
    if (zone.expiresAt <= state.waveTimer) continue;
    const dist = Math.abs(zone.center.col - macroCol) + Math.abs(zone.center.row - macroRow);
    if (dist <= zone.radius) return true;
  }
  return false;
}

export function blizzardZoneCells(center: Cell, radius: number = BLIZZARD_RADIUS): Cell[] {
  const cells: Cell[] = [];
  for (let dc = -radius; dc <= radius; dc++) {
    for (let dr = -radius; dr <= radius; dr++) {
      if (Math.abs(dc) + Math.abs(dr) <= radius) {
        cells.push({ col: center.col + dc, row: center.row + dr });
      }
    }
  }
  return cells;
}

export function addBlizzardZone(state: GameState, center: Cell, expiresAt: number): void {
  ensureAirState(state);
  state.blizzardZones.push({
    center,
    radius: BLIZZARD_RADIUS,
    expiresAt,
    tickTimer: 0,
  });
}

export function tickBlizzardZones(state: GameState): void {
  ensureAirState(state);
  state.blizzardZones = state.blizzardZones.filter((z) => z.expiresAt > state.waveTimer);
}
