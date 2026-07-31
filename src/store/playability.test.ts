import { describe, expect, it } from 'vitest';
import { netBuildCost } from '@/calculations/buildCost';
import { STARTING_CURRENCY } from '@/config/constants';
import { STARTER_TOWER_PLACEMENTS } from '@/model/starterTower';
import { PlayabilityDriver, type BlueprintPlacement } from '@/test/playability';

const FIRST_WAVE_MAX_STEPS = 90 * 60;
const FIRST_WAVE_SEEDS = ['first-wave-b', 'first-wave-c'] as const;

/**
 * A small beginner layout: two soldiers stationed in a ground-level slot plus
 * two Turret Rooms on the existing tower frame. This consumes all 48 starting
 * gold and requires no infrastructure, spells, developer actions, or direct
 * game-state changes.
 */
const STARTER_DEFENSE: readonly BlueprintPlacement[] = [
  { blueprintId: 'guardroomRoom', cell: { col: 6, row: 0 } },
  { blueprintId: 'slotRoom', cell: { col: 8, row: 0 } },
  { blueprintId: 'turretRoom', cell: { col: 6, row: 2 } },
  { blueprintId: 'turretRoom', cell: { col: 8, row: 2 } },
];

describe('first-wave playability', () => {
  it.each(FIRST_WAVE_SEEDS)(
    'the unchanged starter tower loses wave one (seed: %s)',
    (seed) => {
      const driver = new PlayabilityDriver(seed);
      const initial = driver.store.getSnapshot().game;
      expect(initial.phase).toBe('build');
      expect(initial.tower.structures).toHaveLength(STARTER_TOWER_PLACEMENTS.length);

      driver.startWave();
      const result = driver.runUntilTerminal(FIRST_WAVE_MAX_STEPS);

      expect(result.scene, driver.describe(result)).toBe('gameOver');
      expect(result.wizardHp, driver.describe(result)).toBeLessThanOrEqual(0);
    },
  );

  it.each(FIRST_WAVE_SEEDS)(
    'the documented starter defense clears wave one (seed: %s)',
    (seed) => {
      const driver = new PlayabilityDriver(seed);
      const baseline = driver.store.getSnapshot().game.buildBaseline!;

      for (const placement of STARTER_DEFENSE) driver.place(placement);
      driver.recruitAt({ col: 6, row: 0 });
      driver.recruitAt({ col: 6, row: 0 });
      driver.allocateSlotAt({ col: 8, row: 0 }, 2);

      const beforeStart = driver.store.getSnapshot().game;
      const cost = netBuildCost(baseline, beforeStart.tower);
      expect(cost).toBe(40);
      expect(cost + beforeStart.buildRecruitSpend).toBe(STARTING_CURRENCY);

      driver.startWave();
      const result = driver.runUntilTerminal(FIRST_WAVE_MAX_STEPS);

      expect(result.scene, driver.describe(result)).toBe('run');
      expect(result.phase, driver.describe(result)).toBe('build');
      expect(result.wizardHp, driver.describe(result)).toBeGreaterThan(0);
      expect(result.enemiesRemaining, driver.describe(result)).toBe(0);
      expect(result.spawnQueueRemaining, driver.describe(result)).toBe(0);
    },
  );
});
