import { describe, expect, it } from 'vitest';
import { STARTER_TOWER_PLACEMENTS } from '@/model/starterTower';
import { framingHeight } from '@/model/phases';
import { BALANCE_BUILDS } from '@/test/balance/builds';
import { assertCombatOutcome, assertSpawnComposition } from '@/test/balance/run';
import { PlayabilityDriver, runBalanceBuild } from '@/test/playability';

const COMBAT_TIMEOUT_MS = 30_000;

function seedsOf(build: (typeof BALANCE_BUILDS)[number]): readonly string[] {
  return build.seeds ?? ['first-wave-b'];
}

describe('balance builds', () => {
  for (const build of BALANCE_BUILDS) {
    const combat = build.knownFailing ? it.fails : it;
    for (const seed of seedsOf(build)) {
      combat(
        `${build.id} ${build.expect}s (seed: ${seed})`,
        () => {
          const report = runBalanceBuild(build, seed);
          assertSpawnComposition(build, report);
          assertCombatOutcome(build, report);
        },
        COMBAT_TIMEOUT_MS,
      );
    }
  }
});

describe('balance harness', () => {
  it('refuses to place a research-locked blueprint without a grant', () => {
    const driver = new PlayabilityDriver('unlock-layer');
    expect(() =>
      driver.place({ blueprintId: 'slotRoom', cell: { col: 8, row: 0 } }),
    ).toThrow(/Unlock layer: slotRoom/);
  });

  it('places Slot after granting bp-slot', () => {
    const driver = new PlayabilityDriver('unlock-grant');
    driver.grantResearch(['bp-slot']);
    driver.place({ blueprintId: 'slotRoom', cell: { col: 8, row: 0 } });
    expect(driver.store.getSnapshot().game.tower.rooms.some((room) => room.blueprintId === 'slotRoom')).toBe(
      true,
    );
  });

  it('raiseToHeight can grow the starter tower to 80', () => {
    const driver = new PlayabilityDriver('any-height');
    driver.overlayWallet({ stone: 250 });
    driver.raiseToHeight(80);
    expect(framingHeight(driver.store.getSnapshot().game)).toBe(80);
  });

  it('scale-height-15 samples plateau 15 (strikers in the spawn queue)', () => {
    const build = BALANCE_BUILDS.find((candidate) => candidate.id === 'scale-height-15');
    if (!build) throw new Error('scale-height-15 fixture missing');

    const driver = new PlayabilityDriver('first-wave-b');
    expect(driver.store.getSnapshot().game.tower.structures).toHaveLength(STARTER_TOWER_PLACEMENTS.length);
    driver.applyBuild(build);
    expect(framingHeight(driver.store.getSnapshot().game)).toBe(15);

    driver.startWave();
    const game = driver.store.getSnapshot().game;
    expect(game.waveStartHeight).toBe(15);
    expect(game.spawnQueue).toContain('striker');
  });
});
