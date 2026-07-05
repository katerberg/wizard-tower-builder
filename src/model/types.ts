export interface Cell { col: number; row: number }

export interface Modifier { attack?: number; defense?: number; hp?: number }

export interface Blueprint {
  id: string;
  name: string;
  glyph: string;
  color: string;
  size: { w: number; h: number };
  cost: number;
  baseHp: number;
  description: string;
}

/** A modification instance attached to a room (one per type, leveled in place). */
export interface RoomModification { id: string; level: number }

export interface Room {
  id: string;
  blueprintId: string;
  origin: Cell;
  size: { w: number; h: number };
  modifications: RoomModification[];
  hp: number;
}

export interface RoomStats { maxHp: number; attack: number; defense: number }

export interface Tower {
  rooms: Room[];
  occupancy: Record<string, string>;
}

/** Snapshot of tower + gold at the start of a build phase (planning baseline). */
export interface BuildBaseline { tower: Tower; currency: number }

export interface Wizard {
  hp: number;
  maxHp: number;
  glyph: string;
  // v1 defense: wizard auto-attacks; dedicated turret rooms also fire via roomBehaviors.
  attack: number;
  defense: number;
  dexterity: number;
  range: number;
  attackCooldown: number;
}

export type ExteriorFace = 'left' | 'right' | 'top';

export interface ExteriorNode { col: number; row: number; face: ExteriorFace }

export type MovementKind = 'under_overhang' | 'surface_climb' | 'attack_overhang' | 'fly' | 'face_transfer';

export interface MovementProfile {
  kind: MovementKind;
  canPassUnderOverhang: boolean;
  canAttackOverhang: boolean;
  canFly: boolean;
  canTransferFaces: boolean;
}

export interface EnemyTemplate {
  id: string;
  type: string;
  glyph: string;
  color: string;
  stats: { strength: number; dexterity: number; maxHp: number };
  speed: number;
  currencyReward: number;
  movement: MovementProfile;
  dropChance?: number;
  dropItemId?: string;
}

export interface Enemy {
  id: string;
  templateId: string;
  name: string;
  pos: ExteriorNode;
  path: ExteriorNode[];
  pathIndex: number;
  currentHp: number;
  moveCooldown: number;
  attackCooldown: number;
}

export type GameMessageKind = 'info' | 'combat' | 'economy';

export interface GameMessage { text: string; kind: GameMessageKind }

export interface Player {
  currency: number;
  unlockedBlueprints: string[];
  levelIndex: number;
  wizard: Wizard;
  mana: number;
  maxMana: number;
}

export type ProgressionMode = 'linear' | 'branching';

export type Phase = 'build' | 'attack';

export type Scene = 'menu' | 'run' | 'gameOver' | 'victory';

export interface GameState {
  scene: Scene;
  phase: Phase;
  progressionMode: ProgressionMode;
  levelIndex: number;
  waveIndex: number;
  waveTimer: number;
  spawnTimer: number;
  spawnQueue: string[];
  player: Player;
  tower: Tower;
  enemies: Enemy[];
  messages: GameMessage[];
  rngState: number;
  devMode: boolean;
  roomEffectTimers: Record<string, number>;
  /** Seconds remaining before each spell can be cast again. */
  spellCooldowns: Record<string, number>;
  /** Tower + gold at build-phase start; edits commit on wave start. */
  buildBaseline: BuildBaseline | null;
}

export type PlacementReason =
  | 'ok'
  | 'out_of_bounds'
  | 'overlap'
  | 'no_support'
  | 'overhang_too_far'
  | 'disconnected';

export interface PlacementResult { ok: boolean; reason: PlacementReason }
