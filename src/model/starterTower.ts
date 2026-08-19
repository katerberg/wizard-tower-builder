import { getBlueprint } from './blueprints';
import {
  STARTER_QUARTERS_ROOM_ID,
  STARTER_SUPPLY_METAL,
  STARTER_SUPPLY_ROOM_ID,
  STARTER_SUPPLY_STONE,
  STARTER_SUPPLY_CAPACITY,
} from '@/config/storage';
import { DAY_DURATION } from '@/config/dayNight';
import { createStructure, createRoom, createTower, placeRoomReplacing, placeStructure } from './tower';
import { registerStorageSite } from './storage';
import type { Cell, GameState, Tower } from './types';

export interface StarterPlacement {
  blueprintId: string;
  origin: Cell;
}

/**
 * Pre-built hollow wizard tower for wave 1. Placed bottom-to-top as framing only.
 *
 * ```text
 * row 5:  BB  BB   crown wings cantilever one step past the shaft (cols 5, 9)
 * row 4:  I . I
 * row 3:  I . I
 * row 2:  I . I
 * row 1:  I . I      hollow interior at col 7
 * row 0:  I I I          wide base (cols 6–8)
 * ```
 */
export const STARTER_TOWER_PLACEMENTS: StarterPlacement[] = [
  { blueprintId: 'stem', origin: { col: 6, row: 0 } },
  { blueprintId: 'stem', origin: { col: 7, row: 0 } },
  { blueprintId: 'stem', origin: { col: 8, row: 0 } },
  { blueprintId: 'stem', origin: { col: 6, row: 1 } },
  { blueprintId: 'stem', origin: { col: 8, row: 1 } },
  { blueprintId: 'stem', origin: { col: 6, row: 2 } },
  { blueprintId: 'stem', origin: { col: 8, row: 2 } },
  { blueprintId: 'stem', origin: { col: 6, row: 3 } },
  { blueprintId: 'stem', origin: { col: 8, row: 3 } },
  { blueprintId: 'stem', origin: { col: 6, row: 4 } },
  { blueprintId: 'stem', origin: { col: 8, row: 4 } },
  { blueprintId: 'buttress2', origin: { col: 5, row: 5 } },
  { blueprintId: 'buttress2', origin: { col: 8, row: 5 } },
];

/** Ground-floor facilities attached to the starter mass. */
export const STARTER_FACILITY_PLACEMENTS: StarterPlacement[] = [
  { blueprintId: 'stem', origin: { col: 5, row: 0 } },
  { blueprintId: 'stem', origin: { col: 9, row: 0 } },
];

export function createStarterTower(): Tower {
  let tower = createTower();
  const allPlacements = [...STARTER_FACILITY_PLACEMENTS, ...STARTER_TOWER_PLACEMENTS];
  allPlacements.forEach((placement, index) => {
    const blueprint = getBlueprint(placement.blueprintId);
    if (!blueprint) {
      throw new Error(`Unknown starter blueprint: ${placement.blueprintId}`);
    }
    tower = placeStructure(tower, createStructure(`starter-${index}`, blueprint, placement.origin));
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
