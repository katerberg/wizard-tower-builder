import { MAX_OVERHANG_STEP } from '@/config/constants';
import { cellKey, parseKey, roomCells } from '../../calculations/grid';
import type { PlacementReason, Structure, Tower } from '../types';
import { hasStructure } from './query';

function isSpirePiece(size: { w: number; h: number }): boolean {
  return size.w === 1;
}

function structureKeys(tower: Tower): string[] {
  return Object.keys(tower.structureOccupancy ?? {});
}

/** Orthogonal neighbors among structure cells. */
function structureComponents(tower: Tower): Set<string>[] {
  const occupied = new Set(structureKeys(tower));
  if (occupied.size === 0) return [];

  const seen = new Set<string>();
  const components: Set<string>[] = [];

  for (const start of occupied) {
    if (seen.has(start)) continue;
    const component = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
      const key = queue.pop()!;
      if (component.has(key)) continue;
      component.add(key);
      seen.add(key);
      const { col, row } = parseKey(key);
      const neighbors = [
        cellKey(col + 1, row),
        cellKey(col - 1, row),
        cellKey(col, row + 1),
        cellKey(col, row - 1),
      ];
      for (const n of neighbors) {
        if (occupied.has(n) && !component.has(n)) queue.push(n);
      }
    }
    components.push(component);
  }

  return components;
}

export function isTowerConnected(tower: Tower): boolean {
  return structureComponents(tower).length <= 1;
}

/** Structure ids in every component except the main (largest) one. */
function disconnectedStructureIds(tower: Tower): Set<string> {
  const components = structureComponents(tower);
  if (components.length <= 1) return new Set();

  const main = components.reduce((best, comp) => {
    if (comp.size > best.size) return comp;
    if (comp.size < best.size) return best;
    const minKey = (set: Set<string>) =>
      [...set].sort((a, b) => {
        const pa = parseKey(a);
        const pb = parseKey(b);
        return pa.col - pb.col || pa.row - pb.row;
      })[0];
    return minKey(comp) < minKey(best) ? comp : best;
  });

  const bad = new Set<string>();
  for (const comp of components) {
    if (comp === main) continue;
    for (const key of comp) {
      bad.add(tower.structureOccupancy[key]);
    }
  }
  return bad;
}

/** Spire cells above row 0 must have framing directly below. */
function spireViolations(tower: Tower): Structure[] {
  const bad: Structure[] = [];
  for (const piece of tower.structures ?? []) {
    if (!isSpirePiece(piece.size)) continue;
    for (const c of roomCells(piece.origin, piece.size)) {
      if (c.row === 0) continue;
      if (!hasStructure(tower, c.col, c.row - 1)) {
        bad.push(piece);
        break;
      }
    }
  }
  return bad;
}

export interface SupportAnalysis {
  /** Keys of every structure cell that is held up (grounded, direct, or 1-step cantilever). */
  supported: Set<string>;
}

/**
 * Bottom-up support propagation over the structure layer. Buttresses may cantilever
 * at most one step beyond the supported span below. Spires need framing directly beneath.
 */
export function analyzeSupport(tower: Tower): SupportAnalysis {
  const colsByRow = new Map<number, number[]>();
  let maxRow = 0;
  for (const key of structureKeys(tower)) {
    const { col, row } = parseKey(key);
    if (!colsByRow.has(row)) colsByRow.set(row, []);
    colsByRow.get(row)!.push(col);
    if (row > maxRow) maxRow = row;
  }

  const supported = new Set<string>();
  for (const col of colsByRow.get(0) ?? []) {
    supported.add(cellKey(col, 0));
  }

  for (let row = 1; row <= maxRow; row++) {
    const cols = colsByRow.get(row) ?? [];
    if (cols.length === 0) continue;

    const belowSupported = (colsByRow.get(row - 1) ?? []).filter((c) => supported.has(cellKey(c, row - 1)));
    if (belowSupported.length === 0) continue;

    const minBelow = Math.min(...belowSupported);
    const maxBelow = Math.max(...belowSupported);
    const inRange = (c: number) => c >= minBelow - MAX_OVERHANG_STEP && c <= maxBelow + MAX_OVERHANG_STEP;

    const anchored = new Set<number>(cols.filter((c) => supported.has(cellKey(c, row - 1))));
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of cols) {
        if (anchored.has(c) || !inRange(c)) continue;
        if (anchored.has(c - 1) || anchored.has(c + 1)) {
          anchored.add(c);
          changed = true;
        }
      }
    }
    for (const c of anchored) {
      supported.add(cellKey(c, row));
    }
  }

  return { supported };
}

export interface TowerValidity {
  valid: boolean;
  /** Structure ids that make the tower invalid (floating or breaking spire/buttress rules). */
  invalidStructureIds: Set<string>;
  /** @deprecated Prefer invalidStructureIds. */
  invalidRoomIds: Set<string>;
  reason: PlacementReason;
}

function validityFromAnalysis(tower: Tower, analysis: SupportAnalysis): TowerValidity {
  const invalidStructureIds = new Set<string>();

  for (const piece of tower.structures ?? []) {
    for (const c of roomCells(piece.origin, piece.size)) {
      if (!analysis.supported.has(cellKey(c.col, c.row))) {
        invalidStructureIds.add(piece.id);
        break;
      }
    }
  }
  let reason: PlacementReason = invalidStructureIds.size > 0 ? 'no_support' : 'ok';

  for (const piece of spireViolations(tower)) {
    invalidStructureIds.add(piece.id);
    if (reason === 'ok') reason = 'no_support';
  }

  for (const structureId of disconnectedStructureIds(tower)) {
    invalidStructureIds.add(structureId);
    if (reason === 'ok') reason = 'disconnected';
  }

  return {
    valid: invalidStructureIds.size === 0,
    invalidStructureIds,
    invalidRoomIds: invalidStructureIds,
    reason,
  };
}

export function validateTower(tower: Tower): TowerValidity {
  return validityFromAnalysis(tower, analyzeSupport(tower));
}

export function getUnstableStructureIds(tower: Tower): Set<string> {
  return validateTower(tower).invalidStructureIds;
}

/** @deprecated Prefer getUnstableStructureIds. */
export function getUnstableRoomIds(tower: Tower): Set<string> {
  return getUnstableStructureIds(tower);
}

export function isTowerStable(tower: Tower): boolean {
  return validateTower(tower).valid;
}
