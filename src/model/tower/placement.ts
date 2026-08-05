import { getBlueprint, isStructureBlueprint } from '../blueprints';
import { MAX_OVERHANG_STEP } from '@/config/constants';
import { cellKey, inBounds, parseKey, roomCells } from '../../calculations/grid';
import type { Blueprint, Cell, PlacementReason, PlacementResult, Room, Structure, Tower } from '../types';
import { roomAt, structureAt, hasStructure } from './query';
import { analyzeSupport, type SupportAnalysis } from './stability';
import { removeRoom, removeStructure } from './sell';
import { reconcileShellAfterStructureEdit } from '../fortifications/shell';

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

function structureKeys(tower: Tower): string[] {
  return Object.keys(tower.structureOccupancy ?? {});
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
    shell: tower.shell ?? {},
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
    shell: tower.shell ?? {},
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
  const placed = placeStructure(cleared.tower, structure);
  return { ok: true, reason: 'ok', tower: reconcileShellAfterStructureEdit(placed) };
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
  next = reconcileShellAfterStructureEdit(next);
  return { ok: true, reason: 'ok', tower: next };
}
