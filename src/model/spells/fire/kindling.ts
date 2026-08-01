import { inMacroAirBounds, surfaceContactsMacro } from '../../../calculations/exteriorGraph';
import { cellKey } from '../../../calculations/grid';
import { macroCellOfNode } from '../../../calculations/subGrid';
import type { Cell, Enemy, GameState, Tower } from '../../types';
import type { SpellDef } from '../types';
import { KINDLING_PATCH_DURATION } from './constants';
import { applyKindled } from './kindled';
import { ensureFireState } from './wall';

export function isValidKindlingPlacement(tower: Tower, cell: Cell): boolean {
  const { col, row } = cell;
  if (!inMacroAirBounds(tower, col, row)) return false;
  if (Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row))) return false;
  return surfaceContactsMacro(tower, col, row).size > 0;
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
    const enemyMacro = macroCellOfNode(enemy.pos);
    if (patch.col !== enemyMacro.col || patch.row !== enemyMacro.row) continue;
    applyKindled(state, enemy);
  }
}

export function tickKindlingPatches(state: GameState): void {
  ensureFireState(state);
  state.kindlingPatches = state.kindlingPatches.filter((p) => p.expiresAt > state.waveTimer);
}

export const kindling: SpellDef = {
  id: 'kindling',
  name: 'Kindling',
  glyph: 'K',
  description: 'Place a visible trap beside the tower. Stepping on it marks the enemy Kindled for 15s.',
  manaCost: 2,
  cooldown: 3,
  targeting: 'trapAdjacent',
  range: 8,
  damage: 0,
  validatePlacement: (state, cell) => isValidKindlingPlacement(state.tower, cell),
  cast(ctx, target) {
    if (target.kind !== 'cell') return;
    addKindlingPatch(ctx.state, target.cell);
    ctx.log('Kindling trap armed.', 'combat');
  },
};
