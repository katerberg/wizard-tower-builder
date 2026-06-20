export const CELL_SIZE = 48;
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_TIME = 0.25;

export const GRID_COLS = 16;
export const GRID_ROWS = 12;

export const STARTING_CURRENCY = 48;

export const MAX_OVERHANG_STEP = 1;
export const MIN_STABILIZER_WIDTH = 2;

// Gameplay tuning (attack phase).
export const SPAWN_INTERVAL = 0.8;
export const ENEMY_ATTACK_COOLDOWN = 1.0;

export const WIZARD_DEFAULTS = {
  maxHp: 30,
  attack: 6,
  defense: 0,
  dexterity: 3,
  range: 4,
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
} as const;
