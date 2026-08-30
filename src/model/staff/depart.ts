import {
  STAFF_DEPART_STAGGER_MAX_SEC,
  STAFF_DEPART_STAGGER_SEC,
} from '@/config/staff';

/** Departure delay for the Nth unit in a same-tick spawn/path-assign batch. */
export function departCooldownForIndex(index: number): number {
  if (index <= 0) return 0;
  return Math.min(index * STAFF_DEPART_STAGGER_SEC, STAFF_DEPART_STAGGER_MAX_SEC);
}
