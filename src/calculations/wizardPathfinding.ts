import { cellKey } from './grid';
import { cellDistance } from './interiorGraph';
import { isWizardWalkable, wizardNeighbors } from './wizardGraph';
import { macroCenterSubCell, macroCellOfNode } from './subGrid';
import { isElevatorVerticalStep } from '@/model/elevators';
import type { Cell, ExteriorNode, Tower } from '@/model/types';

function heuristic(a: Cell, b: Cell): number {
  return cellDistance(a, b);
}

/** A* on the wizard interior graph (no mines). */
export function findWizardMacroPath(tower: Tower, start: Cell, goal: Cell): Cell[] {
  if (!isWizardWalkable(tower, start.col, start.row) || !isWizardWalkable(tower, goal.col, goal.row)) {
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

    for (const next of wizardNeighbors(tower, current)) {
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

/**
 * Expand a macro path into sub-cell center waypoints.
 * Elevator vertical edges become a single jump marker (same centers) —
 * runtime boards the car instead of free-stepping.
 */
export function expandMacroPathToSubCells(tower: Tower, macroPath: Cell[]): ExteriorNode[] {
  if (macroPath.length === 0) return [];
  const nodes: ExteriorNode[] = [macroCenterSubCell(macroPath[0].col, macroPath[0].row)];
  for (let i = 1; i < macroPath.length; i++) {
    const prev = macroPath[i - 1];
    const curr = macroPath[i];
    if (isElevatorVerticalStep(tower, prev, curr)) {
      // Placeholder center at exit — stepWizard intercepts before walking.
      nodes.push(macroCenterSubCell(curr.col, curr.row));
      continue;
    }
    const from = nodes[nodes.length - 1];
    const to = macroCenterSubCell(curr.col, curr.row);
    const steps = interpolateSubCells(from, to);
    for (const step of steps) {
      if (
        step.col === nodes[nodes.length - 1].col &&
        step.row === nodes[nodes.length - 1].row
      ) {
        continue;
      }
      nodes.push(step);
    }
  }
  return nodes;
}

function interpolateSubCells(from: ExteriorNode, to: ExteriorNode): ExteriorNode[] {
  const out: ExteriorNode[] = [];
  let col = from.col;
  let row = from.row;
  const dc = Math.sign(to.col - from.col);
  const dr = Math.sign(to.row - from.row);
  while (col !== to.col || row !== to.row) {
    if (col !== to.col) col += dc;
    else if (row !== to.row) row += dr;
    out.push({ col, row, face: 'top' });
  }
  return out;
}

export function wizardMacroOf(pos: ExteriorNode): Cell {
  return macroCellOfNode(pos);
}
