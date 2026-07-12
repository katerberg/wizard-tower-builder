import { cellKey, parseKey } from '@/calculations/grid';
import type { Cell, Tower } from '@/model/types';

/** Preview fluid on a pipe cell (steam typing comes later). */
export type PipeFluid = 'water' | 'unassigned';

const ORTHO: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function pipeCells(tower: Tower): Cell[] {
  const cells: Cell[] = [];
  for (const [key, cell] of Object.entries(tower.infra ?? {})) {
    if (cell.kind !== 'pipe') continue;
    cells.push(parseKey(key));
  }
  return cells;
}

function hasPipe(tower: Tower, col: number, row: number): boolean {
  return tower.infra[cellKey(col, row)]?.kind === 'pipe';
}

/**
 * Pipes are water when their orthogonal component touches ground (row 0).
 * Otherwise they stay unassigned (drawn grey until connected).
 */
export function selectPipeFluids(tower: Tower): Record<string, PipeFluid> {
  const result: Record<string, PipeFluid> = {};
  const pipes = pipeCells(tower);
  for (const c of pipes) {
    result[cellKey(c.col, c.row)] = 'unassigned';
  }

  const queue: Cell[] = pipes.filter((c) => c.row === 0);
  const seen = new Set<string>();
  for (const seed of queue) {
    seen.add(cellKey(seed.col, seed.row));
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    result[cellKey(cur.col, cur.row)] = 'water';
    for (const [dc, dr] of ORTHO) {
      const n = { col: cur.col + dc, row: cur.row + dr };
      const key = cellKey(n.col, n.row);
      if (seen.has(key) || !hasPipe(tower, n.col, n.row)) continue;
      seen.add(key);
      queue.push(n);
    }
  }

  return result;
}

export function pipeFluidAt(tower: Tower, col: number, row: number): PipeFluid {
  if (!hasPipe(tower, col, row)) return 'unassigned';
  return selectPipeFluids(tower)[cellKey(col, row)] ?? 'unassigned';
}

/** Preview fluid if a pipe were placed at `cell` (including that cell). */
export function previewPipeFluidAt(tower: Tower, cell: Cell): PipeFluid {
  if (cell.row === 0) return 'water';
  for (const [dc, dr] of ORTHO) {
    const n = { col: cell.col + dc, row: cell.row + dr };
    if (hasPipe(tower, n.col, n.row) && pipeFluidAt(tower, n.col, n.row) === 'water') {
      return 'water';
    }
  }
  return 'unassigned';
}
