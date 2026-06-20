import { GRID_COLS, MAX_OVERHANG_STEP, MIN_STABILIZER_WIDTH } from '@/config/constants';
import { cellKey, inBounds, parseKey, roomCells } from '../calculations/grid';
import type { Blueprint, Cell, ExteriorNode, PlacementReason, PlacementResult, Room, Tower } from './types';

export function createTower(): Tower {
  return { rooms: [], occupancy: {} };
}

export function isOccupied(tower: Tower, col: number, row: number): boolean {
  return Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row));
}

export function towerHasStabilizer(tower: Tower): boolean {
  return tower.rooms.some((room) => room.size.w >= MIN_STABILIZER_WIDTH);
}

export function createRoom(id: string, blueprint: Blueprint, origin: Cell): Room {
  return {
    id,
    blueprintId: blueprint.id,
    origin,
    size: { ...blueprint.size },
    contents: [],
    hp: blueprint.baseHp,
    level: 1,
  };
}

function fail(reason: PlacementReason): PlacementResult {
  return { ok: false, reason };
}

const PLACEMENT_PROBE_ID = '__placement_probe__';

/**
 * Single authority for placement legality. A placement is legal exactly when it
 * is in-bounds, non-overlapping, and the *resulting* tower passes
 * {@link validateTower}. Defining placement in terms of the same validity
 * predicate used after a removal guarantees the two can never drift: anything
 * you can build, you can keep; anything that becomes invalid is rejected.
 */
export function canPlace(tower: Tower, blueprint: Blueprint, origin: Cell): PlacementResult {
  const cells = roomCells(origin, blueprint.size);

  for (const c of cells) {
    if (!inBounds(c.col, c.row)) {
      return fail('out_of_bounds');
    }
    if (isOccupied(tower, c.col, c.row)) {
      return fail('overlap');
    }
    
  }

  const candidate = placeRoom(tower, createRoom(PLACEMENT_PROBE_ID, blueprint, origin));
  const analysis = analyzeSupport(candidate);
  const validity = validityFromAnalysis(candidate, analysis);
  if (validity.valid) {
    return { ok: true, reason: 'ok' };
  }

  return fail(classifyNewRoomFailure(candidate, cells, analysis));
}

/** Translate a tower-level invalidity into a placement-specific reason. */
function classifyNewRoomFailure(candidate: Tower, newCells: Cell[], analysis: SupportAnalysis): PlacementReason {
  const unsupported = newCells
    .filter((c) => !analysis.supported.has(cellKey(c.col, c.row)))
    .sort((a, b) => a.row - b.row);

  if (unsupported.length > 0) {
    const cell = unsupported[0];
    const belowCols = supportedColsAt(candidate, analysis, cell.row - 1);
    if (belowCols.length === 0) {
      return 'no_support';
    }
    const minBelow = Math.min(...belowCols);
    const maxBelow = Math.max(...belowCols);
    if (cell.col < minBelow - MAX_OVERHANG_STEP || cell.col > maxBelow + MAX_OVERHANG_STEP) {
      return 'overhang_too_far';
    }
    return 'no_support';
  }

  // Every new cell is supported, so the only remaining way to be invalid is the
  // cantilever stabilizer gate.
  return 'needs_stabilizer';
}

function supportedColsAt(tower: Tower, analysis: SupportAnalysis, row: number): number[] {
  if (row < 0) return [];
  const cols: number[] = [];
  for (const key of Object.keys(tower.occupancy)) {
    const { col, row: r } = parseKey(key);
    if (r === row && analysis.supported.has(key)) {
      cols.push(col);
    }
  }
  return cols;
}

export function placeRoom(tower: Tower, room: Room): Tower {
  const occupancy = { ...tower.occupancy };
  for (const c of roomCells(room.origin, room.size)) {
    occupancy[cellKey(c.col, c.row)] = room.id;
  }
  return { rooms: [...tower.rooms, room], occupancy };
}

export function removeRoom(tower: Tower, roomId: string): Tower {
  const occupancy: Record<string, string> = {};
  for (const [key, id] of Object.entries(tower.occupancy)) {
    if (id !== roomId) {
      occupancy[key] = id;
    }
  }
  return { rooms: tower.rooms.filter((r) => r.id !== roomId), occupancy };
}

export function roomAt(tower: Tower, col: number, row: number): Room | undefined {
  const id = tower.occupancy[cellKey(col, row)];
  if (!id) return undefined;
  return tower.rooms.find((r) => r.id === id);
}

type SupportAnalysis = {
  /** Keys of every cell that is held up (grounded, direct, or 1-step cantilever). */
  supported: Set<string>;
  /** Keys of supported cells whose row-below cell is empty (i.e. they overhang). */
  cantilevered: Set<string>;
};

/**
 * Bottom-up support propagation over the whole tower. A cell is supported if it
 * is grounded (row 0), sits directly on a supported cell, or cantilevers at most
 * one step from the supported span on the row below. A supported cell with no
 * occupied cell directly beneath it is recorded as cantilevered, which the
 * stabilizer gate keys off of.
 */
export function analyzeSupport(tower: Tower): SupportAnalysis {
  const colsByRow = new Map<number, number[]>();
  let maxRow = 0;
  for (const key of Object.keys(tower.occupancy)) {
    const { col, row } = parseKey(key);
    if (!colsByRow.has(row)) colsByRow.set(row, []);
    colsByRow.get(row)!.push(col);
    if (row > maxRow) maxRow = row;
  }

  const supported = new Set<string>();
  const cantilevered = new Set<string>();
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
      if (!isOccupied(tower, c, row - 1)) {
        cantilevered.add(cellKey(c, row));
      }
    }
  }

  return { supported, cantilevered };
}

export type TowerValidity = {
  valid: boolean;
  /** Rooms that make the tower invalid (floating, or illegally cantilevered). */
  invalidRoomIds: Set<string>;
  reason: PlacementReason;
};

function validityFromAnalysis(tower: Tower, analysis: SupportAnalysis): TowerValidity {
  const invalidRoomIds = new Set<string>();

  for (const room of tower.rooms) {
    for (const c of roomCells(room.origin, room.size)) {
      if (!analysis.supported.has(cellKey(c.col, c.row))) {
        invalidRoomIds.add(room.id);
        break;
      }
    }
  }
  let reason: PlacementReason = invalidRoomIds.size > 0 ? 'no_support' : 'ok';

  // Stabilizer gate as a snapshot invariant: if any cell relies on a cantilever,
  // the tower must contain a width>=2 stabilizer room. This is the same rule the
  // placement check enforces, so it also catches a tower whose stabilizer was
  // removed after the fact.
  if (analysis.cantilevered.size > 0 && !towerHasStabilizer(tower)) {
    for (const room of tower.rooms) {
      for (const c of roomCells(room.origin, room.size)) {
        if (analysis.cantilevered.has(cellKey(c.col, c.row))) {
          invalidRoomIds.add(room.id);
          break;
        }
      }
    }
    if (reason === 'ok') reason = 'needs_stabilizer';
  }

  return { valid: invalidRoomIds.size === 0, invalidRoomIds, reason };
}

/**
 * The single "is this build valid?" predicate. Used by {@link canPlace} on the
 * prospective tower and by the store/views after a removal, so placement rules
 * and the stability check can never disagree.
 */
export function validateTower(tower: Tower): TowerValidity {
  return validityFromAnalysis(tower, analyzeSupport(tower));
}

/** Ids of rooms that make the tower invalid (floating or illegally cantilevered). */
export function getUnstableRoomIds(tower: Tower): Set<string> {
  return validateTower(tower).invalidRoomIds;
}

export function isTowerStable(tower: Tower): boolean {
  return validateTower(tower).valid;
}

/** Top-center exterior node, just above the highest occupied row. */
export function getWizardPosition(tower: Tower): ExteriorNode {
  if (tower.rooms.length === 0) {
    return { col: Math.floor(GRID_COLS / 2), row: 0, face: 'top' };
  }
  let topRow = 0;
  for (const key of Object.keys(tower.occupancy)) {
    const { row } = parseKey(key);
    if (row > topRow) topRow = row;
  }
  const colsAtTop: number[] = [];
  for (const key of Object.keys(tower.occupancy)) {
    const { col, row } = parseKey(key);
    if (row === topRow) colsAtTop.push(col);
  }
  const centerCol = Math.round((Math.min(...colsAtTop) + Math.max(...colsAtTop)) / 2);
  return { col: centerCol, row: topRow + 1, face: 'top' };
}
