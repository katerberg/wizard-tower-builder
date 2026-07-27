/** Max Soak stacks on an enemy. */
export const MAX_SOAK = 100;
/** Half-life interval (seconds) — leisurely. */
export const SOAK_HALF_LIFE = 3;
/** Minimum speed multiplier at full Soak (never hard-root). */
export const SOAK_SPEED_FLOOR = 0.15;
/** Damp band: Soak > 0 and < this; damp+ for Geyser damage is Soak >= this. */
export const DAMP_THRESHOLD = 10;

/** Splash AoE Chebyshev radius (1 = 3×3). */
export const SPLASH_AOE_RADIUS = 1;
/** Soak applied per enemy hit by Splash. */
export const SPLASH_SOAK = 28;

/** Waterfall travel / push length (macro cells). */
export const WATERFALL_MAX_CELLS = 10;
/** Puddle lifetime from Waterfall terminus (seconds) — long-lived residue. */
export const WATERFALL_PUDDLE_LIFETIME = 30;
/** Seconds between each macro-cell sheet drip (wall cascade speed). */
export const SHEET_FLOW_INTERVAL = 0.28;

/** Deadweight AoE Chebyshev radius (1 = 3×3). */
export const DEADWEIGHT_AOE_RADIUS = 1;
/** Deadweight base damage (dry / low soak still chips). */
export const DEADWEIGHT_BASE_DAMAGE = 3;
/** Extra damage per real Soak point. */
export const DEADWEIGHT_DAMAGE_PER_SOAK = 0.22;
/** Fake Soak added to speed math only. */
export const DEADWEIGHT_FAKE_SOAK = 22;
/** Duration of Deadweight fake-Soak slow (seconds). */
export const DEADWEIGHT_DURATION = 2.5;

/** Geyser blast height (macro cells up from puddle). */
export const GEYSER_UP_CELLS = 3;
/** Damage to damp+ enemies. */
export const GEYSER_DAMAGE = 12;
/** Soak added to every unit hit (including dry). */
export const GEYSER_SOAK = 18;
/** Wizard friendly-fire when in geyser column. */
export const GEYSER_WIZARD_DAMAGE = 8;

/** Sheet wet lifetime on walls (seconds) — long enough to drip several cells. */
export const SHEET_LIFETIME = 2.8;
/** Default puddle lifetime (seconds). */
export const PUDDLE_LIFETIME = 7;
/** Soak gained when stepping onto a wet cell. */
export const WET_STEP_SOAK = 10;
/** Soak per second while standing in a puddle (tick). */
export const PUDDLE_SOAK_PER_SEC = 6;
/** Soak per second while in a flowing sheet. */
export const SHEET_SOAK_PER_SEC = 3;

/** Hydrant spray interval (seconds). */
export const HYDRANT_SPRAY_INTERVAL = 0.6;
