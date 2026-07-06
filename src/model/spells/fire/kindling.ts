import { inAirBounds, surfaceContacts } from '../../../calculations/exteriorGraph';
import { cellKey } from '../../../calculations/grid';
import type { Cell, Enemy, GameState, Tower } from '../../types';
import { KINDLING_PATCH_DURATION } from './constants';
import { applyKindled } from './kindled';
import { ensureFireState } from './wall';

export function isValidKindlingPlacement(tower: Tower, cell: Cell): boolean {
  const { col, row } = cell;
  if (!inAirBounds(tower, col, row)) return false;
  if (Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row))) return false;
  return surfaceContacts(tower, col, row).size > 0;
}

export function addKindlingPatch(state: GameState, cell: Cell): void {
  ensureFireState(state);
  state.kindlingPatches.push({
    col: cell.col,
    row: cell.row,
    expiresAt: state.waveTimer + KINDLING_PATCH_DURATION,
  });
}

export function runKindlingPatchStepEffects(state: GameState, enemy: Enemy): void {
  if (enemy.currentHp <= 0) return;
  ensureFireState(state);
  for (const patch of state.kindlingPatches) {
    if (patch.expiresAt <= state.waveTimer) continue;
    if (patch.col !== enemy.pos.col || patch.row !== enemy.pos.row) continue;
    applyKindled(state, enemy);
  }
}

export function tickKindlingPatches(state: GameState): void {
  ensureFireState(state);
  state.kindlingPatches = state.kindlingPatches.filter((p) => p.expiresAt > state.waveTimer);
}
