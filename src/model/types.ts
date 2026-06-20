export type Cell = { col: number; row: number };

export type Modifier = { attack?: number; defense?: number; hp?: number };

export type Blueprint = {
  id: string;
  name: string;
  glyph: string;
  color: string;
  size: { w: number; h: number };
  cost: number;
  baseHp: number;
};

export type ItemKind = 'module' | 'consumable';

export type Effect = { id: string; value: number };

export type Item = {
  id: string;
  kind: ItemKind;
  name: string;
  glyph: string;
  modifiers: Modifier;
  effects: Effect[];
};

export type Room = {
  id: string;
  blueprintId: string;
  origin: Cell;
  size: { w: number; h: number };
  contents: Item[];
  hp: number;
  level: number;
};

export type RoomStats = { maxHp: number; attack: number; defense: number };

export type Tower = {
  rooms: Room[];
  occupancy: Record<string, string>;
};

export type Wizard = {
  hp: number;
  maxHp: number;
  glyph: string;
  // v1 defense: room turrets are deferred, so the wizard auto-attacks the
  // nearest climbing enemy. This is what makes a taller approach worthwhile.
  attack: number;
  defense: number;
  dexterity: number;
  range: number;
  attackCooldown: number;
};

export type ExteriorFace = 'left' | 'right' | 'top';

export type ExteriorNode = { col: number; row: number; face: ExteriorFace };

export type MovementKind = 'under_overhang' | 'attack_overhang' | 'fly' | 'face_transfer';

export type MovementProfile = {
  kind: MovementKind;
  canPassUnderOverhang: boolean;
  canAttackOverhang: boolean;
  canFly: boolean;
  canTransferFaces: boolean;
};

export type EnemyTemplate = {
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
};

export type Enemy = {
  id: string;
  templateId: string;
  name: string;
  pos: ExteriorNode;
  path: ExteriorNode[];
  pathIndex: number;
  currentHp: number;
  moveCooldown: number;
  attackCooldown: number;
};

export type GameMessageKind = 'info' | 'combat' | 'economy';

export type GameMessage = { tick: number; text: string; kind: GameMessageKind };

export type Player = {
  currency: number;
  unlockedBlueprints: string[];
  levelIndex: number;
  wizard: Wizard;
};

export type ProgressionMode = 'linear' | 'branching';

export type Phase = 'build' | 'attack';

export type Scene = 'menu' | 'run' | 'gameOver' | 'victory';

export type GameState = {
  scene: Scene;
  phase: Phase;
  progressionMode: ProgressionMode;
  levelIndex: number;
  waveIndex: number;
  waveTimer: number;
  spawnTimer: number;
  spawnQueue: string[];
  tick: number;
  player: Player;
  tower: Tower;
  enemies: Enemy[];
  messages: GameMessage[];
  rngState: number;
  devMode: boolean;
};

export type PlacementReason =
  | 'ok'
  | 'out_of_bounds'
  | 'overlap'
  | 'no_support'
  | 'overhang_too_far'
  | 'disconnected';

export type PlacementResult = { ok: boolean; reason: PlacementReason };
