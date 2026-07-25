import { cellKey } from '@/calculations/grid';
import { macroCellOfNode } from '@/calculations/subGrid';
import { hasStructure } from '@/model/tower';
import type { Cell, Enemy, GameState, WetCell } from '@/model/types';
import {
  PUDDLE_LIFETIME,
  PUDDLE_SOAK_PER_SEC,
  SHEET_LIFETIME,
  SHEET_SOAK_PER_SEC,
  WET_STEP_SOAK,
} from './constants';
import { addSoak } from './soak';

function wetKey(col: number, row: number): string {
  return cellKey(col, row);
}

export function ensureWetCells(state: GameState): WetCell[] {
  if (!state.wetCells) state.wetCells = [];
  return state.wetCells;
}

export function resetWetCells(state: GameState): void {
  state.wetCells = [];
}

export function getWetCell(state: GameState, col: number, row: number): WetCell | undefined {
  return ensureWetCells(state).find((w) => w.col === col && w.row === row);
}

export function isPuddleCell(state: GameState, col: number, row: number): boolean {
  return getWetCell(state, col, row)?.kind === 'puddle';
}

/** Air cell with solid framing directly below — roof / ledge basin. */
export function isFlatTop(tower: GameState['tower'], col: number, row: number): boolean {
  if (hasStructure(tower, col, row)) return false;
  if (row <= 0) return !hasStructure(tower, col, row);
  return hasStructure(tower, col, row - 1);
}

export function addSheet(state: GameState, col: number, row: number, lifetime = SHEET_LIFETIME): void {
  if (hasStructure(state.tower, col, row)) return;
  if (row < 0) return;
  const cells = ensureWetCells(state);
  const existing = cells.find((w) => w.col === col && w.row === row);
  if (existing) {
    if (existing.kind === 'puddle') {
      existing.lifetime = Math.max(existing.lifetime, PUDDLE_LIFETIME);
      return;
    }
    existing.lifetime = Math.max(existing.lifetime, lifetime);
    return;
  }
  cells.push({ col, row, kind: 'sheet', lifetime });
}

export function addPuddle(state: GameState, col: number, row: number, lifetime = PUDDLE_LIFETIME): void {
  if (hasStructure(state.tower, col, row)) return;
  if (row < 0) return;
  const cells = ensureWetCells(state);
  const existing = cells.find((w) => w.col === col && w.row === row);
  if (existing) {
    existing.kind = 'puddle';
    existing.lifetime = Math.max(existing.lifetime, lifetime);
    return;
  }
  cells.push({ col, row, kind: 'puddle', lifetime });
}

export function wetCellKeys(state: GameState): Set<string> {
  return new Set(ensureWetCells(state).map((w) => wetKey(w.col, w.row)));
}

/** Enemy stepped onto a wet macro cell — bump Soak. */
export function runWetCellStepEffects(state: GameState, enemy: Enemy): void {
  const macro = macroCellOfNode(enemy.pos);
  const wet = getWetCell(state, macro.col, macro.row);
  if (!wet) return;
  addSoak(enemy, WET_STEP_SOAK);
}

function flowSheetDown(state: GameState, sheet: WetCell): WetCell | null {
  const belowRow = sheet.row - 1;
  if (belowRow < 0 || hasStructure(state.tower, sheet.col, belowRow)) {
    // Pool on this cell (roof / ground stop).
    return {
      col: sheet.col,
      row: sheet.row,
      kind: 'puddle',
      lifetime: Math.max(sheet.lifetime, PUDDLE_LIFETIME),
    };
  }
  return {
    col: sheet.col,
    row: belowRow,
    kind: 'sheet',
    lifetime: sheet.lifetime,
  };
}

/**
 * Flow sheets down, dissipate lifetimes, apply standing Soak from wet cells.
 * Call once per attack tick.
 */
export function tickWetCells(state: GameState, dt: number): void {
  const prev = ensureWetCells(state);
  const nextByKey = new Map<string, WetCell>();

  for (const cell of prev) {
    let next: WetCell | null = cell;
    if (cell.kind === 'sheet') {
      next = flowSheetDown(state, cell);
    }
    if (!next) continue;
    next = { ...next, lifetime: next.lifetime - dt };
    if (next.lifetime <= 0) continue;

    const key = wetKey(next.col, next.row);
    const existing = nextByKey.get(key);
    if (!existing) {
      nextByKey.set(key, next);
      continue;
    }
    // Prefer puddle; keep longer lifetime.
    const kind = existing.kind === 'puddle' || next.kind === 'puddle' ? 'puddle' : 'sheet';
    nextByKey.set(key, {
      col: next.col,
      row: next.row,
      kind,
      lifetime: Math.max(existing.lifetime, next.lifetime),
    });
  }

  state.wetCells = [...nextByKey.values()];

  for (const enemy of state.enemies) {
    if (enemy.currentHp <= 0) continue;
    const macro = macroCellOfNode(enemy.pos);
    const wet = getWetCell(state, macro.col, macro.row);
    if (!wet) continue;
    const rate = wet.kind === 'puddle' ? PUDDLE_SOAK_PER_SEC : SHEET_SOAK_PER_SEC;
    addSoak(enemy, rate * dt);
  }
}

export function waterfallPath(tower: GameState['tower'], start: Cell, maxCells: number): Cell[] {
  const path: Cell[] = [];
  let row = start.row;
  const col = start.col;
  for (let i = 0; i < maxCells; i++) {
    if (row < 0) break;
    if (hasStructure(tower, col, row)) break;
    path.push({ col, row });
    row -= 1;
  }
  return path;
}
