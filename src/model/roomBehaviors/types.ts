import type { Cell, Enemy, GameMessageKind, GameState, Room } from '../types';

/** Context for blueprint-native room behavior (turret room, gold mine room, etc.). */
export interface RoomEffectContext {
  state: GameState;
  room: Room;
  cells: Cell[];
  dt: number;
  enemiesNear: (range: number) => Enemy[];
  enemiesTouching: () => Enemy[];
  attackEnemy: (enemy: Enemy, attack: number, dexterity?: number, label?: string) => void;
  reward: (amount: number) => void;
  log: (text: string, kind?: GameMessageKind) => void;
}

export interface RoomBehaviorDef {
  blueprintId: string;
  /** Active attack-phase behavior on a cooldown. */
  attack?: {
    cooldown: () => number;
    run: (ctx: RoomEffectContext) => void;
  };
  /** Fired once when a wave is cleared. */
  onWaveCleared?: (ctx: Omit<RoomEffectContext, 'dt'>) => void;
}
