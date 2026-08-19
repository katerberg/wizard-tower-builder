import { clearInfraInCells } from '../infra';
import { clearShellInCells, reconcileShellAfterStructureEdit } from '../fortifications/shell';
import { cellKey, parseKey, roomCells } from '../../calculations/grid';
import type { Cell, Tower } from '../types';
import { roomAt } from './query';
import { getUnstableStructureIds } from './stability';

export interface RemovalDelta {
  removedRoomIds: string[];
  removedStructureIds: string[];
  clearedCells: Cell[];
}

/** Remove a room; keep structure, infra, and shell. */
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
    shell: tower.shell ?? {},
  };
}

/**
 * Remove a structure piece, clear infra in its cells, and destroy any rooms
 * that covered those cells.
 */
export function removeStructure(tower: Tower, structureId: string): Tower {
  return removeStructureDetailed(tower, structureId).tower;
}

/** Like {@link removeStructure} but returns which rooms/cells were cleared. */
export function removeStructureDetailed(tower: Tower, structureId: string): {
  tower: Tower;
  delta: RemovalDelta;
} {
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
    shell: tower.shell ?? {},
  };
  next = clearInfraInCells(next, cellsToClear);
  next = clearShellInCells(next, cellsToClear);
  for (const roomId of roomIdsToRemove) {
    next = removeRoom(next, roomId);
  }
  next = reconcileShellAfterStructureEdit(next);
  return {
    tower: next,
    delta: {
      removedRoomIds: [...roomIdsToRemove],
      removedStructureIds: [structureId],
      clearedCells: cellsToClear,
    },
  };
}

/** Footprint cells for a room id (empty if missing). */
export function roomFootprintCells(tower: Tower, roomId: string): Cell[] {
  const room = tower.rooms.find((r) => r.id === roomId);
  if (!room) return [];
  return roomCells(room.origin, room.size);
}

/**
 * Repeatedly remove unsupported / disconnected framing until the tower is stable.
 * Rooms and infra on cascading pieces are cleared via {@link removeStructure}.
 */
export function cascadeUnsupportedStructures(
  tower: Tower,
  overhangUnlocked = false,
): {
  tower: Tower;
  delta: RemovalDelta;
} {
  let next = tower;
  const removedRoomIds = new Set<string>();
  const removedStructureIds = new Set<string>();
  const clearedKeys = new Set<string>();
  const clearedCells: Cell[] = [];

  const maxPasses = (tower.structures ?? []).length + 1;
  for (let pass = 0; pass < maxPasses; pass++) {
    const invalid = [...getUnstableStructureIds(next, overhangUnlocked)];
    if (invalid.length === 0) break;
    let removedThisPass = 0;
    for (const id of invalid) {
      if (!(next.structures ?? []).some((s) => s.id === id)) continue;
      const result = removeStructureDetailed(next, id);
      next = result.tower;
      removedThisPass += 1;
      for (const roomId of result.delta.removedRoomIds) removedRoomIds.add(roomId);
      for (const structureId of result.delta.removedStructureIds) removedStructureIds.add(structureId);
      for (const cell of result.delta.clearedCells) {
        const key = cellKey(cell.col, cell.row);
        if (clearedKeys.has(key)) continue;
        clearedKeys.add(key);
        clearedCells.push(cell);
      }
    }
    if (removedThisPass === 0) break;
  }

  return {
    tower: next,
    delta: {
      removedRoomIds: [...removedRoomIds],
      removedStructureIds: [...removedStructureIds],
      clearedCells,
    },
  };
}
