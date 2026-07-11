import type { SpellDef } from './types';
import { FLIGHT_ASCENT_SUB_ROWS, FLIGHT_DURATION } from './air/constants';
import { getWizardPosition } from '../tower';

export const flight: SpellDef = {
  id: 'flight',
  name: 'Flight',
  glyph: 'F',
  description: 'Levitate off the perch. Cast other spells while airborne; drift down to a standable cell when it ends.',
  manaCost: 3,
  cooldown: 5,
  targeting: 'self',
  range: 0,
  damage: 0,
  cast(ctx) {
    const perch = getWizardPosition(ctx.state.tower);
    ctx.state.wizardFlight = {
      pos: { ...perch, row: perch.row + FLIGHT_ASCENT_SUB_ROWS },
      until: ctx.state.waveTimer + FLIGHT_DURATION,
      descending: false,
    };
    ctx.log('The wizard takes flight.', 'combat');
  },
};
