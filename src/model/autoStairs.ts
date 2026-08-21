import { GRID_COLS } from '@/config/constants';
import { cellKey } from '@/calculations/grid';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { isSoldierWalkable, roomAnchorCell } from '@/calculations/interiorGraph';
import { hasStructure } from '@/model/tower/query';
import type { Cell, MineState, Room, Tower } from '@/model/types';

export type AutoStairsFailReason = 'no_shaft' | 'disconnected';

export interface AutoStairsResult {
  ok: boolean;
  reason: AutoStairsFailReason | 'ok';
  tower: Tower;
}

export interface WalkableSegment {
  /** Sorted ascending column indices in this contiguous run. */
  cols: number[];
}

/** Contiguous horizontal runs of walkable cells on one row. */
export function horizontalWalkableSegments(
  tower: Tower,
  row: number,
  mine?: MineState | null,
): WalkableSegment[] {
  const cols: number[] = [];
  for (let col = 0; col < GRID_COLS; col++) {
    if (isSoldierWalkable(tower, col, row, mine)) cols.push(col);
  }
  const segments: WalkableSegment[] = [];
  let run: number[] = [];
  for (const col of cols) {
    if (run.length === 0 || col === run[run.length - 1] + 1) {
      run.push(col);
    } else {
      segments.push({ cols: run });
      run = [col];
    }
  }
  if (run.length > 0) segments.push({ cols: run });
  return segments;
}

/** Segment containing `(col, row)`, or null if not walkable. */
export function segmentForCell(
  tower: Tower,
  row: number,
  col: number,
  mine?: MineState | null,
): WalkableSegment | null {
  return (
    horizontalWalkableSegments(tower, row, mine).find((s) => s.cols.includes(col)) ?? null
  );
}

function hasContinuousStructure(tower: Tower, col: number, upToRow: number): boolean {
  for (let r = 0; r <= upToRow; r++) {
    if (!hasStructure(tower, col, r)) return false;
  }
  return true;
}

/**
 * Pick a shaft column for a segment: prefer the opening room's anchor col,
 * then other segment cols left→right. Requires continuous structure 0..upToRow.
 */
export function pickShaftColumn(
  tower: Tower,
  segmentCols: number[],
  preferredCol: number,
  upToRow: number,
): number | null {
  const ordered = [
    preferredCol,
    ...segmentCols.filter((c) => c !== preferredCol).sort((a, b) => a - b),
  ];
  for (const col of ordered) {
    if (!segmentCols.includes(col)) continue;
    if (hasContinuousStructure(tower, col, upToRow)) return col;
  }
  return null;
}

function stripStairInfra(tower: Tower): Tower {
  const infra: Tower['infra'] = {};
  for (const [key, cell] of Object.entries(tower.infra ?? {})) {
    if (cell.kind === 'stair') continue;
    infra[key] = cell;
  }
  return { ...tower, infra };
}

function maxRoomRow(tower: Tower): number {
  let max = 0;
  for (const room of tower.rooms) {
    const top = room.origin.row + room.size.h - 1;
    if (top > max) max = top;
  }
  return max;
}

function collectGroundCells(tower: Tower, mine?: MineState | null): Cell[] {
  const cells: Cell[] = [];
  for (let col = 0; col < GRID_COLS; col++) {
    if (isSoldierWalkable(tower, col, 0, mine)) cells.push({ col, row: 0 });
  }
  return cells;
}

function assignShaftColumns(tower: Tower, mine?: MineState | null): number[] | null {
  const shafts = new Set<number>();

  for (const room of tower.rooms) {
    const anchor = roomAnchorCell(tower, room.origin, room.size, mine);
    if (!anchor) continue;

    const seg = segmentForCell(tower, anchor.row, anchor.col, mine);
    if (!seg) return null;

    const alreadyServed = [...shafts].some((c) => seg.cols.includes(c));
    if (alreadyServed) continue;

    const upToRow = Math.max(
      anchor.row,
      room.origin.row + room.size.h - 1,
    );
    const col = pickShaftColumn(tower, seg.cols, anchor.col, upToRow);
    if (col === null) {
      console.warn(
        `Auto-stairs: no continuous shaft column for room ${room.id} at ${anchor.col},${anchor.row}`,
      );
      return null;
    }
    shafts.add(col);
  }

  return [...shafts];
}

function applyShaftInfra(
  tower: Tower,
  shaftCols: number[],
  upToRow: number,
): Tower {
  const infra = { ...(tower.infra ?? {}) };
  for (const col of shaftCols) {
    for (let row = 0; row <= upToRow; row++) {
      if (!hasStructure(tower, col, row)) continue;
      const key = cellKey(col, row);
      const existing = infra[key];
      if (existing && existing.kind !== 'stair') {
        console.warn(
          `Auto-stairs replaced ${existing.kind} at ${col},${row} (stairs are required per floor)`,
        );
      }
      infra[key] = { kind: 'stair' };
    }
  }
  return { ...tower, infra };
}

function verifyRoomsReachGround(tower: Tower, mine?: MineState | null): boolean {
  const ground = collectGroundCells(tower, mine);
  if (ground.length === 0) {
    // Rooms only on row 0 with walkable anchors still ok if they ARE ground.
    for (const room of tower.rooms) {
      const anchor = roomAnchorCell(tower, room.origin, room.size, mine);
      if (!anchor) continue;
      if (anchor.row !== 0) return false;
    }
    return true;
  }

  for (const room of tower.rooms) {
    const anchor = roomAnchorCell(tower, room.origin, room.size, mine);
    if (!anchor) continue;
    if (anchor.row === 0 && ground.some((g) => g.col === anchor.col && g.row === 0)) {
      continue;
    }
    const connected = ground.some(
      (g) => findInteriorPath(tower, anchor, g, mine).length > 0,
    );
    if (!connected) {
      console.warn(
        `Auto-stairs: room ${room.id} at ${anchor.col},${anchor.row} cannot reach ground`,
      );
      return false;
    }
  }
  return true;
}

/**
 * Full stair reconcile: strip existing stairs, assign one shaft per unserved
 * walkable room-segment, fill structure cells in those columns, verify paths.
 */
export function reconcileAutoStairs(
  tower: Tower,
  mine?: MineState | null,
): AutoStairsResult {
  let next = stripStairInfra(tower);

  if (next.rooms.length === 0) {
    return { ok: true, reason: 'ok', tower: next };
  }

  const shafts = assignShaftColumns(next, mine);
  if (shafts === null) {
    return { ok: false, reason: 'no_shaft', tower };
  }

  const upTo = maxRoomRow(next);
  next = applyShaftInfra(next, shafts, upTo);

  if (!verifyRoomsReachGround(next, mine)) {
    return { ok: false, reason: 'disconnected', tower };
  }

  return { ok: true, reason: 'ok', tower: next };
}

/** Rooms whose anchors fall in a segment (for tests / debugging). */
export function roomsInSegment(
  tower: Tower,
  segment: WalkableSegment,
  row: number,
  mine?: MineState | null,
): Room[] {
  return tower.rooms.filter((room) => {
    const anchor = roomAnchorCell(tower, room.origin, room.size, mine);
    return anchor !== null && anchor.row === row && segment.cols.includes(anchor.col);
  });
}
