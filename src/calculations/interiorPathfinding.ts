import { cellKey } from './grid';
import { cellDistance, isSoldierWalkable, soldierNeighbors } from './interiorGraph';
import type { Cell, Tower } from '@/model/types';

function heuristic(a: Cell, b: Cell): number {
  return cellDistance(a, b);
}

/** A* on the interior/infra graph for soldier routing. */
export function findInteriorPath(tower: Tower, start: Cell, goal: Cell): Cell[] {
  if (!isSoldierWalkable(tower, start.col, start.row) || !isSoldierWalkable(tower, goal.col, goal.row)) {
    return [];
  }

  const startKey = cellKey(start.col, start.row);
  const goalKey = cellKey(goal.col, goal.row);

  const open = new Set<string>([startKey]);
  const cameFrom = new Map<string, Cell>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, heuristic(start, goal)]]);

  while (open.size > 0) {
    let currentKey: string | null = null;
    let best = Infinity;
    for (const key of open) {
      const f = fScore.get(key) ?? Infinity;
      if (f < best) {
        best = f;
        currentKey = key;
      }
    }
    if (currentKey === null) break;

    if (currentKey === goalKey) {
      return reconstruct(cameFrom, currentKey, start);
    }

    open.delete(currentKey);
    const [col, row] = currentKey.split(',').map(Number);
    const current: Cell = { col, row };
    const currentG = gScore.get(currentKey) ?? Infinity;

    for (const next of soldierNeighbors(tower, current)) {
      const nKey = cellKey(next.col, next.row);
      const tentative = currentG + 1;
      if (tentative < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentative);
        fScore.set(nKey, tentative + heuristic(next, goal));
        open.add(nKey);
      }
    }
  }

  return [];
}

function reconstruct(cameFrom: Map<string, Cell>, currentKey: string, start: Cell): Cell[] {
  const path: Cell[] = [];
  let key: string | undefined = currentKey;
  while (key) {
    const [col, row] = key.split(',').map(Number);
    path.unshift({ col, row });
    const prev = cameFrom.get(key);
    if (!prev) break;
    key = cellKey(prev.col, prev.row);
  }
  if (path.length === 0 || path[0].col !== start.col || path[0].row !== start.row) {
    path.unshift(start);
  }
  return path;
}
