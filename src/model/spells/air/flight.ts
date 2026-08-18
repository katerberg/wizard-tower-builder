import { FLIGHT_ASCENT_SUB_ROWS, FLIGHT_DURATION } from './constants';
import { ensureWizardAvatar, beginWizardFall } from '@/model/wizard';
import type { SpellDef } from '../types';

export { getEffectiveWizardPosition } from '@/model/wizard';

export function startFlight(state: import('@/model/types').GameState, ascentSubRows: number): void {
  const avatar = ensureWizardAvatar(state);
  avatar.pos = {
    ...avatar.pos,
    row: avatar.pos.row + ascentSubRows,
    face: 'air',
  };
  avatar.path = [];
  avatar.pathIndex = 0;
  avatar.macroPath = [];
  avatar.macroPathIndex = 0;
  avatar.status = 'flying';
  state.wizardFlight = {
    until: state.waveTimer + FLIGHT_DURATION,
  };
  void ascentSubRows;
}

export function tickWizardFlight(
  state: import('@/model/types').GameState,
): void {
  if (!state.wizardFlight) return;
  if (state.waveTimer >= state.wizardFlight.until) {
    beginWizardFall(state);
  }
}

export function clearWizardFlight(state: import('@/model/types').GameState): void {
  delete state.wizardFlight;
}

export const flight: SpellDef = {
  id: 'flight',
  name: 'Flight',
  glyph: 'F',
  description:
    'Take flight for a short time. Click to path through open air; when it ends, fall to a standable interior cell with no damage.',
  manaCost: 3,
  cooldown: 5,
  targeting: 'self',
  range: 0,
  damage: 0,
  cast(ctx) {
    const avatar = ensureWizardAvatar(ctx.state);
    avatar.pos = {
      ...avatar.pos,
      row: avatar.pos.row + FLIGHT_ASCENT_SUB_ROWS,
      face: 'air',
    };
    avatar.path = [];
    avatar.pathIndex = 0;
    avatar.macroPath = [];
    avatar.macroPathIndex = 0;
    avatar.status = 'flying';
    avatar.moveCooldown = 0;
    ctx.state.wizardFlight = {
      until: ctx.state.waveTimer + FLIGHT_DURATION,
    };
    ctx.log('The wizard takes flight.', 'combat');
  },
};
