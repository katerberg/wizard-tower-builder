import { GRID_COLS } from '@/config/constants';
import { surfaceContactsMacro } from '../../../calculations/exteriorGraph';
import { macroCellOfNode } from '../../../calculations/subGrid';
import type { Cell, Tower } from '../../types';

export interface PushDelta { dc: number; dr: number }

/** Push away from tower center at macro scale; down if between walls. */
export function computePushDelta(tower: Tower, cell: Cell): PushDelta {
  const center = Math.floor(GRID_COLS / 2);
  const contacts = surfaceContactsMacro(tower, cell.col, cell.row);

  if (contacts.has('leftWall') && contacts.has('rightWall')) {
    return { dc: 0, dr: -1 };
  }

  if (cell.col < center) return { dc: -1, dr: 0 };
  if (cell.col > center) return { dc: 1, dr: 0 };

  return { dc: 0, dr: -1 };
}

/** Push away from the gust center-point (fliers). */
export function computePushDeltaFromCenter(enemyMacro: Cell, gustCenter: Cell): PushDelta {
  const dc = Math.sign(enemyMacro.col - gustCenter.col);
  const dr = Math.sign(enemyMacro.row - gustCenter.row);
  if (dc === 0 && dr === 0) {
    // On the center cell — shove outward horizontally by default.
    return { dc: enemyMacro.col < Math.floor(GRID_COLS / 2) ? -1 : 1, dr: 0 };
  }
  return { dc, dr };
}

export function gustAffectedCells(center: Cell): Cell[] {
  return [
    center,
    { col: center.col - 1, row: center.row },
    { col: center.col + 1, row: center.row },
    { col: center.col, row: center.row - 1 },
    { col: center.col, row: center.row + 1 },
  ];
}

export function enemyInGustCell(enemyPos: { col: number; row: number }, cell: Cell): boolean {
  const macro = macroCellOfNode(enemyPos);
  return macro.col === cell.col && macro.row === cell.row;
}
