import type { Cell, Enemy, GameMessageKind, GameState, ResourceCost, Room } from '../types';

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

export type RoomRole =
  | 'boiler'
  | 'steamTurret'
  | 'manaSpring'
  | 'hydrant'
  | 'slot'
  | 'turret'
  | 'research';

export interface RoomBehaviorDef {
  blueprintId: string;
  mechanics: string;
  /** Identity flags replacing blueprintId === checks. */
  roles?: readonly RoomRole[];
  attack?: {
    cooldown: () => number;
    run: (ctx: RoomEffectContext) => void;
  };
  onWaveCleared?: (ctx: Omit<RoomEffectContext, 'dt'>) => void;
  /** Called once per attack tick for continuous rooms. */
  tick?: (state: GameState, dt: number) => void;
  /** Wave-start / state reset hook. */
  reset?: (state: GameState) => void;
}
