export const CELL_SIZE = 48;
/** Sub-cells per macro cell edge — movement uses the finer grid; build/spells stay macro. */
export const SUB_CELLS_PER_MACRO = 3;
export const SUB_CELL_SIZE = CELL_SIZE / SUB_CELLS_PER_MACRO;
export const SUB_GRID_COLS = 16 * SUB_CELLS_PER_MACRO;

export const FIXED_DT = 1 / 60;
export const MAX_FRAME_TIME = 0.25;
/** Attack-phase sim steps per frame (supports sim speed up to 4×). */
export const MAX_STEPS_PER_FRAME = 4;

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
export const SPAWN_INTERVAL_SWARM = 0.45;
export const SPAWN_INTERVAL_SKIRMISHER = 0.6;
export const SPAWN_INTERVAL_ELITE = 7.5;
export const SPAWN_INTERVAL_BRUTE = 10.5;
export const MAX_LIVE_ENEMIES = 80;
export const ENEMY_ATTACK_COOLDOWN = 1.0;

// Infrastructure & staff (housing → workplaces).
export const GUARDROOM_BASE_CAPACITY = 3;
export const GUARDROOM_EXPANDED_CAPACITY = 6;
export const CHAMBER_BASE_CAPACITY = 1;
export const CHAMBER_EXPANDED_CAPACITY = 2;
export const QUARTERS_BASE_CAPACITY = 6;
export const QUARTERS_EXPANDED_CAPACITY = 12;
export const SLOT_BASE_CAPACITY = 2;
export const SLOT_EXPANDED_CAPACITY = 4;
/** Magi headcount cap per mana spring. */
export const MANA_SPRING_STAFF_CAPACITY = 5;
/** Regen contribution by mage index in a spring (0-based). */
export const MANA_SPRING_MAGE_EFFICIENCY = [1, 0.8, 0.6, 0.4, 0.2] as const;

export const SOLDIER_RECRUIT_COST = 4;
export const SOLDIER_UPKEEP_COST = 2;
export const MAGE_RECRUIT_COST = 5;
export const MAGE_UPKEEP_COST = 2;
export const LABORER_RECRUIT_COST = 3;
export const LABORER_UPKEEP_COST = 1;
/** HP restored per second by the first laborer on a damaged room. */
export const LABORER_REPAIR_HP_PER_SEC = 2;

export const STAFF_HORIZONTAL_SPEED = 2;
export const STAFF_STAIR_SPEED = 0.4;
/** @deprecated Use STAFF_HORIZONTAL_SPEED. */
export const SOLDIER_HORIZONTAL_SPEED = STAFF_HORIZONTAL_SPEED;
/** @deprecated Use STAFF_STAIR_SPEED. */
export const SOLDIER_STAIR_SPEED = STAFF_STAIR_SPEED;

export const SLOT_BASE_DAMAGE = 5;
export const SLOT_ATTACK_COOLDOWN = 0.9;
export const SLOT_ATTACK_RANGE = 3;
/** Fire contribution by soldier index (0-based) in a slot. */
export const SLOT_FIRE_EFFICIENCY = [1, 0.8, 0.7, 0.6] as const;

export const WIZARD_DEFAULTS = {
  maxHp: 30,
  attack: 6,
  defense: 0,
  dexterity: 3,
  range: 1,
  attackCooldown: 0.6,
} as const;

/** Shared mana pool cap (spells, boilers, future springs/turrets). */
export const MAX_MANA = 20;

// Pipes / boilers / steam (PIPES.md).
export const BOILER_MANA_PER_SEC = 0.25;
export const MANA_SPRING_PER_SEC = 0.5;
export const STEAM_TURRET_CHARGE_SEC = 3;
export const STEAM_TURRET_DAMAGE = 10;
/** Exterior blast depth (cells outward) and perpendicular width is 3. */
export const STEAM_TURRET_BLAST_DEPTH = 3;
export const MAGIC_TURRET_MANA_COST = 1;
/** Throughput units by boilerExpansion level (0 = base, 1–2 = upgrades). */
export const BOILER_THROUGHPUT = [3, 4, 5] as const;

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
  ghostInvalid: '#ff3b3b',
  spellValid: '#dd6b20',
  spellInvalid: '#742a2a',
  spellAim: 'rgba(221, 107, 32, 0.55)',
  spellAimOut: 'rgba(197, 48, 48, 0.5)',
  kindlingPatch: 'rgba(236, 201, 75, 0.65)',
  wallFlame: 'rgba(221, 107, 32, 0.45)',
  tornadoLane: 'rgba(144, 205, 244, 0.5)',
  blizzardZone: 'rgba(186, 230, 253, 0.35)',
  mana: '#63b3ed',
  wizard: '#f6e05e',
  enemy: '#fc8181',
  hpBar: '#48bb78',
  hpBarBg: '#2d3748',
  text: '#e2e8f0',
  pathDebug: '#63b3ed',
  infraStair: '#a0aec0',
  infraPipe: '#4299e1',
  /** Pipe not yet connected to a water (or steam) seed. */
  infraPipeDry: '#718096',
  infraPipeSteam: '#ed8936',
  soldier: '#68d391',
  mage: '#b794f4',
  laborer: '#f6ad55',
  connectivityWarn: '#ff5c5c',
} as const;

/** Workers-layer glyph per staff kind. */
export const STAFF_GLYPHS = {
  soldier: '↑',
  mage: '*',
  laborer: '·',
} as const;
