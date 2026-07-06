import { faceOf } from '../../../calculations/exteriorGraph';
import type { Cell, GameState, Tower, WallOfFlameSegment } from '../../types';
import { WALL_OF_FLAME_MAX_CELLS } from './constants';

export function gridLine(from: Cell, to: Cell): Cell[] | null {
  const dist = Math.abs(from.col - to.col) + Math.abs(from.row - to.row);
  if (dist === 0) return [from];
  if (dist > WALL_OF_FLAME_MAX_CELLS) return null;

  const cells: Cell[] = [];
  for (let i = 0; i <= dist; i++) {
    const t = dist === 0 ? 0 : i / dist;
    cells.push({
      col: Math.round(from.col + (to.col - from.col) * t),
      row: Math.round(from.row + (to.row - from.row) * t),
    });
  }

  const deduped: Cell[] = [];
  for (const cell of cells) {
    const prev = deduped[deduped.length - 1];
    if (prev?.col !== cell.col || prev?.row !== cell.row) {
      deduped.push(cell);
    }
  }
  return deduped;
}

export function sameFaceEndpoints(tower: Tower, from: Cell, to: Cell): boolean {
  return faceOf(tower, from.col, from.row) === faceOf(tower, to.col, to.row);
}

export function segmentContainsCell(segment: WallOfFlameSegment, col: number, row: number): boolean {
  return segment.cells.some((c) => c.col === col && c.row === row);
}

export function segmentKey(segment: WallOfFlameSegment, index: number): string {
  const first = segment.cells[0];
  return `wall:${index}:${first?.col},${first?.row}`;
}

export function ensureFireState(state: GameState): void {
  if (!state.kindlingPatches) state.kindlingPatches = [];
  if (!state.wallOfFlameSegments) state.wallOfFlameSegments = [];
  if (!state.fireEnterDone) state.fireEnterDone = {};
}
