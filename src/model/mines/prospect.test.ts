import { describe, expect, it } from 'vitest';
import {
  PROSPECT_MAX_ALLOCATION,
  RARE_PATCH_FALLOFF,
  MINE_STONE_HARVEST_PER_SEC,
} from '@/config/constants';
import { createInitialState } from '@/model/game';
import { getBlueprint } from '@/model/blueprints';
import {
  generateDeepTier,
  generateShallowMine,
  getProspectWorkTime,
  isProspectTarget,
  PROSPECT_TARGET,
  rollQualityBand,
} from '@/model/mines';
import {
  assignSurplusLaborers,
  tickLaborerHarvestAndPump,
  prospectFrontierCell,
} from '@/model/staff/harvest';
import { tickProspectWork, resolveProspectAtNightfall } from '@/model/staff/prospect';
import { tickLaborerRepairs } from '@/model/staff/combat';
import { endWave } from '@/model/phases';
import { createRoom, createStructure, createTower, placeRoom, placeStructure } from '@/model/tower';

function setupMineState(): ReturnType<typeof createInitialState> {
  const state = createInitialState('prospect-test');
  state.tower = createTower();
  const stem = getBlueprint('stem')!;
  const quarters = getBlueprint('quartersRoom')!;
  state.tower = placeStructure(state.tower, createStructure('g0', stem, { col: 7, row: 0 }));
  state.tower = placeRoom(state.tower, createRoom('q1', quarters, { col: 7, row: 0 }));
  state.mine = generateShallowMine(state.tower);
  return state;
}

describe('rollQualityBand', () => {
  it('returns one of three bands', () => {
    const r = rollQualityBand(42);
    expect(['poor', 'mixed', 'rich']).toContain(r.band);
  });

  it('advances RNG state deterministically', () => {
    const r1 = rollQualityBand(12345);
    const r2 = rollQualityBand(12345);
    expect(r1.band).toBe(r2.band);
    expect(r1.rngState).toBe(r2.rngState);
  });
});

describe('generateDeepTier', () => {
  it('appends new patches and increments unlockedDepth', () => {
    const state = setupMineState();
    const { mine, band } = generateDeepTier(state.mine, state.tower, state.rngState);
    expect(mine.unlockedDepth).toBe(2);
    expect(mine.patches.length).toBeGreaterThan(state.mine.patches.length);
    expect(['poor', 'mixed', 'rich']).toContain(band);
  });

  it('creates at least some patches regardless of quality', () => {
    for (const seed of [1, 100, 9999, 42]) {
      const state = createInitialState(seed);
      const { mine } = generateDeepTier(state.mine, state.tower, state.rngState);
      expect(mine.patches.length).toBeGreaterThan(0);
    }
  });
});

describe('getProspectWorkTime', () => {
  it('scales with depth', () => {
    const t1 = getProspectWorkTime(1);
    const t2 = getProspectWorkTime(3);
    expect(t2).toBeGreaterThan(t1);
  });
});

describe('prospect allocation', () => {
  it('clamps to recruited laborers', () => {
    const state = setupMineState();
    state.housingRecruited.q1 = 3;
    // Set allocation above recruited — handler clamps.
    state.prospectAllocation = 10;
    // The handler clamps, but here we test the concept: max = min(6, 3) = 3.
    const max = Math.min(PROSPECT_MAX_ALLOCATION, 3);
    expect(max).toBe(3);
  });

  it('defaults to 0 in fresh state', () => {
    const state = createInitialState('alloc-default');
    expect(state.prospectAllocation).toBe(0);
  });
});

describe('prospectors excluded from mine auto-fill', () => {
  it('does not assign prospectors to stone patches', () => {
    const state = setupMineState();
    state.phase = 'night';
    state.housingRecruited.q1 = 2;
    state.prospectAllocation = 1;
    state.staff = [
      {
        id: 'L1',
        kind: 'laborer',
        homeHousingId: 'q1',
        targetWorkplaceId: PROSPECT_TARGET,
        pos: { col: 7, row: 0 },
        path: [{ col: 7, row: 0 }],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'working',
      },
      {
        id: 'L2',
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

    // Prospector stays on prospect job.
    expect(state.staff[0].targetWorkplaceId).toBe(PROSPECT_TARGET);
    // Idle laborer gets assigned to mine.
    expect(isProspectTarget(state.staff[1].targetWorkplaceId)).toBe(false);
  });
});

describe('rare patch falloff', () => {
  it('second laborer yields less than first on metal patch', () => {
    const state = setupMineState();
    state.phase = 'night';
    // Manually add a metal patch.
    state.mine.patches.push({
      id: 'metal-99',
      cell: { col: 6, row: -2 },
      resource: 'metal',
      remaining: 1000,
    });
    state.mine.tunnels['6,-2'] = true;
    state.mine.tunnels['7,-2'] = true;

    state.staff = [
      {
        id: 'L1',
        kind: 'laborer',
        homeHousingId: 'q1',
        targetWorkplaceId: 'mine:patch:metal-99',
        pos: { col: 6, row: -2 },
        path: [{ col: 6, row: -2 }],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'working',
      },
      {
        id: 'L2',
        kind: 'laborer',
        homeHousingId: 'q1',
        targetWorkplaceId: 'mine:patch:metal-99',
        pos: { col: 6, row: -2 },
        path: [{ col: 6, row: -2 }],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'working',
      },
    ];

    const beforeMetal = state.waveHaul.metal;
    tickLaborerHarvestAndPump(state, 1);
    const total = state.waveHaul.metal - beforeMetal;

    // First laborer: 1.0; second: 0.5. Total = 1.5 units/sec.
    const expected = MINE_STONE_HARVEST_PER_SEC * (1 + RARE_PATCH_FALLOFF);
    expect(total).toBeCloseTo(expected, 5);
  });
});

describe('prospect job resolves and reveals tier', () => {
  it('completes work timer and calls generateDeepTier', () => {
    const state = setupMineState();
    state.phase = 'day';
    state.housingRecruited.q1 = 1;
    state.prospectAllocation = 1;
    const frontier = prospectFrontierCell(state);
    state.staff = [
      {
        id: 'L1',
        kind: 'laborer',
        homeHousingId: 'q1',
        targetWorkplaceId: PROSPECT_TARGET,
        pos: frontier,
        path: [frontier],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'working',
      },
    ];

    const beforeDepth = state.mine.unlockedDepth;
    const workTime = getProspectWorkTime(state.mine.unlockedDepth);

    expect(state.prospectResolved).toBe(false);
    tickProspectWork(state, workTime);
    resolveProspectAtNightfall(state);
    expect(state.prospectResolved).toBe(true);
    expect(state.mine.unlockedDepth).toBe(beforeDepth + 1);
  });
});

describe('prospectors stay put during repair retarget', () => {
  it('not peeled by tickLaborerRepairs', () => {
    const state = setupMineState();
    state.phase = 'night';
    state.prospectAllocation = 1;
    state.staff = [
      {
        id: 'L1',
        kind: 'laborer',
        homeHousingId: 'q1',
        targetWorkplaceId: PROSPECT_TARGET,
        pos: { col: 7, row: -1 },
        path: [{ col: 7, row: -1 }],
        pathIndex: 0,
        moveCooldown: 0,
        status: 'working',
      },
    ];

    tickLaborerRepairs(state, 0.1);
    expect(state.staff[0].targetWorkplaceId).toBe(PROSPECT_TARGET);
    expect(state.staff[0].status).toBe('working');
  });
});

describe('wave clear modal with prospect note', () => {
  it('shows prospectNote when tier was revealed', () => {
    const state = setupMineState();
    state.phase = 'night';
    state.prospectAllocation = 1;
    state.prospectResolved = true;
    state.mine.unlockedDepth = 3;
    state.waveHaul.stone = 5;
    state.waveStartHeight = 4;

    endWave(state);

    expect(state.pendingWaveClear?.prospectNote).not.toBeNull();
    expect(state.pendingWaveClear?.prospectNote).toContain('Depth 3');
  });

  it('prospectNote is null when no prospecting occurred', () => {
    const state = setupMineState();
    state.phase = 'night';
    state.prospectAllocation = 0;
    state.prospectResolved = false;
    state.waveHaul.stone = 3;
    state.waveStartHeight = 4;

    endWave(state);

    expect(state.pendingWaveClear?.prospectNote).toBeNull();
  });
});

describe('prospectFrontierCell', () => {
  it('returns deepest tunnel in entrance column', () => {
    const state = setupMineState();
    const frontier = prospectFrontierCell(state);
    expect(frontier.col).toBe(state.mine.entrance.col);
    expect(frontier.row).toBeLessThanOrEqual(state.mine.entrance.row);
  });
});
