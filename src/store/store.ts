import { getBlueprint } from '@/model/blueprints';
import { canAfford, spend, reward } from '@/calculations/economy';
import { beginRun, createInitialState, step } from '@/model/game';
import { addMessage } from '@/model/messages';
import { beginWave } from '@/model/phases';
import { canPlace, createRoom, isTowerStable, placeRoom, removeRoom, roomAt } from '@/model/tower';
import type { GameState } from '@/model/types';
import type { Intent, ViewState } from './intents';

export type Snapshot = { game: GameState; view: ViewState };

type Listener = () => void;

export class Store {
  private game: GameState;
  private view: ViewState;
  private listeners = new Set<Listener>();
  private roomCounter = 0;
  private dirty = false;

  constructor(seed?: string | number) {
    this.game = createInitialState(seed);
    this.view = {
      selectedBlueprintId: this.game.player.unlockedBlueprints[0] ?? null,
      hoveredCell: null,
      modal: null,
    };
  }

  getSnapshot(): Snapshot {
    return { game: this.game, view: this.view };
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
        };
        break;

      case 'toggleDevMode':
        game.devMode = !game.devMode;
        addMessage(game, `Dev mode ${game.devMode ? 'on' : 'off'}.`, 'info');
        break;

      case 'devAddCurrency':
        if (game.devMode) {
          reward(game, 50);
          addMessage(game, 'Dev: +50 mana.', 'economy');
        }
        break;

      case 'devSkipWave':
        if (game.devMode && game.phase === 'attack') {
          game.enemies = [];
          game.spawnQueue = [];
          addMessage(game, 'Dev: wave skipped.', 'info');
        }
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
      addMessage(game, `Not enough mana for ${blueprint.name} (${blueprint.cost}).`, 'economy');
      return;
    }
    spend(game, blueprint.cost);
    const room = createRoom(`room-${this.roomCounter++}`, blueprint, cell);
    game.tower = placeRoom(game.tower, room);
    addMessage(game, `Built ${blueprint.name} for ${blueprint.cost} mana.`, 'economy');
  }

  private removeAt(cell: { col: number; row: number }): void {
    const game = this.game;
    if (game.phase !== 'build') return;
    const room = roomAt(game.tower, cell.col, cell.row);
    if (!room) return;
    const blueprint = getBlueprint(room.blueprintId);
    game.tower = removeRoom(game.tower, room.id);
    if (blueprint) {
      const refund = Math.floor(blueprint.cost / 2);
      reward(game, refund);
      addMessage(game, `Removed ${blueprint.name}. Refunded ${refund} mana.`, 'economy');
    }
  }
}
