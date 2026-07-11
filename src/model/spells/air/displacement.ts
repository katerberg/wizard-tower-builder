import { inAirBounds } from '../../../calculations/exteriorGraph';
import { cellKey } from '../../../calculations/grid';
import { macroCol, macroRow } from '../../../calculations/subGrid';
import type { ExteriorNode, Tower } from '../../types';

function isRoomSub(tower: Tower, subCol: number, subRow: number): boolean {
  if (subCol < 0 || subRow < 0) return false;
  return Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(macroCol(subCol), macroRow(subRow)));
}

/** True when a sub-cell cannot be entered during a knock-back. */
export function isDisplacementBlocked(tower: Tower, subCol: number, subRow: number): boolean {
  if (!inAirBounds(tower, subCol, subRow)) return true;
  return isRoomSub(tower, subCol, subRow);
}

export interface DisplacementResult {
  pos: Pick<ExteriorNode, 'col' | 'row'>;
  hitRoom: boolean;
  hitBoundary: boolean;
}

/**
 * Move up to `steps` sub-cells along (dc, dr) from `start`.
 * Room tiles block entry; one bounce reflects remaining travel off the obstacle.
 */
export function resolveSubCellDisplacement(
  tower: Tower,
  start: Pick<ExteriorNode, 'col' | 'row'>,
  dc: number,
  dr: number,
  steps: number,
): DisplacementResult {
  if (steps <= 0 || (dc === 0 && dr === 0)) {
    return { pos: { col: start.col, row: start.row }, hitRoom: false, hitBoundary: false };
  }

  let pos = { col: start.col, row: start.row };
  let dir = { dc, dr };
  let remaining = steps;
  let hitRoom = false;
  let hitBoundary = false;
  let bounced = false;

  while (remaining > 0) {
    const nextCol = pos.col + dir.dc;
    const nextRow = pos.row + dir.dr;

    if (!inAirBounds(tower, nextCol, nextRow)) {
      hitBoundary = true;
      break;
    }

    if (isRoomSub(tower, nextCol, nextRow)) {
      hitRoom = true;
      if (!bounced) {
        bounced = true;
        dir = { dc: -dir.dc, dr: -dir.dr };
        continue;
      }
      break;
    }

    pos = { col: nextCol, row: nextRow };
    remaining--;
  }

  return { pos, hitRoom, hitBoundary };
}
