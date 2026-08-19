import { describe, expect, it } from 'vitest';
import { STARTER_TOWER_PLACEMENTS } from '@/model/starterTower';
import { PlayabilityDriver, type BlueprintPlacement } from '@/test/playability';

const FIRST_WAVE_MAX_STEPS = 90 * 60 * 5;
const FIRST_WAVE_SEEDS = ['first-wave-b', 'first-wave-c'] as const;

const STARTER_DEFENSE: readonly BlueprintPlacement[] = [
  { blueprintId: 'guardroomRoom', cell: { col: 6, row: 1 } },
  { blueprintId: 'slotRoom', cell: { col: 8, row: 1 } },
  { blueprintId: 'turretRoom', cell: { col: 6, row: 2 } },
  { blueprintId: 'turretRoom', cell: { col: 8, row: 2 } },
];

describe('first-wave playability', () => {
  it.each(FIRST_WAVE_SEEDS)(
    'the unchanged starter tower loses wave one (seed: %s)',
    (seed) => {
      const driver = new PlayabilityDriver(seed);
      const initial = driver.store.getSnapshot().game;
      expect(initial.phase).toBe('day');
      expect(initial.tower.structures.length).toBeGreaterThan(STARTER_TOWER_PLACEMENTS.length);

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

      for (const placement of STARTER_DEFENSE) {
        driver.place(placement);
        driver.waitForConstruction();
      }
      driver.recruitAt({ col: 6, row: 1 });
      driver.allocateSlotAt({ col: 8, row: 1 }, 2);

      driver.startWave();
      const result = driver.runUntilTerminal(FIRST_WAVE_MAX_STEPS);

      expect(result.scene, driver.describe(result)).toBe('run');
      expect(result.phase, driver.describe(result)).toBe('day');
      expect(result.wizardHp, driver.describe(result)).toBeGreaterThan(0);
      expect(result.enemiesRemaining, driver.describe(result)).toBe(0);
      expect(result.spawnQueueRemaining, driver.describe(result)).toBe(0);
    },
  );
});
