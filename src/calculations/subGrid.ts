import { GRID_COLS, SUB_CELLS_PER_MACRO } from '@/config/constants';
import type { Cell, ExteriorFace, ExteriorNode } from '@/model/types';

type SubPos = Pick<ExteriorNode, 'col' | 'row'>;

export function macroCol(subCol: number): number {
  return Math.floor(subCol / SUB_CELLS_PER_MACRO);
}

export function macroRow(subRow: number): number {
  return Math.floor(subRow / SUB_CELLS_PER_MACRO);
}

export function macroCellOf(subCol: number, subRow: number): Cell {
  return { col: macroCol(subCol), row: macroRow(subRow) };
}

export function macroCellOfNode(node: SubPos): Cell {
  return macroCellOf(node.col, node.row);
}

export function macroCenterSubCell(macroCol: number, macroRow: number): ExteriorNode {
  const offset = Math.floor(SUB_CELLS_PER_MACRO / 2);
  return {
    col: macroCol * SUB_CELLS_PER_MACRO + offset,
    row: macroRow * SUB_CELLS_PER_MACRO + offset,
    face: 'top',
  };
}

export function macroToSubCell(cell: Cell): ExteriorNode {
  return macroCenterSubCell(cell.col, cell.row);
}

const MID_OFFSET = Math.floor(SUB_CELLS_PER_MACRO / 2);

/** Exterior sub-cell hugging a macro tile on the given face (movement grid). */
export function exteriorSubAt(macroCol: number, macroRow: number, face: ExteriorFace = 'left'): ExteriorNode {
  const baseSubRow = macroRow * SUB_CELLS_PER_MACRO;
  const midSubRow = baseSubRow + MID_OFFSET;
  const midSubCol = macroCol * SUB_CELLS_PER_MACRO + MID_OFFSET;
  switch (face) {
    case 'left':
      return { col: macroCol * SUB_CELLS_PER_MACRO - 1, row: midSubRow, face: 'left' };
    case 'right':
      return { col: (macroCol + 1) * SUB_CELLS_PER_MACRO, row: midSubRow, face: 'right' };
    case 'top':
      return { col: midSubCol, row: baseSubRow, face: 'top' };
  }
}

/** First sub-row of the perch macro row directly above `topOccupiedMacroRow`. */
export function perchSubRow(topOccupiedMacroRow: number): number {
  return (topOccupiedMacroRow + 1) * SUB_CELLS_PER_MACRO;
}

/** Manhattan distance in macro cells (for spell range checks). */
export function macroGridDistance(from: SubPos, cell: Cell): number {
  const macro = macroCellOfNode(from);
  return Math.abs(macro.col - cell.col) + Math.abs(macro.row - cell.row);
}

/** Euclidean distance in macro cells (for wand strike / turret range). */
export function macroDistance(a: SubPos, b: SubPos): number {
  const am = macroCellOfNode(a);
  const bm = macroCellOfNode(b);
  return Math.hypot(am.col - bm.col, am.row - bm.row);
}

export function macroDistanceToCell(a: SubPos, cell: Cell): number {
  const am = macroCellOfNode(a);
  return Math.hypot(am.col - cell.col, am.row - cell.row);
}

export function sameMacroCell(a: SubPos, b: SubPos): boolean {
  const am = macroCellOfNode(a);
  const bm = macroCellOfNode(b);
  return am.col === bm.col && am.row === bm.row;
}

export function subColInBounds(subCol: number): boolean {
  return subCol >= 0 && subCol < GRID_COLS * SUB_CELLS_PER_MACRO;
}
