export const CELL_SIZE = 48;
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_TIME = 0.25;
/** Keep visuals and log in 1:1 with simulation during attack (no catch-up bursts). */
export const MAX_STEPS_PER_FRAME = 1;

export const GRID_COLS = 16;
/** Minimum visible rows when the stage is very short (does not cap tower height). */
export const MIN_VIEWPORT_ROWS = 3;
/** Empty rows visible above the highest block when scrolled to the top. */
export const VIEWPORT_AIR_ROWS = 8;

export const STARTING_CURRENCY = 48;

export const MAX_OVERHANG_STEP = 1;
/** Minimum width for a buttress room (spire blocks are always 1-wide). */
export const MIN_BUTTRESS_WIDTH = 2;

// Gameplay tuning (attack phase).
export const SPAWN_INTERVAL = 0.8;
export const ENEMY_ATTACK_COOLDOWN = 1.0;

// Infrastructure & soldiers.
export const BARRACKS_BASE_CAPACITY = 5;
export const BARRACKS_EXPANDED_CAPACITY = 10;
export const SLOT_BASE_CAPACITY = 2;
export const SLOT_EXPANDED_CAPACITY = 4;
export const SOLDIER_RECRUIT_COST = 4;
export const SOLDIER_UPKEEP_COST = 2;
export const SOLDIER_HORIZONTAL_SPEED = 2;
export const SOLDIER_STAIR_SPEED = 0.4;
export const SLOT_BASE_DAMAGE = 5;
export const SLOT_ATTACK_COOLDOWN = 0.9;
export const SLOT_ATTACK_RANGE = 3;
/** Fire contribution by soldier index (1-based) in a slot. */
export const SLOT_FIRE_EFFICIENCY = [1, 0.8, 0.7, 0.6] as const;

export const WIZARD_DEFAULTS = {
  maxHp: 30,
  attack: 6,
  defense: 0,
  dexterity: 3,
  range: 1,
  attackCooldown: 0.6,
} as const;

export const symbols = {
  wizard: '@',
  ground: '=',
  empty: '.',
} as const;

export const colors = {
  background: '#0d1117',
  grid: '#1f2630',
  ground: '#3a2e22',
  room: '#4a5568',
  roomStroke: '#9aa5b1',
  ghostValid: '#2f855a',
  ghostInvalid: '#c53030',
  wizard: '#f6e05e',
  enemy: '#fc8181',
  hpBar: '#48bb78',
  hpBarBg: '#2d3748',
  text: '#e2e8f0',
  pathDebug: '#63b3ed',
  infraStair: '#a0aec0',
  infraPipe: '#4299e1',
  soldier: '#68d391',
  connectivityWarn: '#ed8936',
} as const;
