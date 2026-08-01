import { ABRASION_HP_PER_STEP, WEATHERING_HP_PER_SEC } from '@/config/constants';
import { isStoneBuiltBlueprint } from '@/model/blueprints';
import { roomCells } from '@/calculations/grid';
import { roomAt, structureAt } from '@/model/tower';
import type { Cell, GameState, Room, Structure } from '@/model/types';

function isStoneBuiltRoom(room: Room): boolean {
  return isStoneBuiltBlueprint(room.blueprintId);
}

function isStoneBuiltStructure(structure: Structure): boolean {
  return isStoneBuiltBlueprint(structure.blueprintId);
}

/** Passive weathering on stone-built rooms and structures. */
export function tickStoneWeathering(state: GameState, dt: number): void {
  const dmg = WEATHERING_HP_PER_SEC * dt;
  if (dmg <= 0) return;

  for (const room of state.tower.rooms) {
    if (!isStoneBuiltRoom(room)) continue;
    room.hp = Math.max(0, room.hp - dmg);
  }
  for (const structure of state.tower.structures ?? []) {
    if (!isStoneBuiltStructure(structure)) continue;
    const covered = roomCells(structure.origin, structure.size).some((c) => {
      const room = roomAt(state.tower, c.col, c.row);
      return room ? isStoneBuiltRoom(room) : false;
    });
    if (covered) continue;
    structure.hp = Math.max(0, structure.hp - dmg);
  }
}

/**
 * Exterior abrasion: when a climber occupies a surface cell, wear stone-built
 * framing/room on that clung macro cell.
 */
export function applyExteriorAbrasion(state: GameState, cell: Cell): void {
  const room = roomAt(state.tower, cell.col, cell.row);
  if (room && isStoneBuiltRoom(room)) {
    room.hp = Math.max(0, room.hp - ABRASION_HP_PER_STEP);
    return;
  }
  const structure = structureAt(state.tower, cell.col, cell.row);
  if (structure && isStoneBuiltStructure(structure)) {
    structure.hp = Math.max(0, structure.hp - ABRASION_HP_PER_STEP);
  }
}
