// Housing / workplace capacity.
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
/** Elevator car vertical speed (~5× stairs). */
export const STAFF_ELEVATOR_SPEED = 2;
/** Max staff riding one elevator car. */
export const ELEVATOR_CAPACITY = 6;
/** @deprecated Use STAFF_HORIZONTAL_SPEED. */
export const SOLDIER_HORIZONTAL_SPEED = STAFF_HORIZONTAL_SPEED;
/** @deprecated Use STAFF_STAIR_SPEED. */
export const SOLDIER_STAIR_SPEED = STAFF_STAIR_SPEED;
