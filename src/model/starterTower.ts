import { getBlueprint } from './blueprints';
import { createStructure, createTower, placeStructure } from './tower';
import type { Cell, Tower } from './types';

export interface StarterPlacement {
  blueprintId: string;
  origin: Cell;
}

/**
 * Pre-built hollow wizard tower for wave 1. Placed bottom-to-top as framing only.
 *
 * ```text
 * row 5:  BB  BB   crown wings cantilever one step past the shaft (cols 5, 9)
 * row 4: I . I
 * row 3: I . I
 * row 2: I . I
 * row 1: I . I      hollow interior at col 7
 * row 0: I I I          wide base (cols 6–8)
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

export function createStarterTower(): Tower {
  let tower = createTower();
  STARTER_TOWER_PLACEMENTS.forEach((placement, index) => {
    const blueprint = getBlueprint(placement.blueprintId);
    if (!blueprint) {
      throw new Error(`Unknown starter blueprint: ${placement.blueprintId}`);
    }
    tower = placeStructure(tower, createStructure(`starter-${index}`, blueprint, placement.origin));
  });
  return tower;
}
