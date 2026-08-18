/** Mine geography / shallow stone harvest knobs (provisional). */

/** How many rows below ground the starter shallow shaft digs (rows -1 .. -depth). */
export const MINE_SHALLOW_DEPTH = 4;

/** Starting units on each shallow stone patch (high availability). */
export const MINE_STONE_PATCH_UNITS = 480;

/** Per laborer on a stone patch: stone units per second (no metal split). */
export const MINE_STONE_HARVEST_PER_SEC = 1;

/** Prospect equip cost charged at wave start when prospectAllocation > 0. */
export const PROSPECT_EQUIP_COST = { stone: 5, metal: 1 } as const;

/** Max prospectors allowed (clamped to recruited laborers). */
export const PROSPECT_MAX_ALLOCATION = 6;

/** Prospect work time in seconds (scales with depth). */
export const PROSPECT_WORK_TIME_BASE = 8;
export const PROSPECT_WORK_TIME_PER_DEPTH = 2;

/** Quality band weights for prospect roll: [poor, mixed, rich]. */
export const PROSPECT_QUALITY_WEIGHTS = [0.55, 0.35, 0.10] as const;

/** Diminishing returns multiplier per additional laborer on same metal/gold patch. */
export const RARE_PATCH_FALLOFF = 0.5;

/** Passive iron drip while working stone (fraction of stone harvest → metal). */
export const PASSIVE_IRON_FRACTION = 0.03;
