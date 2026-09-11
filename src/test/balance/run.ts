import { expect } from 'vitest';
import type { BalanceBuild, SimReport } from '@/test/balance/types';

export function assertCombatOutcome(build: BalanceBuild, report: SimReport): void {
  const label = `id=${report.id} seed=${report.seed} outcome=${report.outcome} hp=${report.wizardHp} enemies=${report.enemiesRemaining} queue=${report.spawnQueueRemaining} broke=${report.collectorBroke}`;

  if (build.expect === 'lose') {
    expect(report.outcome, label).toBe('lose');
    return;
  }

  if (build.expect === 'raid') {
    expect(report.outcome, label).toBe('raid');
    expect(report.collectorBroke, label).toBe(true);
    expect(report.enemiesRemaining, label).toBe(0);
    expect(report.spawnQueueRemaining, label).toBe(0);
    return;
  }

  expect(report.outcome, label).toBe('clear');
  expect(report.collectorBroke, label).toBe(false);
  expect(report.enemiesRemaining, label).toBe(0);
  expect(report.spawnQueueRemaining, label).toBe(0);
}

export function assertSpawnComposition(build: BalanceBuild, report: SimReport): void {
  const label = `id=${report.id} seed=${report.seed} waveStartHeight=${report.waveStartHeight}`;
  expect(report.waveStartHeight, label).toBe(build.height);
  for (const templateId of build.spawnIncludes ?? []) {
    expect(report.spawnQueue, `${label} missing ${templateId}`).toContain(templateId);
  }
}
