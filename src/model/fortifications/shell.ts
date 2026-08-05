import { addResources, asResources, emptyResources } from '@/calculations/resources';
import { cellKey, inBounds, parseKey } from '@/calculations/grid';
import { getFortificationBlueprint, isFortificationId } from '@/model/fortificationBlueprints';
import { hasStructure } from '@/model/tower/query';
import type {
  Cell,
  FortificationId,
  PlacementReason,
  PlacementResult,
  Resources,
  ShellCell,
  Tower,
} from '@/model/types';

/** Framing cell exposes at least one orthogonal face with no framing neighbor. */
export function isExteriorFramingCell(tower: Tower, col: number, row: number): boolean {
  if (!hasStructure(tower, col, row)) return false;
  const neighbors: Cell[] = [
    { col: col - 1, row },
    { col: col + 1, row },
    { col, row: row - 1 },
    { col, row: row + 1 },
  ];
  for (const n of neighbors) {
    if (!inBounds(n.col, n.row) || !hasStructure(tower, n.col, n.row)) {
      return true;
    }
  }
  return false;
}

export function getShellAt(tower: Tower, col: number, row: number): ShellCell | undefined {
  return tower.shell?.[cellKey(col, row)];
}

export function shellKindAt(tower: Tower, col: number, row: number): FortificationId | undefined {
  return getShellAt(tower, col, row)?.kind;
}

function hasExposedTop(tower: Tower, col: number, row: number): boolean {
  return !hasStructure(tower, col, row + 1);
}

function hasExposedWallFace(tower: Tower, col: number, row: number): boolean {
  return !hasStructure(tower, col - 1, row) || !hasStructure(tower, col + 1, row);
}

/** True when this framing cell can provide underCeiling to an empty cell below. */
function canProvideUnderCeiling(tower: Tower, col: number, row: number): boolean {
  if (row <= 0) return false;
  return !hasStructure(tower, col, row - 1);
}

export function canPlaceFortification(
  tower: Tower,
  kind: FortificationId,
  cell: Cell,
): PlacementResult {
  if (!inBounds(cell.col, cell.row)) {
    return { ok: false, reason: 'out_of_bounds' };
  }
  if (!hasStructure(tower, cell.col, cell.row)) {
    return { ok: false, reason: 'no_framing' };
  }
  if (!isExteriorFramingCell(tower, cell.col, cell.row)) {
    return { ok: false, reason: 'not_exterior' };
  }

  switch (kind) {
    case 'moat':
    case 'glacis':
    case 'stakes':
      if (cell.row !== 0) return { ok: false, reason: 'wrong_face' };
      return { ok: true, reason: 'ok' };
    case 'parapet':
      if (!hasExposedTop(tower, cell.col, cell.row)) return { ok: false, reason: 'wrong_face' };
      return { ok: true, reason: 'ok' };
    case 'cornice':
      if (!canProvideUnderCeiling(tower, cell.col, cell.row)) {
        return { ok: false, reason: 'wrong_face' };
      }
      return { ok: true, reason: 'ok' };
    case 'barbican':
      if (!hasExposedWallFace(tower, cell.col, cell.row)) {
        return { ok: false, reason: 'wrong_face' };
      }
      return { ok: true, reason: 'ok' };
  }
}

export interface FortificationPlan {
  ok: boolean;
  reason: PlacementReason;
  isToggleOff: boolean;
}

export function planFortificationPlacement(
  tower: Tower,
  kind: FortificationId,
  cell: Cell,
): FortificationPlan {
  const existing = shellKindAt(tower, cell.col, cell.row);
  if (existing === kind) {
    return { ok: true, reason: 'ok', isToggleOff: true };
  }
  const place = canPlaceFortification(tower, kind, cell);
  return { ok: place.ok, reason: place.reason, isToggleOff: false };
}

export function placeShell(tower: Tower, cell: Cell, kind: FortificationId): Tower {
  const key = cellKey(cell.col, cell.row);
  return {
    ...tower,
    shell: { ...(tower.shell ?? {}), [key]: { kind } },
  };
}

export function removeShellAt(tower: Tower, col: number, row: number): Tower {
  const key = cellKey(col, row);
  if (!tower.shell?.[key]) return tower;
  const shell = { ...(tower.shell ?? {}) };
  delete shell[key];
  return { ...tower, shell };
}

export function clearShellInCells(tower: Tower, cells: Cell[]): Tower {
  if (!tower.shell || Object.keys(tower.shell).length === 0) return tower;
  const shell = { ...tower.shell };
  let changed = false;
  for (const c of cells) {
    const key = cellKey(c.col, c.row);
    if (shell[key]) {
      delete shell[key];
      changed = true;
    }
  }
  return changed ? { ...tower, shell } : tower;
}

/**
 * Drop fortifications on cells that lost framing or exterior exposure.
 * Refunds are implicit via towerBuildCost vs baseline (stripped cells leave the cost map).
 */
export function stripEnclosedFortifications(tower: Tower): Tower {
  const shell = tower.shell ?? {};
  const keys = Object.keys(shell);
  if (keys.length === 0) return tower;

  let nextShell: Record<string, ShellCell> | null = null;
  for (const key of keys) {
    const { col, row } = parseKey(key);
    if (hasStructure(tower, col, row) && isExteriorFramingCell(tower, col, row)) {
      continue;
    }
    nextShell ??= { ...shell };
    delete nextShell[key];
  }
  return nextShell ? { ...tower, shell: nextShell } : tower;
}

/** After any structure-occupancy edit: clear orphan shell keys on removed cells, then strip. */
export function reconcileShellAfterStructureEdit(tower: Tower): Tower {
  const shell = tower.shell ?? {};
  let next: Tower = tower;
  const orphanCells: Cell[] = [];
  for (const key of Object.keys(shell)) {
    const cell = parseKey(key);
    if (!hasStructure(tower, cell.col, cell.row)) {
      orphanCells.push(cell);
    }
  }
  if (orphanCells.length > 0) {
    next = clearShellInCells(next, orphanCells);
  }
  return stripEnclosedFortifications(next);
}

export function shellEqual(a: Tower['shell'] | undefined, b: Tower['shell'] | undefined): boolean {
  const sa = a ?? {};
  const sb = b ?? {};
  const keysA = Object.keys(sa).sort();
  const keysB = Object.keys(sb).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    if (sa[keysA[i]].kind !== sb[keysB[i]].kind) return false;
  }
  return true;
}

export function shellBuildCost(tower: Tower): Resources {
  let total = emptyResources();
  for (const cell of Object.values(tower.shell ?? {})) {
    if (!isFortificationId(cell.kind)) continue;
    const bp = getFortificationBlueprint(cell.kind);
    if (bp) total = addResources(total, asResources(bp.cost));
  }
  return total;
}
