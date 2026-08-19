/** @deprecated Prefer STARTING_RESOURCES.gold */
export const STARTING_CURRENCY = 48;

/** Starting wallet for a new run (provisional balance). Stone/metal live in storage rooms. */
export const STARTING_RESOURCES = {
  gold: 48,
  metal: 0,
  stone: 0,
  souls: 30,
} as const;

/**
 * Multiplier applied to stone-built blueprint base HP so wear is attrition.
 * Tune in playtest — not a literal 100× lock.
 */
export const WEAR_HP_SCALE = 10;
/** Passive weathering HP/sec on each stone-built room or structure. */
export const WEATHERING_HP_PER_SEC = 0; // TEMP: disabled for debugging
/** HP removed from stone-built framing/room when a climber abrades its cell. */
export const ABRASION_HP_PER_STEP = 0; // TEMP: disabled for debugging

/** Max water-pipe row reachable with at least one hand-pump laborer (no pump rooms). */
export const HAND_PUMP_MAX_WATER_ROW = 3;
/** Without hand-pump laborers, water only reaches ground row. */
export const GROUND_WATER_MAX_ROW = 0;
/** Each pump room extends the water height band by this many rows. */
export const PUMP_WATER_ROW_EXTENSION = 4;
/** Laborers reserved for hand-pump when water consumers need the band. */
export const HAND_PUMP_LABORER_RESERVE = 1;
