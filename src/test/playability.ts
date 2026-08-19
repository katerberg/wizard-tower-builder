import { netBuildCost } from '@/calculations/buildCost';
import { addResources, cloneResources } from '@/calculations/resources';
import { FIXED_DT, GRID_COLS } from '@/config/constants';
import { depositToStorage, stockpileFromCost } from '@/model/storage';
import { framingHeight } from '@/model/phases';
import { hasStructure, towerExtents } from '@/model/tower';
import type { Cell, GameState, ResourceCost, Resources, Scene } from '@/model/types';
import { Store } from '@/store/store';
import { completeConstruction } from '@/test/construction';
import type { BalanceBuild, BlueprintPlacement, SimReport } from '@/test/balance/types';
import type { BuildBaseline } from '@/model/types';

export type { BlueprintPlacement };

export interface TerminalMetrics {
  seed: string | number;
  steps: number;
  scene: Scene;
  phase: GameState['phase'];
  wizardHp: number;
  currency: number;
  enemiesRemaining: number;
  spawnQueueRemaining: number;
}

export class PlayabilityDriver {
  readonly store: Store;

  constructor(readonly seed: string | number) {
    this.store = new Store(seed);
  }

  /**
   * Add resources to the live wallet (test overlay).
   * Does not go through dev-add-currency; used when a fixture declares `wallet`.
   */
  overlayWallet(extra: ResourceCost): void {
    const game = this.store.getSnapshot().game;
    game.player.resources = addResources(game.player.resources, extra);
    const physical = stockpileFromCost(extra);
    if (physical.stone > 0 || physical.metal > 0) {
      const overflow = depositToStorage(game, physical);
      if (overflow.stone > 0 || overflow.metal > 0) {
        const site = Object.values(game.storageSites)[0];
        if (site) {
          site.stockpile.stone += overflow.stone;
          site.stockpile.metal += overflow.metal;
        }
      }
    }
  }

  /**
   * Stack Spire Blocks on the current crown until framing height is `target`.
   * Height-agnostic: 5, 15, or 80 use the same path. Does not shrink.
   */
  raiseToHeight(target: number): void {
    const current = framingHeight(this.store.getSnapshot().game);
    if (current === target) return;
    if (current < 0) {
      throw new Error(`raiseToHeight(${target}) failed: tower has no framing (seed ${this.seed}).`);
    }
    if (current > target) {
      throw new Error(
        `raiseToHeight(${target}) failed: tower is already height ${current} (seed ${this.seed}).`,
      );
    }

    const stemsNeeded = target - current;
    if (stemsNeeded > 0) {
      this.overlayWallet({ stone: stemsNeeded * 3 + 24 });
    }

    const col = this.growColumn();
    for (let row = current + 1; row <= target; row += 1) {
      this.place({ blueprintId: 'stem', cell: { col, row } });
      this.waitForConstruction();
    }

    const after = framingHeight(this.store.getSnapshot().game);
    if (after !== target) {
      throw new Error(
        `raiseToHeight(${target}) ended at height ${after} (seed ${this.seed}).`,
      );
    }
  }

  /** Instant-complete listed research nodes (dev unlock, then leave dev mode). */
  grantResearch(nodeIds: readonly string[]): void {
    if (nodeIds.length === 0) return;

    const game = this.store.getSnapshot().game;
    const wasDev = game.devMode;
    if (!wasDev) this.store.dispatch({ type: 'toggleDevMode' });

    for (const nodeId of nodeIds) {
      this.store.dispatch({ type: 'devUnlockResearch', nodeId });
      if (!this.store.getSnapshot().game.player.research.completedNodeIds.includes(nodeId)) {
        throw new Error(`Unlock layer: research ${nodeId} did not complete (seed ${this.seed}).`);
      }
    }

    if (!wasDev) this.store.dispatch({ type: 'toggleDevMode' });
  }

  place({ blueprintId, cell }: BlueprintPlacement): void {
    const unlocked = this.store.getSnapshot().game.player.unlockedBlueprints;
    if (!unlocked.includes(blueprintId)) {
      throw new Error(
        `Unlock layer: ${blueprintId} is not in the library at (${cell.col}, ${cell.row}) with seed ${this.seed}. Grant its research on the fixture or pick a starter-kit blueprint.`,
      );
    }

    const before = this.store.getSnapshot().game.constructionOrders.length;
    this.store.dispatch({ type: 'selectBlueprint', blueprintId });
    this.store.dispatch({ type: 'placeSelectedAt', cell });

    if (this.store.getSnapshot().game.constructionOrders.length <= before) {
      throw new Error(
        `Placement failed for ${blueprintId} at (${cell.col}, ${cell.row}) with seed ${this.seed}.`,
      );
    }
  }

  /** Advance sim until construction orders finish (phase timer paused). */
  waitForConstruction(maxSeconds = 120): void {
    completeConstruction(this.store, maxSeconds);
  }

  startWave(): void {
    this.store.dispatch({ type: 'startWave' });
    const { game } = this.store.getSnapshot();
    if (game.phase !== 'night') {
      throw new Error(`Wave did not start with seed ${this.seed}.`);
    }
  }

  recruitAt(cell: Cell): void {
    const roomId = this.roomIdAt(cell);
    this.store.dispatch({ type: 'recruitStaff', housingRoomId: roomId });
    // Side job completes after RECRUIT_SIDE_JOB_SEC
    for (let i = 0; i < 300; i += 1) {
      this.store.advance(FIXED_DT);
      const recruited = this.store.getSnapshot().game.housingRecruited[roomId] ?? 0;
      if (recruited >= 2) return;
    }
  }

  allocateSlotAt(cell: Cell, count: number): void {
    this.store.dispatch({ type: 'setSlotAllocation', slotRoomId: this.roomIdAt(cell), count });
    const { game } = this.store.getSnapshot();
    const roomId = this.roomIdAt(cell);
    if (game.slotAllocations[roomId] !== count) {
      throw new Error(`Slot allocation failed at (${cell.col}, ${cell.row}) with seed ${this.seed}.`);
    }
  }

  applyBuild(build: BalanceBuild): void {
    if (build.wallet) this.overlayWallet(build.wallet);
    this.raiseToHeight(build.height);
    this.grantResearch(build.research ?? []);
    for (const placement of build.placements ?? []) this.place(placement);
    this.waitForConstruction();
    for (const recruit of build.recruits ?? []) {
      for (let i = 0; i < recruit.extra; i += 1) this.recruitAt(recruit.cell);
    }
    for (const slot of build.slotAllocations ?? []) {
      this.allocateSlotAt(slot.cell, slot.count);
    }
  }

  runUntilTerminal(maxSteps: number): TerminalMetrics {
    for (let steps = 0; steps < maxSteps; steps += 1) {
      this.store.advance(FIXED_DT);

      const { game } = this.store.getSnapshot();
      if (game.scene !== 'run') {
        return this.metrics(steps + 1);
      }
      if (
        game.enemies.length === 0 &&
        game.spawnQueue.length === 0 &&
        game.solarCollector.hp > 0 &&
        steps > 100
      ) {
        return this.metrics(steps + 1);
      }
    }

    throw new Error(`Simulation did not reach a terminal state: ${this.describe(this.metrics(maxSteps))}`);
  }

  simReport(build: BalanceBuild, steps: number, netCost: Resources, spawnQueue: string[]): SimReport {
    const { game } = this.store.getSnapshot();
    const metrics = this.metrics(steps);
    return {
      id: build.id,
      seed: this.seed,
      height: build.height,
      waveStartHeight: game.waveStartHeight,
      outcome: this.outcome(game),
      wizardHp: metrics.wizardHp,
      steps,
      simTimeSec: steps * FIXED_DT,
      netCost,
      leftoverWallet: cloneResources(game.player.resources),
      roomsUsed: game.tower.rooms.map((room) => room.blueprintId),
      spawnQueue,
      enemiesRemaining: metrics.enemiesRemaining,
      spawnQueueRemaining: metrics.spawnQueueRemaining,
    };
  }

  metrics(steps: number): TerminalMetrics {
    const { game } = this.store.getSnapshot();
    return {
      seed: this.seed,
      steps,
      scene: game.scene,
      phase: game.phase,
      wizardHp: game.solarCollector.hp,
      currency: game.player.resources.gold,
      enemiesRemaining: game.enemies.length,
      spawnQueueRemaining: game.spawnQueue.length,
    };
  }

  describe(metrics: TerminalMetrics): string {
    return [
      `seed=${metrics.seed}`,
      `steps=${metrics.steps}`,
      `scene=${metrics.scene}`,
      `phase=${metrics.phase}`,
      `wizardHp=${metrics.wizardHp}`,
      `currency=${metrics.currency}`,
      `enemies=${metrics.enemiesRemaining}`,
      `queue=${metrics.spawnQueueRemaining}`,
    ].join(', ');
  }

  describeReport(report: SimReport): string {
    return [
      `id=${report.id}`,
      `seed=${report.seed}`,
      `height=${report.height}`,
      `waveStartHeight=${report.waveStartHeight}`,
      `outcome=${report.outcome}`,
      `steps=${report.steps}`,
      `wizardHp=${report.wizardHp}`,
      `enemies=${report.enemiesRemaining}`,
      `queue=${report.spawnQueueRemaining}`,
      `rooms=${report.roomsUsed.join('|') || 'none'}`,
    ].join(', ');
  }

  private outcome(game: GameState): 'clear' | 'lose' {
    if (game.scene === 'gameOver') return 'lose';
    if (game.scene === 'victory') return 'clear';
    if (game.scene === 'run' && game.enemies.length === 0 && game.spawnQueue.length === 0) {
      return game.solarCollector.hp > 0 ? 'clear' : 'lose';
    }
    throw new Error(`Could not classify outcome: scene=${game.scene} phase=${game.phase} (seed ${this.seed}).`);
  }

  private growColumn(): number {
    const tower = this.store.getSnapshot().game.tower;
    const { maxOccupiedRow } = towerExtents(tower);
    const preferred = [6, 7, 8];
    for (const col of preferred) {
      if (hasStructure(tower, col, maxOccupiedRow)) return col;
    }
    for (let col = 0; col < GRID_COLS; col += 1) {
      if (hasStructure(tower, col, maxOccupiedRow)) return col;
    }
    throw new Error(`raiseToHeight: no framing on crown row ${maxOccupiedRow} (seed ${this.seed}).`);
  }

  private roomIdAt(cell: Cell): string {
    const room = this.store
      .getSnapshot()
      .game.tower.rooms.find((candidate) => candidate.origin.col === cell.col && candidate.origin.row === cell.row);
    if (!room) {
      throw new Error(`No room found at (${cell.col}, ${cell.row}) with seed ${this.seed}.`);
    }
    return room.id;
  }
}

export function defaultMaxSteps(height: number): number {
  return (height <= 5 ? 90 : 180) * 60;
}

/** Place, start the wave, simulate until terminal, return an in-memory sim report. */
export function runBalanceBuild(build: BalanceBuild, seed: string | number): SimReport {
  const driver = new PlayabilityDriver(seed);
  const initial = driver.store.getSnapshot().game;
  const baseline: BuildBaseline = {
    tower: structuredClone(initial.tower),
    resources: cloneResources(initial.player.resources),
    housingRecruited: { ...initial.housingRecruited },
    slotAllocations: { ...initial.slotAllocations },
    manaSpringAllocations: { ...initial.manaSpringAllocations },
    researchRoomAllocations: { ...initial.researchRoomAllocations },
    prospectAllocation: initial.prospectAllocation,
  };

  driver.applyBuild(build);

  const tower = driver.store.getSnapshot().game.tower;
  const netCost = netBuildCost(baseline, tower);

  driver.startWave();
  const afterStart = driver.store.getSnapshot().game;
  const spawnQueue = [...afterStart.spawnQueue];

  const maxSteps = build.maxSteps ?? defaultMaxSteps(build.height);
  const metrics = driver.runUntilTerminal(maxSteps);
  return driver.simReport(build, metrics.steps, netCost, spawnQueue);
}
