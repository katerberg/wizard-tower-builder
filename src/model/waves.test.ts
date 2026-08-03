import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '@/config/constants';
import { createInitialState, step } from '@/model/game';
import { getBlueprint } from '@/model/blueprints';
import { beginWave, endWave } from '@/model/phases';
import { createStructure, createTower, placeStructure, removeStructure, towerExtents } from '@/model/tower';
import {
  buildSpawnQueue,
  estimatePlateauForScore,
  heightProgression,
  plateauForHeight,
  unlockEnemiesForHeight,
  waveDefFromCounts,
  wavePointScore,
  WIN_HEIGHT,
} from '@/model/waves';

function stemTower(maxRow: number) {
  const stem = getBlueprint('stem')!;
  let tower = createTower();
  for (let row = 0; row <= maxRow; row++) {
    tower = placeStructure(tower, createStructure(`r${row}`, stem, { col: 8, row }));
  }
  return tower;
}

function tallTower(state: ReturnType<typeof createInitialState>, maxRow = 5) {
  state.tower = stemTower(maxRow);
  return state;
}

function countOf(queue: string[], id: string): number {
  return queue.filter((x) => x === id).length;
}

describe('height progression', () => {
  it('low height waves are swarm-heavy with a tiny elite presence', () => {
    const unlocked = new Set(unlockEnemiesForHeight([], 5));
    const wave = heightProgression.getWave({ height: 5, unlockedEnemyIds: unlocked });
    const queue = buildSpawnQueue(wave);
    expect(queue.length).toBeGreaterThanOrEqual(30);
    expect(countOf(queue, 'swarm')).toBeGreaterThan(25);
    expect(countOf(queue, 'elite')).toBe(1);
    expect(countOf(queue, 'striker')).toBe(0);
  });

  it('plateaus keep budget flat within a band', () => {
    expect(plateauForHeight(40).budget).toBe(plateauForHeight(54).budget);
    expect(plateauForHeight(55).budget).toBeGreaterThan(plateauForHeight(54).budget);
  });

  it('taller plateaus spend more points and unlock denser mixes', () => {
    const low = buildSpawnQueue(
      heightProgression.getWave({
        height: 5,
        unlockedEnemyIds: new Set(unlockEnemiesForHeight([], 5)),
      }),
    );
    const high = buildSpawnQueue(
      heightProgression.getWave({
        height: 90,
        unlockedEnemyIds: new Set(unlockEnemiesForHeight([], 90)),
      }),
    );
    expect(high.length).toBeGreaterThan(low.length);
    expect(countOf(high, 'brute')).toBeGreaterThan(0);
    expect(countOf(high, 'carrier')).toBeGreaterThan(0);
    expect(heightProgression.rewardFor(90)).toBeGreaterThan(heightProgression.rewardFor(5));
  });

  it('unlocks persist when height drops, but heavies stay few and total weight falls', () => {
    const unlocked = new Set(unlockEnemiesForHeight([], 90));
    expect(unlocked.has('brute')).toBe(true);
    expect(unlocked.has('carrier')).toBe(true);

    const atPeak = buildSpawnQueue(
      heightProgression.getWave({ height: 90, unlockedEnemyIds: unlocked }),
    );
    const afterCollapse = buildSpawnQueue(
      heightProgression.getWave({ height: 20, unlockedEnemyIds: unlocked }),
    );

    expect(countOf(afterCollapse, 'brute')).toBeGreaterThan(0);
    expect(countOf(afterCollapse, 'brute')).toBeLessThanOrEqual(1);
    expect(countOf(afterCollapse, 'carrier')).toBeLessThanOrEqual(1);
    expect(afterCollapse.length).toBeLessThan(atPeak.length);
    expect(plateauForHeight(20).budget).toBeLessThan(plateauForHeight(90).budget);
  });

  it('beginWave snapshots height and unlocks enemies for the run', () => {
    const state = tallTower(createInitialState('unlock-snap'), 40);
    beginWave(state);
    expect(state.waveStartHeight).toBe(40);
    expect(state.unlockedEnemyIds).toContain('skirmisher');
    expect(state.unlockedEnemyIds).toContain('striker');
    expect(state.spawnQueue.some((id) => id === 'skirmisher')).toBe(true);

    // Collapse framing between waves — unlocks remain.
    state.phase = 'build';
    state.enemies = [];
    state.spawnQueue = [];
    state.tower = stemTower(10);
    beginWave(state);
    expect(state.unlockedEnemyIds).toContain('skirmisher');
    expect(state.waveStartHeight).toBe(10);
  });

  it('wins only when height is still >= 100 at wave clear', () => {
    const state = tallTower(createInitialState('win-height'), WIN_HEIGHT);
    expect(towerExtents(state.tower).maxOccupiedRow).toBe(WIN_HEIGHT);
    beginWave(state);
    state.enemies = [];
    state.spawnQueue = [];
    endWave(state);
    expect(state.scene).toBe('victory');
  });

  it('does not win if height drops below 100 before clear', () => {
    const state = tallTower(createInitialState('no-win-drop'), WIN_HEIGHT);
    beginWave(state);
    expect(state.waveStartHeight).toBe(WIN_HEIGHT);

    // Simulate mid-wave framing loss (e.g. Earthquake) below the win line.
    const topId = state.tower.structures.find((s) => s.origin.row === WIN_HEIGHT)?.id;
    expect(topId).toBeTruthy();
    state.tower = removeStructure(state.tower, topId!);
    expect(towerExtents(state.tower).maxOccupiedRow).toBe(WIN_HEIGHT - 1);

    state.enemies = [];
    state.spawnQueue = [];
    endWave(state);
    expect(state.scene).toBe('run');
    expect(state.phase).toBe('build');
    expect(state.levelIndex).toBe(1);
  });

  it('short-tower wave lasts at least 30 simulated seconds', () => {
    const state = tallTower(createInitialState('wave-duration-0'), 5);
    beginWave(state);

    let steps = 0;
    const minSteps = Math.floor(30 / FIXED_DT);
    while (state.phase === 'attack' && steps < minSteps) {
      step(state, FIXED_DT);
      steps += 1;
    }
    expect(steps).toBeGreaterThanOrEqual(minSteps);
    expect(state.enemies.length + state.spawnQueue.length).toBeGreaterThan(0);
  });

  it('wavePointScore sums chess points for mixed entries', () => {
    expect(
      wavePointScore({
        entries: [
          { templateId: 'swarm', count: 10 },
          { templateId: 'elite', count: 2 },
          { templateId: 'striker', count: 3 },
        ],
      }),
    ).toBe(10 * 1 + 2 * 8 + 3 * 3);
  });

  it('estimatePlateauForScore picks nearest budget (ties prefer lower height)', () => {
    expect(estimatePlateauForScore(48)).toEqual({ minHeight: 0, budget: 48 });
    expect(estimatePlateauForScore(100)).toEqual({ minHeight: 30, budget: 100 });
    // Midway 72↔100 → equal distance 14; prefer lower minHeight (15).
    expect(estimatePlateauForScore(86)).toEqual({ minHeight: 15, budget: 72 });
    expect(estimatePlateauForScore(320)).toEqual({ minHeight: 100, budget: 320 });
  });

  it('waveDefFromCounts drops zeros and preserves builder order', () => {
    expect(waveDefFromCounts({ swarm: 5, elite: 0, striker: 2 })).toEqual({
      entries: [
        { templateId: 'swarm', count: 5 },
        { templateId: 'striker', count: 2 },
      ],
    });
  });

  it('beginWave override replaces composition but keeps real height snapshot', () => {
    const state = tallTower(createInitialState('custom-wave'), 40);
    beginWave(state, {
      entries: [
        { templateId: 'brute', count: 2 },
        { templateId: 'swarm', count: 3 },
      ],
    });
    expect(state.waveStartHeight).toBe(40);
    expect(state.spawnQueue).toEqual(['brute', 'swarm', 'brute', 'swarm', 'swarm']);
    expect(state.unlockedEnemyIds).toContain('skirmisher');
  });

  it('beginWave without override still height-composes', () => {
    const state = tallTower(createInitialState('normal-wave'), 5);
    beginWave(state);
    expect(state.spawnQueue.length).toBeGreaterThan(20);
    expect(countOf(state.spawnQueue, 'swarm')).toBeGreaterThan(15);
  });
});
