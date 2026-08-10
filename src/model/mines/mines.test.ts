import { describe, expect, it } from 'vitest';
import {
  MINE_SHALLOW_DEPTH,
  MINE_STONE_HARVEST_PER_SEC,
  MINE_STONE_PATCH_UNITS,
} from '@/config/constants';
import { canSoldierTraverse, isSoldierWalkable } from '@/calculations/interiorGraph';
import { findInteriorPath } from '@/calculations/interiorPathfinding';
import { createInitialState } from '@/model/game';
import { getBlueprint } from '@/model/blueprints';
import {
  generateShallowMine,
  isMinePatchTarget,
  minePatchTargetId,
  pickMineEntranceCol,
} from '@/model/mines';
import {
  assignSurplusLaborers,
  stepStaff,
  tickLaborerHarvestAndPump,
  tickLaborerRepairs,
} from '@/model/staff';
import { createRoom, createStructure, createTower, placeRoom, placeStructure } from '@/model/tower';

describe('generateShallowMine', () => {
  it('attaches under starter ground framing at col 7', () => {
    const state = createInitialState('mine-gen');
    expect(state.mine.entrance).toEqual({ col: 7, row: -1 });
    expect(pickMineEntranceCol(state.tower)).toBe(7);
    expect(state.mine.patches.length).toBe((MINE_SHALLOW_DEPTH - 1) * 2);
    for (const patch of state.mine.patches) {
      expect(patch.resource).toBe('stone');
      expect(patch.remaining).toBe(MINE_STONE_PATCH_UNITS);
      expect(state.mine.tunnels[`${patch.cell.col},${patch.cell.row}`]).toBe(true);
    }
  });

  it('is deterministic for the same tower', () => {
    const tower = createInitialState('a').tower;
    expect(generateShallowMine(tower)).toEqual(generateShallowMine(tower));
  });
});

describe('mine interior pathing', () => {
  it('walks from ground framing into a stone patch', () => {
    const state = createInitialState('mine-path');
    const patch = state.mine.patches[0];
    expect(
      isSoldierWalkable(state.tower, state.mine.entrance.col, state.mine.entrance.row, state.mine),
    ).toBe(true);
    expect(
      canSoldierTraverse(
        state.tower,
        { col: 7, row: 0 },
        { col: 7, row: -1 },
        state.mine,
      ),
    ).toBe(true);

    const path = findInteriorPath(
      state.tower,
      { col: 7, row: 0 },
      patch.cell,
      state.mine,
    );
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).toEqual(patch.cell);
  });
});

describe('mine stone harvest', () => {
  function stateWithLaborerAtPatch() {
    const state = createInitialState('mine-harvest');
    state.tower = createTower();
    const stem = getBlueprint('stem')!;
    const quarters = getBlueprint('quartersRoom')!;
    state.tower = placeStructure(state.tower, createStructure('g0', stem, { col: 7, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('q1', quarters, { col: 7, row: 0 }));
    state.mine = generateShallowMine(state.tower);
    const patch = state.mine.patches[0];
    state.phase = 'attack';
    state.staff = [
      {
        id: 'L1',
        kind: 'laborer',
        homeHousingId: 'q1',
        targetWorkplaceId: minePatchTargetId(patch.id),
        pos: { ...patch.cell },
        path: [patch.cell],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'working',
      },
    ];
    return { state, patch };
  }

  it('yields stone only and depletes the patch', () => {
    const { state, patch } = stateWithLaborerAtPatch();
    const beforeStone = state.player.resources.stone;
    const beforeMetal = state.player.resources.metal;
    const beforeRemaining = patch.remaining;

    tickLaborerHarvestAndPump(state, 1);

    expect(state.player.resources.stone).toBe(beforeStone + MINE_STONE_HARVEST_PER_SEC);
    expect(state.player.resources.metal).toBe(beforeMetal);
    expect(patch.remaining).toBe(beforeRemaining - MINE_STONE_HARVEST_PER_SEC);
  });

  it('assigns surplus laborers to mine patches after repair priority', () => {
    const state = createInitialState('mine-assign');
    state.tower = createTower();
    const stem = getBlueprint('stem')!;
    const quarters = getBlueprint('quartersRoom')!;
    state.tower = placeStructure(state.tower, createStructure('g0', stem, { col: 7, row: 0 }));
    state.tower = placeRoom(state.tower, createRoom('q1', quarters, { col: 7, row: 0 }));
    state.mine = generateShallowMine(state.tower);
    state.phase = 'attack';
    state.housingRecruited.q1 = 1;
    state.staff = [
      {
        id: 'L1',
        kind: 'laborer',
        homeHousingId: 'q1',
        targetWorkplaceId: null,
        pos: { col: 7, row: 0 },
        path: [{ col: 7, row: 0 }],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'idle',
      },
    ];

    assignSurplusLaborers(state);
    const unit = state.staff[0];
    expect(isMinePatchTarget(unit.targetWorkplaceId)).toBe(true);
    expect(unit.status).toBe('moving');
    expect(unit.path.length).toBeGreaterThan(1);

    // Walk until working (shaft is short).
    for (let i = 0; i < 40; i++) {
      unit.moveCooldown = 0;
      stepStaff(state, 1);
      if (unit.status === 'working') break;
    }
    expect(unit.status).toBe('working');
    expect(unit.pos.row).toBeLessThan(0);
  });

  it('does not peel mine workers when repair retargets idle laborers', () => {
    const { state } = stateWithLaborerAtPatch();
    const target = state.staff[0].targetWorkplaceId;
    tickLaborerRepairs(state, 0.1);
    expect(state.staff[0].targetWorkplaceId).toBe(target);
    expect(state.staff[0].status).toBe('working');
  });
});
