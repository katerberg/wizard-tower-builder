import { cellKey } from '@/calculations/grid';
import { macroCellOfNode } from '@/calculations/subGrid';
import { hasStructure } from '@/model/tower';
import type { Cell, Enemy, GameState, WetCell } from '@/model/types';
import {
  PUDDLE_LIFETIME,
  PUDDLE_SOAK_PER_SEC,
  SHEET_FLOW_INTERVAL,
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
    // Don't overwrite a pinned waterfall stream with a hydrant sheet.
    if (existing.stream) return;
    existing.lifetime = Math.max(existing.lifetime, lifetime);
    return;
  }
  cells.push({ col, row, kind: 'sheet', lifetime, flowAcc: 0 });
}

export function addPuddle(state: GameState, col: number, row: number, lifetime = PUDDLE_LIFETIME): void {
  if (hasStructure(state.tower, col, row)) return;
  if (row < 0) return;
  const cells = ensureWetCells(state);
  const existing = cells.find((w) => w.col === col && w.row === row);
  if (existing) {
    existing.kind = 'puddle';
    existing.lifetime = Math.max(existing.lifetime, lifetime);
    existing.flowAcc = undefined;
    existing.stream = undefined;
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
    flowAcc: sheet.flowAcc,
  };
}

/**
 * Flow hydrant sheets down, dissipate lifetimes, apply standing Soak.
 * Waterfall stream cells are owned by `tickActiveWaterfalls` and passed through.
 */
export function tickWetCells(state: GameState, dt: number): void {
  const prev = ensureWetCells(state);
  const streams = prev.filter((c) => c.stream);
  const nextByKey = new Map<string, WetCell>();

  for (const cell of prev) {
    if (cell.stream) continue;

    let next: WetCell | null = cell;
    if (cell.kind === 'sheet') {
      let acc = (cell.flowAcc ?? 0) + dt;
      next = { ...cell, flowAcc: acc };
      while (next?.kind === 'sheet' && acc >= SHEET_FLOW_INTERVAL) {
        acc -= SHEET_FLOW_INTERVAL;
        next = flowSheetDown(state, { ...next, flowAcc: acc });
      }
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
    const kind = existing.kind === 'puddle' || next.kind === 'puddle' ? 'puddle' : 'sheet';
    nextByKey.set(key, {
      col: next.col,
      row: next.row,
      kind,
      lifetime: Math.max(existing.lifetime, next.lifetime),
      flowAcc: kind === 'sheet' ? Math.max(existing.flowAcc ?? 0, next.flowAcc ?? 0) : undefined,
    });
  }

  // Prefer puddles over stream paint if both claim a cell.
  const merged = [...nextByKey.values()];
  for (const stream of streams) {
    const key = wetKey(stream.col, stream.row);
    const existing = nextByKey.get(key);
    if (existing?.kind === 'puddle') continue;
    if (!existing) {
      merged.push(stream);
      nextByKey.set(key, stream);
    }
  }

  state.wetCells = merged;

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
