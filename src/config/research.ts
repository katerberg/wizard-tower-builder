/** Research room capacity and progress rates. */
export const RESEARCH_ROOM_STAFF_CAPACITY = 3;
/** Progress units per second from the first stationed mage (then efficiency curve). */
export const RESEARCH_PROGRESS_PER_SEC = 1;
/** Mage efficiency by station index (0-based), same spirit as mana springs. */
export const RESEARCH_MAGE_EFFICIENCY = [1, 0.8, 0.6] as const;
/** Max paid queue entries (excludes the active project). */
export const RESEARCH_QUEUE_CAP = 5;
/** Fraction of startCost refunded when cancelling the active project. */
export const RESEARCH_CANCEL_REFUND_RATE = 0.5;
