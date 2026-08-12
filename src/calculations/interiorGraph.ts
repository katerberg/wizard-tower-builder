import type { Cell, MineState, Tower } from '@/model/types';
import { getBlueprint } from '@/model/blueprints';
import { hasInfraKind } from '@/model/infra';
import { isElevatorVerticalStep } from '@/model/elevators';
import { hasStructure, roomAt } from '@/model/tower';
import { inBounds, roomCells } from './grid';
import { isMineTunnel } from '@/model/mines';

/**
 * Staff may stand on framing when there is no room, or when the room is passable.
 * Impassable rooms (boiler, steam turret) block even though framing remains underneath.
 */
export function isPassableStructure(tower: Tower, col: number, row: number): boolean {
  if (!hasStructure(tower, col, row)) return false;
  const room = roomAt(tower, col, row);
  if (!room) return true;
  const blueprint = getBlueprint(room.blueprintId);
  return blueprint?.passable !== false;
}

/** A cell staff may occupy: passable framing/room, stair/elevator infra, or mine tunnel. */
export function isSoldierWalkable(
  tower: Tower,
  col: number,
  row: number,
  mine?: MineState | null,
): boolean {
  if (isMineTunnel(mine, col, row)) return true;
  if (!inBounds(col, row)) return false;
  if (hasInfraKind(tower, col, row, 'stair')) return true;
  if (hasInfraKind(tower, col, row, 'elevator')) return true;
  return isPassableStructure(tower, col, row);
}

export function canSoldierTraverse(
  tower: Tower,
  from: Cell,
  to: Cell,
  mine?: MineState | null,
): boolean {
  if (!isSoldierWalkable(tower, from.col, from.row, mine)) return false;
  if (!isSoldierWalkable(tower, to.col, to.row, mine)) return false;

  const dc = Math.abs(from.col - to.col);
  const dr = Math.abs(from.row - to.row);
  if (dc + dr !== 1) return false;

  if (dr > 0) {
    const fromMine = isMineTunnel(mine, from.col, from.row);
    const toMine = isMineTunnel(mine, to.col, to.row);
    // Free vertical steps inside the mine and across the ground↔entrance step.
    if (fromMine || toMine) return true;

    // Stair on the lower floor reaches the floor above (either direction).
    const lowerRow = Math.min(from.row, to.row);
    if (hasInfraKind(tower, from.col, lowerRow, 'stair')) return true;
    // Elevator: both cells must be elevator infra in the same contiguous shaft.
    // Runtime forbids free climbing — staff must ride the car — but A* may route through.
    return isElevatorVerticalStep(tower, from, to);
  }
  return true;
}

export function soldierNeighbors(tower: Tower, cell: Cell, mine?: MineState | null): Cell[] {
  const candidates: Cell[] = [
    { col: cell.col + 1, row: cell.row },
    { col: cell.col - 1, row: cell.row },
    { col: cell.col, row: cell.row + 1 },
    { col: cell.col, row: cell.row - 1 },
  ];
  return candidates.filter((n) => canSoldierTraverse(tower, cell, n, mine));
}

export function cellDistance(a: Cell, b: Cell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

export function roomCenterCell(origin: Cell, size: { w: number; h: number }): Cell {
  return {
    col: origin.col + Math.floor((size.w - 1) / 2),
    row: origin.row + Math.floor((size.h - 1) / 2),
  };
}

/** Pick a walkable cell inside a footprint, preferring center. */
export function roomAnchorCell(
  tower: Tower,
  origin: Cell,
  size: { w: number; h: number },
  mine?: MineState | null,
): Cell | null {
  const center = roomCenterCell(origin, size);
  if (isSoldierWalkable(tower, center.col, center.row, mine)) return center;
  for (const c of roomCells(origin, size)) {
    if (isSoldierWalkable(tower, c.col, c.row, mine)) return c;
  }
  return null;
}
