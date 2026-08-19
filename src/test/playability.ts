import { FIXED_DT } from '@/config/constants';
import type { Cell, GameState, Scene } from '@/model/types';
import { Store } from '@/store/store';
import { completeConstruction } from '@/test/construction';

export interface BlueprintPlacement {
  blueprintId: string;
  cell: Cell;
}

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

  place({ blueprintId, cell }: BlueprintPlacement): void {
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

  runUntilTerminal(maxSteps: number): TerminalMetrics {
    for (let steps = 0; steps < maxSteps; steps += 1) {
      this.store.advance(FIXED_DT);

      const { game } = this.store.getSnapshot();
      // After a full night cycle, dawn returns to day with wave complete
      if (game.phase === 'day' && game.enemies.length === 0 && game.spawnQueue.length === 0 && steps > 100) {
        return this.metrics(steps + 1);
      }
      if (game.scene !== 'run') {
        return this.metrics(steps + 1);
      }
    }

    throw new Error(`Simulation did not reach a terminal state: ${this.describe(this.metrics(maxSteps))}`);
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
