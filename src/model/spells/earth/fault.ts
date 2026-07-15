import { inMacroAirBounds, surfaceContactsMacro } from '@/calculations/exteriorGraph';
import { cellKey } from '@/calculations/grid';
import { macroCellOfNode } from '@/calculations/subGrid';
import { addMessage } from '@/model/messages';
import type { Cell, Enemy, GameState, Tower } from '@/model/types';
import { FAULT_CHARGE_PER_PASS, FAULT_PATCH_DURATION } from './constants';
import { addCharge, ensureEarthState } from './charge';

export function isValidFaultPlacement(tower: Tower, cell: Cell): boolean {
  const { col, row } = cell;
  if (!inMacroAirBounds(tower, col, row)) return false;
  if (Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row))) return false;
  return surfaceContactsMacro(tower, col, row).size > 0;
}

export function addFaultPatch(state: GameState, cell: Cell): void {
  ensureEarthState(state);
  state.faultPatches.push({
    col: cell.col,
    row: cell.row,
    expiresAt: state.waveTimer + FAULT_PATCH_DURATION,
  });
}

/** +Charge when an enemy steps onto a Fault cell (per pass). */
export function runFaultPatchStepEffects(state: GameState, enemy: Enemy): void {
  if (enemy.currentHp <= 0) return;
  ensureEarthState(state);
  const enemyMacro = macroCellOfNode(enemy.pos);
  for (const patch of state.faultPatches) {
    if (patch.expiresAt <= state.waveTimer) continue;
    if (patch.col !== enemyMacro.col || patch.row !== enemyMacro.row) continue;
    addCharge(state, FAULT_CHARGE_PER_PASS, `${enemy.name} crosses Fault`);
  }
}

export function tickFaultPatches(state: GameState): void {
  ensureEarthState(state);
  const before = state.faultPatches.length;
  state.faultPatches = state.faultPatches.filter((p) => p.expiresAt > state.waveTimer);
  if (state.faultPatches.length < before) {
    addMessage(state, 'A Fault scar fades.', 'info');
  }
}
