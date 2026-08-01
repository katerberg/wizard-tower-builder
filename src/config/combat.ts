import { SUB_CELLS_PER_MACRO, VIEWPORT_AIR_ROWS } from './grid';

// Spawn timing / caps.
export const SPAWN_INTERVAL_SWARM = 0.45;
export const SPAWN_INTERVAL_SKIRMISHER = 0.6;
export const SPAWN_INTERVAL_ELITE = 7.5;
export const SPAWN_INTERVAL_BRUTE = 10.5;
export const SPAWN_INTERVAL_STRIKER = 2.5;
export const SPAWN_INTERVAL_KAMIKAZE = 3.5;
export const SPAWN_INTERVAL_CARRIER = 12;
export const MAX_LIVE_ENEMIES = 80;
export const ENEMY_ATTACK_COOLDOWN = 1.0;

/** Preferred air standoff from tower silhouette (macro cells). */
export const FLY_STANDOFF_MIN = 1;
export const FLY_STANDOFF_MAX = 3;
/** Extra sub-rows above the wizard perch for flier / gust travel. */
export const FLY_BOUNDS_EXTRA_SUB_ROWS = VIEWPORT_AIR_ROWS * SUB_CELLS_PER_MACRO;
/** Carrier hover band: stop advancing when this close (macro Manhattan). */
export const CARRIER_HOVER_MACRO_RANGE = 4;
/** Seconds between carrier drone launches. */
export const CARRIER_LAUNCH_INTERVAL = 3.0;
/** Carrier drones self-destruct after this many macro cells moved. */
export const CARRIER_KAMIKAZE_LIFETIME_MACRO = 3;

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

/** Shared mana pool cap (spells, boilers, springs/turrets). */
export const MAX_MANA = 20;

export const MAGIC_TURRET_MANA_COST = 1;
