/** Placeholder Charge cap — tune in playtest (E13). */
export const MAX_CHARGE = 5;
/** Charge gained each time an enemy passes a Fault cell. */
export const FAULT_CHARGE_PER_PASS = 1;
/** Fault patch lifetime (seconds). */
export const FAULT_PATCH_DURATION = 15;
/** Fortify Charge build rate (Charge per second). */
export const FORTIFY_CHARGE_PER_SEC = 1;
/** Incoming damage multiplier while Fortified. */
export const FORTIFY_DAMAGE_MULT = 0.25;
/** Boulder impact delay (seconds). */
export const BOULDER_DELAY = 0.5;
/** Base boulder damage per Charge spent at impact. */
export const BOULDER_DAMAGE_PER_CHARGE = 8;
/** Crash damage for miss-fall (scaled by Charge at cast). */
export const BOULDER_CRASH_DAMAGE_PER_CHARGE = 6;
/** Earthquake enemy damage per Charge along path. */
export const QUAKE_ENEMY_DAMAGE_PER_CHARGE = 10;
/** Tip segment multiplies enemy Quake damage. */
export const QUAKE_TIP_DAMAGE_MULT = 1.5;
/** Fraction of room maxHp removed per Quake (~3 Quakes to collapse). */
export const QUAKE_ROOM_HP_FRACTION = 1 / 3;
