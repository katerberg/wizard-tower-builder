import { cellKey } from './grid';
import { isWalkable, neighbors } from './exteriorGraph';
import type { ExteriorNode, MovementProfile, Tower } from '../model/types';

function heuristic(ac: number, ar: number, bc: number, br: number): number {
  const dx = ac - bc;
  const dy = ar - br;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * A* over the exterior (empty-cell) graph from `start` to `goal`. Returns the
 * full node path including both endpoints, or [] when unreachable. Pure: no
 * dependency on rng, DOM, or the store.
 */
export function findPath(
  tower: Tower,
  start: ExteriorNode,
  goal: ExteriorNode,
  profile: MovementProfile,
): ExteriorNode[] {
  if (!isWalkable(tower, goal.col, goal.row) || !isWalkable(tower, start.col, start.row)) {
    return [];
  }

  const startKey = cellKey(start.col, start.row);
  const goalKey = cellKey(goal.col, goal.row);

  const open = new Set<string>([startKey]);
  const cameFrom = new Map<string, ExteriorNode>();
  const nodeByKey = new Map<string, ExteriorNode>([[startKey, start]]);
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, heuristic(start.col, start.row, goal.col, goal.row)]]);

  while (open.size > 0) {
    let current: string | null = null;
    let best = Infinity;
    for (const key of open) {
      const f = fScore.get(key) ?? Infinity;
      if (f < best) {
        best = f;
        current = key;
      }
    }
    if (current === null) break;

    if (current === goalKey) {
      return reconstruct(cameFrom, nodeByKey, current);
    }

    open.delete(current);
    const node = nodeByKey.get(current)!;
    const currentG = gScore.get(current) ?? Infinity;

    for (const n of neighbors(tower, node.col, node.row, profile)) {
      const nKey = cellKey(n.col, n.row);
      const stepCost = n.col !== node.col && n.row !== node.row ? Math.SQRT2 : 1;
      const tentative = currentG + stepCost;
      if (tentative < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, node);
        nodeByKey.set(nKey, n);
        gScore.set(nKey, tentative);
        fScore.set(nKey, tentative + heuristic(n.col, n.row, goal.col, goal.row));
        open.add(nKey);
      }
    }
  }

  return [];
}

function reconstruct(
  cameFrom: Map<string, ExteriorNode>,
  nodeByKey: Map<string, ExteriorNode>,
  currentKey: string,
): ExteriorNode[] {
  const path: ExteriorNode[] = [nodeByKey.get(currentKey)!];
  let key = currentKey;
  while (cameFrom.has(key)) {
    const prev = cameFrom.get(key)!;
    path.unshift(prev);
    key = cellKey(prev.col, prev.row);
  }
  return path;
}
