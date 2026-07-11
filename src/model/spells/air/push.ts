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
