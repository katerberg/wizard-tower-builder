import { describe, expect, it } from 'vitest';
import { STARTER_STRUCTURE_COUNT } from '@/model/starterTower';
import { balanceBuildById } from '@/test/balance/builds';
import { assertCombatOutcome } from '@/test/balance/run';
import { PlayabilityDriver, runBalanceBuild } from '@/test/playability';

const FIRST_WAVE_MAX_STEPS = 90 * 60;

describe('first-wave playability', () => {
  const bare = balanceBuildById('bare-starter');
  const granted = balanceBuildById('slot-granted-defense');

  it.each(bare.seeds ?? [])('the unchanged starter tower loses wave one (seed: %s)', (seed) => {
    const driver = new PlayabilityDriver(seed);
    const initial = driver.store.getSnapshot().game;
    expect(initial.phase).toBe('day');
    expect(initial.tower.structures).toHaveLength(STARTER_STRUCTURE_COUNT);

    const report = runBalanceBuild({ ...bare, maxSteps: FIRST_WAVE_MAX_STEPS }, seed);
    assertCombatOutcome(bare, report);
  });

  it.each(granted.seeds ?? [])(
    'the documented Slot-granted defense clears wave one (seed: %s)',
    (seed) => {
      const report = runBalanceBuild({ ...granted, maxSteps: FIRST_WAVE_MAX_STEPS }, seed);
      assertCombatOutcome(granted, report);
    },
    15_000,
  );
});
