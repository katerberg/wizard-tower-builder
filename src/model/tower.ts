import { clearInfraInCells, infraEqual } from './infra';
import { getBlueprint, isStructureBlueprint } from './blueprints';
import { GRID_COLS, MAX_OVERHANG_STEP, SUB_CELLS_PER_MACRO } from '@/config/constants';
import { perchSubRow } from '../calculations/subGrid';
import { cellKey, inBounds, parseKey, roomCells } from '../calculations/grid';
import type {
  Blueprint,
  Cell,
  ExteriorNode,
  PlacementReason,
  PlacementResult,
  Room,
  Structure,
  Tower,
} from './types';

export function createTower(): Tower {
  return { structures: [], structureOccupancy: {}, rooms: [], occupancy: {}, infra: {} };
}

/** True when framing occupies the cell (physics / crawler mass). */
export function hasStructure(tower: Tower, col: number, row: number): boolean {
  return Object.prototype.hasOwnProperty.call(tower.structureOccupancy ?? {}, cellKey(col, row));
}

/** @deprecated Prefer {@link hasStructure} — occupancy now means rooms. */
export function isOccupied(tower: Tower, col: number, row: number): boolean {
  return hasStructure(tower, col, row);
}

export function hasRoomAt(tower: Tower, col: number, row: number): boolean {
  return Object.prototype.hasOwnProperty.call(tower.occupancy, cellKey(col, row));
}

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

function newCellsTouchStructure(tower: Tower, newCells: Cell[]): boolean {
  if (structureKeys(tower).length === 0) return true;
  const occupied = new Set(structureKeys(tower));
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

export function createStructure(id: string, blueprint: Blueprint, origin: Cell): Structure {
  return {
    id,
    blueprintId: blueprint.id,
    origin,
    size: { ...blueprint.size },
    hp: blueprint.baseHp,
  };
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
 * Strip structures fully contained in the footprint. Partial overlap is rejected.
 * Also strips rooms and infra on those cells (structure replace rebuilds framing).
 */
export function clearReplaceableStructureFootprint(
  tower: Tower,
  footprint: Cell[],
): { ok: true; tower: Tower } | { ok: false; reason: PlacementReason } {
  for (const c of footprint) {
    if (!inBounds(c.col, c.row)) {
      return { ok: false, reason: 'out_of_bounds' };
    }
  }

  const footKeys = new Set(footprint.map((c) => cellKey(c.col, c.row)));
  const structureIds = new Set<string>();
  for (const c of footprint) {
    const piece = structureAt(tower, c.col, c.row);
    if (piece) structureIds.add(piece.id);
  }

  for (const structureId of structureIds) {
    const piece = tower.structures.find((s) => s.id === structureId);
    if (!piece) continue;
    for (const c of roomCells(piece.origin, piece.size)) {
      if (!footKeys.has(cellKey(c.col, c.row))) {
        return { ok: false, reason: 'overlap' };
      }
    }
  }

  let cleared = tower;
  for (const structureId of structureIds) {
    cleared = removeStructure(cleared, structureId);
  }
  return { ok: true, tower: cleared };
}

/**
 * Strip rooms fully contained in the footprint. Keeps structure and infra.
 */
export function clearReplaceableRoomFootprint(
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

/** @deprecated Prefer clearReplaceableRoomFootprint / clearReplaceableStructureFootprint. */
export function clearReplaceableFootprint(
  tower: Tower,
  footprint: Cell[],
): { ok: true; tower: Tower } | { ok: false; reason: PlacementReason } {
  return clearReplaceableStructureFootprint(tower, footprint);
}

function validateNewStructurePlacement(
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
      if (c.row > 0 && !hasStructure(candidate, c.col, c.row - 1)) {
        return 'no_support';
      }
    }
  }

  return 'ok';
}

function supportedColsAt(tower: Tower, analysis: SupportAnalysis, row: number): number[] {
  if (row < 0) return [];
  const cols: number[] = [];
  for (const key of structureKeys(tower)) {
    const { col, row: r } = parseKey(key);
    if (r === row && analysis.supported.has(key)) {
      cols.push(col);
    }
  }
  return cols;
}

export function canPlaceStructure(tower: Tower, blueprint: Blueprint, origin: Cell): PlacementResult {
  if (!isStructureBlueprint(blueprint)) {
    return fail('overlap');
  }
  const cells = roomCells(origin, blueprint.size);
  const cleared = clearReplaceableStructureFootprint(tower, cells);
  if (!cleared.ok) {
    return fail(cleared.reason);
  }

  if (!newCellsTouchStructure(cleared.tower, cells)) {
    return fail('disconnected');
  }

  const candidate = placeStructure(cleared.tower, createStructure(PLACEMENT_PROBE_ID, blueprint, origin));
  const analysis = analyzeSupport(candidate);
  const newPlacement = validateNewStructurePlacement(candidate, cells, analysis, blueprint);
  if (newPlacement === 'ok') {
    return { ok: true, reason: 'ok' };
  }
  return fail(newPlacement);
}

export interface RoomPlacementPlan {
  ok: boolean;
  reason: PlacementReason;
  /** Cells that need a new Spire Block under the room footprint. */
  stemCells: Cell[];
}

/** Plan room placement: replace covered rooms, auto-stem missing framing. */
export function planRoomPlacement(tower: Tower, blueprint: Blueprint, origin: Cell): RoomPlacementPlan {
  if (isStructureBlueprint(blueprint) || blueprint.category === 'infra') {
    return { ok: false, reason: 'overlap', stemCells: [] };
  }
  const cells = roomCells(origin, blueprint.size);
  const cleared = clearReplaceableRoomFootprint(tower, cells);
  if (!cleared.ok) {
    return { ok: false, reason: cleared.reason, stemCells: [] };
  }

  const stem = getBlueprint('stem');
  if (!stem) {
    return { ok: false, reason: 'no_support', stemCells: [] };
  }

  const stemCells: Cell[] = [];
  let probe = cleared.tower;
  const ordered = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const cell of ordered) {
    if (hasStructure(probe, cell.col, cell.row)) continue;
    const stemResult = canPlaceStructure(probe, stem, cell);
    if (!stemResult.ok) {
      return { ok: false, reason: stemResult.reason, stemCells: [] };
    }
    stemCells.push(cell);
    probe = placeStructure(probe, createStructure(`${PLACEMENT_PROBE_ID}-stem-${stemCells.length}`, stem, cell));
  }

  return { ok: true, reason: 'ok', stemCells };
}

export function canPlaceRoom(tower: Tower, blueprint: Blueprint, origin: Cell): PlacementResult {
  const plan = planRoomPlacement(tower, blueprint, origin);
  return { ok: plan.ok, reason: plan.reason };
}

/**
 * Dispatch placement legality by blueprint category.
 * Structure blueprints use framing rules; rooms auto-stem as needed.
 */
export function canPlace(tower: Tower, blueprint: Blueprint, origin: Cell): PlacementResult {
  if (isStructureBlueprint(blueprint)) {
    return canPlaceStructure(tower, blueprint, origin);
  }
  return canPlaceRoom(tower, blueprint, origin);
}

export function placeStructure(tower: Tower, structure: Structure): Tower {
  const structureOccupancy = { ...(tower.structureOccupancy ?? {}) };
  for (const c of roomCells(structure.origin, structure.size)) {
    structureOccupancy[cellKey(c.col, c.row)] = structure.id;
  }
  return {
    ...tower,
    structures: [...(tower.structures ?? []), structure],
    structureOccupancy,
    rooms: tower.rooms ?? [],
    occupancy: tower.occupancy ?? {},
    infra: tower.infra ?? {},
  };
}

export function placeRoom(tower: Tower, room: Room): Tower {
  const occupancy = { ...tower.occupancy };
  for (const c of roomCells(room.origin, room.size)) {
    occupancy[cellKey(c.col, c.row)] = room.id;
  }
  return {
    ...tower,
    structures: tower.structures ?? [],
    structureOccupancy: tower.structureOccupancy ?? {},
    rooms: [...tower.rooms, room],
    occupancy,
    infra: tower.infra ?? {},
  };
}

/** Place a structure, removing fully covered structures (and their rooms/infra) first. */
export function placeStructureReplacing(
  tower: Tower,
  structure: Structure,
  blueprint: Blueprint,
): PlacementResult & { tower?: Tower } {
  const cells = roomCells(structure.origin, structure.size);
  const cleared = clearReplaceableStructureFootprint(tower, cells);
  if (!cleared.ok) {
    return fail(cleared.reason);
  }
  const legality = canPlaceStructure(cleared.tower, blueprint, structure.origin);
  if (!legality.ok) {
    return legality;
  }
  return { ok: true, reason: 'ok', tower: placeStructure(cleared.tower, structure) };
}

/**
 * Place a room with auto-stems. Removes fully covered rooms first; keeps infra.
 * `nextId` supplies ids for auto-placed stems and is called once per stem.
 */
export function placeRoomReplacing(
  tower: Tower,
  room: Room,
  blueprint: Blueprint,
  nextId: () => string = () => PLACEMENT_PROBE_ID,
): PlacementResult & { tower?: Tower } {
  const plan = planRoomPlacement(tower, blueprint, room.origin);
  if (!plan.ok) {
    return fail(plan.reason);
  }

  const stem = getBlueprint('stem');
  if (!stem) {
    return fail('no_support');
  }

  const cleared = clearReplaceableRoomFootprint(tower, roomCells(room.origin, room.size));
  if (!cleared.ok) {
    return fail(cleared.reason);
  }

  let next = cleared.tower;
  for (const cell of plan.stemCells) {
    next = placeStructure(next, createStructure(nextId(), stem, cell));
  }
  next = placeRoom(next, room);
  return { ok: true, reason: 'ok', tower: next };
}

/** Remove a room; keep structure and infra. */
export function removeRoom(tower: Tower, roomId: string): Tower {
  const occupancy: Record<string, string> = {};
  for (const [key, id] of Object.entries(tower.occupancy)) {
    if (id !== roomId) {
      occupancy[key] = id;
    }
  }
  return {
    ...tower,
    structures: tower.structures ?? [],
    structureOccupancy: tower.structureOccupancy ?? {},
    rooms: tower.rooms.filter((r) => r.id !== roomId),
    occupancy,
    infra: tower.infra ?? {},
  };
}

/**
 * Remove a structure piece, clear infra in its cells, and destroy any rooms
 * that covered those cells.
 */
export function removeStructure(tower: Tower, structureId: string): Tower {
  const cellsToClear: Cell[] = [];
  const structureOccupancy: Record<string, string> = {};
  for (const [key, id] of Object.entries(tower.structureOccupancy ?? {})) {
    if (id !== structureId) {
      structureOccupancy[key] = id;
    } else {
      cellsToClear.push(parseKey(key));
    }
  }

  const roomIdsToRemove = new Set<string>();
  for (const c of cellsToClear) {
    const room = roomAt(tower, c.col, c.row);
    if (room) roomIdsToRemove.add(room.id);
  }

  let next: Tower = {
    ...tower,
    structures: (tower.structures ?? []).filter((s) => s.id !== structureId),
    structureOccupancy,
    rooms: tower.rooms,
    occupancy: tower.occupancy,
    infra: tower.infra ?? {},
  };
  next = clearInfraInCells(next, cellsToClear);
  for (const roomId of roomIdsToRemove) {
    next = removeRoom(next, roomId);
  }
  return next;
}

export function roomAt(tower: Tower, col: number, row: number): Room | undefined {
  const id = tower.occupancy[cellKey(col, row)];
  if (!id) return undefined;
  return tower.rooms.find((r) => r.id === id);
}

export function structureAt(tower: Tower, col: number, row: number): Structure | undefined {
  const id = tower.structureOccupancy?.[cellKey(col, row)];
  if (!id) return undefined;
  return (tower.structures ?? []).find((s) => s.id === id);
}

interface SupportAnalysis {
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

function topRowSpans(tower: Tower, topRow: number): { min: number; max: number }[] {
  const cols = structureKeys(tower)
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
  /** Highest occupied structure row, or -1 when the tower is empty. */
  maxOccupiedRow: number;
  /** Exterior row of the wizard perch (topRow + 1). */
  wizardRow: number;
}

export function towerExtents(tower: Tower): TowerExtents {
  const keys = structureKeys(tower);
  if (keys.length === 0) {
    return { maxOccupiedRow: -1, wizardRow: 0 };
  }
  let maxOccupiedRow = 0;
  for (const key of keys) {
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

function structuresEqual(a: Structure, b: Structure): boolean {
  return (
    a.blueprintId === b.blueprintId &&
    a.origin.col === b.origin.col &&
    a.origin.row === b.origin.row &&
    a.size.w === b.size.w &&
    a.size.h === b.size.h &&
    a.hp === b.hp
  );
}

export function towersEqual(a: Tower, b: Tower): boolean {
  const sKeysA = Object.keys(a.structureOccupancy ?? {}).sort();
  const sKeysB = Object.keys(b.structureOccupancy ?? {}).sort();
  if (sKeysA.length !== sKeysB.length) return false;
  for (let i = 0; i < sKeysA.length; i++) {
    if (sKeysA[i] !== sKeysB[i] || a.structureOccupancy[sKeysA[i]] !== b.structureOccupancy[sKeysB[i]]) {
      return false;
    }
  }
  const keysA = Object.keys(a.occupancy).sort();
  const keysB = Object.keys(b.occupancy).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i] || a.occupancy[keysA[i]] !== b.occupancy[keysB[i]]) return false;
  }
  if ((a.structures ?? []).length !== (b.structures ?? []).length) return false;
  if (a.rooms.length !== b.rooms.length) return false;
  if (!infraEqual(a.infra, b.infra)) return false;
  const structById = new Map((a.structures ?? []).map((s) => [s.id, s]));
  for (const piece of b.structures ?? []) {
    const other = structById.get(piece.id);
    if (!other || !structuresEqual(piece, other)) return false;
  }
  const byIdA = new Map(a.rooms.map((r) => [r.id, r]));
  for (const room of b.rooms) {
    const other = byIdA.get(room.id);
    if (!other || !roomsEqual(room, other)) return false;
  }
  return true;
}

export function getWizardPosition(tower: Tower): ExteriorNode {
  const center = Math.floor(GRID_COLS / 2);
  const keys = structureKeys(tower);
  if (keys.length === 0) {
    return {
      col: center * SUB_CELLS_PER_MACRO + Math.floor(SUB_CELLS_PER_MACRO / 2),
      row: 0,
      face: 'top',
    };
  }

  let topRow = 0;
  for (const key of keys) {
    const { row } = parseKey(key);
    if (row > topRow) topRow = row;
  }

  const spans = topRowSpans(tower, topRow);
  const span = spans[0] ?? { min: center, max: center };
  const centerCol = Math.round((span.min + span.max) / 2);
  const subCol = centerCol * SUB_CELLS_PER_MACRO + Math.floor(SUB_CELLS_PER_MACRO / 2);

  return { col: subCol, row: perchSubRow(topRow), face: 'top' };
}
