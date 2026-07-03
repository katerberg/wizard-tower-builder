import type { Cell, Enemy, GameMessageKind, GameState, Room, RoomStats, Tower } from '../types';

/**
 * Context handed to a modification's active/lifecycle hooks. The dispatcher
 * builds this per room so definition files never import combat/economy/messages
 * directly — they only describe behavior in terms of these helpers.
 */
export interface ModEffectContext {
  state: GameState;
  room: Room;
  /** The room's footprint cells. */
  cells: Cell[];
  /** Level of this modification on the room. */
  level: number;
  /** Seconds elapsed this tick. */
  dt: number;
  /** Living enemies within `range` cells of the room's footprint, nearest first. */
  enemiesNear: (range: number) => Enemy[];
  /** Living enemies standing on or orthogonally adjacent to the footprint. */
  enemiesTouching: () => Enemy[];
  /** True when `enemy` (onEnemyStep only) is on or beside the footprint. */
  enemyTouchesFootprint?: boolean;
  /** Roll an attack against an enemy and apply damage (handles RNG + log). */
  attackEnemy: (enemy: Enemy, attack: number, dexterity?: number) => void;
  /** Grant currency to the player. */
  reward: (amount: number) => void;
  /** Append a message to the game log. */
  log: (text: string, kind?: GameMessageKind) => void;
}

/**
 * A room modification type. Adding a new modification to the game is a single
 * new file exporting one of these plus a line in the registry.
 */
export interface ModificationDef {
  id: string;
  name: string;
  glyph: string;
  color: string;
  description: string;
  /** Highest level this modification can reach. */
  maxLevel: number;
  /** Gold cost to bring the modification to `level` (cost(1) adds it). */
  cost: (level: number) => number;
  /** Fraction of gold spent refunded when the room is sold (default 0.5). */
  sellRefundRate?: number;
  /** Whether this modification may be added to the given room. Defaults to true. */
  canApply?: (room: Room, tower: Tower) => boolean;
  /** Passive contribution folded into computeRoomStats. */
  passiveStats?: (level: number) => Partial<RoomStats>;
  /** Active attack-phase behavior, fired on a per-level cooldown. */
  attack?: {
    cooldown: (level: number) => number;
    run: (ctx: ModEffectContext) => void;
  };
  /** Fired when an enemy finishes a climb step; use for contact hazards (spikes). */
  onEnemyStep?: {
    run: (ctx: ModEffectContext & { enemy: Enemy; enemyTouchesFootprint: boolean }) => void;
  };
  /** Lifecycle hook fired once when a wave is cleared (e.g. passive income). */
  onWaveCleared?: (ctx: Omit<ModEffectContext, 'dt'>) => void;
}
