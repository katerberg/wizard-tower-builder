import { roomAt } from '@/model/tower';
import { refreshKindled } from './kindled';
import { KINDLING_PATCH_DURATION } from './constants';
import type { Cell, GameState, KindlingPatch, Tower } from '@/model/types';

const ORTHO: Cell[] = [
  { col: 0, row: 1 },
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: -1, row: 0 },
];

export function isKindlingTrapCell(tower: Tower, cell: Cell): boolean {
  if (roomAt(tower, cell.col, cell.row)) return false;
  for (const d of ORTHO) {
    if (roomAt(tower, cell.col + d.col, cell.row + d.row)) return true;
  }
  return false;
}

export function placeKindlingPatch(state: GameState, cell: Cell): boolean {
  if (!isKindlingTrapCell(state.tower, cell)) return false;
  state.kindlingPatches.push({
    cell: { ...cell },
    expiresAt: state.waveTimer + KINDLING_PATCH_DURATION,
  });
  return true;
}

export function expireKindlingPatches(state: GameState): void {
  state.kindlingPatches = state.kindlingPatches.filter((p) => state.waveTimer < p.expiresAt);
}

export function kindlingPatchAt(state: GameState, col: number, row: number): KindlingPatch | undefined {
  return state.kindlingPatches.find((p) => p.cell.col === col && p.cell.row === row);
}

/** Called when an enemy finishes a climb step onto a surface cell. */
export function onEnemyStepKindling(state: GameState, col: number, row: number, enemyId: string): void {
  const patch = kindlingPatchAt(state, col, row);
  if (!patch) return;
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy || enemy.currentHp <= 0) return;
  refreshKindled(state, enemy);
}
