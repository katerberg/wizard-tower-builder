import { infraEqual } from '../infra';
import { GRID_COLS, SUB_CELLS_PER_MACRO } from '@/config/constants';
import { perchSubRow } from '../../calculations/subGrid';
import { cellKey, parseKey } from '../../calculations/grid';
import type { ExteriorNode, Room, Structure, Tower } from '../types';

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

function structureKeys(tower: Tower): string[] {
  return Object.keys(tower.structureOccupancy ?? {});
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
