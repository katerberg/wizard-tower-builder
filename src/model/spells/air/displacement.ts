import { inAirBounds } from '../../../calculations/exteriorGraph';
import { macroCol, macroRow } from '../../../calculations/subGrid';
import { hasRoomAt, hasStructure } from '../../tower';
import type { ExteriorNode, Tower } from '../../types';

/** Crawler knock-back solids = framing; flier solids = rooms only. */
function isDisplacementSolid(tower: Tower, subCol: number, subRow: number, canFly: boolean): boolean {
  if (subCol < 0 || subRow < 0) return false;
  const col = macroCol(subCol);
  const row = macroRow(subRow);
  return canFly ? hasRoomAt(tower, col, row) : hasStructure(tower, col, row);
}

/** True when a sub-cell cannot be entered during a knock-back. */
export function isDisplacementBlocked(
  tower: Tower,
  subCol: number,
  subRow: number,
  canFly = false,
): boolean {
  if (!inAirBounds(tower, subCol, subRow, canFly)) return true;
  return isDisplacementSolid(tower, subCol, subRow, canFly);
}

export interface DisplacementResult {
  pos: Pick<ExteriorNode, 'col' | 'row'>;
  hitRoom: boolean;
  hitBoundary: boolean;
}

/**
 * Move up to `steps` sub-cells along (dc, dr) from `start`.
 * Solid tiles block entry; one bounce reflects remaining travel off the obstacle.
 * Crawlers collide with framing; fliers only with rooms (bare framing is open air).
 * Fliers use extended air bounds so gust can shove them off-viewport (still in play).
 */
export function resolveSubCellDisplacement(
  tower: Tower,
  start: Pick<ExteriorNode, 'col' | 'row'>,
  dc: number,
  dr: number,
  steps: number,
  canFly = false,
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

    if (!inAirBounds(tower, nextCol, nextRow, canFly)) {
      hitBoundary = true;
      break;
    }

    if (isDisplacementSolid(tower, nextCol, nextRow, canFly)) {
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
