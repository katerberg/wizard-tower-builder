import { cellKey, inBounds } from '@/calculations/grid';
import type { Blueprint, Cell, InfraCell, InfraKind, Tower } from './types';

export function getInfraAt(tower: Tower, col: number, row: number): InfraCell | undefined {
  return tower.infra[cellKey(col, row)];
}

export function hasInfraKind(tower: Tower, col: number, row: number, kind: InfraKind): boolean {
  return getInfraAt(tower, col, row)?.kind === kind;
}

export function canPlaceInfra(tower: Tower, blueprint: Blueprint, cell: Cell): boolean {
  if (blueprint.category !== 'infra' || !blueprint.infraKind) return false;
  if (!inBounds(cell.col, cell.row)) return false;
  const key = cellKey(cell.col, cell.row);
  const existing = tower.infra[key];
  if (existing?.kind === blueprint.infraKind) return true; // toggle off handled separately
  return !existing;
}

export function placeInfra(tower: Tower, cell: Cell, kind: InfraKind): Tower {
  const key = cellKey(cell.col, cell.row);
  return { ...tower, infra: { ...tower.infra, [key]: { kind } } };
}

export function removeInfraAt(tower: Tower, col: number, row: number): Tower {
  const key = cellKey(col, row);
  if (!tower.infra[key]) return tower;
  const infra = { ...tower.infra };
  delete infra[key];
  return { ...tower, infra };
}

export function clearInfraInCells(tower: Tower, cells: Cell[]): Tower {
  const infra = { ...tower.infra };
  for (const c of cells) {
    delete infra[cellKey(c.col, c.row)];
  }
  return { ...tower, infra };
}

export function infraEqual(a: Tower['infra'], b: Tower['infra']): boolean {
  const ia = a ?? {};
  const ib = b ?? {};
  const keysA = Object.keys(ia).sort();
  const keysB = Object.keys(ib).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    if (ia[keysA[i]].kind !== ib[keysB[i]].kind) return false;
  }
  return true;
}
