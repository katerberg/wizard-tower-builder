import type { Cell, ResourceCost, Resources } from '@/model/types';

export const BALANCE_SEEDS = ['first-wave-b', 'first-wave-c'] as const;

export interface BlueprintPlacement {
  blueprintId: string;
  cell: Cell;
}

export interface RecruitSpec {
  cell: Cell;
  /** Extra recruit clicks beyond the free occupant housing already has. */
  extra: number;
}

export interface SlotAllocationSpec {
  cell: Cell;
  count: number;
}

/**
 * Named tower + staff plan used by the balance harness.
 * Economy affordability envelopes are a follow-up (see docs/BALANCE.md).
 */
export interface BalanceBuild {
  id: string;
  title: string;
  expect: 'clear' | 'lose';
  /**
   * When true, combat asserts the *intended* outcome via `it.fails`.
   * CI stays green while the imbalance is visible; remove this flag after a
   * balance pass actually produces that outcome.
   */
  knownFailing?: boolean;
  /** Framing height at Start Wave. Driver grows stems to reach it. */
  height: number;
  placements?: readonly BlueprintPlacement[];
  recruits?: readonly RecruitSpec[];
  slotAllocations?: readonly SlotAllocationSpec[];
  /** Research node ids granted before place (empty = starter kit only). */
  research?: readonly string[];
  /** Extra resources added to the starting wallet / build baseline. */
  wallet?: ResourceCost;
  seeds?: readonly string[];
  /** Attack-phase step cap. Defaults scale with height. */
  maxSteps?: number;
  /** Spawn-queue checks after Start Wave (always asserted, never inside `it.fails`). */
  spawnIncludes?: readonly string[];
}

/** Aggregate result for tests and a later possible-towers catalog. */
export interface SimReport {
  id: string;
  seed: string | number;
  height: number;
  waveStartHeight: number;
  outcome: 'clear' | 'lose';
  wizardHp: number;
  steps: number;
  simTimeSec: number;
  netCost: Resources;
  leftoverWallet: Resources;
  roomsUsed: string[];
  spawnQueue: string[];
  enemiesRemaining: number;
  spawnQueueRemaining: number;
}
