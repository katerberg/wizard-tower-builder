import type { Cell, Tower } from '@/model/types';
import { hasInfraKind } from '@/model/infra';
import { isElevatorVerticalStep } from '@/model/elevators';
import { getWizardPosition } from '@/model/tower';
import { inBounds } from './grid';
import { isPassableStructure, isSoldierWalkable } from './interiorGraph';
import { macroCellOfNode } from './subGrid';

/** Crown perch macro (solar collector deck) — wizard may stand here without framing. */
export function isCollectorPerchCell(tower: Tower, col: number, row: number): boolean {
  const perch = macroCellOfNode(getWizardPosition(tower));
  return perch.col === col && perch.row === row;
}

/**
 * Wizard walkability: staff-like passable framing/rooms + stairs/elevators,
 * plus any in-bounds ground (row 0) cell, plus the crown collector perch.
 * No mine tunnels.
 */
export function isWizardWalkable(tower: Tower, col: number, row: number): boolean {
  if (!inBounds(col, row)) return false;
  if (row === 0) return true;
  if (isCollectorPerchCell(tower, col, row)) return true;
  if (hasInfraKind(tower, col, row, 'stair')) return true;
  if (hasInfraKind(tower, col, row, 'elevator')) return true;
  return isPassableStructure(tower, col, row);
}

/** Standable after fall / Flight: same as walkable (interior/ground, not exterior shell). */
export function isWizardStandable(tower: Tower, col: number, row: number): boolean {
  return isWizardWalkable(tower, col, row);
}

export function canWizardTraverse(tower: Tower, from: Cell, to: Cell): boolean {
  if (!isWizardWalkable(tower, from.col, from.row)) return false;
  if (!isWizardWalkable(tower, to.col, to.row)) return false;

  const dc = Math.abs(from.col - to.col);
  const dr = Math.abs(from.row - to.row);
  if (dc + dr !== 1) return false;

  if (dr > 0) {
    // Free step between top framing and the collector perch deck.
    if (isCollectorPerchCell(tower, from.col, from.row) || isCollectorPerchCell(tower, to.col, to.row)) {
      return from.col === to.col;
    }
    const lowerRow = Math.min(from.row, to.row);
    if (hasInfraKind(tower, from.col, lowerRow, 'stair')) return true;
    return isElevatorVerticalStep(tower, from, to);
  }
  return true;
}

export function wizardNeighbors(tower: Tower, cell: Cell): Cell[] {
  const candidates: Cell[] = [
    { col: cell.col + 1, row: cell.row },
    { col: cell.col - 1, row: cell.row },
    { col: cell.col, row: cell.row + 1 },
    { col: cell.col, row: cell.row - 1 },
  ];
  return candidates.filter((n) => canWizardTraverse(tower, cell, n));
}

/** Re-export for call sites that already use soldier walkability for staff comparisons. */
export { isSoldierWalkable };
