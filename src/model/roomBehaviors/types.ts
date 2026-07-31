import type { Cell, Enemy, GameMessageKind, GameState, ResourceCost, Room } from '../types';

/** Context for blueprint-native room behavior (turret room, slot room, etc.). */
export interface RoomEffectContext {
  state: GameState;
  room: Room;
  cells: Cell[];
  dt: number;
  enemiesNear: (range: number) => Enemy[];
  enemiesTouching: () => Enemy[];
  attackEnemy: (enemy: Enemy, attack: number, dexterity?: number, label?: string) => void;
  reward: (amount: ResourceCost) => void;
  log: (text: string, kind?: GameMessageKind) => void;
}

export interface RoomBehaviorDef {
  blueprintId: string;
  /** Literal effect summary for UI tooltips. */
  mechanics: string;
  /** Active attack-phase behavior on a cooldown. */
  attack?: {
    cooldown: () => number;
    run: (ctx: RoomEffectContext) => void;
  };
  /** Fired once when a wave is cleared. */
  onWaveCleared?: (ctx: Omit<RoomEffectContext, 'dt'>) => void;
}
