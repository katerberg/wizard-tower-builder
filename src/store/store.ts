import { getBlueprint } from '@/model/blueprints';
import { canAfford, spend, reward } from '@/calculations/economy';
import { beginRun, createInitialState, step } from '@/model/game';
import { addMessage } from '@/model/messages';
import { beginWave } from '@/model/phases';
import {
  canApplyModification,
  canUpgradeModification,
  getModification,
  modificationCost,
  modificationRefund,
} from '@/model/modifications';
import { canPlace, createRoom, isTowerStable, placeRoom, removeRoom, roomAt } from '@/model/tower';
import { clampScrollY, MIN_VIEWPORT_HEIGHT } from '@/view/canvas/camera';
import type { GameState, ExteriorNode } from '@/model/types';
import type { Intent, ViewState } from './intents';

export type Snapshot = {
  game: GameState;
  view: ViewState;
  /** 0..1 blend from pre-step positions to current (for smooth canvas motion). */
  renderAlpha: number;
  previousEnemyPositions: ReadonlyMap<string, ExteriorNode>;
};

type Listener = () => void;

export class Store {
  private game: GameState;
  private view: ViewState;
  private listeners = new Set<Listener>();
  private roomCounter = 0;
  private dirty = false;
  private renderAlpha = 1;
  private previousEnemyPositions = new Map<string, ExteriorNode>();

  constructor(seed?: string | number) {
    this.game = createInitialState(seed);
    this.view = {
      selectedBlueprintId: this.game.player.unlockedBlueprints[0] ?? null,
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
        if (room) this.view.modal = { kind: 'room', roomId: room.id };
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
          beginWave(game);
        }
        break;

      case 'restart':
        this.game = createInitialState();
        beginRun(this.game);
        this.view = {
          selectedBlueprintId: this.game.player.unlockedBlueprints[0] ?? null,
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
    if (game.phase !== 'build') return;
    const id = this.view.selectedBlueprintId;
    if (!id) return;
    const blueprint = getBlueprint(id);
    if (!blueprint) return;

    const result = canPlace(game.tower, blueprint, cell);
    if (!result.ok) {
      addMessage(game, `Cannot build here: ${result.reason.replace(/_/g, ' ')}.`, 'info');
      return;
    }
    if (!canAfford(game, blueprint.cost)) {
      addMessage(game, `Not enough gold for ${blueprint.name} (${blueprint.cost}).`, 'economy');
      return;
    }
    spend(game, blueprint.cost);
    const room = createRoom(`room-${this.roomCounter++}`, blueprint, cell);
    game.tower = placeRoom(game.tower, room);
    addMessage(game, `Built ${blueprint.name} for ${blueprint.cost} gold.`, 'economy');
  }

  private removeAt(cell: { col: number; row: number }): void {
    const room = roomAt(this.game.tower, cell.col, cell.row);
    if (room) this.sellRoomById(room.id);
  }

  private addModificationTo(roomId: string, modId: string): void {
    const game = this.game;
    if (game.phase !== 'build') return;
    const room = game.tower.rooms.find((r) => r.id === roomId);
    const def = getModification(modId);
    if (!room || !def) return;

    if (!canApplyModification(room, game.tower, modId)) {
      addMessage(game, `Cannot add ${def.name} to this room.`, 'info');
      return;
    }
    const cost = modificationCost(def, 1);
    if (!canAfford(game, cost)) {
      addMessage(game, `Not enough gold for ${def.name} (${cost}).`, 'economy');
      return;
    }
    spend(game, cost);
    room.modifications.push({ id: modId, level: 1 });
    addMessage(game, `Added ${def.name} for ${cost} gold.`, 'economy');
  }

  private upgradeModificationOn(roomId: string, modId: string): void {
    const game = this.game;
    if (game.phase !== 'build') return;
    const room = game.tower.rooms.find((r) => r.id === roomId);
    const def = getModification(modId);
    const mod = room?.modifications.find((m) => m.id === modId);
    if (!room || !def || !mod) return;

    if (!canUpgradeModification(room, modId)) {
      addMessage(game, `${def.name} is already at max level.`, 'info');
      return;
    }
    const cost = modificationCost(def, mod.level + 1);
    if (!canAfford(game, cost)) {
      addMessage(game, `Not enough gold to upgrade ${def.name} (${cost}).`, 'economy');
      return;
    }
    spend(game, cost);
    mod.level += 1;
    addMessage(game, `Upgraded ${def.name} to level ${mod.level} for ${cost} gold.`, 'economy');
  }

  private sellRoomById(roomId: string): void {
    const game = this.game;
    if (game.phase !== 'build') return;
    const room = game.tower.rooms.find((r) => r.id === roomId);
    if (!room) return;

    const blueprint = getBlueprint(room.blueprintId);
    const refund = (blueprint ? Math.floor(blueprint.cost / 2) : 0) + modificationRefund(room);
    game.tower = removeRoom(game.tower, room.id);
    if (refund > 0) reward(game, refund);
    addMessage(game, `Sold ${blueprint?.name ?? 'room'}. Refunded ${refund} gold.`, 'economy');

    if (this.view.modal?.kind === 'room' && this.view.modal.roomId === roomId) {
      this.view.modal = null;
    }
  }
}
