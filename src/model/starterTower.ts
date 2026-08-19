import { getBlueprint } from './blueprints';
import {
  STARTER_QUARTERS_ROOM_ID,
  STARTER_SUPPLY_METAL,
  STARTER_SUPPLY_ROOM_ID,
  STARTER_SUPPLY_STONE,
  STARTER_SUPPLY_CAPACITY,
} from '@/config/storage';
import { DAY_DURATION } from '@/config/dayNight';
import {
  createRoom,
  createStructure,
  createTower,
  placeRoomReplacing,
  placeStructure,
} from './tower';
import { registerStorageSite } from './storage';
import type { Cell, GameState, Tower } from './types';

export interface StarterStructurePlacement {
  blueprintId: string;
  origin: Cell;
}

export interface StarterRoomPlacement {
  blueprintId: string;
  origin: Cell;
}

/**
 * Pre-built starter framing: two side-by-side spire columns on a shared base,
 * with ground-floor supply/quarters wings (cols 5, 9) and a starter turret.
 *
 * ```text
 * row 4:  I . I     twin crowns
 * row 3:  I . I
 * row 2:  * . I     turret on the left column
 * row 1:  I . I
 * row 0:  B I I I B   supply (B) and quarters (B) wings + shared base
 * ```
 */
export const STARTER_STRUCTURE_PLACEMENTS: StarterStructurePlacement[] = [
  { blueprintId: 'stem', origin: { col: 6, row: 0 } },
  { blueprintId: 'stem', origin: { col: 7, row: 0 } },
  { blueprintId: 'stem', origin: { col: 8, row: 0 } },
  { blueprintId: 'stem', origin: { col: 6, row: 1 } },
  { blueprintId: 'stem', origin: { col: 8, row: 1 } },
  { blueprintId: 'stem', origin: { col: 6, row: 3 } },
  { blueprintId: 'stem', origin: { col: 8, row: 2 } },
  { blueprintId: 'stem', origin: { col: 8, row: 3 } },
  { blueprintId: 'stem', origin: { col: 6, row: 4 } },
  { blueprintId: 'stem', origin: { col: 8, row: 4 } },
];

/** Ground-floor facility stems (supply + quarters wings). */
export const STARTER_FACILITY_PLACEMENTS: StarterStructurePlacement[] = [
  { blueprintId: 'stem', origin: { col: 5, row: 0 } },
  { blueprintId: 'stem', origin: { col: 9, row: 0 } },
];

export const STARTER_ROOM_PLACEMENTS: StarterRoomPlacement[] = [
  { blueprintId: 'turretRoom', origin: { col: 6, row: 2 } },
];

/** @deprecated Prefer STARTER_STRUCTURE_PLACEMENTS. */
export const STARTER_TOWER_PLACEMENTS = STARTER_STRUCTURE_PLACEMENTS;

/** Structures after createStarterTower (includes auto-stems under starter rooms). */
export const STARTER_STRUCTURE_COUNT =
  STARTER_STRUCTURE_PLACEMENTS.length +
  STARTER_FACILITY_PLACEMENTS.length +
  STARTER_ROOM_PLACEMENTS.length;

export function createStarterTower(): Tower {
  let tower = createTower();
  const allStructurePlacements = [...STARTER_STRUCTURE_PLACEMENTS, ...STARTER_FACILITY_PLACEMENTS];
  allStructurePlacements.forEach((placement, index) => {
    const blueprint = getBlueprint(placement.blueprintId);
    if (!blueprint) {
      throw new Error(`Unknown starter blueprint: ${placement.blueprintId}`);
    }
    tower = placeStructure(tower, createStructure(`starter-${index}`, blueprint, placement.origin));
  });

  STARTER_ROOM_PLACEMENTS.forEach((placement, index) => {
    const blueprint = getBlueprint(placement.blueprintId);
    if (!blueprint) {
      throw new Error(`Unknown starter room blueprint: ${placement.blueprintId}`);
    }
    const room = createRoom(`starter-room-${index}`, blueprint, placement.origin);
    const placed = placeRoomReplacing(tower, room, blueprint, () => `starter-stem-${index}`);
    if (!placed.ok || !placed.tower) {
      throw new Error(`Failed to place starter room ${placement.blueprintId}`);
    }
    tower = placed.tower;
  });

  const supplyBp = getBlueprint('supplyRoom');
  const quartersBp = getBlueprint('quartersRoom');
  if (!supplyBp || !quartersBp) throw new Error('Starter facility blueprints missing');

  const supply = createRoom(STARTER_SUPPLY_ROOM_ID, supplyBp, { col: 5, row: 0 });
  const placedSupply = placeRoomReplacing(tower, supply, supplyBp);
  if (!placedSupply.ok || !placedSupply.tower) throw new Error('Failed to place starter supply');
  tower = placedSupply.tower;

  const quarters = createRoom(STARTER_QUARTERS_ROOM_ID, quartersBp, { col: 9, row: 0 });
  const placedQuarters = placeRoomReplacing(tower, quarters, quartersBp);
  if (!placedQuarters.ok || !placedQuarters.tower) throw new Error('Failed to place starter quarters');
  tower = placedQuarters.tower;

  return tower;
}

export function initStarterFacilities(state: GameState): void {
  registerStorageSite(state, {
    roomId: STARTER_SUPPLY_ROOM_ID,
    stockpile: { stone: STARTER_SUPPLY_STONE, metal: STARTER_SUPPLY_METAL },
    capacity: STARTER_SUPPLY_CAPACITY,
    locked: true,
  });
  state.housingRecruited[STARTER_QUARTERS_ROOM_ID] = 1;
  state.dayIndex = 1;
  state.phaseTimer = DAY_DURATION;
  state.phasePaused = false;
  state.storageSites = state.storageSites ?? {};
  state.storageReservations = [];
  state.constructionOrders = [];
  state.sideJobs = [];
  state.pendingRecruitSpend = 0;
}
