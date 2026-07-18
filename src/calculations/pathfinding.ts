import { cellKey } from './grid';
import { faceOf, isWalkable, neighbors } from './exteriorGraph';
import type { ExteriorNode, MovementProfile, Tower } from '../model/types';

// Manhattan distance: enemies move one orthogonal step at a time along surfaces.
function heuristic(ac: number, ar: number, bc: number, br: number): number {
  return Math.abs(ac - bc) + Math.abs(ar - br);
}

function nodeKey(n: ExteriorNode): string {
  return cellKey(n.col, n.row);
}

/**
 * A* over the exterior surface graph (or open air for fliers) from `start` to `goal`.
 * Returns the full node path including both endpoints, or [] when unreachable.
 *
 * Fliers may step onto `goal` even when it is not normally fly-walkable (wizard perch
 * engagement), so they can enter the wizard's space without skimming walls elsewhere.
 */
export function findPath(
  tower: Tower,
  start: ExteriorNode,
  goal: ExteriorNode,
  profile: MovementProfile,
): ExteriorNode[] {
  const startOk = isWalkable(tower, start.col, start.row, profile);
  const goalOk = isWalkable(tower, goal.col, goal.row, profile);
  if (!startOk) return [];
  if (!goalOk && !profile.canFly) return [];

  const startKey = nodeKey(start);
  const goalKey = nodeKey(goal);
  const goalNode: ExteriorNode = {
    col: goal.col,
    row: goal.row,
    face: profile.canFly && !goalOk ? 'air' : faceOf(tower, goal.col, goal.row),
  };

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

    const nextNodes = neighbors(tower, node.col, node.row, profile);
    // Allow a final lunge onto the wizard goal for fliers.
    if (profile.canFly && !goalOk) {
      const ortho =
        Math.abs(node.col - goal.col) + Math.abs(node.row - goal.row) === 1;
      if (ortho) {
        nextNodes.push(goalNode);
      }
    }

    for (const n of nextNodes) {
      const nKey = nodeKey(n);
      const tentative = currentG + 1;
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
