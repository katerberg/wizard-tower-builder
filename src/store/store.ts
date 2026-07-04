import { createInitialState, step } from '@/model/game';
import { MIN_VIEWPORT_HEIGHT } from '@/calculations/camera';
import type { ExteriorNode, Phase } from '@/model/types';
import type { Intent, ViewState } from './intents';
import type { HandlerContext, StoreRefs } from './context';
import { applyIntent } from './handlers';

export interface Snapshot {
  game: StoreRefs['game'];
  view: ViewState;
  /** 0..1 blend from pre-step positions to current (for smooth canvas motion). */
  renderAlpha: number;
  previousEnemyPositions: ReadonlyMap<string, ExteriorNode>;
  /** Successful build edits recorded this phase (undo stack depth). */
  buildUndoDepth: number;
}

type Listener = () => void;

export class Store {
  private refs: StoreRefs;
  private listeners = new Set<Listener>();
  private roomCounter = 0;
  private dirty = false;
  private renderAlpha = 1;
  private previousEnemyPositions = new Map<string, ExteriorNode>();
  private lastPhase: Phase = 'build';

  constructor(seed?: string | number) {
    const game = createInitialState(seed);
    this.lastPhase = game.phase;
    this.refs = {
      game,
      view: {
        selectedBlueprintId: null,
        hoveredCell: null,
        modal: null,
        cameraScrollY: 0,
        viewportHeight: MIN_VIEWPORT_HEIGHT,
      },
      buildHistory: [],
    };
  }

  getSnapshot(): Snapshot {
    return {
      game: this.refs.game,
      view: this.refs.view,
      renderAlpha: this.renderAlpha,
      previousEnemyPositions: this.previousEnemyPositions,
      buildUndoDepth: this.refs.buildHistory.length,
    };
  }

  /** Snapshot enemy positions before a sim step so the canvas can interpolate. */
  captureForRender(): void {
    this.previousEnemyPositions.clear();
    for (const enemy of this.refs.game.enemies) {
      this.previousEnemyPositions.set(enemy.id, { ...enemy.pos });
    }
  }

  setRenderAlpha(alpha: number): void {
    this.renderAlpha = alpha;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(): void {
    for (const listener of this.listeners) listener();
  }

  /** Advance the simulation one fixed timestep (attack phase only). */
  advance(dt: number): void {
    if (this.refs.game.scene === 'run' && this.refs.game.phase === 'attack') {
      step(this.refs.game, dt);
      this.dirty = true;
    }
  }

  /** Notify subscribers once per frame if the simulation changed. */
  flush(): void {
    if (this.lastPhase === 'attack' && this.refs.game.phase === 'build') {
      this.clearBuildHistory();
    }
    this.lastPhase = this.refs.game.phase;

    if (this.dirty) {
      this.dirty = false;
      this.emit();
    }
  }

  dispatch(intent: Intent): void {
    applyIntent(this.handlerContext(), intent);
    this.emit();
  }

  private handlerContext(): HandlerContext {
    const refs = this.refs;
    return {
      get game() {
        return refs.game;
      },
      set game(value) {
        refs.game = value;
      },
      get view() {
        return refs.view;
      },
      set view(value) {
        refs.view = value;
      },
      get buildHistory() {
        return refs.buildHistory;
      },
      set buildHistory(value) {
        refs.buildHistory = value;
      },
      nextRoomId: () => `room-${this.roomCounter++}`,
      recordBuildStep: () => this.recordBuildStep(),
      clearBuildHistory: () => this.clearBuildHistory(),
      closeModalIfRoomMissing: () => this.closeModalIfRoomMissing(),
    };
  }

  private recordBuildStep(): void {
    this.refs.buildHistory.push(structuredClone(this.refs.game.tower));
  }

  private clearBuildHistory(): void {
    this.refs.buildHistory = [];
  }

  private closeModalIfRoomMissing(): void {
    const modal = this.refs.view.modal;
    if (modal?.kind !== 'room') return;
    const exists = this.refs.game.tower.rooms.some((r) => r.id === modal.roomId);
    if (!exists) this.refs.view.modal = null;
  }
}
