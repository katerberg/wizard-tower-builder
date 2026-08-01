import { clearInfraInCells } from '../infra';
import { parseKey } from '../../calculations/grid';
import type { Cell, Tower } from '../types';
import { roomAt } from './query';

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
