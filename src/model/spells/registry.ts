import { blizzard } from './air/blizzard';
import { gust } from './air/gust';
import { flight } from './air/flight';
import { tornado } from './air/tornado';
import { boulder } from './earth/boulder';
import { earthquake } from './earth/earthquake';
import { fault } from './earth/fault';
import { fortify } from './earth/fortify';
import { fireball } from './fire/fireball';
import { immolate } from './fire/immolate';
import { kindling } from './fire/kindling';
import { wallOfFlame } from './fire/wallOfFlame';
import { deadweight } from './water/deadweight';
import { geyser } from './water/geyser';
import { splash } from './water/splash';
import { waterfall } from './water/waterfall';
import { wandStrike } from './wandStrike';
import type { SpellDef } from './types';
import type { GameState, SpellSchool } from '../types';

/** Hotbar order for each school. Add new spell ids here. */
export const FIRE_HOTBAR_SPELL_IDS = ['fireball', 'immolate', 'wallOfFlame', 'kindling'] as const;
export const AIR_HOTBAR_SPELL_IDS = ['gust', 'tornado', 'flight', 'blizzard'] as const;
export const EARTH_HOTBAR_SPELL_IDS = ['fault', 'fortify', 'boulder', 'earthquake'] as const;
export const WATER_HOTBAR_SPELL_IDS = ['splash', 'waterfall', 'deadweight', 'geyser'] as const;
export const HOTBAR_SLOT_COUNT = 6;

/** Master spell list. Register new SpellDefs here. */
const SPELLS: SpellDef[] = [
  fireball,
  immolate,
  wallOfFlame,
  kindling,
  gust,
  tornado,
  flight,
  blizzard,
  fault,
  fortify,
  boulder,
  earthquake,
  splash,
  waterfall,
  deadweight,
  geyser,
  wandStrike,
];

export function getSpell(id: string): SpellDef | undefined {
  return SPELLS.find((s) => s.id === id);
}

export function hotbarSpellIdsForSchool(school: SpellSchool): readonly string[] {
  if (school === 'air') return AIR_HOTBAR_SPELL_IDS;
  if (school === 'earth') return EARTH_HOTBAR_SPELL_IDS;
  if (school === 'water') return WATER_HOTBAR_SPELL_IDS;
  return FIRE_HOTBAR_SPELL_IDS;
}

export function listHotbarSpells(state: GameState): SpellDef[] {
  return hotbarSpellIdsForSchool(state.activeSpellSchool)
    .map((id) => getSpell(id))
    .filter((s): s is SpellDef => !!s);
}

export function listAutoSpells(): SpellDef[] {
  return SPELLS.filter((s) => s.autoCast);
}
