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

export const WIZARD_DEFAULTS = {
  maxHp: 30,
  attack: 6,
  defense: 0,
  dexterity: 3,
  range: 1,
  attackCooldown: 0.6,
} as const;

export const MAX_MANA = 10;

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
  spellValid: '#dd6b20',
  spellInvalid: '#742a2a',
  spellAim: 'rgba(221, 107, 32, 0.55)',
  spellAimOut: 'rgba(197, 48, 48, 0.5)',
  mana: '#63b3ed',
  wizard: '#f6e05e',
  enemy: '#fc8181',
  hpBar: '#48bb78',
  hpBarBg: '#2d3748',
  text: '#e2e8f0',
  pathDebug: '#63b3ed',
} as const;
