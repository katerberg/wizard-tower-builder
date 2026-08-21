import { LEYLINE_RESEARCH_STAFF_CAP, tierForBandRow } from '@/config/spellProgression';
import { stationedMagiInRoom } from '@/model/staff/combat';
import {
  bandRowForRoom,
  completeLeylineTier,
  isLeylineResearchRoom,
  isLeylineTierCompleted,
  priorTierComplete,
} from '@/model/spells/progression';
import type { RoomBehaviorDef } from './types';

export { isLeylineResearchRoom } from '@/model/spells/progression';

/**
 * On wave clear: if a mage is still stationed and prior tiers are done,
 * mark this band's leyline tier complete (spell stays while the room stands).
 */
export const leylineResearchRoom: RoomBehaviorDef = {
  blueprintId: 'leylineResearchRoom',
  mechanics: `Station one mage (cap ${LEYLINE_RESEARCH_STAFF_CAP}) and clear the night to awaken the next school spell for this leyline band.`,
  roles: ['leyline'],
  onWaveCleared(ctx) {
    const { state, room } = ctx;
    if (!isLeylineResearchRoom(room)) return;
    const band = bandRowForRoom(room);
    if (band === null) return;
    const tier = tierForBandRow(band);
    if (tier === null) return;
    if (isLeylineTierCompleted(state, tier)) return;
    if (!priorTierComplete(state, tier)) return;
    if (stationedMagiInRoom(state, room.id).length < 1) return;
    completeLeylineTier(state, tier);
  },
};
