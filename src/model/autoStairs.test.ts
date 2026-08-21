import { describe, expect, it, vi } from 'vitest';
import { reconcileAutoStairs, horizontalWalkableSegments } from './autoStairs';
import { getBlueprint } from './blueprints';
import { placeInfra } from './infra';
import { createStarterTower } from './starterTower';
import {
  createRoom,
  createStructure,
  createTower,
  placeRoomReplacing,
  placeStructure,
  planRoomPlacement,
} from './tower';
import { placeBlueprint, resetPlaceCounter } from '@/test/place';

function stairCols(tower: ReturnType<typeof createTower>): number[] {
  const cols = new Set<number>();
  for (const [key, cell] of Object.entries(tower.infra ?? {})) {
    if (cell.kind !== 'stair') continue;
    cols.add(Number(key.split(',')[0]));
  }
  return [...cols].sort((a, b) => a - b);
}

describe('reconcileAutoStairs', () => {
  it('creates one shaft for a connected left mass (xx / xx / xxx)', () => {
    resetPlaceCounter();
    let tower = createTower();
    // row 0: xxx
    for (const col of [4, 5, 6]) {
      tower = placeStructure(tower, createStructure(`s0-${col}`, getBlueprint('stem')!, { col, row: 0 }));
    }
    // row 1–2: xx (left)
    for (const row of [1, 2]) {
      for (const col of [4, 5]) {
        tower = placeStructure(
          tower,
          createStructure(`s${row}-${col}`, getBlueprint('stem')!, { col, row }),
        );
      }
    }
    const bp = getBlueprint('guardroomRoom')!;
    const placed = placeRoomReplacing(
      tower,
      createRoom('g1', bp, { col: 4, row: 2 }),
      bp,
    );
    expect(placed.ok).toBe(true);
    tower = placed.tower!;
    expect(stairCols(tower)).toEqual([4]);
    expect(tower.infra['4,0']?.kind).toBe('stair');
    expect(tower.infra['4,1']?.kind).toBe('stair');
    expect(tower.infra['4,2']?.kind).toBe('stair');
  });

  it('creates two shafts for disconnected wings (x x / x x / xxx)', () => {
    resetPlaceCounter();
    let tower = createTower();
    for (const col of [4, 5, 6]) {
      tower = placeStructure(tower, createStructure(`s0-${col}`, getBlueprint('stem')!, { col, row: 0 }));
    }
    for (const row of [1, 2]) {
      tower = placeStructure(tower, createStructure(`sl${row}`, getBlueprint('stem')!, { col: 4, row }));
      tower = placeStructure(tower, createStructure(`sr${row}`, getBlueprint('stem')!, { col: 6, row }));
    }
    const bp = getBlueprint('guardroomRoom')!;
    let placed = placeRoomReplacing(tower, createRoom('gL', bp, { col: 4, row: 2 }), bp);
    expect(placed.ok).toBe(true);
    tower = placed.tower!;
    expect(stairCols(tower)).toEqual([4]);

    placed = placeRoomReplacing(tower, createRoom('gR', bp, { col: 6, row: 2 }), bp);
    expect(placed.ok).toBe(true);
    tower = placed.tower!;
    expect(stairCols(tower)).toEqual([4, 6]);
  });

  it('adds a second shaft on the starter tower right wing', () => {
    let tower = createStarterTower();
    // Starter has turret + supply + quarters on row 0 / left column — one shaft at turret col.
    expect(stairCols(tower).length).toBeGreaterThanOrEqual(1);
    const before = stairCols(tower);

    const bp = getBlueprint('guardroomRoom')!;
    const placed = placeRoomReplacing(tower, createRoom('gR', bp, { col: 8, row: 1 }), bp);
    expect(placed.ok).toBe(true);
    tower = placed.tower!;
    const after = stairCols(tower);
    expect(after.length).toBeGreaterThan(before.length);
    expect(after).toContain(8);
  });

  it('places a shaft when the first room is on row 0', () => {
    resetPlaceCounter();
    let tower = createTower();
    tower = placeStructure(tower, createStructure('s0', getBlueprint('stem')!, { col: 5, row: 0 }));
    const bp = getBlueprint('quartersRoom')!;
    const placed = placeRoomReplacing(tower, createRoom('q1', bp, { col: 5, row: 0 }), bp);
    expect(placed.ok).toBe(true);
    expect(placed.tower!.infra['5,0']?.kind).toBe('stair');
  });

  it('passes stairs through structure-only intermediate rows', () => {
    resetPlaceCounter();
    let tower = createTower();
    for (let row = 0; row <= 3; row++) {
      tower = placeStructure(
        tower,
        createStructure(`s${row}`, getBlueprint('stem')!, { col: 5, row }),
      );
    }
    const bp = getBlueprint('slotRoom')!;
    const placed = placeRoomReplacing(tower, createRoom('s1', bp, { col: 5, row: 3 }), bp);
    expect(placed.ok).toBe(true);
    tower = placed.tower!;
    expect(tower.infra['5,1']?.kind).toBe('stair');
    expect(tower.infra['5,2']?.kind).toBe('stair');
    expect(tower.infra['5,3']?.kind).toBe('stair');
  });

  it('overwrites pipe infra in the shaft column and warns', () => {
    resetPlaceCounter();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let tower = createTower();
    for (let row = 0; row <= 2; row++) {
      tower = placeStructure(
        tower,
        createStructure(`s${row}`, getBlueprint('stem')!, { col: 5, row }),
      );
    }
    tower = placeInfra(tower, { col: 5, row: 1 }, 'pipe');
    const bp = getBlueprint('guardroomRoom')!;
    const placed = placeRoomReplacing(tower, createRoom('g1', bp, { col: 5, row: 2 }), bp);
    expect(placed.ok).toBe(true);
    expect(placed.tower!.infra['5,1']?.kind).toBe('stair');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('rejects room placement with no continuous column to ground', () => {
    resetPlaceCounter();
    let tower = createTower();
    tower = placeStructure(tower, createStructure('g', getBlueprint('stem')!, { col: 5, row: 0 }));
    // Floating cell with no support below — stem auto-place should fail first,
    // but also a cantilevered room with gap in the only column fails no_shaft.
    tower = placeStructure(tower, createStructure('a', getBlueprint('stem')!, { col: 7, row: 0 }));
    tower = placeStructure(tower, createStructure('b', getBlueprint('stem')!, { col: 7, row: 1 }));
    // Room on col 6 with structure only at row 2 (gap at 1) after manual placeStructure
    // that shouldn't be legal via canPlace — use overhang-unlocked style gap:
    // Place room only via plan after building incomplete column.
    tower = placeStructure(tower, createStructure('top', getBlueprint('stem')!, { col: 6, row: 0 }));
    // Remove continuity: no structure at col 6 row 1, room wants row 2
    tower = placeStructure(tower, createStructure('mid', getBlueprint('stem')!, { col: 5, row: 1 }));
    tower = placeStructure(tower, createStructure('top2', getBlueprint('stem')!, { col: 6, row: 2 }));
    // Force room onto col 6 row 2 without stem at row 1 in that col — planRoomPlacement
    // will try to stem (6,2) which needs support below → no_support, or if stem fails...
    const bp = getBlueprint('guardroomRoom')!;
    const plan = planRoomPlacement(tower, bp, { col: 6, row: 2 });
    // Stem at (6,2) needs structure below at (6,1) — none → no_support
    expect(plan.ok).toBe(false);
  });

  it('removes orphan wing shaft when wing room is removed', () => {
    resetPlaceCounter();
    let tower = createTower();
    for (const col of [4, 5, 6]) {
      tower = placeStructure(tower, createStructure(`s0-${col}`, getBlueprint('stem')!, { col, row: 0 }));
    }
    for (const row of [1, 2]) {
      tower = placeStructure(tower, createStructure(`sl${row}`, getBlueprint('stem')!, { col: 4, row }));
      tower = placeStructure(tower, createStructure(`sr${row}`, getBlueprint('stem')!, { col: 6, row }));
    }
    const bp = getBlueprint('guardroomRoom')!;
    tower = placeRoomReplacing(tower, createRoom('gL', bp, { col: 4, row: 2 }), bp).tower!;
    tower = placeRoomReplacing(tower, createRoom('gR', bp, { col: 6, row: 2 }), bp).tower!;
    expect(stairCols(tower)).toEqual([4, 6]);

    tower = {
      ...tower,
      rooms: tower.rooms.filter((r) => r.id !== 'gR'),
      occupancy: Object.fromEntries(
        Object.entries(tower.occupancy).filter(([, id]) => id !== 'gR'),
      ),
    };
    const result = reconcileAutoStairs(tower);
    expect(result.ok).toBe(true);
    expect(stairCols(result.tower)).toEqual([4]);
  });

  it('reports two walkable segments on a hollow starter row', () => {
    const tower = createStarterTower();
    const segs = horizontalWalkableSegments(tower, 1);
    expect(segs.length).toBeGreaterThanOrEqual(2);
  });
});

describe('placeBlueprint auto-stairs', () => {
  it('connects a stacked room via auto-stairs', () => {
    resetPlaceCounter();
    let tower = createTower();
    tower = placeBlueprint(tower, 'stem', { col: 5, row: 0 });
    tower = placeBlueprint(tower, 'stem', { col: 5, row: 1 });
    tower = placeBlueprint(tower, 'guardroomRoom', { col: 5, row: 1 });
    expect(tower.infra['5,0']?.kind).toBe('stair');
    expect(tower.infra['5,1']?.kind).toBe('stair');
  });
});
