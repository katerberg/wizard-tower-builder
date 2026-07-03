import { GRID_COLS, MAX_OVERHANG_STEP } from '@/config/constants';
import { cellKey, inBounds, parseKey, roomCells } from '../calculations/grid';
import type { Blueprint, Cell, ExteriorNode, PlacementReason, PlacementResult, Room, Tower } from './types';

export function createTower(): Tower {
  return { rooms: [], occupancy: {} };
}

export function isOccupied(tower: Tower, col: number, row: number): boolean {
  return Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row));
}

function isSpireRoom(room: Room): boolean {
  return room.size.w === 1;
}

/** Orthogonal neighbors among occupied cells. */
function occupancyComponents(tower: Tower): Set<string>[] {
  const occupied = new Set(Object.keys(tower.occupancy));
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
  return occupancyComponents(tower).length <= 1;
}

/** Room ids in every component except the main (largest) one. */
function disconnectedRoomIds(tower: Tower): Set<string> {
  const components = occupancyComponents(tower);
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
      bad.add(tower.occupancy[key]);
    }
  }
  return bad;
}

function newCellsTouchTower(tower: Tower, newCells: Cell[]): boolean {
  if (Object.keys(tower.occupancy).length === 0) return true;
  const occupied = new Set(Object.keys(tower.occupancy));
  for (const c of newCells) {
    const neighbors = [
      cellKey(c.col + 1, c.row),
      cellKey(c.col - 1, c.row),
      cellKey(c.col, c.row + 1),
      cellKey(c.col, c.row - 1),
    ];
    for (const n of neighbors) {
      if (occupied.has(n)) return true;
    }
  }
  return false;
}

/** Spire cells above row 0 must have an occupied cell directly below (spire or buttress). */
function spireViolations(tower: Tower): Room[] {
  const bad: Room[] = [];
  for (const room of tower.rooms) {
    if (!isSpireRoom(room)) continue;
    for (const c of roomCells(room.origin, room.size)) {
      if (c.row === 0) continue;
      if (!isOccupied(tower, c.col, c.row - 1)) {
        bad.push(room);
        break;
      }
    }
  }
  return bad;
}

export function createRoom(id: string, blueprint: Blueprint, origin: Cell): Room {
  return {
    id,
    blueprintId: blueprint.id,
    origin,
    size: { ...blueprint.size },
    modifications: [],
    hp: blueprint.baseHp,
  };
}

function fail(reason: PlacementReason): PlacementResult {
  return { ok: false, reason };
}

const PLACEMENT_PROBE_ID = '__placement_probe__';

/**
 * Strip rooms fully contained in the footprint. Partial overlap (e.g. corner of a
 * buttress) is rejected so replace behaves like sell-then-place for covered cells.
 */
export function clearReplaceableFootprint(
  tower: Tower,
  footprint: Cell[],
): { ok: true; tower: Tower } | { ok: false; reason: PlacementReason } {
  for (const c of footprint) {
    if (!inBounds(c.col, c.row)) {
      return { ok: false, reason: 'out_of_bounds' };
    }
  }

  const footKeys = new Set(footprint.map((c) => cellKey(c.col, c.row)));
  const roomIds = new Set<string>();
  for (const c of footprint) {
    const room = roomAt(tower, c.col, c.row);
    if (room) roomIds.add(room.id);
  }

  for (const roomId of roomIds) {
    const room = tower.rooms.find((r) => r.id === roomId);
    if (!room) continue;
    for (const c of roomCells(room.origin, room.size)) {
      if (!footKeys.has(cellKey(c.col, c.row))) {
        return { ok: false, reason: 'overlap' };
      }
    }
  }

  let cleared = tower;
  for (const roomId of roomIds) {
    cleared = removeRoom(cleared, roomId);
  }
  return { ok: true, tower: cleared };
}

/**
 * Single authority for placement legality during build planning. A placement is
 * legal when in-bounds, non-overlapping (or fully replacing covered rooms),
 * orthogonally adjacent to existing structure, and the new cells satisfy support
 * rules. The full tower need not be stable yet — disconnected or floating
 * existing rooms can be repaired incrementally; {@link isTowerStable} gates wave start.
 */
export function canPlace(tower: Tower, blueprint: Blueprint, origin: Cell): PlacementResult {
  const cells = roomCells(origin, blueprint.size);
  const cleared = clearReplaceableFootprint(tower, cells);
  if (!cleared.ok) {
    return fail(cleared.reason);
  }

  if (!newCellsTouchTower(cleared.tower, cells)) {
    return fail('disconnected');
  }

  const candidate = placeRoom(cleared.tower, createRoom(PLACEMENT_PROBE_ID, blueprint, origin));
  const analysis = analyzeSupport(candidate);
  const newPlacement = validateNewPlacement(candidate, cells, analysis, blueprint);
  if (newPlacement === 'ok') {
    return { ok: true, reason: 'ok' };
  }

  return fail(newPlacement);
}

/** Place a room, removing any fully covered rooms under its footprint first. */
export function placeRoomReplacing(tower: Tower, room: Room, blueprint: Blueprint): PlacementResult & { tower?: Tower } {
  const cells = roomCells(room.origin, room.size);
  const cleared = clearReplaceableFootprint(tower, cells);
  if (!cleared.ok) {
    return fail(cleared.reason);
  }

  const legality = canPlace(cleared.tower, blueprint, room.origin);
  if (!legality.ok) {
    return legality;
  }

  return { ok: true, reason: 'ok', tower: placeRoom(cleared.tower, room) };
}

/** Support and spire rules for the cells being placed — not whole-tower validity. */
function validateNewPlacement(
  candidate: Tower,
  newCells: Cell[],
  analysis: SupportAnalysis,
  blueprint: Blueprint,
): PlacementReason | 'ok' {
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

  if (blueprint.size.w === 1) {
    for (const c of newCells) {
      if (c.row > 0 && !isOccupied(candidate, c.col, c.row - 1)) {
        return 'no_support';
      }
    }
  }

  return 'ok';
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

interface SupportAnalysis {
  /** Keys of every cell that is held up (grounded, direct, or 1-step cantilever). */
  supported: Set<string>;
}

/**
 * Bottom-up support propagation. Buttress rooms may cantilever at most one step
 * beyond the supported span on the row below. Spire cells must have an occupied
 * cell directly beneath them — only buttress may overhang empty space.
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
  /** Rooms that make the tower invalid (floating or breaking spire/buttress rules). */
  invalidRoomIds: Set<string>;
  reason: PlacementReason;
}

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

  for (const room of spireViolations(tower)) {
    invalidRoomIds.add(room.id);
    if (reason === 'ok') reason = 'no_support';
  }

  for (const roomId of disconnectedRoomIds(tower)) {
    invalidRoomIds.add(roomId);
    if (reason === 'ok') reason = 'disconnected';
  }

  return { valid: invalidRoomIds.size === 0, invalidRoomIds, reason };
}

/**
 * The single "is this build valid?" predicate. Used by {@link canPlace} on the
 * prospective tower and by the store/views after a removal.
 */
export function validateTower(tower: Tower): TowerValidity {
  return validityFromAnalysis(tower, analyzeSupport(tower));
}

/** Ids of rooms that make the tower invalid. */
export function getUnstableRoomIds(tower: Tower): Set<string> {
  return validateTower(tower).invalidRoomIds;
}

export function isTowerStable(tower: Tower): boolean {
  return validateTower(tower).valid;
}

/** Contiguous top-row spans at the highest occupied row. */
function topRowSpans(tower: Tower, topRow: number): { min: number; max: number }[] {
  const cols = Object.keys(tower.occupancy)
    .map(parseKey)
    .filter(({ row }) => row === topRow)
    .map(({ col }) => col)
    .sort((a, b) => a - b);

  if (cols.length === 0) return [];

  const spans: { min: number; max: number }[] = [];
  let runMin = cols[0];
  let runMax = cols[0];
  for (let i = 1; i < cols.length; i++) {
    if (cols[i] === runMax + 1) {
      runMax = cols[i];
    } else {
      spans.push({ min: runMin, max: runMax });
      runMin = cols[i];
      runMax = cols[i];
    }
  }
  spans.push({ min: runMin, max: runMax });
  return spans;
}

export interface TowerExtents {
  /** Highest occupied row, or -1 when the tower is empty. */
  maxOccupiedRow: number;
  /** Exterior row of the wizard perch (topRow + 1). */
  wizardRow: number;
}

/** Vertical span of the tower in grid rows — used by air bounds and camera clamping. */
export function towerExtents(tower: Tower): TowerExtents {
  if (tower.rooms.length === 0) {
    return { maxOccupiedRow: -1, wizardRow: 0 };
  }
  let maxOccupiedRow = 0;
  for (const key of Object.keys(tower.occupancy)) {
    const { row } = parseKey(key);
    if (row > maxOccupiedRow) maxOccupiedRow = row;
  }
  return { maxOccupiedRow, wizardRow: maxOccupiedRow + 1 };
}

function modificationsEqual(a: Room['modifications'], b: Room['modifications']): boolean {
  if (a.length !== b.length) return false;
  const norm = (mods: Room['modifications']) =>
    [...mods].sort((x, y) => x.id.localeCompare(y.id)).map((m) => `${m.id}:${m.level}`);
  const sa = norm(a);
  const sb = norm(b);
  return sa.every((v, i) => v === sb[i]);
}

function roomsEqual(a: Room, b: Room): boolean {
  return (
    a.blueprintId === b.blueprintId &&
    a.origin.col === b.origin.col &&
    a.origin.row === b.origin.row &&
    a.size.w === b.size.w &&
    a.size.h === b.size.h &&
    a.hp === b.hp &&
    modificationsEqual(a.modifications, b.modifications)
  );
}

/** Structural equality for build-phase revert checks. */
export function towersEqual(a: Tower, b: Tower): boolean {
  const keysA = Object.keys(a.occupancy).sort();
  const keysB = Object.keys(b.occupancy).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i] || a.occupancy[keysA[i]] !== b.occupancy[keysB[i]]) return false;
  }
  if (a.rooms.length !== b.rooms.length) return false;
  const byIdA = new Map(a.rooms.map((r) => [r.id, r]));
  for (const room of b.rooms) {
    const other = byIdA.get(room.id);
    if (!other || !roomsEqual(room, other)) return false;
  }
  return true;
}

/**
 * Top-center exterior node, just above the highest occupied row. When several
 * disconnected towers share that row, the wizard stands on the left-most one.
 */
export function getWizardPosition(tower: Tower): ExteriorNode {
  if (tower.rooms.length === 0) {
    return { col: Math.floor(GRID_COLS / 2), row: 0, face: 'top' };
  }

  let topRow = 0;
  for (const key of Object.keys(tower.occupancy)) {
    const { row } = parseKey(key);
    if (row > topRow) topRow = row;
  }

  const spans = topRowSpans(tower, topRow);
  const span = spans[0] ?? { min: Math.floor(GRID_COLS / 2), max: Math.floor(GRID_COLS / 2) };
  const centerCol = Math.round((span.min + span.max) / 2);

  return { col: centerCol, row: topRow + 1, face: 'top' };
}
