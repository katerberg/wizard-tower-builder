import { cellKey, roomCells } from '@/calculations/grid';
import { addMessage } from '../messages';
import { lockPipeFluids } from '../pipes';
import { activeHotbarSpellIds, refreshLeylineSpellState } from '../spells/progression';
import type { RemovalDelta } from '../tower/sell';
import type { Cell, GameState, StaffKind, StaffUnit } from '../types';
import { maybeWizardCollapseFall } from '../wizard';
import {
  housingCapacity,
  housingKindOf,
  pruneHousingState,
  pruneOrphanStaffState,
  staffKindForHousing,
} from './assign';
import { maxWaterReachRow } from './harvest';

function cellSet(cells: Cell[]): Set<string> {
  return new Set(cells.map((c) => cellKey(c.col, c.row)));
}

function staffOnCells(state: GameState, keys: Set<string>): StaffUnit[] {
  return state.staff.filter((s) => keys.has(cellKey(s.pos.col, s.pos.row)));
}

function countHomeOccupants(state: GameState, housingId: string): number {
  return state.staff.filter((s) => s.homeHousingId === housingId).length;
}

function findSpareHousing(state: GameState, kind: StaffKind, exceptRoomId: string): string | null {
  for (const room of state.tower.rooms) {
    if (room.id === exceptRoomId) continue;
    const housing = housingKindOf(room);
    if (!housing || staffKindForHousing(housing) !== kind) continue;
    const cap = housingCapacity(room);
    const occupants = countHomeOccupants(state, room.id);
    if (occupants < cap) return room.id;
  }
  return null;
}

/** Instantly rehome or mark homeless when housing is destroyed. */
function rehomeOrAbandon(state: GameState, destroyedHousingId: string, kind: StaffKind): void {
  const displaced = state.staff.filter((s) => s.homeHousingId === destroyedHousingId);
  for (const unit of displaced) {
    const spare = findSpareHousing(state, kind, destroyedHousingId);
    if (spare) {
      unit.homeHousingId = spare;
      state.housingRecruited[spare] = (state.housingRecruited[spare] ?? 0) + 1;
      addMessage(state, `${kind} finds shelter in spare housing.`, 'info');
    } else {
      unit.homeHousingId = '';
      addMessage(state, `${kind} is left without housing for the rest of the wave.`, 'info');
    }
  }
}

function idleWorkplace(state: GameState, workplaceId: string): void {
  for (const unit of state.staff) {
    if (unit.targetWorkplaceId !== workplaceId) continue;
    unit.targetWorkplaceId = null;
    unit.path = [];
    unit.pathIndex = 0;
    unit.status = 'idle';
    unit.elevatorShaftId = undefined;
    unit.elevatorExitRow = undefined;
    unit.elevatorExitPathIndex = undefined;
    unit.elevatorWaitElapsed = undefined;
  }
}

/**
 * After rooms/structures are destroyed mid-wave: kill staff on cleared cells,
 * rehome or abandon displaced housing, idle lost workplaces, clear enemy paths,
 * and re-lock pipe fluids from live topology.
 */
export function applyDestructionAftermath(state: GameState, delta: RemovalDelta): void {
  const cleared = cellSet(delta.clearedCells);
  const prevSpells = activeHotbarSpellIds(state);

  // Rooms removed without framing clear still kill staff standing on their footprint
  // (caller should include those cells in clearedCells).
  const casualties = staffOnCells(state, cleared);
  if (casualties.length > 0) {
    const deadIds = new Set(casualties.map((s) => s.id));
    for (const unit of casualties) {
      if (unit.homeHousingId) {
        const recruited = state.housingRecruited[unit.homeHousingId] ?? 0;
        if (recruited > 0) {
          state.housingRecruited[unit.homeHousingId] = recruited - 1;
        }
      }
      addMessage(state, `A ${unit.kind} is lost in the collapse.`, 'combat');
    }
    state.staff = state.staff.filter((s) => !deadIds.has(s.id));
  }

  for (const roomId of delta.removedRoomIds) {
    const kindHousing = (() => {
      // Room already gone from tower — infer kind from remaining staff homes / prior blueprint via staff.
      const sample = state.staff.find((s) => s.homeHousingId === roomId);
      return sample?.kind ?? null;
    })();
    if (kindHousing) {
      rehomeOrAbandon(state, roomId, kindHousing);
    }
    pruneHousingState(state, roomId);
    idleWorkplace(state, roomId);
  }

  for (const structureId of delta.removedStructureIds) {
    idleWorkplace(state, structureId);
  }

  pruneOrphanStaffState(state);

  // Clamp recruited counts to living housing capacity (supply limits).
  for (const room of state.tower.rooms) {
    const housing = housingKindOf(room);
    if (!housing) continue;
    const cap = housingCapacity(room);
    const recruited = state.housingRecruited[room.id] ?? 0;
    if (recruited > cap) state.housingRecruited[room.id] = cap;
  }

  for (const enemy of state.enemies) {
    enemy.path = [];
    enemy.pathIndex = 0;
    enemy.pathGoalKey = undefined;
  }

  maybeWizardCollapseFall(state, cleared);

  state.tower = lockPipeFluids(state.tower, maxWaterReachRow(state));
  refreshLeylineSpellState(state, prevSpells);
}

/** Build a removal delta for a single room destroy (framing kept). */
export function roomRemovalDelta(state: GameState, roomId: string): RemovalDelta {
  const room = state.tower.rooms.find((r) => r.id === roomId);
  const clearedCells = room ? roomCells(room.origin, room.size) : [];
  return {
    removedRoomIds: [roomId],
    removedStructureIds: [],
    clearedCells,
  };
}

/** Merge two removal deltas. */
export function mergeRemovalDeltas(a: RemovalDelta, b: RemovalDelta): RemovalDelta {
  const keys = new Set(a.clearedCells.map((c) => cellKey(c.col, c.row)));
  const clearedCells = [...a.clearedCells];
  for (const cell of b.clearedCells) {
    const key = cellKey(cell.col, cell.row);
    if (keys.has(key)) continue;
    keys.add(key);
    clearedCells.push(cell);
  }
  return {
    removedRoomIds: [...new Set([...a.removedRoomIds, ...b.removedRoomIds])],
    removedStructureIds: [...new Set([...a.removedStructureIds, ...b.removedStructureIds])],
    clearedCells,
  };
}
