import { STAFF_ELEVATOR_SPEED, STAFF_HORIZONTAL_SPEED, STAFF_STAIR_SPEED } from './staff';

/** Wizard walks at 2× staff speeds (macro cells per second). */
export const WIZARD_HORIZONTAL_SPEED = STAFF_HORIZONTAL_SPEED * 2;
export const WIZARD_STAIR_SPEED = STAFF_STAIR_SPEED * 2;
/** Elevator ride uses the shared car speed. */
export const WIZARD_ELEVATOR_SPEED = STAFF_ELEVATOR_SPEED;
/** Sub-cell steps per second while Flight air-pathing. */
export const WIZARD_FLIGHT_SPEED = 8;
/** Sub-rows descended per second while falling after Flight / collapse. */
export const WIZARD_FALL_SPEED = 10;

/** Reserved elevator passenger id for the wizard avatar. */
export const WIZARD_PASSENGER_ID = 'wizard';

export const SOLAR_COLLECTOR_DEFAULTS = {
  maxHp: 30,
  glyph: '◎',
} as const;
