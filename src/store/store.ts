import { getBlueprint } from '@/model/blueprints';
import { canAffordBuild, netBuildCost } from '@/calculations/buildCost';
import { reward } from '@/calculations/economy';
import { beginRun, createInitialState, step } from '@/model/game';
import { addMessage } from '@/model/messages';
import { beginWave } from '@/model/phases';
import {
  canApplyModification,
  canUpgradeModification,
  getModification,
  modificationCost,
} from '@/model/modifications';
import { canPlace, createRoom, isTowerStable, placeRoomReplacing, removeRoom, roomAt, towersEqual } from '@/model/tower';
import { clampScrollY, MIN_VIEWPORT_HEIGHT } from '@/view/canvas/camera';
import type { GameState, ExteriorNode, Phase, Tower } from '@/model/types';
import type { Intent, ViewState } from './intents';

export interface Snapshot {
  game: GameState;
  view: ViewState;
  /** 0..1 blend from pre-step positions to current (for smooth canvas motion). */
  renderAlpha: number;
  previousEnemyPositions: ReadonlyMap<string, ExteriorNode>;
  /** Successful build edits recorded this phase (undo stack depth). */
  buildUndoDepth: number;
}

type Listener = () => void;

export class Store {
  private game: GameState;
  private view: ViewState;
  private listeners = new Set<Listener>();
  private roomCounter = 0;
  private dirty = false;
  private renderAlpha = 1;
  private previousEnemyPositions = new Map<string, ExteriorNode>();
  private buildHistory: Tower[] = [];
  private lastPhase: Phase = 'build';

  constructor(seed?: string | number) {
    this.game = createInitialState(seed);
    this.lastPhase = this.game.phase;
    this.view = {
      selectedBlueprintId: null,
      hoveredCell: null,
      modal: null,
      cameraScrollY: 0,
      viewportHeight: MIN_VIEWPORT_HEIGHT,
    };
  }

  getSnapshot(): Snapshot {
    return {
      game: this.game,
      view: this.view,
      renderAlpha: this.renderAlpha,
      previousEnemyPositions: this.previousEnemyPositions,
      buildUndoDepth: this.buildHistory.length,
    };
  }

  /** Snapshot enemy positions before a sim step so the canvas can interpolate. */
  captureForRender(): void {
    this.previousEnemyPositions.clear();
    for (const enemy of this.game.enemies) {
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
    if (this.game.scene === 'run' && this.game.phase === 'attack') {
      step(this.game, dt);
      this.dirty = true;
    }
  }

  /** Notify subscribers once per frame if the simulation changed. */
  flush(): void {
    if (this.lastPhase === 'attack' && this.game.phase === 'build') {
      this.clearBuildHistory();
    }
    this.lastPhase = this.game.phase;

    if (this.dirty) {
      this.dirty = false;
      this.emit();
    }
  }

  dispatch(intent: Intent): void {
    this.apply(intent);
    this.emit();
  }

  private apply(intent: Intent): void {
    const game = this.game;
    switch (intent.type) {
      case 'beginRun':
        beginRun(game);
        this.clearBuildHistory();
        break;

      case 'selectBlueprint':
        this.view.selectedBlueprintId = intent.blueprintId;
        break;

      case 'hoverCell':
        this.view.hoveredCell = intent.cell;
        break;

      case 'placeSelectedAt':
        this.placeSelected(intent.cell);
        break;

      case 'removeRoomAt':
        this.removeAt(intent.cell);
        break;

      case 'inspectRoomAt': {
        const room = roomAt(game.tower, intent.cell.col, intent.cell.row);
        if (room) {
          this.view.selectedBlueprintId = null;
          this.view.modal = { kind: 'room', roomId: room.id };
        }
        break;
      }

      case 'addModification':
        this.addModificationTo(intent.roomId, intent.modId);
        break;

      case 'upgradeModification':
        this.upgradeModificationOn(intent.roomId, intent.modId);
        break;

      case 'sellRoom':
        this.sellRoomById(intent.roomId);
        break;

      case 'closeModal':
        this.view.modal = null;
        break;

      case 'startWave':
        if (game.scene === 'run' && game.phase === 'build') {
          if (!isTowerStable(game.tower)) {
            addMessage(game, 'The tower is unstable. Remove or support floating rooms first.', 'info');
            break;
          }
          if (game.buildBaseline) {
            const net = netBuildCost(game.buildBaseline, game.tower);
            game.player.currency = game.buildBaseline.currency - net;
          }
          this.clearBuildHistory();
          beginWave(game);
        }
        break;

      case 'undoBuild':
        this.undoBuild();
        break;

      case 'revertBuild':
        this.revertBuild();
        break;

      case 'restart':
        this.game = createInitialState();
        beginRun(this.game);
        this.clearBuildHistory();
        this.lastPhase = this.game.phase;
        this.view = {
          selectedBlueprintId: null,
          hoveredCell: null,
          modal: null,
          cameraScrollY: 0,
          viewportHeight: this.view.viewportHeight,
        };
        break;

      case 'toggleDevMode':
        game.devMode = !game.devMode;
        addMessage(game, `Dev mode ${game.devMode ? 'on' : 'off'}.`, 'info');
        break;

      case 'devAddCurrency':
        if (game.devMode) {
          reward(game, 50);
          if (game.buildBaseline) game.buildBaseline.currency += 50;
          addMessage(game, 'Dev: +50 gold.', 'economy');
        }
        break;

      case 'devSkipWave':
        if (game.devMode && game.phase === 'attack') {
          game.enemies = [];
          game.spawnQueue = [];
          addMessage(game, 'Dev: wave skipped.', 'info');
        }
        break;

      case 'scrollCamera':
        // Negate deltaY so wheel-down shows lower rows (standard browser scroll).
        this.view.cameraScrollY = clampScrollY(
          this.view.cameraScrollY - intent.deltaY,
          game.tower,
          this.view.viewportHeight,
        );
        break;

      case 'setViewportHeight':
        if (intent.height === this.view.viewportHeight) break;
        this.view.viewportHeight = intent.height;
        this.view.cameraScrollY = clampScrollY(this.view.cameraScrollY, game.tower, intent.height);
        break;
    }
  }

  private placeSelected(cell: { col: number; row: number }): void {
    const game = this.game;
    if (game.phase !== 'build' || !game.buildBaseline) return;
    const id = this.view.selectedBlueprintId;
    if (!id) return;
    const blueprint = getBlueprint(id);
    if (!blueprint) return;

    const result = canPlace(game.tower, blueprint, cell);
    if (!result.ok) {
      addMessage(game, `Cannot build here: ${result.reason.replace(/_/g, ' ')}.`, 'info');
      return;
    }

    const room = createRoom(`room-${this.roomCounter++}`, blueprint, cell);
    const placed = placeRoomReplacing(game.tower, room, blueprint);
    if (!placed.ok || !placed.tower) {
      addMessage(game, `Cannot build here: ${placed.reason.replace(/_/g, ' ')}.`, 'info');
      return;
    }
    if (!canAffordBuild(game.buildBaseline, placed.tower)) {
      addMessage(game, `Not enough gold for ${blueprint.name} (${blueprint.cost}).`, 'economy');
      return;
    }
    this.recordBuildStep();
    game.tower = placed.tower;
    if (this.view.modal?.kind === 'room') {
      this.view.modal = null;
    }
    addMessage(game, `Placed ${blueprint.name}.`, 'info');
  }

  private removeAt(cell: { col: number; row: number }): void {
    const room = roomAt(this.game.tower, cell.col, cell.row);
    if (room) this.sellRoomById(room.id);
  }

  private addModificationTo(roomId: string, modId: string): void {
    const game = this.game;
    if (game.phase !== 'build' || !game.buildBaseline) return;
    const room = game.tower.rooms.find((r) => r.id === roomId);
    const def = getModification(modId);
    if (!room || !def) return;

    if (!canApplyModification(room, game.tower, modId)) {
      addMessage(game, `Cannot add ${def.name} to this room.`, 'info');
      return;
    }
    const cost = modificationCost(def, 1);
    if (!canAffordBuild(game.buildBaseline, game.tower, cost)) {
      addMessage(game, `Not enough gold for ${def.name} (${cost}).`, 'economy');
      return;
    }
    this.recordBuildStep();
    room.modifications.push({ id: modId, level: 1 });
    addMessage(game, `Added ${def.name}.`, 'info');
  }

  private upgradeModificationOn(roomId: string, modId: string): void {
    const game = this.game;
    if (game.phase !== 'build' || !game.buildBaseline) return;
    const room = game.tower.rooms.find((r) => r.id === roomId);
    const def = getModification(modId);
    const mod = room?.modifications.find((m) => m.id === modId);
    if (!room || !def || !mod) return;

    if (!canUpgradeModification(room, modId)) {
      addMessage(game, `${def.name} is already at max level.`, 'info');
      return;
    }
    const cost = modificationCost(def, mod.level + 1);
    if (!canAffordBuild(game.buildBaseline, game.tower, cost)) {
      addMessage(game, `Not enough gold to upgrade ${def.name} (${cost}).`, 'economy');
      return;
    }
    this.recordBuildStep();
    mod.level += 1;
    addMessage(game, `Upgraded ${def.name} to level ${mod.level}.`, 'info');
  }

  private sellRoomById(roomId: string): void {
    const game = this.game;
    if (game.phase !== 'build' || !game.buildBaseline) return;
    const room = game.tower.rooms.find((r) => r.id === roomId);
    if (!room) return;

    const blueprint = getBlueprint(room.blueprintId);
    this.recordBuildStep();
    game.tower = removeRoom(game.tower, room.id);
    addMessage(game, `Removed ${blueprint?.name ?? 'room'}.`, 'info');

    if (this.view.modal?.kind === 'room' && this.view.modal.roomId === roomId) {
      this.view.modal = null;
    }
  }

  private recordBuildStep(): void {
    this.buildHistory.push(structuredClone(this.game.tower));
  }

  private clearBuildHistory(): void {
    this.buildHistory = [];
  }

  private closeModalIfRoomMissing(): void {
    const modal = this.view.modal;
    if (modal?.kind !== 'room') return;
    const exists = this.game.tower.rooms.some((r) => r.id === modal.roomId);
    if (!exists) this.view.modal = null;
  }

  private undoBuild(): void {
    const game = this.game;
    if (game.phase !== 'build' || !game.buildBaseline || this.buildHistory.length === 0) return;

    game.tower = this.buildHistory.pop()!;
    this.closeModalIfRoomMissing();
    addMessage(game, 'Undid last change.', 'info');
  }

  private revertBuild(): void {
    const game = this.game;
    const baseline = game.buildBaseline;
    if (game.phase !== 'build' || !baseline) return;
    if (towersEqual(game.tower, baseline.tower)) return;

    game.tower = structuredClone(baseline.tower);
    this.clearBuildHistory();
    this.closeModalIfRoomMissing();
    addMessage(game, 'Reverted to wave start layout.', 'info');
  }
}
